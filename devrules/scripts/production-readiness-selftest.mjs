#!/usr/bin/env node
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { validateProductionChangePlan } from './production-readiness.mjs';

const execFileAsync = promisify(execFile);
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE_ROOT = path.join(SCRIPT_DIR, '..');
const CLI = path.join(SCRIPT_DIR, 'production-readiness.mjs');
const TEMPLATE = path.join(TEMPLATE_ROOT, 'templates', 'ops', 'production-change-plan.template.json');

function validPlan() {
  return {
    schemaVersion: 1,
    changeId: 'orders-schema-v3',
    title: 'Migrate order status representation',
    owner: 'release-owner@example.invalid',
    status: 'closed',
    riskLevel: 'high',
    platforms: ['server'],
    impact: {
      persistentData: true,
      schemaChange: true,
      storageFormatChange: false,
      contractChange: true,
      destructiveData: false,
      securityOrPrivacy: false,
      billingOrEntitlements: false,
      crossTenant: false,
      clientLocalState: false,
      irreversibleOperation: false,
    },
    architecture: {
      relationship: 'extend',
      boundaries: ['order repository', 'public order API'],
      decision: 'Add the versioned status field before switching readers and removing the old field.',
      evidence: ['docs/decisions/orders-schema-v3.md'],
    },
    compatibility: {
      oldReadersOnNewData: true,
      newReadersOnOldData: true,
      mixedVersionSafe: true,
      unknownFieldsTolerated: true,
      unknownEnumFallback: 'Unknown status maps to a visible unsupported state.',
      safeGateOrRefusal: 'Minimum-version gate refuses writers outside the supported window.',
      compatibilityWindow: 'Two stable releases and less than 0.1% old clients for 14 days.',
      minimumSupportedVersion: '2.4.0',
      deprecationPlan: 'Remove the legacy field in change orders-schema-v4 after usage reaches zero.',
      evidence: ['artifacts/orders-contract-matrix.json'],
    },
    migration: {
      required: true,
      strategy: 'expand-migrate-contract',
      backwardCompatibleDeployment: true,
      sourceVersions: ['1', '2'],
      targetVersion: '3',
      steps: ['expand field', 'backfill batches', 'switch readers', 'contract in a later change'],
      idempotent: true,
      resumable: true,
      failureAtomicity: 'checkpointed-resumable',
      preflightChecks: ['verify backup freshness', 'verify no invalid status rows'],
      backupProcedure: 'Create release-scoped snapshot before the first backfill batch.',
      restoreTestEvidence: 'restore rehearsal RR-2026-017 passed',
      integrityChecks: ['source and target counts match', 'no order has an unknown owner'],
      batchingAndRateLimit: '500 rows per batch with database-load stop threshold.',
      failureHandling: 'Checkpoint the last committed ID and quarantine invalid rows for owned repair.',
      downgradeBehavior: 'Old services continue reading the legacy field through the compatibility window.',
      interruptionTestEvidence: 'Not applicable to server lane; checkpoint restart covered by CI run 4812.',
    },
    rollout: {
      strategy: 'canary',
      featureFlagOrIsolation: 'Tenant cohort release flag orders_schema_v3.',
      killSwitchOrStopMechanism: 'Disable new writers and pause the migration worker.',
      owner: 'release-owner@example.invalid',
      stages: [
        {
          name: 'internal tenants',
          percentage: 0,
          observationWindow: '2 hours',
          successCriteria: ['zero integrity violations', 'error rate within baseline'],
          stopCriteria: ['any data-loss signal', 'migration failure rate above 0.1%'],
        },
        {
          name: 'first production cohort',
          percentage: 5,
          observationWindow: '24 hours',
          successCriteria: ['zero integrity violations', 'critical-flow success within 1% of baseline'],
          stopCriteria: ['any unexplained invariant failure', 'support rate doubles'],
        },
      ],
    },
    rollback: {
      codeRollback: 'Redeploy release 2.4.0 while dual-read remains enabled.',
      dataRollbackOrRollForward: 'Roll forward repaired target rows; restore only before new writes cross the snapshot boundary.',
      pointOfNoReturn: 'Legacy field removal in follow-up change orders-schema-v4.',
      decisionOwner: 'incident-commander@example.invalid',
      rto: '30 minutes to contain writes',
      rpo: 'No acknowledged user write loss',
      evidence: ['runbook/orders-schema-v3-recovery.md tested in staging'],
    },
    observability: {
      technicalSignals: ['API error rate', 'database load', 'worker lag'],
      businessSignals: ['order update success', 'support contacts'],
      migrationAndIntegritySignals: ['rows attempted/succeeded/failed', 'source-target reconciliation drift'],
      alerts: ['page on any integrity violation', 'page above 0.1% failed rows'],
      dashboard: 'dashboards/orders-schema-v3',
      auditTrail: 'Audit event production_change.orders-schema-v3 records actor, cohort, batch, and result.',
      monitoringWindow: '14 days after full rollout',
    },
    verification: {
      upgradePaths: [
        { from: '1', to: '3', status: 'passed', evidence: 'CI run 4812 migration-v1-v3' },
        { from: '2', to: '3', status: 'passed', evidence: 'CI run 4812 migration-v2-v3' },
      ],
      checks: [
        { name: 'unit, contract, migration, and build suites', status: 'passed', evidence: 'CI run 4812' },
        { name: 'backup restore roundtrip', status: 'passed', evidence: 'restore rehearsal RR-2026-017' },
      ],
      dataScaleEvidence: 'Staging rehearsal completed with 1.2x current production row count in 43 minutes.',
    },
    approvals: [
      {
        role: 'change owner',
        name: 'release-owner@example.invalid',
        status: 'approved',
        evidence: 'approval CR-204',
      },
    ],
    exceptions: [],
    postRelease: {
      monitoringCompleted: true,
      migrationReconciled: true,
      cleanupTracked: true,
      evidence: ['release report orders-schema-v3', 'cleanup issue OPS-912'],
    },
  };
}

