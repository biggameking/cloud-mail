#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';

const DOC_RE = /(^|\/)(docs?|readme|changelog)(\/|\.|$)|\.(md|mdx|txt|rst)$/i;
const EXECUTABLE_RE = /\.(ts|tsx|js|jsx|mjs|cjs|py|rs|go|swift|kt|java|c|cc|cpp|h|hpp|m|mm|rb|php|sh|sql)$/i;
const BROAD_RE = /(^|\/)(migrations?|schema|database|auth|security|permissions?|billing|payments?|public|api|contracts?|release|signing)(\/|\.|$)|(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|Package\.resolved|Podfile\.lock|Cargo\.lock|go\.sum|project\.pbxproj)$/i;

function parseArgs(argv) {
  const options = { repo: process.cwd(), base: null, files: [], json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--repo') options.repo = path.resolve(argv[++index]);
    else if (token === '--base') options.base = argv[++index];
    else if (token === '--file') options.files.push(argv[++index]);
    else if (token === '--json') options.json = true;
    else if (token === '--help' || token === '-h') options.help = true;
    else throw new Error(`Unknown argument: ${token}`);
  }
  return options;
}

function gitLines(repo, args) {
  try {
    return execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8' })
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function changedFiles(repo, base = null) {
  return [...new Set([
    ...gitLines(repo, ['diff', '--name-only', base || 'HEAD', '--']),
    ...gitLines(repo, ['ls-files', '--others', '--exclude-standard']),
  ])].sort();
}

function classify(files) {
  if (files.length === 0) {
    return { tier: 'none', reasons: ['no changed files'], gates: [] };
  }
  const executable = files.filter((file) => EXECUTABLE_RE.test(file));
  const broad = files.filter((file) => BROAD_RE.test(file));
  if (executable.length === 0 && files.every((file) => DOC_RE.test(file) || !path.extname(file))) {
    return {
      tier: 'low',
      reasons: ['changed paths contain no recognized executable source'],
      gates: ['diff-check', 'owner-specific document or generator check when available'],
    };
  }
  if (broad.length > 0 || files.length > 12) {
    return {
      tier: 'broad',
      reasons: [
        ...(broad.length > 0 ? [`sensitive boundary paths: ${broad.join(', ')}`] : []),
        ...(files.length > 12 ? [`change spans ${files.length} files`] : []),
      ],
      gates: ['focused regression checks', 'affected integration/build/contract checks', 'code-health audit', 'architecture or release evidence when applicable'],
    };
  }
  return {
    tier: 'focused',
    reasons: [`${executable.length} executable source path(s) inside a bounded change`],
    gates: ['focused regression or repeatable behavior check', 'relevant static check', 'code-health audit'],
  };
}

function printHuman(plan) {
  console.log(`Verification tier: ${plan.tier}`);
  console.log(`Changed files: ${plan.files.length}`);
  for (const reason of plan.reasons) console.log(`Reason: ${reason}`);
  for (const gate of plan.gates) console.log(`Gate: ${gate}`);
}

const options = parseArgs(process.argv.slice(2));
if (options.help) {
  console.log('Usage: node verification-plan.mjs [--repo <dir>] [--base <git-ref>] [--file <path> ...] [--json]');
} else {
  const files = options.files.length > 0 ? [...new Set(options.files)].sort() : changedFiles(options.repo, options.base);
  const plan = { repo: options.repo, base: options.base, files, ...classify(files) };
  if (options.json) console.log(JSON.stringify(plan, null, 2));
  else printHuman(plan);
}
