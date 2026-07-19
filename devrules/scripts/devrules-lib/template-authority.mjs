import fs from 'node:fs/promises';
import path from 'node:path';

import { readGitHubReleaseTag } from './github-release-tag-readback.mjs';
import { isExactGitWorktree, runGit, sanitizeRemoteUrl } from './git-repository.mjs';
import { hash } from './template-file-fingerprint.mjs';

const TEMPLATE_MANIFEST_FILE = 'template.json';
const NON_INTERACTIVE_GIT_ENV = {
  GIT_TERMINAL_PROMPT: '0',
  GCM_INTERACTIVE: 'Never',
  GIT_SSH_COMMAND: 'ssh -o BatchMode=yes',
};

function normalizeManifest(parsed) {
  const revision = Number(parsed?.revision);
  return {
    schemaVersion: Number(parsed?.schemaVersion || 1),
    templateId: String(parsed?.templateId || '').trim(),
    version: String(parsed?.version || '').trim(),
    revision: Number.isInteger(revision) && revision >= 0 ? revision : -1,
    sourceRepository: sanitizeRemoteUrl(parsed?.sourceRepository || ''),
  };
}

function isSemanticVersion(value) {
  return /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(String(value || ''));
}

async function readAuthorityText(templateRoot, managedFiles, relPath, options = {}) {
  if (options.contentView === 'working-tree') {
    return fs.readFile(path.join(templateRoot, relPath), 'utf8').catch(() => '');
  }
  if (await isExactGitWorktree(templateRoot)) {
    const committed = await runGit(templateRoot, ['show', `HEAD:${relPath}`], { allowFailure: true, trimOutput: false });
    return committed.ok ? committed.stdout : '';
  }
  const managed = managedFiles.find((file) => file.relPath === relPath);
  if (managed?.content) return managed.content.toString('utf8');
  return fs.readFile(path.join(templateRoot, relPath), 'utf8').catch(() => '');
}

async function readToolVersion(templateRoot, managedFiles, options = {}) {
  const content = await readAuthorityText(templateRoot, managedFiles, 'scripts/devrules.mjs', options);
  return /\bconst\s+VERSION\s*=\s*['"]([^'"]+)['"]/.exec(content)?.[1] || '';
}

async function readChangelogVersion(templateRoot, managedFiles, options = {}) {
  const content = await readAuthorityText(templateRoot, managedFiles, 'CHANGELOG.md', options);
  return /^## \[([^\]]+)\]/m.exec(content)?.[1]?.trim() || '';
}

export function remoteIdentity(remoteUrl) {
  const value = sanitizeRemoteUrl(remoteUrl);
  const scpLike = /^(?:[^@]+@)?([^:]+):(.+)$/.exec(value);
  if (scpLike && !/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) {
    const repositoryPath = scpLike[2].replace(/^\/+/, '').replace(/\/$/, '').replace(/\.git$/i, '');
    return `${scpLike[1].toLowerCase()}/${repositoryPath}`;
  }
  try {
    const parsed = new URL(value);
    const authority = `${parsed.hostname.toLowerCase()}${parsed.port ? `:${parsed.port}` : ''}`;
    const repositoryPath = parsed.pathname.replace(/^\/+/, '').replace(/\/$/, '').replace(/\.git$/i, '');
    return `${authority}/${repositoryPath}${parsed.search}${parsed.hash}`;
  } catch {
    return value.replace(/\/$/, '').replace(/\.git$/i, '');
  }
}

function emptyTagMetadata(version) {
  return {
    tagName: version ? `v${version}` : '',
    tagAnnotated: false,
    tagObject: '',
    tagCommit: '',
    tagMatchesCommit: false,
    remoteTagObject: '',
    remoteTagCommit: '',
    tagRemoteVerified: false,
    tagPublished: false,
    remoteTagTransport: '',
  };
}

