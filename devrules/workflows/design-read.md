---
description: Risk-based visual and interaction direction review that respects the project's active design system.
ownership: shared
governs: product
activation: conditional
enforcement: advisory
decision_owner: project
side_effects: local
---

# Workflow · Design Read（风险分级的设计定调）

Use when visual/interaction direction is materially open: a new product surface,
broad redesign, unfamiliar platform, multiple plausible approaches, or a change
whose visual decisions affect several downstream surfaces. Narrow copy fixes,
known component states, and small changes inside an established system normally
do not need a separate Design Read.

A missing Design Read artifact alone never blocks safe project-native work.

## Inputs

- User goal, target users, platform, current product stage, and scope.
- Authentic content, usage frequency, core tasks, and relevant states.
- Current production UI, components, design guidance, and debt evidence.
- Approved product/IA decisions when the change depends on them.
- Activation mode from `rules/design-agent-rules.md`.

## 1. Resolve only real upstream uncertainty

If the request genuinely changes product capability, primary navigation,
surface ownership, a broad user journey, or another high-risk product decision,
use the proportionate product review before committing to UI structure. Missing
IDs or a template are not blockers by themselves; an unresolved decision that
would make implementation unsafe is. 当已有产品评审 verdict 为 `blocked` 时停止
受阻的结构性边界；不受该 blocker 影响的只读调查或独立施工可以继续。

Design Read consumes settled product boundaries. If visual exploration reveals a
real product conflict, document it and return to the decision owner instead of
silently choosing in UI code.

## 2. Choose review depth

- **light**: one established surface or constrained component family; capture
  goal, existing pattern, content/state risks, and verification approach.
- **standard**: a new page or substantial flow inside a known product; compare
  relevant patterns and define hierarchy, density, states, and component reuse.
- **full**: a new product, broad redesign, or multiple plausible visual systems;
  compare concrete directions, include counterexamples, and validate against
  representative content and platform constraints.

Use `templates/design-read.md` only when its structure helps. Store the result in
the project's existing design/decision location or in the task/PR. Fixed paths
and unused fields may be `N/A`.

## 3. Ground the direction

For the chosen depth, make the following explicit where relevant:

- the primary user task and content priority;
- information density and layout reasons based on use, not taste adjectives;
- project-native components, assets, and platform conventions to preserve;
- authentic long/short/empty/error/restricted content and recovery behavior;
- responsive/adaptive behavior, appearance modes, accessibility, and motion;
- concrete references and an anti-reference for full reviews;
- what this task must not change.

In `devrules_managed` mode map durable visual decisions into the active
`DESIGN.md`. In `project_native` mode use the project's own source; do not create
a managed design file.

## 4. Route to construction

Choose the smallest matching workflow: focused change, component, page,
incremental refactor, audit, or an explicitly requested adoption workflow. Do
not make adoption a prerequisite for construction.

## Verification

Validate the selected direction with representative content and at least the
primary path plus a relevant recovery/state case. Use target devices/viewports
and the project's own preview/testing path. Confirm the design does not introduce
unapproved product capability or navigation.

## Completion

- Review depth and its risk reason are explicit.
- The direction follows the active project design system and settled product
  boundaries.
- Authentic content, states, accessibility, and target-platform behavior are
  addressed in proportion to risk.
- A concrete construction/verification route exists; optional devrules artifacts
  are `N/A` where not useful or adopted.
