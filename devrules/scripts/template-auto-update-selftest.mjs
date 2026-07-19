#!/usr/bin/env node
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

import {
  readTemplateAutoUpdateStatus,
  refreshInstalledAutoUpdateAgent,
  refreshInstalledMaintenanceAgent,
  runTemplateAutoUpdate,
} from './devrules-lib/template-auto-update-core.mjs';
import {
  cleanupTemplateAutoUpdateActionMetadata,
  readTemplateAutoUpdateProjectState,
} from './devrules-lib/template-auto-update-project-state.mjs';
import { registeredTemplateProjects, syncRegisteredTemplateProjects } from './devrules-lib/template-auto-update-projects.mjs';
import { inspectGitRepository } from './devrules-lib/git-repository.mjs';
import { expectedFileAfter } from './devrules-lib/fs-actions.mjs';
import {
  compareSemanticVersions,
  inspectRuntimeTemplateRelease,
  resolveTemplateAutoUpdateReleasesDirectory,
} from './devrules-lib/template-auto-update-release.mjs';

const execFileAsync = promisify(execFile);
async function run(command, args) {
  const result = await execFileAsync(command, args, { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, timeout: 60_000, windowsHide: true });
  return result.stdout.trim();
}
async function git(repo, ...args) { return run('git', ['-C', repo, ...args]); }
async function write(filePath, content) { await fs.mkdir(path.dirname(filePath), { recursive: true }); await fs.writeFile(filePath, content); }
async function writeJson(filePath, value) { await write(filePath, `${JSON.stringify(value, null, 2)}\n`); }
async function exists(filePath) { return fs.stat(filePath).then(() => true).catch(() => false); }
async function configure(repo) {
  await git(repo, 'config', 'user.name', 'template auto update selftest');
  await git(repo, 'config', 'user.email', 'template-auto-update@example.invalid');
}

async function publish(source, fixture, version, revision) {
  await writeJson(path.join(source, 'template.json'), { schemaVersion: 1, templateId: fixture.templateId, version, revision,
    sourceRepository: fixture.remote, gitHosting: { defaultBranch: 'main' } });
  await write(path.join(source, 'CHANGELOG.md'), `# Changelog\n\n## [${version}] - 2026-07-19\n`);
  await write(path.join(source, 'always-readme.md'), `# ${version}\n`);
  await write(path.join(source, 'rules/rule.md'), `# ${version}\n`);
  await write(path.join(source, 'scripts/devrules.mjs'), `const VERSION = '${version}';\n`);
  await git(source, 'add', '-A');
  await git(source, 'commit', '-m', `release ${version}`);
  await git(source, 'tag', '-a', `v${version}`, '-m', `v${version}`);
  await git(source, 'push', '-u', 'origin', 'main');
  await git(source, 'push', 'origin', `v${version}`);
}

async function fixture(root) {
  const value = { root, templateId: 'selftest/template-auto-update', deviceId: 'auto-update-device',
    remotePath: path.join(root, 'template.git'), source: path.join(root, 'source'), workspace: path.join(root, 'workspace'),
    releases: path.join(root, 'runtime/releases'), downloads: path.join(root, 'downloads') };
  value.remote = pathToFileURL(value.remotePath).href;
  value.currentRoot = path.join(value.releases, 'v3.3.0');
  await Promise.all([value.workspace, value.releases, value.downloads].map((directory) => fs.mkdir(directory, { recursive: true })));
  await run('git', ['init', '--bare', '--initial-branch=main', value.remotePath]);
  await git(value.remotePath, 'config', 'uploadpack.allowFilter', 'true');
  await run('git', ['init', '--initial-branch=main', value.source]);
  await configure(value.source); await git(value.source, 'remote', 'add', 'origin', value.remote);
  await publish(value.source, value, '3.3.0', 35);
  await run('git', ['clone', value.remote, value.currentRoot]);
  await publish(value.source, value, '3.4.0', 36);
  await git(value.source, 'tag', 'v9.0.0'); await git(value.source, 'push', 'origin', 'v9.0.0');
  await git(value.currentRoot, 'fetch', '--prune', '--tags', 'origin');
  value.projects = ['clean-init', 'clean-sync', 'dirty', 'behind', 'ahead', 'fetch-failed', 'audit-bad'].map((name) => path.join(value.workspace, name));
  for (const repo of value.projects) await fs.mkdir(repo, { recursive: true });
  for (const name of ['clean-sync', 'audit-bad']) {
    await write(path.join(value.workspace, name, 'devrules/always-readme.md'), '# adopted\n');
    await writeJson(path.join(value.workspace, name, 'devrules/manifest.json'), { schemaVersion: 1 });
  }
  value.runtimeConfig = path.join(root, 'device/runtime.json');
  value.statusPath = path.join(root, 'device/status.json'); value.lockPath = path.join(root, 'device/update.lock');
  value.projectStatePath = path.join(root, 'device/project-state.json');
  value.initializeCalls = []; value.syncCalls = []; value.inspectCalls = [];
  await writeJson(value.runtimeConfig, { schemaVersion: 1, templateRoot: value.currentRoot, workspaceRoots: [value.workspace] });
  return value;
}

function testReleaseDirectoryBoundaries(root) {
  const explicit = path.join(root, 'explicit-releases');
  assert.equal(resolveTemplateAutoUpdateReleasesDirectory(path.join(root, 'arbitrary', 'devrules'), explicit), path.resolve(explicit));
  assert.equal(
    resolveTemplateAutoUpdateReleasesDirectory(path.join(root, 'runtime', 'releases', 'v3.3.0')),
    path.join(root, 'runtime', 'releases'),
  );
  assert.throws(
    () => resolveTemplateAutoUpdateReleasesDirectory(path.join(root, 'arbitrary', 'devrules')),
    /pass --releases-dir explicitly/,
  );
}

function readyPreflight(repo) {
  const name = path.basename(repo);
  const common = { repo, fetch: { attempted: true, ok: true, error: '' }, branch: 'main', upstream: 'origin/main',
    upstreamRemote: 'origin', remoteTopologyValid: true, unborn: false,
    head: '1111111111111111111111111111111111111111', upstreamSha: '1111111111111111111111111111111111111111',
    detached: false, dirty: false, ahead: 0, behind: 0, state: 'ready', ready: true, reasons: [] };
  if (name === 'dirty') return { ...common, dirty: true, state: 'blocked', ready: false, reasons: ['worktree dirty'] };
  if (name === 'behind') return { ...common, behind: 1, state: 'blocked', ready: false, reasons: ['branch behind'] };
  if (name === 'ahead') return { ...common, ahead: 1, state: 'handoff-required', ready: false, reasons: ['branch ahead'] };
  if (name === 'fetch-failed') return { ...common,
    fetch: { attempted: true, ok: false, error: 'https://secret-token@example.invalid/private.git failed' },
    state: 'blocked', ready: false, reasons: ['fetch failed'] };
  return common;
}

