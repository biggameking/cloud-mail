import fs from 'node:fs/promises';
import path from 'node:path';

import { isExactGitWorktree, readGitBlobs, runGit } from './git-repository.mjs';
import { fetchTemplateSource, readTemplateSource } from './template-authority.mjs';
import { fileFingerprint, fingerprintMatches, hash } from './template-file-fingerprint.mjs';
import {
  assertManagedDestinationParents,
  isCanonicalRelativePath,
  isSafeRelativePath,
  lstatOrNull,
  normalizeRel,
} from './template-path-safety.mjs';
import { withTemplateSyncLock } from './template-sync-storage.mjs';
import {
  classifyManagedTemplateFiles,
  defaultTemplateModule,
  LEGACY_TEMPLATE_MODULE,
  readInstalledTemplateModules,
  TEMPLATE_MODULE_ATOMIC_GROUPS,
  TEMPLATE_MODULE_DEPENDENCIES,
} from './template-sync-policy.mjs';
import {
  loadTemplateSyncState,
  normalizeTemplateSyncState,
  validateTemplateSyncStateProvenance,
} from './template-sync-state.mjs';
import { applyTemplateSyncPlan } from './template-sync-transaction.mjs';

export { readTemplateSource } from './template-authority.mjs';
export { recoverTemplateSyncTransaction } from './template-sync-storage.mjs';
export { loadTemplateSyncState, normalizeTemplateSyncState } from './template-sync-state.mjs';

const SYNC_STATE_FILE = '.template-sync.json';

async function readBuffer(filePath) {
  return fs.readFile(filePath).catch((error) => {
    if (error?.code === 'ENOENT') return null;
    throw error;
  });
}

function isFilesystemMetadata(name) {
  const normalized = String(name || '');
  return normalized.startsWith('._')
    || normalized === '.DS_Store'
    || normalized.toLowerCase() === 'thumbs.db';
}

function isManagedPath(relPath, directoryNames, rootFiles) {
  const normalized = normalizeRel(relPath);
  return rootFiles.has(normalized)
    || directoryNames.includes(normalized)
    || directoryNames.some((directoryName) => normalized.startsWith(`${directoryName}/`));
}

export async function assertAdoptedTemplateSyncTarget(repoPath) {
  const repo = path.resolve(repoPath);
  if (!(await isExactGitWorktree(repo))) {
    throw new Error(`template sync target must be the exact root of a Git working tree: ${repo}`);
  }
  await assertManagedDestinationParents(repo, ['.template-sync.json']);
  const required = ['devrules/always-readme.md', 'devrules/manifest.json'];
  const presence = await Promise.all(required.map(async (relPath) => (await lstatOrNull(path.join(repo, relPath)))?.isFile() === true));
  const missing = required.filter((_, index) => !presence[index]);
  if (missing.length) {
    throw new Error(`template sync target is not an adopted devrules repository; missing ${missing.join(', ')}`);
  }
  return repo;
}

function nullSeparatedPaths(output, directoryNames, rootFiles) {
  return [...new Set(String(output || '').split('\0')
    .map(normalizeRel)
    .filter((relPath) => isSafeRelativePath(relPath) && isManagedPath(relPath, directoryNames, rootFiles)))];
}

