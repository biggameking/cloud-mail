---
description: Seed governance rule for evidence-driven game production with engine-neutral design and explicit Godot adaptation.
ownership: seed
governs: product
activation: conditional
enforcement: advisory
decision_owner: project
side_effects: none
---

# Game Development

Apply this rule when a project designs, prototypes, implements, tests, balances, packages, or releases a game. It supplements the general architecture, quality, performance, analytics, accessibility, localization, security, and release rules; it does not replace them.

## Operating Principles

1. Establish one editable source of truth for each fact. Mark prior drafts superseded instead of letting version labels decide authority.
2. Define stages by exit evidence, not dates or names. A prototype, vertical slice, content-complete build, and release candidate must each have explicit gates.
3. State every meaningful change as a player-facing hypothesis with observable acceptance evidence.
4. Keep game rules deterministic where practical. Rendering, presentation, platform services, persistence, and editor tooling should not own domain decisions.
5. Prefer small playable slices over disconnected systems. Every production increment should end in a runnable build or an explicitly time-boxed experiment.
6. Treat tuning data, assets, saves, telemetry, and build settings as versioned contracts with named owners.
7. Reproduce defects with build identity, platform, input steps, and random seed when applicable before fixing them.
8. Measure performance on representative hardware and scenes. Editor impressions are not release evidence.
9. Preserve player data through schema versions, migrations, atomic writes, and golden-save tests.
10. End milestones with a decision and a smaller next risk, not merely a list of completed tasks.

## Required Project Decisions

Before production begins, record locally:

- canonical documents and generated artifacts;
- target player, core loop, design pillars, exclusions, and success/failure signals;
- stage names with entry and exit gates;
- target engine version, platforms, input methods, hardware floor, and performance budgets;
- module ownership, scene/state boundaries, data-authoring path, save policy, and build channels;
- playtest cadence, defect severity policy, telemetry/privacy posture, and release authority.

Shared templates must not hard-code a project's engine version, identifiers, content, balance values, hardware targets, storefront, credentials, or release path.

## Change Contract

For a non-trivial game change, state before editing:

```text
Player outcome: ...
Hypothesis: ...
Scope and exclusions: ...
Affected contracts: ...
Evidence and budget: ...
Rollback or migration need: ...
```

Run the smallest matching workflow. Do not force every change through every game workflow.

## Quality Gates

A game change is not complete until the relevant evidence exists:

- **Design:** canonical intent and measurable acceptance are current.
- **Playable:** the behavior is reachable in a representative build.
- **Correct:** focused automated checks and manual play checks pass.
- **Stable:** persistence, determinism, and integration boundaries are checked when affected.
- **Performant:** relevant budgets pass on the declared target profile.
- **Shippable:** export, installation, input, accessibility, localization, licensing, and channel checks pass when affected.
- **Learned:** playtest or release evidence updates the decision log, backlog, or project memory.

## Responsibility Hats

One person may wear every hat, but must make each decision explicitly.

| Hat | Responsibility |
| --- | --- |
| Product/Creative | Player promise, pillars, scope, and priority. |
| Design | Rules, content, balance, onboarding, and playtest hypotheses. |
| Engineering | Architecture, tools, data contracts, persistence, performance, and builds. |
| Art/Audio | Asset direction, technical constraints, provenance, integration, and quality. |
| QA | Reproduction, risk coverage, regression evidence, and release recommendation. |
| Production | Stage gates, dependencies, capacity, decision log, and risk retirement. |
| Release | Versioning, packaging, channel configuration, backup, and go/no-go authority. |

## Anti-Patterns

- Treating the newest filename as canonical without reconciling its claims.
- Calling a feature done because its isolated scene works in the editor.
- Building reusable architecture before the core risk has been prototyped.
- Tuning several variable families at once without a baseline or replayable scenario.
- Editing generated data or imported assets as if they were authoritative sources.
- Hiding nondeterminism, save corruption, missing assets, or performance regressions behind retries or broad fallbacks.
- Expanding scope to rescue a weak playtest result instead of examining the hypothesis.
- Releasing from an unrecorded editor state or an unrepeatable local export.

## Related Workflows

- `game-source-of-truth.md`
- `game-preproduction.md`
- `game-design-change.md`
- `game-prototype-playtest.md`
- `godot-module-architecture.md`
- `game-data-balance.md`
- `game-asset-integration.md`
- `game-qa-regression.md`
- `game-save-compatibility.md`
- `game-performance-profiling.md`
- `godot-export-release.md`
- `game-retrospective.md`
