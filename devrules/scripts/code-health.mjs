#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const DEFAULT_POLICY = {
  mode: 'advisory',
  fileLinesWarn: 500,
  fileLinesNoGrowth: 800,
  excludeDirs: [
    '.git', '.build', '.cache', '.codegraph', '.codex-copilot', '.gradle',
    '.mypy_cache', '.next', '.nox', '.omx', '.pytest_cache', '.ruff_cache',
    '.swiftpm', '.tox', '.venv', '__pycache__', 'build', 'coverage',
    'deriveddata', 'dist', 'generated', 'logs', 'node_modules', 'out', 'pods',
    'target', 'temp', 'tmp', 'vendor', 'venv',
  ],
  excludePaths: ['devrules/**'],
  largeFileAllowlist: [],
};

const SOURCE_EXTENSIONS = new Set([
  '.c', '.cc', '.cpp', '.cs', '.css', '.go', '.h', '.hpp', '.html', '.java',
  '.js', '.jsx', '.kt', '.kts', '.mjs', '.cjs', '.php', '.py', '.rb', '.rs',
  '.scala', '.scss', '.svelte', '.swift', '.ts', '.tsx', '.vue',
]);

const GENERIC_MODULE_NAMES = new Set([
  'common', 'helper', 'helpers', 'manager', 'managers', 'misc', 'util', 'utils',
]);

function parseArgs(argv) {
  const args = { command: 'audit', repo: process.cwd(), base: null, all: false, strict: false, json: false };
  const values = [...argv];
  if (values[0] && !values[0].startsWith('-')) args.command = values.shift();
  while (values.length > 0) {
    const token = values.shift();
    if (token === '--repo') args.repo = values.shift();
    else if (token === '--base') args.base = values.shift();
    else if (token === '--all') args.all = true;
    else if (token === '--strict') args.strict = true;
    else if (token === '--json') args.json = true;
    else if (token === '--help' || token === '-h') args.help = true;
    else throw new Error(`Unknown argument: ${token}`);
  }
  if (!args.repo) throw new Error('--repo requires a path');
  return args;
}

function usage() {
  return `code-health.mjs

Usage:
  node devrules/scripts/code-health.mjs audit [--repo <repo>] [--base <git-ref>] [--all] [--strict] [--json]
  node devrules/scripts/code-health.mjs profiles [--repo <repo>] [--json]

Defaults to a read-only advisory audit of changed and untracked source files.
--base includes committed task changes since a Git ref plus current changes.
--all scans all handwritten source files. --strict promotes warnings to failure.`;
}

async function pathExists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function readJson(target, fallback = {}) {
  try {
    return JSON.parse(await fs.readFile(target, 'utf8'));
  } catch {
    return fallback;
  }
}

function positiveInteger(value, fallback) {
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function stringList(value, fallback = []) {
  return Array.isArray(value) ? value.filter((item) => typeof item === 'string' && item.trim()) : fallback;
}

async function readPolicy(repo) {
  const config = await readJson(path.join(repo, 'devrules', 'config.json'));
  const local = config.codeHealth ?? {};
  return {
    mode: ['off', 'advisory', 'ratchet', 'strict'].includes(local.mode) ? local.mode : DEFAULT_POLICY.mode,
    fileLinesWarn: positiveInteger(local.fileLinesWarn, DEFAULT_POLICY.fileLinesWarn),
    fileLinesNoGrowth: positiveInteger(local.fileLinesNoGrowth, DEFAULT_POLICY.fileLinesNoGrowth),
    excludeDirs: [...new Set([...DEFAULT_POLICY.excludeDirs, ...stringList(local.excludeDirs)].map((item) => item.toLowerCase()))],
    excludePaths: [...new Set([...DEFAULT_POLICY.excludePaths, ...stringList(local.excludePaths)])],
    largeFileAllowlist: stringList(local.largeFileAllowlist),
  };
}

function toPosix(value) {
  return value.split(path.sep).join('/').replace(/^\.\//, '');
}

function globToRegExp(pattern) {
  let source = '^';
  const normalized = toPosix(pattern);
  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index];
    if (char === '*' && normalized[index + 1] === '*') {
      source += '.*';
      index += 1;
    } else if (char === '*') source += '[^/]*';
    else if (char === '?') source += '[^/]';
    else source += char.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
  }
  return new RegExp(`${source}$`);
}

function matchesAny(relativePath, patterns) {
  return patterns.some((pattern) => {
    const normalized = toPosix(pattern);
    return relativePath === normalized
      || relativePath.startsWith(`${normalized.replace(/\/$/, '')}/`)
      || globToRegExp(normalized).test(relativePath);
  });
}

