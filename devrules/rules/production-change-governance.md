---
description: Mandatory governance for evolving products that already have users, persistent data, deployed clients, or production integrations.
ownership: shared
governs: release
activation: explicit
enforcement: gate
decision_owner: project
side_effects: none
---

# Production Change Governance

Use this rule when a change can affect an already released product, deployed service, persistent user data, public contract, local storage format, background job, permission boundary, or mixed-version client population.

The governing constraint is simple: a production system already has state. A change is complete only when existing users, data, clients, integrations, and operators can move through it safely.

## Non-Negotiable Invariants

Production changes MUST satisfy these invariants:

1. **Authoritative user data is non-disposable.** Never reset, silently discard, overwrite, or reconstruct authoritative data to hide a migration failure.
2. **Compatibility is explicit.** Do not assume all clients, services, extensions, or users update together.
3. **Persisted formats are versioned.** A reader must be able to identify the schema or format it is interpreting.
4. **Migration failure preserves recoverability.** Use transactions, copy-on-write, versioned replacement, or durable checkpoints with an explicit recovery path.
5. **Code rollback and data recovery are separate plans.** A deploy rollback is not sufficient when writes or migrations changed persisted state.
6. **Risky exposure is progressive.** High and critical changes need isolation, staged rollout, stop criteria, and a kill switch or equivalent containment mechanism.
7. **Release health is observable.** Define technical, migration, integrity, and user/business signals before exposure.
8. **Irreversible actions are identified in advance.** State the point of no return, approver, backup/restore evidence, and preferred roll-forward path.
9. **Every exception is visible.** An unavailable control requires a documented reason, compensating control, owner, and expiry; silence is not an exception.
10. **Evidence precedes claims.** A checklist item is not complete without a command result, report, dashboard, test record, approval, or other inspectable evidence.

## Trigger And Risk Classification

Create a production change plan before implementation when any of these are true:

- persistent data, schema, file format, cache semantics, encryption format, or identifiers change;
- an API, event, webhook, import/export, plugin, or inter-process contract changes;
- old and new application versions may coexist;
- authentication, authorization, privacy, billing, entitlement, tenant isolation, or destructive operations change;
- a background migration, backfill, index rebuild, or bulk repair will run;
- deployment order, feature flags, minimum client versions, or operator action matter;
- rollback could be unsafe after new writes occur.

Classify by worst credible impact, not code size:

| Risk | Typical examples | Minimum governance |
| --- | --- | --- |
| Low | Copy, isolated stateless UI, internal refactor with unchanged contracts | Normal verification and release notes |
| Medium | Shared behavior, optional contract addition, cache policy, non-critical integration | Compatibility review, monitoring, controlled release |
| High | Persistent data, schema/format, auth, privacy, billing, entitlements, background migration | Production plan, staged rollout, recovery evidence, approval |
| Critical | Destructive data, cross-tenant exposure, irreversible encryption/identity change, unrecoverable financial state | Two-person approval, restore rehearsal, bounded cohorts, explicit point of no return |

The declared risk MUST NOT be lower than the impact-derived risk. Uncertainty raises the class until evidence narrows it.

## Architecture Before First Release

Products expected to evolve SHOULD establish these seams before acquiring persistent users:

- a data-access boundary between storage models and business/UI models;
- explicit schema or file-format version metadata;
- ordered migrations (`v1 -> v2 -> v3`) rather than only `old -> current` shortcuts;
- tolerant readers for additive fields and unknown enum values;
- versioned public contracts with ownership and deprecation policy;
- background-job infrastructure for resumable bulk work;
- feature flags or another server/operator-controlled containment path;
- structured logs, metrics, correlation identifiers, and migration progress records;
- backup, export, restore, and integrity-verification paths;
- fixtures representing old versions, large datasets, malformed-but-observed data, and interrupted migrations.

UI, domain logic, data access, migration code, deployment orchestration, and telemetry SHOULD remain separate responsibilities. Migration logic must not be hidden inside rendering or ordinary request handling.

## Required Production Change Record

Medium, high, and critical changes MUST record:

