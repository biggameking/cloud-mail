import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  appleDoubleCandidatesForActions,
  removeUntrackedActionAppleDoubleArtifacts,
} from './apple-double.mjs';
import { isExactGitWorktree, runGit } from './git-repository.mjs';
import { atomicWriteFile } from './safe-files.mjs';

const PROJECT_STATE_KIND = 'devrules-template-auto-update-project-state';
const PROJECT_STATE_SCHEMA_VERSION = 1;

function environment(options) {
  return options.env || process.env;
}

function timestamp(options) {
  return (options.now || (() => new Date()))().toISOString();
}

function hash(value) {
  return `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`;
}

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function receiptDigest(receipt) {
  const { digest: ignored, ...payload } = receipt;
  return hash(stable(payload));
}

export function defaultTemplateAutoUpdateProjectStatePath(options = {}) {
  return path.resolve(environment(options).DEVRULES_TEMPLATE_AUTO_UPDATE_PROJECT_STATE
    || path.join(options.homeDir || os.homedir(), '.config', 'devrules', 'template-auto-update-project-state.json'));
}

function emptyState(options) {
  return {
    schemaVersion: PROJECT_STATE_SCHEMA_VERSION,
    kind: PROJECT_STATE_KIND,
    updatedAt: timestamp(options),
    repositories: [],
    roundRobin: [],
  };
}

function validRoundRobin(entry) {
  return entry && typeof entry === 'object' && typeof entry.queueId === 'string'
    && typeof entry.lastWorkspaceId === 'string' && Array.isArray(entry.workspaces)
    && entry.workspaces.every((workspace) => workspace && typeof workspace.workspaceId === 'string'
      && typeof workspace.lastProjectPath === 'string');
}

function validReceipt(receipt) {
  return receipt && typeof receipt === 'object'
    && typeof receipt.repoPath === 'string'
    && receipt.repoPath === path.resolve(receipt.repoPath)
    && receipt.baseline && typeof receipt.baseline === 'object'
    && typeof receipt.baseline.head === 'string'
    && typeof receipt.baseline.branch === 'string'
    && typeof receipt.baseline.upstream === 'string'
    && typeof receipt.baseline.upstreamSha === 'string'
    && Array.isArray(receipt.statusEntries)
    && receipt.statusEntries.every((entry) => entry && typeof entry.status === 'string'
      && typeof entry.path === 'string' && entry.path.length > 0
      && (entry.originalPath === undefined || typeof entry.originalPath === 'string'))
    && Array.isArray(receipt.fingerprints)
    && receipt.fingerprints.every((entry) => entry && typeof entry.path === 'string'
      && typeof entry.present === 'boolean' && typeof entry.type === 'string'
      && (entry.mode === null || Number.isInteger(entry.mode))
      && /^sha256:[0-9a-f]{64}$/.test(String(entry.hash || '')))
    && typeof receipt.recordedAt === 'string'
    && typeof receipt.digest === 'string'
    && receipt.digest === receiptDigest(receipt);
}

async function readState(options = {}) {
  const statePath = path.resolve(options.projectStatePath || defaultTemplateAutoUpdateProjectStatePath(options));
  try {
    const stateStat = await fs.lstat(statePath);
    if (!stateStat.isFile() || stateStat.isSymbolicLink()) {
      return { statePath, valid: false, state: null, reason: 'project receipt ledger is not a regular file' };
    }
    if (process.platform !== 'win32' && (stateStat.mode & 0o077) !== 0) {
      return { statePath, valid: false, state: null, reason: 'project receipt ledger permissions must be 0600 or stricter' };
    }
    const parsed = JSON.parse(await fs.readFile(statePath, 'utf8'));
    if (parsed?.schemaVersion !== PROJECT_STATE_SCHEMA_VERSION || parsed?.kind !== PROJECT_STATE_KIND
      || !Array.isArray(parsed.repositories) || !parsed.repositories.every(validReceipt)
      || (parsed.roundRobin !== undefined && (!Array.isArray(parsed.roundRobin) || !parsed.roundRobin.every(validRoundRobin)))) {
      return { statePath, valid: false, state: null, reason: 'project receipt ledger has an invalid schema, kind, or receipt digest' };
    }
    const unique = new Set(parsed.repositories.map((receipt) => receipt.repoPath));
    if (unique.size !== parsed.repositories.length) {
      return { statePath, valid: false, state: null, reason: 'project receipt ledger contains duplicate repository paths' };
    }
    return { statePath, valid: true, state: { ...parsed, roundRobin: parsed.roundRobin || [] }, reason: '' };
  } catch (error) {
    if (error?.code === 'ENOENT') return { statePath, valid: true, state: emptyState(options), reason: '' };
    return { statePath, valid: false, state: null, reason: 'project receipt ledger cannot be read or parsed' };
  }
}

