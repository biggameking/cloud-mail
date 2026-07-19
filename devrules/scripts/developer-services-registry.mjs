#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { atomicWriteFile } from './devrules-lib/safe-files.mjs';
import { resolveRuntimeLocation } from './devrules-lib/runtime-location.mjs';
import {
  PROJECT_INVENTORY_RELATIVE_PATH,
  createDeveloperServicesInventory,
  filterDeveloperServicesCatalog,
  loadDeveloperServicesCatalog,
  renderDeveloperServicesCatalogMarkdown,
  writeDeveloperServicesCatalog,
} from './devrules-lib/developer-services-registry.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const RUNTIME_LOCATION = await resolveRuntimeLocation({ fallbackTemplateRoot: path.resolve(SCRIPT_DIR, '..') });
const TEMPLATE_ROOT = RUNTIME_LOCATION.templateRoot;

function usage() {
  return `Developer services registry

Usage:
  node devrules/scripts/developer-services-registry.mjs init [--project <dir>] [--apply] [--json]
  node devrules/scripts/developer-services-registry.mjs validate [--root <dir>] [--accounts <dir>] [--recursive] [--strict] [--json]
  node devrules/scripts/developer-services-registry.mjs inspect [--root <dir>] [--accounts <dir>] [--project <id>] [--provider <name>] [--account <ref>] [--recursive] [--json]
  node devrules/scripts/developer-services-registry.mjs catalog [--root <dir>] [--accounts <dir>] [--out <dir>] [--recursive] [--apply] [--json]

Rules:
  - Read-only by default. init/catalog write only with --apply.
  - Records contain non-secret identities and logical credential references only.
  - Multiple bindings to the same provider are valid when each target is unique.
  - Runtime/build/operator-selectable alternatives must share selection.group and use unique selectors.
`;
}

function parseArgs(argv) {
  const positionals = [];
  const options = {};
  const booleanOptions = new Set(['apply', 'help', 'json', 'recursive', 'strict']);
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith('--')) {
      positionals.push(arg);
      continue;
    }
    const body = arg.slice(2);
    const separator = body.indexOf('=');
    if (separator >= 0) {
      options[body.slice(0, separator)] = body.slice(separator + 1);
      continue;
    }
    if (booleanOptions.has(body)) {
      options[body] = true;
      continue;
    }
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`missing value for --${body}`);
    options[body] = value;
    index += 1;
  }
  return { positionals, options };
}

async function defaultAccountsDir(options) {
  if (options.accounts) return path.resolve(options.accounts);
  const workspaceRoot = path.resolve(options.root || process.cwd());
  const workspaceAccounts = path.join(workspaceRoot, 'devrules', 'registry', 'developer-account-records');
  if (await fs.access(workspaceAccounts).then(() => true).catch(() => false)) return workspaceAccounts;
  return path.join(TEMPLATE_ROOT, 'registry', 'developer-account-records');
}

function outputJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function printIssues(catalog) {
  const issues = [...catalog.validation.errors, ...catalog.validation.warnings];
  if (issues.length === 0) {
    process.stdout.write('developer services registry: valid\n');
    return;
  }
  for (const entry of issues) {
    process.stdout.write(`${entry.severity.toUpperCase()} ${entry.code} ${entry.file}${entry.field ? `:${entry.field}` : ''} — ${entry.message}\n`);
  }
}

function printCatalogSummary(catalog) {
  process.stdout.write([
    `Developer services: ${catalog.summary.projects} project(s), ${catalog.summary.accounts} account(s), ${catalog.summary.bindings} binding(s).`,
    `Validation: ${catalog.summary.errors} error(s), ${catalog.summary.warnings} warning(s).`,
  ].join('\n') + '\n');
  for (const project of catalog.projects) {
    process.stdout.write(`\n${project.project?.id || project.inventoryPath}\n`);
    for (const binding of project.serviceBindings || []) {
      const selector = binding.selection
        ? `; ${binding.selection.group}:${binding.selection.selector?.name}=${binding.selection.selector?.value}`
        : '';
      process.stdout.write(
        `  - ${binding.bindingId}: ${binding.provider} / ${binding.accountRef} / ${binding.environment} / ${binding.role}${selector} [${binding.status}]\n`,
      );
    }
  }
}

