import fs from 'node:fs/promises';
import path from 'node:path';

import { atomicWriteFile, withFileLock } from './safe-files.mjs';
import { pathExists, readJson } from './fs-actions.mjs';
import {
  validateCrossProjectResources,
  validateDeveloperServiceAccount,
  validateDeveloperServicesProject,
} from './developer-services-validation.mjs';

export const PROJECT_INVENTORY_RELATIVE_PATH = path.join(
  'devrules',
  'memory',
  'developer-services-inventory.json',
);

const SKIP_DIRECTORIES = new Set([
  '.build',
  '.git',
  '.gradle',
  '.next',
  '.venv',
  'build',
  'deriveddata',
  'dist',
  'node_modules',
  'out',
  'target',
  'vendor',
]);

function normalizePath(value) {
  return String(value || '').replace(/\\/g, '/');
}

function relativeFrom(root, target) {
  const relative = path.relative(root, target);
  return normalizePath(relative || '.');
}

function sortBy(items, selector) {
  return [...items].sort((left, right) => String(selector(left)).localeCompare(String(selector(right))));
}

async function discoverDeveloperServicesInventories(root, options = {}) {
  const workspaceRoot = path.resolve(root);
  const recursive = options.recursive === true;
  const maxDepth = Number.isInteger(options.maxDepth) ? options.maxDepth : 3;
  const paths = new Set();
  const visited = new Set();

  async function inspectDirectory(directory, depth) {
    const realDirectory = await fs.realpath(directory).catch(() => directory);
    if (visited.has(realDirectory)) return;
    visited.add(realDirectory);

    const inventoryPath = path.join(directory, PROJECT_INVENTORY_RELATIVE_PATH);
    if (await pathExists(inventoryPath)) paths.add(path.resolve(inventoryPath));
    if (depth >= maxDepth || (depth > 0 && !recursive)) return;

    const entries = await fs.readdir(directory, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (!entry.isDirectory() || SKIP_DIRECTORIES.has(entry.name) || entry.name === 'devrules') continue;
      await inspectDirectory(path.join(directory, entry.name), depth + 1);
    }
  }

  await inspectDirectory(workspaceRoot, 0);
  return sortBy(paths, (item) => item);
}

export async function loadDeveloperServiceAccounts(accountsDir) {
  const directory = path.resolve(accountsDir);
  const entries = await fs.readdir(directory, { withFileTypes: true }).catch((error) => {
    if (error?.code === 'ENOENT') return [];
    throw error;
  });
  const accounts = [];
  const errors = [];
  const warnings = [];
  const accountsByRef = new Map();

  for (const entry of sortBy(entries.filter((item) => item.isFile() && item.name.endsWith('.json')), (item) => item.name)) {
    const filePath = path.join(directory, entry.name);
    let record;
    try {
      record = await readJson(filePath);
    } catch (error) {
      errors.push({
        severity: 'error',
        code: 'ACCOUNT_JSON_INVALID',
        file: filePath,
        field: '',
        message: error.message,
      });
      continue;
    }
    const validation = validateDeveloperServiceAccount(record, { filePath });
    errors.push(...validation.errors);
    warnings.push(...validation.warnings);
    if (record?.accountRef && accountsByRef.has(record.accountRef)) {
      errors.push({
        severity: 'error',
        code: 'DUPLICATE_ACCOUNT_REF',
        file: filePath,
        field: 'accountRef',
        message: `accountRef ${record.accountRef} is already declared by ${accountsByRef.get(record.accountRef).filePath}`,
      });
    } else if (record?.accountRef) {
      accountsByRef.set(record.accountRef, { filePath, record });
    }
    accounts.push({ filePath, record, validation });
  }

  return { directory, accounts, accountsByRef, errors, warnings };
}

