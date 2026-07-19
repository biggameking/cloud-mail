#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE_ROOT = path.resolve(SCRIPT_DIR, '..');
const GLOBAL_SCRIPT = path.join(SCRIPT_DIR, 'global-devrules.mjs');
const CURSOR_EVENTS = {
  sessionStart: { timeout: 10 },
  postToolUse: { matcher: 'Write|StrReplace|EditNotebook|Shell', timeout: 10 },
  beforeSubmitPrompt: { timeout: 10 },
  stop: { timeout: 10 },
};

function run(args, options = {}) {
  return execFileAsync(process.execPath, [GLOBAL_SCRIPT, ...args], {
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
    windowsHide: true,
    ...options,
  });
}

function managedCursorEntries(config, event) {
  return (config.hooks?.[event] || []).filter((entry) => String(entry?.command || '').includes('devrules-cursor-hook.mjs'));
}

async function main() {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'devrules-global-'));
  const codexHome = path.join(tempRoot, 'codex-home');
  const cursorHome = path.join(tempRoot, 'cursor-home');
  const environment = {
    ...process.env,
    DEVRULES_TEMPLATE_ROOT: TEMPLATE_ROOT,
  };
  delete environment.DEVRULES_RUNTIME_CONFIG;
  try {
    await fs.mkdir(codexHome, { recursive: true });
    await fs.mkdir(cursorHome, { recursive: true });

    const sentinel = '# Existing global guidance\n\nKeep this line.\n';
    await fs.writeFile(path.join(codexHome, 'AGENTS.md'), sentinel, 'utf8');
    await fs.writeFile(path.join(codexHome, 'hooks.json'), `${JSON.stringify({
      hooks: {
        SessionStart: [{ hooks: [{ type: 'command', command: 'node "legacy/devrules-native-hook.mjs"' }] }],
        UserPromptSubmit: [{ hooks: [{ type: 'command', command: 'node "legacy/devrules-native-hook.mjs"' }] }],
      },
    }, null, 2)}\n`, 'utf8');

    const cursorSentinel = {
      version: 1,
      hooks: {
        preToolUse: [{ command: 'node hooks/rtk-hook.mjs', matcher: 'Shell' }],
        sessionStart: [
          { command: 'node hooks/devrules-cursor-hook.mjs', timeout: 1, stale: true },
          { command: 'node hooks/devrules-cursor-hook.mjs', timeout: 2 },
        ],
      },
    };
    const cursorBefore = `${JSON.stringify(cursorSentinel, null, 2)}\n`;
    await fs.writeFile(path.join(cursorHome, 'hooks.json'), cursorBefore, 'utf8');

    const commonArgs = ['--codex-home', codexHome, '--cursor-home', cursorHome, '--json'];
    const dryRun = JSON.parse((await run(['install', ...commonArgs], { env: environment })).stdout);
    assert.ok(dryRun.actions.length > 0);
    assert.equal(await fs.readFile(path.join(codexHome, 'AGENTS.md'), 'utf8'), sentinel, 'dry-run must not change Codex guidance');
    assert.equal(await fs.readFile(path.join(cursorHome, 'hooks.json'), 'utf8'), cursorBefore, 'dry-run must not change Cursor hooks');

    const applied = JSON.parse((await run(['install', ...commonArgs, '--apply'], { env: environment })).stdout);
    assert.equal(applied.status, 'pass');
    const installedAgents = await fs.readFile(path.join(codexHome, 'AGENTS.md'), 'utf8');
    assert.match(installedAgents, /Keep this line\./);
    assert.match(installedAgents, /read-only scheduler status/, 'global Agent context must keep SessionStart read-only by default');
    assert.match(installedAgents, /explicit user or\s+device-local opt-in[\s\S]*ensure-agent --apply --json/, 'global Agent context may document the explicit repair command');
    assert.match(installedAgents, /Released-template automation has independent authority[\s\S]*template auto-update ensure-agent --apply --json/, 'template update scheduler must require an independent explicit opt-in');
    assert.match(installedAgents, /SessionStart never\s+installs or runs it/, 'SessionStart must not activate template updates');
    assert.doesNotMatch(installedAgents, /automatically run[\s\S]{0,120}ensure-agent --apply/, 'global Agent context must not authorize automatic SessionStart repair');
    assert.match(installedAgents, /devrules is the authoritative shared engineering context/);
    assert.doesNotMatch(installedAgents, /Treat roughly 50-line functions/, 'global entry adapters must not copy devrules rule bodies');

    for (const [homeKey, installed, source] of [
      ['codex', 'devrules-global-code-health-hook.mjs', path.join(TEMPLATE_ROOT, 'hooks', 'codex-global-code-health-hook.mjs')],
      ['codex', 'device-maintenance-bootstrap-core.mjs', path.join(TEMPLATE_ROOT, 'hooks', 'device-maintenance-bootstrap-core.mjs')],
      ['cursor', 'devrules-cursor-hook.mjs', path.join(TEMPLATE_ROOT, 'hooks', 'cursor-global-routing-hook.mjs')],
      ['cursor', 'cursor-routing-core.mjs', path.join(TEMPLATE_ROOT, 'hooks', 'cursor-routing-core.mjs')],
      ['cursor', 'device-maintenance-bootstrap-core.mjs', path.join(TEMPLATE_ROOT, 'hooks', 'device-maintenance-bootstrap-core.mjs')],
    ]) {
      const home = homeKey === 'codex' ? codexHome : cursorHome;
      assert.equal(
        await fs.readFile(path.join(home, 'hooks', installed), 'utf8'),
        await fs.readFile(source, 'utf8'),
        `${installed} must match the canonical template asset`,
      );
    }

    const installedCursor = JSON.parse(await fs.readFile(path.join(cursorHome, 'hooks.json'), 'utf8'));
    assert.deepEqual(installedCursor.hooks.preToolUse, cursorSentinel.hooks.preToolUse, 'unrelated Cursor hooks must be preserved');
    for (const [event, meta] of Object.entries(CURSOR_EVENTS)) {
      const entries = managedCursorEntries(installedCursor, event);
      assert.equal(entries.length, 1, `${event} must contain exactly one devrules hook`);
      const expected = { command: 'node hooks/devrules-cursor-hook.mjs', timeout: meta.timeout };
      if (meta.matcher) expected.matcher = meta.matcher;
      assert.deepEqual(entries[0], expected, `${event} metadata must match the installer contract`);
    }

    const repeated = JSON.parse((await run(['install', ...commonArgs, '--apply'], { env: environment })).stdout);
    assert.equal(repeated.actions.length, 0, 'global install must be idempotent');
    const passingAudit = JSON.parse((await run(['audit', ...commonArgs], { env: environment })).stdout);
    assert.equal(passingAudit.status, 'pass');

    installedCursor.hooks.postToolUse[0].timeout = 1;
    installedCursor.hooks.postToolUse[0].matcher = 'Shell';
    await fs.writeFile(path.join(cursorHome, 'hooks.json'), `${JSON.stringify(installedCursor, null, 2)}\n`, 'utf8');
    let driftFailure;
    try {
      await run(['audit', '--surface', 'cursor', ...commonArgs], { env: environment });
    } catch (error) {
      driftFailure = error;
    }
    assert.ok(driftFailure, 'Cursor metadata drift must fail audit');
    const driftAudit = JSON.parse(driftFailure.stdout);
    assert.equal(driftAudit.checks.find((check) => check.name === 'cursor-postToolUse-hook')?.ok, false);

    const repaired = JSON.parse((await run(['install', '--surface', 'cursor', ...commonArgs, '--apply'], { env: environment })).stdout);
    assert.equal(repaired.status, 'pass');
    assert.ok(repaired.actions.some((action) => action.path === path.join(cursorHome, 'hooks.json')));

    const invalidText = '{ invalid json';
    await fs.writeFile(path.join(cursorHome, 'hooks.json'), invalidText, 'utf8');
    let invalidFailure;
    try {
      await run(['install', '--surface', 'cursor', ...commonArgs, '--apply'], { env: environment });
    } catch (error) {
      invalidFailure = error;
    }
    assert.ok(invalidFailure, 'invalid Cursor hooks JSON must stop installation');
    assert.equal(await fs.readFile(path.join(cursorHome, 'hooks.json'), 'utf8'), invalidText, 'invalid user configuration must not be overwritten');

    process.stdout.write('global devrules selftest: PASS\n');
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  process.stderr.write(`global devrules selftest: FAIL\n${error.stack ?? error.message}\n`);
  process.exitCode = 1;
});
