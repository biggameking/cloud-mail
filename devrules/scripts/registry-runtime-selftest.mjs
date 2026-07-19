#!/usr/bin/env node
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const CLI = path.join(SCRIPT_DIR, 'devrules.mjs');

async function run(command, args, options = {}) {
  const result = await execFileAsync(command, args, {
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
    env: options.env || process.env,
  });
  return result.stdout.trim();
}

async function git(repo, ...args) {
  return run('git', ['-C', repo, ...args]);
}

async function write(filePath, content) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content);
}

async function read(filePath) {
  return fs.readFile(filePath, 'utf8');
}

async function configureRepository(repo) {
  await git(repo, 'config', 'user.name', 'devrules registry selftest');
  await git(repo, 'config', 'user.email', 'devrules-registry-selftest@example.invalid');
}

async function commitAll(repo, message) {
  await git(repo, 'add', '-A');
  await git(repo, 'commit', '-m', message);
}

async function prepareRuntimeTemplateRoot(templateRoot, templateId) {
  await write(path.join(templateRoot, 'template.json'), JSON.stringify({
    schemaVersion: 1,
    templateId,
    version: '1.0.0',
    revision: 1,
  }, null, 2) + '\n');
  await write(path.join(templateRoot, 'scripts', 'devrules.mjs'), "const VERSION = '1.0.0';\n");
  await write(path.join(templateRoot, 'config.json'), JSON.stringify({
    schemaVersion: 1,
    workspace: { defaultRoot: '..', recursive: false },
  }, null, 2) + '\n');
}

async function initializeRepository(workspace, repoName) {
  const repo = path.join(workspace, repoName);
  await fs.mkdir(repo, { recursive: true });
  await git(repo, 'init', '-b', 'main');
  await configureRepository(repo);
  await write(path.join(repo, 'README.md'), '# ' + repoName + '\n');
  await commitAll(repo, 'initialize ' + repoName);
}

function runtimeEnvironment(templateRoot, deviceId, additions = {}) {
  return {
    ...process.env,
    DEVRULES_TEMPLATE_ROOT: templateRoot,
    DEVRULES_DEVICE_ID: deviceId,
    ...additions,
  };
}

