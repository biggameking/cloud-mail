#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

import { ensureIdleResourceScheduler } from './device-maintenance-bootstrap-core.mjs';

const CODING_PROMPT_RE = /\b(add|build|change|code|create|debug|develop|fix|implement|migrate|modify|optimi[sz]e|refactor|remove|rename|repair|test|update)\b|代码|编码|开发|实现|新增|修改|修复|重构|优化|测试|迁移|删除|命名|架构|模块/i;
const ROUTE_ACTIVATIONS = new Set(['always', 'conditional', 'explicit']);

function safeString(value) {
  return typeof value === 'string' ? value : '';
}

function readEvent(payload) {
  return safeString(payload.hook_event_name ?? payload.hookEventName ?? payload.event ?? payload.name).trim();
}

function readPrompt(payload) {
  return safeString(payload.prompt ?? payload.input ?? payload.user_prompt ?? payload.userPrompt ?? payload.text).trim();
}

function readCwd(payload) {
  const value = safeString(payload.cwd ?? payload.project_path ?? payload.projectPath).trim();
  return path.resolve(value || process.cwd());
}

function pathExists(target) {
  try {
    fs.accessSync(target);
    return true;
  } catch {
    return false;
  }
}

function findGitRoot(cwd) {
  let current = cwd;
  while (true) {
    if (pathExists(path.join(current, '.git'))) return current;
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

function devrulesDir(root) {
  if (!root) return '';
  if (pathExists(path.join(root, 'devrules', 'always-readme.md'))) return path.join(root, 'devrules');
  if (pathExists(path.join(root, 'always-readme.md')) && pathExists(path.join(root, 'hooks', 'hooks.json'))) return root;
  return '';
}

function detectProfiles(root) {
  if (!root) return [];
  const profiles = [];
  if (['package.json', 'tsconfig.json', 'jsconfig.json'].some((file) => pathExists(path.join(root, file)))) profiles.push('typescript-javascript');
  if (pathExists(path.join(root, 'Cargo.toml'))) profiles.push('rust');
  if (['pyproject.toml', 'requirements.txt', 'setup.py', 'Pipfile'].some((file) => pathExists(path.join(root, file)))) profiles.push('python');
  if (pathExists(path.join(root, 'go.mod'))) profiles.push('go');
  if (pathExists(path.join(root, 'Package.swift'))) profiles.push('swift');
  try {
    if (!profiles.includes('swift') && fs.readdirSync(root).some((name) => name.endsWith('.xcodeproj') || name.endsWith('.xcworkspace'))) profiles.push('swift');
  } catch {
    // An unreadable root has no detected language profile.
  }
  return profiles;
}

function readJson(target) {
  try {
    return JSON.parse(fs.readFileSync(target, 'utf8'));
  } catch {
    return null;
  }
}

// The installed Codex hook is copied without cursor-routing-core.mjs. Keep this
// deliberately thin equivalent aligned with the shared Cursor/card selector;
// common fixtures in routing-performance-selftest lock their behavior together.
function normalizeRouteEntry(entry) {
  if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
    const target = String(entry.target || '').trim();
    if (!target) return null;
    return {
      ...entry,
      target,
      activation: ROUTE_ACTIVATIONS.has(entry.activation) ? entry.activation : 'explicit',
      primary: entry.primary === true,
    };
  }
  if (typeof entry !== 'string') return null;
  const target = entry.match(/(?:devrules\/)?(?:[A-Za-z0-9_.-]+\/)*[A-Za-z0-9_.-]+\.md\b/)?.[0] || '';
  if (!target) return null;
  const conditionText = entry.replace(target, '').replace(/^\s*(?:and|plus)\s+/i, '').trim();
  return {
    target,
    activation: conditionText ? 'conditional' : 'always',
    primary: false,
    condition: conditionText ? { type: 'legacy_text', text: conditionText } : undefined,
  };
}

function evaluateRouteCondition(condition, context = {}) {
  if (!condition || typeof condition !== 'object' || Array.isArray(condition)) return false;
  if (Array.isArray(condition.all)) {
    return condition.all.length > 0 && condition.all.every((item) => evaluateRouteCondition(item, context));
  }
  if (Array.isArray(condition.any)) {
    return condition.any.length > 0 && condition.any.some((item) => evaluateRouteCondition(item, context));
  }
  if (condition.not) return !evaluateRouteCondition(condition.not, context);
  if (condition.type === 'legacy_text' || condition.type === 'manual') return false;
  if (typeof condition.fact === 'string') {
    const actual = context.facts?.[condition.fact];
    if (Object.hasOwn(condition, 'equals')) return actual === condition.equals;
    if (Array.isArray(condition.in)) return condition.in.includes(actual);
    return actual === true;
  }
  if (condition.source === 'context' && typeof condition.pattern === 'string') {
    try {
      return new RegExp(condition.pattern, condition.flags || 'i').test(String(context.text || ''));
    } catch {
      return false;
    }
  }
  return false;
}

function selectRouteEntry(entries, expectedTarget, context) {
  const eligible = (Array.isArray(entries) ? entries : [])
    .map(normalizeRouteEntry)
    .filter(Boolean)
    .filter((entry) => entry.activation === 'always'
      || (entry.activation === 'conditional' && evaluateRouteCondition(entry.condition, context)));
  return eligible.find((entry) => entry.primary)
    || eligible.find((entry) => expectedTarget && path.basename(entry.target) === expectedTarget)
    || eligible.find((entry) => entry.activation === 'always')
    || eligible[0]
    || null;
}

function routeTarget(hook, prefix, context) {
  const workflow = selectRouteEntry(hook.workflows, `${hook.id}.md`, context);
  if (workflow) {
    const target = workflow.target.replace(/^devrules\//, '').replace(/^workflows\//, '');
    return `${prefix}workflows/${target}`;
  }
  const read = selectRouteEntry(hook.read, '', context);
  if (!read) return '';
  if (read.target.startsWith('devrules/')) return read.target;
  return `${prefix}${read.target.replace(/^\.\//, '')}`;
}

function loadPromptRoutes(rulesDir, prompt) {
  const registries = [
    readJson(path.join(rulesDir, 'hooks', 'hooks.json')),
    readJson(path.join(rulesDir, 'hooks', 'hooks.local.json')),
  ];
  const merged = new Map();
  for (const registry of registries) {
    for (const hook of Array.isArray(registry?.hooks) ? registry.hooks : []) {
      if (hook?.id) merged.set(hook.id, hook);
    }
  }
  const routes = [];
  for (const hook of merged.values()) {
    if (!hook?.id || !Array.isArray(hook.promptPatterns)) continue;
    const matched = hook.promptPatterns.some((pattern) => {
      try {
        return new RegExp(pattern, 'i').test(prompt);
      } catch {
        return false;
      }
    });
    if (!matched) continue;
    const prefix = rulesDir.endsWith(`${path.sep}devrules`) ? 'devrules/' : '';
    const target = routeTarget(hook, prefix, { text: prompt });
    if (target && !routes.some((route) => route.target === target)) routes.push({ id: hook.id, target });
  }
  return routes.slice(0, 3);
}

function buildContext(root, prompt = '', preloadedRoutes = null) {
  if (!root) {
    return 'Global devrules code-health guidance applies. Identify the concrete repository and local instructions; keep changes focused and verify with repository-native tools.';
  }
  const rulesDir = devrulesDir(root);
  const profiles = detectProfiles(root);
  if (!rulesDir) {
    return [
      `Global devrules code-health guidance applies to repository ${root}.`,
      profiles.length > 0 ? `Detected profiles: ${profiles.join(', ')}.` : '',
      'No project-local devrules instance was detected; follow repository-local instructions first.',
    ].filter(Boolean).join(' ');
  }
  const prefix = rulesDir === root ? '' : 'devrules/';
  const routes = Array.isArray(preloadedRoutes)
    ? preloadedRoutes
    : (prompt ? loadPromptRoutes(rulesDir, prompt) : []);
  const hasChecker = pathExists(path.join(rulesDir, 'scripts', 'code-health.mjs'));
  return [
    `devrules applies at ${root}.`,
    `Read ${prefix}always-readme.md once; load project profile, rules, and language profiles only when the task needs facts they contain.`,
    routes.length > 0 ? `Matched routes: ${routes.map((route) => `${route.id} -> ${route.target}`).join('; ')}.` : '',
    profiles.length > 0 ? `Detected profiles: ${profiles.join(', ')}.` : '',
    hasChecker ? `After edits, run node ${prefix}scripts/code-health.mjs audit --repo .` : '',
  ].filter(Boolean).join(' ');
}

async function main() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  const payload = raw ? JSON.parse(raw) : {};
  const event = readEvent(payload);
  const prompt = readPrompt(payload);
  const cwd = readCwd(payload);
  const root = findGitRoot(cwd);
  const rulesDir = devrulesDir(root);
  const promptRoutes = event === 'UserPromptSubmit' && prompt && rulesDir
    ? loadPromptRoutes(rulesDir, prompt)
    : [];
  const promptMatched = Boolean(prompt && (CODING_PROMPT_RE.test(prompt) || promptRoutes.length > 0));
  const bootstrap = event === 'SessionStart'
    ? ensureIdleResourceScheduler({ rulesDir: devrulesDir(root) })
    : null;

  if (event !== 'SessionStart' && event !== 'UserPromptSubmit') return;
  if (event === 'UserPromptSubmit' && !promptMatched) return;

  process.stdout.write(`${JSON.stringify({
    hookSpecificOutput: {
      hookEventName: event,
      additionalContext: [buildContext(root, prompt, promptRoutes), bootstrap?.context].filter(Boolean).join(' '),
    },
  })}\n`);
}

main().catch((error) => {
  process.stderr.write(`devrules global hook: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
