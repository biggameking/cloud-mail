#!/usr/bin/env node
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { resolveRuntimeLocation } from './devrules-lib/runtime-location.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const RUNTIME_LOCATION = await resolveRuntimeLocation({ fallbackTemplateRoot: path.resolve(SCRIPT_DIR, '..') });
const TEMPLATE_ROOT = RUNTIME_LOCATION.templateRoot;

const CODEX_HOOK_SOURCE = path.join(TEMPLATE_ROOT, 'hooks', 'codex-global-code-health-hook.mjs');
const CODEX_HOOK_FILE = 'devrules-global-code-health-hook.mjs';
const CURSOR_HOOK_SOURCE = path.join(TEMPLATE_ROOT, 'hooks', 'cursor-global-routing-hook.mjs');
const CURSOR_HOOK_FILE = 'devrules-cursor-hook.mjs';
const CURSOR_CORE_SOURCE = path.join(TEMPLATE_ROOT, 'hooks', 'cursor-routing-core.mjs');
const CURSOR_CORE_FILE = 'cursor-routing-core.mjs';
const MAINTENANCE_CORE_SOURCE = path.join(TEMPLATE_ROOT, 'hooks', 'device-maintenance-bootstrap-core.mjs');
const MAINTENANCE_CORE_FILE = 'device-maintenance-bootstrap-core.mjs';
const BLOCK_START = '<!-- DEVRULES:GLOBAL-CODE-HEALTH-START -->';
const BLOCK_END = '<!-- DEVRULES:GLOBAL-CODE-HEALTH-END -->';

const CURSOR_EVENTS = {
  sessionStart: { timeout: 10 },
  postToolUse: { matcher: 'Write|StrReplace|EditNotebook|Shell', timeout: 10 },
  beforeSubmitPrompt: { timeout: 10 },
  stop: { timeout: 10 },
};

function parseArgs(argv) {
  const args = {
    command: 'install',
    surface: 'all',
    codexHome: process.env.CODEX_HOME || path.join(os.homedir(), '.codex'),
    cursorHome: process.env.CURSOR_HOME || path.join(os.homedir(), '.cursor'),
    apply: false,
    json: false,
  };
  const values = [...argv];
  if (values[0] && !values[0].startsWith('-')) args.command = values.shift();
  while (values.length > 0) {
    const token = values.shift();
    if (token === '--codex-home') args.codexHome = values.shift();
    else if (token === '--cursor-home') args.cursorHome = values.shift();
    else if (token === '--surface') args.surface = values.shift();
    else if (token === '--apply') args.apply = true;
    else if (token === '--json') args.json = true;
    else if (token === '--help' || token === '-h') args.help = true;
    else throw new Error(`Unknown argument: ${token}`);
  }
  if (!['all', 'codex', 'cursor'].includes(args.surface)) {
    throw new Error('--surface must be all, codex, or cursor');
  }
  if (!args.codexHome) throw new Error('--codex-home requires a path');
  if (!args.cursorHome) throw new Error('--cursor-home requires a path');
  args.codexHome = path.resolve(args.codexHome);
  args.cursorHome = path.resolve(args.cursorHome);
  return args;
}

function usage() {
  return `global-devrules.mjs

Usage:
  node devrules/scripts/global-devrules.mjs install [--surface all|codex|cursor] [--codex-home <dir>] [--cursor-home <dir>] [--apply] [--json]
  node devrules/scripts/global-devrules.mjs audit [--surface all|codex|cursor] [--codex-home <dir>] [--cursor-home <dir>] [--json]

Install is a dry-run unless --apply is present. Existing AGENTS.md and hook
configuration are preserved outside the managed devrules block and hook entries.
Default --surface is all (Codex + Cursor).`;
}