async function collectGitManagedFiles(templateRoot, directoryNames, rootFiles) {
  if (!(await isExactGitWorktree(templateRoot))) return null;
  const pathspecs = [...new Set([...directoryNames, ...rootFiles])];
  if (!pathspecs.length) return [];
  const commit = await runGit(templateRoot, ['rev-parse', 'HEAD'], { allowFailure: true });
  if (!commit.ok || !commit.stdout) return null;
  const sourceCommit = commit.stdout;
  const [tree, roots, cached, untracked, flags] = await Promise.all([
    runGit(templateRoot, ['ls-tree', '-r', '-z', sourceCommit, '--', ...pathspecs], { allowFailure: true, trimOutput: false }),
    runGit(templateRoot, ['ls-tree', '-z', sourceCommit, '--', ...pathspecs], { allowFailure: true, trimOutput: false }),
    runGit(templateRoot, ['ls-files', '--cached', '-z', '--', ...pathspecs], { trimOutput: false }),
    runGit(templateRoot, ['ls-files', '--others', '--exclude-standard', '-z', '--', ...pathspecs], { trimOutput: false }),
    runGit(templateRoot, ['ls-files', '-v', '-z', '--', ...pathspecs], { trimOutput: false }),
  ]);
  if (!tree.ok || !roots.ok) return null;

  const treeRecords = String(tree.stdout).split('\0').filter(Boolean);
  const rootRecords = String(roots.stdout).split('\0').filter(Boolean);
  const treeRecordPath = (record) => record.slice(record.indexOf('\t') + 1);
  const invalidGitPaths = new Set([
    ...treeRecords.map(treeRecordPath),
    ...rootRecords.map(treeRecordPath),
    ...String(cached.stdout).split('\0').filter(Boolean),
    ...String(untracked.stdout).split('\0').filter(Boolean),
    ...String(flags.stdout).split('\0').filter(Boolean).map((record) => record.slice(2)),
  ].filter((relPath) => !isCanonicalRelativePath(relPath)));

  const treeEntries = new Map(treeRecords.map((record) => {
    const match = /^([0-7]{6}) ([^ ]+) ([0-9a-f]+)\t([\s\S]+)$/.exec(record);
    if (!match) throw new Error(`unexpected git ls-tree record: ${record}`);
    const [, mode, type, objectId, relPath] = match;
    return [normalizeRel(relPath), { mode, type, objectId }];
  }).filter(([relPath]) => isSafeRelativePath(relPath) && isManagedPath(relPath, directoryNames, rootFiles)));
  const rootEntries = new Map(rootRecords.map((record) => {
    const match = /^([0-7]{6}) ([^ ]+) ([0-9a-f]+)\t([\s\S]+)$/.exec(record);
    if (!match) throw new Error(`unexpected git ls-tree record: ${record}`);
    return [normalizeRel(match[4]), { mode: match[1], type: match[2], objectId: match[3] }];
  }));
  const managedRootIssues = new Map();
  for (const directoryName of directoryNames) {
    const entry = rootEntries.get(directoryName);
    if (entry && (entry.type !== 'tree' || entry.mode !== '040000')) {
      managedRootIssues.set(directoryName, 'managed template directory root is not a Git tree');
    }
  }
  for (const rootFile of rootFiles) {
    const entry = rootEntries.get(rootFile);
    if (entry && (entry.type !== 'blob' || !/^100[0-7]{3}$/.test(entry.mode))) {
      managedRootIssues.set(rootFile, 'managed template root file is not a regular Git blob');
    }
  }
  const flagByPath = new Map(String(flags.stdout).split('\0').filter(Boolean).map((record) => [normalizeRel(record.slice(2)), record[0]]));
  const trackedPaths = new Set([...treeEntries.keys(), ...nullSeparatedPaths(cached.stdout, directoryNames, rootFiles)]);
  const blobIds = [...new Set([...treeEntries.values()].filter((entry) => entry.type === 'blob').map((entry) => entry.objectId))];
  const blobs = await readGitBlobs(templateRoot, blobIds);
  const files = [];

  for (const relPath of [...trackedPaths].sort()) {
    const treeEntry = treeEntries.get(relPath);
    const flag = flagByPath.get(relPath) || '';
    const managedRootIssue = managedRootIssues.get(relPath) || '';
    const flagIssue = flag === 'S' || /^[a-z]$/.test(flag)
      ? `managed path uses unsafe Git index flag ${flag}`
      : '';
    if (treeEntry?.type === 'blob') {
      const content = blobs.get(treeEntry.objectId);
      if (!content) throw new Error(`missing committed blob ${treeEntry.objectId} for ${relPath}`);
      files.push({
        relPath,
        sourcePath: path.join(templateRoot, relPath),
        sourceKind: 'git-commit',
        sourceCommit,
        sourceHash: hash(content),
        content,
        mode: parseInt(treeEntry.mode, 8) & 0o777,
        integrityIssue: managedRootIssue || (treeEntry.mode === '120000' ? 'managed template source is a symbolic link' : flagIssue),
      });
      continue;
    }
    const file = await readManagedFile(templateRoot, relPath);
    if (file) files.push({ ...file, sourceKind: 'git-index', sourceCommit, integrityIssue: managedRootIssue || flagIssue || 'managed index path is absent from HEAD' });
    else files.push({ relPath, sourcePath: path.join(templateRoot, relPath), sourceKind: treeEntry ? 'git-commit' : 'git-index', sourceCommit, sourceHash: '', content: Buffer.alloc(0), mode: 0o644, integrityIssue: managedRootIssue || flagIssue || 'managed index path is absent from HEAD and the worktree' });
  }
  for (const relPath of nullSeparatedPaths(untracked.stdout, directoryNames, rootFiles)) {
    const file = await readManagedFile(templateRoot, relPath);
    if (file) files.push({ ...file, sourceKind: 'git-untracked', sourceCommit, integrityIssue: 'managed template source is not committed in HEAD' });
  }
  for (const [relPath, integrityIssue] of managedRootIssues) {
    if (files.some((file) => file.relPath === relPath)) continue;
    files.push({
      relPath,
      sourcePath: path.join(templateRoot, relPath),
      sourceKind: 'git-commit',
      sourceCommit,
      sourceHash: '',
      content: Buffer.alloc(0),
      mode: 0o644,
      integrityIssue,
    });
  }
  for (const relPath of invalidGitPaths) {
    const sentinelRoot = directoryNames[0] || 'scripts';
    const sentinelPath = `${sentinelRoot}/.invalid-managed-git-path-${hash(Buffer.from(relPath)).slice(0, 12)}`;
    if (files.some((file) => file.relPath === sentinelPath)) continue;
    files.push({
      relPath: sentinelPath,
      sourcePath: path.join(templateRoot, sentinelPath),
      sourceKind: 'git-commit',
      sourceCommit,
      sourceHash: '',
      content: Buffer.alloc(0),
      mode: 0o644,
      integrityIssue: `managed Git path is non-canonical: ${JSON.stringify(relPath)}`,
    });
  }
  return files.sort((a, b) => a.relPath.localeCompare(b.relPath));
}

async function readManagedFile(templateRoot, relPath) {
  const sourcePath = path.join(templateRoot, relPath);
  const stat = await fs.lstat(sourcePath).catch((error) => {
    if (error?.code === 'ENOENT') return null;
    throw error;
  });
  if (!stat?.isFile()) return null;
  const content = await fs.readFile(sourcePath);
  return { relPath, sourcePath, sourceHash: hash(content), content, mode: stat.mode & 0o777 };
}

async function collectTree(directory, relPrefix, output) {
  const entries = await fs.readdir(directory, { withFileTypes: true }).catch(() => []);
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (isFilesystemMetadata(entry.name)) continue;
    const sourcePath = path.join(directory, entry.name);
    const relPath = normalizeRel(path.join(relPrefix, entry.name));
    if (entry.isDirectory()) {
      await collectTree(sourcePath, relPath, output);
    } else if (entry.isFile()) {
      const content = await fs.readFile(sourcePath);
      const mode = await fs.stat(sourcePath).then((stat) => stat.mode & 0o777).catch(() => 0o644);
      output.push({ relPath, sourcePath, sourceKind: 'filesystem', sourceHash: hash(content), content, mode });
    }
  }
}

