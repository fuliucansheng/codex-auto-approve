#!/usr/bin/env node
// Source: src/auto_approve.ts. Rebuild with npm run build; do not edit the JS.

import { chmodSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import type { PathOrFileDescriptor } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { TextDecoder } from 'node:util';

const stateDirectory = join(homedir(), '.local', 'state', 'codex-auto-approve');
const stateFile = join(stateDirectory, 'enabled.json');
// Reject invalid UTF-8 and preserve a BOM so JSON.parse rejects it too.
const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });

function readObject(source: PathOrFileDescriptor): Record<string, unknown> | undefined {
  try {
    const payload: unknown = JSON.parse(decoder.decode(readFileSync(source)));
    if (typeof payload === 'object' && payload !== null && !Array.isArray(payload)) {
      return payload as Record<string, unknown>;
    }
  } catch {
    // Missing, unreadable, and malformed input must never authorize anything.
  }
  return undefined;
}

function isEnabled(): boolean {
  return readObject(stateFile)?.enabled === true;
}

function enable(): void {
  mkdirSync(stateDirectory, { recursive: true, mode: 0o700 });
  writeFileSync(stateFile, '{"enabled":true}\n', { mode: 0o600 });
  chmodSync(stateFile, 0o600);
  console.log('Auto Approve: enabled (all supported permission requests are allowed).');
}

function disable(): void {
  try {
    unlinkSync(stateFile);
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) {
      throw error;
    }
  }
  console.log('Auto Approve: disabled (Codex will request approval normally).');
}

function status(): number {
  const enabled = isEnabled();
  console.log(`Auto Approve: ${enabled ? 'enabled' : 'disabled'}`);
  return enabled ? 0 : 1;
}

function runHook(): number {
  const event = readObject(0);
  if (event?.hook_event_name !== 'PermissionRequest' || !isEnabled()) {
    return 0;
  }
  try {
    writeFileSync(1, JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PermissionRequest',
        decision: { behavior: 'allow' },
      },
    }) + '\n');
  } catch {
    // A closed or unwritable output stream must also leave the hook silent.
  }
  return 0;
}

function usage(): number {
  console.error('Usage: auto_approve.js {enable|disable|status}');
  return 2;
}

function main(): number {
  if (process.argv.length !== 3) return usage();
  const command = process.argv[2];
  try {
    switch (command) {
      case 'enable':
        enable();
        return 0;
      case 'disable':
        disable();
        return 0;
      case 'status':
        return status();
      case 'hook':
        return runHook();
      default:
        return usage();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Auto Approve: ${command} failed: ${message}`);
    return 1;
  }
}

process.exitCode = main();
