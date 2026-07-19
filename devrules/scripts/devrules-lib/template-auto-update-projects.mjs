import fs from 'node:fs/promises';
import path from 'node:path';

import { currentDeviceId, mergeRegistryAuthorityRecords, workspaceRecordsForDevice } from './device-registry.mjs';
import { inspectGitRepository, isExactGitWorktree } from './git-repository.mjs';
import { refreshConfiguredEntryFiles } from './instance-bootstrap.mjs';
import { declaresTemplateIdentity, isGitRepo } from './repo-discovery.mjs';
import { TEMPLATE_SYNC_DIRS, TEMPLATE_SYNC_ROOT_FILES } from './repo-init-audit.mjs';
import { syncTemplateRepository } from './template-sync.mjs';
import {
  clearTemplateAutoUpdateProjectReceipt,
  cleanupTemplateAutoUpdateActionMetadata,
  fairTemplateAutoUpdateWorkspaceOrder,
  readTemplateAutoUpdateRoundRobin,
  recordTemplateAutoUpdateProjectReceipt,
  templateAutoUpdateActionAttestation,
  verifyTemplateAutoUpdateProjectReceipt,
  writeTemplateAutoUpdateRoundRobin,
} from './template-auto-update-project-state.mjs';
import { safeRealpath } from './workspace-runtime.mjs';

function portable(value) {
  return String(value || '').replace(/\\/g, '/').replace(/\/$/, '');
}

async function availability(target) {
  try {
    const stat = await fs.stat(target);
    return stat.isDirectory() ? { available: true, reason: '' } : { available: false, reason: 'not a directory' };
  } catch (error) {
    return { available: false, reason: error.code || error.message };
  }
}

function trustedBinding(workspace, options) {
  if (!workspace || workspace.active === false || workspace.status === 'retired') return false;
  const binding = workspace.templateBinding;
  if (!binding || String(binding.templateId || '') !== options.templateId) return false;
  const boundPath = binding.realpath || binding.path;
  if (!boundPath) return false;
  const bound = safeRealpath(boundPath);
  if (bound === options.templateRealpath) return true;
  const releaseParent = path.dirname(options.templateRealpath);
  return path.basename(releaseParent) === 'releases'
    && path.dirname(bound) === releaseParent
    && /^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(path.basename(bound));
}

function workspaceId(workspace) {
  return String(workspace.workspaceId || portable(workspace.path || workspace.workspacePath));
}

async function discoverRepositories(workspace, options) {
  if (options.discoverRepositories) return options.discoverRepositories(workspace.path);
  const workspaceRealpath = await fs.realpath(workspace.path);
  if (workspaceRealpath === options.templateRealpath) return { repos: [],
    exclusions: [{ path: workspace.path, reason: 'workspace root is the shared template authority' }] };
  if (await declaresTemplateIdentity(workspaceRealpath, options.templateId)) return { repos: [], exclusions: [{ path: workspace.path, reason: 'workspace root declares the shared template identity' }] };
  if (await isGitRepo(workspace.path)) return { repos: [path.resolve(workspace.path)], exclusions: [] };
  const entries = await fs.readdir(workspace.path, { withFileTypes: true });
  const repos = [];
  const exclusions = [];
  for (const entry of entries) {
    const candidate = path.join(workspace.path, entry.name);
    if (/^\.(?:migration|backup)(?:$|[-_.])/i.test(entry.name)) {
      exclusions.push({ path: candidate, reason: 'migration or backup control directory' });
      continue;
    }
    if (['.git', '.devrules', '.codex', 'registry'].includes(entry.name.toLowerCase())) {
      exclusions.push({ path: candidate, reason: 'device or repository control directory' });
      continue;
    }
    if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
    if (entry.isSymbolicLink()) {
      const stat = await fs.stat(candidate);
      if (!stat.isDirectory()) continue;
    }
    const candidateRealpath = await fs.realpath(candidate);
    const relativeToWorkspace = path.relative(workspaceRealpath, candidateRealpath);
    if (relativeToWorkspace.startsWith('..') || path.isAbsolute(relativeToWorkspace)) {
      exclusions.push({ path: candidate, reason: 'symlink target escapes the configured workspace root' });
      continue;
    }
    if (candidateRealpath === options.templateRealpath) {
      exclusions.push({ path: candidate, reason: 'shared template authority is not a managed project' });
      continue;
    }
    if (await declaresTemplateIdentity(candidateRealpath, options.templateId)) { exclusions.push({ path: candidate, reason: 'repository declares the shared template identity' }); continue; }
    if (await isGitRepo(candidate)) repos.push(candidate);
  }
  return { repos: [...new Set(repos.map((repo) => path.resolve(repo)))].sort((left, right) => left.localeCompare(right)), exclusions };
}

