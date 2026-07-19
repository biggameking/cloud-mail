import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import {
  isSubPath,
  listDirs,
  normalizeRel,
  pathExists,
} from './fs-actions.mjs';
import { isNestedGitRepoDir } from './repo-discovery.mjs';
import {
  README_ANCHOR_SKIP_DIRS as SKIP_ANCHOR_DIRS,
  README_ANCHOR_SOURCE_EXTENSIONS as SOURCE_EXTENSIONS,
} from './readme-anchors.mjs';
import { normalizeConfig } from './repo-config.mjs';

export const ANCHOR_RELEVANT_EXTENSIONS = new Set([
  ...SOURCE_EXTENSIONS,
  '.strings',
  '.xcstrings',
  '.plist',
  '.storyboard',
  '.xib',
  '.json',
  '.jsonc',
  '.yml',
  '.yaml',
  '.toml',
  '.sql',
  '.graphql',
  '.proto',
  '.tscn',
  '.tres',
  '.res',
]);
const WEB_LANE_DIRS = new Set(['components', 'pages', 'routes', 'views', 'layouts', 'services', 'hooks', 'stores', 'store', 'data', 'api', 'lib', 'features', 'modules']);
const PLATFORM_LANE_DIRS = new Set(['src-tauri', 'electron', 'native', 'ios', 'android']);
const ARCHITECTURE_LANE_DIRS = new Set([
  'app',
  'application',
  'core',
  'domain',
  'features',
  'feature',
  'infrastructure',
  'navigation',
  'resources',
  'resource',
  'services',
  'service',
  'ui',
  'views',
  'viewmodels',
  'viewmodel',
  'models',
  'model',
  'data',
]);
const PACKAGE_BOUNDARY_FILES = ['package.json', 'Cargo.toml', 'pyproject.toml', 'go.mod', 'pom.xml', 'build.gradle', 'Package.swift'];
const PUBLIC_ENTRY_FILES = ['index.ts', 'index.tsx', 'index.js', 'index.jsx', 'mod.rs', 'lib.rs', 'main.rs'];

export function shouldIgnoreDir(name, config) {
  const normalized = normalizeRel(name).toLowerCase();
  return SKIP_ANCHOR_DIRS.has(normalized) || config.detection.ignoreDirs.includes(normalized);
}

export async function isGodotProject(repoPath) {
  return pathExists(path.join(repoPath, 'project.godot'));
}

export async function detectSourceRoots(repoPath, config) {
  const roots = new Set();
  const addIfExists = async (candidate, requireSource = true) => {
    const rel = normalizeRel(candidate);
    if (config.detection.sourceRoots.exclude.includes(rel)) return;
    const fullPath = path.join(repoPath, candidate);
    if (!(await pathExists(fullPath))) return;
    if (await isNestedGitRepoDir(fullPath)) return;
    if (requireSource && !(await containsSourceFiles(fullPath, 3, config))) return;
    roots.add(rel);
  };

  if (await pathExists(path.join(repoPath, 'package.json'))) {
    if (await pathExists(path.join(repoPath, 'src'))) {
      await addIfExists('src');
    } else {
      for (const candidate of ['app', 'pages', 'components', 'lib', 'server', 'api', 'routes']) {
        await addIfExists(candidate);
      }
    }
  }

  if (await pathExists(path.join(repoPath, 'src-tauri'))) {
    await addIfExists('src-tauri', false);
    await addIfExists('src-tauri/src');
  }

  if (await pathExists(path.join(repoPath, 'Cargo.toml'))) {
    await addIfExists('src');
  }

  if (await isGodotProject(repoPath)) {
    for (const candidate of ['scenes', 'scripts', 'autoload', 'addons', 'resources']) {
      const fullPath = path.join(repoPath, candidate);
      const hasGodotContent = await containsSourceFiles(fullPath, 3, config)
        || await containsAnchorRelevantFiles(fullPath, 3, config);
      if (hasGodotContent) await addIfExists(candidate, false);
    }
  }

  for (const candidate of ['ios', 'android', 'cmd', 'internal', 'pkg']) {
    await addIfExists(candidate);
  }

  for (const workspaceDir of ['apps', 'packages']) {
    const full = path.join(repoPath, workspaceDir);
    if (!(await pathExists(full))) continue;
    const children = await listDirs(full);
    for (const child of children) {
      if (await containsSourceFiles(child, 3, config)) roots.add(normalizeRel(path.join(workspaceDir, path.basename(child))));
    }
  }

  for (const candidate of ['backend', 'client', 'desktop', 'engine', 'frontend', 'server']) {
    await addIfExists(candidate);
  }

  if (!roots.size) {
    const children = await listDirs(repoPath);
    for (const child of children) {
      const name = path.basename(child);
      if (shouldIgnoreDir(name, config)) continue;
      if (await isNestedGitRepoDir(child)) continue;
      if (await containsSourceFiles(child, 2, config)) roots.add(normalizeRel(name));
      if (roots.size >= 8) break;
    }
  }

  for (const include of config.detection.sourceRoots.include) {
    await addIfExists(include, false);
  }

  for (const exclude of config.detection.sourceRoots.exclude) {
    roots.delete(exclude);
  }

  return [...roots].sort((a, b) => a.localeCompare(b));
}