function managedBlock() {
  return `${BLOCK_START}
## devrules Global Entry

devrules is the authoritative shared engineering context. AGENTS.md is only an
entry adapter: preserve human-owned global or project-specific instructions,
but do not copy shared devrules rule bodies into this managed block.

- When a Git root contains \`devrules/\`, read its
  \`devrules/always-readme.md\` and only the routes it selects.
- For shared-template control-plane work, resolve the canonical root with
  \`devrules location show\`; never infer it from a workspace parent.
- At SessionStart on Windows or macOS, run only the read-only scheduler status
  check. Install or repair the idle-resource scheduler only after an
  explicit user or device-local opt-in, using
  \`devrules idle ensure-agent --apply --json\`.
- Released-template automation has independent authority. SessionStart never
  installs or runs it; enable it only through explicit device opt-in with
  \`devrules template auto-update ensure-agent --apply --json\`.
${BLOCK_END}`;
}

async function pathExists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function readText(target, fallback = '') {
  try {
    return await fs.readFile(target, 'utf8');
  } catch {
    return fallback;
  }
}

async function readJsonState(target, fallback = {}) {
  if (!(await pathExists(target))) {
    return { exists: false, valid: true, value: fallback, text: '' };
  }
  const text = await fs.readFile(target, 'utf8');
  try {
    return { exists: true, valid: true, value: JSON.parse(text), text };
  } catch {
    return { exists: true, valid: false, value: fallback, text };
  }
}

function upsertManagedBlock(existing, block) {
  const start = existing.indexOf(BLOCK_START);
  const end = existing.indexOf(BLOCK_END);
  if ((start >= 0) !== (end >= 0)) throw new Error('AGENTS.md contains an incomplete global devrules managed block');
  if (start >= 0) {
    const after = end + BLOCK_END.length;
    return `${existing.slice(0, start)}${block}${existing.slice(after)}`;
  }
  const prefix = existing.trimEnd();
  return `${prefix ? `${prefix}\n\n` : ''}${block}\n`;
}

function hookCommand(hookPath) {
  return `node "${hookPath}"`;
}

function commandObjects(eventEntries) {
  const results = [];
  for (const entry of Array.isArray(eventEntries) ? eventEntries : []) {
    for (const hook of Array.isArray(entry?.hooks) ? entry.hooks : []) {
      if (hook?.type === 'command' && typeof hook.command === 'string') results.push(hook);
    }
  }
  return results;
}

function ensureCodexHookEvent(config, event, hookPath) {
  config.hooks ??= {};
  config.hooks[event] ??= [];
  const commands = commandObjects(config.hooks[event]);
  const expected = hookCommand(hookPath);
  const current = commands.find((hook) => hook.command.includes(CODEX_HOOK_FILE));
  if (current) {
    current.command = expected;
    current.statusMessage = event === 'SessionStart' ? 'Loading global code-health guidance' : 'Routing code-health guidance';
    return;
  }
  const legacy = commands.find((hook) => hook.command.includes('devrules-native-hook.mjs'));
  if (legacy) {
    legacy.command = expected;
    legacy.statusMessage = event === 'SessionStart' ? 'Loading global code-health guidance' : 'Routing code-health guidance';
    return;
  }
  const entry = {
    hooks: [{
      type: 'command',
      command: expected,
      statusMessage: event === 'SessionStart' ? 'Loading global code-health guidance' : 'Routing code-health guidance',
    }],
  };
  if (event === 'SessionStart') entry.matcher = 'startup|resume';
  config.hooks[event].push(entry);
}

function normalizedCodexHooks(existing, hookPath) {
  const config = existing && typeof existing === 'object' && !Array.isArray(existing) ? structuredClone(existing) : {};
  ensureCodexHookEvent(config, 'SessionStart', hookPath);
  ensureCodexHookEvent(config, 'UserPromptSubmit', hookPath);
  return config;
}

function hasCodexHook(config, event, hookPath) {
  return commandObjects(config?.hooks?.[event]).some((hook) => hook.command === hookCommand(hookPath));
}

function cursorHookCommand() {
  // User-level Cursor hooks run with cwd ~/.cursor, so keep the relative form.
  return `node hooks/${CURSOR_HOOK_FILE}`;
}

