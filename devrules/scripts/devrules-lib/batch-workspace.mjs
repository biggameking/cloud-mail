import path from 'node:path';
import {
  addWorkspaceRoot,
  resolveWorkspaceConfigRoot,
  safeRealpath,
  workspaceRootStatus,
  workspaceUsesTemplate,
} from './workspace-runtime.mjs';
import {
  currentDeviceId,
  mergeRegistryAuthorityRecords,
  workspaceRecordsForDevice,
} from './device-registry.mjs';
import {
  mapWithConcurrency,
  normalizeRel,
  readText,
} from './fs-actions.mjs';
import { refreshConfiguredEntryFiles } from './instance-bootstrap.mjs';
import { inspectGitRepository } from './git-repository.mjs';
import {
  normalizeAdoptionProfile,
  normalizeConfig,
} from './repo-config.mjs';
import { findGitRepos } from './repo-discovery.mjs';
import {
  assertAdoptedTemplateSyncTarget,
  syncTemplateRepository,
} from './template-sync.mjs';
import {
  TEMPLATE_SYNC_DIRS,
  TEMPLATE_SYNC_ROOT_FILES,
  auditRepo,
  initializeRepo,
  scanRepo,
} from './repo-init-audit.mjs';
import { isApply, output } from './cli-io.mjs';

const MAX_READY_ANCHOR_CANDIDATES = 50;
export const DEFAULT_SCAN_CONCURRENCY = 8;

function gitStatusSummary(status, fetchRequested) {
  const localReasons = [];
  if (!status || status.unborn) localReasons.push('repository has no commits');
  if (!status || status.detached) localReasons.push('HEAD is detached');
  if (!status?.upstream) localReasons.push('branch has no upstream');
  if (status?.upstream && status.upstreamRemote === '') localReasons.push('upstream is not backed by a fetchable Git remote');
  if (status?.upstreamRemote && status.remoteTopologyValid === false) localReasons.push(`upstream remote ${status.upstreamRemote} has ambiguous fetch URLs`);
  if (status?.upstream && !status.upstreamSha) localReasons.push('upstream commit could not be resolved');
  if (status?.dirty) localReasons.push(`worktree has ${status.dirtyCount} uncommitted path(s)`);
  if ((status?.ahead || 0) > 0 && (status?.behind || 0) > 0) {
    localReasons.push(`branch diverged: ahead ${status.ahead}, behind ${status.behind}`);
  } else if ((status?.behind || 0) > 0) {
    localReasons.push(`branch is behind upstream by ${status.behind}`);
  } else if ((status?.ahead || 0) > 0) {
    localReasons.push(`branch has ${status.ahead} unpushed commit(s)`);
  }

  const fetchAttempted = status?.fetch?.attempted === true;
  const fetchOk = fetchAttempted && status?.fetch?.ok === true;
  const locallyReady = localReasons.length === 0;
  const freshness = fetchAttempted ? fetchOk ? 'verified' : 'failed' : 'unchecked';
  const reasons = [...localReasons];
  if (fetchAttempted && !fetchOk) reasons.unshift('fetch failed; remote state is not trustworthy');
  if (!fetchAttempted && locallyReady) reasons.push('remote freshness unchecked; rerun with --fetch before relying on write eligibility');
  if (!status) reasons.unshift('Git inspection failed');

  return {
    state: locallyReady && fetchOk ? 'gitReady' : 'deferredGit',
    ready: locallyReady && fetchOk,
    locallyReady,
    freshness,
    fetchRequested: fetchRequested === true,
    branch: status?.branch || '',
    upstream: status?.upstream || '',
    upstreamRemote: status?.upstreamRemote || '',
    head: status?.head || '',
    upstreamSha: status?.upstreamSha || '',
    ahead: status?.ahead || 0,
    behind: status?.behind || 0,
    dirty: status?.dirty === true,
    dirtyCount: status?.dirtyCount || 0,
    detached: status?.detached !== false,
    unborn: status?.unborn !== false,
    remote: status?.remote || '',
    remoteTopologyValid: status?.remoteTopologyValid !== false,
    fetch: status?.fetch || { attempted: false, ok: false, error: '' },
    reasons: [...new Set(reasons)],
  };
}

