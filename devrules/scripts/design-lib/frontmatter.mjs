// devrules 共享模块：DESIGN.md front matter 解析。
// 实现 DESIGN.md 规范所需的 YAML 子集（嵌套 map + 标量），零依赖、离线可用：
//   - 缩进表示层级（空格；禁止 Tab）
//   - 值：带引号字符串 / 裸字符串 / 数字
//   - 注释：整行 # 与值后 " #"
//   - 不支持数组（DESIGN.md schema 不需要），遇到 "- " 直接报友好错误
// 另提供 token 扁平化与 {path.to.token} 引用解析。

/** 提取 front matter 与正文。返回 { yaml, body, hasFrontMatter, yamlStartLine }。 */
export function extractFrontMatter(text) {
  const lines = text.split(/\r?\n/);
  if (lines[0]?.trim() !== '---') {
    return { yaml: '', body: text, hasFrontMatter: false, yamlStartLine: 0 };
  }
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      return {
        yaml: lines.slice(1, i).join('\n'),
        body: lines.slice(i + 1).join('\n'),
        hasFrontMatter: true,
        yamlStartLine: 2, // 1-based：yaml 第一行在原文件中的行号
      };
    }
  }
  throw new Error('front matter 未闭合：文件以 --- 开头但找不到结束的 ---');
}

function unquote(raw) {
  const s = raw.trim();
  if (s.length >= 2 && ((s[0] === '"' && s.at(-1) === '"') || (s[0] === "'" && s.at(-1) === "'"))) {
    return { value: s.slice(1, -1), quoted: true };
  }
  return { value: s, quoted: false };
}

/** 去掉值尾部的行内注释（引号外的 " #"）。 */
function stripInlineComment(raw) {
  let inQuote = null;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (inQuote) {
      if (ch === inQuote) inQuote = null;
      continue;
    }
    if (ch === '"' || ch === "'") { inQuote = ch; continue; }
    if (ch === '#' && (i === 0 || raw[i - 1] === ' ' || raw[i - 1] === '\t')) {
      return raw.slice(0, i);
    }
  }
  return raw;
}

/**
 * 解析 YAML 子集。返回 { data, warnings: [{line, message}] }。
 * @param {string} yamlText
 * @param {number} lineOffset 原文件中的起始行号（用于报错定位）
 */
export function parseYamlSubset(yamlText, lineOffset = 0) {
  const data = {};
  const warnings = [];
  // 栈内元素：{ indent, node }
  const stack = [{ indent: -1, node: data }];
  let lastKeyEntry = null; // { indent, key, parent } 用于 "key:" 后代块

  const lines = yamlText.split(/\r?\n/);
  for (let idx = 0; idx < lines.length; idx++) {
    const lineNo = idx + lineOffset;
    const rawLine = lines[idx];
    if (!rawLine.trim() || rawLine.trim().startsWith('#')) continue;
    if (/^\s*\t/.test(rawLine)) {
      throw new Error(`第 ${lineNo} 行：缩进包含 Tab，请改用空格`);
    }
    const indent = rawLine.length - rawLine.trimStart().length;
    const content = stripInlineComment(rawLine.trim()).trim();
    if (!content) continue;
    if (content.startsWith('- ') || content === '-') {
      throw new Error(`第 ${lineNo} 行：DESIGN.md front matter 不支持数组（"- "）。请改用命名 key 的 map 结构`);
    }

    // 弹栈到当前层级
    while (stack.length > 1 && indent <= stack.at(-1).indent) stack.pop();

    // 若上一个 key 是 "key:"（开块）且当前行缩进更深，则把它物化为子 map 并入栈
    if (lastKeyEntry && indent > lastKeyEntry.indent) {
      const child = {};
      lastKeyEntry.parent[lastKeyEntry.key] = child;
      stack.push({ indent: lastKeyEntry.indent, node: child });
      lastKeyEntry = null;
      // 重新校正栈（当前行可能比新块更浅，不会发生，因为 indent > lastKeyEntry.indent）
    } else if (lastKeyEntry) {
      // "key:" 后面没有更深的内容 -> 空值
      lastKeyEntry.parent[lastKeyEntry.key] = null;
      warnings.push({ line: lineNo - 1, message: `key "${lastKeyEntry.key}" 没有值（空 map？）` });
      lastKeyEntry = null;
    }

    const colon = findKeyColon(content);
    if (colon === -1) {
      throw new Error(`第 ${lineNo} 行：无法解析（缺少 "key: value"）：${content}`);
    }
    const keyRaw = content.slice(0, colon);
    const { value: key } = unquote(keyRaw);
    const rest = content.slice(colon + 1).trim();
    const parent = stack.at(-1).node;

    if (rest === '') {
      lastKeyEntry = { indent, key, parent };
      continue;
    }
    if (rest.startsWith('#')) {
      // YAML 语义里这是注释、值为空 —— 但在 DESIGN.md 场景 99% 是忘了给 hex 加引号
      warnings.push({
        line: lineNo,
        message: `"${key}" 的值以 # 开头且未加引号，按 YAML 规则会被当作注释。若是 hex 颜色请写成 "${key}: \\"${rest}\\""`,
      });
      parent[key] = null;
      continue;
    }
    const { value, quoted } = unquote(rest);
    if (!quoted && /^-?\d+(\.\d+)?$/.test(value)) {
      parent[key] = Number(value);
    } else {
      parent[key] = value;
    }
  }
  if (lastKeyEntry) {
    lastKeyEntry.parent[lastKeyEntry.key] = null;
    warnings.push({ line: null, message: `key "${lastKeyEntry.key}" 没有值（空 map？）` });
  }
  return { data, warnings };
}