function options(value, events = []) {
  const environment = { ...process.env, DEVRULES_DEVICE_ID: value.deviceId };
  delete environment.DEVRULES_TEMPLATE_ROOT; delete environment.DEVRULES_WORKSPACE_ROOTS; delete environment.DEVRULES_RUNTIME_CONFIG;
  return {
    env: environment,
    homeDir: path.join(value.root, 'home'),
    deviceId: value.deviceId,
    runtimeConfigPath: value.runtimeConfig,
    statusPath: value.statusPath,
    lockPath: value.lockPath,
    projectStatePath: value.projectStatePath,
    releasesDirectory: value.releases,
    temporaryDirectory: value.downloads,
    reconcileOwnership: true,
    discoverRepositories: async () => value.projects,
    isExactWorktree: async () => true,
    inspectRepository: async (repo, inspectOptions) => {
      value.inspectCalls.push({ repo, fetch: inspectOptions?.fetch === true });
      return readyPreflight(repo);
    },
    captureRepositoryState: async (repo) => readyPreflight(repo),
    readProjectStatus: async () => [],
    auditRepository: async (repo) => ({ issues: path.basename(repo) === 'audit-bad'
      ? [{ severity: 'error', message: 'fixture audit failure' }] : [] }),
    initializeRepository: async (repo, execution) => {
      value.initializeCalls.push({ repo, reconcileOwnership: execution.reconcileOwnership });
      await write(path.join(repo, '.initialized'), 'yes\n');
      return { actions: [{ action: 'copy' }] };
    },
    syncRepository: async (repo, execution) => {
      value.syncCalls.push({ repo, reconcileOwnership: execution.reconcileOwnership });
      await write(path.join(repo, '.synced'), 'yes\n');
      if (value.syncCalls.length === 2) return { blocked: true, partial: true, applied: true,
        actionSummary: { copy: 2 }, blockedModules: ['core-rules'] };
      return { blocked: false, actionSummary: { write: 1 } };
    },
    refreshGlobalAssets: async ({ templateRoot }) => { events.push(`global:${path.basename(templateRoot)}`); return { status: 'pass', actions: [] }; },
    refreshMaintenanceAgent: async ({ templateRoot }) => { events.push(`maintenance:${path.basename(templateRoot)}`); return { status: 'pass', scheduler: 'selftest', healthy: true, actions: [] }; },
    refreshAutoUpdateAgent: async ({ templateRoot }) => { events.push(`auto:${path.basename(templateRoot)}`); return { status: 'pass', scheduler: 'selftest', healthy: true, actions: [] }; },
  };
}

async function testCandidateAgentModuleRefresh(value) {
  const templateRoot = path.join(value.root, 'candidate-agent-module');
  const modulePath = path.join(templateRoot, 'scripts', 'devrules-lib', 'template-auto-update-agent.mjs');
  await write(modulePath, `export async function refreshInstalledTemplateAutoUpdateAgent() { return { status: 'pass', scheduler: 'candidate-module', healthy: true, actions: [] }; }\n`);
  const refreshed = await refreshInstalledAutoUpdateAgent(templateRoot, { configPath: value.runtimeConfig }, {
    platform: 'darwin',
    homeDir: path.join(value.root, 'candidate-agent-home'),
  });
  assert.equal(refreshed.status, 'pass');
  assert.equal(refreshed.scheduler, 'candidate-module', 'release activation loads the updater-agent refresher from the candidate release');

  const oldTemplateRoot = path.join(value.root, 'old-release-without-agent');
  await fs.mkdir(oldTemplateRoot, { recursive: true });
  const absent = await refreshInstalledAutoUpdateAgent(oldTemplateRoot, { configPath: value.runtimeConfig }, {
    platform: 'darwin',
    homeDir: path.join(value.root, 'old-agent-home'),
  });
  assert.equal(absent.status, 'skipped', 'an old release may omit the module only when no device scheduler is installed');
}

async function createProjectRepository(root, name) {
  const remote = path.join(root, `${name}.git`);
  const repo = path.join(root, name);
  await run('git', ['init', '--bare', '--initial-branch=main', remote]);
  await run('git', ['init', '--initial-branch=main', repo]);
  await configure(repo);
  await write(path.join(repo, 'README.md'), `# ${name}\n`);
  await git(repo, 'add', 'README.md');
  await git(repo, 'commit', '-m', 'initial project');
  await git(repo, 'remote', 'add', 'origin', remote);
  await git(repo, 'push', '-u', 'origin', 'main');
  return { repo, remote };
}

