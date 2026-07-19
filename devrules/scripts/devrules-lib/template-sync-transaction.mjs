import fs from 'node:fs/promises';
import path from 'node:path';

import { resolveGitDirectory, runGit } from './git-repository.mjs';
import { atomicWriteFile } from './safe-files.mjs';
import { fileFingerprint, fingerprintMatches, hash } from './template-file-fingerprint.mjs';
import {
  assertManagedDestinationParents,
  assertSafeDirectoryChain,
  normalizeRel,
  recoveryManagedRelPath,
} from './template-path-safety.mjs';
import { restoreTemplateSyncEntries } from './template-sync-storage.mjs';

const SYNC_STATE_FILE = '.template-sync.json';

function publicSource(source) {
  return {
    schemaVersion: 1,
    templateId: source.templateId,
    version: source.version,
    toolVersion: source.toolVersion,
    versionMatchesTool: source.versionMatchesTool,
    changelogVersion: source.changelogVersion,
    versionMatchesChangelog: source.versionMatchesChangelog,
    revision: source.revision,
    manifestHash: source.manifestHash,
    commit: source.commit,
    remote: source.remote,
    configuredRemote: source.configuredRemote,
    effectivePushRemote: source.effectivePushRemote,
    remoteTopologyValid: source.remoteTopologyValid,
    objectOverlayClean: source.objectOverlayClean,
    declaredRemote: source.declaredRemote,
    upstream: source.upstream,
    upstreamIsOrigin: source.upstreamIsOrigin,
    upstreamCommit: source.upstreamCommit,
    detached: source.detached,
    fixedReleaseAuthority: source.fixedReleaseAuthority,
    tagName: source.tagName,
    tagObject: source.tagObject,
    tagCommit: source.tagCommit,
    managedIntegrityValid: source.managedIntegrityValid,
    managedCommit: source.managedCommit,
    managedCommitMatches: source.managedCommitMatches,
  };
}

function publicPlan(plan) {
  return {
    schemaVersion: plan.schemaVersion,
    planId: plan.planId,
    repo: plan.repo,
    templateRoot: plan.templateRoot,
    source: plan.source,
    previousSource: plan.previousSource,
    blocked: plan.blocked,
    globalBlocked: plan.globalBlocked,
    partial: plan.partial,
    policyMode: plan.policyMode,
    blockedModules: plan.blockedModules,
    conflictModules: plan.conflictModules,
    deferredModules: plan.deferredModules,
    modules: plan.modules,
    transitionErrors: plan.transitionErrors,
    conflicts: plan.conflicts,
    actions: plan.actions,
  };
}

async function validateOperation(operation, repoPath) {
  await assertManagedDestinationParents(repoPath, [operation.relPath]);
  const target = await fileFingerprint(operation.path);
  const expected = { exists: Boolean(operation.beforeHash), regular: true, hash: operation.beforeHash };
  if (!fingerprintMatches(target, expected)) throw new Error(`target changed after preflight: ${operation.relPath}`);
  if (operation.sourcePath && operation.sourceKind !== 'git-commit') {
    const source = await fileFingerprint(operation.sourcePath);
    if (!source.exists || !source.regular || source.hash !== operation.afterHash) {
      throw new Error(`template source changed after preflight: ${operation.relPath}`);
    }
  }
}

async function backupEntry(transactionDir, repoPath, filePath, expectedBefore) {
  const relPath = normalizeRel(path.relative(repoPath, filePath));
  recoveryManagedRelPath(relPath);
  const target = await fileFingerprint(filePath);
  if (!fingerprintMatches(target, expectedBefore)) throw new Error(`target changed before transaction backup: ${relPath}`);
  const backupPath = path.join(transactionDir, 'backup', relPath);
  if (target.exists) {
    const backupParent = normalizeRel(path.dirname(path.join('backup', relPath)));
    await assertSafeDirectoryChain(transactionDir, backupParent, 'template sync backup');
    await fs.mkdir(path.dirname(backupPath), { recursive: true });
    await assertSafeDirectoryChain(transactionDir, backupParent, 'template sync backup');
    await atomicWriteFile(backupPath, target.content, { mode: target.mode || 0o644 });
  }
  return {
    relPath,
    path: filePath,
    existed: target.exists,
    beforeHash: target.hash,
    mode: target.mode,
    backupPath: target.exists ? backupPath : '',
  };
}

