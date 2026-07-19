import fs from 'node:fs/promises';
import path from 'node:path';

import { atomicWriteFile } from './safe-files.mjs';
import { refreshCursorRoutingCard } from './cursor-routing-card.mjs';
import { expectedFileAfter, pathExists } from './fs-actions.mjs';
import {
  assertSafeDirectoryChain,
  isCanonicalRelativePath,
  lstatOrNull,
} from './template-path-safety.mjs';

const ENTRY_START = '<!-- DEVRULES:ENTRY-START -->';
const ENTRY_END = '<!-- DEVRULES:ENTRY-END -->';
const CURSOR_RULE = '.cursor/rules/devrules.mdc';
const RESERVED_ENTRY_ROOTS = new Set(['.git', '.hg', '.svn', 'devrules']);

function normalizeRel(value) {
  return String(value || '').replaceAll('\\', '/').replace(/^\.\//, '').replace(/\/$/, '');
}

function configuredEntries(config, defaults) {
  const create = [...new Set(config.entryFiles.create || defaults.create)];
  const optional = [...new Set(config.entryFiles.bindIfPresent || defaults.bindIfPresent)]
    .filter((entryRel) => !create.includes(entryRel));
  return { create, optional, all: [...create, ...optional] };
}

async function safeEntryTarget(repoRoot, entryRel) {
  const raw = String(entryRel || '');
  const normalized = normalizeRel(entryRel);
  if (raw !== normalized || !isCanonicalRelativePath(normalized) || normalized.includes('\0')) {
    throw new Error(`unsafe or non-canonical project entry path: ${entryRel}`);
  }
  const segments = normalized.split('/');
  if (RESERVED_ENTRY_ROOTS.has(segments[0].toLowerCase())) {
    throw new Error(`project entry path targets repository control data: ${entryRel}`);
  }
  await assertSafeDirectoryChain(repoRoot, segments.slice(0, -1).join('/') || '.', 'project entry');
  const target = path.join(repoRoot, ...segments);
  const relative = path.relative(repoRoot, target);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`project entry path escapes the repository: ${entryRel}`);
  }
  const targetStat = await lstatOrNull(target);
  if (targetStat?.isSymbolicLink()) throw new Error(`project entry target is a symbolic link: ${entryRel}`);
  if (targetStat && !targetStat.isFile()) throw new Error(`project entry target is not a regular file: ${entryRel}`);
  return { entryRel: normalized, target };
}

export async function resolveSafeProjectEntryFile(repoPath, entryRel) {
  const repoRoot = await fs.realpath(path.resolve(repoPath));
  return safeEntryTarget(repoRoot, entryRel);
}

export async function validateConfiguredEntryFiles(repoPath, config, defaults) {
  const repoRoot = await fs.realpath(path.resolve(repoPath));
  const entries = configuredEntries(config, defaults);
  const targets = new Map();
  for (const entryRel of entries.all) {
    const safe = await safeEntryTarget(repoRoot, entryRel);
    targets.set(entryRel, safe);
  }
  return { repoRoot, entries, targets };
}

function entryBlock() {
  return `${ENTRY_START}
## devrules Priority Context

Read \`devrules/always-readme.md\` before applying the project-specific guidance below. devrules is the authoritative shared engineering context; this entry file is an Agent adapter and may add only repository- or tool-specific instructions.

This managed block may be updated by \`devrules/scripts/devrules.mjs\`; preserve the surrounding official Agent entry content.
${ENTRY_END}`;
}

export function countManagedBlocks(content) {
  const startCount = content.split(ENTRY_START).length - 1;
  const endCount = content.split(ENTRY_END).length - 1;
  return { startCount, endCount, valid: startCount === 1 && endCount === 1 };
}

