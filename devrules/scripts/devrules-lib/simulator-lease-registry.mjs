import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const SCHEMA_VERSION = 1;

export function defaultSimulatorLeaseFile(homeDir = os.homedir()) {
  return path.join(homeDir, '.config', 'devrules', 'simulator-leases.json');
}

function emptyRegistry() {
  return { schemaVersion: SCHEMA_VERSION, updatedAt: '', leases: [] };
}

function validLease(lease) {
  return lease
    && typeof lease.projectId === 'string' && lease.projectId.length > 0
    && typeof lease.taskId === 'string' && lease.taskId.length > 0
    && typeof lease.udid === 'string' && lease.udid.length > 0
    && typeof lease.claimedAt === 'string'
    && typeof lease.lastHeartbeatAt === 'string';
}

export async function readSimulatorLeaseRegistry({ filePath = defaultSimulatorLeaseFile() } = {}) {
  try {
    const stat = await fs.lstat(filePath);
    if (!stat.isFile() || stat.isSymbolicLink()) {
      return { available: false, filePath, registry: emptyRegistry(), error: 'lease registry must be a regular file' };
    }
    const parsed = JSON.parse(await fs.readFile(filePath, 'utf8'));
    if (parsed?.schemaVersion !== SCHEMA_VERSION || !Array.isArray(parsed.leases) || !parsed.leases.every(validLease)) {
      return { available: false, filePath, registry: emptyRegistry(), error: 'lease registry schema is invalid' };
    }
    return { available: true, filePath, registry: parsed, error: '' };
  } catch (error) {
    if (error?.code === 'ENOENT') return { available: true, filePath, registry: emptyRegistry(), error: '' };
    return { available: false, filePath, registry: emptyRegistry(), error: error.message || String(error) };
  }
}

function activeLeaseForUdid(registry, udid) {
  return registry.leases.find((lease) => lease.udid === udid && !lease.releasedAt);
}

function requireLeaseIdentity(input) {
  for (const key of ['projectId', 'taskId', 'udid']) {
    if (typeof input[key] !== 'string' || input[key].trim() === '') throw new Error(`${key} is required`);
  }
}

export function planSimulatorLeaseMutation(registry, command, input, now = new Date()) {
  requireLeaseIdentity(input);
  const timestamp = now.toISOString();
  const current = activeLeaseForUdid(registry, input.udid);
  const sameOwner = current?.projectId === input.projectId && current?.taskId === input.taskId;
  if (command === 'lease-claim') {
    if (current && !sameOwner) {
      return { status: 'blocked', reason: `UDID ${input.udid} is already leased by ${current.projectId}/${current.taskId}`, registry };
    }
    const nextLease = current
      ? { ...current, lastHeartbeatAt: timestamp, manualReservedUntil: '', reclaimAfterManualReservation: false }
      : {
        projectId: input.projectId,
        taskId: input.taskId,
        udid: input.udid,
        claimedAt: timestamp,
        lastHeartbeatAt: timestamp,
        manualReservedUntil: '',
        reclaimAfterManualReservation: false,
        releasedAt: '',
      };
    return {
      status: 'planned',
      reason: current ? 'lease heartbeat refreshed during claim' : 'new exact-UDID lease',
      registry: { ...registry, updatedAt: timestamp, leases: [...registry.leases.filter((lease) => lease !== current && lease.udid !== input.udid), nextLease] },
      lease: nextLease,
    };
  }
  if (!current || !sameOwner) {
    return { status: 'blocked', reason: `no active lease owned by ${input.projectId}/${input.taskId} for ${input.udid}`, registry };
  }
  if (command === 'lease-heartbeat') {
    const nextLease = { ...current, lastHeartbeatAt: timestamp, manualReservedUntil: '', reclaimAfterManualReservation: false };
    return {
      status: 'planned',
      reason: 'lease heartbeat refreshed',
      registry: { ...registry, updatedAt: timestamp, leases: registry.leases.map((lease) => lease === current ? nextLease : lease) },
      lease: nextLease,
    };
  }
  if (command === 'lease-reserve-manual') {
    const minutes = Number(input.manualReservationMinutes);
    if (!Number.isFinite(minutes) || minutes < 1) throw new Error('manualReservationMinutes must be >= 1');
    const nextLease = {
      ...current,
      lastHeartbeatAt: timestamp,
      manualReservedUntil: new Date(now.getTime() + minutes * 60_000).toISOString(),
      reclaimAfterManualReservation: true,
    };
    return {
      status: 'planned',
      reason: `manual verification reserved for ${minutes} minute(s)`,
      registry: { ...registry, updatedAt: timestamp, leases: registry.leases.map((lease) => lease === current ? nextLease : lease) },
      lease: nextLease,
    };
  }
  if (command === 'lease-release') {
    const nextLease = { ...current, lastHeartbeatAt: timestamp, manualReservedUntil: '', releasedAt: timestamp };
    return {
      status: 'planned',
      reason: 'lease explicitly released',
      registry: { ...registry, updatedAt: timestamp, leases: registry.leases.map((lease) => lease === current ? nextLease : lease) },
      lease: nextLease,
    };
  }
  throw new Error(`unsupported lease command: ${command}`);
}

