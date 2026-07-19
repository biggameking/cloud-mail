#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

import { writeJson } from './devrules-lib/selftest-utils.mjs';

const execFileAsync = promisify(execFile);
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const CLI = path.join(SCRIPT_DIR, 'devrules.mjs');

async function run(args) {
  const { stdout } = await execFileAsync(process.execPath, [CLI, ...args], {
    cwd: SCRIPT_DIR,
    maxBuffer: 4 * 1024 * 1024,
  });
  return JSON.parse(stdout);
}

async function main() {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'devrules-cursor-entry-'));
  const repo = path.join(tempRoot, 'product');
  const cursorRule = path.join(repo, '.cursor', 'rules', 'devrules.mdc');
  try {
    await fs.mkdir(path.join(repo, '.git'), { recursive: true });
    await fs.mkdir(path.join(repo, 'src'), { recursive: true });
    await fs.mkdir(path.join(repo, 'devrules'), { recursive: true });
    await fs.writeFile(path.join(repo, 'src', 'index.js'), 'export {};\n', 'utf8');
    await fs.writeFile(path.join(repo, 'devrules', 'always-readme.md'), '# fixture\n', 'utf8');
    await writeJson(path.join(repo, 'devrules', 'config.json'), {
      entryFiles: { create: ['AGENTS.md', '.cursor/rules/devrules.mdc'], bindIfPresent: [] },
      sourceRoots: ['src'],
    });
    await writeJson(path.join(repo, 'devrules', 'hooks', 'hooks.json'), {
      schemaVersion: 1,
      hooks: [{ id: 'route-one', when: 'first route', workflows: ['first.md'], scope: 'universal' }],
    });

    const dryRun = await run(['repo', 'refresh-entries', '--repo', repo, '--json']);
    assert.equal(dryRun.apply, false);
    await assert.rejects(fs.access(cursorRule));
    await assert.rejects(fs.access(path.join(repo, 'AGENTS.md')));

    await run(['repo', 'refresh-entries', '--repo', repo, '--apply', '--json']);
    let content = await fs.readFile(cursorRule, 'utf8');
    assert.match(content, /alwaysApply:\s*true/);
    assert.match(content, /route-one/);
    assert.equal((content.match(/DEVRULES:ROUTING-START/g) || []).length, 1);

    content = content.replace('alwaysApply: true', 'alwaysApply: true\ncustomKey: preserved') + '\nHuman-maintained note.\n';
    await fs.writeFile(cursorRule, content, 'utf8');
    await writeJson(path.join(repo, 'devrules', 'hooks', 'hooks.json'), {
      schemaVersion: 1,
      hooks: [{ id: 'route-two', when: 'second route', workflows: ['second.md'], scope: 'universal' }],
    });
    const staleAudit = await run(['audit', '--repo', repo, '--json']);
    assert.equal(staleAudit.templateContent?.status, 'blocked', 'partial/non-Git fixtures must report a blocked preflight without suppressing adoption checks');
    assert(staleAudit.issues.some((issue) => issue.message.includes('routing card is stale')));

    await run(['repo', 'refresh-entries', '--repo', repo, '--apply', '--json']);
    const refreshed = await fs.readFile(cursorRule, 'utf8');
    assert.match(refreshed, /customKey: preserved/);
    assert.match(refreshed, /Human-maintained note/);
    assert.match(refreshed, /route-two/);
    assert.doesNotMatch(refreshed, /route-one/);
    assert.match(refreshed, /devrules is the authoritative shared engineering context/);
    assert.doesNotMatch(refreshed, /ensure-agent --apply --json/, 'project entry adapters must not duplicate devrules bootstrap rules');
    assert.doesNotMatch(refreshed, /Development must follow first principles/, 'project entry adapters must not duplicate devrules rule bodies');
    const idempotent = await run(['repo', 'refresh-entries', '--repo', repo, '--apply', '--json']);
    assert(idempotent.actions.every((action) => action.action === 'skip'));

    const safeConfig = {
      entryFiles: { create: ['AGENTS.md', '.cursor/rules/devrules.mdc'], bindIfPresent: [] },
      sourceRoots: ['src'],
    };
    const agentsPath = path.join(repo, 'AGENTS.md');
    const agentsBeforeUnsafeChecks = await fs.readFile(agentsPath, 'utf8');
    const outsideCanary = path.join(tempRoot, 'outside-canary.md');
    await fs.writeFile(outsideCanary, 'outside canary\n');
    await writeJson(path.join(repo, 'devrules', 'config.json'), {
      entryFiles: { create: ['AGENTS.md', '../outside-canary.md'], bindIfPresent: [] },
    });
    await assert.rejects(run(['repo', 'refresh-entries', '--repo', repo, '--apply', '--json']));
    assert.equal(await fs.readFile(outsideCanary, 'utf8'), 'outside canary\n');
    assert.equal(await fs.readFile(agentsPath, 'utf8'), agentsBeforeUnsafeChecks,
      'the complete entry set is validated before the first otherwise-valid entry is written');

    const gitCanary = path.join(repo, '.git', 'config');
    await fs.writeFile(gitCanary, 'git metadata canary\n');
    await writeJson(path.join(repo, 'devrules', 'config.json'), {
      entryFiles: { create: ['.git/config'], bindIfPresent: [] },
    });
    await assert.rejects(run(['repo', 'refresh-entries', '--repo', repo, '--apply', '--json']));
    assert.equal(await fs.readFile(gitCanary, 'utf8'), 'git metadata canary\n');

    const alwaysPath = path.join(repo, 'devrules', 'always-readme.md');
    const alwaysBefore = await fs.readFile(alwaysPath, 'utf8');
    await writeJson(path.join(repo, 'devrules', 'config.json'), {
      entryFiles: { create: ['devrules/always-readme.md'], bindIfPresent: [] },
    });
    await assert.rejects(run(['repo', 'refresh-entries', '--repo', repo, '--apply', '--json']));
    assert.equal(await fs.readFile(alwaysPath, 'utf8'), alwaysBefore);

    const outsideParent = path.join(tempRoot, 'outside-parent');
    await fs.mkdir(outsideParent);
    await fs.writeFile(path.join(outsideParent, 'canary.txt'), 'parent canary\n');
    await fs.symlink(outsideParent, path.join(repo, 'docs'));
    await writeJson(path.join(repo, 'devrules', 'config.json'), {
      entryFiles: { create: ['docs/AGENTS.md'], bindIfPresent: [] },
    });
    await assert.rejects(run(['repo', 'refresh-entries', '--repo', repo, '--apply', '--json']));
    await assert.rejects(fs.access(path.join(outsideParent, 'AGENTS.md')));
    assert.equal(await fs.readFile(path.join(outsideParent, 'canary.txt'), 'utf8'), 'parent canary\n');

    const outsideSecret = path.join(tempRoot, 'outside-secret.txt');
    const linkedEntry = path.join(repo, 'LINKED-AGENT.md');
    await fs.writeFile(outsideSecret, 'external secret must remain outside\n');
    await fs.symlink(outsideSecret, linkedEntry);
    await writeJson(path.join(repo, 'devrules', 'config.json'), {
      entryFiles: { create: ['LINKED-AGENT.md'], bindIfPresent: [] },
    });
    await assert.rejects(run(['repo', 'refresh-entries', '--repo', repo, '--apply', '--json']));
    assert.equal((await fs.lstat(linkedEntry)).isSymbolicLink(), true);
    assert.equal(await fs.readFile(outsideSecret, 'utf8'), 'external secret must remain outside\n');

    await writeJson(path.join(repo, 'devrules', 'config.json'), safeConfig);

    await fs.rm(cursorRule);
    const missingAudit = await run(['audit', '--repo', repo, '--json']);
    assert(missingAudit.issues.some((issue) => issue.severity === 'error' && issue.message.includes('is required but missing')));
    console.log('cursor entry selftest: PASS');
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
