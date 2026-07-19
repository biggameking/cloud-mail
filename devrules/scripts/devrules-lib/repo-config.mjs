import path from 'node:path';
import {
  normalizeRel,
  pathExists,
  readText,
  today,
  writeText,
} from './fs-actions.mjs';

export const ADOPTION_LEVEL_BY_PROFILE = { minimal: 1, standard: 2, full: 3 };
export const DEFAULT_ADOPTION_PROFILE = 'minimal';
export const DEFAULT_MATURITY_LEVEL = ADOPTION_LEVEL_BY_PROFILE[DEFAULT_ADOPTION_PROFILE];
export const DEFAULT_ENTRY_CREATE_FILES = ['AGENTS.md'];
export const DEFAULT_ENTRY_BIND_IF_PRESENT_FILES = [
  '.cursor/rules/devrules.mdc',
  'CLAUDE.md',
  '.cursorrules',
  '.windsurfrules',
];

export const DEFAULT_CONFIG = {
  schemaVersion: 1,
  workspace: {
    defaultRoot: '..',
    additionalRoots: [],
    recursive: false,
  },
  initialization: {
    defaultAdoptionProfile: DEFAULT_ADOPTION_PROFILE,
    syncTemplateByDefault: false,
    pruneGeneratedAnchorsByDefault: false,
    instanceOwnsLocalChanges: true,
    templatePromotionMode: 'suggestion-only',
  },
  templateSync: {
    moduleSelection: 'manifest',
    modules: [],
  },
  agentSurfaces: {
    selectionOwner: 'host-user',
    supported: ['codex', 'claude-code', 'cursor', 'windsurf', 'future-agent'],
    singleOrchestrationRoot: 'devrules/always-readme.md',
  },
  entryFiles: {
    create: DEFAULT_ENTRY_CREATE_FILES,
    bindIfPresent: DEFAULT_ENTRY_BIND_IF_PRESENT_FILES,
  },
  detection: {
    ignoreDirs: [
      '.build', '.codegraph', '.codex-copilot', '.gradle', '.mypy_cache',
      '.nox', '.omx', '.pytest_cache', '.ruff_cache', '.swiftpm', '.tox',
      '.venv', '__pycache__', 'deriveddata', 'generated', 'logs',
      'node_modules', 'out', 'pods', 'target', 'temp', 'tmp', 'vendor', 'venv',
    ],
    sourceRoots: {
      include: [],
      exclude: [],
    },
    semanticModules: {
      maxAutomaticPerSourceRoot: 12,
      include: [],
      exclude: [],
      promoteCandidates: [],
      ignoreCandidates: [],
    },
  },
  codeHealth: {
    mode: 'advisory',
    fileLinesWarn: 500,
    fileLinesNoGrowth: 800,
    excludeDirs: [],
    excludePaths: ['devrules/**'],
    largeFileAllowlist: [],
  },
  hooks: {
    enabled: true,
    disabledHookIds: [],
    extraHooks: [],
  },
  memory: {
    feedbackLoop: 'immediate-agent-mediated',
    projectLocalOnly: true,
    compactInteractionLogAfterEntries: 20,
    templateEvolutionTarget: 'devrules/memory/evolution-suggestions.md',
  },
  developerServices: {
    mode: 'safety-only',
    managedProviders: [],
  },
  automation: {
    allowProjectLocalScripts: true,
    githubActionsPolicy: 'inherit',
    preferredRuntime: 'node-mjs',
    dryRunDefault: true,
    mutationFlag: '--apply',
    supportedPlatforms: ['windows', 'macos'],
  },
  audit: {
    allowPlaceholderAnchors: true,
    requireCommands: false,
  },
};

export function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function mergeConfig(base, override) {
  if (!isPlainObject(override)) return structuredClone(base);
  const next = structuredClone(base);
  for (const [key, value] of Object.entries(override)) {
    if (isPlainObject(value) && isPlainObject(next[key])) {
      next[key] = mergeConfig(next[key], value);
    } else {
      next[key] = value;
    }
  }
  return next;
}

export function asArray(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === 'string' && item.trim()).map(normalizeRel) : [];
}

export function adoptionProfileForLevel(value) {
  const level = Number(value);
  if (Number.isFinite(level) && level >= ADOPTION_LEVEL_BY_PROFILE.full) return 'full';
  if (Number.isFinite(level) && level >= ADOPTION_LEVEL_BY_PROFILE.standard) return 'standard';
  return 'minimal';
}

export function normalizeAdoptionProfile(value, legacyLevel = null) {
  const profile = String(value || '').trim().toLowerCase();
  if (Object.hasOwn(ADOPTION_LEVEL_BY_PROFILE, profile)) return profile;
  if (Number.isFinite(Number(legacyLevel))) return adoptionProfileForLevel(legacyLevel);
  return DEFAULT_ADOPTION_PROFILE;
}

