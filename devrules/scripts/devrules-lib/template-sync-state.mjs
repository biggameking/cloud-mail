import fs from 'node:fs/promises';
import path from 'node:path';

import { readGitBlobs, runGit } from './git-repository.mjs';
import { remoteIdentity } from './template-authority.mjs';
import { hash } from './template-file-fingerprint.mjs';
import { isCanonicalRelativePath, isSafeRelativePath, normalizeRel } from './template-path-safety.mjs';
import { INSTALLABLE_TEMPLATE_MODULES, LEGACY_TEMPLATE_MODULE } from './template-sync-policy.mjs';

const OWNERSHIP = new Set(['template', 'project']);
const SOURCE_OWNERSHIP = new Set(['shared', 'seed', 'local']);
const STATE_MODULES = new Set([...INSTALLABLE_TEMPLATE_MODULES, LEGACY_TEMPLATE_MODULE]);

function isRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function isFilesystemMetadata(name) {
  const normalized = String(name || '');
  return normalized.startsWith('._') || normalized === '.DS_Store' || normalized.toLowerCase() === 'thumbs.db';
}

function isManagedPath(relPath, directoryNames, rootFiles) {
  return rootFiles.has(relPath) || directoryNames.some((directoryName) => relPath.startsWith(`${directoryName}/`));
}

function normalizedStatePath(rawPath, directoryNames, rootFiles, section, errors) {
  const normalized = normalizeRel(rawPath);
  if (!isCanonicalRelativePath(rawPath)) {
    errors.push(`${section} has a non-canonical or unsafe path: ${rawPath}`);
    return '';
  }
  if (!isManagedPath(normalized, directoryNames, rootFiles)) {
    errors.push(`${section} path is outside the managed template scope: ${normalized}`);
    return '';
  }
  if (normalized.split('/').some(isFilesystemMetadata)) {
    errors.push(`${section} path is excluded filesystem metadata: ${normalized}`);
    return '';
  }
  return normalized;
}

function validHash(value) {
  return /^[a-f0-9]{64}$/i.test(String(value || ''));
}

function validCommit(value) {
  return /^[a-f0-9]{40,64}$/i.test(String(value || ''));
}

function validRevision(value) {
  const revision = Number(value);
  return Number.isInteger(revision) && revision >= 0;
}

