#!/usr/bin/env python3
"""Toggle and enforce the local Auto Approve policy."""

from __future__ import annotations

import json
import os
from pathlib import Path
import sys
from typing import Any


STATE_DIR = Path.home() / ".local" / "state" / "codex-auto-approve"
STATE_FILE = STATE_DIR / "enabled.json"


def is_enabled() -> bool:
    try:
        payload = json.loads(STATE_FILE.read_text(encoding="utf-8"))
    except (FileNotFoundError, OSError, json.JSONDecodeError):
        return False
    return payload.get("enabled") is True


def enable() -> None:
    STATE_DIR.mkdir(mode=0o700, parents=True, exist_ok=True)
    STATE_FILE.write_text(
        json.dumps({"enabled": True}, separators=(",", ":")) + "\n",
        encoding="utf-8",
    )
    os.chmod(STATE_FILE, 0o600)
    print("Auto Approve: enabled (all supported permission requests are allowed).")


def disable() -> None:
    try:
        STATE_FILE.unlink()
    except FileNotFoundError:
        pass
    print("Auto Approve: disabled (Codex will request approval normally).")


def status() -> int:
    if is_enabled():
        print("Auto Approve: enabled")
        return 0
    print("Auto Approve: disabled")
    return 1


def run_hook() -> int:
    try:
        event: dict[str, Any] = json.load(sys.stdin)
    except (json.JSONDecodeError, TypeError):
        return 0

    if event.get("hook_event_name") != "PermissionRequest" or not is_enabled():
        return 0

    json.dump(
        {
            "hookSpecificOutput": {
                "hookEventName": "PermissionRequest",
                "decision": {"behavior": "allow"},
            }
        },
        sys.stdout,
        separators=(",", ":"),
    )
    sys.stdout.write("\n")
    return 0


def usage() -> int:
    print("Usage: auto_approve.py {enable|disable|status}", file=sys.stderr)
    return 2


def main() -> int:
    if len(sys.argv) != 2:
        return usage()

    command = sys.argv[1]
    if command == "enable":
        enable()
        return 0
    if command == "disable":
        disable()
        return 0
    if command == "status":
        return status()
    if command == "hook":
        return run_hook()
    return usage()


if __name__ == "__main__":
    raise SystemExit(main())