export async function containsSourceFiles(dirPath, maxDepth = 3, config = normalizeConfig({})) {
  if (maxDepth < 0) return false;
  let entries;
  try {
    entries = await fs.readdir(dirPath, { withFileTypes: true });
  } catch {
    return false;
  }

  for (const entry of entries) {
    const full = path.join(dirPath, entry.name);
    if (entry.isFile() && SOURCE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) return true;
    if (entry.isDirectory() && (await isNestedGitRepoDir(full))) continue;
    if (entry.isDirectory() && !shouldIgnoreDir(entry.name, config) && (await containsSourceFiles(full, maxDepth - 1, config))) {
      return true;
    }
  }

  return false;
}

export async function containsAnchorRelevantFiles(dirPath, maxDepth = 2, config = normalizeConfig({})) {
  if (maxDepth < 0) return false;
  let entries;
  try {
    entries = await fs.readdir(dirPath, { withFileTypes: true });
  } catch {
    return false;
  }

  for (const entry of entries) {
    const full = path.join(dirPath, entry.name);
    if (entry.isFile() && ANCHOR_RELEVANT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) return true;
    if (entry.isDirectory() && (await isNestedGitRepoDir(full))) continue;
    if (entry.isDirectory() && !shouldIgnoreDir(entry.name, config) && (await containsAnchorRelevantFiles(full, maxDepth - 1, config))) {
      return true;
    }
  }

  return false;
}

async function hasPackageBoundary(dirPath) {
  for (const file of PACKAGE_BOUNDARY_FILES) {
    if (await pathExists(path.join(dirPath, file))) return true;
  }
  return false;
}

async function hasPublicEntry(dirPath) {
  for (const file of PUBLIC_ENTRY_FILES) {
    if (await pathExists(path.join(dirPath, file))) return true;
  }
  return false;
}

async function countImmediateSourceChildren(dirPath, config) {
  const children = await listDirs(dirPath);
  let count = 0;
  for (const child of children) {
    const name = path.basename(child);
    if (shouldIgnoreDir(name, config)) continue;
    if (await containsSourceFiles(child, 2, config)) count += 1;
  }
  return count;
}

