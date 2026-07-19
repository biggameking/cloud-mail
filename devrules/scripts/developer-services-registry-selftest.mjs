#!/usr/bin/env node
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import {
  filterDeveloperServicesCatalog,
  loadDeveloperServicesCatalog,
  writeDeveloperServicesCatalog,
} from './devrules-lib/developer-services-registry.mjs';
import {
  scanForSecretMaterial,
  validateDeveloperServicesProject,
} from './devrules-lib/developer-services-validation.mjs';
import { writeJson } from './devrules-lib/selftest-utils.mjs';

const execFileAsync = promisify(execFile);
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE_ROOT = path.resolve(SCRIPT_DIR, '..');
const CLI = path.join(SCRIPT_DIR, 'developer-services-registry.mjs');
const MAIN_CLI = path.join(SCRIPT_DIR, 'devrules.mjs');

function automationProfile(accountRef, provider) {
  return {
    profileId: `${accountRef}:mcp-readonly`,
    method: 'mcp-oauth',
    toolName: provider,
    endpoint: provider === 'supabase' ? 'https://mcp.supabase.com/mcp' : 'https://mcp.cloudflare.com/mcp',
    credentialRef: `Test credential profile: ${accountRef}`,
    defaultMode: 'read-only',
    writesRequireExplicitApproval: true,
    expectedIdentity: { landmark: `${accountRef}-identity` },
    status: 'verified',
    lastVerified: '2026-07-14T00:00:00.000Z',
  };
}

function account(accountRef) {
  const provider = accountRef.split(':')[0];
  return {
    schemaVersion: 1,
    recordType: 'developer-service-account',
    accountRef,
    provider,
    displayName: accountRef,
    owner: 'selftest',
    plan: { name: 'test', quotaPolicy: 'Selftest fixture only.' },
    identity: { landmark: `${accountRef}-identity` },
    login: { profileRef: `Selftest profile: ${accountRef}`, notes: 'No credential values.' },
    automationProfiles: [automationProfile(accountRef, provider)],
    status: 'active',
    lastVerified: '2026-07-14T00:00:00.000Z',
  };
}

function supabaseBinding(profileId, accountRef, isDefault) {
  return {
    bindingId: `supabase-profile-${profileId.toLowerCase()}`,
    provider: 'supabase',
    accountRef,
    environment: 'production',
    role: 'alternative',
    status: 'active',
    target: {
      kind: 'supabase-project',
      name: `Profile ${profileId}`,
      identifiers: [
        { kind: 'project-ref', sourceRef: `.env.local:PROFILE_${profileId}_PROJECT_REF` },
        { kind: 'api-url', sourceRef: `.env.local:PROFILE_${profileId}_SUPABASE_URL` },
      ],
    },
    selection: {
      group: 'application-database',
      mode: 'operator-selected',
      selector: { type: 'environment-variable', name: 'ACTIVE_SUPABASE_PROFILE', value: profileId },
      default: isDefault,
      dataRelationship: 'independent',
      switchProcedure: `node scripts/apply-supabase-profile.mjs --active=${profileId}`,
      compatibilityRequirements: ['Both profiles run compatible migrations before switching.'],
    },
    dataAuthority: {
      mode: 'authoritative-when-selected',
      migrationSource: 'supabase/migrations',
      notes: `Profile ${profileId} owns writes while selected.`,
    },
    resources: [],
    environmentContract: [
      {
        name: `PROFILE_${profileId}_PROJECT_REF`,
        classification: 'identity',
        sourceRef: `.env.local:PROFILE_${profileId}_PROJECT_REF`,
        consumers: ['profile-adapter', 'release-guard'],
        required: true,
        status: 'verified',
      },
      {
        name: `PROFILE_${profileId}_SUPABASE_SECRET_KEY`,
        classification: 'privileged-secret',
        sourceRef: `.env.local:PROFILE_${profileId}_SUPABASE_SECRET_KEY`,
        consumers: ['profile-adapter'],
        required: true,
        status: 'verified',
      },
    ],
    automation: [
      {
        profileRef: `${accountRef}:mcp-readonly`,
        scope: 'project',
        defaultMode: 'read-only',
        expectedIdentity: [{ kind: 'project-ref', sourceRef: `.env.local:PROFILE_${profileId}_PROJECT_REF` }],
        status: 'verified',
      },
    ],
    lastVerified: '2026-07-14T00:00:00.000Z',
  };
}

