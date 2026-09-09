# Auto Approve

Auto Approve is a Codex plugin that automatically allows supported permission
requests only while you have explicitly enabled it. It is disabled by default.

## Requirements

- A recent version of Codex with plugin and hook support
- Node.js 22 or newer, with `node` on `PATH`

## Install

```sh
codex plugin marketplace add fuliucansheng/codex-auto-approve
codex plugin add auto-approve@codex-auto-approve
```

The plugin includes the prebuilt `scripts/auto_approve.js` controller and has
no production dependencies. Marketplace installations run directly with
Node.js; no `npm install`, build step, `tsx`, or `ts-node` is needed. Keep the
entire plugin directory, including its local `package.json`, so it also works
under a parent package configured as an ES module.

Start a new Codex conversation after installation and inspect the bundled
`PermissionRequest` hook with `/hooks`.

## Use inside Codex

```text
$auto-approve status
$auto-approve enable
$auto-approve disable
```

Type `$` to select the skill, or select it through `/skills`. This is a plugin
skill rather than a new built-in slash command.

> [!WARNING]
> While enabled, all supported permission requests are allowed without the
> normal confirmation prompt. Only enable it in an environment you trust.

The hook covers permission requests exposed to Codex lifecycle hooks,
including supported shell, file-edit, and MCP tool requests. Some Computer Use
and app-level confirmations cannot be auto-approved by this plugin.

The switch remains at `~/.local/state/codex-auto-approve/enabled.json` and is
compatible with existing state files. Only the boolean `true` in an object's
`enabled` field enables approval. Missing, unreadable, malformed, or non-object
state fails closed; malformed or non-object hook input silently does nothing.
Only explicit enable writes state, and disable is safe to repeat. On POSIX
filesystems, new state directories use `0700` and the file uses `0600`.

`status` exits 0 when enabled and 1 when disabled. Successful enable/disable
actions exit 0, filesystem write failures exit 1, and invalid arguments exit 2.

## Development

In a repository clone, edit `src/auto_approve.ts`, then run `npm ci`,
`npm run build`, `npm run typecheck`, and `npm test` from the repository root.
Include the regenerated `plugins/auto-approve/scripts/auto_approve.js` with
source changes. Tests execute the compiled controller with isolated temporary
`HOME` and `USERPROFILE` directories. CI checks Node.js 22/24 on Linux/macOS
and verifies that the checked-in JavaScript matches the TypeScript source.
