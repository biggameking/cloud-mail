---
description: Run time-boxed game prototypes and unbiased playtests that end in explicit product decisions.
ownership: seed
governs: product
activation: conditional
enforcement: advisory
decision_owner: project
side_effects: local
---

# Game Prototype And Playtest

## Trigger

Run when a design, usability, feasibility, content-cost, or performance assumption needs evidence before durable production work.

## Inputs

- One ranked uncertainty and a falsifiable hypothesis.
- Prototype budget, participant profile, representative scenario, and decision threshold.
- `templates/game/core/prototype-experiment.md` and `templates/game/core/playtest-report.md` templates.

## Responsibility Hats

- **Solo:** Design defines the hypothesis; Engineering builds the smallest probe; Research/QA observes without coaching; Production stops the time box.
- **Team:** Design owns hypothesis; Engineering/Art builds the probe; Research or QA runs sessions; Production enforces budget; Product/Creative makes the decision.

## Steps

1. Isolate one primary question and define success, failure, and inconclusive thresholds.
2. Choose the cheapest credible prototype: paper, spreadsheet, graybox, scripted scene, instrumented build, or content sample.
3. Freeze the test build, seed, scenario, script, and capture method.
4. Recruit representative participants; note prior knowledge and conflicts.
5. Run an internal smoke test, then sessions without teaching behavior the game must communicate itself.
6. Capture observations separately from interpretation: actions, timing, errors, quotes, telemetry, crashes, and performance.
7. Compare evidence with thresholds and segment exceptional cases.
8. Decide `keep`, `iterate`, `kill`, or `inconclusive`. Do not continue because the prototype already consumed effort.
9. Archive evidence, update canonical decisions, and discard or explicitly productionize prototype code.

## Outputs

- Frozen experiment definition and build identity.
- Raw observations and synthesized playtest report.
- Keep/iterate/kill/inconclusive decision.
- Follow-up risk, design change, or productionization tasks.

## Gates

- The prototype tests one primary uncertainty within a fixed budget.
- Participants and scenario match the question.
- Moderator intervention and instrumentation limitations are recorded.
- Observations can be distinguished from conclusions.
- Prototype code has an explicit disposal or hardening decision.

## Done Criteria

The evidence is reproducible enough to review, the decision threshold has been applied, canonical plans reflect the outcome, and no ambiguous prototype implementation silently becomes production architecture.
