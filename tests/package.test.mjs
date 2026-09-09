import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { before, after, test } from 'node:test';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repository = fileURLToPath(new URL('../', import.meta.url));
const pluginPath = 'plugins/auto-approve';
const binPath = `${pluginPath}/scripts/auto_approve.js`;
const expectedFiles = [
  'LICENSE', 'README.md', 'package.json', '.agents/plugins/marketplace.json',
  `${pluginPath}/README.md`, `${pluginPath}/package.json`,
  `${pluginPath}/.codex-plugin/plugin.json`, `${pluginPath}/hooks/hooks.json`,
  `${pluginPath}/skills/auto-approve/SKILL.md`,
  `${pluginPath}/skills/auto-approve/agents/openai.yaml`, binPath,
].sort();
const directory = mkdtempSync(join(tmpdir(), 'codex-npm-package-'));
const home = join(directory, 'home');
const prefix = join(directory, 'prefix with spaces');
mkdirSync(home);
// Strip inherited npm settings/tokens; never read or modify the user's npm config.
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
  !/^npm_/i.test(key) && !/^(NODE_AUTH_TOKEN|NODE_OPTIONS|NODE_PATH)$/i.test(key)));
Object.assign(env, {
  HOME: home, USERPROFILE: home, NODE_OPTIONS: '', NODE_PATH: '',
  PATH: [dirname(process.execPath), ...(process.platform === 'win32'
    ? (process.env.PATH ?? '').split(delimiter).filter((path) => !path.includes('node_modules'))
    : ['/usr/bin', '/bin'])].join(delimiter),
  npm_config_cache: join(directory, 'cache'),
  npm_config_userconfig: join(directory, 'user.npmrc'),
  npm_config_globalconfig: join(directory, 'global.npmrc'),
  npm_config_registry: 'https://registry.npmjs.org/',
});
writeFileSync(env.npm_config_userconfig, '');
writeFileSync(env.npm_config_globalconfig, '');
const npmCli = process.env.npm_execpath;
const packEnv = { ...env };
if (npmCli) {
  // Node may live outside npm's installation (e.g. npm exec --package=node@22).
  // Expose only npm for prepack's nested build, not its directory's global tools.
  const npmBin = join(directory, 'npm-bin');
  mkdirSync(npmBin);
  if (process.platform === 'win32') {
    writeFileSync(join(npmBin, 'npm.cmd'), `@echo off\r\n"${process.execPath}" "${npmCli}" %*\r\n`);
  } else {
    symlinkSync(npmCli, join(npmBin, 'npm'));
  }
  packEnv.PATH = [npmBin, env.PATH].join(delimiter);
}
function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: home, env, encoding: 'utf8', timeout: 120_000, ...options,
  });
  assert.ifError(result.error);
  assert.equal(result.signal, null);
  return result;
}
function npm(args, options = {}) {
  const result = npmCli
    ? run(process.execPath, [npmCli, ...args], options)
    : run('npm', args, options);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout;
}
const json = (path) => JSON.parse(readFileSync(path, 'utf8'));
let packed;
let tarball;
let installed;
before(() => {
  // CI retains precisely this tested archive for the publish step.
  const destination = process.env.NPM_TEST_PACK_DESTINATION
    ? resolve(process.env.NPM_TEST_PACK_DESTINATION) : directory;
  mkdirSync(destination, { recursive: true });
  [packed] = JSON.parse(npm(['pack', '--json', '--pack-destination', destination], { cwd: repository, env: packEnv }));
  tarball = join(destination, packed.filename);
  // Lifecycle scripts stay enabled: any accidental consumer build must fail.
  npm(['install', '--global', '--prefix', prefix, '--omit=dev', '--offline',
    '--no-audit', '--no-fund', tarball]);
  installed = join(prefix, process.platform === 'win32' ? 'node_modules' : 'lib/node_modules', 'codex-auto-approve');
});
after(() => rmSync(directory, { recursive: true, force: true }));

test('tarball has exactly the runtime/plugin files, with original content and version parity', () => {
  assert.deepEqual(packed.files.map(({ path }) => path).sort(), expectedFiles);
  for (const path of expectedFiles) {
    assert.deepEqual(readFileSync(join(installed, path)), readFileSync(join(repository, path)), path);
  }
  const manifests = ['package.json', `${pluginPath}/package.json`, `${pluginPath}/.codex-plugin/plugin.json`];
  const version = json(join(repository, 'package.json')).version;
  for (const path of manifests) assert.equal(json(join(installed, path)).version, version, path);
  const lock = json(join(repository, 'package-lock.json'));
  assert.equal(lock.version, version);
  assert.equal(lock.packages[''].version, version);
});

