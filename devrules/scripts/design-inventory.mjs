#!/usr/bin/env node
// Read-only UI inventory and design-debt scanner.
//
// Default behavior does not write files. Use --out <dir> --apply to emit reports.

import fs from 'node:fs/promises';
import path from 'node:path';

const SOURCE_EXTENSIONS = new Set(['.tsx', '.jsx', '.ts', '.js', '.vue', '.svelte', '.html', '.css', '.swift']);
const IGNORE_DIRS = new Set([
  '.git', 'node_modules', 'dist', 'build', '.next', 'coverage', '.turbo', '.vite',
  'DerivedData', 'Pods', 'Carthage', '.swiftpm', 'xcuserdata',
]);

const PATTERNS = [
  { type: 'hex_color', severity: 'Major', pattern: /#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{8}|[0-9a-fA-F]{3})\b/g },
  { type: 'tailwind_arbitrary_value', severity: 'Major', pattern: /\b(?:bg|text|border|ring|fill|stroke|from|to|via|shadow|p|m|gap|w|h|rounded)-\[[^\]]+\]/g },
  { type: 'css_magic_px', severity: 'Minor', pattern: /\b(?:font-size|padding|margin|gap|border-radius|width|height|top|left|right|bottom)\s*:\s*\d+(?:\.\d+)?px\b/g },
  { type: 'inline_style_literal', severity: 'Major', pattern: /style\s*=\s*\{\{[\s\S]{0,240}?(?:color|background|fontSize|padding|margin|borderRadius|boxShadow)\s*:/g },
  { type: 'swiftui_magic_spacing', severity: 'Major', pattern: /\.(?:padding|frame|cornerRadius)\s*\([^)]*\d+(?:\.\d+)?/g },
  { type: 'swiftui_hardcoded_color', severity: 'Major', pattern: /\b(?:Color|UIColor)\s*\((?!\s*\.)[^)]*\)/g },
  { type: 'swiftui_shadow', severity: 'Minor', pattern: /\.shadow\s*\(/g },
  { type: 'long_ui_copy', severity: 'Major', pattern: /(?:Text\s*\(\s*)?["'`](?=[^"'`\n]{100,}["'`])[^"'`\n]{100,}["'`]/g },
  { type: 'technical_ui_copy', severity: 'Critical', pattern: /\b(?:API|database|数据库|缓存|算法|模型|endpoint|schema|token|payload|stack trace)\b/g },
];

const PHASE_HINTS = {
  hex_color: 'phase_02',
  tailwind_arbitrary_value: 'phase_02',
  css_magic_px: 'phase_02',
  inline_style_literal: 'phase_03',
  swiftui_magic_spacing: 'phase_02',
  swiftui_hardcoded_color: 'phase_02',
  swiftui_shadow: 'phase_07',
  long_ui_copy: 'phase_04',
  technical_ui_copy: 'phase_04',
  large_file: 'phase_04',
};

main().catch((err) => {
  console.error(`[design-inventory] ${err.message}`);
  process.exit(1);
});

async function main() {
  const { flags, values } = parseArgs(process.argv.slice(2));
  if (flags.help) {
    printHelp();
    return;
  }

  const root = path.resolve(values.root || process.cwd());
  const outDir = values.out ? path.resolve(values.out) : null;
  const apply = !!flags.apply;
  const files = await collectFiles(root);
  const scanned = [];

  for (const file of files) {
    scanned.push(await scanFile(root, file));
  }

  const screenInventory = scanned.filter((item) => item.isScreen).map(screenRow);
  const componentInventory = scanned.filter((item) => item.isComponent).map(componentRow);
  const designDebt = buildDebt(scanned);
  const result = {
    schemaVersion: 1,
    generatedBy: 'devrules/design-inventory.mjs',
    root: normalize(root),
    filesScanned: scanned.length,
    summary: {
      screens: screenInventory.length,
      components: componentInventory.length,
      debtItems: designDebt.length,
      critical: designDebt.filter((item) => item.severity === 'Critical').length,
      major: designDebt.filter((item) => item.severity === 'Major').length,
      minor: designDebt.filter((item) => item.severity === 'Minor').length,
    },
    screenInventory,
    componentInventory,
    designDebt,
    files: scanned,
  };

  if (outDir) {
    if (!apply) {
      if (!flags.json) printDryRun(result, outDir);
    } else {
      await writeReports(result, outDir);
      if (!flags.json) console.log(`[design-inventory] wrote reports to ${outDir}`);
    }
  }

  if (flags.json) {
    console.log(JSON.stringify(result, null, 2));
  } else if (!outDir || !apply) {
    printSummary(result);
  }
}

function parseArgs(argv) {
  const flags = {};
  const values = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    if (['apply', 'json', 'help'].includes(key)) {
      flags[key] = true;
      continue;
    }
    values[key] = argv[i + 1];
    i += 1;
  }
  return { flags, values };
}

function printHelp() {
  console.log(`design-inventory

Usage:
  node devrules/scripts/design-inventory.mjs --root <repo> [--json]
  node devrules/scripts/design-inventory.mjs --root <repo> --out docs/ui-refactor --apply

Reads source files and reports likely screens, components, and design debt.
It never rewrites product source. Report files are written only with --out and --apply.`);
}

async function collectFiles(root) {
  const found = [];
  async function walk(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (IGNORE_DIRS.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.isFile() && SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
        found.push(full);
      }
    }
  }
  await walk(root);
  return found.sort((a, b) => a.localeCompare(b));
}

async function scanFile(root, file) {
  const text = await fs.readFile(file, 'utf8').catch(() => '');
  const rel = normalize(path.relative(root, file));
  const lines = text.split(/\r?\n/);
  const findings = [];

  for (const rule of PATTERNS) {
    for (const match of text.matchAll(rule.pattern)) {
      const line = lineForIndex(text, match.index || 0);
      findings.push({
        type: rule.type,
        severity: rule.severity,
        line,
        snippet: (lines[line - 1] || '').trim().slice(0, 220),
      });
    }
  }

  if (lines.length > 300) {
    findings.push({
      type: 'large_file',
      severity: 'Major',
      line: 1,
      snippet: `File has ${lines.length} lines; check whether UI, state, and business logic are mixed.`,
    });
  }

  const isScreen = looksLikeScreen(rel, text);
  const isComponent = looksLikeComponent(rel, text);
  return {
    file: rel,
    extension: path.extname(file),
    kind: isScreen ? 'screen' : isComponent ? 'component' : 'source',
    lineCount: lines.length,
    isScreen,
    isComponent,
    usesTokens: usesTokenLikeValues(text),
    findingCount: findings.length,
    riskScore: findings.reduce((sum, f) => sum + severityWeight(f.severity), 0),
    findings,
  };
}

function looksLikeScreen(rel, text) {
  return /(^|\/)(app|pages|routes|screens|views|viewcontrollers)(\/|$)/i.test(rel) ||
    /(?:Page|Screen|View|ViewController)\.(?:tsx|jsx|ts|js|swift|vue|svelte)$/.test(rel) ||
    /\b(?:struct\s+\w+\s*:\s*View|class\s+\w+\s*:\s*(?:UIViewController|UITableViewController|UICollectionViewController))\b/.test(text);
}

function looksLikeComponent(rel, text) {
  return /(^|\/)(components|ui|widgets|designsystem|design-system)(\/|$)/i.test(rel) ||
    /\b(?:export\s+function|const\s+\w+\s*=\s*\(|struct\s+\w+\s*:\s*View)\b/.test(text);
}

function usesTokenLikeValues(text) {
  return /(?:var\(--|tokens?\.|theme\.|App(?:Spacing|Radius|Color|Typography)|DesignTokens|bg-[a-z][a-z-]+|text-[a-z][a-z-]+)/.test(text);
}

function screenRow(item) {
  return {
    screen_name: nameFromPath(item.file),
    file_path: item.file,
    module: moduleFromPath(item.file),
    screen_type: /(^|\/)(settings|profile|help|about|history|archive)(\/|\.|-)/i.test(item.file) ? 'secondary' : 'unknown',
    current_purpose: '',
    primary_task_clear: false,
    refactor_needed: item.findingCount > 0,
    refactor_priority: priorityForScore(item.riskScore),
  };
}

function componentRow(item) {
  return {
    component_name: nameFromPath(item.file),
    file_path: item.file,
    component_type: inferComponentType(item.file),
    reusable: /(^|\/)(components|ui|widgets|designsystem|design-system)(\/|$)/i.test(item.file),
    duplicates: [],
    uses_tokens: item.usesTokens,
    refactor_needed: item.findingCount > 0 || !item.usesTokens,
  };
}

function buildDebt(scanned) {
  const rows = [];
  let index = 1;
  for (const item of scanned.sort((a, b) => b.riskScore - a.riskScore)) {
    for (const finding of item.findings.slice(0, 12)) {
      rows.push({
        issue_id: `UI-${String(index).padStart(4, '0')}`,
        severity: finding.severity,
        file_path: item.file,
        screen_or_component: item.isScreen ? nameFromPath(item.file) : item.isComponent ? nameFromPath(item.file) : '',
        issue_type: finding.type,
        line: finding.line,
        description: finding.snippet,
        user_impact: impactForFinding(finding.type),
        recommended_fix: fixForFinding(finding.type),
        phase_to_fix: PHASE_HINTS[finding.type] || 'phase_01',
      });
      index += 1;
    }
  }
  return rows;
}

async function writeReports(result, outDir) {
  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(path.join(outDir, 'design-inventory.json'), JSON.stringify(result, null, 2), 'utf8');
  await fs.writeFile(path.join(outDir, 'repository-intake.md'), repositoryMarkdown(result), 'utf8');
  await fs.writeFile(path.join(outDir, 'screen-inventory.md'), screenMarkdown(result.screenInventory), 'utf8');
  await fs.writeFile(path.join(outDir, 'component-inventory.md'), componentMarkdown(result.componentInventory), 'utf8');
  await fs.writeFile(path.join(outDir, 'design-debt-report.md'), debtMarkdown(result), 'utf8');
}

function printDryRun(result, outDir) {
  console.log(`[design-inventory] dry-run: would write reports to ${outDir}`);
  console.log('- design-inventory.json');
  console.log('- repository-intake.md');
  console.log('- screen-inventory.md');
  console.log('- component-inventory.md');
  console.log('- design-debt-report.md');
  printSummary(result);
}

function printSummary(result) {
  console.log(`[design-inventory] files=${result.filesScanned} screens=${result.summary.screens} components=${result.summary.components} debt=${result.summary.debtItems}`);
}

function repositoryMarkdown(result) {
  return `# Repository Intake Report

## Project Summary
- Root: ${result.root}
- Files scanned: ${result.filesScanned}
- Potential screens: ${result.summary.screens}
- Potential components: ${result.summary.components}
- Design debt items: ${result.summary.debtItems}

## Design System Status
- Token usage observed: ${result.componentInventory.some((c) => c.uses_tokens) ? 'yes' : 'unknown'}
- Critical findings: ${result.summary.critical}
- Major findings: ${result.summary.major}
- Minor findings: ${result.summary.minor}

## Recommended Next Step
- Review \`screen-inventory.md\`, \`component-inventory.md\`, and \`design-debt-report.md\`.
- Choose \`incremental\`, \`hybrid\`, or \`full_redesign\` before editing UI.
`;
}

function screenMarkdown(rows) {
  const table = rows.map((r) => `| ${r.screen_name} | \`${r.file_path}\` | ${r.module} | ${r.screen_type} | ${r.primary_task_clear ? 'yes' : 'no'} | ${r.refactor_needed ? 'yes' : 'no'} | ${r.refactor_priority} |`).join('\n');
  return `# Screen Inventory

| Screen | File Path | Module | Type | Primary Task Clear? | Refactor Needed? | Priority |
|---|---|---|---|---|---|---|
${table}
`;
}

function componentMarkdown(rows) {
  const table = rows.map((r) => `| ${r.component_name} | \`${r.file_path}\` | ${r.component_type} | ${r.reusable ? 'yes' : 'no'} | ${r.uses_tokens ? 'yes' : 'no'} | ${r.refactor_needed ? 'yes' : 'no'} |`).join('\n');
  return `# Component Inventory

| Component | File Path | Type | Reusable? | Uses Tokens? | Refactor Needed? |
|---|---|---|---|---|---|
${table}
`;
}

function debtMarkdown(result) {
  const rows = result.designDebt.map((r) => `| ${r.issue_id} | ${r.severity} | \`${r.file_path}\` | ${r.issue_type} | ${escapePipe(r.description)} | ${r.phase_to_fix} |`).join('\n');
  return `# Design Debt Report

## Summary
- Total issues: ${result.summary.debtItems}
- Critical: ${result.summary.critical}
- Major: ${result.summary.major}
- Minor: ${result.summary.minor}

| ID | Severity | File | Type | Description | Phase |
|---|---|---|---|---|---|
${rows}
`;
}

function lineForIndex(text, index) {
  return text.slice(0, index).split(/\r?\n/).length;
}

function severityWeight(severity) {
  return severity === 'Critical' ? 8 : severity === 'Major' ? 3 : 1;
}

function priorityForScore(score) {
  if (score >= 24) return 'P0';
  if (score >= 10) return 'P1';
  if (score > 0) return 'P2';
  return 'P3';
}

function nameFromPath(rel) {
  return path.basename(rel, path.extname(rel));
}

function moduleFromPath(rel) {
  const parts = normalize(rel).split('/');
  return parts.length > 1 ? parts[parts.length - 2] : 'root';
}

function inferComponentType(rel) {
  const name = rel.toLowerCase();
  if (name.includes('button')) return 'button';
  if (name.includes('card')) return 'card';
  if (name.includes('input') || name.includes('field')) return 'input';
  if (name.includes('empty')) return 'empty-state';
  if (name.includes('loading')) return 'loading';
  if (name.includes('error')) return 'error';
  if (name.includes('list') || name.includes('row')) return 'list-row';
  return 'unknown';
}

function impactForFinding(type) {
  if (type === 'technical_ui_copy') return 'Leaks implementation details into user-facing UI.';
  if (type === 'long_ui_copy') return 'Risks document-style UI and weak task focus.';
  if (type === 'large_file') return 'May mix UI, state, and business logic, increasing refactor risk.';
  return 'Weakens design-system consistency and makes visual changes harder to control.';
}

function fixForFinding(type) {
  if (type === 'technical_ui_copy') return 'Rewrite as user-understandable state language or move to logs/admin/help.';
  if (type === 'long_ui_copy') return 'Compress copy and redesign the flow/content hierarchy.';
  if (type === 'large_file') return 'Create a screen spec, then split UI structure before broad edits.';
  return 'Map to DESIGN.md token/component or record a justified allowlist exception.';
}

function normalize(p) {
  return p.replace(/\\/g, '/');
}

function escapePipe(value) {
  return String(value || '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}
