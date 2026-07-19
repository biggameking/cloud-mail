import fs from 'node:fs/promises';
import path from 'node:path';
import { auditHookRegistries } from './hooks.mjs';
import { auditModelSupportMetadata } from './model-support.mjs';
import { auditGovernanceMetadata } from './governance-metadata.mjs';
import { auditGitHubActionsPolicy } from './github-actions-policy.mjs';
import {
  inspectCursorRule,
  renderCursorRoutingCard,
} from './cursor-routing-card.mjs';
import {
  bindConfiguredEntryFiles,
  countManagedBlocks,
  ensureCursorRoutingCard,
  resolveSafeProjectEntryFile,
  validateConfiguredEntryFiles,
} from './project-entry-files.mjs';
import {
  expectedFileAfter,
  normalizeRel,
  pathExists,
  readFileWithRetry,
  readText,
} from './fs-actions.mjs';
import {
  ensureHooks,
  ensureManifest,
  ensureMemory,
  projectProfileHasEmptyCommands,
  projectedAdoptionLevel,
  readExistingProjectFacts,
} from './instance-bootstrap.mjs';
import { normalizeLegacyStructures } from './legacy-normalization.mjs';
import {
  ensureReadmeAnchors,
  hasReadmeAnchor,
  pruneGeneratedReadmeAnchors,
  readmeAnchorHasPlaceholders,
} from './readme-anchors.mjs';
import {
  ADOPTION_LEVEL_BY_PROFILE,
  DEFAULT_ENTRY_BIND_IF_PRESENT_FILES,
  DEFAULT_ENTRY_CREATE_FILES,
  DEFAULT_MATURITY_LEVEL,
  adoptionProfileForLevel,
  asArray,
  ensureConfig,
  loadRepoConfig,
  normalizeAdoptionProfile,
  normalizeConfig,
} from './repo-config.mjs';
import { findGitRepos, isGitRepo } from './repo-discovery.mjs';
import { templateAuthorityIssues } from './template-authority.mjs';
import {
  collectManagedTemplateFiles,
  readTemplateSource,
} from './template-sync.mjs';
import { readInstalledTemplateModules } from './template-sync-policy.mjs';
import { runRepositoryAuditCommand } from './repository-audit-command.mjs';
import {
  classifySemanticModuleRoots,
  detectSourceRoots,
  detectStack,
  isGodotProject,
} from './stack-detection.mjs';
import { isApply, output } from './cli-io.mjs';
import { syncTemplateRepo } from './batch-workspace.mjs';

const REQUIRED_RULES = [
  'workflow-management.md',
  'agent-entry-priority.md',
  'first-principles-development.md',
  'context-fractal.md',
  'architecture-governance.md',
  'ios-account-data-model.md',
  'developer-service-registry-governance.md',
  'production-change-governance.md',
  'memory-governance.md',
  'script-governance.md',
  'system-maturity.md',
  'code-quality.md',
  'modularity-and-dependencies.md',
  'change-health.md',
];
const REQUIRED_WORK_SYSTEM_ASSETS = [
  'workflows/code-change.md',
  'workflows/template-auto-update.md',
  'workflows/product-architecture-review.md',
  'workflows/ios-account-data-architecture.md',
  'templates/product-architecture-brief.md',
  'templates/ios-account-data-decision.md',
];
const REQUIRED_PROFILES = [
  'README.md',
  'typescript-javascript.md',
  'rust.md',
  'python.md',
  'go.md',
  'swift.md',
];
const REQUIRED_SCRIPTS = [
  'code-health.mjs',
  'global-devrules.mjs',
  'code-health-selftest.mjs',
  'global-devrules-selftest.mjs',
  'device-maintenance-bootstrap-selftest.mjs',
  'idle-resource-maintenance.mjs',
  'idle-resource-maintenance-selftest.mjs',
  'devrules-lib/active-build-processes.mjs',
  'devrules-lib/device-maintenance-agent.mjs',
  'devrules-lib/repository-audit-command.mjs',
  'devrules-lib/template-content-audit.mjs',
  'cursor-routing-selftest.mjs',
  'cursor-entry-selftest.mjs',
  'devrules-lib/cursor-routing-card.mjs',
  'devrules-lib/project-entry-files.mjs',
  'devrules-lib/hooks.mjs',
  'devrules-lib/model-support.mjs',
  'devrules-lib/governance-metadata.mjs',
  'governance-v3-migrate.mjs',
  'governance-v3-selftest.mjs',
  'devrules-lib/github-actions-policy.mjs',
  'github-actions-policy-selftest.mjs',
  'devrules-sync-selftest.mjs',
  'batch-git-readiness-selftest.mjs',
  'registry-runtime-selftest.mjs',
  'template-authority-selftest.mjs',
  'template-sync-ownership-selftest.mjs',
  'template-sync-selective-selftest.mjs',
  'template-auto-update.mjs',
  'template-auto-update-selftest.mjs',
  'template-auto-update-agent-selftest.mjs',
  'template-auto-update-lock-selftest.mjs',
  'developer-services-registry.mjs',
  'developer-services-registry-selftest.mjs',
  'devrules-lib/cli-help.mjs',
  'devrules-lib/git-repository.mjs',
  'devrules-lib/git-publish-readiness.mjs', 'devrules-lib/git-publish-readiness-command.mjs', 'git-publish-readiness-selftest.mjs',
  'devrules-lib/template-authority.mjs',
  'devrules-lib/template-file-fingerprint.mjs',
  'devrules-lib/template-path-safety.mjs',
  'devrules-lib/template-sync.mjs',
  'devrules-lib/template-sync-policy.mjs',
  'devrules-lib/template-sync-state.mjs',
  'devrules-lib/template-sync-storage.mjs',
  'devrules-lib/template-sync-transaction.mjs',
  'devrules-lib/template-auto-update-agent.mjs',
  'devrules-lib/template-auto-update-command.mjs',
  'devrules-lib/template-auto-update-core.mjs',
  'devrules-lib/template-auto-update-lock.mjs',
  'devrules-lib/template-auto-update-project-state.mjs',
  'devrules-lib/template-auto-update-projects.mjs',
  'devrules-lib/template-auto-update-release.mjs',
  'devrules-lib/developer-services-contracts.mjs',
  'devrules-lib/developer-services-registry.mjs',
  'devrules-lib/developer-services-secret-scan.mjs',
  'devrules-lib/developer-services-validation.mjs',
  'devrules-lib/runtime-launcher-source.mjs',
  'devrules-lib/runtime-location.mjs',
  'devrules-lib/workspace-runtime.mjs',
  'runtime-location-selftest.mjs',
  'runtime-location.md',
];