export async function collectManagedTemplateFiles(templateRoot, directoryNames, rootFiles) {
  const normalizedDirectories = [...new Set(directoryNames.map(normalizeRel).filter(isSafeRelativePath))];
  const normalizedRootFiles = new Set(rootFiles.map(normalizeRel).filter(isSafeRelativePath));
  const gitFiles = await collectGitManagedFiles(templateRoot, normalizedDirectories, normalizedRootFiles);
  if (gitFiles) return gitFiles;

  const output = [];
  for (const directoryName of normalizedDirectories) {
    await collectTree(path.join(templateRoot, directoryName), directoryName, output);
  }
  for (const fileName of normalizedRootFiles) {
    if (isFilesystemMetadata(path.basename(fileName))) continue;
    const sourcePath = path.join(templateRoot, fileName);
    const content = await readBuffer(sourcePath);
    if (content === null) continue;
    const mode = await fs.stat(sourcePath).then((stat) => stat.mode & 0o777).catch(() => 0o644);
    output.push({ relPath: normalizeRel(fileName), sourcePath, sourceKind: 'filesystem', sourceHash: hash(content), content, mode });
  }
  return output.sort((a, b) => a.relPath.localeCompare(b.relPath));
}

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

function recordFile(state, file, source, syncedHash, ownership = '') {
  const previous = state.files[file.relPath];
  const resolvedOwnership = ownership || (file.sourceOwnership === 'shared' ? previous?.ownership || 'template' : 'project');
  const unchanged = previous
    && previous.sourceHash === file.sourceHash
    && previous.syncedHash === syncedHash
    && previous.targetPresence === 'present'
    && previous.ownership === resolvedOwnership
    && previous.sourceOwnership === file.sourceOwnership
    && previous.moduleId === file.moduleId
    && previous.sourceCommit === source.commit
    && Number(previous.sourceRevision) === Number(source.revision);
  state.files[file.relPath] = {
    sourceHash: file.sourceHash,
    syncedHash,
    targetPresence: 'present',
    ownership: resolvedOwnership,
    sourceOwnership: file.sourceOwnership,
    moduleId: file.moduleId,
    sourceCommit: source.commit,
    sourceRevision: source.revision,
    syncedAt: unchanged && previous.syncedAt ? previous.syncedAt : new Date().toISOString(),
  };
  delete state.removedFiles[file.relPath];
}

function recordAbsentFile(state, file, source) {
  const previous = state.files[file.relPath];
  const unchanged = previous
    && previous.sourceHash === file.sourceHash
    && previous.syncedHash === ''
    && previous.targetPresence === 'absent'
    && previous.ownership === 'project'
    && previous.sourceOwnership === file.sourceOwnership
    && previous.moduleId === file.moduleId
    && previous.sourceCommit === source.commit
    && Number(previous.sourceRevision) === Number(source.revision);
  state.files[file.relPath] = {
    sourceHash: file.sourceHash,
    syncedHash: '',
    targetPresence: 'absent',
    ownership: 'project',
    sourceOwnership: file.sourceOwnership,
    moduleId: file.moduleId,
    sourceCommit: source.commit,
    sourceRevision: source.revision,
    syncedAt: unchanged && previous.syncedAt ? previous.syncedAt : new Date().toISOString(),
  };
  delete state.removedFiles[file.relPath];
}

function retireFile(state, relPath, previous, targetPresence, syncedHash, ownership) {
  delete state.files[relPath];
  state.removedFiles[relPath] = {
    sourceHash: previous.sourceHash,
    syncedHash,
    targetPresence,
    ownership,
    sourceOwnership: previous.sourceOwnership,
    moduleId: previous.moduleId,
    sourceCommit: previous.sourceCommit,
    removedAt: new Date().toISOString(),
    sourceRevision: previous.sourceRevision,
  };
}

function cloneState(state) {
  return {
    schemaVersion: 4,
    inputSchemaVersion: state.inputSchemaVersion,
    updatedAt: state.updatedAt,
    source: state.source ? { ...state.source } : null,
    modules: Object.fromEntries(Object.entries(state.modules || {}).map(([moduleId, entry]) => [moduleId, {
      source: { ...entry.source },
      updatedAt: entry.updatedAt,
    }])),
    files: Object.fromEntries(Object.entries(state.files).map(([relPath, entry]) => [relPath, { ...entry }])),
    removedFiles: Object.fromEntries(Object.entries(state.removedFiles).map(([relPath, entry]) => [relPath, { ...entry }])),
    validationErrors: [],
  };
}

function migrateTrustedLegacyState(state, managedByPath, source) {
  const migrated = cloneState(state);
  const previousSource = state.source || publicSource(source);
  for (const section of ['files', 'removedFiles']) {
    for (const [relPath, entry] of Object.entries(migrated[section])) {
      const file = managedByPath.get(relPath);
      const sourceOwnership = file?.sourceOwnership || entry.sourceOwnership || 'shared';
      const moduleId = file?.moduleId || (file?.policyMode === 'legacy' ? LEGACY_TEMPLATE_MODULE : defaultTemplateModule(relPath));
      if (sourceOwnership === 'local') {
        delete migrated[section][relPath];
        continue;
      }
      migrated[section][relPath] = {
        ...entry,
        ownership: sourceOwnership === 'shared' ? entry.ownership : 'project',
        sourceOwnership,
        moduleId,
        sourceCommit: entry.sourceCommit || previousSource.commit,
        sourceRevision: Number.isInteger(Number(entry.sourceRevision)) ? Number(entry.sourceRevision) : Number(previousSource.revision || 0),
      };
    }
  }
  migrated.modules = {};
  for (const entry of [...Object.values(migrated.files), ...Object.values(migrated.removedFiles)]) {
    migrated.modules[entry.moduleId] ||= { source: { ...previousSource }, updatedAt: state.updatedAt || '' };
  }
  migrated.inputSchemaVersion = 4;
  return migrated;
}

