import { execFile, spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import {
  cleanupGitAppleDoubleArtifacts,
  removeUntrackedActionAppleDoubleArtifacts,
} from './apple-double.mjs';

const execFileAsync = promisify(execFile);

export async function runGit(repoPath, args, options = {}) {
  try {
    const result = await execFileAsync('git', ['-c', 'advice.graftFileDeprecated=false', '-C', repoPath, ...args], {
      encoding: 'utf8',
      env: { ...process.env, ...(options.env || {}), GIT_NO_REPLACE_OBJECTS: '1', GIT_GRAFT_FILE: os.devNull },
      maxBuffer: 8 * 1024 * 1024,
      timeout: Number(options.timeout || 20_000),
      windowsHide: true,
    });
    return {
      ok: true,
      stdout: options.trimOutput === false ? result.stdout : result.stdout.trim(),
      stderr: result.stderr.trim(),
      code: 0,
    };
  } catch (error) {
    const result = {
      ok: false,
      stdout: options.trimOutput === false ? String(error?.stdout || '') : String(error?.stdout || '').trim(),
      stderr: String(error?.stderr || error?.message || '').trim(),
      code: Number.isInteger(error?.code) ? error.code : 1,
    };
    if (options.allowFailure) return result;
    throw new Error(`git ${args.join(' ')} failed in ${repoPath}: ${result.stderr || result.stdout}`);
  }
}

export async function isExactGitWorktree(repoPath) {
  const topLevel = await runGit(repoPath, ['rev-parse', '--show-toplevel'], { allowFailure: true });
  if (!topLevel.ok || !topLevel.stdout) return false;
  const [gitRoot, requestedRoot] = await Promise.all([
    fs.realpath(topLevel.stdout).catch(() => path.resolve(topLevel.stdout)),
    fs.realpath(repoPath).catch(() => path.resolve(repoPath)),
  ]);
  return gitRoot === requestedRoot;
}

export async function readGitBlobs(repoPath, objectIds, options = {}) {
  const ids = [...new Set(objectIds.filter(Boolean))];
  if (!ids.length) return new Map();
  return new Promise((resolve, reject) => {
    const child = spawn('git', ['-c', 'advice.graftFileDeprecated=false', '-C', repoPath, 'cat-file', '--batch'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
      env: { ...process.env, GIT_NO_REPLACE_OBJECTS: '1', GIT_GRAFT_FILE: os.devNull },
    });
    const stdout = [];
    const stderr = [];
    const timeout = setTimeout(() => child.kill(), Number(options.timeout || 20_000));
    child.stdout.on('data', (chunk) => stdout.push(chunk));
    child.stderr.on('data', (chunk) => stderr.push(chunk));
    child.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timeout);
      if (code !== 0) {
        reject(new Error(`git cat-file --batch failed in ${repoPath}: ${Buffer.concat(stderr).toString('utf8').trim()}`));
        return;
      }
      try {
        const output = Buffer.concat(stdout);
        const blobs = new Map();
        let offset = 0;
        for (const requested of ids) {
          const lineEnd = output.indexOf(0x0a, offset);
          if (lineEnd < 0) throw new Error(`missing cat-file header for ${requested}`);
          const header = output.subarray(offset, lineEnd).toString('utf8');
          const match = /^([0-9a-f]+) blob (\d+)$/.exec(header);
          if (!match) throw new Error(`unexpected cat-file header for ${requested}: ${header}`);
          const size = Number(match[2]);
          const contentStart = lineEnd + 1;
          const contentEnd = contentStart + size;
          blobs.set(requested, output.subarray(contentStart, contentEnd));
          offset = contentEnd + 1;
        }
        resolve(blobs);
      } catch (error) {
        reject(error);
      }
    });
    child.stdin.end(`${ids.join('\n')}\n`);
  });
}

export function sanitizeRemoteUrl(remoteUrl) {
  const value = String(remoteUrl || '').trim();
  if (!value) return '';
  try {
    const parsed = new URL(value);
    parsed.username = '';
    parsed.password = '';
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return value.replace(/^(https?:\/\/)[^/@]+@/i, '$1');
  }
}

export async function resolveGitDirectory(repoPath) {
  const absolute = await runGit(repoPath, ['rev-parse', '--absolute-git-dir'], { allowFailure: true });
  if (absolute.ok && absolute.stdout) return path.resolve(absolute.stdout);
  const relative = await runGit(repoPath, ['rev-parse', '--git-dir']);
  return path.resolve(repoPath, relative.stdout);
}

function parseStatusEntries(raw) {
  const records = String(raw || '').split('\0');
  const changes = [];
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    if (!record) continue;
    const status = record.slice(0, 2);
    const change = { status, path: record.slice(3) };
    if (/[RC]/.test(status)) {
      change.originalPath = records[index + 1] || '';
      index += 1;
    }
    changes.push(change);
  }
  return changes;
}