async function inspectGitWriteReadiness(repo, fetchRequested) {
  try {
    const status = await inspectGitRepository(repo, { fetch: fetchRequested === true });
    return gitStatusSummary(status, fetchRequested);
  } catch (error) {
    return {
      ...gitStatusSummary(null, fetchRequested),
      freshness: fetchRequested ? 'failed' : 'unchecked',
      fetch: {
        attempted: fetchRequested === true,
        ok: false,
        error: error?.message || String(error),
      },
      reasons: [`Git inspection failed: ${error?.message || error}`],
    };
  }
}

export function summarizeActions(actions) {
  const summary = {};
  for (const action of actions || []) {
    const key = action.action;
    summary[key] = (summary[key] || 0) + 1;
  }
  return summary;
}

function summarizeSyncResults(results) {
  const actionTotals = {};
  const reposWithConflicts = [];
  const reposWithCopies = [];
  const reposWithWrites = [];

  for (const result of results || []) {
    const summary = result.actionSummary || {};
    for (const [key, value] of Object.entries(summary)) {
      actionTotals[key] = (actionTotals[key] || 0) + value;
    }
    if (summary.conflict) reposWithConflicts.push({ name: result.name, conflicts: summary.conflict });
    if (summary.copy) reposWithCopies.push({ name: result.name, copies: summary.copy });
    if (summary.write) reposWithWrites.push({ name: result.name, writes: summary.write });
  }

  return { actionTotals, reposWithConflicts, reposWithCopies, reposWithWrites };
}

export function formatActionTotals(actionTotals) {
  const entries = Object.entries(actionTotals || {}).sort((a, b) => a[0].localeCompare(b[0]));
  return entries.length ? entries.map(([key, value]) => `${key}=${value}`).join(', ') : 'none';
}

function formatNameCountList(items, countKey, limit = 20) {
  if (!items?.length) return 'none';
  const rendered = items.slice(0, limit).map((item) => `${item.name}(${item[countKey]})`);
  const remaining = items.length - rendered.length;
  return remaining > 0 ? `${rendered.join(', ')} ... +${remaining} more` : rendered.join(', ');
}

function printSyncTemplateSummary(data) {
  const outcome = data.apply
    ? data.partialCount > 0 ? 'Applied with deferred modules' : 'Applied'
    : 'Dry-run';
  console.log(`${outcome} template sync under ${data.root}`);
  if (data.adoptCurrentBaseline) console.log('Adopting current project files as template sync baseline where needed.');
  if (data.reconcileOwnership) console.log('Reconciling untrusted legacy ownership: shared follows the template; seed and local remain project-owned.');
  console.log(`Processed adopted repositories: ${data.processedCount}`);
  console.log(`Skipped repositories: ${data.skippedCount}`);
  console.log(`Blocked repositories: ${data.blockedCount || 0}`);
  console.log(`Partially applied repositories: ${data.partialCount || 0}`);
  console.log(`Actions: ${formatActionTotals(data.actionTotals)}`);
  console.log(`Repos with copies: ${formatNameCountList(data.reposWithCopies, 'copies')}`);
  console.log(`Repos with conflicts: ${formatNameCountList(data.reposWithConflicts, 'conflicts')}`);
  if (data.skippedCount) {
    console.log('\nSkipped:');
    for (const result of data.results.filter((item) => item.skipped).slice(0, 30)) {
      console.log(`- ${result.name}: ${result.reasons.join('; ')}`);
    }
    const remaining = data.results.filter((item) => item.skipped).length - 30;
    if (remaining > 0) console.log(`... ${remaining} more skipped repositories`);
  }
}

export function syncTemplateEligibility(status) {
  const reasons = [];
  if (status.configMalformed) reasons.push('malformed config');
  if (!status.hasDevRulesInstance) reasons.push('no devrules instance');
  return { eligible: reasons.length === 0, reasons };
}

