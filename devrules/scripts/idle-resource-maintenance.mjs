#!/usr/bin/env node
/**
 * Seed idle-resource maintenance for Simulator boot pressure / idle processes,
 * Xcode DerivedData, CoreSimulator caches, SwiftPM `.build`, and Rust `target/`.
 *
 * Prefer a device-local LaunchAgent when installed. Agents should call this
 * script when the agent is missing or reports stale findings.
 *
 * Mutation requires --apply. Default commands are dry-run / report-only.
 * Thresholds come from DEFAULTS, then `devrules/config.json` →
 * `idleResourceMaintenance`, then CLI flags.
 */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

import { resolveRuntimeLocation } from './devrules-lib/runtime-location.mjs';
import { deviceAgentStatus, ensureDeviceAgent, installDeviceAgent, uninstallDeviceAgent } from './devrules-lib/device-maintenance-agent.mjs';
import { artifactCleanupGates, cleanupGateForAction, inspectBuildActivity } from './devrules-lib/active-build-processes.mjs';
import { collectMemoryPressure } from './devrules-lib/simulator-runtime.mjs';
import { collectSimulatorActions, revalidateSimulatorShutdown } from './devrules-lib/simulator-maintenance.mjs';
import {
  defaultSimulatorLeaseFile,
  renderSimulatorLeaseResult,
  runSimulatorLeaseCommand,
} from './devrules-lib/simulator-lease-registry.mjs';

const execFileAsync = promisify(execFile);
const SCRIPT_PATH = fileURLToPath(import.meta.url);
const SCRIPT_DIR = path.dirname(SCRIPT_PATH);
const TEMPLATE_ROOT = path.resolve(SCRIPT_DIR, '..');
const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULTS = {
  idleDays: 30,
  softBootedSimulatorTarget: 3,
  memoryPressureFreeWarnPercent: 15,
  memoryPressureSampleCount: 2,
  memoryPressureSampleIntervalMs: 250,
  simulatorLeaseHeartbeatTtlMinutes: 10,
  simulatorManualReservationMinutes: 120,
  cleanDerivedData: true,
  cleanRustTargets: true,
  cleanSwiftBuilds: true,
  cleanGradleBuilds: true,
  cleanCoreSimulatorCaches: true,
  deleteUnavailableSimulators: true,
  quitSimulatorAppWhenIdle: true,
};

