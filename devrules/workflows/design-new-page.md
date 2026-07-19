---
description: Compose an approved product surface from project-native design primitives and explicit states.
ownership: shared
governs: product
activation: conditional
enforcement: advisory
decision_owner: project
side_effects: local
---

# Workflow · design-new-page（新增页面、视图或大型区块）

## 1. Confirm the product boundary

Identify the page's primary task, entry/exit, content priority, states, and what
must not change. Use an existing product/IA baseline when one exists. Run a
Design Read only when the visual direction is materially open or the scope is a
broad redesign; run product review only for a real unresolved capability,
navigation, ownership, or high-risk flow decision. Missing devrules paperwork is
not itself a blocker.

Use the project's own page-spec convention. The devrules page template is an
optional aid; IDs, fixed document paths, and fields that the project does not use
may be `N/A` with a short reason.

## 2. Map to the active design system

Classify the repository using `rules/design-agent-rules.md` and inventory the
existing layout primitives, components, semantic styles/assets, navigation, and
platform patterns. Prefer those owners over page-local clones.

For each missing reusable component, use `design-new-component.md`. A managed
repository may update `DESIGN.md`; a project-native repository records durable
decisions in its own source of truth.

## 3. Build around authentic content and states

- Keep one clear primary task; secondary actions should reflect real priority.
- Use representative short, long, empty, restricted, loading, error, and recovery
  content as applicable rather than idealized placeholders.
- Preserve platform navigation, focus order, labels, touch targets, text scaling,
  reduced motion, and responsive/adaptive behavior.
- Do not expose API, database, cache, stack, or implementation explanations as
  product copy unless the target user genuinely needs that technical detail.

## 4. Verify with discovered commands

Run repository-native focused tests, lint/typecheck/build, visual tests, or
preview commands that actually exist. Managed design checks apply only when the
repository has adopted and declared them.

Inspect the primary path plus at least one relevant non-happy state on target
devices/viewports. Check appearance modes and accessibility behavior affected by
the change.

## Completion

- The page serves its stated primary task without silently changing product
  capability or ownership.
- Existing primitives were reused or deliberate component additions are owned.
- Authentic content, relevant states, adaptive layout, and accessibility were
  verified.
- Project-native acceptance evidence is complete; devrules-specific artifacts
  are explicitly `N/A` where not adopted.
