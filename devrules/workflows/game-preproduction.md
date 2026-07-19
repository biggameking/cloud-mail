---
description: Convert a game idea into a bounded, testable production decision before feature development.
ownership: seed
governs: product
activation: conditional
enforcement: advisory
decision_owner: project
side_effects: local
---

# Game Preproduction

## Trigger

Run for a new game, a major direction reset, or before moving from exploration into production.

## Inputs

- Canonical V1 registry or candidate concept sources.
- Target audience and platform constraints.
- Available time, skills, budget, tools, and external dependencies.
- `templates/game/core/game-concept-brief.md`, `templates/game/core/stage-gates.md`, and `templates/game/core/prototype-experiment.md` templates.

## Responsibility Hats

- **Solo:** Creative sets the promise, Production enforces capacity, Engineering tests feasibility, QA defines evidence.
- **Team:** Product/Creative owns audience and promise; Design owns loop and pillars; Engineering owns feasibility; Art/Audio owns content constraints; Production owns stage gates; QA owns validation coverage.

## Steps

1. Write the player promise, target player, core loop, design pillars, and explicit non-goals.
2. Identify the few assumptions that could invalidate the project: fun, clarity, content cost, technical feasibility, performance, or market fit.
3. Rank assumptions by uncertainty multiplied by impact.
4. Define time-boxed prototypes that isolate the highest risks without production polish.
5. Set target platforms, input, accessibility, localization, hardware, performance, save, and distribution constraints.
6. Estimate content throughput using representative samples; distinguish recurring content cost from one-time system cost.
7. Define stages and evidence-based entry/exit gates. Reserve production for risks already reduced enough to justify durable implementation.
8. Build a capacity-aware milestone plan with contingency and explicit cuts.
9. Review go, revise, or stop. Record the decision in the canonical registry.

## Outputs

- Approved concept brief and non-goals.
- Ranked risk register and prototype plan.
- Stage-gate map and capacity model.
- Technical/content constraints and milestone cuts.
- Go/revise/stop decision.

## Gates

- The core loop can be stated as player actions and feedback, not feature nouns.
- Each pillar has observable evidence and each non-goal blocks foreseeable scope growth.
- Top risks have bounded experiments and decision thresholds.
- The first production stage fits declared capacity with contingency.
- Platform and content constraints are explicit enough to influence architecture.

## Done Criteria

The project has an approved, feasible direction; the riskiest unknowns have experiments; production gates are measurable; and the next stage can start without inventing scope during implementation.
