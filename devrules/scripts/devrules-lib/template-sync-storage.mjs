import fs from 'node:fs/promises';
import path from 'node:path';

import { isExactGitWorktree, resolveGitDirectory } from './git-repository.mjs';
import { atomicWriteFile, withFileLock } from './safe-files.mjs';
import { recoverAbandonedFileLock } from './template-auto-update-lock.mjs';
import { hash } from './template-file-fingerprint.mjs';
import {
  assertManagedDestinationParents,
  assertSafeDirectoryChain,
  lstatOrNull,
  normalizeRel,
  recoveryManagedRelPath,
} from './template-path-safety.mjs';

async function currentFingerprint(filePath) {
  const stat = await lstatOrNull(filePath);
  if (!stat) return { exists: false, regular: false, hash: '' };
  if (!stat.isFile() || stat.isSymbolicLink()) return { exists: true, regular: false, hash: '' };
  return { exists: true, regular: true, hash: hash(await fs.readFile(filePath)) };
}

function matchesFingerprint(current, exists, expectedHash) {
  return exists
    ? current.exists && current.regular && current.hash === expectedHash
    : !current.exists;
}

async function classifyCurrentEntries(entries, allowedCurrent = 'before-or-after') {
  const classified = [];
  for (const entry of entries) {
    const current = await currentFingerprint(entry.path);
    const matchesBefore = matchesFingerprint(current, entry.existed, entry.beforeHash);
    const matchesAfter = matchesFingerprint(current, entry.afterExists, entry.afterHash);
    if (matchesBefore) {
      classified.push({ ...entry, currentState: 'before' });
      continue;
    }
    if (allowedCurrent === 'before-or-after' && matchesAfter) {
      classified.push({ ...entry, currentState: 'after' });
      continue;
    }
    throw new Error(`recovery target changed outside the recorded transaction: ${entry.relPath}`);
  }
  return classified;
}

export async function restoreTemplateSyncEntries(entries, repoPath, options = {}) {
  const prepared = [];
  const managedPaths = entries.map((entry) => recoveryManagedRelPath(entry.relPath).slice('devrules/'.length));
  await assertManagedDestinationParents(repoPath, managedPaths);
  for (const entry of entries) {
    let content = null;
    if (entry.existed) {
      const backupStat = await lstatOrNull(entry.backupPath);
      if (!backupStat?.isFile() || backupStat.isSymbolicLink()) throw new Error(`template sync backup is not a regular file: ${entry.relPath}`);
      content = await fs.readFile(entry.backupPath);
      if (entry.beforeHash && hash(content) !== entry.beforeHash) throw new Error(`template sync backup hash mismatch: ${entry.relPath}`);
    }
    prepared.push({ entry, content });
  }
  const classified = await classifyCurrentEntries(entries, options.allowedCurrent || 'before-or-after');
  const currentStateByPath = new Map(classified.map((entry) => [entry.relPath, entry.currentState]));
  for (const { entry, content } of prepared.reverse()) {
    if (currentStateByPath.get(entry.relPath) === 'before') continue;
    const managedRelPath = recoveryManagedRelPath(entry.relPath).slice('devrules/'.length);
    await assertManagedDestinationParents(repoPath, [managedRelPath]);
    if (entry.existed) await atomicWriteFile(entry.path, content, { mode: entry.mode || 0o644 });
    else await fs.rm(entry.path, { force: true });
  }
}

