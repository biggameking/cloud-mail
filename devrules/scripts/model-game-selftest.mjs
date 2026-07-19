#!/usr/bin/env node
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { auditHookRegistries } from './devrules-lib/hooks.mjs';
import { auditModelSupportMetadata } from './devrules-lib/model-support.mjs';

const execFileAsync = promisify(execFile);
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE_ROOT = path.resolve(SCRIPT_DIR, '..');
const CLI = path.join(SCRIPT_DIR, 'devrules.mjs');

async function run(command, args, options = {}) {
  const result = await execFileAsync(command, args, {
    cwd: options.cwd,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
    env: options.env || process.env,
  });
  return result.stdout.trim();
}

async function write(filePath, content) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content);
}

async function testTemplateMetadata() {
  const result = await auditModelSupportMetadata(TEMPLATE_ROOT, { templateMode: true });
  assert.deepEqual(result.violations, [], 'the shared template must inherit the host model without per-document defaults');
}

async function testModelSupportPolicy(root) {
  const devrulesRoot = path.join(root, 'model-support');
  await write(path.join(devrulesRoot, 'rules', 'valid.md'), '---\nownership: shared\nactivation: always\n---\n\n# Valid\n');
  await write(path.join(devrulesRoot, 'workflows', 'legacy.md'), '---\nmodel_support: { default: codex, tested: [codex/gpt-5.6] }\nscope: universal\n---\n\n# Legacy\n');
  await write(path.join(devrulesRoot, 'memory', 'bad-default.md'), '# Bad default\n\nAgent-readable devrules documents declare Codex as the default surface.\n');

  const templateAudit = await auditModelSupportMetadata(devrulesRoot, { templateMode: true });
  assert.deepEqual(templateAudit.violations.map((item) => item.relativePath), ['memory/bad-default.md', 'workflows/legacy.md']);
  assert.equal(templateAudit.issues[0].severity, 'error', 'shared-template model defaults must fail strict audit');

  const projectAudit = await auditModelSupportMetadata(devrulesRoot);
  assert.equal(projectAudit.issues.length, 0, 'legacy project model declarations stay advisory during migration');
  assert.equal(projectAudit.recommendations.length, 1);
}

