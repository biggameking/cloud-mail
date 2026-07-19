import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const WORKFLOW_EXTENSIONS = new Set(['.yml', '.yaml']);
const POLICY_MODES = new Set(['inherit', 'allow', 'deny']);

async function listWorkflowFiles(directory, root = directory) {
  let entries;
  try {
    entries = await fs.readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }

  const files = [];
  for (const entry of entries) {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listWorkflowFiles(filePath, root));
    } else if (entry.isFile() && WORKFLOW_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      files.push(path.relative(root, filePath).split(path.sep).join('/'));
    }
  }
  return files.sort((left, right) => left.localeCompare(right));
}

async function readRepositoryPolicy(repoPath) {
  for (const configPath of [
    path.join(repoPath, 'devrules', 'config.json'),
    path.join(repoPath, 'devrules.config.json'),
    path.join(repoPath, 'config.json'),
  ]) {
    try {
      const config = JSON.parse(await fs.readFile(configPath, 'utf8'));
      const mode = config?.automation?.githubActionsPolicy;
      if (POLICY_MODES.has(mode)) return mode;
      if (config?.automation?.allowGitHubActions === true) return 'allow';
    } catch (error) {
      if (error?.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error;
    }
  }
  return null;
}

async function changedWorkflowFiles(repoPath, workflowFiles) {
  try {
    const { stdout } = await execFileAsync('git', [
      '-C',
      repoPath,
      'status',
      '--porcelain=v1',
      '--untracked-files=all',
      '--',
      '.github/workflows',
    ], { encoding: 'utf8' });
    const changedPaths = new Map();
    for (const line of stdout.split('\n')) {
      if (!line.trim()) continue;
      const status = line.slice(0, 2);
      const rawPath = line.slice(3).split(' -> ').at(-1)?.trim();
      if (!rawPath) continue;
      const prefix = '.github/workflows/';
      if (rawPath.startsWith(prefix)) changedPaths.set(rawPath.slice(prefix.length), status);
    }
    const materialChanges = [];
    for (const relativePath of workflowFiles) {
      const status = changedPaths.get(relativePath);
      if (!status) continue;
      if (status.includes('?') || status.includes('A') || status.includes('R') || status.includes('C')) {
        materialChanges.push(relativePath);
        continue;
      }

      const current = await fs.readFile(path.join(repoPath, '.github', 'workflows', relativePath), 'utf8');
      let baseline;
      try {
        const result = await execFileAsync('git', [
          '-C',
          repoPath,
          'show',
          `HEAD:.github/workflows/${relativePath}`,
        ], { encoding: 'utf8' });
        baseline = result.stdout;
      } catch {
        materialChanges.push(relativePath);
        continue;
      }
      if (normalizeWorkflowContent(current) !== normalizeWorkflowContent(baseline)) {
        materialChanges.push(relativePath);
      }
    }
    return materialChanges;
  } catch {
    // Without a Git baseline, an audit cannot prove that a workflow was just
    // introduced or modified. Preserve it and require approval at the actual
    // Agent change boundary instead of treating all existing files as defects.
    return [];
  }
}

function normalizeWorkflowContent(content) {
  return content
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .filter((line) => line.trim() && !line.trimStart().startsWith('#'))
    .map((line) => line.trimEnd())
    .join('\n');
}

async function resolvePolicyMode(repoPath, options) {
  if (POLICY_MODES.has(options.githubActionsPolicy)) return options.githubActionsPolicy;
  const repositoryMode = await readRepositoryPolicy(repoPath);
  if (repositoryMode) return repositoryMode;
  if (options.allowGitHubActions === true) return 'allow';
  return 'inherit';
}

export async function auditGitHubActionsPolicy(repoPath, options = {}) {
  const workflowRoot = path.join(repoPath, '.github', 'workflows');
  const workflowFiles = await listWorkflowFiles(workflowRoot);
  if (!workflowFiles.length) return [];

  const policyMode = await resolvePolicyMode(repoPath, options);
  if (policyMode === 'allow') return [];

  if (policyMode === 'deny') {
    return workflowFiles.map((relativePath) => ({
      severity: 'error',
      message: `GitHub Actions is explicitly denied by automation.githubActionsPolicy=deny, but .github/workflows/${relativePath} exists. Remove the workflow or change the project policy with the user's explicit approval.`,
    }));
  }

  const changedFiles = await changedWorkflowFiles(repoPath, workflowFiles);
  return changedFiles.map((relativePath) => ({
    severity: 'error',
    message: `Hosted CI approval is required before adding or materially modifying .github/workflows/${relativePath}. Existing committed workflows are preserved under automation.githubActionsPolicy=inherit; record an explicit allow only for the approved change.`,
  }));
}
