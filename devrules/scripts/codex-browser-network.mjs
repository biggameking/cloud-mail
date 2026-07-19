#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  AMBIENT_KEY,
  DEFAULT_NODE_REPL,
  LABEL,
  LEGACY_MARKERS,
  NODE_REPL_OVERRIDE_KEY,
  cleanLegacyConfig,
  parseSystemProxy,
  renderLaunchAgent,
  renderLaunchEnvironmentSetter,
  renderNodeReplProxyWrapper,
} from './devrules-lib/codex-browser-network-core.mjs';

function usage() {
  return [
    'codex-browser-network.mjs',
    '',
    'Usage:',
    '  node devrules/scripts/codex-browser-network.mjs status [--json]',
    '  node devrules/scripts/codex-browser-network.mjs ensure [--apply] [--json]',
    '',
    'The command installs a scoped node_repl wrapper and a user LaunchAgent.',
    'The wrapper reads the current macOS loopback proxy at process start, so',
    'proxy variables affect only the Chrome-control helper. Writes are dry-run',
    'unless --apply is present. Restart ChatGPT/Codex Desktop when reported.',
    '',
  ].join('\n');
}

function parseArgs(argv) {
  const options = {
    command: 'status',
    apply: false,
    json: false,
    codexHome: path.join(os.homedir(), '.codex'),
    configPath: path.join(os.homedir(), '.codex', 'config.toml'),
    nodeReplPath: DEFAULT_NODE_REPL,
  };
  const args = [...argv];
  if (args[0] && !args[0].startsWith('-')) options.command = args.shift();
  while (args.length > 0) {
    const arg = args.shift();
    if (arg === '--apply') options.apply = true;
    else if (arg === '--json') options.json = true;
    else if (arg === '--codex-home') options.codexHome = path.resolve(requiredValue(args, arg));
    else if (arg === '--config') options.configPath = path.resolve(requiredValue(args, arg));
    else if (arg === '--node-repl') options.nodeReplPath = path.resolve(requiredValue(args, arg));
    else if (arg === '--help' || arg === '-h') options.command = 'help';
    else throw new Error('unknown argument: ' + arg);
  }
  if (!['status', 'ensure', 'help'].includes(options.command)) {
    throw new Error('unknown command: ' + options.command);
  }
  if (options.apply && options.command !== 'ensure') {
    throw new Error('--apply is valid only with ensure');
  }
  return options;
}

function requiredValue(args, option) {
  const value = args.shift();
  if (!value) throw new Error(option + ' requires a value');
  return value;
}

function systemProxy() {
  if (process.platform !== 'darwin') return {};
  try {
    const raw = execFileSync('/usr/sbin/scutil', ['--proxy'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 5000,
    });
    return parseSystemProxy(raw);
  } catch {
    return {};
  }
}

function managedPaths(options) {
  const hooksDir = path.join(options.codexHome, 'hooks');
  return {
    configPath: options.configPath,
    nodeReplPath: options.nodeReplPath,
    wrapperPath: path.join(hooksDir, 'devrules-node-repl-proxy-wrapper.zsh'),
    setterPath: path.join(hooksDir, 'devrules-codex-browser-launch-env.zsh'),
    launchAgentPath: path.join(os.homedir(), 'Library', 'LaunchAgents', LABEL + '.plist'),
  };
}

function legacyConfigState(source) {
  const hasMarker = LEGACY_MARKERS.some((marker) => source.includes(marker));
  return { state: hasMarker ? 'legacy-managed-block' : 'clean', hasMarker };
}

