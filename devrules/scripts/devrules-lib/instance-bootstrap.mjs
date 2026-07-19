import { existsSync } from 'node:fs';
import path from 'node:path';

import {
  buildHooksJsonContent,
  normalizeHookRegistryMetadata,
} from './hooks.mjs';
import {
  ensureMissingText,
  normalizeRel,
  nowIso,
  pathExists,
  readText,
  today,
  writeText,
  writeTextIfChanged,
} from './fs-actions.mjs';
import {
  ADOPTION_LEVEL_BY_PROFILE,
  DEFAULT_ENTRY_BIND_IF_PRESENT_FILES,
  DEFAULT_ENTRY_CREATE_FILES,
  loadRepoConfig,
  normalizeAdoptionProfile,
} from './repo-config.mjs';
import {
  bindConfiguredEntryFiles,
  ensureCursorRoutingCard,
} from './project-entry-files.mjs';
import { hasReadmeAnchor } from './readme-anchors.mjs';

const PROJECT_PROFILE_START = '<!-- DEVRULES:PROJECT-PROFILE-START -->';
const PROJECT_PROFILE_END = '<!-- DEVRULES:PROJECT-PROFILE-END -->';
const CURSOR_DEVRULES_RULE = '.cursor/rules/devrules.mdc';
const REQUIRED_MEMORY = [
  'project-profile.md',
  'decisions.md',
  'interaction-log.md',
  'lessons.md',
  'evolution-suggestions.md',
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

function upsertManagedSection(content, startMarker, endMarker, section) {
  const start = content.indexOf(startMarker);
  const end = content.indexOf(endMarker);

  if (start !== -1 && end !== -1 && end > start) {
    const after = end + endMarker.length;
    return `${content.slice(0, start).trimEnd()}\n\n${section}\n\n${content.slice(after).trimStart()}`.trimEnd() + '\n';
  }

  const lines = content.split(/\r?\n/);
  const headingIndex = lines.findIndex((line) => /^#\s+/.test(line));
  if (headingIndex !== -1) {
    const before = lines.slice(0, headingIndex + 1).join('\n');
    const after = lines.slice(headingIndex + 1).join('\n').trimStart();
    return `${before}\n\n${section}\n\n${after}`.trimEnd() + '\n';
  }

  return `${section}\n\n${content.trimStart()}`.trimEnd() + '\n';
}

function extractProjectProfileCommandsSection(content) {
  const managedStart = content.indexOf(PROJECT_PROFILE_START);
  const managedEnd = content.indexOf(PROJECT_PROFILE_END);
  if (managedStart === -1 || managedEnd === -1 || managedEnd <= managedStart) return null;
  const managed = content.slice(managedStart, managedEnd);
  const match = managed.match(/\n## Commands(?: To Fill)?\n[\s\S]*?(?=\n## Anchor Maintenance)/);
  if (!match) return null;
  const section = match[0].trim();
  const rows = section.split(/\r?\n/).filter((line) => /^\|/.test(line) && !/^\|\s*-/.test(line));
  const hasFilledCommand = rows.some((row) => {
    const cells = row.split('|').map((cell) => cell.trim());
    if (cells.length < 4 || /^(Task|\u4efb\u52a1)$/i.test(cells[1])) return false;
    return cells[2].length > 0;
  });
  return hasFilledCommand ? section : null;
}

function extractProjectProfileField(content, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = String(content || '').match(new RegExp(`^- ${escaped}:\\s*(.+)$`, 'm'));
  const value = match ? match[1].trim() : '';
  return value && value !== 'unknown' ? value : null;
}

function projectProfileManagedSection(repoPath, sourceRoots, semanticModules, anchorCandidates, stack, commandsSection = null, preservedMainStack = null) {
  const repoName = path.basename(repoPath);
  const entryDocs = ['AGENTS.md'];
  if (existsSync(path.join(repoPath, 'CLAUDE.md'))) entryDocs.push('CLAUDE.md');
  const candidateSummary = anchorCandidates.length
    ? anchorCandidates.slice(0, 24).map((candidate) => `${candidate.path} (${candidate.reason})`).join('; ')
    : 'none detected';
  const mainStack = stack.length ? stack.join(', ') : (preservedMainStack || 'unknown');
  const iosSimulatorProfile = stack.some((item) => item === 'ios' || item === 'swift')
    ? '\n- iOS Simulator profile: devrules/memory/ios-simulator-device-profile.json (required before persistent Simulator mutation)'
    : '';
  const commandBlock = commandsSection || `## Commands To Fill

| Task | Command |
| --- | --- |
| Install | |
| Dev | |
| Test | |
| Build | |
| Lint | |`;

  return `${PROJECT_PROFILE_START}
## devrules Managed Project Map

- Repository: ${repoName}
- Main stack: ${mainStack}
- Entry docs: ${entryDocs.join(', ')}
- Orchestration root: devrules/always-readme.md
- Source roots: ${sourceRoots.length ? sourceRoots.join(', ') : 'none detected'}
- Semantic module anchors: ${semanticModules.length ? semanticModules.join(', ') : 'none detected'}
- Anchor candidates: ${candidateSummary}${anchorCandidates.length > 24 ? `; and ${anchorCandidates.length - 24} more in manifest` : ''}${iosSimulatorProfile}
- Last scanned: ${today()}

${commandBlock}

## Anchor Maintenance

Update this profile when project platforms, source roots, commands, major module boundaries, or verification expectations change. Keep project-specific learning in this repository's \`devrules/memory/\`.
${PROJECT_PROFILE_END}`;
}

async function ensureProjectProfile(repoPath, sourceRoots, semanticModules, anchorCandidates, stack, apply, actions) {
  const profilePath = path.join(repoPath, 'devrules', 'memory', 'project-profile.md');

  if (!(await pathExists(profilePath))) {
    const section = projectProfileManagedSection(repoPath, sourceRoots, semanticModules, anchorCandidates, stack);
    await writeText(
      profilePath,
      `# Project Profile\n\n${section}\n\n## Project Notes\n\nAdd stable human-maintained context here.\n`,
      apply,
      actions,
      'create project profile memory',
    );
    return;
  }

  const current = await readText(profilePath);
  const preservedCommands = extractProjectProfileCommandsSection(current);
  const preservedMainStack = stack.length ? null : extractProjectProfileField(current, 'Main stack');
  const section = projectProfileManagedSection(repoPath, sourceRoots, semanticModules, anchorCandidates, stack, preservedCommands, preservedMainStack);
  const next = upsertManagedSection(current, PROJECT_PROFILE_START, PROJECT_PROFILE_END, section);
  if (current === next) {
    actions.push({ action: 'skip', path: profilePath, reason: 'project profile managed section already current' });
    return;
  }

  await writeText(profilePath, next, apply, actions, 'upsert project profile managed section');
}

function memoryFileContent(name) {
  const date = today();
  switch (name) {
    case 'decisions.md':
      return `# Decisions

Durable project decisions belong here.

## ${date} - devrules initialized

- Context: The repository adopted a project-local devrules instance.
- Decision: Official Agent entry files should point to devrules/always-readme.md while preserving their original content.
- Scope: Agent onboarding, workflow routing, memory, and automation.
- Consequence: Future Agents should read devrules before repository-specific lower-priority details.
`;
    case 'interaction-log.md':
      return `# Interaction Log

Recent useful interaction notes belong here until they are distilled into decisions, lessons, or evolution suggestions.
`;
    case 'lessons.md':
      return `# Lessons

Reusable lessons from debugging and implementation belong here.
`;
    case 'evolution-suggestions.md':
      return `# Evolution Suggestions

Suggestions for improving the shared devrules template belong here. These are reviewed manually before template changes.
`;
    default:
      return '';
  }
}

export async function ensureMemory(repoPath, sourceRoots, semanticModules, anchorCandidates, stack, apply, actions) {
  const memoryDir = path.join(repoPath, 'devrules', 'memory');
  await ensureProjectProfile(repoPath, sourceRoots, semanticModules, anchorCandidates, stack, apply, actions);

  for (const file of REQUIRED_MEMORY.filter((item) => item !== 'project-profile.md')) {
    await ensureMissingText(path.join(memoryDir, file), memoryFileContent(file), apply, actions, `create memory file ${file}`);
  }
}

export async function ensureHooks(repoPath, stack, config, apply, actions, syncTemplate, templateRoot) {
  const hooksDir = path.join(repoPath, 'devrules', 'hooks');
  const readmePath = path.join(hooksDir, 'README.md');
  const hooksPath = path.join(hooksDir, 'hooks.json');
  const localHooksPath = path.join(hooksDir, 'hooks.local.json');

  if (!(await pathExists(readmePath))) {
    const templateReadme = await readText(path.join(templateRoot, 'hooks', 'README.md'));
    await writeTextIfChanged(readmePath, templateReadme, apply, actions, 'create devrules hooks README');
  } else {
    actions.push({ action: 'skip', path: readmePath, reason: 'already exists; preserve project hook README' });
  }

  if (!(await pathExists(hooksPath))) {
    const content = await buildHooksJsonContent(templateRoot, stack, config, today());
    await writeTextIfChanged(hooksPath, content, apply, actions, (await pathExists(hooksPath)) ? 'sync project workflow hook registry' : 'create project workflow hook registry');
  } else {
    const current = await readText(hooksPath);
    const normalized = normalizeHookRegistryMetadata(current);
    if (normalized && normalized !== current) {
      await writeTextIfChanged(hooksPath, normalized, apply, actions, 'normalize hook scope metadata');
    } else {
      actions.push({ action: 'skip', path: hooksPath, reason: 'already exists; preserve project hook registry' });
    }
  }

  const localRegistryContent = await buildHooksJsonContent(templateRoot, stack, config, today(), 'local');
  const localRegistry = JSON.parse(localRegistryContent);
  if (await pathExists(localHooksPath)) {
    actions.push({ action: 'skip', path: localHooksPath, reason: 'project-owned hook overlay is never changed by template automation' });
  } else if (!syncTemplate && localRegistry.hooks.length > 0) {
    await writeTextIfChanged(localHooksPath, localRegistryContent, apply, actions, 'create project-owned hook overlay');
  }
}

export async function ensureManifest(repoPath, config, configPath, entryFileResults, sourceRoots, semanticModules, anchorCandidates, stack, adoptionProfile, observedAdoptionLevel, legacyImports, syncTemplate, apply, actions, version) {
  const manifestPath = path.join(repoPath, 'devrules', 'manifest.json');
  let existing = {};
  if (await pathExists(manifestPath)) {
    try {
      existing = JSON.parse(await readText(manifestPath));
    } catch {
      existing = {};
    }
  }

  const installedModules = [...INSTALLABLE_MODULES];
  const enabledModules = [
    'core-orchestration',
    ...(adoptionProfile === 'minimal' ? [] : ['core-rules', 'workflow-management', 'memory']),
    ...(adoptionProfile === 'minimal' || config.hooks.enabled === false ? [] : ['hooks']),
    ...(adoptionProfile === 'full' ? ['context-fractal'] : []),
  ];
  const manifest = {
    ...existing,
    schemaVersion: 1,
    system: 'devrules',
    devrulesVersion: version,
    initializedAt: existing.initializedAt || nowIso(),
    updatedAt: nowIso(),
    adoptionProfile,
    selectedProfileLevel: ADOPTION_LEVEL_BY_PROFILE[adoptionProfile],
    observedAdoptionLevel,
    maturityLevel: observedAdoptionLevel,
    entryBindings: {
      agents: await pathExists(path.join(repoPath, 'AGENTS.md')),
      claude: await pathExists(path.join(repoPath, 'CLAUDE.md')),
      files: entryFileResults.map((result) => ({
        file: result.file,
        required: result.required,
        exists: result.exists,
        bound: result.bound,
        created: result.created,
      })),
    },
    installedModules,
    enabledModules,
    dormantModules: installedModules.filter((moduleId) => !enabledModules.includes(moduleId)),
    configPath: configPath ? normalizeRel(path.relative(repoPath, configPath)) : 'devrules/config.json',
    configSchemaVersion: config.schemaVersion,
    sourceRoots,
    semanticModules,
    anchorCandidates,
    detectedStack: stack,
    legacyImports,
    templateSyncApplied: syncTemplate,
  };

  const comparableExisting = { ...existing, updatedAt: manifest.updatedAt };
  if (JSON.stringify(comparableExisting) === JSON.stringify(manifest)) {
    actions.push({ action: 'skip', path: manifestPath, reason: 'manifest already current' });
    return;
  }

  await writeText(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, apply, actions, 'write devrules manifest');
}

function normalizeRelArray(values) {
  return Array.isArray(values)
    ? values.map((value) => normalizeRel(value)).filter(Boolean)
    : [];
}

function normalizeAnchorCandidates(values) {
  if (!Array.isArray(values)) return [];
  return values
    .filter((candidate) => candidate && typeof candidate === 'object' && candidate.path)
    .map((candidate) => ({
      path: normalizeRel(candidate.path),
      reason: typeof candidate.reason === 'string' ? candidate.reason : 'candidate only: preserved from existing project state',
    }));
}

export async function readExistingProjectFacts(repoPath, config) {
  const manifestPath = path.join(repoPath, 'devrules', 'manifest.json');
  const facts = {
    adoptionProfile: null,
    maturityLevel: 0,
    sourceRoots: [],
    semanticModules: [],
    anchorCandidates: [],
  };

  if (await pathExists(manifestPath)) {
    try {
      const manifest = JSON.parse(await readText(manifestPath));
      const maturity = Number(manifest.maturityLevel);
      facts.maturityLevel = Number.isFinite(maturity) ? maturity : 0;
      facts.adoptionProfile = normalizeAdoptionProfile(manifest.adoptionProfile, facts.maturityLevel);
      facts.sourceRoots = normalizeRelArray(manifest.sourceRoots);
      facts.semanticModules = normalizeRelArray(manifest.semanticModules);
      facts.anchorCandidates = normalizeAnchorCandidates(manifest.anchorCandidates);
    } catch {
      // Ignore malformed historical manifests; audit reports the JSON error separately.
    }
  }

  const lastDetected = config?._lastDetected || {};
  if (!facts.sourceRoots.length) facts.sourceRoots = normalizeRelArray(lastDetected.sourceRoots);
  if (!facts.semanticModules.length) facts.semanticModules = normalizeRelArray(lastDetected.semanticModules);
  if (!facts.anchorCandidates.length) facts.anchorCandidates = normalizeAnchorCandidates(lastDetected.anchorCandidates);
  return facts;
}

export async function projectedAdoptionLevel(repoPath, entryFileResults, anchorTargets, adoptionProfile, apply) {
  let level = entryFileResults.some((result) => result.bound) ? 1 : 0;
  if (level >= 1) level = 2;
  if (level < 2 || !anchorTargets.length) return level;

  if (!apply && adoptionProfile === 'full') return 3;
  for (const anchor of anchorTargets) {
    if (!(await hasReadmeAnchor(repoPath, anchor))) return level;
  }
  return 3;
}

export async function refreshConfiguredEntryFiles(repoPath, apply, actions = []) {
  try {
    const { config, configPath, malformed } = await loadRepoConfig(repoPath);
    if (malformed) {
      actions.push({ action: 'warn', path: configPath, reason: 'project devrules config is malformed; using defaults' });
    }
    const entryFiles = await bindConfiguredEntryFiles(repoPath, config, apply, actions, {
      create: DEFAULT_ENTRY_CREATE_FILES,
      bindIfPresent: DEFAULT_ENTRY_BIND_IF_PRESENT_FILES,
    });
    const cursorWillBeCreated = entryFiles.some((entry) => entry.file === CURSOR_DEVRULES_RULE && entry.created);
    await ensureCursorRoutingCard(repoPath, apply, actions, { plannedCreate: cursorWillBeCreated });
    return { repo: repoPath, apply, configPath, configMalformed: malformed, entryFiles, actions };
  } catch (error) {
    error.actions = [...actions, ...(error.actions || [])];
    throw error;
  }
}

export async function projectProfileHasEmptyCommands(repoPath) {
  const content = await readText(path.join(repoPath, 'devrules', 'memory', 'project-profile.md'));
  if (!content.includes(PROJECT_PROFILE_START)) return false;
  return /\|\s+(Install|Dev|Test|Build|Lint)\s+\|\s*\|/.test(content);
}