async function releaseTagMetadata(templateRoot, version, commit, remoteUrl, options = {}) {
  const metadata = emptyTagMetadata(version);
  if (!version || !commit) return metadata;
  const tagRef = `refs/tags/${metadata.tagName}`;
  const [tagObject, tagCommit] = await Promise.all([
    runGit(templateRoot, ['rev-parse', '--verify', `${tagRef}^{tag}`], { allowFailure: true }),
    runGit(templateRoot, ['rev-parse', '--verify', `${tagRef}^{commit}`], { allowFailure: true }),
  ]);
  const remoteQuery = options.remoteTagQuery || runGit;
  const remoteTag = options.verifyRemoteTag === true ? await remoteQuery(templateRoot, [
    '-c', 'credential.interactive=never',
    'ls-remote', '--tags', 'origin', tagRef, `${tagRef}^{}`,
  ], {
    allowFailure: true,
    timeout: 30_000,
    env: NON_INTERACTIVE_GIT_ENV,
  }) : { ok: false, stdout: '' };
  const remoteEntries = new Map(String(remoteTag.stdout || '').split(/\r?\n/).filter(Boolean).map((line) => {
    const [sha, ref] = line.split(/\s+/, 2);
    return [ref, sha];
  }));
  metadata.tagAnnotated = tagObject.ok && Boolean(tagObject.stdout);
  metadata.tagObject = metadata.tagAnnotated ? tagObject.stdout : '';
  metadata.tagCommit = tagCommit.ok ? tagCommit.stdout : '';
  metadata.tagMatchesCommit = metadata.tagCommit === commit;
  metadata.remoteTagObject = remoteEntries.get(tagRef) || '';
  metadata.remoteTagCommit = remoteEntries.get(`${tagRef}^{}`) || '';
  metadata.tagRemoteVerified = remoteTag.ok;
  metadata.remoteTagTransport = remoteTag.ok ? 'git' : '';
  if (options.verifyRemoteTag === true && !remoteTag.ok) {
    const fallbackQuery = options.githubTagReadback || readGitHubReleaseTag;
    const fallback = await fallbackQuery(remoteUrl, metadata.tagName, options);
    if (fallback?.ok === true) {
      metadata.remoteTagObject = String(fallback.tagObject || '');
      metadata.remoteTagCommit = String(fallback.tagCommit || '');
      metadata.tagRemoteVerified = true;
      metadata.remoteTagTransport = String(fallback.transport || 'github-rest');
    }
  }
  metadata.tagPublished = metadata.tagAnnotated
    && metadata.tagMatchesCommit
    && metadata.remoteTagObject === metadata.tagObject
    && metadata.remoteTagCommit === commit;
  return metadata;
}

export async function fetchTemplateSource(templateRoot) {
  return runGit(templateRoot, ['-c', 'credential.interactive=never', 'fetch', '--prune', '--tags', 'origin'], {
    allowFailure: true,
    timeout: 60_000,
    env: NON_INTERACTIVE_GIT_ENV,
  });
}

