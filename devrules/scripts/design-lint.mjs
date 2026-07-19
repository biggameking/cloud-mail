#!/usr/bin/env node
// design-lint：校验 DESIGN.md 本身的质量（事实源必须先是干净的，下游才可信）。
//
// 三层检查：
//   A. 官方 CLI（仅显式 --online 时）：npx -p @google/design.md designmd lint —— 9 条规范规则（broken-ref、对比度等）
//   B. 本地默认：front matter 可解析、primary 存在、引用可解析、
//      章节顺序/重复、组件 bg/text 对比度（WCAG AA 4.5:1）
//   C. 本地增强（总是运行）：
//      - requiredComponents 覆盖度：项目要求必须有规格的组件是否都已登记（组件规格完整度门禁）
//      - 组件 backgroundColor/textColor 配对完整性
//      - requiredSections（含别名）是否齐全、Do's and Don'ts 是否存在
//
// 用法：
//   node devrules/scripts/design-lint.mjs [--design path] [--online] [--offline] [--format json] [--strict]

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { loadConfig, resolveFromRoot } from './design-lib/config.mjs';
import { extractFrontMatter, parseYamlSubset, resolveRefs, extractSections, getPath, isTokenRef, refPath } from './design-lib/frontmatter.mjs';
import { contrastRatio, parseColor } from './design-lib/colors.mjs';
import { printFindings, exitCode, parseArgs } from './design-lib/report.mjs';

const { flags } = parseArgs(process.argv.slice(2), ['online', 'offline', 'strict']);
const format = flags.format === 'json' ? 'json' : 'pretty';

// 规范章节顺序（含别名，别名视为同一章节）
const CANONICAL_SECTIONS = [
  { canonical: 'Overview', aliases: ['Overview', 'Brand & Style'] },
  { canonical: 'Colors', aliases: ['Colors'] },
  { canonical: 'Typography', aliases: ['Typography'] },
  { canonical: 'Layout', aliases: ['Layout', 'Layout & Spacing'] },
  { canonical: 'Elevation & Depth', aliases: ['Elevation & Depth', 'Elevation'] },
  { canonical: 'Shapes', aliases: ['Shapes'] },
  { canonical: 'Components', aliases: ['Components'] },
  { canonical: "Do's and Don'ts", aliases: ["Do's and Don'ts", 'Dos and Donts', "Do's & Don'ts"] },
];

main();