function upsertManagedBlock(content) {
  const block = entryBlock();
  const start = content.indexOf(ENTRY_START);
  const end = content.indexOf(ENTRY_END);
  if (start !== -1 && end !== -1 && end > start) {
    const after = end + ENTRY_END.length;
    return `${content.slice(0, start).trimEnd()}\n\n${block}\n\n${content.slice(after).trimStart()}`.trimEnd() + '\n';
  }
  const normalized = content.trimStart();
  if (normalized.startsWith('---')) {
    const close = normalized.indexOf('\n---', 3);
    if (close !== -1) {
      const closeEnd = close + '\n---'.length;
      return `${normalized.slice(0, closeEnd).trimEnd()}\n\n${block}\n\n${normalized.slice(closeEnd).trimStart()}`.trimEnd() + '\n';
    }
  }
  const lines = content.split(/\r?\n/);
  const headingIndex = lines.findIndex((line) => /^#\s+/.test(line));
  if (headingIndex !== -1) {
    const before = lines.slice(0, headingIndex + 1).join('\n');
    const after = lines.slice(headingIndex + 1).join('\n').trimStart();
    return `${before}\n\n${block}\n\n${after}`.trimEnd() + '\n';
  }
  return `${block}\n\n${content.trimStart()}`.trimEnd() + '\n';
}

function minimalEntryFile(entryRel) {
  const normalized = normalizeRel(entryRel);
  if (normalized === CURSOR_RULE) {
    return `---
description: devrules orchestration entry for Cursor agents in this repository
alwaysApply: true
---

${entryBlock()}
`;
  }
  const title = path.basename(entryRel);
  const toolName = title === 'AGENTS.md' ? 'Codex' : 'Agent';
  return `# ${title}

${entryBlock()}

## Repository Context

Add project-specific ${toolName} guidance here. Keep existing official entry content in this file and let devrules provide the shared engineering context system.
`;
}

async function bindEntryFile(repoRoot, entryRel, apply, actions, createIfMissing) {
  const { target: filePath, entryRel: safeRel } = await safeEntryTarget(repoRoot, entryRel);
  const exists = await pathExists(filePath);
  if (!exists && !createIfMissing) {
    actions.push({ action: 'skip', path: filePath, reason: 'entry file not present' });
    return { exists: false, bound: false, created: false };
  }
  const current = exists ? await fs.readFile(filePath, 'utf8') : minimalEntryFile(safeRel);
  const next = exists ? upsertManagedBlock(current) : current;
  const nextMode = exists ? await fs.stat(filePath).then((stat) => stat.mode & 0o7777) : 0o644;
  const expectedAfter = expectedFileAfter(next, nextMode);
  if (exists && current === next) {
    actions.push({ action: 'skip', path: filePath, reason: 'managed block already current' });
  } else if (!apply) {
    actions.push({ action: 'write', path: filePath, reason: exists ? 'upsert devrules managed block' : `create ${safeRel} with devrules managed block`, mode: 'dry-run', expectedAfter });
  } else {
    await safeEntryTarget(repoRoot, safeRel);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await safeEntryTarget(repoRoot, safeRel);
    await atomicWriteFile(filePath, next);
    actions.push({ action: 'write', path: filePath, reason: exists ? 'upsert devrules managed block' : `create ${safeRel} with devrules managed block`, mode: 'applied', expectedAfter });
  }
  return { exists: true, bound: true, created: !exists };
}

export async function bindConfiguredEntryFiles(repoPath, config, apply, actions, defaults) {
  // Preflight the complete configured set before the first write, then recheck
  // each target immediately before use to reject symlink topology changes.
  const { repoRoot, entries } = await validateConfiguredEntryFiles(repoPath, config, defaults);
  const results = [];
  for (const entryRel of entries.create) {
    const result = await bindEntryFile(repoRoot, entryRel, apply, actions, true);
    results.push({ file: entryRel, required: true, ...result });
  }
  for (const entryRel of entries.optional) {
    const result = await bindEntryFile(repoRoot, entryRel, apply, actions, false);
    results.push({ file: entryRel, required: false, ...result });
  }
  return results;
}

export async function ensureCursorRoutingCard(repoPath, apply, actions, options = {}) {
  const repoRoot = await fs.realpath(path.resolve(repoPath));
  const { target: mdcPath } = await safeEntryTarget(repoRoot, CURSOR_RULE);
  if (!(await pathExists(mdcPath))) {
    const planned = !apply && options.plannedCreate === true;
    actions.push({ action: planned ? 'run' : 'skip', path: mdcPath, reason: planned ? 'would refresh Cursor routing card after creating the entry file' : 'cursor entry file not present', ...(planned ? { mode: 'dry-run' } : {}) });
    return;
  }
  try {
    await safeEntryTarget(repoRoot, CURSOR_RULE);
    const result = await refreshCursorRoutingCard(repoRoot, apply);
    if (result.status === 'skip') actions.push({ action: 'skip', path: mdcPath, reason: result.reason });
    else if (result.status === 'unchanged') actions.push({ action: 'skip', path: mdcPath, reason: 'Cursor routing card already current' });
    else actions.push({ action: 'run', path: mdcPath, reason: apply ? 'refresh Cursor routing card' : 'would refresh Cursor routing card', mode: apply ? 'applied' : 'dry-run',
      expectedAfter: expectedFileAfter(result.next, await fs.stat(mdcPath).then((stat) => stat.mode & 0o7777).catch(() => 0o644)) });
  } catch (error) {
    actions.push({ action: 'warn', path: mdcPath, reason: `routing-card refresh failed: ${error instanceof Error ? error.message : String(error)}` });
  }
}
