#!/usr/bin/env node
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { createHandoffRecord, inspectGitRepository, resolveGitDirectory } from './devrules-lib/git-repository.mjs';
import { withFileLock } from './devrules-lib/safe-files.mjs';
import { createRunExpectFailureJson, exists } from './devrules-lib/selftest-utils.mjs';
import {
  templateLocalAuditIssues,
  templateReleaseAuditIssues,
} from './devrules-lib/template-authority.mjs';
import {
  collectManagedTemplateFiles,
  readTemplateSource,
  recoverTemplateSyncTransaction,
  syncTemplateRepository,
} from './devrules-lib/template-sync.mjs';

const execFileAsync = promisify(execFile);
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const CLI = path.join(SCRIPT_DIR, 'devrules.mjs');
const SOURCE_TEMPLATE_ROOT = path.resolve(SCRIPT_DIR, '..');
const TEMPLATE_SYNC_DIRS = ['rules', 'workflows', 'profiles', 'templates', 'scripts', 'hooks', 'design-styles'];
const TEMPLATE_SYNC_ROOT_FILES = [
  'template.json',
  'CHANGELOG.md',
  'always-readme.md',
  'DESIGN.template.md',
  'DESIGN.example.md',
  'design-readme.md',
  'design.config.json',
  'design-guard.allow.json',
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

const runExpectFailureJson = createRunExpectFailureJson(run);

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
  await git(repo, 'config', 'user.name', 'devrules selftest');
  await git(repo, 'config', 'user.email', 'devrules-selftest@example.invalid');
}

async function commitAll(repo, message) {
  await git(repo, 'add', '-A');
  await git(repo, 'commit', '-m', message);
}

async function setTemplateRevision(template, revision, files = {}, sourceRepository = undefined) {
  const version = `1.0.${revision}`;
  let declaredRepository = sourceRepository;
  if (declaredRepository === undefined) {
    const previousManifest = JSON.parse(await read(path.join(template, 'template.json')).catch(() => '{}'));
    declaredRepository = previousManifest.sourceRepository || '';
  }
  await write(path.join(template, 'template.json'), `${JSON.stringify({
    schemaVersion: 1,
    templateId: 'selftest/devrules',
    version,
    revision,
    sourceRepository: declaredRepository,
  }, null, 2)}\n`);
  await write(path.join(template, 'scripts', 'devrules.mjs'), `const VERSION = '${version}';\n`);
  await write(path.join(template, 'CHANGELOG.md'), `# Changelog\n\n## [${version}] - 2026-07-14\n`);
  for (const [relPath, content] of Object.entries(files)) {
    await write(path.join(template, relPath), content);
  }
}

async function tagTemplateRevision(template, revision) {
  const tag = `v1.0.${revision}`;
  if (!(await git(template, 'tag', '--list', tag))) {
    await git(template, 'tag', '-a', tag, '-m', `devrules ${tag}`);
  }
}

async function publishTemplate(template, revision, files, message = `template revision ${revision}`) {
  await setTemplateRevision(template, revision, files);
  await commitAll(template, message);
  await tagTemplateRevision(template, revision);
  await git(template, 'push', '--follow-tags');
}

async function expectFileSet(repo, relPaths) {
  return Promise.all(relPaths.map(async (relPath) => [
    relPath,
    await fs.readFile(path.join(repo, relPath)).catch((error) => error?.code === 'ENOENT' ? null : Promise.reject(error)),
  ])).then(Object.fromEntries);
}

function syncOptions(template, target, apply = true) {
  return {
    repoPath: target,
    templateRoot: template,
    directoryNames: ['rules', 'workflows', 'hooks'],
    rootFiles: ['template.json', 'always-readme.md'],
    apply,
  };
}

async function testNonGitMetadataFallback(root) {
  const template = path.join(root, 'non-git-template');
  await write(path.join(template, 'rules', 'rule.md'), '# rule\n');
  await write(path.join(template, 'rules', '._rule.md'), 'appledouble\n');
  await write(path.join(template, 'rules', '.DS_Store'), 'finder metadata\n');
  await write(path.join(template, 'rules', 'Thumbs.db'), 'windows metadata\n');
  const files = await collectManagedTemplateFiles(template, ['rules'], []);
  assert.deepEqual(files.map((file) => file.relPath), ['rules/rule.md'], 'non-Git fallback must exclude machine metadata');
}

