---
name: auto-approve
description: Control the installed Auto Approve plugin by enabling, disabling, or inspecting automatic approval of supported Codex permission requests. Use when the user explicitly invokes $auto-approve with enable, disable, or status.
---

# Auto Approve Control

Control the plugin's persistent local switch with its bundled controller.
Requires Node.js 22 or newer on `PATH`. The JavaScript controller is prebuilt;
no dependency installation or build step is needed.

1. Read the requested action immediately following the skill mention. Accept only `enable`, `disable`, or `status`. If no action is present, use `status`.
2. Resolve `../../scripts/auto_approve.js` from the directory containing this `SKILL.md`; do not resolve it from the session working directory.
3. Run `node "<resolved-controller-path>" <action>` once.
4. Report the controller's output exactly and briefly explain the resulting state.

Treat an explicit `$auto-approve enable` invocation as authorization to enable the switch without an additional confirmation. Never infer `enable` from vague wording, never substitute it for `status`, and never edit the state file directly. If the action is unsupported, do not run the controller; show the accepted syntax instead.
