import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const repository = fileURLToPath(new URL('../', import.meta.url));
const validator = join(repository, 'scripts/validate-release-version.mjs');
const manifests = ['package.json', 'plugins/auto-approve/package.json', 'plugins/auto-approve/.codex-plugin/plugin.json', 'package-lock.json'];
function fixture(t, version = '0.1.1') {
  const directory = mkdtempSync(join(tmpdir(), 'codex-release-version-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  for (const path of manifests) {
    const value = JSON.parse(readFileSync(join(repository, path), 'utf8'));
    value.version = version;
    if (path === 'package-lock.json') value.packages[''].version = version;
    mkdirSync(dirname(join(directory, path)), { recursive: true });
    writeFileSync(join(directory, path), JSON.stringify(value));
  }
  return directory;
}
function check(directory, tag, success) {
  const result = spawnSync(process.execPath, [validator, ...tag], {
    cwd: directory, env: { ...process.env, HOME: directory, USERPROFILE: directory }, encoding: 'utf8',
  });
  assert.ifError(result.error);
  assert.equal(result.status, success ? 0 : 1, result.stderr);
  if (success) assert.match(result.stdout, /Release version verified:/);
  else assert.match(result.stderr, /Release version error:/);
  return result;
}
for (const version of ['0.1.1', '1.0.0', '12.34.56']) {
  test(`accepts stable v${version} with matching manifests and lock`, (t) => {
    check(fixture(t, version), [`v${version}`], true);
  });
}
for (const tag of [[], [''], ['0.1.1'], ['v01.1.1'], ['v0.1'], ['v0.1.1.0'], ['v0.1.1\n'], ['v0.1.1\r'], ['v0.1.1\u2028'],
  ['refs/tags/v0.1.1'], ['v0.1.1+build'], ['v0.1.1-rc.1'], ['v0.1.1', 'extra']]) {
  test(`rejects malformed or unsupported tag ${JSON.stringify(tag)}`, (t) => check(fixture(t), tag, false));
}
for (const path of [...manifests, 'package-lock.json#root']) {
  test(`rejects a version mismatch in ${path}`, (t) => {
    const directory = fixture(t);
    const filename = join(directory, path.split('#')[0]);
    const manifest = JSON.parse(readFileSync(filename, 'utf8'));
    if (path.endsWith('#root')) manifest.packages[''].version = '0.1.2';
    else manifest.version = '0.1.2';
    writeFileSync(filename, JSON.stringify(manifest));
    assert.match(check(directory, ['v0.1.1'], false).stderr, /does not match/);
  });
}
test('rejects a different stable tag', (t) => check(fixture(t), ['v0.1.2'], false));
test('prerelease manifests do not permit prerelease publishing', (t) => check(fixture(t, '0.1.1-rc.1'), ['v0.1.1-rc.1'], false));
test('missing manifest fails with a useful error', (t) => {
  const directory = fixture(t);
  rmSync(join(directory, manifests[2]));
  assert.match(check(directory, ['v0.1.1'], false).stderr, /plugin.json/);
});
