import fs from 'node:fs/promises';
import path from 'node:path';

const GOVERNANCE_FIELDS = [
  'ownership',
  'governs',
  'activation',
  'enforcement',
  'decision_owner',
  'side_effects',
];

const ALLOWED = {
  ownership: new Set(['shared', 'seed', 'local']),
  governs: new Set(['agent', 'product', 'device', 'release', 'external_service']),
  activation: new Set(['always', 'conditional', 'explicit']),
  enforcement: new Set(['hard', 'gate', 'advisory', 'example']),
  decision_owner: new Set(['devrules', 'project', 'user']),
  side_effects: new Set(['none', 'local', 'external']),
};

const LEGACY_OWNERSHIP = new Map([
  ['universal', 'shared'],
  ['seed', 'seed'],
  ['local', 'local'],
]);

function normalizeRelativePath(value) {
  return String(value || '').split(path.sep).join('/').replace(/^\.\//, '');
}

function splitFrontmatter(content) {
  const normalized = String(content || '').replace(/\r\n/g, '\n');
  const match = normalized.match(/^---\n([\s\S]*?)\n---(?:\n|$)/);
  if (!match) return null;
  return {
    body: match[1],
    rest: normalized.slice(match[0].length),
  };
}

function parseGovernanceMetadata(content) {
  const split = splitFrontmatter(content);
  if (!split) return {};
  const metadata = {};
  for (const line of split.body.split('\n')) {
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*?)\s*$/);
    if (!match) continue;
    metadata[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
  return metadata;
}

function inferredGovernance(relativePath, content) {
  const rel = normalizeRelativePath(relativePath).toLowerCase();
  const metadata = parseGovernanceMetadata(content);
  const oldScope = String(metadata.scope || '').toLowerCase();
  const ownership = ALLOWED.ownership.has(metadata.ownership)
    ? metadata.ownership
    : (LEGACY_OWNERSHIP.get(oldScope) || 'shared');

  const area = rel.split('/')[0];
  const isTemplate = area === 'templates';
  const isTemplateIndex = isTemplate && /(?:^|\/)readme\.md$/.test(rel);

  let governs = isTemplate ? 'product' : 'agent';
  if (/(developer-service|cloudflare|supabase|revenuecat|github|app-store)/.test(rel)) governs = 'external_service';
  else if (/(simulator|idle-resource|multi-device|credential-prompt|terminal-popup)/.test(rel)) governs = 'device';
  else if (/(release|production-change|deployment|backup-maintenance|template-promotion|git-multi-device-sync)/.test(rel)) governs = 'release';
  else if (/(product-architecture|ios-account-data|landing-page|design-|game-|i18n|seo-|prisma)/.test(rel)) governs = 'product';
  else if (isTemplate && /templates\/(?:devrules|quality|architecture|security)\//.test(rel)) governs = 'agent';

  const isWorkflow = area === 'workflows';
  const isAlwaysCore = rel === 'always-readme.md';
  const activation = isAlwaysCore
    ? 'always'
    : (['external_service', 'release'].includes(governs) || rel.includes('idle-resource-maintenance') ? 'explicit' : 'conditional');
  const enforcement = isAlwaysCore
    ? 'hard'
    : (isTemplate ? 'example' : (['external_service', 'release'].includes(governs) ? 'gate' : 'advisory'));
  const decisionOwner = isAlwaysCore ? 'devrules' : (governs === 'external_service' ? 'user' : 'project');
  const sideEffects = isAlwaysCore || !isWorkflow
    ? 'none'
    : (['external_service', 'release'].includes(governs) ? 'external' : 'local');

  return {
    ownership: ALLOWED.ownership.has(metadata.ownership)
      ? metadata.ownership
      : (isTemplate && !isTemplateIndex ? 'seed' : ownership),
    governs,
    activation,
    enforcement,
    decision_owner: decisionOwner,
    side_effects: sideEffects,
    ...Object.fromEntries(GOVERNANCE_FIELDS
      .filter((field) => ALLOWED[field].has(metadata[field]))
      .map((field) => [field, metadata[field]])),
  };
}

function migrateGovernanceDocument(content, relativePath) {
  const split = splitFrontmatter(content);
  if (!split) {
    const governance = inferredGovernance(relativePath, content);
    const governanceLines = GOVERNANCE_FIELDS.map((field) => `${field}: ${governance[field]}`);
    return {
      changed: true,
      content: `---\n${governanceLines.join('\n')}\n---\n\n${String(content).replace(/^\s*/, '')}`,
      metadata: governance,
    };
  }

  const governance = inferredGovernance(relativePath, content);
  const controlledFields = new Set([...GOVERNANCE_FIELDS, 'scope', 'model_support']);
  const kept = split.body.split('\n').filter((line) => {
    const match = line.match(/^([A-Za-z0-9_-]+):/);
    return !match || !controlledFields.has(match[1]);
  });
  const descriptionIndex = kept.findIndex((line) => /^description:/.test(line));
  const insertionIndex = descriptionIndex === -1 ? 0 : descriptionIndex + 1;
  const governanceLines = GOVERNANCE_FIELDS.map((field) => `${field}: ${governance[field]}`);
  kept.splice(insertionIndex, 0, ...governanceLines);

  const next = `---\n${kept.join('\n')}\n---\n${split.rest}`;
  return { changed: next !== String(content).replace(/\r\n/g, '\n'), content: next, metadata: governance };
}

async function listMarkdownFiles(dirPath) {
  const files = [];
  let entries = [];
  try {
    entries = await fs.readdir(dirPath, { withFileTypes: true });
  } catch (error) {
    if (error?.code === 'ENOENT') return files;
    throw error;
  }
  for (const entry of entries) {
    if (entry.name.startsWith('._')) continue;
    const entryPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) files.push(...await listMarkdownFiles(entryPath));
    else if (entry.isFile() && entry.name.endsWith('.md')) files.push(entryPath);
  }
  return files;
}

async function collectGovernanceTargets(devrulesRoot) {
  const targets = [];
  const alwaysReadme = path.join(devrulesRoot, 'always-readme.md');
  try {
    await fs.access(alwaysReadme);
    targets.push(alwaysReadme);
  } catch {
    // A partial project instance can still be audited for the areas it has.
  }
  for (const area of ['rules', 'workflows', 'profiles', 'templates']) {
    targets.push(...await listMarkdownFiles(path.join(devrulesRoot, area)));
  }
  for (const relativePath of [
    'design-readme.md',
    'hooks/README.md',
    'registry/README.md',
    'scripts/README.md',
  ]) {
    const filePath = path.join(devrulesRoot, relativePath);
    try {
      await fs.access(filePath);
      targets.push(filePath);
    } catch {
      // Partial project instances may omit optional operating surfaces.
    }
  }
  return [...new Set(targets)].sort((left, right) => left.localeCompare(right));
}

const TEMPLATE_OVERREACH_PATTERNS = [
  {
    code: 'model-parameter-default',
    pattern: /\breasoning\.(?:mode|effort)\s*:/i,
    message: 'shared Agent guidance must not prescribe provider reasoning request parameters',
  },
  {
    code: 'session-start-write',
    pattern: /SessionStart[^\n]{0,160}(?:automatically\s+run|runs?)\s+`?ensure-agent\s+--apply/i,
    message: 'SessionStart must remain read-only unless automatic repair is explicitly opted into',
  },
  {
    code: 'hosted-ci-default',
    pattern: /(?:GitHub Actions|Hosted workflows?)\s+(?:is|are|remain|remains)\s+disabled by default/i,
    message: 'shared guidance must inherit repository CI policy instead of disabling hosted CI globally',
  },
  {
    code: 'maturity-default',
    pattern: /Default initialization targets (?:maturity )?Level 3/i,
    message: 'shared initialization must not force the full adoption profile by default',
  },
  {
    code: 'ios-key-default',
    pattern: /physical\s+database primary key must remain an application-generated immutable internal\s+`user_id`/i,
    message: 'shared iOS guidance must not choose a product identity/key architecture',
  },
  {
    code: 'simulator-model-default',
    pattern: /(?:default|must use|standardize on)[^\n]{0,80}iPhone\s+17/i,
    message: 'shared device guidance must not choose a fixed simulator model',
  },
  {
    code: 'design-score-default',
    pattern: /(?:>=|≥)\s*85[^\n]{0,80}(?:pass|通过)|(?:below|低于)\s*70[^\n]{0,80}(?:rollback|不允许)/i,
    message: 'shared design guidance must not impose fixed universal score thresholds',
  },
];

async function templateOverreachFindings(devrulesRoot, targets) {
  const findings = [];
  for (const filePath of targets) {
    const relativePath = normalizeRelativePath(path.relative(devrulesRoot, filePath));
    const content = await fs.readFile(filePath, 'utf8');
    for (const rule of TEMPLATE_OVERREACH_PATTERNS) {
      if (!rule.pattern.test(content)) continue;
      findings.push({
        code: rule.code,
        message: `${relativePath}: ${rule.message}.`,
      });
    }
  }
  return findings;
}

function metadataIssues(relativePath, content) {
  const metadata = parseGovernanceMetadata(content);
  const issues = [];
  if (!Object.keys(metadata).length) {
    return [{ code: 'frontmatter', message: `${relativePath} is missing YAML frontmatter.` }];
  }
  if (metadata.scope) {
    issues.push({ code: 'legacy-scope', message: `${relativePath} still uses scope; v3 separates ownership from activation.` });
  }
  for (const field of GOVERNANCE_FIELDS) {
    if (!ALLOWED[field].has(metadata[field])) {
      issues.push({ code: 'metadata', message: `${relativePath} missing valid ${field} metadata.` });
    }
  }
  if (metadata.governs && metadata.governs !== 'agent' && metadata.activation === 'always') {
    issues.push({ code: 'overreach', message: `${relativePath} cannot make ${metadata.governs} governance always-on.` });
  }
  if (metadata.governs && metadata.governs !== 'agent' && metadata.decision_owner === 'devrules') {
    issues.push({ code: 'overreach', message: `${relativePath} cannot make devrules the decision owner for ${metadata.governs} choices.` });
  }
  if (metadata.governs && metadata.governs !== 'agent' && metadata.enforcement === 'hard') {
    issues.push({ code: 'overreach', message: `${relativePath} cannot encode a hard product, device, release, or service choice; use a safety gate or advisory.` });
  }
  if (metadata.side_effects && metadata.side_effects !== 'none' && metadata.activation === 'always') {
    issues.push({ code: 'side-effect', message: `${relativePath} cannot run ${metadata.side_effects} side effects from an always-on rule.` });
  }
  if (metadata.side_effects === 'external' && !['project', 'user'].includes(metadata.decision_owner)) {
    issues.push({ code: 'side-effect', message: `${relativePath} external side effects require a project or user decision owner.` });
  }
  return issues;
}

export async function auditGovernanceMetadata(devrulesRoot, { templateMode = false } = {}) {
  const findings = [];
  const targets = await collectGovernanceTargets(devrulesRoot);
  for (const filePath of targets) {
    const relativePath = normalizeRelativePath(path.relative(devrulesRoot, filePath));
    const content = await fs.readFile(filePath, 'utf8');
    findings.push(...metadataIssues(relativePath, content));
  }
  if (templateMode) findings.push(...await templateOverreachFindings(devrulesRoot, targets));
  if (!findings.length) return { findings, issues: [], recommendations: [] };
  if (templateMode) {
    return {
      findings,
      issues: findings.map((finding) => ({ severity: 'error', message: finding.message })),
      recommendations: [],
    };
  }
  return {
    findings,
    issues: [],
    recommendations: [{
      level: 3,
      message: `${findings.length} governance metadata finding(s) remain; run the explicit v3 migration before relying on automatic routing.`,
    }],
  };
}

export async function migrateGovernanceTree(devrulesRoot, { apply = false } = {}) {
  const actions = [];
  for (const filePath of await collectGovernanceTargets(devrulesRoot)) {
    const relativePath = normalizeRelativePath(path.relative(devrulesRoot, filePath));
    const current = await fs.readFile(filePath, 'utf8');
    const migrated = migrateGovernanceDocument(current, relativePath);
    if (!migrated.changed) continue;
    actions.push({ action: 'write', path: relativePath, mode: apply ? 'apply' : 'dry-run' });
    if (apply) await fs.writeFile(filePath, migrated.content, 'utf8');
  }
  return { apply, actions };
}
