import path from 'node:path';

const SOURCE_OWNERSHIPS = new Set(['shared', 'seed', 'local']);

export const INSTALLABLE_TEMPLATE_MODULES = new Set([
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
]);

export const LEGACY_TEMPLATE_MODULE = 'legacy-template';

export const TEMPLATE_MODULE_DEPENDENCIES = Object.freeze({
  'workflow-management': Object.freeze(['core-rules']),
  hooks: Object.freeze(['workflow-management', 'core-rules']),
  'core-orchestration': Object.freeze(['configuration', 'scripts', 'workflow-management', 'core-rules']),
});

export const TEMPLATE_MODULE_ATOMIC_GROUPS = Object.freeze([
  Object.freeze(['configuration', 'scripts']),
]);

const TEMPLATE_MODULE_SELECTION_MODES = new Set(['manifest', 'explicit']);

const DESIGN_ROOT_FILES = new Set([
  'DESIGN.template.md',
  'DESIGN.example.md',
  'design-readme.md',
  'design.config.json',
  'design-guard.allow.json',
]);

function scalar(value) {
  const trimmed = String(value || '').trim();
  if (trimmed.length >= 2 && (
    trimmed.startsWith('"') && trimmed.endsWith('"')
    || trimmed.startsWith("'") && trimmed.endsWith("'")
  )) return trimmed.slice(1, -1).trim();
  return trimmed;
}

function markdownFrontmatter(content) {
  const text = Buffer.isBuffer(content) ? content.toString('utf8') : String(content || '');
  const match = /^(?:\uFEFF)?---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(text);
  if (!match) return { present: false, values: {} };
  const values = {};
  for (const line of match[1].split(/\r?\n/)) {
    const field = /^([A-Za-z][A-Za-z0-9_-]*):[ \t]*(.*)$/.exec(line);
    if (field) values[field[1]] = scalar(field[2]);
  }
  return { present: true, values };
}

export function defaultTemplateModule(relPath) {
  const normalized = String(relPath || '').replaceAll('\\', '/');
  const top = normalized.split('/')[0];
  if (normalized === 'always-readme.md') return 'core-orchestration';
  if (normalized === 'template.json' || normalized === 'CHANGELOG.md' || normalized === 'config.json') return 'configuration';
  if (DESIGN_ROOT_FILES.has(normalized) || top === 'design-styles' || /^DESIGN(?:[.-]|$)/.test(path.basename(normalized))) return 'design-system';
  if (top === 'rules') return 'core-rules';
  if (top === 'workflows') return 'workflow-management';
  if (top === 'profiles') return 'profiles';
  if (top === 'templates') return 'work-system-assets';
  if (top === 'scripts') return 'scripts';
  if (top === 'hooks') return 'hooks';
  if (top === 'memory') return 'memory';
  return 'configuration';
}

export function classifyManagedTemplateFiles(files) {
  const markdown = files.filter((file) => /\.md$/i.test(file.relPath) && file.relPath !== 'CHANGELOG.md');
  const metadataByPath = new Map(markdown.map((file) => [file.relPath, markdownFrontmatter(file.content)]));
  const policyEnabled = [...metadataByPath.values()].some((metadata) => Object.hasOwn(metadata.values, 'ownership')
    || Object.hasOwn(metadata.values, 'sync_module'));
  const policyMode = policyEnabled ? 'classified' : 'legacy';

  return {
    policyMode,
    files: files.map((file) => {
      if (!policyEnabled) {
        return {
          ...file,
          sourceOwnership: 'shared',
          moduleId: LEGACY_TEMPLATE_MODULE,
          policyMode,
        };
      }

      const requiresOwnership = /\.md$/i.test(file.relPath) && file.relPath !== 'CHANGELOG.md';
      const metadata = metadataByPath.get(file.relPath);
      let sourceOwnership = 'shared';
      let moduleId = defaultTemplateModule(file.relPath);
      const issues = [];
      if (requiresOwnership) {
        sourceOwnership = metadata?.values?.ownership || '';
        if (!SOURCE_OWNERSHIPS.has(sourceOwnership)) {
          issues.push('managed Markdown must declare frontmatter ownership as shared, seed, or local');
          sourceOwnership = 'shared';
        }
      }
      if (metadata) {
        if (Object.hasOwn(metadata.values, 'sync_module')) {
          const override = metadata.values.sync_module;
          if (!INSTALLABLE_TEMPLATE_MODULES.has(override)) {
            issues.push(`managed Markdown sync_module is not installable: ${override || '<empty>'}`);
          } else {
            moduleId = override;
          }
        }
      }

      return {
        ...file,
        sourceOwnership,
        moduleId,
        policyMode,
        integrityIssue: [file.integrityIssue, ...issues].filter(Boolean).join('; '),
      };
    }),
  };
}

