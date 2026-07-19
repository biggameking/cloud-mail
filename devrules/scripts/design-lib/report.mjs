// devrules 共享模块：统一的检查结果（finding）输出。
// finding 形状：{ severity: 'error'|'warn'|'info', rule, file?, line?, message, snippet? }
// 三个工具（lint/guard/sync --check）都用它输出，保证人读与 agent 读（--format json）口径一致。

const ANSI = {
  red: (s) => `\u001b[31m${s}\u001b[0m`,
  yellow: (s) => `\u001b[33m${s}\u001b[0m`,
  cyan: (s) => `\u001b[36m${s}\u001b[0m`,
  dim: (s) => `\u001b[2m${s}\u001b[0m`,
  bold: (s) => `\u001b[1m${s}\u001b[0m`,
};
const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (fn, s) => (useColor ? fn(s) : s);

function summarize(findings) {
  return {
    errors: findings.filter((f) => f.severity === 'error').length,
    warnings: findings.filter((f) => f.severity === 'warn').length,
    info: findings.filter((f) => f.severity === 'info').length,
  };
}

export function printFindings(findings, { format = 'pretty', tool = 'devrules' } = {}) {
  const summary = summarize(findings);
  if (format === 'json') {
    process.stdout.write(JSON.stringify({ tool, findings, summary }, null, 2) + '\n');
    return summary;
  }
  const order = { error: 0, warn: 1, info: 2 };
  const sorted = [...findings].sort(
    (a, b) => (order[a.severity] - order[b.severity]) || String(a.file).localeCompare(String(b.file)) || ((a.line ?? 0) - (b.line ?? 0)),
  );
  for (const f of sorted) {
    const sev =
      f.severity === 'error' ? paint(ANSI.red, 'ERROR') :
      f.severity === 'warn' ? paint(ANSI.yellow, 'WARN ') : paint(ANSI.cyan, 'INFO ');
    const loc = f.file ? `${f.file}${f.line ? ':' + f.line : ''}` : '';
    const rule = f.rule ? paint(ANSI.dim, `[${f.rule}]`) : '';
    process.stdout.write(`${sev} ${loc ? loc + '  ' : ''}${f.message} ${rule}\n`);
    if (f.snippet) process.stdout.write(paint(ANSI.dim, `      ${f.snippet.trim()}\n`));
  }
  process.stdout.write(
    `\n${paint(ANSI.bold, `[${tool}]`)} errors: ${summary.errors}  warnings: ${summary.warnings}  info: ${summary.info}\n`,
  );
  return summary;
}

/** 统一退出码：有 error -> 1；--strict 时 warn 也算失败。 */
export function exitCode(summary, { strict = false } = {}) {
  if (summary.errors > 0) return 1;
  if (strict && summary.warnings > 0) return 1;
  return 0;
}

/** 极简 flag 解析：--key value / --key / 位置参数。 */
export function parseArgs(argv, boolFlags = []) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      if (boolFlags.includes(key) || i + 1 >= argv.length || argv[i + 1].startsWith('--')) {
        flags[key] = true;
      } else {
        flags[key] = argv[++i];
      }
    } else {
      positional.push(a);
    }
  }
  return { flags, positional };
}
