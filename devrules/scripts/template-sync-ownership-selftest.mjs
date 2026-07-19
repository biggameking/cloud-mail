#!/usr/bin/env node
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { exists } from './devrules-lib/selftest-utils.mjs';
import { syncTemplateRepository } from './devrules-lib/template-sync.mjs';
import {
  auditTemplateContent,
  formatTemplateContentAudit,
  templateContentAuditIssue,
} from './devrules-lib/template-content-audit.mjs';

const execFileAsync = promisify(execFile);

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

async function configureRepository(repo) {
  await git(repo, 'config', 'user.name', 'template ownership selftest');
  await git(repo, 'config', 'user.email', 'template-ownership@example.invalid');
}

async function commitAll(repo, message) {
  await git(repo, 'add', '-A');
  await git(repo, 'commit', '-m', message);
}

async function setTemplateRevision(template, remote, revision, files = {}) {
  const version = `1.0.${revision}`;
  await write(path.join(template, 'template.json'), `${JSON.stringify({
    schemaVersion: 1,
    templateId: 'selftest/template-ownership',
    version,
    revision,
    sourceRepository: remote,
  }, null, 2)}\n`);
  await write(path.join(template, 'scripts/devrules.mjs'), `const VERSION = '${version}';\n`);
  await write(path.join(template, 'CHANGELOG.md'), `# Changelog\n\n## [${version}] - 2026-07-15\n`);
  for (const [relPath, content] of Object.entries(files)) await write(path.join(template, relPath), content);
}

async function publishTemplate(template, remote, revision, files = {}) {
  await setTemplateRevision(template, remote, revision, files);
  await commitAll(template, `template revision ${revision}`);
  await git(template, 'tag', '-a', `v1.0.${revision}`, '-m', `v1.0.${revision}`);
  await git(template, 'push', '--follow-tags');
}

function syncOptions(template, target, options = {}) {
  return {
    repoPath: target,
    templateRoot: template,
    directoryNames: ['rules'],
    rootFiles: ['template.json', 'always-readme.md'],
    apply: true,
    ...options,
  };
}

function auditOptions(template, target) {
  return {
    repoPath: target,
    templateRoot: template,
    directoryNames: ['rules'],
    rootFiles: ['template.json', 'always-readme.md'],
  };
}

async function snapshot(repo, relPaths) {
  return Promise.all(relPaths.map(async (relPath) => [
    relPath,
    await fs.readFile(path.join(repo, relPath)).catch((error) => error?.code === 'ENOENT' ? null : Promise.reject(error)),
  ])).then(Object.fromEntries);
}