function degitInventory() {
  return {
    schemaVersion: 1,
    recordType: 'developer-services-project',
    project: { id: 'degit', repository: 'DeGit', displayName: 'DeGit', status: 'active' },
    serviceBindings: [
      supabaseBinding('A', 'supabase:owner-free-01', true),
      supabaseBinding('B', 'supabase:owner-free-02', false),
    ],
    lastReviewed: '2026-07-14',
  };
}

function cloudflareInventory() {
  return {
    schemaVersion: 1,
    recordType: 'developer-services-project',
    project: { id: 'web-app', repository: 'WebApp', displayName: 'Web App', status: 'active' },
    serviceBindings: [
      {
        bindingId: 'cloudflare-production',
        provider: 'cloudflare',
        accountRef: 'cloudflare:owner-free-01',
        environment: 'production',
        role: 'primary',
        status: 'active',
        target: {
          kind: 'cloudflare-worker',
          name: 'web-app',
          identifiers: [{ kind: 'worker-name', value: 'web-app' }],
        },
        dataAuthority: { mode: 'none', notes: 'Stateless Worker.' },
        resources: [],
        environmentContract: [
          {
            name: 'CLOUDFLARE_ACCOUNT_ID',
            classification: 'identity',
            sourceRef: '.env.local:CLOUDFLARE_ACCOUNT_ID',
            consumers: ['wrangler'],
            required: true,
            status: 'verified',
          },
        ],
        automation: [
          {
            profileRef: 'cloudflare:owner-free-01:mcp-readonly',
            scope: 'account',
            defaultMode: 'read-only',
            expectedIdentity: [{ kind: 'worker-name', value: 'web-app' }],
            status: 'verified',
          },
        ],
        lastVerified: '2026-07-14T00:00:00.000Z',
      },
    ],
    lastReviewed: '2026-07-14',
  };
}

async function createFixture(root) {
  const accountsDir = path.join(root, 'devrules', 'registry', 'developer-account-records');
  await writeJson(path.join(accountsDir, 'supabase-a.json'), account('supabase:owner-free-01'));
  await writeJson(path.join(accountsDir, 'supabase-b.json'), account('supabase:owner-free-02'));
  await writeJson(path.join(accountsDir, 'supabase-spare.json'), account('supabase:spare-free-03'));
  await writeJson(path.join(accountsDir, 'cloudflare.json'), account('cloudflare:owner-free-01'));
  await writeJson(
    path.join(root, 'DeGit', 'devrules', 'memory', 'developer-services-inventory.json'),
    degitInventory(),
  );
  await writeJson(
    path.join(root, 'WebApp', 'devrules', 'memory', 'developer-services-inventory.json'),
    cloudflareInventory(),
  );
  return accountsDir;
}

async function testValidMultiBindingCatalog(root, accountsDir) {
  const catalog = await loadDeveloperServicesCatalog({ root, accountsDir });
  assert.equal(catalog.validation.valid, true, JSON.stringify(catalog.validation.errors, null, 2));
  assert.equal(catalog.summary.accounts, 4);
  assert.equal(catalog.summary.projects, 2);
  assert.equal(catalog.summary.bindings, 3);
  assert.equal(catalog.summary.selectionGroups, 1);
  assert.equal(catalog.relationships.selectionGroups[0].bindings.length, 2);
  assert.deepEqual(
    catalog.relationships.selectionGroups[0].bindings.map((binding) => binding.selector.value),
    ['A', 'B'],
  );

  const filtered = filterDeveloperServicesCatalog(catalog, { project: 'degit', provider: 'supabase' });
  assert.equal(filtered.summary.projects, 1);
  assert.equal(filtered.summary.bindings, 2);
  assert.equal(filtered.accounts.length, 2);

  const unusedAccount = filterDeveloperServicesCatalog(catalog, { account: 'supabase:spare-free-03' });
  assert.equal(unusedAccount.accounts.length, 1);
  assert.equal(unusedAccount.accounts[0].accountRef, 'supabase:spare-free-03');
  assert.equal(unusedAccount.projects.length, 0);

  const providerAccounts = filterDeveloperServicesCatalog(catalog, { provider: 'supabase' });
  assert.equal(providerAccounts.accounts.length, 3);
  assert.equal(providerAccounts.projects.length, 1);

  const outDir = path.join(root, 'reports');
  const files = await writeDeveloperServicesCatalog(catalog, outDir);
  assert.equal(await fs.access(files.jsonPath).then(() => true), true);
  assert.equal(await fs.access(files.markdownPath).then(() => true), true);
  const markdown = await fs.readFile(files.markdownPath, 'utf8');
  assert.match(markdown, /degit \/ application-database/);
  assert.match(markdown, /ACTIVE_SUPABASE_PROFILE=A/);
  assert.match(markdown, /ACTIVE_SUPABASE_PROFILE=B/);
}

