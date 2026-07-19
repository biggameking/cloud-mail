#!/usr/bin/env node
// Cursor user-level hook that makes devrules routing self-triggering.
//
// Installed copy lives at ~/.cursor/hooks/devrules-cursor-hook.mjs and is
// registered in ~/.cursor/hooks.json for sessionStart, postToolUse,
// beforeSubmitPrompt, and stop. The template file under devrules/hooks/ is
// the source asset; reinstall by copying it over the installed copy.
//
// Behavior by event:
// - sessionStart: when the workspace has a devrules instance, inject a short
//   orientation context (routing entry, project profile, code-change gate,
//   template-version drift warning).
// - postToolUse: match edited file paths and shell commands against the
//   repository's devrules hook matcher fields (pathPatterns/commandPatterns)
//   and inject the matching hook targets once per conversation.
// - beforeSubmitPrompt and stop: return without persistent writes because these
//   events cannot inject context.
//
// Session start is read-only. postToolUse writes only small, best-effort
// per-conversation dedupe state after a concrete route is injected.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { globToRegExp, mergeHookRegistries, selectHookTarget } from './cursor-routing-core.mjs';
import { ensureIdleResourceScheduler } from './device-maintenance-bootstrap-core.mjs';

const STATE_DIR = path.join(os.homedir(), '.cursor', 'log', 'devrules-hook-state');
const MAX_INJECTED_HOOKS = 4;

function pathExists(target) {
  try {
    fs.accessSync(target);
    return true;
  } catch {
    return false;
  }
}

function readJsonSync(target) {
  try {
    return JSON.parse(fs.readFileSync(target, 'utf8'));
  } catch {
    return null;
  }
}

