import fs from 'node:fs/promises';
import path from 'node:path';

import { pathExists } from './fs-actions.mjs';

const WORK_SYSTEM_OWNERSHIP = new Set(['shared', 'seed', 'local']);
const LEGACY_OWNERSHIP = new Map([
  ['universal', 'shared'],
  ['seed', 'seed'],
  ['local', 'local'],
  ['complete-generic', 'shared'],
  ['partial-generic', 'seed'],
  ['project-private', 'local'],
]);
const BASELINE_HOOK_IDS = new Set([
  'session-start',
  'multi-device-registry-handoff',
  'git-multi-device-sync',
  'before-edit-route',
  'code-health-change',
  'architecture-change-review',
  'production-change-governance',
  'failure-root-cause',
  'memory-distill',
  'post-task-feedback',
  'template-sync-propagation',
  'workspace-initialization',
  'devrules-script-automation',
  'game-development',
  'i18n-multilingual-adaptation',
  'revenuecat-integration',
  'release-readiness',
  'node-package-change',
  'desktop-native-change',
]);
const OWNERSHIP_SCHEMA = {
  shared: 'Portable system owned by the canonical template. Ownership does not imply always-on activation.',
  seed: 'Reusable starter system. Template seeds projects, then project edits stay local unless the user requests promotion.',
  local: 'Project-owned system. Keep it in the project instance unless the user explicitly reclassifies it.',
};

const NODE_PACKAGE_HOOK = {
  id: 'node-package-change',
  event: 'file_change',
  when: 'package.json, lockfiles, build config, or frontend source changes.',
  read: ['devrules/templates/performance/performance-optimization.md when performance-sensitive'],
  run: [],
  workflows: ['documentation-update.md', 'debug-root-cause.md on failing checks'],
  ownership: 'shared',
  governs: 'agent',
  activation: 'conditional',
  enforcement: 'advisory',
  decision_owner: 'project',
  side_effects: 'local',
};

const DESKTOP_NATIVE_HOOK = {
  id: 'desktop-native-change',
  event: 'file_change',
  when: 'src-tauri, Cargo files, native commands, capabilities, updater, filesystem, or sidecar code changes.',
  read: ['devrules/templates/desktop/README.md', 'devrules/templates/security/local-security.md'],
  run: [],
  workflows: ['debug-root-cause.md', 'release.md for packaging/updater changes'],
  ownership: 'shared',
  governs: 'agent',
  activation: 'conditional',
  enforcement: 'advisory',
  decision_owner: 'project',
  side_effects: 'local',
};

function normalizeWorkSystemOwnership(item, defaultOwnership) {
  if (WORK_SYSTEM_OWNERSHIP.has(item?.ownership)) return item.ownership;
  if (LEGACY_OWNERSHIP.has(item?.scope)) return LEGACY_OWNERSHIP.get(item.scope);
  if (LEGACY_OWNERSHIP.has(item?.generality)) return LEGACY_OWNERSHIP.get(item.generality);
  return defaultOwnership;
}

function inferredHookGovernance(hook) {
  const id = String(hook?.id || '').toLowerCase();
  let governs = 'agent';
  if (/(revenuecat|supabase|cloudflare|developer-service|app-store)/.test(id)) governs = 'external_service';
  else if (/(idle-resource|simulator|device|credential|terminal)/.test(id)) governs = 'device';
  else if (/(release|production-change|template-sync|git-multi-device)/.test(id)) governs = 'release';
  else if (/(product-architecture|ios-account-data|landing|design|game|i18n)/.test(id)) governs = 'product';

  const explicit = ['external_service', 'release'].includes(governs) || id === 'idle-resource-maintenance';
  return {
    governs,
    activation: id === 'session-start' ? 'always' : (explicit ? 'explicit' : 'conditional'),
    enforcement: id === 'session-start' ? 'hard' : (['external_service', 'release'].includes(governs) ? 'gate' : 'advisory'),
    decision_owner: id === 'session-start' ? 'devrules' : (governs === 'external_service' ? 'user' : 'project'),
    side_effects: id === 'session-start' ? 'none' : (['external_service', 'release'].includes(governs) ? 'external' : 'local'),
  };
}