async function loadCatalog(options) {
  const root = path.resolve(options.root || process.cwd());
  return loadDeveloperServicesCatalog({
    root,
    accountsDir: await defaultAccountsDir(options),
    recursive: options.recursive === true,
  });
}

async function commandInit(options) {
  const projectRoot = path.resolve(options.project || process.cwd());
  const inventoryPath = path.join(projectRoot, PROJECT_INVENTORY_RELATIVE_PATH);
  const exists = await fs.access(inventoryPath).then(() => true).catch(() => false);
  if (exists) throw new Error(`inventory already exists: ${inventoryPath}`);
  const inventory = createDeveloperServicesInventory(projectRoot);
  const result = {
    action: options.apply ? 'created' : 'planned',
    apply: options.apply === true,
    inventoryPath,
    inventory,
  };
  if (options.apply) await atomicWriteFile(inventoryPath, `${JSON.stringify(inventory, null, 2)}\n`);
  if (options.json) outputJson(result);
  else process.stdout.write(`${options.apply ? 'Created' : 'Would create'} ${inventoryPath}\n`);
}

async function commandValidate(options) {
  const catalog = await loadCatalog(options);
  if (options.json) outputJson(catalog.validation);
  else {
    printCatalogSummary(catalog);
    printIssues(catalog);
  }
  if (!catalog.validation.valid || (options.strict && catalog.validation.warnings.length > 0)) process.exitCode = 1;
}

async function commandInspect(options) {
  const catalog = filterDeveloperServicesCatalog(await loadCatalog(options), {
    project: options.project,
    provider: options.provider,
    account: options.account,
  });
  if (options.json) outputJson(catalog);
  else printCatalogSummary(catalog);
  if (!catalog.validation.valid) process.exitCode = 1;
}

async function commandCatalog(options) {
  const root = path.resolve(options.root || process.cwd());
  const catalog = await loadCatalog({ ...options, root });
  const outDir = path.resolve(options.out || path.join(root, 'devrules', 'reports', 'developer-services'));
  const result = {
    action: options.apply ? 'written' : 'planned',
    apply: options.apply === true,
    outDir,
    summary: catalog.summary,
    validation: catalog.validation,
    files: {
      json: path.join(outDir, 'catalog.json'),
      markdown: path.join(outDir, 'catalog.md'),
    },
  };
  if (!catalog.validation.valid) {
    if (options.json) outputJson(result);
    else {
      printCatalogSummary(catalog);
      printIssues(catalog);
      process.stdout.write('Catalog not written because validation failed.\n');
    }
    process.exitCode = 1;
    return;
  }
  if (options.apply) await writeDeveloperServicesCatalog(catalog, outDir);
  if (options.json) outputJson(result);
  else {
    process.stdout.write(`${options.apply ? 'Wrote' : 'Would write'} ${result.files.json}\n`);
    process.stdout.write(`${options.apply ? 'Wrote' : 'Would write'} ${result.files.markdown}\n`);
    if (!options.apply) process.stdout.write('\nPreview:\n\n');
    if (!options.apply) process.stdout.write(renderDeveloperServicesCatalogMarkdown(catalog));
  }
}

export async function runDeveloperServicesCommand(command, options = {}) {
  if (command === 'init') await commandInit(options);
  else if (command === 'validate') await commandValidate(options);
  else if (command === 'inspect') await commandInspect(options);
  else if (command === 'catalog') await commandCatalog(options);
  else throw new Error(`unknown command: ${command}\n\n${usage()}`);
}

export async function main(argv = process.argv.slice(2)) {
  const { positionals, options } = parseArgs(argv);
  const command = positionals[0];
  if (options.help || !command) {
    process.stdout.write(usage());
    return;
  }
  if (positionals.length > 1) throw new Error(`unexpected positional arguments: ${positionals.slice(1).join(' ')}`);
  await runDeveloperServicesCommand(command, options);
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
const selfPath = path.resolve(fileURLToPath(import.meta.url));
if (invokedPath === selfPath) {
  main().catch((error) => {
    process.stderr.write(`developer services registry: ${error.message}\n`);
    process.exitCode = 1;
  });
}