async function testHookAudit(root) {
  const templateRegistry = JSON.parse(await fs.readFile(path.join(TEMPLATE_ROOT, 'hooks', 'hooks.json'), 'utf8'));
  assert.equal(templateRegistry.schemaVersion, 3, 'the shared template hook registry must use schema v3');
  const validTemplate = await auditHookRegistries(TEMPLATE_ROOT, {
    requiredHookIds: ['game-development', 'ios-account-data-model-gate'],
  });
  assert.equal(
    validTemplate.hookEntries.length,
    templateRegistry.hooks.length,
    'the hook audit fixture must cover every real template hook',
  );
  for (const hook of validTemplate.hookEntries) {
    const routes = [...hook.read, ...hook.workflows];
    const primaryRoutes = routes.filter((entry) => entry?.primary === true);
    assert.equal(primaryRoutes.length, 1, `v3 hook ${hook.id} must declare exactly one primary target`);
    assert.equal(primaryRoutes[0].activation, 'always', `v3 hook ${hook.id} primary target must use always activation`);
  }

  const gameHook = validTemplate.hookEntries.find((hook) => hook.id === 'game-development');
  assert.equal(gameHook?.ownership, 'seed', 'the game-development route must remain a reusable seed hook');
  const gamePrimary = [...gameHook.read, ...gameHook.workflows].find((entry) => entry.primary === true);
  assert.equal(
    gamePrimary?.target,
    'game-source-of-truth.md',
    'game-development must resolve to game-source-of-truth.md as its primary target',
  );
  assert.equal(gamePrimary?.activation, 'always', 'the game-development primary target must always load after a hook match');

  const iosBuildHook = validTemplate.hookEntries.find((hook) => hook.id === 'ios-build-error-triage');
  assert.deepEqual(
    iosBuildHook?.workflows.filter((entry) => entry.activation === 'always').map((entry) => entry.target),
    ['ios-build-error-triage.md'],
    'iOS build triage must have only one always workflow',
  );
  const debugRootCauseRoute = iosBuildHook?.workflows.find((entry) => entry.target === 'debug-root-cause.md');
  assert.equal(debugRootCauseRoute?.activation, 'conditional', 'debug-root-cause.md must remain a secondary conditional workflow');
  assert.deepEqual(
    debugRootCauseRoute?.condition,
    { fact: 'route.ios-build-error-triage.debug-root-cause', equals: true },
    'debug-root-cause.md must use the structured iOS build triage fact',
  );

  const iosAccountHook = validTemplate.hookEntries.find((hook) => hook.id === 'ios-account-data-model-gate');
  assert.equal(iosAccountHook?.ownership, 'shared', 'the iOS account/data route is shared template ownership');
  assert.equal(iosAccountHook?.governs, 'product', 'the iOS account/data route governs a product decision');
  assert.equal(iosAccountHook?.activation, 'conditional', 'product architecture must not become an always-on route');
  assert.equal(iosAccountHook?.decision_owner, 'project', 'the project, not devrules, owns the product decision');
  assert.equal(
    iosAccountHook?.read.every((entry) => entry && typeof entry === 'object' && typeof entry.target === 'string'),
    true,
    'v3 iOS account/data read routes must use structured targets',
  );
  assert.equal(
    iosAccountHook?.workflows.every((entry) => entry && typeof entry === 'object' && typeof entry.target === 'string'),
    true,
    'v3 iOS account/data workflow routes must use structured targets',
  );
  assert.equal(
    iosAccountHook?.read.some((entry) => entry.target === 'devrules/rules/ios-account-data-model.md'),
    true,
    'the iOS account/data gate must read its governing rule',
  );
  assert.equal(
    iosAccountHook?.read.some((entry) => entry.target === 'devrules/templates/ios-account-data-decision.md'),
    true,
    'the iOS account/data gate must expose its optional decision form',
  );
  assert.equal(
    iosAccountHook?.workflows.some((entry) => (
      entry.target === 'ios-account-data-architecture.md'
      && entry.activation === 'always'
      && entry.primary === true
    )),
    true,
    'the conditional hook must declare one structured primary workflow target',
  );
  assert.equal(
    iosAccountHook?.workflows.some((entry) => (
      entry.target === 'apple-app-store-launch.md'
      && entry.activation === 'conditional'
      && typeof entry.condition === 'object'
    )),
    true,
    'regional launch review must remain a structured conditional route',
  );
  const iosAccountRule = await fs.readFile(path.join(TEMPLATE_ROOT, 'rules', 'ios-account-data-model.md'), 'utf8');
  const iosAccountWorkflow = await fs.readFile(path.join(TEMPLATE_ROOT, 'workflows', 'ios-account-data-architecture.md'), 'utf8');
  const iosAccountTemplate = await fs.readFile(path.join(TEMPLATE_ROOT, 'templates', 'ios-account-data-decision.md'), 'utf8');
  assert.match(
    iosAccountRule,
    /decision_owner:\s*project/,
    'the rule metadata must preserve project ownership of the product decision',
  );
  assert.match(
    iosAccountRule,
    /released or valuable data must not be silently\s+re-keyed, orphaned, exposed to another principal, or destroyed/i,
    'the rule must retain the data-integrity safety boundary without choosing a key architecture',
  );
  assert.match(
    iosAccountRule,
    /migration, compatibility, backup, rollback, and recovery gates[\s\S]*remain mandatory/i,
    'released-data migration and recovery remain hard safety gates',
  );
  assert.match(
    iosAccountRule,
    /visual, copy-only, test-only, or mechanical change[\s\S]*must not be\s+blocked because one is absent/i,
    'non-applicable UI and mechanical work must not be blocked by a missing decision artifact',
  );
  assert.match(
    iosAccountWorkflow,
    /project or user selects the product architecture/i,
    'the workflow must state who owns the architecture choice',
  );
  assert.match(
    iosAccountTemplate,
    /If no, `N\/A` reason:/,
    'non-applicable mainland-China review must have a legitimate resolved N/A state',
  );
  const combinedIosPolicy = `${iosAccountRule}\n${iosAccountWorkflow}\n${iosAccountTemplate}`;
  assert.doesNotMatch(
    combinedIosPolicy,
    /(?:\b(?:must|shall)\b[^.\n]{0,160}`user_id`|`user_id`[^.\n]{0,160}\b(?:must|shall)\b)/i,
    'devrules must not mandate one physical user-key architecture',
  );
  assert.doesNotMatch(
    combinedIosPolicy,
    /(?:default(?:s|ed)?\s+to|without an explicit exception,?\s+use|normal sync default)[^\n]*local[-_ ]first|local[-_ ]first[^\n]{0,24}\(default\)/i,
    'devrules must not silently choose local-first for the product',
  );
  assert.doesNotMatch(
    combinedIosPolicy,
    /purely (?:visual|UI)[\s\S]{0,180}(?:next substantive development task|blocks? implementation)/i,
    'non-applicable UI work must not inherit a deferred mandatory product gate',
  );
  assert.deepEqual(validTemplate.issues, [], 'the template hook registry must have unique IDs and valid local references');

  const devrulesRoot = path.join(root, 'hook-audit');
  await write(path.join(devrulesRoot, 'workflows', 'primary.md'), '# Primary\n');
  await write(path.join(devrulesRoot, 'hooks', 'hooks.json'), `${JSON.stringify({
    schemaVersion: 3,
    hooks: [
      {
        id: 'duplicate',
        ownership: 'shared',
        governs: 'agent',
        activation: 'conditional',
        enforcement: 'advisory',
        decision_owner: 'project',
        side_effects: 'none',
        read: [{
          target: 'devrules/hooks/hooks.local.json',
          activation: 'conditional',
          condition: { fact: 'fixture.local-hooks-present', equals: true },
        }],
        workflows: [{ target: 'primary.md', activation: 'always', primary: true }],
      },
      {
        id: 'duplicate',
        ownership: 'shared',
        governs: 'agent',
        activation: 'conditional',
        enforcement: 'advisory',
        decision_owner: 'project',
        side_effects: 'none',
        read: [{ target: 'devrules/rules/missing.md', activation: 'always' }],
        workflows: [{ target: 'missing-workflow.md', activation: 'always', primary: true }],
      },
      {
        id: 'misplaced-local',
        ownership: 'local',
        governs: 'agent',
        activation: 'conditional',
        enforcement: 'advisory',
        decision_owner: 'project',
        side_effects: 'none',
        read: [],
        workflows: [{ target: 'primary.md', activation: 'always', primary: true }],
      },
    ],
  }, null, 2)}\n`);

  const audit = await auditHookRegistries(devrulesRoot, { requiredHookIds: [] });
  const messages = audit.issues.map((issue) => issue.message).join('\n');
  assert.match(messages, /Duplicate hook id: duplicate/);
  assert.match(messages, /Project-local hook misplaced-local/);
  assert.match(messages, /missing local read file: rules\/missing\.md/);
  assert.match(messages, /missing local workflow file: workflows\/missing-workflow\.md/);
  assert.doesNotMatch(messages, /missing local read file: hooks\/hooks\.local\.json/, 'structured conditional hook references must not produce false warnings');
}

