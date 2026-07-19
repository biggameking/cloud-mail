#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  classifySimulatorDevices,
  parseMemoryPressureFreePercent,
  selectSimulatorCoordinationRequest,
  selectSimulatorShutdowns,
  summarizeMemoryPressure,
  validateSimulatorShutdown,
} from './devrules-lib/simulator-resource-policy.mjs';
import { collectMemoryPressure, inspectSimulatorOwners } from './devrules-lib/simulator-runtime.mjs';

const templateRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function devices(count) {
  return Array.from({ length: count }, (_, index) => ({
    udid: `UDID-${index + 1}`,
    name: `Project ${index + 1}`,
    state: 'Booted',
    isAvailable: true,
    dataMtime: (index + 1) * 1000,
  }));
}

function options(overrides = {}) {
  const leases = Array.from({ length: 5 }, (_, index) => ({
    projectId: `project-${index + 1}`,
    taskId: `task-${index + 1}`,
    udid: `UDID-${index + 1}`,
    claimedAt: new Date(index * 1000).toISOString(),
    lastHeartbeatAt: new Date(0).toISOString(),
    releasedAt: new Date(10_000).toISOString(),
  }));
  return {
    softBootedTarget: 3,
    pressureConfirmed: true,
    owners: [],
    ownerInventoryAvailable: true,
    leases,
    leaseRegistryAvailable: true,
    nowMs: 20_000,
    ...overrides,
  };
}

assert.equal(parseMemoryPressureFreePercent('System-wide memory free percentage: 47%'), 47);
assert.equal(parseMemoryPressureFreePercent('unrecognized output'), null);
assert.equal(summarizeMemoryPressure({ samples: [12, 11], warningPercent: 15 }).pressure, true);
assert.equal(summarizeMemoryPressure({ samples: [12, 20], warningPercent: 15 }).pressure, false);
assert.equal(summarizeMemoryPressure({ samples: [1], warningPercent: 15 }).reliable, false);
assert.equal(summarizeMemoryPressure({ explicitLagObserved: true }).pressure, true);

const sampledPressure = await collectMemoryPressure({
  warningPercent: 15,
  sampleCount: 2,
  sampleIntervalMs: 0,
  platform: 'darwin',
  runCapture: async () => ({ ok: true, stdout: 'System-wide memory free percentage: 10%' }),
});
assert.equal(sampledPressure.pressure, true);
const unavailableOwners = await inspectSimulatorOwners({
  platform: 'darwin',
  runCapture: async () => ({ ok: false, stderr: 'denied' }),
});
assert.equal(unavailableOwners.available, false, 'owner inspection failure must remain distinguishable from zero owners');

assert.deepEqual(selectSimulatorShutdowns(devices(3), options()), [], 'three active devices are within the soft target');
assert.deepEqual(selectSimulatorShutdowns(devices(4), options({ pressureConfirmed: false })), [], 'count alone must never trigger shutdown');
assert.deepEqual(selectSimulatorShutdowns(devices(4), options({ ownerInventoryAvailable: false })), [], 'unknown ownership must fail closed');
assert.deepEqual(selectSimulatorShutdowns(devices(4), options({ leaseRegistryAvailable: false })), [], 'unknown leases must fail closed');
assert.deepEqual(
  selectSimulatorShutdowns(devices(4), options({ owners: [{ args: 'xcodebuild -destination name=Unknown' }] })),
  [],
  'an unresolved controller must protect every device',
);

const oneCandidate = selectSimulatorShutdowns(devices(5), options());
assert.equal(oneCandidate.length, 1, 'one pressure pass may reclaim at most one simulator');
assert.equal(oneCandidate[0].udid, 'UDID-1', 'the earliest safe ordering timestamp is selected');

const contestedOldest = selectSimulatorShutdowns(devices(4), options({
  owners: [{ args: 'xcodebuild test -destination id=UDID-1' }],
}));
assert.equal(contestedOldest[0].udid, 'UDID-2', 'an owned simulator must never be selected');

const activeLeases = options().leases.map((lease) => ({ ...lease, releasedAt: '', lastHeartbeatAt: new Date(19_000).toISOString() }));
const classified = classifySimulatorDevices(devices(4), options({ leases: activeLeases }));
assert(classified.every((device) => device.leaseState === 'ACTIVE'));
const coordination = selectSimulatorCoordinationRequest(devices(4), options({ leases: activeLeases }));
assert.equal(coordination.taskId, 'task-1');
assert.match(coordination.authority, /never stop or interrupt/);
const manualLeases = activeLeases.map((lease, index) => index === 0 ? {
  ...lease,
  manualReservedUntil: new Date(30_000).toISOString(),
  reclaimAfterManualReservation: true,
} : lease);
assert.equal(classifySimulatorDevices(devices(4), options({ leases: manualLeases }))[0].leaseState, 'MANUAL_RESERVED');

assert.equal(validateSimulatorShutdown(oneCandidate[0], devices(4), options()).safe, true);
assert.equal(validateSimulatorShutdown(oneCandidate[0], devices(3), options()).safe, false);
assert.equal(validateSimulatorShutdown(oneCandidate[0], devices(4), options({ pressureConfirmed: false })).safe, false);
assert.equal(validateSimulatorShutdown(oneCandidate[0], devices(4), options({ leases: activeLeases })).safe, false, 'a renewed task lease blocks apply');
assert.equal(validateSimulatorShutdown(oneCandidate[0], devices(4), options({
  owners: [{ args: 'xcodebuild test -destination id=UDID-1' }],
})).safe, false, 'a newly acquired owner blocks apply');

const ownershipRule = await fs.readFile(path.join(templateRoot, 'rules', 'ios-simulator-ownership.md'), 'utf8');
const maintenanceWorkflow = await fs.readFile(path.join(templateRoot, 'workflows', 'idle-resource-maintenance.md'), 'utf8');
assert.match(ownershipRule, /cross-task notification is advisory only/i);
assert.match(ownershipRule, /user confirms[\s\S]*in the receiving task/i);
assert.match(maintenanceWorkflow, /User Reporting And Cross-Task Notifications/);
assert.match(maintenanceWorkflow, /report in the observing task first/i);
assert.match(maintenanceWorkflow, /at most one advisory request/i);
assert.match(maintenanceWorkflow, /Do not send automatic acknowledgments/i);

process.stdout.write('simulator resource policy selftest: PASS\n');