function replaceModuleState(target, planned, moduleId) {
  for (const section of ['files', 'removedFiles']) {
    for (const [relPath, entry] of Object.entries(target[section])) {
      if (entry.moduleId === moduleId) delete target[section][relPath];
    }
    for (const [relPath, entry] of Object.entries(planned[section])) {
      if (entry.moduleId === moduleId) target[section][relPath] = { ...entry };
    }
  }
  if (planned.modules[moduleId]) target.modules[moduleId] = {
    source: { ...planned.modules[moduleId].source },
    updatedAt: planned.modules[moduleId].updatedAt,
  };
  else delete target.modules[moduleId];
}

function moduleDeferralClosure(plans) {
  const conflicts = new Set([...plans]
    .filter(([, plan]) => plan.conflicts.length > 0)
    .map(([moduleId]) => moduleId));
  const deferred = new Map();
  let changed = true;
  while (changed) {
    changed = false;
    for (const [moduleId] of plans) {
      if (conflicts.has(moduleId) || deferred.has(moduleId)) continue;
      const blockedDependencies = (TEMPLATE_MODULE_DEPENDENCIES[moduleId] || [])
        .filter((dependency) => plans.has(dependency) && (conflicts.has(dependency) || deferred.has(dependency)));
      if (blockedDependencies.length) {
        deferred.set(moduleId, `dependency module blocked: ${blockedDependencies.join(', ')}`);
        changed = true;
      }
    }
    for (const group of TEMPLATE_MODULE_ATOMIC_GROUPS) {
      const plannedMembers = group.filter((moduleId) => plans.has(moduleId));
      const blockedMembers = plannedMembers.filter((moduleId) => conflicts.has(moduleId) || deferred.has(moduleId));
      if (!blockedMembers.length) continue;
      for (const moduleId of plannedMembers) {
        if (conflicts.has(moduleId) || deferred.has(moduleId)) continue;
        deferred.set(moduleId, `atomic module group blocked by: ${blockedMembers.join(', ')}`);
        changed = true;
      }
    }
  }
  return { conflicts, deferred };
}

function deferredModuleActions(modulePlan, reason) {
  const summary = {
    action: 'deferred',
    path: modulePlan.actions[0]?.path || '',
    relPath: '',
    moduleId: modulePlan.moduleId,
    reason,
  };
  const actions = modulePlan.actions.map((action) => action.action === 'conflict'
    ? action
    : { ...action, action: 'deferred', reason: `${reason}; pending action: ${action.reason}` });
  return [summary, ...actions];
}

function sourceTransitionErrors(previousSource, source, options) {
  const errors = [];
  const fixedReleaseAuthority = source.detached === true
    && source.fixedReleaseAuthority === true;
  if (source.remoteFetchAttempted && !source.remoteFetchOk) errors.push('template fetch failed; remote source authority could not be verified');
  if (!source.manifestValid) errors.push('template.json is missing a valid templateId, semantic version, non-negative revision, or sourceRepository');
  if (!source.versionMatchesTool) errors.push(`template.json version ${source.version || '<missing>'} does not match scripts/devrules.mjs version ${source.toolVersion || '<missing>'}`);
  if (!source.versionMatchesChangelog) errors.push(`template.json version ${source.version || '<missing>'} does not match CHANGELOG.md latest release ${source.changelogVersion || '<missing>'}`);
  if (!source.gitRepository) errors.push('template root is not its own Git repository');
  if (!source.commit) errors.push('template source has no Git commit');
  if (!source.remote) errors.push('template source has no configured remote authority');
  if (source.remote && !source.remoteTopologyValid) errors.push('template origin fetch/push authority is ambiguous or rewritten to a different repository');
  if (!source.objectOverlayClean) errors.push('template Git replace refs or grafts are present; canonical release objects cannot be verified');
  if (!source.remoteMatchesDeclaration) errors.push('template Git remote does not match template.json sourceRepository');
  if (!fixedReleaseAuthority && !source.upstream) errors.push('template branch has no configured upstream');
  if (!fixedReleaseAuthority && source.upstream && !source.upstreamIsOrigin) errors.push('template branch upstream is not configured on origin');
  if (!fixedReleaseAuthority && source.upstream && !source.published) errors.push('template commit is not published to its upstream');
  if (!source.tagAnnotated) errors.push(`template release tag ${source.tagName || '<missing>'} is missing or is not annotated`);
  if (source.tagAnnotated && !source.tagMatchesCommit) errors.push(`template release tag ${source.tagName} does not point to the template commit`);
  if ((options.apply === true || options.verifyRemoteTag === true) && source.tagAnnotated && source.tagMatchesCommit && !source.tagPublished) errors.push(`template release tag ${source.tagName} is not published exactly to the configured remote`);
  for (const issue of source.managedIntegrityIssues || []) errors.push(`${issue.relPath}: ${issue.message}`);
  if (!source.managedCommitMatches) errors.push('managed template payload was not collected from the current Git commit');
  if (source.dirty) errors.push('template Git worktree is dirty; commit the template before applying it');

  if (previousSource?.templateId && source.templateId && previousSource.templateId !== source.templateId) {
    errors.push(`template identity changed from ${previousSource.templateId} to ${source.templateId}`);
  }
  const previousRevision = Number(previousSource?.revision);
  if (Number.isFinite(previousRevision) && previousRevision > source.revision) {
    errors.push(`template downgrade blocked: target revision ${previousRevision} is newer than source revision ${source.revision}`);
  }
  if (
    Number.isFinite(previousRevision)
    && previousRevision === source.revision
    && previousSource?.manifestHash
    && previousSource.manifestHash !== source.manifestHash
  ) {
    errors.push(`template revision ${source.revision} changed content without a revision bump`);
  }
  return errors;
}