async function createRepositoryScopedTemplate(root) {
  const template = path.join(root, 'repository-scoped-template');
  const remote = path.join(root, 'repository-scoped-template.git');
  await fs.mkdir(template, { recursive: true });
  await run('git', ['init', '--bare', remote]);
  await git(template, 'init', '-b', 'main');
  await configureRepository(template);
  await setTemplateRevision(template, 1, {
    '.gitignore': '._*\n.DS_Store\nThumbs.db\nrules/tracked-ignored.md\n',
    'always-readme.md': '# template 1\n',
    'rules/rule.md': '# rule 1\n',
    'rules/tracked-ignored.md': '# tracked even after ignore\n',
    'hooks/hooks.json': '{"schemaVersion":1,"hooks":[]}\n',
    'hooks/codex-global-code-health-hook.mjs': 'export {};\n',
    'hooks/cursor-global-routing-hook.mjs': 'export {};\n',
    'hooks/cursor-routing-core.mjs': 'export {};\n',
    'hooks/device-maintenance-bootstrap-core.mjs': 'export {};\n',
  }, remote);
  await git(template, 'add', '-f', 'rules/tracked-ignored.md');
  await commitAll(template, 'publish repository-scoped template revision 1');
  await git(template, 'remote', 'add', 'origin', remote);
  await git(template, 'push', '-u', 'origin', 'main');
  const managedFiles = await collectManagedTemplateFiles(template, TEMPLATE_SYNC_DIRS, TEMPLATE_SYNC_ROOT_FILES);
  const missingTag = await readTemplateSource(template, managedFiles);
  assert.equal(missingTag.authoritative, false, 'a published branch without the version tag is not authoritative');

  await git(template, 'tag', 'v1.0.1');
  await git(template, 'push', 'origin', 'v1.0.1');
  const lightweightTag = await readTemplateSource(template, managedFiles, { verifyRemoteTag: true });
  assert.equal(lightweightTag.tagAnnotated, false, 'a lightweight version tag must not satisfy release authority');
  assert.equal(lightweightTag.remoteAuthoritative, false);

  await git(template, 'push', 'origin', ':refs/tags/v1.0.1');
  await git(template, 'tag', '-d', 'v1.0.1');
  await tagTemplateRevision(template, 1);
  const localOnlyTag = await readTemplateSource(template, managedFiles, { verifyRemoteTag: true });
  assert.equal(localOnlyTag.authoritative, true, 'an annotated local tag on HEAD satisfies local authority');
  assert.equal(localOnlyTag.remoteAuthoritative, false, 'an unpushed annotated tag must not satisfy remote authority');
  await git(template, 'push', 'origin', 'v1.0.1');
  const released = await readTemplateSource(template, managedFiles, { verifyRemoteTag: true });
  assert.equal(released.authoritative, true, 'an annotated local version tag on HEAD satisfies local authority');
  assert.equal(released.remoteAuthoritative, true, 'the exact annotated tag object and commit must exist on the remote');
  return { template, remote };
}

