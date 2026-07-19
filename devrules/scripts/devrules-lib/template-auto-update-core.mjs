import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';

import { resolveRuntimeLocation, runRuntimeLocationCommand } from './runtime-location.mjs';
import { atomicWriteFile, withFileLock } from './safe-files.mjs';
import { recoverAbandonedTemplateAutoUpdateLock } from './template-auto-update-lock.mjs';
import { installPreparedTemplateRelease, prepareTemplateReleaseUpdate, removePreparedTemplateRelease } from './template-auto-update-release.mjs';
import { registeredTemplateProjects, syncRegisteredTemplateProjects } from './template-auto-update-projects.mjs';

const execFileAsync = promisify(execFile);
const STATUS_KIND = 'devrules-template-auto-update-status';

function env(options) { return options.env || process.env; }

export function defaultTemplateAutoUpdateStatusPath(options = {}) {
  return path.resolve(env(options).DEVRULES_TEMPLATE_AUTO_UPDATE_STATUS
    || path.join(options.homeDir || os.homedir(), '.config', 'devrules', 'template-auto-update-status.json'));
}

export function defaultTemplateAutoUpdateLockPath(options = {}) {
  return path.resolve(env(options).DEVRULES_TEMPLATE_AUTO_UPDATE_LOCK
    || path.join(options.homeDir || os.homedir(), '.config', 'devrules', 'template-auto-update.lock'));
}

function now(options) { return (options.now || (() => new Date()))().toISOString(); }
function envelope(status, options, additions = {}) {
  return { schemaVersion: 1, kind: STATUS_KIND, status, checkedAt: now(options), ...additions };
}
async function persist(filePath, value) { await atomicWriteFile(filePath, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o644 }); }

export async function readTemplateAutoUpdateStatus(options = {}) {
  const statusPath = options.statusPath || defaultTemplateAutoUpdateStatusPath(options);
  try {
    const parsed = JSON.parse(await fs.readFile(statusPath, 'utf8'));
    if (parsed?.schemaVersion !== 1 || parsed?.kind !== STATUS_KIND) return envelope('invalid', options, { statusPath, reason: 'invalid status schema or kind' });
    return { ...parsed, statusPath };
  } catch (error) {
    return error?.code === 'ENOENT' ? envelope('never-run', options, { statusPath }) : envelope('invalid', options, { statusPath, reason: error.message });
  }
}

function plannedProjects(registration) {
  const workspaces = registration.workspaces.map((workspace) => {
    const unavailable = workspace.available === false;
    return {
      workspaceId: workspace.workspaceId,
      path: workspace.path,
      enrolled: true,
      available: workspace.available,
      reason: workspace.reason,
      discoveryExcludedCount: workspace.discoveryExcludedCount || 0,
      discoveryExclusions: workspace.discoveryExclusions || [],
      discoveredCount: workspace.projects.length,
      appliedCount: 0,
      currentCount: 0,
      uncheckedCount: unavailable ? 0 : workspace.projects.length,
      deferredCount: unavailable ? workspace.projects.length : 0,
      partialAppliedCount: 0,
      projects: workspace.projects.map((project) => unavailable
        ? { ...project, status: 'deferred', applied: false, current: false, unchecked: false,
          deferred: true, reason: workspace.reason || 'workspace is unavailable during dry-run planning' }
        : { ...project, status: 'unchecked', applied: false, current: false, unchecked: true,
          deferred: false, reason: 'dry-run lists enrollment only; project Git state and convergence were not checked' }),
    };
  });
  return {
    deviceId: registration.deviceId,
    enrolledWorkspaceCount: registration.workspaceCount,
    deferredWorkspaceCount: workspaces.filter((workspace) => workspace.available === false).length,
    discoveredCount: registration.projectCount,
    discoveryExcludedCount: registration.discoveryExcludedCount || 0,
    enrolledProjectCount: registration.projectCount,
    appliedCount: 0,
    currentCount: 0,
    uncheckedCount: workspaces.reduce((total, workspace) => total + workspace.uncheckedCount, 0),
    deferredCount: workspaces.reduce((total, workspace) => total + workspace.deferredCount, 0),
    partialAppliedCount: 0,
    workspaces,
  };
}

function release(releaseValue) {
  if (!releaseValue) return null;
  const source = releaseValue.source;
  return { templateId: source.templateId, version: source.version, revision: source.revision, commit: source.commit,
    tagName: source.tagName, tagObject: source.tagObject };
}