export async function buildHooksJsonContent(templateRoot, stack, config, lastUpdated, registryKind = 'shared') {
  const templatePath = path.join(templateRoot, 'hooks', 'hooks.json');
  const templateContent = await fs.readFile(templatePath, 'utf8');
  const registry = JSON.parse(templateContent);
  const hooks = Array.isArray(registry.hooks) ? structuredClone(registry.hooks) : [];
  const hookIds = new Set(hooks.map((hook) => hook?.id).filter(Boolean));
  const projectHooks = [];
  if (stack.includes('node') && !hookIds.has(NODE_PACKAGE_HOOK.id)) projectHooks.push(structuredClone(NODE_PACKAGE_HOOK));
  if ((stack.includes('tauri') || stack.includes('rust')) && !hookIds.has(DESKTOP_NATIVE_HOOK.id)) projectHooks.push(structuredClone(DESKTOP_NATIVE_HOOK));

  const disabled = new Set(config.hooks.disabledHookIds || []);
  if (registryKind !== 'local' && config.hooks.enabled !== false && disabled.size === 0) {
    return templateContent.endsWith('\n') ? templateContent : `${templateContent}\n`;
  }
  const sharedHooks = hooks
    .filter((hook) => !disabled.has(hook.id))
    .map((hook) => ({ ownership: 'shared', ...hook }));
  const localHooks = [
    ...projectHooks.filter((hook) => !disabled.has(hook.id)),
    ...(config.hooks.extraHooks || []).map((hook) => ({ ownership: 'local', ...hook })),
  ].map((hook) => ({ ...hook, ownership: 'local' }));
  const kind = registryKind === 'local' ? 'local' : 'shared';
  return `${JSON.stringify({
    schemaVersion: 3,
    description: kind === 'local'
      ? 'Project-owned Agent workflow hooks. This file is never managed by template sync.'
      : 'Template-owned shared Agent workflow hooks. Project-local hooks belong in hooks.local.json.',
    ownershipSchema: OWNERSHIP_SCHEMA,
    lastUpdated,
    hooks: config.hooks.enabled === false ? [] : kind === 'local' ? localHooks : sharedHooks,
  }, null, 2)}\n`;
}

export function normalizeHookRegistryMetadata(content) {
  let registry;
  try {
    registry = JSON.parse(content);
  } catch {
    return null;
  }

  let changed = false;
  if (JSON.stringify(registry.ownershipSchema) !== JSON.stringify(OWNERSHIP_SCHEMA)) {
    registry.ownershipSchema = OWNERSHIP_SCHEMA;
    changed = true;
  }
  for (const legacySchema of ['generalitySchema', 'scopeSchema']) {
    if (registry[legacySchema]) {
      delete registry[legacySchema];
      changed = true;
    }
  }
  if (Array.isArray(registry.hooks)) {
    for (const hook of registry.hooks) {
      const defaultOwnership = ['game-development', 'idle-resource-maintenance'].includes(hook?.id)
        ? 'seed'
        : (BASELINE_HOOK_IDS.has(hook?.id) ? 'shared' : 'local');
      const nextOwnership = normalizeWorkSystemOwnership(hook, defaultOwnership);
      if (hook.ownership !== nextOwnership) {
        hook.ownership = nextOwnership;
        changed = true;
      }
      const inferred = inferredHookGovernance(hook);
      for (const [field, value] of Object.entries(inferred)) {
        if (!hook[field]) {
          hook[field] = value;
          changed = true;
        }
      }
      for (const legacyField of ['scope', 'generality', 'syncPolicy']) {
        if (hook[legacyField]) {
          delete hook[legacyField];
          changed = true;
        }
      }
    }
  }
  return changed ? `${JSON.stringify(registry, null, 2)}\n` : content;
}

function routeEntryTarget(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return typeof value.target === 'string' ? value.target.trim() : '';
  }
  return typeof value === 'string' ? value.trim() : '';
}

