---
title: Game Save Schema Migration
description: Form for versioned save changes, ordered migrations, recovery, and compatibility evidence.
ownership: seed
governs: product
activation: conditional
enforcement: example
decision_owner: project
side_effects: none
last_reviewed: 2026-07-13
---

# Save Schema Migration

## Contract

- Current schema version:
- Supported source versions:
- Unsupported/downgrade policy:
- Storage platforms/paths/adapters:
- Privacy/security considerations:

## Change

| Field/stable ID | Old meaning/type | New meaning/type | Default/invariant | Migration risk |
| --- | --- | --- | --- | --- |
| | | | | |

## Ordered Migration

| From → To | Transform | Validation | Failure/recovery | Idempotence |
| --- | --- | --- | --- | --- |
| | | | | |

## Fixture Matrix

| Fixture | Source version/state | Expected result | Post-load gameplay invariant | Status |
| --- | --- | --- | --- | --- |
| Fresh save | current | | | |
| Golden prior save | | | | |
| Chained oldest supported | | | | |
| Truncated/corrupt | invalid | recoverable explicit outcome | | |
| Interrupted write | current | last known-good preserved | | |

## Approval

- Atomic-write/backup procedure:
- Diagnostics without private data:
- Engineering, Design, QA, Release approval:
- Verified build and artifact references:
