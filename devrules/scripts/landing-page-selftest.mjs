#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const requiredPaths = [
  'rules/landing-page.md',
  'workflows/landing-page.md',
  'templates/landing-page/README.md',
  'templates/landing-page/brief.md',
  'templates/landing-page/saas-conversion.md',
  'templates/devrules/devrules-instance.md',
  'workflows/devrules-initialize.md',
  'workflows/devrules-audit.md',
  'always-readme.md',
  'rules/workflow-management.md',
  'templates/README.md',
  'templates/ui/README.md',
  'design-readme.md',
  'hooks/hooks.json',
  'template.json',
  'scripts/devrules.mjs',
  'CHANGELOG.md',
];

const documents = Object.fromEntries(
  await Promise.all(
    requiredPaths.map(async (relativePath) => [
      relativePath,
      await fs.readFile(path.join(root, relativePath), 'utf8'),
    ]),
  ),
);

const rule = documents['rules/landing-page.md'];
const workflow = documents['workflows/landing-page.md'];
const library = documents['templates/landing-page/README.md'];
const brief = documents['templates/landing-page/brief.md'];
const saas = documents['templates/landing-page/saas-conversion.md'];
const instance = documents['templates/devrules/devrules-instance.md'];
const initializeWorkflow = documents['workflows/devrules-initialize.md'];
const auditWorkflow = documents['workflows/devrules-audit.md'];

const governanceExpectations = {
  'rules/landing-page.md': {
    ownership: 'shared',
    governs: 'product',
    activation: 'conditional',
    enforcement: 'advisory',
    decision_owner: 'project',
    side_effects: 'none',
  },
  'workflows/landing-page.md': {
    ownership: 'shared',
    governs: 'product',
    activation: 'conditional',
    enforcement: 'advisory',
    decision_owner: 'project',
    side_effects: 'local',
  },
  'templates/landing-page/README.md': {
    ownership: 'shared',
    governs: 'product',
    activation: 'conditional',
    enforcement: 'example',
    decision_owner: 'project',
    side_effects: 'none',
  },
  'templates/landing-page/brief.md': {
    ownership: 'shared',
    governs: 'product',
    activation: 'conditional',
    enforcement: 'example',
    decision_owner: 'project',
    side_effects: 'none',
  },
  'templates/landing-page/saas-conversion.md': {
    ownership: 'shared',
    governs: 'product',
    activation: 'explicit',
    enforcement: 'example',
    decision_owner: 'project',
    side_effects: 'none',
  },
  'templates/devrules/devrules-instance.md': {
    ownership: 'shared',
    governs: 'agent',
    activation: 'conditional',
    enforcement: 'example',
    decision_owner: 'project',
    side_effects: 'none',
  },
  'workflows/devrules-initialize.md': {
    ownership: 'shared',
    governs: 'agent',
    activation: 'conditional',
    enforcement: 'advisory',
    decision_owner: 'project',
    side_effects: 'local',
  },
  'workflows/devrules-audit.md': {
    ownership: 'shared',
    governs: 'agent',
    activation: 'conditional',
    enforcement: 'advisory',
    decision_owner: 'project',
    side_effects: 'local',
  },
};

