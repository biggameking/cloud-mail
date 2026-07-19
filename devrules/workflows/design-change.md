---
description: Change existing visual or interaction design within the project's established design contract.
ownership: shared
governs: product
activation: conditional
enforcement: advisory
decision_owner: project
side_effects: local
---

# Workflow · design-change（调整现有视觉与交互）

Use this workflow for a focused visual, interaction, state, or copy change. It
does not require a repository to adopt devrules managed design tooling.

## 1. Confirm activation and scope

Classify the repository using `rules/design-agent-rules.md`.

- `project_native`: locate the existing theme, asset catalog, style definitions,
  component variants, or design documentation that owns the decision.
- `devrules_managed`: confirm the active `DESIGN.md`, declared generated files,
  and repository-defined design checks.
- If the task would change product capability, navigation, data behavior, or a
  broad user journey, stop treating it as a visual-only change and route to the
  appropriate product/architecture review.

Record what should remain unchanged, especially authentic content, accessibility
behavior, platform conventions, and existing brand assets.

## 2. Locate the decision owner

Change the narrowest authoritative source:

- a shared semantic value or asset when the intended effect is global;
- a component variant or local style owner when the effect is intentionally
  scoped;
- prose or component documentation when usage rules changed;
- `DESIGN.md` only in an active managed-design repository.

Do not edit a generated artifact or repeat the same literal across call sites.
Also do not force every legitimate one-off value into a token: brand, chart,
third-party, and platform-specific values may have a documented local owner.

## 3. Inspect impact before broad replacement

Use repository-native search, dependency information, previews, or an existing
design diff tool to identify consumers of the changed source. If the repository
already declares a `designmd` or token-diff command, it may be used; do not invoke
`npx` or install a package merely to obtain a diff.

If an unrelated surface changes, split the semantic role or reduce the scope.
Do not hide the unwanted effect with an unowned override.

## 4. Verify

Discover checks from the repository rather than assuming package-manager design
aliases. Run the smallest relevant set, which may include native lint/build/tests,
token sync/check, component tests, and a preview.

Visually inspect affected surfaces with representative content and relevant
states. Include appearance modes, viewport/device sizes, text scaling, keyboard
or platform navigation, and reduced motion when the change can affect them.

## Completion

- The intended visual/interaction change is owned by the project's existing
  design source and has no unexplained collateral effect.
- Generated files, if any, were regenerated only through the repository's
  declared command.
- Relevant project-native checks and visual/accessibility inspection passed, or
  limitations are explicit.
- Managed artifacts and commands are recorded as `N/A` when the project has not
  adopted them.