async function runJson(script, args, options) {
  try {
    const result = await execFileAsync(process.execPath, [script, ...args, '--json'], {
      encoding: 'utf8', env: options.env, timeout: options.timeout || 120_000, maxBuffer: 8 * 1024 * 1024, windowsHide: true,
    });
    return JSON.parse(result.stdout);
  } catch (error) {
    throw new Error(String(error?.stderr || error?.stdout || error?.message || error).trim() || `refresh failed: ${path.basename(script)}`);
  }
}

async function refreshGlobal(templateRoot, runtime, options) {
  if (options.refreshGlobalAssets) return options.refreshGlobalAssets({ templateRoot, runtime });
  const result = await runJson(path.join(templateRoot, 'scripts', 'global-devrules.mjs'), ['install', '--apply'], {
    env: { ...env(options), DEVRULES_RUNTIME_CONFIG: runtime.configPath, DEVRULES_TEMPLATE_ROOT: templateRoot },
    timeout: options.deviceRefreshTimeout,
  });
  if (result.status !== 'pass') throw new Error(`global devrules refresh returned ${result.status || 'unknown'}`);
  return result;
}

export async function refreshInstalledMaintenanceAgent(templateRoot, runtime, options = {}) {
  if (options.refreshMaintenanceAgent) return options.refreshMaintenanceAgent({ templateRoot, runtime });
  const status = options.queryMaintenanceAgentStatus
    ? await options.queryMaintenanceAgentStatus({ templateRoot, runtime })
    : await runJson(path.join(templateRoot, 'scripts', 'idle-resource-maintenance.mjs'), ['agent-status'], {
      env: { ...env(options), DEVRULES_RUNTIME_CONFIG: runtime.configPath, DEVRULES_TEMPLATE_ROOT: templateRoot },
      timeout: options.deviceRefreshTimeout,
    });
  if (status.installed !== true) {
    return { status: 'skipped', scheduler: status.scheduler, healthy: false, actions: [], reason: 'idle maintenance agent is not installed; auto-update will not opt it in' };
  }
  if (options.ensureMaintenanceAgent) return options.ensureMaintenanceAgent({ templateRoot, runtime, status });
  const result = await runJson(path.join(templateRoot, 'scripts', 'idle-resource-maintenance.mjs'), ['ensure-agent', '--apply'], {
    env: { ...env(options), DEVRULES_RUNTIME_CONFIG: runtime.configPath, DEVRULES_TEMPLATE_ROOT: templateRoot },
    timeout: options.deviceRefreshTimeout,
  });
  if (!['pass', 'skipped'].includes(result.status)) throw new Error(`maintenance refresh returned ${result.status || 'unknown'}`);
  return result;
}

function autoUpdateWrapperPath(options = {}) {
  const platform = options.platform || process.platform;
  const configDir = path.join(options.homeDir || os.homedir(), '.config', 'devrules');
  if (platform === 'darwin') return path.join(configDir, 'template-auto-update-agent.sh');
  if (platform === 'win32') return path.join(configDir, 'template-auto-update-agent.ps1');
  return '';
}

export async function refreshInstalledAutoUpdateAgent(templateRoot, runtime, options = {}) {
  if (options.refreshAutoUpdateAgent) return options.refreshAutoUpdateAgent({ templateRoot, runtime });
  const modulePath = path.join(templateRoot, 'scripts', 'devrules-lib', 'template-auto-update-agent.mjs');
  const moduleStat = await fs.lstat(modulePath).catch((error) => error?.code === 'ENOENT' ? null : Promise.reject(error));
  if (!moduleStat) {
    const wrapper = autoUpdateWrapperPath(options);
    const installed = wrapper ? await fs.lstat(wrapper).then(() => true).catch(() => false) : false;
    if (installed) throw new Error('installed template auto-update agent cannot be refreshed because the active release lacks its agent module');
    return { status: 'skipped', scheduler: options.platform || process.platform, healthy: false, actions: [],
      reason: 'template auto-update agent is not installed; release activation will not opt this device in' };
  }
  if (!moduleStat.isFile() || moduleStat.isSymbolicLink()) {
    throw new Error('template auto-update agent module is not a regular release file');
  }
  // Load the implementation from the verified candidate release, not from the
  // old updater process, so the installed scheduler files converge forward.
  const agentModule = await import(pathToFileURL(modulePath).href);
  if (typeof agentModule.refreshInstalledTemplateAutoUpdateAgent !== 'function') {
    throw new Error('template auto-update agent module does not export its refresh operation');
  }
  const result = await agentModule.refreshInstalledTemplateAutoUpdateAgent({
    env: env(options),
    platform: options.platform,
    homeDir: options.homeDir,
  });
  if (!['pass', 'skipped'].includes(result.status)) {
    throw new Error(`template auto-update agent refresh returned ${result.status || 'unknown'}${result.reason ? `: ${result.reason}` : ''}`);
  }
  return result;
}

