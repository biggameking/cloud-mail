#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const hook = path.join(root, 'hooks', 'codex-global-code-health-hook.mjs');
const alwaysReadme = await fs.readFile(path.join(root, 'always-readme.md'), 'utf8');
const entryLines = alwaysReadme.split('\n').length;
const entryBytes = Buffer.byteLength(alwaysReadme);
const entryAdvisories = [];

if (entryLines > 150) entryAdvisories.push(`${entryLines} lines exceeds the 150-line review signal`);
if (entryBytes > 9_000) entryAdvisories.push(`${entryBytes} bytes exceeds the 9 KB review signal`);
assert.doesNotMatch(alwaysReadme, /read `hooks\/hooks\.json`.*default/i);
assert.match(alwaysReadme, /authoritative shared engineering context/i);
assert.doesNotMatch(alwaysReadme, /read the repository entry file and this file/i, 'devrules must not route back through Agent entry files');

const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'devrules-routing-'));
const repo = path.join(temp, 'repo');
await fs.mkdir(path.join(repo, '.git'), { recursive: true });
await fs.mkdir(path.join(repo, 'devrules', 'hooks'), { recursive: true });
await fs.mkdir(path.join(repo, 'devrules', 'scripts'), { recursive: true });
await fs.writeFile(path.join(repo, 'devrules', 'always-readme.md'), alwaysReadme);
await fs.copyFile(path.join(root, 'hooks', 'hooks.json'), path.join(repo, 'devrules', 'hooks', 'hooks.json'));
await fs.writeFile(path.join(repo, 'devrules', 'hooks', 'hooks.local.json'), `${JSON.stringify({
  schemaVersion: 3,
  hooks: [{
    id: 'conditional-fixture',
    promptPatterns: ['conditional-fixture'],
    workflows: [
      {
        target: 'ios-only.md',
        activation: 'conditional',
        primary: true,
        condition: { source: 'context', pattern: '\\bios\\b' },
      },
      { target: 'web.md', activation: 'always' },
    ],
    read: [],
    scope: 'local',
  }],
}, null, 2)}\n`, 'utf8');
await fs.writeFile(path.join(repo, 'devrules', 'scripts', 'code-health.mjs'), '');
const idleInvocationLog = path.join(temp, 'idle-invocation.log');
await fs.writeFile(path.join(repo, 'devrules', 'scripts', 'idle-resource-maintenance.mjs'), `
import fs from 'node:fs';
fs.appendFileSync(process.env.DEVRULES_ROUTING_TEST_LOG, process.argv.slice(2).join(' ') + '\\n');
process.stdout.write(JSON.stringify({ healthy: true, status: 'pass', scheduler: 'fixture' }));
`, 'utf8');
await fs.writeFile(path.join(repo, 'Package.swift'), '');

function invokeRaw(payload) {
  const started = performance.now();
  const result = spawnSync(process.execPath, [hook], {
    cwd: repo,
    input: JSON.stringify(payload),
    encoding: 'utf8',
    env: { ...process.env, DEVRULES_ROUTING_TEST_LOG: idleInvocationLog },
  });
  assert.equal(result.status, 0, result.stderr);
  return { stdout: result.stdout, elapsedMs: performance.now() - started };
}

function invoke(payload) {
  const result = invokeRaw(payload);
  assert.notEqual(result.stdout.trim(), '', 'expected the hook to emit routed context');
  return { output: JSON.parse(result.stdout), elapsedMs: result.elapsedMs };
}

const session = invoke({ hook_event_name: 'SessionStart', cwd: repo });
const sessionContext = session.output.hookSpecificOutput.additionalContext;
assert.match(sessionContext, /Read devrules\/always-readme\.md once/);
assert.doesNotMatch(sessionContext, /code-quality|modularity-and-dependencies|change-health/);
assert.ok(Buffer.byteLength(sessionContext) < 700, 'session context must stay below 700 bytes');
assert.equal(
  (await fs.readFile(idleInvocationLog, 'utf8')).trim(),
  'agent-status --json',
  'SessionStart must inspect scheduler status without applying persistent changes',
);

