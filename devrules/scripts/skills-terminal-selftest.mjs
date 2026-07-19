#!/usr/bin/env node
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE_ROOT = path.resolve(SCRIPT_DIR, '..');
const CLI = path.join(SCRIPT_DIR, 'devrules.mjs');

async function runJson(args, env = process.env) {
  const { stdout } = await execFileAsync(process.execPath, [CLI, ...args], {
    encoding: 'utf8',
    env,
    maxBuffer: 8 * 1024 * 1024,
    windowsHide: true,
  });
  return JSON.parse(stdout);
}

async function write(filePath, content) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, 'utf8');
}

function assertKeys(value, expected, label) {
  assert.deepEqual(Object.keys(value).sort(), [...expected].sort(), `${label} keys changed`);
}

async function testSkills(tempRoot) {
  const fixtureHome = path.join(tempRoot, 'home');
  await write(
    path.join(fixtureHome, '.codex', 'skills', 'swift-build-doctor', 'SKILL.md'),
    [
      '---',
      'name: swift-build-doctor',
      'description: Diagnose Swift iOS build errors in Xcode projects.',
      '---',
      '# Swift Build Doctor',
      '',
    ].join('\n'),
  );
  await write(
    path.join(fixtureHome, '.claude', 'skills', 'web-release-helper', 'SKILL.md'),
    [
      '---',
      'name: web-release-helper',
      'description: Prepare frontend web releases and deployment notes.',
      '---',
      '# Web Release Helper',
      '',
    ].join('\n'),
  );

  const env = {
    ...process.env,
    HOME: fixtureHome,
    USERPROFILE: fixtureHome,
    DEVRULES_TEMPLATE_ROOT: TEMPLATE_ROOT,
  };
  const list = await runJson(['skills', 'list', '--json'], env);

  assertKeys(list, ['schemaVersion', 'lastUpdated', 'totalSkills', 'roots', 'skills'], 'skills list');
  assert.equal(list.schemaVersion, 1);
  assert.match(list.lastUpdated, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  assert.equal(list.totalSkills, 2);
  assert.equal(list.totalSkills, list.skills.length);
  assert.deepEqual(list.skills.map((skill) => skill.name), ['swift-build-doctor', 'web-release-helper']);
  assert.ok(list.roots.some((root) => root.surface === 'codex' && root.exists === true));
  assert.ok(list.roots.some((root) => root.surface === 'claude' && root.exists === true));

  const swiftSkill = list.skills.find((skill) => skill.name === 'swift-build-doctor');
  assert.ok(swiftSkill.categories.includes('ios'));
  assert.ok(list.skills.some((skill) => skill.categories.includes('web')));
  assertKeys(
    swiftSkill,
    ['skillId', 'name', 'surface', 'surfaces', 'path', 'paths', 'description', 'categories', 'keywords', 'aliases', 'health'],
    'skill entry',
  );
  assertKeys(swiftSkill.health, ['hasSkillMd', 'hasDescription', 'duplicatePaths', 'issues'], 'skill health');

  const codexDataHome = path.join(tempRoot, 'codex-data-skills');
  await write(
    path.join(codexDataHome, 'data-skill', 'SKILL.md'),
    [
      '---',
      'name: data-skill',
      'description: Analyze spreadsheets and SQL data.',
      '---',
      '# Data Skill',
      '',
    ].join('\n'),
  );
  const overridden = await runJson(['skills', 'list', '--json'], {
    ...env,
    DEVRULES_CODEX_DATA_SKILLS: codexDataHome,
  });
  assert.ok(overridden.roots.some((root) => root.surface === 'codex-data' && root.exists === true));
  assert.ok(overridden.skills.some((skill) => skill.name === 'data-skill'));

  const malformed = await runJson(['skills', 'list', '--json'], {
    ...env,
    DEVRULES_CODEX_DATA_SKILLS: 'D:\\UserData\\.codex\\skills',
  });
  assert.ok(
    malformed.roots.every((root) => !/\/[A-Za-z]:\//.test(root.path)),
    'skills roots must never contain an embedded drive-letter segment',
  );

  const recommendation = await runJson(
    ['skills', 'recommend', '--query', 'Swift iOS build error', '--json'],
    env,
  );
  assertKeys(recommendation, ['query', 'count', 'recommendations'], 'skills recommendation');
  assert.equal(recommendation.query, 'Swift iOS build error');
  assert.equal(recommendation.count, recommendation.recommendations.length);
  assert.ok(recommendation.count > 0);
  assert.equal(recommendation.recommendations[0].name, 'swift-build-doctor');
  assert.ok(recommendation.recommendations[0].score > 0);
  assert.ok(recommendation.recommendations[0].categories.includes('ios'));
  assert.ok(recommendation.recommendations[0].reasons.includes('category:ios'));
  assertKeys(
    recommendation.recommendations[0],
    ['skillId', 'name', 'surface', 'path', 'score', 'categories', 'reasons', 'description'],
    'skill recommendation entry',
  );

  for (let index = 1; index < recommendation.recommendations.length; index += 1) {
    const previous = recommendation.recommendations[index - 1];
    const current = recommendation.recommendations[index];
    assert.ok(
      previous.score > current.score
        || (previous.score === current.score && previous.name.localeCompare(current.name) <= 0),
      'recommendations must be sorted by descending score and then ascending name',
    );
  }
}

async function testTerminalAudit(tempRoot) {
  const repo = path.join(tempRoot, 'terminal-fixture');
  await fs.mkdir(repo, { recursive: true });
  await execFileAsync('git', ['init', '--quiet', repo], {
    encoding: 'utf8',
    windowsHide: true,
  });

  const childMethod = ['sp', 'awn'].join('');
  const riskySource = [
    `import { ${childMethod} } from 'node:child_process';`,
    `${childMethod}('npm', ['run', 'build']);`,
    '',
  ].join('\n');
  await write(path.join(repo, 'scripts', 'visible-process.mjs'), riskySource);
  await write(path.join(repo, 'src', 'benign.mjs'), 'export const answer = 42;\n');

  const report = await runJson(['terminal-audit', '--repo', repo, '--json']);
  assertKeys(report, ['count', 'totals', 'results'], 'terminal audit report');
  assert.equal(report.count, 1);
  assertKeys(report.totals, ['high', 'medium', 'low', 'total'], 'terminal audit totals');
  assert.deepEqual(report.totals, { high: 1, medium: 0, low: 0, total: 1 });

  const result = report.results[0];
  assertKeys(result, ['repo', 'name', 'findings', 'summary'], 'terminal audit repository');
  assert.equal(result.name, path.basename(repo));
  assert.deepEqual(result.summary, report.totals);
  assert.equal(result.findings.length, 1);

  const finding = result.findings[0];
  assertKeys(finding, ['severity', 'file', 'line', 'category', 'message', 'evidence'], 'terminal audit finding');
  assert.equal(finding.severity, 'high');
  assert.equal(finding.file, 'scripts/visible-process.mjs');
  assert.equal(finding.line, 2);
  assert.equal(finding.category, 'node-child-process-without-window-hide');
  assert.match(finding.message, /windowsHide: true/);
  assert.ok(finding.evidence.includes("'npm'"));
  assert.ok(!result.findings.some((item) => item.file === 'src/benign.mjs'));

  await fs.rm(path.join(repo, 'scripts', 'visible-process.mjs'));
  const cleanReport = await runJson(['terminal-audit', '--repo', repo, '--json']);
  assert.equal(cleanReport.count, 1);
  assert.deepEqual(cleanReport.totals, { high: 0, medium: 0, low: 0, total: 0 });
  assert.deepEqual(cleanReport.results[0].summary, cleanReport.totals);
  assert.deepEqual(cleanReport.results[0].findings, []);
}

async function main() {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'skills-terminal-selftest-'));
  try {
    await testSkills(tempRoot);
    await testTerminalAudit(tempRoot);
    process.stdout.write('skills and terminal selftest: PASS\n');
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  process.stderr.write(`skills and terminal selftest: FAIL\n${error.stack ?? error.message}\n`);
  process.exitCode = 1;
});