function testValidationFailures(accountsDir) {
  const secretRecord = {
    schemaVersion: 1,
    recordType: 'developer-service-account',
    apiToken: 'not-a-real-token-value',
  };
  assert.equal(
    scanForSecretMaterial(secretRecord).some((entry) => entry.code === 'SECRET_FIELD_FORBIDDEN'),
    true,
  );

  const record = degitInventory();
  record.serviceBindings[1].selection.selector.value = 'A';
  const accountsByRef = new Map([
    ['supabase:owner-free-01', account('supabase:owner-free-01')],
    ['supabase:owner-free-02', account('supabase:owner-free-02')],
  ]);
  const duplicateSelector = validateDeveloperServicesProject(record, { accountsByRef, filePath: 'DeGit.json' });
  assert.equal(
    duplicateSelector.errors.some((entry) => entry.code === 'DUPLICATE_SELECTION_SELECTOR'),
    true,
  );

  const missingAccount = degitInventory();
  missingAccount.serviceBindings[1].accountRef = 'supabase:missing';
  const missingResult = validateDeveloperServicesProject(missingAccount, { accountsByRef, filePath: accountsDir });
  assert.equal(missingResult.errors.some((entry) => entry.code === 'ACCOUNT_REF_UNRESOLVED'), true);
}

async function testCli(root, accountsDir) {
  const validateResult = await execFileAsync(process.execPath, [
    CLI,
    'validate',
    '--root',
    root,
    '--accounts',
    accountsDir,
    '--json',
  ]);
  const validation = JSON.parse(validateResult.stdout);
  assert.equal(validation.valid, true);

  const unifiedValidateResult = await execFileAsync(process.execPath, [
    MAIN_CLI,
    'services',
    'validate',
    '--root',
    root,
    '--json',
  ]);
  assert.equal(JSON.parse(unifiedValidateResult.stdout).valid, true);

  const initProject = path.join(root, 'NewProject');
  await fs.mkdir(initProject, { recursive: true });
  const dryRun = await execFileAsync(process.execPath, [MAIN_CLI, 'services', 'init', '--project', initProject, '--json']);
  const dryRunResult = JSON.parse(dryRun.stdout);
  assert.equal(dryRunResult.action, 'planned');
  const inventoryPath = path.join(initProject, 'devrules', 'memory', 'developer-services-inventory.json');
  assert.equal(await fs.access(inventoryPath).then(() => true).catch(() => false), false);
  await execFileAsync(process.execPath, [MAIN_CLI, 'services', 'init', '--project', initProject, '--apply', '--json']);
  assert.equal(await fs.access(inventoryPath).then(() => true), true);
}

