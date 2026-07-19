#!/usr/bin/env node
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ensureMemory } from './devrules-lib/instance-bootstrap.mjs';
import { validateIosSimulatorProfile } from './devrules-lib/ios-simulator-profile.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const script = path.join(root, 'scripts', 'ios-simulator-profile.mjs');
const valid = {
  schemaVersion: 1,
  projectId: 'project-a',
  simulator: {
    steadyState: 'one-persistent-device',
    deviceSelector: { name: 'Project A iPhone', runtime: 'iOS 20.0' },
    manualAcceptance: { scheme: 'App', bundleId: 'com.acme.app', preserveAppData: true },
    automation: {
      scheme: 'AppAutomation',
      appBundleId: 'com.acme.app.automation',
      destination: 'same-device',
      mutationScope: 'app-container-only',
      parallelUiWorkers: 1,
      runnerBundleIds: ['com.acme.app.automation-uitests.runner'],
    },
    bundleAllowlist: [
      { bundleId: 'com.acme.app', role: 'manual-app' },
      { bundleId: 'com.acme.app.automation', role: 'automation-app' },
      { bundleId: 'com.acme.app.automation-uitests.runner', role: 'ui-test-runner' },
      { bundleId: 'com.acme.app.widget', role: 'extension' },
    ],
    disposableDeviceRequiredFor: [
      'clean-device-state',
      'destructive-device-state',
      'identity-sensitive',
      'parallel-ui-worker',
    ],
  },
};

assert.equal(validateIosSimulatorProfile(valid).valid, true);

const templateProfile = JSON.parse(await fs.readFile(path.join(root, 'templates', 'quality', 'ios-simulator-device-profile.template.json'), 'utf8'));
assert.equal(validateIosSimulatorProfile(templateProfile).valid, false, 'unfilled template identities must fail closed');

const sameBundle = structuredClone(valid);
sameBundle.simulator.automation.appBundleId = sameBundle.simulator.manualAcceptance.bundleId;
assert.match(validateIosSimulatorProfile(sameBundle).issues.map((issue) => issue.message).join('\n'), /must differ/);

const separateDevice = structuredClone(valid);
separateDevice.simulator.automation.destination = 'separate-device';
assert.match(validateIosSimulatorProfile(separateDevice).issues.map((issue) => issue.message).join('\n'), /same-device/);

const unsafePersistentAutomation = structuredClone(valid);
unsafePersistentAutomation.simulator.automation.parallelUiWorkers = 2;
unsafePersistentAutomation.simulator.automation.mutationScope = 'device-wide';
const unsafeIssues = validateIosSimulatorProfile(unsafePersistentAutomation).issues.map((issue) => issue.message).join('\n');
assert.match(unsafeIssues, /must equal 1/);
assert.match(unsafeIssues, /app-container-only/);

const missingRunner = structuredClone(valid);
missingRunner.simulator.bundleAllowlist = missingRunner.simulator.bundleAllowlist.filter((entry) => entry.role !== 'ui-test-runner');
assert.match(validateIosSimulatorProfile(missingRunner).issues.map((issue) => issue.message).join('\n'), /must include runner/);

const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'ios-simulator-profile-selftest-'));
try {
  const appleRepo = path.join(temp, 'apple-project');
  await fs.mkdir(appleRepo, { recursive: true });
  const actions = [];
  await ensureMemory(appleRepo, ['Sources'], [], [], ['swift'], true, actions);
  const projectProfile = await fs.readFile(path.join(appleRepo, 'devrules', 'memory', 'project-profile.md'), 'utf8');
  assert.match(projectProfile, /iOS Simulator profile: devrules\/memory\/ios-simulator-device-profile\.json/);

  const profilePath = path.join(temp, 'profile.json');
  await fs.writeFile(profilePath, `${JSON.stringify(valid, null, 2)}\n`);
  const result = JSON.parse(execFileSync(process.execPath, [script, '--profile', profilePath, '--json'], { encoding: 'utf8' }));
  assert.equal(result.valid, true);
  assert.equal(result.automationDestination, 'same-device');

  valid.simulator.automation.destination = 'separate-device';
  await fs.writeFile(profilePath, `${JSON.stringify(valid, null, 2)}\n`);
  const invalid = spawnSync(process.execPath, [script, '--profile', profilePath, '--json'], { encoding: 'utf8' });
  assert.equal(invalid.status, 1);
  assert.equal(JSON.parse(invalid.stdout).valid, false);

  const hooks = JSON.parse(await fs.readFile(path.join(root, 'hooks', 'hooks.json'), 'utf8'));
  const xcodeRoute = hooks.hooks.find((hook) => hook.id === 'ios-xcode-verification');
  assert.ok(xcodeRoute.run.some((command) => command.includes('ios-simulator-profile.mjs')));
} finally {
  await fs.rm(temp, { recursive: true, force: true });
}

console.log('iOS Simulator profile selftest: PASS');
