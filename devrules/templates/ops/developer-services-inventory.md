---
title: Developer Services Managed Registry
description: Optional non-secret project ledger for explicitly managed external-service bindings.
ownership: seed
governs: external_service
activation: explicit
enforcement: example
decision_owner: project
side_effects: none
profile: managed-registry
outputs:
  - devrules/memory/developer-services-inventory.md
  - devrules/memory/developer-services-inventory.json
related_workflows:
  - devrules/workflows/developer-service-configuration-governance.md
last_reviewed: 2026-07-17
---

# Developer Services Managed Registry

> Use this template only after the project or user explicitly selects the
> `managed-registry` profile. `safety-only` projects do not need either
> inventory file. Never record secret values, private keys, tokens, cookies,
> passwords, recovery codes, authorization headers, or customer data here.

The companion JSON file owns machine-readable non-secret bindings and target
preflight. This Markdown file owns rationale, lifecycle, drift, and verification
evidence. Provider state and the project's selected secret store remain the
authorities for live resources and secret values.

Remove or mark `N/A` any section the selected providers do not need. Do not fill
provider adapters merely because they appear in this template.

## Profile Selection

```json
{
  "developerServices": {
    "mode": "managed-registry",
    "managedProviders": ["<selected-provider>"]
  }
}
```

| Field | Value |
| --- | --- |
| Product/repository | `<name>` |
| Registry decision owner | `<role/person/project instruction>` |
| Selected providers | `<provider list>` |
| Existing authority integrated | `<IaC/catalog/docs/none>` |
| Last provider readback | `<date/time and method>` |
| Overall status | `draft / verified / drifted / cleanup-required` |

## Managed Account And Target Bindings

Record only bindings the project intentionally manages.

| Binding ID | Provider | Logical account reference | Environment | Immutable target or source reference | Role/data authority | Consumers | Last readback | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `<binding-id>` | `<provider>` | `<provider:account-ref>` | `<environment>` | `<non-secret ID or .env.local:NAME>` | `<primary/alternative; authority>` | `<consumers>` | `<date/method>` | `<status>` |

Display names help humans but never replace immutable provider identity. Before
an external write, compare the active account and target with provider readback.

## Credential And Environment Contract

| Logical credential/config name | Provider/type | Classification | Permission/scope | Environment | Consumers | Secret-store reference | Rotation/revocation owner | Last verified | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `<logical name>` | `<type>` | `public / secret / privileged-secret / identity` | `<least privilege>` | `<env>` | `<consumers>` | `<logical reference, never value>` | `<owner/path>` | `<date/method>` | `<status>` |

If local credential files are part of the project contract, list variable names
and ignore proof only. Never paste file contents.

| Local file | Variable names only | Target identity | Consumers | Git-ignore proof | Example contract | Last verified |
| --- | --- | --- | --- | --- | --- | --- |
| `.env.local` | `<NAMES>` | `<account/project/environment>` | `<consumers>` | `<git check-ignore result>` | `<.env.example path>` | `<date/method>` |

## Integrations And Consumers

| Integration/resource | Source | Destination/consumer | Environment | Auth logical name | Purpose | Verification | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `<name>` | `<provider/target>` | `<consumer>` | `<env>` | `<logical name>` | `<purpose>` | `<date/result>` | `<status>` |

## Optional Multiple-Target Selection

Use this section only when the project deliberately selects among multiple
targets for the same provider concern.

| Selection group | Binding ID | Target identity | Selector | Data relationship | Authority while selected | Switch procedure/readback | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `<group>` | `<binding>` | `<immutable target>` | `<ACTIVE_PROFILE=A>` | `<independent/mirrored/migrating/...>` | `<authority>` | `<procedure/evidence>` | `<status>` |

Unique credentials do not define a safe target switch by themselves. Record
schema/data compatibility and which target owns writes.

## Conditional Provider Adapters

Complete only the adapter for a provider listed in `managedProviders` or already
present in the structured inventory.

### Apple / App Store Connect (only when selected)

| Team and app identity | Resource type | Environment | Scope/role | Consumers | Expiry/rotation | Provider readback |
| --- | --- | --- | --- | --- | --- | --- |
| `<team + bundle/App ID>` | `<key/cert/profile/app/product>` | `<env>` | `<scope>` | `<consumers>` | `<policy>` | `<date/result>` |

### RevenueCat (only when selected)

| Project/app | Platform app identity | Environment | Product/entitlement/offering mapping | Credential logical name | Consumers | Provider readback |
| --- | --- | --- | --- | --- | --- | --- |
| `<project/app>` | `<bundle/package>` | `<env>` | `<mapping>` | `<logical name>` | `<consumers>` | `<date/result>` |

### Supabase (only when selected)

| Project ref/API URL | Environment | Migration/data authority | Auth/storage/function owners | Client config names | Privileged secret names | Last drift/readback |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `<identity/source refs>` | `<env>` | `<source/authority>` | `<owners>` | `<names only>` | `<names only>` | `<date/result>` |

### Cloudflare (only when selected)

| Account/deployable/resource identity | Environment | Routes/bindings | Migration authority | Required plain vars | Required secret names | Health/readback |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `<non-secret IDs>` | `<env>` | `<mapping>` | `<source>` | `<names only>` | `<names only>` | `<date/result>` |

### GitHub (only when selected)

| Login/organization | Exact repository | Branch/remote authority | Automation profile | Hosted CI policy | Last identity/readback |
| --- | --- | --- | --- | --- | --- |
| `<accountRef>` | `<owner/repository>` | `<branch/remote>` | `<logical auth profile>` | `inherit / allow / deny` | `<date/result>` |

Existing committed Actions workflows are preserved under `inherit`. Record
explicit approval before an Agent adds or materially changes hosted CI.

## Duplicate, Rotation, And Cleanup Queue

| Resource | Suspected issue | Consumer evidence required | Planned action | Authorization owner | Provider readback | Status |
| --- | --- | --- | --- | --- | --- | --- |
| `<name/ID>` | `<duplicate/orphan/rotation>` | `<proof>` | `<investigate/rotate/deprecate/delete>` | `<owner>` | `<result>` | `<status>` |

## Verification And Change History

| Date | Provider/source | Target identity verified | Authorized operation | External mutation | Readback/result | Registry section updated |
| --- | --- | --- | --- | --- | --- | --- |
| `<date>` | `<API/dashboard/CLI>` | `<non-secret proof>` | `<scope>` | `<summary or none>` | `<result>` | `<section>` |

## Validation

Run only for a project/workspace that selected the managed registry:

```bash
devrules services validate --root <workspace>
devrules services inspect --root <workspace> --project <project-id>
```

Generated catalogs are derived views. Fix the maintained project JSON or shared
account record instead of editing `devrules/reports/developer-services/`.
