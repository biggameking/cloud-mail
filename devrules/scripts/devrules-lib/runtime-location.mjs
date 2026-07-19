import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  createRuntimeLauncherSource,
  createWindowsLauncherShim,
} from './runtime-launcher-source.mjs';
import { atomicWriteFile } from './safe-files.mjs';

export {
  createRuntimeLauncherSource,
  createWindowsLauncherShim,
} from './runtime-launcher-source.mjs';

const SCHEMA_VERSION = 1;
const ENV_CONFIG = 'DEVRULES_RUNTIME_CONFIG';
const ENV_TEMPLATE = 'DEVRULES_TEMPLATE_ROOT';
const ENV_WORKSPACES = 'DEVRULES_WORKSPACE_ROOTS';

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function pathApiFor(platform) {
  return platform === 'win32' ? path.win32 : path.posix;
}

function requireString(value, label) {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`${label} must be a non-empty string`);
  return value;
}

function expandHome(value, homeDir, pathApi) {
  if (value === '~') return homeDir;
  if (value.startsWith('~/') || value.startsWith('~\\')) return pathApi.join(homeDir, value.slice(2));
  return value;
}

function resolveConfigPath(value, { cwd, homeDir, pathApi, label }) {
  const expanded = expandHome(requireString(value, label), homeDir, pathApi);
  return pathApi.normalize(pathApi.isAbsolute(expanded) ? expanded : pathApi.resolve(cwd, expanded));
}

function normalizeRoot(value, { homeDir, pathApi, label }) {
  const expanded = expandHome(requireString(value, label), homeDir, pathApi);
  if (!pathApi.isAbsolute(expanded)) throw new Error(`${label} must be an absolute path: ${value}`);
  return pathApi.normalize(expanded);
}

function environment(options) {
  return options.env ?? process.env;
}

export function defaultRuntimeConfigPath(options = {}) {
  const env = environment(options);
  const platform = options.platform ?? process.platform;
  const pathApi = pathApiFor(platform);
  const homeDir = options.homeDir ?? os.homedir();
  const cwd = options.cwd ?? process.cwd();
  const explicit = options.configPath ?? (hasOwn(env, ENV_CONFIG) ? requireString(env[ENV_CONFIG], ENV_CONFIG) : undefined);
  if (explicit !== undefined) return resolveConfigPath(explicit, { cwd, homeDir, pathApi, label: 'runtime config path' });
  if (platform === 'win32') {
    const localAppData = typeof env.LOCALAPPDATA === 'string' && env.LOCALAPPDATA.trim()
      ? env.LOCALAPPDATA
      : pathApi.join(homeDir, 'AppData', 'Local');
    return pathApi.join(localAppData, 'devrules', 'runtime.json');
  }
  return pathApi.join(homeDir, '.config', 'devrules', 'runtime.json');
}

function parseWorkspaceOverride(raw, platform) {
  const value = requireString(raw, ENV_WORKSPACES).trim();
  if (value.startsWith('[')) {
    let parsed;
    try {
      parsed = JSON.parse(value);
    } catch (error) {
      throw new Error(`${ENV_WORKSPACES} must be a JSON array or path-delimited list: ${error.message}`);
    }
    if (!Array.isArray(parsed)) throw new Error(`${ENV_WORKSPACES} JSON value must be an array`);
    return parsed;
  }
  const entries = value.split(pathApiFor(platform).delimiter);
  if (entries.some((entry) => entry.trim() === '')) throw new Error(`${ENV_WORKSPACES} contains an empty path`);
  return entries.map((entry) => entry.trim());
}

function validateConfigShape(config, configPath) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new Error(`Runtime config must contain a JSON object: ${configPath}`);
  }
  if (config.schemaVersion !== SCHEMA_VERSION) {
    throw new Error(`Runtime config schemaVersion must be ${SCHEMA_VERSION}: ${configPath}`);
  }
  requireString(config.templateRoot, `runtime config templateRoot (${configPath})`);
  if (config.workspaceRoots !== undefined && !Array.isArray(config.workspaceRoots)) {
    throw new Error(`Runtime config workspaceRoots must be an array: ${configPath}`);
  }
  return {
    schemaVersion: SCHEMA_VERSION,
    templateRoot: config.templateRoot,
    workspaceRoots: config.workspaceRoots ?? [],
  };
}