function parseHookLocalReference(value, kind) {
  const text = routeEntryTarget(value);
  if (kind === 'workflow') {
    const match = text.match(/^(?:devrules\/workflows\/|workflows\/)?([A-Za-z0-9._-]+\.md)(?:\s|$)/);
    return match ? path.join('workflows', match[1]) : null;
  }

  const match = text.match(/^devrules\/([A-Za-z0-9._/-]+\.[A-Za-z0-9_-]+)(?:\s|$)/);
  if (!match) return null;
  const relativePath = match[1].split('/').join(path.sep);
  if (['memory', 'registry', 'reports'].includes(relativePath.split(path.sep)[0])) return null;
  return relativePath;
}

async function auditHookLocalReferences(devrulesRoot, hook, issues) {
  const hookLabel = hook?.id || '<unknown>';
  for (const [kind, values] of [['read', hook?.read], ['workflow', hook?.workflows]]) {
    if (!Array.isArray(values)) continue;
    for (const value of values) {
      const relativePath = parseHookLocalReference(value, kind);
      if (!relativePath) continue;
      const optional = value && typeof value === 'object'
        ? value.activation !== 'always'
        : /\b(?:when|if)\s+(?:present|available)\b/i.test(String(value));
      if (!optional && !(await pathExists(path.join(devrulesRoot, relativePath)))) {
        issues.push({
          severity: 'warn',
          message: `Hook ${hookLabel} references missing local ${kind} file: ${relativePath.split(path.sep).join('/')}.`,
        });
      }
    }
  }
}

function auditStructuredRoutes(hook, issues, { allowLegacy = false, required = false } = {}) {
  const hookLabel = hook?.id || '<unknown>';
  let primaryCount = 0;
  for (const [kind, values] of [['read', hook?.read], ['workflows', hook?.workflows]]) {
    if (!Array.isArray(values)) {
      issues.push({ severity: 'error', message: `Hook ${hookLabel} ${kind} must be an array.` });
      continue;
    }
    for (const [index, value] of values.entries()) {
      if (typeof value === 'string') {
        if (required && !allowLegacy) {
          issues.push({ severity: 'error', message: `Hook ${hookLabel} ${kind}[${index}] must use a v3 target/activation object.` });
        }
        continue;
      }
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        issues.push({ severity: 'error', message: `Hook ${hookLabel} ${kind}[${index}] is not a valid route entry.` });
        continue;
      }
      if (typeof value.target !== 'string' || !value.target.trim()) {
        issues.push({ severity: 'error', message: `Hook ${hookLabel} ${kind}[${index}] is missing target.` });
      }
      if (!['always', 'conditional', 'explicit'].includes(value.activation)) {
        issues.push({ severity: 'error', message: `Hook ${hookLabel} ${kind}[${index}] has invalid activation.` });
      }
      if (value.activation === 'conditional'
        && (!value.condition || typeof value.condition !== 'object' || Array.isArray(value.condition))) {
        issues.push({ severity: 'error', message: `Hook ${hookLabel} ${kind}[${index}] needs a structured condition.` });
      }
      if (value.primary === true) {
        primaryCount += 1;
        if (value.activation !== 'always') {
          issues.push({ severity: 'error', message: `Hook ${hookLabel} primary route must use always activation.` });
        }
      }
    }
  }
  if (required && primaryCount !== 1) {
    issues.push({ severity: 'error', message: `Hook ${hookLabel} must declare exactly one primary route; found ${primaryCount}.` });
  }
}