async function testGodotInitialization(root) {
  const repo = path.join(root, 'godot-project');
  await fs.mkdir(repo, { recursive: true });
  await run('git', ['init', '-b', 'main', repo]);
  await write(path.join(repo, 'project.godot'), '[application]\nconfig/name="Selftest"\n');
  await write(path.join(repo, 'scripts', 'player.gd'), 'extends Node\n');
  await write(path.join(repo, 'scenes', 'main.tscn'), '[gd_scene format=3]\n');

  const initialized = JSON.parse(await run(process.execPath, [CLI, 'init', '--repo', repo, '--profile', 'standard', '--apply', '--json']));
  const result = initialized.results[0];
  assert.equal(result.stack.includes('godot'), true, 'project.godot must identify the Godot stack');
  assert.deepEqual(result.sourceRoots, ['scenes', 'scripts'], 'Godot scene and script roots must be discovered deterministically');

  const hooksPath = path.join(repo, 'devrules', 'hooks', 'hooks.json');
  const registry = JSON.parse(await fs.readFile(hooksPath, 'utf8'));
  assert.equal(registry.hooks.some((hook) => hook.id === 'game-development'), true, 'new Godot instances must receive the game-development seed');
  registry.hooks = registry.hooks.filter((hook) => hook.id !== 'game-development');
  await fs.writeFile(hooksPath, `${JSON.stringify(registry, null, 2)}\n`);

  const audit = JSON.parse(await run(process.execPath, [CLI, 'audit', '--repo', repo, '--json']));
  assert.equal(typeof audit.templateContent?.status, 'string', 'repository audit must include the shared-template content preflight result');
  assert.equal(
    audit.recommendations.some((item) => item.message.includes('Godot project detected without the game-development seed hook')),
    true,
    'legacy Godot instances without the seed hook must receive an explicit adoption recommendation',
  );
  const humanAudit = await run(process.execPath, [CLI, 'audit', '--repo', repo]);
  assert.ok(
    humanAudit.indexOf('Template content preflight:') < humanAudit.indexOf('Observed adoption level:'),
    'human audit output must show template content alignment before adoption findings',
  );
}

async function main() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'devrules-model-game-selftest-'));
  try {
    await testTemplateMetadata();
    await testModelSupportPolicy(root);
    await testHookAudit(root);
    await testGodotInitialization(root);
    console.log('model and game selftest: PASS');
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
