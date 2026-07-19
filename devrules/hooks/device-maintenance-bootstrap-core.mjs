import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const IDLE_RESOURCE_AUTO_REPAIR_ENV = 'DEVRULES_IDLE_SCHEDULER_AUTO_REPAIR';

function readJson(target) {
  try {
    return JSON.parse(fs.readFileSync(target, 'utf8'));
  } catch {
    return null;
  }
}

function runtimeConfigPath() {
  if (process.env.DEVRULES_RUNTIME_CONFIG) return path.resolve(process.env.DEVRULES_RUNTIME_CONFIG);
  if (process.platform === 'win32' && process.env.LOCALAPPDATA) {
    return path.join(process.env.LOCALAPPDATA, 'devrules', 'runtime.json');
  }
  return path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'devrules', 'runtime.json');
}

export function findIdleResourceScript({ rulesDir = '', templateRoot = '' } = {}) {
  const runtime = readJson(runtimeConfigPath());
  const runtimeRoot = runtime?.templateRoot || runtime?.template?.root || '';
  for (const root of [rulesDir, templateRoot, runtimeRoot]) {
    if (!root) continue;
    const candidate = path.join(root, 'scripts', 'idle-resource-maintenance.mjs');
    try {
      if (fs.statSync(candidate).isFile()) return candidate;
    } catch {
      // Try the next device-local source.
    }
  }
  return '';
}

function fallback(reason) {
  return {
    attempted: false,
    healthy: false,
    changed: false,
    mode: 'status-only',
    repairEnabled: false,
    scheduler: 'project-fallback',
    status: 'fallback',
    context: `Idle-resource device scheduler status unavailable (${reason}); project Agents must run pressure/status/plan directly.`,
  };
}

function autoRepairEnabled(options) {
  if (options.autoRepair === true) return true;
  const env = options.env || process.env;
  return env[IDLE_RESOURCE_AUTO_REPAIR_ENV] === '1';
}

export function ensureIdleResourceScheduler(options = {}) {
  const platform = options.platform || process.platform;
  if (!['darwin', 'win32'].includes(platform)) return fallback(`unsupported platform ${platform}`);
  const script = findIdleResourceScript(options);
  if (!script) return fallback('maintenance script not found');
  const run = options.run || execFileSync;
  const repairEnabled = autoRepairEnabled(options);
  const mode = repairEnabled ? 'auto-repair' : 'status-only';
  const args = repairEnabled
    ? [script, 'ensure-agent', '--apply', '--json']
    : [script, 'agent-status', '--json'];
  try {
    const stdout = run(process.execPath, args, {
      encoding: 'utf8',
      timeout: options.timeoutMs || 12000,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      env: options.env ? { ...process.env, ...options.env } : process.env,
    });
    const result = JSON.parse(String(stdout || ''));
    const healthy = result.healthy === true;
    const changed = repairEnabled && result.changed === true;
    return {
      attempted: true,
      healthy,
      changed,
      mode,
      repairEnabled,
      scheduler: result.scheduler || 'unknown',
      status: result.status || (healthy ? 'pass' : 'fail'),
      context: healthy
        ? (changed ? `Idle-resource device scheduler installed or repaired because auto-repair was explicitly enabled (${result.scheduler || 'device scheduler'}).` : '')
        : repairEnabled
          ? 'Idle-resource scheduler auto-repair was explicitly enabled but could not make it healthy; project Agents must run pressure/status/plan directly.'
          : 'Idle-resource scheduler is not healthy. SessionStart performed a read-only status check; run ensure-agent --apply explicitly to install or repair it.',
    };
  } catch (error) {
    return {
      ...fallback(`${repairEnabled ? 'ensure-agent' : 'agent-status'} failed`),
      attempted: true,
      mode,
      repairEnabled,
      status: 'fail',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
