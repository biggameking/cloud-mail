#!/usr/bin/env node
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), 'verification-plan.mjs');

function plan(files) {
  const args = [script, '--json'];
  for (const file of files) args.push('--file', file);
  return JSON.parse(execFileSync(process.execPath, args, { encoding: 'utf8' }));
}

assert.equal(plan(['docs/setup.md']).tier, 'low');
assert.equal(plan(['Sources/Feature.swift', 'Tests/FeatureTests.swift']).tier, 'focused');
assert.equal(plan(['Sources/Auth/Session.swift']).tier, 'broad');
assert.equal(plan(['package-lock.json']).tier, 'broad');
assert.equal(plan(Array.from({ length: 13 }, (_, index) => `src/file-${index}.js`)).tier, 'broad');

console.log('verification plan selftest: PASS');