async function readText(target) {
  try {
    return await fs.promises.readFile(target, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

async function writeAtomic(target, content, mode) {
  await fs.promises.mkdir(path.dirname(target), { recursive: true });
  const temp = path.join(path.dirname(target), '.' + path.basename(target) + '.devrules-' + process.pid + '-' + Date.now() + '.tmp');
  try {
    await fs.promises.writeFile(temp, content, { encoding: 'utf8', mode });
    await fs.promises.chmod(temp, mode);
    await fs.promises.rename(temp, target);
  } finally {
    await fs.promises.rm(temp, { force: true });
  }
}

async function assetState(paths) {
  const expected = new Map([
    [paths.wrapperPath, renderNodeReplProxyWrapper(paths)],
    [paths.setterPath, renderLaunchEnvironmentSetter(paths)],
    [paths.launchAgentPath, renderLaunchAgent(paths)],
  ]);
  const drift = [];
  for (const [target, content] of expected) {
    if (await readText(target) !== content) drift.push(target);
  }
  return { state: drift.length > 0 ? 'drift' : 'ready', drift, expected };
}

function launchctlGetenv(key) {
  try {
    return execFileSync('/bin/launchctl', ['getenv', key], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 2000,
    }).trim();
  } catch {
    return '';
  }
}

function expectedLaunchEnvironment(paths) {
  return new Map([
    [AMBIENT_KEY, '1'],
    [NODE_REPL_OVERRIDE_KEY, paths.wrapperPath],
  ]);
}

function expectedHelperEnvironment(proxy) {
  const values = new Map([[AMBIENT_KEY, '1']]);
  if (proxy.http || proxy.https) {
    values.set('NODE_USE_ENV_PROXY', '1');
    values.set('HTTP_PROXY', proxy.http || proxy.https);
    values.set('HTTPS_PROXY', proxy.https || proxy.http);
    values.set('NO_PROXY', 'localhost,127.0.0.1,::1');
  }
  return values;
}

function environmentState(expected) {
  const mismatchedKeys = [];
  for (const [key, value] of expected) {
    if (launchctlGetenv(key) !== value) mismatchedKeys.push(key);
  }
  return { state: mismatchedKeys.length > 0 ? 'drift' : 'ready', mismatchedKeys };
}

function processInventory() {
  if (process.platform !== 'darwin') return [];
  try {
    const raw = execFileSync('/bin/ps', ['-axo', 'pid=,ppid=,command='], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 5000,
    });
    return raw.split('\n').map((line) => {
      const match = line.match(/^\s*(\d+)\s+(\d+)\s+(.*)$/);
      return match ? { pid: Number(match[1]), ppid: Number(match[2]), command: match[3] } : null;
    }).filter(Boolean);
  } catch {
    return [];
  }
}

function missingProcessKeys(pid, expected) {
  try {
    const raw = execFileSync('/bin/ps', ['eww', '-p', String(pid), '-o', 'command='], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 2000,
      maxBuffer: 4 * 1024 * 1024,
    });
    const missing = [];
    for (const [key, value] of expected) {
      if (!raw.includes(key + '=' + value)) missing.push(key);
    }
    return missing;
  } catch {
    return ['<environment-unavailable>'];
  }
}

function summarizeMissing(processes, expected) {
  return [...new Set(processes.flatMap((entry) => missingProcessKeys(entry.pid, expected)))];
}

function runtimeState(paths, proxy) {
  if (process.platform !== 'darwin') return { state: 'unsupported', missingParentKeys: [], missingHelperKeys: [] };
  const inventory = processInventory();
  const parents = inventory.filter((entry) => entry.command.includes('/ChatGPT.app/Contents/Resources/codex')
    && entry.command.includes('app-server'));
  const parentIds = new Set(parents.map((entry) => entry.pid));
  const helpers = inventory.filter((entry) => parentIds.has(entry.ppid)
    && entry.command.includes('/cua_node/bin/node_repl'));
  const missingParentKeys = summarizeMissing(parents, expectedLaunchEnvironment(paths));
  const missingHelperKeys = summarizeMissing(helpers, expectedHelperEnvironment(proxy));
  if (missingParentKeys.length > 0 || missingHelperKeys.length > 0) {
    return {
      state: 'stale',
      parentCount: parents.length,
      helperCount: helpers.length,
      missingParentKeys,
      missingHelperKeys,
    };
  }
  if (helpers.length > 0) {
    return { state: 'loaded', parentCount: parents.length, helperCount: helpers.length, missingParentKeys: [], missingHelperKeys: [] };
  }
  if (parents.length > 0) {
    return { state: 'parent-current', parentCount: parents.length, helperCount: 0, missingParentKeys: [], missingHelperKeys: [] };
  }
  return { state: 'not-running', parentCount: 0, helperCount: 0, missingParentKeys: [], missingHelperKeys: [] };
}

