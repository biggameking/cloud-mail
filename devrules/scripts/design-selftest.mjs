#!/usr/bin/env node
// devrules design subsystem self-test.
//
// This is intentionally read-only: it runs the .selftest fixture from the
// fixture directory so design.config.json path resolution matches real projects.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const templateRoot = path.resolve(here, '..');
const fixtureRoot = path.join(templateRoot, '.selftest');

const scripts = {
  devrules: path.join(here, 'devrules.mjs'),
  sync: path.join(here, 'design-sync.mjs'),
  lint: path.join(here, 'design-lint.mjs'),
  guard: path.join(here, 'design-guard.mjs'),
  inventory: path.join(here, 'design-inventory.mjs'),
  refactorState: path.join(here, 'design-refactor-state.mjs'),
  styleLibrary: path.join(here, 'design-style-library.mjs'),
};

const DESIGN_ROOT_FILES = [
  'DESIGN.template.md',
  'DESIGN.example.md',
  'design-readme.md',
  'design.config.json',
  'design-guard.allow.json',
];

const TEMPLATE_RELEASE_FILES = ['template.json', 'CHANGELOG.md'];
const PRODUCT_ARCHITECTURE_FILES = [
  'workflows/product-architecture-review.md',
  'templates/product-architecture-brief.md',
];

main();

function main() {
  assert(fs.existsSync(fixtureRoot), `Missing fixture directory: ${fixtureRoot}`);
  assert(fs.existsSync(path.join(fixtureRoot, 'DESIGN.md')), 'Missing .selftest/DESIGN.md');
  assert(fs.existsSync(path.join(fixtureRoot, 'design.config.json')), 'Missing .selftest/design.config.json');

  const sync = run('design-sync --check', [scripts.sync, '--check'], { expectStatus: 0 });
  const lint = run('design-lint local default', [scripts.lint], {
    expectStatus: 0,
    env: { ...process.env, PATH: '' },
  });
  assert(!lint.stdout.includes('官方 designmd CLI 不可用'), 'default design-lint must not invoke the package-on-demand CLI');
  const guard = run('design-guard --format json', [scripts.guard, '--format', 'json'], { expectStatus: 1 });

  const guardJson = parseJsonOutput(guard.stdout, 'design-guard JSON');
  const findings = guardJson.findings ?? [];

  assert(findings.length > 0, 'design-guard fixture should produce findings');
  assert(!findings.some((f) => f.file === 'src/Good.tsx'), 'Good.tsx should stay clean');
  assert(!findings.some((f) => f.snippet?.includes('#0F0F0F')), 'inline no-hex-color suppression did not apply');
  assert(!findings.some((f) => f.snippet?.includes('#ABCDEF')), 'allowlist no-hex-color suppression did not apply');
  assert(hasRule(findings, 'no-hex-color', '#FF5A01'), 'missing expected no-hex-color finding');
  assert(hasRule(findings, 'no-tailwind-arbitrary-color', 'bg-[#123456]'), 'missing expected Tailwind arbitrary color finding');
  assert(hasRule(findings, 'no-tailwind-arbitrary-value', 'p-[13px]'), 'missing expected Tailwind arbitrary value finding');
  assert(hasRule(findings, 'no-inline-style-literal', 'rgb(1, 2, 3)'), 'missing expected inline style color finding');
  assert(hasRule(findings, 'no-unregistered-font', 'Comic Sans MS'), 'missing expected unregistered font finding');
  assert(hasRule(findings, 'no-placeholder-copy', '示例文本'), 'missing expected placeholder copy finding');
  assert(hasRule(findings, 'no-placeholder-copy', 'lorem ipsum'), 'missing expected lorem ipsum finding');
  assert(!findings.some((f) => f.rule === 'no-placeholder-copy' && f.severity !== 'error'), 'placeholder copy should be an error-level design gate');

  const propagation = runTemplatePropagationSelftest();
  const productArchitecture = runProductArchitectureContractSelftest();
  const governance = runDesignGovernanceActivationSelftest();
  const inventory = runInventorySelftest();
  const refactorState = runRefactorStateSelftest();
  const styleLibrary = runStyleLibrarySelftest();

  process.stdout.write([
    '[design-selftest] OK',
    `  sync: ${oneLine(sync.stdout)}`,
    `  lint: ${oneLine(lint.stdout)}`,
    `  guard: expected fixture findings (${guardJson.summary?.errors ?? 0} errors, ${guardJson.summary?.warnings ?? 0} warnings)`,
    `  propagation: ${propagation}`,
    `  product-architecture: ${productArchitecture}`,
    `  governance: ${governance}`,
    `  inventory: ${inventory}`,
    `  refactor-state: ${refactorState}`,
    `  style-library: ${styleLibrary}`,
    '',
  ].join('\n'));
}

