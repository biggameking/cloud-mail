import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { listDirs, pathExists } from './fs-actions.mjs';
import { safeRealpath } from './workspace-runtime.mjs';

const execFileAsync = promisify(execFile);

export const SKIP_DIRS = new Set([
  '.git',
  '.build',
  '.codegraph',
  '.codex-copilot',
  '.gradle',
  '.mypy_cache',
  '.nox',
  '.omx',
  '.pytest_cache',
  '.ruff_cache',
  '.tox',
  'node_modules',
  'dist',
  'build',
  '.next',
  '.swiftpm',
  '.venv',
  'venv',
  '__pycache__',
  'target',
  'coverage',
  '.cache',
  '.godot',
  'deriveddata',
  'generated',
  'logs',
  'out',
  'pods',
  'temp',
  'tmp',
  'vendor',
  'devrules',
]);

export async function isGitRepo(dirPath) {
  if (await pathExists(path.join(dirPath, '.git'))) return true;
  try {
    const { stdout } = await execFileAsync('git', ['-C', dirPath, 'rev-parse', '--show-toplevel'], { timeout: 5000 });
    return safeRealpath(stdout.trim()) === safeRealpath(dirPath);
  } catch {
    return false;
  }
}

export async function declaresTemplateIdentity(dirPath, templateId) {
  const manifestPath = path.join(dirPath, 'template.json');
  try {
    const stat = await fs.lstat(manifestPath);
    if (!stat.isFile() || stat.isSymbolicLink()) return false;
    const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
    return String(manifest?.templateId || '') === String(templateId || '');
  } catch {
    return false;
  }
}

export async function isNestedGitRepoDir(dirPath) {
  return pathExists(path.join(dirPath, '.git'));
}

export async function findGitRepos(root, recursive = false) {
  const repos = [];
  const dirs = await listDirs(root);

  for (const dir of dirs) {
    const name = path.basename(dir).toLowerCase();
    if (SKIP_DIRS.has(name)) continue;
    if (await isGitRepo(dir)) {
      repos.push(dir);
      continue;
    }
    if (recursive) {
      const nested = await findGitRepos(dir, true);
      repos.push(...nested);
    }
  }

  return repos.sort((a, b) => a.localeCompare(b));
}