async function canonicalRepositoryPath(repoPath) {
  const resolved = path.resolve(repoPath);
  return fs.realpath(resolved).catch(() => resolved);
}

function parseStatusEntries(raw) {
  const records = String(raw || '').split('\0');
  const changes = [];
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    if (!record) continue;
    const status = record.slice(0, 2);
    const change = { status, path: record.slice(3) };
    if (/[RC]/.test(status)) {
      change.originalPath = records[index + 1] || '';
      index += 1;
    }
    changes.push(change);
  }
  return changes;
}

async function statusEntries(repoPath, options) {
  const entries = options.readProjectStatus
    ? await options.readProjectStatus(repoPath)
    : parseStatusEntries((await runGit(repoPath, ['status', '--porcelain=v1', '-z', '--untracked-files=all'], { trimOutput: false })).stdout);
  return entries.map((entry) => ({
    status: String(entry.status || ''),
    path: String(entry.path || ''),
    ...(entry.originalPath === undefined ? {} : { originalPath: String(entry.originalPath || '') }),
  }));
}

function safeRelativePath(relativePath) {
  const value = String(relativePath || '');
  if (!value || value.includes('\0') || path.isAbsolute(value)) throw new Error('Git status contains an unsafe path');
  const segments = value.replace(/\\/g, '/').split('/');
  if (segments.some((segment) => segment === '..')) throw new Error('Git status contains an unsafe parent path');
  return value;
}

const RECEIPTABLE_ACTIONS = new Set([
  'copy', 'delete', 'write', 'create', 'update', 'run',
  'reconcile-ownership', 'adopt-state-baseline', 'migrate-state',
]);

function portable(value) {
  return String(value || '').replace(/\\/g, '/').replace(/\/$/, '');
}

function actionPaths(repoPath, actions) {
  const repo = path.resolve(repoPath);
  const paths = [];
  for (const action of actions || []) {
    if (!RECEIPTABLE_ACTIONS.has(String(action?.action || ''))) continue;
    const rawPath = action.path || (action.templatePath ? path.join(repo, 'devrules', action.templatePath) : '');
    if (!rawPath) continue;
    const target = path.isAbsolute(rawPath) ? path.resolve(rawPath) : path.resolve(repo, rawPath);
    const relative = path.relative(repo, target);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) continue;
    paths.push(portable(relative));
  }
  return [...new Set(paths)];
}

export function templateAutoUpdateActionAttestation(repoPath, actions, ownedFingerprints = []) {
  const declaredPaths = actionPaths(repoPath, actions);
  const byPath = new Map(ownedFingerprints.map((entry) => [entry.path, entry]));
  for (const action of actions || []) {
    if (!action?.expectedAfter) continue;
    const [relativePath] = actionPaths(repoPath, [action]);
    if (relativePath) byPath.set(relativePath, { path: relativePath, ...action.expectedAfter });
  }
  return { actionPaths: declaredPaths, fingerprints: [...byPath.values()] };
}

export async function cleanupTemplateAutoUpdateActionMetadata(repoPath, actions, options = {}) {
  const declaredPaths = actionPaths(repoPath, actions);
  if (!declaredPaths.length || (options.platform || process.platform) !== 'darwin') {
    return { removed: [], removedCount: 0 };
  }
  if (!(await isExactGitWorktree(repoPath))) {
    throw new Error('AppleDouble action cleanup requires the exact verified Git worktree root');
  }
  const candidates = [...new Set([
    ...appleDoubleCandidatesForActions(declaredPaths),
    '._.git',
  ])].sort((left, right) => left.localeCompare(right));
  const trackedResult = await runGit(repoPath, ['ls-files', '-z', '--', ...candidates], { trimOutput: false });
  const trackedPaths = String(trackedResult.stdout || '').split('\0').filter(Boolean);
  return removeUntrackedActionAppleDoubleArtifacts(repoPath, candidates, trackedPaths, options);
}

