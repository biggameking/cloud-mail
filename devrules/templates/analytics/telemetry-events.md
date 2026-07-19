---
title: Telemetry Event Design
description: Pattern for event taxonomy, instrumentation boundaries, payload rules, privacy, retention, and event evolution.
ownership: seed
governs: product
activation: conditional
enforcement: example
decision_owner: project
side_effects: none
applies_to:
  - product analytics
  - operational telemetry
  - desktop event streams
  - AI usage logging
  - background job monitoring
use_when:
  - A project needs durable event contracts.
  - Multiple surfaces or services emit events for analytics or diagnostics.
do_not_use_when:
  - A local one-off debug log is enough.
outputs:
  - event taxonomy
  - payload contract
  - instrumentation boundary
  - privacy policy
  - evolution checklist
case_sources:
  - structureUI editor events and ops telemetry
  - DeGit desktop event and runtime diagnostics
  - magic-novel-forge rollout telemetry
  - html-to-image telemetry transport
  - AutoMedia desktop events
related_workflows:
  - devrules/workflows/debug-root-cause.md
last_reviewed: 2026-06-11
---

# Telemetry Event Design

Telemetry events are contracts. They should be stable enough for dashboards and diagnostics, but small enough to remain safe and understandable.

## Event Taxonomy

Common groups:

- user action
- feature milestone
- background job lifecycle
- AI request lifecycle
- export/import lifecycle
- billing or entitlement event
- auth/session event
- sync event
- error or incident event
- admin operation event

## Payload Rules

Each event should define:

- event name
- source boundary
- actor/workspace scope if allowed
- stable object identifiers
- status or result
- error category
- latency or duration when relevant
- version or schema marker
- privacy classification

Avoid raw prompts, private documents, full email bodies, full URLs with secrets, and provider keys.

## Instrumentation Boundary

Prefer events from durable boundaries:

- server action or API route
- background job runner
- provider adapter
- native bridge command
- export/import service
- sync engine

UI-only events are useful for interaction analysis, but they should not be the only evidence for completed work.

## Evolution Policy

- Add fields compatibly.
- Deprecate before removing.
- Version when semantics change.
- Keep old dashboard queries working during migration.
- Write tests for critical event names and payload shape when dashboards or billing depend on them.

## Review Checklist

- Event names are semantic and stable.
- Payloads avoid sensitive content.
- Emission boundaries are documented.
- Retention and access policy are known.
- Event changes are reviewed like API changes when downstream consumers exist.
