#!/usr/bin/env node
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), 'task-delta.mjs');
const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'devrules-task-delta-'));
const run = (command, args = []) => execFileSync(command, args, { cwd: temp, encoding: 'utf8' });
run('git', ['init', '-q']);
run('git', ['config', 'user.email', 'test@example.com']);
run('git', ['config', 'user.name', 'Test']);
await fs.mkdir(path.join(temp, 'src'));
await fs.writeFile(path.join(temp, 'src', 'one.js'), 'export const one = 1;\n');
run('git', ['add', '.']);
run('git', ['commit', '-qm', 'base']);
const dryRun = JSON.parse(run(process.execPath, [script, 'start', '--repo', temp, '--id', 'selftest', '--json']));
assert.equal(dryRun.applied, false, 'start without --apply must be a dry-run');
let dryRunWrote = true;
try {
  run(process.execPath, [script, 'status', '--repo', temp, '--json']);
} catch {
  dryRunWrote = false;
}
assert.equal(dryRunWrote, false, 'dry-run start must not record a baseline');
run(process.execPath, [script, 'start', '--repo', temp, '--id', 'selftest', '--apply']);
await fs.writeFile(path.join(temp, 'src', 'one.js'), 'export const one = 2;\n');
run('git', ['add', '.']);
run('git', ['commit', '-qm', 'phase one']);
await fs.writeFile(path.join(temp, 'src', 'two.js'), 'export const two = 2;\n');

const report = JSON.parse(run(process.execPath, [script, 'audit', '--repo', temp, '--json']));
assert.deepEqual(report.verification.files, ['src/one.js', 'src/two.js']);
assert.equal(report.verification.tier, 'focused');
assert.deepEqual(report.codeHealth.files, ['src/one.js', 'src/two.js']);
await fs.rm(temp, { recursive: true, force: true });
console.log('task delta selftest: PASS');