- change ID, title, owner, risk, status, affected platforms, and impact flags;
- architecture relationship: reuse, extend, replace, merge, isolate, or refactor;
- compatibility matrix and supported mixed-version window;
- migration strategy and source-to-target upgrade paths when state changes;
- rollout stages with success and stop criteria;
- code rollback, data recovery or roll-forward, point of no return, RTO, and RPO;
- technical, migration, integrity, business, alerting, and audit signals;
- verification evidence, approvals, exceptions, and post-release reconciliation.

Use `devrules/templates/ops/production-change-plan.md` and validate the machine-readable record with `devrules/scripts/production-readiness.mjs`.

## Compatibility Contract

For each affected reader and writer, answer:

- Can the new reader consume old data?
- Can the old reader safely consume data written by the new version?
- Can old and new writers run concurrently?
- What happens when an unknown field or enum value appears?
- Which client/service versions are supported, and until when?
- What is the minimum supported version and how is it enforced?
- What happens to offline devices, delayed jobs, queued events, restored backups, or long-idle clients?

Rules:

- Additive contract changes SHOULD precede consumer adoption.
- Required-field additions need a default, backfill, or compatibility phase.
- Fields and enum values MUST NOT be removed while supported readers still depend on them.
- A server MUST tolerate the declared supported client versions.
- A client MUST fail safely and visibly when data is newer than it can interpret.
- Deprecation requires usage evidence, an owner, a compatibility deadline, and removal in a later change.

## Data Migration Contract

Every persistent-state change MUST define source versions, target version, ordered steps, preflight checks, integrity checks, failure behavior, and retry behavior.

Migrations SHOULD be:

- **idempotent**: retrying does not duplicate or corrupt state;
- **resumable**: interruption continues from a durable checkpoint;
- **bounded**: work is batched, rate-limited, and observable;
- **failure-atomic**: transactional, copy-on-write, or checkpointed with a proven recovery path;
- **verifiable**: counts, invariants, checksums, ownership, and referential rules can be reconciled;
- **separable**: schema expansion, data movement, read cutover, and old-structure removal are distinct steps.

Never use broad exception handling, silent fallback, or automatic data reset to make a migration appear successful.

### Server And Web State

Use **Expand -> Migrate -> Contract** for breaking schema or contract changes unless an equally safe strategy is documented:

1. **Expand:** add compatible structures; deploy readers/writers that tolerate old and new forms.
2. **Migrate:** backfill in bounded batches; checkpoint progress; reconcile results; isolate failures.
3. **Cut over:** switch reads/writes behind a flag or controlled release; observe the compatibility window.
4. **Contract:** remove old structures only after usage evidence proves no supported reader or writer depends on them.

Do not ship destructive schema removal in the first release that depends on the replacement. Rolling deployments and delayed jobs must remain safe throughout the sequence.

### Browser, Desktop, iOS, And Android Local State

Local and local-first applications still require production migration discipline. This includes IndexedDB or other authoritative browser storage. The migration runs independently on each user device, often after skipped releases and under low disk, crash, termination, or downgrade conditions.

Local migrations MUST:

- support every officially declared source version, including multi-version jumps;
- version databases, files, preferences, indexes, and import/export packages;
- preserve the original through a transaction or copy-then-verify atomic replacement;
- test interruption and relaunch at every durable phase boundary;
- check disk space and avoid treating authoritative documents as cache;
- define downgrade behavior after a newer version writes data;
- distinguish disposable cache, rebuildable derived state, settings, drafts, and authoritative content;
- surface an actionable recovery state rather than looping, resetting, or repeatedly attempting destructive work.

If downgrade is unsupported, the older application must refuse unsafe writes to newer data and explain the condition.

## Rollout And Containment

High and critical changes MUST NOT default to immediate full exposure.

A rollout plan includes:

- internal or test cohort;
- one or more bounded production cohorts;
- observation window per stage;
- quantitative success criteria;
- quantitative and qualitative stop criteria;
- owner and decision channel;
- feature flag, tenant/user isolation, version gate, traffic split, or equivalent control;
- kill switch or safe stop mechanism tested before exposure.

Do not advance while an anomaly is unexplained. Pausing is not rollback; define the safe state of partially migrated users and in-flight work.

