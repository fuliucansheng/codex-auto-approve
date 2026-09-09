import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const installCalls = [
  ['plugin', 'marketplace', 'add', 'fuliucansheng/codex-auto-approve'],
  ['plugin', 'add', 'auto-approve@codex-auto-approve'],
];
export const posix = process.platform !== 'win32';

export function installFixture(t, enabled = false) {
  const directory = mkdtempSync(join(tmpdir(), 'codex-install-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const home = join(directory, 'home with spaces');
  const bin = join(directory, 'fake bin');
  const codexHome = join(directory, 'codex home');
  for (const path of [home, bin, codexHome]) mkdirSync(path);
  symlinkSync(process.execPath, join(bin, 'node'));
  const config = join(codexHome, 'config.toml');
  writeFileSync(config, '# isolated config sentinel\n');
  const stateDirectory = join(home, '.local/state/codex-auto-approve');
  const state = join(stateDirectory, 'enabled.json');
  const stateContents = '{ "enabled": true, "sentinel": "preserve bytes" }\n';
  if (enabled) {
    mkdirSync(stateDirectory, { recursive: true });
    writeFileSync(state, stateContents, { mode: 0o600 });
  }
  const log = join(directory, 'calls.jsonl');
  const executable = join(bin, 'codex');
  writeFileSync(executable, `#!/usr/bin/env node
const fs = require('node:fs');
const env = process.env;
const step = fs.existsSync(env.INSTALL_TEST_LOG) ? 2 : 1;
fs.appendFileSync(env.INSTALL_TEST_LOG, JSON.stringify({
  args: process.argv.slice(2), cwd: process.cwd(),
  home: env.HOME, userprofile: env.USERPROFILE, codexHome: env.CODEX_HOME,
  sentinel: env.INSTALL_TEST_SENTINEL,
  input: step === 1 ? fs.readFileSync(0, 'utf8') : null,
}) + '\\n');
console.log('codex stdout ' + step);
console.error('codex stderr ' + step);
if (String(step) === env.INSTALL_TEST_FAIL_STEP) {
  if (env.INSTALL_TEST_SIGNAL) process.kill(process.pid, 'SIGTERM');
  else process.exit(Number(env.INSTALL_TEST_EXIT));
}
`, { mode: 0o755 });
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
    !/^(npm_|CODEX_|XDG_)/i.test(key) && !/^(NODE_AUTH_TOKEN|NODE_OPTIONS|NODE_PATH)$/i.test(key)));
  Object.assign(env, {
    HOME: home, USERPROFILE: home, CODEX_HOME: codexHome,
    XDG_CONFIG_HOME: join(home, '.config'), XDG_STATE_HOME: join(home, '.local/state'),
    XDG_CACHE_HOME: join(home, '.cache'), XDG_DATA_HOME: join(home, '.local/share'),
    PATH: bin, NODE_OPTIONS: '', NODE_PATH: '',
    npm_config_userconfig: join(directory, 'user.npmrc'),
    npm_config_globalconfig: join(directory, 'global.npmrc'),
    npm_config_cache: join(directory, 'npm-cache'),
    INSTALL_TEST_LOG: log, INSTALL_TEST_SENTINEL: 'literal $HOME ; & value',
  });
  writeFileSync(env.npm_config_userconfig, '');
  writeFileSync(env.npm_config_globalconfig, '');
  function run(command, args) {
    const result = spawnSync(command, args, {
      cwd: home, env, encoding: 'utf8', input: 'interactive input\n', timeout: 10_000,
    });
    assert.ifError(result.error);
    assert.equal(result.signal, null);
    return result;
  }
  function calls() {
    return existsSync(log) ? readFileSync(log, 'utf8').trim().split('\n').map(JSON.parse) : [];
  }
  function unchanged() {
    assert.equal(readFileSync(config, 'utf8'), '# isolated config sentinel\n');
    if (enabled) assert.equal(readFileSync(state, 'utf8'), stateContents);
    else assert.equal(existsSync(stateDirectory), false);
  }
  return { env, home, codexHome, executable, run, calls, unchanged };
}

export function assertInstallSuccess(f, result) {
  assert.equal(result.status, 0, result.stderr);
  const calls = f.calls();
  assert.deepEqual(calls.map(({ args }) => args), installCalls);
  for (const call of calls) {
    assert.equal(call.cwd, realpathSync(f.home));
    assert.equal(call.home, f.home);
    assert.equal(call.userprofile, f.home);
    assert.equal(call.codexHome, f.codexHome);
    assert.equal(call.sentinel, f.env.INSTALL_TEST_SENTINEL);
  }
  assert.equal(calls[0].input, 'interactive input\n');
  assert.match(result.stdout, /codex stdout 1\ncodex stdout 2\n/);
  assert.equal(result.stderr, 'codex stderr 1\ncodex stderr 2\n');
  assert.match(result.stdout, /installed/i);
  assert.match(result.stdout, /restart.*new.*conversation/i);
  f.unchanged();
}
