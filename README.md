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

## Install

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
`npm test` exercises the shipped JavaScript without rebuilding it.

CI runs these checks on Node.js 22 and 24 on Linux and macOS and rejects drift
between the source and checked-in JavaScript. POSIX mode checks skip on
Windows; permission-denial checks also skip when run as root.

## License

[MIT](LICENSE)
