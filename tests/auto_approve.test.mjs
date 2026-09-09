import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  closeSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repository = fileURLToPath(new URL('../', import.meta.url));
const plugin = join(repository, 'plugins', 'auto-approve');
const controller = join(plugin, 'scripts', 'auto_approve.js');
const permissionRequest = JSON.stringify({
  hook_event_name: 'PermissionRequest',
  tool_name: 'shell',
  tool_input: { command: 'example command' },
});
const allowOutput = '{"hookSpecificOutput":{"hookEventName":"PermissionRequest","decision":{"behavior":"allow"}}}\n';
const enableOutput = 'Auto Approve: enabled (all supported permission requests are allowed).\n';
const disableOutput = 'Auto Approve: disabled (Codex will request approval normally).\n';
const disabledOutput = 'Auto Approve: disabled\n';
const enabledOutput = 'Auto Approve: enabled\n';
const usageOutput = 'Usage: auto_approve.js {enable|disable|status}\n';
const posix = process.platform !== 'win32';
const permissionChecks = posix && process.getuid?.() !== 0;

// Every controller and shell process receives its own temporary HOME and
// USERPROFILE, including negative tests and copies of the packaged plugin.
function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), 'codex-auto-approve-test-'));
  const home = join(directory, 'home');
  mkdirSync(home, { mode: 0o700 });
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const stateDirectory = join(home, '.local', 'state', 'codex-auto-approve');
  const stateFile = join(stateDirectory, 'enabled.json');
  const env = {
    ...process.env,
    HOME: home,
    USERPROFILE: home,
    PATH: `${dirname(process.execPath)}${delimiter}${process.env.PATH ?? ''}`,
    NODE_OPTIONS: '',
    NODE_PATH: '',
  };
  function run(args, options = {}) {
    const { script = controller, ...stdioOptions } = options;
    return spawnSync(process.execPath, [script, ...args], {
      cwd: home,
      env,
      encoding: 'utf8',
      timeout: 10_000,
      ...stdioOptions,
    });
  }
  function writeState(contents) {
    mkdirSync(stateDirectory, { recursive: true, mode: 0o700 });
    writeFileSync(stateFile, contents, { mode: 0o600 });
  }
  return { directory, home, stateDirectory, stateFile, env, run, writeState };
}

function resultIs(result, status, stdout, stderr = '') {
  assert.ifError(result.error);
  assert.equal(result.signal, null);
  assert.equal(result.status, status, result.stderr);
  assert.equal(result.stdout, stdout);
  assert.equal(result.stderr, stderr);
}

function failsWithoutSuccess(result) {
  assert.ifError(result.error);
  assert.equal(result.signal, null);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /^Auto Approve: /);
}

for (const args of [[], ['unknown'], ['ENABLE'], ['--help'], [''],
  ['enable', 'extra'], ['disable', 'extra'], ['status', 'extra'], ['hook', 'extra']]) {
  test(`invalid arguments ${JSON.stringify(args)} exit 2 without changing state`, (t) => {
    const f = fixture(t);
    resultIs(f.run(args), 2, '', usageOutput);
    assert.equal(existsSync(f.stateDirectory), false);
    f.writeState('{"enabled":true}\n');
    resultIs(f.run(args), 2, '', usageOutput);
    assert.equal(readFileSync(f.stateFile, 'utf8'), '{"enabled":true}\n');
  });
}

test('enable, status, hook, and disable preserve exact output and exit codes', (t) => {
  const f = fixture(t);
  resultIs(f.run(['status']), 1, disabledOutput);
  resultIs(f.run(['hook'], { input: permissionRequest }), 0, '');
  assert.equal(existsSync(f.stateDirectory), false);
  resultIs(f.run(['enable']), 0, enableOutput);
  assert.equal(readFileSync(f.stateFile, 'utf8'), '{"enabled":true}\n');
  resultIs(f.run(['status']), 0, enabledOutput);
  resultIs(f.run(['hook'], { input: permissionRequest }), 0, allowOutput);
  resultIs(f.run(['disable']), 0, disableOutput);
  assert.equal(existsSync(f.stateFile), false);
  resultIs(f.run(['status']), 1, disabledOutput);
  resultIs(f.run(['hook'], { input: permissionRequest }), 0, '');
});

test('disable is idempotent and never creates state or removes unrelated files', (t) => {
  const f = fixture(t);
  resultIs(f.run(['disable']), 0, disableOutput);
  resultIs(f.run(['disable']), 0, disableOutput);
  assert.equal(existsSync(f.stateDirectory), false);
  resultIs(f.run(['enable']), 0, enableOutput);
  const unrelated = join(f.stateDirectory, 'keep.txt');
  writeFileSync(unrelated, 'keep');
  resultIs(f.run(['disable']), 0, disableOutput);
  resultIs(f.run(['disable']), 0, disableOutput);
  assert.equal(readFileSync(unrelated, 'utf8'), 'keep');
});

