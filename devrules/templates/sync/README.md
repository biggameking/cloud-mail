---
title: Sync Domain Templates
description: Index for local-first data, offline queues, cloud/LAN sync, import/export, and conflict resolution.
ownership: shared
governs: product
activation: conditional
enforcement: example
decision_owner: project
side_effects: none
applies_to:
  - desktop apps
  - mobile apps
  - offline-capable web apps
  - multi-device products
  - data import/export tools
use_when:
  - Data must move across devices, offline queues, local stores, cloud stores, or import/export boundaries.
do_not_use_when:
  - The app is purely online and has no import/export or offline behavior.
outputs:
  - sync topology
  - offline queue plan
  - conflict policy
  - import/export contract
case_sources:
  - planner-v0 sync-v2 and platform sync docs
  - DeGit cloud/LAN sync and backup modules
  - structureUI offline workspace cache
  - SetMail local storage and backup
  - NovelX cloud sync and local backup panels
related_workflows:
  - devrules/workflows/backup-maintenance.md
  - devrules/workflows/debug-root-cause.md
last_reviewed: 2026-06-11
---

# Sync Domain Templates

Sync is a product contract. Decide what is authoritative, what is optional, what is per-device, and how conflicts are resolved before writing transport code.

## Templates

| Template | Use For |
| --- | --- |
| `local-first-sync.md` | Local-first data, remote authority, per-device settings, cloud/LAN split. |
| `offline-queue.md` | Offline operation log, pending queues, retries, resumability. |
| `conflict-resolution.md` | Merge strategy, conflict UI, CAS/vector/checkpoint style decisions. |
| `import-export.md` | Import/export contracts, manifests, validation, roundtrip checks. |