function ensureCursorHookEvent(config, event, meta) {
  config.hooks ??= {};
  const next = {
    command: cursorHookCommand(),
    timeout: meta.timeout,
  };
  if (meta.matcher) next.matcher = meta.matcher;

  const entries = Array.isArray(config.hooks[event]) ? config.hooks[event] : [];
  const preserved = [];
  let insertAt = null;
  for (const entry of entries) {
    if (typeof entry?.command === 'string' && entry.command.includes(CURSOR_HOOK_FILE)) {
      if (insertAt == null) insertAt = preserved.length;
      continue;
    }
    preserved.push(entry);
  }
  preserved.splice(insertAt == null ? preserved.length : insertAt, 0, next);
  config.hooks[event] = preserved;
}

function normalizedCursorHooks(existing) {
  const config = existing && typeof existing === 'object' && !Array.isArray(existing)
    ? structuredClone(existing)
    : { version: 1, hooks: {} };
  config.version = 1;
  for (const [event, meta] of Object.entries(CURSOR_EVENTS)) {
    ensureCursorHookEvent(config, event, meta);
  }
  return config;
}

function hasExactCursorHook(config, event, meta) {
  const entries = config?.hooks?.[event];
  if (!Array.isArray(entries)) return false;
  const managed = entries.filter((entry) => typeof entry?.command === 'string' && entry.command.includes(CURSOR_HOOK_FILE));
  if (managed.length !== 1) return false;
  const entry = managed[0];
  const allowedKeys = new Set(['command', 'timeout', ...(meta.matcher ? ['matcher'] : [])]);
  return entry.command === cursorHookCommand()
    && entry.timeout === meta.timeout
    && (meta.matcher ? entry.matcher === meta.matcher : !Object.hasOwn(entry, 'matcher'))
    && Object.keys(entry).every((key) => allowedKeys.has(key));
}

function render(result) {
  const lines = [
    `Global devrules ${result.command}: ${result.status.toUpperCase()}`,
  ];
  if (result.codexHome) lines.push(`Codex home: ${result.codexHome}`);
  if (result.cursorHome) lines.push(`Cursor home: ${result.cursorHome}`);
  for (const check of result.checks) lines.push(`${check.ok ? 'OK' : 'MISSING'} ${check.name}: ${check.detail}`);
  for (const action of result.actions ?? []) lines.push(`${action.kind.toUpperCase()} ${action.path}`);
  if (result.command === 'install' && !result.applied && result.actions?.length > 0) {
    lines.push('Dry-run only; pass --apply to write these changes.');
  }
  return lines.join('\n');
}

async function auditCodex(codexHome) {
  const agentsPath = path.join(codexHome, 'AGENTS.md');
  const hooksPath = path.join(codexHome, 'hooks.json');
  const hookPath = path.join(codexHome, 'hooks', CODEX_HOOK_FILE);
  const maintenancePath = path.join(codexHome, 'hooks', MAINTENANCE_CORE_FILE);
  const agents = await readText(agentsPath);
  const hooksState = await readJsonState(hooksPath, {});
  const hooks = hooksState.value;
  const expectedHook = await readText(CODEX_HOOK_SOURCE);
  const installedHook = await readText(hookPath);
  const expectedMaintenance = await readText(MAINTENANCE_CORE_SOURCE);
  const installedMaintenance = await readText(maintenancePath);
  return [
    { name: 'codex-hooks-json-valid', ok: hooksState.valid, detail: hooksPath },
    { name: 'codex-managed-agents-block', ok: agents.includes(BLOCK_START) && agents.includes(BLOCK_END), detail: agentsPath },
    { name: 'codex-hook-asset', ok: Boolean(expectedHook) && installedHook === expectedHook, detail: hookPath },
    { name: 'codex-maintenance-bootstrap-asset', ok: Boolean(expectedMaintenance) && installedMaintenance === expectedMaintenance, detail: maintenancePath },
    { name: 'codex-session-start-hook', ok: hasCodexHook(hooks, 'SessionStart', hookPath), detail: hooksPath },
    { name: 'codex-prompt-routing-hook', ok: hasCodexHook(hooks, 'UserPromptSubmit', hookPath), detail: hooksPath },
  ];
}

