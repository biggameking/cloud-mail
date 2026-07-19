#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { writeJson } from './devrules-lib/selftest-utils.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE_ROOT = path.resolve(SCRIPT_DIR, '..');
const ROUTING_CARD = path.join(SCRIPT_DIR, 'routing-card.mjs');
const CURSOR_HOOK = path.join(TEMPLATE_ROOT, 'hooks', 'cursor-global-routing-hook.mjs');
const ROUTING_CORE = path.join(TEMPLATE_ROOT, 'hooks', 'cursor-routing-core.mjs');

function runNode(script, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, ...args], {
      cwd: options.cwd || TEMPLATE_ROOT,
      env: options.env || process.env,
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code) => {
      const result = { code, stdout, stderr };
      if (code === 0) resolve(result);
      else reject(Object.assign(new Error(`${path.basename(script)} exited ${code}: ${stderr}`), result));
    });
    child.stdin.end(options.input || '');
  });
}

async function main() {
  const { selectHookTarget } = await import(ROUTING_CORE);
  const templateRegistry = JSON.parse(await fs.readFile(path.join(TEMPLATE_ROOT, 'hooks', 'hooks.json'), 'utf8'));
  const revenueCatHook = templateRegistry.hooks.find((hook) => hook.id === 'revenuecat-integration');
  const revenueCatWebTarget = selectHookTarget(revenueCatHook, {
    prefix: 'devrules',
    context: { text: 'Implement RevenueCat subscriptions for a web app with Supabase.' },
  });
  assert.equal(revenueCatWebTarget, 'devrules/workflows/revenuecat-integration.md');
  assert.doesNotMatch(revenueCatWebTarget, /ios-account-data-architecture/);
  assert.equal(
    selectHookTarget({
      id: 'legacy-only',
      workflows: ['ios-account-data-architecture.md when the app is iOS'],
      read: [],
    }, { prefix: 'devrules', context: { text: 'RevenueCat web billing' } }),
    'devrules/always-readme.md',
    'legacy prose conditions must not become automatic primary routes',
  );
  const conditionalFixture = {
    id: 'platform-route',
    workflows: [
      {
        target: 'ios-only.md',
        activation: 'conditional',
        primary: true,
        condition: { source: 'context', pattern: '\\bios\\b' },
      },
      { target: 'web.md', activation: 'always' },
    ],
  };
  assert.equal(
    selectHookTarget(conditionalFixture, { prefix: 'devrules', context: { text: 'web billing' } }),
    'devrules/workflows/web.md',
  );
  assert.equal(
    selectHookTarget(conditionalFixture, { prefix: 'devrules', context: { text: 'iOS billing' } }),
    'devrules/workflows/ios-only.md',
  );

  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'devrules-cursor-routing-'));
  const repo = path.join(tempRoot, 'workspace', 'product');
  const devrules = path.join(repo, 'devrules');
  const home = path.join(tempRoot, 'home');
  const runtimePath = path.join(tempRoot, 'runtime.json');
  const template = path.join(tempRoot, 'template');
  try {
    await fs.mkdir(path.join(repo, '.git'), { recursive: true });
    await fs.mkdir(path.join(devrules, 'scripts'), { recursive: true });
    await fs.mkdir(path.join(devrules, 'memory'), { recursive: true });
    await fs.writeFile(path.join(devrules, 'always-readme.md'), '# project devrules\n', 'utf8');
    await fs.writeFile(path.join(devrules, 'scripts', 'code-health.mjs'), '// fixture\n', 'utf8');
    await writeJson(path.join(devrules, 'manifest.json'), { schemaVersion: 1, devrulesVersion: '1.0.0' });
    await writeJson(path.join(devrules, 'hooks', 'hooks.json'), {
      schemaVersion: 3,
      hooks: [
        {
          id: 'override-me',
          when: 'shared definition',
          pathPatterns: ['devrules/shared/**'],
          workflows: [{ target: 'shared-flow.md', activation: 'always', primary: true }],
          scope: 'universal',
        },
      ],
    });
    await writeJson(path.join(devrules, 'hooks', 'hooks.local.json'), {
      schemaVersion: 1,
      hooks: [
        {
          id: 'override-me',
          when: 'local definition',
          pathPatterns: ['devrules/scripts/**'],
          workflows: ['local-flow.md'],
          scope: 'local',
        },
      ],
    });
    await fs.mkdir(path.join(repo, '.cursor', 'rules'), { recursive: true });
    const cursorRule = `---
description: Preserve this project-specific Cursor description.
alwaysApply: true
customField: keep-me
---

<!-- DEVRULES:ENTRY-START -->
managed entry
<!-- DEVRULES:ENTRY-END -->
`;
    const cursorRulePath = path.join(repo, '.cursor', 'rules', 'devrules.mdc');
    await fs.writeFile(cursorRulePath, cursorRule, 'utf8');

    const applied = await runNode(ROUTING_CARD, ['--repo', repo, '--apply']);
    assert.match(applied.stdout, /updated/);
    const generated = await fs.readFile(cursorRulePath, 'utf8');
    assert.match(generated, /customField: keep-me/);
    assert.match(generated, /- override-me -> workflows\/local-flow\.md/);
    assert.doesNotMatch(generated, /shared definition/);
    assert.equal((generated.match(/^- override-me ->/gm) || []).length, 1, 'local hook must replace the shared hook by id');
    const repeated = await runNode(ROUTING_CARD, ['--repo', repo]);
    assert.match(repeated.stdout, /unchanged/);

    await fs.mkdir(template, { recursive: true });
    await writeJson(path.join(template, 'template.json'), { schemaVersion: 1, version: '9.0.0' });
    await writeJson(runtimePath, { schemaVersion: 1, templateRoot: template, workspaceRoots: [path.dirname(repo)] });
    const environment = {
      ...process.env,
      HOME: home,
      USERPROFILE: home,
      DEVRULES_RUNTIME_CONFIG: runtimePath,
      CURSOR_PROJECT_DIR: repo,
    };

    const sessionPayload = {
      hook_event_name: 'sessionStart',
      session_id: 'cursor-routing-session',
      cwd: repo,
      workspace_roots: [repo],
    };
    const sessionResult = JSON.parse((await runNode(CURSOR_HOOK, [], {
      env: environment,
      input: JSON.stringify(sessionPayload),
    })).stdout);
    assert.match(sessionResult.additional_context, /devrules is active/);
    assert.match(sessionResult.additional_context, /instance devrules 1\.0\.0 lags shared template 9\.0\.0/);

    const postToolPayload = {
      hook_event_name: 'postToolUse',
      conversation_id: 'cursor-routing-post-tool',
      cwd: path.dirname(repo),
      tool_name: 'Write',
      tool_input: { file_path: path.join(devrules, 'scripts', 'example.mjs') },
    };
    const firstPostTool = JSON.parse((await runNode(CURSOR_HOOK, [], {
      env: environment,
      input: JSON.stringify(postToolPayload),
    })).stdout);
    assert.match(firstPostTool.additional_context, /override-me/);
    assert.match(firstPostTool.additional_context, /devrules\/workflows\/local-flow\.md/);
    assert.doesNotMatch(firstPostTool.additional_context, /shared-flow/);
    const repeatedPostTool = JSON.parse((await runNode(CURSOR_HOOK, [], {
      env: environment,
      input: JSON.stringify(postToolPayload),
    })).stdout);
    assert.deepEqual(repeatedPostTool, {}, 'the same hook id must be injected only once per conversation');

    const promptResult = JSON.parse((await runNode(CURSOR_HOOK, [], {
      env: environment,
      input: JSON.stringify({
        hook_event_name: 'beforeSubmitPrompt',
        conversation_id: 'cursor-routing-prompt',
        cwd: repo,
        prompt: 'change the implementation',
      }),
    })).stdout);
    assert.deepEqual(promptResult, { continue: true });

    process.stdout.write('cursor routing selftest: PASS\n');
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  process.stderr.write(`cursor routing selftest: FAIL\n${error.stack ?? error.message}\n`);
  process.exitCode = 1;
});