export function normalizeTemplateSyncState(parsed, directoryNames = [], rootFileNames = []) {
  const errors = [];
  const directories = [...new Set(directoryNames.map(normalizeRel).filter(isSafeRelativePath))];
  const rootFiles = new Set(rootFileNames.map(normalizeRel).filter(isSafeRelativePath));
  if (!isRecord(parsed)) parsed = {};
  const inputSchema = Number(parsed.schemaVersion || 1);
  if (Object.keys(parsed).length && ![1, 2, 3, 4].includes(inputSchema)) errors.push(`unsupported template sync state schema: ${parsed.schemaVersion}`);
  const legacySourceCommit = String(parsed.source?.commit || '');
  const legacySourceRevision = Number(parsed.source?.revision || 0);
  const files = {};
  if (parsed.files !== undefined && !isRecord(parsed.files)) errors.push('template sync state files must be an object');
  for (const [rawPath, entry] of Object.entries(isRecord(parsed.files) ? parsed.files : {})) {
    const relPath = normalizedStatePath(rawPath, directories, rootFiles, 'template sync state files', errors);
    if (!relPath) continue;
    if (!isRecord(entry)) {
      errors.push(`template sync state file entry is invalid: ${relPath}`);
      continue;
    }
    const sourceHash = typeof entry.sourceHash === 'string' ? entry.sourceHash : '';
    const syncedHash = typeof entry.syncedHash === 'string' ? entry.syncedHash : sourceHash;
    const targetPresence = inputSchema >= 3 ? String(entry.targetPresence || '') : 'present';
    if (!validHash(sourceHash)
      || !['present', 'absent'].includes(targetPresence)
      || targetPresence === 'present' && !validHash(syncedHash)
      || targetPresence === 'absent' && syncedHash !== '') {
      errors.push(`template sync state file hashes are invalid: ${relPath}`);
      continue;
    }
    const ownership = inputSchema >= 3 ? String(entry.ownership || '') : sourceHash === syncedHash ? 'template' : 'project';
    const sourceOwnership = inputSchema >= 4 ? String(entry.sourceOwnership || '') : 'shared';
    const moduleId = inputSchema >= 4 ? String(entry.moduleId || '') : LEGACY_TEMPLATE_MODULE;
    const sourceCommit = inputSchema >= 4 ? String(entry.sourceCommit || '') : legacySourceCommit;
    const sourceRevision = inputSchema >= 4 ? Number(entry.sourceRevision) : legacySourceRevision;
    const moduleProvenanceInvalid = inputSchema >= 4 && (
      !SOURCE_OWNERSHIP.has(sourceOwnership)
      || !STATE_MODULES.has(moduleId)
      || !validCommit(sourceCommit)
      || !validRevision(sourceRevision)
    );
    if (moduleProvenanceInvalid) {
      errors.push(`template sync state file set does not match schema 4 module provenance: ${relPath}`);
      continue;
    }
    if (!OWNERSHIP.has(ownership)
      || ownership === 'template' && (sourceHash !== syncedHash || targetPresence !== 'present')
      || targetPresence === 'absent' && ownership !== 'project'
      || sourceOwnership !== 'shared' && ownership !== 'project') {
      errors.push(`template sync state ownership is invalid: ${relPath}`);
      continue;
    }
    files[relPath] = {
      sourceHash,
      syncedHash,
      targetPresence,
      ownership,
      sourceOwnership,
      moduleId,
      sourceCommit,
      sourceRevision,
      syncedAt: typeof entry.syncedAt === 'string' ? entry.syncedAt : '',
    };
  }
  const removedFiles = {};
  if (parsed.removedFiles !== undefined && !isRecord(parsed.removedFiles)) errors.push('template sync state removedFiles must be an object');
  for (const [rawPath, entry] of Object.entries(isRecord(parsed.removedFiles) ? parsed.removedFiles : {})) {
    const relPath = normalizedStatePath(rawPath, directories, rootFiles, 'template sync state removedFiles', errors);
    if (!relPath) continue;
    if (!isRecord(entry)) {
      errors.push(`template sync state removed-file entry is invalid: ${relPath}`);
      continue;
    }
    if (files[relPath] || removedFiles[relPath]) {
      errors.push(`template sync state path appears more than once: ${relPath}`);
      continue;
    }
    const sourceRevision = inputSchema >= 4 ? Number(entry.sourceRevision) : Number(entry.sourceRevision || legacySourceRevision || 0);
    if (!Number.isInteger(sourceRevision) || sourceRevision < 0) {
      errors.push(`template sync state removed-file revision is invalid: ${relPath}`);
      continue;
    }
    const ownership = inputSchema >= 3 ? String(entry.ownership || '') : 'template';
    const sourceCommit = inputSchema >= 3 ? String(entry.sourceCommit || '') : '';
    const sourceHash = inputSchema >= 3 ? String(entry.sourceHash || '') : String(entry.previousHash || '');
    const syncedHash = inputSchema >= 3 ? String(entry.syncedHash ?? '') : String(entry.previousHash || '');
    const targetPresence = inputSchema >= 3 ? String(entry.targetPresence || '') : 'present';
    const sourceOwnership = inputSchema >= 4 ? String(entry.sourceOwnership || '') : 'shared';
    const moduleId = inputSchema >= 4 ? String(entry.moduleId || '') : LEGACY_TEMPLATE_MODULE;
    const moduleProvenanceInvalid = inputSchema >= 4 && (
      !SOURCE_OWNERSHIP.has(sourceOwnership)
      || !STATE_MODULES.has(moduleId)
      || !validCommit(sourceCommit)
    );
    if (moduleProvenanceInvalid) {
      errors.push(`template sync state removed-file set does not match schema 4 module provenance: ${relPath}`);
      continue;
    }
    if (!OWNERSHIP.has(ownership)
      || !validHash(sourceHash)
      || inputSchema >= 3 && !validCommit(sourceCommit)
      || !['present', 'absent'].includes(targetPresence)
      || targetPresence === 'present' && !validHash(syncedHash)
      || targetPresence === 'absent' && syncedHash !== ''
      || sourceOwnership !== 'shared' && ownership !== 'project') {
      errors.push(`template sync state removed-file provenance is invalid: ${relPath}`);
      continue;
    }
    removedFiles[relPath] = {
      sourceHash,
      syncedHash,
      targetPresence,
      ownership,
      sourceOwnership,
      moduleId,
      sourceCommit,
      removedAt: String(entry.removedAt || ''),
      sourceRevision,
    };
  }
  if (parsed.source !== undefined && parsed.source !== null && !isRecord(parsed.source)) errors.push('template sync state source must be an object or null');
  const modules = {};
  if (inputSchema >= 4 && !isRecord(parsed.modules)) errors.push('template sync state modules must be an object');
  for (const [moduleId, entry] of Object.entries(inputSchema >= 4 && isRecord(parsed.modules) ? parsed.modules : {})) {
    if (!STATE_MODULES.has(moduleId) || !isRecord(entry) || !isRecord(entry.source)) {
      errors.push(`template sync state module is invalid: ${moduleId}`);
      continue;
    }
    const moduleCommit = String(entry.source.commit || '');
    const moduleRevision = Number(entry.source.revision);
    if (!validCommit(moduleCommit) || !validRevision(moduleRevision)) {
      errors.push(`template sync state module source is invalid: ${moduleId}`);
      continue;
    }
    modules[moduleId] = {
      source: { ...entry.source },
      updatedAt: typeof entry.updatedAt === 'string' ? entry.updatedAt : '',
    };
  }
  if (inputSchema >= 4) {
    for (const [relPath, entry] of [...Object.entries(files), ...Object.entries(removedFiles)]) {
      if (!modules[entry.moduleId]) errors.push(`template sync state path references a missing module: ${relPath}`);
    }
  }
  return {
    schemaVersion: 4,
    inputSchemaVersion: inputSchema,
    updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : '',
    source: isRecord(parsed.source) ? { ...parsed.source } : null,
    modules,
    files,
    removedFiles,
    validationErrors: errors,
  };
}