async function readRuntimeConfig(configPath, required) {
  let content;
  try {
    content = await fs.readFile(configPath, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT' && !required) return null;
    if (error?.code === 'ENOENT') throw new Error(`Explicit runtime config does not exist: ${configPath}`);
    throw new Error(`Cannot read runtime config ${configPath}: ${error.message}`);
  }
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    throw new Error(`Runtime config is not valid JSON (${configPath}): ${error.message}`);
  }
  return validateConfigShape(parsed, configPath);
}

async function requiredDirectory(root, label) {
  let stat;
  try {
    stat = await fs.stat(root);
  } catch (error) {
    throw new Error(`${label} does not exist or is unavailable: ${root} (${error.code || error.message})`);
  }
  if (!stat.isDirectory()) throw new Error(`${label} is not a directory: ${root}`);
  return fs.realpath(root).catch((error) => {
    throw new Error(`Cannot resolve ${label}: ${root} (${error.code || error.message})`);
  });
}

async function requiredTemplateRoot(root) {
  const realpath = await requiredDirectory(root, 'Runtime template root');
  const manifestPath = path.join(root, 'template.json');
  let manifest;
  try {
    manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  } catch (error) {
    throw new Error(`Runtime template manifest is missing or invalid: ${manifestPath} (${error.code || error.message})`);
  }
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    throw new Error(`Runtime template manifest must contain a JSON object: ${manifestPath}`);
  }
  requireString(manifest.templateId, `runtime template templateId (${manifestPath})`);
  const cliPath = path.join(root, 'scripts', 'devrules.mjs');
  const cliStat = await fs.stat(cliPath).catch((error) => {
    throw new Error(`Runtime devrules CLI is missing or unavailable: ${cliPath} (${error.code || error.message})`);
  });
  if (!cliStat.isFile()) throw new Error(`Runtime devrules CLI is not a file: ${cliPath}`);
  return realpath;
}

async function workspaceLocations(values, pathOptions) {
  if (!Array.isArray(values)) throw new Error('workspaceRoots must be an array');
  const roots = [];
  const realpaths = [];
  const seen = new Set();
  for (let index = 0; index < values.length; index += 1) {
    const root = normalizeRoot(values[index], { ...pathOptions, label: `workspaceRoots[${index}]` });
    const realpath = await fs.realpath(root).catch(() => null);
    const key = (realpath || root).normalize('NFC');
    const comparisonKey = pathOptions.platform === 'win32' ? key.toLowerCase() : key;
    if (seen.has(comparisonKey)) continue;
    seen.add(comparisonKey);
    roots.push(root);
    realpaths.push(realpath);
  }
  return { roots, realpaths };
}

