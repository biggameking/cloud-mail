#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const TOOL_VERSION = '0.1.0';
const DEFAULT_REPORT_DIR = 'devrules/reports/i18n';
const DEFAULT_SOURCE_EXTENSIONS = [
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.vue',
  '.svelte',
  '.swift',
  '.kt',
  '.java',
  '.md',
  '.mdx',
  '.html',
  '.htm',
];
const DEFAULT_RESOURCE_PATTERNS = [
  '**/*.xcstrings',
  '**/*.strings',
  '**/locales/**/*.{json,jsonc}',
  '**/locale/**/*.{json,jsonc}',
  '**/i18n/**/*.{json,jsonc}',
  '**/translations/**/*.{json,jsonc}',
  '**/*.arb',
  '**/strings.xml',
];
const DEFAULT_EXCLUDE_PATTERNS = [
  '**/.git/**',
  '**/.hg/**',
  '**/.svn/**',
  '**/node_modules/**',
  '**/.next/**',
  '**/.nuxt/**',
  '**/.svelte-kit/**',
  '**/.turbo/**',
  '**/dist/**',
  '**/build/**',
  '**/Build/**',
  '**/coverage/**',
  '**/.build/**',
  '**/DerivedData/**',
  '**/Pods/**',
  '**/vendor/**',
  '**/target/**',
  '**/devrules/reports/**',
  '**/.omx/**',
  '**/.codex/**',
  '**/*.min.js',
  '**/*.map',
  '**/*.snap',
  '**/*.png',
  '**/*.jpg',
  '**/*.jpeg',
  '**/*.gif',
  '**/*.webp',
  '**/*.pdf',
  '**/._*',
];
const DEFAULT_SCAN_ROOT_CANDIDATES = [
  'src',
  'app',
  'apps',
  'Apps',
  'components',
  'pages',
  'packages',
  'Packages',
  'Sources',
  'Resources',
  'content',
  'docs',
  'public',
];
const REVIEW_RISK_KINDS = ['legal', 'billing', 'privacy', 'security', 'brand'];

const usage = `i18n-maintenance ${TOOL_VERSION}

Provider-neutral i18n maintenance automation. This script scans source copy and
locale resources, compares current source units against an approved baseline,
builds translation job plans, validates locale resources, and approves a new
source-unit baseline after review.

Usage:
  node devrules/scripts/i18n-maintenance.mjs scan [--repo <dir>] [--apply] [--json]
  node devrules/scripts/i18n-maintenance.mjs diff [--repo <dir>] [--apply] [--json]
  node devrules/scripts/i18n-maintenance.mjs plan [--repo <dir>] [--apply] [--json]
  node devrules/scripts/i18n-maintenance.mjs validate [--repo <dir>] [--apply] [--json]
  node devrules/scripts/i18n-maintenance.mjs approve [--repo <dir>] [--apply] [--json]

Options:
  --repo <dir>          Repository root. Defaults to current directory.
  --config <file>       Project config. Defaults to devrules/config.json.
  --source <glob>       Add source glob. Repeatable.
  --resource <glob>     Add locale resource glob. Repeatable.
  --exclude <glob>      Add exclude glob. Repeatable.
  --locale <locale>     Add required target/source locale. Repeatable.
  --source-locale <id>  Source locale override.
  --out <dir>           Report directory. Defaults to devrules/reports/i18n.
  --apply               Write generated reports or approved baseline.
  --dry-run             Force report-only mode. This is the default.
  --json                Print machine-readable output.
  --help                Show this help.

Project config may define devrules/config.json:i18n with:
  sourceLocale, requiredLocales, sourceGlobs, sourceRoots, excludeGlobs,
  resourceFiles, reportDir, generatedInventory, approvedInventory, diffReport,
  validationReport, jobPlan, reviewRiskKinds, maxFiles, maxFileBytes.

Safety:
  - Default mode is dry-run.
  - --apply writes only under the configured i18n report paths.
  - The script never calls translation providers and never rewrites product source.
`;

main().catch((error) => {
  console.error(`i18n-maintenance: ${error.message}`);
  if (process.env.DEVRULES_DEBUG) {
    console.error(error.stack);
  }
  process.exitCode = 1;
});

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.options.help || !args.command) {
    console.log(usage.trimEnd());
    return;
  }

  const repoPath = path.resolve(args.options.repo || process.cwd());
  const repoStat = await safeStat(repoPath);
  if (!repoStat?.isDirectory()) {
    throw new Error(`Repository path is not a directory: ${repoPath}`);
  }

  const config = await loadRuntimeConfig(repoPath, args.options);
  let result;
  switch (args.command) {
    case 'scan':
      result = await commandScan(repoPath, config, args.options);
      break;
    case 'diff':
      result = await commandDiff(repoPath, config, args.options);
      break;
    case 'plan':
      result = await commandPlan(repoPath, config, args.options);
      break;
    case 'validate':
      result = await commandValidate(repoPath, config, args.options);
      break;
    case 'approve':
      result = await commandApprove(repoPath, config, args.options);
      break;
    default:
      throw new Error(`Unknown command: ${args.command}`);
  }

  if (args.options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    printHumanResult(args.command, result);
  }

  if (result.exitCode && result.exitCode !== 0) {
    process.exitCode = result.exitCode;
  }
}

function parseArgs(argv) {
  const positional = [];
  const options = {};
  const repeatable = new Set(['source', 'resource', 'exclude', 'locale']);
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      positional.push(token);
      continue;
    }

    const equalIndex = token.indexOf('=');
    const rawKey = token.slice(2, equalIndex === -1 ? undefined : equalIndex);
    const key = rawKey.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    let value;
    if (equalIndex !== -1) {
      value = token.slice(equalIndex + 1);
    } else if (['apply', 'dry-run', 'dryRun', 'json', 'help'].includes(rawKey) || ['apply', 'dryRun', 'json', 'help'].includes(key)) {
      value = true;
    } else {
      value = argv[index + 1];
      index += 1;
    }

    if (value === undefined) {
      throw new Error(`Missing value for --${rawKey}`);
    }

    if (repeatable.has(rawKey)) {
      const current = options[key] || [];
      current.push(String(value));
      options[key] = current;
    } else {
      options[key] = value;
    }
  }

  if (options.dryRun) {
    options.apply = false;
  }

  return {
    command: positional[0],
    positional: positional.slice(1),
    options,
  };
}

