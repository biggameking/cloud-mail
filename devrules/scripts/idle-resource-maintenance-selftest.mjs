#!/usr/bin/env node
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildDeviceAgentSpec,
  deviceAgentStatus,
  ensureDeviceAgent,
  installDeviceAgent,
  uninstallDeviceAgent,
  windowsTaskConfigurationCurrent,
} from './devrules-lib/device-maintenance-agent.mjs';
import {
  artifactCleanupGates,
  classifyBuildProcesses,
  cleanupGateForAction,
  inspectBuildActivity,
} from './devrules-lib/active-build-processes.mjs';

const POLICY = {
  idleDays: 30,
  softBootedSimulatorTarget: 3,
  memoryPressureFreeWarnPercent: 15,
  memoryPressureSampleCount: 2,
  memoryPressureSampleIntervalMs: 0,
  simulatorLeaseHeartbeatTtlMinutes: 10,
  simulatorManualReservationMinutes: 120,
};

function options(root, platform) {
  return {
    platform,
    homeDir: root,
    nodePath: platform === 'win32' ? 'C:\\Node\\node.exe' : '/opt/node/bin/node',
    scriptPath: path.join(root, 'template', 'scripts', 'idle-resource-maintenance.mjs'),
    policy: POLICY,
  };
}

function testSpecs(root) {
  const mac = buildDeviceAgentSpec(options(root, 'darwin'));
  assert.equal(mac.scheduler, 'launchd');
  assert.match(mac.wrapperContent, /apply --apply/);
  assert.match(mac.wrapperContent, /pressure --apply/);
  assert.match(mac.wrapperContent, /--idle-days.*30/);
  assert.match(mac.wrapperContent, /--soft-booted-target.*3/);
  assert.doesNotMatch(mac.wrapperContent, /\|\| true/, 'scheduled failures must remain visible');
  assert.match(mac.plistContent, /StartCalendarInterval/);

  const windows = buildDeviceAgentSpec(options(root, 'win32'));
  assert.equal(windows.scheduler, 'task-scheduler');
  assert.match(windows.taskCommand, /-WindowStyle Hidden/);
  assert.match(windows.wrapperContent, /DayOfWeek]::Sunday/);
  assert.match(windows.wrapperContent, /'apply', '--apply'/);
  assert.match(windows.wrapperContent, /'pressure', '--apply'/);
  assert.match(windows.wrapperContent, /--memory-pressure-free-warn-percent/);
  const taskXml = `<Task><Triggers><CalendarTrigger><StartBoundary>2026-01-01T10:15:00</StartBoundary><ScheduleByDay><DaysInterval>1</DaysInterval></ScheduleByDay></CalendarTrigger></Triggers><Settings><Enabled>true</Enabled></Settings><Actions><Exec><Command>powershell.exe</Command><Arguments>-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File &quot;${windows.wrapper}&quot;</Arguments></Exec></Actions></Task>`;
  assert.equal(windowsTaskConfigurationCurrent(windows, taskXml), true);
  assert.equal(windowsTaskConfigurationCurrent(windows, taskXml.replace('T10:15:00', 'T11:15:00')), false);

  const unsupported = buildDeviceAgentSpec(options(root, 'linux'));
  assert.equal(unsupported.scheduler, 'project-fallback');
}

async function testBuildActivityGate() {
  const activity = classifyBuildProcesses([
    { pid: 10, name: 'cargo.exe', commandLine: 'cargo build --release' },
    { pid: 11, name: 'java.exe', commandLine: 'org.gradle.launcher.daemon.bootstrap.GradleDaemon' },
    { pid: 12, name: 'xcodebuild', args: 'xcodebuild test' },
    { pid: 13, name: 'node.exe', commandLine: 'node server.mjs' },
  ], 99);
  assert.equal(activity.rust.count, 1);
  assert.equal(activity.gradle.count, 1);
  assert.equal(activity.xcode.count, 1);
  assert.equal(activity.swift.count, 0);
  assert.equal(cleanupGateForAction('rustTarget.remove'), 'rustTargets');
  assert.equal(cleanupGateForAction('simulator.shutdown'), null, 'simulator shutdown uses its own fresh pressure/owner recheck');
  assert.deepEqual(artifactCleanupGates({ available: true, ...activity }), {
    derivedData: true,
    rustTargets: true,
    swiftBuilds: true,
    gradleBuilds: true,
  });

  const unavailable = await inspectBuildActivity({
    platform: 'win32',
    runCapture: async () => ({ ok: false, stderr: 'denied' }),
  });
  assert.equal(unavailable.available, false);
  assert.equal(Object.values(artifactCleanupGates(unavailable)).every(Boolean), true);
}