async function testOwnedDirtyReceipts(value, common) {
  const root = path.join(value.root, 'receipt-projects');
  await fs.mkdir(root, { recursive: true });
  const owned = await createProjectRepository(root, 'owned');
  const unknown = await createProjectRepository(root, 'unknown');
  const projectStatePath = path.join(value.root, 'device', 'owned-project-state.json');
  const statusPath = path.join(value.root, 'device', 'owned-status.json');
  const lockPath = path.join(value.root, 'device', 'owned-update.lock');
  const secret = 'super-secret-token-value';
  let syncCalls = 0;
  let syncMode = 'partial';
  const ownedOptions = {
    ...common,
    statusPath,
    lockPath,
    projectStatePath,
    discoverRepositories: async () => [owned.repo],
    isExactWorktree: undefined,
    inspectRepository: undefined,
    captureRepositoryState: undefined,
    readProjectStatus: undefined,
    auditRepository: undefined,
    initializeRepository: async (repo) => {
      const paths = [
        path.join(repo, 'devrules', 'always-readme.md'),
        path.join(repo, 'devrules', 'manifest.json'),
        path.join(repo, 'devrules', 'receipt-secret-fixture.txt'),
      ];
      const contents = ['# updater initialized\n', `${JSON.stringify({ schemaVersion: 1 }, null, 2)}\n`, `${secret}\n`];
      await write(paths[0], contents[0]);
      await write(paths[1], contents[1]);
      await write(paths[2], contents[2]);
      return { blocked: false, actions: paths.map((target, index) => ({
        action: 'copy', path: target, expectedAfter: expectedFileAfter(contents[index], 0o644),
      })) };
    },
    syncRepository: async (repo) => {
      syncCalls += 1;
      if (syncMode === 'partial') {
        const content = '# updater partial\n';
        await write(path.join(repo, 'devrules', 'always-readme.md'), content);
        return { blocked: true, partial: true, applied: true,
          actions: [{ action: 'write', path: path.join(repo, 'devrules', 'always-readme.md'), expectedAfter: expectedFileAfter(content, 0o644) }],
          actionSummary: { write: 1 }, blockedModules: ['core-rules'] };
      }
      return { blocked: false, actionSummary: {} };
    },
  };

  const ledgerBlocked = await createProjectRepository(root, 'ledger-blocked');
  const invalidLedgerPath = path.join(value.root, 'device', 'invalid-project-state.json');
  let ledgerBlockedInitializations = 0;
  await write(invalidLedgerPath, '{not-json\n');
  const invalidLedger = await runTemplateAutoUpdate({
    ...ownedOptions,
    apply: true,
    statusPath: path.join(value.root, 'device', 'invalid-ledger-status.json'),
    lockPath: path.join(value.root, 'device', 'invalid-ledger.lock'),
    projectStatePath: invalidLedgerPath,
    discoverRepositories: async () => [ledgerBlocked.repo],
    initializeRepository: async () => { ledgerBlockedInitializations += 1; return { actions: [] }; },
  });
  assert.equal(invalidLedger.status, 'failed');
  assert.match(invalidLedger.reason, /receipt ledger is invalid/);
  assert.equal(ledgerBlockedInitializations, 0, 'an invalid receipt ledger blocks every project write before mutation');

  await fs.rm(invalidLedgerPath);
  const externalLedgerCanary = path.join(value.root, 'external-ledger-canary.json');
  await write(externalLedgerCanary, 'external ledger canary\n');
  await fs.symlink(externalLedgerCanary, invalidLedgerPath);
  const symlinkLedger = await runTemplateAutoUpdate({
    ...ownedOptions,
    apply: true,
    statusPath: path.join(value.root, 'device', 'symlink-ledger-status.json'),
    lockPath: path.join(value.root, 'device', 'symlink-ledger.lock'),
    projectStatePath: invalidLedgerPath,
    discoverRepositories: async () => [ledgerBlocked.repo],
    initializeRepository: async () => { ledgerBlockedInitializations += 1; return { actions: [] }; },
  });
  assert.equal(symlinkLedger.status, 'failed');
  assert.match(symlinkLedger.reason, /not a regular file/);
  assert.equal((await fs.lstat(invalidLedgerPath)).isSymbolicLink(), true);
  assert.equal(await fs.readFile(externalLedgerCanary, 'utf8'), 'external ledger canary\n');
  assert.equal(ledgerBlockedInitializations, 0);
  await fs.rm(invalidLedgerPath);

  const initialized = await runTemplateAutoUpdate({ ...ownedOptions, apply: true });
  assert.equal(initialized.updateApplied, false, 'receipt fixture runs against the already-current release');
  assert.equal(initialized.projects.appliedCount, 1);
  assert.equal(initialized.projects.deferredCount, 0);
  let ledgerText = await fs.readFile(projectStatePath, 'utf8');
  const initialLedgerText = ledgerText;
  let ledger = JSON.parse(ledgerText);
  assert.equal(ledger.schemaVersion, 1);
  assert.equal(ledger.kind, 'devrules-template-auto-update-project-state');
  assert.equal(ledger.repositories.length, 1);
  assert.equal(ledger.repositories[0].repoPath, await fs.realpath(owned.repo));
  assert.equal(ledger.repositories[0].baseline.head, await git(owned.repo, 'rev-parse', 'HEAD'));
  assert.equal(ledger.repositories[0].baseline.upstream, 'origin/main');
  assert.equal(ledger.repositories[0].statusEntries.length > 0, true);
  assert.equal(ledger.repositories[0].fingerprints.every((entry) => entry.hash.startsWith('sha256:')), true);
  assert.doesNotMatch(ledgerText, new RegExp(secret));
  assert.equal((await fs.stat(projectStatePath)).mode & 0o777, 0o600);

  await writeJson(statusPath, { schemaVersion: 1, kind: 'fixture-status-overwrite' });
  assert.equal(await fs.readFile(projectStatePath, 'utf8'), initialLedgerText,
    'ordinary updater status persistence cannot overwrite the separate project receipt ledger');

  const continued = await runTemplateAutoUpdate({ ...ownedOptions, apply: true });
  assert.equal(continued.updateApplied, false);
  assert.equal(continued.projects.deferredCount, 1, 'an explicit partial result remains accounted as deferred');
  assert.equal(continued.projects.partialAppliedCount, 1);
  assert.equal(continued.projects.workspaces[0].projects[0].updaterOwnedDirty, true,
    'an exact updater-owned dirty worktree is eligible on the next current-version run');
  assert.equal(syncCalls, 1);
  ledgerText = await fs.readFile(projectStatePath, 'utf8');
  ledger = JSON.parse(ledgerText);
  assert.equal(ledger.repositories.length, 1, 'a partial updater mutation refreshes its receipt');
  assert.notEqual(ledger.repositories[0].digest, JSON.parse(initialLedgerText).repositories[0].digest);
  assert.doesNotMatch(ledgerText, new RegExp(secret));

  await fs.appendFile(path.join(owned.repo, 'devrules', 'always-readme.md'), 'x');
  const humanEdited = await runTemplateAutoUpdate({ ...ownedOptions, apply: true });
  assert.equal(humanEdited.projects.deferredCount, 1);
  assert.match(humanEdited.projects.workspaces[0].projects[0].reason, /no longer matches/);
  assert.equal(syncCalls, 1, 'a one-byte human edit invalidates the receipt before synchronization');

  await write(path.join(unknown.repo, 'human-note.txt'), 'unreceipted edit\n');
  let unknownInitializations = 0;
  const unknownDirty = await runTemplateAutoUpdate({ ...ownedOptions, apply: true,
    discoverRepositories: async () => [unknown.repo],
    initializeRepository: async () => { unknownInitializations += 1; return { actions: [{ action: 'copy' }] }; },
  });
  assert.equal(unknownDirty.projects.deferredCount, 1);
  assert.match(unknownDirty.projects.workspaces[0].projects[0].reason, /no updater-owned receipt/);
  assert.equal(unknownInitializations, 0, 'unknown dirty worktrees fail closed');

  const failedInit = await createProjectRepository(root, 'failed-init');
  let initRepair = false;
  const failedInitOptions = {
    ...ownedOptions,
    discoverRepositories: async () => [failedInit.repo],
    initializeRepository: async (repo) => {
      const always = path.join(repo, 'devrules', 'always-readme.md');
      if (!initRepair) {
        const content = '# interrupted initialization\n';
        await write(always, content);
        const error = new Error('fixture initialization interruption');
        error.actions = [{ action: 'copy', path: always, expectedAfter: expectedFileAfter(content, 0o644) }];
        throw error;
      }
      const manifest = path.join(repo, 'devrules', 'manifest.json');
      const content = `${JSON.stringify({ schemaVersion: 1 }, null, 2)}\n`;
      await write(manifest, content);
      return { actions: [{ action: 'copy', path: manifest, expectedAfter: expectedFileAfter(content, 0o644) }] };
    },
  };
  const interruptedInit = await runTemplateAutoUpdate({ ...failedInitOptions, apply: true });
  assert.equal(interruptedInit.projects.deferredCount, 1);
  assert.equal(interruptedInit.projects.partialAppliedCount, 1);
  assert.equal(interruptedInit.projects.workspaces[0].projects[0].receiptRecorded, true,
    'an interrupted mutation is receipted only from its explicit error actions');
  initRepair = true;
  const repairedInit = await runTemplateAutoUpdate({ ...failedInitOptions, apply: true });
  assert.equal(repairedInit.projects.appliedCount, 1);
  assert.equal(repairedInit.projects.workspaces[0].projects[0].updaterOwnedDirty, true,
    'an exactly receipted incomplete devrules instance can resume idempotent initialization');

  const failedSync = await createProjectRepository(root, 'failed-sync');
  await write(path.join(failedSync.repo, 'devrules', 'always-readme.md'), '# adopted\n');
  await writeJson(path.join(failedSync.repo, 'devrules', 'manifest.json'), { schemaVersion: 1 });
  await git(failedSync.repo, 'add', '-A'); await git(failedSync.repo, 'commit', '-m', 'adopt devrules');
  await git(failedSync.repo, 'push', 'origin', 'main');
  let syncRepair = false;
  const failedSyncOptions = {
    ...ownedOptions,
    discoverRepositories: async () => [failedSync.repo],
    syncRepository: async (repo) => {
      if (!syncRepair) {
        const always = path.join(repo, 'devrules', 'always-readme.md');
        const content = '# interrupted synchronization\n';
        await write(always, content);
        const error = new Error('fixture synchronization interruption');
        error.actions = [{ action: 'write', path: always, expectedAfter: expectedFileAfter(content, 0o644) }];
        throw error;
      }
      return { blocked: false, actions: [], actionSummary: {} };
    },
  };
  const interruptedSync = await runTemplateAutoUpdate({ ...failedSyncOptions, apply: true });
  assert.equal(interruptedSync.projects.partialAppliedCount, 1);
  assert.equal(interruptedSync.projects.workspaces[0].projects[0].receiptRecorded, true);
  syncRepair = true;
  const repairedSync = await runTemplateAutoUpdate({ ...failedSyncOptions, apply: true });
  assert.equal(repairedSync.projects.currentCount, 1);
  assert.equal(repairedSync.projects.workspaces[0].projects[0].updaterOwnedDirty, true);

  const raced = await createProjectRepository(root, 'raced');
  await write(path.join(raced.repo, 'devrules', 'always-readme.md'), '# adopted\n');
  await writeJson(path.join(raced.repo, 'devrules', 'manifest.json'), { schemaVersion: 1 });
  await git(raced.repo, 'add', '-A'); await git(raced.repo, 'commit', '-m', 'adopt devrules');
  await git(raced.repo, 'push', 'origin', 'main');
  let racedSyncCalls = 0;
  const racedOptions = {
    ...ownedOptions,
    discoverRepositories: async () => [raced.repo],
    syncRepository: async (repo) => {
      racedSyncCalls += 1;
      const managed = path.join(repo, 'devrules', 'always-readme.md');
      const content = '# updater change\n';
      await write(managed, content);
      await write(path.join(repo, 'unrelated-human-file.txt'), 'concurrent human content\n');
      return { blocked: false,
        actions: [{ action: 'write', path: managed, expectedAfter: expectedFileAfter(content, 0o644) }],
        actionSummary: { write: 1 } };
    },
  };
  const racedRun = await runTemplateAutoUpdate({ ...racedOptions, apply: true });
  assert.equal(racedRun.projects.deferredCount, 1);
  assert.equal(racedRun.projects.workspaces[0].projects[0].partialApplied, true);
  assert.match(racedRun.projects.workspaces[0].projects[0].reason, /not declared by updater actions/);
  const racedRetry = await runTemplateAutoUpdate({ ...racedOptions, apply: true });
  assert.equal(racedRetry.projects.deferredCount, 1);
  assert.match(racedRetry.projects.workspaces[0].projects[0].reason, /no updater-owned receipt/);
  assert.equal(racedSyncCalls, 1, 'an unrelated concurrent dirty path is never signed into a usable receipt');

  const samePathRace = await createProjectRepository(root, 'same-path-race');
  await write(path.join(samePathRace.repo, 'devrules', 'always-readme.md'), '# adopted\n');
  await writeJson(path.join(samePathRace.repo, 'devrules', 'manifest.json'), { schemaVersion: 1 });
  await git(samePathRace.repo, 'add', '-A'); await git(samePathRace.repo, 'commit', '-m', 'adopt devrules');
  await git(samePathRace.repo, 'push', 'origin', 'main');
  let injectSamePathEdit = true;
  const samePathOptions = {
    ...ownedOptions,
    discoverRepositories: async () => [samePathRace.repo],
    syncRepository: async (repo) => {
      const managed = path.join(repo, 'devrules', 'always-readme.md');
      const content = '# updater attested content\n';
      await write(managed, content);
      return { blocked: false,
        actions: [{ action: 'write', path: managed, expectedAfter: expectedFileAfter(content, 0o644) }],
        actionSummary: { write: 1 } };
    },
    captureRepositoryState: async (repo, captureOptions) => {
      if (injectSamePathEdit) {
        injectSamePathEdit = false;
        await fs.appendFile(path.join(repo, 'devrules', 'always-readme.md'), 'x');
      }
      return inspectGitRepository(repo, captureOptions);
    },
  };
  const samePathRejected = await runTemplateAutoUpdate({ ...samePathOptions, apply: true });
  assert.equal(samePathRejected.projects.deferredCount, 1);
  assert.match(samePathRejected.projects.workspaces[0].projects[0].reason, /does not match updater attestation/,
    'a one-byte same-path edit after updater mutation but before receipt signing is rejected');

  const metadataNormalized = await createProjectRepository(root, 'metadata-normalized');
  const metadataStatePath = path.join(value.root, 'device', 'metadata-project-state.json');
  const metadataSidecar = path.join(metadataNormalized.repo, 'devrules', '._always-readme.md');
  const worktreeMetadataSidecar = path.join(metadataNormalized.repo, '._.git');
  const gitMetadataSidecar = path.join(metadataNormalized.repo, '.git', 'objects', 'pack', '._updater-fixture.idx');
  const syncMetadataSidecar = path.join(metadataNormalized.repo, '.git', 'devrules-sync', 'fixture', '._journal.json');
  await write(worktreeMetadataSidecar, Buffer.from([0x00, 0x05, 0x16, 0x07, 0x00, 0x02, 0x00, 0x00]));
  await write(gitMetadataSidecar, Buffer.from([0x00, 0x05, 0x16, 0x07, 0x00, 0x02, 0x00, 0x00]));
  await write(syncMetadataSidecar, Buffer.from([0x00, 0x05, 0x16, 0x07, 0x00, 0x02, 0x00, 0x00]));
  const metadataRun = await runTemplateAutoUpdate({
    ...ownedOptions,
    apply: true,
    platform: 'darwin',
    probeFilesystemMode: async () => 0o600,
    statusPath: path.join(value.root, 'device', 'metadata-status.json'),
    lockPath: path.join(value.root, 'device', 'metadata.lock'),
    projectStatePath: metadataStatePath,
    discoverRepositories: async () => [metadataNormalized.repo],
    initializeRepository: async (repo) => {
      const always = path.join(repo, 'devrules', 'always-readme.md');
      const manifest = path.join(repo, 'devrules', 'manifest.json');
      const alwaysContent = '# metadata-normalized updater\n';
      const manifestContent = `${JSON.stringify({ schemaVersion: 1 }, null, 2)}\n`;
      await write(always, alwaysContent);
      await fs.chmod(always, 0o600);
      await write(manifest, manifestContent);
      await fs.writeFile(metadataSidecar, Buffer.from([0x00, 0x05, 0x16, 0x07, 0x00, 0x02, 0x00, 0x00]));
      await fs.writeFile(worktreeMetadataSidecar, Buffer.from([0x00, 0x05, 0x16, 0x07, 0x00, 0x02, 0x00, 0x00]));
      await write(syncMetadataSidecar, Buffer.from([0x00, 0x05, 0x16, 0x07, 0x00, 0x02, 0x00, 0x00]));
      return { blocked: false, actions: [
        { action: 'copy', path: always, expectedAfter: expectedFileAfter(alwaysContent, 0o644) },
        { action: 'copy', path: manifest, expectedAfter: expectedFileAfter(manifestContent, 0o644) },
      ] };
    },
  });
  assert.equal(metadataRun.projects.appliedCount, 1,
    `filesystem-normalized modes do not reject otherwise exact updater content: ${JSON.stringify(metadataRun.projects.workspaces[0]?.projects[0])}`);
  assert.equal(await exists(metadataSidecar), false,
    'an untracked AppleDouble sidecar derived from an updater action is removed before receipt signing');
  assert.equal(await exists(worktreeMetadataSidecar), false,
    'an untracked AppleDouble sidecar for the verified worktree Git entry is removed before receipt signing');
  assert.equal(await exists(gitMetadataSidecar), false,
    'AppleDouble metadata inside the Git object database is removed before repository inspection');
  assert.equal(await exists(syncMetadataSidecar), false,
    'AppleDouble metadata inside verified devrules transaction storage is removed before repository inspection');
  const metadataLedger = await readTemplateAutoUpdateProjectState({ projectStatePath: metadataStatePath });
  assert.equal(metadataLedger.repositories.length, 1);
  assert.equal(metadataLedger.repositories[0].statusEntries.some((entry) => entry.path.includes('._')), false);

  const modeRace = await createProjectRepository(root, 'mode-race');
  await git(modeRace.repo, 'config', 'core.fileMode', 'false');
  const modeRaceRun = await runTemplateAutoUpdate({
    ...ownedOptions,
    apply: true,
    probeFilesystemMode: async () => null,
    statusPath: path.join(value.root, 'device', 'mode-race-status.json'),
    lockPath: path.join(value.root, 'device', 'mode-race.lock'),
    projectStatePath: path.join(value.root, 'device', 'mode-race-state.json'),
    discoverRepositories: async () => [modeRace.repo],
    initializeRepository: async (repo) => {
      const always = path.join(repo, 'devrules', 'always-readme.md');
      const manifest = path.join(repo, 'devrules', 'manifest.json');
      const alwaysContent = '# mode race\n';
      const manifestContent = `${JSON.stringify({ schemaVersion: 1 }, null, 2)}\n`;
      await write(always, alwaysContent);
      await fs.chmod(always, 0o600);
      await write(manifest, manifestContent);
      return { blocked: false, actions: [
        { action: 'copy', path: always, expectedAfter: expectedFileAfter(alwaysContent, 0o644) },
        { action: 'copy', path: manifest, expectedAfter: expectedFileAfter(manifestContent, 0o644) },
      ] };
    },
  });
  assert.equal(modeRaceRun.projects.deferredCount, 1);
  assert.match(modeRaceRun.projects.workspaces[0].projects[0].reason, /does not match updater attestation/,
    'core.fileMode=false alone never authorizes a mode-only concurrent edit');

  const untrustedGitPointer = path.join(root, 'untrusted-git-pointer');
  const externalGitDirectory = path.join(root, 'external-git-directory');
  const externalAppleDouble = path.join(externalGitDirectory, 'objects', 'pack', '._outside.idx');
  await write(path.join(externalGitDirectory, 'HEAD'), 'ref: refs/heads/main\n');
  await write(externalAppleDouble, Buffer.from([0x00, 0x05, 0x16, 0x07, 0x00, 0x02, 0x00, 0x00]));
  await write(path.join(untrustedGitPointer, '.git'), `gitdir: ${externalGitDirectory}\n`);
  const untrustedInspection = await inspectGitRepository(untrustedGitPointer, {
    cleanupAppleDouble: true,
    platform: 'darwin',
  });
  assert.equal(untrustedInspection.ready, false);
  assert.equal(await exists(externalAppleDouble), true,
    'an unverified .git file cannot redirect AppleDouble cleanup outside the requested repository');
  const untrustedWorktreeSidecar = path.join(untrustedGitPointer, '._.git');
  await write(untrustedWorktreeSidecar, Buffer.from([0x00, 0x05, 0x16, 0x07, 0x00, 0x02, 0x00, 0x00]));
  await assert.rejects(
    cleanupTemplateAutoUpdateActionMetadata(untrustedGitPointer, [
      { action: 'write', path: path.join(untrustedGitPointer, 'devrules', 'always-readme.md') },
    ], { platform: 'darwin' }),
    /exact verified Git worktree root/,
  );
  assert.equal(await exists(untrustedWorktreeSidecar), true,
    'action cleanup cannot remove a worktree entry sidecar before Git verifies the exact repository root');

  const trackedSidecarProject = await createProjectRepository(root, 'tracked-worktree-sidecar');
  const trackedWorktreeSidecar = path.join(trackedSidecarProject.repo, '._.git');
  await write(trackedWorktreeSidecar, Buffer.from([0x00, 0x05, 0x16, 0x07, 0x00, 0x02, 0x00, 0x00]));
  await git(trackedSidecarProject.repo, 'add', '._.git');
  await git(trackedSidecarProject.repo, 'commit', '-m', 'track worktree entry sidecar fixture');
  await git(trackedSidecarProject.repo, 'push', 'origin', 'main');
  const trackedSidecarInspection = await inspectGitRepository(trackedSidecarProject.repo, {
    cleanupAppleDouble: true,
    platform: 'darwin',
  });
  assert.equal(trackedSidecarInspection.dirty, false);
  assert.equal(await exists(trackedWorktreeSidecar), true,
    'a tracked worktree entry sidecar remains project-owned even when its bytes match AppleDouble magic');

  await git(owned.repo, 'add', '-A');
  await git(owned.repo, 'commit', '-m', 'accept updater changes');
  await git(owned.repo, 'push', 'origin', 'main');
  syncMode = 'current';
  const committed = await runTemplateAutoUpdate({ ...ownedOptions, apply: true });
  assert.equal(committed.projects.currentCount, 1);
  assert.equal(committed.projects.deferredCount, 0);
  const cleared = await readTemplateAutoUpdateProjectState({ projectStatePath });
  assert.equal(cleared.status, 'valid');
  const ownedRealpath = await fs.realpath(owned.repo);
  assert.equal(cleared.repositories.some((receipt) => receipt.repoPath === ownedRealpath), false,
    'a clean fetched repository clears its stale updater receipt');
}