async function loadRuntimeConfig(repoPath, options) {
  const configPath = options.config
    ? path.resolve(repoPath, options.config)
    : path.join(repoPath, 'devrules', 'config.json');
  const projectConfig = await readJsonIfExists(configPath);
  const i18nConfig = projectConfig?.i18n || {};

  const reportDir = normalizeRelPath(options.out || i18nConfig.reportDir || DEFAULT_REPORT_DIR);
  const generatedInventory = normalizeRelPath(i18nConfig.generatedInventory || path.posix.join(reportDir, 'source-units.json'));
  const approvedInventory = normalizeRelPath(i18nConfig.approvedInventory || path.posix.join(reportDir, 'source-units.approved.json'));

  const requiredLocales = uniqueStrings([
    ...(toArray(i18nConfig.requiredLocales)),
    ...(toArray(options.locale)),
  ]);
  const sourceLocale = String(options.sourceLocale || i18nConfig.sourceLocale || '').trim();
  const sourceGlobs = uniqueStrings([
    ...toArray(i18nConfig.sourceGlobs),
    ...toArray(options.source),
  ]);
  const sourceRoots = uniqueStrings([
    ...toArray(i18nConfig.sourceRoots),
    ...toArray(projectConfig?.detection?.sourceRoots?.include),
    ...toArray(projectConfig?._lastDetected?.sourceRoots),
  ]);
  const resourcePatterns = uniqueStrings([
    ...toArray(i18nConfig.resourceFiles),
    ...toArray(options.resource),
  ]);
  const excludePatterns = uniqueStrings([
    ...DEFAULT_EXCLUDE_PATTERNS,
    ...toArray(i18nConfig.excludeGlobs),
    ...toArray(options.exclude),
    ...toArray(projectConfig?.detection?.sourceRoots?.exclude).map((item) => `${normalizeRelPath(item)}/**`),
  ]);
  const sourceExtensions = uniqueStrings([
    ...DEFAULT_SOURCE_EXTENSIONS,
    ...toArray(i18nConfig.sourceExtensions).map((item) => item.startsWith('.') ? item : `.${item}`),
  ]);
  const reviewRiskKinds = uniqueStrings([
    ...toArray(i18nConfig.reviewRiskKinds),
    ...(toArray(i18nConfig.reviewRiskKinds).length ? [] : REVIEW_RISK_KINDS),
  ]);

  return {
    schemaVersion: 1,
    configPath: (await pathExists(configPath)) ? configPath : null,
    sourceLocale,
    requiredLocales,
    sourceGlobs,
    sourceRoots,
    resourcePatterns: resourcePatterns.length ? resourcePatterns : DEFAULT_RESOURCE_PATTERNS,
    excludePatterns,
    sourceExtensions,
    reportDir,
    generatedInventory,
    approvedInventory,
    diffReport: normalizeRelPath(i18nConfig.diffReport || path.posix.join(reportDir, 'content-diff.json')),
    validationReport: normalizeRelPath(i18nConfig.validationReport || path.posix.join(reportDir, 'validation-report.json')),
    jobPlan: normalizeRelPath(i18nConfig.jobPlan || path.posix.join(reportDir, 'translation-jobs.json')),
    reviewRiskKinds,
    maxFiles: Number(i18nConfig.maxFiles || 20000),
    maxFileBytes: Number(i18nConfig.maxFileBytes || 1024 * 1024),
  };
}

async function commandScan(repoPath, config, options) {
  const scan = await scanRepository(repoPath, config);
  const inventory = buildInventory(repoPath, config, scan);
  const apply = Boolean(options.apply);
  const outputPath = path.join(repoPath, config.generatedInventory);
  const actions = [];

  if (apply) {
    await writeJson(outputPath, inventory);
    actions.push({ action: 'write', path: config.generatedInventory });
  } else {
    actions.push({ action: 'would_write', path: config.generatedInventory });
  }

  return {
    ok: true,
    command: 'scan',
    mode: apply ? 'apply' : 'dry-run',
    repo: repoPath,
    toolVersion: TOOL_VERSION,
    inventoryPath: config.generatedInventory,
    sourceLocale: inventory.sourceLocale,
    requiredLocales: inventory.requiredLocales,
    units: {
      total: inventory.units.length,
      fromResources: inventory.units.filter((unit) => unit.origin === 'resource').length,
      fromSourceScan: inventory.units.filter((unit) => unit.origin === 'source_scan').length,
      risky: inventory.units.filter((unit) => unit.risk !== 'normal').length,
    },
    files: scan.files,
    resources: scan.resources.summary,
    samples: inventory.units.slice(0, 8).map(publicUnitSummary),
    actions,
  };
}

async function commandDiff(repoPath, config, options) {
  const current = await currentInventory(repoPath, config);
  const approved = await readJsonIfExists(path.join(repoPath, config.approvedInventory));
  const diff = diffInventories(current, approved);
  const apply = Boolean(options.apply);
  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    toolVersion: TOOL_VERSION,
    repoName: path.basename(repoPath),
    sourceLocale: current.sourceLocale,
    requiredLocales: current.requiredLocales,
    paths: {
      generatedInventory: config.generatedInventory,
      approvedInventory: config.approvedInventory,
    },
    ...diff,
  };

  const actions = [];
  if (apply) {
    await writeJson(path.join(repoPath, config.diffReport), report);
    actions.push({ action: 'write', path: config.diffReport });
  } else {
    actions.push({ action: 'would_write', path: config.diffReport });
  }

  return {
    ok: true,
    command: 'diff',
    mode: apply ? 'apply' : 'dry-run',
    repo: repoPath,
    reportPath: config.diffReport,
    ...summarizeDiff(diff),
    baseline: approved ? 'approved_inventory' : 'missing_approved_inventory',
    samples: {
      added: diff.added.slice(0, 5).map(publicUnitSummary),
      changed: diff.changed.slice(0, 5).map((item) => ({ id: item.id, sourcePath: item.current.sourcePath, previousFingerprint: item.previous.fingerprint, currentFingerprint: item.current.fingerprint })),
      removed: diff.removed.slice(0, 5).map(publicUnitSummary),
    },
    actions,
  };
}

async function commandPlan(repoPath, config, options) {
  const current = await currentInventory(repoPath, config);
  const approved = await readJsonIfExists(path.join(repoPath, config.approvedInventory));
  const diff = diffInventories(current, approved);
  const targetLocales = current.requiredLocales.filter((locale) => locale !== current.sourceLocale);
  const jobs = [];

  for (const unit of diff.added) {
    for (const locale of targetLocales) {
      jobs.push(buildTranslationJob(unit, locale, 'added', current.sourceLocale, config));
    }
  }
  for (const item of diff.changed) {
    for (const locale of targetLocales) {
      jobs.push(buildTranslationJob(item.current, locale, 'changed', current.sourceLocale, config));
    }
  }

  jobs.sort((left, right) => {
    const byLocale = left.targetLocale.localeCompare(right.targetLocale);
    if (byLocale !== 0) return byLocale;
    const byNamespace = left.namespace.localeCompare(right.namespace);
    if (byNamespace !== 0) return byNamespace;
    return left.sourceUnitId.localeCompare(right.sourceUnitId);
  });

  const plan = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    toolVersion: TOOL_VERSION,
    sourceLocale: current.sourceLocale,
    targetLocales,
    baseline: approved ? 'approved_inventory' : 'missing_approved_inventory',
    summary: {
      jobs: jobs.length,
      addedUnits: diff.added.length,
      changedUnits: diff.changed.length,
      reviewRequired: jobs.filter((job) => job.requiresHumanReview).length,
    },
    jobs,
  };

  const actions = [];
  const apply = Boolean(options.apply);
  if (apply) {
    await writeJson(path.join(repoPath, config.jobPlan), plan);
    actions.push({ action: 'write', path: config.jobPlan });
  } else {
    actions.push({ action: 'would_write', path: config.jobPlan });
  }

  return {
    ok: true,
    command: 'plan',
    mode: apply ? 'apply' : 'dry-run',
    repo: repoPath,
    jobPlanPath: config.jobPlan,
    sourceLocale: current.sourceLocale,
    targetLocales,
    jobs: plan.summary,
    samples: jobs.slice(0, 8),
    actions,
  };
}