function buildAccountRelationships(accounts, projects) {
  const relationships = new Map(accounts.map((account) => [account.record.accountRef, {
    accountRef: account.record.accountRef,
    provider: account.record.provider,
    projects: new Set(),
    bindings: [],
  }]));
  for (const project of projects) {
    const projectId = project.record?.project?.id || '';
    for (const binding of project.record?.serviceBindings || []) {
      if (!relationships.has(binding.accountRef)) {
        relationships.set(binding.accountRef, {
          accountRef: binding.accountRef,
          provider: binding.provider,
          projects: new Set(),
          bindings: [],
        });
      }
      const relationship = relationships.get(binding.accountRef);
      relationship.projects.add(projectId);
      relationship.bindings.push({
        projectId,
        bindingId: binding.bindingId,
        environment: binding.environment,
        role: binding.role,
        status: binding.status,
      });
    }
  }
  return sortBy([...relationships.values()].map((relationship) => ({
    ...relationship,
    projects: [...relationship.projects].sort(),
    bindings: sortBy(relationship.bindings, (item) => `${item.projectId}:${item.bindingId}`),
  })), (item) => item.accountRef);
}

function buildSelectionGroups(projects) {
  const groups = [];
  for (const project of projects) {
    const projectId = project.record?.project?.id || '';
    const byGroup = new Map();
    for (const binding of project.record?.serviceBindings || []) {
      if (!binding?.selection?.group || binding.status === 'retired') continue;
      if (!byGroup.has(binding.selection.group)) byGroup.set(binding.selection.group, []);
      byGroup.get(binding.selection.group).push({
        bindingId: binding.bindingId,
        provider: binding.provider,
        accountRef: binding.accountRef,
        environment: binding.environment,
        selector: binding.selection.selector,
        default: binding.selection.default === true,
        dataRelationship: binding.selection.dataRelationship,
        dataAuthority: binding.dataAuthority?.mode || '',
      });
    }
    for (const [group, bindings] of byGroup) {
      groups.push({
        projectId,
        group,
        bindings: sortBy(bindings, (item) => item.bindingId),
      });
    }
  }
  return sortBy(groups, (item) => `${item.projectId}:${item.group}`);
}

function buildResourceRelationships(projects) {
  const resources = new Map();
  for (const project of projects) {
    const projectId = project.record?.project?.id || '';
    for (const binding of project.record?.serviceBindings || []) {
      for (const resource of binding.resources || []) {
        if (!resource?.resourceRef) continue;
        if (!resources.has(resource.resourceRef)) {
          resources.set(resource.resourceRef, {
            resourceRef: resource.resourceRef,
            provider: binding.provider,
            accountRef: binding.accountRef,
            type: resource.type,
            identity: resource.id || `@${resource.idSourceRef || ''}`,
            consumers: [],
          });
        }
        resources.get(resource.resourceRef).consumers.push({
          projectId,
          bindingId: binding.bindingId,
          environment: binding.environment,
        });
      }
    }
  }
  return sortBy([...resources.values()].map((resource) => ({
    ...resource,
    consumers: sortBy(resource.consumers, (item) => `${item.projectId}:${item.bindingId}`),
  })), (item) => item.resourceRef);
}

