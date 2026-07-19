import path from 'node:path';

// This function is serialized into the installed launcher. Keep it self-contained.
async function standaloneRuntimeLauncher() {
  const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
  const env = process.env;
  const pathApi = process.platform === 'win32' ? path.win32 : path.posix;
  const home = os.homedir();
  const argv = process.argv.slice(2);
  const isLocationConfigure = argv[0] === 'location' && argv[1] === 'configure';
  const nonEmpty = (value, label) => {
    if (typeof value !== 'string' || value.trim() === '') throw new Error(label + ' must be a non-empty string');
    return value;
  };
  const expand = (value) => {
    if (value === '~') return home;
    if (value.startsWith('~/') || value.startsWith('~\\')) return pathApi.join(home, value.slice(2));
    return value;
  };
  const normalizeAbsolute = (value, label) => {
    const expanded = expand(nonEmpty(value, label));
    if (!pathApi.isAbsolute(expanded)) throw new Error(label + ' must be an absolute path: ' + value);
    return pathApi.normalize(expanded);
  };
  const parseArguments = (values) => {
    const positionals = [];
    const options = {};
    for (let index = 0; index < values.length; index += 1) {
      const token = values[index];
      if (!token.startsWith('--')) {
        positionals.push(token);
        continue;
      }
      const raw = token.slice(2);
      const separator = raw.indexOf('=');
      const key = separator >= 0 ? raw.slice(0, separator) : raw;
      let value = separator >= 0 ? raw.slice(separator + 1) : true;
      if (separator < 0 && !['apply', 'dry-run', 'json'].includes(key)) {
        value = values[index + 1];
        if (!value || value.startsWith('--')) throw new Error('missing value for --' + key);
        index += 1;
      }
      if (key === 'workspace-root') {
        options[key] = [...(options[key] || []), value];
      } else {
        options[key] = value;
      }
    }
    return { positionals, options };
  };
  const configPathFromArguments = (values) => {
    let configPathValue;
    for (let index = 0; index < values.length; index += 1) {
      const token = values[index];
      if (token === '--config-path') {
        const value = values[index + 1];
        if (!value || value.startsWith('--')) throw new Error('missing value for --config-path');
        configPathValue = value;
        index += 1;
      } else if (token.startsWith('--config-path=')) {
        configPathValue = token.slice('--config-path='.length);
      }
    }
    return configPathValue;
  };
  const argumentConfigPath = configPathFromArguments(argv);
  const parsed = isLocationConfigure
    ? parseArguments(argv)
    : { positionals: [], options: {} };
  const explicitConfig = argumentConfigPath !== undefined || own(env, 'DEVRULES_RUNTIME_CONFIG');
  const configuredPath = argumentConfigPath ?? env.DEVRULES_RUNTIME_CONFIG;
  let configPath;
  if (configuredPath !== undefined) {
    const expanded = expand(nonEmpty(configuredPath, 'runtime config path'));
    configPath = pathApi.normalize(pathApi.isAbsolute(expanded) ? expanded : pathApi.resolve(process.cwd(), expanded));
  } else if (process.platform === 'win32') {
    const base = env.LOCALAPPDATA && env.LOCALAPPDATA.trim() ? env.LOCALAPPDATA : pathApi.join(home, 'AppData', 'Local');
    configPath = pathApi.join(base, 'devrules', 'runtime.json');
  } else {
    configPath = pathApi.join(home, '.config', 'devrules', 'runtime.json');
  }
  const parseConfig = (content) => {
    const config = JSON.parse(content);
    if (!config || typeof config !== 'object' || Array.isArray(config)) throw new Error('Runtime config must contain a JSON object: ' + configPath);
    if (config.schemaVersion !== 1) throw new Error('Runtime config schemaVersion must be 1: ' + configPath);
    nonEmpty(config.templateRoot, 'runtime config templateRoot');
    if (config.workspaceRoots !== undefined && !Array.isArray(config.workspaceRoots)) throw new Error('Runtime config workspaceRoots must be an array: ' + configPath);
    return config;
  };
  const readConfigContent = async () => fs.readFile(configPath, 'utf8').catch((error) => {
    if (error?.code === 'ENOENT') return null;
    throw new Error('Cannot read runtime config ' + configPath + ': ' + error.message);
  });
  const validateTemplate = async (templateRoot) => {
    const templateStat = await fs.stat(templateRoot).catch((error) => {
      throw new Error('Runtime template root does not exist or is unavailable: ' + templateRoot + ' (' + (error.code || error.message) + ')');
    });
    if (!templateStat.isDirectory()) throw new Error('Runtime template root is not a directory: ' + templateRoot);
    const manifestPath = pathApi.join(templateRoot, 'template.json');
    let manifest;
    try {
      manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
    } catch (error) {
      throw new Error('Runtime template manifest is missing or invalid: ' + manifestPath + ' (' + (error.code || error.message) + ')');
    }
    if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) throw new Error('Runtime template manifest must contain a JSON object: ' + manifestPath);
    nonEmpty(manifest.templateId, 'runtime template templateId (' + manifestPath + ')');
    const cli = pathApi.join(templateRoot, 'scripts', 'devrules.mjs');
    const cliStat = await fs.stat(cli).catch((error) => {
      throw new Error('Runtime devrules CLI is unavailable: ' + cli + ' (' + (error.code || error.message) + ')');
    });
    if (!cliStat.isFile()) throw new Error('Runtime devrules CLI is not a file: ' + cli);
    return cli;
  };
  const normalizeWorkspaces = (values) => {
    let entries = values;
    if (typeof entries === 'string') {
      if (entries.trim().startsWith('[')) entries = JSON.parse(entries);
      else entries = entries.split(pathApi.delimiter);
    }
    if (!Array.isArray(entries)) throw new Error('workspace roots must be an array or path-delimited list');
    const seen = new Set();
    return entries.map((value, index) => normalizeAbsolute(value, 'workspaceRoots[' + index + ']')).filter((value) => {
      const key = process.platform === 'win32' ? value.toLowerCase() : value;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };
  const atomicWrite = async (filePath, content) => {
    await fs.mkdir(pathApi.dirname(filePath), { recursive: true });
    const temporary = pathApi.join(pathApi.dirname(filePath), '.' + pathApi.basename(filePath) + '.' + process.pid + '.tmp');
    try {
      await fs.writeFile(temporary, content, 'utf8');
      try {
        await fs.rename(temporary, filePath);
      } catch (error) {
        if (!['EEXIST', 'EPERM'].includes(error?.code)) throw error;
        await fs.rm(filePath, { force: true });
        await fs.rename(temporary, filePath);
      }
    } finally {
      await fs.rm(temporary, { force: true }).catch(() => {});
    }
  };

  if (isLocationConfigure) {
    const currentContent = await readConfigContent();
    let currentConfig = null;
    if (currentContent !== null) {
      try {
        currentConfig = parseConfig(currentContent);
      } catch (error) {
        if (parsed.options['template-root'] === undefined) throw error;
      }
    }
    const templateRoot = normalizeAbsolute(
      parsed.options['template-root'] ?? currentConfig?.templateRoot,
      'templateRoot',
    );
    await validateTemplate(templateRoot);
    const workspaceInput = parsed.options['workspace-root']
      ?? parsed.options['workspace-roots']
      ?? currentConfig?.workspaceRoots
      ?? [];
    const configuration = { schemaVersion: 1, templateRoot, workspaceRoots: normalizeWorkspaces(workspaceInput) };
    const content = JSON.stringify(configuration, null, 2) + '\n';
    const changed = currentContent !== content;
    const apply = parsed.options.apply === true && parsed.options['dry-run'] !== true;
    if (apply && changed) await atomicWrite(configPath, content);
    const result = {
      command: 'configure',
      status: apply ? 'pass' : 'dry-run',
      applied: apply,
      changed,
      configPath,
      configuration,
      actions: changed ? [{ kind: currentContent === null ? 'create' : 'update', path: configPath }] : [],
    };
    if (parsed.options.json === true) process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    else {
      process.stdout.write('Runtime location configure: ' + result.status + '\n');
      process.stdout.write('Config: ' + configPath + '\n');
      process.stdout.write('Template: ' + templateRoot + '\n');
    }
    return;
  }

  const configContent = await readConfigContent();
  if (configContent === null && explicitConfig) throw new Error('Explicit runtime config does not exist: ' + configPath);
  const config = configContent === null ? null : parseConfig(configContent);
  if (config) normalizeWorkspaces(config.workspaceRoots || []);
  const rawTemplateRoot = own(env, 'DEVRULES_TEMPLATE_ROOT') ? nonEmpty(env.DEVRULES_TEMPLATE_ROOT, 'DEVRULES_TEMPLATE_ROOT') : config?.templateRoot;
  if (rawTemplateRoot === undefined) throw new Error('No runtime template root is configured; create ' + configPath + ' or set DEVRULES_TEMPLATE_ROOT');
  const templateRoot = normalizeAbsolute(rawTemplateRoot, 'templateRoot');
  const cli = await validateTemplate(templateRoot);
  const childEnv = { ...env };
  if (configContent !== null || explicitConfig) childEnv.DEVRULES_RUNTIME_CONFIG = configPath;
  if (own(env, 'DEVRULES_TEMPLATE_ROOT') || configContent === null) childEnv.DEVRULES_TEMPLATE_ROOT = templateRoot;
  else delete childEnv.DEVRULES_TEMPLATE_ROOT;
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cli, ...argv], {
      stdio: 'inherit',
      env: childEnv,
    });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (signal) {
        process.kill(process.pid, signal);
        return;
      }
      process.exitCode = code ?? 1;
      resolve();
    });
  });
}

export function createRuntimeLauncherSource() {
  return `#!/usr/bin/env node
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const main = ${standaloneRuntimeLauncher.toString()};
main().catch((error) => {
  process.stderr.write('devrules launcher: ' + (error instanceof Error ? error.message : String(error)) + '\\n');
  process.exitCode = 2;
});
`;
}

export function createWindowsLauncherShim(launcherPath, nodePath = process.execPath) {
  const launcherName = path.win32.basename(launcherPath);
  return `@echo off\r\n"${nodePath}" "%~dp0${launcherName}" %*\r\n`;
}