async function commandValidate(repoPath, config, options) {
  const scan = await scanRepository(repoPath, config, { sourceOnly: false });
  const inventory = buildInventory(repoPath, config, scan);
  const validation = validateInventoryAndResources(inventory, scan.resources, config);
  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    toolVersion: TOOL_VERSION,
    sourceLocale: inventory.sourceLocale,
    requiredLocales: inventory.requiredLocales,
    inventory: {
      units: inventory.units.length,
      risky: inventory.units.filter((unit) => unit.risk !== 'normal').length,
    },
    resources: scan.resources.summary,
    ...validation,
  };
  const actions = [];
  const apply = Boolean(options.apply);
  if (apply) {
    await writeJson(path.join(repoPath, config.validationReport), report);
    actions.push({ action: 'write', path: config.validationReport });
  } else {
    actions.push({ action: 'would_write', path: config.validationReport });
  }

  return {
    ok: validation.errors.length === 0,
    command: 'validate',
    mode: apply ? 'apply' : 'dry-run',
    repo: repoPath,
    validationReportPath: config.validationReport,
    sourceLocale: inventory.sourceLocale,
    requiredLocales: inventory.requiredLocales,
    errors: validation.errors,
    warnings: validation.warnings,
    summary: validation.summary,
    actions,
    exitCode: validation.errors.length === 0 ? 0 : 2,
  };
}

async function commandApprove(repoPath, config, options) {
  const generatedPath = path.join(repoPath, config.generatedInventory);
  const inventory = await readJsonIfExists(generatedPath);
  if (!inventory) {
    throw new Error(`Generated inventory not found: ${config.generatedInventory}. Run scan --apply first.`);
  }

  const validation = validateInventoryShape(inventory);
  if (validation.errors.length) {
    return {
      ok: false,
      command: 'approve',
      mode: options.apply ? 'apply' : 'dry-run',
      repo: repoPath,
      errors: validation.errors,
      warnings: validation.warnings,
      actions: [],
      exitCode: 2,
    };
  }

  const resourceValidation = await commandValidate(repoPath, config, { apply: false });
  if (resourceValidation.errors.length) {
    return {
      ok: false,
      command: 'approve',
      mode: options.apply ? 'apply' : 'dry-run',
      repo: repoPath,
      errors: resourceValidation.errors,
      warnings: resourceValidation.warnings,
      actions: [{ action: 'blocked_by_validate', path: config.validationReport }],
      exitCode: 2,
    };
  }

  const approved = {
    ...inventory,
    approvedAt: new Date().toISOString(),
    approvalSource: config.generatedInventory,
  };
  const apply = Boolean(options.apply);
  const actions = [];
  if (apply) {
    await writeJson(path.join(repoPath, config.approvedInventory), approved);
    actions.push({ action: 'write', path: config.approvedInventory });
  } else {
    actions.push({ action: 'would_write', path: config.approvedInventory });
  }

  return {
    ok: true,
    command: 'approve',
    mode: apply ? 'apply' : 'dry-run',
    repo: repoPath,
    source: config.generatedInventory,
    approvedInventoryPath: config.approvedInventory,
    units: inventory.units?.length || 0,
    actions,
  };
}

async function currentInventory(repoPath, config) {
  const generated = await readJsonIfExists(path.join(repoPath, config.generatedInventory));
  if (generated?.units) {
    return generated;
  }
  const scan = await scanRepository(repoPath, config);
  return buildInventory(repoPath, config, scan);
}

async function scanRepository(repoPath, config) {
  const resourceFiles = await collectFiles(repoPath, {
    includePatterns: config.resourcePatterns,
    excludePatterns: config.excludePatterns,
    maxFiles: config.maxFiles,
  });
  const resources = await parseResourceFiles(repoPath, resourceFiles, config);
  const sourceLocale = config.sourceLocale || resources.detectedSourceLocale || 'en';

  const sourcePatterns = config.sourceGlobs.length
    ? config.sourceGlobs
    : await defaultSourcePatterns(repoPath, config);
  const sourceFiles = await collectFiles(repoPath, {
    includePatterns: sourcePatterns,
    excludePatterns: [
      ...config.excludePatterns,
      ...config.resourcePatterns,
    ],
    extensions: config.sourceExtensions,
    maxFiles: config.maxFiles,
  });

  const scannedUnits = [];
  let truncatedFiles = 0;
  for (const relPath of sourceFiles) {
    const absolutePath = path.join(repoPath, relPath);
    const stat = await safeStat(absolutePath);
    if (!stat || stat.size > config.maxFileBytes) {
      truncatedFiles += 1;
      continue;
    }
    const text = await fs.readFile(absolutePath, 'utf8');
    scannedUnits.push(...extractSourceUnits(relPath, text, sourceLocale));
  }

  const files = {
    sourcePatterns,
    resourcePatterns: config.resourcePatterns,
    sourceScanned: sourceFiles.length,
    resourceScanned: resourceFiles.length,
    truncated: truncatedFiles,
  };

  return {
    files,
    sourceLocale,
    resources,
    sourceUnits: mergeDuplicateUnits(scannedUnits),
  };
}

async function defaultSourcePatterns(repoPath, config) {
  const candidates = uniqueStrings([
    ...config.sourceRoots,
    ...DEFAULT_SCAN_ROOT_CANDIDATES,
  ]);
  const existingRoots = [];
  for (const candidate of candidates) {
    const normalized = normalizeRelPath(candidate).replace(/\/+$/, '');
    if (!normalized || normalized === '.') {
      continue;
    }
    const stat = await safeStat(path.join(repoPath, normalized));
    if (stat?.isDirectory()) {
      existingRoots.push(normalized);
    } else if (stat?.isFile()) {
      existingRoots.push(normalized);
    }
  }

  const extensionPattern = `{${config.sourceExtensions.map((item) => item.replace(/^\./, '')).join(',')}}`;
  if (!existingRoots.length) {
    return [`**/*.${extensionPattern}`];
  }

  return existingRoots.map((root) => {
    if (path.posix.extname(root)) {
      return root;
    }
    return `${root}/**/*.${extensionPattern}`;
  });
}

