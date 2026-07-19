#!/usr/bin/env node
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import {
  defaultRuntimeConfigPath,
  defaultRuntimeLauncherPath,
  createWindowsLauncherShim,
  resolveRuntimeLocation,
  runRuntimeLocationCommand,
} from './devrules-lib/runtime-location.mjs';

const execFileAsync = promisify(execFile);

async function write(filePath, content) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, 'utf8');
}

async function writeConfig(filePath, templateRoot, workspaceRoots = []) {
  await write(filePath, `${JSON.stringify({ schemaVersion: 1, templateRoot, workspaceRoots }, null, 2)}\n`);
}

async function initializeTemplate(templateRoot, templateId) {
  await write(path.join(templateRoot, 'template.json'), `${JSON.stringify({ schemaVersion: 1, templateId }, null, 2)}\n`);
  await write(path.join(templateRoot, 'scripts', 'devrules.mjs'), '// runtime location selftest fixture\n');
}

function configEnv(configPath, additions = {}) {
  return { DEVRULES_RUNTIME_CONFIG: configPath, ...additions };
}

async function expectReject(callback, pattern) {
  await assert.rejects(callback, pattern);
}

async function testDefaultPaths(root) {
  assert.equal(
    defaultRuntimeConfigPath({ platform: 'darwin', homeDir: '/Users/测试 用户', env: {} }),
    '/Users/测试 用户/.config/devrules/runtime.json',
  );
  assert.equal(
    defaultRuntimeConfigPath({ platform: 'linux', homeDir: '/home/example', env: {} }),
    '/home/example/.config/devrules/runtime.json',
  );
  assert.equal(
    defaultRuntimeConfigPath({
      platform: 'win32',
      homeDir: String.raw`C:\Users\example`,
      env: { LOCALAPPDATA: String.raw`D:\Local Data\用户` },
    }),
    String.raw`D:\Local Data\用户\devrules\runtime.json`,
  );
  const windowsLauncher = defaultRuntimeLauncherPath({
    platform: 'win32',
    homeDir: String.raw`C:\Users\example`,
    env: { LOCALAPPDATA: String.raw`D:\Local Data\用户` },
  });
  assert.equal(windowsLauncher, String.raw`D:\Local Data\用户\devrules\bin\devrules.mjs`);
  assert.match(createWindowsLauncherShim(windowsLauncher, String.raw`C:\Program Files\nodejs\node.exe`), /%~dp0devrules\.mjs/);
  assert.equal(
    defaultRuntimeConfigPath({
      platform: process.platform,
      homeDir: root,
      cwd: root,
      env: { DEVRULES_RUNTIME_CONFIG: 'relative/runtime.json' },
    }),
    path.join(root, 'relative', 'runtime.json'),
  );
  assert.throws(
    () => defaultRuntimeConfigPath({ env: { DEVRULES_RUNTIME_CONFIG: ' ' }, homeDir: root }),
    /must be a non-empty string/,
  );
}

async function testResolution(root, fixtures) {
  const { templateA, templateB, workspace, offlineWorkspace } = fixtures;
  const fallback = await resolveRuntimeLocation({
    fallbackTemplateRoot: templateA,
    env: {},
    homeDir: path.join(root, 'empty home'),
  });
  assert.equal(fallback.source, 'fallback');
  assert.equal(fallback.templateRoot, templateA);
  assert.deepEqual(fallback.workspaceRoots, []);

  const templateLink = path.join(root, '模板 当前链接');
  await fs.symlink(templateA, templateLink, process.platform === 'win32' ? 'junction' : 'dir');
  const configPath = path.join(root, '配置 文件', 'runtime.json');
  await writeConfig(configPath, templateLink, [workspace, path.join(workspace, '..', path.basename(workspace)), offlineWorkspace]);
  const configured = await resolveRuntimeLocation({ fallbackTemplateRoot: templateB, env: configEnv(configPath) });
  assert.equal(configured.source, 'config');
  assert.equal(configured.templateRoot, templateLink);
  assert.equal(configured.templateRealpath, await fs.realpath(templateA));
  assert.deepEqual(configured.workspaceRoots, [workspace, offlineWorkspace]);
  assert.equal(configured.workspaceRealpaths[0], await fs.realpath(workspace));
  assert.equal(configured.workspaceRealpaths[1], null, 'offline workspace must remain configured without blocking resolution');

  const overridden = await resolveRuntimeLocation({
    fallbackTemplateRoot: templateA,
    env: configEnv(configPath, {
      DEVRULES_TEMPLATE_ROOT: templateB,
      DEVRULES_WORKSPACE_ROOTS: JSON.stringify([offlineWorkspace, workspace]),
    }),
  });
  assert.equal(overridden.source, 'environment');
  assert.equal(overridden.sources.workspaceRoots, 'environment');
  assert.equal(overridden.templateRoot, templateB);
  assert.deepEqual(overridden.workspaceRoots, [offlineWorkspace, workspace]);
}

