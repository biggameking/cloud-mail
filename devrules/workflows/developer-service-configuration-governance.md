---
description: Apply external-service safety gates and, when explicitly selected, maintain the optional managed developer-services registry.
ownership: shared
governs: external_service
activation: conditional
enforcement: gate
decision_owner: project
side_effects: external
---

# Developer Service Configuration Governance

Use this workflow only when the task reads or changes an external developer
service: for example a store portal, cloud account, payment provider, source
host, analytics service, notification provider, or deployment platform. The
mere presence of an SDK, config file, or old inventory does not authorize an
external operation.

Provider-specific workflows own provider commands and resource semantics. This
workflow owns the cross-provider safety boundary and the optional registry
profile.

## Universal Safety Contract

These gates apply whenever the Agent operates an external service, whether or
not the project uses a devrules inventory:

1. **Authorization:** distinguish read-only inspection from mutation. Obtain
   the required user authorization before creating, changing, deleting,
   publishing, rotating, billing, or otherwise writing external state.
2. **Exact target identity:** before a write, read back the active account,
   organization/team, provider project/app, environment, and immutable target
   identifier needed to disambiguate the destination. Do not trust a display
   name, browser tab, CLI last-link state, or cached default by itself.
3. **Secret containment:** never put secret values, private keys, credentials,
   cookies, recovery codes, authorization headers, or customer data in source,
   devrules memory, registry records, logs, screenshots, or task handoffs. Use
   an approved secret store and record at most a logical reference.
4. **Smallest authorized change:** use the least privilege and the narrowest
   provider action that achieves the requested result. Never create a duplicate
   merely because the intended resource is difficult to locate.
5. **Authoritative readback:** after a mutation, read the provider's current
   state and compare the exact account, target, environment, and changed fields
   with the requested result before reporting success.
6. **Deletion and rotation proof:** enumerate consumers before revocation or
   deletion. For rotation, validate the replacement and switch consumers before
   revoking the old credential. A missing local reference is not proof of zero
   use.
7. **No silent authority switch:** authentication failure, quota pressure, an
   unavailable tool, or a missing credential must not trigger an automatic
   account, environment, database, repository, or data-authority switch.

These are Agent conduct rules. They do not choose a vendor, account topology,
credential-sharing strategy, CI platform, naming convention, or product data
architecture for the project.

## Governance Modes

### `safety-only` (default)

Apply the universal safety contract and the selected provider's own workflow.
No devrules Markdown or JSON registry is required. Respect an existing project
system such as infrastructure-as-code, a platform catalog, a password manager,
or repository documentation instead of duplicating it.

The shared template declares this default as:

```json
{
  "developerServices": {
    "mode": "safety-only",
    "managedProviders": []
  }
}
```

Absence of this block also means `safety-only`.

### `managed-registry` (explicit profile)

Use the devrules registry only when at least one of these is true:

- project configuration sets `developerServices.mode` to `managed-registry`;
- the repository already designates its developer-services inventory as an
  authority and the task is to maintain it;
- the user explicitly asks to create or adopt the managed registry.

The project selects the providers covered by this profile through
`developerServices.managedProviders`, repository instructions, or the actual
bindings already recorded. An empty provider list does not activate every
provider adapter.

When selected, the managed surfaces are:

- `devrules/memory/developer-services-inventory.json` for non-secret,
  machine-readable bindings and target-selection preflight;
- `devrules/memory/developer-services-inventory.md` for rationale, lifecycle,
  drift, and verification notes;
- `devrules/registry/developer-account-records/*.json` only when the workspace
  intentionally maintains shared non-secret account records.

Start from the templates under `devrules/templates/ops/`. Provider dashboards
remain authoritative for live state, and the selected secret manager remains
authoritative for credential values. The registry is not a reason to copy the
same identifiers into unrelated documents.

## Managed Registry Contract

This section applies only in `managed-registry` mode.

For each binding that the project chooses to manage, record only the fields
needed to prevent target confusion and make lifecycle decisions reviewable:

- provider and logical account reference;
- immutable target identity or a non-secret source reference;
- environment, role, status, and consumers;
- data authority when the target stores application data;
- automation identity and expected provider readback;
- logical secret-storage references, never values;
- last verification, rotation/revocation owner, and unresolved drift.