function buildInventory(repoPath, config, scan) {
  const sourceLocale = config.sourceLocale || scan.sourceLocale || 'en';
  const requiredLocales = inferRequiredLocales(config, scan.resources, sourceLocale);
  const units = mergeDuplicateUnits([
    ...scan.resources.units,
    ...scan.sourceUnits,
  ]).map((unit) => ({
    ...unit,
    sourceLocale,
    fingerprint: fingerprintUnit(unit),
  }));

  units.sort((left, right) => {
    const byNamespace = left.namespace.localeCompare(right.namespace);
    if (byNamespace !== 0) return byNamespace;
    return left.id.localeCompare(right.id);
  });

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    toolVersion: TOOL_VERSION,
    repoName: path.basename(repoPath),
    sourceLocale,
    requiredLocales,
    config: {
      sourceGlobs: scan.files.sourcePatterns,
      resourceFiles: config.resourcePatterns,
      excludeGlobs: config.excludePatterns,
    },
    summary: {
      units: units.length,
      resourceUnits: units.filter((unit) => unit.origin === 'resource').length,
      sourceScanUnits: units.filter((unit) => unit.origin === 'source_scan').length,
      riskyUnits: units.filter((unit) => unit.risk !== 'normal').length,
      resourceFiles: scan.resources.summary.files,
      sourceFiles: scan.files.sourceScanned,
    },
    units,
  };
}

function inferRequiredLocales(config, resources, sourceLocale) {
  const explicit = uniqueStrings([
    sourceLocale,
    ...config.requiredLocales,
  ].filter(Boolean));
  if (config.requiredLocales.length) {
    return explicit;
  }

  const resourceLocales = uniqueStrings([
    sourceLocale,
    ...resources.primaryLocales,
  ].filter(Boolean));
  return resourceLocales.length ? resourceLocales : [sourceLocale || 'en'];
}

async function parseResourceFiles(repoPath, resourceFiles, config) {
  const result = {
    units: [],
    records: [],
    files: [],
    primaryLocales: [],
    detectedSourceLocale: '',
    summary: {
      files: 0,
      parseErrors: 0,
      keys: 0,
      locales: [],
      types: {},
    },
  };

  for (const relPath of resourceFiles) {
    const absolutePath = path.join(repoPath, relPath);
    const stat = await safeStat(absolutePath);
    if (!stat || stat.size > config.maxFileBytes * 4) {
      continue;
    }
    const raw = await fs.readFile(absolutePath, 'utf8');
    const parsed = parseResourceFile(relPath, raw, config);
    result.files.push(parsed.file);
    result.units.push(...parsed.units);
    result.records.push(...parsed.records);

    if (parsed.file.sourceLocale && !result.detectedSourceLocale) {
      result.detectedSourceLocale = parsed.file.sourceLocale;
    }
    if (parsed.file.locales.length > result.primaryLocales.length) {
      result.primaryLocales = parsed.file.locales;
    }
    result.summary.files += 1;
    result.summary.parseErrors += parsed.file.parseError ? 1 : 0;
    result.summary.keys += parsed.file.keyCount;
    result.summary.types[parsed.file.type] = (result.summary.types[parsed.file.type] || 0) + 1;
  }

  result.summary.locales = uniqueStrings(result.files.flatMap((file) => file.locales));
  return result;
}

function parseResourceFile(relPath, raw, config) {
  const extension = path.posix.extname(relPath).toLowerCase();
  if (extension === '.xcstrings') {
    return parseXcstrings(relPath, raw, config);
  }
  if (extension === '.strings') {
    return parseAppleStrings(relPath, raw, config);
  }
  if (extension === '.json' || extension === '.jsonc' || extension === '.arb') {
    return parseJsonLocale(relPath, raw, config);
  }
  if (path.posix.basename(relPath).toLowerCase() === 'strings.xml') {
    return parseAndroidStrings(relPath, raw, config);
  }
  return emptyParsedResource(relPath, 'unknown', 'unsupported resource type');
}

function parseXcstrings(relPath, raw, config) {
  try {
    const json = JSON.parse(stripJsonBom(raw));
    const strings = json.strings && typeof json.strings === 'object' ? json.strings : {};
    const sourceLocale = config.sourceLocale || json.sourceLanguage || '';
    const locales = uniqueStrings(Object.values(strings).flatMap((entry) => Object.keys(entry?.localizations || {})));
    const units = [];
    const records = [];
    for (const [key, entry] of Object.entries(strings)) {
      const localizations = entry?.localizations || {};
      const sourceValue = valueFromXcstringLocalization(localizations[sourceLocale])
        || valueFromXcstringLocalization(Object.values(localizations)[0])
        || key;
      const line = lineOfNeedle(raw, JSON.stringify(key));
      const common = buildUnit({
        id: key,
        text: sourceValue,
        kind: 'locale_resource',
        namespace: namespaceFromKey(key, relPath),
        sourcePath: relPath,
        line,
        context: String(entry?.comment || ''),
        origin: 'resource',
      });
      units.push(common);
      for (const locale of Object.keys(localizations)) {
        const value = valueFromXcstringLocalization(localizations[locale]) || '';
        records.push({
          key,
          locale,
          value,
          sourcePath: relPath,
          type: 'xcstrings',
          placeholders: extractPlaceholders(value),
          state: localizations[locale]?.stringUnit?.state || '',
        });
      }
    }
    return {
      file: {
        path: relPath,
        type: 'xcstrings',
        sourceLocale,
        locales,
        keyCount: Object.keys(strings).length,
        parseError: '',
      },
      units,
      records,
    };
  } catch (error) {
    return emptyParsedResource(relPath, 'xcstrings', error.message);
  }
}

function valueFromXcstringLocalization(localization) {
  if (!localization || typeof localization !== 'object') {
    return '';
  }
  return String(localization.stringUnit?.value || '');
}