export async function registeredTemplateProjects(options) {
  const templateRoot = path.resolve(options.templateRoot);
  const templateRealpath = options.templateRealpath || safeRealpath(templateRoot);
  const deviceId = options.deviceId || currentDeviceId();
  const registry = await mergeRegistryAuthorityRecords(path.join(templateRoot, 'registry'), null);
  const byPath = new Map();
  const add = (workspace, runtimeConfigured = false) => {
    const rawPath = workspace?.path || workspace?.workspacePath;
    if (!rawPath) return;
    const normalized = { ...workspace, path: path.resolve(rawPath), deviceId: workspace.deviceId || deviceId };
    if (normalized.deviceId !== deviceId || (!runtimeConfigured && !trustedBinding(normalized, { templateId: options.templateId, templateRealpath }))) return;
    byPath.set(portable(normalized.path), normalized);
  };
  for (const [index, root] of (options.runtimeWorkspaceRoots || []).entries()) {
    if (root) add({ deviceId, workspaceId: `runtime-root-${index}`, path: root }, true);
  }
  for (const device of registry.devices.devices || []) {
    if (device.deviceId === deviceId) for (const workspace of workspaceRecordsForDevice(device)) add(workspace);
  }
  for (const workspace of registry.projects.workspaces || []) {
    if ((workspace.deviceId || registry.projects.deviceId) === deviceId) add(workspace);
  }
  const names = new Map((registry.projects.projects || [])
    .filter((project) => (project.deviceId || registry.projects.deviceId) === deviceId && project.path)
    .map((project) => [portable(path.resolve(project.path)), project.name]));
  const workspaces = [];
  const seenRepositories = new Set();
  for (const workspace of [...byPath.values()].sort((left, right) => left.path.localeCompare(right.path))) {
    let state = await availability(workspace.path);
    let discovered = [];
    let discoveryExclusions = [];
    if (state.available) {
      try {
        const discovery = await discoverRepositories(workspace, { ...options, templateRealpath });
        if (!Array.isArray(discovery) && !Array.isArray(discovery?.repos)) {
          throw new Error('repository discovery returned an invalid result');
        }
        discovered = Array.isArray(discovery) ? discovery : discovery.repos;
        discoveryExclusions = Array.isArray(discovery) ? [] : discovery.exclusions || [];
      } catch (error) {
        state = { available: false, reason: `repository discovery failed: ${error?.code || error?.message || 'unknown error'}` };
      }
    }
    const repos = [];
    if (state.available) for (const repo of discovered) {
      const canonical = await fs.realpath(repo).catch(() => path.resolve(repo));
      const key = process.platform === 'darwin' ? portable(canonical).toLowerCase() : portable(canonical);
      if (seenRepositories.has(key)) {
        discoveryExclusions.push({ path: repo, reason: 'duplicate canonical project worktree' });
        continue;
      }
      seenRepositories.add(key);
      repos.push(canonical);
    }
    workspaces.push({
      workspaceId: workspaceId(workspace),
      path: workspace.path,
      enrolled: true,
      ...state,
      discoveryExcludedCount: discoveryExclusions.length,
      discoveryExclusions,
      projects: repos.map((repo) => ({
        name: String(names.get(portable(repo)) || path.basename(repo)),
        path: repo,
        workspaceId: workspaceId(workspace),
        enrolled: true,
      })),
    });
  }
  const projectCount = workspaces.reduce((total, workspace) => total + workspace.projects.length, 0);
  const discoveryExcludedCount = workspaces.reduce((total, workspace) => total + workspace.discoveryExcludedCount, 0);
  return { deviceId, templateId: options.templateId, templateRealpath, workspaceCount: workspaces.length,
    projectCount, discoveryExcludedCount, workspaces };
}

function deferred(project, reason, preflight = null) {
  return {
    ...project,
    status: 'deferred',
    applied: false,
    current: false,
    deferred: true,
    reason,
    ...(preflight ? { preflight: {
      state: preflight.state,
      fetch: publicFetch(preflight.fetch),
      branch: preflight.branch,
      upstream: preflight.upstream,
      dirty: preflight.dirty,
      ahead: preflight.ahead,
      behind: preflight.behind,
      reasons: preflight.reasons,
    } } : {}),
  };
}