async function refreshSurfaces(templateRoot, runtime, options) {
  const global = await refreshGlobal(templateRoot, runtime, options);
  const maintenance = await refreshInstalledMaintenanceAgent(templateRoot, runtime, options);
  const autoUpdate = await refreshInstalledAutoUpdateAgent(templateRoot, runtime, options);
  return { globalAssets: { status: global.status, actions: global.actions || [] },
    maintenanceAgent: { status: maintenance.status, scheduler: maintenance.scheduler, healthy: maintenance.healthy, actions: maintenance.actions || [] },
    autoUpdateAgent: { status: autoUpdate.status, scheduler: autoUpdate.scheduler, healthy: autoUpdate.healthy, actions: autoUpdate.actions || [] } };
}

async function switchRuntime(runtime, templateRoot, options) {
  if (options.switchRuntime) return options.switchRuntime({ runtime, templateRoot });
  return runRuntimeLocationCommand('configure', {
    configPath: runtime.configPath, templateRoot, workspaceRoots: runtime.workspaceRoots, apply: true,
  }, { env: env(options), platform: options.platform, homeDir: options.homeDir, cwd: options.cwd, fallbackTemplateRoot: templateRoot });
}

async function rollback(runtime, previousRoot, options) {
  const result = { attempted: true, runtime: false, deviceSurfaces: false, errors: [] };
  try { await switchRuntime(runtime, previousRoot, options); result.runtime = true; } catch (error) { result.errors.push(`runtime rollback failed: ${error.message}`); }
  try { await refreshSurfaces(previousRoot, runtime, options); result.deviceSurfaces = true; } catch (error) { result.errors.push(`surface rollback failed: ${error.message}`); }
  return result;
}

async function runtimeLocation(options) {
  if (options.runtimeLocation) return options.runtimeLocation;
  return resolveRuntimeLocation({ env: env(options), configPath: options.runtimeConfigPath, platform: options.platform,
    homeDir: options.homeDir, cwd: options.cwd, fallbackTemplateRoot: options.fallbackTemplateRoot });
}

