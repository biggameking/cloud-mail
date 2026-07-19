#!/usr/bin/env node
// design-sync：把 DESIGN.md（单一事实源）编译成代码可消费的产物。
//
//   DESIGN.md ──> src/styles/design-tokens.css   （:root CSS 变量 + .typo-* 排版类 + 组件变量）
//             ──> src/styles/tailwind.design.json （tailwind theme.extend 片段，颜色支持 <alpha-value>）
//             ──> src/styles/design-tokens.json   （DTCG 风格 tokens，供 Figma/Style Dictionary 等）
//             ──> src/styles/.design-stamp.json   （同步戳：DESIGN.md hash + 产物 hash）
//
// 用法：
//   node devrules/scripts/design-sync.mjs                # 生成/更新产物
//   node devrules/scripts/design-sync.mjs --check        # 只校验：DESIGN.md 与产物是否同步、产物是否被手改
//   node devrules/scripts/design-sync.mjs --design path  # 指定 DESIGN.md（默认走 design.config.json）
//   node devrules/scripts/design-sync.mjs --out dir      # 把所有产物输出到指定目录（自测/预览用）
//   --format json                                        # 机器可读输出
//
// 产物均为生成物，禁止手改（--check / pre-commit 会发现手改）。

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { loadConfig, resolveFromRoot } from './design-lib/config.mjs';
import { extractFrontMatter, parseYamlSubset, resolveRefs, isTokenRef, refPath } from './design-lib/frontmatter.mjs';
import { parseColor, rgbChannels } from './design-lib/colors.mjs';
import { printFindings, exitCode, parseArgs } from './design-lib/report.mjs';

const KIT_VERSION = '1.0.0';
const KNOWN_GROUPS = new Set(['version', 'name', 'description', 'colors', 'colors-dark', 'typography', 'rounded', 'spacing', 'components']);

const { flags } = parseArgs(process.argv.slice(2), ['check']);
const format = flags.format === 'json' ? 'json' : 'pretty';

function main() {
  const { config, root } = loadConfig();
  const designPath = flags.design ? path.resolve(flags.design) : resolveFromRoot(root, config.designFile);
  const outputs = resolveOutputs(config, root, flags.out);

  const findings = [];
  if (!fs.existsSync(designPath)) {
    findings.push({ severity: 'error', rule: 'sync', file: rel(root, designPath), message: `找不到设计事实源文件。先按 devrules/workflows/design-init-new-project.md 或 design-adopt-existing-project.md 建立 DESIGN.md` });
    finish(findings);
  }
  const designText = fs.readFileSync(designPath, 'utf8');
  const designHash = sha256(designText);

  if (flags.check) {
    checkMode({ root, outputs, designHash, findings });
    finish(findings);
  }

  // ---------- 解析 ----------
  let fm;
  try {
    fm = extractFrontMatter(designText);
  } catch (err) {
    findings.push({ severity: 'error', rule: 'frontmatter', file: rel(root, designPath), message: err.message });
    finish(findings);
  }
  if (!fm.hasFrontMatter) {
    findings.push({ severity: 'error', rule: 'frontmatter', file: rel(root, designPath), message: 'DESIGN.md 缺少 YAML front matter（--- 包围的 token 区）' });
    finish(findings);
  }
  let parsed;
  try {
    parsed = parseYamlSubset(fm.yaml, fm.yamlStartLine);
  } catch (err) {
    findings.push({ severity: 'error', rule: 'frontmatter', file: rel(root, designPath), message: err.message });
    finish(findings);
  }
  for (const w of parsed.warnings) {
    findings.push({ severity: 'warn', rule: 'frontmatter', file: rel(root, designPath), line: w.line ?? undefined, message: w.message });
  }
  const raw = parsed.data;
  const { resolved, broken } = resolveRefs(raw);
  for (const b of broken) {
    findings.push({ severity: 'error', rule: 'broken-ref', file: rel(root, designPath), message: `token 引用无法解析：${b.at} -> ${b.ref}${b.reason === 'circular' ? '（循环引用）' : ''}` });
  }
  if (findings.some((f) => f.severity === 'error')) finish(findings);

  // ---------- 生成 ----------
  const css = emitCss({ raw, resolved, designHash });
  const tailwind = emitTailwindFragment({ raw, resolved });
  const dtcg = emitDtcg({ resolved });

  const artifacts = [
    { path: outputs.cssVariables, content: css },
    { path: outputs.tailwindFragment, content: JSON.stringify(tailwind, null, 2) + '\n' },
    { path: outputs.dtcgTokens, content: JSON.stringify(dtcg, null, 2) + '\n' },
  ];
  const stamp = {
    kitVersion: KIT_VERSION,
    designFile: rel(root, designPath),
    designHash,
    generatedAt: new Date().toISOString(),
    artifacts: {},
  };
  for (const a of artifacts) {
    writeFileEnsured(a.path, a.content);
    stamp.artifacts[rel(root, a.path)] = sha256(a.content);
    findings.push({ severity: 'info', rule: 'sync', file: rel(root, a.path), message: '已生成' });
  }
  writeFileEnsured(outputs.stampFile, JSON.stringify(stamp, null, 2) + '\n');
  findings.push({ severity: 'info', rule: 'sync', file: rel(root, outputs.stampFile), message: '同步戳已更新' });
  finish(findings);
}

