const DEFAULT_SOFT_TARGET = 3;

export function parseMemoryPressureFreePercent(output) {
  const match = String(output || '').match(/System-wide memory free percentage:\s*([0-9]+(?:\.[0-9]+)?)%/i);
  return match ? Number(match[1]) : null;
}

export function summarizeMemoryPressure({
  samples = [],
  warningPercent = 15,
  requiredSamples = 2,
  explicitLagObserved = false,
  source = 'unavailable',
} = {}) {
  const validSamples = samples.filter((value) => Number.isFinite(value));
  const reliable = validSamples.length >= requiredSamples;
  const sustained = reliable
    && validSamples.slice(-requiredSamples).every((value) => value <= warningPercent);
  const pressure = explicitLagObserved === true || sustained;
  return {
    source,
    samples: validSamples,
    requiredSamples,
    warningPercent,
    reliable,
    sustained,
    explicitLagObserved: explicitLagObserved === true,
    pressure,
    reason: explicitLagObserved === true
      ? 'simulator lag explicitly observed'
      : sustained
        ? `${requiredSamples} reliable memory-pressure samples <= ${warningPercent}%`
        : reliable
          ? 'reliable memory-pressure samples are healthy'
          : 'reliable memory-pressure samples unavailable',
  };
}

function bootedDevices(devices) {
  return devices.filter((device) => device.state === 'Booted' && device.isAvailable !== false);
}

export const SIMULATOR_LEASE_STATES = Object.freeze({
  ACTIVE: 'ACTIVE',
  MANUAL_RESERVED: 'MANUAL_RESERVED',
  PROVEN_INACTIVE: 'PROVEN_INACTIVE',
  UNKNOWN: 'UNKNOWN',
});

function timestamp(value) {
  const parsed = Date.parse(value || '');
  return Number.isFinite(parsed) ? parsed : 0;
}

export function classifySimulatorDevices(devices, {
  leases = [],
  leaseRegistryAvailable = false,
  owners = [],
  ownerInventoryAvailable = false,
  leaseHeartbeatTtlMinutes = 10,
  nowMs = Date.now(),
} = {}) {
  const ownerText = owners.map((owner) => String(owner.args || '')).join('\n');
  return bootedDevices(devices).map((device) => {
    const lease = leases.find((item) => item.udid === device.udid && !item.releasedAt)
      || leases.find((item) => item.udid === device.udid)
      || null;
    let leaseState = SIMULATOR_LEASE_STATES.UNKNOWN;
    let stateReason = 'no exact task lease exists';
    if (!leaseRegistryAvailable || !ownerInventoryAvailable) {
      stateReason = 'lease or owner inventory is unavailable';
    } else if (ownerText.includes(device.udid)) {
      leaseState = SIMULATOR_LEASE_STATES.ACTIVE;
      stateReason = 'an active controller targets the exact UDID';
    } else if (lease?.releasedAt) {
      leaseState = SIMULATOR_LEASE_STATES.PROVEN_INACTIVE;
      stateReason = 'the owning task explicitly released its lease';
    } else if (lease && timestamp(lease.manualReservedUntil) > nowMs) {
      leaseState = SIMULATOR_LEASE_STATES.MANUAL_RESERVED;
      stateReason = 'the device is reserved for user verification';
    } else if (lease && lease.reclaimAfterManualReservation && timestamp(lease.manualReservedUntil) > 0) {
      leaseState = SIMULATOR_LEASE_STATES.PROVEN_INACTIVE;
      stateReason = 'the explicitly time-bounded manual reservation expired';
    } else if (lease && timestamp(lease.lastHeartbeatAt) >= nowMs - leaseHeartbeatTtlMinutes * 60_000) {
      leaseState = SIMULATOR_LEASE_STATES.ACTIVE;
      stateReason = 'the task lease has a fresh heartbeat';
    } else if (lease) {
      stateReason = 'the task lease heartbeat is stale without an explicit release';
    }
    return { ...device, lease, leaseState, stateReason };
  });
}

export function unresolvedSimulatorOwners(devices, owners) {
  const booted = bootedDevices(devices);
  return owners.filter((owner) => !booted.some((device) => String(owner.args || '').includes(device.udid)));
}

