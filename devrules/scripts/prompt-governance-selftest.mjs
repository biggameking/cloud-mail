#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const [rootAgents, alwaysReadme, agentEntryRule, promptManagement, modelRouting, modelBoundary, projectEntry, globalEntry] = await Promise.all([
  fs.readFile(path.join(root, 'AGENTS.md'), 'utf8'),
  fs.readFile(path.join(root, 'always-readme.md'), 'utf8'),
  fs.readFile(path.join(root, 'rules', 'agent-entry-priority.md'), 'utf8'),
  fs.readFile(path.join(root, 'templates', 'ai', 'prompt-management.md'), 'utf8'),
  fs.readFile(path.join(root, 'templates', 'ai', 'model-routing.md'), 'utf8'),
  fs.readFile(path.join(root, 'templates', 'devrules', 'model-support.md'), 'utf8'),
  fs.readFile(path.join(root, 'scripts', 'devrules-lib', 'project-entry-files.mjs'), 'utf8'),
  fs.readFile(path.join(root, 'scripts', 'global-devrules.mjs'), 'utf8'),
]);

assert.match(rootAgents, /always-readme\.md/);
assert.match(agentEntryRule, /Shared rules flow one way/);
assert.match(agentEntryRule, /Never make devrules route back through an entry file/);
assert.match(promptManagement, /## Lean Prompt Contract/);
assert.match(promptManagement, /Give each instruction once/);
assert.match(promptManagement, /task completion,[\s\S]*evidence completeness,[\s\S]*approval correctness/);
assert.match(modelRouting, /## Capability-Gated Execution/);
assert.match(modelRouting, /portable fallback/);

for (const [name, content] of [
  ['template AGENTS entry', rootAgents],
  ['always-readme', alwaysReadme],
  ['project entry adapter', projectEntry],
  ['global entry adapter', globalEntry],
]) {
  assert.doesNotMatch(content, /reasoning\.mode|programmatic_tool_calling|allowed_callers|reasoning\.context/, `${name} must stay model-neutral`);
}

assert.match(modelBoundary, /model selected in Codex App/);
assert.match(modelBoundary, /does not define a default model, preferred model/);
assert.match(modelBoundary, /product architecture decisions owned by that\s+project/);
await assert.rejects(
  fs.access(path.join(root, 'templates', 'ai', 'model-overlays', 'openai-gpt-5.6.md')),
  /ENOENT/,
  'shared devrules must not ship a GPT-5.6 request-parameter overlay',
);

console.log('prompt governance selftest: PASS');
