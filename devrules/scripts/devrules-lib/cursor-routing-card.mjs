import fs from 'node:fs/promises';
import path from 'node:path';

import { mergeHookRegistries, selectHookTarget } from '../../hooks/cursor-routing-core.mjs';
import { atomicWriteFile } from './safe-files.mjs';
import { pathExists } from './fs-actions.mjs';

const ROUTING_START = '<!-- DEVRULES:ROUTING-START -->';
const ROUTING_END = '<!-- DEVRULES:ROUTING-END -->';

async function readJson(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function firstTarget(hook) {
  return selectHookTarget(hook).replace(/^\.\//, '');
}

function buildRoutingCard(hooks) {
  const lines = [
    ROUTING_START,
    '## devrules Routing Card (generated)',
    '',
    'Generated from `devrules/hooks/hooks.json` by `devrules/scripts/routing-card.mjs`; do not edit by hand.',
    'Hooks match task/file/command signals at runtime; read only the target for a matched id.',
    'Open the full hook registry only to debug routing or audit matcher definitions.',
    '',
  ];
  for (const hook of hooks) {
    if (!hook?.id) continue;
    lines.push(`- ${hook.id} -> ${firstTarget(hook)}`);
  }
  lines.push('');
  lines.push('Always: for executable code changes read `devrules/workflows/code-change.md` and finish with `node devrules/scripts/code-health.mjs audit --repo .`; write project memory only when the current request authorizes repository changes or explicitly asks for it (`devrules/rules/memory-governance.md`).');
  lines.push(ROUTING_END);
  return lines.join('\n');
}

function upsertRoutingBlock(content, card) {
  const start = content.indexOf(ROUTING_START);
  const end = content.indexOf(ROUTING_END);
  if (start !== -1 && end !== -1 && end > start) {
    const after = end + ROUTING_END.length;
    return `${content.slice(0, start).trimEnd()}\n\n${card}\n${content.slice(after).replace(/^\s*\n/, '')}`.trimEnd() + '\n';
  }
  return `${content.trimEnd()}\n\n${card}\n`;
}

export function inspectCursorRule(content, expectedContent = null) {
  const startCount = content.split(ROUTING_START).length - 1;
  const endCount = content.split(ROUTING_END).length - 1;
  const alwaysApply = /^---\s*[\s\S]*?^alwaysApply:\s*true\s*$[\s\S]*?^---\s*$/m.test(content);
  return {
    alwaysApply,
    startCount,
    endCount,
    valid: alwaysApply && startCount === 1 && endCount === 1,
    current: expectedContent === null ? null : content === expectedContent,
  };
}

export async function renderCursorRoutingCard(repoPath) {
  const repo = path.resolve(repoPath);
  const instanceHooks = path.join(repo, 'devrules', 'hooks', 'hooks.json');
  const templateHooks = path.join(repo, 'hooks', 'hooks.json');
  const hooksPath = (await pathExists(instanceHooks)) ? instanceHooks : templateHooks;
  const localHooksPath = path.join(path.dirname(hooksPath), 'hooks.local.json');
  const mdcPath = path.join(repo, '.cursor', 'rules', 'devrules.mdc');

  if (!(await pathExists(hooksPath))) return { repo, mdcPath, status: 'skip', reason: 'no hooks.json' };
  if (!(await pathExists(mdcPath))) return { repo, mdcPath, status: 'skip', reason: 'no .cursor/rules/devrules.mdc entry file' };
  const registry = await readJson(hooksPath);
  if (!registry || !Array.isArray(registry.hooks)) return { repo, mdcPath, status: 'skip', reason: 'invalid hooks.json' };
  const localRegistry = await readJson(localHooksPath);
  const hooks = mergeHookRegistries(registry, localRegistry);
  const current = await fs.readFile(mdcPath, 'utf8');
  const card = buildRoutingCard(hooks);
  const next = upsertRoutingBlock(current, card);
  return { repo, mdcPath, status: next === current ? 'unchanged' : 'would-update', current, next, card };
}

export async function refreshCursorRoutingCard(repoPath, apply) {
  const rendered = await renderCursorRoutingCard(repoPath);
  if (rendered.status !== 'would-update' || !apply) return rendered;
  await atomicWriteFile(rendered.mdcPath, rendered.next);
  return { ...rendered, status: 'updated' };
}
