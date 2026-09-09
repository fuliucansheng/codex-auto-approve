import assert from 'node:assert/strict';
import { chmodSync, unlinkSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { assertInstallSuccess, installCalls, installFixture, posix } from './helpers/install.mjs';

const controller = fileURLToPath(new URL('../plugins/auto-approve/scripts/auto_approve.js', import.meta.url));
const run = (f, args = ['install']) => f.run(process.execPath, [controller, ...args]);
function failed(result, status) {
  assert.equal(result.status, status, result.stderr);
  assert.doesNotMatch(result.stdout, /installed|restart|new.*conversation/i);
}

for (const enabled of [false, true]) {
  test(`install runs exact commands in order, inherits IO/environment, preserves state (enabled=${enabled})`, { skip: !posix }, (t) => {
    const f = installFixture(t, enabled);
    assertInstallSuccess(f, run(f));
  });
  for (const [step, code] of [[1, 17], [2, 23]]) {
    test(`install propagates step ${step} exit ${code} and stops (enabled=${enabled})`, { skip: !posix }, (t) => {
      const f = installFixture(t, enabled);
      Object.assign(f.env, { INSTALL_TEST_FAIL_STEP: String(step), INSTALL_TEST_EXIT: String(code) });
      const result = run(f);
      failed(result, code);
      assert.deepEqual(f.calls().map(({ args }) => args), installCalls.slice(0, step));
      f.unchanged();
    });
  }
  for (const args of [['install', 'extra'], ['install', '--help'], ['install', '--'], ['install', '; touch injected']]) {
    test(`install rejects extras ${JSON.stringify(args)} (enabled=${enabled})`, { skip: !posix }, (t) => {
      const f = installFixture(t, enabled);
      const result = run(f, args);
      failed(result, 2);
      assert.match(result.stderr, /Usage:.*install/);
      assert.deepEqual(f.calls(), []);
      f.unchanged();
    });
  }
}

test('missing codex gives actionable PATH guidance without invoking another executable', { skip: !posix }, (t) => {
  const f = installFixture(t);
  unlinkSync(f.executable);
  const result = run(f);
  failed(result, 1);
  assert.match(result.stderr, /codex.*not found/i);
  assert.match(result.stderr, /install.*Codex.*PATH/i);
  assert.deepEqual(f.calls(), []);
  f.unchanged();
});

test('codex spawn permission failure fails closed', { skip: !posix }, (t) => {
  const f = installFixture(t, true);
  chmodSync(f.executable, 0o644);
  const result = run(f);
  failed(result, 1);
  assert.match(result.stderr, /EACCES/);
  assert.deepEqual(f.calls(), []);
  f.unchanged();
});

for (const step of [1, 2]) {
  test(`codex signal termination at step ${step} fails and stops`, { skip: !posix }, (t) => {
    const f = installFixture(t);
    Object.assign(f.env, { INSTALL_TEST_FAIL_STEP: String(step), INSTALL_TEST_SIGNAL: '1' });
    const result = run(f);
    failed(result, 1);
    assert.match(result.stderr, /SIGTERM/);
    assert.deepEqual(f.calls().map(({ args }) => args), installCalls.slice(0, step));
    f.unchanged();
  });
}