export function normalizeConfig(config) {
  const configuredAdoptionProfile = config?.initialization?.defaultAdoptionProfile;
  const configuredLegacyMaturity = Number(config?.initialization?.defaultMaturityLevel);
  const configuredAgentSurfaces = isPlainObject(config?.agentSurfaces) ? config.agentSurfaces : {};
  const configuredGitHubActionsPolicy = config?.automation?.githubActionsPolicy;
  const configuredLegacyAllowGitHubActions = config?.automation?.allowGitHubActions === true;
  const next = mergeConfig(DEFAULT_CONFIG, config);
  next.workspace = isPlainObject(next.workspace) ? next.workspace : structuredClone(DEFAULT_CONFIG.workspace);
  next.workspace.defaultRoot = typeof next.workspace.defaultRoot === 'string' && next.workspace.defaultRoot.trim()
    ? next.workspace.defaultRoot
    : DEFAULT_CONFIG.workspace.defaultRoot;
  next.workspace.additionalRoots = asArray(next.workspace.additionalRoots);
  next.workspace.recursive = next.workspace.recursive === true;
  next.agentSurfaces = isPlainObject(next.agentSurfaces)
    ? next.agentSurfaces
    : structuredClone(DEFAULT_CONFIG.agentSurfaces);
  next.agentSurfaces.selectionOwner = 'host-user';
  next.agentSurfaces.supported = [...new Set([
    ...asArray(configuredAgentSurfaces.supported),
    ...asArray(configuredAgentSurfaces.compatible),
    ...DEFAULT_CONFIG.agentSurfaces.supported,
  ])];
  delete next.agentSurfaces.primary;
  delete next.agentSurfaces.compatible;
  next.entryFiles = isPlainObject(next.entryFiles) ? next.entryFiles : structuredClone(DEFAULT_CONFIG.entryFiles);
  next.entryFiles.create = asArray(next.entryFiles.create);
  next.entryFiles.bindIfPresent = asArray(next.entryFiles.bindIfPresent);
  if (!next.entryFiles.create.includes('AGENTS.md')) next.entryFiles.create.unshift('AGENTS.md');
  next.entryFiles.create = [...new Set(next.entryFiles.create.map(normalizeRel))];
  next.entryFiles.bindIfPresent = [...new Set(
    next.entryFiles.bindIfPresent
      .map(normalizeRel)
      .filter((entryRel) => !next.entryFiles.create.includes(entryRel)),
  )];
  next.detection.ignoreDirs = [...new Set([
    ...DEFAULT_CONFIG.detection.ignoreDirs,
    ...asArray(next.detection.ignoreDirs),
  ].map((item) => item.toLowerCase()))];
  next.detection.sourceRoots.include = asArray(next.detection.sourceRoots.include);
  next.detection.sourceRoots.exclude = asArray(next.detection.sourceRoots.exclude);
  next.detection.semanticModules.include = asArray(next.detection.semanticModules.include);
  next.detection.semanticModules.exclude = asArray(next.detection.semanticModules.exclude);
  next.detection.semanticModules.promoteCandidates = asArray(next.detection.semanticModules.promoteCandidates);
  next.detection.semanticModules.ignoreCandidates = asArray(next.detection.semanticModules.ignoreCandidates);
  next.hooks.disabledHookIds = Array.isArray(next.hooks.disabledHookIds) ? next.hooks.disabledHookIds.filter((item) => typeof item === 'string') : [];
  next.hooks.extraHooks = Array.isArray(next.hooks.extraHooks) ? next.hooks.extraHooks.filter(isPlainObject) : [];
  next.initialization = isPlainObject(next.initialization)
    ? next.initialization
    : structuredClone(DEFAULT_CONFIG.initialization);
  next.initialization.defaultAdoptionProfile = Object.hasOwn(ADOPTION_LEVEL_BY_PROFILE, configuredAdoptionProfile)
    ? configuredAdoptionProfile
    : (Number.isInteger(configuredLegacyMaturity)
        ? (Object.entries(ADOPTION_LEVEL_BY_PROFILE).find(([, level]) => level === configuredLegacyMaturity)?.[0] || DEFAULT_ADOPTION_PROFILE)
        : DEFAULT_ADOPTION_PROFILE);
  delete next.initialization.defaultMaturityLevel;
  next.templateSync = isPlainObject(next.templateSync)
    ? next.templateSync
    : structuredClone(DEFAULT_CONFIG.templateSync);
  next.templateSync.moduleSelection = ['manifest', 'explicit'].includes(next.templateSync.moduleSelection)
    ? next.templateSync.moduleSelection
    : DEFAULT_CONFIG.templateSync.moduleSelection;
  next.templateSync.modules = asArray(next.templateSync.modules);
  next.developerServices = isPlainObject(next.developerServices)
    ? next.developerServices
    : structuredClone(DEFAULT_CONFIG.developerServices);
  next.developerServices.mode = ['safety-only', 'managed-registry'].includes(next.developerServices.mode)
    ? next.developerServices.mode
    : DEFAULT_CONFIG.developerServices.mode;
  next.developerServices.managedProviders = asArray(next.developerServices.managedProviders);
  next.automation = isPlainObject(next.automation) ? next.automation : structuredClone(DEFAULT_CONFIG.automation);
  next.automation.githubActionsPolicy = ['inherit', 'allow', 'deny'].includes(configuredGitHubActionsPolicy)
    ? configuredGitHubActionsPolicy
    : (configuredLegacyAllowGitHubActions ? 'allow' : DEFAULT_CONFIG.automation.githubActionsPolicy);
  delete next.automation.allowGitHubActions;
  next.codeHealth = isPlainObject(next.codeHealth) ? next.codeHealth : structuredClone(DEFAULT_CONFIG.codeHealth);
  next.codeHealth.mode = ['off', 'advisory', 'ratchet', 'strict'].includes(next.codeHealth.mode)
    ? next.codeHealth.mode
    : DEFAULT_CONFIG.codeHealth.mode;
  next.codeHealth.fileLinesWarn = Number.isInteger(next.codeHealth.fileLinesWarn) && next.codeHealth.fileLinesWarn > 0
    ? next.codeHealth.fileLinesWarn
    : DEFAULT_CONFIG.codeHealth.fileLinesWarn;
  next.codeHealth.fileLinesNoGrowth = Number.isInteger(next.codeHealth.fileLinesNoGrowth) && next.codeHealth.fileLinesNoGrowth > 0
    ? next.codeHealth.fileLinesNoGrowth
    : DEFAULT_CONFIG.codeHealth.fileLinesNoGrowth;
  next.codeHealth.excludeDirs = asArray(next.codeHealth.excludeDirs);
  next.codeHealth.excludePaths = asArray(next.codeHealth.excludePaths);
  next.codeHealth.largeFileAllowlist = asArray(next.codeHealth.largeFileAllowlist);
  const maxAuto = Number(next.detection.semanticModules.maxAutomaticPerSourceRoot);
  next.detection.semanticModules.maxAutomaticPerSourceRoot = Number.isFinite(maxAuto) && maxAuto >= 0 ? maxAuto : 12;
  return next;
}