const prompt = invoke({
  hook_event_name: 'UserPromptSubmit',
  cwd: repo,
  prompt: 'Fix the failing Swift build error without changing unrelated behavior.',
});
const promptContext = prompt.output.hookSpecificOutput.additionalContext;
assert.match(promptContext, /before-edit-route -> devrules\/workflows\/code-change\.md/);
assert.match(promptContext, /ios-build-error-triage -> devrules\/workflows\/ios-build-error-triage\.md/);
assert.doesNotMatch(promptContext, /rules\/code-quality|rules\/modularity-and-dependencies/);
assert.ok(Buffer.byteLength(promptContext) < 1_000, 'prompt context must stay below 1 KB');

const revenueCatWeb = invoke({
  hook_event_name: 'UserPromptSubmit',
  cwd: repo,
  prompt: 'Implement RevenueCat subscriptions for a web app.',
});
const revenueCatWebContext = revenueCatWeb.output.hookSpecificOutput.additionalContext;
assert.match(revenueCatWebContext, /revenuecat-integration -> devrules\/workflows\/revenuecat-integration\.md/);
assert.doesNotMatch(revenueCatWebContext, /ios-account-data-architecture/, 'RevenueCat Web must not route through the iOS account workflow');

const chromeAutomation = invoke({
  hook_event_name: 'UserPromptSubmit',
  cwd: repo,
  prompt: '请操作已登录的 Chrome 浏览器自动化完成任务。',
});
const chromeAutomationContext = chromeAutomation.output.hookSpecificOutput.additionalContext;
assert.match(
  chromeAutomationContext,
  /codex-browser-automation-health -> devrules\/workflows\/codex-browser-automation-fix\.md/,
  'non-coding Chrome automation prompts must route to the Codex browser recovery workflow',
);

const chromeProxy = invoke({
  hook_event_name: 'UserPromptSubmit',
  cwd: repo,
  prompt: 'Chrome 控制进程为什么没有走系统代理？请修复 node_repl 联网。',
});
assert.match(
  chromeProxy.output.hookSpecificOutput.additionalContext,
  /codex-browser-automation-health -> devrules\/workflows\/codex-browser-automation-fix\.md/,
  'Chrome proxy-inheritance prompts must route to the source-repair workflow',
);

const registry = JSON.parse(await fs.readFile(path.join(root, 'hooks', 'hooks.json'), 'utf8'));
const chromeHook = registry.hooks.find((entry) => entry.id === 'codex-browser-automation-health');
assert.ok(chromeHook, 'browser automation hook must exist');
assert.ok(
  chromeHook.run.some((command) => command.includes('codex-browser-network.mjs status')),
  'browser automation hook must expose the network-boundary audit command',
);

const unrelatedPrompt = invokeRaw({
  hook_event_name: 'UserPromptSubmit',
  cwd: repo,
  prompt: '今天的天气怎么样？',
});
assert.equal(unrelatedPrompt.stdout, '', 'unrelated non-coding prompts must remain silent');

const conditionalWeb = invoke({
  hook_event_name: 'UserPromptSubmit',
  cwd: repo,
  prompt: 'Fix conditional-fixture for web.',
});
assert.match(conditionalWeb.output.hookSpecificOutput.additionalContext, /conditional-fixture -> devrules\/workflows\/web\.md/);
const conditionalIos = invoke({
  hook_event_name: 'UserPromptSubmit',
  cwd: repo,
  prompt: 'Fix conditional-fixture for iOS.',
});
assert.match(conditionalIos.output.hookSpecificOutput.additionalContext, /conditional-fixture -> devrules\/workflows\/ios-only\.md/);

await fs.rm(temp, { recursive: true, force: true });
console.log(`routing performance selftest: PASS (entry=${entryBytes}B/${entryLines}L session=${Math.round(session.elapsedMs)}ms prompt=${Math.round(prompt.elapsedMs)}ms advisories=${entryAdvisories.length})`);
for (const advisory of entryAdvisories) console.warn(`routing performance advisory: ${advisory}`);