function loadPolicy() {
  const configPath = path.join(TEMPLATE_ROOT, 'config.json');
  const config = (() => {
    try {
      return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch {
      return {};
    }
  })();
  const section = config.idleResourceMaintenance && typeof config.idleResourceMaintenance === 'object'
    ? config.idleResourceMaintenance
    : {};
  const merged = { ...DEFAULTS, ...section };
  if (!Object.hasOwn(section, 'softBootedSimulatorTarget') && Number.isFinite(section.maxBootedSimulators)) {
    merged.softBootedSimulatorTarget = section.maxBootedSimulators;
  }
  if (!Object.hasOwn(section, 'memoryPressureFreeWarnPercent') && Number.isFinite(section.memoryFreeWarnPercent)) {
    merged.memoryPressureFreeWarnPercent = section.memoryFreeWarnPercent;
  }
  return merged;
}

function deviceAgentOptions(policy, apply = false) {
  return {
    apply,
    scriptPath: SCRIPT_PATH,
    nodePath: process.execPath,
    policy,
  };
}

async function memorySnapshot(warningPercent, {
  sampleCount = 2,
  sampleIntervalMs = 250,
  explicitLagObserved = false,
} = {}) {
  return collectMemoryPressure({
    warningPercent,
    sampleCount,
    sampleIntervalMs,
    explicitLagObserved,
    runCapture,
  });
}

function parseArgs(argv, policy = DEFAULTS) {
  const args = {
    command: 'status',
    apply: false,
    json: false,
    idleDays: policy.idleDays,
    softBootedTarget: policy.softBootedSimulatorTarget,
    legacyBootedIdleHours: 12,
    memoryPressureFreeWarnPercent: policy.memoryPressureFreeWarnPercent,
    memoryPressureSampleCount: policy.memoryPressureSampleCount,
    memoryPressureSampleIntervalMs: policy.memoryPressureSampleIntervalMs,
    simulatorLagObserved: false,
    leaseHeartbeatTtlMinutes: policy.simulatorLeaseHeartbeatTtlMinutes,
    manualReservationMinutes: policy.simulatorManualReservationMinutes,
    leaseFile: defaultSimulatorLeaseFile(),
    projectId: '',
    taskId: '',
    udid: '',
    roots: [],
    policy,
  };
  const values = [...argv];
  if (values[0] && !values[0].startsWith('-')) args.command = values.shift();
  while (values.length > 0) {
    const token = values.shift();
    if (token === '--apply') args.apply = true;
    else if (token === '--json') args.json = true;
    else if (token === '--idle-days') args.idleDays = Number(values.shift());
    else if (token === '--soft-booted-target' || token === '--max-booted') args.softBootedTarget = Number(values.shift());
    else if (token === '--booted-idle-hours') args.legacyBootedIdleHours = Number(values.shift());
    else if (token === '--memory-pressure-free-warn-percent' || token === '--memory-free-warn-percent') args.memoryPressureFreeWarnPercent = Number(values.shift());
    else if (token === '--pressure-sample-count') args.memoryPressureSampleCount = Number(values.shift());
    else if (token === '--pressure-sample-interval-ms') args.memoryPressureSampleIntervalMs = Number(values.shift());
    else if (token === '--simulator-lag-observed') args.simulatorLagObserved = true;
    else if (token === '--lease-heartbeat-ttl-minutes') args.leaseHeartbeatTtlMinutes = Number(values.shift());
    else if (token === '--manual-reservation-minutes') args.manualReservationMinutes = Number(values.shift());
    else if (token === '--lease-file') args.leaseFile = path.resolve(values.shift());
    else if (token === '--project-id') args.projectId = String(values.shift() || '');
    else if (token === '--task-id') args.taskId = String(values.shift() || '');
    else if (token === '--udid') args.udid = String(values.shift() || '');
    else if (token === '--root') args.roots.push(path.resolve(values.shift()));
    else if (token === '--help' || token === '-h') args.help = true;
    else throw new Error(`Unknown argument: ${token}`);
  }
  if (!Number.isFinite(args.idleDays) || args.idleDays < 1) throw new Error('--idle-days must be >= 1');
  if (!Number.isFinite(args.softBootedTarget) || args.softBootedTarget < 0) throw new Error('--soft-booted-target must be >= 0');
  if (!Number.isFinite(args.legacyBootedIdleHours) || args.legacyBootedIdleHours < 1) throw new Error('--booted-idle-hours must be >= 1');
  if (!Number.isFinite(args.memoryPressureFreeWarnPercent) || args.memoryPressureFreeWarnPercent < 1 || args.memoryPressureFreeWarnPercent > 100) {
    throw new Error('--memory-pressure-free-warn-percent must be between 1 and 100');
  }
  if (!Number.isInteger(args.memoryPressureSampleCount) || args.memoryPressureSampleCount < 2) throw new Error('--pressure-sample-count must be an integer >= 2');
  if (!Number.isFinite(args.memoryPressureSampleIntervalMs) || args.memoryPressureSampleIntervalMs < 0) throw new Error('--pressure-sample-interval-ms must be >= 0');
  if (!Number.isFinite(args.leaseHeartbeatTtlMinutes) || args.leaseHeartbeatTtlMinutes < 1) throw new Error('--lease-heartbeat-ttl-minutes must be >= 1');
  if (!Number.isFinite(args.manualReservationMinutes) || args.manualReservationMinutes < 1) throw new Error('--manual-reservation-minutes must be >= 1');
  return args;
}

function usage() {
  return `idle-resource-maintenance.mjs

Usage:
  node devrules/scripts/idle-resource-maintenance.mjs status [--root <dir>] [--json]
  node devrules/scripts/idle-resource-maintenance.mjs pressure [--json] [--apply]
  node devrules/scripts/idle-resource-maintenance.mjs plan [--root <dir>] [--idle-days 30] [--soft-booted-target 3] [--memory-pressure-free-warn-percent 15] [--json]
  node devrules/scripts/idle-resource-maintenance.mjs apply --apply [same options as plan] [--json]
  node devrules/scripts/idle-resource-maintenance.mjs install-agent|ensure-agent [--apply] [--json]
  node devrules/scripts/idle-resource-maintenance.mjs uninstall-agent [--apply] [--json]
  node devrules/scripts/idle-resource-maintenance.mjs agent-status [--json]
  node devrules/scripts/idle-resource-maintenance.mjs lease-status [--json]
  node devrules/scripts/idle-resource-maintenance.mjs lease-claim|lease-heartbeat|lease-reserve-manual|lease-release --project-id <id> --task-id <id> --udid <udid> [--apply] [--json]

macOS: Simulator boot pressure, unavailable device cleanup, Simulator.app quit when
idle, DerivedData and CoreSimulator/Caches age prune.
Workspace roots: stale Rust target/, SwiftPM .build, and Gradle build/ directories.
\`pressure\` is the fast path (simulators/processes only; no disk walks).
Device scheduler runs daily (macOS LaunchAgent / Windows Task Scheduler):
pressure on weekdays, full apply on Sunday. Unsupported or unhealthy devices
fall back to autonomous project Agent invocation.
Simulator count is a soft target. Shutdown requires sustained macOS pressure or
--simulator-lag-observed, exact owner visibility, and a fresh apply-time recheck.
Thresholds: config.json idleResourceMaintenance, then CLI flags. Legacy
--max-booted and --memory-free-warn-percent aliases remain accepted.
Simulator task leases live in a device-local registry. Lease mutation is dry-run
unless --apply is present; manual reservations are explicitly time-bounded.
Writes require --apply. Never erases named Simulator device content by default.`;
}

function pathExists(target) {
  try {
    fs.accessSync(target);
    return true;
  } catch {
    return false;
  }
}

async function readJson(target, fallback = null) {
  try {
    return JSON.parse(await fsp.readFile(target, 'utf8'));
  } catch {
    return fallback;
  }
}

function home(...parts) {
  return path.join(os.homedir(), ...parts);
}

function developerDir() {
  const candidates = [
    process.env.DEVELOPER_DIR,
    '/Applications/Xcode.app/Contents/Developer',
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (pathExists(path.join(candidate, 'usr', 'bin', 'simctl'))) return candidate;
  }
  return null;
}

async function runCapture(command, args, env = {}) {
  try {
    const { stdout, stderr } = await execFileAsync(command, args, {
      env: { ...process.env, ...env },
      maxBuffer: 8 * 1024 * 1024,
      windowsHide: true,
    });
    return { ok: true, stdout: String(stdout || ''), stderr: String(stderr || '') };
  } catch (error) {
    return {
      ok: false,
      stdout: String(error.stdout || ''),
      stderr: String(error.stderr || error.message || error),
      code: error.code,
    };
  }
}

async function dirSizeBytes(target) {
  if (!pathExists(target)) return 0;
  let total = 0;
  async function walk(current) {
    let entries;
    try {
      entries = await fsp.readdir(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      try {
        if (entry.isDirectory()) await walk(full);
        else if (entry.isFile()) {
          const st = await fsp.stat(full);
          total += st.size;
        }
      } catch {
        // Skip unreadable leaves.
      }
    }
  }
  await walk(target);
  return total;
}

function formatBytes(bytes) {
  if (!bytes) return '0B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let idx = 0;
  while (value >= 1024 && idx < units.length - 1) {
    value /= 1024;
    idx += 1;
  }
  return `${value.toFixed(idx === 0 ? 0 : 1)}${units[idx]}`;
}

function ageDays(mtimeMs, now = Date.now()) {
  return (now - mtimeMs) / DAY_MS;
}

async function mtimeMs(target) {
  try {
    const st = await fsp.stat(target);
    return st.mtimeMs;
  } catch {
    return 0;
  }
}

async function resolveRoots(args) {
  if (args.roots.length > 0) return args.roots;
  const runtime = await resolveRuntimeLocation({ fallbackTemplateRoot: TEMPLATE_ROOT });
  const roots = Array.isArray(runtime.workspaceRoots) ? runtime.workspaceRoots.filter(Boolean) : [];
  if (roots.length > 0) return roots.map((item) => path.resolve(item));
  return [path.resolve(TEMPLATE_ROOT, '..')];
}

async function collectAgedProjectDirs(roots, idleDays, { markerFiles, artifactDir, skipExtra = [] }) {
  const findings = [];
  const skipDirs = new Set(['.git', 'node_modules', '.build', 'Pods', 'DerivedData', '.swiftpm', 'target', ...skipExtra]);
  async function walk(current, depth) {
    if (depth > 6) return;
    let entries;
    try {
      entries = await fsp.readdir(current, { withFileTypes: true });
    } catch {
      return;
    }
    const names = new Set(entries.map((entry) => entry.name));
    const hasMarker = markerFiles.some((marker) => names.has(marker));
    const artifactPath = path.join(current, artifactDir);
    if (hasMarker && names.has(artifactDir) && pathExists(artifactPath)) {
      const touched = await mtimeMs(artifactPath);
      const days = ageDays(touched);
      if (days >= idleDays) {
        findings.push({
          path: artifactPath,
          project: current,
          idleDays: Number(days.toFixed(1)),
          bytes: await dirSizeBytes(artifactPath),
        });
      }
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (skipDirs.has(entry.name)) continue;
      await walk(path.join(current, entry.name), depth + 1);
    }
  }
  for (const root of roots) {
    if (pathExists(root)) await walk(root, 0);
  }
  return findings;
}

async function collectRustTargets(roots, idleDays) {
  return collectAgedProjectDirs(roots, idleDays, {
    markerFiles: ['Cargo.toml'],
    artifactDir: 'target',
  });
}

async function collectSwiftBuilds(roots, idleDays) {
  return collectAgedProjectDirs(roots, idleDays, {
    markerFiles: ['Package.swift', 'Package.resolved'],
    artifactDir: '.build',
  });
}

async function collectGradleBuilds(roots, idleDays) {
  return collectAgedProjectDirs(roots, idleDays, {
    markerFiles: ['build.gradle', 'build.gradle.kts', 'settings.gradle', 'settings.gradle.kts'],
    artifactDir: 'build',
    skipExtra: ['src', 'app', 'android'],
  });
}

async function collectDerivedData(idleDays) {
  const root = home('Library', 'Developer', 'Xcode', 'DerivedData');
  if (!pathExists(root)) return [];
  const findings = [];
  const entries = await fsp.readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name === 'ModuleCache.noindex') continue;
    const full = path.join(root, entry.name);
    const touched = await mtimeMs(full);
    const days = ageDays(touched);
    if (days >= idleDays) {
      findings.push({
        path: full,
        idleDays: Number(days.toFixed(1)),
        bytes: await dirSizeBytes(full),
      });
    }
  }
  return findings;
}