function publicFetch(fetch) {
  return {
    attempted: fetch?.attempted === true,
    ok: fetch?.ok === true,
    remote: String(fetch?.remote || ''),
    error: fetch?.attempted === true && fetch?.ok !== true ? 'fetch failed; details omitted from persistent device status' : '',
  };
}

function gitReady(result) {
  return result?.fetch?.attempted === true && result.fetch.ok === true && result.ready === true
    && result.state === 'ready' && result.detached === false && Boolean(result.upstream)
    && Boolean(result.head) && Boolean(result.upstreamSha) && result.head === result.upstreamSha
    && result.dirty === false && result.ahead === 0 && result.behind === 0;
}

function updaterOwnedDirtyGitReady(result) {
  return result?.fetch?.attempted === true && result.fetch.ok === true
    && result.unborn !== true && result.detached === false && Boolean(result.branch)
    && Boolean(result.upstream) && Boolean(result.upstreamRemote) && result.remoteTopologyValid === true
    && result.dirty === true && result.ahead === 0 && result.behind === 0
    && Boolean(result.head) && Boolean(result.upstreamSha) && result.head === result.upstreamSha;
}

function locallyUnchanged(result, baseline) {
  return result?.state === 'ready' && result.ready === true && result.detached === false && Boolean(result.upstream)
    && Boolean(result.head) && Boolean(result.upstreamSha) && result.head === result.upstreamSha
    && Boolean(baseline.head) && Boolean(baseline.upstreamSha) && baseline.head === baseline.upstreamSha
    && result.dirty === false && result.ahead === 0 && result.behind === 0
    && result.head === baseline.head
    && result.upstreamSha === baseline.upstreamSha
    && result.upstream === baseline.upstream;
}

function summarize(actions) {
  return (actions || []).reduce((result, action) => {
    result[action.action] = (result[action.action] || 0) + 1;
    return result;
  }, {});
}

function locallyAtBaseline(result, baseline) {
  return result?.unborn !== true && result.detached === false && Boolean(result.branch)
    && Boolean(result.upstream) && result.ahead === 0 && result.behind === 0
    && Boolean(result.head) && Boolean(result.upstreamSha) && result.head === result.upstreamSha
    && result.head === baseline.head && result.upstreamSha === baseline.upstreamSha
    && result.branch === baseline.branch && result.upstream === baseline.upstream;
}

