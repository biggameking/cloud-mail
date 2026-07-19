import fs from 'node:fs/promises';
import path from 'node:path';

import {
  normalizeRel,
  pathExists,
  readText,
  today,
  writeText,
} from './fs-actions.mjs';
import { SKIP_DIRS } from './repo-discovery.mjs';

const LEGACY_MARKDOWN_DIRS = [
  { source: 'rules', target: path.join('devrules', 'rules') },
  { source: 'rule', target: path.join('devrules', 'rules') },
  { source: 'workflows', target: path.join('devrules', 'workflows') },
  { source: 'workflow', target: path.join('devrules', 'workflows') },
  { source: path.join('.agent', 'rules'), target: path.join('devrules', 'rules') },
  { source: path.join('.agent', 'workflows'), target: path.join('devrules', 'workflows') },
  { source: path.join('.agent', 'workflow'), target: path.join('devrules', 'workflows') },
  { source: path.join('.agent', 'templates'), target: path.join('devrules', 'templates', 'legacy') },
];

const LEGACY_CONTEXT_FILES = [
  'always-readme.md',
  path.join('rules', 'always-readme.md'),
  path.join('.agent', 'always-readme.md'),
];

const MARKDOWN_EXTENSIONS = new Set(['.md', '.mdx']);

function legacySourceId(sourceRel) {
  return normalizeRel(sourceRel).replace(/[^a-zA-Z0-9_.-]+/g, '_');
}

function importedMarkdownContent(sourceRel, content) {
  return `<!-- Imported from ${normalizeRel(sourceRel)} by devrules initialization on ${today()}. Review before treating as canonical. -->\n\n${content.trimEnd()}\n`;
}

async function chooseLegacyTarget(destPath, sourceRel) {
  if (!(await pathExists(destPath))) return destPath;

  const firstExisting = await readText(destPath);
  if (firstExisting.includes(`Imported from ${normalizeRel(sourceRel)}`)) return destPath;

  const parsed = path.parse(destPath);
  let candidate = path.join(parsed.dir, `legacy-${parsed.base}`);
  let index = 2;
  while (await pathExists(candidate)) {
    const existing = await readText(candidate);
    if (existing.includes(`Imported from ${normalizeRel(sourceRel)}`)) return candidate;
    candidate = path.join(parsed.dir, `legacy-${index}-${parsed.base}`);
    index += 1;
  }
  return candidate;
}

async function importLegacyMarkdownFile(repoPath, sourcePath, targetPath, sourceRel, apply, actions) {
  if (!(await pathExists(sourcePath))) return null;
  const content = await readText(sourcePath);
  if (!content.trim()) {
    actions.push({ action: 'skip', path: sourcePath, reason: 'legacy markdown source is empty' });
    return null;
  }

  const finalTarget = await chooseLegacyTarget(targetPath, sourceRel);
  if (await pathExists(finalTarget)) {
    const existing = await readText(finalTarget);
    if (existing.includes(`Imported from ${normalizeRel(sourceRel)}`)) {
      actions.push({ action: 'skip', path: finalTarget, reason: 'legacy markdown already imported' });
      return { source: sourceRel, target: normalizeRel(path.relative(repoPath, finalTarget)), mode: 'already-imported' };
    }
  }

  await writeText(finalTarget, importedMarkdownContent(sourceRel, content), apply, actions, `import legacy markdown from ${normalizeRel(sourceRel)}`);
  return { source: sourceRel, target: normalizeRel(path.relative(repoPath, finalTarget)), mode: apply ? 'imported' : 'dry-run' };
}

async function importLegacyMarkdownTree(repoPath, sourceDir, targetDir, sourceBaseRel, apply, actions, imports) {
  if (!(await pathExists(sourceDir))) return;
  const entries = await fs.readdir(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name);
    const relFromBase = path.relative(sourceDir, sourcePath);
    const sourceRel = path.join(sourceBaseRel, relFromBase);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      await importLegacyMarkdownTree(repoPath, sourcePath, path.join(targetDir, entry.name), sourceRel, apply, actions, imports);
    } else if (entry.isFile() && MARKDOWN_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      if (entry.name.toLowerCase() === 'always-readme.md') continue;
      const imported = await importLegacyMarkdownFile(repoPath, sourcePath, path.join(targetDir, entry.name), sourceRel, apply, actions);
      if (imported) imports.push(imported);
    }
  }
}

async function importLegacyContextFile(repoPath, sourceRel, apply, actions, imports) {
  const sourcePath = path.join(repoPath, sourceRel);
  if (!(await pathExists(sourcePath))) return;

  const marker = `<!-- DEVRULES:LEGACY-CONTEXT:${legacySourceId(sourceRel)} -->`;
  const targetPath = path.join(repoPath, 'devrules', 'memory', 'legacy-context.md');
  const existing = await readText(targetPath, '# Legacy Context Imports\n\nReview these imports and distill durable knowledge into project-profile, decisions, lessons, rules, or workflows.\n');
  if (existing.includes(marker)) {
    actions.push({ action: 'skip', path: targetPath, reason: `legacy context already imported from ${normalizeRel(sourceRel)}` });
    imports.push({ source: normalizeRel(sourceRel), target: 'devrules/memory/legacy-context.md', mode: 'already-imported' });
    return;
  }

  const sourceContent = await readText(sourcePath);
  if (!sourceContent.trim()) {
    actions.push({ action: 'skip', path: sourcePath, reason: 'legacy context source is empty' });
    return;
  }

  const section = `${marker}
## Imported: ${normalizeRel(sourceRel)}

Imported on ${today()}. Review and distill this content into canonical devrules files.

\`\`\`markdown
${sourceContent.trimEnd()}
\`\`\`
`;
  const next = `${existing.trimEnd()}\n\n${section}\n`;
  await writeText(targetPath, next, apply, actions, `import legacy context from ${normalizeRel(sourceRel)}`);
  imports.push({ source: normalizeRel(sourceRel), target: 'devrules/memory/legacy-context.md', mode: apply ? 'imported' : 'dry-run' });
}

export async function normalizeLegacyStructures(repoPath, apply, actions) {
  const imports = [];

  for (const sourceRel of LEGACY_CONTEXT_FILES) {
    await importLegacyContextFile(repoPath, sourceRel, apply, actions, imports);
  }

  for (const mapping of LEGACY_MARKDOWN_DIRS) {
    const sourceDir = path.join(repoPath, mapping.source);
    const targetDir = path.join(repoPath, mapping.target);
    if (!(await pathExists(sourceDir))) continue;
    await importLegacyMarkdownTree(repoPath, sourceDir, targetDir, mapping.source, apply, actions, imports);
  }

  return imports;
}