async function perform(options, writeStatus) {
  const apply = options.apply === true;
  const runtime = await runtimeLocation(options);
  const base = { apply, authorization: options.invocation === 'agent' ? 'device-opt-in' : apply ? 'manual-apply' : 'dry-run',
    policy: { allowMajor: options.allowMajor === true, reconcileOwnership: options.reconcileOwnership === true },
    runtime: { configPath: runtime.configPath, source: runtime.source, templateRoot: runtime.templateRoot, workspaceRoots: runtime.workspaceRoots } };
  if (apply && runtime.source !== 'config') {
    const result = envelope('blocked', options, { ...base,
      reason: 'runtime activation requires device-local runtime.json; environment/fallback roots cannot be switched atomically' });
    if (writeStatus) await persist(options.statusPath, result);
    return result;
  }
  let prepared, switched = false;
  try {
    prepared = await prepareTemplateReleaseUpdate({ templateRoot: runtime.templateRoot, apply,
      releasesDirectory: options.releasesDirectory, temporaryDirectory: options.temporaryDirectory,
      downloadTimeout: options.downloadTimeout, includePrerelease: options.includePrerelease, allowMajor: options.allowMajor });
    const registration = await registeredTemplateProjects({ templateRoot: runtime.templateRoot, templateRealpath: runtime.templateRealpath,
      templateId: prepared.current.source.templateId, deviceId: options.deviceId, runtimeWorkspaceRoots: runtime.workspaceRoots,
      discoverRepositories: options.discoverRepositories });
    const projects = plannedProjects(registration);
    const releases = { current: release(prepared.current), candidate: release(prepared.candidate), rejected: prepared.rejected,
      blockedMajor: prepared.blockedMajor || [] };
    if (!prepared.candidate) {
      const convergence = apply ? await syncRegisteredTemplateProjects(registration, {
        templateRoot: runtime.templateRoot,
        templateVersion: prepared.current.source.version,
        fetchTimeout: options.projectFetchTimeout,
        reconcileOwnership: options.reconcileOwnership,
        inspectRepository: options.inspectRepository,
        isExactWorktree: options.isExactWorktree,
        auditRepository: options.auditRepository,
        initializeRepository: options.initializeRepository,
        syncRepository: options.syncRepository,
        captureRepositoryState: options.captureRepositoryState,
        projectStatePath: options.projectStatePath,
        homeDir: options.homeDir,
        platform: options.platform,
        probeFilesystemMode: options.probeFilesystemMode,
        env: env(options),
        now: options.now,
        readProjectStatus: options.readProjectStatus,
        projectRoundBudgetMs: options.projectRoundBudgetMs,
        clockMs: options.clockMs,
        projectQueueId: options.projectQueueId,
      }) : projects;
      const resultStatus = prepared.blockedMajor?.length ? 'blocked-major'
        : prepared.rejected?.length ? 'failed'
          : convergence.deferredCount || convergence.deferredWorkspaceCount ? 'deferred' : 'up-to-date';
      const result = envelope(resultStatus, options, { ...base,
        updateApplied: false, releases, projects: convergence,
        ...(prepared.blockedMajor?.length ? { reason: 'newer major release requires allow-major' }
          : prepared.rejected?.length ? { reason: 'newer release candidates failed verification; automatic convergence will retry' } : {}) });
      if (writeStatus) await persist(options.statusPath, result);
      return result;
    }
    if (!apply) return envelope('update-available', options, { ...base, updateApplied: false, releases,
      plannedReleasePath: prepared.releasePath, projects });
    const installed = await installPreparedTemplateRelease(prepared);
    await switchRuntime(runtime, installed.path, options); switched = true;
    let surfaces;
    try { surfaces = await refreshSurfaces(installed.path, runtime, options); }
    catch (error) {
      const rollbackResult = await rollback(runtime, runtime.templateRoot, options); switched = !rollbackResult.runtime;
      throw Object.assign(new Error(`device activation failed: ${error.message}`), { rollback: rollbackResult });
    }
    const convergence = await syncRegisteredTemplateProjects(registration, {
      templateRoot: installed.path, templateVersion: prepared.candidate.source.version, fetchTimeout: options.projectFetchTimeout,
      inspectRepository: options.inspectRepository, isExactWorktree: options.isExactWorktree,
      auditRepository: options.auditRepository, initializeRepository: options.initializeRepository, syncRepository: options.syncRepository,
      captureRepositoryState: options.captureRepositoryState, projectStatePath: options.projectStatePath,
      homeDir: options.homeDir, platform: options.platform, probeFilesystemMode: options.probeFilesystemMode,
      env: env(options), now: options.now, readProjectStatus: options.readProjectStatus,
      projectRoundBudgetMs: options.projectRoundBudgetMs, clockMs: options.clockMs,
      projectQueueId: options.projectQueueId,
      reconcileOwnership: options.reconcileOwnership,
    });
    const result = envelope(convergence.deferredCount || convergence.deferredWorkspaceCount ? 'deferred' : 'pass', options, { ...base, updateApplied: true,
      releases, installedRelease: installed, activation: { runtimeSwitched: true, templateRoot: installed.path, deviceSurfaces: surfaces }, projects: convergence });
    await persist(options.statusPath, result);
    return result;
  } catch (error) {
    const result = envelope('failed', options, { ...base, updateApplied: false, reason: error.message,
      activation: { runtimeSwitched: switched, rollback: error.rollback || null } });
    if (writeStatus) await persist(options.statusPath, result);
    return result;
  } finally { await removePreparedTemplateRelease(prepared).catch(() => {}); }
}

export async function runTemplateAutoUpdate(options = {}) {
  const statusPath = path.resolve(options.statusPath || defaultTemplateAutoUpdateStatusPath(options));
  const lockPath = path.resolve(options.lockPath || defaultTemplateAutoUpdateLockPath(options));
  const context = { ...options, statusPath, lockPath };
  if (context.apply === true && context.invocation === 'agent' && context.deviceOptIn !== true) {
    return envelope('opt-in-required', context, { apply: true, statusPath, lockPath, reason: 'scheduled updates require installed device opt-in' });
  }
  if (context.apply !== true) return perform(context, false);
  try {
    await recoverAbandonedTemplateAutoUpdateLock(lockPath);
    return await withFileLock(lockPath, async () => {
      await persist(statusPath, envelope('running', context, { apply: true, authorization: context.invocation === 'agent' ? 'device-opt-in' : 'manual-apply' }));
      try {
        return await perform(context, true);
      } catch (error) {
        const failure = envelope('failed', context, { apply: true, updateApplied: false, reason: error.message });
        await persist(statusPath, failure);
        return failure;
      }
    });
  } catch (error) {
    if (/another devrules operation holds lock/.test(error.message)) return envelope('locked', context, { apply: true, statusPath, lockPath, reason: error.message });
    throw error;
  }
}