The detailed Markdown sections and JSON schemas are available for projects that
benefit from them; unused sections may be marked `N/A` or removed. A project is
not non-compliant merely because it does not need a product map, entitlement
map, multi-binding group, global account record, or workspace catalog.

### Classification And Naming Aids

Resource classifications such as account-shared, project-specific,
environment-specific, and ephemeral are decision aids, not universal provider
facts. Confirm the provider's actual scope before reuse.

The optional display-name pattern
`<owner>/<product>/<service>/<environment>/<purpose>` can improve a managed
dashboard, but existing provider conventions and immutable identifiers take
precedence. Renaming is never required solely to satisfy this template.

### Intentional Multiple Bindings

Use selection groups only when one project intentionally supports multiple
targets for the same provider concern. Each alternative needs a unique binding
and selector, an explicit data relationship, an authority statement, a switch
procedure, and provider readback. Do not infer synchronization from a shared
schema or application code.

## Conditional Provider Adapters

Load a provider adapter only after the project or task has selected that
provider. The table does not prescribe a vendor or require these records in
unrelated projects.

| Selected provider or concern | Additional route | Conditional checks |
| --- | --- | --- |
| Apple Developer or App Store Connect | `apple-app-store-launch.md` and the relevant signing/release workflow | Confirm Apple team, bundle/App ID, environment, role, and exact consumer before key, certificate, profile, app, or product changes. |
| RevenueCat | `revenuecat-integration.md` | Confirm RevenueCat project/app, platform bundle/package, environment, entitlement/product mapping, and whether any Apple credential scope intentionally spans the selected apps. |
| Supabase | `supabase-project-operations.md` | Compare project reference and API URL; distinguish client-safe and privileged credentials; confirm migration and data authority before writes or target switches. |
| Cloudflare | `cloudflare-project-operations.md` | Confirm account, zone/deployable/resource ID, environment, routes, and bindings; keep deployable secrets outside source and plain configuration. |
| GitHub publication | `git-multi-device-sync.md` | Confirm exact login/organization, `owner/repository`, branch, remote divergence, and requested visibility before a remote write. |
| Hosted GitHub Actions | repository CI guidance plus the policy below | Preserve existing workflows by default; require explicit approval for Agent-added or materially modified hosted CI. |

Provider documentation and the provider-specific workflow decide current
credential scope. Do not generalize an Apple, RevenueCat, Supabase, Cloudflare,
or GitHub table to another provider.

## Operation Sequence

1. Identify the requested outcome and whether the operation is read-only or a
   mutation.
2. Discover the project's existing authority and governance mode. Do not create
   a devrules registry in `safety-only` mode.
3. Load only the selected provider workflow and relevant repository guidance.
4. Read back the exact active identity and immutable target fields.
5. Compare the intended target, environment, permission, consumers, and blast
   radius. Stop on ambiguity.
6. Obtain authorization for the concrete external write when required.
7. Perform the smallest change and read back provider state.
8. Update the existing project authority. In `managed-registry` mode, update the
   affected binding and verification evidence; do not fill unrelated tables.

## GitHub Actions Policy

`automation.githubActionsPolicy` has three modes:

| Mode | Meaning |
| --- | --- |
| `inherit` | Default. Preserve clean, committed workflows. An Agent must get explicit approval before adding or materially modifying hosted CI. |
| `allow` | Hosted workflow changes are approved within the scope recorded by the project/user. It is not blanket approval for unrelated workflows or costly runs. |
| `deny` | Hosted workflows are prohibited for this project; existing workflow files are audit errors until removed or the policy is explicitly changed. |

The legacy `automation.allowGitHubActions=true` is treated as `allow` for
compatibility. `false` means no blanket approval; it does not mean that an Agent
should delete or condemn clean workflows already owned by the repository.

## Done Criteria

For every external mutation:

- authorization covered the actual target and operation;
- account, target, and environment were verified before the write;
- no secret or private data entered source, logs, memory, or handoff artifacts;
- authoritative provider readback proves the requested result;
- destructive or credential lifecycle changes include consumer evidence.

Additionally, only in `managed-registry` mode:

- the affected non-secret binding matches provider readback;
- unresolved identity ambiguity or drift remains visibly blocked;
- optional sections not relevant to the selected provider are omitted or `N/A`;
- registry validation passes for the records actually maintained by the project.
