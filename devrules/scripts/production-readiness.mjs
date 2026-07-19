#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const STAGES = new Set(['design', 'preflight', 'post-release']);
const RISKS = ['low', 'medium', 'high', 'critical'];
const STATUSES = new Set(['draft', 'ready', 'released', 'closed']);
const PLATFORMS = new Set(['web', 'server', 'desktop', 'ios', 'android']);
const RELATIONSHIPS = new Set(['reuse', 'extend', 'replace', 'merge', 'isolate', 'refactor']);
const FAILURE_ATOMICITY = new Set(['transactional', 'copy-on-write', 'checkpointed-resumable']);
const LOCAL_PLATFORMS = new Set(['desktop', 'ios', 'android']);
const SERVER_PLATFORMS = new Set(['web', 'server']);
const IMPACT_FLAGS = [
  'persistentData',
  'schemaChange',
  'storageFormatChange',
  'contractChange',
  'destructiveData',
  'securityOrPrivacy',
  'billingOrEntitlements',
  'crossTenant',
  'clientLocalState',
  'irreversibleOperation',
];
const PLACEHOLDER = /^(?:(?:todo|tbd|tbc|pending)\b|unknown$|fill[ -]?me\b|not[ -]?set\b|<.+>)/i;

function parseArgs(argv) {
  const options = { stage: 'design', json: false, help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--json') {
      options.json = true;
    } else if (arg === '--plan' || arg === '--stage') {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) throw new Error(`${arg} requires a value.`);
      options[arg.slice(2)] = value;
      index += 1;
    } else if (arg.startsWith('--plan=')) {
      options.plan = arg.slice('--plan='.length);
    } else if (arg.startsWith('--stage=')) {
      options.stage = arg.slice('--stage='.length);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function meaningfulText(value) {
  return typeof value === 'string' && value.trim().length > 0 && !PLACEHOLDER.test(value.trim());
}

function meaningfulTextArray(value) {
  return Array.isArray(value) && value.length > 0 && value.every(meaningfulText);
}

function issue(code, field, message) {
  return { code, field, message };
}

function minimumRiskFor(impact) {
  if (!isObject(impact)) return 'low';
  if (
    impact.destructiveData === true
    || impact.crossTenant === true
    || impact.irreversibleOperation === true
  ) return 'critical';
  if (
    impact.persistentData === true
    || impact.schemaChange === true
    || impact.storageFormatChange === true
    || impact.contractChange === true
    || impact.securityOrPrivacy === true
    || impact.billingOrEntitlements === true
    || impact.clientLocalState === true
  ) return 'high';
  return 'low';
}

function riskAtLeast(risk, threshold) {
  return RISKS.indexOf(risk) >= RISKS.indexOf(threshold);
}

function requireObject(value, field, errors) {
  if (!isObject(value)) {
    errors.push(issue('REQUIRED_OBJECT', field, `${field} must be an object.`));
    return false;
  }
  return true;
}

function requireText(value, field, errors) {
  if (!meaningfulText(value)) {
    errors.push(issue('REQUIRED_TEXT', field, `${field} must contain a concrete value, not a placeholder.`));
    return false;
  }
  return true;
}

function requireTextArray(value, field, errors) {
  if (!meaningfulTextArray(value)) {
    errors.push(issue('REQUIRED_TEXT_ARRAY', field, `${field} must contain at least one concrete value and no placeholders.`));
    return false;
  }
  return true;
}

function requireBoolean(value, field, errors) {
  if (typeof value !== 'boolean') {
    errors.push(issue('REQUIRED_BOOLEAN', field, `${field} must be explicitly true or false.`));
    return false;
  }
  return true;
}

function validateIdentity(plan, errors) {
  if (plan.schemaVersion !== 1) {
    errors.push(issue('SCHEMA_VERSION', 'schemaVersion', 'schemaVersion must be 1.'));
  }
  for (const field of ['changeId', 'title', 'owner']) requireText(plan[field], field, errors);
  if (!STATUSES.has(plan.status)) {
    errors.push(issue('STATUS', 'status', `status must be one of: ${[...STATUSES].join(', ')}.`));
  }
  if (!RISKS.includes(plan.riskLevel)) {
    errors.push(issue('RISK_LEVEL', 'riskLevel', `riskLevel must be one of: ${RISKS.join(', ')}.`));
  }

  if (!Array.isArray(plan.platforms) || plan.platforms.length === 0) {
    errors.push(issue('PLATFORMS', 'platforms', 'platforms must contain at least one affected platform.'));
  } else {
    const invalid = plan.platforms.filter((platform) => !PLATFORMS.has(platform));
    if (invalid.length > 0) {
      errors.push(issue('PLATFORMS', 'platforms', `Unsupported platforms: ${invalid.join(', ')}.`));
    }
    if (new Set(plan.platforms).size !== plan.platforms.length) {
      errors.push(issue('PLATFORMS_DUPLICATE', 'platforms', 'platforms must not contain duplicates.'));
    }
  }
}

function validateImpact(plan, errors) {
  if (!requireObject(plan.impact, 'impact', errors)) return;
  for (const flag of IMPACT_FLAGS) requireBoolean(plan.impact[flag], `impact.${flag}`, errors);

  if (plan.impact.schemaChange === true && plan.impact.persistentData !== true) {
    errors.push(issue('IMPACT_INCONSISTENT', 'impact.persistentData', 'schemaChange=true requires persistentData=true.'));
  }
  if (plan.impact.storageFormatChange === true && plan.impact.persistentData !== true) {
    errors.push(issue('IMPACT_INCONSISTENT', 'impact.persistentData', 'storageFormatChange=true requires persistentData=true.'));
  }
  if (plan.impact.destructiveData === true && plan.impact.persistentData !== true) {
    errors.push(issue('IMPACT_INCONSISTENT', 'impact.persistentData', 'destructiveData=true requires persistentData=true.'));
  }
  if (plan.impact.clientLocalState === true && plan.impact.persistentData !== true) {
    errors.push(issue('IMPACT_INCONSISTENT', 'impact.persistentData', 'clientLocalState=true requires persistentData=true.'));
  }
}

function validateArchitecture(plan, errors) {
  if (!requireObject(plan.architecture, 'architecture', errors)) return;
  if (!RELATIONSHIPS.has(plan.architecture.relationship)) {
    errors.push(issue(
      'ARCHITECTURE_RELATIONSHIP',
      'architecture.relationship',
      `architecture.relationship must be one of: ${[...RELATIONSHIPS].join(', ')}.`,
    ));
  }
  requireTextArray(plan.architecture.boundaries, 'architecture.boundaries', errors);
  requireText(plan.architecture.decision, 'architecture.decision', errors);
  requireTextArray(plan.architecture.evidence, 'architecture.evidence', errors);
}

function validateCompatibility(plan, errors) {
  const needed = plan.impact?.persistentData === true || plan.impact?.contractChange === true;
  if (!needed) return;
  if (!requireObject(plan.compatibility, 'compatibility', errors)) return;

  const booleans = [
    'oldReadersOnNewData',
    'newReadersOnOldData',
    'mixedVersionSafe',
    'unknownFieldsTolerated',
  ];
  for (const field of booleans) requireBoolean(plan.compatibility[field], `compatibility.${field}`, errors);
  for (const field of [
    'unknownEnumFallback',
    'safeGateOrRefusal',
    'compatibilityWindow',
    'minimumSupportedVersion',
    'deprecationPlan',
  ]) requireText(plan.compatibility[field], `compatibility.${field}`, errors);
  requireTextArray(plan.compatibility.evidence, 'compatibility.evidence', errors);

  const unsafe = booleans.some((field) => plan.compatibility[field] === false);
  if (unsafe && !meaningfulText(plan.compatibility.safeGateOrRefusal)) {
    errors.push(issue(
      'COMPATIBILITY_GATE',
      'compatibility.safeGateOrRefusal',
      'Any unsupported compatibility direction requires a concrete version gate or safe refusal path.',
    ));
  }
}

function validateMigration(plan, stage, errors) {
  const requiredByImpact = (
    plan.impact?.schemaChange === true
    || plan.impact?.storageFormatChange === true
    || plan.impact?.destructiveData === true
  );
  if (!requireObject(plan.migration, 'migration', errors)) return;
  if (!requireBoolean(plan.migration.required, 'migration.required', errors)) return;
  if (plan.migration.required === true && plan.impact?.persistentData !== true) {
    errors.push(issue(
      'IMPACT_INCONSISTENT',
      'impact.persistentData',
      'migration.required=true requires persistentData=true.',
    ));
  }
  if (requiredByImpact && plan.migration.required !== true) {
    errors.push(issue(
      'MIGRATION_REQUIRED',
      'migration.required',
      'Schema, storage-format, or destructive-data changes require a migration/data-operation plan.',
    ));
  }
  if (plan.migration.required !== true) return;

  requireText(plan.migration.strategy, 'migration.strategy', errors);
  requireBoolean(plan.migration.backwardCompatibleDeployment, 'migration.backwardCompatibleDeployment', errors);
  requireTextArray(plan.migration.sourceVersions, 'migration.sourceVersions', errors);
  requireText(plan.migration.targetVersion, 'migration.targetVersion', errors);
  requireTextArray(plan.migration.steps, 'migration.steps', errors);
  requireBoolean(plan.migration.idempotent, 'migration.idempotent', errors);
  requireBoolean(plan.migration.resumable, 'migration.resumable', errors);
  if (plan.migration.idempotent !== true) {
    errors.push(issue('MIGRATION_IDEMPOTENCE', 'migration.idempotent', 'Production migrations must be safe to retry.'));
  }
  if (plan.migration.resumable !== true) {
    errors.push(issue('MIGRATION_RESUMABILITY', 'migration.resumable', 'Production migrations must resume after interruption.'));
  }
  if (!FAILURE_ATOMICITY.has(plan.migration.failureAtomicity)) {
    errors.push(issue(
      'MIGRATION_ATOMICITY',
      'migration.failureAtomicity',
      `migration.failureAtomicity must be one of: ${[...FAILURE_ATOMICITY].join(', ')}.`,
    ));
  }
  for (const field of ['preflightChecks', 'integrityChecks']) {
    requireTextArray(plan.migration[field], `migration.${field}`, errors);
  }
  for (const field of ['backupProcedure', 'batchingAndRateLimit', 'failureHandling', 'downgradeBehavior']) {
    requireText(plan.migration[field], `migration.${field}`, errors);
  }

  const platforms = Array.isArray(plan.platforms) ? plan.platforms : [];
  const hasServerLane = platforms.some((platform) => SERVER_PLATFORMS.has(platform));
  const hasLocalLane = (
    platforms.some((platform) => LOCAL_PLATFORMS.has(platform))
    || plan.impact?.clientLocalState === true
  );
  if (hasServerLane && plan.migration.backwardCompatibleDeployment !== true) {
    errors.push(issue(
      'SERVER_MIXED_DEPLOYMENT',
      'migration.backwardCompatibleDeployment',
      'Server/web migrations must preserve mixed-version deployment compatibility.',
    ));
  }
  if (hasLocalLane && !['transactional', 'copy-on-write'].includes(plan.migration.failureAtomicity)) {
    errors.push(issue(
      'LOCAL_FAILURE_ATOMICITY',
      'migration.failureAtomicity',
      'Desktop/iOS/Android storage migrations require transactional or copy-on-write preservation of the original.',
    ));
  }

  if (stage !== 'design') {
    requireText(plan.migration.restoreTestEvidence, 'migration.restoreTestEvidence', errors);
    if (hasLocalLane) {
      requireText(plan.migration.interruptionTestEvidence, 'migration.interruptionTestEvidence', errors);
    }
  }
}

function validateRollout(plan, risk, errors) {
  if (!riskAtLeast(risk, 'medium')) return;
  if (!requireObject(plan.rollout, 'rollout', errors)) return;
  for (const field of ['strategy', 'featureFlagOrIsolation', 'killSwitchOrStopMechanism', 'owner']) {
    requireText(plan.rollout[field], `rollout.${field}`, errors);
  }
  const minimumStages = riskAtLeast(risk, 'high') ? 2 : 1;
  if (!Array.isArray(plan.rollout.stages) || plan.rollout.stages.length < minimumStages) {
    errors.push(issue(
      'ROLLOUT_STAGES',
      'rollout.stages',
      `${risk} changes require at least ${minimumStages} rollout stage(s).`,
    ));
    return;
  }
  for (const [index, rolloutStage] of plan.rollout.stages.entries()) {
    const prefix = `rollout.stages[${index}]`;
    if (!requireObject(rolloutStage, prefix, errors)) continue;
    requireText(rolloutStage.name, `${prefix}.name`, errors);
    if (typeof rolloutStage.percentage !== 'number' || rolloutStage.percentage < 0 || rolloutStage.percentage > 100) {
      errors.push(issue('ROLLOUT_PERCENTAGE', `${prefix}.percentage`, 'percentage must be a number from 0 to 100.'));
    }
    requireText(rolloutStage.observationWindow, `${prefix}.observationWindow`, errors);
    requireTextArray(rolloutStage.successCriteria, `${prefix}.successCriteria`, errors);
    requireTextArray(rolloutStage.stopCriteria, `${prefix}.stopCriteria`, errors);
  }
}

function validateRollback(plan, risk, stage, errors) {
  if (!riskAtLeast(risk, 'medium')) return;
  if (!requireObject(plan.rollback, 'rollback', errors)) return;
  for (const field of ['codeRollback', 'dataRollbackOrRollForward', 'pointOfNoReturn', 'decisionOwner', 'rto', 'rpo']) {
    requireText(plan.rollback[field], `rollback.${field}`, errors);
  }
  if (stage !== 'design' && riskAtLeast(risk, 'high')) {
    requireTextArray(plan.rollback.evidence, 'rollback.evidence', errors);
  }
}

function validateObservability(plan, risk, errors) {
  if (!riskAtLeast(risk, 'medium')) return;
  if (!requireObject(plan.observability, 'observability', errors)) return;
  for (const field of ['technicalSignals', 'businessSignals', 'migrationAndIntegritySignals', 'alerts']) {
    requireTextArray(plan.observability[field], `observability.${field}`, errors);
  }
  for (const field of ['dashboard', 'monitoringWindow']) {
    requireText(plan.observability[field], `observability.${field}`, errors);
  }
  if (riskAtLeast(risk, 'high')) requireText(plan.observability.auditTrail, 'observability.auditTrail', errors);
}

function validateVerification(plan, stage, errors) {
  if (!requireObject(plan.verification, 'verification', errors)) return;
  if (!Array.isArray(plan.verification.checks) || plan.verification.checks.length === 0) {
    errors.push(issue('VERIFICATION_CHECKS', 'verification.checks', 'At least one verification check is required.'));
  } else {
    for (const [index, check] of plan.verification.checks.entries()) {
      const prefix = `verification.checks[${index}]`;
      if (!requireObject(check, prefix, errors)) continue;
      requireText(check.name, `${prefix}.name`, errors);
      if (stage !== 'design') {
        if (check.status !== 'passed') {
          errors.push(issue('VERIFICATION_NOT_PASSED', `${prefix}.status`, 'Every preflight check must be passed.'));
        }
        requireText(check.evidence, `${prefix}.evidence`, errors);
      }
    }
  }

  if (plan.migration?.required === true) {
    if (!Array.isArray(plan.verification.upgradePaths) || plan.verification.upgradePaths.length === 0) {
      errors.push(issue('UPGRADE_PATHS', 'verification.upgradePaths', 'Migration changes require upgrade-path verification.'));
    } else {
      const coveredSources = new Set();
      for (const [index, upgrade] of plan.verification.upgradePaths.entries()) {
        const prefix = `verification.upgradePaths[${index}]`;
        if (!requireObject(upgrade, prefix, errors)) continue;
        if (requireText(upgrade.from, `${prefix}.from`, errors)) coveredSources.add(upgrade.from);
        requireText(upgrade.to, `${prefix}.to`, errors);
        if (stage !== 'design') {
          if (upgrade.status !== 'passed') {
            errors.push(issue('UPGRADE_PATH_NOT_PASSED', `${prefix}.status`, 'Every declared upgrade path must be passed.'));
          }
          requireText(upgrade.evidence, `${prefix}.evidence`, errors);
        }
      }
      for (const source of plan.migration.sourceVersions || []) {
        if (meaningfulText(source) && !coveredSources.has(source)) {
          errors.push(issue(
            'UPGRADE_SOURCE_UNCOVERED',
            'verification.upgradePaths',
            `No upgrade-path verification covers source version ${source}.`,
          ));
        }
      }
    }
    if (stage !== 'design') requireText(plan.verification.dataScaleEvidence, 'verification.dataScaleEvidence', errors);
  }
}

function validateApprovals(plan, risk, stage, errors) {
  if (stage === 'design' || !riskAtLeast(risk, 'high')) return;
  const required = risk === 'critical' ? 2 : 1;
  if (!Array.isArray(plan.approvals)) {
    errors.push(issue('APPROVALS', 'approvals', `${risk} preflight requires ${required} approved record(s).`));
    return;
  }
  const approved = plan.approvals.filter((approval) => (
    isObject(approval)
    && approval.status === 'approved'
    && meaningfulText(approval.role)
    && meaningfulText(approval.name)
    && meaningfulText(approval.evidence)
  ));
  const distinctApprovers = new Set(approved.map((approval) => approval.name.trim().toLowerCase()));
  if (approved.length < required || distinctApprovers.size < required) {
    errors.push(issue(
      'APPROVALS',
      'approvals',
      `${risk} preflight requires ${required} distinct approved record(s) with role, name, and evidence.`,
    ));
  }
}

function validateExceptions(plan, warnings, errors) {
  if (plan.exceptions === undefined) return;
  if (!Array.isArray(plan.exceptions)) {
    errors.push(issue('EXCEPTIONS', 'exceptions', 'exceptions must be an array.'));
    return;
  }
  for (const [index, exception] of plan.exceptions.entries()) {
    const prefix = `exceptions[${index}]`;
    if (!requireObject(exception, prefix, errors)) continue;
    for (const field of ['requirement', 'reason', 'compensatingControl', 'owner', 'expiry', 'approvalEvidence']) {
      requireText(exception[field], `${prefix}.${field}`, errors);
    }
    warnings.push(issue(
      'EXCEPTION_RECORDED',
      prefix,
      'An exception is recorded; required universal gates remain enforced unless project policy explicitly adds a reviewed waiver mechanism.',
    ));
  }
}

function validateStageStatus(plan, stage, errors) {
  if (stage === 'preflight' && !['ready', 'released', 'closed'].includes(plan.status)) {
    errors.push(issue('PREFLIGHT_STATUS', 'status', 'Preflight requires status ready, released, or closed.'));
  }
  if (stage === 'post-release' && !['released', 'closed'].includes(plan.status)) {
    errors.push(issue('POST_RELEASE_STATUS', 'status', 'Post-release validation requires status released or closed.'));
  }
}

function validatePostRelease(plan, stage, errors) {
  if (stage !== 'post-release') return;
  if (!requireObject(plan.postRelease, 'postRelease', errors)) return;
  for (const field of ['monitoringCompleted', 'migrationReconciled', 'cleanupTracked']) {
    requireBoolean(plan.postRelease[field], `postRelease.${field}`, errors);
    if (plan.postRelease[field] !== true) {
      errors.push(issue('POST_RELEASE_INCOMPLETE', `postRelease.${field}`, `${field} must be true before closure.`));
    }
  }
  requireTextArray(plan.postRelease.evidence, 'postRelease.evidence', errors);
}

export function validateProductionChangePlan(plan, options = {}) {
  const stage = options.stage || 'design';
  if (!STAGES.has(stage)) throw new Error(`stage must be one of: ${[...STAGES].join(', ')}.`);
  const errors = [];
  const warnings = [];
  if (!isObject(plan)) {
    errors.push(issue('PLAN_OBJECT', '$', 'The plan must be a JSON object.'));
    return { valid: false, stage, declaredRisk: null, minimumRisk: null, errors, warnings };
  }

  validateIdentity(plan, errors);
  validateImpact(plan, errors);
  validateArchitecture(plan, errors);

  const minimumRisk = minimumRiskFor(plan.impact);
  const declaredRisk = RISKS.includes(plan.riskLevel) ? plan.riskLevel : null;
  if (declaredRisk && !riskAtLeast(declaredRisk, minimumRisk)) {
    errors.push(issue(
      'RISK_UNDERRATED',
      'riskLevel',
      `Declared risk ${declaredRisk} is below the impact-derived minimum ${minimumRisk}.`,
    ));
  }
  const effectiveRisk = declaredRisk && riskAtLeast(declaredRisk, minimumRisk) ? declaredRisk : minimumRisk;

  validateCompatibility(plan, errors);
  validateMigration(plan, stage, errors);
  validateRollout(plan, effectiveRisk, errors);
  validateRollback(plan, effectiveRisk, stage, errors);
  validateObservability(plan, effectiveRisk, errors);
  validateVerification(plan, stage, errors);
  validateApprovals(plan, effectiveRisk, stage, errors);
  validateExceptions(plan, warnings, errors);
  validateStageStatus(plan, stage, errors);
  validatePostRelease(plan, stage, errors);

  return {
    valid: errors.length === 0,
    stage,
    declaredRisk,
    minimumRisk,
    errors,
    warnings,
  };
}

function printHelp() {
  console.log(`Production change readiness validator (read-only)

Usage:
  node devrules/scripts/production-readiness.mjs --plan <plan.json> [--stage design|preflight|post-release] [--json]

Stages:
  design        Validate architecture, compatibility, migration, rollout, recovery, and observability decisions.
  preflight     Also require passed verification, restore/recovery evidence, and risk-based approvals.
  post-release  Also require completed monitoring, reconciliation, and cleanup tracking.

Exit codes:
  0  Plan passes the requested stage.
  1  Plan is valid JSON but fails readiness validation.
  2  CLI, file, or JSON parsing error.

The validator never writes files or performs deployment/migration operations.`);
}

function printHuman(result, planPath) {
  const heading = result.valid ? 'PASS' : 'FAIL';
  console.log(`[production-readiness] ${heading} stage=${result.stage} plan=${planPath}`);
  console.log(`risk declared=${result.declaredRisk || 'invalid'} minimum=${result.minimumRisk || 'unknown'}`);
  for (const warning of result.warnings) {
    console.log(`WARN ${warning.code} ${warning.field}: ${warning.message}`);
  }
  for (const error of result.errors) {
    console.log(`ERROR ${error.code} ${error.field}: ${error.message}`);
  }
  console.log(`summary errors=${result.errors.length} warnings=${result.warnings.length}`);
}

async function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
      printHelp();
      return;
    }
    if (!options.plan) throw new Error('--plan is required.');
    if (!STAGES.has(options.stage)) throw new Error(`--stage must be one of: ${[...STAGES].join(', ')}.`);

    const planPath = path.resolve(options.plan);
    const content = await fs.readFile(planPath, 'utf8');
    let plan;
    try {
      plan = JSON.parse(content);
    } catch (error) {
      throw new Error(`Invalid JSON in ${planPath}: ${error.message}`);
    }
    const result = validateProductionChangePlan(plan, { stage: options.stage });
    if (options.json) {
      console.log(JSON.stringify({ plan: planPath, ...result }, null, 2));
    } else {
      printHuman(result, planPath);
    }
    if (!result.valid) process.exitCode = 1;
  } catch (error) {
    console.error(`[production-readiness] ${error.message}`);
    process.exitCode = 2;
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
if (invokedPath === import.meta.url) await main();
