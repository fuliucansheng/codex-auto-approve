# Codex Auto Approve

A small Codex plugin that can automatically allow supported permission
requests. The switch is explicit, persistent, and **disabled by default**.

> [!WARNING]
> Enabling Auto Approve lets Codex proceed without asking you for every
> supported permission request. Review the plugin and only enable it in an
> environment you trust. Disable it as soon as you no longer need it.

## Requirements

- A recent version of Codex with plugin and hook support
- Node.js 22 or newer, with `node` on `PATH`

## Install the Codex plugin

Add this repository as a Codex plugin marketplace, then install the plugin:

```sh
codex plugin marketplace add fuliucansheng/codex-auto-approve
codex plugin add auto-approve@codex-auto-approve
```

The marketplace ships the prebuilt `scripts/auto_approve.js` controller inside
the plugin. Installation needs only Node.js: no `npm install`, build step,
`tsx`, or `ts-node` is needed. The plugin has no production dependencies, and
its local `package.json` keeps the JavaScript runnable regardless of a parent
package's module type.

Start a new Codex conversation after installation so the skill and hook are
loaded. You can inspect the installed hook with `/hooks`.

## npm CLI

Once the package is published to npm, install the command globally:

```sh
npm install -g codex-auto-approve
codex-auto-approve status
codex-auto-approve enable
codex-auto-approve disable
```

Or run without a global installation:

```sh
npx --yes codex-auto-approve status
npx --yes codex-auto-approve enable
npx --yes codex-auto-approve disable
```

Node.js 22 or newer is required. The npm package includes prebuilt JavaScript
and has no production dependencies or consumer build step. Installing the CLI
alone **does not register Codex hooks or skills**; use the marketplace
installation above for integration with Codex. Both interfaces control the
same local switch. The tarball also preserves the root
`.agents/plugins/marketplace.json` descriptor and the complete
`plugins/auto-approve` directory layout for marketplace use.

## Use

Invoke the bundled skill in Codex:

```text
$auto-approve status
$auto-approve enable
$auto-approve disable
```

Type `$` in the composer to select the skill, or find it through `/skills`.
`$auto-approve` is a plugin skill mention, not a built-in slash command.

The actions are:

- `status`: show whether automatic approval is enabled.
- `enable`: automatically allow all supported `PermissionRequest` events.
- `disable`: return to the normal Codex approval flow.

The skill runs the bundled Node.js controller. `status` exits with code 0 when
enabled and 1 when disabled. Successful `enable` and `disable` actions exit 0;
invalid arguments exit 2 and write usage to stderr. Filesystem errors during
enable or disable exit 1 and write an error to stderr.

## Update

```sh
codex plugin marketplace upgrade codex-auto-approve
codex plugin add auto-approve@codex-auto-approve
```

Start a new Codex conversation after updating.

## Uninstall

Disable Auto Approve first, then remove the plugin and marketplace:

```text
$auto-approve disable
```

```sh
codex plugin remove auto-approve@codex-auto-approve
codex plugin marketplace remove codex-auto-approve
```

## How it works

The controller stores the enabled state at:

```text
~/.local/state/codex-auto-approve/enabled.json
```

Only an object containing `"enabled": true` enables the bundled
`PermissionRequest` hook, which returns an `allow` decision. Existing
`enabled.json` files remain compatible. Missing, unreadable, malformed, or
non-object state fails closed, as do other enabled values such as `"true"` or
`1`. Invalid hook input silently does nothing. Status and hook calls never
create or repair state; only an explicit enable action writes the switch.

On filesystems supporting POSIX modes, newly created state directories use
`0700` and the state file uses `0600`. Disable removes only `enabled.json` and
is safe to repeat.

The hook only covers permission requests exposed to Codex lifecycle hooks,
including supported shell, file-edit, and MCP tool requests. Some Computer Use
and app-level confirmations are always shown directly to the user and cannot
be auto-approved by this plugin. Managed workspace policy can also limit what
the plugin is allowed to approve.

## Local development

[src/auto_approve.ts](src/auto_approve.ts) is the canonical source. `tsc`
compiles it to the checked-in
[plugins/auto-approve/scripts/auto_approve.js](plugins/auto-approve/scripts/auto_approve.js).
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
`HOME` and `USERPROFILE` directories. Build before testing source changes;
`npm test` checks the shipped JavaScript and runs real `npm pack`, offline
installation into a separate temporary global prefix, executable CLI and
standalone plugin smoke tests, and credential-free `npm publish --dry-run`.
Package tests check exact tarball contents, metadata, executable mode, version
parity, and absence of source, developer scripts, and runtime dependencies.
Only `prepack` rebuilds (`npm run build`); it never runs tests, avoiding recursion.
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
The npm installation commands above require a successful publication first.

The [publish workflow](.github/workflows/publish-npm.yml) runs **only** when a
GitHub release is published. It skips releases marked as prereleases and
requires a stable, canonical `vX.Y.Z` tag. Prerelease versions and build metadata
do not publish, even if the GitHub release is incorrectly marked stable. PRs
and ordinary branch pushes never trigger npm publication.

Keep these versions identical when preparing a release (currently `0.1.1`):

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
npm run validate:release -- v0.1.1
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

## License

[MIT](LICENSE)
