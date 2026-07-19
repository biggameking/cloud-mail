#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { readSimulatorLeaseRegistry, runSimulatorLeaseCommand } from './devrules-lib/simulator-lease-registry.mjs';

const root = await fs.mkdtemp(path.join(os.tmpdir(), 'simulator-lease-registry-'));
const filePath = path.join(root, 'leases.json');
const identity = { projectId: 'project-a', taskId: 'task-a', udid: 'UDID-A' };
try {
  const dryRun = await runSimulatorLeaseCommand({ command: 'lease-claim', filePath, ...identity });
  assert.equal(dryRun.status, 'dry-run');
  await assert.rejects(fs.access(filePath), 'dry-run must not create device state');

  const claimed = await runSimulatorLeaseCommand({ command: 'lease-claim', apply: true, filePath, ...identity, now: new Date('2026-01-01T00:00:00Z') });
  assert.equal(claimed.status, 'pass');
  assert.equal(claimed.lease.claimedAt, '2026-01-01T00:00:00.000Z');
  assert.equal((await fs.stat(filePath)).mode & 0o777, 0o600);

  const conflict = await runSimulatorLeaseCommand({
    command: 'lease-claim', apply: true, filePath, projectId: 'project-b', taskId: 'task-b', udid: identity.udid,
  });
  assert.equal(conflict.status, 'fail');

  const heartbeat = await runSimulatorLeaseCommand({ command: 'lease-heartbeat', apply: true, filePath, ...identity, now: new Date('2026-01-01T00:05:00Z') });
  assert.equal(heartbeat.lease.claimedAt, claimed.lease.claimedAt);
  assert.equal(heartbeat.lease.lastHeartbeatAt, '2026-01-01T00:05:00.000Z');

  const manual = await runSimulatorLeaseCommand({
    command: 'lease-reserve-manual', apply: true, filePath, ...identity, manualReservationMinutes: 30, now: new Date('2026-01-01T00:10:00Z'),
  });
  assert.equal(manual.lease.manualReservedUntil, '2026-01-01T00:40:00.000Z');
  assert.equal(manual.lease.reclaimAfterManualReservation, true);

  const resumed = await runSimulatorLeaseCommand({ command: 'lease-heartbeat', apply: true, filePath, ...identity, now: new Date('2026-01-01T00:15:00Z') });
  assert.equal(resumed.lease.manualReservedUntil, '', 'resumed automation cancels the manual handoff');
  assert.equal(resumed.lease.reclaimAfterManualReservation, false);

  const released = await runSimulatorLeaseCommand({ command: 'lease-release', apply: true, filePath, ...identity, now: new Date('2026-01-01T00:20:00Z') });
  assert.equal(released.lease.releasedAt, '2026-01-01T00:20:00.000Z');
  const status = await runSimulatorLeaseCommand({ command: 'lease-status', filePath });
  assert.equal(status.leases.length, 1);

  await fs.writeFile(`${filePath}.lock`, 'held', { encoding: 'utf8', mode: 0o600 });
  const locked = await runSimulatorLeaseCommand({
    command: 'lease-claim', apply: true, filePath, projectId: 'project-b', taskId: 'task-b', udid: 'UDID-B',
  });
  assert.equal(locked.status, 'fail');
  assert.match(locked.error, /locked/);
  await fs.rm(`${filePath}.lock`);

  await fs.writeFile(filePath, '{broken', 'utf8');
  assert.equal((await readSimulatorLeaseRegistry({ filePath })).available, false, 'malformed registry must fail closed');
  process.stdout.write('simulator lease registry selftest: PASS\n');
} finally {
  await fs.rm(root, { recursive: true, force: true });
}