async function gitSourceMetadata(templateRoot, version, options) {
  const topLevel = await runGit(templateRoot, ['rev-parse', '--show-toplevel'], { allowFailure: true });
  const [gitRoot, requestedRoot] = await Promise.all([
    fs.realpath(topLevel.stdout || templateRoot).catch(() => path.resolve(topLevel.stdout || templateRoot)),
    fs.realpath(templateRoot).catch(() => path.resolve(templateRoot)),
  ]);
  if (!topLevel.ok || gitRoot !== requestedRoot) {
    return { isRepository: false, commit: '', dirty: false, remote: '', ...emptyTagMetadata(version) };
  }
  const [commit, status, branchResult, configuredRemotesResult, effectiveRemotesResult, effectivePushRemotesResult, upstreamResult, replaceRefsResult, gitDirectoryResult] = await Promise.all([
    runGit(templateRoot, ['rev-parse', 'HEAD'], { allowFailure: true }),
    runGit(templateRoot, ['status', '--porcelain=v1'], { allowFailure: true }),
    runGit(templateRoot, ['symbolic-ref', '--quiet', '--short', 'HEAD'], { allowFailure: true }),
    runGit(templateRoot, ['config', '--local', '--get-all', 'remote.origin.url'], { allowFailure: true }),
    runGit(templateRoot, ['remote', 'get-url', '--all', 'origin'], { allowFailure: true }),
    runGit(templateRoot, ['remote', 'get-url', '--all', '--push', 'origin'], { allowFailure: true }),
    runGit(templateRoot, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}'], { allowFailure: true }),
    runGit(templateRoot, ['for-each-ref', '--format=%(refname)', 'refs/replace/'], { allowFailure: true }),
    runGit(templateRoot, ['rev-parse', '--absolute-git-dir'], { allowFailure: true }),
  ]);
  const graftsPath = gitDirectoryResult.ok
    ? path.join(gitDirectoryResult.stdout, 'info', 'grafts')
    : '';
  const graftsContent = graftsPath ? await fs.readFile(graftsPath, 'utf8').catch(() => '') : '';
  const objectOverlayClean = replaceRefsResult.ok
    && !replaceRefsResult.stdout
    && !graftsContent.trim();
  const configuredRemotes = configuredRemotesResult.ok
    ? configuredRemotesResult.stdout.split(/\r?\n/).filter(Boolean).map(sanitizeRemoteUrl)
    : [];
  const effectiveRemotes = effectiveRemotesResult.ok
    ? effectiveRemotesResult.stdout.split(/\r?\n/).filter(Boolean).map(sanitizeRemoteUrl)
    : [];
  const effectivePushRemotes = effectivePushRemotesResult.ok
    ? effectivePushRemotesResult.stdout.split(/\r?\n/).filter(Boolean).map(sanitizeRemoteUrl)
    : [];
  const configuredRemote = configuredRemotes.length === 1 ? configuredRemotes[0] : '';
  const effectiveRemote = effectiveRemotes.length === 1 ? effectiveRemotes[0] : '';
  const effectivePushRemote = effectivePushRemotes.length === 1 ? effectivePushRemotes[0] : '';
  const remoteTopologyValid = Boolean(configuredRemote && effectiveRemote && effectivePushRemote)
    && remoteIdentity(configuredRemote) === remoteIdentity(effectiveRemote)
    && remoteIdentity(effectivePushRemote) === remoteIdentity(effectiveRemote);
  const upstream = upstreamResult.ok ? upstreamResult.stdout : '';
  const detached = !branchResult.ok || !branchResult.stdout;
  const upstreamIsOrigin = upstream.startsWith('origin/');
  const upstreamCommitResult = upstream
    ? await runGit(templateRoot, ['rev-parse', upstream], { allowFailure: true })
    : { ok: false, stdout: '' };
  const commitSha = commit.ok ? commit.stdout : '';
  const upstreamCommit = upstreamCommitResult.ok ? upstreamCommitResult.stdout : '';
  const tag = await releaseTagMetadata(templateRoot, version, commitSha, effectiveRemote, options);
  return {
    isRepository: true,
    commit: commitSha,
    dirty: status.ok ? Boolean(status.stdout) : true,
    remote: effectiveRemote,
    configuredRemote,
    effectivePushRemote,
    remoteTopologyValid,
    objectOverlayClean,
    upstream,
    upstreamCommit,
    upstreamIsOrigin,
    detached,
    published: Boolean(commitSha && upstreamIsOrigin && upstreamCommit === commitSha),
    ...tag,
  };
}