function run(label, args, { expectStatus, cwd = fixtureRoot, env = process.env }) {
  const result = spawnSync(process.execPath, args, {
    cwd,
    encoding: 'utf8',
    windowsHide: true,
    env,
  });
  if (result.error) {
    fail(`${label} failed to start: ${result.error.message}`);
  }
  if (result.status !== expectStatus) {
    fail([
      `${label} exited ${result.status}; expected ${expectStatus}`,
      '--- stdout ---',
      result.stdout,
      '--- stderr ---',
      result.stderr,
    ].join('\n'));
  }
  return result;
}

function runCommand(label, command, args, { expectStatus, cwd }) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    windowsHide: true,
  });
  if (result.error) {
    fail(`${label} failed to start: ${result.error.message}`);
  }
  if (result.status !== expectStatus) {
    fail([
      `${label} exited ${result.status}; expected ${expectStatus}`,
      '--- stdout ---',
      result.stdout,
      '--- stderr ---',
      result.stderr,
    ].join('\n'));
  }
  return result;
}

function publishNextTemplateRevision(authoritativeTemplate, fixtureManifest) {
  const versionMatch = /^(\d+)\.(\d+)\.(\d+)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.exec(fixtureManifest.version);
  assert(versionMatch, `propagation fixture version must be semver: ${fixtureManifest.version}`);
  const nextVersion = `${versionMatch[1]}.${versionMatch[2]}.${Number(versionMatch[3]) + 1}`;
  const nextRevision = Number(fixtureManifest.revision) + 1;
  const propagationMarker = `<!-- design-selftest propagated ${nextVersion} -->`;

  fixtureManifest.version = nextVersion;
  fixtureManifest.revision = nextRevision;
  const manifestPath = path.join(authoritativeTemplate, 'template.json');
  fs.writeFileSync(manifestPath, `${JSON.stringify(fixtureManifest, null, 2)}\n`, 'utf8');

  const cliPath = path.join(authoritativeTemplate, 'scripts', 'devrules.mjs');
  const cli = fs.readFileSync(cliPath, 'utf8');
  const updatedCli = cli.replace(/\bconst\s+VERSION\s*=\s*['"][^'"]+['"];/, `const VERSION = '${nextVersion}';`);
  assert(updatedCli !== cli, 'propagation fixture must update the CLI version');
  fs.writeFileSync(cliPath, updatedCli, 'utf8');

  const changelogPath = path.join(authoritativeTemplate, 'CHANGELOG.md');
  const changelog = fs.readFileSync(changelogPath, 'utf8');
  const updatedChangelog = changelog.replace(
    /^## \[/m,
    `## [${nextVersion}] - 2026-07-15\n\n- Exercise authoritative template propagation.\n\n## [`,
  );
  assert(updatedChangelog !== changelog, 'propagation fixture must update the changelog release');
  fs.writeFileSync(changelogPath, updatedChangelog, 'utf8');

  fs.appendFileSync(path.join(authoritativeTemplate, 'design-readme.md'), `\n${propagationMarker}\n`, 'utf8');
  runCommand('git add next template revision', 'git', ['add', '-A'], { expectStatus: 0, cwd: authoritativeTemplate });
  runCommand('git commit next template revision', 'git', ['commit', '-m', `authoritative template ${nextVersion}`], { expectStatus: 0, cwd: authoritativeTemplate });
  runCommand('git tag next template revision', 'git', ['tag', '-a', `v${nextVersion}`, '-m', `devrules v${nextVersion}`], { expectStatus: 0, cwd: authoritativeTemplate });
  runCommand('git push next template revision', 'git', ['push', 'origin', 'main', '--follow-tags'], { expectStatus: 0, cwd: authoritativeTemplate });
  return propagationMarker;
}