// ---------------------------------------------------------------- check 模式

function checkMode({ root, outputs, designHash, findings }) {
  const stampPath = outputs.stampFile;
  if (!fs.existsSync(stampPath)) {
    findings.push({ severity: 'error', rule: 'sync-stale', file: rel(root, stampPath), message: '缺少同步戳：尚未运行过 design-sync。请运行 npm run design:sync' });
    return;
  }
  let stamp;
  try {
    stamp = JSON.parse(fs.readFileSync(stampPath, 'utf8'));
  } catch {
    findings.push({ severity: 'error', rule: 'sync-stale', file: rel(root, stampPath), message: '同步戳损坏，请重新运行 npm run design:sync' });
    return;
  }
  if (stamp.designHash !== designHash) {
    findings.push({ severity: 'error', rule: 'sync-stale', file: stamp.designFile, message: 'DESIGN.md 已变更但产物未同步。请运行 npm run design:sync 并把产物一并提交' });
  }
  for (const [relPath, hash] of Object.entries(stamp.artifacts ?? {})) {
    const p = resolveFromRoot(root, relPath);
    if (!fs.existsSync(p)) {
      findings.push({ severity: 'error', rule: 'sync-missing', file: relPath, message: '生成物缺失。请运行 npm run design:sync' });
      continue;
    }
    if (sha256(fs.readFileSync(p, 'utf8')) !== hash) {
      findings.push({ severity: 'error', rule: 'sync-hand-edit', file: relPath, message: '生成物与同步戳不一致：疑似被手改。生成物禁止手改 —— 改 DESIGN.md 后重新 design:sync' });
    }
  }
  if (!findings.length) {
    findings.push({ severity: 'info', rule: 'sync', message: 'DESIGN.md 与全部产物同步 ✔' });
  }
}

// ---------------------------------------------------------------- CSS 产物