async function collectCoreSimulatorCaches(idleDays) {
  const root = home('Library', 'Developer', 'CoreSimulator', 'Caches');
  if (!pathExists(root)) return [];
  const findings = [];
  const entries = await fsp.readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(root, entry.name);
    let touched = 0;
    try {
      touched = (await fsp.stat(full)).mtimeMs;
    } catch {
      continue;
    }
    const days = ageDays(touched);
    if (days < idleDays) continue;
    findings.push({
      path: full,
      idleDays: Number(days.toFixed(1)),
      bytes: entry.isDirectory() ? await dirSizeBytes(full) : (await fsp.stat(full)).size,
    });
  }
  return findings;
}

async function buildPressurePlan(args) {
  const policy = args.policy || loadPolicy();
  const agent = await deviceAgentStatus(deviceAgentOptions(policy));
  const memory = await memorySnapshot(args.memoryPressureFreeWarnPercent, {
    sampleCount: args.memoryPressureSampleCount,
    sampleIntervalMs: args.memoryPressureSampleIntervalMs,
    explicitLagObserved: args.simulatorLagObserved,
  });
  const buildActivity = await inspectBuildActivity();
  const {
    platform, devDir, sims, ownerInventory, leaseRegistry, classifiedDevices,
    coordinationRequest, owners, unresolvedOwners, actions,
  } = await collectSimulatorActions({
    args,
    policy,
    memory,
    devDir: process.platform === 'darwin' ? developerDir() : null,
    runCapture,
    includeUnavailable: true,
  });
  const bootedNow = sims.devices.filter((device) => device.state === 'Booted');
  return {
    command: 'pressure',
    platform,
    roots: [],
    policy: {
      idleDays: args.idleDays,
      softBootedSimulatorTarget: args.softBootedTarget,
      memoryPressureFreeWarnPercent: args.memoryPressureFreeWarnPercent,
      memoryPressureSampleCount: args.memoryPressureSampleCount,
      simulatorLeaseHeartbeatTtlMinutes: args.leaseHeartbeatTtlMinutes,
      mode: 'pressure',
    },
    agentInstalled: agent.installed,
    agentHealthy: agent.healthy,
    agentScheduler: agent.scheduler,
    memory, buildActivity,
    developerDir: devDir,
    simulators: {
      available: sims.available,
      booted: bootedNow.map((device) => {
        const classified = classifiedDevices.find((item) => item.udid === device.udid);
        return { udid: device.udid, name: device.name, leaseState: classified?.leaseState || 'UNKNOWN' };
      }),
      shutdown: sims.devices.filter((device) => device.state === 'Shutdown' && device.isAvailable).length,
      unavailable: sims.unavailable,
      competingOwners: owners.length,
      unresolvedOwners: unresolvedOwners.length,
      ownerInventoryAvailable: ownerInventory.available,
      leaseRegistryAvailable: leaseRegistry.available,
      leaseStates: Object.fromEntries(['ACTIVE', 'MANUAL_RESERVED', 'PROVEN_INACTIVE', 'UNKNOWN'].map((state) => [state, classifiedDevices.filter((device) => device.leaseState === state).length])),
    },
    findings: {
      derivedData: 0,
      coreSimulatorCaches: 0,
      rustTargets: 0,
      swiftBuilds: 0,
      gradleBuilds: 0,
      plannedActions: actions.length,
    },
    bytesReclaimable: 0,
    actions,
    coordinationRequest,
    guidance: actions.length > 0
      ? 'Sustained pressure and a safe exact-UDID candidate were detected. Apply revalidates pressure and ownership before one shutdown.'
      : coordinationRequest
        ? 'Pressure remains above the soft target with no proven-inactive device. The host Agent may request this oldest active owner to release the exact UDID; it must never stop or interrupt that task.'
      : (memory.pressure ? 'Pressure is confirmed, but no safely managed Simulator action exists. Active, manual, and unknown owners must be preserved.'
      : (agent.healthy ? 'No managed process pressure right now. The healthy device scheduler remains primary.'
      : `Device scheduler (${agent.scheduler}) is NOT healthy. Project Agents must invoke pressure/status themselves and install-agent --apply when supported.`)),
  };
}

