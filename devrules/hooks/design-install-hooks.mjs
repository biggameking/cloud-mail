#!/usr/bin/env node
// Install the devrules design gate git hooks by pointing core.hooksPath at the
// design-githooks directory that ships next to this script.
//
//   node devrules/hooks/design-install-hooks.mjs
//
// Projects already using husky or a custom hooksPath are not overwritten; the
// script prints how to append one call to the existing pre-commit instead.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

let root;
try {
  root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
} catch {
  console.error('[devrules] current directory is not a git repository; cannot install hooks');
  process.exit(1);
}

// Resolve the hooks directory relative to this script so both layouts work:
// project instances (<repo>/devrules/hooks/...) and the shared template root
// (<repo>/hooks/...).
const here = path.dirname(fileURLToPath(import.meta.url));
const hooksDirAbs = path.join(here, 'design-githooks');
const hooksDirRel = path.relative(root, hooksDirAbs).split(path.sep).join('/');
const preCommitRel = path.relative(root, path.join(here, 'design-pre-commit.mjs')).split(path.sep).join('/');
const shim = path.join(hooksDirAbs, 'pre-commit');

if (!hooksDirRel || hooksDirRel.startsWith('..')) {
  console.error(`[devrules] hooks directory ${hooksDirAbs} is outside the repository ${root}`);
  process.exit(1);
}

if (!fs.existsSync(shim)) {
  console.error(`[devrules] ${hooksDirRel}/pre-commit not found; ensure the devrules hooks directory is complete`);
  process.exit(1);
}

// Git for Windows sh rejects CRLF shebang scripts; normalize the shim to LF.
const content = fs.readFileSync(shim, 'utf8');
if (content.includes('\r\n')) {
  fs.writeFileSync(shim, content.split('\r\n').join('\n'), 'utf8');
  console.log('[devrules] normalized the pre-commit shim to LF line endings');
}

let existing = '';
try {
  existing = execFileSync('git', ['config', '--get', 'core.hooksPath'], { cwd: root, encoding: 'utf8' }).trim();
} catch {
  existing = '';
}

if (existing && existing !== hooksDirRel) {
  console.log(`[devrules] existing core.hooksPath = ${existing} detected (possibly husky); leaving it untouched.`);
  console.log('[devrules] append this line to the existing pre-commit script instead:');
  console.log(`    node ${preCommitRel} || exit 1`);
  process.exit(0);
}

execFileSync('git', ['config', 'core.hooksPath', hooksDirRel], { cwd: root });
console.log(`[devrules] installed: core.hooksPath -> ${hooksDirRel}`);
console.log('[devrules] each commit now runs: design-lint (when DESIGN.md changed) + design-sync --check + design-guard --staged');
console.log('[devrules] uninstall with: git config --unset core.hooksPath');
