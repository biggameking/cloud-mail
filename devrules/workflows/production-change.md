---
description: Stage-gated workflow for safely changing released products, persistent data, public contracts, and deployed clients.
ownership: shared
governs: release
activation: explicit
enforcement: gate
decision_owner: project
side_effects: external
---

# Production Change Workflow

Use this workflow for a released product when a change affects persistent state, public contracts, mixed client versions, permissions, billing, destructive behavior, deployment order, or recoverability.

Read first:

- `devrules/rules/production-change-governance.md`
- `devrules/templates/ops/production-change-plan.md`
- the project release, backup/restore, observability, security, and platform guidance that matches the affected lanes

## Goal

Move the existing user population and production state to the new behavior without losing data, breaking supported readers/writers, or creating an unrecoverable partial state.

## Inputs

- requested behavior and release target;
- current architecture, storage ownership, schema/format versions, and public contracts;
- supported client/service versions and real version distribution when available;
- data size, shape, known anomalies, backup/restore capability, and existing migrations;
- deployment topology, feature flags, staged-release controls, telemetry, and incident ownership;
- project-specific test, build, release, App Store, Play, desktop updater, or backend deployment commands.

## Phase 1: Classify Before Editing

1. State goal, constraints, architecture relationship, approach, and done criteria.
2. Identify affected boundaries: UI, domain, data access, database/files, API/events, background jobs, auth/privacy, billing, integrations, and platform clients.
3. Set every impact flag in a production change plan; do not omit uncertain flags.
4. Derive risk from worst credible impact and raise uncertainty to the safer class.
5. Run the design gate:

```bash
node devrules/scripts/production-readiness.mjs --plan <plan.json> --stage design
```

Do not implement a high or critical change while the design gate reports missing compatibility, migration, recovery, rollout, or observability controls.

## Phase 2: Map Existing State And Compatibility

Build an explicit matrix for every reader/writer pair:

| Producer/writer | Consumer/reader | Old -> new | New -> old | Concurrent operation | End of support |
| --- | --- | --- | --- | --- | --- |
| service/client/job/importer | service/client/job/exporter | evidence | evidence | safe/gated/unsafe | date or criterion |

Include offline queues, delayed events, webhooks, restored backups, long-idle clients, plugins, import/export packages, and administrative tools.

For local applications, inventory all persisted stores—not only the primary database—and classify each as authoritative, draft, setting, derived, or disposable cache.

## Phase 3: Design Migration And Deployment Order

For server/web state:

1. Expand compatible structures.
2. Deploy tolerant readers and writers.
3. Backfill in resumable, bounded batches.
4. Reconcile counts and invariants.
5. Cut over reads/writes behind a control.
6. Observe supported old versions through the compatibility window.
7. Contract old structures in a later change.

For browser/desktop/iOS/Android local state:

1. Define ordered source-version steps and multi-version jumps.
2. Choose transaction, copy-on-write, or durable checkpoint recovery.
3. Check disk space and preserve originals before replacement.
4. Test process termination/relaunch at durable phase boundaries.
5. Define downgrade/newer-format refusal or compatibility behavior.
6. Keep authoritative content distinct from rebuildable cache or indexes.

For every lane:

- write preflight checks and integrity invariants;
- define batch limits, load budgets, checkpoints, and quarantined-record handling;
- make retries idempotent;
- name the point of no return;
- choose whether failure rolls back, rolls forward, pauses, or isolates affected records.

## Phase 4: Build Safety Controls And Tests

Implement through explicit boundaries:

- migration modules separate from ordinary UI/request logic;
- versioned storage and contract adapters;
- feature flag, cohort gate, tenant isolation, version gate, or traffic split;
- kill switch or safe stop mechanism;
- structured progress, result, and correlation/change-ID telemetry;
- operator-visible failure and recovery state.

Add focused regression coverage proportional to risk:

- all declared upgrade paths;
- old/new reader-writer combinations;
- retry and interruption;
- malformed-but-observed data;
- production-like volume and duration;
- low disk/device termination for local clients;
- backup/restore roundtrip for state changes;
- authorization, tenant, billing, or privacy invariants when affected.