function parseAppleStrings(relPath, raw) {
  const locale = localeFromPath(relPath);
  const regex = /"((?:\\.|[^"\\])*)"\s*=\s*"((?:\\.|[^"\\])*)"\s*;/g;
  const units = [];
  const records = [];
  for (const match of raw.matchAll(regex)) {
    const key = decodeQuoted(match[1]);
    const value = decodeQuoted(match[2]);
    const line = lineNumberAtIndex(raw, match.index || 0);
    const unit = buildUnit({
      id: key,
      text: value || key,
      kind: 'locale_resource',
      namespace: namespaceFromKey(key, relPath),
      sourcePath: relPath,
      line,
      context: '',
      origin: 'resource',
    });
    units.push(unit);
    records.push({
      key,
      locale,
      value,
      sourcePath: relPath,
      type: 'strings',
      placeholders: extractPlaceholders(value),
      state: '',
    });
  }
  return {
    file: {
      path: relPath,
      type: 'strings',
      sourceLocale: locale,
      locales: locale ? [locale] : [],
      keyCount: records.length,
      parseError: '',
    },
    units,
    records,
  };
}

function parseJsonLocale(relPath, raw, config) {
  try {
    const json = JSON.parse(stripJsonComments(stripJsonBom(raw)));
    const flattened = flattenJsonStrings(json);
    const locale = localeFromPath(relPath) || localeFromFilename(relPath);
    const units = [];
    const records = [];
    for (const [key, value] of flattened) {
      const text = String(value);
      if (!isLikelyHumanText(text) && config.sourceLocale !== locale) {
        continue;
      }
      const line = lineOfNeedle(raw, JSON.stringify(key.split('.').at(-1) || key));
      units.push(buildUnit({
        id: key,
        text,
        kind: 'locale_resource',
        namespace: namespaceFromKey(key, relPath),
        sourcePath: relPath,
        line,
        context: '',
        origin: 'resource',
      }));
      records.push({
        key,
        locale,
        value: text,
        sourcePath: relPath,
        type: 'json',
        placeholders: extractPlaceholders(text),
        state: '',
      });
    }
    return {
      file: {
        path: relPath,
        type: path.posix.extname(relPath).slice(1) || 'json',
        sourceLocale: locale,
        locales: locale ? [locale] : [],
        keyCount: records.length,
        parseError: '',
      },
      units,
      records,
    };
  } catch (error) {
    return emptyParsedResource(relPath, path.posix.extname(relPath).slice(1) || 'json', error.message);
  }
}

function parseAndroidStrings(relPath, raw) {
  const locale = localeFromAndroidPath(relPath);
  const regex = /<string\s+[^>]*name=["']([^"']+)["'][^>]*>([\s\S]*?)<\/string>/g;
  const units = [];
  const records = [];
  for (const match of raw.matchAll(regex)) {
    const key = match[1];
    const value = stripXmlTags(match[2]).trim();
    const line = lineNumberAtIndex(raw, match.index || 0);
    units.push(buildUnit({
      id: key,
      text: value || key,
      kind: 'locale_resource',
      namespace: namespaceFromKey(key, relPath),
      sourcePath: relPath,
      line,
      context: '',
      origin: 'resource',
    }));
    records.push({
      key,
      locale,
      value,
      sourcePath: relPath,
      type: 'android_xml',
      placeholders: extractPlaceholders(value),
      state: '',
    });
  }
  return {
    file: {
      path: relPath,
      type: 'android_xml',
      sourceLocale: locale,
      locales: locale ? [locale] : [],
      keyCount: records.length,
      parseError: '',
    },
    units,
    records,
  };
}

function emptyParsedResource(relPath, type, parseError) {
  return {
    file: {
      path: relPath,
      type,
      sourceLocale: '',
      locales: [],
      keyCount: 0,
      parseError,
    },
    units: [],
    records: [],
  };
}

function extractSourceUnits(relPath, text, sourceLocale) {
  const extension = path.posix.extname(relPath).toLowerCase();
  if (extension === '.md' || extension === '.mdx') {
    return extractMarkdownUnits(relPath, text, sourceLocale);
  }
  if (extension === '.swift') {
    return extractSwiftUnits(relPath, text, sourceLocale);
  }
  return extractGenericQuotedUnits(relPath, text, sourceLocale);
}

function extractMarkdownUnits(relPath, text, sourceLocale) {
  const units = [];
  const lines = text.split(/\r?\n/);
  let paragraph = [];
  let paragraphStart = 0;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    const raw = paragraph.join(' ').trim();
    paragraph = [];
    if (!isLikelyHumanText(raw) || raw.length > 800) return;
    units.push(buildSourceScanUnit(relPath, raw, 'markdown_paragraph', paragraphStart, sourceLocale));
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('```') || trimmed.startsWith('---')) {
      flushParagraph();
      continue;
    }
    const heading = trimmed.match(/^(#{1,6})\s+(.+)$/);
    const listItem = trimmed.match(/^[-*+]\s+(.+)$/);
    if (heading || listItem) {
      flushParagraph();
      const raw = cleanupMarkdownInline((heading?.[2] || listItem?.[1] || '').trim());
      if (isLikelyHumanText(raw)) {
        units.push(buildSourceScanUnit(relPath, raw, heading ? 'markdown_heading' : 'markdown_list_item', index + 1, sourceLocale));
      }
      continue;
    }
    if (!paragraph.length) {
      paragraphStart = index + 1;
    }
    paragraph.push(cleanupMarkdownInline(trimmed));
  }
  flushParagraph();
  return units;
}

function extractSwiftUnits(relPath, text, sourceLocale) {
  const units = [];
  const patterns = [
    { kind: 'swiftui_text', regex: /\b(?:Text|Label|Button|Toggle|Picker|Section|NavigationLink|Menu|Link)\s*\(\s*"((?:\\.|[^"\\])*)"/g },
    { kind: 'swiftui_modifier', regex: /\.(?:navigationTitle|alert|confirmationDialog|help|accessibilityLabel|accessibilityHint|textFieldStyle)\s*\(\s*"((?:\\.|[^"\\])*)"/g },
    { kind: 'localized_string', regex: /\b(?:String\s*\(\s*localized:|LocalizedStringResource\s*\()\s*"((?:\\.|[^"\\])*)"/g },
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern.regex)) {
      const value = decodeQuoted(match[1]);
      if (!isLikelyHumanText(value)) continue;
      units.push(buildSourceScanUnit(relPath, value, pattern.kind, lineNumberAtIndex(text, match.index || 0), sourceLocale));
    }
  }
  units.push(...extractGenericQuotedUnits(relPath, text, sourceLocale, { conservative: true }));
  return mergeDuplicateUnits(units);
}