async function buildPlan(args) {
  const policy = args.policy || loadPolicy();
  const roots = await resolveRoots(args);
  const agent = await deviceAgentStatus(deviceAgentOptions(policy));
  const memory = await memorySnapshot(args.memoryPressureFreeWarnPercent, {
    sampleCount: args.memoryPressureSampleCount,
    sampleIntervalMs: args.memoryPressureSampleIntervalMs,
    explicitLagObserved: args.simulatorLagObserved,
  });
  const buildActivity = await inspectBuildActivity();
  const blocked = artifactCleanupGates(buildActivity);
  const {
    platform, devDir, sims, ownerInventory, leaseRegistry, classifiedDevices,
    coordinationRequest, owners, unresolvedOwners, actions,
  } = await collectSimulatorActions({
    args,
    policy,
    memory,
    devDir: process.platform === 'darwin' ? developerDir() : null,
    runCapture,
  });
  const derived = platform === 'darwin' && policy.cleanDerivedData && !blocked.derivedData
    ? await collectDerivedData(args.idleDays)
    : [];
  const simCaches = platform === 'darwin' && policy.cleanCoreSimulatorCaches
    ? await collectCoreSimulatorCaches(args.idleDays)
    : [];
  const rustTargets = policy.cleanRustTargets && !blocked.rustTargets
    ? await collectRustTargets(roots, args.idleDays)
    : [];
  const swiftBuilds = policy.cleanSwiftBuilds && !blocked.swiftBuilds
    ? await collectSwiftBuilds(roots, args.idleDays)
    : [];
  const gradleBuilds = policy.cleanGradleBuilds && !blocked.gradleBuilds
    ? await collectGradleBuilds(roots, args.idleDays)
    : [];

  for (const item of derived) {
    actions.push({
      kind: 'derivedData.remove',
      path: item.path,
      bytes: item.bytes,
      idleDays: item.idleDays,
      reason: `DerivedData idle ${item.idleDays}d >= ${args.idleDays}d (${formatBytes(item.bytes)})`,
    });
  }
  for (const item of simCaches) {
    actions.push({
      kind: 'coreSimulatorCache.remove',
      path: item.path,
      bytes: item.bytes,
      idleDays: item.idleDays,
      reason: `CoreSimulator cache idle ${item.idleDays}d >= ${args.idleDays}d (${formatBytes(item.bytes)})`,
    });
  }
  for (const item of rustTargets) {
    actions.push({
      kind: 'rustTarget.remove',
      path: item.path,
      project: item.project,
      bytes: item.bytes,
      idleDays: item.idleDays,
      reason: `Rust target idle ${item.idleDays}d >= ${args.idleDays}d (${formatBytes(item.bytes)})`,
    });
  }
  for (const item of swiftBuilds) {
    actions.push({
      kind: 'swiftBuild.remove',
      path: item.path,
      project: item.project,
      bytes: item.bytes,
      idleDays: item.idleDays,
      reason: `SwiftPM .build idle ${item.idleDays}d >= ${args.idleDays}d (${formatBytes(item.bytes)})`,
    });
  }
  for (const item of gradleBuilds) {
    actions.push({
      kind: 'gradleBuild.remove',
      path: item.path,
      project: item.project,
      bytes: item.bytes,
      idleDays: item.idleDays,
      reason: `Gradle build/ idle ${item.idleDays}d >= ${args.idleDays}d (${formatBytes(item.bytes)})`,
    });
  }

  const bootedNow = sims.devices.filter((device) => device.state === 'Booted');
  return {
    command: args.command,
    platform,
    roots,
    policy: {
      idleDays: args.idleDays,
      softBootedSimulatorTarget: args.softBootedTarget,
      memoryPressureFreeWarnPercent: args.memoryPressureFreeWarnPercent,
      memoryPressureSampleCount: args.memoryPressureSampleCount,
      simulatorLeaseHeartbeatTtlMinutes: args.leaseHeartbeatTtlMinutes,
      cleanDerivedData: Boolean(policy.cleanDerivedData),
      cleanRustTargets: Boolean(policy.cleanRustTargets),
      cleanSwiftBuilds: Boolean(policy.cleanSwiftBuilds),
      cleanGradleBuilds: Boolean(policy.cleanGradleBuilds),
      cleanCoreSimulatorCaches: Boolean(policy.cleanCoreSimulatorCaches),
    },
    agentInstalled: agent.installed,
    agentHealthy: agent.healthy,
    agentScheduler: agent.scheduler,
    memory,
    buildActivity,
    cleanupDeferred: blocked,
    developerDir: devDir,
    simulators: {
      available: sims.available,
      booted: bootedNow.map((device) => {
        const classified = classifiedDevices.find((item) => item.udid === device.udid);
        return { udid: device.udid, name: device.name, leaseState: classified?.leaseState || 'UNKNOWN' };
      }),
      shutdown: sims.devices.filter((device) => device.state === 'Shutdown' && device.isAvailable).length,
      unavailable: sims.unavailable,
      competingOwners: owners.length,
      unresolvedOwners: unresolvedOwners.length,
      ownerInventoryAvailable: ownerInventory.available,
      leaseRegistryAvailable: leaseRegistry.available,
      leaseStates: Object.fromEntries(['ACTIVE', 'MANUAL_RESERVED', 'PROVEN_INACTIVE', 'UNKNOWN'].map((state) => [state, classifiedDevices.filter((device) => device.leaseState === state).length])),
    },
    findings: {
      derivedData: derived.length,
      coreSimulatorCaches: simCaches.length,
      rustTargets: rustTargets.length,
      swiftBuilds: swiftBuilds.length,
      gradleBuilds: gradleBuilds.length,
      plannedActions: actions.length,
    },
    bytesReclaimable: actions.reduce((sum, action) => sum + (action.bytes || 0), 0),
    actions,
    coordinationRequest,
    guidance: Object.values(blocked).some(Boolean)
      ? 'Artifact cleanup was deferred for active build lanes (or unavailable process inventory); retry after builds finish. No build process is terminated.'
      : agent.healthy
      ? `Device scheduler (${agent.scheduler}) is healthy; Agents may rely on it and invoke this script when current-task pressure appears.`
      : `Device scheduler (${agent.scheduler}) is NOT healthy. Project Agents must run status/plan after Simulator or build-heavy work, install-agent --apply when supported, and apply safe reclaim actions.`,
  };
}