function emitCss({ raw, resolved, designHash }) {
  const L = [];
  L.push('/*');
  L.push(' * AUTO-GENERATED by devrules design-sync — DO NOT EDIT BY HAND.');
  L.push(' * 事实源：DESIGN.md（改设计只改 DESIGN.md，然后运行 npm run design:sync）');
  L.push(` * design-hash: ${designHash}`);
  L.push(' */');
  L.push('');
  L.push(':root {');

  // colors
  if (isObj(resolved.colors)) {
    L.push('  /* ---- colors ---- */');
    for (const [name, value] of Object.entries(resolved.colors)) {
      if (value == null) continue;
      const v = String(value);
      L.push(`  --color-${varName(name)}: ${v};`);
      const ch = safeChannels(v);
      if (ch) L.push(`  --color-${varName(name)}-rgb: ${ch};`);
    }
  }
  // rounded / spacing
  for (const [group, prefix] of [['rounded', 'rounded'], ['spacing', 'space']]) {
    if (!isObj(resolved[group])) continue;
    L.push(`  /* ---- ${group} ---- */`);
    for (const [name, value] of Object.entries(resolved[group])) {
      if (value == null) continue;
      L.push(`  --${prefix}-${varName(name)}: ${value};`);
    }
  }
  // typography 变量
  if (isObj(resolved.typography)) {
    L.push('  /* ---- typography ---- */');
    for (const [name, t] of Object.entries(resolved.typography)) {
      if (!isObj(t)) continue;
      const n = varName(name);
      if (t.fontFamily != null) L.push(`  --font-${n}-family: ${cssFontFamily(t.fontFamily)};`);
      if (t.fontSize != null) L.push(`  --font-${n}-size: ${t.fontSize};`);
      if (t.fontWeight != null) L.push(`  --font-${n}-weight: ${t.fontWeight};`);
      if (t.lineHeight != null) L.push(`  --font-${n}-line-height: ${t.lineHeight};`);
      if (t.letterSpacing != null) L.push(`  --font-${n}-letter-spacing: ${t.letterSpacing};`);
    }
  }
  // 自定义扩展组（motion / elevation / zindex ...）：标量叶子一律输出为 --<group>-<name>
  for (const [group, node] of Object.entries(resolved)) {
    if (KNOWN_GROUPS.has(group) || !isObj(node)) continue;
    const leaves = Object.entries(node).filter(([, v]) => v != null && typeof v !== 'object');
    if (!leaves.length) continue;
    L.push(`  /* ---- ${group} (custom) ---- */`);
    for (const [name, value] of leaves) {
      L.push(`  --${varName(group)}-${varName(name)}: ${value};`);
    }
  }
  // components：引用尽量落成 var()，保持“改一处、处处生效”
  if (isObj(raw.components)) {
    L.push('  /* ---- components ---- */');
    for (const [comp, props] of Object.entries(raw.components)) {
      if (!isObj(props)) continue;
      for (const [prop, value] of Object.entries(props)) {
        if (value == null || prop === 'typography') continue; // 组合值不落 CSS 变量
        const cssVal = componentValue(value);
        if (cssVal == null) continue;
        L.push(`  --c-${varName(comp)}-${PROP_SHORT[prop] ?? varName(prop)}: ${cssVal};`);
      }
    }
  }
  L.push('}');
  L.push('');

  // colors-dark（自定义组）：同名覆盖，生成 .dark 作用域 —— 暗色切换零成本
  if (isObj(resolved['colors-dark'])) {
    L.push('.dark {');
    for (const [name, value] of Object.entries(resolved['colors-dark'])) {
      if (value == null) continue;
      const v = String(value);
      L.push(`  --color-${varName(name)}: ${v};`);
      const ch = safeChannels(v);
      if (ch) L.push(`  --color-${varName(name)}-rgb: ${ch};`);
    }
    L.push('}');
    L.push('');
  }

  // .typo-* 排版类：组件/页面直接 class="typo-h1"，不再各写各的字号行高
  if (isObj(resolved.typography)) {
    for (const [name, t] of Object.entries(resolved.typography)) {
      if (!isObj(t)) continue;
      const n = varName(name);
      L.push(`.typo-${n} {`);
      if (t.fontFamily != null) L.push(`  font-family: var(--font-${n}-family);`);
      if (t.fontSize != null) L.push(`  font-size: var(--font-${n}-size);`);
      if (t.fontWeight != null) L.push(`  font-weight: var(--font-${n}-weight);`);
      if (t.lineHeight != null) L.push(`  line-height: var(--font-${n}-line-height);`);
      if (t.letterSpacing != null) L.push(`  letter-spacing: var(--font-${n}-letter-spacing);`);
      if (t.fontFeature != null) L.push(`  font-feature-settings: ${t.fontFeature};`);
      if (t.fontVariation != null) L.push(`  font-variation-settings: ${t.fontVariation};`);
      L.push('}');
    }
    L.push('');
  }
  return L.join('\n');
}

const PROP_SHORT = {
  backgroundColor: 'bg',
  textColor: 'text',
  rounded: 'rounded',
  padding: 'padding',
  height: 'height',
  width: 'width',
  size: 'size',
};

/** 组件属性值：token 引用 -> var(--...)；字面量 -> 原样。 */
function componentValue(value) {
  if (isTokenRef(value)) {
    const p = refPath(value);
    const [group, ...restParts] = p.split('.');
    const restName = varName(restParts.join('.'));
    if (group === 'colors') return `var(--color-${restName})`;
    if (group === 'rounded') return `var(--rounded-${restName})`;
    if (group === 'spacing') return `var(--space-${restName})`;
    if (group === 'typography') return null;
    return `var(--${varName(group)}-${restName})`;
  }
  return String(value);
}

// ---------------------------------------------------------------- tailwind 片段

