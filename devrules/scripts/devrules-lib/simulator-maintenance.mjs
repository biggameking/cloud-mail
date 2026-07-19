import fs from 'node:fs';

import {
  classifySimulatorDevices,
  selectSimulatorCoordinationRequest,
  selectSimulatorShutdowns,
  unresolvedSimulatorOwners,
  validateSimulatorShutdown,
} from './simulator-resource-policy.mjs';
import { inspectSimulatorOwners, listSimulators } from './simulator-runtime.mjs';
import { readSimulatorLeaseRegistry } from './simulator-lease-registry.mjs';

export async function collectSimulatorActions({
  args,
  policy,
  memory,
  devDir,
  runCapture,
  platform = process.platform,
  includeUnavailable = true,
} = {}) {
  const sims = platform === 'darwin'
    ? await listSimulators({ devDir, runCapture })
    : { available: false, devices: [], unavailable: 0 };
  const ownerInventory = platform === 'darwin'
    ? await inspectSimulatorOwners({ runCapture })
    : { available: true, owners: [], error: '' };
  const leaseRegistry = await readSimulatorLeaseRegistry({ filePath: args.leaseFile });
  const owners = ownerInventory.owners;
  const actions = [];
  let classifiedDevices = [];
  let coordinationRequest = null;
  if (sims.available) {
    const devices = sims.devices.map((device) => ({
      ...device,
      dataMtime: fs.existsSync(device.dataPath) ? fs.statSync(device.dataPath).mtimeMs : 0,
    }));
    const resourceOptions = {
      softBootedTarget: args.softBootedTarget,
      pressureConfirmed: memory.pressure,
      owners,
      ownerInventoryAvailable: ownerInventory.available,
      leases: leaseRegistry.registry.leases,
      leaseRegistryAvailable: leaseRegistry.available,
      leaseHeartbeatTtlMinutes: args.leaseHeartbeatTtlMinutes,
    };
    classifiedDevices = classifySimulatorDevices(devices, resourceOptions);
    actions.push(...selectSimulatorShutdowns(devices, resourceOptions));
    coordinationRequest = selectSimulatorCoordinationRequest(devices, resourceOptions);
    if (includeUnavailable && policy.deleteUnavailableSimulators && sims.unavailable > 0) {
      actions.push({
        kind: 'simulator.deleteUnavailable',
        count: sims.unavailable,
        reason: `${sims.unavailable} unavailable simulator device(s)`,
      });
    }
    const booted = sims.devices.filter((device) => device.state === 'Booted');
    const plannedShutdowns = new Set(actions.filter((action) => action.kind === 'simulator.shutdown').map((action) => action.udid));
    const remainingBooted = booted.filter((device) => !plannedShutdowns.has(device.udid));
    if (policy.quitSimulatorAppWhenIdle && remainingBooted.length === 0 && ownerInventory.available && owners.length === 0) {
      const simApp = await runCapture('pgrep', ['-x', 'Simulator']);
      if (simApp.ok && simApp.stdout.trim()) {
        actions.push({ kind: 'simulator.quitApp', reason: 'Simulator.app is running with zero booted devices' });
      }
    }
  }
  return {
    platform,
    devDir,
    sims,
    ownerInventory,
    leaseRegistry,
    classifiedDevices,
    coordinationRequest,
    owners,
    unresolvedOwners: unresolvedSimulatorOwners(sims.devices, owners),
    actions,
  };
}

export async function revalidateSimulatorShutdown({
  action,
  args,
  devDir,
  runCapture,
  memorySnapshot,
} = {}) {
  const memory = await memorySnapshot(args.memoryPressureFreeWarnPercent, {
    sampleCount: args.memoryPressureSampleCount,
    sampleIntervalMs: args.memoryPressureSampleIntervalMs,
    explicitLagObserved: args.simulatorLagObserved,
  });
  const sims = await listSimulators({ devDir, runCapture });
  const ownerInventory = await inspectSimulatorOwners({ runCapture });
  const leaseRegistry = await readSimulatorLeaseRegistry({ filePath: args.leaseFile });
  if (!sims.available) return { safe: false, reason: 'simulator inventory is unavailable', memory };
  return {
    ...validateSimulatorShutdown(action, sims.devices, {
      softBootedTarget: args.softBootedTarget,
      pressureConfirmed: memory.pressure,
      owners: ownerInventory.owners,
      ownerInventoryAvailable: ownerInventory.available,
      leases: leaseRegistry.registry.leases,
      leaseRegistryAvailable: leaseRegistry.available,
      leaseHeartbeatTtlMinutes: args.leaseHeartbeatTtlMinutes,
    }),
    memory,
  };
}