function extractGenericQuotedUnits(relPath, text, sourceLocale, options = {}) {
  const units = [];
  const regex = /(["'`])((?:\\.|(?!\1)[^\\]){2,500})\1/g;
  const skipBefore = /(import|from|require|case|enum|className|style|id|data-testid|testID|accessibilityIdentifier|systemImage|image|icon|font|color|url|path|route|href|src)\s*[:=]?\s*$/i;
  for (const match of text.matchAll(regex)) {
    const before = text.slice(Math.max(0, (match.index || 0) - 48), match.index || 0);
    if (skipBefore.test(before)) continue;
    const value = decodeQuoted(match[2]);
    if (!isLikelyHumanText(value)) continue;
    if (options.conservative && looksLikeLocalizationKey(value)) continue;
    units.push(buildSourceScanUnit(relPath, value, 'quoted_string', lineNumberAtIndex(text, match.index || 0), sourceLocale));
  }
  return mergeDuplicateUnits(units);
}

function buildSourceScanUnit(relPath, text, kind, line, sourceLocale) {
  const normalized = normalizeText(text);
  const namespace = namespaceFromPath(relPath);
  return buildUnit({
    id: `auto.${shortHash([kind, normalized, extractPlaceholders(normalized).join('|')].join('\0'))}`,
    sourceLocale,
    text,
    kind,
    namespace,
    sourcePath: relPath,
    line,
    context: '',
    origin: 'source_scan',
  });
}

function buildUnit(input) {
  const text = String(input.text || '');
  const sourcePath = normalizeRelPath(input.sourcePath || '');
  const placeholders = extractPlaceholders(text);
  const richTextTags = extractRichTextTags(text);
  const pluralCategories = extractPluralCategories(text);
  const links = extractLinks(text);
  const semanticPath = input.semanticPath || `${sourcePath}${input.line ? `:${input.line}` : ''}`;
  return {
    id: String(input.id || `auto.${shortHash(`${semanticPath}\0${normalizeText(text)}`)}`),
    sourceLocale: String(input.sourceLocale || ''),
    text,
    kind: String(input.kind || 'text'),
    namespace: String(input.namespace || namespaceFromPath(sourcePath)),
    sourcePath,
    semanticPath,
    line: Number(input.line || 0),
    placeholders,
    richTextTags,
    pluralCategories,
    links,
    context: String(input.context || ''),
    risk: classifyRisk({ text, key: input.id, path: sourcePath }),
    origin: input.origin || 'source_scan',
    fingerprint: '',
  };
}

function mergeDuplicateUnits(units) {
  const map = new Map();
  for (const unit of units) {
    const existing = map.get(unit.id);
    if (!existing) {
      map.set(unit.id, {
        ...unit,
        occurrences: unit.occurrences || [{ sourcePath: unit.sourcePath, line: unit.line }],
      });
      continue;
    }
    const seen = new Set(existing.occurrences.map((item) => `${item.sourcePath}:${item.line}`));
    const occurrence = { sourcePath: unit.sourcePath, line: unit.line };
    if (!seen.has(`${occurrence.sourcePath}:${occurrence.line}`)) {
      existing.occurrences.push(occurrence);
    }
    if (existing.origin !== unit.origin) {
      existing.origin = existing.origin === 'resource' ? 'resource' : unit.origin;
    }
  }
  return [...map.values()];
}

function fingerprintUnit(unit) {
  const payload = {
    text: normalizeText(unit.text),
    placeholders: unit.placeholders,
    richTextTags: unit.richTextTags,
    pluralCategories: unit.pluralCategories,
    links: unit.links,
    key: unit.origin === 'resource' ? unit.id : '',
  };
  return `sha256:${hash(JSON.stringify(payload))}`;
}

function diffInventories(current, approved) {
  const currentUnits = Array.isArray(current?.units) ? current.units : [];
  const approvedUnits = Array.isArray(approved?.units) ? approved.units : [];
  const currentMap = new Map(currentUnits.map((unit) => [unit.id, unit]));
  const approvedMap = new Map(approvedUnits.map((unit) => [unit.id, unit]));
  const added = [];
  const changed = [];
  const moved = [];
  const removed = [];
  const placeholderDrift = [];

  for (const unit of currentUnits) {
    const previous = approvedMap.get(unit.id);
    if (!previous) {
      added.push(unit);
      continue;
    }
    if (previous.fingerprint !== unit.fingerprint) {
      changed.push({ id: unit.id, previous, current: unit });
    } else if (previous.sourcePath !== unit.sourcePath || previous.line !== unit.line) {
      moved.push({ id: unit.id, previous, current: unit });
    }
    if (JSON.stringify(previous.placeholders || []) !== JSON.stringify(unit.placeholders || [])) {
      placeholderDrift.push({ id: unit.id, previous: previous.placeholders || [], current: unit.placeholders || [] });
    }
  }

  for (const unit of approvedUnits) {
    if (!currentMap.has(unit.id)) {
      removed.push(unit);
    }
  }

  return {
    added,
    changed,
    moved,
    removed,
    placeholderDrift,
    risky: currentUnits.filter((unit) => unit.risk !== 'normal'),
  };
}

function summarizeDiff(diff) {
  return {
    summary: {
      added: diff.added.length,
      changed: diff.changed.length,
      moved: diff.moved.length,
      removed: diff.removed.length,
      placeholderDrift: diff.placeholderDrift.length,
      riskyCurrentUnits: diff.risky.length,
    },
  };
}

function buildTranslationJob(unit, targetLocale, reason, sourceLocale, config) {
  return {
    jobId: `i18n-${new Date().toISOString().slice(0, 10)}-${shortHash(`${unit.id}\0${targetLocale}\0${reason}`)}`,
    sourceUnitId: unit.id,
    sourceLocale,
    targetLocale,
    reason,
    namespace: unit.namespace,
    sourcePath: unit.sourcePath,
    text: unit.text,
    risk: unit.risk,
    placeholders: unit.placeholders,
    richTextTags: unit.richTextTags,
    pluralCategories: unit.pluralCategories,
    requiresHumanReview: config.reviewRiskKinds.includes(unit.risk),
  };
}

function validateInventoryAndResources(inventory, resources, config) {
  const shape = validateInventoryShape(inventory);
  const errors = [...shape.errors];
  const warnings = [...shape.warnings];
  const explicitLocales = config.requiredLocales.length > 0;
  const requiredLocales = inventory.requiredLocales || [];

  for (const file of resources.files) {
    if (file.parseError) {
      errors.push({
        code: 'resource_parse_error',
        path: file.path,
        message: file.parseError,
      });
    }
  }

  const grouped = groupResourceRecords(resources.records);
  for (const [groupKey, records] of grouped) {
    const byLocale = new Map(records.map((record) => [record.locale || 'unknown', record]));
    const localesToCheck = explicitLocales
      ? requiredLocales
      : uniqueStrings(records.map((record) => record.locale).filter(Boolean));
    const sourceRecord = byLocale.get(inventory.sourceLocale) || records[0];
    const sourcePlaceholders = sourceRecord?.placeholders || [];

    for (const locale of localesToCheck) {
      const record = byLocale.get(locale);
      if (!record) {
        const target = explicitLocales ? errors : warnings;
        target.push({
          code: 'missing_locale_value',
          key: groupKey,
          locale,
          message: `Missing ${locale} value for ${groupKey}`,
        });
        continue;
      }
      if (!String(record.value || '').trim()) {
        const target = explicitLocales ? errors : warnings;
        target.push({
          code: 'empty_locale_value',
          key: groupKey,
          locale,
          path: record.sourcePath,
          message: `Empty ${locale} value for ${groupKey}`,
        });
      }
      if (JSON.stringify(sourcePlaceholders) !== JSON.stringify(record.placeholders || [])) {
        errors.push({
          code: 'placeholder_drift',
          key: groupKey,
          locale,
          path: record.sourcePath,
          sourcePlaceholders,
          targetPlaceholders: record.placeholders || [],
          message: `Placeholder drift for ${groupKey} (${locale})`,
        });
      }
    }
  }

  const duplicateIds = duplicates(inventory.units.map((unit) => unit.id));
  for (const id of duplicateIds) {
    errors.push({
      code: 'duplicate_unit_id',
      id,
      message: `Duplicate source-unit id: ${id}`,
    });
  }

  return {
    errors,
    warnings,
    summary: {
      errors: errors.length,
      warnings: warnings.length,
      resourceGroups: grouped.size,
      resourceFiles: resources.files.length,
    },
  };
}

function validateInventoryShape(inventory) {
  const errors = [];
  const warnings = [];
  if (!inventory || typeof inventory !== 'object') {
    return { errors: [{ code: 'invalid_inventory', message: 'Inventory is not an object.' }], warnings };
  }
  if (!Array.isArray(inventory.units)) {
    errors.push({ code: 'missing_units', message: 'Inventory has no units array.' });
  }
  if (!inventory.sourceLocale) {
    warnings.push({ code: 'missing_source_locale', message: 'Inventory has no sourceLocale.' });
  }
  for (const [index, unit] of (inventory.units || []).entries()) {
    for (const field of ['id', 'text', 'sourcePath', 'fingerprint']) {
      if (!unit[field]) {
        errors.push({ code: 'missing_unit_field', index, field, message: `Unit ${index} is missing ${field}.` });
      }
    }
  }
  return { errors, warnings };
}

async function collectFiles(repoPath, options) {
  const includeRegexes = expandPatterns(options.includePatterns || ['**/*']).map((pattern) => globToRegExp(pattern));
  const excludeRegexes = expandPatterns(options.excludePatterns || []).map((pattern) => globToRegExp(pattern));
  const extensions = new Set(options.extensions || []);
  const files = [];

  async function walk(directory) {
    if (files.length >= options.maxFiles) {
      return;
    }
    const entries = await safeReadDir(directory);
    for (const entry of entries) {
      const absolutePath = path.join(directory, entry.name);
      const relPath = normalizeRelPath(path.relative(repoPath, absolutePath));
      if (!relPath || shouldSkipByName(entry.name)) {
        continue;
      }
      if (excludeRegexes.some((regex) => regex.test(relPath))) {
        continue;
      }
      if (entry.isDirectory()) {
        await walk(absolutePath);
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }
      if (extensions.size && !extensions.has(path.posix.extname(relPath))) {
        continue;
      }
      if (!includeRegexes.some((regex) => regex.test(relPath))) {
        continue;
      }
      files.push(relPath);
      if (files.length >= options.maxFiles) {
        return;
      }
    }
  }

  await walk(repoPath);
  files.sort();
  return files;
}

function shouldSkipByName(name) {
  return name === '.git'
    || name === 'node_modules'
    || name === 'DerivedData'
    || name === 'Build'
    || name === 'build'
    || name === 'dist'
    || name === '.build'
    || name.startsWith('._');
}

function expandPatterns(patterns) {
  return uniqueStrings(patterns.flatMap((pattern) => braceExpand(normalizeRelPath(pattern))));
}

function braceExpand(pattern) {
  const match = pattern.match(/\{([^{}]+)\}/);
  if (!match) {
    return [pattern];
  }
  const before = pattern.slice(0, match.index);
  const after = pattern.slice((match.index || 0) + match[0].length);
  return match[1].split(',').flatMap((part) => braceExpand(`${before}${part.trim()}${after}`));
}

function globToRegExp(pattern) {
  let source = '^';
  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index];
    const next = pattern[index + 1];
    if (char === '*') {
      if (next === '*') {
        const after = pattern[index + 2];
        if (after === '/') {
          source += '(?:.*/)?';
          index += 2;
        } else {
          source += '.*';
          index += 1;
        }
      } else {
        source += '[^/]*';
      }
    } else if (char === '?') {
      source += '[^/]';
    } else {
      source += escapeRegex(char);
    }
  }
  source += '$';
  return new RegExp(source);
}

