#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import {
  auditGovernanceMetadata,
  migrateGovernanceTree,
} from './devrules-lib/governance-metadata.mjs';

const root = await fs.mkdtemp(path.join(os.tmpdir(), 'devrules-governance-v3-'));
const templateRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const execFileAsync = promisify(execFile);

try {
  const productRule = path.join(root, 'rules', 'ios-account-data-model.md');
  const releaseWorkflow = path.join(root, 'workflows', 'release.md');
  const optionalTemplate = path.join(root, 'templates', 'ui', 'component-brief.md');
  await fs.mkdir(path.dirname(productRule), { recursive: true });
  await fs.mkdir(path.dirname(releaseWorkflow), { recursive: true });
  await fs.mkdir(path.dirname(optionalTemplate), { recursive: true });
  await fs.writeFile(productRule, '---\nmodel_support: { default: codex }\ndescription: legacy product rule\nscope: universal\n---\n\n# Product\n');
  await fs.writeFile(releaseWorkflow, '---\ndescription: legacy release workflow\nscope: seed\n---\n\n# Release\n');
  await fs.writeFile(optionalTemplate, '# Optional component brief\n');

  const before = await fs.readFile(productRule, 'utf8');
  const dryRun = await migrateGovernanceTree(root);
  assert.equal(dryRun.actions.length, 3);
  assert.equal(await fs.readFile(productRule, 'utf8'), before, 'dry-run must not write');

  await migrateGovernanceTree(root, { apply: true });
  const product = await fs.readFile(productRule, 'utf8');
  const release = await fs.readFile(releaseWorkflow, 'utf8');
  const template = await fs.readFile(optionalTemplate, 'utf8');
  assert.match(product, /ownership: shared/);
  assert.match(product, /governs: product/);
  assert.match(product, /decision_owner: project/);
  assert.doesNotMatch(product, /model_support:|scope:/);
  assert.match(release, /ownership: seed/);
  assert.match(release, /governs: release/);
  assert.match(release, /activation: explicit/);
  assert.match(release, /side_effects: external/);
  assert.match(template, /ownership: seed/);
  assert.match(template, /activation: conditional/);
  assert.match(template, /enforcement: example/);
  assert.deepEqual((await auditGovernanceMetadata(root, { templateMode: true })).issues, []);

  await fs.writeFile(path.join(root, 'rules', 'bad-product.md'), `---
description: overreaching product rule
ownership: shared
governs: product
activation: always
enforcement: hard
decision_owner: devrules
side_effects: external
---

# Bad
`);
  const badAudit = await auditGovernanceMetadata(root, { templateMode: true });
  const messages = badAudit.issues.map((item) => item.message).join('\n');
  assert.match(messages, /cannot make product governance always-on/);
  assert.match(messages, /cannot make devrules the decision owner/);
  assert.match(messages, /cannot encode a hard product/);
  assert.match(messages, /cannot run external side effects/);

  await fs.writeFile(optionalTemplate, `${template}\nFixed shared gate: >= 85 passes.\n`);
  const semanticAudit = await auditGovernanceMetadata(root, { templateMode: true });
  assert.match(
    semanticAudit.issues.map((item) => item.message).join('\n'),
    /must not impose fixed universal score thresholds/,
  );

  const currentTemplateAudit = await auditGovernanceMetadata(templateRoot, { templateMode: true });
  assert.deepEqual(currentTemplateAudit.issues, [], 'the current shared template must pass v3 metadata and overreach checks');
  for (const fileName of ['DESIGN.example.md', 'DESIGN.template.md']) {
    const content = await fs.readFile(path.join(templateRoot, fileName), 'utf8');
    assert.match(
      content,
      /^---\r?\nownership: shared\r?$/m,
      `${fileName} must declare shared ownership so first-time template initialization is not blocked`,
    );
  }
  const config = JSON.parse(await fs.readFile(path.join(templateRoot, 'config.json'), 'utf8'));
  assert.equal(config.initialization.defaultAdoptionProfile, 'minimal');
  assert.equal(config.agentSurfaces.selectionOwner, 'host-user');
  assert.deepEqual(config.entryFiles.create, ['AGENTS.md']);
  assert(config.entryFiles.bindIfPresent.includes('.cursor/rules/devrules.mdc'));
  assert.equal(config.automation.githubActionsPolicy, 'inherit');
  assert.equal(config.developerServices.mode, 'safety-only');
  const globalInstaller = await fs.readFile(path.join(templateRoot, 'scripts', 'global-devrules.mjs'), 'utf8');
  const codexHook = await fs.readFile(path.join(templateRoot, 'hooks', 'codex-global-code-health-hook.mjs'), 'utf8');
  const cursorHook = await fs.readFile(path.join(templateRoot, 'hooks', 'cursor-global-routing-hook.mjs'), 'utf8');
  const designLint = await fs.readFile(path.join(templateRoot, 'scripts', 'design-lint.mjs'), 'utf8');
  assert.doesNotMatch(globalInstaller, /automatically run[^\n]*[\s\S]{0,120}ensure-agent --apply/i);
  assert.doesNotMatch(codexHook, /appendFile|devrules-code-health-hook\.jsonl/);
  assert.doesNotMatch(cursorHook, /appendLog|devrules-cursor-hook\.jsonl/);
  assert.match(designLint, /if \(flags\.online && !flags\.offline\)/, 'external design CLI must require explicit online selection');
  await assert.rejects(
    fs.access(path.join(templateRoot, 'templates', 'ai', 'model-overlays', 'openai-gpt-5.6.md')),
    /ENOENT/,
    'the removed model overlay must not return',
  );

  const workspace = path.join(root, 'profile-workspace');
  const minimalRepo = path.join(workspace, 'minimal-project');
  await fs.mkdir(path.join(minimalRepo, 'devrules'), { recursive: true });
  await execFileAsync('git', ['init', '--quiet', minimalRepo]);
  await fs.writeFile(path.join(minimalRepo, 'AGENTS.md'), '<!-- DEVRULES:ENTRY-START -->\nRead `devrules/always-readme.md`.\n<!-- DEVRULES:ENTRY-END -->\n');
  await fs.writeFile(path.join(minimalRepo, 'devrules', 'always-readme.md'), '# Minimal project contract\n');
  const minimalManifest = {
    schemaVersion: 1,
    adoptionProfile: 'minimal',
    selectedProfileLevel: 1,
    observedAdoptionLevel: 2,
    maturityLevel: 2,
    installedModules: ['core-orchestration'],
    enabledModules: ['core-orchestration'],
    dormantModules: [],
  };
  const minimalManifestPath = path.join(minimalRepo, 'devrules', 'manifest.json');
  await fs.writeFile(minimalManifestPath, `${JSON.stringify(minimalManifest, null, 2)}\n`);
  const readinessRun = await execFileAsync(process.execPath, [
    path.join(templateRoot, 'scripts', 'devrules.mjs'),
    'batch',
    'readiness',
    '--root', workspace,
    '--json',
  ], { maxBuffer: 16 * 1024 * 1024 });
  const readiness = JSON.parse(readinessRun.stdout);
  assert.equal(readiness.groups.alreadyReady.length, 1, 'minimal profile must not inherit full-profile file, source-root, or anchor requirements');
  assert.equal(readiness.groups.alreadyReady[0].adoptionProfile, 'minimal');

  const validAuditRun = await execFileAsync(process.execPath, [
    path.join(templateRoot, 'scripts', 'devrules.mjs'),
    'audit',
    '--repo', minimalRepo,
    '--strict',
    '--json',
  ], { maxBuffer: 16 * 1024 * 1024 });
  const validAudit = JSON.parse(validAuditRun.stdout);
  assert.equal(validAudit.issues.filter((issue) => issue.severity === 'error').length, 0);
  // The fixture diverges from the shared template, so the comparison must be
  // visible as a blocking finding. Its exact status depends on the template's
  // release state: 'blocked' before the running template is published,
  // 'conflict' once released authority verifies and content comparison runs.
  assert(
    ['blocked', 'conflict'].includes(validAudit.templateContent.status),
    `template comparison remains visible on a partial fixture (got ${validAudit.templateContent.status})`,
  );
  assert.equal(validAudit.templateIssues[0].severity, 'error', 'template comparison findings use their own channel');

  await fs.writeFile(minimalManifestPath, `${JSON.stringify({
    ...minimalManifest,
    selectedProfileLevel: 3,
    observedAdoptionLevel: 1,
    dormantModules: ['core-orchestration'],
  }, null, 2)}\n`);
  let inconsistentAuditError;
  try {
    await execFileAsync(process.execPath, [
      path.join(templateRoot, 'scripts', 'devrules.mjs'),
      'audit',
      '--repo', minimalRepo,
      '--strict',
      '--json',
    ], { maxBuffer: 16 * 1024 * 1024 });
  } catch (error) {
    inconsistentAuditError = error;
  }
  assert(inconsistentAuditError, 'inconsistent v3 manifest must fail strict local audit');
  const inconsistentAudit = JSON.parse(inconsistentAuditError.stdout);
  const inconsistentMessages = inconsistentAudit.issues.map((issue) => issue.message).join('\n');
  assert.match(inconsistentMessages, /selectedProfileLevel/);
  assert.match(inconsistentMessages, /maturityLevel/);
  assert.match(inconsistentMessages, /dormantModules/);

  console.log('governance v3 selftest: PASS');
} finally {
  await fs.rm(root, { recursive: true, force: true });
}