function rotateAfter(items, predicate) {
  const index = items.findIndex(predicate);
  if (index < 0 || items.length < 2) return [...items];
  return [...items.slice(index + 1), ...items.slice(0, index + 1)];
}

export function fairTemplateAutoUpdateWorkspaceOrder(workspaces, cursor) {
  const workspaceOrder = rotateAfter(workspaces, (workspace) => workspace.workspaceId === cursor.lastWorkspaceId);
  const projectCursor = new Map((cursor.workspaces || []).map((entry) => [entry.workspaceId, entry.lastProjectPath]));
  return workspaceOrder.map((workspace) => ({
    ...workspace,
    projects: rotateAfter(workspace.projects || [],
      (project) => portable(path.resolve(project.path)) === projectCursor.get(workspace.workspaceId)),
  }));
}

function fileType(stat) {
  if (stat.isFile()) return 'file';
  if (stat.isDirectory()) return 'directory';
  if (stat.isSymbolicLink()) return 'symlink';
  if (stat.isBlockDevice()) return 'block-device';
  if (stat.isCharacterDevice()) return 'character-device';
  if (stat.isFIFO()) return 'fifo';
  if (stat.isSocket()) return 'socket';
  return 'other';
}

async function treeRecords(directory, relative = '') {
  const names = await fs.readdir(directory);
  names.sort((left, right) => left.localeCompare(right));
  const records = [];
  for (const name of names) {
    const absolute = path.join(directory, name);
    const childPath = relative ? `${relative}/${name}` : name;
    const stat = await fs.lstat(absolute);
    const type = fileType(stat);
    const record = { path: childPath, type, mode: stat.mode & 0o7777 };
    if (type === 'file') record.hash = hash(await fs.readFile(absolute));
    else if (type === 'symlink') record.hash = hash(await fs.readlink(absolute));
    else if (type === 'directory') records.push(...await treeRecords(absolute, childPath));
    records.push(record);
  }
  return records;
}

async function fingerprint(repoPath, relativePath) {
  const safePath = safeRelativePath(relativePath);
  const absolute = path.resolve(repoPath, safePath);
  const relative = path.relative(repoPath, absolute);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Git status path escapes the repository');
  let stat;
  try {
    stat = await fs.lstat(absolute);
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return { path: safePath, present: false, type: 'absent', mode: null, hash: hash('absent') };
    }
    throw error;
  }
  const type = fileType(stat);
  let contentHash;
  let treeEntryCount;
  if (type === 'file') contentHash = hash(await fs.readFile(absolute));
  else if (type === 'symlink') contentHash = hash(await fs.readlink(absolute));
  else if (type === 'directory') {
    const records = await treeRecords(absolute);
    contentHash = hash(stable(records));
    treeEntryCount = records.length;
  } else contentHash = hash(`${type}:${stat.rdev || 0}:${stat.size || 0}`);
  return {
    path: safePath,
    present: true,
    type,
    mode: stat.mode & 0o7777,
    hash: contentHash,
    ...(treeEntryCount === undefined ? {} : { treeEntryCount }),
  };
}

async function normalizedFilesystemMode(repoPath, options = {}) {
  if (options.probeFilesystemMode) return options.probeFilesystemMode(repoPath);
  const probeName = `.devrules-mode-probe.${process.pid}.${crypto.randomUUID()}`;
  const probePath = path.join(repoPath, probeName);
  const requestedModes = [0o600, 0o644, 0o755];
  const observedModes = [];
  try {
    await fs.writeFile(probePath, 'devrules filesystem mode probe\n', { mode: requestedModes[0] });
    for (const requestedMode of requestedModes) {
      await fs.chmod(probePath, requestedMode);
      observedModes.push((await fs.stat(probePath)).mode & 0o7777);
    }
    return new Set(observedModes).size === 1 ? observedModes[0] : null;
  } catch {
    return null;
  } finally {
    await fs.rm(probePath, { force: true }).catch(() => {});
    await removeUntrackedActionAppleDoubleArtifacts(repoPath, [`._${probeName}`], [], options).catch(() => {});
  }
}