async function testProjectDiscoveryBoundaries(value, common) {
  const workspace = path.join(value.root, 'discovery-workspace');
  await fs.mkdir(workspace, { recursive: true });
  const direct = await createProjectRepository(workspace, 'direct-project');
  await fs.mkdir(path.join(workspace, 'container'), { recursive: true });
  const nested = await createProjectRepository(path.join(workspace, 'container'), 'nested-project');
  const migrated = await createProjectRepository(path.join(workspace, '.migration'), 'migrated-project');
  const backup = await createProjectRepository(path.join(workspace, '.backup'), 'backup-project');
  const templateClone = await createProjectRepository(workspace, 'template-source-clone');
  await writeJson(path.join(templateClone.repo, 'template.json'), { schemaVersion: 1, templateId: value.templateId,
    version: '1.0.0', revision: 1, sourceRepository: value.remote });
  await git(templateClone.repo, 'add', 'template.json');
  await git(templateClone.repo, 'commit', '-m', 'declare shared template identity');
  await git(templateClone.repo, 'push', 'origin', 'main');
  await fs.symlink(value.currentRoot, path.join(workspace, 'shared-template'));
  await fs.symlink(direct.repo, path.join(workspace, 'direct-project-alias'));
  const registration = await registeredTemplateProjects({
    templateRoot: value.currentRoot,
    templateRealpath: await fs.realpath(value.currentRoot),
    templateId: value.templateId,
    deviceId: value.deviceId,
    runtimeWorkspaceRoots: [workspace],
  });
  assert.deepEqual(registration.workspaces[0].projects.map((project) => project.path), [await fs.realpath(direct.repo)],
    'default discovery enrolls only direct independent worktrees and excludes nested migration, backup, and template roots');
  assert.equal(registration.workspaces[0].projects.some((project) => [nested.repo, migrated.repo, backup.repo].includes(project.path)), false);
  assert.equal(registration.workspaces[0].discoveryExclusions.some((entry) => /escapes/.test(entry.reason)), true,
    'symlinked worktrees outside the workspace are visibly excluded from the write boundary');
  assert.equal(registration.workspaces[0].discoveryExclusions.some((entry) => /duplicate canonical/.test(entry.reason)), true,
    'canonical realpath dedupe prevents a symlink alias from being managed twice');
  assert.equal(registration.workspaces[0].discoveryExclusions.some((entry) => entry.path === templateClone.repo
    && /shared template identity/.test(entry.reason)), true,
  'an independent clone of the shared template control plane is never initialized as a product project');
  assert.equal(registration.discoveryExcludedCount, registration.workspaces[0].discoveryExclusions.length);

  const discoveryFailed = await runTemplateAutoUpdate({
    ...common,
    apply: true,
    statusPath: path.join(value.root, 'device', 'discovery-error-status.json'),
    lockPath: path.join(value.root, 'device', 'discovery-error.lock'),
    discoverRepositories: async () => { const error = new Error('fixture readdir failure'); error.code = 'EACCES'; throw error; },
  });
  assert.equal(discoveryFailed.status, 'failed');
  assert.equal(discoveryFailed.projects.discoveredCount, 0);
  assert.equal(discoveryFailed.projects.deferredWorkspaceCount, 1);
  assert.equal(discoveryFailed.projects.workspaces[0].available, false,
    'workspace discovery failures are explicit unavailable/deferred state, never zero-project success');

  const isolatedRoot = path.join(value.root, 'isolated-preflight-projects');
  const isolatedProjects = ['inspect-fails', 'sha-missing', 'sha-mismatch', 'continues']
    .map((name) => path.join(isolatedRoot, name));
  await Promise.all(isolatedProjects.map((repo) => fs.mkdir(repo, { recursive: true })));
  const initializedAfterFailure = [];
  const isolated = await syncRegisteredTemplateProjects({
    deviceId: value.deviceId,
    templateId: value.templateId,
    projectCount: 4,
    workspaces: [{ workspaceId: 'isolated', path: isolatedRoot, available: true,
      projects: isolatedProjects.map((repo) => ({ name: path.basename(repo), path: repo, enrolled: true })) }],
  }, {
    templateRoot: value.currentRoot,
    projectStatePath: path.join(value.root, 'device', 'isolated-project-state.json'),
    isExactWorktree: async () => true,
    inspectRepository: async (repo) => {
      if (path.basename(repo) === 'inspect-fails') throw new Error('sensitive fixture transport detail');
      if (path.basename(repo) === 'sha-missing') return { ...readyPreflight(repo), upstreamSha: '' };
      if (path.basename(repo) === 'sha-mismatch') return { ...readyPreflight(repo), upstreamSha: '2222222222222222222222222222222222222222' };
      return readyPreflight(repo);
    },
    captureRepositoryState: async (repo) => readyPreflight(repo),
    readProjectStatus: async () => [],
    initializeRepository: async (repo) => { initializedAfterFailure.push(path.basename(repo)); return { actions: [] }; },
  });
  assert.equal(isolated.deferredCount, 3);
  assert.equal(isolated.appliedCount, 1);
  assert.equal(isolated.discoveredCount, isolated.appliedCount + isolated.currentCount + isolated.deferredCount);
  assert.deepEqual(initializedAfterFailure, ['continues'],
    'inspect failures and unproven upstream SHA equality never authorize writes or abort later projects');
  assert.doesNotMatch(JSON.stringify(isolated), /sensitive fixture transport detail/);

  const budgetRoot = path.join(value.root, 'budget-projects');
  const budgetProjects = [path.join(budgetRoot, 'one'), path.join(budgetRoot, 'two'), path.join(budgetRoot, 'three')];
  await Promise.all(budgetProjects.map((repo) => fs.mkdir(repo, { recursive: true })));
  const attempted = [];
  const budgetRegistration = {
    deviceId: value.deviceId,
    projectCount: 3,
    workspaces: [{ workspaceId: 'budget', path: budgetRoot, available: true,
      projects: budgetProjects.map((repo) => ({ name: path.basename(repo), path: repo, enrolled: true })) }],
  };
  const budgetStatePath = path.join(value.root, 'device', 'budget-project-state.json');
  for (let round = 0; round < 3; round += 1) {
    let elapsed = 0;
    const budgeted = await syncRegisteredTemplateProjects(budgetRegistration, {
      templateRoot: value.currentRoot,
      projectStatePath: budgetStatePath,
      projectRoundBudgetMs: 50,
      clockMs: () => elapsed,
      isExactWorktree: async () => true,
      inspectRepository: async (repo) => readyPreflight(repo),
      captureRepositoryState: async (repo) => readyPreflight(repo),
      readProjectStatus: async () => [],
      initializeRepository: async (repo) => { attempted.push(path.basename(repo)); elapsed = 100; return { actions: [] }; },
    });
    assert.equal(budgeted.workspaces[0].projects.some((project) => /round budget exhausted/.test(project.reason)), true);
  }
  assert.equal(new Set(attempted).size, 3,
    'the persisted round-robin cursor prevents tail projects from starving across consecutive small-budget rounds');
}