async function applyAction(action, devDir) {
  if (action.kind === 'simulator.shutdown') {
    const result = await runCapture('xcrun', ['simctl', 'shutdown', action.udid], { DEVELOPER_DIR: devDir });
    return { ...action, applied: result.ok, detail: result.ok ? 'shutdown' : result.stderr.trim() };
  }
  if (action.kind === 'simulator.deleteUnavailable') {
    const result = await runCapture('xcrun', ['simctl', 'delete', 'unavailable'], { DEVELOPER_DIR: devDir });
    return { ...action, applied: result.ok, detail: result.ok ? 'deleted unavailable' : result.stderr.trim() };
  }
  if (action.kind === 'simulator.quitApp') {
    const result = await runCapture('osascript', ['-e', 'tell application "Simulator" to quit']);
    return { ...action, applied: result.ok, detail: result.ok ? 'quit Simulator.app' : result.stderr.trim() };
  }
  if (
    action.kind === 'derivedData.remove'
    || action.kind === 'rustTarget.remove'
    || action.kind === 'swiftBuild.remove'
    || action.kind === 'gradleBuild.remove'
    || action.kind === 'coreSimulatorCache.remove'
  ) {
    await fsp.rm(action.path, { recursive: true, force: true });
    return { ...action, applied: true, detail: 'removed' };
  }
  return { ...action, applied: false, detail: 'unknown action' };
}