export async function syncRegisteredTemplateProjects(registration, options) {
  const inspect = options.inspectRepository || inspectGitRepository;
  const capture = options.captureRepositoryState || inspectGitRepository;
  const exact = options.isExactWorktree || isExactGitWorktree;
  const clock = options.clockMs || Date.now;
  const roundStartedAt = clock();
  const requestedRoundBudget = Number(options.projectRoundBudgetMs || 15 * 60_000);
  const roundBudgetMs = Number.isFinite(requestedRoundBudget) && requestedRoundBudget > 0 ? requestedRoundBudget : 15 * 60_000;
  const remainingBudget = () => Math.max(0, roundBudgetMs - (clock() - roundStartedAt));
  const boundedFetchTimeout = () => Math.max(1, Math.min(Number(options.fetchTimeout || 60_000), remainingBudget()));
  const projectStateOptions = {
    projectStatePath: options.projectStatePath,
    homeDir: options.homeDir,
    env: options.env,
    platform: options.platform,
    probeFilesystemMode: options.probeFilesystemMode,
    now: options.now,
    readProjectStatus: options.readProjectStatus,
  };
  const queueId = String(options.projectQueueId
    || `${registration.deviceId || 'default'}:${registration.templateId || 'template'}`);
  const savedSchedule = await readTemplateAutoUpdateRoundRobin(queueId, projectStateOptions);
  if (!savedSchedule.valid) {
    throw new Error(`device project receipt ledger is invalid; project writes are blocked until explicit repair: ${savedSchedule.reason}`);
  }
  const roundRobin = {
    queueId,
    lastWorkspaceId: savedSchedule.cursor.lastWorkspaceId || '',
    workspaces: [...(savedSchedule.cursor.workspaces || [])],
  };
  const workspaceCursor = new Map(roundRobin.workspaces.map((entry) => [entry.workspaceId, entry.lastProjectPath]));
  let scheduleAttempted = false;
  const sync = options.syncRepository || (async (repo) => {
    const result = await syncTemplateRepository({
      repoPath: repo,
      templateRoot: options.templateRoot,
      directoryNames: TEMPLATE_SYNC_DIRS,
      rootFiles: TEMPLATE_SYNC_ROOT_FILES,
      apply: true,
      reconcileOwnership: options.reconcileOwnership === true,
    });
    const actions = [...(result.actions || [])];
    if (!result.globalBlocked && !(result.blockedModules || []).includes('core-orchestration')) {
      try {
        await refreshConfiguredEntryFiles(repo, true, actions);
      } catch (error) {
        error.actions = [...actions, ...(error?.actions || [])];
        throw error;
      }
    }
    return { ...result, actions };
  });
  // A caller may inject a focused adoption gate. Production convergence relies
  // on the stricter transactional planner instead of treating ordinary
  // template drift from a repository-wide audit as a reason to skip syncing.
  const audit = options.auditRepository || null;
  const initialize = options.initializeRepository || (async (repo) => {
    const module = await import('./repo-init-audit.mjs');
    return module.initializeRepo(repo, { apply: true, profile: 'minimal', 'sync-template': true }, {
      templateRoot: options.templateRoot,
      version: options.templateVersion,
    });
  });
  const workspaces = [];
  let appliedCount = 0, currentCount = 0, deferredCount = 0;
  for (const workspace of fairTemplateAutoUpdateWorkspaceOrder(registration.workspaces || [], roundRobin)) {
    const projects = [];
    for (const project of workspace.projects) {
      if (remainingBudget() <= 0) {
        projects.push(deferred(project, 'project convergence round budget exhausted; retry on the next scheduled run'));
        deferredCount += 1;
        continue;
      }
      roundRobin.lastWorkspaceId = workspace.workspaceId;
      workspaceCursor.set(workspace.workspaceId, portable(path.resolve(project.path)));
      scheduleAttempted = true;
      try {
      const state = await availability(project.path);
      if (!state.available) {
        projects.push(deferred(project, `offline or unavailable: ${state.reason}`)); deferredCount += 1; continue;
      }
      if (!(await exact(project.path))) {
        projects.push(deferred(project, 'registered path is not the exact Git worktree root')); deferredCount += 1; continue;
      }
      const preflight = await inspect(project.path, { fetch: true, fetchTimeout: boundedFetchTimeout(),
        cleanupAppleDouble: true, platform: options.platform });
      let updaterOwnedDirty = false;
      let ownedPaths = [];
      let ownedFingerprints = [];
      if (preflight?.dirty === true) {
        if (!updaterOwnedDirtyGitReady(preflight)) {
          projects.push(deferred(project, (preflight.reasons || []).join('; ') || 'dirty Git preflight is not remotely equal', preflight)); deferredCount += 1; continue;
        }
        const receipt = await verifyTemplateAutoUpdateProjectReceipt(project.path, preflight, projectStateOptions);
        if (!receipt.eligible) {
          projects.push(deferred(project, receipt.reason, preflight)); deferredCount += 1; continue;
        }
        updaterOwnedDirty = true;
        ownedPaths = receipt.ownedPaths || [];
        ownedFingerprints = receipt.ownedFingerprints || [];
      } else if (!gitReady(preflight)) {
        projects.push(deferred(project, (preflight.reasons || []).join('; ') || 'Git preflight is not ready', preflight)); deferredCount += 1; continue;
      } else {
        // A clean, remotely equal worktree means the developer committed or
        // otherwise resolved any earlier updater-owned changes. Its old
        // device-local receipt must not authorize a future unrelated edit.
        await clearTemplateAutoUpdateProjectReceipt(project.path, projectStateOptions);
      }
      let mutationAttempted = false;
      let mutationBaseline = preflight;
      try {
        const devrules = await fs.stat(path.join(project.path, 'devrules')).catch((error) => error?.code === 'ENOENT' ? null : Promise.reject(error));
        const hasAlways = await fs.stat(path.join(project.path, 'devrules', 'always-readme.md')).then((stat) => stat.isFile()).catch(() => false);
        const hasManifest = await fs.stat(path.join(project.path, 'devrules', 'manifest.json')).then((stat) => stat.isFile()).catch(() => false);
        const incompleteDevrules = Boolean(devrules) && (!hasAlways || !hasManifest);
        if (incompleteDevrules && !updaterOwnedDirty) {
          projects.push(deferred(project, 'existing devrules instance is incomplete and requires explicit repair', preflight)); deferredCount += 1; continue;
        }
        let result, initialized = false;
        if (!devrules || incompleteDevrules) {
          if (remainingBudget() <= 0) {
            projects.push(deferred(project, 'project convergence round budget exhausted before initialization recheck', preflight)); deferredCount += 1; continue;
          }
          const recheck = await inspect(project.path, { fetch: true, fetchTimeout: boundedFetchTimeout(),
            cleanupAppleDouble: true, platform: options.platform });
          const receipt = updaterOwnedDirty
            ? await verifyTemplateAutoUpdateProjectReceipt(project.path, recheck, projectStateOptions)
            : null;
          if (updaterOwnedDirty
            ? !updaterOwnedDirtyGitReady(recheck) || !receipt.eligible
            : !locallyUnchanged(recheck, preflight)) {
            projects.push(deferred(project, 'Git state changed after preflight; initialization was not attempted', recheck)); deferredCount += 1; continue;
          }
          if (receipt?.eligible) {
            ownedPaths = receipt.ownedPaths || ownedPaths;
            ownedFingerprints = receipt.ownedFingerprints || ownedFingerprints;
          }
          mutationAttempted = true;
          mutationBaseline = recheck;
          result = await initialize(project.path, { reconcileOwnership: options.reconcileOwnership === true }); initialized = true;
        } else {
          if (audit) {
            const audited = await audit(project.path);
            const issues = audited.issues || [];
            if (issues.length) {
              projects.push(deferred(project, `devrules audit requires review: ${issues.map((issue) => issue.message).join('; ')}`, preflight)); deferredCount += 1; continue;
            }
          }
          if (remainingBudget() <= 0) {
            projects.push(deferred(project, 'project convergence round budget exhausted before synchronization recheck', preflight)); deferredCount += 1; continue;
          }
          const recheck = await inspect(project.path, { fetch: true, fetchTimeout: boundedFetchTimeout(),
            cleanupAppleDouble: true, platform: options.platform });
          const receipt = updaterOwnedDirty
            ? await verifyTemplateAutoUpdateProjectReceipt(project.path, recheck, projectStateOptions)
            : null;
          if (updaterOwnedDirty
            ? !updaterOwnedDirtyGitReady(recheck) || !receipt.eligible
            : !locallyUnchanged(recheck, preflight)) {
            projects.push(deferred(project, 'Git state changed after preflight; synchronization was not attempted', recheck)); deferredCount += 1; continue;
          }
          if (receipt?.eligible) {
            ownedPaths = receipt.ownedPaths || ownedPaths;
            ownedFingerprints = receipt.ownedFingerprints || ownedFingerprints;
          }
          mutationAttempted = true;
          mutationBaseline = recheck;
          result = await sync(project.path, { reconcileOwnership: options.reconcileOwnership === true });
        }
        const actionSummary = result?.actionSummary || summarize(result?.actions);
        const mutationReported = initialized || result?.applied === true || result?.partial === true
          || ['copy', 'delete', 'write', 'create', 'update', 'run'].some((key) => Number(actionSummary[key] || 0) > 0);
        await cleanupTemplateAutoUpdateActionMetadata(project.path, result?.actions, projectStateOptions)
          .catch((error) => { error.actions = result?.actions; throw error; });
        const expected = templateAutoUpdateActionAttestation(project.path, result?.actions, ownedFingerprints);
        let receiptResult = { accepted: true, recorded: false, reason: '' };
        if (!result?.blocked || mutationReported) {
          const postMutation = await capture(project.path, { fetch: false, fetchTimeout: boundedFetchTimeout(),
            cleanupAppleDouble: true, platform: options.platform });
          if (!locallyAtBaseline(postMutation, mutationBaseline)) {
            receiptResult = { accepted: false, recorded: false,
              reason: 'post-mutation Git baseline changed; updater receipt was not issued' };
          } else {
            receiptResult = await recordTemplateAutoUpdateProjectReceipt(project.path, postMutation, {
              ...projectStateOptions,
              allowedPaths: [...ownedPaths, ...expected.actionPaths],
              actionPaths: expected.actionPaths,
              expectedFingerprints: expected.fingerprints,
            });
          }
        }
        if (!receiptResult.accepted) {
          projects.push({ ...deferred(project, receiptResult.reason, preflight), partialApplied: mutationReported,
            updaterOwnedDirty, actionSummary, blockedModules: result?.blockedModules || [] });
          deferredCount += 1; continue;
        }
        if (result?.blocked) {
          projects.push({ ...deferred(project, 'template baseline planner blocked this repository', preflight),
            partialApplied: result.partial === true && result.applied === true, actionSummary,
            blockedModules: result.blockedModules || [], updaterOwnedDirty });
          deferredCount += 1; continue;
        }
        const changed = initialized || ['copy', 'delete', 'write', 'create', 'update', 'run'].some((key) => Number(actionSummary[key] || 0) > 0);
        projects.push({ ...project, status: changed ? 'applied' : 'current', applied: changed, current: !changed,
          deferred: false, initialized, reconcileOwnership: options.reconcileOwnership === true,
          partialApplied: false, updaterOwnedDirty, actionSummary,
          preflight: { state: preflight.state, fetch: publicFetch(preflight.fetch), branch: preflight.branch, upstream: preflight.upstream } });
        if (changed) appliedCount += 1; else currentCount += 1;
      } catch (error) {
        let receiptRecorded = false;
        let receiptReason = '';
        if (mutationAttempted) {
          try {
            await cleanupTemplateAutoUpdateActionMetadata(project.path, error?.actions, projectStateOptions);
            const expected = templateAutoUpdateActionAttestation(project.path, error?.actions, ownedFingerprints);
            const postMutation = await capture(project.path, { fetch: false, fetchTimeout: boundedFetchTimeout(),
              cleanupAppleDouble: true, platform: options.platform });
            if (!locallyAtBaseline(postMutation, mutationBaseline)) {
              receiptReason = 'post-mutation Git baseline changed; partial receipt was not issued';
            } else {
              const recorded = await recordTemplateAutoUpdateProjectReceipt(project.path, postMutation, {
                ...projectStateOptions,
                allowedPaths: [...ownedPaths, ...expected.actionPaths],
                actionPaths: expected.actionPaths,
                expectedFingerprints: expected.fingerprints,
              });
              receiptRecorded = recorded.accepted === true && recorded.recorded === true;
              receiptReason = recorded.reason || '';
            }
          } catch {
            receiptReason = 'post-mutation state could not be captured; partial receipt was not issued';
          }
        }
        const reason = [`template convergence failed closed: ${error.message}`, receiptReason].filter(Boolean).join('; ');
        projects.push({ ...deferred(project, reason, preflight), partialApplied: receiptRecorded,
          updaterOwnedDirty, receiptRecorded });
        deferredCount += 1;
      }
      } catch (error) {
        const code = error?.code ? ` (${error.code})` : '';
        projects.push(deferred(project, `project preflight failed closed${code}; details omitted`));
        deferredCount += 1;
      }
    }
    workspaces.push({
      workspaceId: workspace.workspaceId,
      path: workspace.path,
      enrolled: true,
      available: workspace.available,
      reason: workspace.reason,
      discoveryExcludedCount: workspace.discoveryExcludedCount || 0,
      discoveryExclusions: workspace.discoveryExclusions || [],
      discoveredCount: projects.length,
      appliedCount: projects.filter((project) => project.applied).length,
      currentCount: projects.filter((project) => project.current).length,
      deferredCount: projects.filter((project) => project.deferred).length,
      partialAppliedCount: projects.filter((project) => project.partialApplied).length,
      projects,
    });
  }
  const discoveredCount = registration.projectCount || 0;
  if (scheduleAttempted) {
    roundRobin.workspaces = [...workspaceCursor.entries()]
      .map(([workspaceIdValue, lastProjectPath]) => ({ workspaceId: workspaceIdValue, lastProjectPath }))
      .sort((left, right) => left.workspaceId.localeCompare(right.workspaceId));
    await writeTemplateAutoUpdateRoundRobin(roundRobin, projectStateOptions);
  }
  if (discoveredCount !== appliedCount + currentCount + deferredCount) throw new Error('project convergence accounting invariant failed');
  return { deviceId: registration.deviceId, enrolledWorkspaceCount: workspaces.length,
    deferredWorkspaceCount: workspaces.filter((workspace) => workspace.available === false).length, discoveredCount,
    discoveryExcludedCount: workspaces.reduce((total, workspace) => total + workspace.discoveryExcludedCount, 0),
    enrolledProjectCount: discoveredCount, appliedCount, currentCount, deferredCount,
    partialAppliedCount: workspaces.reduce((total, workspace) => total + workspace.partialAppliedCount, 0), workspaces };
}