/** 找到 key 与 value 的分隔冒号（跳过引号内的冒号）。 */
function findKeyColon(content) {
  let inQuote = null;
  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    if (inQuote) {
      if (ch === inQuote) inQuote = null;
      continue;
    }
    if (ch === '"' || ch === "'") { inQuote = ch; continue; }
    if (ch === ':') {
      if (i + 1 >= content.length || content[i + 1] === ' ' || content[i + 1] === '\t') return i;
    }
  }
  return -1;
}

/** 按 "a.b.c" 取值。 */
export function getPath(obj, dotted) {
  let cur = obj;
  for (const part of dotted.split('.')) {
    if (cur === null || typeof cur !== 'object' || !(part in cur)) return undefined;
    cur = cur[part];
  }
  return cur;
}

/** 是否为 {path.to.token} 形式的整值引用。 */
export function isTokenRef(v) {
  return typeof v === 'string' && /^\{[A-Za-z0-9_.-]+\}$/.test(v.trim());
}

export function refPath(v) {
  return v.trim().slice(1, -1);
}

/**
 * 解析 token 引用（仅整值引用，符合 DESIGN.md 规范）。
 * 返回 { resolved, broken: [{at, ref}] }。resolved 为深拷贝，引用已替换为最终值（支持多级引用，带环检测）。
 */
export function resolveRefs(data) {
  const broken = [];
  const resolveValue = (v, at, seen) => {
    if (!isTokenRef(v)) return v;
    const p = refPath(v);
    if (seen.has(p)) {
      broken.push({ at, ref: v, reason: 'circular' });
      return v;
    }
    const target = getPath(data, p);
    if (target === undefined || target === null || typeof target === 'object' && !isCompositeAllowed(at)) {
      if (target === undefined || target === null) {
        broken.push({ at, ref: v });
        return v;
      }
    }
    if (typeof target === 'object' && target !== null) return target; // 组合值引用（components.typography 允许）
    return resolveValue(target, at, new Set([...seen, p]));
  };
  const walk = (node, prefix) => {
    if (node === null || typeof node !== 'object') return node;
    const out = Array.isArray(node) ? [] : {};
    for (const [k, v] of Object.entries(node)) {
      const at = prefix ? `${prefix}.${k}` : k;
      out[k] = (v !== null && typeof v === 'object') ? walk(v, at) : resolveValue(v, at, new Set());
    }
    return out;
  };
  const isCompositeAllowed = (at) => at.startsWith('components.');
  return { resolved: walk(data, ''), broken };
}

/** 提取正文中的 ## 章节（顺序 + 行号），供结构检查用。 */
export function extractSections(body, bodyStartLine = 1) {
  const sections = [];
  const lines = body.split(/\r?\n/);
  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
    if (inFence) continue;
    const m = /^##\s+(.+?)\s*$/.exec(line);
    if (m) sections.push({ title: m[1].trim(), line: bodyStartLine + i });
  }
  return sections;
}