export async function syncTemplateRepo(repoPath, apply, options = {}, context) {
  const result = await syncTemplateRepository({
    repoPath,
    templateRoot: context.templateRoot,
    directoryNames: TEMPLATE_SYNC_DIRS,
    rootFiles: TEMPLATE_SYNC_ROOT_FILES,
    apply,
    adoptCurrentBaseline: options.adoptCurrentBaseline === true || options['adopt-current-baseline'] === true || options['adopt-baseline'] === true,
    reconcileOwnership: options.reconcileOwnership === true || options['reconcile-ownership'] === true,
  });
  const actions = [...(result.actions || [])];
  const orchestrationBlocked = (result.blockedModules || []).includes('core-orchestration');
  if (!result.globalBlocked && !orchestrationBlocked) await refreshConfiguredEntryFiles(repoPath, apply, actions);
  return {
    ...result,
    repo: repoPath,
    apply,
    actions,
    actionSummary: summarizeActions(actions),
  };
}

export async function commandRepoRefreshEntries(options) {
  if (!options.repo) throw new Error('repo refresh-entries requires --repo <dir>');
  const repo = path.resolve(String(options.repo));
  const result = await refreshConfiguredEntryFiles(repo, isApply(options));
  output({ ...result, actionSummary: summarizeActions(result.actions) }, options, (data) => {
    console.log(`${data.apply ? 'Applied' : 'Dry-run'} entry refresh for ${data.repo}`);
    console.log(`Actions: ${formatActionTotals(data.actionSummary)}`);
  });
}

export async function commandRepoSyncTemplate(options, context) {
  if (!options.repo) throw new Error('repo sync-template requires --repo <dir>');
  const repo = path.resolve(String(options.repo));
  await assertAdoptedTemplateSyncTarget(repo);
  const result = await syncTemplateRepo(repo, isApply(options), options, context);
  output(result, options, (data) => {
    const outcome = data.globalBlocked
      ? 'Blocked'
      : data.apply && data.partial
        ? 'Partially applied'
        : data.apply
          ? 'Applied'
          : data.partial
            ? 'Partial dry-run'
            : 'Dry-run';
    console.log(`${outcome} template sync for ${data.repo}`);
    console.log(`Source: ${data.source.templateId || 'unknown'} ${data.source.version || ''} revision=${data.source.revision}`);
    console.log(`Blocked: ${data.blocked ? 'yes' : 'no'}`);
    if (data.blockedModules?.length) console.log(`Deferred modules: ${data.blockedModules.join(', ')}`);
    console.log(`Actions: ${formatActionTotals(data.actionSummary)}`);
  });
  if (result.blocked) process.exitCode = 1;
}

async function runBatchSyncTemplate(options, context) {
  const apply = isApply(options);
  const root = path.resolve(String(options.root || '..'));
  const adoptCurrentBaseline = options['adopt-current-baseline'] === true || options['adopt-baseline'] === true;
  const reconcileOwnership = options['reconcile-ownership'] === true || options.reconcileOwnership === true;
  const repos = await findGitRepos(root, options.recursive === true);
  const results = await mapWithConcurrency(repos, DEFAULT_SCAN_CONCURRENCY, async (repo) => {
    const status = await scanRepo(repo);
    const eligibility = syncTemplateEligibility(status);
    if (!eligibility.eligible) {
      return {
        repo,
        name: path.basename(repo),
        group: 'skipped',
        skipped: true,
        reasons: eligibility.reasons,
      };
    }
    const result = await syncTemplateRepo(repo, apply, { ...options, adoptCurrentBaseline, reconcileOwnership }, context);
    return { name: path.basename(repo), group: 'synced', ...result };
  });
  const processedCount = results.filter((result) => result.group === 'synced').length;
  const skippedCount = results.length - processedCount;
  const blockedCount = results.filter((result) => result.blocked).length;
  const partialCount = results.filter((result) => result.partial).length;

  return {
    root,
    apply,
    adoptCurrentBaseline,
    reconcileOwnership,
    count: repos.length,
    processedCount,
    skippedCount,
    blockedCount,
    partialCount,
    results,
    ...summarizeSyncResults(results),
  };
}

