---
title: Ops Domain Templates
description: Index for developer-service configuration, production changes, deployment, release readiness, TestFlight packaging, backup/restore, and diagnostics.
ownership: shared
governs: product
activation: conditional
enforcement: example
decision_owner: project
side_effects: none
applies_to:
  - web apps
  - API services
  - serverless functions
  - desktop apps with cloud sync
  - data-heavy products
use_when:
  - A project is preparing deployment, release, rollback, backup, restore, or operational diagnostics.
  - Production behavior must be observable and supportable.
do_not_use_when:
  - The task is a local-only prototype with no persistence or users.
  - A repo has a mature runbook and the task only changes local UI.
outputs:
  - developer-services inventory
  - deployment runbook
  - release checklist
  - TestFlight packaging checklist
  - production change plan and acceptance evidence
  - backup and restore plan
  - observability plan
  - diagnostics surface
case_sources:
  - magic-novel-forge/docs/templates early deployment experience
  - planner-v0/lib/data-backup
  - planner-v0/lib/data-export
  - DeGit/src/services/backup-job-runner.ts
  - DeGit/src/services/diagnostics.ts
  - DeGit/src/services/runtime-diagnostics.ts
  - FrameCast/src/projects/export-job.ts
  - FrameCast/src/projects/export-records.ts
  - auto-threads/supabase/functions
related_workflows:
  - devrules/workflows/release.md
  - devrules/workflows/backup-maintenance.md
  - devrules/workflows/supabase-project-operations.md
  - devrules/workflows/supabase-edge-function-deploy.md
  - devrules/workflows/cloudflare-project-operations.md
  - devrules/workflows/debug-root-cause.md
  - devrules/workflows/apple-app-store-launch.md
last_reviewed: 2026-07-17
---

# Ops Domain Templates

Operations templates turn "it works locally" into "it can be shipped, observed, backed up, restored, and debugged without guessing."

## Recommended Reading Order

| Task | Read |
| --- | --- |
| Organize developer accounts, apps, identifiers, credentials, products, environments, and shared APIs | `developer-services-inventory.md` |
| Bind a repository to its exact GitHub account and remote before commit/push | `developer-services-inventory.md`, `examples/developer-services-github.json`, then `devrules/workflows/git-multi-device-sync.md` |
| Operate Supabase accounts, projects, schema, Auth, Storage, Functions, or webhooks | `developer-services-inventory.md`, then `devrules/workflows/supabase-project-operations.md` |
| Operate Cloudflare accounts, Workers, Pages, bindings, storage, migrations, or domains | `developer-services-inventory.md`, then `devrules/workflows/cloudflare-project-operations.md` |
| Prepare deployment or environment configuration | `deployment-runbook.md` |
| Prepare a production release | `release-readiness.md` |
| Package, upload, process, and distribute an Apple TestFlight build | `testflight-packaging.md`, then `devrules/workflows/apple-app-store-launch.md` |
| Change released data, schema/file format, contracts, deployed clients, migration, rollout, or recovery | `production-change-plan.md`, then `devrules/workflows/production-change.md` |
| Add backup, export, restore, retention, or cleanup | `backup-export-restore.md` |
| Add logs, metrics, health checks, admin diagnostics, or support views | `observability-diagnostics.md` |

## Domain Principles

- Deployment config, secrets, database state, and rollback must be documented together.
- A release is not complete until smoke checks and rollback criteria are known.
- A stateful production change is not complete until compatibility, migration, staged rollout, recovery, observability, and post-release reconciliation pass their gates.
- Backup is not real until restore is tested.
- Diagnostics should explain runtime state without exposing secrets.
- Admin tools should separate observation, repair, and destructive operations.
- External developer-service configuration should be readable from one non-secret project inventory; shared credentials require explicit scope and consumer evidence.
- Multi-account cloud automation must bind credential identity, account,
  project/deployable, environment, and resource targets before any mutation.