test('explicit enable replaces corrupt state and is repeatable', (t) => {
  const f = fixture(t);
  f.writeState('broken');
  resultIs(f.run(['enable']), 0, enableOutput);
  resultIs(f.run(['enable']), 0, enableOutput);
  assert.equal(readFileSync(f.stateFile, 'utf8'), '{"enabled":true}\n');
  resultIs(f.run(['status']), 0, enabledOutput);
});

test('existing enabled.json with boolean true remains compatible', (t) => {
  const f = fixture(t);
  const existingState = ' { "enabled": true, "extra": "preserved" } \n';
  f.writeState(existingState);
  resultIs(f.run(['status']), 0, enabledOutput);
  resultIs(f.run(['hook'], { input: permissionRequest }), 0, allowOutput);
  assert.equal(readFileSync(f.stateFile, 'utf8'), existingState);
});

const disabledStates = [
  ['missing', undefined],
  ['empty', ''],
  ['corrupt', '{'],
  ['trailing data', '{"enabled":true} extra'],
  ['byte order mark', '\ufeff{"enabled":true}'],
  ['null', 'null'],
  ['array', '[]'],
  ['array containing enabled object', '[{"enabled":true}]'],
  ['boolean', 'true'],
  ['number', '1'],
  ['string', '"enabled"'],
  ['missing enabled key', '{}'],
  ['wrong key case', '{"Enabled":true}'],
  ['false', '{"enabled":false}'],
  ['string true', '{"enabled":"true"}'],
  ['number one', '{"enabled":1}'],
  ['number zero', '{"enabled":0}'],
  ['null enabled', '{"enabled":null}'],
  ['object enabled', '{"enabled":{}}'],
  ['array enabled', '{"enabled":[]}'],
  ['prototype key', '{"__proto__":{"enabled":true}}'],
  ['invalid UTF-8', Buffer.concat([
    Buffer.from('{"enabled":true,"extra":"'), Buffer.from([0xff]), Buffer.from('"}'),
  ])],
];
for (const [label, contents] of disabledStates) {
  test(`${label} state stays disabled and the hook silently fails closed`, (t) => {
    const f = fixture(t);
    if (contents !== undefined) f.writeState(contents);
    resultIs(f.run(['status']), 1, disabledOutput);
    resultIs(f.run(['hook'], { input: permissionRequest }), 0, '');
    if (contents === undefined) {
      assert.equal(existsSync(f.stateDirectory), false);
    } else {
      assert.deepEqual(readFileSync(f.stateFile), Buffer.from(contents));
    }
  });
}

for (const event of [{}, { hook_event_name: 'PreToolUse' },
  { hook_event_name: 'PostToolUse' }, { hook_event_name: 'permissionrequest' },
  { hook_event_name: null }, { hook_event_name: true },
  { hook_event_name: ['PermissionRequest'] }, { hookEventName: 'PermissionRequest' }]) {
  test(`other event ${JSON.stringify(event)} does not allow even when enabled`, (t) => {
    const f = fixture(t);
    f.writeState('{"enabled":true}\n');
    resultIs(f.run(['hook'], { input: JSON.stringify(event) }), 0, '');
    assert.equal(readFileSync(f.stateFile, 'utf8'), '{"enabled":true}\n');
  });
}

const invalidInputs = [
  ['empty', ''], ['whitespace', ' \n\t'], ['malformed', '{'],
  ['trailing JSON', `${permissionRequest}\n{}`],
  ['null', 'null'], ['array', '[]'], ['event array', `[${permissionRequest}]`],
  ['string', '"PermissionRequest"'], ['boolean', 'true'], ['number', '1'],
  ['byte order mark', `\ufeff${permissionRequest}`],
  ['invalid UTF-8', Buffer.concat([
    Buffer.from('{"hook_event_name":"PermissionRequest","extra":"'),
    Buffer.from([0xff]), Buffer.from('"}'),
  ])],
];
for (const [label, input] of invalidInputs) {
  test(`${label} hook input silently no-ops even when enabled`, (t) => {
    const f = fixture(t);
    f.writeState('{"enabled":true}\n');
    resultIs(f.run(['hook'], { input }), 0, '');
    assert.equal(readFileSync(f.stateFile, 'utf8'), '{"enabled":true}\n');
  });
}