export async function loadTemplateSyncState(repoPath, directoryNames, rootFiles) {
  const statePath = path.join(repoPath, 'devrules', '.template-sync.json');
  let parsed = {};
  try {
    const stat = await fs.lstat(statePath);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('state is not a regular file');
    parsed = JSON.parse(await fs.readFile(statePath, 'utf8'));
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      const state = normalizeTemplateSyncState({}, directoryNames, rootFiles);
      state.validationErrors.push(`template sync state is unreadable or malformed: ${statePath}`);
      return state;
    }
  }
  return normalizeTemplateSyncState(parsed, directoryNames, rootFiles);
}

async function committedManifest(templateRoot, commit, directoryNames, rootFileNames) {
  const pathspecs = [...new Set([...directoryNames, ...rootFileNames])];
  const [tree, roots] = await Promise.all([
    runGit(templateRoot, ['ls-tree', '-r', '-z', commit, '--', ...pathspecs], { allowFailure: true, trimOutput: false }),
    runGit(templateRoot, ['ls-tree', '-z', commit, '--', ...pathspecs], { allowFailure: true, trimOutput: false }),
  ]);
  if (!tree.ok || !roots.ok) return null;
  const rootFiles = new Set(rootFileNames.map(normalizeRel));
  const directoryRoots = new Set(directoryNames.map(normalizeRel));
  const rootEntries = new Map(String(roots.stdout).split('\0').filter(Boolean).map((record) => {
    const match = /^([0-7]{6}) ([^ ]+) ([0-9a-f]+)\t([\s\S]+)$/.exec(record);
    if (!match) throw new Error(`unexpected git ls-tree record: ${record}`);
    return [match[4], { mode: match[1], type: match[2] }];
  }));
  if ([...rootEntries.keys()].some((relPath) => !isCanonicalRelativePath(relPath))) return null;
  for (const directoryRoot of directoryRoots) {
    const entry = rootEntries.get(directoryRoot);
    if (entry && (entry.type !== 'tree' || entry.mode !== '040000')) return null;
  }
  for (const rootFile of rootFiles) {
    const entry = rootEntries.get(rootFile);
    if (entry && (entry.type !== 'blob' || !/^100[0-7]{3}$/.test(entry.mode))) return null;
  }
  const entries = String(tree.stdout).split('\0').filter(Boolean).map((record) => {
    const match = /^([0-7]{6}) ([^ ]+) ([0-9a-f]+)\t([\s\S]+)$/.exec(record);
    if (!match) throw new Error(`unexpected git ls-tree record: ${record}`);
    return { mode: match[1], type: match[2], objectId: match[3], relPath: match[4] };
  }).filter((entry) => isSafeRelativePath(entry.relPath)
    && (directoryRoots.has(entry.relPath) || isManagedPath(entry.relPath, directoryNames, rootFiles)));
  if (entries.some((entry) => !isCanonicalRelativePath(entry.relPath))) return null;
  if (entries.some((entry) => directoryRoots.has(entry.relPath))) return null;
  if (entries.some((entry) => entry.type !== 'blob' || entry.mode === '120000')) return null;
  const blobs = await readGitBlobs(templateRoot, entries.map((entry) => entry.objectId));
  if (entries.some((entry) => !blobs.has(entry.objectId))) return null;
  const files = new Map(entries.map((entry) => {
    const content = blobs.get(entry.objectId);
    return [entry.relPath, { content, sourceHash: hash(content) }];
  }));
  const manifestHash = hash(Buffer.from([...files].sort(([a], [b]) => a.localeCompare(b)).map(([relPath, entry]) => `${relPath}\0${entry.sourceHash}`).join('\n')));
  return { files, manifestHash };
}

