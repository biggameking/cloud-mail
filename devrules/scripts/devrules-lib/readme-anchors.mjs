import fs from 'node:fs/promises';
import path from 'node:path';

import {
  expectedAbsentAfter,
  listDirs,
  listFiles,
  normalizeRel,
  pathExists,
  readText,
  today,
  writeText,
} from './fs-actions.mjs';
import { SKIP_DIRS } from './repo-discovery.mjs';

const README_ANCHOR_START = '<!-- DEVRULES:README-ANCHOR-START -->';
const README_ANCHOR_END = '<!-- DEVRULES:README-ANCHOR-END -->';

export const README_ANCHOR_SKIP_DIRS = new Set([
  ...SKIP_DIRS,
  'gen',
  'generated',
  'icons',
  'assets',
  'static',
  'public',
  'fixtures',
  '__fixtures__',
  '__snapshots__',
]);

export const README_ANCHOR_SOURCE_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.rs',
  '.go',
  '.py',
  '.java',
  '.kt',
  '.swift',
  '.vue',
  '.svelte',
  '.astro',
  '.gd',
  '.gdshader',
  '.css',
  '.scss',
  '.html',
]);

function upsertManagedSection(content, startMarker, endMarker, section) {
  const start = content.indexOf(startMarker);
  const end = content.indexOf(endMarker);

  if (start !== -1 && end !== -1 && end > start) {
    const after = end + endMarker.length;
    return `${content.slice(0, start).trimEnd()}\n\n${section}\n\n${content.slice(after).trimStart()}`.trimEnd() + '\n';
  }

  const lines = content.split(/\r?\n/);
  const headingIndex = lines.findIndex((line) => /^#\s+/.test(line));
  if (headingIndex !== -1) {
    const before = lines.slice(0, headingIndex + 1).join('\n');
    const after = lines.slice(headingIndex + 1).join('\n').trimStart();
    return `${before}\n\n${section}\n\n${after}`.trimEnd() + '\n';
  }

  return `${section}\n\n${content.trimStart()}`.trimEnd() + '\n';
}

async function directSourceFilesForAnchor(dirPath) {
  const files = await listFiles(dirPath);
  return files
    .filter((file) => README_ANCHOR_SOURCE_EXTENSIONS.has(path.extname(file).toLowerCase()))
    .map((file) => path.basename(file))
    .sort((a, b) => {
      const rank = (name) => (/^(index|main|app|mod|lib)\./i.test(name) ? 0 : 1);
      return rank(a) - rank(b) || a.localeCompare(b);
    })
    .slice(0, 12);
}

async function directChildDirsForAnchor(dirPath) {
  const dirs = await listDirs(dirPath);
  return dirs
    .map((dir) => path.basename(dir))
    .filter((name) => !README_ANCHOR_SKIP_DIRS.has(name))
    .sort((a, b) => a.localeCompare(b))
    .slice(0, 16);
}

async function readmeAnchorSection(repoPath, anchorRel, kind) {
  const dirPath = path.join(repoPath, anchorRel);
  const sourceFiles = await directSourceFilesForAnchor(dirPath);
  const childDirs = await directChildDirsForAnchor(dirPath);
  const fileRows = sourceFiles.length
    ? sourceFiles.map((file) => `| \`${file}\` | Fill purpose | Fill public surface or side effects |`).join('\n')
    : '|  | Fill key file or entry point | Fill public surface or side effects |';
  const childRows = childDirs.length
    ? childDirs.map((dir) => `| \`${dir}/\` | Fill responsibility |`).join('\n')
    : '|  | Fill child responsibility |';

  return `${README_ANCHOR_START}
## devrules Context Anchor

- Path: \`${normalizeRel(anchorRel)}\`
- Anchor type: ${kind}
- Last reviewed: ${today()}

### Responsibility

Fill the stable responsibility of this directory. Keep this section short and operational.

### Key Files

| Path | Purpose | Public surface / side effects |
| --- | --- | --- |
${fileRows}

### Child Areas

| Path | Responsibility |
| --- | --- |
${childRows}

### Workflows And Checks

- Relevant workflows: fill from \`devrules/workflows/\` when this area has special handling.
- Required checks: fill test, lint, build, or manual verification commands for this area.

### Update Rules

Update this anchor when responsibilities, public interfaces, key files, dependency direction, or workflows change.
${README_ANCHOR_END}`;
}

async function ensureReadmeAnchor(repoPath, anchorRel, kind, apply, actions) {
  const readmePath = path.join(repoPath, anchorRel, 'README.md');
  const section = await readmeAnchorSection(repoPath, anchorRel, kind);

  if (!(await pathExists(readmePath))) {
    const content = `# ${path.basename(anchorRel)}\n\n${section}\n`;
    await writeText(readmePath, content, apply, actions, `create ${kind} README anchor`);
    return;
  }

  const current = await readText(readmePath);
  const next = upsertManagedSection(current, README_ANCHOR_START, README_ANCHOR_END, section);
  if (current === next) {
    actions.push({ action: 'skip', path: readmePath, reason: 'README anchor already current' });
    return;
  }

  await writeText(readmePath, next, apply, actions, `upsert ${kind} README anchor`);
}

export async function ensureReadmeAnchors(repoPath, sourceRoots, semanticModules, apply, actions) {
  for (const root of sourceRoots) {
    await ensureReadmeAnchor(repoPath, root, 'source-root', apply, actions);
  }

  for (const moduleRoot of semanticModules) {
    await ensureReadmeAnchor(repoPath, moduleRoot, 'semantic-module', apply, actions);
  }
}

function removeManagedSection(content, startMarker, endMarker) {
  const start = content.indexOf(startMarker);
  const end = content.indexOf(endMarker);
  if (start === -1 || end === -1 || end <= start) return content;
  return `${content.slice(0, start)}${content.slice(end + endMarker.length)}`;
}

function isGeneratedOnlyReadme(content) {
  if (!content.includes(README_ANCHOR_START) || !content.includes(README_ANCHOR_END)) return false;
  const withoutAnchor = removeManagedSection(content, README_ANCHOR_START, README_ANCHOR_END).trim();
  return withoutAnchor === '' || /^#\s+[^\r\n]+$/.test(withoutAnchor);
}

async function collectReadmes(dirPath, repoPath, results = []) {
  let entries;
  try {
    entries = await fs.readdir(dirPath, { withFileTypes: true });
  } catch {
    return results;
  }

  for (const entry of entries) {
    const full = path.join(dirPath, entry.name);
    const rel = normalizeRel(path.relative(repoPath, full));
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name) || entry.name === 'devrules') continue;
      await collectReadmes(full, repoPath, results);
    } else if (entry.isFile() && entry.name.toLowerCase() === 'readme.md') {
      results.push({ full, rel });
    }
  }

  return results;
}