export const DESIGN_ROOT_FILES = [
  'DESIGN.template.md',
  'DESIGN.example.md',
  'design-readme.md',
  'design.config.json',
  'design-guard.allow.json',
];

const REQUIRED_ROOT_FILES = ['always-readme.md'];
const REQUIRED_CONFIG = ['config.json'];

const REQUIRED_MEMORY = [
  'project-profile.md',
  'decisions.md',
  'interaction-log.md',
  'lessons.md',
  'evolution-suggestions.md',
];

const REQUIRED_HOOKS = [
  'README.md',
  'hooks.json',
  'codex-global-code-health-hook.mjs',
  'cursor-global-routing-hook.mjs',
  'cursor-routing-core.mjs',
  'device-maintenance-bootstrap-core.mjs',
];

const INSTALLABLE_MODULES = [
  'core-orchestration',
  'configuration',
  'core-rules',
  'workflow-management',
  'work-system-assets',
  'profiles',
  'design-system',
  'context-fractal',
  'hooks',
  'memory',
  'scripts',
];

const COPY_DIRS = ['rules', 'workflows', 'profiles', 'templates', 'scripts', 'design-styles'];
const COPY_ROOT_FILES = ['template.json', 'CHANGELOG.md', 'always-readme.md', ...DESIGN_ROOT_FILES];
export const TEMPLATE_SYNC_DIRS = ['rules', 'workflows', 'profiles', 'templates', 'scripts', 'hooks', 'design-styles'];
export const TEMPLATE_SYNC_ROOT_FILES = ['template.json', 'CHANGELOG.md', 'always-readme.md', ...DESIGN_ROOT_FILES];
const CURSOR_DEVRULES_RULE = '.cursor/rules/devrules.mdc';

function configuredEntryFiles(config) {
  return [...new Set([
    ...DEFAULT_ENTRY_CREATE_FILES,
    ...DEFAULT_ENTRY_BIND_IF_PRESENT_FILES,
    ...(config.entryFiles.create || []),
    ...(config.entryFiles.bindIfPresent || []),
  ].map(normalizeRel))];
}

async function scanEntryFiles(repoPath, config) {
  const statuses = {};
  for (const entryRel of configuredEntryFiles(config)) {
    try {
      const { target: filePath } = await resolveSafeProjectEntryFile(repoPath, entryRel);
      const exists = await pathExists(filePath);
      const content = exists ? await readText(filePath) : '';
      statuses[entryRel] = {
        path: filePath,
        exists,
        unsafe: false,
        required: (config.entryFiles.create || []).includes(entryRel),
        ...countManagedBlocks(content),
      };
    } catch (error) {
      statuses[entryRel] = {
        path: '',
        exists: false,
        unsafe: true,
        required: (config.entryFiles.create || []).includes(entryRel),
        error: error.message,
        ...countManagedBlocks(''),
      };
    }
  }
  return statuses;
}


// Initialization-time template file copy. Baseline-tracked template sync is
// owned by devrules-lib/template-sync.mjs; this helper never overwrites an
// existing project instance file.
async function copyTemplateFile(src, dest, apply, actions, collectedContent = null) {
  const content = Buffer.isBuffer(collectedContent) ? collectedContent : await readFileWithRetry(src);
  if (await pathExists(dest)) {
    const existing = await readFileWithRetry(dest);
    if (Buffer.compare(existing, content) === 0) {
      actions.push({ action: 'skip', path: dest, reason: 'already current' });
      return;
    }
    actions.push({ action: 'skip', path: dest, reason: 'already exists; preserve project instance file' });
    return;
  }

  const reason = 'missing devrules template file';
  const expectedAfter = expectedFileAfter(content, 0o644);
  if (!apply) {
    actions.push({ action: 'copy', from: src, path: dest, reason, mode: 'dry-run', expectedAfter });
    return;
  }

  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.writeFile(dest, content);
  const appliedMode = await fs.stat(dest).then((stat) => stat.mode & 0o7777);
  actions.push({ action: 'copy', from: src, path: dest, reason, mode: 'applied', expectedAfter: expectedFileAfter(content, appliedMode) });
}

export async function isSharedTemplateRoot(rootPath) {
  return (await pathExists(path.join(rootPath, 'always-readme.md')))
    && (await pathExists(path.join(rootPath, 'rules', 'workflow-management.md')))
    && (await pathExists(path.join(rootPath, 'scripts', 'devrules.mjs')))
    && !(await pathExists(path.join(rootPath, 'devrules', 'always-readme.md')));
}

