#!/usr/bin/env node
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), 'xcode-verification-plan.mjs');
const base = [script, '--project', 'App.xcodeproj', '--scheme', 'App', '--udid', 'AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE', '--derived-data', '/tmp/app-derived'];
const focused = JSON.parse(execFileSync(process.execPath, [...base, '--tier', 'focused', '--only-testing', 'AppTests/FeatureTests', '--json'], { encoding: 'utf8' }));

assert.equal(focused.build.length, 1);
assert.match(focused.build[0], /build-for-testing/);
assert.equal(focused.test.length, 1);
assert.match(focused.test[0], /test-without-building/);
assert.match(focused.test[0], /-only-testing:AppTests\/FeatureTests/);
assert.doesNotMatch(focused.test[0], /\bxcodebuild test\b/);

const missingFilter = spawnSync(process.execPath, [...base, '--tier', 'focused'], { encoding: 'utf8' });
assert.notEqual(missingFilter.status, 0);
assert.match(missingFilter.stderr, /requires at least one --only-testing/);

console.log('xcode verification plan selftest: PASS');
