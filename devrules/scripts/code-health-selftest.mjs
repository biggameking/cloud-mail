#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE_ROOT = path.resolve(SCRIPT_DIR, '..');
const DEVRULES_SCRIPT = path.join(SCRIPT_DIR, 'devrules.mjs');
const CODE_HEALTH_SCRIPT = path.join(SCRIPT_DIR, 'code-health.mjs');

async function run(command, args, options = {}) {
  return execFileAsync(command, args, {
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
    windowsHide: true,
    ...options,
  });
}

async function main() {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'devrules-code-health-'));
  const repo = path.join(tempRoot, 'repo');
  try {
    await fs.mkdir(repo, { recursive: true });
    const templateEnvironment = {
      ...process.env,
      DEVRULES_TEMPLATE_ROOT: TEMPLATE_ROOT,
    };
    await run('git', ['init', '--quiet', repo]);
    await run('git', ['-C', repo, 'config', 'user.email', 'devrules-selftest@example.invalid']);
    await run('git', ['-C', repo, 'config', 'user.name', 'devrules selftest']);
    await fs.writeFile(path.join(repo, 'package.json'), '{"private":true}\n', 'utf8');
    await fs.writeFile(path.join(repo, 'index.js'), 'export const answer = 42;\n', 'utf8');
    await run('git', ['-C', repo, 'add', '.']);
    await run('git', ['-C', repo, 'commit', '--quiet', '-m', 'fixture']);

    await run(process.execPath, [DEVRULES_SCRIPT, 'init', '--repo', repo, '--maturity', '3', '--apply'], {
      env: templateEnvironment,
    });
    for (const relativePath of [
      'devrules/rules/code-quality.md',
      'devrules/rules/modularity-and-dependencies.md',
      'devrules/rules/change-health.md',
      'devrules/workflows/code-change.md',
      'devrules/profiles/typescript-javascript.md',
      'devrules/scripts/code-health.mjs',
      'devrules/scripts/devrules-lib/hooks.mjs',
    ]) {
      await fs.access(path.join(repo, relativePath));
    }
    await run('git', ['-C', repo, 'add', '.']);
    await run('git', ['-C', repo, 'commit', '--quiet', '-m', 'initialize devrules']);
    const projectAudit = await run(process.execPath, [DEVRULES_SCRIPT, 'audit', '--repo', repo, '--json'], {
      env: templateEnvironment,
    });
    const projectIssues = JSON.parse(projectAudit.stdout).issues;
    assert.equal(
      projectIssues.filter((issue) => issue.severity === 'error').length,
      0,
      'initialized project must pass the core devrules audit without errors',
    );

    const cleanAudit = await run(process.execPath, [CODE_HEALTH_SCRIPT, 'audit', '--repo', repo, '--json']);
    assert.equal(JSON.parse(cleanAudit.stdout).summary.status, 'pass');

    const largeFile = Array.from({ length: 801 }, (_, index) => `export const value${index} = ${index};`).join('\n') + '\n';
    await fs.writeFile(path.join(repo, 'oversized.js'), largeFile, 'utf8');
    const advisoryLarge = await run(process.execPath, [CODE_HEALTH_SCRIPT, 'audit', '--repo', repo, '--json']);
    const advisoryReport = JSON.parse(advisoryLarge.stdout);
    assert.ok(
      advisoryReport.issues.some((item) => item.rule === 'large-file-no-growth' && item.severity === 'warning'),
      'default size thresholds are review signals, not universal hard failures',
    );

    const configPath = path.join(repo, 'devrules', 'config.json');
    const config = JSON.parse(await fs.readFile(configPath, 'utf8'));
    config.codeHealth.mode = 'ratchet';
    await fs.writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);
    let largeFailure;
    try {
      await run(process.execPath, [CODE_HEALTH_SCRIPT, 'audit', '--repo', repo, '--json']);
    } catch (error) {
      largeFailure = error;
    }
    assert.ok(largeFailure, 'a project-selected ratchet may turn its configured threshold into a gate');
    const largeReport = JSON.parse(largeFailure.stdout);
    assert.ok(largeReport.issues.some((item) => item.rule === 'large-file-no-growth' && item.severity === 'error'));

    process.stdout.write('code-health selftest: PASS\n');
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  process.stderr.write(`code-health selftest: FAIL\n${error.stack ?? error.message}\n`);
  process.exitCode = 1;
});
