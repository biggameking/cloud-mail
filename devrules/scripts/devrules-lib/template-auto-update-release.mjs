import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { isExactGitWorktree, runGit } from './git-repository.mjs';
import { readTemplateSource, remoteIdentity } from './template-authority.mjs';
import { collectManagedTemplateFiles } from './template-sync.mjs';
import { TEMPLATE_SYNC_DIRS, TEMPLATE_SYNC_ROOT_FILES } from './repo-init-audit.mjs';

const GIT_ENV = {
  GIT_TERMINAL_PROMPT: '0',
  GCM_INTERACTIVE: 'Never',
  GIT_SSH_COMMAND: 'ssh -o BatchMode=yes',
};

function parseVersion(value) {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(String(value || ''));
  if (!match) return null;
  return { raw: String(value), numbers: match.slice(1, 4).map(Number), prerelease: match[4]?.split('.') || [] };
}

function comparePrerelease(left, right) {
  if (!left.length || !right.length) return left.length ? -1 : right.length ? 1 : 0;
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    if (left[index] === undefined) return -1;
    if (right[index] === undefined) return 1;
    const leftNumeric = /^\d+$/.test(left[index]);
    const rightNumeric = /^\d+$/.test(right[index]);
    if (leftNumeric && rightNumeric && Number(left[index]) !== Number(right[index])) return Number(left[index]) - Number(right[index]);
    if (leftNumeric !== rightNumeric) return leftNumeric ? -1 : 1;
    const comparison = left[index].localeCompare(right[index]);
    if (comparison) return comparison;
  }
  return 0;
}

export function compareSemanticVersions(leftValue, rightValue) {
  const left = parseVersion(leftValue), right = parseVersion(rightValue);
  if (!left || !right) throw new Error(`invalid semantic version comparison: ${leftValue}, ${rightValue}`);
  for (let index = 0; index < 3; index += 1) {
    if (left.numbers[index] !== right.numbers[index]) return left.numbers[index] - right.numbers[index];
  }
  return comparePrerelease(left.prerelease, right.prerelease);
}

function safeBranch(value) {
  const branch = String(value || '').trim();
  if (!branch || branch.startsWith('-') || branch.includes('..') || branch.includes('@{') || !/^[A-Za-z0-9._/-]+$/.test(branch)) {
    throw new Error(`invalid declared default branch: ${value || '<missing>'}`);
  }
  return branch;
}

async function readJson(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch (error) {
    throw new Error(`cannot read template manifest ${filePath}: ${error.message}`);
  }
}

function publicSource(source) {
  return {
    templateId: source.templateId,
    version: source.version,
    revision: source.revision,
    commit: source.commit,
    tagName: source.tagName,
    tagObject: source.tagObject,
    remote: source.remote,
  };
}

export async function inspectRuntimeTemplateRelease(templateRoot, options = {}) {
  const root = path.resolve(templateRoot);
  if (!(await isExactGitWorktree(root))) throw new Error(`runtime template must be an exact Git worktree: ${root}`);
  const managed = await collectManagedTemplateFiles(root, TEMPLATE_SYNC_DIRS, TEMPLATE_SYNC_ROOT_FILES);
  const source = await readTemplateSource(root, managed, { verifyRemoteTag: options.verifyRemote === true });
  const issues = [];
  if (!source.manifestValid || !source.versionMatchesTool || !source.versionMatchesChangelog) issues.push('release versions are inconsistent');
  if (!source.remoteTopologyValid || !source.remoteMatchesDeclaration) issues.push('remote topology does not match template declaration');
  if (!source.objectOverlayClean || !source.managedIntegrityValid || !source.managedCommitMatches) issues.push('committed template payload is not canonical');
  if (source.dirty || !source.tagAnnotated || !source.tagMatchesCommit) issues.push('HEAD is not a clean exact tagged release');
  if (options.verifyRemote === true && !source.tagRemoteVerified) {
    issues.push('remote release-tag query failed; publication could not be verified');
  } else if (options.verifyRemote === true ? !source.tagPublished : !source.authoritative) {
    issues.push(options.verifyRemote === true
      ? 'annotated release tag is not published exactly on origin'
      : 'local release authority is invalid');
  }
  if (issues.length) throw new Error(`runtime template release is not authoritative: ${issues.join('; ')}`);
  const manifest = await readJson(path.join(root, 'template.json'));
  return {
    root,
    manifest,
    defaultBranch: safeBranch(manifest?.gitHosting?.defaultBranch || 'main'),
    source,
    publicSource: publicSource(source),
  };
}