async function auditHooksRegistry(rootPath, issues, recommendations, options = {}) {
  const result = await auditHookRegistries(rootPath, options);
  issues.push(...result.issues);
  recommendations.push(...result.recommendations);
  return result;
}

async function auditTemplateRoot(rootPath) {
  const issues = [];
  const recommendations = [];

  for (const file of ['template.json', 'CHANGELOG.md', 'config.json', 'always-readme.md', 'scripts/devrules.mjs', 'hooks/README.md', 'hooks/hooks.json']) {
    if (!(await pathExists(path.join(rootPath, file)))) {
      issues.push({ severity: 'error', message: `Missing template file: ${file}` });
    }
  }
  for (const rule of REQUIRED_RULES) {
    if (!(await pathExists(path.join(rootPath, 'rules', rule)))) {
      issues.push({ severity: 'error', message: `Missing core template rule: rules/${rule}` });
    }
  }
  for (const asset of REQUIRED_WORK_SYSTEM_ASSETS) {
    if (!(await pathExists(path.join(rootPath, asset)))) {
      issues.push({ severity: 'error', message: `Missing core work-system asset: ${asset}` });
    }
  }
  for (const profile of REQUIRED_PROFILES) {
    if (!(await pathExists(path.join(rootPath, 'profiles', profile)))) {
      issues.push({ severity: 'error', message: `Missing language profile: profiles/${profile}` });
    }
  }
  for (const script of REQUIRED_SCRIPTS) {
    if (!(await pathExists(path.join(rootPath, 'scripts', script)))) {
      issues.push({ severity: 'error', message: `Missing code-health script: scripts/${script}` });
    }
  }
  for (const hook of REQUIRED_HOOKS) {
    if (!(await pathExists(path.join(rootPath, 'hooks', hook)))) {
      issues.push({ severity: 'error', message: `Missing template hook asset: hooks/${hook}` });
    }
  }

  await auditHooksRegistry(rootPath, issues, recommendations, {
    requiredHookIds: ['session-start', 'template-auto-update', 'before-edit-route', 'product-architecture-gate', 'ios-account-data-model-gate', 'code-health-change', 'failure-root-cause', 'game-development'],
  });
  const governanceAudit = await auditGovernanceMetadata(rootPath, { templateMode: true });
  issues.push(...governanceAudit.issues);
  let templateConfig = normalizeConfig({});
  try {
    templateConfig = normalizeConfig(JSON.parse(await readText(path.join(rootPath, 'config.json'))));
  } catch {
    // Missing or malformed config is reported through the normal template/config checks.
  }
  issues.push(...await auditGitHubActionsPolicy(rootPath, {
    githubActionsPolicy: templateConfig.automation.githubActionsPolicy,
  }));
  const modelSupportAudit = await auditModelSupportMetadata(rootPath, { templateMode: true });
  issues.push(...modelSupportAudit.issues);

  const managedFiles = await collectManagedTemplateFiles(rootPath, TEMPLATE_SYNC_DIRS, TEMPLATE_SYNC_ROOT_FILES);
  const source = await readTemplateSource(rootPath, managedFiles, { contentView: 'working-tree' });
  for (const problem of templateAuthorityIssues(source, { mode: 'local' })) {
    issues.push({ severity: 'error', message: problem.message });
  }

  return {
    repo: rootPath,
    name: path.basename(rootPath),
    templateMode: true,
    maturityLevel: 'template',
    auditScope: 'local-content',
    releaseStateChecked: false,
    releaseAuditCommand: 'devrules template release-audit',
    templateSource: source,
    issues,
    recommendations,
  };
}

