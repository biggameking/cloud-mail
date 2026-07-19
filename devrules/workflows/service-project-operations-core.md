---
description: Shared identity, inventory, environment-file, preflight, deployment, and verification contract for provider project-operations workflows.
ownership: shared
governs: external_service
activation: explicit
enforcement: gate
decision_owner: user
side_effects: external
applies_to: service-projects
---

# Service Project Operations Core

This is the shared skeleton for provider project-operations workflows such as
`supabase-project-operations.md` and `cloudflare-project-operations.md`. Read
this core first, then the provider workflow for provider-specific credential
lanes, resources, gates, and sequences. Run
`developer-service-configuration-governance.md` first for account, project,
credential, environment, consumer, reuse, and lifecycle decisions.

## Goal

Make the selected provider account/organization, project or deployable,
environment, credential lane, stateful-resource set, and deployment target
unambiguous before any mutation. A CLI's last login or link state, a browser's
current account, a default account, or a generic/globally exported environment
variable is never sufficient target evidence in a multi-account workspace.

## Required Project Record

Maintain non-secret provider fields in
`devrules/memory/developer-services-inventory.md`, and the same operational
identities in the structured companion
`devrules/memory/developer-services-inventory.json`:

- account/organization identity and non-secret IDs;
- each project/deployable, environment, region/route, and lifecycle status;
- stateful resources, integrations, and secret logical names;
- canonical environment-variable names, credential consumers, and secret-store
  references;
- the latest CLI/API/Dashboard readback and any drift or cleanup action.

Use one binding per account/environment/target. When the application can
select more than one same-provider target, declare one binding per target
rather than overwriting a single row. The provider workflow lists the exact
provider-specific fields.

Never record token, key, password, connection-string, JWT, authorization
header, cookie, or private customer data values in devrules.

## Local Environment File Contract

Provider credentials, IDs, URLs, and related environment values are normally
resolved from a repository-local `.env.local` or `.env` file. Default to
`.env.local` for developer-machine values; use `.env` when that is the
repository's explicit convention or tool entry point. Any file containing a
secret must be ignored by Git.

- Record only the file's repository-relative path, variable names, consumer,
  environment, account/purpose, and `git check-ignore` evidence in the
  inventory. Never record values, full connection strings, or decoded token
  metadata.
- If both files exist, state the repository's precedence. Unless project
  tooling defines otherwise, treat `.env.local` as the local override and
  `.env` as the lower-priority/default layer.
- Load only the allowlisted variables needed for the current command. Do not
  source an entire file into unrelated tools, print its contents, or pass all
  process variables to a child deployment.
- Multi-account profiles may keep profile-specific variable names in the same
  ignored file or materialize one selected profile into canonical names.
  Verify the active target identity after resolution.
- A local environment file is only a credential source. Remote runtime secrets
  are written through the provider's secret mechanism and verified by name;
  never upload the local file wholesale.
- Committed `.env.example` files contain names and safe placeholders only.
  CI and hosted runtimes use their protected secret stores but expose the same
  canonical variable-name contract as local development.

## Selectable Same-Provider Targets

An application may intentionally support two or more targets from one
provider, such as operator-selected profiles, independent data planes,
failover targets, or a controlled migration pair. This is not a duplicate when
each target identity is distinct and each binding declares its own account and
credential boundary.

All alternatives must share an explicit selection group and define unique
selector values, data relationship, authority mode, compatibility, switch
procedure, and post-switch readback. Never assume independently hosted targets
contain the same users or data. Never auto-switch because one account reaches
a quota, authentication fails, or the selected automation lane is unavailable.

## Hard Target Preflight

Before any remote write:

1. Read the project inventory and select one explicit account, environment,
   and target operation.
2. Resolve the intended account/organization and target identity from
   non-secret configuration and provider readback.
3. Select the repository's `.env.local` or `.env` source, verify that any
   secret-bearing file is ignored, resolve only the required credential names
   without printing values, and prove they belong to the selected account,
   target, environment, consumer, and purpose.
4. Compare the selected target identity with the application's canonical
   configuration. A mismatch blocks the operation.
5. Inspect the repository's provider configuration, migration/resource
   declarations, and deployment commands.
6. State the smallest mutation, data impact, verification proof, and
   rollback/forward-repair plan.

Pass an explicit target flag on mutation commands whenever the tool supports
it. For a selectable group, additionally resolve the current selector,
identify exactly one binding, compare its profile-specific identity with the
materialized canonical identity, and confirm the binding's declared data
relationship and compatibility. Zero or multiple matches, or unprovable
identity, blocks the operation: fail closed.

## Deployment And Verification

For every change:

1. Build/test locally and capture a non-secret source or migration fingerprint
   when the project supports it.
2. Apply required stateful migrations serially, one target/environment at a
   time, and read them back before dependent code takes traffic.
3. Apply the smallest remote change to one environment; do not deploy every
   service merely because several live in one repository.
4. Read back target identity and the changed provider resource.
5. Run the health, auth, integration, and application smoke checks relevant to
   the change.
6. Inspect bounded logs without printing secrets or private customer data.
7. Update the inventory, change history, drift status, and next rotation or
   cleanup action.

Code or configuration rollback does not reverse a database migration,
stateful-resource change, or customer-data change. Prefer backward-compatible
migrations and forward repair; restore only through an approved, tested
data-recovery decision.

## RevenueCat Web Lane

When RevenueCat powers a web project, also run `revenuecat-integration.md`:

- Use one stable application user ID contract across the web client, the
  backend, and RevenueCat.
- Keep the RevenueCat public Web SDK key in the intended client build only;
  keep secret/management credentials server-side.
- Authenticate the webhook, deduplicate by event identity, acknowledge fast,
  and defer longer processing.
- Choose one authoritative entitlement projection with RevenueCat as billing
  authority; do not let a second store become a competing authority.

## Core Done Criteria

- Account, target, environment, and credential lane were explicitly matched
  before mutation.
- The inventory maps account → target → environment → resource →
  credential/consumer without secrets, with the latest readback.
- Stateful changes are versioned, applied serially, and read back.
- Only the smallest required target changed.
- Runtime and provider verification passed, or the exact blocker and unchanged
  state are reported.
- RevenueCat web entitlement state has one documented authority when
  applicable.
- Every selectable same-provider target remains a distinct binding with a
  unique selector, explicit data relationship, conditional authority,
  compatibility contract, and verified identity.

The provider workflow adds its provider-specific done criteria on top of this
core.

Last updated: 2026-07-19