async function auditCursor(cursorHome) {
  const hooksPath = path.join(cursorHome, 'hooks.json');
  const hookPath = path.join(cursorHome, 'hooks', CURSOR_HOOK_FILE);
  const corePath = path.join(cursorHome, 'hooks', CURSOR_CORE_FILE);
  const maintenancePath = path.join(cursorHome, 'hooks', MAINTENANCE_CORE_FILE);
  const hooksState = await readJsonState(hooksPath, {});
  const hooks = hooksState.value;
  const expectedHook = await readText(CURSOR_HOOK_SOURCE);
  const installedHook = await readText(hookPath);
  const expectedCore = await readText(CURSOR_CORE_SOURCE);
  const installedCore = await readText(corePath);
  const expectedMaintenance = await readText(MAINTENANCE_CORE_SOURCE);
  const installedMaintenance = await readText(maintenancePath);
  const checks = [
    { name: 'cursor-hooks-json-valid', ok: hooksState.valid, detail: hooksPath },
    { name: 'cursor-hooks-version', ok: hooksState.valid && hooks?.version === 1, detail: hooksPath },
    { name: 'cursor-hook-asset', ok: Boolean(expectedHook) && installedHook === expectedHook, detail: hookPath },
    { name: 'cursor-routing-core-asset', ok: Boolean(expectedCore) && installedCore === expectedCore, detail: corePath },
    { name: 'cursor-maintenance-bootstrap-asset', ok: Boolean(expectedMaintenance) && installedMaintenance === expectedMaintenance, detail: maintenancePath },
  ];
  for (const [event, meta] of Object.entries(CURSOR_EVENTS)) {
    checks.push({
      name: `cursor-${event}-hook`,
      ok: hooksState.valid && hasExactCursorHook(hooks, event, meta),
      detail: hooksPath,
    });
  }
  return checks;
}

async function installCodex(codexHome, apply, actions) {
  if (!(await pathExists(CODEX_HOOK_SOURCE))) throw new Error(`Hook template is missing: ${CODEX_HOOK_SOURCE}`);
  if (!(await pathExists(MAINTENANCE_CORE_SOURCE))) throw new Error(`Maintenance bootstrap core is missing: ${MAINTENANCE_CORE_SOURCE}`);
  const agentsPath = path.join(codexHome, 'AGENTS.md');
  const hooksPath = path.join(codexHome, 'hooks.json');
  const hookPath = path.join(codexHome, 'hooks', CODEX_HOOK_FILE);
  const maintenancePath = path.join(codexHome, 'hooks', MAINTENANCE_CORE_FILE);
  const currentAgents = await readText(agentsPath);
  const nextAgents = upsertManagedBlock(currentAgents, managedBlock());
  const currentHook = await readText(hookPath);
  const nextHook = await readText(CODEX_HOOK_SOURCE);
  const currentMaintenance = await readText(maintenancePath);
  const nextMaintenance = await readText(MAINTENANCE_CORE_SOURCE);
  const hooksState = await readJsonState(hooksPath, {});
  if (!hooksState.valid) throw new Error(`Codex hooks configuration is not valid JSON: ${hooksPath}`);
  const nextHooks = normalizedCodexHooks(hooksState.value, hookPath);
  const currentHooksText = hooksState.text;
  const nextHooksText = `${JSON.stringify(nextHooks, null, 2)}\n`;
  if (currentAgents !== nextAgents) actions.push({ kind: currentAgents ? 'update' : 'create', path: agentsPath, content: nextAgents });
  if (currentHook !== nextHook) actions.push({ kind: currentHook ? 'update' : 'create', path: hookPath, content: nextHook });
  if (currentMaintenance !== nextMaintenance) actions.push({ kind: currentMaintenance ? 'update' : 'create', path: maintenancePath, content: nextMaintenance });
  if (currentHooksText !== nextHooksText) actions.push({ kind: (await pathExists(hooksPath)) ? 'update' : 'create', path: hooksPath, content: nextHooksText });
}

