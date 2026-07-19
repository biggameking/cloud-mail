---
description: Govern authored game data, deterministic generation, validation, tuning experiments, and balance decisions.
ownership: seed
governs: product
activation: conditional
enforcement: advisory
decision_owner: project
side_effects: local
---

# Game Data And Balance

## Trigger

Run when adding or changing tuning values, progression, economy, difficulty, spawn tables, loot, content records, formulas, or authored/generated data pipelines.

## Inputs

- Canonical design intent and balance goals.
- Editable data source, schema, generator, validators, and current baseline.
- Representative scenarios, fixed seeds, telemetry, and `templates/game/core/tuning-note.md`.

## Responsibility Hats

- **Solo:** Design owns intent; Data/Engineering owns pipeline integrity; QA owns boundary and regression scenarios.
- **Team:** Systems design owns model; data/tools engineering owns schema/generation; analytics supports evidence; QA owns validation; Product approves economy-impacting changes.

## Steps

1. Confirm the editable source and generated outputs. Never hand-edit a generated artifact.
2. Version stable IDs, field semantics, units, defaults, ranges, references, and compatibility rules.
3. Validate schema, uniqueness, foreign keys, ranges, formulas, completeness, localization keys, and asset references.
4. Capture a baseline using representative scenarios and fixed seeds where randomness matters.
5. State the player outcome and change one coherent variable family at a time.
6. Generate artifacts deterministically and record source revision, tool version, and output diff.
7. Run automated simulations/checks, then playtest for feel and emergent behavior.
8. Inspect segment effects, exploits, degenerate strategies, pacing, accessibility, and save compatibility.
9. Accept, revise, or revert the tuning note; update canonical data and regenerate all outputs.

## Outputs

- Validated canonical data and deterministic generated artifacts.
- Baseline and tuning note with before/after evidence.
- Compatibility, exploit, and regression results.
- Accepted/revised/reverted decision.

## Gates

- One editable source owns every value.
- Generation is deterministic and stale outputs are detectable.
- Stable IDs and references survive ordering and display-name changes.
- The change has a baseline, bounded hypothesis, and representative evidence.
- Relevant saves, content, localization, and assets remain valid.

## Done Criteria

Canonical data and generated outputs agree, validators pass, the tuning decision is evidence-backed and reversible, and regression scenarios establish that unrelated systems did not drift unexpectedly.