function tagRecords(output) {
  return String(output || '').split(/\r?\n/).filter(Boolean).map((line) => {
    const [name, objectType, objectId, commit] = line.split('|');
    return { name, version: name?.startsWith('v') ? name.slice(1) : '', objectType, objectId, commit: commit || '' };
  }).filter((entry) => parseVersion(entry.version));
}

async function cloneRemote(remote, destination, timeout) {
  const result = await runGit(path.dirname(destination), [
    'clone', '--no-checkout', '--origin', 'origin', remote, destination,
  ], { allowFailure: true, timeout: timeout || 120_000, env: GIT_ENV });
  if (!result.ok) throw new Error(`template release download failed: ${result.stderr || result.stdout || 'git clone failed'}`);
}

async function verifyObjectDatabaseClosed(repo, timeout) {
  const result = await runGit(repo, ['rev-list', '--objects', '--missing=print', '--all'], {
    allowFailure: true,
    timeout: timeout || 120_000,
  });
  if (!result.ok) throw new Error('candidate release object database could not be verified');
  if (String(result.stdout || '').split(/\r?\n/).some((line) => line.startsWith('?'))) {
    throw new Error('candidate release object database is incomplete');
  }
}

async function candidateTags(repo, currentVersion, includePrerelease) {
  const listed = await runGit(repo, [
    'for-each-ref', '--format=%(refname:short)|%(objecttype)|%(objectname)|%(*objectname)', 'refs/tags/v*',
  ]);
  return tagRecords(listed.stdout)
    .filter((entry) => compareSemanticVersions(entry.version, currentVersion) > 0)
    .filter((entry) => includePrerelease || parseVersion(entry.version).prerelease.length === 0)
    .sort((left, right) => compareSemanticVersions(right.version, left.version));
}

async function commitManifest(repo, commit) {
  const shown = await runGit(repo, ['show', `${commit}:template.json`], { allowFailure: true, trimOutput: false });
  if (!shown.ok) throw new Error('candidate release does not contain template.json');
  try {
    return JSON.parse(shown.stdout);
  } catch (error) {
    throw new Error(`candidate template.json is invalid: ${error.message}`);
  }
}

async function validateCandidate(repo, entry, current, timeout) {
  const manifest = await commitManifest(repo, entry.commit);
  const revision = Number(manifest?.revision);
  if (String(manifest?.version || '') !== entry.version) throw new Error(`${entry.name} does not match template.json version`);
  if (String(manifest?.templateId || '') !== current.source.templateId) throw new Error(`${entry.name} changes templateId`);
  if (!Number.isInteger(revision) || revision <= current.source.revision) throw new Error(`${entry.name} does not increase template revision`);
  if (remoteIdentity(manifest?.sourceRepository || '') !== remoteIdentity(current.source.declaredRemote)) throw new Error(`${entry.name} changes source repository`);
  const branch = safeBranch(manifest?.gitHosting?.defaultBranch || current.defaultBranch);
  if (branch !== current.defaultBranch) throw new Error(`${entry.name} changes the default branch`);
  const tip = await runGit(repo, ['rev-parse', `refs/remotes/origin/${branch}`], { allowFailure: true });
  if (!tip.ok || !(await runGit(repo, ['merge-base', '--is-ancestor', entry.commit, tip.stdout], { allowFailure: true })).ok) {
    throw new Error(`${entry.name} is not reachable from origin/${branch}`);
  }
  if (!(await runGit(repo, ['merge-base', '--is-ancestor', current.source.commit, entry.commit], { allowFailure: true })).ok) {
    throw new Error(`${entry.name} is not a descendant of the active release`);
  }
  const checkout = await runGit(repo, ['checkout', '--force', '--detach', entry.commit], {
    allowFailure: true,
    timeout: timeout || 120_000,
    env: GIT_ENV,
  });
  if (!checkout.ok) throw new Error(`cannot checkout fixed release ${entry.name}`);
  const candidate = await inspectRuntimeTemplateRelease(repo, { verifyRemote: true });
  if (candidate.source.version !== entry.version || candidate.source.revision !== revision
    || candidate.source.commit !== entry.commit || candidate.source.tagObject !== entry.objectId) {
    throw new Error(`${entry.name} identity changed during verification`);
  }
  return candidate;
}