async function test(value) {
  const events = [], common = options(value, events);
  const originBefore = await git(value.currentRoot, 'rev-parse', 'origin/main');
  assert.notEqual(await git(value.currentRoot, 'rev-parse', 'HEAD'), originBefore,
    'the active runtime fixture remains at the older release while origin/main advances');
  assert.equal(await git(value.currentRoot, 'symbolic-ref', '-q', 'HEAD'), 'refs/heads/main',
    'an attached old tagged runtime remains a valid published release');
  const dryRun = await runTemplateAutoUpdate({ ...common, apply: false });
  assert.equal(dryRun.status, 'update-available');
  assert.equal(dryRun.releases.candidate.version, '3.4.0');
  assert.deepEqual(dryRun.releases.blockedMajor, []);
  assert.equal(dryRun.releases.rejected.some((item) => item.tag === 'v9.0.0'), true);
  assert.equal(dryRun.policy.reconcileOwnership, true);
  assert.equal(dryRun.projects.enrolledWorkspaceCount, 1, 'runtime workspace roots are enrolled without a registry');
  assert.equal(dryRun.projects.discoveredCount, 7);
  assert.equal(dryRun.projects.uncheckedCount, 7);
  assert.equal(dryRun.projects.deferredCount, 0);
  assert.equal(dryRun.projects.workspaces[0].projects.every((project) => project.status === 'unchecked'), true);
  assert.equal(await exists(path.join(value.releases, 'v3.4.0')), false);
  assert.equal(await exists(value.statusPath), false);
  assert.deepEqual(await fs.readdir(value.downloads), []);
  assert.equal(await git(value.currentRoot, 'rev-parse', 'origin/main'), originBefore, 'dry-run does not mutate active release refs');

  await write(value.lockPath, 'held\n');
  assert.equal((await runTemplateAutoUpdate({ ...common, apply: true })).status, 'locked');
  await fs.rm(value.lockPath);

  const liveLock = { schemaVersion: 2, token: crypto.randomUUID(), pid: process.pid, createdAt: new Date().toISOString() };
  await writeJson(value.lockPath, liveLock);
  assert.equal((await runTemplateAutoUpdate({ ...common, apply: true })).status, 'locked');
  assert.equal(await exists(value.lockPath), true, 'a valid live-owner lock is preserved');
  await fs.rm(value.lockPath);

  await writeJson(value.lockPath, { ...liveLock, token: crypto.randomUUID(), pid: 2_147_483_647 });

  const applied = await runTemplateAutoUpdate({ ...common, apply: true });
  assert.equal(applied.status, 'deferred');
  assert.equal(applied.projects.discoveredCount, 7);
  assert.equal(applied.projects.appliedCount, 2);
  assert.equal(applied.projects.currentCount, 0);
  assert.equal(applied.projects.deferredCount, 5);
  assert.equal(applied.projects.discoveredCount, applied.projects.appliedCount + applied.projects.currentCount + applied.projects.deferredCount);
  const states = new Map(applied.projects.workspaces[0].projects.map((project) => [project.name, project.status]));
  assert.equal(states.get('clean-init'), 'applied'); assert.equal(states.get('clean-sync'), 'applied');
  for (const name of ['dirty', 'behind', 'ahead', 'fetch-failed', 'audit-bad']) assert.equal(states.get(name), 'deferred');
  const fetchFailure = applied.projects.workspaces[0].projects.find((project) => project.name === 'fetch-failed');
  assert.doesNotMatch(JSON.stringify(fetchFailure), /secret-token/);
  assert.match(fetchFailure.preflight.fetch.error, /details omitted/);
  const runtime = JSON.parse(await fs.readFile(value.runtimeConfig, 'utf8'));
  assert.equal(runtime.templateRoot, path.join(value.releases, 'v3.4.0'));
  assert.equal(await exists(value.lockPath), false, 'a valid abandoned-owner lock is recovered before the updater acquires it once');
  assert.deepEqual(events, ['global:v3.4.0', 'maintenance:v3.4.0', 'auto:v3.4.0']);
  assert.equal(await git(runtime.templateRoot, 'rev-parse', 'HEAD'), applied.releases.candidate.commit);
  assert.doesNotMatch(
    await git(runtime.templateRoot, 'rev-list', '--objects', '--missing=print', '--all'),
    /^\?/m,
    'installed releases must contain every reachable object so project convergence never depends on lazy network fetches',
  );
  await assert.rejects(git(runtime.templateRoot, 'symbolic-ref', '-q', 'HEAD'));
  assert.equal(await git(runtime.templateRoot, 'remote', 'get-url', 'origin'), value.remote);
  assert.equal((await readTemplateAutoUpdateStatus({ statusPath: value.statusPath })).status, 'deferred');
  assert.equal(value.initializeCalls.length, 1); assert.equal(value.syncCalls.length, 1);
  for (const name of ['clean-init', 'clean-sync']) {
    const calls = value.inspectCalls.filter((call) => path.basename(call.repo) === name);
    assert.equal(calls.length, 2, `${name} must be fetched initially and immediately before mutation`);
    assert.equal(calls.every((call) => call.fetch), true);
  }
  assert.equal(value.initializeCalls.every((call) => call.reconcileOwnership === true), true);
  assert.equal(value.syncCalls.every((call) => call.reconcileOwnership === true), true);

  await testOwnedDirtyReceipts(value, common);
  await testProjectDiscoveryBoundaries(value, common);
  await testCandidateAgentModuleRefresh(value);

  const retried = await runTemplateAutoUpdate({ ...common, apply: true });
  assert.equal(retried.status, 'failed');
  assert.equal(retried.updateApplied, false, 'project convergence retries even when the runtime release is current');
  assert.equal(retried.releases.candidate, null);
  assert.equal(retried.projects.discoveredCount, 7);
  assert.equal(retried.projects.appliedCount, 1);
  assert.equal(retried.projects.deferredCount, 6);
  const retryProjects = new Map(retried.projects.workspaces[0].projects.map((project) => [project.name, project]));
  assert.equal(retryProjects.get('clean-sync').status, 'deferred');
  assert.equal(retryProjects.get('clean-sync').partialApplied, true);
  assert.deepEqual(retryProjects.get('clean-sync').actionSummary, { copy: 2 });
  assert.deepEqual(retryProjects.get('clean-sync').blockedModules, ['core-rules']);
  assert.equal(value.initializeCalls.length, 2); assert.equal(value.syncCalls.length, 2);
  assert.equal(value.initializeCalls.every((call) => call.reconcileOwnership === true), true);
  assert.equal(value.syncCalls.every((call) => call.reconcileOwnership === true), true);

  await publish(value.source, value, '4.0.0', 37);

  const majorBlocked = await runTemplateAutoUpdate({ ...common, apply: false });
  assert.equal(majorBlocked.status, 'blocked-major');
  const majorAllowed = await runTemplateAutoUpdate({ ...common, apply: false, allowMajor: true });
  assert.equal(majorAllowed.status, 'update-available'); assert.equal(majorAllowed.releases.candidate.version, '4.0.0');

  await writeJson(value.runtimeConfig, { schemaVersion: 1, templateRoot: value.currentRoot, workspaceRoots: [value.workspace] });
  const failed = await runTemplateAutoUpdate({ ...common, apply: true,
    refreshGlobalAssets: async ({ templateRoot }) => {
      if (path.basename(templateRoot) === 'v3.4.0') throw new Error('fixture activation failure');
      return { status: 'pass', actions: [] };
    },
    refreshMaintenanceAgent: async () => ({ status: 'pass', scheduler: 'selftest', healthy: true, actions: [] }),
  });
  assert.equal(failed.status, 'failed');
  assert.equal(failed.activation.rollback.runtime, true); assert.equal(failed.activation.rollback.deviceSurfaces, true);
  assert.equal(JSON.parse(await fs.readFile(value.runtimeConfig, 'utf8')).templateRoot, value.currentRoot);

  const maintenance = await refreshInstalledMaintenanceAgent(value.currentRoot,
    { configPath: value.runtimeConfig }, {
      queryMaintenanceAgentStatus: async () => ({ installed: false, scheduler: 'selftest' }),
      ensureMaintenanceAgent: async () => { throw new Error('must not opt in an absent maintenance agent'); },
    });
  assert.equal(maintenance.status, 'skipped');
  assert.match(maintenance.reason, /not installed/);
}

async function testRemoteQueryFailure(value) {
  const offline = path.join(value.root, 'offline-runtime');
  await run('git', ['clone', value.remote, offline]);
  await git(offline, 'checkout', '--detach', 'v3.3.0');
  await git(offline, 'remote', 'set-url', 'origin', 'https://127.0.0.1:1/unavailable.git');
  await assert.rejects(
    inspectRuntimeTemplateRelease(offline, { verifyRemote: true }),
    /remote release-tag query failed/,
  );
}

async function main() {
  assert(compareSemanticVersions('3.4.0', '3.3.9') > 0); assert(compareSemanticVersions('4.0.0-beta.1', '4.0.0') < 0);
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'devrules-template-auto-update-selftest-'));
  try {
    testReleaseDirectoryBoundaries(root);
    const value = await fixture(root);
    await test(value);
    await testRemoteQueryFailure(value);
    process.stdout.write('template-auto-update selftest: PASS\n');
  }
  finally { await fs.rm(root, { recursive: true, force: true }); }
}
main().catch((error) => { process.stderr.write(`template-auto-update selftest: FAIL\n${error.stack || error.message}\n`); process.exitCode = 1; });
