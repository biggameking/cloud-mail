---
title: Test Strategy
description: Pattern for selecting unit, integration, contract, E2E, visual, performance, migration, and smoke tests by risk.
ownership: seed
governs: agent
activation: conditional
enforcement: example
decision_owner: project
side_effects: none
applies_to:
  - feature work
  - refactors
  - release preparation
  - platform integrations
use_when:
  - A change needs tests or verification beyond manual inspection.
do_not_use_when:
  - The change is documentation-only and has no runtime behavior.
outputs:
  - test layer selection
  - risk-based matrix
  - fixture strategy
  - regression checklist
case_sources:
  - DeGit runtime job runner tests
  - FrameCast export tests
  - structureUI domain tests
  - NovelEditor QA probes
  - planner-v0 sync verification scripts
related_workflows:
  - devrules/workflows/debug-root-cause.md
last_reviewed: 2026-06-11
---

# Test Strategy

Choose tests by risk and boundary.

## Test Layers

- unit: pure logic and small adapters
- integration: service plus storage/provider boundary
- contract: API, IPC, schema, event, import/export, sync
- E2E: critical user journeys
- visual: UI layout and responsive risk
- performance: budgets and regressions
- migration: data shape and rollback assumptions
- smoke: release sanity

## Risk Matrix

High-risk changes need more than one layer:

- auth and permissions
- billing and credits
- data migration
- sync and offline queues
- provider integrations
- native bridge commands
- backup/restore
- AI route costs or prompt publication

## Fixture Strategy

Good fixtures are:

- small
- named by behavior
- versioned when format matters
- safe to share
- easy to regenerate

## Review Checklist

- Tests cover the boundary being changed.
- Failure modes are tested, not only happy paths.
- Contract tests protect downstream consumers.
- Visual checks exist for layout-sensitive UI.
- Smoke tests match release risk.