async function testRegistrySharding(root) {
  const templateRoot = path.join(root, 'registry-sharding-template');
  const workspaceA = path.join(root, 'workspace-a');
  const workspaceASecond = path.join(root, 'workspace-a-second');
  const workspaceB = path.join(root, 'workspace-b');
  await prepareRuntimeTemplateRoot(templateRoot, 'selftest/registry-sharding');
  for (const [workspace, repoName] of [
    [workspaceA, 'project-a'],
    [workspaceASecond, 'project-a-second'],
    [workspaceB, 'project-b'],
  ]) {
    await initializeRepository(workspace, repoName);
  }

  const refreshes = [];
  for (const [deviceId, workspace] of [
    ['device-a', workspaceA],
    ['device-a', workspaceASecond],
    ['device-b', workspaceB],
  ]) {
    const result = JSON.parse(await run(
      process.execPath,
      [CLI, 'registry', 'refresh', '--root', workspace, '--apply', '--json'],
      { env: runtimeEnvironment(templateRoot, deviceId) },
    ));
    refreshes.push({ deviceId, result });
  }

  const registryDir = path.join(templateRoot, 'registry');
  assert.equal((await fs.readdir(path.join(registryDir, 'device-records'))).length, 2, 'each device should own a separate authority record');
  assert.equal((await fs.readdir(path.join(registryDir, 'workspace-records'))).length, 3, 'each workspace should own a separate project snapshot');
  for (const fileName of ['devices.json', 'projects.json', 'skills.json']) {
    assert.equal(await fs.stat(path.join(registryDir, fileName)).then(() => true).catch(() => false), false, fileName + ' must not be a shared write target');
  }

  const workspaceRecords = await Promise.all(
    (await fs.readdir(path.join(registryDir, 'workspace-records')))
      .map(async (name) => JSON.parse(await read(path.join(registryDir, 'workspace-records', name)))),
  );
  const templateRealpath = await fs.realpath(templateRoot);
  for (const record of workspaceRecords) {
    const workspace = record.projects.workspaces.find((item) => item.workspaceId === record.projects.workspaceId);
    assert.equal(workspace.templateBinding.templateId, 'selftest/registry-sharding');
    assert.equal(workspace.templateBinding.realpath, templateRealpath);
    assert.equal(workspace.devrulesRealpath, '', 'explicit template binding must not forge a workspace-local devrules realpath');
    assert.equal(await fs.stat(path.join(workspace.path, 'devrules')).then(() => true).catch(() => false), false, 'registered workspaces must not require a devrules clone or symlink');
  }

  const deviceAEnv = runtimeEnvironment(templateRoot, 'device-a', {
    DEVRULES_WORKSPACE_ROOTS: JSON.stringify([workspaceA]),
  });
  const registered = JSON.parse(await run(
    process.execPath,
    [CLI, 'workspace', 'sync-template', '--registered', '--json'],
    { env: deviceAEnv },
  ));
  assert.deepEqual(registered.roots, [workspaceA, workspaceASecond].sort(), 'registered sync must read current-device sharded authority records');
  assert.equal(registered.roots.includes(workspaceB), false, 'registered sync must exclude foreign-device workspaces');
  const currentOnly = JSON.parse(await run(
    process.execPath,
    [CLI, 'workspace', 'sync-template', '--current-only', '--json'],
    { env: deviceAEnv },
  ));
  assert.deepEqual(currentOnly.roots, [workspaceA], 'current-only must exclude other registered workspaces');

  const offlinePath = workspaceASecond + '-offline';
  await fs.rename(workspaceASecond, offlinePath);
  try {
    let offline;
    try {
      await run(process.execPath, [CLI, 'workspace', 'sync-template', '--registered', '--json'], { env: deviceAEnv });
      assert.fail('registered sync must fail when a workspace root is offline');
    } catch (error) {
      assert.equal(error.code, 1, 'an offline registered workspace must return exit code 1');
      offline = JSON.parse(error.stdout);
    }
    assert.equal(offline.status, 'partial');
    assert.equal(offline.missingWorkspaceCount, 1, 'an offline registered workspace must be reported explicitly');
    assert.equal(offline.missingRoots[0].root, workspaceASecond);
    assert.equal(await fs.stat(workspaceASecond).then(() => true).catch(() => false), false, 'workspace sync must not recreate an offline mount path');
  } finally {
    await fs.rename(offlinePath, workspaceASecond);
  }

  const changedPaths = refreshes.map(({ result }) => result.actions
    .filter((action) => action.action !== 'skip')
    .map((action) => action.path));
  assert.equal(changedPaths.every((paths) => paths.length === 2), true, 'each device refresh should write only its device and workspace shards');
  const deviceAPaths = new Set(refreshes.filter((item) => item.deviceId === 'device-a').flatMap(({ result }) => result.actions.map((action) => action.path)));
  const deviceBPaths = new Set(refreshes.filter((item) => item.deviceId === 'device-b').flatMap(({ result }) => result.actions.map((action) => action.path)));
  assert.equal([...deviceAPaths].some((filePath) => deviceBPaths.has(filePath)), false, 'separate devices must not share a registry write path');

  const inspected = JSON.parse(await run(
    process.execPath,
    [CLI, 'registry', 'inspect', '--root', workspaceB, '--json'],
    { env: runtimeEnvironment(templateRoot, 'device-b') },
  ));
  assert.deepEqual(inspected.registry.devices.devices.map((device) => device.deviceId).sort(), ['device-a', 'device-b']);
  assert.equal(inspected.registry.devices.devices.find((device) => device.deviceId === 'device-a').workspaces.length, 2, 'one device record must retain all of that device workspaces');
  assert.deepEqual([...new Set(inspected.registry.projects.projects.map((project) => project.deviceId))].sort(), ['device-a', 'device-b']);
  assert.equal(inspected.registry.projects.summary.devices, 2);
  assert.equal(inspected.registry.projects.summary.workspaces, 3);

  const idempotent = JSON.parse(await run(
    process.execPath,
    [CLI, 'registry', 'refresh', '--root', workspaceB, '--json'],
    { env: runtimeEnvironment(templateRoot, 'device-b') },
  ));
  assert.equal(idempotent.actions.length, 2, 'repeat refresh should inspect only the two owned shards');
  assert.equal(idempotent.actions.every((action) => action.action === 'skip'), true, 'repeat registry refresh must be idempotent');

  const deviceRecordName = (await fs.readdir(path.join(registryDir, 'device-records')))
    .find((name) => name.startsWith('device-b-'));
  const workspaceRecordName = (await fs.readdir(path.join(registryDir, 'workspace-records')))
    .find((name) => name.startsWith('device-b-'));
  const deviceRecordPath = path.join(registryDir, 'device-records', deviceRecordName);
  const workspaceRecordPath = path.join(registryDir, 'workspace-records', workspaceRecordName);
  const deviceRecord = JSON.parse(await read(deviceRecordPath));
  deviceRecord.device.computerName = 'must-not-be-overwritten';
  const guardedDeviceBytes = JSON.stringify(deviceRecord, null, 2) + '\n';
  const malformedWorkspaceBytes = '{ malformed registry record\n';
  await write(deviceRecordPath, guardedDeviceBytes);
  await write(workspaceRecordPath, malformedWorkspaceBytes);
  await assert.rejects(
    run(
      process.execPath,
      [CLI, 'registry', 'refresh', '--root', workspaceB, '--apply', '--json'],
      { env: runtimeEnvironment(templateRoot, 'device-b') },
    ),
    (error) => /invalid registry authority record/.test(error.stderr || error.message),
  );
  assert.equal(await read(deviceRecordPath), guardedDeviceBytes, 'malformed registry preflight must block earlier shard writes');
  assert.equal(await read(workspaceRecordPath), malformedWorkspaceBytes, 'malformed registry preflight must preserve recoverable bytes');
}