export async function classifySemanticModuleRoots(repoPath, sourceRoots, config) {
  const sourceSet = new Set(sourceRoots.map(normalizeRel));
  const modules = [];
  const candidates = [];
  const includeSet = new Set(config.detection.semanticModules.include);
  const excludeSet = new Set(config.detection.semanticModules.exclude);
  const promoteSet = new Set(config.detection.semanticModules.promoteCandidates);
  const ignoreSet = new Set(config.detection.semanticModules.ignoreCandidates);

  for (const sourceRoot of sourceRoots) {
    const fullSourceRoot = path.join(repoPath, sourceRoot);
    const children = await listDirs(fullSourceRoot);
    const sourceChildCount = await countImmediateSourceChildren(fullSourceRoot, config);
    const crowded = sourceChildCount > config.detection.semanticModules.maxAutomaticPerSourceRoot;
    for (const child of children) {
      const name = path.basename(child);
      const rel = normalizeRel(path.relative(repoPath, child));
      if (shouldIgnoreDir(name, config)) continue;
      if (await isNestedGitRepoDir(child)) continue;
      if (excludeSet.has(rel) || ignoreSet.has(rel)) continue;
      if (sourceSet.has(rel)) continue;
      if ([...sourceSet].some((root) => isSubPath(rel, root))) continue;
      const hasSource = await containsSourceFiles(child, 3, config);
      const hasAnchorRelevant = hasSource || await containsAnchorRelevantFiles(child, 2, config);
      if (!hasAnchorRelevant) continue;

      const hasBoundary = await hasPackageBoundary(child);
      const hasEntry = await hasPublicEntry(child);
      const normalizedName = name.toLowerCase();
      const isWebLane = WEB_LANE_DIRS.has(normalizedName);
      const isPlatformLane = PLATFORM_LANE_DIRS.has(normalizedName);
      const isArchitectureLane = ARCHITECTURE_LANE_DIRS.has(normalizedName);
      const shouldAnchor = includeSet.has(rel) || promoteSet.has(rel) || hasBoundary || isArchitectureLane || (!crowded && (isWebLane || isPlatformLane || hasEntry));

      if (shouldAnchor) {
        modules.push(rel);
      } else {
        candidates.push({
          path: rel,
          reason: crowded
            ? `candidate only: ${normalizeRel(sourceRoot)} has ${sourceChildCount} source child directories`
            : 'candidate only: not enough boundary signal for automatic README anchor',
        });
      }
    }
  }

  for (const include of [...includeSet, ...promoteSet]) {
    if (sourceSet.has(include) || excludeSet.has(include) || ignoreSet.has(include)) continue;
    if (await pathExists(path.join(repoPath, include))) modules.push(include);
  }

  return {
    semanticModules: [...new Set(modules)].sort((a, b) => a.localeCompare(b)),
    anchorCandidates: candidates
      .filter((candidate) => !modules.includes(candidate.path) && !ignoreSet.has(candidate.path))
      .sort((a, b) => a.path.localeCompare(b.path)),
  };
}

export async function detectStack(repoPath) {
  const stack = [];
  if (await pathExists(path.join(repoPath, 'package.json'))) stack.push('node');
  if (await pathExists(path.join(repoPath, 'next.config.js')) || await pathExists(path.join(repoPath, 'next.config.mjs'))) stack.push('next');
  if (await pathExists(path.join(repoPath, 'vite.config.ts')) || await pathExists(path.join(repoPath, 'vite.config.js'))) stack.push('vite');
  if (await pathExists(path.join(repoPath, 'src-tauri', 'tauri.conf.json'))) stack.push('tauri');
  if (await pathExists(path.join(repoPath, 'Cargo.toml')) || await pathExists(path.join(repoPath, 'src-tauri', 'Cargo.toml'))) stack.push('rust');
  if (await pathExists(path.join(repoPath, 'ios'))) stack.push('ios');
  if (await pathExists(path.join(repoPath, 'android'))) stack.push('android');
  if (await isGodotProject(repoPath)) stack.push('godot');
  if (await pathExists(path.join(repoPath, 'pnpm-workspace.yaml'))) stack.push('pnpm-workspace');
  if ([
    'pyproject.toml',
    'requirements.txt',
    'setup.py',
    'Pipfile',
  ].some((file) => existsSync(path.join(repoPath, file)))) stack.push('python');
  if (await pathExists(path.join(repoPath, 'go.mod'))) stack.push('go');
  if (await pathExists(path.join(repoPath, 'Package.swift'))) stack.push('swift');
  if ([
    'pom.xml',
    'build.gradle',
    'build.gradle.kts',
  ].some((file) => existsSync(path.join(repoPath, file)))) stack.push('jvm');
  const rootDirs = await listDirs(repoPath);
  if (rootDirs.some((dir) => /\.(xcodeproj|xcworkspace)$/i.test(path.basename(dir)))) stack.push('swift');
  return [...new Set(stack)];
}