async function buildReceipt(repoPath, inspection, options = {}) {
  const repo = await canonicalRepositoryPath(repoPath);
  const entries = await statusEntries(repo, options);
  const paths = [...new Set(entries.flatMap((entry) => [entry.path, entry.originalPath].filter(Boolean)))].sort((left, right) => left.localeCompare(right));
  const fingerprints = [];
  for (const relativePath of paths) fingerprints.push(await fingerprint(repo, relativePath));
  const receipt = {
    repoPath: repo,
    baseline: {
      head: String(inspection?.head || ''),
      branch: String(inspection?.branch || ''),
      upstream: String(inspection?.upstream || ''),
      upstreamSha: String(inspection?.upstreamSha || ''),
    },
    statusEntries: entries,
    fingerprints,
    recordedAt: timestamp(options),
  };
  return { ...receipt, digest: receiptDigest(receipt) };
}

async function persistState(statePath, state, options) {
  const output = {
    schemaVersion: PROJECT_STATE_SCHEMA_VERSION,
    kind: PROJECT_STATE_KIND,
    updatedAt: timestamp(options),
    repositories: [...state.repositories].sort((left, right) => left.repoPath.localeCompare(right.repoPath)),
    roundRobin: [...(state.roundRobin || [])].sort((left, right) => left.queueId.localeCompare(right.queueId)),
  };
  await atomicWriteFile(statePath, `${JSON.stringify(output, null, 2)}\n`, { mode: 0o600 });
  return output;
}

export async function verifyTemplateAutoUpdateProjectReceipt(repoPath, inspection, options = {}) {
  const loaded = await readState(options);
  if (!loaded.valid) return { eligible: false, statePath: loaded.statePath, reason: loaded.reason };
  const repo = await canonicalRepositoryPath(repoPath);
  const receipt = loaded.state.repositories.find((candidate) => candidate.repoPath === repo);
  if (!receipt) return { eligible: false, statePath: loaded.statePath, reason: 'dirty worktree has no updater-owned receipt' };
  let current;
  try {
    current = await buildReceipt(repo, inspection, { ...options, now: () => new Date(receipt.recordedAt) });
  } catch {
    return { eligible: false, statePath: loaded.statePath, reason: 'dirty worktree receipt fingerprints cannot be verified' };
  }
  const matches = receipt.repoPath === current.repoPath
    && stable(receipt.baseline) === stable(current.baseline)
    && stable(receipt.statusEntries) === stable(current.statusEntries)
    && stable(receipt.fingerprints) === stable(current.fingerprints);
  return {
    eligible: matches,
    statePath: loaded.statePath,
    reason: matches ? '' : 'dirty worktree no longer matches the updater-owned receipt',
    ownedPaths: matches
      ? [...new Set(receipt.statusEntries.flatMap((entry) => [entry.path, entry.originalPath].filter(Boolean)))]
      : [],
    ownedFingerprints: matches ? receipt.fingerprints : [],
  };
}