export async function initializeRepo(repoPath, options, context) {
  const apply = isApply(options);
  const { config, configPath, malformed } = await loadRepoConfig(repoPath);
  await validateConfiguredEntryFiles(repoPath, config, {
    create: DEFAULT_ENTRY_CREATE_FILES,
    bindIfPresent: DEFAULT_ENTRY_BIND_IF_PRESENT_FILES,
  });
  const explicitProfile = options.profile === undefined ? '' : String(options.profile).trim().toLowerCase();
  if (explicitProfile && !Object.hasOwn(ADOPTION_LEVEL_BY_PROFILE, explicitProfile)) {
    throw new Error(`invalid adoption profile ${JSON.stringify(options.profile)}; expected minimal, standard, or full`);
  }
  const legacyMaturity = options.maturity === undefined ? null : Number(options.maturity);
  if (legacyMaturity !== null && ![1, 2, 3].includes(legacyMaturity)) {
    throw new Error(`invalid legacy maturity ${JSON.stringify(options.maturity)}; expected 1, 2, or 3`);
  }
  if (explicitProfile && legacyMaturity !== null && ADOPTION_LEVEL_BY_PROFILE[explicitProfile] !== legacyMaturity) {
    throw new Error(`conflicting adoption selectors: --profile ${explicitProfile} does not match --maturity ${legacyMaturity}`);
  }
  const requestedProfile = explicitProfile
    || (legacyMaturity === null
      ? normalizeAdoptionProfile(config.initialization.defaultAdoptionProfile)
      : adoptionProfileForLevel(legacyMaturity));
  const requestedMaturityLevel = ADOPTION_LEVEL_BY_PROFILE[requestedProfile] || DEFAULT_MATURITY_LEVEL;
  const syncTemplate = options['sync-template'] === true || config.initialization.syncTemplateByDefault === true;
  const existingInstance = await pathExists(path.join(repoPath, 'devrules'));
  const pruneGeneratedAnchors = options['prune-generated-anchors'] === true || config.initialization.pruneGeneratedAnchorsByDefault === true;
  const existingFacts = await readExistingProjectFacts(repoPath, config);
  const existingProfileLevel = existingFacts.adoptionProfile
    ? ADOPTION_LEVEL_BY_PROFILE[existingFacts.adoptionProfile]
    : existingFacts.maturityLevel;
  const preserveExistingProfile = syncTemplate && existingProfileLevel > requestedMaturityLevel;
  const adoptionProfile = preserveExistingProfile ? existingFacts.adoptionProfile : requestedProfile;
  const selectedProfileLevel = ADOPTION_LEVEL_BY_PROFILE[adoptionProfile] || requestedMaturityLevel;
  const actions = [];
  try {
  if (malformed) actions.push({ action: 'warn', path: configPath, reason: 'project devrules config is malformed; using defaults' });
  if (preserveExistingProfile) {
    actions.push({
      action: 'preserve',
      path: path.join(repoPath, 'devrules', 'manifest.json'),
      reason: `preserve existing adoption profile ${existingFacts.adoptionProfile}; requested profile ${requestedProfile} is smaller during template sync`,
    });
  }
  const detectedSourceRoots = await detectSourceRoots(repoPath, config);
  const sourceRoots = detectedSourceRoots.length ? detectedSourceRoots : existingFacts.sourceRoots;
  const classifiedAnchors = adoptionProfile === 'full'
    ? await classifySemanticModuleRoots(repoPath, sourceRoots, config)
    : {
        semanticModules: existingFacts.semanticModules,
        anchorCandidates: existingFacts.anchorCandidates,
      };
  const semanticModules = classifiedAnchors.semanticModules;
  const anchorCandidates = classifiedAnchors.anchorCandidates;
  const stack = await detectStack(repoPath);
  const copyDirs = syncTemplate && !existingInstance ? [...COPY_DIRS, 'hooks'] : COPY_DIRS;

  if (syncTemplate && existingInstance) {
    const safeSync = await syncTemplateRepo(repoPath, apply, options, context);
    actions.push(...safeSync.actions);
    if (safeSync.blocked) {
      actions.push({
        action: 'blocked',
        path: path.join(repoPath, 'devrules'),
        reason: 'safe template preflight blocked initialization repair; no repository files were written',
      });
      return {
        repo: repoPath,
        apply,
        blocked: true,
        adoptionProfile,
        selectedProfileLevel,
        maturityLevel: existingFacts.maturityLevel,
        configPath,
        configMalformed: malformed,
        entryFiles: {},
        sourceRoots,
        semanticModules,
        anchorCandidates,
        stack,
        legacyImports: [],
        actions,
      };
    }
  }
  if (syncTemplate && !existingInstance && apply) {
    const initialSync = await syncTemplateRepo(repoPath, true, options, context);
    actions.push(...initialSync.actions);
    if (initialSync.blocked) {
      actions.push({
        action: 'blocked',
        path: path.join(repoPath, 'devrules'),
        reason: 'template authority blocked initialization before any repository files were written',
      });
      return {
        repo: repoPath,
        apply,
        blocked: true,
        adoptionProfile,
        selectedProfileLevel,
        maturityLevel: existingFacts.maturityLevel,
        configPath,
        configMalformed: malformed,
        entryFiles: {},
        sourceRoots,
        semanticModules,
        anchorCandidates,
        stack,
        legacyImports: [],
        actions,
      };
    }
  }

  if (!(syncTemplate && !existingInstance && apply)) {
    const initialTemplateFiles = await collectManagedTemplateFiles(context.templateRoot, copyDirs, COPY_ROOT_FILES);
    for (const file of initialTemplateFiles) {
      await copyTemplateFile(
        file.sourcePath,
        path.join(repoPath, 'devrules', file.relPath),
        apply,
        actions,
        file.content,
      );
    }
  }

  const legacyImports = await normalizeLegacyStructures(repoPath, apply, actions);

  await ensureMemory(repoPath, sourceRoots, semanticModules, anchorCandidates, stack, apply, actions);
  await ensureConfig(repoPath, config, sourceRoots, semanticModules, anchorCandidates, apply, actions);
  if (!syncTemplate) {
    for (const hookAsset of REQUIRED_HOOKS.filter((asset) => asset.endsWith('.mjs'))) {
    await copyTemplateFile(
      path.join(context.templateRoot, 'hooks', hookAsset),
      path.join(repoPath, 'devrules', 'hooks', hookAsset),
      apply,
      actions,
    );
    }
  }
  await ensureHooks(repoPath, stack, config, apply, actions, syncTemplate, context.templateRoot);
  const entryFileResults = await bindConfiguredEntryFiles(repoPath, config, apply, actions, {
    create: DEFAULT_ENTRY_CREATE_FILES,
    bindIfPresent: DEFAULT_ENTRY_BIND_IF_PRESENT_FILES,
  });
  await ensureCursorRoutingCard(repoPath, apply, actions);

  if (adoptionProfile === 'full') {
    await ensureReadmeAnchors(repoPath, sourceRoots, semanticModules, apply, actions);
    if (pruneGeneratedAnchors) {
      await pruneGeneratedReadmeAnchors(repoPath, [...sourceRoots, ...semanticModules], apply, actions);
    }
  }

  const observedAdoptionLevel = await projectedAdoptionLevel(
    repoPath,
    entryFileResults,
    [...sourceRoots, ...semanticModules],
    adoptionProfile,
    apply,
  );
  await ensureManifest(repoPath, config, configPath || path.join(repoPath, 'devrules', 'config.json'), entryFileResults, sourceRoots, semanticModules, anchorCandidates, stack, adoptionProfile, observedAdoptionLevel, legacyImports, syncTemplate, apply, actions, context.version);
  return {
    repo: repoPath,
    apply,
    adoptionProfile,
    selectedProfileLevel,
    observedAdoptionLevel,
    maturityLevel: observedAdoptionLevel,
    configPath,
    configMalformed: malformed,
    entryFiles: entryFileResults,
    sourceRoots,
    semanticModules,
    anchorCandidates,
    stack,
    legacyImports,
    actions,
  };
  } catch (error) {
    error.actions = [...actions, ...(error.actions || [])];
    throw error;
  }
}

