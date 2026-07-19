---
title: Release Readiness
description: Pattern for release gates, risk assessment, test matrix, changelog, migration, support, and post-release monitoring.
ownership: seed
governs: release
activation: explicit
enforcement: example
decision_owner: project
side_effects: none
applies_to:
  - product releases
  - backend deployments
  - desktop app releases
  - mobile submissions
  - workflow or template system releases
use_when:
  - A set of changes is about to ship to users or production.
do_not_use_when:
  - The change is local documentation with no runtime or user effect.
outputs:
  - release risk summary
  - test matrix
  - migration checklist
  - support notes
  - post-release monitoring plan
case_sources:
  - devrules/workflows/release.md
  - DeGit/src/services/runtime-diagnostics.ts
  - FrameCast/docs/execution-plan
related_workflows:
  - devrules/workflows/release.md
  - devrules/workflows/production-change.md
last_reviewed: 2026-07-14
---

# Release Readiness

Release readiness ties engineering verification to user risk. It should be short enough to use and specific enough to catch real failures.

## Release Summary

Record:

- user-facing changes
- internal changes
- migrations
- feature flags
- dependencies changed
- risky areas
- rollback plan
- owner

## Risk Classes

- Low: copy, isolated UI, docs.
- Medium: shared component, route behavior, non-critical API.
- High: auth, billing, data migration, AI cost, backup/restore, permissions.
- Critical: destructive data path, payment state, production secrets, cross-tenant access.

Risk class determines test depth and approval.

When persistent state, contracts, mixed client versions, migration, or recovery are affected, create the machine-readable `production-change-plan.template.json` record and run the three gates in `devrules/workflows/production-change.md`. This checklist alone is not sufficient evidence for existing-user safety.

## Test Matrix

Include:

- unit tests
- integration tests
- lint/typecheck/build
- browser or UI smoke where relevant
- migration dry-run or validation
- permission checks
- billing/webhook tests
- i18n validation
- backup restore smoke for data changes

## Release Notes

Good notes separate:

- user-facing changes
- admin/operator changes
- migration or downtime notes
- known limitations
- support actions

## Post-Release Monitoring

Watch:

- error rate
- latency
- failed jobs
- payment webhook failures
- auth failures
- AI provider failures
- support tickets
- user conversion or usage for changed feature

Define when to roll back before deployment.

## Review Checklist

- Risk class is named.
- Checks match risk class.
- Migration and rollback are documented.
- Support/admin impact is clear.
- Monitoring signals are known.
- Any triggered production change plan passes its current stage gate.
