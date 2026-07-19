---
title: Conflict Resolution
description: Pattern for sync conflicts, merge strategies, compare-and-swap, checkpoints, vector clocks, and conflict UI.
ownership: seed
governs: product
activation: conditional
enforcement: example
decision_owner: project
side_effects: none
applies_to:
  - collaborative data
  - multi-device sync
  - offline queues
  - document or project editors
use_when:
  - Multiple actors or devices can change the same data.
do_not_use_when:
  - Data is append-only or single-writer by design.
outputs:
  - conflict classification
  - merge policy
  - conflict UI plan
  - verification matrix
case_sources:
  - planner-v0 sync-v2 conflict and CAS verification scripts
  - DeGit sync conflict modal
  - structureUI domain model tests
  - NovelEditor review queue patterns
related_workflows:
  - devrules/workflows/debug-root-cause.md
last_reviewed: 2026-06-11
---

# Conflict Resolution

Conflict policy should be product-specific. Do not rely on last-write-wins unless the user impact is acceptable and documented.

## Conflict Types

- same field edited on two devices
- deleted remotely but edited locally
- permission changed while offline
- subscription/entitlement changed during pending operation
- schema version mismatch
- attachment or file path changed

## Merge Strategies

Options:

- last-write-wins
- field-level merge
- append-only merge
- compare-and-swap retry
- manual conflict UI
- preserve both copies
- reject local change with explanation

Choose per data type.

## Conflict UI

Conflict UI should show:

- local version
- remote version
- changed fields
- timestamps/devices
- suggested resolution
- manual choose/merge action
- discard option
- audit trace if needed

## Review Checklist

- Conflict strategy is defined per important data type.
- Permission and entitlement changes cannot be bypassed by offline replay.
- Manual conflict UI is available for high-value user content.
- Tests cover delete/edit, edit/edit, and schema mismatch cases.
