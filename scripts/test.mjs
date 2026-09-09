import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const home = mkdtempSync(join(tmpdir(), 'codex-auto-approve-suite-'));
try {
  const result = spawnSync(process.execPath, [
    // npm pack rebuilds shared controller JS; serialize files to avoid partial reads.
    '--test', '--test-concurrency=1', '--test-reporter=spec', ...process.argv.slice(2),
    ...['auto_approve', 'install', 'package', 'release-version'].map((name) =>
      fileURLToPath(new URL(`../tests/${name}.test.mjs`, import.meta.url))),
  ], {
    env: { ...process.env, HOME: home, USERPROFILE: home, CODEX_HOME: join(home, '.codex'), XDG_CONFIG_HOME: join(home, '.config') },
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  rmSync(home, { recursive: true, force: true });
}