async function withRegistryLock(filePath, operation) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const lockPath = `${filePath}.lock`;
  let lock;
  try {
    lock = await fs.open(lockPath, 'wx', 0o600);
  } catch (error) {
    if (error?.code === 'EEXIST') throw new Error(`lease registry is locked: ${lockPath}`);
    throw error;
  }
  try {
    return await operation();
  } finally {
    await lock.close().catch(() => {});
    await fs.rm(lockPath, { force: true }).catch(() => {});
  }
}

async function writeRegistryUnlocked(filePath, registry) {
  const tempPath = `${filePath}.${process.pid}.tmp`;
  try {
    await fs.writeFile(tempPath, `${JSON.stringify(registry, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
    await fs.rename(tempPath, filePath);
  } finally {
    await fs.rm(tempPath, { force: true }).catch(() => {});
  }
}

export async function runSimulatorLeaseCommand({
  command,
  apply = false,
  filePath = defaultSimulatorLeaseFile(),
  projectId = '',
  taskId = '',
  udid = '',
  manualReservationMinutes = 120,
  now = new Date(),
} = {}) {
  const current = await readSimulatorLeaseRegistry({ filePath });
  if (!current.available) return { command, status: 'fail', applied: false, filePath, error: current.error, leases: [] };
  if (command === 'lease-status') {
    return { command, status: 'report', applied: false, filePath, leases: current.registry.leases };
  }
  let planned;
  try {
    planned = planSimulatorLeaseMutation(current.registry, command, {
      projectId, taskId, udid, manualReservationMinutes,
    }, now);
  } catch (error) {
    return { command, status: 'fail', applied: false, filePath, error: error.message || String(error), leases: current.registry.leases };
  }
  if (planned.status === 'blocked') {
    return { command, status: 'fail', applied: false, filePath, error: planned.reason, leases: current.registry.leases };
  }
  if (!apply) {
    return { command, status: 'dry-run', applied: false, filePath, reason: planned.reason, lease: planned.lease, leases: current.registry.leases };
  }
  try {
    return await withRegistryLock(filePath, async () => {
      const fresh = await readSimulatorLeaseRegistry({ filePath });
      if (!fresh.available) throw new Error(fresh.error);
      const freshPlan = planSimulatorLeaseMutation(fresh.registry, command, {
        projectId, taskId, udid, manualReservationMinutes,
      }, now);
      if (freshPlan.status === 'blocked') throw new Error(freshPlan.reason);
      await writeRegistryUnlocked(filePath, freshPlan.registry);
      return {
        command, status: 'pass', applied: true, filePath, reason: freshPlan.reason,
        lease: freshPlan.lease, leases: freshPlan.registry.leases,
      };
    });
  } catch (error) {
    return { command, status: 'fail', applied: false, filePath, error: error.message || String(error), leases: current.registry.leases };
  }
}

export function renderSimulatorLeaseResult(result) {
  const lines = [
    `Simulator lease ${result.command}: ${(result.status || 'report').toUpperCase()}`,
    `Registry: ${result.filePath || 'unknown'}`,
    `Leases: ${(result.leases || []).length}`,
  ];
  if (result.reason) lines.push(result.reason);
  if (result.error) lines.push(`Error: ${result.error}`);
  if (result.lease) lines.push(`- ${result.lease.projectId}/${result.lease.taskId}: ${result.lease.udid}`);
  if (!result.applied && result.status === 'dry-run') lines.push('Dry-run only; pass --apply to mutate the device-local lease registry.');
  return lines.join('\n');
}
