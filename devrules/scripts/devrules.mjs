#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runDeveloperServicesCommand } from './developer-services-registry.mjs';
import { formatCliHelp } from './devrules-lib/cli-help.mjs';
import { isApply, output } from './devrules-lib/cli-io.mjs';
import {
  resolveRuntimeLocation,
  runRuntimeLocationCommand,
} from './devrules-lib/runtime-location.mjs';
import { createHandoffRecord, inspectGitRepository } from './devrules-lib/git-repository.mjs';
import { runGitPublishReadinessCommand } from './devrules-lib/git-publish-readiness-command.mjs';
import { currentDeviceId } from './devrules-lib/device-registry.mjs';
import {
  commandRegistryInspect,
  commandRegistryRefresh,
  commandRegistryRetire,
} from './devrules-lib/registry-command.mjs';
import {
  buildSkillsRegistry,
  commandSkillsList,
  commandSkillsRecommend,
  defaultSkillRoots,
} from './devrules-lib/skills-registry.mjs';
import { commandTerminalAudit } from './devrules-lib/terminal-audit.mjs';
import { DEFAULT_ADOPTION_PROFILE } from './devrules-lib/repo-config.mjs';
import {
  findGitRepos,
  isGitRepo,
} from './devrules-lib/repo-discovery.mjs';
import {
  fetchTemplateSource,
  templateAuthorityIssues,
} from './devrules-lib/template-authority.mjs';
import {
  collectManagedTemplateFiles,
  readTemplateSource,
  recoverTemplateSyncTransaction,
} from './devrules-lib/template-sync.mjs';
import {
  TEMPLATE_SYNC_DIRS,
  TEMPLATE_SYNC_ROOT_FILES,
  commandAudit,
  commandInit,
  commandScan,
  scanRepo,
} from './devrules-lib/repo-init-audit.mjs';
import {
  DEFAULT_SCAN_CONCURRENCY,
  commandBatchApplyReady,
  commandBatchReadiness,
  commandBatchSyncTemplate,
  commandRepoRefreshEntries,
  commandRepoSyncTemplate,
  commandWorkspaceSyncTemplate,
  syncTemplateEligibility,
  workspaceOptions,
} from './devrules-lib/batch-workspace.mjs';
import {
  commandEvolutionCollect,
  commandMemoryCompact,
} from './devrules-lib/memory-evolution.mjs';
import {
  renderTemplateAutoUpdateResult,
  runTemplateAutoUpdateCommand,
} from './devrules-lib/template-auto-update-command.mjs';
const VERSION = '4.0.7';
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const FALLBACK_TEMPLATE_ROOT = path.resolve(SCRIPT_DIR, '..');
const RUNTIME_LOCATION = await resolveRuntimeLocation({ fallbackTemplateRoot: FALLBACK_TEMPLATE_ROOT });
const TEMPLATE_ROOT = RUNTIME_LOCATION.templateRoot;
const RUNTIME_WORKSPACE_ROOTS = RUNTIME_LOCATION.workspaceRoots || [];
const TEMPLATE_MANIFEST = await fs.readFile(path.join(TEMPLATE_ROOT, 'template.json'), 'utf8')
  .then((content) => JSON.parse(content))
  .catch(() => ({}));
const TEMPLATE_ID = String(TEMPLATE_MANIFEST.templateId || '');

const CLI_CONTEXT = {
  version: VERSION,
  templateRoot: TEMPLATE_ROOT,
  templateId: TEMPLATE_ID,
  runtimeLocation: RUNTIME_LOCATION,
  runtimeWorkspaceRoots: RUNTIME_WORKSPACE_ROOTS,
};

function parseArgs(argv) {
  const positionals = [];
  const options = {};

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      positionals.push(arg);
      continue;
    }

    const raw = arg.slice(2);
    const eqIndex = raw.indexOf('=');
    if (eqIndex !== -1) {
      options[raw.slice(0, eqIndex)] = raw.slice(eqIndex + 1);
      continue;
    }

    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      options[raw] = next;
      i += 1;
    } else {
      options[raw] = true;
    }
  }

  return { positionals, options };
}

function printHelp() {
  console.log(formatCliHelp({ version: VERSION, defaultAdoptionProfile: DEFAULT_ADOPTION_PROFILE }));
}

function registryCommandContext() {
  return {
    templateId: TEMPLATE_ID,
    templateRoot: TEMPLATE_ROOT,
    templateRealpath: RUNTIME_LOCATION.templateRealpath,
    defaultSkillRoots,
    scanConcurrency: DEFAULT_SCAN_CONCURRENCY,
    scanRepo,
    syncTemplateEligibility,
    buildSkillsRegistry,
    workspaceOptions: (options) => workspaceOptions(options, CLI_CONTEXT),
    isApply,
    output,
  };
}