export async function readTemplateSource(templateRoot, managedFiles, options = {}) {
  const manifestText = await readAuthorityText(templateRoot, managedFiles, TEMPLATE_MANIFEST_FILE, options);
  let parsedManifest = {};
  try {
    parsedManifest = JSON.parse(manifestText || '{}');
  } catch {
    // The normalized invalid manifest is reported through the authority gate.
  }
  const manifest = normalizeManifest(parsedManifest);
  const [git, toolVersion, changelogVersion] = await Promise.all([
    gitSourceMetadata(templateRoot, manifest.version, options),
    readToolVersion(templateRoot, managedFiles, options),
    readChangelogVersion(templateRoot, managedFiles, options),
  ]);
  const manifestHash = hash(Buffer.from(managedFiles.map((file) => `${file.relPath}\0${file.sourceHash}`).join('\n')));
  const manifestValid = Boolean(manifest.templateId && isSemanticVersion(manifest.version) && manifest.revision >= 0 && manifest.sourceRepository);
  const versionMatchesTool = Boolean(toolVersion) && toolVersion === manifest.version;
  const versionMatchesChangelog = Boolean(changelogVersion) && changelogVersion === manifest.version;
  const remote = git.remote;
  const configuredRemote = git.configuredRemote;
  const declaredRemote = manifest.sourceRepository;
  const remoteMatchesDeclaration = !remote || !configuredRemote || !declaredRemote
    || remoteIdentity(remote) === remoteIdentity(declaredRemote)
      && remoteIdentity(configuredRemote) === remoteIdentity(declaredRemote);
  const managedIntegrityIssues = managedFiles.flatMap((file) => {
    const messages = [];
    if (file.integrityIssue) messages.push(file.integrityIssue);
    if (git.isRepository && file.sourceKind !== 'git-commit') messages.push('managed template payload is not committed in HEAD');
    return [...new Set(messages)].map((message) => ({ relPath: file.relPath, message }));
  });
  const managedCommits = [...new Set(managedFiles.map((file) => file.sourceCommit).filter(Boolean))];
  const managedCommitMatches = !git.isRepository || managedFiles.length === 0
    || (managedCommits.length === 1 && managedCommits[0] === git.commit);
  const managedIntegrityValid = managedIntegrityIssues.length === 0 && managedCommitMatches;
  const fixedReleaseAuthority = git.detached && git.tagAnnotated && git.tagMatchesCommit;
  const baseAuthority = manifestValid && versionMatchesTool && versionMatchesChangelog
    && git.isRepository && Boolean(git.commit) && Boolean(remote)
    && git.remoteTopologyValid && git.objectOverlayClean
    && remoteMatchesDeclaration && (git.published || fixedReleaseAuthority)
    && !git.dirty && managedIntegrityValid;
  return {
    schemaVersion: 1,
    contentView: options.contentView === 'working-tree' ? 'working-tree' : 'commit',
    templateId: manifest.templateId,
    version: manifest.version,
    toolVersion,
    versionMatchesTool,
    changelogVersion,
    versionMatchesChangelog,
    revision: manifest.revision,
    manifestHash,
    commit: git.commit,
    remote,
    configuredRemote,
    effectivePushRemote: git.effectivePushRemote,
    remoteTopologyValid: git.remoteTopologyValid,
    objectOverlayClean: git.objectOverlayClean,
    declaredRemote,
    remoteMatchesDeclaration,
    upstream: git.upstream,
    upstreamIsOrigin: git.upstreamIsOrigin,
    upstreamCommit: git.upstreamCommit,
    detached: git.detached,
    published: git.published,
    tagName: git.tagName,
    tagAnnotated: git.tagAnnotated,
    tagObject: git.tagObject,
    tagCommit: git.tagCommit,
    tagMatchesCommit: git.tagMatchesCommit,
    remoteTagObject: git.remoteTagObject,
    remoteTagCommit: git.remoteTagCommit,
    remoteTagTransport: git.remoteTagTransport,
    tagRemoteVerified: git.tagRemoteVerified,
    tagPublished: git.tagPublished,
    gitRepository: git.isRepository,
    dirty: git.dirty,
    managedIntegrityIssues,
    managedIntegrityValid,
    managedCommit: managedCommits.length === 1 ? managedCommits[0] : '',
    managedCommitMatches,
    manifestValid,
    fixedReleaseAuthority,
    authoritative: baseAuthority && git.tagAnnotated && git.tagMatchesCommit,
    remoteAuthoritative: baseAuthority && git.tagPublished,
  };
}

export function templateLocalAuditIssues(source) {
  const issues = [];
  if (!source.manifestValid) {
    issues.push({
      code: 'manifest',
      message: 'template.json must declare a templateId, semantic version, non-negative revision, and sourceRepository',
    });
  }
  return issues;
}