export function resolveTemplateAutoUpdateReleasesDirectory(templateRoot, explicit) {
  if (explicit) return path.resolve(explicit);
  const parent = path.dirname(path.resolve(templateRoot));
  if (path.basename(parent) === 'releases') return parent;
  throw new Error('active runtime is not inside an immutable releases/v<version> layout; pass --releases-dir explicitly');
}

async function stagingLocation(currentRoot, options) {
  const releaseRoot = resolveTemplateAutoUpdateReleasesDirectory(currentRoot, options.releasesDirectory);
  const parent = options.apply === true ? releaseRoot : path.resolve(options.temporaryDirectory || os.tmpdir());
  await fs.mkdir(parent, { recursive: true });
  const prefix = options.apply === true ? '.template-auto-update-' : 'devrules-template-auto-update-';
  return { stagingRoot: await fs.mkdtemp(path.join(parent, prefix)), releasesDirectory: releaseRoot };
}

export async function removePreparedTemplateRelease(prepared) {
  if (!prepared?.stagingRoot) return;
  await fs.rm(prepared.stagingRoot, { recursive: true, force: true });
  prepared.stagingRoot = '';
}

export async function prepareTemplateReleaseUpdate(options) {
  const current = await inspectRuntimeTemplateRelease(options.templateRoot, { verifyRemote: true });
  const prepared = await stagingLocation(current.root, options);
  const rejected = [], blockedMajor = [];
  try {
    await cloneRemote(current.source.declaredRemote, prepared.stagingRoot, options.downloadTimeout);
    await verifyObjectDatabaseClosed(prepared.stagingRoot, options.downloadTimeout);
    for (const entry of await candidateTags(prepared.stagingRoot, current.source.version, options.includePrerelease === true)) {
      if (entry.objectType !== 'tag' || !entry.commit) {
        rejected.push({ tag: entry.name, reason: `${entry.name} is not an annotated release tag` });
        continue;
      }
      const candidateMajor = parseVersion(entry.version).numbers[0];
      const currentMajor = parseVersion(current.source.version).numbers[0];
      if (candidateMajor > currentMajor && options.allowMajor !== true) {
        blockedMajor.push({ tag: entry.name, version: entry.version, reason: `major update ${currentMajor} -> ${candidateMajor} requires explicit allowMajor` });
        continue;
      }
      try {
        const candidate = await validateCandidate(prepared.stagingRoot, entry, current, options.downloadTimeout);
        return {
          ...prepared,
          current,
          candidate,
          rejected,
          blockedMajor,
          releasePath: path.join(prepared.releasesDirectory, `v${candidate.source.version}`),
        };
      } catch (error) {
        rejected.push({ tag: entry.name, reason: error.message });
      }
    }
    await removePreparedTemplateRelease(prepared);
    return { ...prepared, current, candidate: null, rejected, blockedMajor, releasePath: '' };
  } catch (error) {
    await removePreparedTemplateRelease(prepared);
    throw error;
  }
}

async function existingRelease(releasePath, candidate) {
  const stat = await fs.lstat(releasePath).catch((error) => error?.code === 'ENOENT' ? null : Promise.reject(error));
  if (!stat) return null;
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`immutable release path is not a real directory: ${releasePath}`);
  const existing = await inspectRuntimeTemplateRelease(releasePath, { verifyRemote: true });
  if (existing.source.version !== candidate.source.version || existing.source.revision !== candidate.source.revision
    || existing.source.commit !== candidate.source.commit || existing.source.tagObject !== candidate.source.tagObject) {
    throw new Error(`immutable release path already contains different bytes: ${releasePath}`);
  }
  return existing;
}

export async function installPreparedTemplateRelease(prepared) {
  if (!prepared?.candidate || !prepared.stagingRoot) throw new Error('no verified release candidate is prepared');
  const existing = await existingRelease(prepared.releasePath, prepared.candidate);
  if (existing) {
    await removePreparedTemplateRelease(prepared);
    return { path: prepared.releasePath, installed: false, source: existing.publicSource };
  }
  await fs.rename(prepared.stagingRoot, prepared.releasePath);
  prepared.stagingRoot = '';
  const installed = await inspectRuntimeTemplateRelease(prepared.releasePath);
  if (installed.source.commit !== prepared.candidate.source.commit) throw new Error('installed release differs from verified candidate');
  return { path: prepared.releasePath, installed: true, source: installed.publicSource };
}