function duplicateHookIds(hooks) {
  const ids = hooks.map((hook) => hook?.id).filter(Boolean);
  return [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
}

export async function auditHookRegistries(devrulesRoot, {
  requiredHookIds = ['session-start', 'before-edit-route', 'code-health-change', 'failure-root-cause'],
} = {}) {
  const issues = [];
  const recommendations = [];
  const hooksPath = path.join(devrulesRoot, 'hooks', 'hooks.json');
  const localHooksPath = path.join(devrulesRoot, 'hooks', 'hooks.local.json');
  let hookEntries = [];
  let localHookEntries = [];
  let valid = false;

  if (!(await pathExists(hooksPath))) {
    issues.push({ severity: 'error', message: 'Missing hook file: hooks/hooks.json.' });
  } else {
    try {
      const registry = JSON.parse(await fs.readFile(hooksPath, 'utf8'));
      hookEntries = Array.isArray(registry.hooks) ? registry.hooks : [];
      valid = true;
      const structuredRoutesRequired = Number(registry.schemaVersion) >= 3;
      const ids = new Set(hookEntries.map((hook) => hook?.id).filter(Boolean));
      for (const duplicateId of duplicateHookIds(hookEntries)) {
        issues.push({ severity: 'error', message: `Duplicate hook id: ${duplicateId}.` });
      }
      for (const required of requiredHookIds) {
        if (!ids.has(required)) recommendations.push({ level: 4, message: `Consider adding required baseline hook: ${required}` });
      }
      for (const hook of hookEntries) {
        const hookLabel = hook?.id || '<unknown>';
        if (!WORK_SYSTEM_OWNERSHIP.has(hook?.ownership)) {
          issues.push({ severity: 'warn', message: `Hook ${hookLabel} missing valid ownership metadata.` });
        } else if (hook.ownership === 'local') {
          issues.push({ severity: 'error', message: `Project-local hook ${hookLabel} must move from hooks.json to hooks.local.json.` });
        }
        const expectedFields = {
          governs: ['agent', 'product', 'device', 'release', 'external_service'],
          activation: ['always', 'conditional', 'explicit'],
          enforcement: ['hard', 'gate', 'advisory', 'example'],
          decision_owner: ['devrules', 'project', 'user'],
          side_effects: ['none', 'local', 'external'],
        };
        for (const [field, allowed] of Object.entries(expectedFields)) {
          if (!allowed.includes(hook?.[field])) issues.push({ severity: 'error', message: `Hook ${hookLabel} missing valid ${field} metadata.` });
        }
        if (hook.governs !== 'agent' && hook.activation === 'always') {
          issues.push({ severity: 'error', message: `Hook ${hookLabel} cannot make ${hook.governs} governance always-on.` });
        }
        if (hook.governs !== 'agent' && hook.decision_owner === 'devrules') {
          issues.push({ severity: 'error', message: `Hook ${hookLabel} cannot make devrules the decision owner for ${hook.governs}.` });
        }
        if (hook.side_effects !== 'none' && hook.activation === 'always') {
          issues.push({ severity: 'error', message: `Hook ${hookLabel} cannot run side effects from always-on activation.` });
        }
        auditStructuredRoutes(hook, issues, { required: structuredRoutesRequired });
        await auditHookLocalReferences(devrulesRoot, hook, issues);
      }
    } catch {
      issues.push({ severity: 'error', message: 'hooks/hooks.json is not valid JSON.' });
    }
  }

  if (await pathExists(localHooksPath)) {
    try {
      const registry = JSON.parse(await fs.readFile(localHooksPath, 'utf8'));
      localHookEntries = Array.isArray(registry.hooks) ? registry.hooks : [];
      for (const duplicateId of duplicateHookIds(localHookEntries)) {
        issues.push({ severity: 'error', message: `Duplicate local hook id: ${duplicateId}.` });
      }
      for (const hook of localHookEntries) {
        if (hook?.ownership !== 'local' && hook?.scope !== 'local') {
          issues.push({ severity: 'warn', message: `Hook ${hook?.id || '<unknown>'} in hooks.local.json should use local ownership.` });
        }
        auditStructuredRoutes(hook, issues, { allowLegacy: true });
        await auditHookLocalReferences(devrulesRoot, hook, issues);
      }
    } catch {
      issues.push({ severity: 'error', message: 'hooks/hooks.local.json is not valid JSON.' });
    }
  }

  return { valid, hookEntries, localHookEntries, issues, recommendations };
}
