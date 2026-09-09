#!/usr/bin/env node
"use strict";
// Source: src/auto_approve.ts. Rebuild with npm run build; do not edit the JS.
Object.defineProperty(exports, "__esModule", { value: true });
const node_child_process_1 = require("node:child_process");
const node_fs_1 = require("node:fs");
const node_os_1 = require("node:os");
const node_path_1 = require("node:path");
const node_util_1 = require("node:util");
const stateDirectory = (0, node_path_1.join)((0, node_os_1.homedir)(), '.local', 'state', 'codex-auto-approve');
const stateFile = (0, node_path_1.join)(stateDirectory, 'enabled.json');
// Reject invalid UTF-8 and preserve a BOM so JSON.parse rejects it too.
const decoder = new node_util_1.TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
function readObject(source) {
    try {
        const payload = JSON.parse(decoder.decode((0, node_fs_1.readFileSync)(source)));
        if (typeof payload === 'object' && payload !== null && !Array.isArray(payload)) {
            return payload;
        }
    }
    catch {
        // Missing, unreadable, and malformed input must never authorize anything.
    }
    return undefined;
}
function isEnabled() {
    return readObject(stateFile)?.enabled === true;
}
function enable() {
    (0, node_fs_1.mkdirSync)(stateDirectory, { recursive: true, mode: 0o700 });
    (0, node_fs_1.writeFileSync)(stateFile, '{"enabled":true}\n', { mode: 0o600 });
    (0, node_fs_1.chmodSync)(stateFile, 0o600);
    console.log('Auto Approve: enabled (all supported permission requests are allowed).');
}
function disable() {
    try {
        (0, node_fs_1.unlinkSync)(stateFile);
    }
    catch (error) {
        if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) {
            throw error;
        }
    }
    console.log('Auto Approve: disabled (Codex will request approval normally).');
}
function status() {
    const enabled = isEnabled();
    console.log(`Auto Approve: ${enabled ? 'enabled' : 'disabled'}`);
    return enabled ? 0 : 1;
}
function install() {
    // Keep the marketplace source durable; an npx cache path can disappear.
    const commands = [
        ['plugin', 'marketplace', 'add', 'fuliucansheng/codex-auto-approve'],
        ['plugin', 'add', 'auto-approve@codex-auto-approve'],
    ];
    for (const args of commands) {
        const result = (0, node_child_process_1.spawnSync)('codex', args, { stdio: 'inherit' });
        if (result.error) {
            if ('code' in result.error && result.error.code === 'ENOENT') {
                throw new Error('codex executable not found. Install the Codex CLI with plugin support and ensure codex is on PATH, then retry.');
            }
            throw result.error;
        }
        if (result.signal) {
            throw new Error(`codex ${args.join(' ')} terminated by signal ${result.signal}`);
        }
        if (result.status === null) {
            throw new Error(`codex ${args.join(' ')} exited without a status`);
        }
        if (result.status !== 0)
            return result.status;
    }
    console.log('Auto Approve: plugin installed. Automatic approval state is unchanged.');
    console.log('Restart Codex and start a new conversation to load the plugin.');
    return 0;
}
function runHook() {
    const event = readObject(0);
    if (event?.hook_event_name !== 'PermissionRequest' || !isEnabled()) {
        return 0;
    }
    try {
        (0, node_fs_1.writeFileSync)(1, JSON.stringify({
            hookSpecificOutput: {
                hookEventName: 'PermissionRequest',
                decision: { behavior: 'allow' },
            },
        }) + '\n');
    }
    catch {
        // A closed or unwritable output stream must also leave the hook silent.
    }
    return 0;
}
function usage() {
    console.error('Usage: codex-auto-approve {install|enable|disable|status}');
    return 2;
}
function main() {
    if (process.argv.length !== 3)
        return usage();
    const command = process.argv[2];
    try {
        switch (command) {
            case 'install':
                return install();
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
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`Auto Approve: ${command} failed: ${message}`);
        return 1;
    }
}
process.exitCode = main();