export async function loadRepoConfig(repoPath) {
  for (const configPath of [
    path.join(repoPath, 'devrules', 'config.json'),
    path.join(repoPath, 'devrules.config.json'),
  ]) {
    if (!(await pathExists(configPath))) continue;
    try {
      return { config: normalizeConfig(JSON.parse(await readText(configPath))), configPath, malformed: false };
    } catch {
      return { config: normalizeConfig({}), configPath, malformed: true };
    }
  }
  return { config: normalizeConfig({}), configPath: null, malformed: false };
}

export function configContent(config, sourceRoots = [], semanticModules = [], anchorCandidates = []) {
  const next = normalizeConfig(config);
  next._notes = [
    'Project-local devrules configuration.',
    'Use include/exclude/promote/ignore lists to tune initialization without editing the shared script.',
    'entryFiles.create is created when missing; entryFiles.bindIfPresent is updated only when the file already exists.',
    'workspace.defaultRoot is used by workspace commands when --root is omitted.',
    'workspace.additionalRoots can list other workspace parent directories on the same device; workspace sync-template also reads registered template workspaces.',
    'templateSync.moduleSelection=manifest follows manifest.installedModules; explicit uses templateSync.modules and automatically includes declared module dependencies.',
    'memory settings describe Agent-mediated feedback capture; project memory stays local to this repository.',
    'automation settings describe devrules script defaults; writes still require explicit --apply.',
    'automation.githubActionsPolicy defaults to inherit: preserve committed workflows, but require approval before Agent-created or materially changed hosted CI.',
    'developerServices defaults to safety-only; managed-registry is an explicit project choice.',
    'Entry-file paths are canonical repository-relative paths using forward slashes; parent traversal, version-control/devrules control data, symlink topology, and non-regular targets are rejected before writes.',
  ];
  next._lastDetected = {
    sourceRoots,
    semanticModules,
    anchorCandidates: anchorCandidates.slice(0, 50),
    updatedAt: today(),
  };
  return `${JSON.stringify(next, null, 2)}\n`;
}

export async function ensureConfig(repoPath, config, sourceRoots, semanticModules, anchorCandidates, apply, actions) {
  const configPath = path.join(repoPath, 'devrules', 'config.json');
  if (await pathExists(configPath)) {
    actions.push({ action: 'skip', path: configPath, reason: 'project config already exists' });
    return;
  }
  await writeText(configPath, configContent(config, sourceRoots, semanticModules, anchorCandidates), apply, actions, 'create project devrules config');
}