function emitTailwindFragment({ raw, resolved }) {
  const out = { $comment: 'AUTO-GENERATED by devrules design-sync. merge into tailwind theme.extend — do not edit.' };
  if (isObj(resolved.colors)) {
    out.colors = {};
    for (const [name, value] of Object.entries(resolved.colors)) {
      if (value == null) continue;
      const n = varName(name);
      out.colors[name] = safeChannels(String(value))
        ? `rgb(var(--color-${n}-rgb) / <alpha-value>)`
        : `var(--color-${n})`;
    }
  }
  if (isObj(resolved.rounded)) {
    out.borderRadius = {};
    for (const [name] of Object.entries(resolved.rounded)) {
      out.borderRadius[name] = `var(--rounded-${varName(name)})`;
    }
  }
  if (isObj(resolved.spacing)) {
    out.spacing = {};
    for (const [name, value] of Object.entries(resolved.spacing)) {
      if (typeof value === 'number') continue; // 列数/比例等无单位值不进 spacing scale
      out.spacing[name] = `var(--space-${varName(name)})`;
    }
  }
  if (isObj(resolved.typography)) {
    out.fontSize = {};
    out.fontFamily = {};
    for (const [name, t] of Object.entries(resolved.typography)) {
      if (!isObj(t)) continue;
      const extra = {};
      if (t.lineHeight != null) extra.lineHeight = String(t.lineHeight);
      if (t.letterSpacing != null) extra.letterSpacing = String(t.letterSpacing);
      if (t.fontWeight != null) extra.fontWeight = String(t.fontWeight);
      if (t.fontSize != null) out.fontSize[name] = Object.keys(extra).length ? [String(t.fontSize), extra] : String(t.fontSize);
      if (t.fontFamily != null) out.fontFamily[name] = [String(t.fontFamily)];
    }
  }
  return out;
}

// ---------------------------------------------------------------- DTCG 产物

function emitDtcg({ resolved }) {
  const out = {};
  if (isObj(resolved.colors)) {
    out.colors = {};
    for (const [name, value] of Object.entries(resolved.colors)) {
      if (value == null) continue;
      out.colors[name] = { $type: 'color', $value: String(value) };
    }
  }
  if (isObj(resolved.typography)) {
    out.typography = {};
    for (const [name, t] of Object.entries(resolved.typography)) {
      if (!isObj(t)) continue;
      out.typography[name] = { $type: 'typography', $value: { ...t } };
    }
  }
  for (const [group, key] of [['rounded', 'rounded'], ['spacing', 'spacing']]) {
    if (!isObj(resolved[group])) continue;
    out[key] = {};
    for (const [name, value] of Object.entries(resolved[group])) {
      if (value == null) continue;
      out[key][name] = { $type: typeof value === 'number' ? 'number' : 'dimension', $value: value };
    }
  }
  if (isObj(resolved.components)) {
    out.components = {};
    for (const [comp, props] of Object.entries(resolved.components)) {
      if (!isObj(props)) continue;
      out.components[comp] = {};
      for (const [prop, value] of Object.entries(props)) {
        if (value == null) continue;
        const type = prop === 'backgroundColor' || prop === 'textColor' ? 'color'
          : prop === 'typography' ? 'typography' : 'dimension';
        out.components[comp][prop] = { $type: type, $value: value };
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------- 工具函数

function resolveOutputs(config, root, outOverride) {
  if (outOverride) {
    const dir = path.resolve(outOverride);
    return {
      cssVariables: path.join(dir, 'design-tokens.css'),
      tailwindFragment: path.join(dir, 'tailwind.design.json'),
      dtcgTokens: path.join(dir, 'design-tokens.json'),
      stampFile: path.join(dir, '.design-stamp.json'),
    };
  }
  return {
    cssVariables: resolveFromRoot(root, config.output.cssVariables),
    tailwindFragment: resolveFromRoot(root, config.output.tailwindFragment),
    dtcgTokens: resolveFromRoot(root, config.output.dtcgTokens),
    stampFile: resolveFromRoot(root, config.output.stampFile),
  };
}

function safeChannels(v) {
  const c = parseColor(v);
  if (!c || c.a !== 1) return null; // 带透明度的颜色不给 -rgb 通道，避免误用
  return rgbChannels(v);
}

function cssFontFamily(family) {
  const f = String(family).trim();
  if (f.includes(',') || /^['"].*['"]$/.test(f)) return f;
  return /\s/.test(f) ? `'${f}'` : f;
}

function varName(name) {
  return String(name).trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
}

function isObj(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function sha256(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

function writeFileEnsured(p, content) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content, 'utf8');
}

function rel(root, p) {
  return path.relative(root, p).split(path.sep).join('/') || p;
}

function finish(findings) {
  const summary = printFindings(findings, { format, tool: 'design-sync' });
  process.exit(exitCode(summary));
}

main();