export async function recordTemplateAutoUpdateProjectReceipt(repoPath, inspection, options = {}) {
  const loaded = await readState(options);
  if (!loaded.valid) throw new Error(loaded.reason);
  const repo = await canonicalRepositoryPath(repoPath);
  const repositories = loaded.state.repositories.filter((receipt) => receipt.repoPath !== repo);
  const receipt = await buildReceipt(repo, inspection, options);
  const dirty = receipt.statusEntries.length > 0;
  if (dirty) {
    const allowedPaths = new Set((options.allowedPaths || []).map((entry) => safeRelativePath(entry)));
    const currentActionPaths = new Set((options.actionPaths || []).map((entry) => safeRelativePath(entry)));
    const unexpected = receipt.statusEntries
      .flatMap((entry) => [entry.path, entry.originalPath].filter(Boolean))
      .filter((entry) => !allowedPaths.has(entry));
    if (unexpected.length) {
      return { statePath: loaded.statePath, recorded: false, accepted: false,
        reason: 'post-mutation Git status contains paths not declared by updater actions' };
    }
    const expectedByPath = new Map((options.expectedFingerprints || []).map((entry) => [entry.path, entry]));
    const hasModeOnlyDifference = receipt.fingerprints.some((entry) => {
      const expected = expectedByPath.get(entry.path);
      if (!expected || stable(entry) === stable(expected) || !currentActionPaths.has(entry.path)) return false;
      const { mode: ignoredActualMode, ...actualWithoutMode } = entry;
      const { mode: ignoredExpectedMode, ...expectedWithoutMode } = expected;
      return stable(actualWithoutMode) === stable(expectedWithoutMode);
    });
    const normalizedMode = hasModeOnlyDifference ? await normalizedFilesystemMode(repo, options) : null;
    const mismatched = receipt.fingerprints.filter((entry) => {
      const expected = expectedByPath.get(entry.path);
      if (!expected) return true;
      if (stable(entry) === stable(expected)) return false;
      const { mode: ignoredActualMode, ...actualWithoutMode } = entry;
      const { mode: ignoredExpectedMode, ...expectedWithoutMode } = expected;
      return normalizedMode === null || entry.mode !== normalizedMode || !currentActionPaths.has(entry.path)
        || stable(actualWithoutMode) !== stable(expectedWithoutMode);
    });
    if (mismatched.length) {
      return { statePath: loaded.statePath, recorded: false, accepted: false,
        reason: 'post-mutation content, type, mode, hash, or presence does not match updater attestation' };
    }
    repositories.push(receipt);
  }
  const state = await persistState(loaded.statePath, { ...loaded.state, repositories }, options);
  return { statePath: loaded.statePath, recorded: dirty, accepted: true, reason: '', state };
}

export async function clearTemplateAutoUpdateProjectReceipt(repoPath, options = {}) {
  const loaded = await readState(options);
  if (!loaded.valid) return { statePath: loaded.statePath, cleared: false, reason: loaded.reason };
  const repo = await canonicalRepositoryPath(repoPath);
  const repositories = loaded.state.repositories.filter((receipt) => receipt.repoPath !== repo);
  if (repositories.length === loaded.state.repositories.length) return { statePath: loaded.statePath, cleared: false, reason: '' };
  await persistState(loaded.statePath, { ...loaded.state, repositories }, options);
  return { statePath: loaded.statePath, cleared: true, reason: '' };
}

export async function readTemplateAutoUpdateProjectState(options = {}) {
  const loaded = await readState(options);
  if (!loaded.valid) return { schemaVersion: PROJECT_STATE_SCHEMA_VERSION, kind: PROJECT_STATE_KIND,
    status: 'invalid', statePath: loaded.statePath, reason: loaded.reason, repositories: [] };
  return { ...loaded.state, status: 'valid', statePath: loaded.statePath };
}

export async function readTemplateAutoUpdateRoundRobin(queueId, options = {}) {
  const loaded = await readState(options);
  if (!loaded.valid) return { valid: false, statePath: loaded.statePath, reason: loaded.reason,
    cursor: { queueId: String(queueId || ''), lastWorkspaceId: '', workspaces: [] } };
  const cursor = loaded.state.roundRobin.find((entry) => entry.queueId === String(queueId || ''));
  return { valid: true, statePath: loaded.statePath, reason: '', cursor: cursor || {
    queueId: String(queueId || ''), lastWorkspaceId: '', workspaces: [],
  } };
}

export async function writeTemplateAutoUpdateRoundRobin(cursor, options = {}) {
  if (!validRoundRobin(cursor)) throw new Error('invalid project convergence round-robin cursor');
  const loaded = await readState(options);
  if (!loaded.valid) return { written: false, statePath: loaded.statePath, reason: loaded.reason };
  const roundRobin = loaded.state.roundRobin.filter((entry) => entry.queueId !== cursor.queueId);
  roundRobin.push(cursor);
  const state = await persistState(loaded.statePath, { ...loaded.state, roundRobin }, options);
  return { written: true, statePath: loaded.statePath, reason: '', state };
}
