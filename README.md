# Codex Auto Approve

A Codex plugin that automatically allows supported permission requests when
explicitly enabled. The switch is persistent and **disabled by default**.

## Requirements

- **Node.js 22 or newer**, with `node` on `PATH`.
- A recent **Codex CLI with plugin and hook support**, with `codex` on `PATH`.
- `npm` and `npx` on `PATH` for the npm commands below.

## Install

```sh
npx codex-auto-approve@latest install
```

The one-command installer requires **version 0.2.0 or newer**. For older
versions, use the manual alternative below. Installing the npm package alone
does not register the plugin.

### Manual alternative

These are the same two commands the installer runs; they require no npm
installation or build step:

```sh
codex plugin marketplace add fuliucansheng/codex-auto-approve
codex plugin add auto-approve@codex-auto-approve
```

Both methods register a durable GitHub marketplace source, fetched from this
repository's **`main` branch**, rather than a temporary npx cache path. The npm
version selects the installer only: even a pinned npm version does not pin the
plugin version or install the plugin from the npm tarball.

Installation **does not enable automatic approval** or change the existing
switch: a missing switch stays disabled, and an enabled switch stays enabled.
Restart Codex and start a **new conversation**, then inspect the hook with
`/hooks`.

## Use

In Codex, select the skill by typing `$` or through `/skills`:

```text
$auto-approve status
$auto-approve enable
$auto-approve disable
```

`status` shows the current switch, `enable` allows all supported permission
requests automatically, and `disable` restores the normal approval flow.
`$auto-approve` is a plugin skill, not a built-in slash command.

You can also control the same switch from a terminal using the npm CLI:

```sh
npx codex-auto-approve@latest status
npx codex-auto-approve@latest enable
npx codex-auto-approve@latest disable
```

## Update

Refresh the marketplace and reinstall the plugin:

```sh
codex plugin marketplace upgrade codex-auto-approve
codex plugin add auto-approve@codex-auto-approve
```

Start a new Codex conversation after updating. Updating the npm CLI alone does
not update the installed plugin.

## Uninstall

Disable automatic approval in Codex first:

```text
$auto-approve disable
```

Then remove the plugin and marketplace in your terminal:

```sh
codex plugin remove auto-approve@codex-auto-approve
codex plugin marketplace remove codex-auto-approve
```

## Safety

While enabled, all supported permission requests are allowed without the normal
confirmation prompt. Review the plugin, enable it only in an environment you
trust, and disable it when finished.

The switch is stored at `~/.local/state/codex-auto-approve/enabled.json`.
Missing, unreadable, or invalid state leaves automatic approval disabled.
The hook covers supported shell, file-edit, and MCP permission requests; some
Computer Use and app-level confirmations still require user approval. Managed
workspace policy can also limit what the plugin may approve.

## License

[MIT](LICENSE)

[Contributing](https://github.com/fuliucansheng/codex-auto-approve/blob/main/docs/MAINTAINING.md)