export async function scanRepo(repoPath) {
  const manifestPath = path.join(repoPath, 'devrules', 'manifest.json');
  const alwaysPath = path.join(repoPath, 'devrules', 'always-readme.md');
  const { config, configPath, malformed } = await loadRepoConfig(repoPath);

  const entryFileStatuses = await scanEntryFiles(repoPath, config);
  const hasAgents = entryFileStatuses['AGENTS.md']?.exists === true;
  const hasClaude = entryFileStatuses['CLAUDE.md']?.exists === true;
  const agentsBlocks = entryFileStatuses['AGENTS.md'] || countManagedBlocks('');
  const claudeBlocks = entryFileStatuses['CLAUDE.md'] || countManagedBlocks('');
  const hasInstance = await pathExists(alwaysPath);
  const hasManifest = await pathExists(manifestPath);
  let manifestMaturityLevel = null;
  let manifestAdoptionProfile = null;
  let manifestAdoptionProfileRaw = null;
  let manifestAdoptionProfileValid = true;
  let manifestSelectedProfileLevel = null;
  let manifestObservedAdoptionLevel = null;
  let manifestInstalledModules = [];
  let manifestEnabledModules = [];
  let manifestDormantModules = [];
  let manifestProfileFields = [];
  let manifestModuleSchema = 'missing';
  if (hasManifest) {
    try {
      const manifest = JSON.parse(await readText(manifestPath));
      manifestMaturityLevel = Number.isFinite(Number(manifest.maturityLevel)) ? Number(manifest.maturityLevel) : null;
      manifestAdoptionProfileRaw = typeof manifest.adoptionProfile === 'string'
        ? manifest.adoptionProfile.trim().toLowerCase()
        : null;
      manifestAdoptionProfileValid = !Object.hasOwn(manifest, 'adoptionProfile')
        || Object.hasOwn(ADOPTION_LEVEL_BY_PROFILE, manifestAdoptionProfileRaw || '');
      manifestAdoptionProfile = normalizeAdoptionProfile(manifest.adoptionProfile, manifestMaturityLevel);
      manifestSelectedProfileLevel = Number.isFinite(Number(manifest.selectedProfileLevel))
        ? Number(manifest.selectedProfileLevel)
        : null;
      manifestObservedAdoptionLevel = Number.isFinite(Number(manifest.observedAdoptionLevel))
        ? Number(manifest.observedAdoptionLevel)
        : null;
      manifestEnabledModules = asArray(manifest.enabledModules);
      manifestDormantModules = asArray(manifest.dormantModules);
      manifestProfileFields = ['selectedProfileLevel', 'observedAdoptionLevel', 'dormantModules']
        .filter((field) => Object.hasOwn(manifest, field));
      if (Array.isArray(manifest.installedModules)) {
        manifestInstalledModules = asArray(manifest.installedModules);
        manifestModuleSchema = 'installed-enabled';
      } else if (Object.hasOwn(manifest, 'installedModules')) {
        manifestInstalledModules = [];
        manifestModuleSchema = 'invalid-installed-modules';
      } else {
        manifestInstalledModules = [...new Set(['core-orchestration', ...manifestEnabledModules])];
        manifestModuleSchema = 'legacy-enabled-only';
      }
    } catch {
      manifestMaturityLevel = null;
      manifestAdoptionProfile = null;
      manifestAdoptionProfileRaw = null;
      manifestAdoptionProfileValid = false;
      manifestSelectedProfileLevel = null;
      manifestObservedAdoptionLevel = null;
      manifestInstalledModules = [];
      manifestEnabledModules = [];
      manifestDormantModules = [];
      manifestProfileFields = [];
      manifestModuleSchema = 'malformed';
    }
  }
  const sourceRoots = await detectSourceRoots(repoPath, config);
  const classifiedAnchors = await classifySemanticModuleRoots(repoPath, sourceRoots, config);
  const semanticModules = classifiedAnchors.semanticModules;
  const anchorCandidates = classifiedAnchors.anchorCandidates;
  const anchorTargets = [...sourceRoots, ...semanticModules];
  const missingAnchors = [];
  for (const anchor of anchorTargets) {
    if (!(await hasReadmeAnchor(repoPath, anchor))) missingAnchors.push(anchor);
  }

  let maturityLevel = 0;
  if (agentsBlocks.valid || claudeBlocks.valid) maturityLevel = 1;
  if (hasInstance && hasManifest) maturityLevel = 2;
  if (maturityLevel >= 2 && anchorTargets.length > 0 && missingAnchors.length === 0) maturityLevel = 3;

  return {
    repo: repoPath,
    name: path.basename(repoPath),
    hasDevRulesInstance: hasInstance,
    hasManifest,
    hasAgents,
    hasClaude,
    entryBindings: {
      AGENTS: agentsBlocks,
      CLAUDE: hasClaude ? claudeBlocks : { startCount: 0, endCount: 0, valid: false },
      files: entryFileStatuses,
    },
    configPath,
    configMalformed: malformed,
    sourceRoots,
    semanticModules,
    anchorCandidates,
    anchorTargets,
    missingAnchors,
    missingReadmes: missingAnchors,
    maturityLevel,
    manifestMaturityLevel,
    adoptionProfile: manifestAdoptionProfile,
    manifestAdoptionProfileRaw,
    manifestAdoptionProfileValid,
    selectedProfileLevel: manifestSelectedProfileLevel,
    observedAdoptionLevel: manifestObservedAdoptionLevel,
    installedModules: manifestInstalledModules,
    enabledModules: manifestEnabledModules,
    dormantModules: manifestDormantModules,
    manifestProfileFields,
    manifestModuleSchema,
  };
}

