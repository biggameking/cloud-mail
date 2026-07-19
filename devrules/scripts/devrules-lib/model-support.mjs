import fs from 'node:fs/promises';
import path from 'node:path';

import { pathExists } from './fs-actions.mjs';

const AGENT_READABLE_ROOT_FILES = [
  'always-readme.md',
  'CHANGELOG.md',
  'DESIGN.template.md',
  'DESIGN.example.md',
  'design-readme.md',
];
const AGENT_READABLE_OPERATING_FILES = [
  'hooks/README.md',
  'scripts/README.md',
  'registry/README.md',
];
const AGENT_READABLE_AREAS = ['rules', 'workflows', 'profiles', 'templates', 'memory'];
const POLICY_DOCUMENT = 'templates/devrules/model-support.md';
const LEGACY_CODE_TARGETS = ['templates/ui-primitive.tsx.template'];

const LEGACY_MODEL_METADATA_PATTERN = /(?:^|\n)\s*(?:<!--\s*)?model_support\s*:/i;
const CONCRETE_AGENT_DEFAULT_PATTERN = /(?:^|\n)\s*(?:default|preferred)\s*:\s*(?:codex|claude|gemini|grok)(?:\/[A-Za-z0-9._-]+)?\s*(?:,|\}|$)/i;
const NATURAL_LANGUAGE_AGENT_DEFAULT_PATTERN = /\b(?:declare|declares|use|uses)\s+Codex\s+as\s+the\s+default\s+surface\b/i;

async function listFilesRecursive(dirPath) {
  const files = [];
  let entries;
  try {
    entries = await fs.readdir(dirPath, { withFileTypes: true });
  } catch (error) {
    if (error?.code === 'ENOENT') return files;
    throw error;
  }

  for (const entry of entries) {
    if (entry.name.startsWith('._')) continue;
    const entryPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) files.push(...await listFilesRecursive(entryPath));
    else if (entry.isFile() && entryPath.endsWith('.md')) files.push(entryPath);
  }
  return files;
}

async function collectAgentCompatibilityTargets(devrulesRoot) {
  const targets = [];
  for (const relativePath of AGENT_READABLE_ROOT_FILES) {
    const filePath = path.join(devrulesRoot, relativePath);
    if (await pathExists(filePath)) targets.push(filePath);
  }
  for (const area of AGENT_READABLE_AREAS) {
    targets.push(...await listFilesRecursive(path.join(devrulesRoot, area)));
  }
  for (const relativePath of AGENT_READABLE_OPERATING_FILES) {
    const filePath = path.join(devrulesRoot, relativePath);
    if (await pathExists(filePath)) targets.push(filePath);
  }
  for (const relativePath of LEGACY_CODE_TARGETS) {
    const filePath = path.join(devrulesRoot, relativePath);
    if (await pathExists(filePath)) targets.push(filePath);
  }
  return [...new Set(targets)].sort((left, right) => left.localeCompare(right));
}

function removeLegacyModelDeclarations(content) {
  return String(content || '')
    .replace(/^\s*(?:<!--\s*|\/\/\s*)?model_support\s*:.*?(?:-->\s*)?\n/gim, '')
    .replace(/^\n+(?=(?:---|#))/, '');
}

export async function migrateLegacyModelDeclarations(devrulesRoot, { apply = false } = {}) {
  const actions = [];
  for (const filePath of await collectAgentCompatibilityTargets(devrulesRoot)) {
    const current = await fs.readFile(filePath, 'utf8');
    const next = removeLegacyModelDeclarations(current);
    if (next === current) continue;
    const relativePath = path.relative(devrulesRoot, filePath).split(path.sep).join('/');
    actions.push({ action: 'write', path: relativePath, mode: apply ? 'apply' : 'dry-run' });
    if (apply) await fs.writeFile(filePath, next, 'utf8');
  }
  return { apply, actions };
}

function policyViolations(content) {
  const violations = [];
  if (LEGACY_MODEL_METADATA_PATTERN.test(content)) violations.push('legacy model_support metadata');
  if (CONCRETE_AGENT_DEFAULT_PATTERN.test(content)) violations.push('concrete default or preferred Agent/model');
  if (NATURAL_LANGUAGE_AGENT_DEFAULT_PATTERN.test(content)) violations.push('natural-language concrete Agent default');
  return violations;
}

/**
 * The host and user own Agent/model selection. Shared devrules documents must
 * not select a model or request parameters on their behalf. The historical
 * export name is retained so existing project instances can upgrade without a
 * second audit integration path.
 */
export async function auditModelSupportMetadata(devrulesRoot, { templateMode = false } = {}) {
  const violations = [];
  for (const filePath of await collectAgentCompatibilityTargets(devrulesRoot)) {
    const relativePath = path.relative(devrulesRoot, filePath).split(path.sep).join('/');
    if (relativePath === POLICY_DOCUMENT) continue;
    const content = await fs.readFile(filePath, 'utf8');
    for (const reason of policyViolations(content)) violations.push({ relativePath, reason });
  }

  if (!violations.length) {
    return { missing: [], violations: [], issues: [], recommendations: [] };
  }

  const messages = violations.map(({ relativePath, reason }) => `${relativePath} contains ${reason}`);
  if (templateMode) {
    return {
      missing: [],
      violations,
      issues: messages.map((message) => ({
        severity: 'error',
        message: `${message}; shared devrules must inherit the host-selected Agent/model.`,
      })),
      recommendations: [],
    };
  }

  return {
    missing: [],
    violations,
    issues: [],
    recommendations: [{
      level: 3,
      message: `${violations.length} legacy model-selection declaration(s) remain in this project instance; they are ignored and may be removed during an explicit devrules upgrade.`,
    }],
  };
}
