# Codex Auto Approve

A small Codex plugin that can automatically allow supported permission
requests. The switch is explicit, persistent, and **disabled by default**.

> [!WARNING]
> Enabling Auto Approve lets Codex proceed without asking you for every
> supported permission request. Review the plugin and only enable it in an
> environment you trust. Disable it as soon as you no longer need it.

## Requirements

- A recent version of Codex with plugin and hook support
- Python 3

## Install

Add this repository as a Codex plugin marketplace, then install the plugin:

```sh
codex plugin marketplace add fuliucansheng/codex-auto-approve
codex plugin add auto-approve@codex-auto-approve
```

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

For local development, the same controller can be run from a clone:

```sh
python3 plugins/auto-approve/scripts/auto_approve.py status
python3 plugins/auto-approve/scripts/auto_approve.py enable
python3 plugins/auto-approve/scripts/auto_approve.py disable
```

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

When the state is enabled, the bundled `PermissionRequest` hook returns an
`allow` decision. When the state file is missing, unreadable, or invalid, the
plugin fails closed and leaves Codex's normal approval behavior unchanged.

The hook only covers permission requests exposed to Codex lifecycle hooks,
including supported shell, file-edit, and MCP tool requests. Some Computer Use
and app-level confirmations are always shown directly to the user and cannot
be auto-approved by this plugin. Managed workspace policy can also limit what
the plugin is allowed to approve.

## License

[MIT](LICENSE)
