#!/usr/bin/env node
// Self-test for the design gate git hooks: design-install-hooks.mjs and
// design-pre-commit.mjs. Builds a temporary project instance (fixture copied
// from .selftest plus the devrules hooks/scripts layout), installs the hooks
// via core.hooksPath, and verifies that real `git commit` runs are allowed,
// blocked, and skippable exactly per the documented contract.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const templateRoot = path.resolve(here, '..');
const fixtureRoot = path.join(templateRoot, '.selftest');

function sh(command, args, { cwd, env, expectStatus } = {}) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    windowsHide: true,
    env: env ?? process.env,
  });
  assert(!result.error, `${command} ${args.join(' ')} failed to start: ${result.error?.message}`);
  if (expectStatus !== undefined) {
    assert.equal(
      result.status,
      expectStatus,
      `${command} ${args.join(' ')} exited ${result.status}; expected ${expectStatus}\n--- stdout ---\n${result.stdout}\n--- stderr ---\n${result.stderr}`,
    );
  }
  return result;
}

function gitConfig(repo, key) {
  const result = sh('git', ['config', '--get', key], { cwd: repo });
  return (result.stdout || '').trim();
}

function commitCount(repo) {
  const result = sh('git', ['rev-list', '--count', 'HEAD'], { cwd: repo, expectStatus: 0 });
  return Number(result.stdout.trim());
}

function initGitRepo(repo) {
  fs.mkdirSync(repo, { recursive: true });
  sh('git', ['init', '-b', 'main'], { cwd: repo, expectStatus: 0 });
  sh('git', ['config', 'user.name', 'devrules design hooks selftest'], { cwd: repo, expectStatus: 0 });
  sh('git', ['config', 'user.email', 'design-hooks-selftest@example.invalid'], { cwd: repo, expectStatus: 0 });
  sh('git', ['config', 'commit.gpgsign', 'false'], { cwd: repo, expectStatus: 0 });
}

function buildProjectInstance(repo) {
  initGitRepo(repo);
  for (const entry of ['DESIGN.md', 'design.config.json', 'allow.json', 'out', 'src']) {
    fs.cpSync(path.join(fixtureRoot, entry), path.join(repo, entry), { recursive: true });
  }
  const hooksDest = path.join(repo, 'devrules', 'hooks');
  fs.mkdirSync(path.join(hooksDest, 'design-githooks'), { recursive: true });
  fs.cpSync(path.join(templateRoot, 'hooks', 'design-install-hooks.mjs'), path.join(hooksDest, 'design-install-hooks.mjs'));
  fs.cpSync(path.join(templateRoot, 'hooks', 'design-pre-commit.mjs'), path.join(hooksDest, 'design-pre-commit.mjs'));
  const shim = path.join(hooksDest, 'design-githooks', 'pre-commit');
  fs.cpSync(path.join(templateRoot, 'hooks', 'design-githooks', 'pre-commit'), shim);
  fs.chmodSync(shim, 0o755);
  const scriptsDest = path.join(repo, 'devrules', 'scripts');
  fs.mkdirSync(scriptsDest, { recursive: true });
  for (const script of ['design-sync.mjs', 'design-guard.mjs', 'design-lint.mjs']) {
    fs.cpSync(path.join(here, script), path.join(scriptsDest, script));
  }
  fs.cpSync(path.join(here, 'design-lib'), path.join(scriptsDest, 'design-lib'), { recursive: true });
  sh('git', ['add', '-A'], { cwd: repo, expectStatus: 0 });
  sh('git', ['commit', '-m', 'fixture project instance'], { cwd: repo, expectStatus: 0 });
}