async function testLocatorTemplateWithoutWorkspaceDevrules(root) {
  const templateRoot = path.join(root, 'locator-template');
  const workspaceRoot = path.join(root, 'locator-workspace');
  const accountsDir = path.join(templateRoot, 'registry', 'developer-account-records');
  const runtimeConfigPath = path.join(root, 'runtime.json');
  const accountRef = 'supabase:locator-only-01';

  await writeJson(path.join(templateRoot, 'template.json'), {
    schemaVersion: 1,
    templateId: 'selftest/developer-services-locator',
  });
  await fs.mkdir(path.join(templateRoot, 'scripts'), { recursive: true });
  await fs.writeFile(path.join(templateRoot, 'scripts', 'devrules.mjs'), '// locator fixture\n', 'utf8');
  await writeJson(path.join(accountsDir, 'locator-only.json'), account(accountRef));
  await fs.mkdir(workspaceRoot, { recursive: true });
  await writeJson(runtimeConfigPath, {
    schemaVersion: 1,
    templateRoot,
    workspaceRoots: [workspaceRoot],
  });

  const environment = {
    ...process.env,
    DEVRULES_RUNTIME_CONFIG: runtimeConfigPath,
  };
  delete environment.DEVRULES_TEMPLATE_ROOT;
  delete environment.DEVRULES_WORKSPACE_ROOTS;

  const inspected = await execFileAsync(process.execPath, [
    CLI,
    'inspect',
    '--account',
    accountRef,
    '--json',
  ], {
    cwd: workspaceRoot,
    env: environment,
  });
  const catalog = JSON.parse(inspected.stdout);
  assert.equal(await fs.access(path.join(workspaceRoot, 'devrules')).then(() => true).catch(() => false), false);
  assert.equal(path.resolve(workspaceRoot, catalog.accountDirectory), accountsDir);
  assert.deepEqual(catalog.accounts.map((entry) => entry.accountRef), [accountRef]);
}

async function testSchemasParse() {
  const files = [
    path.join(TEMPLATE_ROOT, 'templates', 'ops', 'schemas', 'developer-service-account.schema.json'),
    path.join(TEMPLATE_ROOT, 'templates', 'ops', 'schemas', 'developer-services-inventory.schema.json'),
    path.join(TEMPLATE_ROOT, 'templates', 'ops', 'developer-service-account-record.json'),
    path.join(TEMPLATE_ROOT, 'templates', 'ops', 'developer-services-inventory.json'),
    path.join(TEMPLATE_ROOT, 'templates', 'ops', 'examples', 'developer-services-multi-supabase.json'),
    path.join(TEMPLATE_ROOT, 'hooks', 'hooks.json'),
  ];
  for (const filePath of files) JSON.parse(await fs.readFile(filePath, 'utf8'));

  const hooks = JSON.parse(await fs.readFile(path.join(TEMPLATE_ROOT, 'hooks', 'hooks.json'), 'utf8'));
  const serviceHook = hooks.hooks.find((entry) => entry.id === 'developer-service-configuration-governance');
  assert.ok(serviceHook);
  assert.equal(
    serviceHook.run.includes('devrules services validate --root <workspace>'),
    true,
  );
}

async function testGovernanceProfiles() {
  const config = JSON.parse(await fs.readFile(path.join(TEMPLATE_ROOT, 'config.json'), 'utf8'));
  assert.equal(
    config.developerServices.mode,
    'safety-only',
    'the shared default must not require a managed registry',
  );
  assert.deepEqual(
    config.developerServices.managedProviders,
    [],
    'provider adapters must be selected by the project instead of globally activated',
  );
  assert.equal(
    config.automation.githubActionsPolicy,
    'inherit',
    'existing hosted CI must be preserved unless the project explicitly denies it',
  );

  const workflow = await fs.readFile(
    path.join(TEMPLATE_ROOT, 'workflows', 'developer-service-configuration-governance.md'),
    'utf8',
  );
  assert.match(workflow, /`safety-only` \(default\)/);
  assert.match(workflow, /`managed-registry` \(explicit profile\)/);
  assert.match(workflow, /Load a provider adapter only after the project or task has selected that\s+provider/);
  assert.match(workflow, /No devrules Markdown or JSON registry is required/);

  const inventoryTemplate = JSON.parse(await fs.readFile(
    path.join(TEMPLATE_ROOT, 'templates', 'ops', 'developer-services-inventory.json'),
    'utf8',
  ));
  assert.deepEqual(
    inventoryTemplate.serviceBindings,
    [],
    'the generic managed-registry template must not preselect a provider',
  );
}

async function main() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'developer-services-registry-selftest-'));
  try {
    const accountsDir = await createFixture(root);
    await testValidMultiBindingCatalog(root, accountsDir);
    testValidationFailures(accountsDir);
    await testCli(root, accountsDir);
    await testLocatorTemplateWithoutWorkspaceDevrules(root);
    await testSchemasParse();
    await testGovernanceProfiles();
    process.stdout.write('developer services registry selftest: PASS\n');
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}

main().catch((error) => {
  process.stderr.write(`developer services registry selftest: FAIL\n${error.stack || error.message}\n`);
  process.exitCode = 1;
});
