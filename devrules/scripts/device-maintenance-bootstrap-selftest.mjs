#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  IDLE_RESOURCE_AUTO_REPAIR_ENV,
  ensureIdleResourceScheduler,
  findIdleResourceScript,
} from '../hooks/device-maintenance-bootstrap-core.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE_ROOT = path.resolve(SCRIPT_DIR, '..');

function runHook(script, payload, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script], {
      cwd: TEMPLATE_ROOT,
      env,
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve(JSON.parse(stdout));
      else reject(new Error(`${path.basename(script)} exited ${code}: ${stderr}`));
    });
    child.stdin.end(JSON.stringify(payload));
  });
}

async function main() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'devrules-device-bootstrap-'));
  const repo = path.join(root, 'product');
  const rulesDir = path.join(repo, 'devrules');
  const idleScript = path.join(rulesDir, 'scripts', 'idle-resource-maintenance.mjs');
  const record = path.join(root, 'bootstrap-record.jsonl');
  try {
    await fs.mkdir(path.join(repo, '.git'), { recursive: true });
    await fs.mkdir(path.dirname(idleScript), { recursive: true });
    await fs.mkdir(path.join(rulesDir, 'hooks'), { recursive: true });
    await fs.writeFile(path.join(rulesDir, 'always-readme.md'), '# fixture\n', 'utf8');
    await fs.writeFile(path.join(rulesDir, 'hooks', 'hooks.json'), '{"schemaVersion":1,"hooks":[]}\n', 'utf8');
    await fs.writeFile(idleScript, `import fs from 'node:fs';\nconst args = process.argv.slice(2);\nfs.appendFileSync(process.env.DEVRULES_BOOTSTRAP_RECORD, JSON.stringify(args) + '\\n');\nprocess.stdout.write(JSON.stringify({ healthy: true, changed: args.includes('--apply'), status: 'pass', scheduler: 'task-scheduler' }));\n`, 'utf8');

    assert.equal(findIdleResourceScript({ rulesDir }), idleScript);
    const calls = [];
    const result = ensureIdleResourceScheduler({
      platform: 'win32',
      rulesDir,
      run(command, args, options) {
        calls.push({ command, args, options });
        return JSON.stringify({ healthy: true, changed: true, status: 'pass', scheduler: 'task-scheduler' });
      },
    });
    assert.equal(result.healthy, true);
    assert.equal(result.changed, false, 'status-only bootstrap must never report a mutation');
    assert.equal(result.mode, 'status-only');
    assert.equal(result.repairEnabled, false);
    assert.deepEqual(calls[0].args.slice(1), ['agent-status', '--json']);
    assert.equal(calls[0].options.windowsHide, true);

    const optedIn = ensureIdleResourceScheduler({
      platform: 'win32',
      rulesDir,
      autoRepair: true,
      run(command, args) {
        calls.push({ command, args });
        return JSON.stringify({ healthy: true, changed: true, status: 'pass', scheduler: 'task-scheduler' });
      },
    });
    assert.equal(optedIn.mode, 'auto-repair');
    assert.equal(optedIn.repairEnabled, true);
    assert.equal(optedIn.changed, true);
    assert.deepEqual(calls[1].args.slice(1), ['ensure-agent', '--apply', '--json']);
    assert.match(optedIn.context, /explicitly enabled/);

    const envOptedIn = ensureIdleResourceScheduler({
      platform: 'win32',
      rulesDir,
      env: { [IDLE_RESOURCE_AUTO_REPAIR_ENV]: '1' },
      run(command, args, options) {
        calls.push({ command, args, options });
        return JSON.stringify({ healthy: true, changed: false, status: 'pass', scheduler: 'task-scheduler' });
      },
    });
    assert.equal(envOptedIn.mode, 'auto-repair');
    assert.deepEqual(calls[2].args.slice(1), ['ensure-agent', '--apply', '--json']);
    assert.equal(calls[2].options.env[IDLE_RESOURCE_AUTO_REPAIR_ENV], '1');

    let unsupportedCalled = false;
    const unsupported = ensureIdleResourceScheduler({ platform: 'linux', rulesDir, run() { unsupportedCalled = true; } });
    assert.equal(unsupported.status, 'fallback');
    assert.equal(unsupportedCalled, false);

    const env = {
      ...process.env,
      HOME: path.join(root, 'home'),
      USERPROFILE: path.join(root, 'home'),
      DEVRULES_BOOTSTRAP_RECORD: record,
      [IDLE_RESOURCE_AUTO_REPAIR_ENV]: '',
    };
    const codex = await runHook(path.join(TEMPLATE_ROOT, 'hooks', 'codex-global-code-health-hook.mjs'), {
      hook_event_name: 'SessionStart',
      cwd: repo,
    }, env);
    assert.doesNotMatch(codex.hookSpecificOutput.additionalContext, /installed or repaired/);
    const cursor = await runHook(path.join(TEMPLATE_ROOT, 'hooks', 'cursor-global-routing-hook.mjs'), {
      hook_event_name: 'sessionStart',
      session_id: 'device-bootstrap',
      cwd: repo,
      workspace_roots: [repo],
    }, env);
    assert.doesNotMatch(cursor.additional_context, /installed or repaired/);
    const invocations = (await fs.readFile(record, 'utf8')).trim().split('\n').map((line) => JSON.parse(line));
    assert.deepEqual(invocations, [
      ['agent-status', '--json'],
      ['agent-status', '--json'],
    ]);
    await assert.rejects(
      fs.access(path.join(env.HOME, '.config', 'devrules', 'idle-resource-maintenance-agent.sh')),
      'read-only SessionStart must not create the macOS wrapper',
    );
    await assert.rejects(
      fs.access(path.join(env.HOME, '.config', 'devrules', 'idle-resource-maintenance-agent.ps1')),
      'read-only SessionStart must not create the Windows wrapper',
    );
    await assert.rejects(
      fs.access(path.join(env.HOME, 'Library', 'LaunchAgents', 'com.devrules.idle-resource-maintenance.plist')),
      'read-only SessionStart must not create a LaunchAgent plist',
    );
    await assert.rejects(
      fs.access(path.join(env.HOME, '.codex', 'log', 'devrules-code-health-hook.jsonl')),
      'Codex SessionStart must not create an invocation log',
    );
    await assert.rejects(
      fs.access(path.join(env.HOME, '.cursor', 'log', 'devrules-cursor-hook.jsonl')),
      'Cursor SessionStart must not create an invocation log',
    );
    await assert.rejects(
      fs.access(path.join(env.HOME, '.cursor', 'log', 'devrules-hook-state')),
      'Cursor SessionStart must not create postToolUse dedupe state',
    );
    process.stdout.write('device maintenance bootstrap selftest: PASS\n');
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}

main().catch((error) => {
  process.stderr.write(`device maintenance bootstrap selftest: FAIL\n${error.stack || error.message}\n`);
  process.exitCode = 1;
});