export async function loadDeveloperServicesCatalog(options) {
  const root = path.resolve(options.root);
  const accountsDir = path.resolve(options.accountsDir);
  const accountState = await loadDeveloperServiceAccounts(accountsDir);
  const inventoryPaths = await discoverDeveloperServicesInventories(root, {
    recursive: options.recursive === true,
    maxDepth: options.maxDepth,
  });
  const projects = [];
  const errors = [...accountState.errors];
  const warnings = [...accountState.warnings];
  const seenProjectIds = new Map();

  const accountRecords = new Map([...accountState.accountsByRef].map(([accountRef, value]) => [
    accountRef,
    value.record,
  ]));

  for (const filePath of inventoryPaths) {
    let record;
    try {
      record = await readJson(filePath);
    } catch (error) {
      errors.push({
        severity: 'error',
        code: 'PROJECT_JSON_INVALID',
        file: filePath,
        field: '',
        message: error.message,
      });
      continue;
    }
    const validation = validateDeveloperServicesProject(record, {
      filePath,
      accountsByRef: accountRecords,
    });
    errors.push(...validation.errors);
    warnings.push(...validation.warnings);
    const projectId = record?.project?.id;
    if (projectId && seenProjectIds.has(projectId)) {
      errors.push({
        severity: 'error',
        code: 'DUPLICATE_PROJECT_ID',
        file: filePath,
        field: 'project.id',
        message: `project.id ${projectId} is already declared by ${seenProjectIds.get(projectId)}`,
      });
    } else if (projectId) {
      seenProjectIds.set(projectId, filePath);
    }
    projects.push({
      filePath,
      projectRoot: path.resolve(path.dirname(filePath), '..', '..'),
      record,
      validation,
    });
  }

  const resourceValidation = validateCrossProjectResources(projects);
  errors.push(...resourceValidation.errors);
  warnings.push(...resourceValidation.warnings);

  const normalizedAccounts = sortBy(accountState.accounts.map((account) => ({
    recordPath: relativeFrom(root, account.filePath),
    ...account.record,
  })), (account) => account.accountRef);
  const normalizedProjects = sortBy(projects.map((project) => ({
    inventoryPath: relativeFrom(root, project.filePath),
    projectRoot: relativeFrom(root, project.projectRoot),
    ...project.record,
  })), (project) => project.project?.id || project.inventoryPath);
  const normalizedProjectState = normalizedProjects.map((record) => ({ record }));

  const catalog = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    workspaceRoot: '.',
    accountDirectory: relativeFrom(root, accountsDir),
    summary: {
      accounts: normalizedAccounts.length,
      projects: normalizedProjects.length,
      bindings: normalizedProjects.reduce((total, project) => total + (project.serviceBindings?.length || 0), 0),
      selectionGroups: buildSelectionGroups(normalizedProjectState).length,
      resources: buildResourceRelationships(normalizedProjectState).length,
      errors: errors.length,
      warnings: warnings.length,
    },
    accounts: normalizedAccounts,
    projects: normalizedProjects,
    relationships: {
      accounts: buildAccountRelationships(accountState.accounts, projects),
      selectionGroups: buildSelectionGroups(normalizedProjectState),
      resources: buildResourceRelationships(normalizedProjectState),
    },
    validation: {
      valid: errors.length === 0,
      errors: errors.map((entry) => ({ ...entry, file: relativeFrom(root, entry.file) })),
      warnings: warnings.map((entry) => ({ ...entry, file: relativeFrom(root, entry.file) })),
    },
  };

  return catalog;
}

export function filterDeveloperServicesCatalog(catalog, filters = {}) {
  const projectFilter = String(filters.project || '').toLowerCase();
  const providerFilter = String(filters.provider || '').toLowerCase();
  const accountFilter = String(filters.account || '').toLowerCase();
  const projects = [];

  for (const project of catalog.projects) {
    const projectMatches = !projectFilter
      || project.project?.id?.toLowerCase() === projectFilter
      || project.project?.repository?.toLowerCase() === projectFilter;
    if (!projectMatches) continue;
    const serviceBindings = (project.serviceBindings || []).filter((binding) => {
      if (providerFilter && binding.provider?.toLowerCase() !== providerFilter) return false;
      if (accountFilter && binding.accountRef?.toLowerCase() !== accountFilter) return false;
      return true;
    });
    if ((providerFilter || accountFilter) && serviceBindings.length === 0) continue;
    projects.push({ ...project, serviceBindings });
  }

  const referencedAccounts = new Set(projects.flatMap((project) => project.serviceBindings.map((binding) => binding.accountRef)));
  const accounts = catalog.accounts.filter((account) => {
    if (accountFilter && account.accountRef?.toLowerCase() !== accountFilter) return false;
    if (providerFilter && account.provider?.toLowerCase() !== providerFilter) return false;
    if (accountFilter) return true;
    if (projectFilter) return referencedAccounts.has(account.accountRef);
    return true;
  });

  return {
    ...catalog,
    accounts,
    projects,
    summary: {
      ...catalog.summary,
      accounts: accounts.length,
      projects: projects.length,
      bindings: projects.reduce((total, project) => total + project.serviceBindings.length, 0),
    },
  };
}

function markdownCell(value) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

