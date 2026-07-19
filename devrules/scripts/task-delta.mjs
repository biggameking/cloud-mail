#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const options = { command: argv[0] || 'status', repo: process.cwd(), json: false, replace: false, apply: false };
  for (let index = 1; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--repo') options.repo = path.resolve(argv[++index]);
    else if (token === '--id') options.id = argv[++index];
    else if (token === '--replace') options.replace = true;
    else if (token === '--apply') options.apply = true;
    else if (token === '--json') options.json = true;
    else throw new Error(`Unknown argument: ${token}`);
  }
  return options;
}

function git(repo, args) {
  return execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8' }).trim();
}

async function statePath(repo) {
  const gitDir = git(repo, ['rev-parse', '--path-format=absolute', '--git-dir']);
  return path.join(gitDir, 'devrules', 'task-baseline.json');
}

async function readState(target) {
  try {
    return JSON.parse(await fs.readFile(target, 'utf8'));
  } catch {
    return null;
  }
}

function runJson(script, args) {
  const result = spawnSync(process.execPath, [path.join(scriptDir, script), ...args, '--json'], { encoding: 'utf8' });
  if (result.status !== 0 && !result.stdout.trim()) throw new Error(result.stderr.trim() || `${script} failed`);
  return { status: result.status, value: JSON.parse(result.stdout) };
}

const options = parseArgs(process.argv.slice(2));
const repo = path.resolve(git(options.repo, ['rev-parse', '--show-toplevel']));
const target = await statePath(repo);
const state = await readState(target);

if (options.command === 'start') {
  if (state && !options.replace) throw new Error(`task baseline already exists at ${target}; use --replace for a new task`);
  const next = {
    schemaVersion: 1,
    id: options.id || null,
    baseSha: git(repo, ['rev-parse', 'HEAD']),
    startedAt: new Date().toISOString(),
  };
  if (options.apply) {
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  }
  const suffix = options.apply ? '' : ' (dry-run; rerun with --apply to record)';
  console.log(options.json
    ? JSON.stringify({ ...next, applied: options.apply }, null, 2)
    : `Task baseline: ${next.baseSha}${next.id ? ` (${next.id})` : ''}${suffix}`);
} else if (options.command === 'status' || options.command === 'audit') {
  if (!state?.baseSha) throw new Error('no task baseline; run task-delta.mjs start first');
  const verification = runJson('verification-plan.mjs', ['--repo', repo, '--base', state.baseSha]);
  const health = options.command === 'audit'
    ? runJson('code-health.mjs', ['audit', '--repo', repo, '--base', state.baseSha])
    : null;
  const report = { ...state, repo, verification: verification.value, codeHealth: health?.value || null };
  if (options.json) console.log(JSON.stringify(report, null, 2));
  else {
    console.log(`Task baseline: ${state.baseSha}${state.id ? ` (${state.id})` : ''}`);
    console.log(`Delta files: ${verification.value.files.length}; verification tier: ${verification.value.tier}`);
    if (health) console.log(`Code health: ${health.value.summary.status}; files: ${health.value.summary.files}`);
  }
  if (health && health.status !== 0) process.exitCode = health.status;
} else if (options.command === 'clear') {
  if (!options.apply) throw new Error('clear requires --apply');
  await fs.rm(target, { force: true });
  console.log('Task baseline cleared.');
} else {
  throw new Error('Usage: task-delta.mjs start|status|audit|clear --repo <dir> [--id <id>] [--replace] [--apply] [--json]; start and clear write only with --apply');
}