function runTemplatePropagationSelftest() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'devrules-design-selftest-'));
  try {
    const authoritativeTemplate = path.join(tempRoot, 'template');
    const templateRemote = path.join(tempRoot, 'template.git');
    fs.cpSync(templateRoot, authoritativeTemplate, {
      recursive: true,
      filter: (source) => {
        const rel = path.relative(templateRoot, source).split(path.sep).join('/');
        return !['.git', '.codegraph', '.selftest', '.selftest-out', 'node_modules']
          .some((ignored) => rel === ignored || rel.startsWith(`${ignored}/`));
      },
    });
    const fixtureManifestPath = path.join(authoritativeTemplate, 'template.json');
    const fixtureManifest = JSON.parse(fs.readFileSync(fixtureManifestPath, 'utf8'));
    fixtureManifest.sourceRepository = templateRemote;
    fs.writeFileSync(fixtureManifestPath, `${JSON.stringify(fixtureManifest, null, 2)}\n`, 'utf8');
    const fixtureChangelogPath = path.join(authoritativeTemplate, 'CHANGELOG.md');
    const fixtureChangelog = fs.readFileSync(fixtureChangelogPath, 'utf8');
    fs.writeFileSync(
      fixtureChangelogPath,
      fixtureChangelog.replace(/\n## \[Unreleased\]\n[\s\S]*?(?=\n## \[)/, '\n'),
      'utf8',
    );
    runCommand('git init template remote', 'git', ['init', '--bare', templateRemote], { expectStatus: 0, cwd: tempRoot });
    runCommand('git init authoritative template', 'git', ['init', '-b', 'main'], { expectStatus: 0, cwd: authoritativeTemplate });
    runCommand('git configure template user', 'git', ['config', 'user.name', 'devrules design selftest'], { expectStatus: 0, cwd: authoritativeTemplate });
    runCommand('git configure template email', 'git', ['config', 'user.email', 'devrules-design-selftest@example.invalid'], { expectStatus: 0, cwd: authoritativeTemplate });
    runCommand('git add authoritative template', 'git', ['add', '-A'], { expectStatus: 0, cwd: authoritativeTemplate });
    runCommand('git commit authoritative template', 'git', ['commit', '-m', 'authoritative template fixture'], { expectStatus: 0, cwd: authoritativeTemplate });
    runCommand('git tag authoritative template', 'git', ['tag', '-a', `v${fixtureManifest.version}`, '-m', `devrules v${fixtureManifest.version}`], { expectStatus: 0, cwd: authoritativeTemplate });
    runCommand('git add template remote', 'git', ['remote', 'add', 'origin', templateRemote], { expectStatus: 0, cwd: authoritativeTemplate });
    runCommand('git push authoritative template', 'git', ['push', '-u', 'origin', 'main', '--follow-tags'], { expectStatus: 0, cwd: authoritativeTemplate });
    const authoritativeEnv = { ...process.env, DEVRULES_TEMPLATE_ROOT: authoritativeTemplate };

    const workspace = path.join(tempRoot, 'workspace');
    const repo = path.join(workspace, 'sample-app');
    fs.mkdirSync(path.join(repo, 'src'), { recursive: true });
    fs.writeFileSync(path.join(repo, 'src', 'index.ts'), 'export const ok = true;\n', 'utf8');

    runCommand('git init propagation fixture', 'git', ['init'], { expectStatus: 0, cwd: repo });
    run('devrules init propagation fixture', [scripts.devrules, 'init', '--repo', repo, '--apply', '--sync-template', '--json'], {
      expectStatus: 0,
      cwd: templateRoot,
      env: authoritativeEnv,
    });
    const initializedManifest = JSON.parse(fs.readFileSync(path.join(repo, 'devrules', 'manifest.json'), 'utf8'));
    assert(initializedManifest.adoptionProfile === 'minimal', 'default initialization must record the minimal adoption profile');
    assert(initializedManifest.selectedProfileLevel === 1, 'manifest must keep selected profile separate from observed adoption');
    assert(initializedManifest.observedAdoptionLevel >= 2, 'installed instance must record its separately observed adoption level');
    assert(!fs.existsSync(path.join(repo, '.cursor', 'rules', 'devrules.mdc')), 'default initialization must not create an unselected Cursor entry');
    assertDesignRootFiles(repo, 'init');
    assertTemplateReleaseFiles(repo, 'init');
    assertStyleLibrary(repo, 'init');
    assertProductArchitectureFiles(repo, 'init');

    const propagationMarker = publishNextTemplateRevision(authoritativeTemplate, fixtureManifest);
    run('devrules batch sync-template propagation fixture', [scripts.devrules, 'batch', 'sync-template', '--root', workspace, '--apply', '--json'], {
      expectStatus: 0,
      cwd: templateRoot,
      env: authoritativeEnv,
    });
    assertDesignRootFiles(repo, 'batch sync-template');
    assertTemplateReleaseFiles(repo, 'batch sync-template');
    assertStyleLibrary(repo, 'batch sync-template');
    assertProductArchitectureFiles(repo, 'batch sync-template');
    assert(
      fs.readFileSync(path.join(repo, 'devrules', 'design-readme.md'), 'utf8').includes(propagationMarker),
      'batch sync-template did not propagate the next authoritative release',
    );

    return `init copied the full template and sync-template propagated the next authoritative release`;
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

function assertDesignRootFiles(repo, phase) {
  for (const file of DESIGN_ROOT_FILES) {
    assert(fs.existsSync(path.join(repo, 'devrules', file)), `${phase} missing devrules/${file}`);
  }
}

function assertTemplateReleaseFiles(repo, phase) {
  for (const file of TEMPLATE_RELEASE_FILES) {
    assert(fs.existsSync(path.join(repo, 'devrules', file)), `${phase} missing devrules/${file}`);
  }
}

function assertStyleLibrary(repo, phase) {
  assert(fs.existsSync(path.join(repo, 'devrules', 'design-styles', 'catalog.json')), `${phase} missing design style catalog`);
  assert(fs.existsSync(path.join(repo, 'devrules', 'design-styles', 'signal-newsroom', 'style.json')), `${phase} missing signal-newsroom style pack`);
}

function assertProductArchitectureFiles(repo, phase) {
  for (const file of PRODUCT_ARCHITECTURE_FILES) {
    assert(fs.existsSync(path.join(repo, 'devrules', file)), `${phase} missing devrules/${file}`);
  }
}

function runProductArchitectureContractSelftest() {
  const workflow = fs.readFileSync(path.join(templateRoot, 'workflows', 'product-architecture-review.md'), 'utf8');
  const brief = fs.readFileSync(path.join(templateRoot, 'templates', 'product-architecture-brief.md'), 'utf8');
  const workflowFlat = workflow.replace(/\s+/g, ' ');
  const briefFlat = brief.replace(/\s+/g, ' ');
  const architecture = fs.readFileSync(path.join(templateRoot, 'workflows', 'architecture-change-review.md'), 'utf8');
  const designRead = fs.readFileSync(path.join(templateRoot, 'workflows', 'design-read.md'), 'utf8');
  const hooks = JSON.parse(fs.readFileSync(path.join(templateRoot, 'hooks', 'hooks.json'), 'utf8'));

  for (const verdict of ['ready', 'ready_with_reversible_assumptions', 'blocked']) {
    assert(workflow.includes(`\`${verdict}\``), `product workflow missing verdict ${verdict}`);
    assert(brief.includes(verdict), `product brief missing verdict ${verdict}`);
  }
  for (const role of ['core', 'supporting', 'cross_cutting', 'background', 'configuration']) {
    assert(workflow.includes(`\`${role}\``), `product workflow missing capability role ${role}`);
  }
  for (const role of ['primary_destination', 'secondary_destination', 'contextual_action', 'setting', 'no_direct_surface']) {
    assert(workflow.includes(`\`${role}\``), `product workflow missing surface role ${role}`);
  }
  for (const tier of ['light', 'standard', 'full']) {
    assert(workflow.includes(`\`${tier}\``), `product workflow missing risk tier ${tier}`);
    assert(brief.includes(`\`${tier}\``), `product brief missing risk tier ${tier}`);
  }
  assert(workflow.includes('activation: conditional'), 'product workflow must be conditionally activated');
  assert(workflow.includes('decision_owner: project'), 'product decisions must remain project-owned');
  assert(brief.includes('decision_owner: project'), 'product brief must preserve project decision ownership');
  assert(workflowFlat.includes('A new product; a core-navigation change; a product data/account ownership change'), 'full review must be limited to high-risk product boundaries');
  assert(workflow.includes('Do not select `full` for routine feature work merely to obtain more paperwork'), 'routine work must not be escalated for paperwork');
  assert(workflow.includes('Missing `REQ-*`, `CAP-*`, `FLOW-*`, `SURFACE-*`, or `DEC-*` identifiers is never'), 'missing product IDs must not block implementation');
  assert(brief.includes('Their absence cannot by itself block the review'), 'brief must not turn identifiers into a gate');
  assert(workflowFlat.includes('only when the change presents a genuine, broad IA choice'), 'two IA options must require a genuine broad IA choice');
  assert(workflow.includes('mark the second-option comparison `N/A`'), 'constrained IA must support a legitimate N/A');
  assert(brief.includes('Do not invent a second option'), 'brief must not manufacture an IA alternative');
  assert(workflow.includes('For high-risk boundaries, explicitly identify'), 'high-risk dependencies must remain explicit');
  assert(briefFlat.includes('High-risk dependencies, migration, and recovery'), 'brief must retain high-risk migration and recovery evidence');
  assert(workflow.includes('owner, review date or trigger'), 'reversible assumptions must have an owner and review trigger');
  assert(workflow.includes('A blocked verdict stops only'), 'blocked product verdict must stop the affected structural boundary');
  assert(architecture.includes('product-architecture-review.md` first'), 'technical architecture must resolve the product gate first');
  assert(designRead.includes('verdict 为 `blocked` 时停止'), 'Design Read must stop on a blocked product verdict');

  const productHook = hooks.hooks.find((hook) => hook.id === 'product-architecture-gate');
  const productRoute = productHook?.workflows?.find((entry) =>
    typeof entry === 'string'
      ? entry.startsWith('product-architecture-review.md')
      : entry?.target === 'product-architecture-review.md'
  );
  assert(productRoute, 'product hook must route product-architecture-review.md');

  return 'conditional activation, risk tiers, project ownership, N/A, evidence, and consequence-based verdicts verified';
}

function runDesignGovernanceActivationSelftest() {
  const rules = fs.readFileSync(path.join(templateRoot, 'rules', 'design-agent-rules.md'), 'utf8');
  const workflowDir = path.join(templateRoot, 'workflows');
  const workflowFiles = fs.readdirSync(workflowDir)
    .filter((file) => file.startsWith('design-') && file.endsWith('.md'))
    .sort();
  const workflows = Object.fromEntries(workflowFiles.map((file) => [
    file,
    fs.readFileSync(path.join(workflowDir, file), 'utf8'),
  ]));
  const combined = [rules, ...Object.values(workflows)].join('\n');

  assert(rules.includes('## Design Tooling Activation Contract'), 'design rules must define an activation contract');
  for (const mode of ['project_native', 'devrules_managed', 'adoption_task']) {
    assert(rules.includes(`\`${mode}\``), `design rules missing activation mode ${mode}`);
  }
  assert(
    rules.includes('Do not copy this rule body into `AGENTS.md`, `CLAUDE.md`, `WARP.md`'),
    'design rules must prohibit copying rule bodies into Agent entry files',
  );
  assert(
    workflows['design-init-new-project.md']?.includes('Use only when the user or repository owner explicitly chooses'),
    'managed design initialization must require explicit adoption',
  );
  assert(
    workflows['design-new-page.md']?.replace(/\s+/g, ' ').includes('Missing devrules paperwork is not itself a blocker'),
    'missing devrules paperwork must not block project-native UI work',
  );
  assert(
    workflows['design-refactor-existing-project.md']?.includes('DevRules does not impose a numeric pass threshold'),
    'UI refactor acceptance must not impose a universal numeric threshold',
  );
  assert(
    workflows['design-change.md']?.includes('Discover checks from the repository'),
    'design changes must discover project-native checks',
  );
  assert(
    workflows['design-audit.md']?.includes('Managed artifacts/commands are clearly `N/A` where not adopted'),
    'design audit must permit N/A for unadopted managed tooling',
  );

  for (const forbidden of [
    /npm run design:/,
    /npx\s+-p\s+@google\/design\.md/,
    /(?:>=|≥)\s*85/,
    /70\s*[-–]\s*84/,
    /<\s*70/,
  ]) {
    assert(!forbidden.test(combined), `design governance still contains unconditional legacy prescription: ${forbidden}`);
  }

  for (const file of ['design-init-new-project.md', 'design-port-to-new-project.md']) {
    const text = workflows[file] ?? '';
    assert(!/`(?:AGENTS|CLAUDE|WARP)\.md`/.test(text), `${file} must not copy design rules into Agent entry files`);
  }

  return `${workflowFiles.length} workflows verified for opt-in tooling, project-native commands, N/A, and non-numeric acceptance`;
}

function runInventorySelftest() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'devrules-design-inventory-'));
  try {
    fs.mkdirSync(path.join(tempRoot, 'src', 'pages'), { recursive: true });
    fs.mkdirSync(path.join(tempRoot, 'src', 'components'), { recursive: true });
    fs.mkdirSync(path.join(tempRoot, 'ios'), { recursive: true });
    fs.writeFileSync(path.join(tempRoot, 'src', 'pages', 'HomePage.tsx'), `
export function HomePage() {
  return <main style={{ color: '#ff0000', padding: 13 }}>
    <h1 className="text-[31px]">API 数据库缓存同步状态调试说明文字会把技术细节直接塞进 UI，导致用户看不懂当前页面应该做什么</h1>
    <button className="bg-[#123456] p-[13px]">确定</button>
  </main>;
}
`, 'utf8');
    fs.writeFileSync(path.join(tempRoot, 'src', 'components', 'AppButton.tsx'), `
export function AppButton({ children }) {
  return <button className="rounded-md bg-primary text-primary-foreground">{children}</button>;
}
`, 'utf8');
    fs.writeFileSync(path.join(tempRoot, 'ios', 'SettingsView.swift'), `
import SwiftUI
struct SettingsView: View {
  var body: some View {
    Text("This is a very long settings explanation that should become a compact empty or help state instead of a wall of interface copy for users.")
      .padding(13)
      .foregroundStyle(Color(red: 0.2, green: 0.3, blue: 0.4))
  }
}
`, 'utf8');

    const json = run('design-inventory --json', [scripts.inventory, '--root', tempRoot, '--json'], {
      expectStatus: 0,
      cwd: templateRoot,
    });
    const data = parseJsonOutput(json.stdout, 'design-inventory JSON');
    assert(data.filesScanned >= 3, 'design-inventory should scan web and Swift fixtures');
    assert(data.screenInventory.some((row) => row.file_path.includes('HomePage.tsx')), 'missing HomePage screen inventory');
    assert(data.componentInventory.some((row) => row.file_path.includes('AppButton.tsx')), 'missing AppButton component inventory');
    assert(data.designDebt.some((row) => row.issue_type === 'technical_ui_copy'), 'missing technical copy debt');
    assert(data.designDebt.some((row) => row.issue_type === 'tailwind_arbitrary_value'), 'missing Tailwind arbitrary value debt');

    const outDir = path.join(tempRoot, 'docs', 'ui-refactor');
    run('design-inventory --out --apply', [scripts.inventory, '--root', tempRoot, '--out', outDir, '--apply'], {
      expectStatus: 0,
      cwd: templateRoot,
    });
    assert(fs.existsSync(path.join(outDir, 'screen-inventory.md')), 'design-inventory did not write screen-inventory.md');
    assert(fs.existsSync(path.join(outDir, 'component-inventory.md')), 'design-inventory did not write component-inventory.md');
    assert(fs.existsSync(path.join(outDir, 'design-debt-report.md')), 'design-inventory did not write design-debt-report.md');

    return `scanned ${data.filesScanned} fixture files and wrote reports`;
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

function runRefactorStateSelftest() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'devrules-refactor-state-'));
  try {
    const docs = path.join(tempRoot, 'docs', 'ui-refactor');
    fs.mkdirSync(docs, { recursive: true });
    for (const file of ['repository-intake.md', 'screen-inventory.md', 'component-inventory.md']) {
      fs.writeFileSync(path.join(docs, file), `# ${file}\n`, 'utf8');
    }
    const validState = {
      project_name: 'fixture',
      mode: 'hybrid',
      current_phase: 'phase_01',
      completed_phases: ['phase_00'],
      blocked: false,
      blockers: [],
      risks: [],
      protected_paths: ['api/', 'database/'],
      artifacts: {
        phase_00: [
          'docs/ui-refactor/repository-intake.md',
          'docs/ui-refactor/screen-inventory.md',
          'docs/ui-refactor/component-inventory.md',
        ],
      },
    };
    const invalidState = {
      project_name: 'fixture',
      mode: 'big-bang',
      current_phase: 'phase_01',
      completed_phases: ['phase_03'],
      blocked: true,
      risks: [],
    };
    const validPath = path.join(tempRoot, 'valid-state.json');
    const invalidPath = path.join(tempRoot, 'invalid-state.json');
    fs.writeFileSync(validPath, JSON.stringify(validState, null, 2), 'utf8');
    fs.writeFileSync(invalidPath, JSON.stringify(invalidState, null, 2), 'utf8');

    const valid = run('design-refactor-state valid', [scripts.refactorState, '--root', tempRoot, '--state', validPath, '--check-files', '--json'], {
      expectStatus: 0,
      cwd: templateRoot,
    });
    const validJson = parseJsonOutput(valid.stdout, 'design-refactor-state valid JSON');
    assert(validJson.valid === true, 'valid refactor state should pass');

    const invalid = run('design-refactor-state invalid', [scripts.refactorState, '--root', tempRoot, '--state', invalidPath, '--json'], {
      expectStatus: 1,
      cwd: templateRoot,
    });
    const invalidJson = parseJsonOutput(invalid.stdout, 'design-refactor-state invalid JSON');
    assert(invalidJson.valid === false, 'invalid refactor state should fail');
    assert(invalidJson.errors.length >= 2, 'invalid refactor state should report multiple errors');

    return 'valid state passed; invalid state failed';
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

function runStyleLibrarySelftest() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'devrules-style-library-'));
  try {
    const sourceA = path.join(tempRoot, 'source-a');
    const sourceB = path.join(tempRoot, 'source-b');
    for (const source of [sourceA, sourceB]) {
      fs.mkdirSync(path.join(source, 'src', 'pages', 'admin'), { recursive: true });
      fs.writeFileSync(path.join(source, 'src', 'page.astro'), `
<main class="grid grid-cols-12 border-y dark:bg-black">
  <h1 class="font-headline uppercase tracking-wider text-accent">Story</h1>
  <article class="font-body prose max-w-prose rounded-sm shadow-sm">Body</article>
  <div class="font-ui ticker">Latest</div>
</main>
`, 'utf8');
      fs.writeFileSync(path.join(source, 'src', 'styles.css'), `
body { font-family: "Source Serif 4", Georgia, serif; color: #1A1A1A; }
h1 { font-family: "Playfair Display", Georgia, serif; }
button { font-family: Inter, system-ui, sans-serif; border-radius: 4px; }
`, 'utf8');
      fs.writeFileSync(path.join(source, 'src', 'pages', 'admin', 'secret.astro'), '<div style="color:#ABCDEF">Admin only</div>\n', 'utf8');
    }

    const review = path.join(tempRoot, 'review');
    const extractArgs = [
      scripts.styleLibrary, 'extract',
      '--source', sourceA, '--source', sourceB,
      '--exclude', 'src/pages/admin',
      '--id', 'fixture-editorial', '--out', review, '--json',
    ];
    run('style extract dry-run', extractArgs, { expectStatus: 0, cwd: templateRoot });
    assert(!fs.existsSync(review), 'style extract dry-run must not create the review directory');
    const extracted = run('style extract apply', [...extractArgs, '--apply'], { expectStatus: 0, cwd: templateRoot });
    const extractJson = parseJsonOutput(extracted.stdout, 'style extract JSON');
    assert(extractJson.evidence.sourceCount === 2, 'style extraction should preserve both sources');
    assert(extractJson.evidence.commonSignals.includes('serif-headlines'), 'style extraction should find shared editorial signals');
    assert(!JSON.stringify(extractJson.evidence).includes('#ABCDEF'), 'excluded admin evidence leaked into extraction');
    assert(fs.existsSync(path.join(review, 'evidence.json')), 'style extraction did not write evidence.json');
    assert(fs.existsSync(path.join(review, 'STYLE-DRAFT.md')), 'style extraction did not write STYLE-DRAFT.md');

    const publishedLibrary = path.join(tempRoot, 'published-library');
    const publishedSource = path.join(templateRoot, 'design-styles', 'signal-newsroom');
    const publishArgs = [scripts.styleLibrary, 'publish', '--source', publishedSource, '--library', publishedLibrary, '--json'];
    run('style publish dry-run', publishArgs, { expectStatus: 0, cwd: templateRoot });
    assert(!fs.existsSync(publishedLibrary), 'style publish dry-run must not create the library');
    run('style publish apply', [...publishArgs, '--apply'], { expectStatus: 0, cwd: templateRoot });
    assert(fs.existsSync(path.join(publishedLibrary, 'catalog.json')), 'style publish should generate catalog.json');
    run('style publish conflict', [...publishArgs, '--apply'], { expectStatus: 1, cwd: templateRoot });

    const listed = run('style list', [scripts.styleLibrary, 'list', '--json'], { expectStatus: 0, cwd: templateRoot });
    const listJson = parseJsonOutput(listed.stdout, 'style list JSON');
    assert(listJson.styles.some((style) => style.id === 'signal-newsroom'), 'style catalog should list signal-newsroom');
    run('style validate', [scripts.styleLibrary, 'validate', '--style', 'signal-newsroom', '--json'], { expectStatus: 0, cwd: templateRoot });

    const target = path.join(tempRoot, 'target');
    fs.mkdirSync(target, { recursive: true });
    const applyArgs = [scripts.styleLibrary, 'apply', '--style', 'signal-newsroom', '--repo', target, '--json'];
    run('style apply dry-run', applyArgs, { expectStatus: 0, cwd: templateRoot });
    assert(!fs.existsSync(path.join(target, 'DESIGN.md')), 'style apply dry-run must not write DESIGN.md');
    run('style apply', [...applyArgs, '--apply'], { expectStatus: 0, cwd: templateRoot });
    run('style apply idempotent', [...applyArgs, '--apply'], { expectStatus: 0, cwd: templateRoot });
    const localDesign = path.join(target, 'DESIGN.md');
    fs.writeFileSync(localDesign, fs.readFileSync(localDesign, 'utf8') + '\n<!-- local fork -->\n', 'utf8');
    run('style apply conflict', [...applyArgs, '--apply'], { expectStatus: 1, cwd: templateRoot });
    assert(fs.readFileSync(localDesign, 'utf8').includes('local fork'), 'style apply conflict overwrote local DESIGN.md');

    return 'extraction, publish, catalog, validation, idempotent apply, and conflict protection passed';
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

function parseJsonOutput(text, label) {
  const start = text.indexOf('{');
  if (start === -1) fail(`${label}: no JSON object in stdout`);
  try {
    return JSON.parse(text.slice(start));
  } catch (err) {
    fail(`${label}: ${err.message}\n${text}`);
  }
}

function hasRule(findings, rule, needle) {
  const lower = String(needle).toLowerCase();
  return findings.some((f) =>
    f.rule === rule &&
    `${f.message ?? ''}\n${f.snippet ?? ''}`.toLowerCase().includes(lower)
  );
}

function oneLine(text) {
  return text.split(/\r?\n/).map((s) => s.trim()).filter(Boolean).slice(-1)[0] ?? 'ok';
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function fail(message) {
  process.stderr.write(`[design-selftest] ${message}\n`);
  process.exit(1);
}