async function applyPlan(plan, args) {
  if (!args.apply) {
    return { ...plan, applied: false, status: 'dry-run', results: plan.actions.map((action) => ({ ...action, applied: false })) };
  }
  const results = [], currentGates = args.command === 'apply'
    ? artifactCleanupGates(await inspectBuildActivity())
    : {};
  for (const action of plan.actions) {
    if (action.kind === 'simulator.shutdown') {
      const validation = await revalidateSimulatorShutdown({
        action,
        args,
        devDir: developerDir(),
        runCapture,
        memorySnapshot,
      });
      if (!validation.safe) {
        results.push({ ...action, applied: false, deferred: true, detail: `apply-time simulator safety check: ${validation.reason}` });
        continue;
      }
    }
    const gate = cleanupGateForAction(action.kind);
    if (gate && currentGates[gate]) {
      results.push({ ...action, applied: false, deferred: true, detail: 'active build or unavailable process inventory' });
      continue;
    }
    results.push(await applyAction(action, plan.developerDir));
  }
  const failed = results.filter((item) => item.applied === false && !item.deferred);
  const deferred = results.filter((item) => item.deferred);
  return {
    ...plan,
    applied: true,
    status: failed.length > 0 ? 'partial' : (deferred.length > 0 ? 'deferred' : 'pass'),
    results,
  };
}