async function commandRepoPreflight(options) {
  if (!options.repo) throw new Error('repo preflight requires --repo <dir>');
  const result = await inspectGitRepository(path.resolve(String(options.repo)), {
    fetch: options.fetch === true,
    expectedSha: options['expect-sha'] || '',
  });
  output(result, options, (data) => {
    console.log(`Git preflight: ${data.repo}`);
    console.log(`State: ${data.state}`);
    console.log(`Branch: ${data.branch || 'DETACHED'} -> ${data.upstream || 'NO UPSTREAM'}`);
    console.log(`Commit: ${data.head || 'unknown'} (ahead=${data.ahead || 0}, behind=${data.behind || 0}, dirty=${data.dirtyCount || 0})`);
    if (!data.fetch?.attempted) console.log('Remote freshness: unchecked (rerun with --fetch before cross-device work)');
    for (const reason of data.reasons || []) console.log(`- ${reason}`);
    for (const action of data.actions || []) console.log(`  action: ${action}`);
  });
}

async function commandRepoHandoff(options) {
  if (!options.repo) throw new Error('repo handoff requires --repo <dir>');
  const result = await createHandoffRecord(path.resolve(String(options.repo)), {
    fetch: options.fetch === true,
    allowStale: options['allow-stale'] === true,
    deviceId: currentDeviceId(),
  });
  output(result, options, (data) => {
    console.log(`Git handoff: ${data.ready ? 'ready' : 'blocked'}`);
    console.log(`Branch: ${data.branch || 'DETACHED'}`);
    console.log(`Commit: ${data.commit || 'unknown'}`);
    for (const reason of data.reasons || []) console.log(`- ${reason}`);
    if (data.ready) console.log(`Next device: ${data.nextDeviceCommand}`);
  });
}

async function commandWorkspaceGitStatus(options) {
  const root = path.resolve(String(options.root || path.dirname(TEMPLATE_ROOT)));
  const repoSet = new Set(await findGitRepos(root, options.recursive === true));
  if (await isGitRepo(root)) repoSet.add(root);
  const templateRelative = path.relative(root, TEMPLATE_ROOT);
  const templateInsideRoot = templateRelative === ''
    || (!templateRelative.startsWith('..') && !path.isAbsolute(templateRelative));
  if (templateInsideRoot && await isGitRepo(TEMPLATE_ROOT)) repoSet.add(TEMPLATE_ROOT);
  const repos = [...repoSet].sort((a, b) => a.localeCompare(b));
  const results = [];
  for (const repo of repos) {
    results.push(await inspectGitRepository(repo, {
      fetch: options.fetch === true,
      expectedSha: '',
    }));
  }
  const summary = {
    total: results.length,
    ready: results.filter((item) => item.state === 'ready').length,
    handoffRequired: results.filter((item) => item.state === 'handoff-required').length,
    blocked: results.filter((item) => item.state === 'blocked').length,
    dirty: results.filter((item) => item.dirty).length,
    diverged: results.filter((item) => item.ahead > 0 && item.behind > 0).length,
  };
  output({ schemaVersion: 1, root, fetch: options.fetch === true, summary, results }, options, (data) => {
    console.log(`Workspace Git status: ${data.root}`);
    console.log(`ready=${data.summary.ready}, handoff-required=${data.summary.handoffRequired}, blocked=${data.summary.blocked}, dirty=${data.summary.dirty}`);
    for (const item of data.results) {
      console.log(`- ${path.basename(item.repo)}: ${item.state} (${item.branch || 'DETACHED'}, ahead=${item.ahead || 0}, behind=${item.behind || 0}, dirty=${item.dirtyCount || 0})`);
    }
  });
}

async function commandTemplateStatus(options) {
  const managedFiles = await collectManagedTemplateFiles(TEMPLATE_ROOT, TEMPLATE_SYNC_DIRS, TEMPLATE_SYNC_ROOT_FILES);
  const fetchResult = options.fetch === true ? await fetchTemplateSource(TEMPLATE_ROOT) : null;
  const source = await readTemplateSource(TEMPLATE_ROOT, managedFiles, {
    verifyRemoteTag: fetchResult?.ok === true,
  });
  const issues = templateAuthorityIssues(source, {
    mode: 'runtime',
    fetchFailed: fetchResult?.ok === false,
    remoteVerificationRequested: options.fetch === true,
  }).map((problem) => problem.message);
  const result = {
    schemaVersion: 1,
    templateRoot: TEMPLATE_ROOT,
    runtimeLocation: RUNTIME_LOCATION,
    managedFileCount: managedFiles.length,
    source,
    readyForApply: source.authoritative,
    readyForRemoteHandoff: source.remoteAuthoritative,
    remoteVerificationRequested: options.fetch === true,
    issues,
  };
  output(result, options, (data) => {
    console.log(`Template authority: ${data.readyForApply ? 'ready' : 'blocked'}`);
    console.log(`Template: ${data.source.templateId || 'unknown'} ${data.source.version || ''} revision=${data.source.revision}`);
    console.log(`Commit: ${data.source.commit || 'none'}`);
    console.log(`Remote: ${data.source.remote || 'none'}`);
    console.log(`Remote release verification: ${data.remoteVerificationRequested ? data.readyForRemoteHandoff ? 'ready' : 'blocked' : 'not requested (use --fetch)'}`);
    for (const issue of data.issues) console.log(`- ${issue}`);
  });
}