function templateSourceIntegrityIssues(source, options = {}) {
  const issues = [];
  if (options.fetchFailed) issues.push({ code: 'fetch', message: 'template fetch failed; remote authority was not verified' });
  if (!source.manifestValid) issues.push({ code: 'manifest', message: 'template.json must declare a templateId, semantic version, non-negative revision, and sourceRepository' });
  if (!source.versionMatchesTool) issues.push({ code: 'tool-version', message: `template version ${source.version || '<missing>'} does not match CLI version ${source.toolVersion || '<missing>'}` });
  if (!source.versionMatchesChangelog) issues.push({ code: 'changelog-version', message: `template version ${source.version || '<missing>'} does not match changelog release ${source.changelogVersion || '<missing>'}` });
  if (!source.gitRepository) issues.push({ code: 'git-root', message: 'template root is not an independent Git repository' });
  if (!source.commit) issues.push({ code: 'commit', message: 'template has no commit' });
  if (!source.remote) issues.push({ code: 'remote', message: 'template has no remote authority' });
  if (source.remote && !source.remoteTopologyValid) issues.push({ code: 'remote-topology', message: 'template origin must have one fetch URL and one equivalent push URL; URL rewrites and split authorities are not allowed' });
  if (!source.objectOverlayClean) issues.push({ code: 'object-overlay', message: 'template Git replace refs or grafts are present; canonical release objects cannot be verified' });
  if (!source.remoteMatchesDeclaration) issues.push({ code: 'remote-declaration', message: 'template remote does not match template.json sourceRepository' });
  return issues;
}

function templateReleaseTagIssues(source, options = {}) {
  const issues = [];
  if (!source.tagAnnotated) issues.push({ code: 'tag-annotated', message: `template release tag ${source.tagName || '<missing>'} is missing or is not annotated` });
  if (source.tagAnnotated && !source.tagMatchesCommit) issues.push({ code: 'tag-commit', message: `template release tag ${source.tagName} does not point to the template commit` });
  if (options.remoteVerificationRequested && source.tagAnnotated && source.tagMatchesCommit && !source.tagPublished) {
    issues.push(source.tagRemoteVerified
      ? { code: 'tag-publish', message: `template release tag ${source.tagName} is not published exactly to the configured remote` }
      : { code: 'tag-remote-query', message: `remote tag query for ${source.tagName} failed (network or authentication); tag publication was not verified` });
  }
  return issues;
}

function templateManagedIntegrityIssues(source) {
  const issues = [];
  for (const issue of source.managedIntegrityIssues || []) issues.push({ code: 'managed-integrity', message: `${issue.relPath}: ${issue.message}` });
  if (!source.managedCommitMatches) issues.push({ code: 'managed-commit', message: 'managed template payload was not collected from the current Git commit' });
  if (source.dirty) issues.push({ code: 'dirty', message: 'template Git worktree is dirty' });
  return issues;
}

export function templateReleaseAuditIssues(source, options = {}) {
  const issues = templateSourceIntegrityIssues(source, options);
  if (!source.upstream) issues.push({ code: 'upstream', message: 'template branch has no upstream' });
  if (source.upstream && !source.upstreamIsOrigin) issues.push({ code: 'upstream-remote', message: 'template branch upstream is not configured on origin' });
  if (source.upstream && !source.published) issues.push({ code: 'branch-publish', message: 'template commit is not published to its upstream' });
  issues.push(...templateReleaseTagIssues(source, options));
  issues.push(...templateManagedIntegrityIssues(source));
  return issues;
}

export function templateRuntimeAuditIssues(source, options = {}) {
  const issues = templateSourceIntegrityIssues(source, options);
  if (!source.detached) {
    if (!source.upstream) issues.push({ code: 'upstream', message: 'template branch has no upstream' });
    if (source.upstream && !source.upstreamIsOrigin) issues.push({ code: 'upstream-remote', message: 'template branch upstream is not configured on origin' });
    if (source.upstream && !source.published) issues.push({ code: 'branch-publish', message: 'template commit is not published to its upstream' });
  }
  issues.push(...templateReleaseTagIssues(source, options));
  issues.push(...templateManagedIntegrityIssues(source));
  return issues;
}

export function templateAuthorityIssues(source, options = {}) {
  return options.mode === 'local'
    ? templateLocalAuditIssues(source)
    : options.mode === 'runtime'
      ? templateRuntimeAuditIssues(source, options)
      : templateReleaseAuditIssues(source, options);
}