## Phase 5: Preflight Gate

Before any production write or user exposure:

1. Run project lint, typecheck, tests, build, contract, migration, and platform checks.
2. Dry-run or rehearse migrations on representative data.
3. Verify the backup can be restored and record evidence.
4. Verify dashboard queries, alerts, feature flag, kill switch, and operator permissions.
5. Confirm deployment order and mixed-version behavior.
6. Obtain approvals required by risk; critical changes need two named approvals.
7. Run:

```bash
node devrules/scripts/production-readiness.mjs --plan <plan.json> --stage preflight
```

Any failed or pending required check blocks the release. Do not convert a failure into a warning merely to proceed.

## Phase 6: Progressive Rollout

For each stage:

1. Confirm cohort and change ID.
2. Apply only the planned exposure or migration batch.
3. Observe for the declared window.
4. Compare technical, migration, integrity, and user/business signals against baseline.
5. Reconcile failed, skipped, quarantined, and retried records.
6. Record the decision to advance, hold, contain, roll back, or roll forward.

Stop when any criterion is breached or an anomaly is unexplained. A hold must leave partially migrated users and in-flight work in a defined safe state.

## Phase 7: Incident Or Failed Migration

If behavior deviates from plan:

1. Stop new exposure or writes with the prepared control.
2. Preserve logs, checkpoints, affected IDs, and change correlation without copying secrets or unnecessary personal data.
3. Determine whether valid new writes exist beyond the restore boundary.
4. Choose code rollback, configuration rollback, data restore, isolated repair, or roll-forward based on data integrity—not convenience.
5. Reconcile every affected record or cohort.
6. Use `devrules/workflows/debug-root-cause.md`; do not hide the unknown defect with retries, resets, or silent fallback.
7. Record incident evidence and any exception or changed recovery boundary in the production plan.

## Phase 8: Post-Release Reconciliation And Cleanup

After full rollout:

- observe through the declared delayed-work and dormant-client window;
- reconcile source/target counts, checksums, invariants, failures, and quarantined records;
- confirm support/admin impact and user-facing recovery paths;
- create owned cleanup work for dual writes, temporary flags, compatibility adapters, deprecated fields, old schemas, and extra telemetry;
- keep old structures until usage evidence and support policy allow removal;
- update release notes, runbooks, README anchors, and durable decisions when system shape changed;
- run:

```bash
node devrules/scripts/production-readiness.mjs --plan <plan.json> --stage post-release
```

## Platform Branches

| Platform | Additional required focus |
| --- | --- |
| Web/backend | rolling deploy, old/new service instances, API/event compatibility, online schema work, job load, backup/restore; also use the local-state branch for authoritative IndexedDB/browser storage |
| Desktop | updater population, skipped versions, local files/databases, process interruption, disk space, downgrade/newer-format protection |
| iOS | App Store phased release, background termination, protected storage, skipped upgrades, downgrade/newer-format behavior |
| Android | staged Play rollout, process death, Room/file migration chains, low storage, downgrade/newer-format behavior |

Mixed products follow every applicable branch; one passing lane does not prove another.

## Required Evidence

- completed machine-readable production change plan;
- exact verification commands and latest outputs or report paths;
- compatibility and upgrade-path test results;
- migration rehearsal and production-scale estimate;
- backup/restore evidence when persistent state is affected;
- rollout dashboard/queries, thresholds, stop decisions, and audit trail;
- approvals and documented exceptions;
- post-release reconciliation and cleanup ownership.

## Done Criteria

- The post-release gate passes.
- No supported old reader/writer or upgrade path is unaccounted for.
- No authoritative data failure is silently discarded or unresolved without ownership.
- Rollout, recovery, monitoring, and audit evidence is inspectable.
- Temporary compatibility and migration mechanisms have removal criteria and owners.
- Project-specific checks are green or remaining risk is explicitly accepted by the authorized owner.