async function testRegistryRetirement(root) {
  const templateRoot = path.join(root, 'registry-template');
  const registryDir = path.join(templateRoot, 'registry');
  const workspaceOne = path.join(root, 'retire-workspace-one');
  const workspaceTwo = path.join(root, 'retire-workspace-two');
  await prepareRuntimeTemplateRoot(templateRoot, 'selftest/registry-retirement');
  for (const [deviceId, workspace, repoName] of [
    ['device-one', workspaceOne, 'one-project'],
    ['device-two', workspaceTwo, 'two-project'],
  ]) {
    await initializeRepository(workspace, repoName);
    await run(
      process.execPath,
      [CLI, 'registry', 'refresh', '--root', workspace, '--apply', '--json'],
      { env: runtimeEnvironment(templateRoot, deviceId) },
    );
  }

  const recordNames = await fs.readdir(path.join(registryDir, 'workspace-records'));
  const records = await Promise.all(recordNames.map(async (name) => JSON.parse(await read(path.join(registryDir, 'workspace-records', name)))));
  const workspaceOneRecord = records.find((record) => record.projects.deviceId === 'device-one');
  const workspaceOneId = workspaceOneRecord.projects.workspaceId;
  const recordPath = path.join(registryDir, 'workspace-records', recordNames[records.indexOf(workspaceOneRecord)]);
  const beforeDryRun = await read(recordPath);
  const env = runtimeEnvironment(templateRoot, 'device-two');
  const dryRun = JSON.parse(await run(process.execPath, [CLI, 'registry', 'retire', '--type', 'workspace', '--id', workspaceOneId, '--json'], { env }));
  assert.equal(dryRun.actions.length, 1, 'retirement should touch only the selected authority record');
  assert.equal(await read(recordPath), beforeDryRun, 'retirement dry-run must not alter the authority record');
  await run(process.execPath, [CLI, 'registry', 'retire', '--type', 'workspace', '--id', workspaceOneId, '--apply', '--json'], { env });
  assert.equal((await fs.readdir(path.join(registryDir, 'workspace-records'))).length, 2, 'retirement should replace rather than duplicate the workspace shard');
  const retiredRecord = JSON.parse(await read(recordPath));
  assert.equal(retiredRecord.status, 'retired');
  assert.equal(retiredRecord.recordId, workspaceOneId);

  const inspected = JSON.parse(await run(process.execPath, [CLI, 'registry', 'inspect', '--root', workspaceTwo, '--json'], { env }));
  assert.equal(inspected.registry.projects.projects.some((project) => project.workspaceId === workspaceOneId), false);
  assert.equal(inspected.registry.projects.summary.total, 1);
  assert.equal(inspected.registry.devices.devices.find((device) => device.deviceId === 'device-one').workspaces.length, 0);

  const deviceDryRun = JSON.parse(await run(process.execPath, [CLI, 'registry', 'retire', '--type', 'device', '--id', 'device-one', '--json'], { env }));
  assert.equal(deviceDryRun.actions.length, 1, 'device retirement should touch only the selected device shard');
  await run(process.execPath, [CLI, 'registry', 'retire', '--type', 'device', '--id', 'device-one', '--apply', '--json'], { env });
  const afterDeviceRetirement = JSON.parse(await run(process.execPath, [CLI, 'registry', 'inspect', '--root', workspaceTwo, '--json'], { env }));
  assert.equal(afterDeviceRetirement.registry.devices.devices.some((device) => device.deviceId === 'device-one'), false);
  assert.equal(afterDeviceRetirement.registry.projects.projects.some((project) => project.deviceId === 'device-one'), false);
}

async function main() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'registry-runtime-selftest-'));
  try {
    await testRegistrySharding(root);
    await testRegistryRetirement(root);
    console.log('registry runtime selftest: PASS');
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