function classifyRepository(result) {
  const reasons = [];
  const actions = [];

  if (!result.fetch.ok && result.fetch.attempted) {
    reasons.push('fetch failed; remote state is not trustworthy');
    actions.push('fix authentication/network and rerun with --fetch');
  }
  if (result.unborn) {
    reasons.push('repository has no commits');
    actions.push('create and commit the initial repository state before synchronization');
  }
  if (result.detached) {
    reasons.push('HEAD is detached');
    actions.push('checkout a named branch');
  }
  if (!result.upstream) {
    reasons.push('branch has no upstream');
    actions.push('set an upstream branch before cross-device work');
  }
  if (result.upstream && !result.upstreamRemote) {
    reasons.push('upstream is not backed by a fetchable Git remote');
    actions.push('configure the branch upstream on one explicit remote');
  }
  if (result.upstreamRemote && !result.remoteTopologyValid) {
    reasons.push(`upstream remote ${result.upstreamRemote} does not resolve to exactly one fetch URL`);
    actions.push('remove ambiguous fetch URL configuration before synchronization');
  }
  if (result.dirty) {
    reasons.push(`worktree has ${result.dirtyCount} uncommitted path(s)`);
    actions.push('commit to a WIP/feature branch and push; do not rely on stash for handoff');
  }
  if (result.ahead > 0 && result.behind > 0) {
    reasons.push(`branch diverged: ahead ${result.ahead}, behind ${result.behind}`);
    actions.push('resolve with an explicit rebase or merge; never reset/force automatically');
  } else if (result.behind > 0) {
    reasons.push(`branch is behind upstream by ${result.behind}`);
    actions.push('update with git pull --ff-only');
  } else if (result.ahead > 0) {
    reasons.push(`branch has ${result.ahead} unpushed commit(s)`);
    actions.push('push and verify the remote SHA before handoff');
  }
  if (result.expectedSha && result.head !== result.expectedSha) {
    reasons.push(`HEAD ${result.head} does not match expected handoff SHA ${result.expectedSha}`);
    actions.push('fetch and checkout the exact handed-off commit before editing');
  }

  const hardBlocked = result.unborn
    || result.detached
    || !result.upstream
    || !result.upstreamRemote
    || !result.remoteTopologyValid
    || result.dirty
    || result.behind > 0
    || (result.fetch.attempted && !result.fetch.ok)
    || (result.expectedSha && result.head !== result.expectedSha);
  const state = hardBlocked ? 'blocked' : result.ahead > 0 ? 'handoff-required' : 'ready';
  if (!result.fetch.attempted) actions.push('rerun with --fetch before relying on remote equality');
  return { state, ready: state === 'ready', reasons, actions: [...new Set(actions)] };
}