export async function commandBatchSyncTemplate(options, context) {
  const data = await runBatchSyncTemplate(options, context);
  output(data, options, printSyncTemplateSummary);
  if (data.blockedCount > 0) process.exitCode = 1;
}

function workspaceUsesCurrentTemplate(workspace, templateRealpath, context) {
  return workspaceUsesTemplate(workspace, { templateId: context.templateId, templateRealpath });
}

async function registeredTemplateWorkspaceRoots(context) {
  const registryDir = path.join(context.templateRoot, 'registry');
  const registry = await mergeRegistryAuthorityRecords(registryDir, null);
  const deviceId = currentDeviceId();
  const templateRealpath = normalizeRel(context.runtimeLocation.templateRealpath || safeRealpath(context.templateRoot));
  const rootsByPath = new Map();
  const addIfBound = (workspace) => {
    if (workspace?.active === false || workspace?.status === 'retired') return;
    if (workspaceUsesCurrentTemplate(workspace, templateRealpath, context)) {
      addWorkspaceRoot(rootsByPath, workspace.path || workspace.workspacePath);
    }
  };

  for (const device of registry.devices.devices || []) {
    if (device.deviceId !== deviceId) continue;
    for (const workspace of workspaceRecordsForDevice(device)) addIfBound(workspace);
  }

  for (const workspace of registry.projects.workspaces || []) {
    if ((workspace.deviceId || registry.projects.deviceId) === deviceId) addIfBound(workspace);
  }

  return [...rootsByPath.values()].sort((a, b) => a.localeCompare(b));
}

async function workspaceSyncTemplateRoots(options, context) {
  const rootsByPath = new Map();
  const templateConfig = normalizeConfig(JSON.parse(await readText(path.join(context.templateRoot, 'config.json'), '{}')));
  const currentOnly = options['current-only'] === true;
  const configuredDefaultRoot = resolveWorkspaceConfigRoot(templateConfig.workspace.defaultRoot || '..', context.templateRoot);
  const defaultRoot = options.root || context.runtimeWorkspaceRoots[0] || configuredDefaultRoot;

  addWorkspaceRoot(rootsByPath, defaultRoot);

  if (!currentOnly) {
    for (const root of context.runtimeWorkspaceRoots) addWorkspaceRoot(rootsByPath, root);
    if (!context.runtimeWorkspaceRoots.length) {
      for (const extraRoot of templateConfig.workspace.additionalRoots || []) {
        addWorkspaceRoot(rootsByPath, resolveWorkspaceConfigRoot(extraRoot, context.templateRoot));
      }
    }

    for (const root of await registeredTemplateWorkspaceRoots(context)) addWorkspaceRoot(rootsByPath, root);
  }

  return [...rootsByPath.values()].sort((a, b) => a.localeCompare(b));
}