async function testInvalidConfiguration(root, fixtures) {
  const { templateA, workspace } = fixtures;
  const missing = path.join(root, 'missing-explicit.json');
  await expectReject(
    () => resolveRuntimeLocation({ fallbackTemplateRoot: templateA, env: configEnv(missing) }),
    /Explicit runtime config does not exist/,
  );

  const malformed = path.join(root, 'malformed.json');
  await write(malformed, '{not json}\n');
  await expectReject(
    () => resolveRuntimeLocation({ fallbackTemplateRoot: templateA, env: configEnv(malformed) }),
    /not valid JSON/,
  );

  const relativeWorkspace = path.join(root, 'relative-workspace.json');
  await writeConfig(relativeWorkspace, templateA, ['relative/workspace']);
  await expectReject(
    () => resolveRuntimeLocation({ env: configEnv(relativeWorkspace) }),
    /must be an absolute path/,
  );

  const absentTemplate = path.join(root, 'absent-template.json');
  await writeConfig(absentTemplate, path.join(root, 'not mounted template'), [workspace]);
  await expectReject(
    () => resolveRuntimeLocation({ env: configEnv(absentTemplate) }),
    /Runtime template root does not exist or is unavailable/,
  );

  const valid = path.join(root, 'valid-for-empty-env.json');
  await writeConfig(valid, templateA, [workspace]);
  await expectReject(
    () => resolveRuntimeLocation({ env: configEnv(valid, { DEVRULES_TEMPLATE_ROOT: '' }) }),
    /DEVRULES_TEMPLATE_ROOT must be a non-empty string/,
  );

  const wrongSchema = path.join(root, 'wrong-schema.json');
  await write(wrongSchema, `${JSON.stringify({ schemaVersion: 2, templateRoot: templateA, workspaceRoots: [] })}\n`);
  await expectReject(
    () => resolveRuntimeLocation({ env: configEnv(wrongSchema) }),
    /schemaVersion must be 1/,
  );

  const invalidTemplate = path.join(root, 'invalid template identity');
  await write(path.join(invalidTemplate, 'template.json'), '{"schemaVersion":1,"templateId":""}\n');
  await write(path.join(invalidTemplate, 'scripts', 'devrules.mjs'), '// present\n');
  const invalidTemplateConfig = path.join(root, 'invalid-template.json');
  await writeConfig(invalidTemplateConfig, invalidTemplate);
  await expectReject(
    () => resolveRuntimeLocation({ env: configEnv(invalidTemplateConfig) }),
    /templateId.*must be a non-empty string/,
  );
  await expectReject(
    () => runRuntimeLocationCommand('configure', {
      configPath: path.join(root, 'must-not-be-written.json'),
      templateRoot: invalidTemplate,
      workspaceRoots: [],
      apply: true,
    }, { env: {} }),
    /templateId.*must be a non-empty string/,
  );
  assert.equal(await fs.access(path.join(root, 'must-not-be-written.json')).then(() => true).catch(() => false), false);

  const missingCliTemplate = path.join(root, 'template missing cli');
  await write(path.join(missingCliTemplate, 'template.json'), '{"schemaVersion":1,"templateId":"selftest/missing-cli"}\n');
  const missingCliConfig = path.join(root, 'missing-cli.json');
  await writeConfig(missingCliConfig, missingCliTemplate);
  await expectReject(
    () => resolveRuntimeLocation({ env: configEnv(missingCliConfig) }),
    /Runtime devrules CLI is missing or unavailable/,
  );
}

