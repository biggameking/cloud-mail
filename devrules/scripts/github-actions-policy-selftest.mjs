#!/usr/bin/env node
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const CLI = path.join(SCRIPT_DIR, 'devrules.mjs');

async function run(command, args, options = {}) {
  const result = await execFileAsync(command, args, {
    cwd: options.cwd,
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
  });
  return result.stdout.trim();
}

async function write(filePath, content) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content);
}

async function main() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'devrules-github-actions-policy-'));
  try {
    await run('git', ['init', '-b', 'main', root]);
    await run('git', ['-C', root, 'config', 'user.name', 'devrules selftest']);
    await run('git', ['-C', root, 'config', 'user.email', 'devrules-selftest@example.invalid']);
    await write(path.join(root, 'README.md'), '# GitHub Actions policy fixture\n');
    await run('git', ['-C', root, 'add', 'README.md']);
    await run('git', ['-C', root, 'commit', '-m', 'initialize policy fixture']);

    await run(process.execPath, [CLI, 'init', '--repo', root, '--apply', '--json']);
    const configPath = path.join(root, 'devrules', 'config.json');
    const config = JSON.parse(await fs.readFile(configPath, 'utf8'));
    assert.equal(
      config.automation.githubActionsPolicy,
      'inherit',
      'new instances must preserve existing workflows without granting blanket approval',
    );
    assert.equal(
      Object.hasOwn(config.automation, 'allowGitHubActions'),
      false,
      'new instances must emit the v3 policy key instead of the legacy boolean',
    );
    assert.equal(
      await fs.access(path.join(root, '.github', 'workflows')).then(() => true).catch(() => false),
      false,
      'initialization must not install hosted workflows',
    );

    const workflowPath = path.join(root, '.github', 'workflows', 'ci.yml');
    await write(workflowPath, 'name: needs approval\non: [push]\njobs: {}\n');
    const blocked = JSON.parse(await run(process.execPath, [CLI, 'audit', '--repo', root, '--json']));
    assert.equal(
      blocked.issues.some((issue) => issue.severity === 'error' && issue.message.includes('Hosted CI approval is required')),
      true,
      'audit must reject a newly added hosted workflow without explicit approval',
    );

    await run('git', ['-C', root, 'add', '.github/workflows/ci.yml']);
    await run('git', ['-C', root, 'commit', '-m', 'adopt existing hosted workflow']);
    const inherited = JSON.parse(await run(process.execPath, [CLI, 'audit', '--repo', root, '--json']));
    assert.equal(
      inherited.issues.some((issue) => issue.message.includes('Hosted CI approval is required')),
      false,
      'inherit mode must preserve a clean committed workflow',
    );

    await write(workflowPath, 'name: needs approval\non: [push]\njobs: {}\n# documentation only\n');
    const documentationOnly = JSON.parse(await run(process.execPath, [CLI, 'audit', '--repo', root, '--json']));
    assert.equal(
      documentationOnly.issues.some((issue) => issue.message.includes('Hosted CI approval is required')),
      false,
      'comment-only workflow edits are not a material hosted CI change',
    );

    await write(workflowPath, 'name: materially changed\non: [push]\njobs: {}\n');
    const modified = JSON.parse(await run(process.execPath, [CLI, 'audit', '--repo', root, '--json']));
    assert.equal(
      modified.issues.some((issue) => issue.message.includes('Hosted CI approval is required')),
      true,
      'inherit mode must require approval for a material workflow modification',
    );

    config.automation.githubActionsPolicy = 'allow';
    await write(configPath, `${JSON.stringify(config, null, 2)}\n`);
    const approved = JSON.parse(await run(process.execPath, [CLI, 'audit', '--repo', root, '--json']));
    assert.equal(
      approved.issues.some((issue) => issue.message.includes('Hosted CI approval is required')),
      false,
      'a recorded user-approved allow must suppress the change-boundary error',
    );

    delete config.automation.githubActionsPolicy;
    config.automation.allowGitHubActions = true;
    await write(configPath, `${JSON.stringify(config, null, 2)}\n`);
    const legacyApproved = JSON.parse(await run(process.execPath, [CLI, 'audit', '--repo', root, '--json']));
    assert.equal(
      legacyApproved.issues.some((issue) => issue.message.includes('Hosted CI approval is required')),
      false,
      'legacy allowGitHubActions=true must continue to migrate to allow semantics',
    );

    config.automation.githubActionsPolicy = 'deny';
    await write(configPath, `${JSON.stringify(config, null, 2)}\n`);
    const denied = JSON.parse(await run(process.execPath, [CLI, 'audit', '--repo', root, '--json']));
    assert.equal(
      denied.issues.some((issue) => issue.severity === 'error' && issue.message.includes('explicitly denied')),
      true,
      'an explicit deny must block hosted workflows even when the legacy allow flag is true',
    );
    process.stdout.write('GitHub Actions policy selftest: PASS\n');
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}

main().catch((error) => {
  process.stderr.write(`GitHub Actions policy selftest: FAIL\n${error.stack || error.message}\n`);
  process.exitCode = 1;
});
