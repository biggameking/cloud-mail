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
const TEMPLATE_ROOT = path.resolve(SCRIPT_DIR, '..');
const CLI = path.join(SCRIPT_DIR, 'devrules.mjs');

async function run(command, args, options = {}) {
  const result = await execFileAsync(command, args, {
    encoding: 'utf8',
    env: options.env || process.env,
    maxBuffer: 64 * 1024 * 1024,
    timeout: options.timeout || 120_000,
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

async function configureRepository(repo) {
  await git(repo, 'config', 'user.name', 'devrules batch Git selftest');
  await git(repo, 'config', 'user.email', 'batch-git-selftest@example.invalid');
}

async function createTrackedRepository(root, workspace, name) {
  const remote = path.join(root, 'remotes', `${name}.git`);
  const repo = path.join(workspace, name);
  await fs.mkdir(path.dirname(remote), { recursive: true });
  await run('git', ['init', '--bare', '--initial-branch=main', remote]);
  await fs.mkdir(repo, { recursive: true });
  await git(repo, 'init', '-b', 'main');
  await configureRepository(repo);
  await write(path.join(repo, 'README.md'), `# ${name}\n`);
  await git(repo, 'add', 'README.md');
  await git(repo, 'commit', '-m', `initialize ${name}`);
  await git(repo, 'remote', 'add', 'origin', remote);
  await git(repo, 'push', '-u', 'origin', 'main');
  return { repo, remote };
}

async function createNoUpstreamRepository(workspace) {
  const repo = path.join(workspace, 'no-upstream');
  await fs.mkdir(repo, { recursive: true });
  await git(repo, 'init', '-b', 'main');
  await configureRepository(repo);
  await write(path.join(repo, 'README.md'), '# no upstream\n');
  await git(repo, 'add', 'README.md');
  await git(repo, 'commit', '-m', 'initialize no-upstream');
  return repo;
}

async function advanceRemote(root, remote) {
  const updater = path.join(root, 'updaters', 'stale-updater');
  await fs.mkdir(path.dirname(updater), { recursive: true });
  await run('git', ['clone', '--branch', 'main', remote, updater]);
  await configureRepository(updater);
  await write(path.join(updater, 'REMOTE.md'), 'advanced remotely\n');
  await git(updater, 'add', 'REMOTE.md');
  await git(updater, 'commit', '-m', 'advance remote');
  await git(updater, 'push', 'origin', 'main');
}

async function runCli(args, env) {
  return JSON.parse(await run(process.execPath, [CLI, ...args, '--json'], { env }));
}

function itemByName(items, name) {
  return items.find((item) => path.basename(item.repo) === name);
}

async function exists(filePath) {
  return fs.stat(filePath).then(() => true).catch(() => false);
}

async function main() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'batch-git-readiness-selftest-'));
  try {
    const workspace = path.join(root, 'workspace');
    await fs.mkdir(workspace, { recursive: true });
    const clean = await createTrackedRepository(root, workspace, 'clean');
    const ambiguous = await createTrackedRepository(root, workspace, 'ambiguous-remote');
    const dirty = await createTrackedRepository(root, workspace, 'dirty');
    const stale = await createTrackedRepository(root, workspace, 'stale');
    const noUpstream = await createNoUpstreamRepository(workspace);
    await git(ambiguous.repo, 'config', '--add', 'remote.origin.url', ambiguous.remote);
    await write(path.join(dirty.repo, 'DIRTY.txt'), 'must remain untouched\n');
    await advanceRemote(root, stale.remote);

    const env = {
      ...process.env,
      DEVRULES_TEMPLATE_ROOT: TEMPLATE_ROOT,
      DEVRULES_DEVICE_ID: 'batch-git-readiness-selftest',
    };

    const unchecked = await runCli([
      'workspace', 'readiness', '--root', workspace, '--profile', 'minimal',
    ], env);
    assert.equal(unchecked.summary.readyToApply, 5);
    assert.equal(unchecked.summary.gitReady, 0, 'no-fetch readiness must not claim remote-verified write eligibility');
    assert.equal(unchecked.summary.deferredGit, 5);
    assert.equal(unchecked.summary.gitLocallyReady, 2, 'clean and stale-tracking repositories look locally equal before fetch');
    assert.equal(itemByName(unchecked.groups.readyToApply, 'clean').gitFreshness, 'unchecked');
    assert.equal(itemByName(unchecked.groups.readyToApply, 'clean').gitLocallyReady, true);
    assert.equal(itemByName(unchecked.groups.readyToApply, 'dirty').gitLocallyReady, false);
    assert.equal(itemByName(unchecked.groups.readyToApply, 'no-upstream').gitLocallyReady, false);
    assert.equal(itemByName(unchecked.groups.readyToApply, 'ambiguous-remote').gitLocallyReady, false);

    const dryRun = await runCli([
      'workspace', 'apply-ready', '--root', workspace, '--profile', 'minimal',
    ], env);
    assert.equal(dryRun.apply, false);
    assert.equal(dryRun.readyProcessedCount, 2, 'unchecked dry-run should plan only locally clean/equal candidates');
    assert.equal(dryRun.gitUncheckedPlanCount, 2);
    assert.equal(dryRun.deferredGitCount, 3);
    for (const repo of [clean.repo, ambiguous.repo, dirty.repo, stale.repo, noUpstream]) {
      assert.equal(await exists(path.join(repo, 'devrules')), false, 'dry-run must not write project files');
    }

    const fetched = await runCli([
      'workspace', 'readiness', '--root', workspace, '--profile', 'minimal', '--fetch',
    ], env);
    assert.equal(fetched.summary.gitReady, 1, 'only the clean exact-upstream repository is fetch-verified ready');
    assert.equal(fetched.summary.deferredGit, 4);
    assert.equal(itemByName(fetched.groups.gitReady, 'clean').gitFreshness, 'verified');
    assert.equal(itemByName(fetched.groups.deferredGit, 'stale').git.behind, 1);

    const fetchedDryRun = await runCli([
      'workspace', 'apply-ready', '--root', workspace, '--profile', 'minimal', '--fetch',
    ], env);
    assert.equal(fetchedDryRun.readyProcessedCount, 1);
    assert.equal(fetchedDryRun.gitVerifiedCount, 1);
    assert.equal(fetchedDryRun.gitUncheckedPlanCount, 0);
    assert.equal(fetchedDryRun.deferredGitCount, 4);
    for (const repo of [clean.repo, ambiguous.repo, dirty.repo, stale.repo, noUpstream]) {
      assert.equal(await exists(path.join(repo, 'devrules')), false, 'fetch-backed dry-run must remain read-only');
    }

    // Restore the stale local tracking ref so apply-ready must fetch again to
    // discover the remote advance immediately before it considers writing.
    const staleHead = await git(stale.repo, 'rev-parse', 'HEAD');
    await git(stale.repo, 'update-ref', 'refs/remotes/origin/main', staleHead);

    const applied = await runCli([
      'workspace', 'apply-ready', '--root', workspace, '--profile', 'minimal', '--apply',
    ], env);
    assert.equal(applied.apply, true);
    assert.equal(applied.appliedCount, 1);
    assert.equal(applied.readyProcessedCount, 1);
    assert.equal(applied.gitVerifiedCount, 1);
    assert.equal(applied.deferredGitCount, 4);

    const cleanResult = itemByName(applied.results, 'clean');
    const ambiguousResult = itemByName(applied.results, 'ambiguous-remote');
    const dirtyResult = itemByName(applied.results, 'dirty');
    const staleResult = itemByName(applied.results, 'stale');
    const noUpstreamResult = itemByName(applied.results, 'no-upstream');
    assert.equal(cleanResult.group, 'readyToApply');
    assert.equal(cleanResult.gitReady, true);
    assert.equal(cleanResult.git.fetch.attempted, true);
    assert.equal(ambiguousResult.group, 'deferredGit');
    assert.equal(ambiguousResult.git.remoteTopologyValid, false);
    assert.equal(dirtyResult.group, 'deferredGit');
    assert.equal(dirtyResult.git.dirty, true);
    assert.equal(staleResult.group, 'deferredGit');
    assert.equal(staleResult.git.fetch.attempted, true);
    assert.equal(staleResult.git.behind, 1, 'fresh pre-write fetch must expose a stale tracking ref');
    assert.equal(noUpstreamResult.group, 'deferredGit');
    assert.equal(noUpstreamResult.git.upstream, '');

    assert.equal(await exists(path.join(clean.repo, 'devrules', 'manifest.json')), true);
    assert.equal(await exists(path.join(clean.repo, 'AGENTS.md')), true);
    for (const repo of [ambiguous.repo, dirty.repo, stale.repo, noUpstream]) {
      assert.equal(await exists(path.join(repo, 'devrules')), false, 'Git-deferred repositories must receive no governance writes');
      assert.equal(await exists(path.join(repo, 'AGENTS.md')), false, 'Git-deferred repositories must receive no entry-file writes');
    }
    assert.equal(await fs.readFile(path.join(dirty.repo, 'DIRTY.txt'), 'utf8'), 'must remain untouched\n');
    assert.equal(await git(stale.repo, 'rev-parse', 'HEAD'), staleHead, 'fetch/defer must not change the checked-out commit');

    process.stdout.write('batch Git readiness selftest: PASS\n');
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}

main().catch((error) => {
  process.stderr.write(`batch Git readiness selftest: FAIL\n${error.stack || error.message}\n`);
  process.exitCode = 1;
});