function moduleDependencyClosure(values) {
  const selected = new Set(values);
  const queue = [...selected];
  for (let index = 0; index < queue.length; index += 1) {
    const moduleId = queue[index];
    for (const dependency of TEMPLATE_MODULE_DEPENDENCIES[moduleId] || []) {
      if (!selected.has(dependency)) queue.push(dependency);
      selected.add(dependency);
    }
    for (const group of TEMPLATE_MODULE_ATOMIC_GROUPS) {
      if (!group.includes(moduleId)) continue;
      for (const peer of group) {
        if (!selected.has(peer)) queue.push(peer);
        selected.add(peer);
      }
    }
  }
  return selected;
}

function validatedModules(values, label) {
  if (!Array.isArray(values)) throw new Error(`${label} must be an array`);
  const modules = [];
  for (const value of values) {
    if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} must contain non-empty module identifiers`);
    const moduleId = value.trim();
    if (!INSTALLABLE_TEMPLATE_MODULES.has(moduleId)) throw new Error(`${label} contains an unknown module: ${moduleId}`);
    modules.push(moduleId);
  }
  return moduleDependencyClosure(modules);
}

async function readProjectModuleScope(repoPath, fs) {
  for (const configPath of [path.join(repoPath, 'devrules', 'config.json'), path.join(repoPath, 'devrules.config.json')]) {
    let stat;
    try {
      stat = await fs.lstat(configPath);
    } catch (error) {
      if (error?.code === 'ENOENT') continue;
      throw error;
    }
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`project config is not a regular file: ${configPath}`);
    let config;
    try {
      config = JSON.parse(await fs.readFile(configPath, 'utf8'));
    } catch (error) {
      throw new Error(`project config is malformed: ${configPath}: ${error.message}`);
    }
    if (config.templateSync === undefined) return null;
    if (!config.templateSync || typeof config.templateSync !== 'object' || Array.isArray(config.templateSync)) {
      throw new Error(`project templateSync config must be an object: ${configPath}`);
    }
    const mode = config.templateSync.moduleSelection ?? 'manifest';
    if (!TEMPLATE_MODULE_SELECTION_MODES.has(mode)) {
      throw new Error(`project templateSync.moduleSelection must be manifest or explicit: ${configPath}`);
    }
    if (mode === 'manifest') return null;
    return validatedModules(config.templateSync.modules, 'project templateSync.modules');
  }
  return null;
}

export async function readInstalledTemplateModules(repoPath, fs) {
  const configured = await readProjectModuleScope(repoPath, fs);
  if (configured !== null) return configured;
  const manifestPath = path.join(repoPath, 'devrules', 'manifest.json');
  try {
    const stat = await fs.lstat(manifestPath);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`project manifest is not a regular file: ${manifestPath}`);
    let manifest;
    try {
      manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
    } catch (error) {
      throw new Error(`project manifest is malformed: ${manifestPath}: ${error.message}`);
    }
    if (!Object.hasOwn(manifest, 'installedModules')) return null;
    return validatedModules(manifest.installedModules, 'project manifest installedModules');
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

export function sourceOwnership(value) {
  return SOURCE_OWNERSHIPS.has(value) ? value : 'shared';
}