function isLikelyHumanText(value) {
  const text = normalizeText(value);
  if (text.length < 2 || text.length > 600) return false;
  if (!hasLetter(text)) return false;
  if (/^(true|false|null|undefined|none|auto|left|right|center|start|end|GET|POST|PUT|PATCH|DELETE)$/i.test(text)) return false;
  if (/^https?:\/\//i.test(text) || /^[a-z]+:\/\//i.test(text)) return false;
  if (/^[A-Z0-9_]+$/.test(text) && text.length > 3) return false;
  if (/^#[0-9a-f]{3,8}$/i.test(text)) return false;
  if (/^[\w.-]+@[\w.-]+$/.test(text)) return false;
  if (/^[./~]?[A-Za-z0-9_./-]+\.[A-Za-z0-9]+$/.test(text)) return false;
  if (/^[a-z0-9_.:/-]+$/.test(text) && !/[A-Z\s]/.test(text) && !hasCjk(text)) return false;
  if (looksLikeLocalizationKey(text)) return false;
  return true;
}

function looksLikeLocalizationKey(text) {
  return /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+){1,8}$/.test(text)
    || /^[A-Z][A-Za-z0-9]*(?:\.[A-Z]?[A-Za-z0-9]+){1,8}$/.test(text);
}

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function hasLetter(value) {
  return /\p{L}/u.test(value);
}

function hasCjk(value) {
  return /[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/u.test(value);
}

function cleanupMarkdownInline(value) {
  return value
    .replace(/!\[[^\]]*]\([^)]+\)/g, '')
    .replace(/\[([^\]]+)]\([^)]+\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/[*_~>#]+/g, '')
    .trim();
}

function extractPlaceholders(text) {
  const placeholders = new Set();
  for (const match of String(text).matchAll(/%\d*\$?[@dfisu]|%\{[^}]+}|{{\s*[\w.]+\s*}}|\$\{[\w.]+}|\{([A-Za-z_][\w.]*)[^{}]*}/g)) {
    placeholders.add(match[0].replace(/\s+/g, ''));
  }
  return [...placeholders].sort();
}

function extractRichTextTags(text) {
  const tags = new Set();
  for (const match of String(text).matchAll(/<\/?([A-Za-z][A-Za-z0-9-]*)\b[^>]*>/g)) {
    tags.add(match[1]);
  }
  return [...tags].sort();
}

function extractPluralCategories(text) {
  const categories = new Set();
  for (const match of String(text).matchAll(/\b(zero|one|two|few|many|other)\s*\{/g)) {
    categories.add(match[1]);
  }
  return [...categories].sort();
}

function extractLinks(text) {
  const links = new Set();
  for (const match of String(text).matchAll(/\[[^\]]+]\(([^)]+)\)|https?:\/\/[^\s)]+/g)) {
    links.add(match[1] || match[0]);
  }
  return [...links].sort();
}

function classifyRisk({ text, key, path: filePath }) {
  const haystack = `${text || ''} ${key || ''} ${filePath || ''}`.toLowerCase();
  if (/\b(legal|terms|privacy|copyright|license|gdpr|ccpa)\b/.test(haystack)) return 'legal';
  if (/\b(billing|payment|invoice|subscription|refund|price|tax|revenuecat|purchase)\b/.test(haystack)) return 'billing';
  if (/\b(camera|photo library|contacts|location|microphone|tracking|permission|private|personal data)\b/.test(haystack)) return 'privacy';
  if (/\b(password|token|secret|security|credential|keychain|two-factor|2fa)\b/.test(haystack)) return 'security';
  if (/\b(brand|trademark|slogan|product name)\b/.test(haystack)) return 'brand';
  return 'normal';
}

function namespaceFromKey(key, fallbackPath) {
  const parts = String(key || '').split(/[.:/]/).filter(Boolean);
  if (parts.length > 1) {
    return parts.slice(0, -1).join('.');
  }
  return namespaceFromPath(fallbackPath || '');
}

function namespaceFromPath(relPath) {
  const withoutExtension = normalizeRelPath(relPath).replace(/\.[^.]+$/, '');
  const parts = withoutExtension.split('/').filter(Boolean);
  if (!parts.length) return 'root';
  return parts.slice(0, Math.min(parts.length, 3)).join('.');
}

function localeFromPath(relPath) {
  const parts = normalizeRelPath(relPath).split('/');
  for (const part of parts) {
    const lproj = part.match(/^(.+)\.lproj$/);
    if (lproj) return lproj[1];
  }
  return '';
}