function testInstallAndCommitGate(tempRoot) {
  const repo = path.join(tempRoot, 'project');
  buildProjectInstance(repo);
  const installer = path.join(repo, 'devrules', 'hooks', 'design-install-hooks.mjs');
  const preCommit = path.join(repo, 'devrules', 'hooks', 'design-pre-commit.mjs');

  const install = sh(process.execPath, [installer], { cwd: repo, expectStatus: 0 });
  assert.match(install.stdout, /installed: core\.hooksPath -> devrules\/hooks\/design-githooks/);
  assert.equal(gitConfig(repo, 'core.hooksPath'), 'devrules/hooks/design-githooks');

  const reinstall = sh(process.execPath, [installer], { cwd: repo, expectStatus: 0 });
  assert.match(reinstall.stdout, /installed: core\.hooksPath -> devrules\/hooks\/design-githooks/);
  assert.equal(gitConfig(repo, 'core.hooksPath'), 'devrules/hooks/design-githooks', 're-install must stay idempotent');

  const installedShim = path.join(repo, 'devrules', 'hooks', 'design-githooks', 'pre-commit');
  assert(fs.statSync(installedShim).mode & 0o100, 'the pre-commit shim must stay executable');

  const direct = sh(process.execPath, [preCommit], { cwd: repo, expectStatus: 0 });
  assert.match(direct.stdout, /design gate passed/, 'pre-commit with nothing staged must pass');

  fs.writeFileSync(path.join(repo, 'src', 'CleanExtra.tsx'), [
    'export function CleanExtra() {',
    '  return <button className="rounded-md bg-primary text-primary-foreground">Continue</button>;',
    '}',
    '',
  ].join('\n'), 'utf8');
  sh('git', ['add', 'src/CleanExtra.tsx'], { cwd: repo, expectStatus: 0 });
  const before = commitCount(repo);
  sh('git', ['commit', '-m', 'clean staged change'], { cwd: repo, expectStatus: 0 });
  assert.equal(commitCount(repo), before + 1, 'a clean staged change must commit through the gate');

  fs.writeFileSync(path.join(repo, 'src', 'BadStaged.tsx'), [
    'export function BadStaged() {',
    "  return <div style={{ color: '#FF00AA' }}>hardcoded</div>;",
    '}',
    '',
  ].join('\n'), 'utf8');
  sh('git', ['add', 'src/BadStaged.tsx'], { cwd: repo, expectStatus: 0 });
  const blocked = spawnSync('git', ['commit', '-m', 'blocked staged change'], { cwd: repo, encoding: 'utf8', windowsHide: true });
  assert.notEqual(blocked.status, 0, 'a staged hardcoded color must block the commit');
  assert.match(`${blocked.stdout}${blocked.stderr}`, /design gate failed/);
  assert.equal(commitCount(repo), before + 1, 'the blocked commit must not be recorded');

  sh('git', ['commit', '-m', 'escape hatch commit'], {
    cwd: repo,
    env: { ...process.env, DEVRULES_SKIP: '1' },
    expectStatus: 0,
  });
  assert.equal(commitCount(repo), before + 2, 'DEVRULES_SKIP=1 must bypass the gate');
}

function testExistingHooksPathPreserved(tempRoot) {
  const repo = path.join(tempRoot, 'husky-project');
  buildProjectInstance(repo);
  sh('git', ['config', 'core.hooksPath', '.husky/_'], { cwd: repo, expectStatus: 0 });
  const installer = path.join(repo, 'devrules', 'hooks', 'design-install-hooks.mjs');
  const result = sh(process.execPath, [installer], { cwd: repo, expectStatus: 0 });
  assert.match(result.stdout, /leaving it untouched/);
  assert.match(result.stdout, /design-pre-commit\.mjs \|\| exit 1/, 'must print the manual append instruction');
  assert.equal(gitConfig(repo, 'core.hooksPath'), '.husky/_', 'an existing hooksPath must not be overwritten');
}

function testHooksDirOutsideRepoRejected(tempRoot) {
  const repo = path.join(tempRoot, 'plain-project');
  initGitRepo(repo);
  const templateInstaller = path.join(templateRoot, 'hooks', 'design-install-hooks.mjs');
  const result = sh(process.execPath, [templateInstaller], { cwd: repo });
  assert.equal(result.status, 1, 'installing from a hooks dir outside the target repo must fail');
  assert.match(result.stderr, /outside the repository/);
  assert.equal(gitConfig(repo, 'core.hooksPath'), '', 'the rejected install must not set core.hooksPath');
}

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'devrules-design-hooks-'));
try {
  testInstallAndCommitGate(tempRoot);
  testExistingHooksPathPreserved(tempRoot);
  testHooksDirOutsideRepoRejected(tempRoot);
  console.log('design hooks selftest: PASS');
} catch (error) {
  console.error(`design hooks selftest: FAIL\n${error.stack || error.message}`);
  process.exitCode = 1;
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
