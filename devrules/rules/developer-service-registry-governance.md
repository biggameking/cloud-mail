---
description: Mandatory account, project, resource, environment, automation, and multi-binding registry rules for external developer services.
ownership: shared
governs: external_service
activation: explicit
enforcement: gate
decision_owner: user
side_effects: none
applies_to: projects-using-external-developer-services
---

# Developer Service Registry Governance

Projects that use GitHub, Supabase, Cloudflare, Apple, RevenueCat, deployment providers, hosted databases, storage, CI, analytics, notification services, or another external developer platform must make the intended provider identity and access path explicit before an Agent performs remote work.

## Authority model

- The provider API or Dashboard is authoritative for current remote state.
- An approved secret manager, ignored local environment file, CI secret store, or MCP/OAuth credential store is authoritative for credential values.
- `devrules/memory/developer-services-inventory.json` is authoritative for the project's intended account, target, environment, resources, variable contract, and automation profile references.
- `devrules/memory/developer-services-inventory.md` owns human rationale, lifecycle decisions, verification evidence, drift, cleanup, and change history.
- `devrules/registry/developer-account-records/*.json` owns global non-secret account aliases and access-profile metadata.
- Generated workspace catalogs are derived views. Never edit them as a second source of truth.

## Required identity chain

Every active binding must resolve this complete chain:

`project → bindingId → provider → accountRef → environment → target identifiers → resources → variable contract → automation profile`

Names alone are not identity proof. Prefer immutable provider IDs or a non-secret `sourceRef` that resolves the expected ID without copying credentials into devrules.

Before a remote write, read back the active provider identity and compare all applicable account, organization, project, zone, deployable, environment, and resource IDs. A CLI's last-linked target, a browser's current tab, or an already-authenticated global MCP connection is only a discovery hint. Any mismatch or ambiguity blocks the write.

## Multiple accounts and multiple bindings

The relationship is intentionally many-to-many:

- one account may own several projects or deployables;
- one project may use several providers or accounts;
- one project may have several bindings to the same provider and environment;
- one resource may have several documented consumers.

Do not label multiple same-provider bindings as duplicates merely because their provider and environment match. They are valid when each has a unique `bindingId`, a distinct target identity, and an explicit role.

When bindings are alternatives, failover targets, migration peers, or runtime/build/operator-selectable backends, each binding must also declare:

- one shared `selection.group`;
- the selection mode and unique selector value;
- at most one default;
- whether data is independent, mirrored, migrating, shared, or a read replica;
- which target is authoritative and under what condition;
- the switch procedure and compatibility requirements;
- migration/readback checks required before and after switching.

For example, a project such as DeGit may intentionally map `ACTIVE_SUPABASE_PROFILE=A|B` to two independent Supabase projects. Both bindings are first-class. Each is `authoritative-when-selected`; profile-specific variables remain separate; canonical runtime variables are generated from the selected profile; and release automation must prove the canonical URL/project reference matches the chosen profile.

Never silently switch to another account or backend because authentication fails, quota is low, a tool is unavailable, or a similarly named project exists. Account allocation and switching must comply with provider terms and explicit product/data policy; automatic rotation to evade quotas is prohibited.

## Secret boundary

Registry records contain names and references, never credential values. Forbidden material includes passwords, tokens, API keys, cookies, OAuth sessions, private keys, recovery codes, authorization headers, database passwords, and credential-bearing connection strings.

Allowed examples include:

- `.env.local:CLOUDFLARE_API_TOKEN`;
- `1Password: Cloud Accounts / Cloudflare Free 01`;
- `Codex OAuth: supabase-project-a`;
- variable names such as `PROFILE_A_SUPABASE_SECRET_KEY`;
- non-secret account IDs, project references, zone IDs, D1 IDs, deployable names, and public API URLs.

Files containing secret values must be ignored by Git. Load only the allowlisted variables needed by the selected consumer and never bulk-copy an environment file into a remote runtime.

## Agent operation gate

For any external-service task:

1. Read the project JSON inventory and human ledger.
2. Select one explicit binding and environment; if a selection group exists, resolve its selector.
3. Resolve the referenced account and automation profile.
4. Start with a bounded read-only identity call.
5. Compare provider readback with every expected non-secret identifier.
6. State the smallest intended mutation, data impact, verification, and recovery path.
7. Require explicit approval for the remote write.
8. Read back the exact changed resource and update verification/change records.

Do not silently fall back between MCP, CLI, REST, browser sessions, accounts, projects, or environments. A fallback is a new target-selection decision and must pass the same gate.

## Lifecycle and aggregation

- Create or update the project inventory when an external resource or credential relationship is created, reused, switched, migrated, rotated, deprecated, or retired.
- Shared resources must list every known consumer and blast radius.
- Deletion or revocation requires provider readback and proof of zero remaining consumers or a verified replacement.
- Retired account aliases and binding IDs are tombstones; do not reuse them for unrelated identities.
- Generate the workspace catalog through the registry script. Validation errors block catalog writes and remote automation readiness.

## Done criteria

- One command can answer which accounts, targets, environments, resources, variables, and automation profiles a project uses.
- One account can be traced to every consuming project and binding.
- Intentional same-provider alternatives remain distinct and show their selector, relationship, authority, and switch contract.
- Active bindings resolve to account records and identity evidence.
- Secret scanning finds no raw credential values or forbidden secret-bearing fields.
- Provider identity mismatch blocks mutation.
- The generated catalog is reproducible from project and account authority records and is never hand-maintained.
