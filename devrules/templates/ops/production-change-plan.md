---
title: Production Change Plan
description: Human and machine-readable acceptance record for safely changing released products, persistent state, contracts, and deployed clients.
ownership: seed
governs: release
activation: explicit
enforcement: example
decision_owner: project
side_effects: none
applies_to:
  - web and backend production changes
  - desktop application updates
  - iOS and Android releases
  - persistent data and contract migrations
use_when:
  - A released product change affects state, compatibility, rollout, recovery, or observability.
do_not_use_when:
  - A local prototype has no users, persistent state, deployed integrations, or release exposure.
outputs:
  - risk and impact record
  - compatibility and migration plan
  - rollout and recovery plan
  - verification and approval evidence
  - post-release reconciliation record
related_rules:
  - devrules/rules/production-change-governance.md
related_workflows:
  - devrules/workflows/production-change.md
  - devrules/workflows/release.md
last_reviewed: 2026-07-14
---

# Production Change Plan

Copy `production-change-plan.template.json` into a project-owned location such as:

```text
docs/production-changes/<change-id>.json
```

The JSON record is the acceptance artifact. Keep long design prose in project documentation and put stable evidence paths or concise decisions in the record.

## Validation Stages

```bash
node devrules/scripts/production-readiness.mjs --plan docs/production-changes/<change-id>.json --stage design
node devrules/scripts/production-readiness.mjs --plan docs/production-changes/<change-id>.json --stage preflight
node devrules/scripts/production-readiness.mjs --plan docs/production-changes/<change-id>.json --stage post-release
```

| Stage | Meaning |
| --- | --- |
| `design` | Required architecture, compatibility, migration, rollout, recovery, and observability decisions are explicit. |
| `preflight` | Verification and approval evidence is complete and passed before production exposure. |
| `post-release` | Monitoring and migration reconciliation completed; temporary cleanup has ownership. |

The validator is read-only. It never deploys, migrates, restores, edits the plan, or changes product files.

## Field Contract

### Identity And Impact

- `changeId`, `title`, `owner`, `status`, `riskLevel`, and `platforms` identify the change.
- Every boolean in `impact` must be set. Unknown impact is not equivalent to `false`; use `clientLocalState` for IndexedDB/browser storage as well as native-device stores, and `irreversibleOperation` whenever no proven inverse exists.
- Valid platforms are `web`, `server`, `desktop`, `ios`, and `android`; mixed products list every affected lane.
- The validator derives a minimum risk. Destructive, cross-tenant, or irreversible impact is critical; persistent data, contracts, client-local state, security/privacy, or billing is high.

### Architecture

`architecture.relationship` is one of `reuse`, `extend`, `replace`, `merge`, `isolate`, or `refactor`. Record affected boundaries and the smallest safe architecture decision.

### Compatibility

Required for persistent data or contract changes. Record old/new reader behavior, mixed-version safety, unknown-field and unknown-enum handling, a safe gate/refusal path, support window, minimum version, deprecation plan, and evidence.

Boolean answers must reflect tested or deliberately designed behavior. `false` is allowed when the plan includes a safe version gate or refusal path; omitting the answer is not allowed.

### Migration

Set `required` when schema or storage format changes. Record:

- strategy and backward-compatible deployment order;
- source versions, target version, and ordered steps;
- idempotence, resumability, and failure atomicity;
- preflight and integrity checks;
- backup and restore evidence;
- batching/load limits, failure handling, downgrade behavior, and interruption evidence.

`failureAtomicity` must be `transactional`, `copy-on-write`, or `checkpointed-resumable`.

### Rollout And Recovery

High and critical changes need at least two rollout stages. Each stage records cohort/percentage, observation window, success criteria, and stop criteria. `featureFlagOrIsolation` and `killSwitchOrStopMechanism` may name an equivalent platform control when a literal feature flag is not applicable.

Rollback records executable code rollback, data recovery or roll-forward, point of no return, owner, RTO, RPO, and preflight evidence.

### Observability And Audit

Record technical, business, and migration/integrity signals; alerts; dashboard or query path; monitoring window; and audit trail. Use evidence references, not secrets or raw personal data.

### Verification, Approval, And Closure

- Every `verification.checks[]` and required `upgradePaths[]` item must be `passed` with evidence at preflight.
- High changes need at least one approved record; critical changes need at least two distinct approved records.
- `postRelease` proves monitoring, reconciliation, and cleanup tracking. Cleanup tracking can reference an issue even when removal must wait for a compatibility window.

## Evidence Quality

Accepted evidence is inspectable and specific, for example:

- `artifacts/migration-dry-run-2026-07-14.json`
- `CI run 4812: migration + contract suites passed`
- `dashboard/release-abc?window=...`
- `restore rehearsal RR-2026-017`
- `issue OPS-912 owns dual-write removal after <criterion>`

`TODO`, `TBD`, `pending`, a bare command name, or an unchecked box is not evidence.

## Exceptions

Use `exceptions[]` only when a required control is technically unavailable. Each exception needs:

- the affected requirement;
- reason;
- compensating control;
- owner;
- expiry or removal criterion;
- approval evidence.

The generic validator reports exceptions but does not automatically waive required safety gates. Project-specific policy may add stricter validation; it must not silently weaken the universal minimum.
