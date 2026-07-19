#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  inspectGitHubHost,
  inspectGitPublishReadiness,
  parseGitHubRemote,
} from './devrules-lib/git-publish-readiness.mjs';
import { runGit } from './devrules-lib/git-repository.mjs';
import { writeJson } from './devrules-lib/selftest-utils.mjs';

async function commitAll(repo, message) {
  await runGit(repo, ['add', '-A']);
  await runGit(repo, ['commit', '-m', message]);
}

function githubAccount() {
  return {
    schemaVersion: 1,
    recordType: 'developer-service-account',
    accountRef: 'github:octocat',
    provider: 'github',
    displayName: 'octocat / GitHub',
    owner: 'octocat',
    identity: { login: 'octocat', host: 'github.com' },
    automationProfiles: [
      {
        profileId: 'github:octocat:gh-write',
        method: 'cli',
        toolName: 'gh',
        credentialRef: 'Selftest gh profile',
        defaultMode: 'read-write',
        writesRequireExplicitApproval: true,
        expectedIdentity: { login: 'octocat' },
        status: 'verified',
        lastVerified: '2026-07-16',
      },
    ],
    status: 'active',
    lastVerified: '2026-07-16',
  };
}

function githubInventory() {
  return {
    schemaVersion: 1,
    recordType: 'developer-services-project',
    project: {
      id: 'widgets',
      repository: 'widgets',
      displayName: 'Widgets',
      status: 'active',
    },
    serviceBindings: [
      {
        bindingId: 'github-repository',
        provider: 'github',
        accountRef: 'github:octocat',
        environment: 'repository',
        role: 'primary',
        status: 'active',
        target: {
          kind: 'github-repository',
          name: 'octocat/widgets',
          identifiers: [{ kind: 'repository', value: 'octocat/widgets' }],
        },
        dataAuthority: { mode: 'none', notes: 'Git history is authoritative.' },
        resources: [],
        environmentContract: [],
        automation: [
          {
            profileRef: 'github:octocat:gh-write',
            scope: 'repository',
            defaultMode: 'read-write',
            expectedIdentity: [{ kind: 'login', value: 'octocat' }],
            status: 'verified',
          },
        ],
        lastVerified: '2026-07-16',
      },
    ],
    lastReviewed: '2026-07-16',
  };
}