function clone(value) {
  return structuredClone(value);
}

function assertValid(result, label) {
  assert.equal(result.valid, true, `${label} should pass:\n${JSON.stringify(result.errors, null, 2)}`);
}

function assertCode(result, code, label) {
  assert.equal(
    result.errors.some((error) => error.code === code),
    true,
    `${label} should report ${code}:\n${JSON.stringify(result.errors, null, 2)}`,
  );
}

async function testValidStages() {
  const plan = validPlan();
  assertValid(validateProductionChangePlan(plan, { stage: 'design' }), 'complete design');
  assertValid(validateProductionChangePlan(plan, { stage: 'preflight' }), 'complete preflight');
  assertValid(validateProductionChangePlan(plan, { stage: 'post-release' }), 'complete post-release');
}

async function testRiskCannotBeUnderstated() {
  const plan = validPlan();
  plan.riskLevel = 'high';
  plan.impact.destructiveData = true;
  assertCode(validateProductionChangePlan(plan, { stage: 'design' }), 'RISK_UNDERRATED', 'destructive change');
}

async function testCompatibilityCannotBeOmitted() {
  const plan = validPlan();
  delete plan.compatibility;
  assertCode(validateProductionChangePlan(plan, { stage: 'design' }), 'REQUIRED_OBJECT', 'persistent contract change');
}

async function testLocalMigrationPreservesOriginal() {
  for (const platform of ['desktop', 'ios', 'android']) {
    const plan = validPlan();
    plan.platforms = [platform];
    plan.impact.schemaChange = false;
    plan.impact.storageFormatChange = true;
    plan.migration.failureAtomicity = 'checkpointed-resumable';
    assertCode(validateProductionChangePlan(plan, { stage: 'design' }), 'LOCAL_FAILURE_ATOMICITY', `${platform} migration`);
  }
}

async function testBrowserLocalMigrationUsesLocalSafety() {
  const plan = validPlan();
  plan.platforms = ['web'];
  plan.impact.schemaChange = false;
  plan.impact.storageFormatChange = true;
  plan.impact.clientLocalState = true;
  plan.migration.failureAtomicity = 'checkpointed-resumable';
  assertCode(validateProductionChangePlan(plan, { stage: 'design' }), 'LOCAL_FAILURE_ATOMICITY', 'browser local migration');
}

async function testRolloutNeedsStopCriteria() {
  const plan = validPlan();
  plan.rollout.stages[1].stopCriteria = [];
  assertCode(validateProductionChangePlan(plan, { stage: 'design' }), 'REQUIRED_TEXT_ARRAY', 'rollout stage');
}

async function testPreflightNeedsEvidence() {
  const plan = validPlan();
  plan.status = 'ready';
  plan.verification.checks[0].status = 'pending';
  plan.migration.restoreTestEvidence = 'TODO';
  const result = validateProductionChangePlan(plan, { stage: 'preflight' });
  assertCode(result, 'VERIFICATION_NOT_PASSED', 'pending check');
  assert.equal(
    result.errors.some((error) => error.field === 'migration.restoreTestEvidence'),
    true,
    `preflight should require restore evidence:\n${JSON.stringify(result.errors, null, 2)}`,
  );
}

async function testCriticalNeedsTwoApprovers() {
  const plan = validPlan();
  plan.status = 'ready';
  plan.riskLevel = 'critical';
  plan.impact.destructiveData = true;
  assertCode(validateProductionChangePlan(plan, { stage: 'preflight' }), 'APPROVALS', 'critical change');
}