function serializeState(state) {
  const modules = Object.fromEntries(Object.entries(state.modules || {}).sort(([a], [b]) => a.localeCompare(b)));
  const files = Object.fromEntries(Object.entries(state.files).sort(([a], [b]) => a.localeCompare(b)));
  const removedFiles = Object.fromEntries(Object.entries(state.removedFiles).sort(([a], [b]) => a.localeCompare(b)));
  return `${JSON.stringify({
    schemaVersion: 4,
    updatedAt: state.updatedAt,
    source: state.source,
    modules,
    files,
    removedFiles,
  }, null, 2)}\n`;
}

function planIdentifier(source, operations, stateContent) {
  const material = JSON.stringify({
    source: publicSource(source),
    operations: operations.map((operation) => ({
      action: operation.action,
      relPath: operation.relPath,
      moduleId: operation.moduleId,
      beforeHash: operation.beforeHash,
      afterHash: operation.afterHash,
    })),
    stateHash: hash(Buffer.from(stateContent)),
  });
  return hash(Buffer.from(material)).slice(0, 20);
}

function publicAction(action) {
  return {
    action: action.action,
    path: action.path,
    templatePath: action.relPath,
    reason: action.reason,
    ...(action.moduleId ? { moduleId: action.moduleId } : {}),
    ...(action.sourceOwnership ? { sourceOwnership: action.sourceOwnership } : {}),
    ...(action.mode ? { mode: action.mode } : {}),
    ...(action.expectedAfter ? { expectedAfter: action.expectedAfter } : {}),
    ...(Object.hasOwn(action, 'afterHash') ? {
      expectedAfter: action.action === 'delete'
        ? { present: false, type: 'absent', hash: `sha256:${hash(Buffer.from('absent'))}`, mode: null }
        : { present: true, type: 'file', hash: `sha256:${action.afterHash}`, ...(action.mode ? { mode: action.mode } : {}) },
    } : {}),
  };
}

function moduleOperation(file, destination, target, reason) {
  return {
    action: 'copy',
    path: destination,
    relPath: file.relPath,
    moduleId: file.moduleId,
    sourceOwnership: file.sourceOwnership,
    reason,
    beforeHash: target.exists ? target.hash : '',
    afterHash: file.sourceHash,
    content: file.content,
    mode: file.mode,
    sourcePath: file.sourcePath,
    sourceKind: file.sourceKind,
  };
}