async function installCursor(cursorHome, apply, actions) {
  if (!(await pathExists(CURSOR_HOOK_SOURCE))) throw new Error(`Hook template is missing: ${CURSOR_HOOK_SOURCE}`);
  if (!(await pathExists(CURSOR_CORE_SOURCE))) throw new Error(`Cursor routing core is missing: ${CURSOR_CORE_SOURCE}`);
  if (!(await pathExists(MAINTENANCE_CORE_SOURCE))) throw new Error(`Maintenance bootstrap core is missing: ${MAINTENANCE_CORE_SOURCE}`);
  const hooksPath = path.join(cursorHome, 'hooks.json');
  const hookPath = path.join(cursorHome, 'hooks', CURSOR_HOOK_FILE);
  const corePath = path.join(cursorHome, 'hooks', CURSOR_CORE_FILE);
  const maintenancePath = path.join(cursorHome, 'hooks', MAINTENANCE_CORE_FILE);
  const currentHook = await readText(hookPath);
  const nextHook = await readText(CURSOR_HOOK_SOURCE);
  const currentCore = await readText(corePath);
  const nextCore = await readText(CURSOR_CORE_SOURCE);
  const currentMaintenance = await readText(maintenancePath);
  const nextMaintenance = await readText(MAINTENANCE_CORE_SOURCE);
  const hooksState = await readJsonState(hooksPath, {});
  if (!hooksState.valid) throw new Error(`Cursor hooks configuration is not valid JSON: ${hooksPath}`);
  const nextHooks = normalizedCursorHooks(hooksState.value);
  const currentHooksText = hooksState.text;
  const nextHooksText = `${JSON.stringify(nextHooks, null, 2)}\n`;
  if (currentHook !== nextHook) actions.push({ kind: currentHook ? 'update' : 'create', path: hookPath, content: nextHook });
  if (currentCore !== nextCore) actions.push({ kind: currentCore ? 'update' : 'create', path: corePath, content: nextCore });
  if (currentMaintenance !== nextMaintenance) actions.push({ kind: currentMaintenance ? 'update' : 'create', path: maintenancePath, content: nextMaintenance });
  if (currentHooksText !== nextHooksText) actions.push({ kind: (await pathExists(hooksPath)) ? 'update' : 'create', path: hooksPath, content: nextHooksText });
}

async function audit(args) {
  const checks = [];
  if (args.surface === 'all' || args.surface === 'codex') checks.push(...await auditCodex(args.codexHome));
  if (args.surface === 'all' || args.surface === 'cursor') checks.push(...await auditCursor(args.cursorHome));
  return {
    command: 'audit',
    surface: args.surface,
    codexHome: args.codexHome,
    cursorHome: args.cursorHome,
    status: checks.every((check) => check.ok) ? 'pass' : 'fail',
    checks,
  };
}

async function install(args) {
  const actions = [];
  if (args.surface === 'all' || args.surface === 'codex') await installCodex(args.codexHome, args.apply, actions);
  if (args.surface === 'all' || args.surface === 'cursor') await installCursor(args.cursorHome, args.apply, actions);
  if (args.apply) {
    for (const action of actions) {
      await fs.mkdir(path.dirname(action.path), { recursive: true });
      await fs.writeFile(action.path, action.content, 'utf8');
    }
  }
  const checks = args.apply
    ? (await audit(args)).checks
    : [
      { name: 'managed-write-plan', ok: true, detail: `${actions.length} file(s) would change` },
      { name: 'preserve-existing-content', ok: true, detail: 'Only managed AGENTS blocks and named hook entries are owned' },
    ];
  return {
    command: 'install',
    surface: args.surface,
    codexHome: args.codexHome,
    cursorHome: args.cursorHome,
    applied: args.apply,
    status: args.apply ? (checks.every((check) => check.ok) ? 'pass' : 'fail') : 'dry-run',
    actions: actions.map(({ content, ...action }) => action),
    checks,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }
  let result;
  if (args.command === 'install') result = await install(args);
  else if (args.command === 'audit') result = await audit(args);
  else throw new Error(`Unknown command: ${args.command}`);
  process.stdout.write(args.json ? `${JSON.stringify(result, null, 2)}\n` : `${render(result)}\n`);
  if (result.status === 'fail') process.exitCode = 1;
}

main().catch((error) => {
  process.stderr.write(`global-devrules: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 2;
});