async function testPostReleaseCannotCloseEarly() {
  const plan = validPlan();
  plan.status = 'released';
  plan.postRelease.migrationReconciled = false;
  assertCode(validateProductionChangePlan(plan, { stage: 'post-release' }), 'POST_RELEASE_INCOMPLETE', 'unreconciled release');
}

async function testStarterTemplateFailsUntilFilled() {
  const template = JSON.parse(await fs.readFile(TEMPLATE, 'utf8'));
  const result = validateProductionChangePlan(template, { stage: 'design' });
  assert.equal(result.valid, false, 'starter template must not pass while TODO placeholders remain');
  assert.equal(result.errors.length > 5, true, 'starter template should expose multiple incomplete gates');
}

async function testCliJsonOutput() {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'production-readiness-'));
  try {
    const planPath = path.join(tempDir, 'plan.json');
    await fs.writeFile(planPath, `${JSON.stringify(validPlan(), null, 2)}\n`, 'utf8');
    const result = await execFileAsync(process.execPath, [CLI, '--plan', planPath, '--stage', 'preflight', '--json'], {
      encoding: 'utf8',
      windowsHide: true,
    });
    const output = JSON.parse(result.stdout);
    assert.equal(output.valid, true);
    assert.equal(output.stage, 'preflight');
    assert.equal(output.plan, planPath);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

async function testTemplateIntegration() {
  const [hooksText, cliText, ruleText, workflowText, manifestText, repoInitAuditText] = await Promise.all([
    fs.readFile(path.join(TEMPLATE_ROOT, 'hooks', 'hooks.json'), 'utf8'),
    fs.readFile(path.join(TEMPLATE_ROOT, 'scripts', 'devrules.mjs'), 'utf8'),
    fs.readFile(path.join(TEMPLATE_ROOT, 'rules', 'production-change-governance.md'), 'utf8'),
    fs.readFile(path.join(TEMPLATE_ROOT, 'workflows', 'production-change.md'), 'utf8'),
    fs.readFile(path.join(TEMPLATE_ROOT, 'template.json'), 'utf8'),
    fs.readFile(path.join(TEMPLATE_ROOT, 'scripts', 'devrules-lib', 'repo-init-audit.mjs'), 'utf8'),
  ]);
  const hooks = JSON.parse(hooksText);
  const manifest = JSON.parse(manifestText);
  const productionHook = hooks.hooks.find((hook) => hook.id === 'production-change-governance');
  assert.ok(productionHook, 'production change hook must be registered');
  assert.deepEqual(
    {
      ownership: productionHook.ownership,
      governs: productionHook.governs,
      activation: productionHook.activation,
      enforcement: productionHook.enforcement,
      decisionOwner: productionHook.decision_owner,
      sideEffects: productionHook.side_effects,
    },
    {
      ownership: 'shared',
      governs: 'release',
      activation: 'explicit',
      enforcement: 'gate',
      decisionOwner: 'project',
      sideEffects: 'external',
    },
    'production changes must be a project-owned explicit release gate, not a universal default',
  );
  for (const stage of ['design', 'preflight', 'post-release']) {
    assert.equal(
      productionHook.run.some((command) => command.includes(`--stage ${stage}`)),
      true,
      `production hook must route the ${stage} gate`,
    );
  }
  assert.match(`${cliText}\n${repoInitAuditText}`, /'production-change-governance\.md'/, 'the production rule must be a required rule');
  for (const section of [
    'Compatibility Contract',
    'Data Migration Contract',
    'Rollout And Containment',
    'Rollback, Recovery, And Roll-Forward',
    'Observability, Audit, And Privacy',
  ]) assert.match(ruleText, new RegExp(section));
  for (const platform of ['web', 'server', 'desktop', 'iOS', 'Android']) {
    assert.match(`${ruleText}\n${workflowText}`, new RegExp(platform, 'i'), `${platform} lane must be documented`);
  }
  assert.match(manifest.version, /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/);
  assert.equal(Number.isInteger(manifest.revision) && manifest.revision >= 0, true);
}

async function main() {
  const tests = [
    testValidStages,
    testRiskCannotBeUnderstated,
    testCompatibilityCannotBeOmitted,
    testLocalMigrationPreservesOriginal,
    testBrowserLocalMigrationUsesLocalSafety,
    testRolloutNeedsStopCriteria,
    testPreflightNeedsEvidence,
    testCriticalNeedsTwoApprovers,
    testPostReleaseCannotCloseEarly,
    testStarterTemplateFailsUntilFilled,
    testCliJsonOutput,
    testTemplateIntegration,
  ];
  for (const test of tests) await test();
  console.log(`production readiness self-test passed (${tests.length} cases)`);
}

await main();