async function testIgnoredArtifactsAndRepositoryScopedSync(root) {
  const { template } = await createRepositoryScopedTemplate(root);
  const templateEnv = { ...process.env, DEVRULES_TEMPLATE_ROOT: template };
  const releaseAudit = JSON.parse(await run(process.execPath, [CLI, 'template', 'release-audit', '--json'], {
    env: templateEnv,
  }));
  assert.equal(releaseAudit.status, 'pass', 'release audit must verify the published branch and exact annotated remote tag');
  assert.equal(releaseAudit.remoteVerification.ok, true);

  const releaseRulePath = path.join(template, 'rules', 'rule.md');
  const releaseRule = await fs.readFile(releaseRulePath);
  await write(releaseRulePath, '# dirty release candidate\n');
  const dirtyReleaseAudit = await runExpectFailureJson(
    process.execPath,
    [CLI, 'template', 'release-audit', '--json'],
    { env: templateEnv },
  );
  assert.equal(dirtyReleaseAudit.status, 'fail');
  assert.equal(dirtyReleaseAudit.issues.some((issue) => issue.code === 'dirty'), true, 'release audit must reject a dirty template');
  await fs.writeFile(releaseRulePath, releaseRule);

  const beforeFiles = await collectManagedTemplateFiles(template, TEMPLATE_SYNC_DIRS, TEMPLATE_SYNC_ROOT_FILES);
  assert.equal(beforeFiles.some((file) => file.relPath === 'rules/tracked-ignored.md'), true, 'tracked files remain managed even when a later ignore rule matches them');
  const beforeSource = await readTemplateSource(template, beforeFiles);
  assert.equal(beforeSource.authoritative, true, 'published fixture must be authoritative before adding ignored metadata');

  await write(path.join(template, 'rules', 'untracked-review.md'), '# untracked review\n');
  const withUntracked = await collectManagedTemplateFiles(template, TEMPLATE_SYNC_DIRS, TEMPLATE_SYNC_ROOT_FILES);
  assert.equal(withUntracked.some((file) => file.relPath === 'rules/untracked-review.md'), true, 'untracked non-ignored files must enter the managed review set');
  await fs.rm(path.join(template, 'rules', 'untracked-review.md'));

  const ignoredArtifacts = [
    'rules/._rule.md',
    'rules/.DS_Store',
    'rules/Thumbs.db',
  ];
  for (const relPath of ignoredArtifacts) await write(path.join(template, relPath), `ignored ${relPath}\n`);
  assert.equal(await git(template, 'status', '--porcelain=v1'), '', 'ignored metadata must not dirty Git authority');

  const afterFiles = await collectManagedTemplateFiles(template, TEMPLATE_SYNC_DIRS, TEMPLATE_SYNC_ROOT_FILES);
  const afterSource = await readTemplateSource(template, afterFiles);
  assert.deepEqual(afterFiles.map((file) => file.relPath), beforeFiles.map((file) => file.relPath), 'ignored metadata must not enter the managed set');
  assert.equal(afterSource.manifestHash, beforeSource.manifestHash, 'ignored metadata must not change the managed manifest hash');
  assert.equal(afterSource.authoritative, true, 'ignored metadata must not weaken an otherwise published source');

  const initTarget = path.join(root, 'initialization-target');
  await fs.mkdir(initTarget, { recursive: true });
  await git(initTarget, 'init', '-b', 'main');
  await configureRepository(initTarget);
  await write(path.join(initTarget, 'package.json'), '{"name":"initialization-target","private":true}\n');
  await commitAll(initTarget, 'initialize target for init filtering');
  await run(process.execPath, [CLI, 'init', '--repo', initTarget, '--maturity', '2', '--apply', '--json'], { env: templateEnv });
  for (const relPath of ignoredArtifacts) {
    assert.equal(await exists(path.join(initTarget, 'devrules', relPath)), false, `initial init must not copy ${relPath}`);
  }

  const target = path.join(root, 'repository-scoped-target');
  const sibling = path.join(root, 'repository-scoped-sibling');
  const unadopted = path.join(root, 'repository-scoped-unadopted');
  await fs.mkdir(path.join(target, 'devrules', 'hooks'), { recursive: true });
  await fs.mkdir(path.join(target, 'docs'), { recursive: true });
  await fs.mkdir(sibling, { recursive: true });
  await git(target, 'init', '-b', 'main');
  await configureRepository(target);
  await fs.mkdir(unadopted, { recursive: true });
  await git(unadopted, 'init', '-b', 'main');
  await configureRepository(unadopted);
  await write(path.join(unadopted, 'README.md'), '# unadopted\n');
  await commitAll(unadopted, 'initialize unadopted repository');
  await assert.rejects(
    run(process.execPath, [CLI, 'repo', 'sync-template', '--repo', unadopted, '--apply', '--json'], { env: templateEnv }),
    /not an adopted devrules repository/,
  );
  assert.equal(await exists(path.join(unadopted, 'devrules')), false, 'rejected unadopted targets must receive zero files');
  const preservedContent = {
    'AGENTS.md': '# Existing AGENTS\n\nHuman-owned instructions.\n',
    'docs/product.md': '# Product documentation\n',
    'devrules/always-readme.md': '# template 1\n',
    'devrules/manifest.json': '{"schemaVersion":1,"projectId":"keep-project-identity"}\n',
    'devrules/config.json': '{"schemaVersion":1,"projectIdentity":"keep-config"}\n',
    'devrules/hooks/hooks.local.json': '{"schemaVersion":1,"hooks":[{"id":"project-only","scope":"local"}]}\n',
  };
  for (const [relPath, content] of Object.entries(preservedContent)) await write(path.join(target, relPath), content);
  await write(path.join(sibling, 'sentinel.txt'), 'sibling must remain untouched\n');
  await commitAll(target, 'initialize adopted repository identity');
  await assert.rejects(
    run(process.execPath, [CLI, 'repo', 'sync-template', '--repo', path.join(target, 'docs'), '--apply', '--json'], { env: templateEnv }),
    /exact root of a Git working tree/,
  );
  assert.equal(await exists(path.join(target, 'docs', 'devrules')), false, 'rejected nested targets must receive zero files');
  const outside = path.join(root, 'repository-scoped-outside');
  const linkedRules = path.join(target, 'devrules', 'rules');
  await fs.mkdir(outside, { recursive: true });
  await write(path.join(outside, 'sentinel.txt'), 'outside must remain untouched\n');
  await fs.symlink(outside, linkedRules, process.platform === 'win32' ? 'junction' : 'dir');
  const outsideBefore = await expectFileSet(outside, ['sentinel.txt', 'rule.md']);
  await assert.rejects(
    run(process.execPath, [CLI, 'repo', 'sync-template', '--repo', target, '--apply', '--json'], { env: templateEnv }),
    /symlinked parent/,
  );
  assert.deepEqual(await expectFileSet(outside, Object.keys(outsideBefore)), outsideBefore, 'symlinked managed parents must not write outside the selected repository');
  await fs.rm(linkedRules);
  const preservedPaths = Object.keys(preservedContent);
  const preservedBefore = await expectFileSet(target, preservedPaths);
  const siblingBefore = await read(path.join(sibling, 'sentinel.txt'));

  const dryRun = JSON.parse(await run(process.execPath, [CLI, 'repo', 'sync-template', '--repo', target, '--json'], { env: templateEnv }));
  assert.equal(dryRun.apply, false);
  assert.equal(dryRun.applied, false);
  assert.equal(dryRun.blocked, false);
  assert.equal(dryRun.actions.some((action) => action.action === 'copy'), true, 'single-repository dry-run should expose the transactional copy plan');
  assert.equal(await exists(path.join(target, 'devrules', 'rules', 'rule.md')), false, 'dry-run must not copy managed files');
  assert.equal(await exists(path.join(target, 'devrules', '.template-sync.json')), false, 'dry-run must not create sync state');
  assert.deepEqual(await expectFileSet(target, preservedPaths), preservedBefore, 'dry-run must preserve project identity and human files');

  const applied = JSON.parse(await run(process.execPath, [CLI, 'repo', 'sync-template', '--repo', target, '--apply', '--json'], { env: templateEnv }));
  assert.equal(applied.apply, true);
  assert.equal(applied.applied, true);
  assert.equal(applied.blocked, false);
  assert.equal(await read(path.join(target, 'devrules', 'rules', 'rule.md')), '# rule 1\n');
  const state = JSON.parse(await read(path.join(target, 'devrules', '.template-sync.json')));
  assert.equal(state.source.templateId, 'selftest/devrules');
  assert.equal(state.source.version, '1.0.1');
  assert.equal(state.source.revision, 1);
  assert.equal(state.source.commit, await git(template, 'rev-parse', 'HEAD'));
  assert.equal(Boolean(state.files['hooks/hooks.local.json']), false, 'project-local hook overlays must never enter template state');
  const identityPaths = preservedPaths.filter((relPath) => relPath !== 'AGENTS.md');
  assert.deepEqual(
    await expectFileSet(target, identityPaths),
    Object.fromEntries(Object.entries(preservedBefore).filter(([relPath]) => relPath !== 'AGENTS.md')),
    'apply must preserve project identity, local hooks, and docs',
  );
  const agentsAfter = await read(path.join(target, 'AGENTS.md'));
  assert.match(agentsAfter, /^# Existing AGENTS/m, 'entry refresh must preserve the existing AGENTS heading');
  assert.match(agentsAfter, /Human-owned instructions\./, 'entry refresh must preserve human-owned AGENTS content');
  assert.equal((agentsAfter.match(/DEVRULES:ENTRY-START/g) || []).length, 1, 'entry refresh must add exactly one managed block');
  assert.equal(
    await exists(path.join(target, '.cursor/rules/devrules.mdc')),
    false,
    'template sync must not materialize a Cursor entry when the project did not select Cursor',
  );
  assert.equal(await read(path.join(sibling, 'sentinel.txt')), siblingBefore, 'repo sync-template must not scan or mutate siblings');
  for (const relPath of ignoredArtifacts) {
    assert.equal(await exists(path.join(target, 'devrules', relPath)), false, `repository sync must not copy ${relPath}`);
    assert.equal(Boolean(state.files[relPath]), false, `sync state must not record ${relPath}`);
  }

  const noOp = JSON.parse(await run(process.execPath, [CLI, 'repo', 'sync-template', '--repo', target, '--json'], { env: templateEnv }));
  assert.equal(noOp.blocked, false);
  assert.equal(noOp.actions.some((action) => ['copy', 'delete', 'write'].includes(action.action)), false, 'repeat single-repository sync must be a true no-op');

  await write(path.join(target, 'src', 'index.mjs'), 'export const ready = true;\n');
  await run(process.execPath, [CLI, 'init', '--repo', target, '--maturity', '3', '--apply', '--json'], { env: templateEnv });
  await commitAll(target, 'prepare adopted repository for batch sync coverage');

  await write(path.join(target, 'devrules', 'rules', 'rule.md'), '# project-local rule\n');
  await publishTemplate(template, 2, {
    'always-readme.md': '# template 2\n',
    'rules/rule.md': '# rule 2\n',
  });
  const zeroWritePaths = [
    ...preservedPaths,
    'devrules/always-readme.md',
    'devrules/rules/rule.md',
    'devrules/template.json',
    'devrules/CHANGELOG.md',
    'devrules/scripts/devrules.mjs',
    'devrules/hooks/hooks.json',
    'devrules/.template-sync.json',
  ];
  const beforeConflict = await expectFileSet(target, zeroWritePaths);
  const conflict = await runExpectFailureJson(
    process.execPath,
    [CLI, 'repo', 'sync-template', '--repo', target, '--apply', '--json'],
    { env: templateEnv },
  );
  assert.equal(conflict.blocked, true);
  assert.equal(conflict.applied, false);
  assert.equal(conflict.conflicts.some((item) => item.templatePath === 'rules/rule.md'), true);
  assert.deepEqual(await expectFileSet(target, zeroWritePaths), beforeConflict, 'one conflict must leave all managed, identity, local-hook, docs, AGENTS, and state bytes unchanged');
  assert.equal(await read(path.join(sibling, 'sentinel.txt')), siblingBefore, 'blocked repository sync must not inspect or mutate siblings');

  const batchConflict = await runExpectFailureJson(
    process.execPath,
    [CLI, 'batch', 'sync-template', '--root', root, '--apply', '--json'],
    { env: templateEnv },
  );
  assert.equal(batchConflict.blockedCount > 0, true, 'batch sync must report blocked repositories');

  const workspaceConflict = await runExpectFailureJson(
    process.execPath,
    [CLI, 'workspace', 'sync-template', '--root', root, '--current-only', '--apply', '--json'],
    { env: templateEnv },
  );
  assert.equal(workspaceConflict.status, 'blocked', 'workspace sync must not report pass when a repository is blocked');
  assert.equal(workspaceConflict.blockedCount > 0, true, 'workspace sync must report blocked repositories');
}

async function testTemplateSynchronization(root) {
  const template = path.join(root, 'template');
  const target = path.join(root, 'target');
  const remote = path.join(root, 'template.git');
  await fs.mkdir(template, { recursive: true });
  await fs.mkdir(target, { recursive: true });
  await run('git', ['init', '--bare', remote]);
  await git(template, 'init', '-b', 'main');
  await configureRepository(template);
  await setTemplateRevision(template, 1, {
    'always-readme.md': '# template 1\n',
    'rules/rule.md': '# rule 1\n',
    'workflows/flow.md': '# flow 1\n',
    'hooks/hooks.json': '{"schemaVersion":1,"hooks":[]}\n',
  }, remote);
  await commitAll(template, 'template revision 1');
  await tagTemplateRevision(template, 1);
  await git(template, 'remote', 'add', 'origin', remote);
  await git(template, 'push', '-u', 'origin', 'main', '--follow-tags');

  await git(target, 'init', '-b', 'main');
  await configureRepository(target);
  await write(path.join(target, 'README.md'), '# target\n');
  await commitAll(target, 'initialize target');

  const initial = await syncTemplateRepository(syncOptions(template, target));
  assert.equal(initial.applied, true, `initial authoritative sync should apply:\n${JSON.stringify(initial, null, 2)}`);
  assert.equal(await read(path.join(target, 'devrules/rules/rule.md')), '# rule 1\n');
  const recoveryPreview = await recoverTemplateSyncTransaction(target, initial.transaction.id, false);
  assert.equal(recoveryPreview.previousStatus, 'completed');
  assert.equal(recoveryPreview.entryCount > 0, true);
  const recovered = await recoverTemplateSyncTransaction(target, initial.transaction.id, true);
  assert.equal(recovered.status, 'recovered');
  await assert.rejects(read(path.join(target, 'devrules/rules/rule.md')), /ENOENT/, 'manual recovery should restore the pre-sync absence');
  assert.equal((await syncTemplateRepository(syncOptions(template, target))).applied, true, 'sync should be repeatable after manual recovery');
  await commitAll(target, 'apply template revision 1');

  const idempotent = await syncTemplateRepository(syncOptions(template, target, false));
  assert.equal(idempotent.blocked, false);
  assert.equal(idempotent.actions.some((action) => ['copy', 'delete', 'write'].includes(action.action)), false, 'current template sync must be a true no-op');

  await publishTemplate(template, 2, {
    'always-readme.md': '# template 2\n',
    'rules/rule.md': '# rule 2\n',
  });
  const targetGitDir = await resolveGitDirectory(target);
  const syncLockPath = path.join(targetGitDir, 'devrules-sync', '.sync.lock');
  let releaseSyncLock;
  const syncLockGate = new Promise((resolve) => { releaseSyncLock = resolve; });
  const syncLockHolder = withFileLock(syncLockPath, async () => syncLockGate);
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (await exists(syncLockPath)) break;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  const beforeConcurrentApply = await expectFileSet(target, [
    'devrules/always-readme.md',
    'devrules/rules/rule.md',
    'devrules/.template-sync.json',
  ]);
  await assert.rejects(syncTemplateRepository(syncOptions(template, target)), /another devrules operation holds lock/);
  assert.deepEqual(
    await expectFileSet(target, Object.keys(beforeConcurrentApply)),
    beforeConcurrentApply,
    'a competing template sync must be rejected before planning or writes',
  );
  releaseSyncLock();
  await syncLockHolder;
  await write(syncLockPath, `${JSON.stringify({ schemaVersion: 2, token: '01234567-89ab-cdef-0123-456789abcdef',
    pid: 2_147_483_647, createdAt: new Date().toISOString() })}\n`);
  assert.equal((await syncTemplateRepository(syncOptions(template, target))).applied, true);
  assert.equal(await exists(syncLockPath), false, 'a dead owner sync lock is recovered only after ownership is revalidated');
  await commitAll(target, 'apply template revision 2');

  await publishTemplate(template, 2, { 'rules/rule.md': '# mutable revision\n' }, 'mutate revision 2');
  const mutableRevision = await syncTemplateRepository({ ...syncOptions(template, target), allowMutableRevision: true });
  assert.equal(mutableRevision.blocked, true, 'changed content at the same revision must be blocked');
  assert.match(mutableRevision.transitionErrors.join('\n'), /without a revision bump/);

  await publishTemplate(template, 3, { 'rules/rule.md': '# rule 3\n' });
  assert.equal((await syncTemplateRepository(syncOptions(template, target))).applied, true);
  await commitAll(target, 'apply template revision 3');

  const beforeDowngrade = await expectFileSet(target, ['devrules/rules/rule.md', 'devrules/.template-sync.json']);
  await publishTemplate(template, 2, { 'rules/rule.md': '# downgrade attempt\n' }, 'attempt downgrade');
  const downgrade = await syncTemplateRepository({ ...syncOptions(template, target), allowDowngrade: true });
  assert.equal(downgrade.blocked, true, 'downgrade must be blocked');
  assert.match(downgrade.transitionErrors.join('\n'), /downgrade blocked/);
  assert.deepEqual(await expectFileSet(target, Object.keys(beforeDowngrade)), beforeDowngrade, 'blocked downgrade must write nothing');

  await publishTemplate(template, 4, {
    'always-readme.md': '# template 4\n',
    'rules/rule.md': '# rule 4\n',
  });
  assert.equal((await syncTemplateRepository(syncOptions(template, target))).applied, true);
  await commitAll(target, 'apply template revision 4');

  await publishTemplate(template, 5, {
    'always-readme.md': '# template 5\n',
    'rules/rule.md': '# rule 5\n',
  });
  await write(path.join(target, 'devrules/rules/rule.md'), '# project-local edit\n');
  const beforeConflict = await expectFileSet(target, [
    'devrules/always-readme.md',
    'devrules/rules/rule.md',
    'devrules/.template-sync.json',
  ]);
  const conflict = await syncTemplateRepository(syncOptions(template, target));
  assert.equal(conflict.blocked, true, 'one conflict must block the whole repository plan');
  assert.deepEqual(await expectFileSet(target, Object.keys(beforeConflict)), beforeConflict, 'conflict plan must write nothing, including unrelated files and state');

  await write(path.join(target, 'devrules/rules/rule.md'), '# rule 4\n');
  assert.equal((await syncTemplateRepository(syncOptions(template, target))).applied, true);
  await commitAll(target, 'apply template revision 5');

  await fs.rm(path.join(template, 'workflows/flow.md'));
  await setTemplateRevision(template, 6, {});
  await commitAll(template, 'template revision 6 removes flow');
  await tagTemplateRevision(template, 6);
  await git(template, 'push', '--follow-tags');
  await write(path.join(target, 'devrules/workflows/flow.md'), '# project-local flow\n');
  const deletionConflictState = await read(path.join(target, 'devrules/.template-sync.json'));
  const deletionConflict = await syncTemplateRepository(syncOptions(template, target));
  assert.equal(deletionConflict.blocked, true, 'source deletion must not remove a locally modified target file');
  assert.equal(await read(path.join(target, 'devrules/workflows/flow.md')), '# project-local flow\n');
  assert.equal(await read(path.join(target, 'devrules/.template-sync.json')), deletionConflictState, 'deletion conflict must not update sync state');
  await write(path.join(target, 'devrules/workflows/flow.md'), '# flow 1\n');
  assert.equal((await syncTemplateRepository(syncOptions(template, target))).applied, true);
  await assert.rejects(read(path.join(target, 'devrules/workflows/flow.md')), /ENOENT/, 'unchanged source deletion should propagate');
  await commitAll(target, 'apply template revision 6');

  await publishTemplate(template, 7, {
    'always-readme.md': '# template 7\n',
    'rules/rule.md': '# rule 7\n',
    'hooks/hooks.json': '{"schemaVersion":1,"hooks":[{"id":"revision-7"}]}\n',
  });
  const rollbackPaths = [
    'devrules/always-readme.md',
    'devrules/rules/rule.md',
    'devrules/hooks/hooks.json',
    'devrules/.template-sync.json',
  ];
  const beforeRollback = await expectFileSet(target, rollbackPaths);
  process.env.DEVRULES_TEST_FAIL_AFTER_OPERATIONS = '1';
  await assert.rejects(
    syncTemplateRepository(syncOptions(template, target)),
    /was rolled back/,
    'injected partial failure should report automatic rollback',
  );
  delete process.env.DEVRULES_TEST_FAIL_AFTER_OPERATIONS;
  assert.deepEqual(await expectFileSet(target, rollbackPaths), beforeRollback, 'rollback must restore every file and sync state byte-for-byte');

  await write(path.join(template, 'uncommitted.txt'), 'dirty\n');
  const dirtySource = await syncTemplateRepository({ ...syncOptions(template, target), allowDirtyTemplate: true });
  assert.equal(dirtySource.blocked, true, 'dirty template authority must be blocked');
  assert.match(dirtySource.transitionErrors.join('\n'), /worktree is dirty/);
  await fs.rm(path.join(template, 'uncommitted.txt'));

  const origin = await git(template, 'config', '--get', 'remote.origin.url');
  await git(template, 'remote', 'remove', 'origin');
  await setTemplateRevision(template, 8, {}, origin);
  await commitAll(template, 'declared remote without configured origin');
  const declarationOnly = await syncTemplateRepository(syncOptions(template, target));
  assert.equal(declarationOnly.blocked, true, 'a manifest declaration must not replace an actual configured Git remote');
  assert.match(declarationOnly.transitionErrors.join('\n'), /no configured remote authority/);
  await git(template, 'remote', 'add', 'origin', origin);
  await git(template, 'fetch', 'origin');
  await git(template, 'branch', '--set-upstream-to=origin/main', 'main');
  const unpublished = await syncTemplateRepository(syncOptions(template, target));
  assert.equal(unpublished.blocked, true, 'an unpushed template commit must not become source authority');
  assert.match(unpublished.transitionErrors.join('\n'), /not published to its upstream/);
  await git(template, 'push', '-u', 'origin', 'main');

  return template;
}

async function testGitHandoff(template) {
  const ready = await inspectGitRepository(template, { fetch: true });
  assert.equal(ready.state, 'ready');
  assert.equal(ready.head, ready.upstreamSha);

  const trackedPath = path.join(template, 'always-readme.md');
  const trackedContent = await read(trackedPath);
  await write(trackedPath, `${trackedContent.trimEnd()}\n\nworktree-only change\n`);
  const worktreeOnly = await inspectGitRepository(template, { fetch: true });
  assert.deepEqual(
    worktreeOnly.changes,
    [{ status: ' M', path: 'always-readme.md' }],
    'porcelain parsing must preserve a worktree-only status and the complete path',
  );
  await write(trackedPath, trackedContent);

  await write(trackedPath, `${trackedContent.trimEnd()}\n\nstaged-only change\n`);
  await git(template, 'add', 'always-readme.md');
  const stagedOnly = await inspectGitRepository(template, { fetch: true });
  assert.deepEqual(
    stagedOnly.changes,
    [{ status: 'M ', path: 'always-readme.md' }],
    'porcelain parsing must preserve a staged-only status and the complete path',
  );
  await write(trackedPath, trackedContent);
  await git(template, 'add', 'always-readme.md');

  const renamedPath = path.join(template, 'always-readme-renamed.md');
  await git(template, 'mv', 'always-readme.md', 'always-readme-renamed.md');
  const renamed = await inspectGitRepository(template, { fetch: true });
  assert.deepEqual(
    renamed.changes,
    [{ status: 'R ', path: 'always-readme-renamed.md', originalPath: 'always-readme.md' }],
    'one NUL-delimited rename must remain one change with both paths',
  );
  await git(template, 'mv', path.basename(renamedPath), 'always-readme.md');

  await write(path.join(template, 'scratch.txt'), 'dirty\n');
  assert.equal((await inspectGitRepository(template, { fetch: true })).state, 'blocked');
  await fs.rm(path.join(template, 'scratch.txt'));

  await write(path.join(template, 'ahead.txt'), 'ahead\n');
  await commitAll(template, 'local commit awaiting push');
  const ahead = await inspectGitRepository(template, { fetch: true });
  assert.equal(ahead.state, 'handoff-required');
  assert.equal((await createHandoffRecord(template, { fetch: true })).ready, false, 'unpushed commit cannot be handed off');
  await git(template, 'push');

  const handoff = await createHandoffRecord(template, { fetch: true, deviceId: 'selftest-device' });
  assert.equal(handoff.ready, true);
  assert.equal(handoff.commit, handoff.upstreamCommit);
  assert.match(handoff.nextDeviceCommand, new RegExp(handoff.commit));
  assert.equal((await inspectGitRepository(template, { fetch: true, expectedSha: '0'.repeat(40) })).state, 'blocked');

  const origin = await git(template, 'config', '--get', 'remote.origin.url');
  const peer = path.join(path.dirname(template), 'peer');
  await run('git', ['clone', '--branch', 'main', origin, peer]);
  await configureRepository(peer);
  await write(path.join(peer, 'remote-ahead.txt'), 'remote ahead\n');
  await commitAll(peer, 'remote advances main');
  await git(peer, 'push');
  const behind = await inspectGitRepository(template, { fetch: true });
  assert.equal(behind.state, 'blocked');
  assert.equal(behind.behind, 1);
  assert.equal(behind.ahead, 0);

  await write(path.join(template, 'local-divergence.txt'), 'local divergence\n');
  await commitAll(template, 'local diverges from fetched upstream');
  const diverged = await inspectGitRepository(template, { fetch: true });
  assert.equal(diverged.state, 'blocked');
  assert.equal(diverged.ahead, 1);
  assert.equal(diverged.behind, 1);
  assert.match(diverged.reasons.join('\n'), /branch diverged/);
}

async function testHookRegistrySplit(root) {
  const repo = path.join(root, 'node-project');
  await fs.mkdir(repo, { recursive: true });
  await git(repo, 'init', '-b', 'main');
  await configureRepository(repo);
  await write(path.join(repo, 'package.json'), '{"name":"hook-selftest","private":true}\n');
  await commitAll(repo, 'initialize node project');
  await run(process.execPath, [CLI, 'init', '--repo', repo, '--apply']);
  const shared = JSON.parse(await read(path.join(repo, 'devrules/hooks/hooks.json')));
  const local = JSON.parse(await read(path.join(repo, 'devrules/hooks/hooks.local.json')));
  assert.equal(shared.hooks.some((hook) => hook.ownership === 'local'), false, 'shared hook registry must not contain local hooks');
  assert.equal(local.hooks.every((hook) => hook.ownership === 'local'), true);
  assert.equal(local.hooks.some((hook) => hook.id === 'node-package-change'), true, 'stack-specific hooks belong in the local overlay');

  const sentinel = `${JSON.stringify({
    schemaVersion: 3,
    hooks: [{
      id: 'project-only',
      ownership: 'local',
      governs: 'agent',
      activation: 'explicit',
      enforcement: 'advisory',
      decision_owner: 'project',
      side_effects: 'local',
      read: [],
      run: [],
      workflows: [],
    }],
  }, null, 2)}\n`;
  await write(path.join(repo, 'devrules/hooks/hooks.local.json'), sentinel);
  await run(process.execPath, [CLI, 'init', '--repo', repo, '--apply']);
  assert.equal(await read(path.join(repo, 'devrules/hooks/hooks.local.json')), sentinel, 'repeat initialization must preserve the local overlay');

  const workspaceStatus = JSON.parse(await run(process.execPath, [CLI, 'workspace', 'git-status', '--root', repo, '--json']));
  assert.equal(workspaceStatus.summary.total, 1, 'workspace git-status must include a Git repository passed as the root itself');
  assert.equal(workspaceStatus.results[0].repo, repo);
}

async function testFileLock(root) {
  const lockPath = path.join(root, 'registry', '.refresh.lock');
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const holder = withFileLock(lockPath, async () => gate);
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (await fs.stat(lockPath).then(() => true).catch(() => false)) break;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  await assert.rejects(withFileLock(lockPath, async () => {}), /another devrules operation holds lock/);
  release();
  await holder;
  assert.equal(await fs.stat(lockPath).then(() => true).catch(() => false), false, 'lock file should be removed after completion');
}

async function testTemplateVersionIdentity(root) {
  const template = path.join(root, 'version-identity-template');
  await write(path.join(template, 'template.json'), `${JSON.stringify({
    schemaVersion: 1,
    templateId: 'selftest/version-identity',
    version: '2.3.0',
    revision: 11,
    sourceRepository: 'https://example.invalid/selftest/devrules',
  }, null, 2)}\n`);
  await write(path.join(template, 'scripts', 'devrules.mjs'), "const VERSION = '2.3.1';\n");
  const mismatch = await readTemplateSource(template, []);
  assert.equal(mismatch.manifestValid, true, 'a valid semantic template version should parse');
  assert.equal(mismatch.versionMatchesTool, false, 'template and CLI version mismatch must be detected');
  assert.equal(mismatch.versionMatchesChangelog, false, 'missing changelog release must be detected');
  assert.equal(mismatch.authoritative, false, 'version mismatch cannot be authoritative');
  assert.deepEqual(templateLocalAuditIssues(mismatch), [], 'local content audit must not treat release version alignment as a working-tree error');
  assert.equal(
    templateReleaseAuditIssues(mismatch).some((issue) => issue.code === 'tool-version'),
    true,
    'release audit must retain version alignment as a release gate',
  );

  await write(path.join(template, 'scripts', 'devrules.mjs'), "const VERSION = '2.3.0';\n");
  const match = await readTemplateSource(template, []);
  assert.equal(match.versionMatchesTool, true, 'matching template and CLI versions should pass');

  await write(path.join(template, 'CHANGELOG.md'), '# Changelog\n\n## [2.2.0] - 2026-07-14\n');
  const staleChangelog = await readTemplateSource(template, []);
  assert.equal(staleChangelog.versionMatchesChangelog, false, 'stale changelog release must be detected');
  assert.equal(staleChangelog.authoritative, false, 'stale changelog cannot be authoritative');
  await write(path.join(template, 'CHANGELOG.md'), '# Changelog\n\n## [2.3.0] - 2026-07-14\n');
  const aligned = await readTemplateSource(template, []);
  assert.equal(aligned.versionMatchesChangelog, true, 'matching changelog release should pass');

  await write(path.join(template, 'template.json'), `${JSON.stringify({
    schemaVersion: 1,
    templateId: 'selftest/version-identity',
    version: '2.3',
    revision: 12,
    sourceRepository: 'https://example.invalid/selftest/devrules',
  }, null, 2)}\n`);
  const invalid = await readTemplateSource(template, []);
  assert.equal(invalid.manifestValid, false, 'non-SemVer template versions must be rejected');
  assert.equal(templateLocalAuditIssues(invalid).some((issue) => issue.code === 'manifest'), true, 'local audit must still enforce template schema');
}

async function testLocalAuditReleaseIsolation(root) {
  const template = path.join(root, 'unreleased-working-template');
  await fs.cp(SOURCE_TEMPLATE_ROOT, template, {
    recursive: true,
    filter(sourcePath) {
      const relPath = path.relative(SOURCE_TEMPLATE_ROOT, sourcePath).replaceAll('\\', '/');
      return relPath !== '.git'
        && !relPath.startsWith('.git/')
        && relPath !== '.codegraph'
        && !relPath.startsWith('.codegraph/');
    },
  });
  await git(template, 'init', '-b', 'main');

  const localAudit = JSON.parse(await run(process.execPath, [
    CLI,
    'audit',
    '--repo', template,
    '--strict',
    '--json',
  ]));
  assert.equal(localAudit.templateMode, true);
  assert.equal(localAudit.auditScope, 'local-content');
  assert.equal(localAudit.releaseStateChecked, false);
  assert.equal(localAudit.templateSource.contentView, 'working-tree');
  assert.equal(localAudit.templateSource.dirty, true, 'fixture must exercise a dirty working tree');
  assert.equal(localAudit.templateSource.commit, '', 'fixture must exercise a template with no release commit');
  assert.equal(localAudit.templateSource.remote, '', 'fixture must exercise offline local audit with no remote');
  assert.equal(localAudit.templateSource.tagAnnotated, false, 'fixture must exercise a template with no release tag');
  assert.equal(
    localAudit.issues.some((issue) => issue.severity === 'error'),
    false,
    'local strict audit must validate content without requiring release state',
  );

  const releaseAudit = await runExpectFailureJson(process.execPath, [
    CLI,
    'template',
    'release-audit',
    '--json',
  ], {
    env: { ...process.env, DEVRULES_TEMPLATE_ROOT: template },
  });
  const releaseCodes = new Set(releaseAudit.issues.map((issue) => issue.code));
  for (const code of ['fetch', 'commit', 'remote', 'upstream', 'tag-annotated', 'dirty']) {
    assert.equal(releaseCodes.has(code), true, `release audit must report ${code}`);
  }
}

async function main() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'devrules-sync-selftest-'));
  try {
    await testLocalAuditReleaseIsolation(root);
    await testTemplateVersionIdentity(root);
    await testNonGitMetadataFallback(root);
    await testIgnoredArtifactsAndRepositoryScopedSync(root);
    const template = await testTemplateSynchronization(root);
    await testGitHandoff(template);
    await testHookRegistrySplit(root);
    await testFileLock(root);
    console.log('devrules sync selftest: PASS');
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