export async function commandWorkspaceSyncTemplate(options, context) {
  const roots = await workspaceSyncTemplateRoots(options, context);
  const results = [];
  const missingRoots = [];
  let processedCount = 0;
  let skippedCount = 0;
  let blockedCount = 0;
  const actionTotals = {};
  const reposWithConflicts = [];
  const reposWithCopies = [];
  const reposWithWrites = [];

  for (const root of roots) {
    const rootStatus = await workspaceRootStatus(root);
    if (!rootStatus.available) {
      missingRoots.push(rootStatus);
      results.push({ root, missing: true, skipped: true, reason: rootStatus.reason });
      continue;
    }
    const result = await runBatchSyncTemplate({ ...options, root }, context);
    results.push(result);
    processedCount += result.processedCount;
    skippedCount += result.skippedCount;
    blockedCount += result.blockedCount || 0;
    for (const [key, value] of Object.entries(result.actionTotals || {})) actionTotals[key] = (actionTotals[key] || 0) + value;
    for (const item of result.reposWithConflicts || []) reposWithConflicts.push({ ...item, root });
    for (const item of result.reposWithCopies || []) reposWithCopies.push({ ...item, root });
    for (const item of result.reposWithWrites || []) reposWithWrites.push({ ...item, root });
  }

  const result = {
    status: blockedCount > 0 ? 'blocked' : missingRoots.length ? 'partial' : 'pass',
    roots,
    apply: isApply(options),
    adoptCurrentBaseline: options['adopt-current-baseline'] === true || options['adopt-baseline'] === true,
    workspaceCount: roots.length,
    availableWorkspaceCount: roots.length - missingRoots.length,
    missingWorkspaceCount: missingRoots.length,
    missingRoots,
    processedCount,
    skippedCount,
    blockedCount,
    actionTotals,
    reposWithConflicts,
    reposWithCopies,
    reposWithWrites,
    results,
  };
  output(result, options, (data) => {
    const outcome = data.status === 'blocked'
      ? 'Blocked'
      : data.status === 'partial'
        ? 'Partial'
        : data.apply ? 'Applied' : 'Dry-run';
    console.log(`${outcome} registered workspace template sync`);
    console.log(`Workspaces: ${data.workspaceCount} (${data.missingWorkspaceCount} unavailable)`);
    for (const root of data.roots) console.log(`- ${root}`);
    for (const item of data.missingRoots) console.log(`- unavailable ${item.root}: ${item.reason}`);
    console.log(`Processed adopted repositories: ${data.processedCount}`);
    console.log(`Skipped repositories: ${data.skippedCount}`);
    console.log(`Blocked repositories: ${data.blockedCount}`);
    console.log(`Actions: ${formatActionTotals(data.actionTotals)}`);
    console.log(`Repos with copies: ${formatNameCountList(data.reposWithCopies, 'copies')}`);
    console.log(`Repos with conflicts: ${formatNameCountList(data.reposWithConflicts, 'conflicts')}`);
  });
  if (missingRoots.length || blockedCount > 0) process.exitCode = 1;
}

async function assessBatchRepo(repo, options, context) {
  const [status, git] = await Promise.all([
    scanRepo(repo),
    inspectGitWriteReadiness(repo, options.fetch === true),
  ]);
  const audit = await auditRepo(repo, status);
  const errorIssues = audit.issues.filter((issue) => issue.severity === 'error');
  const reasons = [];
  if (status.configMalformed) reasons.push('malformed config');
  const targetProfile = status.adoptionProfile
    || normalizeAdoptionProfile(options.profile, options.maturity);
  const requiresAnchors = targetProfile === 'full';
  if (requiresAnchors && !status.sourceRoots.length) reasons.push('full profile selected but no source roots detected');
  if (requiresAnchors && status.anchorTargets.length > 30) reasons.push(`high automatic anchor count: ${status.anchorTargets.length}`);
  if (requiresAnchors && status.anchorCandidates.length > MAX_READY_ANCHOR_CANDIDATES) reasons.push(`high anchor candidate count: ${status.anchorCandidates.length}`);
  if (errorIssues.length && status.hasDevRulesInstance) reasons.push(`${errorIssues.length} existing devrules error(s)`);

  const profileRequirementsMet = status.hasDevRulesInstance
    && status.hasManifest
    && status.entryBindings.AGENTS.valid
    && (!requiresAnchors || (status.maturityLevel >= 3 && status.missingAnchors.length === 0));
  const compliant = profileRequirementsMet && errorIssues.length === 0;
  const item = {
    repo,
    name: path.basename(repo),
    maturityLevel: status.maturityLevel,
    adoptionProfile: targetProfile,
    satisfiesRequirements: compliant,
    complianceStatus: compliant
      ? 'compliant'
      : status.hasDevRulesInstance
        ? 'incomplete-instance'
        : 'not-adopted',
    sourceRoots: status.sourceRoots,
    anchorTargets: status.anchorTargets.length,
    anchorCandidates: status.anchorCandidates.length,
    hasDevRulesInstance: status.hasDevRulesInstance,
    hasAgents: status.hasAgents,
    hasClaude: status.hasClaude,
    git,
    gitReady: git.ready,
    gitLocallyReady: git.locallyReady,
    gitFreshness: git.freshness,
    gitReasons: git.reasons,
    actionSummary: summarizeActions([]),
    reasons,
  };

  if (compliant) {
    return { group: 'alreadyReady', item, status, audit };
  }
  if (reasons.length) {
    return { group: 'needsReview', item, status, audit };
  }
  const dryRun = await initializeRepo(repo, {
    ...options,
    apply: false,
    'dry-run': true,
    'sync-template': status.hasDevRulesInstance,
  }, context);
  item.actionSummary = summarizeActions(dryRun.actions);
  return { group: 'readyToApply', item, status, audit };
}

