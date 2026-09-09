import { readFileSync } from 'node:fs';

// Run from the repository root. Accept only canonical stable release tags.
try {
  const [tag, ...extra] = process.argv.slice(2);
  if (extra.length || !/^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(tag ?? '') || tag?.trim() !== tag) {
    throw new Error('expected one stable vX.Y.Z tag; prereleases and build metadata do not publish');
  }
  const version = tag.slice(1);
  const paths = [
    'package.json',
    'plugins/auto-approve/package.json',
    'plugins/auto-approve/.codex-plugin/plugin.json',
    'package-lock.json',
  ];
  function requireVersion(actual, location) {
    if (actual !== version) throw new Error(`${location}: version ${JSON.stringify(actual)} does not match ${tag}`);
  }
  for (const path of paths) {
    const manifest = JSON.parse(readFileSync(path, 'utf8'));
    requireVersion(manifest.version, path);
    if (path === 'package-lock.json') requireVersion(manifest.packages?.['']?.version, `${path} packages[""]`);
  }
  console.log(`Release version verified: ${tag}`);
} catch (error) {
  console.error(`Release version error: ${error.message}`);
  process.exitCode = 1;
}