async function testWindowsLifecycle(root) {
  const calls = [];
  const spec = buildDeviceAgentSpec(options(root, 'win32'));
  const taskXml = `<Task><Triggers><CalendarTrigger><StartBoundary>2026-01-01T10:15:00</StartBoundary><ScheduleByDay><DaysInterval>1</DaysInterval></ScheduleByDay></CalendarTrigger></Triggers><Settings><Enabled>true</Enabled></Settings><Actions><Exec><Command>powershell.exe</Command><Arguments>-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File &quot;${spec.wrapper}&quot;</Arguments></Exec></Actions></Task>`;
  const runCapture = async (command, args) => {
    calls.push({ command, args });
    return { ok: true, stdout: taskXml, stderr: '' };
  };
  const base = { ...options(root, 'win32'), runCapture };
  const dryRun = await installDeviceAgent(base);
  assert.equal(dryRun.status, 'dry-run');
  assert.equal(calls.length, 0, 'dry-run must not register a task');
  const ensureDryRun = await ensureDeviceAgent(base);
  assert.equal(ensureDryRun.status, 'dry-run');
  assert.equal(ensureDryRun.changed, false);
  assert.equal(ensureDryRun.repairAttempted, false);
  assert.equal(ensureDryRun.requiresApply, true);
  assert.equal(calls.some((call) => call.args.includes('/Create')), false, 'default ensure must only query task state');
  await assert.rejects(fs.access(spec.wrapper), 'default ensure must not create its wrapper');
  await assert.rejects(fs.access(path.dirname(spec.wrapper)), 'default ensure must not create scheduler directories');

  const installed = await ensureDeviceAgent({ ...base, apply: true });
  assert.equal(installed.status, 'pass');
  assert.equal(installed.healthy, true);
  assert.equal(installed.changed, true);
  assert.equal(installed.repairAttempted, true);
  assert.equal(calls.some((call) => call.args.includes('/Create')), true);
  await fs.access(spec.wrapper);

  const status = await deviceAgentStatus(base);
  assert.equal(status.healthy, true);
  const createCalls = calls.filter((call) => call.args.includes('/Create')).length;
  const alreadyHealthy = await ensureDeviceAgent({ ...base, apply: true });
  assert.equal(alreadyHealthy.changed, false);
  assert.equal(calls.filter((call) => call.args.includes('/Create')).length, createCalls, 'healthy ensure must not rewrite the task');
  const disabled = await deviceAgentStatus({
    ...base,
    runCapture: async () => ({ ok: true, stdout: taskXml.replace('<Enabled>true</Enabled>', '<Enabled>false</Enabled>'), stderr: '' }),
  });
  assert.equal(disabled.healthy, false, 'a disabled task must use the project fallback');
  await fs.writeFile(status.wrapper, '# stale wrapper\n', 'utf8');
  const drifted = await deviceAgentStatus(base);
  assert.equal(drifted.installed, true);
  assert.equal(drifted.configurationCurrent, false);
  assert.equal(drifted.healthy, false, 'a registered but stale device task must fall back to project invocation');
  const repaired = await ensureDeviceAgent({ ...base, apply: true });
  assert.equal(repaired.healthy, true);
  assert.equal(repaired.changed, true);

  const removed = await uninstallDeviceAgent({ ...base, apply: true });
  assert.equal(removed.status, 'pass');
  assert.equal(calls.some((call) => call.args.includes('/Delete')), true);
  await assert.rejects(fs.access(status.wrapper));
}

async function testMacReadOnlyStatus(root) {
  const homeDir = path.join(root, 'mac-home');
  const spec = buildDeviceAgentSpec(options(homeDir, 'darwin'));
  const calls = [];
  const result = await ensureDeviceAgent({
    ...options(homeDir, 'darwin'),
    runCapture: async (command, args) => {
      calls.push({ command, args });
      return { ok: false, stdout: '', stderr: 'not registered' };
    },
  });
  assert.equal(result.status, 'dry-run');
  assert.equal(result.repairAttempted, false);
  assert.equal(result.requiresApply, true);
  assert.deepEqual(calls.map((call) => call.args[0]), ['print']);
  assert.equal(calls.some((call) => call.args.includes('bootstrap')), false);
  await assert.rejects(fs.access(spec.wrapper), 'read-only status must not create the macOS wrapper');
  await assert.rejects(fs.access(spec.plist), 'read-only status must not create a LaunchAgent plist');
  await assert.rejects(fs.access(homeDir), 'read-only status must not create the temporary HOME');
}