async function validatePreviousRelease(options) {
  const { previous, templateRoot, currentSource, directoryNames, rootFiles } = options;
  const errors = [];
  const previousCommit = String(previous?.commit || '');
  if (!previous || !validCommit(previousCommit)) return { errors: ['template sync state has no verifiable previous source commit'], committed: null };
  const commit = await runGit(templateRoot, ['cat-file', '-e', `${previousCommit}^{commit}`], { allowFailure: true });
  const ancestor = await runGit(templateRoot, ['merge-base', '--is-ancestor', previousCommit, currentSource.commit], { allowFailure: true });
  if (!commit.ok) errors.push('template sync state previous source commit is unavailable');
  if (!ancestor.ok) errors.push('template sync state previous source is not an ancestor of the current authority');
  if (errors.length) return { errors, committed: null };

  const committed = await committedManifest(templateRoot, previousCommit, directoryNames, rootFiles);
  if (!committed) return { errors: ['template sync state previous managed tree is invalid'], committed: null };
  const previousManifestFile = committed.files.get('template.json');
  let previousManifest = {};
  try {
    previousManifest = JSON.parse(previousManifestFile?.content?.toString('utf8') || '{}');
  } catch {
    errors.push('template sync state previous template manifest is invalid');
  }
  const previousDeclaredRemote = String(previousManifest.sourceRepository || '');
  if (!previousDeclaredRemote || remoteIdentity(previousDeclaredRemote) !== remoteIdentity(currentSource.declaredRemote)) errors.push('template authority repository changed since the previous sync');
  if (remoteIdentity(previous.remote) !== remoteIdentity(previousDeclaredRemote) || remoteIdentity(previous.declaredRemote) !== remoteIdentity(previousDeclaredRemote)) errors.push('template sync state previous remote identity is invalid');
  if (previous.templateId !== previousManifest.templateId || previous.templateId !== currentSource.templateId) errors.push('template sync state template identity is invalid');
  if (previous.version !== previousManifest.version || Number(previous.revision) !== Number(previousManifest.revision)) errors.push('template sync state previous version or revision is invalid');
  if (previous.manifestHash !== committed.manifestHash) errors.push('template sync state previous manifest hash is invalid');
  if (previous.tagName !== `v${previous.version}` || previous.tagCommit !== previousCommit) errors.push('template sync state previous release tag metadata is invalid');
  const [tagObject, tagCommit] = await Promise.all([
    runGit(templateRoot, ['rev-parse', '--verify', `refs/tags/${previous.tagName}^{tag}`], { allowFailure: true }),
    runGit(templateRoot, ['rev-parse', '--verify', `refs/tags/${previous.tagName}^{commit}`], { allowFailure: true }),
  ]);
  if (!tagObject.ok || tagObject.stdout !== previous.tagObject || !tagCommit.ok || tagCommit.stdout !== previousCommit) errors.push('template sync state previous annotated release tag is invalid');
  return { errors, committed };
}