async function run() {
  assert.deepEqual(parseGitHubRemote('https://github.com/octocat/widgets.git'), {
    host: 'github.com',
    owner: 'octocat',
    repository: 'widgets',
    nameWithOwner: 'octocat/widgets',
  });
  assert.equal(parseGitHubRemote('git@github.com:octocat/widgets.git')?.nameWithOwner, 'octocat/widgets');
  assert.equal(parseGitHubRemote('https://gitlab.com/octocat/widgets.git'), null);

  const hostCalls = [];
  const host = await inspectGitHubHost({
    owner: 'octocat',
    repository: 'widgets',
    nameWithOwner: 'octocat/widgets',
  }, true, async (args) => {
    hostCalls.push(args.join(' '));
    if (args[0] === 'api' && args[1] === 'user') return { ok: true, stdout: 'octocat', stderr: '' };
    if (args[0] === 'repo') return { ok: false, stdout: '', stderr: 'GraphQL EOF' };
    if (args[0] === 'api' && args[1] === 'repos/octocat/widgets') {
      return {
        ok: true,
        stdout: JSON.stringify({
          full_name: 'octocat/widgets',
          visibility: 'private',
          default_branch: 'main',
        }),
        stderr: '',
      };
    }
    throw new Error(`unexpected gh call: ${args.join(' ')}`);
  });
  assert.equal(host.ok, true);
  assert.equal(host.login, 'octocat');
  assert.equal(host.repository.nameWithOwner, 'octocat/widgets');
  assert.equal(host.repository.defaultBranchRef.name, 'main');
  assert.deepEqual(hostCalls, [
    'api user --jq .login',
    'repo view octocat/widgets --json nameWithOwner,visibility,defaultBranchRef',
    'api repos/octocat/widgets',
  ]);

  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'devrules-publish-readiness-'));
  const repo = path.join(root, 'widgets');
  const remote = path.join(root, 'widgets.git');
  const accountsDir = path.join(root, 'accounts');
  try {
    await fs.mkdir(repo, { recursive: true });
    await runGit(repo, ['init', '--initial-branch=main']);
    await runGit(repo, ['config', 'user.name', 'devrules selftest']);
    await runGit(repo, ['config', 'user.email', 'devrules@example.invalid']);
    await fs.writeFile(path.join(repo, '.gitignore'), '*.log\n', 'utf8');
    await fs.writeFile(path.join(repo, 'README.md'), '# Widgets\n', 'utf8');
    await commitAll(repo, 'initial');
    await runGit(root, ['init', '--bare', remote]);
    await runGit(remote, ['symbolic-ref', 'HEAD', 'refs/heads/main']);
    await runGit(repo, ['remote', 'add', 'origin', remote]);
    await runGit(repo, ['push', '-u', 'origin', 'main']);
    await runGit(repo, ['remote', 'set-head', 'origin', '-a']);

    const clean = await inspectGitPublishReadiness(repo, { fetch: true, accountsDir });
    assert.equal(clean.status, 'ready');
    assert.equal(clean.branches.default, 'main');

    await runGit(repo, ['switch', '-c', 'feature/complete']);
    await fs.writeFile(path.join(repo, 'feature.txt'), 'complete\n', 'utf8');
    await commitAll(repo, 'feature');
    await runGit(repo, ['push', '-u', 'origin', 'feature/complete']);
    const feature = await inspectGitPublishReadiness(repo, { fetch: true, accountsDir });
    assert.equal(feature.status, 'blocked');
    assert.match(feature.blockingReasons.join('\n'), /not default branch main/);
    assert.equal(feature.branches.localNonDefault[0].disposition, 'wip');

    await runGit(repo, ['switch', 'main']);
    await runGit(repo, ['merge', '--no-ff', 'feature/complete', '-m', 'merge feature']);
    const mergedBranchRemains = await inspectGitPublishReadiness(repo, { fetch: true, accountsDir });
    assert.equal(mergedBranchRemains.status, 'review');
    assert.equal(mergedBranchRemains.branches.localNonDefault[0].disposition, 'cleanup');
    await runGit(repo, ['branch', '-d', 'feature/complete']);
    const integrated = await inspectGitPublishReadiness(repo, { fetch: true, accountsDir });
    assert.equal(integrated.status, 'ready');
    assert.equal(integrated.branches.remoteDivergence.ahead > 0, true);
    assert.equal(integrated.branches.remoteNonDefault[0].disposition, 'cleanup-after-push');
    await runGit(repo, ['push', 'origin', 'main']);
    const remoteCleanup = await inspectGitPublishReadiness(repo, { fetch: true, accountsDir });
    assert.equal(remoteCleanup.status, 'review');
    assert.equal(remoteCleanup.branches.remoteNonDefault[0].disposition, 'cleanup');
    await runGit(repo, ['push', 'origin', '--delete', 'feature/complete']);
    const cleaned = await inspectGitPublishReadiness(repo, { fetch: true, accountsDir });
    assert.equal(cleaned.status, 'ready');

    await fs.mkdir(path.join(repo, 'target'), { recursive: true });
    await fs.writeFile(path.join(repo, 'target', 'debug.bin'), 'artifact', 'utf8');
    const artifact = await inspectGitPublishReadiness(repo, { fetch: true, accountsDir });
    assert.equal(artifact.status, 'blocked');
    assert.equal(artifact.hygiene.suspiciousUntracked.length, 1);
    await fs.appendFile(path.join(repo, '.gitignore'), 'target/\n', 'utf8');
    await commitAll(repo, 'ignore build output');
    const ignored = await inspectGitPublishReadiness(repo, { fetch: true, accountsDir });
    assert.equal(ignored.status, 'ready');

    await writeJson(path.join(accountsDir, 'github-octocat.json'), githubAccount());
    await writeJson(
      path.join(repo, 'devrules', 'memory', 'developer-services-inventory.json'),
      githubInventory(),
    );
    await runGit(repo, ['remote', 'set-url', 'origin', 'https://github.com/octocat/widgets.git']);
    const configured = await inspectGitPublishReadiness(repo, {
      fetch: false,
      verifyHost: false,
      defaultBranch: 'main',
      accountsDir,
    });
    assert.equal(configured.hosting.kind, 'github');
    assert.equal(configured.hosting.binding.binding.accountRef, 'github:octocat');
    assert.equal(configured.hosting.binding.ownerMatches, true);
    assert.match(configured.blockingReasons.join('\n'), /readback were not verified/);
    console.log('git publish readiness self-test passed');
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}

await run();
