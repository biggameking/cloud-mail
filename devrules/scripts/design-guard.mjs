#!/usr/bin/env node
// design-guard：UI 硬编码守卫。确保前端只消费 DESIGN.md 派生的 token/语义类，
// 从机制上杜绝“各自为营、一处一处抠 UI”的情况。
//
// 规则（severity 由 design.config.json guard.rules 控制，off 可关闭）：
//   no-hex-color                代码/样式中出现 #hex 颜色字面量
//   no-color-fn-literal         rgb()/hsl()/oklch() 等颜色函数字面量（hsl(var(--x)) 这类包 var 的放行）
//   no-tailwind-arbitrary-color Tailwind 任意值颜色：bg-[#fff]、text-[rgb(...)]
//   no-tailwind-arbitrary-value 其他 Tailwind 任意值：p-[13px]、w-[42rem]（data-[...]/aria-[...] 等变体放行）
//   no-inline-style-literal     style={{...}} / style="..." 内的颜色或 px 字面量
//   no-unregistered-font        使用了 DESIGN.md typography 未注册的字体族
//   no-magic-px-in-css          .css 内 >= 阈值的裸 px 值（var()/calc(var())/@media 行放行）
//   no-placeholder-copy         占位/模板化文案（lorem ipsum、占位文案、点击这里…，名单由 copyBannedPatterns 配置）
//
// 豁免（两种，都必须带理由）：
//   1) devrules/design-guard.allow.json 清单（见该文件注释）
//   2) 行内注释：// design-guard-allow: no-hex-color -- 品牌 Logo 固定色
//      （放在违规行或其上一行；缺少 "-- 理由" 的豁免不生效）
//
// 用法：
//   node devrules/scripts/design-guard.mjs                 # 全量扫描
//   node devrules/scripts/design-guard.mjs --staged        # 只扫 git 暂存区文件（pre-commit 用）
//   node devrules/scripts/design-guard.mjs --inventory     # 盘点模式：聚合统计存量硬编码值（审计/逆向沉淀用）
//   node devrules/scripts/design-guard.mjs --root dir      # 指定扫描根（默认仓库根）
//   node devrules/scripts/design-guard.mjs --format json   # 机器可读输出
//   node devrules/scripts/design-guard.mjs --strict        # warn 也导致退出码 1

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { loadConfig, resolveFromRoot } from './design-lib/config.mjs';
import { extractFrontMatter, parseYamlSubset } from './design-lib/frontmatter.mjs';
import { printFindings, exitCode, parseArgs } from './design-lib/report.mjs';

const { flags } = parseArgs(process.argv.slice(2), ['staged', 'inventory', 'strict']);
const format = flags.format === 'json' ? 'json' : 'pretty';

