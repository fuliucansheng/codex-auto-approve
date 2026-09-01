# Auto Approve

Auto Approve is a Codex plugin that automatically allows supported permission
requests only while you have explicitly enabled it. It is disabled by default.

## Install

```sh
codex plugin marketplace add fuliucansheng/codex-auto-approve
codex plugin add auto-approve@codex-auto-approve
```

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
