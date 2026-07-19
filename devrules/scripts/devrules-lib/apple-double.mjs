import fs from 'node:fs/promises';
import path from 'node:path';

const APPLE_DOUBLE_MAGIC = Buffer.from([0x00, 0x05, 0x16, 0x07]);

function portable(value) {
  return String(value || '').replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/$/, '');
}

function darwin(options) {
  return (options.platform || process.platform) === 'darwin';
}

async function isAppleDoubleFile(filePath) {
  const stat = await fs.lstat(filePath).catch((error) => error?.code === 'ENOENT' ? null : Promise.reject(error));
  if (!stat?.isFile() || stat.isSymbolicLink() || stat.size < APPLE_DOUBLE_MAGIC.length) return false;
  const handle = await fs.open(filePath, 'r');
  try {
    const header = Buffer.alloc(APPLE_DOUBLE_MAGIC.length);
    const { bytesRead } = await handle.read(header, 0, header.length, 0);
    return bytesRead === header.length && header.equals(APPLE_DOUBLE_MAGIC);
  } finally {
    await handle.close();
  }
}

async function removeCandidate(filePath, removed) {
  if (!(await isAppleDoubleFile(filePath))) return;
  await fs.rm(filePath);
  removed.push(filePath);
}

async function removeDirect(directory, removed) {
  const entries = await fs.readdir(directory, { withFileTypes: true }).catch((error) => error?.code === 'ENOENT' ? [] : Promise.reject(error));
  for (const entry of entries) {
    if (entry.isFile() && entry.name.startsWith('._')) await removeCandidate(path.join(directory, entry.name), removed);
  }
}

async function removeRecursive(directory, removed) {
  const entries = await fs.readdir(directory, { withFileTypes: true }).catch((error) => error?.code === 'ENOENT' ? [] : Promise.reject(error));
  for (const entry of entries) {
    const candidate = path.join(directory, entry.name);
    if (entry.isDirectory()) await removeRecursive(candidate, removed);
    else if (entry.isFile() && entry.name.startsWith('._')) await removeCandidate(candidate, removed);
  }
}

export async function cleanupGitAppleDoubleArtifacts(gitDirectory, options = {}) {
  if (!darwin(options)) return { removed: [], removedCount: 0 };
  const verifiedGitDirectory = path.resolve(gitDirectory);
  const head = await fs.lstat(path.join(verifiedGitDirectory, 'HEAD')).catch((error) => error?.code === 'ENOENT' ? null : Promise.reject(error));
  if (!head?.isFile() || head.isSymbolicLink()) throw new Error('verified Git directory has no regular HEAD file');
  const removed = [];
  await removeDirect(verifiedGitDirectory, removed);
  await removeDirect(path.join(verifiedGitDirectory, 'objects', 'pack'), removed);
  await removeDirect(path.join(verifiedGitDirectory, 'objects', 'info'), removed);
  await removeRecursive(path.join(verifiedGitDirectory, 'refs'), removed);
  await removeDirect(path.join(verifiedGitDirectory, 'logs'), removed);
  await removeRecursive(path.join(verifiedGitDirectory, 'logs', 'refs'), removed);
  await removeRecursive(path.join(verifiedGitDirectory, 'devrules-sync'), removed);
  return { removed, removedCount: removed.length };
}

export function appleDoubleCandidatesForActions(actionPaths) {
  const candidates = new Set();
  for (const actionPath of actionPaths || []) {
    let current = portable(actionPath);
    while (current && current !== '.') {
      const directory = path.posix.dirname(current);
      const base = path.posix.basename(current);
      candidates.add(directory === '.' ? `._${base}` : `${directory}/._${base}`);
      current = directory === '.' ? '' : directory;
    }
  }
  return [...candidates].sort((left, right) => left.localeCompare(right));
}

export async function removeUntrackedActionAppleDoubleArtifacts(repoPath, candidates, trackedPaths, options = {}) {
  if (!darwin(options)) return { removed: [], removedCount: 0 };
  const tracked = new Set((trackedPaths || []).map(portable));
  const removed = [];
  for (const relativePath of candidates || []) {
    const portablePath = portable(relativePath);
    if (!portablePath || tracked.has(portablePath)) continue;
    const absolute = path.resolve(repoPath, portablePath);
    const relative = path.relative(path.resolve(repoPath), absolute);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) continue;
    await removeCandidate(absolute, removed);
  }
  return { removed, removedCount: removed.length };
}