test('a directory in place of the state file fails closed and controller writes fail', (t) => {
  const f = fixture(t);
  mkdirSync(f.stateFile, { recursive: true });
  resultIs(f.run(['status']), 1, disabledOutput);
  resultIs(f.run(['hook'], { input: permissionRequest }), 0, '');
  failsWithoutSuccess(f.run(['enable']));
  failsWithoutSuccess(f.run(['disable']));
  assert.equal(statSync(f.stateFile).isDirectory(), true);
});

test('a file blocking the state directory fails closed and cannot be enabled', (t) => {
  const f = fixture(t);
  mkdirSync(join(f.home, '.local'));
  const blocker = join(f.home, '.local', 'state');
  writeFileSync(blocker, 'keep');
  resultIs(f.run(['status']), 1, disabledOutput);
  resultIs(f.run(['hook'], { input: permissionRequest }), 0, '');
  failsWithoutSuccess(f.run(['enable']));
  failsWithoutSuccess(f.run(['disable']));
  assert.equal(readFileSync(blocker, 'utf8'), 'keep');
});

test('unreadable state silently fails closed', {
  skip: permissionChecks ? false : 'requires a non-root POSIX user',
}, (t) => {
  const f = fixture(t);
  f.writeState('{"enabled":true}\n');
  chmodSync(f.stateFile, 0o000);
  try {
    assert.throws(() => readFileSync(f.stateFile), { code: 'EACCES' });
    resultIs(f.run(['status']), 1, disabledOutput);
    resultIs(f.run(['hook'], { input: permissionRequest }), 0, '');
  } finally {
    chmodSync(f.stateFile, 0o600);
  }
});

test('enable reports a write failure without enabling a read-only state file', {
  skip: permissionChecks ? false : 'requires a non-root POSIX user',
}, (t) => {
  const f = fixture(t);
  f.writeState('{"enabled":false}\n');
  chmodSync(f.stateFile, 0o400);
  try {
    failsWithoutSuccess(f.run(['enable']));
    assert.equal(readFileSync(f.stateFile, 'utf8'), '{"enabled":false}\n');
    resultIs(f.run(['status']), 1, disabledOutput);
  } finally {
    chmodSync(f.stateFile, 0o600);
  }
});

test('enable reports an unwritable directory without claiming success', {
  skip: permissionChecks ? false : 'requires a non-root POSIX user',
}, (t) => {
  const f = fixture(t);
  mkdirSync(f.stateDirectory, { recursive: true });
  chmodSync(f.stateDirectory, 0o500);
  try {
    failsWithoutSuccess(f.run(['enable']));
    assert.equal(existsSync(f.stateFile), false);
  } finally {
    chmodSync(f.stateDirectory, 0o700);
  }
});

test('disable reports an unlink failure and leaves the existing state intact', {
  skip: permissionChecks ? false : 'requires a non-root POSIX user',
}, (t) => {
  const f = fixture(t);
  f.writeState('{"enabled":true}\n');
  chmodSync(f.stateDirectory, 0o500);
  try {
    failsWithoutSuccess(f.run(['disable']));
    assert.equal(readFileSync(f.stateFile, 'utf8'), '{"enabled":true}\n');
  } finally {
    chmodSync(f.stateDirectory, 0o700);
  }
});

test('hook stdin I/O failure silently no-ops', {
  skip: posix ? false : 'directory file descriptors require POSIX',
}, (t) => {
  const f = fixture(t);
  f.writeState('{"enabled":true}\n');
  const descriptor = openSync(f.home, 'r');
  try {
    resultIs(f.run(['hook'], { stdio: [descriptor, 'pipe', 'pipe'] }), 0, '');
  } finally {
    closeSync(descriptor);
  }
});

test('hook stdout I/O failure exits silently', (t) => {
  const f = fixture(t);
  f.writeState('{"enabled":true}\n');
  const output = join(f.directory, 'read-only-output');
  writeFileSync(output, 'keep');
  const descriptor = openSync(output, 'r');
  try {
    resultIs(f.run(['hook'], {
      input: permissionRequest, stdio: ['pipe', descriptor, 'pipe'],
    }), 0, null);
    assert.equal(readFileSync(output, 'utf8'), 'keep');
  } finally {
    closeSync(descriptor);
  }
});

test('enable uses private modes even with a permissive umask and existing file', {
  skip: posix ? false : 'POSIX permission bits are not supported',
}, (t) => {
  const f = fixture(t);
  const previousUmask = process.umask(0);
  try {
    resultIs(f.run(['enable']), 0, enableOutput);
  } finally {
    process.umask(previousUmask);
  }
  assert.equal(statSync(f.stateDirectory).mode & 0o777, 0o700);
  assert.equal(statSync(f.stateFile).mode & 0o777, 0o600);
  chmodSync(f.stateFile, 0o666);
  resultIs(f.run(['enable']), 0, enableOutput);
  assert.equal(statSync(f.stateFile).mode & 0o777, 0o600);
});

