# Maintaining Codex Auto Approve

For user instructions, see the [README](../README.md). Run the commands below
from the repository root.

## Local development

[src/auto_approve.ts](../src/auto_approve.ts) is the canonical source. `tsc`
compiles it to the checked-in
[plugins/auto-approve/scripts/auto_approve.js](../plugins/auto-approve/scripts/auto_approve.js).
Include the regenerated JavaScript with every source change so marketplace
copies remain ready to run. The root development dependencies are only the
TypeScript compiler and Node type definitions.

```sh
npm ci
npm run build
npm run typecheck
npm test
git diff --check
```

Tests use Node's built-in test/assert modules and execute the compiled CLI in
child processes, including a standalone copy of the plugin in a path with
spaces. The test runner and every controller invocation use isolated temporary
`HOME`, `USERPROFILE`, and `CODEX_HOME` directories and isolated configuration
paths. Build before testing source changes;
`npm test` checks the shipped JavaScript and runs real `npm pack`, offline
installation into a separate temporary global prefix, executable CLI and
standalone plugin smoke tests, and credential-free `npm publish --dry-run`.
Installer process tests use a fake `codex` on an isolated `PATH` to check command
order, inherited IO/environment, failure handling, strict arguments, and unchanged
approval state. Package tests also exercise `install` through the packed executable
without invoking a real Codex installation. Package tests check exact tarball
contents, metadata, executable mode, version parity, and absence of source,
developer scripts, and runtime dependencies.
Only `prepack` rebuilds (`npm run build`); it never runs tests, avoiding recursion.
The test runner serializes test files with `--test-concurrency=1` because package
tests run `npm pack`, whose `prepack` rebuilds the shared controller JavaScript.
This prevents controller and installer process tests from executing a partially
written file during compilation.
Package tests use empty temporary npm configs and a separate cache as well as
an isolated home. Release validator behavior tests cover matching versions,
mismatches, malformed tags, and rejection of prereleases.

CI runs these checks on Node.js 22 and 24 on Linux and macOS and rejects drift
between the source and checked-in JavaScript. POSIX mode checks skip on
Windows; permission-denial checks also skip when run as root.

## npm releases

Publishing requires a maintainer with permission to publish the npm package
and manage this repository's GitHub Actions settings. Configure trusted
publishing or the first-publication bootstrap described below before releasing.
The one-command installer requires `codex-auto-approve` version 0.2.0 or newer
on npm.

The [publish workflow](../.github/workflows/publish-npm.yml) runs **only** when a
GitHub release is published. It skips releases marked as prereleases and
requires a stable, canonical `vX.Y.Z` tag. Prerelease versions and build metadata
do not publish, even if the GitHub release is incorrectly marked stable. PRs
and ordinary branch pushes never trigger npm publication.

Keep these versions identical when preparing a release (currently `0.2.0`):

- Root `package.json`
- `package-lock.json`: top-level `version` and `packages[""].version`
- `plugins/auto-approve/package.json`
- `plugins/auto-approve/.codex-plugin/plugin.json`

After updating the manifests, refresh the lockfile with
`npm install --package-lock-only`, then run:

```sh
npm ci
npm run build
npm run typecheck
npm test
npm run validate:release -- v0.2.0
git diff --exit-code -- plugins/auto-approve/scripts/auto_approve.js
git diff --check
```

Use the intended version in the validation command for future releases.
Include regenerated JavaScript with source changes. After reviewing and merging
the release changes, tag that exact commit with the matching `vX.Y.Z` and
publish a stable GitHub release for that tag. npm versions are immutable;
fixes after publication require a new version and tag.

The workflow checks out the exact release tag, verifies all version fields,
installs dependencies, builds, typechecks, tests, and rejects generated artifact
drift. Tests retain their installed and inspected archive using
`NPM_TEST_PACK_DESTINATION`; the publish step sends that same tarball with
`--access public --provenance`. Release publish jobs are serialized.

### Trusted publishing and first-publication bootstrap

Publishing uses a GitHub-hosted Ubuntu runner with Node.js 24 and explicitly
pinned npm 11.6.2. npm trusted publishing requires npm **11.5.1 or newer** and
Node.js **22.14.0 or newer**; this is separate from the CLI's Node.js 22 runtime
minimum. The workflow grants only `contents: read` and `id-token: write`.

Once the package exists, open its npm settings and add a **GitHub Actions**
Trusted Publisher with these exact fields:

| Field | Value |
| --- | --- |
| Organization or user | `fuliucansheng` |
| Repository | `codex-auto-approve` |
| Workflow filename | `publish-npm.yml` |
| Environment | Leave blank (the workflow has no environment) |
| Allowed actions (if shown) | Allow direct publishing with `npm publish` |

No npm token is needed after that mapping is configured. The workflow uses npm
OIDC automatically when `secrets.NPM_TOKEN` is absent. As recommended by the
[npm trusted publishing documentation](https://docs.npmjs.com/trusted-publishers/),
the release workflow does not restore or save dependency caches.

For the first publication, the package does not yet have settings for a trusted
publisher. An authorized maintainer can create a short-lived granular npm token
with permission to create/publish this package (and bypass 2FA for automation),
then add it as the repository Actions secret **`NPM_TOKEN`**. The same workflow
uses it only in the publish step as an optional bootstrap fallback. After the
first successful stable release, configure the Trusted Publisher mapping,
remove the repository secret, and revoke the bootstrap token. Subsequent
releases use OIDC. Do not put tokens in repository files. These setup steps
must be performed by a maintainer; a dry run verifies packaging, not registry
authorization or successful publication.
