import { spawn } from 'node:child_process';
import https from 'node:https';

const SHA_PATTERN = /^[0-9a-f]{40}$/;
const TAG_PATTERN = /^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const COMPONENT_PATTERN = /^[A-Za-z0-9_.-]+$/;

function repositoryParts(owner, repository) {
  const name = String(repository || '').replace(/\.git$/i, '');
  if (!COMPONENT_PATTERN.test(owner || '') || !COMPONENT_PATTERN.test(name)
    || ['.', '..'].includes(owner) || ['.', '..'].includes(name)) return null;
  return { owner, repository: name };
}

export function parseGitHubRepository(remoteUrl) {
  const value = String(remoteUrl || '').trim();
  const scp = /^(?:[^@]+@)?github\.com:([^/]+)\/([^/]+?)\/?$/i.exec(value);
  if (scp) return repositoryParts(scp[1], scp[2]);
  try {
    const parsed = new URL(value);
    if (parsed.hostname.toLowerCase() !== 'github.com' || parsed.port || parsed.search || parsed.hash
      || !['https:', 'ssh:'].includes(parsed.protocol)) return null;
    const parts = parsed.pathname.split('/').filter(Boolean);
    return parts.length === 2 ? repositoryParts(parts[0], parts[1]) : null;
  } catch {
    return null;
  }
}

function validToken(value) {
  const token = String(value || '');
  return token && !/[\r\n]/.test(token) ? token : '';
}

function tokenFromEnvironment(environment) {
  return validToken(environment.DEVRULES_GITHUB_TOKEN)
    || validToken(environment.GH_TOKEN)
    || validToken(environment.GITHUB_TOKEN);
}

function credentialToken(repository, options = {}) {
  const environment = options.env || process.env;
  const configured = tokenFromEnvironment(environment);
  if (configured) return Promise.resolve(configured);
  return new Promise((resolve) => {
    let settled = false;
    let stdout = '';
    const finish = (token = '') => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(validToken(token));
    };
    const child = spawn('git', ['credential', 'fill'], {
      stdio: ['pipe', 'pipe', 'ignore'],
      windowsHide: true,
      env: { ...environment, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'Never' },
    });
    const timer = setTimeout(() => {
      child.kill();
      finish();
    }, Number(options.credentialTimeout || 10_000));
    child.on('error', () => finish());
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString('utf8');
      if (stdout.length > 64 * 1024) {
        child.kill();
        finish();
      }
    });
    child.on('close', (code) => {
      if (code !== 0) return finish();
      const password = stdout.split(/\r?\n/).find((line) => line.startsWith('password='))?.slice('password='.length) || '';
      finish(password);
    });
    child.stdin.on('error', () => finish());
    child.stdin.end(`protocol=https\nhost=github.com\npath=${repository.owner}/${repository.repository}.git\n\n`);
  });
}

function getJson(url, token, options = {}) {
  return new Promise((resolve) => {
    let settled = false;
    let body = '';
    const finish = (value = null) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    const request = (options.httpsRequest || https.request)(url, {
      method: 'GET',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'User-Agent': 'devrules-template-authority',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    }, (response) => {
      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        body += chunk;
        if (body.length > 1024 * 1024) {
          request.destroy();
          finish();
        }
      });
      response.on('error', () => finish());
      response.on('end', () => {
        if (response.statusCode !== 200) return finish();
        try { finish(JSON.parse(body)); } catch { finish(); }
      });
    });
    request.setTimeout(Number(options.requestTimeout || 10_000), () => {
      request.destroy();
      finish();
    });
    request.on('error', () => finish());
    request.end();
  });
}

export async function readGitHubReleaseTag(remoteUrl, tagName, options = {}) {
  const repository = parseGitHubRepository(remoteUrl);
  if (!repository || !TAG_PATTERN.test(String(tagName || ''))) {
    return { ok: false, reason: 'unsupported GitHub release-tag authority' };
  }
  const provideCredential = options.credentialProvider || credentialToken;
  const token = validToken(await provideCredential(repository, options));
  if (!token) return { ok: false, reason: 'GitHub credential is unavailable' };
  const requestJson = options.requestJson || getJson;
  const base = `https://api.github.com/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.repository)}/git`;
  const reference = await requestJson(`${base}/ref/tags/${encodeURIComponent(tagName)}`, token, options);
  const tagObject = String(reference?.object?.sha || '');
  if (reference?.ref !== `refs/tags/${tagName}` || reference?.object?.type !== 'tag' || !SHA_PATTERN.test(tagObject)) {
    return { ok: false, reason: 'GitHub release reference is missing or is not annotated' };
  }
  const tag = await requestJson(`${base}/tags/${tagObject}`, token, options);
  const tagCommit = String(tag?.object?.sha || '');
  if (tag?.sha !== tagObject || tag?.tag !== tagName || tag?.object?.type !== 'commit' || !SHA_PATTERN.test(tagCommit)) {
    return { ok: false, reason: 'GitHub annotated tag object is invalid' };
  }
  return { ok: true, tagObject, tagCommit, transport: 'github-rest' };
}