export function renderDeveloperServicesCatalogMarkdown(catalog) {
  const lines = [
    '# Developer Services Catalog',
    '',
    '> Generated from project-local inventories and global non-secret account records. Do not edit this report manually.',
    '',
    `Generated: ${catalog.generatedAt}`,
    '',
    `Accounts: ${catalog.summary.accounts}; projects: ${catalog.summary.projects}; bindings: ${catalog.summary.bindings}; selectable groups: ${catalog.summary.selectionGroups}; errors: ${catalog.summary.errors}; warnings: ${catalog.summary.warnings}.`,
    '',
    '## Project bindings',
    '',
    '| Project | Binding | Provider | Account | Environment | Role | Target | Selection | Status |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
  ];
  for (const project of catalog.projects) {
    for (const binding of project.serviceBindings || []) {
      const target = [binding.target?.kind, binding.target?.name].filter(Boolean).join(': ');
      const selection = binding.selection
        ? `${binding.selection.group} (${binding.selection.selector?.name}=${binding.selection.selector?.value})`
        : 'fixed';
      lines.push(`| ${[
        project.project?.id,
        binding.bindingId,
        binding.provider,
        binding.accountRef,
        binding.environment,
        binding.role,
        target,
        selection,
        binding.status,
      ].map(markdownCell).join(' | ')} |`);
    }
  }
  if (catalog.projects.every((project) => (project.serviceBindings || []).length === 0)) {
    lines.push('| — | — | — | — | — | — | — | — | — |');
  }

  lines.push('', '## Selectable service groups', '');
  for (const group of catalog.relationships.selectionGroups) {
    lines.push(`### ${group.projectId} / ${group.group}`, '');
    lines.push('| Binding | Provider | Account | Environment | Selector | Data relationship | Authority | Default |');
    lines.push('| --- | --- | --- | --- | --- | --- | --- | --- |');
    for (const binding of group.bindings) {
      const selector = `${binding.selector?.name || ''}=${binding.selector?.value || ''}`;
      lines.push(`| ${[
        binding.bindingId,
        binding.provider,
        binding.accountRef,
        binding.environment,
        selector,
        binding.dataRelationship,
        binding.dataAuthority,
        binding.default ? 'yes' : 'no',
      ].map(markdownCell).join(' | ')} |`);
    }
    lines.push('');
  }
  if (catalog.relationships.selectionGroups.length === 0) lines.push('None.', '');

  lines.push('## Validation', '');
  for (const entry of [...catalog.validation.errors, ...catalog.validation.warnings]) {
    lines.push(`- **${entry.severity.toUpperCase()} ${entry.code}** — ${entry.file}${entry.field ? `:${entry.field}` : ''}: ${entry.message}`);
  }
  if (catalog.validation.errors.length + catalog.validation.warnings.length === 0) lines.push('- Valid; no issues found.');
  lines.push('');
  return `${lines.join('\n')}\n`;
}

export async function writeDeveloperServicesCatalog(catalog, outDir) {
  if (!catalog.validation.valid) {
    throw new Error(`catalog has ${catalog.validation.errors.length} validation error(s); refusing to write`);
  }
  const directory = path.resolve(outDir);
  const jsonPath = path.join(directory, 'catalog.json');
  const markdownPath = path.join(directory, 'catalog.md');
  const lockPath = path.join(directory, '.catalog.lock');
  await withFileLock(lockPath, async () => {
    await atomicWriteFile(jsonPath, `${JSON.stringify(catalog, null, 2)}\n`);
    await atomicWriteFile(markdownPath, renderDeveloperServicesCatalogMarkdown(catalog));
  });
  return { jsonPath, markdownPath };
}

export function createDeveloperServicesInventory(projectRoot) {
  const repository = path.basename(path.resolve(projectRoot));
  const projectId = repository.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'project';
  return {
    schemaVersion: 1,
    recordType: 'developer-services-project',
    project: {
      id: projectId,
      repository,
      displayName: repository,
      status: 'draft',
    },
    serviceBindings: [],
    lastReviewed: null,
  };
}