test('root package declares public metadata, bundled bin, and no consumer build or dependencies', () => {
  const manifest = json(join(installed, 'package.json'));
  assert.equal(manifest.name, 'codex-auto-approve');
  assert.notEqual(manifest.private, true);
  assert.equal(manifest.license, 'MIT');
  assert.ok(manifest.description.length > 20);
  assert.deepEqual(manifest.repository, { type: 'git', url: 'git+https://github.com/fuliucansheng/codex-auto-approve.git' });
  assert.equal(manifest.homepage, 'https://github.com/fuliucansheng/codex-auto-approve#readme');
  assert.ok(manifest.keywords.includes('codex'));
  assert.deepEqual(manifest.publishConfig, { access: 'public', registry: 'https://registry.npmjs.org/' });
  assert.deepEqual(manifest.bin, { 'codex-auto-approve': binPath });
  assert.ok(Array.isArray(manifest.files));
  assert.equal(manifest.scripts.prepack, 'npm run build');
  for (const name of ['preinstall', 'install', 'postinstall', 'prepare']) assert.equal(manifest.scripts[name], undefined);
  for (const name of ['dependencies', 'optionalDependencies', 'peerDependencies']) assert.deepEqual(manifest[name] ?? {}, {});
  assert.equal(existsSync(join(installed, 'node_modules')), false);
  assert.deepEqual(readdirSync(dirname(installed)), ['codex-auto-approve']);
});

function exercise(command, args = [], options = {}) {
  const invoke = (action, status, output, input) => {
    const result = run(command, [...args, action], { ...options, input });
    assert.equal(result.status, status, result.stderr);
    assert.equal(result.stdout, output);
    assert.equal(result.stderr, '');
  };
  const input = '{"hook_event_name":"PermissionRequest"}';
  const state = join(home, '.local/state/codex-auto-approve/enabled.json');
  invoke('status', 1, 'Auto Approve: disabled\n');
  invoke('hook', 0, '', input);
  assert.equal(existsSync(state), false);
  invoke('enable', 0, 'Auto Approve: enabled (all supported permission requests are allowed).\n');
  assert.deepEqual(json(state), { enabled: true });
  invoke('status', 0, 'Auto Approve: enabled\n');
  invoke('hook', 0, '{"hookSpecificOutput":{"hookEventName":"PermissionRequest","decision":{"behavior":"allow"}}}\n', input);
  invoke('disable', 0, 'Auto Approve: disabled (Codex will request approval normally).\n');
  invoke('status', 1, 'Auto Approve: disabled\n');
  invoke('hook', 0, '', input);
  assert.equal(existsSync(state), false);
}

test('installed executable bin runs status/enable/disable/hook without source or dev dependencies', () => {
  const bin = join(prefix, process.platform === 'win32' ? 'codex-auto-approve.cmd' : 'bin/codex-auto-approve');
  assert.ok(existsSync(bin));
  if (process.platform !== 'win32') {
    assert.ok(statSync(bin).mode & 0o111);
    assert.ok(packed.files.find(({ path }) => path === binPath).mode & 0o111);
  }
  assert.match(readFileSync(join(installed, binPath), 'utf8'), /^#!\/usr\/bin\/env node\n/);
  exercise(bin, [], { shell: process.platform === 'win32' });
});

test('packed marketplace resolves a standalone plugin with hooks and skills intact', () => {
  const marketplace = json(join(installed, '.agents/plugins/marketplace.json'));
  assert.equal(marketplace.name, 'codex-auto-approve');
  assert.equal(marketplace.plugins[0].source.source, 'local');
  const source = resolve(installed, marketplace.plugins[0].source.path);
  assert.equal(source, join(installed, pluginPath));
  const standalone = join(directory, 'standalone plugin');
  cpSync(source, standalone, { recursive: true });
  writeFileSync(join(directory, 'package.json'), '{"type":"module"}');
  const manifest = json(join(standalone, '.codex-plugin/plugin.json'));
  assert.equal(manifest.name, marketplace.plugins[0].name);
  assert.equal(json(join(standalone, 'package.json')).type, 'commonjs');
  assert.ok(existsSync(resolve(standalone, manifest.skills, 'auto-approve/SKILL.md')));
  const hooks = json(join(standalone, 'hooks/hooks.json'));
  const command = hooks.hooks.PermissionRequest[0].hooks[0].command;
  assert.equal(command, 'node "${PLUGIN_ROOT}/scripts/auto_approve.js" hook');
  exercise(process.execPath, [join(standalone, 'scripts/auto_approve.js')]);
  if (process.platform !== 'win32') {
    const hookEnv = { ...env, PLUGIN_ROOT: standalone };
    const enabled = run(process.execPath, [join(standalone, 'scripts/auto_approve.js'), 'enable']);
    assert.equal(enabled.status, 0);
    const result = run('/bin/sh', ['-c', command], { env: hookEnv, input: '{"hook_event_name":"PermissionRequest"}' });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).hookSpecificOutput.decision.behavior, 'allow');
    assert.equal(run(process.execPath, [join(standalone, 'scripts/auto_approve.js'), 'disable']).status, 0);
  }
});

test('tested tarball passes npm publish --dry-run without credentials', () => {
  const output = JSON.parse(npm(['publish', tarball, '--dry-run', '--ignore-scripts', '--access', 'public', '--json']));
  // npm may return a package directly, an array, or an object keyed by package name.
  const packages = Array.isArray(output) ? output
    : typeof output.name === 'string' ? [output] : Object.values(output);
  assert.equal(packages.length, 1, 'dry-run must report exactly one package');
  const [result] = packages;
  assert.equal(result.name, 'codex-auto-approve');
  assert.equal(result.version, packed.version);
  assert.deepEqual(result.files.map(({ path }) => path).sort(), expectedFiles);
});
