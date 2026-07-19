#!/usr/bin/env node
// devrules design gate pre-commit (cross-platform, invoked by the
// hooks/design-githooks/pre-commit shim).
//
// Three checks must all pass before the commit proceeds:
//   1. When DESIGN.md is staged -> design-lint (source of truth must be clean; offline mode, fast)
//   2. design-sync --check      -> DESIGN.md and generated artifacts are in sync and unedited
//   3. design-guard --staged    -> staged source contains no hardcoded UI values
//
// Emergency escape (not recommended): DEVRULES_SKIP=1 git commit ...  or git commit --no-verify

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync, execFileSync } from 'node:child_process';

if (process.env.DEVRULES_SKIP === '1') {
  console.log('[devrules] DEVRULES_SKIP=1, skipping the design gate (run design:check and design:guard soon)');
  process.exit(0);
}

const here = path.dirname(fileURLToPath(import.meta.url));
const scriptsDir = path.join(here, '..', 'scripts');

let root;
try {
  root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
} catch {
  root = process.cwd();
}

let staged = [];
try {
  staged = execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR'], { cwd: root, encoding: 'utf8' })
    .split(/\r?\n/).filter(Boolean).map((f) => f.split('\\').join('/'));
} catch {
  // Not a git environment: let the commit pass (should not happen; the shim is invoked by git).
  process.exit(0);
}

const run = (label, args) => {
  console.log(`\n[devrules pre-commit] ${label}`);
  const r = spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit' });
  return r.status === 0;
};

let ok = true;
const designStaged = staged.some((f) => /(^|\/)DESIGN\.md$/.test(f));

if (designStaged) {
  ok = run('1/3 validate DESIGN.md (design-lint --offline)', [path.join(scriptsDir, 'design-lint.mjs'), '--offline']) && ok;
} else {
  console.log('[devrules pre-commit] 1/3 DESIGN.md unchanged, skipping lint');
}

ok = run('2/3 verify token sync (design-sync --check)', [path.join(scriptsDir, 'design-sync.mjs'), '--check']) && ok;
ok = run('3/3 scan staged files for hardcoded values (design-guard --staged)', [path.join(scriptsDir, 'design-guard.mjs'), '--staged']) && ok;

if (!ok) {
  console.error(
    '\n[devrules pre-commit] design gate failed.' +
    '\n  - DESIGN.md changed: run npm run design:sync and commit the generated artifacts together' +
    '\n  - hardcoded values: switch to semantic tokens (see DESIGN.md / devrules/rules/design-agent-rules.md); register a justified exemption in design-guard.allow.json' +
    '\n  - detailed process: see devrules/workflows/',
  );
  process.exit(1);
}
console.log('\n[devrules pre-commit] design gate passed');