function renderText(result) {
  if (String(result.command || '').startsWith('lease-')) {
    return renderSimulatorLeaseResult(result);
  }
  if (['install-agent', 'ensure-agent', 'uninstall-agent', 'agent-status'].includes(result.command)) {
    const lines = [
      `Idle resource agent: ${(result.status || (result.healthy ? 'pass' : 'missing')).toUpperCase()}`,
      `Scheduler: ${result.scheduler || 'unknown'}`,
      `Installed: ${result.installed ? 'yes' : 'no'}`,
      `Registered: ${result.registered || result.loaded ? 'yes' : 'no'}`,
      `Configuration current: ${result.configurationCurrent ? 'yes' : 'no'}`,
    ];
    if (result.taskName) lines.push(`Task: ${result.taskName}`);
    if (result.plist) lines.push(`Plist: ${result.plist}`);
    if (result.wrapper) lines.push(`Wrapper: ${result.wrapper}`);
    if (result.reason) lines.push(result.reason);
    if (result.registrationDetail) lines.push(`Registration: ${result.registrationDetail}`);
    for (const action of result.actions || []) {
      lines.push(`- ${action.kind}: ${action.path || action.label || ''}`);
    }
    return lines.join('\n');
  }
  const lines = [
    `Idle resource ${result.command}: ${(result.status || 'report').toUpperCase()}`,
    `Platform: ${result.platform}`,
    `Agent: ${result.agentHealthy ? `healthy (${result.agentScheduler})` : `fallback-required (${result.agentScheduler || 'unknown'})`}`,
    `Roots: ${result.roots.join(', ')}`,
  ];
  if (result.memory) {
    const pressureSamples = result.memory.samples?.length > 0 ? result.memory.samples.join('%, ') + '%' : 'unavailable';
    lines.push(`Memory pressure: ${result.memory.pressure ? 'CONFIRMED' : 'not confirmed'} (${result.memory.reason}; samples=${pressureSamples}; host-free=${result.memory.hostFreePercent}%)`);
  }
  if (result.buildActivity) {
    const active = ['rust', 'swift', 'gradle', 'xcode']
      .filter((lane) => result.buildActivity[lane]?.active)
      .map((lane) => `${lane}=${result.buildActivity[lane].count}`);
    if (!result.buildActivity.available) lines.push('Build process inventory unavailable: artifact cleanup deferred');
    else if (active.length > 0) lines.push(`Active build lanes: ${active.join(', ')} (matching cleanup deferred)`);
  }
  if (result.simulators?.available) {
    lines.push(`Simulators booted: ${result.simulators.booted.length} / shutdown-available: ${result.simulators.shutdown} / unavailable: ${result.simulators.unavailable}`);
    for (const device of result.simulators.booted) lines.push(`  - BOOT ${device.name} (${device.udid}) lease=${device.leaseState || 'UNKNOWN'}`);
    if (result.simulators.competingOwners > 0) lines.push(`Competing sim/xcode owners: ${result.simulators.competingOwners}`);
    if (result.simulators.unresolvedOwners > 0) lines.push(`Unresolved simulator owners: ${result.simulators.unresolvedOwners} (automatic shutdown blocked)`);
    if (!result.simulators.ownerInventoryAvailable) lines.push('Simulator owner inventory unavailable: automatic shutdown blocked');
  } else if (result.platform === 'darwin') {
    lines.push('Simulators: unavailable (set DEVELOPER_DIR / install Xcode CLT tools)');
  }
  if (result.findings) {
    lines.push(
      `Findings: derivedData=${result.findings.derivedData || 0}, coreSimulatorCaches=${result.findings.coreSimulatorCaches || 0}, rustTargets=${result.findings.rustTargets || 0}, swiftBuilds=${result.findings.swiftBuilds || 0}, gradleBuilds=${result.findings.gradleBuilds || 0}, actions=${result.findings.plannedActions || 0}`,
    );
  }
  lines.push(`Reclaimable (file deletes): ${formatBytes(result.bytesReclaimable || 0)}`);
  const list = result.results || result.actions || [];
  for (const action of list.slice(0, 40)) {
    const mark = action.applied === true ? 'APPLY' : (result.applied ? 'FAIL' : 'PLAN');
    lines.push(`- [${mark}] ${action.kind}: ${action.reason || action.path || action.udid || ''}`);
  }
  if (list.length > 40) lines.push(`... ${list.length - 40} more`);
  if (result.coordinationRequest) {
    lines.push(`Release request candidate: ${result.coordinationRequest.projectId}/${result.coordinationRequest.taskId} ${result.coordinationRequest.udid}`);
    lines.push(result.coordinationRequest.authority);
  }
  if (result.guidance) lines.push(result.guidance);
  if (result.command === 'plan' || result.command === 'pressure' || (result.command === 'apply' && !result.applied)) {
    if (!result.applied) lines.push('Dry-run only; pass --apply to mutate.');
  }
  return lines.join('\n');
}