async function buildBatchReadiness(root, options, context) {
  const repos = await findGitRepos(root, options.recursive === true);
  const groups = {
    alreadyReady: [],
    readyToApply: [],
    needsReview: [],
    gitReady: [],
    deferredGit: [],
  };
  const assessments = await mapWithConcurrency(repos, DEFAULT_SCAN_CONCURRENCY, (repo) => assessBatchRepo(repo, options, context));

  for (const assessment of assessments) {
    groups[assessment.group].push(assessment.item);
    if (assessment.group === 'readyToApply') {
      groups[assessment.item.gitReady ? 'gitReady' : 'deferredGit'].push(assessment.item);
    }
  }

  return {
    root,
    count: repos.length,
    groups,
    assessments,
    summary: {
      alreadyReady: groups.alreadyReady.length,
      readyToApply: groups.readyToApply.length,
      needsReview: groups.needsReview.length,
      gitReady: groups.gitReady.length,
      deferredGit: groups.deferredGit.length,
      gitLocallyReady: groups.readyToApply.filter((item) => item.gitLocallyReady).length,
      gitFreshnessUnchecked: groups.readyToApply.filter((item) => item.gitFreshness === 'unchecked').length,
      gitFetchFailed: groups.readyToApply.filter((item) => item.gitFreshness === 'failed').length,
    },
  };
}

export async function commandBatchReadiness(options, context) {
  const root = path.resolve(String(options.root || '..'));
  const readiness = await buildBatchReadiness(root, options, context);
  const data = {
    root: readiness.root,
    count: readiness.count,
    groups: readiness.groups,
    summary: readiness.summary,
  };
  output(data, options, (formatted) => {
    console.log(`Batch readiness for ${formatted.count} repositories under ${formatted.root}`);
    console.log(`Already compliant: ${formatted.summary.alreadyReady}`);
    console.log(`Not compliant but safe to apply: ${formatted.summary.readyToApply}`);
    console.log(`Needs review: ${formatted.summary.needsReview}`);
    console.log(`Git write gate: verified=${formatted.summary.gitReady}, deferred=${formatted.summary.deferredGit}, freshness-unchecked=${formatted.summary.gitFreshnessUnchecked}`);
    if (formatted.groups.readyToApply.length) {
      console.log('\nNot compliant but safe to apply:');
      for (const item of formatted.groups.readyToApply) {
        console.log(`- ${item.name}: ${item.complianceStatus}, level ${item.maturityLevel}, missing ${item.anchorTargets} anchor target(s), Git ${item.gitReady ? 'verified-ready' : `deferred (${item.gitFreshness})`}`);
      }
    }
    if (formatted.groups.needsReview.length) {
      console.log('\nNeeds review:');
      for (const item of formatted.groups.needsReview) console.log(`- ${item.name}: ${item.reasons.join('; ')}`);
    }
  });
}