for (const parentType of [undefined, 'module', 'commonjs']) {
  test(`packaged plugin alone runs from a path with spaces (parent type: ${parentType ?? 'absent'})`, (t) => {
    const f = fixture(t);
    const packaged = join(f.directory, 'marketplace copy', 'auto approve');
    cpSync(plugin, packaged, { recursive: true });
    if (parentType !== undefined) {
      writeFileSync(join(f.directory, 'package.json'), JSON.stringify({ type: parentType }));
    }
    assert.equal(existsSync(join(f.directory, 'node_modules')), false);
    assert.equal(existsSync(join(packaged, 'node_modules')), false);
    assert.equal(existsSync(join(f.directory, 'src')), false);
    const script = join(packaged, 'scripts', 'auto_approve.js');
    resultIs(f.run(['status'], { script }), 1, disabledOutput);
    resultIs(f.run(['enable'], { script }), 0, enableOutput);
    resultIs(f.run(['status'], { script }), 0, enabledOutput);
    resultIs(f.run(['hook'], { script, input: permissionRequest }), 0, allowOutput);
    resultIs(f.run(['disable'], { script }), 0, disableOutput);
    resultIs(f.run(['hook'], { script, input: permissionRequest }), 0, '');
    const manifest = JSON.parse(readFileSync(join(packaged, 'package.json'), 'utf8'));
    assert.equal(manifest.type, 'commonjs');
    assert.equal(manifest.engines.node, '>=22');
    assert.deepEqual(manifest.dependencies ?? {}, {});
    assert.deepEqual(manifest.devDependencies ?? {}, {});
  });
}

test('the packaged hook is wired only to PermissionRequest and quotes paths with spaces', {
  skip: posix ? false : 'the hook command uses a POSIX shell',
}, (t) => {
  const f = fixture(t);
  const packaged = join(f.directory, 'installed plugin with spaces');
  cpSync(plugin, packaged, { recursive: true });
  const hooks = JSON.parse(readFileSync(join(packaged, 'hooks', 'hooks.json'), 'utf8'));
  const command = 'node "${PLUGIN_ROOT}/scripts/auto_approve.js" hook';
  assert.deepEqual(hooks.hooks, {
    PermissionRequest: [{ hooks: [{ type: 'command', command, timeout: 5 }] }],
  });
  function runHook() {
    return spawnSync('/bin/sh', ['-c', command], {
      cwd: f.home,
      env: { ...f.env, PLUGIN_ROOT: packaged },
      input: permissionRequest,
      encoding: 'utf8',
      timeout: 10_000,
    });
  }
  resultIs(runHook(), 0, '');
  resultIs(f.run(['enable'], { script: join(packaged, 'scripts', 'auto_approve.js') }), 0, enableOutput);
  resultIs(runHook(), 0, allowOutput);
});

test('the skill resolves the bundled Node controller and retains explicit opt-in safeguards', (t) => {
  const f = fixture(t);
  const skillPath = join(plugin, 'skills', 'auto-approve', 'SKILL.md');
  const skill = readFileSync(skillPath, 'utf8');
  const match = skill.match(/Resolve `([^`]+)` from the directory containing this `SKILL.md`/);
  assert.ok(match);
  assert.equal(match[1], '../../scripts/auto_approve.js');
  assert.match(skill, /Run `node "<resolved-controller-path>" <action>` once\./);
  assert.match(skill, /If no action is present, use `status`/);
  assert.match(skill, /Never infer `enable` from vague wording/);
  assert.match(skill, /never substitute it for `status`/);
  assert.match(skill, /never edit the state file directly/);
  assert.match(skill, /If the action is unsupported, do not run the controller/);
  const agent = readFileSync(join(dirname(skillPath), 'agents', 'openai.yaml'), 'utf8');
  assert.match(agent, /allow_implicit_invocation: false/);
  resultIs(f.run(['status'], { script: resolve(dirname(skillPath), match[1]) }), 1, disabledOutput);
  assert.equal(existsSync(f.stateDirectory), false);
});

test('the shipped plugin matches the root version and has no legacy controller', () => {
  const manifest = JSON.parse(readFileSync(join(plugin, '.codex-plugin', 'plugin.json'), 'utf8'));
  const root = JSON.parse(readFileSync(join(repository, 'package.json'), 'utf8'));
  assert.equal(manifest.version, root.version);
  assert.equal(existsSync(join(plugin, 'scripts', 'auto_approve.py')), false);
});