export async function pruneGeneratedReadmeAnchors(repoPath, keepAnchors, apply, actions) {
  const keep = new Set(keepAnchors.map((anchor) => normalizeRel(path.join(anchor, 'README.md'))));
  const readmes = await collectReadmes(repoPath, repoPath);

  for (const readme of readmes) {
    if (keep.has(readme.rel)) continue;
    const content = await readText(readme.full);
    if (!isGeneratedOnlyReadme(content)) {
      if (content.includes(README_ANCHOR_START)) {
        actions.push({ action: 'skip', path: readme.full, reason: 'stale README anchor has human content; preserve file' });
      }
      continue;
    }

    if (!apply) {
      actions.push({ action: 'delete', path: readme.full, reason: 'prune stale generated README anchor', mode: 'dry-run', expectedAfter: expectedAbsentAfter() });
    } else {
      await fs.rm(readme.full);
      actions.push({ action: 'delete', path: readme.full, reason: 'prune stale generated README anchor', mode: 'applied', expectedAfter: expectedAbsentAfter() });
    }
  }
}

export async function hasReadmeAnchor(repoPath, anchorRel) {
  const readmePath = path.join(repoPath, anchorRel, 'README.md');
  const content = await readText(readmePath);
  return content.includes(README_ANCHOR_START) && content.includes(README_ANCHOR_END);
}

export async function readmeAnchorHasPlaceholders(repoPath, anchorRel) {
  const content = await readText(path.join(repoPath, anchorRel, 'README.md'));
  if (!content.includes(README_ANCHOR_START)) return false;
  return /Fill (the stable responsibility|purpose|public surface|child responsibility)/.test(content);
}