async function planTemplateModule(options) {
  const {
    moduleId,
    repoPath,
    source,
    baseState,
    files,
    managedByPath,
    adoptCurrentBaseline,
    reconcileOwnership,
  } = options;
  const state = cloneState(baseState);
  const actions = [];
  const operations = [];

  for (const file of files) {
    const destination = path.join(repoPath, 'devrules', file.relPath);
    if (file.sourceOwnership === 'local') {
      delete state.files[file.relPath];
      delete state.removedFiles[file.relPath];
      actions.push({
        action: 'skip',
        path: destination,
        relPath: file.relPath,
        moduleId,
        sourceOwnership: file.sourceOwnership,
        reason: 'local ownership is project-controlled and is not synchronized',
      });
      continue;
    }

    const target = await fileFingerprint(destination);
    const previous = baseState.files[file.relPath];
    const retired = baseState.removedFiles[file.relPath];
    const previousOwnership = previous?.ownership || retired?.ownership || '';
    const previousSourceHash = previous?.sourceHash || '';
    const baselineHash = previous?.syncedHash || previousSourceHash || '';
    const detail = { path: destination, relPath: file.relPath, moduleId, sourceOwnership: file.sourceOwnership };

    if (target.exists && !target.regular) {
      actions.push({ ...detail, action: 'conflict', reason: `managed target leaf is a ${target.kind}; preserve its filesystem topology for explicit resolution` });
      continue;
    }

    if (file.sourceOwnership === 'seed') {
      if (!previous && !retired && !target.exists) {
        recordFile(state, file, source, file.sourceHash, 'project');
        const operation = moduleOperation(file, destination, target, 'install project-owned seed file');
        operations.push(operation);
        actions.push(operation);
      } else if (!target.exists) {
        recordAbsentFile(state, file, source);
        actions.push({ ...detail, action: 'skip', reason: 'preserve project-owned seed deletion' });
      } else {
        recordFile(state, file, source, target.hash, 'project');
        actions.push({ ...detail, action: previous || retired ? 'skip' : 'adopt-baseline', reason: 'preserve project-owned seed content after initial installation' });
      }
      continue;
    }

    if (target.exists && target.hash === file.sourceHash) {
      const ownership = retired ? 'project' : previousOwnership;
      recordFile(state, file, source, target.hash, ownership);
      actions.push({ ...detail, action: 'skip', reason: 'already current' });
      continue;
    }
    if (!target.exists) {
      if (previous?.targetPresence === 'absent' || retired?.ownership === 'project') {
        recordAbsentFile(state, file, source);
        actions.push({ ...detail, action: 'skip', reason: 'preserve project-owned local deletion' });
        continue;
      }
      if (previous) {
        if (adoptCurrentBaseline) {
          recordAbsentFile(state, file, source);
          actions.push({ ...detail, action: 'adopt-baseline', reason: 'adopt local deletion as project-owned state' });
        } else {
          actions.push({ ...detail, action: 'conflict', reason: 'project instance file was deleted since the last template sync' });
        }
        continue;
      }
      recordFile(state, file, source, file.sourceHash);
      const operation = moduleOperation(file, destination, target, 'missing devrules template file');
      operations.push(operation);
      actions.push(operation);
      continue;
    }
    if (previousOwnership === 'project' || retired) {
      recordFile(state, file, source, target.hash, 'project');
      actions.push({ ...detail, action: 'skip', reason: 'preserve project-owned adopted file' });
      continue;
    }
    if (!baselineHash) {
      if (reconcileOwnership) {
        recordFile(state, file, source, file.sourceHash, 'template');
        const operation = moduleOperation(file, destination, target, 'reconcile shared file to the authoritative template');
        operations.push(operation);
        actions.push(operation);
      } else if (adoptCurrentBaseline) {
        recordFile(state, file, source, target.hash, 'project');
        actions.push({ ...detail, action: 'adopt-baseline', reason: 'adopt existing project file; preserve project-owned content' });
      } else {
        actions.push({ ...detail, action: 'conflict', reason: 'existing file differs from template and has no sync baseline' });
      }
      continue;
    }
    if (target.hash !== baselineHash) {
      if (adoptCurrentBaseline) {
        recordFile(state, file, source, target.hash, 'project');
        actions.push({ ...detail, action: 'adopt-baseline', reason: 'adopt locally changed project file; preserve local edits' });
      } else {
        actions.push({ ...detail, action: 'conflict', reason: 'project instance file changed since last template sync' });
      }
      continue;
    }
    recordFile(state, file, source, file.sourceHash);
    const operation = moduleOperation(file, destination, target, 'sync devrules template file');
    operations.push(operation);
    actions.push(operation);
  }

  for (const [relPath, previous] of Object.entries(baseState.files)) {
    if (previous.moduleId !== moduleId || managedByPath.has(relPath)) continue;
    const destination = path.join(repoPath, 'devrules', relPath);
    const target = await fileFingerprint(destination);
    const baselineHash = previous.syncedHash || previous.sourceHash || '';
    const detail = { path: destination, relPath, moduleId, sourceOwnership: previous.sourceOwnership };
    if (target.exists && !target.regular) {
      actions.push({ ...detail, action: 'conflict', reason: `managed target leaf is a ${target.kind}; preserve its filesystem topology for explicit resolution` });
    } else if (!target.exists) {
      retireFile(state, relPath, previous, 'absent', '', 'project');
      actions.push({ ...detail, action: 'remove-baseline', reason: 'template and project both removed the path; preserve project-owned absence' });
    } else if (previous.ownership === 'project' || previous.sourceOwnership !== 'shared') {
      retireFile(state, relPath, previous, 'present', target.hash, 'project');
      actions.push({ ...detail, action: 'remove-baseline', reason: 'template removed a project-owned file; retire the baseline and preserve project content' });
    } else if (target.hash === baselineHash) {
      retireFile(state, relPath, previous, 'absent', '', 'template');
      const operation = {
        ...detail,
        action: 'delete',
        reason: 'template removed an unchanged managed file',
        beforeHash: target.hash,
        afterHash: '',
        content: null,
        mode: target.mode,
      };
      operations.push(operation);
      actions.push(operation);
    } else {
      actions.push({ ...detail, action: 'conflict', reason: 'template removed a file that has project-local changes' });
    }
  }

  for (const [relPath, retired] of Object.entries(baseState.removedFiles)) {
    if (retired.moduleId !== moduleId || managedByPath.has(relPath)) continue;
    const destination = path.join(repoPath, 'devrules', relPath);
    const target = await fileFingerprint(destination);
    const detail = { path: destination, relPath, moduleId, sourceOwnership: retired.sourceOwnership };
    if (target.exists && !target.regular) {
      actions.push({ ...detail, action: 'conflict', reason: `retired managed target leaf is a ${target.kind}; preserve its filesystem topology for explicit resolution` });
    } else if (target.exists && (retired.ownership !== 'project' || retired.targetPresence !== 'present' || retired.syncedHash !== target.hash)) {
      state.removedFiles[relPath] = { ...retired, syncedHash: target.hash, targetPresence: 'present', ownership: 'project' };
      actions.push({ ...detail, action: 'adopt-baseline', reason: 'preserve a project file created or changed while the template path is retired' });
    } else if (!target.exists && retired.ownership === 'project' && retired.targetPresence !== 'absent') {
      state.removedFiles[relPath] = { ...retired, syncedHash: '', targetPresence: 'absent' };
      actions.push({ ...detail, action: 'adopt-baseline', reason: 'preserve project-owned deletion while the template path is retired' });
    }
  }

  const conflicts = actions.filter((action) => action.action === 'conflict');
  if (!conflicts.length) {
    const hasStatePaths = [...Object.values(state.files), ...Object.values(state.removedFiles)].some((entry) => entry.moduleId === moduleId);
    if (hasStatePaths) {
      const previousModule = baseState.modules[moduleId];
      state.modules[moduleId] = {
        source: publicSource(source),
        updatedAt: previousModule?.source?.commit === source.commit && previousModule.updatedAt
          ? previousModule.updatedAt
          : new Date().toISOString(),
      };
    } else {
      delete state.modules[moduleId];
    }
  }
  return { moduleId, state, actions, operations, conflicts };
}