function localeFromFilename(relPath) {
  const basename = path.posix.basename(relPath).replace(/\.[^.]+$/, '');
  if (/^[a-z]{2,3}(-[A-Za-z0-9]+){0,2}$/.test(basename)) {
    return basename;
  }
  return '';
}

function localeFromAndroidPath(relPath) {
  const parts = normalizeRelPath(relPath).split('/');
  const valuesDir = parts.find((part) => part.startsWith('values'));
  if (!valuesDir || valuesDir === 'values') return 'default';
  return valuesDir.replace(/^values-/, '').replace(/-r/, '-');
}

function flattenJsonStrings(value, prefix = '') {
  const output = [];
  if (typeof value === 'string') {
    output.push([prefix, value]);
    return output;
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return output;
  }
  for (const [key, child] of Object.entries(value)) {
    const nextPrefix = prefix ? `${prefix}.${key}` : key;
    output.push(...flattenJsonStrings(child, nextPrefix));
  }
  return output;
}

function groupResourceRecords(records) {
  const grouped = new Map();
  for (const record of records) {
    const family = resourceFamily(record.sourcePath, record.type);
    const groupKey = `${family}:${record.key}`;
    if (!grouped.has(groupKey)) {
      grouped.set(groupKey, []);
    }
    grouped.get(groupKey).push(record);
  }
  return grouped;
}

function resourceFamily(sourcePath, type) {
  const relPath = normalizeRelPath(sourcePath);
  if (type === 'strings') {
    return relPath.replace(/(^|\/)[^/]+\.lproj\//, '$1*.lproj/');
  }
  if (type === 'json') {
    const locale = localeFromFilename(relPath);
    return locale ? relPath.replace(`${locale}.`, '*.') : relPath;
  }
  return relPath;
}

function duplicates(values) {
  const seen = new Set();
  const duplicate = new Set();
  for (const value of values) {
    if (seen.has(value)) duplicate.add(value);
    seen.add(value);
  }
  return [...duplicate].sort();
}

function publicUnitSummary(unit) {
  return {
    id: unit.id,
    text: truncate(unit.text, 90),
    namespace: unit.namespace,
    sourcePath: unit.sourcePath,
    line: unit.line,
    risk: unit.risk,
    origin: unit.origin,
  };
}

function truncate(value, maxLength) {
  const text = String(value || '');
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}...` : text;
}

function printHumanResult(command, result) {
  const mode = result.mode || 'dry-run';
  console.log(`i18n ${command} (${mode})`);
  if (result.repo) console.log(`repo: ${result.repo}`);
  if (result.sourceLocale) console.log(`source locale: ${result.sourceLocale}`);
  if (result.requiredLocales) console.log(`required locales: ${result.requiredLocales.join(', ')}`);

  if (command === 'scan') {
    console.log(`units: ${result.units.total} (${result.units.fromResources} resource, ${result.units.fromSourceScan} source-scan, ${result.units.risky} risky)`);
    console.log(`files: ${result.files.sourceScanned} source, ${result.files.resourceScanned} resource, ${result.files.truncated} skipped oversized`);
  } else if (command === 'diff') {
    console.log(`diff: +${result.summary.added} ~${result.summary.changed} moved=${result.summary.moved} -${result.summary.removed} placeholderDrift=${result.summary.placeholderDrift}`);
    console.log(`baseline: ${result.baseline}`);
  } else if (command === 'plan') {
    console.log(`jobs: ${result.jobs.jobs} (${result.jobs.reviewRequired} require human review)`);
    console.log(`target locales: ${result.targetLocales.join(', ') || '(none)'}`);
  } else if (command === 'validate') {
    console.log(`validation: ${result.summary.errors} errors, ${result.summary.warnings} warnings`);
    for (const error of result.errors.slice(0, 8)) {
      console.log(`error: ${error.code} ${error.path || error.key || error.id || ''} ${error.message}`);
    }
    for (const warning of result.warnings.slice(0, 8)) {
      console.log(`warning: ${warning.code} ${warning.path || warning.key || warning.id || ''} ${warning.message}`);
    }
  } else if (command === 'approve') {
    console.log(`approved units: ${result.units}`);
  }

  if (result.actions?.length) {
    for (const action of result.actions) {
      console.log(`${action.action}: ${action.path}`);
    }
  }
  if (result.samples?.length) {
    console.log('samples:');
    for (const sample of result.samples) {
      if (sample.sourceUnitId) {
        console.log(`- ${sample.sourceUnitId} -> ${sample.targetLocale} (${sample.reason}) ${sample.sourcePath || ''} ${sample.text ? `=> ${truncate(sample.text, 90)}` : ''}`);
      } else {
        console.log(`- ${sample.id} ${sample.sourcePath}${sample.line ? `:${sample.line}` : ''} ${sample.text ? `=> ${sample.text}` : ''}`);
      }
    }
  }
}

function lineNumberAtIndex(text, index) {
  let line = 1;
  for (let cursor = 0; cursor < index; cursor += 1) {
    if (text.charCodeAt(cursor) === 10) {
      line += 1;
    }
  }
  return line;
}

function lineOfNeedle(text, needle) {
  const index = text.indexOf(needle);
  return index === -1 ? 0 : lineNumberAtIndex(text, index);
}

function decodeQuoted(value) {
  try {
    return JSON.parse(`"${String(value).replace(/"/g, '\\"')}"`);
  } catch {
    return String(value).replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\'/g, "'");
  }
}

function stripJsonBom(value) {
  return String(value).replace(/^\uFEFF/, '');
}

function stripJsonComments(value) {
  return String(value)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function stripXmlTags(value) {
  return String(value).replace(/<[^>]+>/g, '');
}

function normalizeRelPath(value) {
  return String(value || '').replace(/\\/g, '/').replace(/^\.\/+/, '');
}

function toArray(value) {
  if (Array.isArray(value)) return value.filter((item) => item !== undefined && item !== null).map(String);
  if (value === undefined || value === null || value === '') return [];
  return [String(value)];
}

function uniqueStrings(values) {
  return [...new Set(values.map((value) => String(value).trim()).filter(Boolean))];
}

function shortHash(value) {
  return hash(value).slice(0, 12);
}

function hash(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function escapeRegex(char) {
  return /[\\^$+?.()|[\]{}]/.test(char) ? `\\${char}` : char;
}

async function readJsonIfExists(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw new Error(`Failed to read JSON ${filePath}: ${error.message}`);
  }
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function safeReadDir(directory) {
  try {
    return await fs.readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (['ENOENT', 'EACCES', 'EPERM', 'EBUSY'].includes(error.code)) {
      return [];
    }
    throw error;
  }
}

async function safeStat(filePath) {
  try {
    return await fs.stat(filePath);
  } catch (error) {
    if (['ENOENT', 'EACCES', 'EPERM', 'EBUSY'].includes(error.code)) {
      return null;
    }
    throw error;
  }
}

async function pathExists(filePath) {
  return Boolean(await safeStat(filePath));
}