export function selectSimulatorShutdowns(devices, {
  softBootedTarget = DEFAULT_SOFT_TARGET,
  pressureConfirmed = false,
  owners = [],
  ownerInventoryAvailable = false,
  leases = [],
  leaseRegistryAvailable = false,
  leaseHeartbeatTtlMinutes = 10,
  nowMs = Date.now(),
} = {}) {
  const booted = bootedDevices(devices);
  if (!pressureConfirmed || !ownerInventoryAvailable || booted.length <= softBootedTarget) return [];
  if (unresolvedSimulatorOwners(booted, owners).length > 0) return [];
  const classified = classifySimulatorDevices(booted, {
    leases, leaseRegistryAvailable, owners, ownerInventoryAvailable, leaseHeartbeatTtlMinutes, nowMs,
  });
  const ranked = classified
    .filter((device) => device.leaseState === SIMULATOR_LEASE_STATES.PROVEN_INACTIVE)
    .sort((a, b) => {
    const aStarted = timestamp(a.lease?.claimedAt) || Number(a.claimedAtMs || a.bootedAtMs || a.dataMtime || 0);
    const bStarted = timestamp(b.lease?.claimedAt) || Number(b.claimedAtMs || b.bootedAtMs || b.dataMtime || 0);
    return aStarted - bStarted || String(a.udid).localeCompare(String(b.udid));
  });
  const candidate = ranked[0];
  if (!candidate) return [];
  return [{
    kind: 'simulator.shutdown',
    udid: candidate.udid,
    name: candidate.name,
    reason: `sustained pressure with ${booted.length} Booted simulators above soft target ${softBootedTarget}`,
    orderingTimestampMs: timestamp(candidate.lease?.claimedAt) || Number(candidate.claimedAtMs || candidate.bootedAtMs || candidate.dataMtime || 0),
    projectId: candidate.lease?.projectId || '',
    taskId: candidate.lease?.taskId || '',
  }];
}

export function selectSimulatorCoordinationRequest(devices, options = {}) {
  const booted = bootedDevices(devices);
  if (!options.pressureConfirmed || !options.ownerInventoryAvailable || !options.leaseRegistryAvailable) return null;
  if (booted.length <= (options.softBootedTarget ?? DEFAULT_SOFT_TARGET)) return null;
  if (unresolvedSimulatorOwners(booted, options.owners || []).length > 0) return null;
  const classified = classifySimulatorDevices(booted, options);
  if (classified.some((device) => device.leaseState === SIMULATOR_LEASE_STATES.PROVEN_INACTIVE)) return null;
  const active = classified
    .filter((device) => device.leaseState === SIMULATOR_LEASE_STATES.ACTIVE && device.lease)
    .sort((a, b) => timestamp(a.lease.claimedAt) - timestamp(b.lease.claimedAt));
  const candidate = active[0];
  if (!candidate) return null;
  return {
    kind: 'simulator.release-request',
    udid: candidate.udid,
    name: candidate.name,
    projectId: candidate.lease.projectId,
    taskId: candidate.lease.taskId,
    claimedAt: candidate.lease.claimedAt,
    reason: 'sustained pressure remains above the soft target after no proven-inactive device was found',
    authority: 'request release only; never stop or interrupt the owning task',
  };
}

export function validateSimulatorShutdown(action, devices, {
  softBootedTarget = DEFAULT_SOFT_TARGET,
  pressureConfirmed = false,
  owners = [],
  ownerInventoryAvailable = false,
  leases = [],
  leaseRegistryAvailable = false,
  leaseHeartbeatTtlMinutes = 10,
  nowMs = Date.now(),
} = {}) {
  if (!pressureConfirmed) return { safe: false, reason: 'memory pressure is no longer confirmed' };
  if (!ownerInventoryAvailable) return { safe: false, reason: 'simulator owner inventory is unavailable' };
  const booted = bootedDevices(devices);
  if (booted.length <= softBootedTarget) {
    return { safe: false, reason: `Booted count ${booted.length} is at or below soft target ${softBootedTarget}` };
  }
  if (!booted.some((device) => device.udid === action.udid)) {
    return { safe: false, reason: 'target simulator is no longer Booted and available' };
  }
  if (unresolvedSimulatorOwners(booted, owners).length > 0) {
    return { safe: false, reason: 'one or more simulator owners cannot be resolved to an exact UDID' };
  }
  if (owners.some((owner) => String(owner.args || '').includes(action.udid))) {
    return { safe: false, reason: 'target simulator acquired an active owner after planning' };
  }
  const target = classifySimulatorDevices(booted, {
    leases, leaseRegistryAvailable, owners, ownerInventoryAvailable, leaseHeartbeatTtlMinutes, nowMs,
  }).find((device) => device.udid === action.udid);
  if (target?.leaseState !== SIMULATOR_LEASE_STATES.PROVEN_INACTIVE) {
    return { safe: false, reason: `target lease is ${target?.leaseState || SIMULATOR_LEASE_STATES.UNKNOWN}, not PROVEN_INACTIVE` };
  }
  return { safe: true, reason: 'pressure and exact-UDID ownership revalidated' };
}
