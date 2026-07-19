---
description: Protect game saves with explicit schemas, migrations, corruption handling, and golden-save compatibility tests.
ownership: seed
governs: product
activation: conditional
enforcement: advisory
decision_owner: project
side_effects: local
---

# Game Save Compatibility

## Trigger

Run when save fields, stable IDs, progression, inventory, world state, settings, platform storage, encryption, or serialization behavior changes; and before a release that must load older saves.

## Inputs

- Current and prior save schemas with supported version range.
- Golden saves, corrupted/truncated cases, platform paths, and data-retention policy.
- Change impact and `templates/game/core/save-schema-migration.md`.

## Responsibility Hats

- **Solo:** Engineering owns schema/migration; Design validates preserved intent; QA owns golden/corruption coverage; Release approves compatibility range.
- **Team:** Data/gameplay engineering owns schema; domain owners map semantics; QA owns matrix; platform engineering owns storage adapter; Release owns support policy.

## Steps

1. Inventory persisted fields, stable IDs, invariants, defaults, and external platform state.
2. Assign an explicit schema version and define supported source versions.
3. Design small, ordered migrations from one version to the next; keep runtime loading separate from migration logic.
4. Preserve unknown or removed meaning deliberately; never guess silently when player progress could be lost.
5. Write atomically using temporary data, validation, replacement, and recoverable backup appropriate to the platform.
6. Test clean creation, round trip, every supported golden save, chained migration, interrupted write, invalid data, disk/storage failure, and downgrade policy.
7. Validate gameplay invariants after load, not only successful parsing.
8. Record migration telemetry or diagnostics without exposing private player data.
9. Approve the compatibility matrix and recovery messaging before release.

## Outputs

- Versioned schema and ordered migration plan.
- Golden-save and corruption fixture matrix.
- Atomic-write/recovery evidence.
- Compatibility and downgrade policy.

## Gates

- Save data contains a detectable schema version.
- Every supported historical version reaches current through tested steps.
- Failed migration cannot overwrite the last known-good save.
- Post-load gameplay invariants pass.
- Unsupported or corrupt data produces an explicit, recoverable outcome.

## Done Criteria

All supported golden saves load into valid current state, new saves round-trip, interruption/corruption tests preserve recovery, and release notes accurately state compatibility and downgrade limits.