async function main() {
  const policy = loadPolicy();
  const args = parseArgs(process.argv.slice(2), policy);
  if (args.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }
  let result;
  if (args.command === 'agent-status') {
    const agent = await deviceAgentStatus(deviceAgentOptions(policy));
    result = { command: 'agent-status', ...agent, status: agent.healthy ? 'pass' : 'missing' };
  } else if (args.command === 'install-agent') {
    result = await installDeviceAgent(deviceAgentOptions(policy, args.apply));
  } else if (args.command === 'ensure-agent') {
    result = await ensureDeviceAgent(deviceAgentOptions(policy, args.apply));
  } else if (args.command === 'uninstall-agent') {
    result = await uninstallDeviceAgent(deviceAgentOptions(policy, args.apply));
  } else if (['lease-status', 'lease-claim', 'lease-heartbeat', 'lease-reserve-manual', 'lease-release'].includes(args.command)) {
    result = await runSimulatorLeaseCommand({
      command: args.command,
      apply: args.apply,
      filePath: args.leaseFile,
      projectId: args.projectId,
      taskId: args.taskId,
      udid: args.udid,
      manualReservationMinutes: args.manualReservationMinutes,
    });
  } else if (args.command === 'pressure') {
    const plan = await buildPressurePlan(args);
    result = await applyPlan(plan, args);
  } else if (['status', 'plan', 'apply'].includes(args.command)) {
    const plan = await buildPlan({ ...args, command: args.command === 'status' ? 'status' : args.command });
    if (args.command === 'status') {
      result = { ...plan, status: 'report' };
    } else {
      result = await applyPlan(plan, args);
    }
  } else {
    throw new Error(`Unknown command: ${args.command}`);
  }
  process.stdout.write(args.json ? `${JSON.stringify(result, null, 2)}\n` : `${renderText(result)}\n`);
  if (result.status === 'fail' || result.status === 'partial') process.exitCode = 1;
}

main().catch((error) => {
  process.stderr.write(`idle-resource-maintenance: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 2;
});