async function testConfigureSwitchAndAudit(root, fixtures) {
  const { templateA, templateB, workspace, offlineWorkspace } = fixtures;
  const configPath = path.join(root, 'switch A B', 'runtime.json');
  const context = { env: {}, fallbackTemplateRoot: templateA };
  const dryRun = await runRuntimeLocationCommand('configure', {
    configPath,
    templateRoot: templateA,
    workspaceRoots: [workspace, offlineWorkspace],
  }, context);
  assert.equal(dryRun.status, 'dry-run');
  assert.equal(dryRun.changed, true);
  await assert.rejects(fs.access(configPath), /ENOENT/, 'configure must not write without --apply');

  const appliedA = await runRuntimeLocationCommand('configure', {
    configPath,
    templateRoot: templateA,
    workspaceRoots: [workspace, offlineWorkspace],
    apply: true,
  }, context);
  assert.equal(appliedA.status, 'pass');
  const locationA = await resolveRuntimeLocation({ configPath, env: {} });
  assert.equal(locationA.templateRoot, templateA);

  await runRuntimeLocationCommand('configure', {
    configPath,
    templateRoot: templateB,
    workspaceRoots: [workspace, offlineWorkspace],
    apply: true,
  }, { ...context, fallbackTemplateRoot: templateB });
  const locationB = await resolveRuntimeLocation({ configPath, env: {} });
  assert.equal(locationB.templateRoot, templateB, 'changing one locator must switch the active template');

  const shown = await runRuntimeLocationCommand('show', { configPath }, { env: {} });
  assert.equal(shown.templateRoot, templateB);
  const audited = await runRuntimeLocationCommand('audit', { configPath }, { env: {} });
  assert.equal(audited.status, 'fail', 'an offline workspace must be visible to audit');
  assert.equal(audited.checks.find((check) => check.path === offlineWorkspace)?.ok, false);
  assert.equal(await fs.access(offlineWorkspace).then(() => true).catch(() => false), false, 'audit must not create an offline mount path');
  return configPath;
}

async function fakeCli(templateRoot, marker) {
  await write(path.join(templateRoot, 'scripts', 'devrules.mjs'), `process.stdout.write(JSON.stringify({
  marker: ${JSON.stringify(marker)},
  args: process.argv.slice(2),
  templateRoot: process.env.DEVRULES_TEMPLATE_ROOT,
  templateOverridePresent: Object.prototype.hasOwnProperty.call(process.env, 'DEVRULES_TEMPLATE_ROOT'),
  runtimeConfig: process.env.DEVRULES_RUNTIME_CONFIG
}));
`);
}