export async function inspectGitRepository(repoPath, options = {}) {
  const repo = path.resolve(repoPath);
  let appleDoubleRemoved = 0;
  const inside = await runGit(repo, ['rev-parse', '--is-inside-work-tree'], { allowFailure: true });
  if (!inside.ok || inside.stdout !== 'true') {
    return {
      schemaVersion: 1,
      repo,
      state: 'blocked',
      ready: false,
      reasons: ['not a Git working tree'],
      actions: ['clone or initialize the repository before synchronization'],
    };
  }
  let gitDirectories = [];
  if (options.cleanupAppleDouble === true) {
    if (!(await isExactGitWorktree(repo))) throw new Error('AppleDouble cleanup requires the exact verified Git worktree root');
    const trackedWorktreeEntry = await runGit(repo, ['ls-files', '-z', '--', '._.git'], { trimOutput: false });
    const trackedWorktreePaths = String(trackedWorktreeEntry.stdout || '').split('\0').filter(Boolean);
    appleDoubleRemoved += (await removeUntrackedActionAppleDoubleArtifacts(
      repo,
      ['._.git'],
      trackedWorktreePaths,
      options,
    )).removedCount;
    const [worktreeGitDirectory, commonGitDirectory] = await Promise.all([
      runGit(repo, ['rev-parse', '--absolute-git-dir']),
      runGit(repo, ['rev-parse', '--path-format=absolute', '--git-common-dir']),
    ]);
    gitDirectories = [...new Set([worktreeGitDirectory.stdout, commonGitDirectory.stdout])];
    for (const gitDirectory of gitDirectories) {
      appleDoubleRemoved += (await cleanupGitAppleDoubleArtifacts(gitDirectory, options)).removedCount;
    }
  }

  const [initialBranch, initialUpstream] = await Promise.all([
    runGit(repo, ['symbolic-ref', '--short', '-q', 'HEAD'], { allowFailure: true }),
    runGit(repo, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}'], { allowFailure: true }),
  ]);
  const initialBranchName = initialBranch.ok ? initialBranch.stdout : '';
  const upstreamRemoteResult = initialBranchName
    ? await runGit(repo, ['config', '--get', `branch.${initialBranchName}.remote`], { allowFailure: true })
    : { ok: false, stdout: '' };
  const upstreamRemote = upstreamRemoteResult.ok && upstreamRemoteResult.stdout !== '.'
    ? upstreamRemoteResult.stdout
    : '';
  const fetch = { attempted: options.fetch === true, ok: true, remote: upstreamRemote, error: '' };
  if (fetch.attempted) {
    if (!initialUpstream.ok || !upstreamRemote) {
      fetch.ok = false;
      fetch.error = 'cannot fetch safely because the current branch has no fetchable upstream remote';
    } else {
      const fetched = await runGit(repo, ['-c', 'credential.interactive=never', 'fetch', '--prune', '--tags', '--', upstreamRemote], {
        allowFailure: true,
        timeout: options.fetchTimeout || 60_000,
        env: { GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'Never', GIT_SSH_COMMAND: 'ssh -o BatchMode=yes',
          COPYFILE_DISABLE: '1', COPY_EXTENDED_ATTRIBUTES_DISABLE: '1' },
      });
      fetch.ok = fetched.ok;
      fetch.error = fetched.ok ? '' : fetched.stderr || fetched.stdout;
      if (options.cleanupAppleDouble === true) {
        for (const gitDirectory of gitDirectories) {
          appleDoubleRemoved += (await cleanupGitAppleDoubleArtifacts(gitDirectory, options)).removedCount;
        }
      }
    }
  }

  const [headResult, branchResult, upstreamResult, statusResult, remoteResult] = await Promise.all([
    runGit(repo, ['rev-parse', 'HEAD'], { allowFailure: true }),
    runGit(repo, ['symbolic-ref', '--short', '-q', 'HEAD'], { allowFailure: true }),
    runGit(repo, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}'], { allowFailure: true }),
    runGit(repo, ['status', '--porcelain=v1', '-z'], { trimOutput: false }),
    upstreamRemote
      ? runGit(repo, ['remote', 'get-url', '--all', upstreamRemote], { allowFailure: true })
      : Promise.resolve({ ok: false, stdout: '' }),
  ]);

  const upstream = upstreamResult.ok ? upstreamResult.stdout : '';
  let ahead = 0;
  let behind = 0;
  let upstreamSha = '';
  if (upstream) {
    const [counts, sha] = await Promise.all([
      runGit(repo, ['rev-list', '--left-right', '--count', `HEAD...${upstream}`], { allowFailure: true }),
      runGit(repo, ['rev-parse', upstream], { allowFailure: true }),
    ]);
    if (counts.ok) {
      const [left, right] = counts.stdout.split(/\s+/).map(Number);
      ahead = Number.isFinite(left) ? left : 0;
      behind = Number.isFinite(right) ? right : 0;
    }
    upstreamSha = sha.ok ? sha.stdout : '';
  }

  const changes = parseStatusEntries(statusResult.stdout);
  const remoteUrls = remoteResult.ok
    ? remoteResult.stdout.split(/\r?\n/).map(sanitizeRemoteUrl).filter(Boolean)
    : [];
  const result = {
    schemaVersion: 1,
    repo,
    branch: branchResult.ok ? branchResult.stdout : '',
    unborn: !headResult.ok || !headResult.stdout,
    detached: !branchResult.ok || !branchResult.stdout,
    head: headResult.ok ? headResult.stdout : '',
    upstream,
    upstreamRemote,
    upstreamSha,
    ahead,
    behind,
    dirty: changes.length > 0,
    dirtyCount: changes.length,
    devrulesDirtyCount: changes.filter((entry) => entry.path === 'devrules' || entry.path.startsWith('devrules/')).length,
    changes,
    remote: remoteUrls.length === 1 ? remoteUrls[0] : '',
    remoteTopologyValid: remoteUrls.length === 1,
    expectedSha: String(options.expectedSha || ''),
    fetch,
    appleDoubleRemoved,
    checkedAt: new Date().toISOString(),
  };
  return { ...result, ...classifyRepository(result) };
}

export async function createHandoffRecord(repoPath, options = {}) {
  const status = await inspectGitRepository(repoPath, options);
  const reasons = [...(status.reasons || [])];
  if (!status.fetch?.attempted && options.allowStale !== true) {
    reasons.push('handoff requires a successful --fetch to verify the remote SHA');
  }
  const ready = status.ready && (status.fetch?.ok && status.fetch?.attempted || options.allowStale === true);
  return {
    schemaVersion: 1,
    kind: 'devrules-git-handoff',
    ready,
    repo: status.repo,
    remote: status.remote,
    branch: status.branch,
    commit: status.head,
    upstream: status.upstream,
    upstreamCommit: status.upstreamSha,
    deviceId: String(options.deviceId || ''),
    clean: !status.dirty,
    verifiedAt: new Date().toISOString(),
    nextDeviceCommand: status.head
      ? `devrules repo preflight --repo <repo> --fetch --expect-sha ${status.head}`
      : '',
    reasons,
  };
}