async function commandTemplateReleaseAudit(options) {
  const managedFiles = await collectManagedTemplateFiles(TEMPLATE_ROOT, TEMPLATE_SYNC_DIRS, TEMPLATE_SYNC_ROOT_FILES);
  const fetchResult = await fetchTemplateSource(TEMPLATE_ROOT);
  const source = await readTemplateSource(TEMPLATE_ROOT, managedFiles, {
    verifyRemoteTag: fetchResult.ok === true,
  });
  const issues = templateAuthorityIssues(source, {
    mode: 'release',
    fetchFailed: fetchResult.ok !== true,
    remoteVerificationRequested: true,
  });
  const result = {
    schemaVersion: 1,
    command: 'template release-audit',
    status: issues.length ? 'fail' : 'pass',
    templateRoot: TEMPLATE_ROOT,
    managedFileCount: managedFiles.length,
    remoteVerification: {
      attempted: true,
      ok: fetchResult.ok === true,
    },
    source,
    issues,
  };
  output(result, options, (data) => {
    console.log(`Template release audit: ${data.status}`);
    console.log(`Template: ${data.source.templateId || 'unknown'} ${data.source.version || ''} revision=${data.source.revision}`);
    console.log(`Commit: ${data.source.commit || 'none'}`);
    console.log(`Remote: ${data.source.remote || 'none'}`);
    console.log(`Remote verification: ${data.remoteVerification.ok ? 'verified' : 'failed'}`);
    if (!data.issues.length) {
      console.log('Release authority verified.');
    } else {
      for (const issue of data.issues) console.log(`- [${issue.code}] ${issue.message}`);
    }
  });
  if (issues.length) process.exitCode = 1;
  return result;
}

async function commandRepoRecoverSync(options) {
  if (!options.repo) throw new Error('repo recover-sync requires --repo <dir>');
  if (!options.transaction) throw new Error('repo recover-sync requires --transaction <id>');
  const result = await recoverTemplateSyncTransaction(
    path.resolve(String(options.repo)),
    String(options.transaction),
    isApply(options),
  );
  output(result, options, (data) => {
    console.log(`${data.apply ? 'Applied' : 'Dry-run'} sync recovery ${data.transactionId} for ${data.repo}`);
    console.log(`Entries: ${data.entryCount}`);
    if (data.status) console.log(`Status: ${data.status}`);
  });
}