export async function commandBatchApplyReady(options, context) {
  const apply = isApply(options);
  const root = path.resolve(String(options.root || '..'));
  const readiness = await buildBatchReadiness(root, options, context);
  const results = [];

  for (const assessment of readiness.assessments) {
    if (assessment.group === 'readyToApply') {
      // A dry-run may plan against locally clean/equal state while clearly
      // marking remote freshness unchecked. A real write always fetches and
      // rechecks immediately before initializeRepo is allowed to mutate files.
      const git = apply
        ? await inspectGitWriteReadiness(assessment.item.repo, true)
        : assessment.item.git;
      const uncheckedDryRun = !apply
        && options.fetch !== true
        && git.locallyReady
        && git.freshness === 'unchecked';
      if (!git.ready && !uncheckedDryRun) {
        results.push({
          repo: assessment.item.repo,
          group: 'deferredGit',
          candidateGroup: assessment.group,
          skipped: true,
          git,
          gitReady: false,
          gitFreshness: git.freshness,
          reasons: git.reasons,
        });
        continue;
      }
      const result = await initializeRepo(assessment.item.repo, {
        ...options,
        apply,
        'dry-run': !apply,
        'sync-template': assessment.status.hasDevRulesInstance,
      }, context);
      results.push({
        group: assessment.group,
        git,
        gitReady: git.ready,
        gitFreshness: git.freshness,
        planOnly: uncheckedDryRun,
        ...result,
      });
    } else {
      results.push({
        repo: assessment.item.repo,
        group: assessment.group,
        skipped: true,
        git: assessment.item.git,
        gitReady: assessment.item.gitReady,
        gitFreshness: assessment.item.gitFreshness,
        reasons: assessment.item.reasons,
      });
    }
  }

  const processed = results.filter((result) => result.group === 'readyToApply' && !result.skipped);
  const deferredGit = results.filter((result) => result.group === 'deferredGit');

  output({
    root,
    apply,
    count: readiness.count,
    summary: readiness.summary,
    appliedCount: processed.filter((result) => !result.blocked).length,
    readyProcessedCount: processed.length,
    deferredGitCount: deferredGit.length,
    gitVerifiedCount: processed.filter((result) => result.gitReady).length,
    gitUncheckedPlanCount: processed.filter((result) => result.planOnly).length,
    skippedAlreadyReady: readiness.groups.alreadyReady.length,
    skippedNeedsReview: readiness.groups.needsReview.length,
    results,
  }, options, (data) => {
    console.log(`${data.apply ? 'Applied' : 'Dry-run'} batch initialization for ready repositories under ${data.root}`);
    console.log(`Initialization candidates processed: ${data.readyProcessedCount}`);
    console.log(`Git verified: ${data.gitVerifiedCount}; Git deferred: ${data.deferredGitCount}; unchecked dry-run plans: ${data.gitUncheckedPlanCount}`);
    console.log(`Skipped already compliant: ${data.skippedAlreadyReady}`);
    console.log(`Skipped needs review: ${data.skippedNeedsReview}`);
    if (data.deferredGitCount) {
      console.log('\nDeferred by Git write gate:');
      for (const result of data.results.filter((item) => item.group === 'deferredGit')) {
        console.log(`- ${path.basename(result.repo)}: ${result.reasons.join('; ')}`);
      }
    }
    if (data.skippedNeedsReview) {
      console.log('\nNeeds review before apply:');
      for (const result of data.results.filter((item) => item.group === 'needsReview')) {
        console.log(`- ${path.basename(result.repo)}: ${result.reasons.join('; ')}`);
      }
    }
  });
}

export async function workspaceOptions(options, context) {
  if (options.root) return { ...options, root: path.resolve(String(options.root)) };
  const templateConfig = normalizeConfig(JSON.parse(await readText(path.join(context.templateRoot, 'config.json'))));
  const configuredRoot = resolveWorkspaceConfigRoot(templateConfig.workspace.defaultRoot || '..', context.templateRoot);
  return {
    ...options,
    root: path.resolve(context.runtimeWorkspaceRoots[0] || configuredRoot),
    recursive: options.recursive === true || templateConfig.workspace.recursive === true,
  };
}