export async function resolveRuntimeLocation(options = {}) {
  const env = environment(options);
  const platform = options.platform ?? process.platform;
  const pathApi = pathApiFor(platform);
  const homeDir = options.homeDir ?? os.homedir();
  const cwd = options.cwd ?? process.cwd();
  const pathOptions = { platform, pathApi, homeDir };
  const explicitConfig = options.configPath !== undefined || hasOwn(env, ENV_CONFIG);
  const configPath = defaultRuntimeConfigPath({ ...options, env, platform, homeDir, cwd });
  const config = await readRuntimeConfig(configPath, explicitConfig);

  let rawTemplateRoot;
  let source;
  if (hasOwn(env, ENV_TEMPLATE)) {
    rawTemplateRoot = requireString(env[ENV_TEMPLATE], ENV_TEMPLATE);
    source = 'environment';
  } else if (config) {
    rawTemplateRoot = config.templateRoot;
    source = 'config';
  } else {
    rawTemplateRoot = options.fallbackTemplateRoot;
    source = 'fallback';
  }
  if (rawTemplateRoot === undefined) {
    throw new Error(`No runtime template root is configured; create ${configPath} or set ${ENV_TEMPLATE}`);
  }

  const templateRoot = normalizeRoot(rawTemplateRoot, { ...pathOptions, label: 'templateRoot' });
  const templateRealpath = await requiredTemplateRoot(templateRoot);
  const workspaceSource = hasOwn(env, ENV_WORKSPACES) ? 'environment' : config ? 'config' : 'default';
  const rawWorkspaceRoots = hasOwn(env, ENV_WORKSPACES)
    ? parseWorkspaceOverride(env[ENV_WORKSPACES], platform)
    : config?.workspaceRoots ?? [];
  const workspaces = await workspaceLocations(rawWorkspaceRoots, pathOptions);

  return {
    schemaVersion: SCHEMA_VERSION,
    configPath,
    source,
    sources: {
      configPath: options.configPath !== undefined ? 'option' : hasOwn(env, ENV_CONFIG) ? 'environment' : 'default',
      templateRoot: source,
      workspaceRoots: workspaceSource,
    },
    templateRoot,
    templateRealpath,
    workspaceRoots: workspaces.roots,
    workspaceRealpaths: workspaces.realpaths,
  };
}

export function defaultRuntimeLauncherPath(options = {}) {
  const env = environment(options);
  const platform = options.platform ?? process.platform;
  const pathApi = pathApiFor(platform);
  const homeDir = options.homeDir ?? os.homedir();
  if (platform === 'win32') {
    const base = typeof env.LOCALAPPDATA === 'string' && env.LOCALAPPDATA.trim()
      ? env.LOCALAPPDATA
      : pathApi.join(homeDir, 'AppData', 'Local');
    return pathApi.join(base, 'devrules', 'bin', 'devrules.mjs');
  }
  return pathApi.join(homeDir, '.local', 'bin', 'devrules');
}

function commandContext(options, context) {
  return {
    env: context.env ?? options.env ?? process.env,
    platform: context.platform ?? options.platform ?? process.platform,
    homeDir: context.homeDir ?? options.homeDir ?? os.homedir(),
    cwd: context.cwd ?? options.cwd ?? process.cwd(),
    fallbackTemplateRoot: context.fallbackTemplateRoot ?? options.fallbackTemplateRoot,
    configPath: options.configPath,
  };
}

async function commandRuntime(options, context) {
  if (options.runtimeLocation && options.configPath === undefined) return options.runtimeLocation;
  return resolveRuntimeLocation(commandContext(options, context));
}

async function configure(options, context) {
  const runtimeContext = commandContext(options, context);
  const currentRuntime = options.runtimeLocation;
  const configPath = options.configPath !== undefined
    ? defaultRuntimeConfigPath(runtimeContext)
    : currentRuntime?.configPath ?? defaultRuntimeConfigPath(runtimeContext);
  const rawTemplateRoot = options.templateRoot ?? currentRuntime?.templateRoot ?? runtimeContext.fallbackTemplateRoot;
  if (rawTemplateRoot === undefined) throw new Error('configure requires templateRoot');
  const pathApi = pathApiFor(runtimeContext.platform);
  const pathOptions = { platform: runtimeContext.platform, pathApi, homeDir: runtimeContext.homeDir };
  const templateRoot = normalizeRoot(rawTemplateRoot, { ...pathOptions, label: 'templateRoot' });
  const templateRealpath = await requiredTemplateRoot(templateRoot);
  const workspaceInput = options.workspaceRoots ?? options.workspaceRoot ?? currentRuntime?.workspaceRoots ?? [];
  const rawWorkspaceRoots = typeof workspaceInput === 'string'
    ? parseWorkspaceOverride(workspaceInput, runtimeContext.platform)
    : workspaceInput;
  const workspaces = await workspaceLocations(rawWorkspaceRoots, pathOptions);
  const configuration = { schemaVersion: SCHEMA_VERSION, templateRoot, workspaceRoots: workspaces.roots };
  const content = `${JSON.stringify(configuration, null, 2)}\n`;
  const current = await fs.readFile(configPath, 'utf8').catch((error) => error?.code === 'ENOENT' ? null : Promise.reject(error));
  const changed = current !== content;
  if (options.apply === true && changed) await atomicWriteFile(configPath, content, { mode: 0o644 });
  return {
    command: 'configure',
    status: options.apply === true ? 'pass' : 'dry-run',
    applied: options.apply === true,
    changed,
    configPath,
    configuration,
    runtimeLocation: {
      configPath,
      source: 'config',
      templateRoot,
      templateRealpath,
      workspaceRoots: workspaces.roots,
      workspaceRealpaths: workspaces.realpaths,
    },
    actions: changed ? [{ kind: current === null ? 'create' : 'update', path: configPath }] : [],
  };
}

