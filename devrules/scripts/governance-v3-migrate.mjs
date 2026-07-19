#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

import {
  auditGovernanceMetadata,
  migrateGovernanceTree,
} from './devrules-lib/governance-metadata.mjs';
import {
  auditModelSupportMetadata,
  migrateLegacyModelDeclarations,
} from './devrules-lib/model-support.mjs';
import { normalizeHookRegistryMetadata } from './devrules-lib/hooks.mjs';

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[index + 1];
    if (next && !next.startsWith('--')) {
      options[key] = next;
      index += 1;
    } else {
      options[key] = true;
    }
  }
  return options;
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

const options = parseArgs(process.argv.slice(2));
const requestedRoot = path.resolve(String(options.repo || process.cwd()));
const devrulesRoot = await exists(path.join(requestedRoot, 'always-readme.md'))
  ? requestedRoot
  : path.join(requestedRoot, 'devrules');
const governance = await migrateGovernanceTree(devrulesRoot, { apply: options.apply === true });
const modelDeclarations = await migrateLegacyModelDeclarations(devrulesRoot, { apply: options.apply === true });
const hookActions = [];
const hooksPath = path.join(devrulesRoot, 'hooks', 'hooks.json');
if (await exists(hooksPath)) {
  const currentHooks = await fs.readFile(hooksPath, 'utf8');
  const normalizedHooks = normalizeHookRegistryMetadata(currentHooks);
  if (normalizedHooks && normalizedHooks !== currentHooks) {
    hookActions.push({ action: 'write', path: 'hooks/hooks.json', mode: options.apply === true ? 'apply' : 'dry-run' });
    if (options.apply === true) await fs.writeFile(hooksPath, normalizedHooks, 'utf8');
  }
}
const result = {
  apply: options.apply === true,
  actions: [...governance.actions, ...modelDeclarations.actions, ...hookActions]
    .filter((item, index, all) => all.findIndex((candidate) => candidate.path === item.path) === index),
};
const templateMode = await exists(path.join(devrulesRoot, 'template.json'));
const audit = options.apply === true
  ? await auditGovernanceMetadata(devrulesRoot, { templateMode })
  : null;
const modelAudit = options.apply === true
  ? await auditModelSupportMetadata(devrulesRoot, { templateMode })
  : null;
const payload = { schemaVersion: 3, devrulesRoot, ...result, audit, modelAudit };

if (options.json === true) {
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
} else {
  console.log(`Governance v3 migration: ${result.apply ? 'APPLY' : 'DRY-RUN'}`);
  console.log(`Root: ${devrulesRoot}`);
  console.log(`Planned writes: ${result.actions.length}`);
  if (!result.apply) console.log('Re-run with --apply after reviewing the plan.');
  if (audit) console.log(`Remaining findings: ${audit.findings.length}`);
}

if (audit?.issues?.length || modelAudit?.issues?.length) process.exitCode = 1;