export async function auditRepo(repoPath, existingStatus = null) {
  if (await isSharedTemplateRoot(repoPath)) {
    return auditTemplateRoot(repoPath);
  }

  const status = existingStatus || await scanRepo(repoPath);
  const { config } = await loadRepoConfig(repoPath);
  const issues = [];
  const recommendations = [];
  const installedModules = new Set(status.installedModules || []);
  const enabledModules = new Set(status.enabledModules || []);
  const dormantModules = new Set(status.dormantModules || []);
  const moduleInstalled = (moduleId) => installedModules.has(moduleId);

  try {
    await readInstalledTemplateModules(repoPath, fs);
  } catch (error) {
    issues.push({ severity: 'error', message: `Template module scope is invalid: ${error.message}` });
  }

  if (status.manifestModuleSchema === 'invalid-installed-modules') {
    issues.push({ severity: 'error', message: 'Manifest installedModules must be an array when present.' });
  }

  if (status.manifestModuleSchema === 'legacy-enabled-only') {
    recommendations.push({ level: 3, message: 'Manifest uses the legacy enabled-only module list; an explicit devrules initialization or upgrade can record installed, enabled, and dormant modules separately.' });
  }

  for (const moduleId of enabledModules) {
    if (!moduleInstalled(moduleId)) {
      issues.push({ severity: 'error', message: `Manifest enables module ${moduleId} without declaring it installed.` });
    }
  }
  for (const moduleId of installedModules) {
    if (!INSTALLABLE_MODULES.includes(moduleId)) {
      issues.push({ severity: 'error', message: `Manifest declares unknown installed module ${moduleId}; template synchronization fails closed until the module contract is documented.` });
    }
  }

  const profileFields = new Set(status.manifestProfileFields || []);
  if (profileFields.size > 0 && profileFields.size < 3) {
    issues.push({ severity: 'error', message: 'Manifest profile metadata is incomplete; selectedProfileLevel, observedAdoptionLevel, and dormantModules must be recorded together.' });
  } else if (profileFields.size === 3) {
    if (!status.manifestAdoptionProfileValid || !status.manifestAdoptionProfileRaw) {
      issues.push({ severity: 'error', message: `Manifest adoptionProfile is invalid: ${status.manifestAdoptionProfileRaw || '<non-string>'}.` });
    }
    const expectedSelectedLevel = ADOPTION_LEVEL_BY_PROFILE[status.adoptionProfile];
    if (status.selectedProfileLevel !== expectedSelectedLevel) {
      issues.push({ severity: 'error', message: `Manifest selectedProfileLevel ${status.selectedProfileLevel ?? '<invalid>'} does not match adoptionProfile ${status.adoptionProfile} (${expectedSelectedLevel}).` });
    }
    if (!Number.isFinite(status.observedAdoptionLevel) || status.observedAdoptionLevel < 0 || status.observedAdoptionLevel > 3) {
      issues.push({ severity: 'error', message: `Manifest observedAdoptionLevel must be a number from 0 through 3; found ${status.observedAdoptionLevel ?? '<invalid>'}.` });
    } else {
      if (status.manifestMaturityLevel !== status.observedAdoptionLevel) {
        issues.push({ severity: 'error', message: `Manifest maturityLevel ${status.manifestMaturityLevel ?? '<invalid>'} must match observedAdoptionLevel ${status.observedAdoptionLevel}.` });
      }
      if (status.maturityLevel !== status.observedAdoptionLevel) {
        recommendations.push({ level: 3, message: `Observed adoption has drifted from manifest level ${status.observedAdoptionLevel} to current level ${status.maturityLevel}; refresh the manifest during an explicit initialization or upgrade.` });
      }
    }
    const expectedDormant = new Set([...installedModules].filter((moduleId) => !enabledModules.has(moduleId)));
    const dormantMismatch = expectedDormant.size !== dormantModules.size
      || [...expectedDormant].some((moduleId) => !dormantModules.has(moduleId));
    if (dormantMismatch) {
      issues.push({ severity: 'error', message: 'Manifest dormantModules must equal installedModules minus enabledModules.' });
    }
  } else if (status.manifestModuleSchema === 'installed-enabled') {
    recommendations.push({ level: 3, message: 'Manifest does not yet record the v3 selected, observed, and dormant profile fields; an explicit initialization or upgrade can add them.' });
  }

  issues.push(...await auditGitHubActionsPolicy(repoPath, {
    githubActionsPolicy: config.automation.githubActionsPolicy,
  }));

  const agentsEntry = status.entryBindings.files?.['AGENTS.md'];
  const claudeEntry = status.entryBindings.files?.['CLAUDE.md'];
  for (const [entryRel, entryStatus] of Object.entries(status.entryBindings.files || {})) {
    if (entryStatus.unsafe) {
      issues.push({ severity: 'error', message: `Configured project entry ${entryRel} is unsafe: ${entryStatus.error}` });
    }
  }

  if (!agentsEntry?.exists) {
    issues.push({ severity: 'warn', message: 'AGENTS.md is missing; Codex entry binding is absent.' });
  } else if (!status.entryBindings.AGENTS.valid) {
    issues.push({ severity: 'warn', message: 'AGENTS.md does not contain exactly one valid devrules managed block.' });
  }

  if (claudeEntry?.exists) {
    if (!status.entryBindings.CLAUDE.valid) {
      issues.push({ severity: 'warn', message: 'CLAUDE.md exists but does not contain exactly one valid devrules managed block.' });
    }
  }

  for (const [entryRel, entryStatus] of Object.entries(status.entryBindings.files || {})) {
    if (entryRel === 'AGENTS.md' || entryRel === 'CLAUDE.md') continue;
    if (entryStatus.exists && !entryStatus.valid) {
      issues.push({ severity: 'warn', message: `${entryRel} exists but does not contain exactly one valid devrules managed block.` });
    }
  }

  const requiredEntries = new Set((config.entryFiles.create || DEFAULT_ENTRY_CREATE_FILES).map(normalizeRel));
  const cursorEntry = status.entryBindings.files?.[CURSOR_DEVRULES_RULE];
  const cursorEntryPath = cursorEntry?.path || '';
  if (requiredEntries.has(CURSOR_DEVRULES_RULE) && !cursorEntry?.exists && !cursorEntry?.unsafe) {
    issues.push({ severity: 'error', message: `${CURSOR_DEVRULES_RULE} is required but missing; run repo refresh-entries --apply.` });
  } else if (cursorEntry?.exists && !cursorEntry.unsafe) {
    const cursorContent = await readText(cursorEntryPath);
    const rendered = await renderCursorRoutingCard(repoPath);
    const inspection = inspectCursorRule(cursorContent, rendered.status === 'skip' ? null : rendered.next);
    if (!inspection.alwaysApply) {
      issues.push({ severity: 'error', message: `${CURSOR_DEVRULES_RULE} must contain frontmatter with alwaysApply: true.` });
    }
    if (inspection.startCount !== 1 || inspection.endCount !== 1) {
      issues.push({ severity: 'error', message: `${CURSOR_DEVRULES_RULE} must contain exactly one generated routing-card block.` });
    } else if (inspection.current === false) {
      issues.push({ severity: 'warn', message: `${CURSOR_DEVRULES_RULE} routing card is stale; run repo refresh-entries --apply.` });
    }
  }

  for (const file of REQUIRED_ROOT_FILES) {
    if (!(await pathExists(path.join(repoPath, 'devrules', file)))) {
      issues.push({ severity: 'error', message: `Missing core file: devrules/${file}` });
    }
  }

  for (const file of moduleInstalled('configuration') ? REQUIRED_CONFIG : []) {
    if (!(await pathExists(path.join(repoPath, 'devrules', file)))) {
      issues.push({ severity: 'error', message: `Manifest declares configuration installed but file is missing: devrules/${file}` });
    }
  }

  for (const file of moduleInstalled('design-system') ? DESIGN_ROOT_FILES : []) {
    if (!(await pathExists(path.join(repoPath, 'devrules', file)))) {
      issues.push({ severity: 'error', message: `Manifest declares design-system installed but file is missing: devrules/${file}` });
    }
  }

  if (status.configMalformed) {
    issues.push({ severity: 'error', message: `devrules config is malformed: ${status.configPath}` });
  }

  for (const rule of moduleInstalled('core-rules') ? REQUIRED_RULES : []) {
    if (!(await pathExists(path.join(repoPath, 'devrules', 'rules', rule)))) {
      issues.push({ severity: 'error', message: `Missing core rule: devrules/rules/${rule}` });
    }
  }

  for (const asset of moduleInstalled('work-system-assets') ? REQUIRED_WORK_SYSTEM_ASSETS : []) {
    if (!(await pathExists(path.join(repoPath, 'devrules', asset)))) {
      issues.push({ severity: 'error', message: `Missing core work-system asset: devrules/${asset}` });
    }
  }

  for (const profile of moduleInstalled('profiles') ? REQUIRED_PROFILES : []) {
    if (!(await pathExists(path.join(repoPath, 'devrules', 'profiles', profile)))) {
      issues.push({ severity: 'error', message: `Missing language profile: devrules/profiles/${profile}` });
    }
  }

  for (const script of moduleInstalled('scripts') ? REQUIRED_SCRIPTS : []) {
    if (!(await pathExists(path.join(repoPath, 'devrules', 'scripts', script)))) {
      issues.push({ severity: 'error', message: `Missing code-health script: devrules/scripts/${script}` });
    }
  }

  for (const file of moduleInstalled('memory') ? REQUIRED_MEMORY : []) {
    if (!(await pathExists(path.join(repoPath, 'devrules', 'memory', file)))) {
      issues.push({ severity: 'error', message: `Missing memory file: devrules/memory/${file}` });
    }
  }

  for (const file of moduleInstalled('hooks') ? REQUIRED_HOOKS : []) {
    if (!(await pathExists(path.join(repoPath, 'devrules', 'hooks', file)))) {
      issues.push({ severity: 'error', message: `Missing hook file: devrules/hooks/${file}` });
    }
  }

  const devrulesRoot = path.join(repoPath, 'devrules');
  const hookAudit = moduleInstalled('hooks')
    ? await auditHooksRegistry(devrulesRoot, issues, recommendations)
    : { hookEntries: [], localHookEntries: [] };
  if (enabledModules.has('hooks') && await isGodotProject(repoPath)) {
    const hasGameHook = hookAudit.hookEntries.some((hook) => hook?.id === 'game-development');
    if (!hasGameHook) {
      recommendations.push({
        level: 4,
        message: 'Godot project detected without the game-development seed hook; sync the shared template or add an equivalent project-local game workflow route.',
      });
    }
  }

  const governanceAudit = await auditGovernanceMetadata(devrulesRoot);
  recommendations.push(...governanceAudit.recommendations);

  const modelSupportAudit = await auditModelSupportMetadata(devrulesRoot);
  recommendations.push(...modelSupportAudit.recommendations);

  if (!(await pathExists(path.join(repoPath, 'devrules', 'manifest.json')))) {
    issues.push({ severity: 'error', message: 'Missing devrules/manifest.json.' });
  } else {
    try {
      JSON.parse(await readText(path.join(repoPath, 'devrules', 'manifest.json')));
    } catch {
      issues.push({ severity: 'error', message: 'devrules/manifest.json is not valid JSON.' });
    }
  }

  for (const missing of status.missingAnchors) {
    if (status.adoptionProfile === 'full') {
      issues.push({ severity: 'warn', message: `Full adoption profile expects devrules README anchor: ${missing}` });
    }
  }

  for (const anchor of enabledModules.has('context-fractal') ? status.anchorTargets : []) {
    if (await hasReadmeAnchor(repoPath, anchor) && (await readmeAnchorHasPlaceholders(repoPath, anchor))) {
      const message = `README anchor still contains generated placeholders: ${anchor}`;
      if (config.audit.allowPlaceholderAnchors === false) {
        issues.push({ severity: 'warn', message });
      } else {
        recommendations.push({ level: 3, message });
      }
    }
  }

  if (enabledModules.has('memory') && await pathExists(path.join(repoPath, 'devrules', 'memory', 'project-profile.md')) && (await projectProfileHasEmptyCommands(repoPath))) {
    const message = 'Project profile command table still has empty command cells.';
    if (config.audit.requireCommands === true) {
      issues.push({ severity: 'warn', message });
    } else {
      recommendations.push({ level: 4, message });
    }
  }

  return { ...status, issues, recommendations };
}