function isSourceFile(relativePath) {
  return SOURCE_EXTENSIONS.has(path.extname(relativePath).toLowerCase());
}

function isExcluded(relativePath, policy) {
  const segments = toPosix(relativePath).split('/');
  return segments.some((segment) => policy.excludeDirs.includes(segment.toLowerCase()))
    || matchesAny(toPosix(relativePath), policy.excludePaths);
}

async function runGit(repo, args, allowFailure = false) {
  try {
    const result = await execFileAsync('git', ['-C', repo, ...args], {
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
      windowsHide: true,
    });
    return result.stdout.trim();
  } catch (error) {
    if (allowFailure) return '';
    throw new Error(`git ${args.join(' ')} failed: ${error.stderr?.trim() || error.message}`);
  }
}

async function resolveRepo(input) {
  const candidate = path.resolve(input);
  const root = await runGit(candidate, ['rev-parse', '--show-toplevel']);
  return path.resolve(root);
}

function lines(value) {
  return value ? value.split(/\r?\n/).filter(Boolean) : [];
}

async function changedFiles(repo, base = null) {
  const hasHead = Boolean(await runGit(repo, ['rev-parse', '--verify', 'HEAD'], true));
  const tracked = hasHead
    ? lines(await runGit(repo, ['diff', '--name-only', '--diff-filter=ACMR', base || 'HEAD', '--']))
    : lines(await runGit(repo, ['ls-files', '--cached']));
  const untracked = lines(await runGit(repo, ['ls-files', '--others', '--exclude-standard']));
  return [...new Set([...tracked, ...untracked].map(toPosix))].sort();
}

async function changeStats(repo, base = null) {
  const hasHead = Boolean(await runGit(repo, ['rev-parse', '--verify', 'HEAD'], true));
  const stats = new Map();
  if (hasHead) {
    for (const row of lines(await runGit(repo, ['diff', '--numstat', base || 'HEAD', '--']))) {
      const [addedRaw, deletedRaw, ...nameParts] = row.split('\t');
      const name = toPosix(nameParts.join('\t'));
      if (!name || addedRaw === '-' || deletedRaw === '-') continue;
      stats.set(name, { added: Number(addedRaw), deleted: Number(deletedRaw), untracked: false });
    }
  }
  for (const name of lines(await runGit(repo, ['ls-files', '--others', '--exclude-standard']))) {
    stats.set(toPosix(name), { added: null, deleted: 0, untracked: true });
  }
  return stats;
}

async function scanAll(repo, policy) {
  const results = [];
  async function visit(current, prefix = '') {
    const entries = await fs.readdir(current, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const relativePath = toPosix(path.join(prefix, entry.name));
      if (isExcluded(relativePath, policy)) continue;
      if (entry.isDirectory()) await visit(path.join(current, entry.name), relativePath);
      else if (entry.isFile() && isSourceFile(relativePath)) results.push(relativePath);
    }
  }
  await visit(repo);
  return results;
}

async function detectProfiles(repo) {
  const markers = [
    ['typescript-javascript', ['package.json', 'tsconfig.json', 'jsconfig.json']],
    ['rust', ['Cargo.toml']],
    ['python', ['pyproject.toml', 'requirements.txt', 'setup.py', 'Pipfile']],
    ['go', ['go.mod']],
    ['swift', ['Package.swift']],
  ];
  const profiles = [];
  for (const [profile, files] of markers) {
    if ((await Promise.all(files.map((file) => pathExists(path.join(repo, file))))).some(Boolean)) profiles.push(profile);
  }
  if (!profiles.includes('swift')) {
    const rootEntries = await fs.readdir(repo, { withFileTypes: true });
    if (rootEntries.some((entry) => entry.name.endsWith('.xcodeproj') || entry.name.endsWith('.xcworkspace'))) profiles.push('swift');
  }
  return profiles;
}

function countLines(text) {
  if (!text) return 0;
  return text.split(/\r\n|\r|\n/).length - (text.endsWith('\n') || text.endsWith('\r') ? 1 : 0);
}

function genericModuleName(relativePath) {
  const normalized = toPosix(relativePath);
  const segments = normalized.split('/');
  const fileStem = path.basename(normalized, path.extname(normalized)).toLowerCase();
  return GENERIC_MODULE_NAMES.has(fileStem)
    || segments.slice(0, -1).some((segment) => GENERIC_MODULE_NAMES.has(segment.toLowerCase()));
}

function issue(file, rule, severity, message) {
  return { file, rule, severity, message };
}

