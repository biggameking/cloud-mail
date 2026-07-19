import fs from 'node:fs/promises';
import path from 'node:path';
import { normalizeRel as normalizeSeparators } from './fs-actions.mjs';

export function normalizeRel(value) {
  return normalizeSeparators(String(value || '')).replace(/^\.\//, '');
}

export function isSafeRelativePath(value) {
  const normalized = normalizeRel(value);
  return Boolean(normalized)
    && !path.isAbsolute(normalized)
    && normalized !== '..'
    && !normalized.startsWith('../')
    && !normalized.includes('/../');
}

export function isCanonicalRelativePath(value) {
  const raw = String(value || '');
  const normalized = normalizeRel(raw);
  return raw === normalized
    && isSafeRelativePath(normalized)
    && path.posix.normalize(normalized) === normalized;
}

export async function lstatOrNull(filePath) {
  return fs.lstat(filePath).catch((error) => {
    if (error?.code === 'ENOENT') return null;
    throw error;
  });
}

export async function assertManagedDestinationParents(repoPath, relPaths) {
  const devrulesRoot = path.join(repoPath, 'devrules');
  const directories = new Set([devrulesRoot]);
  for (const relPath of relPaths) {
    if (!isCanonicalRelativePath(relPath)) throw new Error(`unsafe or non-canonical managed template path: ${relPath}`);
    const segments = normalizeRel(relPath).split('/').slice(0, -1);
    let current = devrulesRoot;
    for (const segment of segments) {
      current = path.join(current, segment);
      directories.add(current);
    }
  }
  for (const directory of [...directories].sort((a, b) => a.length - b.length)) {
    const stat = await lstatOrNull(directory);
    if (stat?.isSymbolicLink()) throw new Error(`managed template destination has a symlinked parent: ${directory}`);
    if (stat && !stat.isDirectory()) throw new Error(`managed template destination parent is not a directory: ${directory}`);
  }
}

export async function assertSafeDirectoryChain(rootPath, relDirectory, label) {
  const normalized = normalizeRel(relDirectory || '.');
  if (normalized === '.') return;
  if (!isSafeRelativePath(normalized)) throw new Error(`unsafe ${label} path: ${relDirectory}`);
  let current = rootPath;
  for (const segment of normalized.split('/')) {
    current = path.join(current, segment);
    const stat = await lstatOrNull(current);
    if (stat?.isSymbolicLink()) throw new Error(`${label} has a symlinked directory: ${current}`);
    if (stat && !stat.isDirectory()) throw new Error(`${label} path is not a directory: ${current}`);
  }
}

export function recoveryManagedRelPath(value) {
  const normalized = normalizeRel(value);
  if (
    !isCanonicalRelativePath(value)
    || !normalized.startsWith('devrules/')
    || normalized === 'devrules/'
  ) {
    throw new Error(`unsafe recovery journal path: ${value}`);
  }
  return normalized;
}
