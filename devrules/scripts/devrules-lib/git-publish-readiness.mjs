import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

import {
  PROJECT_INVENTORY_RELATIVE_PATH,
  loadDeveloperServiceAccounts,
} from './developer-services-registry.mjs';
import { validateDeveloperServicesProject } from './developer-services-validation.mjs';
import { pathExists, readJson } from './fs-actions.mjs';
import { inspectGitRepository, runGit } from './git-repository.mjs';

const execFileAsync = promisify(execFile);
const ACTIVE_BINDING_STATUSES = new Set(['active']);
const SENSITIVE_FILE_PATTERN = /(^|\/)(\.env(?:\..+)?|[^/]+\.(?:key|pem|p12|pfx|jks|keystore)|credentials?(?:\.[^/]+)?)$/i;
const GENERATED_SEGMENTS = new Set([
  '.build', '.gradle', '.next', '.nuxt', 'build', 'coverage', 'deriveddata',
  'dist', 'node_modules', 'out', 'target', 'temp', 'tmp',
]);
const GENERATED_FILE_PATTERN = /(^|\/)(?:\.DS_Store|Thumbs\.db|[^/]+\.(?:log|swp|tmp))$/i;

function normalizePath(value) {
  return String(value || '').replace(/\\/g, '/');
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function isGeneratedPath(filePath) {
  const normalized = normalizePath(filePath);
  if (GENERATED_FILE_PATTERN.test(normalized)) return true;
  return normalized.split('/').some((segment) => GENERATED_SEGMENTS.has(segment.toLowerCase()));
}

export function parseGitHubRemote(remoteUrl) {
  const value = String(remoteUrl || '').trim();
  if (!value) return null;
  let repositoryPath = '';
  try {
    const parsed = new URL(value);
    if (parsed.hostname.toLowerCase() !== 'github.com') return null;
    repositoryPath = parsed.pathname;
  } catch {
    const scpMatch = /^(?:[^@]+@)?github\.com:(.+)$/i.exec(value);
    if (!scpMatch) return null;
    repositoryPath = scpMatch[1];
  }
  const parts = repositoryPath.replace(/^\/+|\/+$/g, '').replace(/\.git$/i, '').split('/');
  if (parts.length !== 2 || parts.some((part) => !part)) return null;
  const [owner, repository] = parts;
  return { host: 'github.com', owner, repository, nameWithOwner: `${owner}/${repository}` };
}

function parseBranchRows(output, remote = false) {
  return String(output || '').split(/\r?\n/).filter(Boolean).map((line) => {
    const [name, commit, upstream = '', worktreePath = '', symref = ''] = line.split('\t');
    return {
      name,
      commit,
      upstream,
      worktreePath,
      symref,
      remote,
    };
  });
}

async function listBranches(repoPath) {
  const format = '%(refname:short)%09%(objectname)%09%(upstream:short)%09%(worktreepath)%09%(symref)';
  const [local, remote] = await Promise.all([
    runGit(repoPath, ['for-each-ref', `--format=${format}`, 'refs/heads/']),
    runGit(repoPath, ['for-each-ref', `--format=${format}`, 'refs/remotes/origin/']),
  ]);
  return {
    local: parseBranchRows(local.stdout),
    remote: parseBranchRows(remote.stdout, true).filter((branch) => !branch.symref),
  };
}

async function resolveDefaultBranch(repoPath, branches, requested) {
  if (requested) return String(requested).replace(/^origin\//, '');
  const originHead = await runGit(
    repoPath,
    ['symbolic-ref', '--quiet', '--short', 'refs/remotes/origin/HEAD'],
    { allowFailure: true },
  );
  if (originHead.ok && originHead.stdout) return originHead.stdout.replace(/^origin\//, '');
  if (branches.local.some((branch) => branch.name === 'main')) return 'main';
  if (branches.local.some((branch) => branch.name === 'master')) return 'master';
  return '';
}

async function isAncestor(repoPath, ancestor, descendant) {
  const result = await runGit(
    repoPath,
    ['merge-base', '--is-ancestor', ancestor, descendant],
    { allowFailure: true },
  );
  return result.ok;
}

async function divergence(repoPath, left, right) {
  const result = await runGit(
    repoPath,
    ['rev-list', '--left-right', '--count', `${left}...${right}`],
    { allowFailure: true },
  );
  if (!result.ok) return { available: false, ahead: 0, behind: 0 };
  const [ahead, behind] = result.stdout.split(/\s+/).map(Number);
  return {
    available: true,
    ahead: Number.isFinite(ahead) ? ahead : 0,
    behind: Number.isFinite(behind) ? behind : 0,
  };
}

function normalizeWipBranches(value) {
  return new Set(String(value || '').split(',').map((item) => item.trim()).filter(Boolean));
}

async function inspectBranches(repoPath, repoState, options) {
  const branches = await listBranches(repoPath);
  const defaultBranch = await resolveDefaultBranch(repoPath, branches, options.defaultBranch);
  const localDefault = branches.local.find((branch) => branch.name === defaultBranch) || null;
  const remoteDefault = branches.remote.find((branch) => branch.name === `origin/${defaultBranch}`) || null;
  const wipBranches = normalizeWipBranches(options.wipBranches);
  const localNonDefault = [];
  if (localDefault) {
    for (const branch of branches.local.filter((item) => item.name !== defaultBranch)) {
      const merged = await isAncestor(repoPath, branch.commit, localDefault.commit);
      const activeWorktree = Boolean(branch.worktreePath);
      localNonDefault.push({
        ...branch,
        merged,
        disposition: activeWorktree || wipBranches.has(branch.name)
          ? 'wip'
          : merged ? 'cleanup' : 'unclassified',
      });
    }
  }
  const localWipNames = new Set(
    localNonDefault.filter((branch) => branch.disposition === 'wip').map((branch) => branch.name),
  );
  const remoteNonDefault = [];
  if (remoteDefault) {
    for (const branch of branches.remote.filter((item) => item.name !== `origin/${defaultBranch}`)) {
      const shortName = branch.name.replace(/^origin\//, '');
      const mergedIntoRemoteDefault = await isAncestor(repoPath, branch.commit, remoteDefault.commit);
      const mergedIntoLocalDefault = localDefault
        ? await isAncestor(repoPath, branch.commit, localDefault.commit)
        : false;
      remoteNonDefault.push({
        ...branch,
        merged: mergedIntoLocalDefault,
        mergedIntoRemoteDefault,
        disposition: localWipNames.has(shortName) || wipBranches.has(shortName)
          ? 'wip'
          : mergedIntoRemoteDefault
            ? 'cleanup'
            : mergedIntoLocalDefault ? 'cleanup-after-push' : 'unclassified',
      });
    }
  }
  const remoteDivergence = localDefault && remoteDefault
    ? await divergence(repoPath, localDefault.commit, remoteDefault.commit)
    : { available: false, ahead: 0, behind: 0 };
  return {
    current: repoState.branch,
    default: defaultBranch,
    localDefault,
    remoteDefault,
    remoteDivergence,
    localNonDefault,
    remoteNonDefault,
    declaredWipBranches: [...wipBranches].sort(),
  };
}

async function inspectHygiene(repoPath, repoState) {
  const gitignorePath = path.join(repoPath, '.gitignore');
  const untracked = repoState.changes.filter((change) => change.status === '??');
  return {
    gitignore: {
      path: '.gitignore',
      exists: await pathExists(gitignorePath),
    },
    changes: repoState.changes,
    untracked,
    suspiciousUntracked: untracked.filter((change) => isGeneratedPath(change.path)),
    sensitiveUntracked: untracked.filter((change) => SENSITIVE_FILE_PATTERN.test(normalizePath(change.path))),
  };
}

function identifierValue(binding, kinds) {
  const wanted = new Set(kinds);
  const identifier = (binding?.target?.identifiers || []).find((item) => wanted.has(item.kind));
  return String(identifier?.value || '');
}

function accountIdentityValues(account) {
  return Object.values(account?.identity || {}).filter((value) => typeof value === 'string');
}

function expectedLogin(account, binding) {
  const direct = account?.identity?.login || account?.identity?.userLogin || '';
  if (direct) return String(direct);
  for (const automation of binding?.automation || []) {
    const login = (automation.expectedIdentity || []).find((item) => item.kind === 'login');
    if (login?.value) return String(login.value);
  }
  return '';
}

async function loadProjectGitHubBinding(repoPath, accountsDir, github, templateBinding) {
  const inventoryPath = path.join(repoPath, PROJECT_INVENTORY_RELATIVE_PATH);
  const accountState = await loadDeveloperServiceAccounts(accountsDir);
  let inventory = null;
  let inventoryError = '';
  if (await pathExists(inventoryPath)) {
    try {
      inventory = await readJson(inventoryPath);
    } catch (error) {
      inventoryError = error.message;
    }
  }
  const accountRecords = new Map([...accountState.accountsByRef].map(([ref, value]) => [ref, value.record]));
  const validation = inventory && !inventoryError
    ? validateDeveloperServicesProject(inventory, { filePath: inventoryPath, accountsByRef: accountRecords })
    : { errors: [], warnings: [] };
  const bindings = (inventory?.serviceBindings || []).filter((binding) => (
    binding.provider === 'github' && ACTIVE_BINDING_STATUSES.has(binding.status)
  ));
  const normalizedTarget = github.nameWithOwner.toLowerCase();
  let binding = bindings.find((item) => (
    identifierValue(item, ['repository', 'name-with-owner', 'github-repository']).toLowerCase() === normalizedTarget
  )) || null;
  let source = binding ? normalizePath(path.relative(repoPath, inventoryPath)) : '';
  if (!binding && templateBinding?.provider === 'github'
    && String(templateBinding.repository || '').toLowerCase() === normalizedTarget) {
    binding = {
      bindingId: 'shared-template-github-authority',
      provider: 'github',
      accountRef: templateBinding.accountRef,
      status: 'active',
      target: { identifiers: [{ kind: 'repository', value: templateBinding.repository }] },
      automation: [],
    };
    source = 'template.json:gitHosting';
  }
  const account = binding ? accountRecords.get(binding.accountRef) || null : null;
  const ownerMatches = accountIdentityValues(account)
    .some((value) => value.toLowerCase() === github.owner.toLowerCase());
  return {
    inventoryPath: normalizePath(path.relative(repoPath, inventoryPath)),
    inventoryPresent: Boolean(inventory),
    inventoryError,
    validationErrors: [...accountState.errors, ...validation.errors],
    binding,
    bindingSource: source,
    account,
    expectedLogin: expectedLogin(account, binding),
    ownerMatches,
  };
}

async function runGh(args) {
  try {
    const result = await execFileAsync('gh', args, {
      encoding: 'utf8',
      env: { ...process.env, GH_PROMPT_DISABLED: '1', GIT_TERMINAL_PROMPT: '0' },
      maxBuffer: 1024 * 1024,
      timeout: 30_000,
      windowsHide: true,
    });
    return { ok: true, stdout: result.stdout.trim(), stderr: result.stderr.trim() };
  } catch (error) {
    return {
      ok: false,
      stdout: String(error?.stdout || '').trim(),
      stderr: String(error?.stderr || error?.message || '').trim(),
    };
  }
}

export async function inspectGitHubHost(github, enabled, ghRunner = runGh) {
  if (!enabled) return { attempted: false, ok: false, login: '', repository: null, error: '' };
  const [loginResult, repositoryResult] = await Promise.all([
    ghRunner(['api', 'user', '--jq', '.login']),
    ghRunner(['repo', 'view', github.nameWithOwner, '--json', 'nameWithOwner,visibility,defaultBranchRef']),
  ]);
  let repository = null;
  if (repositoryResult.ok) {
    try {
      repository = JSON.parse(repositoryResult.stdout);
    } catch {
      repository = null;
    }
  }
  let finalRepositoryResult = repositoryResult;
  if (!repository) {
    const restResult = await ghRunner(['api', `repos/${github.owner}/${github.repository}`]);
    finalRepositoryResult = restResult;
    if (restResult.ok) {
      try {
        const parsed = JSON.parse(restResult.stdout);
        repository = {
          nameWithOwner: parsed.full_name || '',
          visibility: parsed.visibility || '',
          defaultBranchRef: { name: parsed.default_branch || '' },
        };
      } catch {
        repository = null;
      }
    }
  }
  return {
    attempted: true,
    ok: loginResult.ok && finalRepositoryResult.ok && Boolean(repository),
    login: loginResult.ok ? loginResult.stdout : '',
    repository,
    error: unique([
      loginResult.ok ? '' : loginResult.stderr,
      finalRepositoryResult.ok ? '' : finalRepositoryResult.stderr,
    ]).join('; '),
  };
}

async function inspectHosting(repoPath, repoState, options) {
  const github = parseGitHubRemote(repoState.remote);
  if (!repoState.remote) return { kind: 'missing', github: null, binding: null, hostVerification: null };
  if (!github) return { kind: 'other', github: null, binding: null, hostVerification: null };
  const binding = await loadProjectGitHubBinding(
    repoPath,
    options.accountsDir,
    github,
    options.templateBinding,
  );
  const hostVerification = await inspectGitHubHost(github, options.verifyHost === true);
  return { kind: 'github', github, binding, hostVerification };
}

function classifyReadiness(repoState, hygiene, branches, hosting) {
  const blockingReasons = [];
  const reviewReasons = [];
  const actions = [];
  if (!repoState.fetch.attempted) {
    blockingReasons.push('remote freshness was not fetched');
    actions.push('rerun with --fetch before publication');
  } else if (!repoState.fetch.ok) {
    blockingReasons.push('fetch failed; remote history is not trustworthy');
    actions.push('fix remote authentication/network access and fetch again');
  }
  if (repoState.dirty) {
    blockingReasons.push(`worktree has ${repoState.dirtyCount} uncommitted path(s)`);
    actions.push('classify every change, commit intended source, and remove or ignore generated artifacts');
  }
  if (!hygiene.gitignore.exists) {
    reviewReasons.push('.gitignore is missing');
    actions.push('confirm the repository needs no ignore rules or add project-appropriate rules');
  }
  if (hygiene.untracked.length > 0) {
    reviewReasons.push(`${hygiene.untracked.length} untracked path(s) need source-vs-artifact classification`);
  }
  if (hygiene.suspiciousUntracked.length > 0) {
    reviewReasons.push(`${hygiene.suspiciousUntracked.length} untracked path(s) resemble temporary/build output`);
    actions.push('add appropriate ignore rules and remove temporary/build output from the publish set');
  }
  if (hygiene.sensitiveUntracked.length > 0) {
    blockingReasons.push(`${hygiene.sensitiveUntracked.length} untracked path(s) may contain credentials or private keys`);
    actions.push('keep secret-bearing files untracked and prove they are ignored with git check-ignore');
  }
  if (!branches.default || !branches.localDefault) {
    blockingReasons.push('local default branch could not be resolved');
    actions.push('configure or create the intended default branch before publication');
  } else if (branches.current !== branches.default) {
    blockingReasons.push(`current branch ${branches.current || 'DETACHED'} is not default branch ${branches.default}`);
    actions.push('merge the verified completed branch into the default branch before pushing the final state');
  }
  if (!branches.remoteDefault) {
    blockingReasons.push('remote default branch is unavailable');
    actions.push('fetch the configured remote or create the private remote repository after selecting its account');
  } else if (branches.remoteDivergence.behind > 0) {
    blockingReasons.push(`local default branch is behind remote by ${branches.remoteDivergence.behind} commit(s)`);
    actions.push('pull with fast-forward when possible; otherwise inspect and merge remote changes without discarding content');
  }
  if (branches.remoteDivergence.ahead > 0 && branches.remoteDivergence.behind > 0) {
    blockingReasons.push('local and remote default branches have diverged');
    actions.push('resolve the divergence through an explicit reviewed merge; never reset or force-push');
  }
  const localCleanup = branches.localNonDefault.filter((branch) => branch.disposition === 'cleanup');
  const remoteCleanup = branches.remoteNonDefault.filter((branch) => branch.disposition === 'cleanup');
  const remoteCleanupAfterPush = branches.remoteNonDefault
    .filter((branch) => branch.disposition === 'cleanup-after-push');
  const unclassified = [
    ...branches.localNonDefault,
    ...branches.remoteNonDefault,
  ].filter((branch) => branch.disposition === 'unclassified');
  if (localCleanup.length > 0 || remoteCleanup.length > 0) {
    reviewReasons.push(`${localCleanup.length + remoteCleanup.length} merged non-default branch ref(s) remain to clean up`);
    actions.push('delete only verified merged local/remote branches; preserve active worktrees and unfinished work');
  }
  if (remoteCleanupAfterPush.length > 0) {
    actions.push(`after pushing the default branch, delete ${remoteCleanupAfterPush.length} remote branch ref(s) now preserved as pre-push backup`);
  }
  if (unclassified.length > 0) {
    reviewReasons.push(`${unclassified.length} unmerged branch ref(s) require completed-vs-WIP classification`);
    actions.push('merge tested completed work; declare intentional WIP with --wip-branches <a,b> and leave it unmerged');
  }
  if (hosting.kind === 'missing') {
    blockingReasons.push('origin remote is missing');
    actions.push('select the repository GitHub account, then create a private repository and configure origin');
  } else if (hosting.kind === 'github') {
    const { binding, hostVerification, github } = hosting;
    if (binding.inventoryError) blockingReasons.push(`GitHub inventory JSON is invalid: ${binding.inventoryError}`);
    if (binding.validationErrors.length > 0) {
      blockingReasons.push(`developer-service registry has ${binding.validationErrors.length} validation error(s)`);
    }
    if (!binding.binding) {
      blockingReasons.push(`no active GitHub binding selects ${github.nameWithOwner}`);
      actions.push('add an active github repository binding to the project developer-services inventory');
    } else if (!binding.account) {
      blockingReasons.push(`GitHub account record ${binding.binding.accountRef} is missing`);
    } else if (!binding.ownerMatches) {
      blockingReasons.push(`GitHub account record ${binding.binding.accountRef} does not identify owner ${github.owner}`);
    }
    if (!hostVerification.attempted) {
      blockingReasons.push('GitHub authenticated identity and repository readback were not verified');
      actions.push('rerun with --verify-host before pushing');
    } else if (!hostVerification.ok) {
      blockingReasons.push(`GitHub readback failed: ${hostVerification.error || 'unknown error'}`);
    } else {
      if (binding.expectedLogin
        && hostVerification.login.toLowerCase() !== binding.expectedLogin.toLowerCase()) {
        blockingReasons.push(`active gh login ${hostVerification.login} does not match configured ${binding.expectedLogin}`);
      }
      if (String(hostVerification.repository?.nameWithOwner || '').toLowerCase() !== github.nameWithOwner.toLowerCase()) {
        blockingReasons.push('GitHub repository readback does not match origin');
      }
      const hostDefault = hostVerification.repository?.defaultBranchRef?.name || '';
      if (hostDefault && branches.default && hostDefault !== branches.default) {
        blockingReasons.push(`GitHub default branch ${hostDefault} does not match local default ${branches.default}`);
      }
    }
  }
  const status = blockingReasons.length > 0 ? 'blocked' : reviewReasons.length > 0 ? 'review' : 'ready';
  return {
    status,
    ready: status === 'ready',
    blockingReasons: unique(blockingReasons),
    reviewReasons: unique(reviewReasons),
    actions: unique(actions),
  };
}

export async function inspectGitPublishReadiness(repoPath, options = {}) {
  const repo = path.resolve(repoPath);
  const repoState = await inspectGitRepository(repo, { fetch: options.fetch === true });
  if (!repoState.head) {
    return {
      schemaVersion: 1,
      kind: 'devrules-git-publish-readiness',
      repo,
      status: 'blocked',
      ready: false,
      blockingReasons: repoState.reasons || ['repository has no publishable commit'],
      reviewReasons: [],
      actions: repoState.actions || [],
      repository: repoState,
    };
  }
  const [hygiene, branches, hosting] = await Promise.all([
    inspectHygiene(repo, repoState),
    inspectBranches(repo, repoState, options),
    inspectHosting(repo, repoState, options),
  ]);
  const readiness = classifyReadiness(repoState, hygiene, branches, hosting);
  return {
    schemaVersion: 1,
    kind: 'devrules-git-publish-readiness',
    repo,
    ...readiness,
    repository: repoState,
    hygiene,
    branches,
    hosting,
    checkedAt: new Date().toISOString(),
  };
}
