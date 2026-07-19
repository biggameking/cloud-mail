#!/usr/bin/env node
import path from 'node:path';
import process from 'node:process';

import { refreshCursorRoutingCard } from './devrules-lib/cursor-routing-card.mjs';

function parseArgs(argv) {
  const options = { apply: false, repo: null, root: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--apply') options.apply = true;
    else if (arg === '--dry-run') options.apply = false;
    else if (arg === '--repo') options.repo = argv[++index];
    else if (arg === '--root') options.root = argv[++index];
  }
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const repos = [];
  if (options.repo) {
    repos.push(options.repo);
  } else if (options.root) {
    const root = path.resolve(options.root);
    const fs = await import('node:fs/promises');
    for (const entry of await fs.readdir(root, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
      repos.push(path.join(root, entry.name));
    }
  } else {
    console.error('Usage: node routing-card.mjs (--repo <dir> | --root <dir>) [--dry-run|--apply]');
    process.exitCode = 1;
    return;
  }

  let changed = 0;
  for (const repo of repos.sort()) {
    const result = await refreshCursorRoutingCard(repo, options.apply);
    if (result.status === 'skip' && options.root) continue;
    console.log(`${result.status.padEnd(13)} ${result.repo}${result.reason ? ` (${result.reason})` : ''}${result.card ? ` card=${result.card.length}B` : ''}`);
    if (result.status === 'updated' || result.status === 'would-update') changed += 1;
  }
  console.log(`${options.apply ? 'Applied' : 'Dry-run'}: ${changed} repo(s) ${options.apply ? 'updated' : 'would update'}.`);
}

main().catch((error) => {
  console.error(`routing-card: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
