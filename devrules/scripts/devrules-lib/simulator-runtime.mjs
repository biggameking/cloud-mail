import os from 'node:os';

import {
  parseMemoryPressureFreePercent,
  summarizeMemoryPressure,
} from './simulator-resource-policy.mjs';

export async function collectMemoryPressure({
  warningPercent = 15,
  sampleCount = 2,
  sampleIntervalMs = 250,
  explicitLagObserved = false,
  platform = process.platform,
  runCapture,
  wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
} = {}) {
  const totalBytes = os.totalmem();
  const freeBytes = os.freemem();
  const hostFreePercent = totalBytes > 0 ? (freeBytes / totalBytes) * 100 : 0;
  const samples = [];
  if (platform === 'darwin' && typeof runCapture === 'function') {
    for (let index = 0; index < sampleCount; index += 1) {
      const result = await runCapture('/usr/bin/memory_pressure', ['-Q']);
      samples.push(result.ok ? parseMemoryPressureFreePercent(result.stdout) : null);
      if (index < sampleCount - 1 && sampleIntervalMs > 0) await wait(sampleIntervalMs);
    }
  }
  return {
    totalBytes,
    freeBytes,
    hostFreePercent: Number(hostFreePercent.toFixed(1)),
    ...summarizeMemoryPressure({
      samples,
      warningPercent,
      requiredSamples: sampleCount,
      explicitLagObserved,
      source: platform === 'darwin' ? 'memory_pressure -Q' : 'unavailable',
    }),
  };
}

export async function inspectSimulatorOwners({
  platform = process.platform,
  runCapture,
  currentPid = process.pid,
} = {}) {
  const owners = [];
  if (platform !== 'darwin') return { available: true, owners, error: '' };
  const result = await runCapture('ps', ['-axo', 'pid=,comm=,args=']);
  if (!result.ok) return { available: false, owners, error: result.stderr || 'process inventory unavailable' };
  const patterns = [
    'xcodebuild', 'XCTest', 'xctest', 'SimulatorTrampoline', 'simctl',
    'XCUIApplication', 'Appium', 'Maestro', 'idb', 'flutter', 'react-native',
  ];
  for (const line of result.stdout.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || !patterns.some((pattern) => trimmed.includes(pattern))) continue;
    if (trimmed.includes('idle-resource-maintenance')) continue;
    const match = trimmed.match(/^(\d+)\s+(\S+)\s+(.*)$/);
    if (!match || Number(match[1]) === currentPid) continue;
    owners.push({ pid: Number(match[1]), command: match[2], args: match[3] });
  }
  return { available: true, owners, error: '' };
}

export async function listSimulators({ devDir, runCapture, homeDir = os.homedir() } = {}) {
  if (!devDir) return { available: false, devices: [], unavailable: 0 };
  const result = await runCapture('xcrun', ['simctl', 'list', 'devices', '-j'], { DEVELOPER_DIR: devDir });
  if (!result.ok) return { available: false, devices: [], unavailable: 0, error: result.stderr };
  let parsed;
  try {
    parsed = JSON.parse(result.stdout);
  } catch {
    return { available: false, devices: [], unavailable: 0, error: 'failed to parse simctl JSON' };
  }
  const devices = [];
  let unavailable = 0;
  for (const [runtime, list] of Object.entries(parsed.devices || {})) {
    for (const device of list || []) {
      if (device.isAvailable === false) unavailable += 1;
      devices.push({
        udid: device.udid,
        name: device.name,
        state: device.state,
        runtime,
        isAvailable: device.isAvailable !== false,
        dataPath: `${homeDir}/Library/Developer/CoreSimulator/Devices/${device.udid}`,
      });
    }
  }
  return { available: true, devices, unavailable };
}
