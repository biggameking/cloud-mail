#!/usr/bin/env node
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { syncTemplateRepository } from './devrules-lib/template-sync.mjs';

const execFileAsync = promisify(execFile);
const DIRECTORY_NAMES = ['rules', 'workflows', 'profiles', 'templates', 'scripts'];
const ROOT_FILES = ['template.json', 'CHANGELOG.md', 'always-readme.md'];
const INSTALLED_MODULES = [
  'core-orchestration',
  'configuration',
  'core-rules',
  'workflow-management',
  'profiles',
  'work-system-assets',
  'scripts',
];

async function run(command, args, options = {}) {
  const result = await execFileAsync(command, args, {
    cwd: options.cwd,
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

async function exists(filePath) {
  return fs.access(filePath).then(() => true).catch(() => false);
}

async function configure(repo) {
  await git(repo, 'config', 'user.name', 'selective sync selftest');
  await git(repo, 'config', 'user.email', 'selective-sync@example.invalid');
}

function governedMarkdown(ownership, syncModule, body) {
  return `---\nownership: ${ownership}\nsync_module: ${syncModule}\n---\n\n${body}`;
}

async function setRevision(template, remote, revision) {
  const version = `2.0.${revision}`;
  await write(path.join(template, 'template.json'), `${JSON.stringify({
    schemaVersion: 1,
    templateId: 'selftest/selective-sync',
    version,
    revision,
    sourceRepository: remote,
  }, null, 2)}\n`);
  await write(path.join(template, 'CHANGELOG.md'), `# Changelog\n\n## [${version}] - 2026-07-19\n`);
  await write(path.join(template, 'scripts/devrules.mjs'), `const VERSION = '${version}';\n`);
  await write(path.join(template, 'always-readme.md'), governedMarkdown('shared', 'core-orchestration', `# orchestration ${revision}\n`));
  await write(path.join(template, 'rules/shared-alpha.md'), governedMarkdown('shared', 'core-rules', `# alpha ${revision}\n`));
  await write(path.join(template, 'workflows/shared-beta.md'), governedMarkdown('shared', 'workflow-management', `# beta ${revision}\n`));
  await write(path.join(template, 'profiles/shared-profile.md'), governedMarkdown('shared', 'profiles', `# profile ${revision}\n`));
  await write(path.join(template, 'templates/project-seed.md'), governedMarkdown('seed', 'work-system-assets', `# seed ${revision}\n`));
  await write(path.join(template, 'rules/project-local.md'), governedMarkdown('local', 'core-rules', `# local source ${revision}\n`));
}

async function publish(template, remote, revision, initial = false) {
  await setRevision(template, remote, revision);
  await git(template, 'add', '-A');
  await git(template, 'commit', '-m', `template revision ${revision}`);
  await git(template, 'tag', '-a', `v2.0.${revision}`, '-m', `v2.0.${revision}`);
  await git(template, 'push', ...(initial ? ['-u', 'origin', 'main'] : []), '--follow-tags');
}

async function initializeTarget(target) {
  await fs.mkdir(path.join(target, 'devrules'), { recursive: true });
  await git(target, 'init', '-b', 'main');
  await configure(target);
  await write(path.join(target, 'devrules/manifest.json'), `${JSON.stringify({
    schemaVersion: 1,
    installedModules: INSTALLED_MODULES,
    enabledModules: ['core-orchestration'],
  }, null, 2)}\n`);
}

function syncOptions(template, target, options = {}) {
  return {
    repoPath: target,
    templateRoot: template,
    directoryNames: DIRECTORY_NAMES,
    rootFiles: ROOT_FILES,
    apply: true,
    ...options,
  };
}

async function snapshot(target, relPaths) {
  return Object.fromEntries(await Promise.all(relPaths.map(async (relPath) => [
    relPath,
    await fs.readFile(path.join(target, relPath)).catch((error) => error?.code === 'ENOENT' ? null : Promise.reject(error)),
  ])));
}

async function testSelectiveModulesAndRollback(root) {
  const template = path.join(root, 'template');
  const target = path.join(root, 'target');
  const remote = path.join(root, 'template.git');
  await fs.mkdir(template, { recursive: true });
  await run('git', ['init', '--bare', remote]);
  await git(template, 'init', '-b', 'main');
  await configure(template);
  await git(template, 'remote', 'add', 'origin', remote);
  await publish(template, remote, 1, true);
  await initializeTarget(target);

  const first = await syncTemplateRepository(syncOptions(template, target));
  assert.equal(first.applied, true);
  assert.equal(first.blocked, false);
  assert.equal(await exists(path.join(target, 'devrules/rules/project-local.md')), false, 'local source must never be installed');
  assert.match(await read(path.join(target, 'devrules/workflows/shared-beta.md')), /beta 1/, 'installedModules, not enabledModules, controls synchronization');
  let state = JSON.parse(await read(path.join(target, 'devrules/.template-sync.json')));
  assert.equal(state.schemaVersion, 4);
  assert.equal(state.files['templates/project-seed.md'].ownership, 'project');
  assert.equal(state.files['templates/project-seed.md'].sourceOwnership, 'seed');
  assert.equal(state.files['rules/project-local.md'], undefined);
  const revision1Commit = await git(template, 'rev-parse', 'HEAD');

  await write(path.join(target, 'devrules/rules/shared-alpha.md'), '# project alpha edit\n');
  await publish(template, remote, 2);
  const revision2Commit = await git(template, 'rev-parse', 'HEAD');
  const partial = await syncTemplateRepository(syncOptions(template, target));
  assert.equal(partial.applied, true, 'unrelated modules must still apply');
  assert.equal(partial.blocked, true, 'partial apply must retain a conflict signal');
  assert.equal(partial.partial, true);
  assert.deepEqual(partial.conflictModules, ['core-rules']);
  assert.deepEqual(partial.deferredModules, ['core-orchestration', 'workflow-management']);
  assert.equal(await read(path.join(target, 'devrules/rules/shared-alpha.md')), '# project alpha edit\n');
  assert.match(await read(path.join(target, 'devrules/workflows/shared-beta.md')), /beta 1/, 'workflow must defer when core-rules is conflicted');
  assert.match(await read(path.join(target, 'devrules/profiles/shared-profile.md')), /profile 2/, 'independent modules must still advance');
  assert.match(await read(path.join(target, 'devrules/templates/project-seed.md')), /seed 1/, 'seed upgrades must preserve the installed project copy');
  state = JSON.parse(await read(path.join(target, 'devrules/.template-sync.json')));
  assert.equal(state.files['rules/shared-alpha.md'].sourceCommit, revision1Commit, 'blocked module baseline must remain unchanged');
  assert.equal(state.files['workflows/shared-beta.md'].sourceCommit, revision1Commit, 'dependency-deferred module baseline must remain unchanged');
  assert.equal(state.files['profiles/shared-profile.md'].sourceCommit, revision2Commit, 'independent module baseline must advance');
  assert.equal(state.files['templates/project-seed.md'].ownership, 'project');

  await write(path.join(target, 'devrules/rules/shared-alpha.md'), governedMarkdown('shared', 'core-rules', '# alpha 2\n'));
  assert.equal((await syncTemplateRepository(syncOptions(template, target))).applied, true, 'resolved module must advance independently on retry');

  await publish(template, remote, 3);
  await write(path.join(target, 'devrules/scripts/devrules.mjs'), "const VERSION = 'project-local';\n");
  const atomicPlan = await syncTemplateRepository(syncOptions(template, target, { apply: false }));
  assert.deepEqual(atomicPlan.conflictModules, ['scripts']);
  assert.equal(atomicPlan.deferredModules.includes('configuration'), true, 'configuration must defer with its atomic scripts peer');
  assert.equal(atomicPlan.deferredModules.includes('core-orchestration'), true, 'dependency closure must propagate through the atomic group');
  const rollbackPaths = [
    'devrules/always-readme.md',
    'devrules/workflows/shared-beta.md',
    'devrules/profiles/shared-profile.md',
    'devrules/template.json',
    'devrules/scripts/devrules.mjs',
    'devrules/.template-sync.json',
  ];
  const beforeRollback = await snapshot(target, rollbackPaths);
  const previousInjection = process.env.DEVRULES_TEST_FAIL_AFTER_OPERATIONS;
  process.env.DEVRULES_TEST_FAIL_AFTER_OPERATIONS = '1';
  try {
    await assert.rejects(syncTemplateRepository(syncOptions(template, target)), /rolled back/);
  } finally {
    if (previousInjection === undefined) delete process.env.DEVRULES_TEST_FAIL_AFTER_OPERATIONS;
    else process.env.DEVRULES_TEST_FAIL_AFTER_OPERATIONS = previousInjection;
  }
  assert.deepEqual(await snapshot(target, rollbackPaths), beforeRollback, 'module-safe transaction failure must restore every target and state byte');
}

async function testExplicitLegacyReconciliation(root) {
  const template = path.join(root, 'template');
  const target = path.join(root, 'legacy-target');
  await initializeTarget(target);
  await write(path.join(target, 'devrules/rules/shared-alpha.md'), '# legacy shared customization\n');
  await write(path.join(target, 'devrules/templates/project-seed.md'), '# legacy project seed\n');
  await write(path.join(target, 'devrules/rules/project-local.md'), '# legacy local rule\n');
  await write(path.join(target, 'devrules/rules/unknown-legacy.md'), '# retired legacy bytes\n');
  await write(path.join(target, 'devrules/rules/._legacy.md'), 'AppleDouble bytes\n');
  const legacyStatePath = path.join(target, 'devrules/.template-sync.json');
  const legacyFiles = {
    'rules/shared-alpha.md': { sourceHash: 'a'.repeat(64), syncedHash: 'a'.repeat(64), syncedAt: new Date().toISOString() },
    'templates/project-seed.md': { sourceHash: 'b'.repeat(64), syncedHash: 'c'.repeat(64), syncedAt: new Date().toISOString() },
    'rules/project-local.md': { sourceHash: 'd'.repeat(64), syncedHash: 'e'.repeat(64), syncedAt: new Date().toISOString() },
    'rules/unknown-legacy.md': { sourceHash: 'f'.repeat(64), syncedHash: 'f'.repeat(64), syncedAt: new Date().toISOString() },
    'rules/._legacy.md': { sourceHash: '1'.repeat(64), syncedHash: '1'.repeat(64), syncedAt: new Date().toISOString() },
    'rules/../unsafe.md': { sourceHash: '2'.repeat(64), syncedHash: '2'.repeat(64), syncedAt: new Date().toISOString() },
  };
  await write(legacyStatePath, `${JSON.stringify({ schemaVersion: 1, files: legacyFiles }, null, 2)}\n`);
  const before = await snapshot(target, [
    'devrules/rules/shared-alpha.md',
    'devrules/templates/project-seed.md',
    'devrules/rules/project-local.md',
    'devrules/rules/unknown-legacy.md',
    'devrules/rules/._legacy.md',
    'devrules/.template-sync.json',
  ]);
  const ordinary = await syncTemplateRepository(syncOptions(template, target));
  assert.equal(ordinary.blocked, true, 'ordinary sync must fail closed on untrusted legacy state');
  assert.equal(ordinary.applied, false);
  assert.deepEqual(await snapshot(target, Object.keys(before)), before);
  const unsafe = await syncTemplateRepository(syncOptions(template, target, { reconcileOwnership: true }));
  assert.equal(unsafe.blocked, true, 'explicit reconciliation must reject unsafe state structure');
  assert.match(unsafe.transitionErrors.join('\n'), /structurally invalid/);

  delete legacyFiles['rules/../unsafe.md'];
  await write(legacyStatePath, `${JSON.stringify({ schemaVersion: 1, files: legacyFiles }, null, 2)}\n`);
  const reconciled = await syncTemplateRepository(syncOptions(template, target, { reconcileOwnership: true }));
  assert.equal(reconciled.applied, true);
  assert.match(await read(path.join(target, 'devrules/rules/shared-alpha.md')), /alpha 3/, 'shared content must reconcile to template authority');
  assert.equal(await read(path.join(target, 'devrules/templates/project-seed.md')), '# legacy project seed\n');
  assert.equal(await read(path.join(target, 'devrules/rules/project-local.md')), '# legacy local rule\n');
  assert.equal(await read(path.join(target, 'devrules/rules/unknown-legacy.md')), '# retired legacy bytes\n');
  assert.equal(await read(path.join(target, 'devrules/rules/._legacy.md')), 'AppleDouble bytes\n');
  const state = JSON.parse(await read(legacyStatePath));
  assert.equal(state.schemaVersion, 4);
  assert.equal(state.files['rules/shared-alpha.md'].ownership, 'template');
  assert.equal(state.files['templates/project-seed.md'].ownership, 'project');
  assert.equal(state.files['rules/project-local.md'], undefined);
  assert.equal(state.files['rules/unknown-legacy.md'], undefined);
  assert.equal(state.files['rules/._legacy.md'], undefined);

  await git(template, 'checkout', '--detach', 'HEAD');
  const fixedReleasePlan = await syncTemplateRepository(syncOptions(template, target, { apply: false }));
  assert.equal(fixedReleasePlan.globalBlocked, false, 'an immutable detached release must not require a branch upstream');
  assert.doesNotMatch(fixedReleasePlan.transitionErrors.join('\n'), /upstream|published to its upstream/);
}

async function testProjectConfiguredModuleScope(root) {
  const template = path.join(root, 'template');
  const target = path.join(root, 'configured-scope-target');
  await git(template, 'checkout', 'main');
  await initializeTarget(target);
  await write(path.join(target, 'devrules/config.json'), `${JSON.stringify({
    schemaVersion: 1,
    templateSync: { moduleSelection: 'explicit', modules: ['profiles'] },
  }, null, 2)}\n`);
  const profileScopeConfig = await read(path.join(target, 'devrules/config.json'));

  const profileOnly = await syncTemplateRepository(syncOptions(template, target));
  assert.equal(profileOnly.blocked, false);
  assert.match(await read(path.join(target, 'devrules/profiles/shared-profile.md')), /profile 3/);
  assert.equal(await exists(path.join(target, 'devrules/rules/shared-alpha.md')), false, 'out-of-scope rule files must not be installed');
  assert.equal(await exists(path.join(target, 'devrules/workflows/shared-beta.md')), false, 'out-of-scope workflow files must not be installed');
  assert.equal(await read(path.join(target, 'devrules/config.json')), profileScopeConfig, 'project module scope must remain project-owned');
  let state = JSON.parse(await read(path.join(target, 'devrules/.template-sync.json')));
  assert.deepEqual(Object.keys(state.modules), ['profiles']);

  await publish(template, path.join(root, 'template.git'), 4);
  const profileUpgrade = await syncTemplateRepository(syncOptions(template, target));
  assert.equal(profileUpgrade.blocked, false);
  assert.match(await read(path.join(target, 'devrules/profiles/shared-profile.md')), /profile 4/);
  assert.equal(await read(path.join(target, 'devrules/config.json')), profileScopeConfig, 'explicit module scope must survive later releases');

  await write(path.join(target, 'devrules/config.json'), `${JSON.stringify({
    schemaVersion: 1,
    templateSync: { moduleSelection: 'explicit', modules: ['workflow-management'] },
  }, null, 2)}\n`);
  const dependencyScope = await syncTemplateRepository(syncOptions(template, target));
  assert.equal(dependencyScope.blocked, false);
  assert.match(await read(path.join(target, 'devrules/rules/shared-alpha.md')), /alpha 4/, 'workflow scope must include its core-rules dependency');
  assert.match(await read(path.join(target, 'devrules/workflows/shared-beta.md')), /beta 4/);
  assert.match(await read(path.join(target, 'devrules/profiles/shared-profile.md')), /profile 4/, 'leaving a module scope must preserve its existing bytes');

  const coreTarget = path.join(root, 'core-orchestration-scope-target');
  await initializeTarget(coreTarget);
  await write(path.join(coreTarget, 'devrules/config.json'), `${JSON.stringify({
    schemaVersion: 1,
    templateSync: { moduleSelection: 'explicit', modules: ['core-orchestration'] },
  }, null, 2)}\n`);
  const coreScopeConfig = await read(path.join(coreTarget, 'devrules/config.json'));
  const coreOnly = await syncTemplateRepository(syncOptions(template, coreTarget));
  assert.equal(coreOnly.blocked, false);
  assert.match(await read(path.join(coreTarget, 'devrules/always-readme.md')), /orchestration 4/);
  assert.match(await read(path.join(coreTarget, 'devrules/rules/shared-alpha.md')), /alpha 4/,
    'core orchestration scope must include its declared rules/workflow/script dependencies');
  await publish(template, path.join(root, 'template.git'), 5);
  const coreUpgrade = await syncTemplateRepository(syncOptions(template, coreTarget));
  assert.equal(coreUpgrade.blocked, false);
  assert.match(await read(path.join(coreTarget, 'devrules/always-readme.md')), /orchestration 5/);
  assert.equal(await read(path.join(coreTarget, 'devrules/config.json')), coreScopeConfig,
    'core orchestration scope remains project-owned across later releases');
  assert.match(await read(path.join(coreTarget, 'devrules/rules/shared-alpha.md')), /alpha 5/);

  await write(path.join(target, 'devrules/config.json'), `${JSON.stringify({
    schemaVersion: 1,
    templateSync: { moduleSelection: 'explicit', modules: ['unknown-module'] },
  }, null, 2)}\n`);
  const before = await snapshot(target, ['devrules/rules/shared-alpha.md', 'devrules/workflows/shared-beta.md', 'devrules/.template-sync.json']);
  await assert.rejects(syncTemplateRepository(syncOptions(template, target)), /unknown module/);
  assert.deepEqual(
    await snapshot(target, ['devrules/rules/shared-alpha.md', 'devrules/workflows/shared-beta.md', 'devrules/.template-sync.json']),
    before,
    'invalid module scope must fail before any target bytes change',
  );

  for (const selectedModule of ['configuration', 'scripts']) {
    const atomicTarget = path.join(root, `atomic-scope-${selectedModule}`);
    await initializeTarget(atomicTarget);
    await write(path.join(atomicTarget, 'devrules/config.json'), `${JSON.stringify({
      schemaVersion: 1,
      templateSync: { moduleSelection: 'explicit', modules: [selectedModule] },
    }, null, 2)}\n`);
    const atomicResult = await syncTemplateRepository(syncOptions(template, atomicTarget));
    assert.equal(atomicResult.blocked, false);
    const plannedModuleIds = new Set(atomicResult.modules.map((module) => module.moduleId));
    assert.equal(plannedModuleIds.has('configuration'), true, `selecting ${selectedModule} must include configuration`);
    assert.equal(plannedModuleIds.has('scripts'), true, `selecting ${selectedModule} must include scripts`);
    assert.equal(await exists(path.join(atomicTarget, 'devrules/template.json')), true);
    assert.equal(await exists(path.join(atomicTarget, 'devrules/scripts/devrules.mjs')), true);
  }

  const invalidManifestTarget = path.join(root, 'invalid-installed-modules-target');
  await initializeTarget(invalidManifestTarget);
  const invalidManifest = JSON.parse(await read(path.join(invalidManifestTarget, 'devrules/manifest.json')));
  invalidManifest.installedModules = 'profiles';
  await write(path.join(invalidManifestTarget, 'devrules/manifest.json'), `${JSON.stringify(invalidManifest, null, 2)}\n`);
  await assert.rejects(
    syncTemplateRepository(syncOptions(template, invalidManifestTarget)),
    /project manifest installedModules must be an array/,
    'a malformed module selection must fail closed instead of expanding to every module',
  );
}

async function main() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'template-sync-selective-selftest-'));
  try {
    await testSelectiveModulesAndRollback(root);
    await testExplicitLegacyReconciliation(root);
    await testProjectConfiguredModuleScope(root);
    process.stdout.write('template sync selective selftest: PASS\n');
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}

main().catch((error) => {
  process.stderr.write(`template sync selective selftest: FAIL\n${error.stack || error.message}\n`);
  process.exitCode = 1;
});