function formatScan(statuses) {
  const rows = statuses.map((status) => ({
    repo: status.name,
    profile: status.adoptionProfile || 'unselected',
    level: status.maturityLevel,
    instance: status.hasDevRulesInstance ? 'yes' : 'no',
    manifest: status.hasManifest ? 'yes' : 'no',
    agents: status.entryBindings.AGENTS.valid ? 'bound' : status.hasAgents ? 'unbound' : 'absent',
    claude: status.entryBindings.CLAUDE.valid ? 'bound' : status.hasClaude ? 'unbound' : 'n/a',
    missingAnchors: status.missingAnchors.length,
  }));
  console.table(rows);
}

export async function commandScan(options) {
  const root = path.resolve(String(options.root || '..'));
  const repos = await findGitRepos(root, options.recursive === true);
  const statuses = [];
  for (const repo of repos) statuses.push(await scanRepo(repo));
  output({ root, count: statuses.length, repos: statuses }, options, (data) => {
    console.log(`Scanned ${data.count} repositories under ${data.root}`);
    formatScan(data.repos);
  });
}

export async function commandInit(options, context) {
  const repos = [];
  if (options.repo) {
    repos.push(path.resolve(String(options.repo)));
  } else {
    const root = path.resolve(String(options.root || '..'));
    repos.push(...(await findGitRepos(root, options.recursive === true)));
  }

  const results = [];
  for (const repo of repos) {
    if (!(await isGitRepo(repo))) {
      results.push({ repo, error: 'not a git repository' });
      continue;
    }
    results.push(await initializeRepo(repo, options, context));
  }

  output({ apply: isApply(options), count: results.length, results }, options, (data) => {
    console.log(`${data.apply ? 'Applied' : 'Dry-run'} initialization for ${data.count} repositories.`);
    for (const result of data.results) {
      console.log(`\n${result.repo}`);
      if (result.error) {
        console.log(`  ERROR: ${result.error}`);
        continue;
      }
      console.log(`  Profile: ${result.adoptionProfile} (observed level ${result.observedAdoptionLevel ?? result.maturityLevel})`);
      for (const action of result.actions) {
        const target = action.path || action.from || '';
        console.log(`  - ${action.action}: ${target} (${action.reason})`);
      }
    }
  });
}

export async function commandAudit(options, context) {
  const result = await runRepositoryAuditCommand(options, {
    templateRoot: context.templateRoot,
    directoryNames: TEMPLATE_SYNC_DIRS,
    rootFiles: TEMPLATE_SYNC_ROOT_FILES,
    isSharedTemplateRoot,
    auditRepo,
    output,
  });
  if (options.strict === true && result.issues.some((issue) => issue.severity === 'error')) {
    process.exitCode = 1;
  }
}