async function inspectFile(repo, relativePath, policy, stats, touched) {
  const absolutePath = path.join(repo, relativePath);
  if (!(await pathExists(absolutePath))) return [];
  const buffer = await fs.readFile(absolutePath);
  if (buffer.includes(0)) return [];
  const text = buffer.toString('utf8');
  const lineCount = countLines(text);
  const fileIssues = [];
  const allowlisted = matchesAny(relativePath, policy.largeFileAllowlist);
  const stat = stats.get(relativePath);
  const added = stat?.untracked ? lineCount : (stat?.added ?? 0);
  const deleted = stat?.deleted ?? 0;
  const growth = added - deleted;

  if (text.length > 0 && !text.endsWith('\n')) {
    fileIssues.push(issue(relativePath, 'final-newline', 'warning', 'Text file does not end with a newline.'));
  }
  const trailingWhitespaceLine = text.split(/\r?\n/).findIndex((line) => /[\t ]+$/.test(line));
  if (trailingWhitespaceLine >= 0) {
    fileIssues.push(issue(relativePath, 'trailing-whitespace', 'warning', `Trailing whitespace starts at line ${trailingWhitespaceLine + 1}.`));
  }
  if (!allowlisted && lineCount > policy.fileLinesWarn) {
    fileIssues.push(issue(relativePath, 'large-file-review', 'warning', `${lineCount} lines exceeds the ${policy.fileLinesWarn}-line review budget.`));
  }
  if (!allowlisted && touched && lineCount > policy.fileLinesNoGrowth && growth > 0) {
    const severity = ['ratchet', 'strict'].includes(policy.mode) ? 'error' : 'warning';
    fileIssues.push(issue(relativePath, 'large-file-no-growth', severity, `${lineCount} lines and +${growth} net lines grows a file above the ${policy.fileLinesNoGrowth}-line review signal.`));
  }
  const newFile = stat?.untracked || (stat && stat.deleted === 0 && added >= lineCount);
  if (newFile && genericModuleName(relativePath)) {
    fileIssues.push(issue(relativePath, 'generic-module-name', 'warning', 'New generic module name obscures ownership; prefer a domain or capability name.'));
  }
  return fileIssues;
}

function renderHuman(report) {
  const scope = report.all ? 'all source files' : (report.base ? `task delta since ${report.base}` : 'changed source files');
  const output = [
    `Code health: ${report.summary.status.toUpperCase()}`,
    `Repository: ${report.repo}`,
    `Policy: ${report.policy.mode}; scope: ${scope}; profiles: ${report.profiles.join(', ') || 'none detected'}`,
    `Files: ${report.summary.files}; errors: ${report.summary.errors}; warnings: ${report.summary.warnings}`,
  ];
  for (const item of report.issues) output.push(`${item.severity.toUpperCase()} ${item.file} [${item.rule}] ${item.message}`);
  return output.join('\n');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }
  const repo = await resolveRepo(args.repo);
  const profiles = await detectProfiles(repo);
  if (args.command === 'profiles') {
    const result = { repo, profiles };
    process.stdout.write(args.json ? `${JSON.stringify(result, null, 2)}\n` : `${profiles.join('\n') || 'No profile detected'}\n`);
    return;
  }
  if (args.command !== 'audit') throw new Error(`Unknown command: ${args.command}`);

  const policy = await readPolicy(repo);
  if (args.base && !(await runGit(repo, ['rev-parse', '--verify', `${args.base}^{commit}`], true))) {
    throw new Error(`--base is not a valid commit: ${args.base}`);
  }
  const stats = await changeStats(repo, args.base);
  const candidates = args.all ? await scanAll(repo, policy) : await changedFiles(repo, args.base);
  const files = candidates.filter((file) => isSourceFile(file) && !isExcluded(file, policy));
  const issues = [];
  if (policy.mode !== 'off') {
    for (const file of files) issues.push(...await inspectFile(repo, file, policy, stats, stats.has(file)));
  }
  issues.sort((a, b) => a.file.localeCompare(b.file) || a.rule.localeCompare(b.rule));
  const errors = issues.filter((item) => item.severity === 'error').length;
  const warnings = issues.length - errors;
  const strict = args.strict || policy.mode === 'strict';
  const failed = errors > 0 || (strict && warnings > 0);
  const report = {
    schemaVersion: 1,
    repo,
    base: args.base,
    all: args.all,
    policy,
    profiles,
    files,
    issues,
    summary: { files: files.length, errors, warnings, status: failed ? 'fail' : 'pass' },
  };
  process.stdout.write(args.json ? `${JSON.stringify(report, null, 2)}\n` : `${renderHuman(report)}\n`);
  if (failed && policy.mode !== 'advisory') process.exitCode = 1;
}

main().catch((error) => {
  process.stderr.write(`code-health: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 2;
});