async function validateRecoveryJournal(repo, transactionDir, transactionId, journal) {
  if (journal?.schemaVersion !== 2) throw new Error('unsupported recovery journal schema; legacy journals lack safe after-state fingerprints');
  if (journal.transactionId !== transactionId) throw new Error('recovery journal transaction id does not match its directory');
  if (path.resolve(String(journal.repo || '')) !== repo) throw new Error('recovery journal repository does not match the selected target');
  if (!['prepared', 'completed', 'rolled-back', 'recovered'].includes(journal.status)) throw new Error(`unsupported recovery journal status: ${journal.status || '<missing>'}`);
  if (!Array.isArray(journal.entries)) throw new Error('recovery journal entries must be an array');

  const normalizedEntries = [];
  const destinations = new Set();
  for (const entry of journal.entries) {
    if (!entry || typeof entry !== 'object' || typeof entry.existed !== 'boolean') throw new Error('invalid recovery journal entry');
    const relPath = recoveryManagedRelPath(entry.relPath);
    if (destinations.has(relPath)) throw new Error(`duplicate recovery journal path: ${relPath}`);
    destinations.add(relPath);
    const destination = path.join(repo, relPath);
    if (path.resolve(String(entry.path || '')) !== destination) throw new Error(`recovery journal destination mismatch: ${relPath}`);
    await assertManagedDestinationParents(repo, [relPath.slice('devrules/'.length)]);

    const mode = Number(entry.mode || 0);
    if (!Number.isInteger(mode) || mode < 0 || mode > 0o777) throw new Error(`invalid recovery journal mode: ${relPath}`);
    const beforeHash = String(entry.beforeHash || '');
    if (entry.existed && !/^[a-f0-9]{64}$/i.test(beforeHash)) throw new Error(`invalid recovery journal hash: ${relPath}`);
    if (!entry.existed && beforeHash) throw new Error(`unexpected recovery journal hash: ${relPath}`);
    if (typeof entry.afterExists !== 'boolean') throw new Error(`invalid recovery journal after-state: ${relPath}`);
    const afterHash = String(entry.afterHash || '');
    if (entry.afterExists && !/^[a-f0-9]{64}$/i.test(afterHash)) throw new Error(`invalid recovery journal after-state hash: ${relPath}`);
    if (!entry.afterExists && afterHash) throw new Error(`unexpected recovery journal after-state hash: ${relPath}`);
    let backupPath = '';
    if (entry.existed) {
      backupPath = path.join(transactionDir, 'backup', relPath);
      if (path.resolve(String(entry.backupPath || '')) !== backupPath) throw new Error(`recovery journal backup mismatch: ${relPath}`);
      const backupParent = normalizeRel(path.dirname(path.join('backup', relPath)));
      await assertSafeDirectoryChain(transactionDir, backupParent, 'template sync recovery backup');
      const backupStat = await lstatOrNull(backupPath);
      if (!backupStat?.isFile() || backupStat.isSymbolicLink()) throw new Error(`recovery journal backup is not a regular file: ${relPath}`);
      if (hash(await fs.readFile(backupPath)) !== beforeHash) throw new Error(`recovery journal backup hash mismatch: ${relPath}`);
    } else if (entry.backupPath) {
      throw new Error(`recovery journal has an unexpected backup: ${relPath}`);
    }
    normalizedEntries.push({ ...entry, relPath, path: destination, backupPath, mode, beforeHash, afterHash });
  }
  return normalizedEntries;
}

export async function withTemplateSyncLock(repoPath, callback) {
  const gitDir = await resolveGitDirectory(repoPath);
  await assertSafeDirectoryChain(gitDir, 'devrules-sync', 'template sync lock storage');
  await fs.mkdir(path.join(gitDir, 'devrules-sync'), { recursive: true });
  await assertSafeDirectoryChain(gitDir, 'devrules-sync', 'template sync lock storage');
  const lockPath = path.join(gitDir, 'devrules-sync', '.sync.lock');
  await recoverAbandonedFileLock(lockPath);
  return withFileLock(lockPath, callback);
}

export async function recoverTemplateSyncTransaction(repoPath, transactionId, apply = false) {
  if (!transactionId || !/^[a-f0-9]{8,64}$/i.test(transactionId)) throw new Error('recover requires a valid transaction id');
  const repo = path.resolve(repoPath);
  if (!(await isExactGitWorktree(repo))) throw new Error(`template sync target must be the exact root of a Git working tree: ${repo}`);
  const recover = async () => {
    const gitDir = await resolveGitDirectory(repo);
    const transactionDir = path.join(gitDir, 'devrules-sync', transactionId);
    await assertSafeDirectoryChain(gitDir, path.join('devrules-sync', transactionId), 'template sync recovery storage');
    const journalPath = path.join(transactionDir, 'journal.json');
    const journalStat = await lstatOrNull(journalPath);
    if (!journalStat?.isFile() || journalStat.isSymbolicLink()) throw new Error('recovery journal is not a regular file');
    const journal = JSON.parse(await fs.readFile(journalPath, 'utf8'));
    const entries = await validateRecoveryJournal(repo, transactionDir, transactionId, journal);
    const allowedCurrent = ['rolled-back', 'recovered'].includes(journal.status) ? 'before-only' : 'before-or-after';
    const classifiedEntries = await classifyCurrentEntries(entries, allowedCurrent);
    const result = {
      schemaVersion: 2,
      repo,
      transactionId,
      previousStatus: journal.status,
      entryCount: entries.length,
      restoreCount: classifiedEntries.filter((entry) => entry.currentState === 'after').length,
      apply,
    };
    if (!apply) return result;
    if (journal.status === 'recovered') return { ...result, status: 'already-recovered' };
    await restoreTemplateSyncEntries(entries, repo, { allowedCurrent });
    journal.status = 'recovered';
    journal.recoveredAt = new Date().toISOString();
    await atomicWriteFile(journalPath, `${JSON.stringify(journal, null, 2)}\n`);
    return { ...result, status: 'recovered' };
  };
  return apply ? withTemplateSyncLock(repo, recover) : recover();
}
