#!/usr/bin/env node
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { resolveGitDirectory } from './devrules-lib/git-repository.mjs';
import {
  parseGitHubRepository,
  readGitHubReleaseTag,
} from './devrules-lib/github-release-tag-readback.mjs';
import { createRunExpectFailureJson } from './devrules-lib/selftest-utils.mjs';
import { withFileLock } from './devrules-lib/safe-files.mjs';
import {
  remoteIdentity,
  templateReleaseAuditIssues,
  templateRuntimeAuditIssues,
} from './devrules-lib/template-authority.mjs';
import {
  collectManagedTemplateFiles,
  readTemplateSource,
  recoverTemplateSyncTransaction,
  syncTemplateRepository,
} from './devrules-lib/template-sync.mjs';

const execFileAsync = promisify(execFile);
const CLI = path.join(path.dirname(fileURLToPath(import.meta.url)), 'devrules.mjs');
const DIRECTORIES = ['rules', 'scripts'];
const ROOT_FILES = ['template.json', 'CHANGELOG.md', 'always-readme.md'];

async function run(command, args, options = {}) {
  const result = await execFileAsync(command, args, {
    cwd: options.cwd,
    encoding: 'utf8',
    env: options.env || process.env,
    maxBuffer: 8 * 1024 * 1024,
    windowsHide: true,
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

async function stageGitSymlink(repo, relPath, targetText) {
  const payloadPath = path.join(repo, '.devrules-selftest-symlink-target');
  await fs.writeFile(payloadPath, targetText, 'utf8');
  const blob = await git(repo, 'hash-object', '-w', payloadPath);
  await fs.rm(payloadPath);
  await git(repo, 'update-index', '--add', '--cacheinfo', `120000,${blob},${relPath}`);
}

async function tryCreateFileSymlink(target, linkPath) {
  try {
    await fs.symlink(target, linkPath, 'file');
    return true;
  } catch (error) {
    if (process.platform === 'win32' && ['EPERM', 'EACCES', 'UNKNOWN'].includes(error?.code)) return false;
    throw error;
  }
}

async function configure(repo) {
  await git(repo, 'config', 'user.name', 'template authority selftest');
  await git(repo, 'config', 'user.email', 'template-authority@example.invalid');
}

async function writeRevision(repo, revision) {
  const version = `1.0.${revision}`;
  const sourceRepository = await git(repo, 'config', '--get', 'remote.origin.url');
  await write(path.join(repo, 'template.json'), `${JSON.stringify({
    schemaVersion: 1,
    templateId: 'selftest/template-authority',
    version,
    revision,
    sourceRepository,
  }, null, 2)}\n`);
  await write(path.join(repo, 'CHANGELOG.md'), `# Changelog\n\n## [${version}] - 2026-07-15\n`);
  await write(path.join(repo, 'scripts/devrules.mjs'), `const VERSION = '${version}';\n`);
  await write(path.join(repo, 'always-readme.md'), `# template ${revision}\n`);
  await write(path.join(repo, 'rules/rule.md'), `# rule ${revision}\n`);
}

async function publishRevision(repo, revision) {
  await writeRevision(repo, revision);
  await git(repo, 'add', '-A');
  await git(repo, 'commit', '-m', `template revision ${revision}`);
  await git(repo, 'tag', '-a', `v1.0.${revision}`, '-m', `v1.0.${revision}`);
  await git(repo, 'push', '--follow-tags');
}

function syncOptions(template, target, options = {}) {
  return {
    repoPath: target,
    templateRoot: template,
    directoryNames: DIRECTORIES,
    rootFiles: ROOT_FILES,
    apply: true,
    ...options,
  };
}

async function targetSnapshot(target) {
  const paths = [
    'devrules/.template-sync.json',
    'devrules/template.json',
    'devrules/CHANGELOG.md',
    'devrules/always-readme.md',
    'devrules/scripts/devrules.mjs',
    'devrules/rules/rule.md',
  ];
  return Promise.all(paths.map(async (relPath) => [
    relPath,
    await fs.readFile(path.join(target, relPath)).catch((error) => error?.code === 'ENOENT' ? null : Promise.reject(error)),
  ])).then(Object.fromEntries);
}

async function createFixture(root) {
  const remote = path.join(root, 'template.git');
  const template = path.join(root, 'template');
  const target = path.join(root, 'target');
  await run('git', ['init', '--bare', remote]);
  await fs.mkdir(template, { recursive: true });
  await git(template, 'init', '-b', 'main');
  await configure(template);
  await git(template, 'remote', 'add', 'origin', remote);
  await writeRevision(template, 1);
  await git(template, 'add', '-A');
  await git(template, 'commit', '-m', 'template revision 1');
  await git(template, 'tag', '-a', 'v1.0.1', '-m', 'v1.0.1');
  await git(template, 'push', '-u', 'origin', 'main', '--follow-tags');

  await fs.mkdir(path.join(target, 'devrules'), { recursive: true });
  await git(target, 'init', '-b', 'main');
  await configure(target);
  await write(path.join(target, 'devrules/always-readme.md'), '# template 1\n');
  await write(path.join(target, 'devrules/manifest.json'), '{"schemaVersion":1,"projectId":"authority-target"}\n');
  await git(target, 'add', '-A');
  await git(target, 'commit', '-m', 'initialize adopted target');
  const initial = await syncTemplateRepository(syncOptions(template, target));
  assert.equal(initial.applied, true);
  return { remote, template, target, initial };
}

function testRemoteIdentityBoundaries() {
  assert.notEqual(
    remoteIdentity('ssh://host.example:2222/Org/repo.git'),
    remoteIdentity('ssh://host.example:3333/Org/repo.git'),
    'non-default ports identify different Git authorities',
  );
  assert.notEqual(
    remoteIdentity('ssh://host.example/Org/repo.git'),
    remoteIdentity('ssh://host.example/org/repo.git'),
    'repository path case must remain authority-significant',
  );
  assert.notEqual(
    remoteIdentity('https://host.example/Org/repo.git?tenant=good'),
    remoteIdentity('https://host.example/Org/repo.git?tenant=evil'),
    'URL query parameters must remain authority-significant',
  );
  assert.notEqual(
    remoteIdentity('https://host.example/Org/repo.git#authority-one'),
    remoteIdentity('https://host.example/Org/repo.git#authority-two'),
    'URL fragments must remain authority-significant',
  );
  assert.equal(
    remoteIdentity('https://HOST.EXAMPLE/Org/repo.git/?tenant=good'),
    remoteIdentity('https://host.example/Org/repo?tenant=good'),
    'repository suffix normalization must not discard the query identity',
  );
  assert.equal(
    remoteIdentity('git@HOST.EXAMPLE:Org/repo.git'),
    'host.example/Org/repo',
    'scp-like remotes normalize only the host and transport syntax',
  );
}

async function testGitHubReleaseTagReadback() {
  assert.deepEqual(parseGitHubRepository('git@github.com:Example/Widget.git'), {
    owner: 'Example', repository: 'Widget',
  });
  assert.deepEqual(parseGitHubRepository('https://github.com/Example/Widget'), {
    owner: 'Example', repository: 'Widget',
  });
  assert.equal(parseGitHubRepository('https://github.example/Example/Widget.git'), null);
  assert.equal(parseGitHubRepository('https://github.com/Example/Widget/extra'), null);
  const tagObject = 'a'.repeat(40), tagCommit = 'b'.repeat(40);
  const requests = [];
  const result = await readGitHubReleaseTag('https://github.com/Example/Widget.git', 'v1.2.3', {
    credentialProvider: async () => 'credential-that-must-not-be-returned',
    requestJson: async (url) => {
      requests.push(url);
      return url.endsWith('/ref/tags/v1.2.3')
        ? { ref: 'refs/tags/v1.2.3', object: { type: 'tag', sha: tagObject } }
        : { sha: tagObject, tag: 'v1.2.3', object: { type: 'commit', sha: tagCommit } };
    },
  });
  assert.deepEqual(result, { ok: true, tagObject, tagCommit, transport: 'github-rest' });
  assert.equal(requests.length, 2);
  assert.doesNotMatch(JSON.stringify(result), /credential-that-must-not-be-returned/);
  let credentialRequested = false;
  const unsupported = await readGitHubReleaseTag('https://gitlab.example/Example/Widget.git', 'v1.2.3', {
    credentialProvider: async () => { credentialRequested = true; return 'unused'; },
  });
  assert.equal(unsupported.ok, false);
  assert.equal(credentialRequested, false, 'unsupported authorities must not request GitHub credentials');
  const lightweight = await readGitHubReleaseTag('https://github.com/Example/Widget.git', 'v1.2.3', {
    credentialProvider: async () => 'credential',
    requestJson: async () => ({ ref: 'refs/tags/v1.2.3', object: { type: 'commit', sha: tagCommit } }),
  });
  assert.equal(lightweight.ok, false, 'a lightweight remote tag must not satisfy annotated release authority');
}

async function testLockOwnership(root) {
  const lockPath = path.join(root, 'lock-ownership', '.lock');
  await write(lockPath, '{"schemaVersion":1,"pid":-1}\n');
  await fs.utimes(lockPath, new Date(0), new Date(0));
  await assert.rejects(
    withFileLock(lockPath, async () => {}),
    /another devrules operation holds lock/,
    'lock age alone must never authorize stale-lock takeover',
  );
  await fs.rm(lockPath);
  const replacement = '{"schemaVersion":2,"token":"new-owner"}\n';
  await withFileLock(lockPath, async () => {
    await fs.rm(lockPath);
    await write(lockPath, replacement);
  });
  assert.equal(await fs.readFile(lockPath, 'utf8'), replacement, 'an old holder must not unlink a replacement lock it does not own');
  await fs.rm(lockPath);
}

async function testSyncStatePathValidation(template, target) {
  const statePath = path.join(target, 'devrules/.template-sync.json');
  const originalState = await fs.readFile(statePath);
  const aliasState = JSON.parse(originalState.toString('utf8'));
  aliasState.files['rules//rule.md'] = { ...aliasState.files['rules/rule.md'] };
  await fs.writeFile(statePath, `${JSON.stringify(aliasState, null, 2)}\n`);
  const aliasBefore = await targetSnapshot(target);
  const aliasResult = await syncTemplateRepository(syncOptions(template, target));
  assert.equal(aliasResult.blocked, true, 'non-canonical sync-state aliases must block the complete plan');
  assert.match(aliasResult.transitionErrors.join('\n'), /non-canonical or unsafe path/);
  assert.deepEqual(await targetSnapshot(target), aliasBefore, 'state alias rejection must write zero target bytes');

  await fs.writeFile(statePath, originalState);
  const localConfigPath = path.join(target, 'devrules/config.json');
  const localConfig = Buffer.from('{"projectLocal":true}\n');
  await fs.writeFile(localConfigPath, localConfig);
  const outOfScopeState = JSON.parse(originalState.toString('utf8'));
  const localHash = crypto.createHash('sha256').update(localConfig).digest('hex');
  outOfScopeState.files['config.json'] = { sourceHash: localHash, syncedHash: localHash, syncedAt: new Date().toISOString() };
  await fs.writeFile(statePath, `${JSON.stringify(outOfScopeState, null, 2)}\n`);
  const scopeBefore = await targetSnapshot(target);
  const scopeResult = await syncTemplateRepository(syncOptions(template, target));
  assert.equal(scopeResult.blocked, true, 'out-of-scope sync-state baselines must not authorize deletion');
  assert.match(scopeResult.transitionErrors.join('\n'), /outside the managed template scope/);
  assert.deepEqual(await targetSnapshot(target), scopeBefore, 'out-of-scope state rejection must write zero managed bytes');
  assert.deepEqual(await fs.readFile(localConfigPath), localConfig, 'project-local devrules files must never be deleted through forged state');
  await fs.writeFile(statePath, originalState);

  const projectLocalPath = path.join(target, 'devrules/rules/project-local.md');
  const projectLocal = Buffer.from('# project local\n');
  await fs.writeFile(projectLocalPath, projectLocal);
  const injectedState = JSON.parse(originalState.toString('utf8'));
  const projectLocalHash = crypto.createHash('sha256').update(projectLocal).digest('hex');
  injectedState.files['rules/project-local.md'] = {
    sourceHash: projectLocalHash,
    syncedHash: projectLocalHash,
    targetPresence: 'present',
    ownership: 'template',
    syncedAt: new Date().toISOString(),
  };
  await fs.writeFile(statePath, `${JSON.stringify(injectedState, null, 2)}\n`);
  const injectedBefore = await targetSnapshot(target);
  const injectedResult = await syncTemplateRepository(syncOptions(template, target));
  assert.equal(injectedResult.blocked, true, 'a canonical in-scope path must not gain template ownership through state injection');
  assert.match(injectedResult.transitionErrors.join('\n'), /file set does not match/);
  assert.deepEqual(await targetSnapshot(target), injectedBefore, 'canonical state injection must write zero managed bytes');
  assert.deepEqual(await fs.readFile(projectLocalPath), projectLocal);
  await fs.rm(projectLocalPath);

  const rulePath = path.join(target, 'devrules/rules/rule.md');
  const originalRule = await fs.readFile(rulePath);
  const humanRule = Buffer.from('# human rule\n');
  await fs.writeFile(rulePath, humanRule);
  const forgedBaseline = JSON.parse(originalState.toString('utf8'));
  const humanHash = crypto.createHash('sha256').update(humanRule).digest('hex');
  forgedBaseline.files['rules/rule.md'] = {
    ...forgedBaseline.files['rules/rule.md'],
    sourceHash: humanHash,
    syncedHash: humanHash,
    ownership: 'template',
  };
  await fs.writeFile(statePath, `${JSON.stringify(forgedBaseline, null, 2)}\n`);
  const forgedBefore = await targetSnapshot(target);
  const forgedResult = await syncTemplateRepository(syncOptions(template, target));
  assert.equal(forgedResult.blocked, true, 'forged baseline hashes must not authorize overwriting a human edit');
  assert.match(forgedResult.transitionErrors.join('\n'), /source hash lacks commit provenance/);
  assert.deepEqual(await targetSnapshot(target), forgedBefore, 'forged baseline rejection must write zero target bytes');
  await fs.writeFile(rulePath, originalRule);
  await fs.writeFile(statePath, originalState);
}

async function testRemoteAuthorityMigration(root) {
  const fixtureRoot = path.join(root, 'remote-authority-migration');
  const { remote, template, target } = await createFixture(fixtureRoot);
  const fork = path.join(fixtureRoot, 'template-fork.git');
  await run('git', ['clone', '--bare', remote, fork]);
  await git(template, 'remote', 'set-url', 'origin', fork);
  await publishRevision(template, 2);
  const before = await targetSnapshot(target);
  const blocked = await syncTemplateRepository(syncOptions(template, target));
  assert.equal(blocked.blocked, true, 'a descendant fork must not silently replace the recorded template authority');
  assert.match(blocked.transitionErrors.join('\n'), /authority repository changed/);
  assert.deepEqual(await targetSnapshot(target), before, 'remote authority migration must require an explicit state re-adoption and write zero bytes by default');
}

async function testDetachedPublishedReleaseAuthority(root) {
  const fixtureRoot = path.join(root, 'detached-published-release');
  const { remote, template } = await createFixture(fixtureRoot);
  const pinned = path.join(fixtureRoot, 'pinned-release');
  await run('git', ['clone', remote, pinned]);
  await git(pinned, 'checkout', '--detach', 'v1.0.1');

  await publishRevision(template, 2);
  await git(pinned, 'fetch', '--prune', '--tags', 'origin');
  const files = await collectManagedTemplateFiles(pinned, DIRECTORIES, ROOT_FILES);
  const source = await readTemplateSource(pinned, files, { verifyRemoteTag: true });
  assert.equal(source.detached, true);
  assert.equal(source.published, false, 'an immutable release must not pretend to track the advancing default branch');
  assert.equal(source.tagPublished, true, 'the pinned annotated release tag must be verified at origin');
  assert.equal(source.fixedReleaseAuthority, true);
  assert.equal(source.authoritative, true, 'a clean detached release is valid local template authority');
  assert.equal(source.remoteAuthoritative, true, 'the exact published annotated tag authorizes immutable release use');
  assert.deepEqual(
    templateRuntimeAuditIssues(source, { remoteVerificationRequested: true }),
    [],
    'runtime status accepts an exact detached annotated release verified at origin',
  );
  assert.equal(
    templateReleaseAuditIssues(source, { remoteVerificationRequested: true }).some((issue) => issue.code === 'upstream'),
    true,
    'canonical release audit remains branch/upstream strict',
  );
  const fallback = await readTemplateSource(pinned, files, {
    verifyRemoteTag: true,
    remoteTagQuery: async () => ({ ok: false, stdout: '' }),
    githubTagReadback: async () => ({ ok: true, tagObject: source.tagObject,
      tagCommit: source.commit, transport: 'github-rest' }),
  });
  assert.equal(fallback.tagPublished, true, 'an exact REST readback may replace only a failed Git transport query');
  assert.equal(fallback.remoteTagTransport, 'github-rest');
  const mismatch = await readTemplateSource(pinned, files, {
    verifyRemoteTag: true,
    remoteTagQuery: async () => ({ ok: false, stdout: '' }),
    githubTagReadback: async () => ({ ok: true, tagObject: source.tagObject,
      tagCommit: '0'.repeat(40), transport: 'github-rest' }),
  });
  assert.equal(mismatch.tagRemoteVerified, true);
  assert.equal(mismatch.tagPublished, false, 'REST fallback must still match the exact peeled release commit');
}

async function testInsteadOfAuthorityRewrite(root) {
  const fixtureRoot = path.join(root, 'instead-of-authority-rewrite');
  const redirectedRoot = path.join(fixtureRoot, 'redirected');
  const remote = path.join(redirectedRoot, 'repo.git');
  const template = path.join(fixtureRoot, 'template');
  const target = path.join(fixtureRoot, 'target');
  await fs.mkdir(template, { recursive: true });
  await run('git', ['init', '--bare', remote]);
  await git(template, 'init', '-b', 'main');
  await configure(template);
  await git(template, 'remote', 'add', 'origin', 'https://authority.invalid/repo.git');
  await git(template, 'config', `url.file://${redirectedRoot}/.insteadOf`, 'https://authority.invalid/');
  await writeRevision(template, 1);
  await git(template, 'add', '-A');
  await git(template, 'commit', '-m', 'rewritten authority revision');
  await git(template, 'tag', '-a', 'v1.0.1', '-m', 'v1.0.1');
  await git(template, 'push', '-u', 'origin', 'main', '--follow-tags');

  await fs.mkdir(target, { recursive: true });
  await git(target, 'init', '-b', 'main');
  await configure(target);
  await write(path.join(target, 'README.md'), '# target\n');
  await git(target, 'add', '-A');
  await git(target, 'commit', '-m', 'initialize target');
  const blocked = await syncTemplateRepository(syncOptions(template, target));
  assert.equal(blocked.blocked, true, 'insteadOf must not redirect a declared authority to another repository');
  assert.match(blocked.transitionErrors.join('\n'), /rewritten to a different repository/);
  assert.equal(await git(target, 'status', '--porcelain=v1'), '', 'authority rewrite rejection must write zero target bytes');
}

async function testGitObjectOverlays(root) {
  const fixtureRoot = path.join(root, 'git-object-overlays');
  const { template, target } = await createFixture(fixtureRoot);
  const official = await git(template, 'rev-parse', 'HEAD');
  await write(path.join(template, 'rules/rule.md'), '# unpublished malicious rule\n');
  await git(template, 'add', '-A');
  await git(template, 'commit', '-m', 'unpublished malicious replacement');
  const malicious = await git(template, 'rev-parse', 'HEAD');
  await git(template, 'reset', '--hard', official);
  await git(template, 'replace', official, malicious);
  const filesWithReplace = await collectManagedTemplateFiles(template, DIRECTORIES, ROOT_FILES);
  assert.equal(filesWithReplace.find((file) => file.relPath === 'rules/rule.md').content.toString('utf8'), '# rule 1\n', 'managed blobs must ignore replace refs');
  const beforeReplace = await targetSnapshot(target);
  const replaceBlocked = await syncTemplateRepository(syncOptions(template, target));
  assert.equal(replaceBlocked.blocked, true, 'Git replace refs must invalidate template authority');
  assert.match(replaceBlocked.transitionErrors.join('\n'), /replace refs or grafts/);
  assert.deepEqual(await targetSnapshot(target), beforeReplace, 'replace-ref rejection must write zero target bytes');

  await git(template, 'replace', '-d', official);
  const gitDir = await resolveGitDirectory(template);
  await write(path.join(gitDir, 'info/grafts'), `${official} ${malicious}\n`);
  const beforeGraft = await targetSnapshot(target);
  const graftBlocked = await syncTemplateRepository(syncOptions(template, target));
  assert.equal(graftBlocked.blocked, true, 'legacy Git grafts must invalidate template authority');
  assert.match(graftBlocked.transitionErrors.join('\n'), /replace refs or grafts/);
  assert.deepEqual(await targetSnapshot(target), beforeGraft, 'graft rejection must write zero target bytes');
}

async function testManagedDirectoryRootType(root) {
  const fixtureRoot = path.join(root, 'managed-directory-root-type');
  const { template, target } = await createFixture(fixtureRoot);
  await writeRevision(template, 2);
  await fs.rm(path.join(template, 'rules'), { recursive: true, force: true });
  await git(template, 'add', '-A');
  await stageGitSymlink(template, 'rules', 'always-readme.md');
  await git(template, 'commit', '-m', 'replace managed directory with symlink');
  await git(template, 'tag', '-a', 'v1.0.2', '-m', 'v1.0.2');
  await git(template, 'push', '--follow-tags');
  const before = await targetSnapshot(target);
  const blocked = await syncTemplateRepository(syncOptions(template, target));
  assert.equal(blocked.blocked, true, 'a managed directory root must remain a Git tree');
  assert.match(blocked.transitionErrors.join('\n'), /directory root is not a Git tree/);
  assert.deepEqual(await targetSnapshot(target), before, 'an invalid managed directory root must not authorize deletion of its prior children');
}

async function testManagedRootFileType(root) {
  const fixtureRoot = path.join(root, 'managed-root-file-type');
  const { template, target } = await createFixture(fixtureRoot);
  await writeRevision(template, 2);
  await fs.rm(path.join(template, 'always-readme.md'));
  await write(path.join(template, 'always-readme.md/child.md'), '# invalid root file tree\n');
  await git(template, 'add', '-A');
  await git(template, 'commit', '-m', 'replace managed root file with tree');
  await git(template, 'tag', '-a', 'v1.0.2', '-m', 'v1.0.2');
  await git(template, 'push', '--follow-tags');
  const before = await targetSnapshot(target);
  const blocked = await syncTemplateRepository(syncOptions(template, target));
  assert.equal(blocked.blocked, true, 'a managed root file must remain a regular Git blob');
  assert.match(blocked.transitionErrors.join('\n'), /root file is not a regular Git blob/);
  assert.deepEqual(await targetSnapshot(target), before, 'an invalid managed root file shape must not delete the prior target file');
}

async function testTargetLeafSymlink(root) {
  const fixtureRoot = path.join(root, 'target-leaf-symlink');
  const { template, target } = await createFixture(fixtureRoot);
  const externalPath = path.join(target, 'project-rule.md');
  const targetRule = path.join(target, 'devrules/rules/rule.md');
  await write(externalPath, '# rule 1\n');
  await fs.rm(targetRule);
  if (!(await tryCreateFileSymlink('../../project-rule.md', targetRule))) {
    console.log('template authority selftest: SKIP target leaf symlink (Windows symlink privilege unavailable)');
    return;
  }
  await publishRevision(template, 2);
  const before = await targetSnapshot(target);
  const blocked = await syncTemplateRepository(syncOptions(template, target));
  assert.equal(blocked.blocked, true, 'a managed target symlink must never be treated as baseline file bytes');
  assert.match(blocked.conflicts.map((entry) => entry.reason).join('\n'), /symbolic link/);
  assert.deepEqual(await targetSnapshot(target), before, 'target leaf symlink rejection must write zero managed bytes');
  assert.equal((await fs.lstat(targetRule)).isSymbolicLink(), true, 'blocked sync must preserve the target symlink topology');
  assert.equal(await fs.readFile(externalPath, 'utf8'), '# rule 1\n', 'blocked sync must not mutate the symlink target');
}

async function testRecoveryPreservesLaterHumanEdits(root) {
  const fixtureRoot = path.join(root, 'recovery-human-edit');
  const { target, initial } = await createFixture(fixtureRoot);
  const rulePath = path.join(target, 'devrules/rules/rule.md');
  const humanRule = '# later human edit\n';
  await fs.writeFile(rulePath, humanRule);
  const gitDir = await resolveGitDirectory(target);
  const journalPath = path.join(gitDir, 'devrules-sync', initial.transaction.id, 'journal.json');
  const originalJournal = JSON.parse(await fs.readFile(journalPath, 'utf8'));
  for (const status of ['completed', 'prepared', 'rolled-back']) {
    await fs.writeFile(journalPath, `${JSON.stringify({ ...originalJournal, status }, null, 2)}\n`);
    await assert.rejects(
      recoverTemplateSyncTransaction(target, initial.transaction.id, true),
      /changed outside the recorded transaction/,
      `${status} recovery must reject a target with later human edits`,
    );
    assert.equal(await fs.readFile(rulePath, 'utf8'), humanRule, `${status} recovery must preserve the later human edit`);
  }
}

async function testIndexFlagsAndCanonicalBytes(template, target) {
  const rulePath = path.join(template, 'rules/rule.md');
  const manifestPath = path.join(template, 'template.json');
  const originalRule = await fs.readFile(rulePath);
  const originalManifest = await fs.readFile(manifestPath);
  await git(template, 'update-index', '--assume-unchanged', 'rules/rule.md', 'template.json');
  await write(rulePath, '# spoofed rule\n');
  await write(manifestPath, '{"templateId":"spoofed","version":"9.9.9","revision":999}\n');
  assert.equal(await git(template, 'status', '--porcelain=v1'), '', 'assume-unchanged must reproduce a deceptively clean worktree');

  const files = await collectManagedTemplateFiles(template, DIRECTORIES, ROOT_FILES);
  const rule = files.find((file) => file.relPath === 'rules/rule.md');
  assert.equal(rule.content.toString('utf8'), '# rule 1\n', 'managed bytes must come from the committed Git blob');
  assert.match(rule.integrityIssue, /unsafe Git index flag/);
  const source = await readTemplateSource(template, files);
  assert.equal(source.version, '1.0.1', 'release identity must come from the committed tree');
  assert.equal(source.authoritative, false, 'unsafe index flags must invalidate source authority');
  const localSource = await readTemplateSource(template, files, { contentView: 'working-tree' });
  assert.equal(localSource.contentView, 'working-tree');
  assert.equal(localSource.version, '9.9.9', 'local content audit must inspect the current working-tree manifest');

  const before = await targetSnapshot(target);
  const blocked = await syncTemplateRepository(syncOptions(template, target, { allowDirtyTemplate: true }));
  assert.equal(blocked.blocked, true);
  assert.match(blocked.transitionErrors.join('\n'), /unsafe Git index flag/);
  assert.deepEqual(await targetSnapshot(target), before, 'index-flag authority failure must write zero target bytes');

  const initTarget = path.join(path.dirname(target), 'blocked-init-target');
  await fs.mkdir(initTarget, { recursive: true });
  await git(initTarget, 'init', '-b', 'main');
  await configure(initTarget);
  await write(path.join(initTarget, 'README.md'), '# blocked init target\n');
  await git(initTarget, 'add', '-A');
  await git(initTarget, 'commit', '-m', 'initialize blocked target');
  const initResult = JSON.parse(await run(process.execPath, [CLI, 'init', '--repo', initTarget, '--sync-template', '--apply', '--json'], {
    env: { ...process.env, DEVRULES_TEMPLATE_ROOT: template },
  }));
  assert.equal(initResult.results[0].blocked, true);
  assert.equal(await fs.stat(path.join(initTarget, 'devrules')).then(() => true).catch(() => false), false, 'blocked initial sync must create no devrules directory');
  assert.equal(await git(initTarget, 'status', '--porcelain=v1'), '', 'blocked initial sync must write zero repository files');

  await fs.writeFile(rulePath, originalRule);
  await fs.writeFile(manifestPath, originalManifest);
  await git(template, 'update-index', '--no-assume-unchanged', 'rules/rule.md', 'template.json');
}

async function testUntrackedPayload(template, target) {
  const untrackedPath = path.join(template, 'rules/untracked.md');
  await write(untrackedPath, '# untracked\n');
  const files = await collectManagedTemplateFiles(template, DIRECTORIES, ROOT_FILES);
  assert.equal(files.find((file) => file.relPath === 'rules/untracked.md')?.sourceKind, 'git-untracked');
  const before = await targetSnapshot(target);
  const blocked = await syncTemplateRepository(syncOptions(template, target, { allowDirtyTemplate: true }));
  assert.equal(blocked.blocked, true, 'allow-dirty must not authorize an uncommitted managed payload');
  assert.match(blocked.transitionErrors.join('\n'), /not committed in HEAD/);
  assert.deepEqual(await targetSnapshot(target), before, 'uncommitted payload failure must write zero target bytes');
  await fs.rm(untrackedPath);
}

async function testFetchBackedFreshness(root, remote, template, target) {
  const peer = path.join(root, 'peer');
  await run('git', ['clone', '--branch', 'main', remote, peer]);
  await configure(peer);
  await publishRevision(peer, 2);
  assert.equal(await git(template, 'rev-parse', 'HEAD'), await git(template, 'rev-parse', 'origin/main'), 'fixture starts with a stale local remote-tracking ref');
  const before = await targetSnapshot(target);
  const blocked = await syncTemplateRepository(syncOptions(template, target));
  assert.equal(blocked.blocked, true, 'apply must fetch and reject a source branch behind its upstream');
  assert.match(blocked.transitionErrors.join('\n'), /not published to its upstream/);
  assert.notEqual(await git(template, 'rev-parse', 'HEAD'), await git(template, 'rev-parse', 'origin/main'), 'apply preflight must refresh the remote-tracking ref');
  assert.deepEqual(await targetSnapshot(target), before, 'stale source authority failure must write zero target bytes');
  const cliAttempt = await runExpectFailureJson(
    process.execPath,
    [CLI, 'repo', 'sync-template', '--repo', target, '--apply', '--allow-local-authority', '--json'],
    { env: { ...process.env, DEVRULES_TEMPLATE_ROOT: template } },
  );
  assert.equal(cliAttempt.blocked, true, 'production CLI flags must not bypass remote source authority');
  assert.deepEqual(await targetSnapshot(target), before, 'authority bypass attempts must write zero target bytes');
}

async function testRecoveryJournalContainment(root, target) {
  const transactionId = 'c'.repeat(20);
  const gitDir = await resolveGitDirectory(target);
  const transactionDir = path.join(gitDir, 'devrules-sync', transactionId);
  const legitimatePath = path.join(target, 'devrules/always-readme.md');
  const outsidePath = path.join(root, 'recovery-outside.txt');
  const legitimateBefore = await fs.readFile(legitimatePath);
  await write(outsidePath, 'outside sentinel\n');
  const replacement = Buffer.from('malicious replacement\n');
  await write(path.join(transactionDir, 'backup/devrules/always-readme.md'), replacement);
  const journal = {
    schemaVersion: 2,
    transactionId,
    status: 'completed',
    repo: target,
    entries: [
      {
        relPath: 'devrules/always-readme.md',
        path: legitimatePath,
        existed: true,
        beforeHash: crypto.createHash('sha256').update(replacement).digest('hex'),
        afterExists: true,
        afterHash: crypto.createHash('sha256').update(legitimateBefore).digest('hex'),
        mode: 0o644,
        backupPath: path.join(transactionDir, 'backup/devrules/always-readme.md'),
      },
      {
        relPath: '../recovery-outside.txt',
        path: outsidePath,
        existed: false,
        beforeHash: '',
        afterExists: false,
        afterHash: '',
        mode: 0,
        backupPath: '',
      },
    ],
  };
  await write(path.join(transactionDir, 'journal.json'), `${JSON.stringify(journal, null, 2)}\n`);
  await assert.rejects(recoverTemplateSyncTransaction(target, transactionId, true), /unsafe recovery journal path/);
  assert.deepEqual(await fs.readFile(legitimatePath), legitimateBefore, 'journal validation must finish before restoring any entry');
  assert.equal(await fs.readFile(outsidePath, 'utf8'), 'outside sentinel\n', 'recovery must never write outside the selected repository');
}

async function main() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'template-authority-selftest-'));
  try {
    testRemoteIdentityBoundaries();
    await testGitHubReleaseTagReadback();
    await testLockOwnership(root);
    const { remote, template, target } = await createFixture(root);
    await testSyncStatePathValidation(template, target);
    await testIndexFlagsAndCanonicalBytes(template, target);
    await testUntrackedPayload(template, target);
    await testFetchBackedFreshness(root, remote, template, target);
    await testDetachedPublishedReleaseAuthority(root);
    await testRemoteAuthorityMigration(root);
    await testInsteadOfAuthorityRewrite(root);
    await testGitObjectOverlays(root);
    await testManagedDirectoryRootType(root);
    await testManagedRootFileType(root);
    await testTargetLeafSymlink(root);
    await testRecoveryPreservesLaterHumanEdits(root);
    await testRecoveryJournalContainment(root, target);
    process.stdout.write('template authority selftest: PASS\n');
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}

main().catch((error) => {
  process.stderr.write(`template authority selftest: FAIL\n${error.stack || error.message}\n`);
  process.exitCode = 1;
});