export async function validateTemplateSyncStateProvenance(options) {
  const { state, templateRoot, currentSource, directoryNames, rootFiles } = options;
  if (!Object.keys(state.files).length && !Object.keys(state.removedFiles).length && !state.source) return [];
  const previous = state.source;
  const previousCommit = String(previous?.commit || '');
  const release = await validatePreviousRelease({ previous, templateRoot, currentSource, directoryNames, rootFiles });
  const errors = [...release.errors];
  if (!release.committed || errors.length) return errors;
  const committed = release.committed;

  if (state.inputSchemaVersion < 4) {
    const committedPaths = [...committed.files.keys()].sort();
    const statePaths = Object.keys(state.files).sort();
    if (committedPaths.join('\0') !== statePaths.join('\0')) errors.push('template sync state file set does not match the previous committed template tree');
    for (const [relPath, entry] of Object.entries(state.files)) {
      if (committed.files.get(relPath)?.sourceHash !== entry.sourceHash) errors.push(`template sync state source hash lacks commit provenance: ${relPath}`);
    }
    for (const relPath of Object.keys(state.removedFiles)) {
      if (committed.files.has(relPath)) errors.push(`template sync state removed path exists in the previous committed tree: ${relPath}`);
    }
    for (const [relPath, entry] of Object.entries(state.removedFiles)) {
      const sourceAncestor = await runGit(templateRoot, ['merge-base', '--is-ancestor', entry.sourceCommit, previousCommit], { allowFailure: true });
      const sourceBlob = await runGit(templateRoot, ['show', `${entry.sourceCommit}:${relPath}`], { allowFailure: true, trimOutput: false });
      if (!sourceAncestor.ok || !sourceBlob.ok || hash(Buffer.from(sourceBlob.stdout)) !== entry.sourceHash) {
        errors.push(`template sync state removed-file source lacks commit provenance: ${relPath}`);
      }
    }
    return errors;
  }

  const manifests = new Map([[previousCommit, committed]]);
  const entries = [...Object.entries(state.files), ...Object.entries(state.removedFiles)];
  const commits = new Set(entries.map(([, entry]) => entry.sourceCommit));
  for (const module of Object.values(state.modules)) commits.add(String(module.source.commit || ''));
  for (const sourceCommit of commits) {
    if (!validCommit(sourceCommit)) continue;
    const ancestor = await runGit(templateRoot, ['merge-base', '--is-ancestor', sourceCommit, currentSource.commit], { allowFailure: true });
    if (!ancestor.ok) {
      errors.push(`template sync state module source is not an ancestor of current authority: ${sourceCommit}`);
      continue;
    }
    if (!manifests.has(sourceCommit)) {
      manifests.set(sourceCommit, await committedManifest(templateRoot, sourceCommit, directoryNames, rootFiles));
    }
  }
  for (const [relPath, entry] of entries) {
    const historical = manifests.get(entry.sourceCommit);
    if (!historical || historical.files.get(relPath)?.sourceHash !== entry.sourceHash) {
      errors.push(`template sync state source hash lacks commit provenance for its module: ${relPath}`);
      continue;
    }
    let manifest = {};
    try {
      manifest = JSON.parse(historical.files.get('template.json')?.content?.toString('utf8') || '{}');
    } catch {
      errors.push(`template sync state source manifest is invalid: ${relPath}`);
      continue;
    }
    if (Number(manifest.revision) !== Number(entry.sourceRevision) || manifest.templateId !== currentSource.templateId) {
      errors.push(`template sync state source revision lacks module commit provenance: ${relPath}`);
    }
  }
  for (const [moduleId, module] of Object.entries(state.modules)) {
    const historical = manifests.get(String(module.source.commit || ''));
    let manifest = {};
    try {
      manifest = JSON.parse(historical?.files.get('template.json')?.content?.toString('utf8') || '{}');
    } catch {
      errors.push(`template sync state module manifest is invalid: ${moduleId}`);
      continue;
    }
    if (!historical || manifest.templateId !== currentSource.templateId || Number(manifest.revision) !== Number(module.source.revision)) {
      errors.push(`template sync state module source lacks commit provenance: ${moduleId}`);
    }
  }
  return errors;
}