function parseFrontmatter(relativePath) {
  const frontmatter = documents[relativePath].match(/^---\n([\s\S]*?)\n---\n/)?.[1];
  assert.ok(frontmatter, `${relativePath} must have frontmatter`);
  const metadata = {};
  for (const line of frontmatter.split('\n')) {
    const match = line.match(/^([a-z_]+):\s*(.*?)\s*$/);
    if (match) metadata[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
  return { frontmatter, metadata };
}

for (const [relativePath, expected] of Object.entries(governanceExpectations)) {
  const { frontmatter, metadata } = parseFrontmatter(relativePath);
  for (const [field, value] of Object.entries(expected)) {
    assert.equal(metadata[field], value, `${relativePath} ${field} must be ${value}`);
  }
  assert.doesNotMatch(frontmatter, /^scope:/m, `${relativePath} must not use legacy scope metadata`);
  assert.doesNotMatch(
    frontmatter,
    /^model_support:/m,
    `${relativePath} must not encode model selection or support metadata`,
  );
  assert.doesNotMatch(
    documents[relativePath],
    /reasoning\.(?:mode|effort)\s*:/,
    `${relativePath} must not prescribe API model parameters`,
  );
}

for (const status of ['Verified', 'Qualified', 'Planned', 'Unsupported']) {
  assert.match(rule, new RegExp(`\\b${status}\\b`));
  assert.match(brief, new RegExp(`\\b${status}\\b`));
}

assert.match(rule, /PRD.*(?:意图|intent)/i);
assert.match(rule, /不得生成或暗示/);
assert.match(rule, /营销专家协作边界/);
assert.match(workflow, /本流程只向下路由/);
assert.match(workflow, /quick_copy/);
assert.match(workflow, /new_page/);
assert.match(workflow, /structural_refactor/);
assert.match(workflow, /review_only/);
for (const structurePath of ['registered_template', 'custom', 'brief_only', 'not_applicable']) {
  assert.match(rule, new RegExp(`\\b${structurePath}\\b`));
  assert.match(workflow, new RegExp(`\\b${structurePath}\\b`));
  assert.match(library, new RegExp(`\\b${structurePath}\\b`));
  assert.match(brief, new RegExp(`\\b${structurePath}\\b`));
}
assert.match(workflow, /Claim Ledger/);
assert.match(workflow, /项目选定的验收|项目决定是否使用/);
assert.match(brief, /Optional Quality Review/);
assert.match(brief, /不是 devrules 的通用发布分数门槛/);

for (const [label, content] of [
  ['workflow', workflow],
  ['brief', brief],
  ['library', library],
]) {
  assert.doesNotMatch(content, />=\s*13|≥\s*13/, `${label} must not impose a fixed score threshold`);
  assert.doesNotMatch(
    content,
    /证据完整性[^\n]{0,80}必须(?:为|=)\s*`?2`?/,
    `${label} must not impose a fixed evidence score`,
  );
}
assert.doesNotMatch(workflow, /最多两个/, 'workflow must not cap copy alternatives globally');
assert.doesNotMatch(
  workflow,
  /完整 Lane[^\n]*(?:应|必须)[^\n]*(?:独立营销|独立[^\n]*评审)/,
  'workflow must not require independent expert review for every complete lane',
);
assert.doesNotMatch(
  workflow,
  /再打开一个选定模板|完整 Brief、模板选择/,
  'workflow must not require a registered template for every page',
);

assert.match(library, /`saas-conversion` \| `saas-conversion\.md`/);
assert.match(library, /不得让 `saas-conversion` 自动成为所有页面的默认值/);
assert.match(library, /项目\/任务决定是否采用质量评分/);
assert.match(saas, /template_id: saas-conversion/);
assert.match(saas, /仅在项目\/用户.*显式选择/);
assert.doesNotMatch(saas, /\/Users\/|Downloads\/|\.png\b/);

for (const profile of ['minimal', 'standard', 'full']) {
  assert.match(instance, new RegExp(`\\b${profile}\\b`));
  assert.match(initializeWorkflow, new RegExp(`\\b${profile}\\b`));
  assert.match(auditWorkflow, new RegExp(`\\b${profile}\\b`));
}
assert.match(initializeWorkflow, /`minimal` only as the safe fallback/);
assert.match(auditWorkflow, /not_applicable/);
assert.match(auditWorkflow, /devrules template release-audit/);
for (const [label, content] of [
  ['instance contract', instance],
  ['initialize workflow', initializeWorkflow],
  ['audit workflow', auditWorkflow],
]) {
  assert.doesNotMatch(
    content,
    /Default initialization targets (?:maturity )?Level 3|默认初始化[^\n]*Level 3/,
    `${label} must not default every repository to Level 3`,
  );
}
assert.doesNotMatch(
  initializeWorkflow,
  /Use `--maturity 2` only[^\n]*minimal/i,
  'initialize workflow must use profile selection instead of a special Level 2 escape hatch',
);
assert.doesNotMatch(
  auditWorkflow,
  /must begin[^\n]*shared-template|Before adoption checks[^\n]*template/i,
  'local adoption audit must not be blocked on release or upstream state',
);

const moduleRows = saas.split('\n');

function assertModulePresence(moduleId, presence) {
  assert.ok(
    moduleRows.some((line) => line.includes('| `' + moduleId + '` | ' + presence + ' |')),
    `${moduleId} must be ${presence}`,
  );
}

for (const moduleId of ['hero', 'outcome-grid', 'final-cta', 'trust-footer']) {
  assertModulePresence(moduleId, 'Required');
}

for (const moduleId of [
  'decision-nav',
  'value-visual',
  'association-proof',
  'quantitative-proof',
  'how-it-works',
  'why-us',
  'integrations',
  'testimonials',
  'pricing',
  'objection-faq',
]) {
  assertModulePresence(moduleId, 'Conditional');
}

const hooks = JSON.parse(documents['hooks/hooks.json']);
const landingHook = hooks.hooks.find((hook) => hook.id === 'landing-page');
assert.ok(landingHook, 'landing-page hook must exist');
assert.equal(landingHook.scope, undefined, 'landing-page hook must not use legacy scope metadata');
for (const [field, value] of Object.entries({
  ownership: 'shared',
  governs: 'product',
  activation: 'conditional',
  enforcement: 'advisory',
  decision_owner: 'project',
  side_effects: 'local',
})) {
  assert.equal(landingHook[field], value, `landing-page hook ${field} must be ${value}`);
}
assert.match(landingHook.promptPatterns.join('\n'), /landing/);
assert.match(landingHook.promptPatterns.join('\n'), /落地页/);
for (const [field, entries] of [['read', landingHook.read], ['workflows', landingHook.workflows]]) {
  assert.ok(Array.isArray(entries) && entries.length > 0, `landing-page hook ${field} must be populated`);
  for (const entry of entries) {
    assert.equal(typeof entry, 'object', `landing-page hook ${field} entries must be structured`);
    assert.equal(typeof entry.target, 'string', `landing-page hook ${field} target must be a string`);
    assert.ok(
      ['always', 'conditional', 'explicit'].includes(entry.activation),
      `landing-page hook ${field} activation must be structured`,
    );
    if (entry.activation !== 'always') {
      assert.equal(typeof entry.condition, 'object', `landing-page hook ${field} conditional entries need a condition`);
    }
  }
}
const landingReadTargets = landingHook.read.map((entry) => entry.target);
assert.ok(landingReadTargets.includes('devrules/rules/landing-page.md'));
assert.ok(landingReadTargets.includes('devrules/templates/landing-page/README.md'));
const selectedTemplateRead = landingHook.read.find((entry) => /selected template/.test(entry.target));
assert.ok(selectedTemplateRead, 'selected landing-page template route must exist');
assert.equal(selectedTemplateRead.activation, 'explicit');
const primaryLandingWorkflows = landingHook.workflows.filter((entry) => entry.primary === true);
assert.equal(primaryLandingWorkflows.length, 1, 'landing-page hook must have exactly one primary workflow');
assert.equal(primaryLandingWorkflows[0].target, 'landing-page.md');
assert.equal(primaryLandingWorkflows[0].activation, 'always');

for (const downstreamPath of [
  'workflows/design-read.md',
  'workflows/design-new-page.md',
  'workflows/design-refactor-existing-project.md',
  'workflows/design-change.md',
  'workflows/seo-optimization.md',
]) {
  const downstream = await fs.readFile(path.join(root, downstreamPath), 'utf8');
  assert.doesNotMatch(
    downstream,
    /(?:devrules\/workflows\/|workflows\/)?landing-page\.md/,
    `${downstreamPath} must not route back to the outer landing-page workflow`,
  );
}

assert.match(documents['always-readme.md'], /Landing page creation.*workflows\/landing-page\.md/i);
assert.match(documents['rules/workflow-management.md'], /`landing-page\.md`/);
assert.match(documents['templates/README.md'], /`landing-page\/`/);
assert.match(documents['templates/ui/README.md'], /\.\.\/landing-page\//);
assert.match(documents['design-readme.md'], /workflows\/landing-page\.md/);

const manifest = JSON.parse(documents['template.json']);
const cliVersion = documents['scripts/devrules.mjs'].match(/const VERSION = '([^']+)'/)?.[1];
const changelogVersion = documents['CHANGELOG.md'].match(/^## \[([^\]]+)\]/m)?.[1];
assert.equal(cliVersion, manifest.version, 'CLI and template manifest versions must match');
assert.equal(changelogVersion, manifest.version, 'changelog and template manifest versions must match');

console.log(
  `[landing-page-selftest] OK: v3 governance, four structure paths, project-owned acceptance, evidence contract, structured hook routing, modular SaaS template, and release metadata are aligned (v${manifest.version}, revision ${manifest.revision}).`,
);