async function testLauncher(root, fixtures, configPath) {
  const { templateA, templateB, workspace } = fixtures;
  await fakeCli(templateA, 'A');
  await fakeCli(templateB, 'B');
  await runRuntimeLocationCommand('configure', {
    configPath,
    templateRoot: templateA,
    workspaceRoots: [workspace],
    apply: true,
  }, { env: {}, fallbackTemplateRoot: templateA });

  const launcherPath = path.join(root, 'bin 中文', 'devrules');
  const commandContext = { env: configEnv(configPath), fallbackTemplateRoot: templateA };
  const dryRun = await runRuntimeLocationCommand('install-launcher', { launcherPath }, commandContext);
  assert.equal(dryRun.status, 'dry-run');
  await assert.rejects(fs.access(launcherPath), /ENOENT/, 'launcher install must be a dry-run by default');

  const installed = await runRuntimeLocationCommand('install-launcher', { launcherPath, apply: true }, commandContext);
  assert.equal(installed.status, 'pass');
  if (process.platform !== 'win32') assert.notEqual((await fs.stat(launcherPath)).mode & 0o111, 0, 'launcher must be executable');
  const first = await execFileAsync(process.execPath, [launcherPath, 'hello world', '中文'], {
    encoding: 'utf8',
    env: { ...process.env, DEVRULES_RUNTIME_CONFIG: configPath },
  });
  assert.deepEqual(JSON.parse(first.stdout), {
    marker: 'A',
    args: ['hello world', '中文'],
    templateOverridePresent: false,
    runtimeConfig: configPath,
  });

  const movedTemplateA = `${templateA} 已移动`;
  await fs.rename(templateA, movedTemplateA);
  const repaired = await execFileAsync(process.execPath, [
    launcherPath,
    'location',
    'configure',
    '--template-root',
    templateB,
    '--workspace-root',
    workspace,
    '--apply',
    '--json',
  ], {
    encoding: 'utf8',
    env: { ...process.env, DEVRULES_RUNTIME_CONFIG: configPath },
  });
  const repairedResult = JSON.parse(repaired.stdout);
  assert.equal(repairedResult.status, 'pass');
  assert.equal(repairedResult.configuration.templateRoot, templateB);
  assert.equal(
    JSON.parse(await fs.readFile(configPath, 'utf8')).templateRoot,
    templateB,
    'the installed launcher must repair the locator after the old template path becomes unavailable',
  );
  const second = await execFileAsync(process.execPath, [launcherPath, 'after-switch'], {
    encoding: 'utf8',
    env: { ...process.env, DEVRULES_RUNTIME_CONFIG: configPath },
  });
  assert.deepEqual(JSON.parse(second.stdout), {
    marker: 'B',
    args: ['after-switch'],
    templateOverridePresent: false,
    runtimeConfig: configPath,
  });

  const booleanFlags = ['workspace', 'sync-template', '--registered', '--current-only', '--fetch', '--recursive', '--help'];
  const passthrough = await execFileAsync(process.execPath, [launcherPath, ...booleanFlags], {
    encoding: 'utf8',
    env: { ...process.env, DEVRULES_RUNTIME_CONFIG: configPath },
  });
  assert.deepEqual(
    JSON.parse(passthrough.stdout),
    { marker: 'B', args: booleanFlags, templateOverridePresent: false, runtimeConfig: configPath },
    'non-location arguments must pass through the stable launcher unchanged',
  );

  const isolatedHome = path.join(root, 'isolated launcher home');
  const customConfigEnvironment = {
    ...process.env,
    HOME: isolatedHome,
    USERPROFILE: isolatedHome,
    LOCALAPPDATA: path.join(isolatedHome, 'LocalAppData'),
  };
  delete customConfigEnvironment.DEVRULES_RUNTIME_CONFIG;
  delete customConfigEnvironment.DEVRULES_TEMPLATE_ROOT;
  const customShowArgs = ['location', 'show', '--config-path', configPath, '--json'];
  const customShow = await execFileAsync(process.execPath, [launcherPath, ...customShowArgs], {
    encoding: 'utf8',
    env: customConfigEnvironment,
  });
  assert.deepEqual(
    JSON.parse(customShow.stdout),
    { marker: 'B', args: customShowArgs, templateOverridePresent: false, runtimeConfig: configPath },
    'location show must select and propagate an explicit custom runtime config',
  );
  const customAuditArgs = ['location', 'audit', `--config-path=${configPath}`, '--json'];
  const customAudit = await execFileAsync(process.execPath, [launcherPath, ...customAuditArgs], {
    encoding: 'utf8',
    env: customConfigEnvironment,
  });
  assert.deepEqual(
    JSON.parse(customAudit.stdout),
    { marker: 'B', args: customAuditArgs, templateOverridePresent: false, runtimeConfig: configPath },
    'location audit must support the equals form of a custom runtime config',
  );
  const customWorkspaceArgs = ['workspace', 'scan', `--config-path=${configPath}`, '--json'];
  const customWorkspace = await execFileAsync(process.execPath, [launcherPath, ...customWorkspaceArgs], {
    encoding: 'utf8',
    env: customConfigEnvironment,
  });
  assert.deepEqual(
    JSON.parse(customWorkspace.stdout),
    { marker: 'B', args: customWorkspaceArgs, templateOverridePresent: false, runtimeConfig: configPath },
    'ordinary commands must use and propagate an explicit custom runtime config',
  );

  const explicitTemplate = await execFileAsync(process.execPath, [launcherPath, 'explicit-template'], {
    encoding: 'utf8',
    env: { ...customConfigEnvironment, DEVRULES_RUNTIME_CONFIG: configPath, DEVRULES_TEMPLATE_ROOT: movedTemplateA },
  });
  assert.deepEqual(
    JSON.parse(explicitTemplate.stdout),
    { marker: 'A', args: ['explicit-template'], templateRoot: movedTemplateA, templateOverridePresent: true, runtimeConfig: configPath },
    'an explicit template environment override remains explicit and selects its requested runtime',
  );
}

async function main() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'devrules runtime 中文 '));
  try {
    const fixtures = {
      templateA: path.join(root, '模板 A'),
      templateB: path.join(root, '模板 B'),
      workspace: path.join(root, '工作区 有空格'),
      offlineWorkspace: path.join(root, '外置盘 未挂载'),
    };
    await Promise.all([
      initializeTemplate(fixtures.templateA, 'selftest/template-a'),
      initializeTemplate(fixtures.templateB, 'selftest/template-b'),
      fs.mkdir(fixtures.workspace, { recursive: true }),
    ]);
    await testDefaultPaths(root);
    await testResolution(root, fixtures);
    await testInvalidConfiguration(root, fixtures);
    const configPath = await testConfigureSwitchAndAudit(root, fixtures);
    await testLauncher(root, fixtures, configPath);
    process.stdout.write('runtime-location selftest: PASS\n');
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}

main().catch((error) => {
  process.stderr.write(`runtime-location selftest: FAIL\n${error.stack || error.message}\n`);
  process.exitCode = 1;
});
