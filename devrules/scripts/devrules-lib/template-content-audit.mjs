import { syncTemplateRepository } from './template-sync.mjs';

const CONTENT_CHANGE_ACTIONS = new Set(['copy', 'delete']);
const BLOCKING_ACTIONS = new Set(['blocked', 'conflict']);
const SYNC_STATE_PATH = '.template-sync.json';

function sourceIdentity(source) {
  source = source || {};
  const hasRevision = source.revision !== undefined && source.revision !== null && source.revision !== '';
  return {
    templateId: source.templateId || '',
    version: source.version || '',
    revision: hasRevision && Number.isFinite(Number(source.revision)) ? Number(source.revision) : null,
    commit: source.commit || '',
    manifestHash: source.manifestHash || '',
  };
}

function publicChange(action) {
  return {
    action: action.action,
    templatePath: action.templatePath || '',
    reason: action.reason || '',
  };
}

function countCheckedFiles(actions) {
  return new Set(actions
    .map((action) => action.templatePath || '')
    .filter((templatePath) => templatePath && templatePath !== SYNC_STATE_PATH)).size;
}

function comparisonStatus({ blockerCount, conflictCount, contentChangeCount, stateChangeCount }) {
  if (blockerCount > 0) return 'blocked';
  if (conflictCount > 0) return 'conflict';
  if (contentChangeCount > 0 || stateChangeCount > 0) return 'update-available';
  return 'current';
}

function nextStep(status) {
  if (status === 'update-available') {
    return 'Review the repo sync-template dry-run, then rerun it with --apply after accepting the plan.';
  }
  if (status === 'conflict') {
    return 'Review the repo sync-template dry-run and resolve project/template ownership conflicts before applying.';
  }
  if (status === 'blocked') {
    return 'Restore trusted template and sync-state provenance before relying on the repository audit.';
  }
  return '';
}

function summarizeTemplateContentPlan(plan) {
  const actions = plan.actions || [];
  const contentChanges = actions.filter((action) => CONTENT_CHANGE_ACTIONS.has(action.action));
  const conflicts = actions.filter((action) => action.action === 'conflict');
  const blockers = actions.filter((action) => action.action === 'blocked');
  const stateChanges = actions.filter((action) => (
    action.action !== 'skip'
    && !CONTENT_CHANGE_ACTIONS.has(action.action)
    && !BLOCKING_ACTIONS.has(action.action)
  ));
  const preservedProjectFiles = actions.filter((action) => (
    action.action === 'skip' && /preserve project-owned|project-owned local deletion/i.test(action.reason || '')
  ));
  const summary = {
    checkedFileCount: countCheckedFiles(actions),
    contentChangeCount: contentChanges.length,
    stateChangeCount: stateChanges.length,
    conflictCount: conflicts.length,
    blockerCount: blockers.length,
    preservedProjectFileCount: preservedProjectFiles.length,
  };
  const status = comparisonStatus(summary);

  return {
    schemaVersion: 1,
    status,
    repo: plan.repo,
    templateRoot: plan.templateRoot,
    source: sourceIdentity(plan.source),
    baseline: sourceIdentity(plan.previousSource),
    summary,
    changes: actions
      .filter((action) => action.action !== 'skip')
      .map(publicChange),
    nextStep: nextStep(status),
  };
}

export async function auditTemplateContent(options) {
  try {
    const plan = await syncTemplateRepository({
      repoPath: options.repoPath,
      templateRoot: options.templateRoot,
      directoryNames: options.directoryNames,
      rootFiles: options.rootFiles,
      apply: false,
    });
    return summarizeTemplateContentPlan(plan);
  } catch (error) {
    return summarizeTemplateContentPlan({
      repo: options.repoPath,
      templateRoot: options.templateRoot,
      source: {},
      previousSource: {},
      actions: [{
        action: 'blocked',
        templatePath: '',
        reason: `template content preflight unavailable: ${error.message}`,
      }],
    });
  }
}

export function templateContentAuditIssue(comparison) {
  const { summary } = comparison;
  if (comparison.status === 'update-available') {
    return {
      severity: 'warn',
      message: `Project devrules differs from the shared template: ${summary.contentChangeCount} content change(s) and ${summary.stateChangeCount} sync-state change(s) are pending.`,
    };
  }
  if (comparison.status === 'conflict') {
    return {
      severity: 'error',
      message: `Project devrules has ${summary.conflictCount} template synchronization conflict(s); resolve them before treating this audit as current.`,
    };
  }
  if (comparison.status === 'blocked') {
    return {
      severity: 'error',
      message: `Project/template comparison is blocked by ${summary.blockerCount} provenance or authority problem(s); the audit cannot prove this devrules instance is current.`,
    };
  }
  return null;
}

function displayPath(change) {
  return change.templatePath ? `devrules/${change.templatePath}` : '<template authority>';
}

function displayAction(action) {
  if (action === 'copy') return 'update';
  if (action === 'write' || action === 'adopt-baseline' || action === 'remove-baseline') return 'state';
  return action;
}

export function formatTemplateContentAudit(comparison, options = {}) {
  const maxChanges = options.maxChanges ?? 20;
  const { source, baseline, summary } = comparison;
  const sourceCommit = source.commit ? source.commit.slice(0, 12) : 'unknown';
  const lines = [
    `Template content preflight: ${comparison.status.toUpperCase().replaceAll('-', ' ')}`,
    `Template source: ${source.templateId || 'unknown'} ${source.version || ''} revision=${source.revision ?? 'unknown'} commit=${sourceCommit}`,
    `Template-managed files: checked=${summary.checkedFileCount}, content changes=${summary.contentChangeCount}, sync-state changes=${summary.stateChangeCount}, conflicts=${summary.conflictCount}, blockers=${summary.blockerCount}`,
  ];
  if (baseline.commit) {
    lines.push(`Project template baseline: ${baseline.version || 'unknown'} revision=${baseline.revision ?? 'unknown'} commit=${baseline.commit.slice(0, 12)}`);
  } else {
    lines.push('Project template baseline: unavailable');
  }
  for (const change of comparison.changes.slice(0, maxChanges)) {
    lines.push(`- [${displayAction(change.action)}] ${displayPath(change)}: ${change.reason}`);
  }
  if (comparison.changes.length > maxChanges) {
    lines.push(`- ... ${comparison.changes.length - maxChanges} more template comparison finding(s)`);
  }
  if (comparison.nextStep) lines.push(`Next: ${comparison.nextStep}`);
  return lines;
}