async function audit(options, context) {
  const runtime = await commandRuntime(options, context);
  const checks = [{ name: 'template-root', ok: true, path: runtime.templateRoot, realpath: runtime.templateRealpath }];
  for (const root of runtime.workspaceRoots) {
    try {
      const stat = await fs.stat(root);
      checks.push({
        name: 'workspace-root',
        ok: stat.isDirectory(),
        path: root,
        realpath: stat.isDirectory() ? await fs.realpath(root).catch(() => null) : null,
        detail: stat.isDirectory() ? 'available' : 'not a directory',
      });
    } catch (error) {
      checks.push({ name: 'workspace-root', ok: false, path: root, realpath: null, detail: error.code || error.message });
    }
  }
  return { ...runtime, command: 'audit', status: checks.every((check) => check.ok) ? 'pass' : 'fail', checks };
}

async function installLauncher(options, context) {
  const runtimeContext = commandContext(options, context);
  const runtime = await commandRuntime(options, context);
  const rawPath = options.launcherPath ?? defaultRuntimeLauncherPath(runtimeContext);
  const launcherPath = resolveConfigPath(rawPath, {
    cwd: runtimeContext.cwd,
    homeDir: runtimeContext.homeDir,
    pathApi: pathApiFor(runtimeContext.platform),
    label: 'launcherPath',
  });
  const content = createRuntimeLauncherSource();
  const current = await fs.readFile(launcherPath, 'utf8').catch((error) => error?.code === 'ENOENT' ? null : Promise.reject(error));
  const commandPath = runtimeContext.platform === 'win32'
    ? launcherPath.replace(/\.mjs$/i, '') + '.cmd'
    : launcherPath;
  const commandContent = runtimeContext.platform === 'win32' ? createWindowsLauncherShim(launcherPath) : null;
  const currentCommand = commandContent === null
    ? current
    : await fs.readFile(commandPath, 'utf8').catch((error) => error?.code === 'ENOENT' ? null : Promise.reject(error));
  const launcherChanged = current !== content;
  const commandChanged = commandContent !== null && currentCommand !== commandContent;
  if (options.apply === true && launcherChanged) await atomicWriteFile(launcherPath, content, { mode: 0o755 });
  if (options.apply === true && commandChanged) await atomicWriteFile(commandPath, commandContent, { mode: 0o755 });
  return {
    command: 'install-launcher',
    status: options.apply === true ? 'pass' : 'dry-run',
    applied: options.apply === true,
    changed: launcherChanged || commandChanged,
    launcherPath,
    commandPath,
    configPath: runtime.configPath,
    templateRoot: runtime.templateRoot,
    actions: [
      ...(launcherChanged ? [{ kind: current === null ? 'create' : 'update', path: launcherPath }] : []),
      ...(commandChanged ? [{ kind: currentCommand === null ? 'create' : 'update', path: commandPath }] : []),
    ],
  };
}

export async function runRuntimeLocationCommand(subcommand, options = {}, context = {}) {
  if (subcommand === 'configure') return configure(options, context);
  if (subcommand === 'show') return { ...await commandRuntime(options, context), command: 'show', status: 'pass' };
  if (subcommand === 'audit') return audit(options, context);
  if (subcommand === 'install-launcher') return installLauncher(options, context);
  throw new Error(`Unknown runtime location command: ${subcommand}`);
}