async function main() {
  const { positionals, options } = parseArgs(process.argv.slice(2));
  const [command, subcommand, action] = positionals;

  if (!command || command === 'help' || options.help) {
    printHelp();
    return;
  }

  if (command === 'scan') {
    await commandScan(options);
  } else if (command === 'init') {
    await commandInit(options, CLI_CONTEXT);
  } else if (command === 'audit') {
    await commandAudit(options, CLI_CONTEXT);
  } else if (command === 'repo' && subcommand === 'preflight') {
    await commandRepoPreflight(options);
  } else if (command === 'repo' && subcommand === 'publish-readiness') {
    await runGitPublishReadinessCommand(options, TEMPLATE_ROOT, TEMPLATE_MANIFEST, output);
  } else if (command === 'repo' && subcommand === 'handoff') {
    await commandRepoHandoff(options);
  } else if (command === 'repo' && subcommand === 'sync-template') {
    await commandRepoSyncTemplate(options, CLI_CONTEXT);
  } else if (command === 'repo' && subcommand === 'refresh-entries') {
    await commandRepoRefreshEntries(options);
  } else if (command === 'repo' && subcommand === 'recover-sync') {
    await commandRepoRecoverSync(options);
  } else if (command === 'location' && ['show', 'audit', 'configure', 'install-launcher'].includes(subcommand)) {
    const result = await runRuntimeLocationCommand(subcommand, {
      ...options,
      apply: isApply(options),
      templateRoot: options.templateRoot || options['template-root'],
      workspaceRoots: options.workspaceRoots || options['workspace-roots']
        || (options['workspace-root'] ? [options['workspace-root']] : undefined),
      configPath: options.configPath || options['config-path'],
      launcherPath: options.launcherPath || options['launcher-path'] || options.target,
      runtimeLocation: RUNTIME_LOCATION,
      fallbackTemplateRoot: FALLBACK_TEMPLATE_ROOT,
    });
    output(result, options, (data) => {
      console.log(`Runtime location ${data.command}: ${data.status}`);
      if (data.configPath) console.log(`Config: ${data.configPath}`);
      if (data.templateRoot) console.log(`Template: ${data.templateRoot}`);
      for (const root of data.workspaceRoots || data.configuration?.workspaceRoots || []) console.log(`Workspace: ${root}`);
      for (const check of data.checks || []) console.log(`- ${check.ok ? 'ok' : 'fail'} ${check.name}: ${check.path}${check.detail ? ` (${check.detail})` : ''}`);
      for (const action of data.actions || []) console.log(`- ${action.kind}: ${action.path}`);
    });
    if (subcommand === 'audit' && result.status === 'fail') process.exitCode = 1;
  } else if (command === 'template' && subcommand === 'status') {
    await commandTemplateStatus(options);
  } else if (command === 'template' && subcommand === 'release-audit') {
    await commandTemplateReleaseAudit(options);
  } else if (command === 'template' && subcommand === 'auto-update') {
    const result = await runTemplateAutoUpdateCommand(action || 'status', options, CLI_CONTEXT);
    output(result, options, (data) => console.log(renderTemplateAutoUpdateResult(data)));
    if (['failed', 'blocked', 'blocked-major', 'locked', 'invalid', 'opt-in-required'].includes(result.status)) process.exitCode = 1;
  } else if (command === 'registry' && subcommand === 'inspect') {
    await commandRegistryInspect(options, registryCommandContext());
  } else if (command === 'registry' && subcommand === 'refresh') {
    await commandRegistryRefresh(options, registryCommandContext());
  } else if (command === 'registry' && subcommand === 'retire') {
    await commandRegistryRetire(options, registryCommandContext());
  } else if (command === 'services' && ['init', 'validate', 'inspect', 'catalog'].includes(subcommand)) {
    await runDeveloperServicesCommand(subcommand, { ...options, apply: isApply(options) });
  } else if (command === 'skills' && subcommand === 'list') {
    await commandSkillsList(options, { output });
  } else if (command === 'skills' && subcommand === 'recommend') {
    await commandSkillsRecommend(options, { output });
  } else if (command === 'batch' && subcommand === 'readiness') {
    await commandBatchReadiness(options, CLI_CONTEXT);
  } else if (command === 'batch' && subcommand === 'apply-ready') {
    await commandBatchApplyReady(options, CLI_CONTEXT);
  } else if (command === 'batch' && subcommand === 'sync-template') {
    await commandBatchSyncTemplate(options, CLI_CONTEXT);
  } else if (command === 'workspace' && subcommand === 'scan') {
    await commandScan(await workspaceOptions(options, CLI_CONTEXT));
  } else if (command === 'workspace' && subcommand === 'readiness') {
    await commandBatchReadiness(await workspaceOptions(options, CLI_CONTEXT), CLI_CONTEXT);
  } else if (command === 'workspace' && subcommand === 'apply-ready') {
    await commandBatchApplyReady(await workspaceOptions(options, CLI_CONTEXT), CLI_CONTEXT);
  } else if (command === 'workspace' && subcommand === 'sync-template') {
    await commandWorkspaceSyncTemplate(options, CLI_CONTEXT);
  } else if (command === 'workspace' && subcommand === 'git-status') {
    await commandWorkspaceGitStatus(await workspaceOptions(options, CLI_CONTEXT));
  } else if (command === 'workspace' && subcommand === 'terminal-audit') {
    await commandTerminalAudit(await workspaceOptions(options, CLI_CONTEXT), { output });
  } else if (command === 'terminal-audit') {
    await commandTerminalAudit(options, { output });
  } else if (command === 'memory' && subcommand === 'compact') {
    await commandMemoryCompact(options);
  } else if (command === 'evolution' && subcommand === 'collect') {
    await commandEvolutionCollect(options, CLI_CONTEXT);
  } else if (command === 'idle') {
    const { spawnSync } = await import('node:child_process');
    const idleScript = path.join(SCRIPT_DIR, 'idle-resource-maintenance.mjs');
    const forwarded = process.argv.slice(process.argv.indexOf('idle') + 1);
    const result = spawnSync(process.execPath, [idleScript, ...forwarded], {
      stdio: 'inherit',
      windowsHide: true,
    });
    process.exitCode = result.status == null ? 1 : result.status;
  } else {
    throw new Error(`Unknown command: ${positionals.join(' ')}`);
  }
}

main().catch((error) => {
  console.error(`devrules error: ${error.message}`);
  process.exitCode = 1;
});