async function buildTemplateSyncPlan(options) {
  const repoPath = path.resolve(options.repoPath);
  const templateRoot = path.resolve(options.templateRoot);
  const statePath = path.join(repoPath, 'devrules', SYNC_STATE_FILE);
  if (!(await isExactGitWorktree(repoPath))) throw new Error(`template sync target must be the exact root of a Git working tree: ${repoPath}`);

  const collectedFiles = await collectManagedTemplateFiles(templateRoot, options.directoryNames, options.rootFiles);
  const policy = classifyManagedTemplateFiles(collectedFiles);
  const managedFiles = policy.files;
  const managedByPath = new Map(managedFiles.map((file) => [file.relPath, file]));
  await assertManagedDestinationParents(repoPath, [...managedFiles.map((file) => file.relPath), SYNC_STATE_FILE]);
  const stateAtPlanStart = await fileFingerprint(statePath);
  const verifyRemote = options.apply === true || options.verifyRemoteTag === true;
  const remotePreflight = verifyRemote ? await fetchTemplateSource(templateRoot) : null;
  const source = await readTemplateSource(templateRoot, managedFiles, { verifyRemoteTag: remotePreflight?.ok === true });
  source.remoteFetchAttempted = remotePreflight !== null;
  source.remoteFetchOk = remotePreflight?.ok === true;

  const loadedState = await loadTemplateSyncState(repoPath, options.directoryNames, options.rootFiles);
  const stateTrustErrors = [...loadedState.validationErrors];
  if (!stateTrustErrors.length) {
    stateTrustErrors.push(...await validateTemplateSyncStateProvenance({
      state: loadedState,
      templateRoot,
      currentSource: source,
      directoryNames: options.directoryNames,
      rootFiles: options.rootFiles,
    }));
  }

  const reconcileRequested = options.reconcileOwnership === true;
  const reconcileUnknownPaths = [
    ...Object.keys(loadedState.files),
    ...Object.keys(loadedState.removedFiles),
  ].filter((relPath) => !managedByPath.has(relPath));
  const recoverableReconcileValidation = loadedState.validationErrors
    .filter((error) => /excluded filesystem metadata/.test(error));
  const structuralReconcileValidation = loadedState.validationErrors
    .filter((error) => !recoverableReconcileValidation.includes(error));
  const reconcileErrors = [];
  if (reconcileRequested && stateTrustErrors.length && structuralReconcileValidation.length) {
    reconcileErrors.push('ownership reconciliation cannot rebuild a structurally invalid or unreadable legacy state file');
  }
  if (reconcileRequested && stateTrustErrors.length && policy.policyMode !== 'classified') {
    reconcileErrors.push('ownership reconciliation requires a template whose managed Markdown has classified ownership metadata');
  }
  const reconcileAllowed = reconcileRequested && stateTrustErrors.length > 0 && reconcileErrors.length === 0;
  const rebuildUntrustedState = stateTrustErrors.length > 0 && (options.adoptCurrentBaseline === true || reconcileAllowed);
  const emptyState = normalizeTemplateSyncState({}, options.directoryNames, options.rootFiles);
  const previousState = rebuildUntrustedState ? emptyState : loadedState;
  await assertManagedDestinationParents(repoPath, Object.keys(previousState.files));

  const trustedPolicyMigration = stateAtPlanStart.regular && !stateTrustErrors.length && (
    loadedState.inputSchemaVersion < 4
    || Object.values(loadedState.files).some((entry) => entry.moduleId === LEGACY_TEMPLATE_MODULE && policy.policyMode === 'classified')
  );
  const baseState = trustedPolicyMigration
    ? migrateTrustedLegacyState(loadedState, managedByPath, source)
    : cloneState(previousState);
  const nextState = cloneState(baseState);

  const actions = [];
  if (rebuildUntrustedState && reconcileAllowed) {
    actions.push({ action: 'reconcile-ownership', path: statePath, relPath: SYNC_STATE_FILE, reason: 'explicitly rebuild untrusted legacy state: shared follows the template while seed and local stay project-owned' });
    for (const relPath of reconcileUnknownPaths) {
      actions.push({
        action: 'discard-state-provenance',
        path: statePath,
        relPath,
        reason: 'historical path is absent from the current template; discard untrusted provenance and preserve target bytes',
      });
    }
    for (const validationError of recoverableReconcileValidation) {
      actions.push({
        action: 'discard-state-provenance',
        path: statePath,
        relPath: SYNC_STATE_FILE,
        reason: `${validationError}; preserve excluded filesystem metadata bytes`,
      });
    }
  } else if (rebuildUntrustedState) {
    actions.push({ action: 'adopt-state-baseline', path: statePath, relPath: SYNC_STATE_FILE, reason: 'replace untrusted legacy sync state while preserving every current project file' });
  } else if (trustedPolicyMigration) {
    actions.push({ action: 'migrate-state', path: statePath, relPath: SYNC_STATE_FILE, reason: 'upgrade trusted legacy baselines to schema 4 module ownership' });
  }

  const authorityErrors = sourceTransitionErrors(previousState.source, source, options);
  const transitionErrors = [
    ...(!rebuildUntrustedState ? stateTrustErrors.map((error) => `invalid template sync state: ${error}`) : []),
    ...reconcileErrors,
    ...authorityErrors,
  ];
  for (const reason of transitionErrors) actions.push({ action: 'blocked', path: templateRoot, relPath: '', reason });
  let globalBlocked = transitionErrors.length > 0;

  const installedModules = await readInstalledTemplateModules(repoPath, fs);
  const moduleInstalled = (moduleId) => policy.policyMode === 'legacy'
    || installedModules === null
    || installedModules.has(moduleId);
  const activeFiles = [];
  if (!globalBlocked) {
    for (const file of managedFiles) {
      if (file.sourceOwnership === 'local' || moduleInstalled(file.moduleId)) {
        activeFiles.push(file);
      } else {
        actions.push({
          action: 'skip',
          path: path.join(repoPath, 'devrules', file.relPath),
          relPath: file.relPath,
          moduleId: file.moduleId,
          sourceOwnership: file.sourceOwnership,
          reason: 'module is outside the project template-sync scope; preserve existing project bytes and module provenance',
        });
      }
    }
  }
  const activeByModule = new Map();
  for (const file of activeFiles) {
    if (!activeByModule.has(file.moduleId)) activeByModule.set(file.moduleId, []);
    activeByModule.get(file.moduleId).push(file);
  }
  if (!globalBlocked) {
    for (const entry of [...Object.values(baseState.files), ...Object.values(baseState.removedFiles)]) {
      if (moduleInstalled(entry.moduleId) && !activeByModule.has(entry.moduleId)) activeByModule.set(entry.moduleId, []);
    }
  }

  const safeOperations = [];
  const plannedModules = new Map();
  const modulePlans = [];
  let successfulModules = 0;
  for (const [moduleId, files] of [...activeByModule.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const modulePlan = await planTemplateModule({
      moduleId,
      repoPath,
      source,
      baseState,
      files,
      managedByPath,
      adoptCurrentBaseline: options.adoptCurrentBaseline === true,
      reconcileOwnership: reconcileAllowed,
    });
    plannedModules.set(moduleId, modulePlan);
  }
  const closure = moduleDeferralClosure(plannedModules);
  const conflictModules = [...closure.conflicts].sort();
  const deferredModules = [...closure.deferred.keys()].sort();
  const blockedModules = [...new Set([...conflictModules, ...deferredModules])].sort();
  for (const [moduleId, modulePlan] of plannedModules) {
    const deferralReason = closure.conflicts.has(moduleId)
      ? `module blocked by ${modulePlan.conflicts.length} ownership conflict(s)`
      : closure.deferred.get(moduleId);
    if (deferralReason) {
      actions.push(...deferredModuleActions(modulePlan, deferralReason));
    } else {
      replaceModuleState(nextState, modulePlan.state, moduleId);
      safeOperations.push(...modulePlan.operations);
      actions.push(...modulePlan.actions);
      successfulModules += 1;
    }
    modulePlans.push({
      moduleId,
      status: closure.conflicts.has(moduleId) ? 'conflict' : closure.deferred.has(moduleId) ? 'deferred' : 'ready',
      blocked: Boolean(deferralReason),
      reason: deferralReason || '',
      operationCount: deferralReason ? 0 : modulePlan.operations.length,
      conflictCount: modulePlan.conflicts.length,
    });
  }

  const shouldPersistState = !globalBlocked && successfulModules > 0;
  if (shouldPersistState) {
    for (const moduleId of Object.keys(nextState.modules)) {
      const hasStatePaths = [...Object.values(nextState.files), ...Object.values(nextState.removedFiles)]
        .some((entry) => entry.moduleId === moduleId);
      if (!hasStatePaths) delete nextState.modules[moduleId];
    }
    nextState.source = publicSource(source);
    const previousMaterial = serializeState({ ...baseState, updatedAt: '' });
    const nextMaterial = serializeState({ ...nextState, updatedAt: '' });
    if (previousMaterial !== nextMaterial || !nextState.updatedAt) nextState.updatedAt = new Date().toISOString();
  }

  const stateBefore = await fileFingerprint(statePath);
  if (!fingerprintMatches(stateBefore, stateAtPlanStart)) {
    actions.push({ action: 'conflict', path: statePath, relPath: SYNC_STATE_FILE, reason: 'template sync state changed while the plan was being built' });
    globalBlocked = true;
  }
  if (stateBefore.exists && !stateBefore.regular) {
    actions.push({ action: 'conflict', path: statePath, relPath: SYNC_STATE_FILE, reason: `template sync state is a ${stateBefore.kind}; preserve its filesystem topology for explicit resolution` });
    globalBlocked = true;
  }
  const currentStateContent = stateBefore.regular ? stateBefore.content.toString('utf8') : '';
  const proposedStateContent = shouldPersistState ? serializeState(nextState) : currentStateContent;
  const stateChanged = !globalBlocked && shouldPersistState && currentStateContent !== proposedStateContent;
  const operations = globalBlocked ? [] : safeOperations;
  const stateContent = globalBlocked ? currentStateContent : proposedStateContent;
  const blocked = globalBlocked || blockedModules.length > 0;
  const partial = !globalBlocked && blockedModules.length > 0 && (successfulModules > 0 || operations.length > 0 || stateChanged);
  const planId = planIdentifier(source, operations, stateContent);
  if (stateChanged) actions.push({
    action: 'write',
    path: statePath,
    relPath: SYNC_STATE_FILE,
    reason: 'update schema 4 module sync state',
    expectedAfter: {
      present: true,
      type: 'file',
      hash: `sha256:${hash(Buffer.from(stateContent))}`,
      mode: stateBefore.mode || 0o644,
    },
  });

  return {
    schemaVersion: 2,
    planId,
    repo: repoPath,
    templateRoot,
    source,
    previousSource: loadedState.source,
    blocked,
    globalBlocked,
    partial,
    policyMode: policy.policyMode,
    blockedModules,
    conflictModules,
    deferredModules,
    modules: modulePlans,
    transitionErrors,
    conflicts: actions.filter((action) => action.action === 'conflict').map(publicAction),
    actions: actions.map(publicAction),
    operations,
    statePath,
    stateBefore,
    stateContent,
    stateChanged,
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

export async function syncTemplateRepository(options) {
  if (options.apply !== true) {
    const plan = await buildTemplateSyncPlan(options);
    return { ...publicPlan(plan), apply: false, applied: false };
  }
  return withTemplateSyncLock(path.resolve(options.repoPath), async () => {
    const plan = await buildTemplateSyncPlan(options);
    return applyTemplateSyncPlan(plan);
  });
}
