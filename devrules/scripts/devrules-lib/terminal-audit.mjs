import fs from 'node:fs/promises';
import path from 'node:path';
import { normalizeRel, readText } from './fs-actions.mjs';
import {
  SKIP_DIRS,
  findGitRepos,
  isGitRepo,
} from './repo-discovery.mjs';
import { README_ANCHOR_SKIP_DIRS } from './readme-anchors.mjs';

const TERMINAL_AUDIT_EXTENSIONS = new Set(['.js', '.cjs', '.mjs', '.ts', '.tsx', '.rs', '.ps1', '.cmd', '.bat', '.json']);
const TERMINAL_AUDIT_SKIP_FILES = new Set(['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lockb']);
const TERMINAL_AUDIT_SKIP_DIRS = new Set([
  ...SKIP_DIRS,
  ...README_ANCHOR_SKIP_DIRS,
  '.cursor',
  '.codegraph',
  '.devrules-backups',
  '.tmp',
  'tmp',
  'temp',
  '.worktrees',
  'docs',
  'documentation',
  'reference',
  'references',
  'release',
  'releases',
  'test',
  'tests',
  '__tests__',
  'fixtures',
  '__fixtures__',
  'snapshots',
  '__snapshots__',
]);

function terminalSeverityRank(severity) {
  return { high: 3, medium: 2, low: 1 }[severity] || 0;
}

function terminalLineWindow(lines, index, before = 3, after = 80) {
  return lines.slice(Math.max(0, index - before), Math.min(lines.length, index + after + 1)).join('\n');
}