function runLaunchctl(args, ignoreFailure = false) {
  try {
    execFileSync('/bin/launchctl', args, {
      stdio: ['ignore', 'ignore', 'ignore'],
      timeout: 5000,
    });
  } catch (error) {
    if (!ignoreFailure) throw error;
  }
}

async function applyManagedState(paths, proxy, legacyState) {
  const assets = await assetState(paths);
  for (const [target, content] of assets.expected) {
    const mode = target.endsWith('.plist') ? 0o644 : 0o700;
    if (await readText(target) !== content) await writeAtomic(target, content, mode);
  }

  if (legacyState.hasMarker) {
    const source = await readText(paths.configPath);
    if (source != null) {
      const cleaned = cleanLegacyConfig(source);
      if (cleaned !== source.replace(/\r\n/g, '\n')) await writeAtomic(paths.configPath, cleaned, 0o600);
    }
    const previousProxy = expectedHelperEnvironment(proxy);
    for (const key of ['NODE_USE_ENV_PROXY', 'HTTP_PROXY', 'HTTPS_PROXY', 'NO_PROXY']) {
      const expected = previousProxy.get(key);
      if (expected && launchctlGetenv(key) === expected) runLaunchctl(['unsetenv', key], true);
    }
  }

  for (const [key, value] of expectedLaunchEnvironment(paths)) {
    runLaunchctl(['setenv', key, value]);
  }

  const domain = 'gui/' + process.getuid();
  runLaunchctl(['bootout', domain + '/' + LABEL], true);
  runLaunchctl(['bootstrap', domain, paths.launchAgentPath]);
}

async function inspect(options) {
  const paths = managedPaths(options);
  const proxy = systemProxy();
  const configSource = await readText(paths.configPath);
  const legacy = legacyConfigState(configSource || '');
  const assets = await assetState(paths);
  const launchEnvironment = environmentState(expectedLaunchEnvironment(paths));
  const runtime = runtimeState(paths, proxy);
  return { paths, proxy, legacy, assets, launchEnvironment, runtime };
}

function publicResult(state, applied) {
  const drift = state.legacy.hasMarker
    || state.assets.state === 'drift'
    || state.launchEnvironment.state === 'drift';
  const restartRequired = state.runtime.state === 'stale';
  return {
    status: drift ? 'drift' : (restartRequired ? 'restart-required' : 'ready'),
    proxy: state.proxy,
    assets: {
      state: state.assets.state,
      driftCount: state.assets.drift.length,
    },
    launchEnvironment: state.launchEnvironment,
    legacyConfig: state.legacy.state,
    runtime: state.runtime,
    applied,
    restartRequired,
  };
}

function formatResult(result, json) {
  if (json) return JSON.stringify(result, null, 2) + '\n';
  const lines = [
    'codex browser network: ' + result.status,
    'ambient network: disabled for browser control',
    result.proxy.http || result.proxy.https
      ? 'scoped proxy: ' + (result.proxy.https || result.proxy.http)
      : 'scoped proxy: none detected',
    'launch environment: ' + result.launchEnvironment.state,
    'runtime: ' + result.runtime.state,
  ];
  if (result.restartRequired) lines.push('restart required: fully restart ChatGPT/Codex Desktop');
  return lines.join('\n') + '\n';
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.command === 'help') {
    process.stdout.write(usage());
    return;
  }
  let state = await inspect(options);
  let applied = false;
  const before = publicResult(state, false);
  if (options.command === 'ensure' && options.apply && before.status !== 'ready') {
    await applyManagedState(state.paths, state.proxy, state.legacy);
    applied = true;
    state = await inspect(options);
  }
  const result = publicResult(state, applied);
  process.stdout.write(formatResult(result, options.json));
  if (options.command === 'status' && result.status !== 'ready') process.exitCode = 2;
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
if (import.meta.url === invokedPath) {
  main().catch((error) => {
    process.stderr.write('codex browser network: ' + (error instanceof Error ? error.message : String(error)) + '\n');
    process.exitCode = 1;
  });
}
