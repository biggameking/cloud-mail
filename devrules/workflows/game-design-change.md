---
description: Evaluate and govern player-facing game design changes without uncontrolled scope growth.
ownership: seed
governs: product
activation: conditional
enforcement: advisory
decision_owner: project
side_effects: local
---

# Game Design Change

## Trigger

Run for a new mechanic, rule change, content family, economy change, onboarding change, or any request that alters the player experience beyond a small correction.

## Inputs

- Canonical design pillars, loop, stage scope, and current backlog.
- Observed player problem or opportunity with evidence.
- Relevant feature, tuning, telemetry, save, content, and technical contracts.
- `templates/game/core/feature-brief.md`.

## Responsibility Hats

- **Solo:** Design writes the hypothesis, Production challenges scope, Engineering maps cost, QA makes acceptance falsifiable.
- **Team:** Design owns intent; Product/Creative owns priority; Engineering and Art/Audio estimate impact; QA owns verification; Production approves displacement and schedule.

## Steps

1. Describe the player problem and evidence without prescribing a feature.
2. State the hypothesis, target player behavior, acceptance signal, and failure signal.
3. Check alignment with pillars, non-goals, current stage, and accessibility needs.
4. Map affected rules, UI, content, assets, data, saves, telemetry, performance, localization, and tests.
5. Compare the smallest viable options, including changing or removing existing behavior.
6. Name what the change displaces. No material scope enters a fixed milestone without an equal cut or explicit replan.
7. Define a prototype or implementation slice, budget, rollback/migration plan, and evidence window.
8. Decide `accept`, `experiment`, `defer`, or `reject`; update canonical documents before implementation.

## Outputs

- Decision-ready feature brief.
- Impact and dependency map.
- Acceptance/failure signals and test plan.
- Scope displacement or milestone replan.
- Recorded decision and canonical updates.

## Gates

- The request is tied to an observed player outcome.
- Acceptance is measurable in a build or playtest.
- Cross-domain impacts and compatibility needs are named.
- Priority cost is explicit.
- The decision has one accountable owner and review point.

## Done Criteria

The design decision is recorded, canonical sources agree, scope is funded, affected contracts have owners, and implementation can proceed from observable acceptance rather than interpretation.