// CLI smoke: run the read-only subcommands against a sandboxed workspace root
// (--root) with a huge idle threshold so no real home-directory artifact ever
// qualifies, then verify JSON shape and that nothing is deleted without --apply.
async function testCliReadOnlySmoke(root) {
  const script = path.join(path.dirname(fileURLToPath(import.meta.url)), 'idle-resource-maintenance.mjs');
  const workspace = path.join(root, 'cli-workspace');
  const rustTarget = path.join(workspace, 'rusty', 'target');
  await fs.mkdir(rustTarget, { recursive: true });
  await fs.writeFile(path.join(workspace, 'rusty', 'Cargo.toml'), '[package]\nname = "rusty"\n', 'utf8');
  await fs.writeFile(path.join(rustTarget, 'artifact.bin'), 'stale', 'utf8');
  const epoch = new Date(0);
  await fs.utimes(rustTarget, epoch, epoch);

  const idleDaysFlag = ['--idle-days', '3650'];
  const runJson = (args) => JSON.parse(execFileSync(process.execPath, [script, ...args, '--json'], { encoding: 'utf8' }));

  const status = runJson(['status', '--root', workspace, ...idleDaysFlag]);
  assert.equal(status.command, 'status');
  assert.equal(status.status, 'report');
  assert.deepEqual(status.roots, [workspace], 'status must honor the sandboxed --root');
  assert.equal(typeof status.findings.plannedActions, 'number');
  assert(Array.isArray(status.actions));
  assert.equal(typeof status.memory.hostFreePercent, 'number');
  assert.equal(typeof status.memory.reliable, 'boolean');
  if (!status.cleanupDeferred?.rustTargets) {
    assert(
      status.actions.some((action) => action.kind === 'rustTarget.remove' && action.path === rustTarget),
      'status must report the stale fixture rust target',
    );
  }

  const plan = runJson(['plan', '--root', workspace, ...idleDaysFlag]);
  assert.equal(plan.command, 'plan');
  assert.equal(plan.applied, false, 'plan without --apply must stay a dry-run');
  assert.equal(plan.status, 'dry-run');
  assert(plan.results.every((item) => item.applied === false), 'dry-run results must not apply');
  await fs.access(rustTarget);
  await fs.access(path.join(rustTarget, 'artifact.bin'));

  const pressure = runJson(['pressure']);
  assert.equal(pressure.command, 'pressure');
  assert.equal(pressure.applied, false, 'pressure without --apply must stay a dry-run');
  assert.equal(pressure.status, 'dry-run');
  assert.equal(typeof pressure.memory.pressure, 'boolean');
  assert(Array.isArray(pressure.actions));
  assert.equal(pressure.findings.derivedData, 0, 'pressure must not walk artifact trees');

  const leaseFile = path.join(root, 'cli-leases.json');
  const leaseStatus = runJson(['lease-status', '--lease-file', leaseFile]);
  assert.equal(leaseStatus.status, 'report');
  assert.deepEqual(leaseStatus.leases, []);
  const leaseDryRun = runJson([
    'lease-claim', '--lease-file', leaseFile, '--project-id', 'project',
    '--task-id', 'task', '--udid', 'UDID-CLI',
  ]);
  assert.equal(leaseDryRun.status, 'dry-run');
  await assert.rejects(fs.access(leaseFile), 'CLI lease mutation must remain dry-run without --apply');
}

async function main() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'idle-resource-maintenance-selftest-'));
  try {
    testSpecs(root);
    await testBuildActivityGate();
    await testMacReadOnlyStatus(root);
    await testWindowsLifecycle(root);
    await testCliReadOnlySmoke(root);
    process.stdout.write('idle resource maintenance selftest: PASS\n');
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}

main().catch((error) => {
  process.stderr.write(`idle resource maintenance selftest: FAIL\n${error.stack || error.message}\n`);
  process.exitCode = 1;
});