## Rollback, Recovery, And Roll-Forward

The plan MUST distinguish:

- **code rollback:** restoring the previous executable or deployment;
- **configuration rollback:** reverting flags, routing, or runtime configuration;
- **data rollback:** restoring an earlier state, only when no valid later writes would be lost;
- **roll-forward repair:** correcting state while preserving valid writes made after release;
- **containment:** stopping new exposure or writes while investigation continues.

Prefer roll-forward once valid new-version writes make data rollback unsafe. Backup existence is insufficient: record restore-test evidence, recovery point objective, recovery time objective, and the latest safe restore boundary.

Critical changes require a named decision owner and a second approver before crossing the point of no return.

## Observability, Audit, And Privacy

Before rollout, define:

- technical signals: errors, crashes, latency, saturation, failed jobs;
- migration signals: attempted/succeeded/failed/skipped counts, checkpoint age, retries, quarantined records;
- integrity signals: record counts, checksums, invariant violations, orphaned ownership, reconciliation drift;
- user/business signals: critical-flow success, support contacts, conversion or usage regressions;
- alerts with thresholds and responders;
- a dashboard or query path usable during the release;
- a monitoring window that covers delayed work and dormant clients;
- an audit trail for approvals, operator actions, migrations, exceptions, and destructive steps.

Logs and evidence MUST exclude secrets and unnecessary personal data. Audit records should identify actor, action, target scope, time, result, and correlation/change ID without copying sensitive payloads.

## Verification Matrix

Match checks to the affected lane:

| Lane | Required evidence when affected |
| --- | --- |
| Web/API/server | old/new reader-writer matrix, rolling-deploy compatibility, migration dry-run, production-scale estimate, backup/restore, job retry, contract tests |
| Desktop | clean install, prior-version upgrades, skipped-version upgrade, interrupted migration, low-disk path, updater/rollback behavior, local backup/restore |
| iOS | supported-version upgrades, background termination, storage protection, low-disk behavior, App Store phased-release containment, downgrade/newer-format behavior |
| Android | supported Room/file upgrades, process death, low storage, staged rollout containment, downgrade/newer-format behavior |
| Shared contracts | unknown field/enum handling, producer-before-consumer and consumer-before-producer order, deprecation usage evidence |

Use representative old-data fixtures and production-like scale. A migration test that only starts from an empty database is not evidence for existing-user safety.

## Acceptance Gates

Run the validator at three stages:

```bash
node devrules/scripts/production-readiness.mjs --plan <plan.json> --stage design
node devrules/scripts/production-readiness.mjs --plan <plan.json> --stage preflight
node devrules/scripts/production-readiness.mjs --plan <plan.json> --stage post-release
```

- **Design:** architecture, impact, compatibility, migration, rollout, recovery, and observability plans are complete.
- **Preflight:** verification and approval evidence is passed; no required item remains pending.
- **Post-release:** monitoring and migration reconciliation are complete; compatibility/flag/old-schema cleanup is tracked.

Automated validation is a minimum gate, not a substitute for project-specific tests, review, restore rehearsal, or operational judgment.

## Prohibited Shortcuts

- Resetting user state because migration is difficult.
- Reclassifying authoritative data as cache after a failure.
- Destructive database changes coupled to the first dependent deploy.
- Assuming app-store, desktop, or browser clients update immediately.
- Treating a backup that has never been restored as recovery evidence.
- Treating code rollback as proof that persisted data is recoverable.
- Advancing rollout while errors or business regressions are unexplained.
- Marking checks complete with `TODO`, a command name without output, or an unverified checkbox.
- Leaving dual-write, compatibility paths, feature flags, or temporary schemas without an owner and removal milestone.

## Done Criteria

A production change is complete only when:

- supported old data and clients are compatible or safely gated;
- migrations are reconciled and failures are resolved or quarantined with ownership;
- rollout success and stop criteria were observed for the required window;
- rollback/recovery capability remains valid for the stated boundary;
- user, integrity, technical, and business signals are healthy;
- approvals, exceptions, and operator actions are auditable;
- temporary flags, dual writes, compatibility code, and old structures have tracked cleanup work;
- the post-release readiness gate passes with inspectable evidence.