function findGitRoot(start) {
  let current = path.resolve(start);
  while (true) {
    if (pathExists(path.join(current, '.git'))) return current;
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

function devrulesDir(repoRoot) {
  // Project instances keep the system under devrules/; the shared template
  // repository is itself the system root.
  if (pathExists(path.join(repoRoot, 'devrules', 'always-readme.md'))) return path.join(repoRoot, 'devrules');
  if (pathExists(path.join(repoRoot, 'always-readme.md')) && pathExists(path.join(repoRoot, 'hooks', 'hooks.json'))) return repoRoot;
  return null;
}

function loadHooks(rulesDir) {
  const shared = readJsonSync(path.join(rulesDir, 'hooks', 'hooks.json'));
  const local = readJsonSync(path.join(rulesDir, 'hooks', 'hooks.local.json'));
  return mergeHookRegistries(shared, local);
}

function hookTarget(hook, prefix) {
  return selectHookTarget(hook, { prefix });
}

function matchHooks(hooks, { relPaths = [], command = '', prompt = '' }) {
  const matched = [];
  for (const hook of hooks) {
    if (!hook?.id) continue;
    let hit = null;
    for (const pattern of hook.pathPatterns || []) {
      const regex = globToRegExp(pattern);
      const relPath = relPaths.find((candidate) => regex.test(candidate));
      if (relPath) { hit = `path:${relPath}`; break; }
    }
    if (!hit && command) {
      for (const pattern of hook.commandPatterns || []) {
        try {
          if (new RegExp(pattern, 'i').test(command)) { hit = 'command'; break; }
        } catch { /* invalid pattern: skip */ }
      }
    }
    if (!hit && prompt) {
      for (const pattern of hook.promptPatterns || []) {
        try {
          if (new RegExp(pattern, 'i').test(prompt)) { hit = 'prompt'; break; }
        } catch { /* invalid pattern: skip */ }
      }
    }
    if (hit) matched.push({ hook, hit });
  }
  return matched;
}

function stateFile(conversationId) {
  const safe = String(conversationId || 'unknown').replace(/[^A-Za-z0-9_-]/g, '_');
  return path.join(STATE_DIR, `${safe}.json`);
}

function loadSurfaced(conversationId) {
  return new Set(readJsonSync(stateFile(conversationId)) || []);
}

async function saveSurfaced(conversationId, surfaced) {
  try {
    await fsp.mkdir(STATE_DIR, { recursive: true });
    await fsp.writeFile(stateFile(conversationId), JSON.stringify([...surfaced]), 'utf8');
  } catch { /* dedupe state is best-effort */ }
}

function candidateStarts(payload) {
  const starts = [];
  const input = payload.tool_input && typeof payload.tool_input === 'object' ? payload.tool_input : {};
  for (const key of ['path', 'file_path', 'filePath', 'target_notebook', 'notebook_path']) {
    if (typeof input[key] === 'string' && input[key]) starts.push(input[key]);
  }
  if (typeof payload.file_path === 'string' && payload.file_path) starts.push(payload.file_path);
  if (typeof payload.cwd === 'string' && payload.cwd) starts.push(payload.cwd);
  if (Array.isArray(payload.workspace_roots)) starts.push(...payload.workspace_roots.filter((value) => typeof value === 'string' && value));
  if (process.env.CURSOR_PROJECT_DIR) starts.push(process.env.CURSOR_PROJECT_DIR);
  return starts;
}

function resolveRepoRoot(payload) {
  // Prefer edited/referenced file paths first so multi-repo parent workspaces
  // (cwd = GithubMe/) still resolve the concrete product repository.
  for (const candidate of candidateStarts(payload)) {
    const absolute = path.isAbsolute(candidate) ? candidate : path.resolve(payload.cwd || process.cwd(), candidate);
    for (const start of [absolute, path.dirname(absolute)]) {
      const gitRoot = findGitRoot(start);
      if (gitRoot && devrulesDir(gitRoot)) return gitRoot;
    }
  }
  return null;
}

function runtimeConfigPath() {
  if (process.env.DEVRULES_RUNTIME_CONFIG) return path.resolve(process.env.DEVRULES_RUNTIME_CONFIG);
  if (process.platform === 'win32' && process.env.LOCALAPPDATA) {
    return path.join(process.env.LOCALAPPDATA, 'devrules', 'runtime.json');
  }
  const configHome = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  return path.join(configHome, 'devrules', 'runtime.json');
}

function runtimeConfig() {
  return readJsonSync(runtimeConfigPath());
}

function templateVersion() {
  const runtime = runtimeConfig();
  const templateRoot = runtime?.templateRoot || runtime?.template?.root;
  if (!templateRoot) return null;
  return readJsonSync(path.join(templateRoot, 'template.json'))?.version || null;
}

function idleResourceHint(rulesDir) {
  if (!['darwin', 'win32'].includes(process.platform)) return '';
  const bootstrap = ensureIdleResourceScheduler({ rulesDir });
  const hints = bootstrap.context ? [bootstrap.context] : [];
  if (!bootstrap.healthy || process.platform !== 'darwin') return hints.join(' ');
  const idlePolicy = readJsonSync(path.join(rulesDir, 'config.json'))?.idleResourceMaintenance || {};
  const softTarget = Number.isFinite(idlePolicy.softBootedSimulatorTarget)
    ? idlePolicy.softBootedSimulatorTarget
    : 3;
  // Keep this sync and cheap: count is only an observation, never shutdown authority.
  try {
    const out = execFileSync('xcrun', ['simctl', 'list', 'devices', 'booted'], {
      encoding: 'utf8',
      timeout: 4000,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const booted = (out.match(/\(Booted\)/g) || []).length;
    if (booted > softTarget) {
      hints.push(`Simulator count: ${booted} Booted devices is above the soft target ${softTarget}. Count alone does not authorize shutdown; follow idle-resource-maintenance.md only when sustained pressure or explicit lag is present.`);
    }
  } catch {
    // Toolchain may be absent; do not fail session start.
  }
  return hints.join(' ');
}

function sessionStartContext(repoRoot) {
  const rulesDir = devrulesDir(repoRoot);
  const isInstance = rulesDir !== repoRoot;
  const prefix = isInstance ? 'devrules' : '.';
  const lines = [
    `devrules is active in ${repoRoot}.`,
    `Routing: the always-applied .cursor/rules/devrules.mdc carries the generated routing card; treat matching triggers as mandatory reads. Orchestration root: ${prefix}/always-readme.md.`,
  ];
  if (isInstance && pathExists(path.join(rulesDir, 'memory', 'project-profile.md'))) {
    lines.push('Before non-trivial work read devrules/memory/project-profile.md.');
  }
  if (isInstance && pathExists(path.join(rulesDir, 'scripts', 'code-health.mjs'))) {
    lines.push('For executable code changes follow devrules/workflows/code-change.md and finish with: node devrules/scripts/code-health.mjs audit --repo .');
  }
  if (isInstance) {
    const instanceVersion = readJsonSync(path.join(rulesDir, 'manifest.json'))?.devrulesVersion;
    const template = templateVersion();
    if (instanceVersion && template && instanceVersion !== template) {
      lines.push(`Warning: instance devrules ${instanceVersion} lags shared template ${template}; suggest running template sync.`);
    }
  }
  const idleHint = idleResourceHint(rulesDir);
  if (idleHint) lines.push(idleHint);
  lines.push('Before ending a non-trivial task apply the memory feedback gate (devrules/rules/memory-governance.md).');
  return lines.join(' ');
}

function collectToolPaths(payload, repoRoot) {
  const input = payload.tool_input && typeof payload.tool_input === 'object' ? payload.tool_input : {};
  const candidates = [];
  for (const key of ['path', 'file_path', 'filePath', 'target_notebook', 'notebook_path']) {
    if (typeof input[key] === 'string' && input[key]) candidates.push(input[key]);
  }
  if (typeof payload.file_path === 'string' && payload.file_path) candidates.push(payload.file_path);
  const relPaths = [];
  for (const candidate of candidates) {
    const absolute = path.isAbsolute(candidate) ? candidate : path.join(repoRoot, candidate);
    let relative = path.relative(repoRoot, absolute).split(path.sep).join('/');
    if (relative.startsWith('..')) relative = candidate.split(path.sep).join('/');
    relPaths.push(relative);
  }
  return relPaths;
}

async function main() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  const payload = raw ? JSON.parse(raw) : {};
  const event = String(payload.hook_event_name || '').trim();
  const conversationId = payload.conversation_id || payload.session_id || 'unknown';
  const repoRoot = resolveRepoRoot(payload);

  if (!repoRoot) {
    process.stdout.write('{}\n');
    return;
  }
  const rulesDir = devrulesDir(repoRoot);
  const prefix = rulesDir === repoRoot ? '.' : 'devrules';

  if (event === 'sessionStart') {
    const context = sessionStartContext(repoRoot);
    process.stdout.write(`${JSON.stringify({ additional_context: context })}\n`);
    return;
  }

  if (event === 'postToolUse') {
    const toolName = String(payload.tool_name || '');
    const relPaths = collectToolPaths(payload, repoRoot);
    const command = toolName === 'Shell' && typeof payload.tool_input?.command === 'string' ? payload.tool_input.command : '';
    if (relPaths.length === 0 && !command) {
      process.stdout.write('{}\n');
      return;
    }
    const hooks = loadHooks(rulesDir);
    const matched = matchHooks(hooks, { relPaths, command });
    const surfaced = loadSurfaced(conversationId);
    const fresh = matched.filter(({ hook }) => !surfaced.has(hook.id)).slice(0, MAX_INJECTED_HOOKS);
    if (fresh.length === 0) {
      process.stdout.write('{}\n');
      return;
    }
    for (const { hook } of fresh) surfaced.add(hook.id);
    await saveSurfaced(conversationId, surfaced);
    const lines = fresh.map(({ hook, hit }) => `- ${hook.id} (${hit}): read ${hookTarget(hook, prefix)}`);
    const context = `devrules trigger matched for this change. Before continuing, honor:\n${lines.join('\n')}`;
    process.stdout.write(`${JSON.stringify({ additional_context: context })}\n`);
    return;
  }

  if (event === 'beforeSubmitPrompt') {
    process.stdout.write(`${JSON.stringify({ continue: true })}\n`);
    return;
  }

  process.stdout.write('{}\n');
}

main().catch(() => {
  // Fail open: routing enrichment must never block the agent.
  process.stdout.write('{}\n');
});