const HEX_RE = /#[0-9a-fA-F]{3,8}(?![0-9a-fA-F])/g;
const COLOR_FN_RE = /(?<![\w-])(rgba?|hsla?|oklch|oklab|hwb|lab|lch|color-mix)\(/g;
const TW_ARBITRARY_RE = /(?<=^|[\s"'`{:])((?:[a-zA-Z][\w-]*-)+)\[([^\]\s][^\]]*)\]/g;
const VARIANT_PREFIXES = ['data-', 'aria-', 'supports-', 'has-', 'group-', 'peer-', 'nth-', 'not-'];
const GENERIC_FONTS = new Set([
  'sans-serif', 'serif', 'monospace', 'cursive', 'fantasy', 'system-ui',
  'ui-sans-serif', 'ui-serif', 'ui-monospace', 'ui-rounded', 'inherit', 'initial', 'unset', 'emoji', 'math',
]);

main();

function main() {
  const { config, root } = loadConfig();
  const guardCfg = config.guard;
  const scanRoot = flags.root ? path.resolve(flags.root) : root;

  const files = flags.staged ? stagedFiles(root, guardCfg) : walkFiles(scanRoot, guardCfg, root);
  const registeredFonts = loadRegisteredFonts(config, root);
  const allowlist = loadAllowlist(config, root);
  const bannedCopy = (guardCfg.copyBannedPatterns ?? []).map((p) => String(p).toLowerCase()).filter(Boolean);

  if (flags.inventory) {
    runInventory(files, root);
    return;
  }

  const findings = [];
  const usedAllowEntries = new Set();
  for (const file of files) {
    scanFile({ file, root, guardCfg, registeredFonts, allowlist, usedAllowEntries, findings, bannedCopy });
  }
  // 提示失效豁免（清单里写了但已无命中的条目 → 审计时应删除）
  allowlist.forEach((entry, i) => {
    if (!usedAllowEntries.has(i) && !flags.staged) {
      findings.push({
        severity: 'info', rule: 'allowlist-unused',
        file: entry.file,
        message: `豁免条目已无命中，可从 design-guard.allow.json 移除（rule=${entry.rule}${entry.match ? `, match=${entry.match}` : ''}）`,
      });
    }
  });
  if (!findings.length) {
    findings.push({ severity: 'info', rule: 'guard', message: `扫描 ${files.length} 个文件，未发现硬编码 ✔` });
  }
  const summary = printFindings(findings, { format, tool: 'design-guard' });
  process.exit(exitCode(summary, { strict: !!flags.strict }));
}

// ---------------------------------------------------------------- 单文件扫描

function scanFile({ file, root, guardCfg, registeredFonts, allowlist, usedAllowEntries, findings, bannedCopy = [] }) {
  const relPath = rel(root, file);
  const ext = path.extname(file).toLowerCase();
  const isCss = ext === '.css' || ext === '.scss';
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return;
  }
  const lines = text.split(/\r?\n/);
  const sev = (ruleId) => guardCfg.rules?.[ruleId] ?? 'off';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNo = i + 1;
    const trimmed = line.trim();
    // 跳过纯注释行（行内豁免注释在 suppression 检查里读原文，不受影响）
    if (!isCss && (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*'))) continue;
    if (isCss && trimmed.startsWith('/*')) continue;

    const suppress = suppressedRules(lines, i);
    const report = (ruleId, message, matchText) => {
      const severity = sev(ruleId);
      if (severity === 'off') return;
      if (suppress.rules.has(ruleId) || suppress.rules.has('*')) return;
      const allowIdx = matchAllowlist(allowlist, ruleId, relPath, line, matchText);
      if (allowIdx !== -1) {
        usedAllowEntries.add(allowIdx);
        return;
      }
      findings.push({ severity: severity === 'warn' ? 'warn' : 'error', rule: ruleId, file: relPath, line: lineNo, message, snippet: line });
    };

    // 1) hex 颜色
    for (const m of line.matchAll(HEX_RE)) {
      report('no-hex-color', `硬编码颜色 ${m[0]} —— 请改用 DESIGN.md 派生的语义 token（如 bg-primary / var(--color-primary)）`, m[0]);
    }
    // 2) 颜色函数字面量（参数含 var( 的放行）
    for (const m of line.matchAll(COLOR_FN_RE)) {
      const args = argsAfter(line, m.index + m[0].length);
      if (args.includes('var(')) continue;
      report('no-color-fn-literal', `颜色函数字面量 ${m[1]}(${truncate(args, 24)}) —— 请引用 token 变量`, m[0]);
    }
    // 3/4) Tailwind 任意值
    for (const m of line.matchAll(TW_ARBITRARY_RE)) {
      const prefix = m[1];
      const inner = m[2];
      if (VARIANT_PREFIXES.some((p) => prefix.startsWith(p) || prefix.includes(`:${p}`))) continue;
      const isColor = /^#[0-9a-fA-F]{3,8}$|^(rgba?|hsla?|oklch|oklab|hwb)\(/.test(inner) && !inner.includes('var(');
      if (isColor) {
        report('no-tailwind-arbitrary-color', `Tailwind 任意值颜色 ${prefix}[${inner}] —— 请把颜色收进 DESIGN.md 再用语义类`, m[0]);
      } else if (!inner.includes('var(')) {
        report('no-tailwind-arbitrary-value', `Tailwind 任意值 ${prefix}[${truncate(inner, 24)}] —— 优先使用 token 化的 scale；确有必要请豁免并写明理由`, m[0]);
      }
    }
    // 5) inline style 字面量
    for (const styleContent of inlineStyleSegments(line)) {
      const colorHit = inlineColorLiteral(styleContent);
      const pxHit = /(?<!var\([^)]*)\b\d+(\.\d+)?px\b/.exec(styleContent);
      if (colorHit) {
        report('no-inline-style-literal', `inline style 中的颜色字面量 ${colorHit} —— 请用语义类或 var(--...)`, colorHit);
      } else if (pxHit && !/var\(/.test(styleContent)) {
        report('no-inline-style-literal', `inline style 中的尺寸字面量 ${pxHit[0]} —— 请用 spacing token（var(--space-*)）或布局组件`, pxHit[0]);
      }
    }
    // 6) 未注册字体
    const fontDecl = /font-family\s*:\s*([^;'"}\n]+|'[^']+'|"[^"]+")/i.exec(line) || /fontFamily\s*:\s*(['"`][^'"`]+['"`])/.exec(line);
    if (fontDecl && registeredFonts) {
      const families = fontDecl[1].split(',').map((f) => f.trim().replace(/^['"`]|['"`]$/g, '').toLowerCase()).filter(Boolean);
      const bad = families.find((f) => !GENERIC_FONTS.has(f) && !f.startsWith('var(') && !registeredFonts.has(f));
      if (bad) {
        report('no-unregistered-font', `字体 "${bad}" 未在 DESIGN.md typography 注册 —— 新字体先登记规格再使用`, bad);
      }
    }
    // 7) CSS 裸 px
    if (isCss && !trimmed.startsWith('@media') && !line.includes('var(')) {
      for (const m of line.matchAll(/\b(\d+(?:\.\d+)?)px\b/g)) {
        if (parseFloat(m[1]) >= (guardCfg.cssPxThreshold ?? 4)) {
          report('no-magic-px-in-css', `裸 px 值 ${m[0]} —— 请使用 var(--space-*) / var(--rounded-*) 等 token`, m[0]);
        }
      }
    }
    // 8) 占位/模板化文案（反 AI 味：界面文案必须是真实产品语言）
    if (bannedCopy.length && !isCss) {
      const lower = line.toLowerCase();
      for (const pat of bannedCopy) {
        if (lower.includes(pat)) {
          report('no-placeholder-copy', `疑似占位/模板化文案 "${pat}" —— 换成真实产品文案（验收标准见 devrules/templates/design-acceptance.md）`, pat);
        }
      }
    }
  }
}

/** 行内豁免：本行或上一行的 design-guard-allow 注释。必须带 "-- 理由" 才生效。 */
function suppressedRules(lines, idx) {
  const rules = new Set();
  for (const cand of [lines[idx], idx > 0 ? lines[idx - 1] : '']) {
    const m = /design-guard-allow:\s*([a-z*,\s-]+?)\s*--\s*(.+)/.exec(cand ?? '');
    if (m && m[2].trim()) {
      m[1].split(',').map((s) => s.trim()).filter(Boolean).forEach((r) => rules.add(r));
    }
  }
  return { rules };
}

function inlineStyleSegments(line) {
  const segments = [];
  for (const m of line.matchAll(/style=\{\{(?<body>.*?)\}\}/g)) {
    if (m.groups?.body) segments.push(m.groups.body);
  }
  for (const m of line.matchAll(/style=(["'])(?<body>.*?)\1/g)) {
    if (m.groups?.body) segments.push(m.groups.body);
  }
  return segments;
}

function inlineColorLiteral(styleContent) {
  const hex = /#[0-9a-fA-F]{3,8}(?![0-9a-fA-F])/.exec(styleContent);
  if (hex) return hex[0];
  if (styleContent.includes('var(')) return null;
  for (const m of styleContent.matchAll(/(?<![\w-])(rgba?|hsla?|oklch|oklab|hwb|lab|lch|color-mix)\(/g)) {
    const args = argsAfter(styleContent, m.index + m[0].length);
    return `${m[1]}(${args})`;
  }
  return null;
}

function matchAllowlist(allowlist, ruleId, relPath, line, matchText) {
  for (let i = 0; i < allowlist.length; i++) {
    const e = allowlist[i];
    if (e.rule !== ruleId) continue;
    if (e.file && !relPath.endsWith(normalizeSlash(e.file))) continue;
    if (e.match && !line.includes(e.match) && !String(matchText).includes(e.match)) continue;
    if (!e.reason || !String(e.reason).trim()) continue; // 无理由的豁免不生效
    return i;
  }
  return -1;
}

// ---------------------------------------------------------------- inventory 盘点模式

function runInventory(files, root) {
  const buckets = {
    hexColors: new Map(),
    colorFns: new Map(),
    tailwindArbitrary: new Map(),
    pxValues: new Map(),
    fontFamilies: new Map(),
  };
  const bump = (map, key, file) => {
    const e = map.get(key) ?? { count: 0, files: new Set() };
    e.count++;
    e.files.add(rel(root, file));
    map.set(key, e);
  };
  for (const file of files) {
    let text;
    try { text = fs.readFileSync(file, 'utf8'); } catch { continue; }
    for (const m of text.matchAll(HEX_RE)) bump(buckets.hexColors, m[0].toLowerCase(), file);
    for (const m of text.matchAll(/(?<![\w-])(rgba?|hsla?|oklch)\([^)]*\)/g)) {
      if (!m[0].includes('var(')) bump(buckets.colorFns, m[0], file);
    }
    for (const m of text.matchAll(TW_ARBITRARY_RE)) {
      const prefix = m[1];
      if (VARIANT_PREFIXES.some((p) => prefix.startsWith(p))) continue;
      if (!m[2].includes('var(')) bump(buckets.tailwindArbitrary, `${prefix}[${m[2]}]`, file);
    }
    for (const m of text.matchAll(/\b\d+(?:\.\d+)?px\b/g)) bump(buckets.pxValues, m[0], file);
    for (const m of text.matchAll(/font-family\s*:\s*([^;'"}\n]+)|fontFamily\s*:\s*['"`]([^'"`]+)['"`]/gi)) {
      const fam = (m[1] ?? m[2] ?? '').split(',')[0].trim().replace(/^['"`]|['"`]$/g, '');
      if (fam && !fam.startsWith('var(')) bump(buckets.fontFamilies, fam, file);
    }
  }
  const toSorted = (map, limit = 40) =>
    [...map.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, limit)
      .map(([value, e]) => ({ value, count: e.count, files: [...e.files].slice(0, 6) }));
  const result = {
    tool: 'design-guard --inventory',
    scannedFiles: files.length,
    hexColors: toSorted(buckets.hexColors),
    colorFns: toSorted(buckets.colorFns),
    tailwindArbitrary: toSorted(buckets.tailwindArbitrary),
    pxValues: toSorted(buckets.pxValues, 20),
    fontFamilies: toSorted(buckets.fontFamilies, 20),
  };
  if (format === 'json') {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    return;
  }
  process.stdout.write(`[design-guard --inventory] 扫描 ${files.length} 个文件。用于逆向沉淀（design-adopt-existing-project）与漂移审计（design-audit）：\n`);
  for (const [title, list] of [
    ['Hex 颜色（按出现次数）', result.hexColors],
    ['颜色函数字面量', result.colorFns],
    ['Tailwind 任意值', result.tailwindArbitrary],
    ['px 值分布', result.pxValues],
    ['字体族', result.fontFamilies],
  ]) {
    process.stdout.write(`\n== ${title} ==\n`);
    if (!list.length) { process.stdout.write('  （无）\n'); continue; }
    for (const item of list) {
      process.stdout.write(`  ${String(item.count).padStart(4)}x  ${item.value}   ${item.files[0] ?? ''}${item.files.length > 1 ? ` (+${item.files.length - 1})` : ''}\n`);
    }
  }
}

// ---------------------------------------------------------------- 文件收集

function walkFiles(scanRoot, guardCfg, repoRoot) {
  const out = [];
  const roots = (guardCfg.scanDirs ?? ['src']).map((d) => path.isAbsolute(d) ? d : path.join(scanRoot, d));
  const exts = new Set(guardCfg.extensions ?? []);
  const excludes = (guardCfg.exclude ?? []).map(normalizeSlash);
  const visit = (dir) => {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      const relPath = rel(repoRoot, full);
      if (excludes.some((x) => relPath.includes(x))) continue;
      if (e.isDirectory()) visit(full);
      else if (exts.has(path.extname(e.name).toLowerCase())) out.push(full);
    }
  };
  for (const r of roots) visit(r);
  return out;
}

function stagedFiles(root, guardCfg) {
  let list = '';
  try {
    list = execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR'], { cwd: root, encoding: 'utf8' });
  } catch {
    return [];
  }
  const exts = new Set(guardCfg.extensions ?? []);
  const excludes = (guardCfg.exclude ?? []).map(normalizeSlash);
  const dirs = (guardCfg.scanDirs ?? ['src']).map((d) => normalizeSlash(d).replace(/\/$/, '') + '/');
  return list.split(/\r?\n/).filter(Boolean)
    .map(normalizeSlash)
    .filter((f) => dirs.some((d) => f.startsWith(d)))
    .filter((f) => exts.has(path.extname(f).toLowerCase()))
    .filter((f) => !excludes.some((x) => f.includes(x)))
    .map((f) => path.join(root, f))
    .filter((f) => fs.existsSync(f));
}

// ---------------------------------------------------------------- 加载辅助

function loadRegisteredFonts(config, root) {
  const p = resolveFromRoot(root, config.designFile);
  if (!fs.existsSync(p)) return null; // 无 DESIGN.md 时跳过字体校验
  try {
    const fm = extractFrontMatter(fs.readFileSync(p, 'utf8'));
    if (!fm.hasFrontMatter) return null;
    const { data } = parseYamlSubset(fm.yaml);
    const fonts = new Set();
    for (const t of Object.values(data.typography ?? {})) {
      if (t && typeof t === 'object' && t.fontFamily) {
        String(t.fontFamily).split(',').forEach((f) => fonts.add(f.trim().replace(/^['"]|['"]$/g, '').toLowerCase()));
      }
    }
    return fonts.size ? fonts : null;
  } catch {
    return null;
  }
}

function loadAllowlist(config, root) {
  const p = resolveFromRoot(root, config.guard.allowlistFile);
  if (!fs.existsSync(p)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(p, 'utf8'));
    return Array.isArray(data.entries) ? data.entries : [];
  } catch (err) {
    process.stderr.write(`design-guard: 豁免清单解析失败（${p}）：${err.message}\n`);
    return [];
  }
}

// ---------------------------------------------------------------- 小工具

function argsAfter(line, from) {
  let depth = 1;
  let i = from;
  for (; i < line.length && depth > 0; i++) {
    if (line[i] === '(') depth++;
    else if (line[i] === ')') depth--;
  }
  return line.slice(from, i - 1);
}

function truncate(s, n) {
  return s.length > n ? s.slice(0, n) + '…' : s;
}

function normalizeSlash(p) {
  return String(p).split(path.sep).join('/').split('\\').join('/');
}

function rel(root, p) {
  return normalizeSlash(path.relative(root, p)) || p;
}