function hasHiddenWindowsGuard(text) {
  return /\bwindowsHide\b|CREATE_NO_WINDOW|WINDOWS_CREATE_NO_WINDOW|hidden_command|windows_hidden|creation_flags\s*\(/.test(text);
}

function isNonWindowsProcessUtility(text) {
  return /cfg\s*\(\s*not\s*\(\s*target_os\s*=\s*"windows"\s*\)\s*\)|cfg!\s*\(\s*not\s*\(\s*target_os\s*=\s*"windows"\s*\)\s*\)|\b(?:Command::new|spawn|spawnSync|execFile|execFileSync)\s*\(\s*["'`](?:ps|lsof|ss|security|secret-tool|networksetup|which)["'`]/.test(text);
}

function isIntentionalVisibleAppLaunch(text) {
  return /\bCommand::new\(&(?:browser_path|executable_path|test_exe)\)/.test(text);
}

function addTerminalFinding(findings, severity, file, line, category, message, evidence) {
  findings.push({
    severity,
    file,
    line,
    category,
    message,
    evidence: evidence.trim().slice(0, 220),
  });
}

function auditTerminalFile(repoPath, filePath, content) {
  const rel = normalizeRel(path.relative(repoPath, filePath));
  const ext = path.extname(filePath).toLowerCase();
  const lines = content.split(/\r?\n/);
  const findings = [];
  const usesNodeChildProcess = /(?:from|require\()\s*["']node:child_process["']|(?:from|require\()\s*["']child_process["']|child_process/.test(content);

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const window = terminalLineWindow(lines, i);
    const lineNo = i + 1;

    if (ext === '.rs') {
      if (/CREATE_NEW_CONSOLE/.test(line)) {
        addTerminalFinding(findings, 'high', rel, lineNo, 'rust-explicit-new-console', 'Rust code explicitly requests a new Windows console.', line);
        continue;
      }
      if (/\b(?:tokio::process::Command|std::process::Command|Command)::new\(|\bCommand::new\(/.test(line) && !hasHiddenWindowsGuard(window) && !isNonWindowsProcessUtility(window) && !isIntentionalVisibleAppLaunch(window)) {
        const riskyProgram = /"(cmd|cmd\.exe|powershell|powershell\.exe|pwsh|pwsh\.exe|node|npm|npx|taskkill|where|wmic|ffmpeg|ffprobe|git|docker)"/i.test(line);
        addTerminalFinding(
          findings,
          riskyProgram ? 'high' : 'medium',
          rel,
          lineNo,
          'rust-command-without-hidden-guard',
          'Rust process spawn lacks a nearby Windows CREATE_NO_WINDOW/hidden-command guard.',
          line,
        );
      }
      continue;
    }

    if (['.js', '.cjs', '.mjs', '.ts', '.tsx'].includes(ext)) {
      if (/\b(shell\s*:\s*true|detached\s*:\s*true)\b/.test(line) && !hasHiddenWindowsGuard(window)) {
        addTerminalFinding(findings, 'high', rel, lineNo, 'node-shell-or-detached-without-window-hide', 'Node child process uses shell/detached mode without windowsHide: true nearby.', line);
      }
      const hasChildProcessCall = usesNodeChildProcess && (
        /\b(?:spawn|spawnSync|execFile|execFileSync|execSync)\s*\(/.test(line)
        || /(^|[^\.\w])exec\s*\(/.test(line)
      );
      if (hasChildProcessCall && !hasHiddenWindowsGuard(window) && !isNonWindowsProcessUtility(window)) {
        const riskyProgram = /["'`](cmd|cmd\.exe|powershell|powershell\.exe|pwsh|pwsh\.exe|npm|npx|pnpm|yarn|bun|vite|tauri|cargo|taskkill)["'`]/i.test(window);
        addTerminalFinding(
          findings,
          riskyProgram ? 'high' : 'medium',
          rel,
          lineNo,
          'node-child-process-without-window-hide',
          'Node child_process call lacks windowsHide: true nearby.',
          line,
        );
      }
      continue;
    }

    if (ext === '.ps1') {
      const intentionallyVisibleShellOpen = /\bStart-Process\b/i.test(line)
        && /\b(explorer(?:\.exe)?|open)\b/i.test(line);
      if (/\bStart-Process\b/i.test(line) && !intentionallyVisibleShellOpen && !/-WindowStyle\s+Hidden/i.test(window)) {
        addTerminalFinding(findings, 'high', rel, lineNo, 'powershell-start-process-visible', 'PowerShell Start-Process lacks -WindowStyle Hidden.', line);
      }
      continue;
    }

    if (['.cmd', '.bat'].includes(ext)) {
      const trimmedBatchLine = line.trim();
      if (/^(?:rem\b|::)/i.test(trimmedBatchLine)) {
        continue;
      }
      if (/\b(start|cmd|powershell|pwsh)\b/i.test(line)) {
        addTerminalFinding(findings, 'low', rel, lineNo, 'batch-shell-launch', 'Batch file launches another shell or process; verify it is intentionally visible.', line);
      }
      continue;
    }

    if (ext === '.json' && path.basename(filePath) === 'package.json') {
      if (/"(?:dev|start|serve|preview|desktop|tauri)[^"]*"\s*:\s*"[^"]*(cmd|powershell|pwsh|start\s+|tauri dev|node scripts|npm run|npx)/i.test(line)) {
        addTerminalFinding(findings, 'low', rel, lineNo, 'package-script-launches-dev-process', 'Package script launches a dev process; ensure wrappers use hidden child-process options when run from GUI apps.', line);
      }
    }
  }

  return findings;
}

async function collectTerminalAuditFiles(dirPath, repoPath, files = []) {
  let entries;
  try {
    entries = await fs.readdir(dirPath, { withFileTypes: true });
  } catch {
    return files;
  }

  for (const entry of entries) {
    if (entry.name.toLowerCase() === 'nul') continue;
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      if (TERMINAL_AUDIT_SKIP_DIRS.has(entry.name)) continue;
      await collectTerminalAuditFiles(fullPath, repoPath, files);
      continue;
    }
    if (!entry.isFile()) continue;
    if (TERMINAL_AUDIT_SKIP_FILES.has(entry.name)) continue;
    const ext = path.extname(entry.name).toLowerCase();
    if (!TERMINAL_AUDIT_EXTENSIONS.has(ext)) continue;
    if (ext === '.json' && entry.name !== 'package.json') continue;
    files.push(fullPath);
  }
  return files;
}

async function auditRepoTerminalSpawns(repoPath) {
  const files = await collectTerminalAuditFiles(repoPath, repoPath);
  const findings = [];
  for (const file of files) {
    let stat;
    try {
      stat = await fs.stat(file);
    } catch {
      continue;
    }
    if (stat.size > 1_500_000) continue;
    const content = await readText(file);
    findings.push(...auditTerminalFile(repoPath, file, content));
  }
  findings.sort((a, b) => terminalSeverityRank(b.severity) - terminalSeverityRank(a.severity) || a.file.localeCompare(b.file) || a.line - b.line);
  return {
    repo: repoPath,
    name: path.basename(repoPath),
    findings,
    summary: {
      high: findings.filter((item) => item.severity === 'high').length,
      medium: findings.filter((item) => item.severity === 'medium').length,
      low: findings.filter((item) => item.severity === 'low').length,
      total: findings.length,
    },
  };
}

export async function commandTerminalAudit(options, context) {
  const repos = [];
  if (options.repo) {
    repos.push(path.resolve(String(options.repo)));
  } else {
    const root = path.resolve(String(options.root || '..'));
    repos.push(...(await findGitRepos(root, options.recursive === true)));
  }

  const results = [];
  for (const repo of repos) {
    if (!(await isGitRepo(repo))) {
      results.push({ repo, name: path.basename(repo), error: 'not a git repository', findings: [], summary: { high: 0, medium: 0, low: 0, total: 0 } });
      continue;
    }
    results.push(await auditRepoTerminalSpawns(repo));
  }

  const totals = results.reduce((acc, item) => {
    acc.high += item.summary.high;
    acc.medium += item.summary.medium;
    acc.low += item.summary.low;
    acc.total += item.summary.total;
    return acc;
  }, { high: 0, medium: 0, low: 0, total: 0 });

  context.output({ count: results.length, totals, results }, options, (data) => {
    console.log(`Terminal spawn audit for ${data.count} repositories.`);
    console.log(`Findings: high ${data.totals.high}, medium ${data.totals.medium}, low ${data.totals.low}, total ${data.totals.total}`);
    for (const result of data.results.filter((item) => item.summary.total > 0).sort((a, b) => b.summary.high - a.summary.high || b.summary.medium - a.summary.medium || a.name.localeCompare(b.name)).slice(0, 20)) {
      console.log(`- ${result.name}: high ${result.summary.high}, medium ${result.summary.medium}, low ${result.summary.low}`);
      for (const finding of result.findings.slice(0, 5)) {
        console.log(`  ${finding.severity}: ${finding.file}:${finding.line} ${finding.category}`);
      }
    }
  });
}