export async function applyTemplateSyncPlan(plan) {
  if (plan.globalBlocked) return { ...publicPlan(plan), apply: true, applied: false, reason: 'preflight blocked all writes' };
  if (!plan.operations.length && !plan.stateChanged) {
    return {
      ...publicPlan(plan),
      apply: true,
      applied: false,
      reason: plan.blockedModules?.length ? 'all changed modules are blocked by conflicts' : 'template sync is already current',
    };
  }
  await assertManagedDestinationParents(plan.repo, [...plan.operations.map((operation) => operation.relPath), SYNC_STATE_FILE]);
  if (plan.source.gitRepository) {
    const currentCommit = await runGit(plan.templateRoot, ['rev-parse', 'HEAD'], { allowFailure: true });
    if (!currentCommit.ok || currentCommit.stdout !== plan.source.commit) throw new Error('template source changed after preflight');
  }
  for (const operation of plan.operations) await validateOperation(operation, plan.repo);

  const gitDir = await resolveGitDirectory(plan.repo);
  const transactionDir = path.join(gitDir, 'devrules-sync', plan.planId);
  const journalPath = path.join(transactionDir, 'journal.json');
  await assertSafeDirectoryChain(gitDir, path.join('devrules-sync', plan.planId), 'template sync transaction storage');
  await fs.mkdir(transactionDir, { recursive: true });
  await assertSafeDirectoryChain(gitDir, path.join('devrules-sync', plan.planId), 'template sync transaction storage');

  const writeTargets = [...plan.operations.map((operation) => operation.path)];
  if (plan.stateChanged) writeTargets.push(plan.statePath);
  const beforeByPath = new Map(plan.operations.map((operation) => [operation.path, {
    exists: Boolean(operation.beforeHash),
    regular: true,
    hash: operation.beforeHash,
  }]));
  if (plan.stateChanged) beforeByPath.set(plan.statePath, plan.stateBefore);
  const afterByPath = new Map(plan.operations.map((operation) => [operation.path, {
    afterExists: operation.action === 'copy',
    afterHash: operation.afterHash,
  }]));
  if (plan.stateChanged) afterByPath.set(plan.statePath, { afterExists: true, afterHash: hash(Buffer.from(plan.stateContent)) });
  const entries = [];
  for (const filePath of [...new Set(writeTargets)]) {
    entries.push({ ...await backupEntry(transactionDir, plan.repo, filePath, beforeByPath.get(filePath)), ...afterByPath.get(filePath) });
  }

  const journal = {
    schemaVersion: 2,
    transactionId: plan.planId,
    status: 'prepared',
    repo: plan.repo,
    source: publicSource(plan.source),
    modules: plan.modules,
    createdAt: new Date().toISOString(),
    entries,
  };
  await atomicWriteFile(journalPath, `${JSON.stringify(journal, null, 2)}\n`);

  let appliedOperations = 0;
  const appliedPaths = new Set();
  try {
    for (const operation of plan.operations) {
      await assertManagedDestinationParents(plan.repo, [operation.relPath]);
      await validateOperation(operation, plan.repo);
      if (operation.action === 'copy') await atomicWriteFile(operation.path, operation.content, { mode: operation.mode || 0o644 });
      else if (operation.action === 'delete') await fs.rm(operation.path, { force: true });
      appliedPaths.add(operation.path);
      appliedOperations += 1;
      if (Number(process.env.DEVRULES_TEST_FAIL_AFTER_OPERATIONS || 0) === appliedOperations) throw new Error('injected template sync failure');
    }
    if (plan.stateChanged) {
      const currentState = await fileFingerprint(plan.statePath);
      if (!fingerprintMatches(currentState, plan.stateBefore)) throw new Error('template sync state changed after transaction backup');
      await atomicWriteFile(plan.statePath, plan.stateContent, { mode: plan.stateBefore.mode || 0o644 });
      appliedPaths.add(plan.statePath);
    }
    journal.status = 'completed';
    journal.completedAt = new Date().toISOString();
    await atomicWriteFile(journalPath, `${JSON.stringify(journal, null, 2)}\n`);
    return {
      ...publicPlan(plan),
      apply: true,
      applied: true,
      transaction: { id: plan.planId, journalPath, status: journal.status },
      actions: plan.actions.map((action) => ['copy', 'delete', 'write'].includes(action.action)
        ? { ...action, mode: 'applied' }
        : action),
    };
  } catch (error) {
    const appliedEntries = entries.filter((entry) => appliedPaths.has(entry.path));
    await restoreTemplateSyncEntries(appliedEntries, plan.repo);
    journal.status = 'rolled-back';
    journal.error = error.message;
    journal.rolledBackAt = new Date().toISOString();
    await atomicWriteFile(journalPath, `${JSON.stringify(journal, null, 2)}\n`);
    throw new Error(`template sync failed and was rolled back (${plan.planId}): ${error.message}`);
  }
}
