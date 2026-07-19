---
title: Offline Queue
description: Pattern for offline operation logs, pending queues, retries, status chips, background flush, and recovery.
ownership: seed
governs: product
activation: conditional
enforcement: example
decision_owner: project
side_effects: none
applies_to:
  - offline-capable apps
  - desktop apps
  - mobile apps
  - background job systems
use_when:
  - User actions can occur while disconnected or while remote services are unavailable.
do_not_use_when:
  - The product blocks all write actions until online.
outputs:
  - offline operation model
  - queue lifecycle
  - retry policy
  - UI state checklist
  - verification checklist
case_sources:
  - planner-v0 offline oplog and sync runner
  - NovelEditor offline queue probes
  - DeGit runtime job runners
  - SetMail SMTP queue
related_workflows:
  - devrules/workflows/debug-root-cause.md
last_reviewed: 2026-06-11
---

# Offline Queue

Offline queues turn user actions into durable pending operations. They need lifecycle, retry, visibility, and conflict behavior.

## Queue Item

A queue item usually records:

- operation ID
- actor/workspace
- operation type
- target object
- payload summary
- created time
- retry count
- status
- dependency or ordering key
- error category

## Lifecycle

Common states:

- pending
- flushing
- succeeded
- failed retryable
- failed permanent
- conflict
- cancelled

## UI Pattern

Users should see:

- offline status
- pending count
- last sync time
- failure reason
- retry action
- conflict resolution action

Avoid invisible background queues that silently lose user intent.

## Review Checklist

- Queue writes are durable before UI reports success.
- Retry is bounded and observable.
- Permanent failures have recovery actions.
- Queue replay is idempotent.
- Tests cover offline create, reconnect, duplicate replay, and conflict.