async function testLegacyStateMigrationAndProjectOwnership(root) {
  const template = path.join(root, 'template');
  const target = path.join(root, 'target');
  const remote = path.join(root, 'template.git');
  await fs.mkdir(template, { recursive: true });
  await fs.mkdir(path.join(target, 'devrules/rules'), { recursive: true });
  await run('git', ['init', '--bare', remote]);
  await git(template, 'init', '-b', 'main');
  await configureRepository(template);
  await git(template, 'remote', 'add', 'origin', remote);
  await setTemplateRevision(template, remote, 1, {
    'always-readme.md': '# template 1\n',
    'rules/adopted.md': '# source revision 1\n',
    'rules/divergent.md': '# source divergent\n',
  });
  await commitAll(template, 'template revision 1');
  await git(template, 'tag', '-a', 'v1.0.1', '-m', 'v1.0.1');
  await git(template, 'push', '-u', 'origin', 'main', '--follow-tags');

  await git(target, 'init', '-b', 'main');
  await configureRepository(target);
  await write(path.join(target, 'devrules/rules/adopted.md'), '# project-owned\n');
  await write(path.join(target, 'devrules/rules/divergent.md'), '# project divergent\n');
  await write(path.join(target, 'devrules/rules/legacy-extra.md'), '# legacy project file\n');
  await write(path.join(target, 'devrules/rules/._legacy.md'), 'appledouble metadata\n');
  const legacyState = {
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    files: {
      'rules/adopted.md': { sourceHash: 'a'.repeat(64), syncedHash: 'b'.repeat(64), syncedAt: new Date().toISOString() },
      'rules/legacy-extra.md': { sourceHash: 'c'.repeat(64), syncedHash: 'c'.repeat(64), syncedAt: new Date().toISOString() },
      'rules/._legacy.md': { sourceHash: 'd'.repeat(64), syncedHash: 'd'.repeat(64), syncedAt: new Date().toISOString() },
    },
  };
  await write(path.join(target, 'devrules/.template-sync.json'), `${JSON.stringify(legacyState, null, 2)}\n`);
  await commitAll(target, 'initialize legacy devrules state');

  const protectedPaths = [
    'devrules/.template-sync.json',
    'devrules/rules/adopted.md',
    'devrules/rules/divergent.md',
    'devrules/rules/legacy-extra.md',
    'devrules/rules/._legacy.md',
  ];
  const beforeBlocked = await snapshot(target, protectedPaths);
  const blocked = await syncTemplateRepository(syncOptions(template, target));
  assert.equal(blocked.blocked, true, 'legacy state without source provenance must fail closed');
  assert.match(blocked.transitionErrors.join('\n'), /invalid template sync state/);
  assert.deepEqual(await snapshot(target, protectedPaths), beforeBlocked, 'ordinary legacy sync must write zero target bytes');
  const blockedAudit = await auditTemplateContent(auditOptions(template, target));
  assert.equal(blockedAudit.status, 'blocked', 'template content audit must fail closed when sync-state provenance is untrusted');
  assert.equal(templateContentAuditIssue(blockedAudit).severity, 'error');

  const migrated = await syncTemplateRepository(syncOptions(template, target, { adoptCurrentBaseline: true }));
  assert.equal(migrated.applied, true, 'explicit adopt must safely rebuild legacy state');
  assert.equal(await read(path.join(target, 'devrules/rules/adopted.md')), '# project-owned\n');
  assert.equal(await read(path.join(target, 'devrules/rules/divergent.md')), '# project divergent\n');
  assert.equal(await read(path.join(target, 'devrules/rules/legacy-extra.md')), '# legacy project file\n');
  assert.equal(await read(path.join(target, 'devrules/rules/._legacy.md')), 'appledouble metadata\n');
  let state = JSON.parse(await read(path.join(target, 'devrules/.template-sync.json')));
  assert.equal(state.schemaVersion, 4);
  assert.equal(state.files['rules/adopted.md'].ownership, 'project');
  assert.equal(state.files['rules/divergent.md'].ownership, 'project');
  assert.equal(state.files['rules/legacy-extra.md'], undefined);
  const currentAudit = await auditTemplateContent(auditOptions(template, target));
  assert.equal(currentAudit.status, 'current', 'template content audit must accept a current instance with protected project-owned files');
  assert.match(formatTemplateContentAudit(currentAudit)[0], /CURRENT$/);

  await fs.rm(path.join(target, 'devrules/always-readme.md'));
  const conflictAudit = await auditTemplateContent(auditOptions(template, target));
  assert.equal(conflictAudit.status, 'conflict', 'template content audit must expose local changes to template-owned files before the adoption audit');
  assert.equal(conflictAudit.summary.conflictCount, 1);
  assert.equal(templateContentAuditIssue(conflictAudit).severity, 'error');
  const beforeDeletionConflict = await snapshot(target, [
    'devrules/.template-sync.json',
    'devrules/always-readme.md',
    'devrules/rules/adopted.md',
  ]);
  const deletionConflict = await syncTemplateRepository(syncOptions(template, target));
  assert.equal(deletionConflict.blocked, true, 'a project-local deletion of a template-owned file must conflict by default');
  assert.equal(deletionConflict.conflicts.some((entry) => entry.templatePath === 'always-readme.md'), true);
  assert.deepEqual(await snapshot(target, Object.keys(beforeDeletionConflict)), beforeDeletionConflict, 'local deletion conflict must write zero target bytes');
  const adoptedDeletion = await syncTemplateRepository(syncOptions(template, target, { adoptCurrentBaseline: true }));
  assert.equal(adoptedDeletion.applied, true);
  assert.equal(await exists(path.join(target, 'devrules/always-readme.md')), false);
  state = JSON.parse(await read(path.join(target, 'devrules/.template-sync.json')));
  assert.equal(state.files['always-readme.md'].ownership, 'project');
  assert.equal(state.files['always-readme.md'].targetPresence, 'absent');

  await publishTemplate(template, remote, 2, {
    'always-readme.md': '# template 2\n',
    'rules/adopted.md': '# project-owned\n',
    'rules/divergent.md': '# source divergent 2\n',
  });
  const updateAudit = await auditTemplateContent(auditOptions(template, target));
  assert.equal(updateAudit.status, 'update-available', 'template content audit must expose published template changes before synchronization');
  assert.ok(updateAudit.summary.contentChangeCount > 0);
  assert.equal(templateContentAuditIssue(updateAudit).severity, 'warn');
  assert.equal((await syncTemplateRepository(syncOptions(template, target))).applied, true);
  assert.equal(await exists(path.join(target, 'devrules/always-readme.md')), false);
  state = JSON.parse(await read(path.join(target, 'devrules/.template-sync.json')));
  assert.equal(state.files['rules/adopted.md'].ownership, 'project');
  assert.equal(state.files['rules/divergent.md'].ownership, 'project');

  await fs.rm(path.join(template, 'rules/adopted.md'));
  await fs.rm(path.join(template, 'rules/divergent.md'));
  await publishTemplate(template, remote, 3, { 'always-readme.md': '# template 3\n' });
  assert.equal((await syncTemplateRepository(syncOptions(template, target))).applied, true);
  assert.equal(await read(path.join(target, 'devrules/rules/adopted.md')), '# project-owned\n');
  assert.equal(await read(path.join(target, 'devrules/rules/divergent.md')), '# project divergent\n');
  state = JSON.parse(await read(path.join(target, 'devrules/.template-sync.json')));
  assert.equal(state.removedFiles['rules/adopted.md'].ownership, 'project');
  assert.notEqual(state.removedFiles['rules/divergent.md'].sourceHash, state.removedFiles['rules/divergent.md'].syncedHash);

  await publishTemplate(template, remote, 4, {
    'always-readme.md': '# template 4\n',
    'rules/adopted.md': '# project-owned\n',
  });
  assert.equal((await syncTemplateRepository(syncOptions(template, target))).applied, true);
  assert.equal(await read(path.join(target, 'devrules/rules/divergent.md')), '# project divergent\n');
  state = JSON.parse(await read(path.join(target, 'devrules/.template-sync.json')));
  assert.equal(state.files['rules/adopted.md'].ownership, 'project');

  await fs.rm(path.join(template, 'rules/adopted.md'));
  await publishTemplate(template, remote, 5, { 'always-readme.md': '# template 5\n' });
  assert.equal((await syncTemplateRepository(syncOptions(template, target))).applied, true);
  assert.equal(await read(path.join(target, 'devrules/rules/adopted.md')), '# project-owned\n');
}

async function main() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'template-sync-ownership-selftest-'));
  try {
    await testLegacyStateMigrationAndProjectOwnership(root);
    process.stdout.write('template sync ownership selftest: PASS\n');
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}

main().catch((error) => {
  process.stderr.write(`template sync ownership selftest: FAIL\n${error.stack || error.message}\n`);
  process.exitCode = 1;
});