function main() {
  const { config, root } = loadConfig();
  const designPath = flags.design ? path.resolve(flags.design) : resolveFromRoot(root, config.designFile);
  const relPath = path.relative(root, designPath).split(path.sep).join('/');
  const findings = [];

  if (!fs.existsSync(designPath)) {
    findings.push({ severity: 'error', rule: 'lint', file: relPath, message: '找不到 DESIGN.md。请先按 devrules/workflows/design-init-new-project.md 或 design-adopt-existing-project.md 建立设计事实源' });
    return finish(findings);
  }
  const text = fs.readFileSync(designPath, 'utf8');

  // ---------- A. 官方 CLI ----------
  let officialRan = false;
  if (flags.online && !flags.offline) {
    const official = runOfficialLint(designPath);
    if (official.ok) {
      officialRan = true;
      for (const f of official.findings) {
        findings.push({
          severity: f.severity === 'warning' ? 'warn' : f.severity === 'error' ? 'error' : 'info',
          rule: `designmd/${f.rule ?? 'lint'}`,
          file: relPath,
          message: f.path ? `${f.path}: ${f.message}` : f.message,
        });
      }
    } else {
      findings.push({ severity: 'info', rule: 'lint', message: `显式选择的官方 designmd CLI 不可用（${official.reason}），使用本地兜底检查。确认联网与依赖策略后可运行: npx -p @google/design.md designmd lint ${relPath}` });
    }
  }

  // ---------- 解析（B/C 共用） ----------
  let raw = null;
  let body = '';
  let bodyStartLine = 1;
  try {
    const fm = extractFrontMatter(text);
    body = fm.body;
    if (fm.hasFrontMatter) {
      const parsed = parseYamlSubset(fm.yaml, fm.yamlStartLine);
      raw = parsed.data;
      bodyStartLine = fm.yamlStartLine + fm.yaml.split('\n').length + 1;
      for (const w of parsed.warnings) {
        findings.push({ severity: 'warn', rule: 'frontmatter', file: relPath, line: w.line ?? undefined, message: w.message });
      }
    } else {
      findings.push({ severity: 'error', rule: 'frontmatter', file: relPath, message: '缺少 YAML front matter（--- 包围的 token 区）' });
    }
  } catch (err) {
    findings.push({ severity: 'error', rule: 'frontmatter', file: relPath, message: err.message });
  }

  // ---------- B. 本地兜底（官方没跑成时） ----------
  if (raw && !officialRan) {
    if (!raw.name) {
      findings.push({ severity: 'warn', rule: 'local/missing-name', file: relPath, message: '缺少 name 字段' });
    }
    if (raw.colors && !getPath(raw, 'colors.primary')) {
      findings.push({ severity: 'warn', rule: 'local/missing-primary', file: relPath, message: '定义了 colors 但没有 primary —— 消费方会自行猜一个主色' });
    }
    if (raw.colors && !raw.typography) {
      findings.push({ severity: 'warn', rule: 'local/missing-typography', file: relPath, message: '没有 typography tokens —— 消费方会使用默认字体' });
    }
    const { broken } = resolveRefs(raw);
    for (const b of broken) {
      findings.push({ severity: 'error', rule: 'local/broken-ref', file: relPath, message: `token 引用无法解析：${b.at} -> ${b.ref}` });
    }
    // 章节顺序 / 重复
    const sections = extractSections(body, bodyStartLine);
    const seen = new Map();
    let lastIdx = -1;
    for (const s of sections) {
      const idx = CANONICAL_SECTIONS.findIndex((c) => c.aliases.some((a) => a.toLowerCase() === s.title.toLowerCase()));
      if (idx === -1) continue; // 未知章节：保留不报错（规范行为）
      const canonical = CANONICAL_SECTIONS[idx].canonical;
      if (seen.has(canonical)) {
        findings.push({ severity: 'error', rule: 'local/duplicate-section', file: relPath, line: s.line, message: `章节重复：## ${s.title}` });
      }
      seen.set(canonical, true);
      if (idx < lastIdx) {
        findings.push({ severity: 'warn', rule: 'local/section-order', file: relPath, line: s.line, message: `章节顺序不符合规范：## ${s.title} 应出现在更前面（规范顺序见 devrules/DESIGN.template.md）` });
      }
      lastIdx = Math.max(lastIdx, idx);
    }
    // 对比度（WCAG AA）
    if (raw.components) {
      const { resolved } = resolveRefs(raw);
      for (const [comp, props] of Object.entries(resolved.components ?? {})) {
        if (!props || typeof props !== 'object') continue;
        const bg = props.backgroundColor;
        const fg = props.textColor;
        if (typeof bg === 'string' && typeof fg === 'string') {
          const bgParsed = parseColor(bg);
          if (bgParsed && bgParsed.a < 1) continue; // 半透明/透明底无法静态断言对比度
          const ratio = contrastRatio(fg, bg);
          if (ratio !== null && ratio < 4.5) {
            findings.push({ severity: 'warn', rule: 'local/contrast-ratio', file: relPath, message: `components.${comp}: textColor 与 backgroundColor 对比度 ${ratio.toFixed(2)}:1，低于 WCAG AA (4.5:1)` });
          }
        }
      }
    }
  }

  // ---------- C. 本地增强（总是运行） ----------
  if (raw) {
    const comps = raw.components && typeof raw.components === 'object' ? Object.keys(raw.components) : [];
    for (const required of config.lint.requiredComponents ?? []) {
      if (!comps.includes(required)) {
        findings.push({ severity: 'warn', rule: 'devrules/required-component', file: relPath, message: `组件规格缺失：components.${required} 未登记（requiredComponents 见 design.config.json；用 devrules/templates/design-component-spec.md 补齐）` });
      }
    }
    for (const [comp, props] of Object.entries(raw.components ?? {})) {
      if (!props || typeof props !== 'object') continue;
      const isVariant = /-(hover|active|pressed|focus|disabled|checked|selected|error|loading|open)$/.test(comp);
      if (props.backgroundColor && !props.textColor && !isVariant) {
        findings.push({ severity: 'info', rule: 'devrules/bg-without-text', file: relPath, message: `components.${comp} 定义了 backgroundColor 但没有 textColor —— 无法做对比度校验，建议补上` });
      }
      // 组件属性里的引用是否可解析（官方也查，本地再兜一层，保证增强检查独立可用）
      for (const [prop, value] of Object.entries(props)) {
        if (isTokenRef(value) && getPath(raw, refPath(value)) === undefined) {
          findings.push({ severity: 'error', rule: 'devrules/broken-ref', file: relPath, message: `components.${comp}.${prop} 引用无法解析：${value}` });
        }
      }
    }
    const sections = extractSections(body, bodyStartLine);
    for (const requiredTitle of config.lint.requiredSections ?? []) {
      const group = CANONICAL_SECTIONS.find((c) => c.canonical.toLowerCase() === requiredTitle.toLowerCase());
      const aliases = group ? group.aliases : [requiredTitle];
      if (!sections.some((s) => aliases.some((a) => a.toLowerCase() === s.title.toLowerCase()))) {
        findings.push({ severity: 'warn', rule: 'devrules/required-section', file: relPath, message: `缺少必需章节：## ${requiredTitle}（prose 是设计的灵魂 —— token 只给数值，prose 给理由与用法）` });
      }
    }
  }

  if (!findings.length) {
    findings.push({ severity: 'info', rule: 'lint', file: relPath, message: 'DESIGN.md 校验通过 ✔' });
  }
  finish(findings);
}

function runOfficialLint(designPath) {
  try {
    const r = spawnSync('npx', ['-p', '@google/design.md', 'designmd', 'lint', '--format', 'json', designPath], {
      encoding: 'utf8',
      shell: process.platform === 'win32', // Windows 上 npx 是 .cmd，需要 shell
      timeout: 120000,
    });
    if (r.error) return { ok: false, reason: r.error.message };
    const stdout = (r.stdout ?? '').trim();
    if (!stdout) return { ok: false, reason: `无输出（exit=${r.status}）` };
    const jsonStart = stdout.indexOf('{');
    if (jsonStart === -1) return { ok: false, reason: '输出不是 JSON' };
    const data = JSON.parse(stdout.slice(jsonStart));
    return { ok: true, findings: data.findings ?? [] };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
}

function finish(findings) {
  const summary = printFindings(findings, { format, tool: 'design-lint' });
  process.exit(exitCode(summary, { strict: !!flags.strict }));
}
