# Auto Approve

A Codex plugin that automatically allows supported permission requests when
explicitly enabled. The switch is persistent and **disabled by default**.

## Install

Requires **Node.js 22 or newer** and a recent **Codex CLI with plugin and hook
support**, with `node` and `codex` on `PATH`. For one-command installation,
`npm` and `npx` must also be on `PATH`:

```sh
npx codex-auto-approve@latest install
```

The installer requires **version 0.2.0 or newer**. For older versions, use
these manual commands:

```sh
codex plugin marketplace add fuliucansheng/codex-auto-approve
codex plugin add auto-approve@codex-auto-approve
```

The manual alternative needs no npm installation or build step. Installing the
npm package alone does not register the plugin. Both methods use the durable
GitHub marketplace on **`main`**, not an npx cache path. The npm version selects
only the installer; pinning it does not pin the plugin version or install the
plugin from the npm tarball.

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

`status` shows the current switch, `enable` allows supported requests
automatically, and `disable` restores the normal approval flow. This is a
plugin skill, not a built-in slash command. For terminal controls, see the
[root README](https://github.com/fuliucansheng/codex-auto-approve#use).

## Update and uninstall

To update, run these commands and start a new Codex conversation:

```sh
codex plugin marketplace upgrade codex-auto-approve
codex plugin add auto-approve@codex-auto-approve
```

Updating the npm CLI alone does not update the installed plugin.

To uninstall, run `$auto-approve disable` in Codex first, then in your terminal:

```sh
codex plugin remove auto-approve@codex-auto-approve
codex plugin marketplace remove codex-auto-approve
```

## Safety

While enabled, all supported permission requests are allowed without the normal
confirmation prompt. Enable only in an environment you trust and disable when
finished. Some Computer Use and app-level confirmations still require user
approval, and managed workspace policy may limit what the plugin can approve.

The switch is stored at `~/.local/state/codex-auto-approve/enabled.json`.
Missing, unreadable, or invalid state leaves automatic approval disabled.

[Contributing](https://github.com/fuliucansheng/codex-auto-approve/blob/main/docs/MAINTAINING.md)
