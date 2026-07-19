// devrules 设计子系统共享模块：配置加载。
// 查找顺序：<root>/design.config.json -> <root>/devrules/design.config.json -> 内置默认值。
// 所有 design-* 脚本共用本模块，保证路径与规则口径一致。
import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_CONFIG = {
  designFile: 'DESIGN.md',
  changelogFile: 'DESIGN-CHANGELOG.md',
  output: {
    cssVariables: 'src/styles/design-tokens.css',
    tailwindFragment: 'src/styles/tailwind.design.json',
    dtcgTokens: 'src/styles/design-tokens.json',
    stampFile: 'src/styles/.design-stamp.json',
  },
  guard: {
    scanDirs: ['src'],
    extensions: ['.tsx', '.ts', '.jsx', '.js', '.css', '.html', '.vue', '.svelte'],
    exclude: [
      'node_modules', 'dist', 'build', '.next', 'coverage',
      'src/styles/design-tokens.css',
      'src/styles/design-tokens.json',
      'src/styles/tailwind.design.json',
      '.test.', '.spec.', '.stories.',
    ],
    allowlistFile: 'devrules/design-guard.allow.json',
    rules: {
      'no-hex-color': 'error',
      'no-color-fn-literal': 'error',
      'no-tailwind-arbitrary-color': 'error',
      'no-tailwind-arbitrary-value': 'warn',
      'no-inline-style-literal': 'error',
      'no-unregistered-font': 'warn',
      'no-magic-px-in-css': 'warn',
      'no-placeholder-copy': 'error',
    },
    cssPxThreshold: 4,
    // 占位/模板化文案黑名单（大小写不敏感子串匹配）：界面文案必须是真实产品语言
    copyBannedPatterns: [
      'lorem ipsum', 'placeholder text', 'click here', 'coming soon',
      '占位文案', '占位符', '示例文本', '示例文案', '此处显示', '点击这里',
      '强大的', '一站式', '无缝', '无缝集成', '重新定义', '开启您的', '之旅',
    ],
  },
  lint: {
    requiredComponents: [
      'button-primary', 'button-secondary', 'button-ghost', 'button-destructive',
      'input-field', 'card', 'dialog', 'badge',
    ],
    requiredSections: ['Overview', 'Colors', 'Typography', 'Components', "Do's and Don'ts"],
  },
};

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function deepMerge(base, override) {
  if (!isPlainObject(base) || !isPlainObject(override)) {
    return override === undefined ? base : override;
  }
  const out = { ...base };
  for (const [k, v] of Object.entries(override)) {
    if (k === '$comment') continue;
    out[k] = isPlainObject(v) && isPlainObject(base[k]) ? deepMerge(base[k], v) : v;
  }
  return out;
}

function stripComments(obj) {
  if (Array.isArray(obj)) return obj.map(stripComments);
  if (!isPlainObject(obj)) return obj;
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (k === '$comment') continue;
    out[k] = stripComments(v);
  }
  return out;
}

/** 从 startDir 向上寻找仓库根（含 .git 或 design.config.json 或 devrules/ 的目录）。找不到则返回 startDir。 */
function findRepoRoot(startDir = process.cwd()) {
  let dir = path.resolve(startDir);
  for (;;) {
    if (
      fs.existsSync(path.join(dir, '.git')) ||
      fs.existsSync(path.join(dir, 'design.config.json')) ||
      fs.existsSync(path.join(dir, 'devrules', 'design.config.json'))
    ) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) return path.resolve(startDir);
    dir = parent;
  }
}

/** 加载配置：内置默认值 <- 项目配置文件 <- 调用方 overrides。返回 { config, root, configPath }。 */
export function loadConfig({ cwd = process.cwd(), overrides = {} } = {}) {
  const root = findRepoRoot(cwd);
  const candidates = [
    path.join(root, 'design.config.json'),
    path.join(root, 'devrules', 'design.config.json'),
  ];
  let fileConfig = {};
  let configPath = null;
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      try {
        fileConfig = stripComments(JSON.parse(fs.readFileSync(p, 'utf8')));
        configPath = p;
        break;
      } catch (err) {
        throw new Error(`devrules 配置文件 JSON 解析失败: ${p}\n${err.message}`);
      }
    }
  }
  const config = deepMerge(deepMerge(DEFAULT_CONFIG, fileConfig), stripComments(overrides));
  return { config, root, configPath };
}

/** 相对路径一律相对仓库根解析。 */
export function resolveFromRoot(root, p) {
  return path.isAbsolute(p) ? p : path.join(root, p);
}
