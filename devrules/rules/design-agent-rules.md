---
description: Classify design work as project-native or devrules-managed and route it to the correct design workflow.
ownership: shared
governs: product
activation: conditional
enforcement: advisory
decision_owner: project
side_effects: none
---

# Design Work Governance

This rule governs how an Agent works with a repository's design system. It does
not require a particular design-system format, package manager, token generator,
component library, scorecard, or Agent entry file.

## Always Applicable

For every UI change:

1. Treat the repository's existing design guidance, components, platform
   conventions, and product decisions as the authority. Do not create a parallel
   design system merely because devrules contains one.
2. Preserve accessibility: keyboard or platform navigation, focus, labels,
   contrast, touch targets, text scaling, reduced motion, and meaningful states
   must remain appropriate to the target platform and changed surface.
3. Use authentic product content and representative data. Do not ship lorem
   ipsum, fabricated metrics or endorsements, internal implementation detail,
   or generic AI marketing filler as product copy.
4. Verify the changed surface in proportion to risk. Use the project's existing
   tests and preview path, then inspect representative content, states, viewport
   or device sizes, and appearance modes when they are affected.
5. Keep product capability, navigation, data behavior, and service contracts
   outside a visual-only change unless the user explicitly expands scope.

These are outcome requirements. They do not prescribe the files or commands a
project must use to satisfy them.

## Design Tooling Activation Contract

Before using any managed-design instruction, classify the repository:

| Mode | Evidence | Agent behavior |
| --- | --- | --- |
| `project_native` | The project has its own design docs, component system, platform conventions, scripts, or no declared managed tooling. This is the safe default when evidence is unclear. | Follow the repository's own process. `DESIGN.md`, `designmd`, `design:*` scripts, devrules design hooks, generated token files, changelog, scorecards, and fixed artifact paths are `N/A`. Do not create them. |
| `devrules_managed` | Repository guidance or configuration explicitly adopts the devrules design system, or an existing `DESIGN.md` plus its declared config/scripts is confirmed as active. | Treat the project's managed artifacts as authoritative and run only commands actually declared by that repository. |
| `adoption_task` | The user explicitly asks to initialize, adopt, port, apply, or extract a devrules design system/style. | The matching adoption workflow may propose or create managed artifacts within the requested scope. New dependencies, hooks, hosted CI, and broad migration still require their normal approval and fit checks. |

A lone template file, an unused script, or the presence of `devrules/` is not
enough to infer adoption. If activation matters and repository evidence
conflicts, report the ambiguity and continue with safe project-native work until
the user or repository owner resolves it.

Do not copy this rule body into `AGENTS.md`, `CLAUDE.md`, `WARP.md`, or another
Agent entry. Agent entries point to the authoritative devrules entry; project
design facts remain in the project's chosen design source.

## Command Discovery

Never assume `npm`, `designmd`, or a `design:*` script exists.

1. Read the nearest repository guidance and package/task manifests.
2. Discover the relevant formatter, lint, token sync/check, component test,
   build, preview, and accessibility commands already declared by the project.
3. Run only the smallest relevant discovered set. If an expected managed command
   is absent, mark it `N/A` or use an existing equivalent; do not install a tool
   or invent a package script solely to satisfy this rule.
4. A workflow may name a bundled devrules script when the user has explicitly
   selected that workflow. Treat command snippets as examples until their path,
   runtime, and adoption are confirmed in the target repository.

## Working With Existing Systems

- Reuse existing primitives before adding a near-duplicate. Add a variant or a
  new component only when it represents a real, reusable semantic difference.
- Make visual values consistent through the project's chosen mechanism: native
  platform assets, semantic tokens, theme variables, component variants, or
  another established source. Literal values may be valid for brand assets,
  charts, third-party embeds, or platform-specific cases; document exceptions in
  the repository's normal place when one exists.
- Do not edit generated artifacts directly. First confirm that a file is
  generated and locate its declared source and regeneration command.
- Record durable design decisions in the project's existing source of truth. In
  `devrules_managed` mode that may be `DESIGN.md`; in `project_native` mode it may
  be code, asset catalogs, Figma-linked docs, ADRs, or component documentation.

## Content Quality

Prefer concise interface copy that helps the user act or understand their own
data. Remove placeholder text, internal API/database/cache explanations, empty
headings, redundant feature tutorials, and unsupported claims. Legitimate
exceptions include concise empty-state guidance, format or consequence help,
accessible labels, onboarding the user requested, and evidence-backed marketing
content.

Judge copy in context: removing it should not make the task, consequence, state,
or accessibility meaning less clear.

## Workflow Routing

Use only the smallest applicable workflow:

- Direction is materially open or a broad redesign is requested:
  `design-read.md`.
- Existing visual treatment changes: `design-change.md`.
- A component or page is added: `design-new-component.md` or
  `design-new-page.md`.
- An existing UI is being audited or refactored: `design-audit.md` or
  `design-refactor-existing-project.md`.
- The user explicitly requests managed-system adoption, initialization, porting,
  style extraction, or style application: the matching adoption workflow.

Missing devrules-specific paperwork alone never blocks a project-native UI
change. Escalate only for a real unresolved product, safety, accessibility,
authorization, or data-integrity decision.

## Completion Evidence

Report:

- the activation mode and evidence used;
- the project-native or managed design source followed;
- the discovered checks actually run and their fresh result;
- the representative surfaces, content, states, devices/viewports, and
  accessibility behavior inspected;
- any `N/A` managed artifacts or checks and why they were not applicable.

Fixed review scores are advisory only when a project has explicitly adopted the
matching rubric. Acceptance otherwise depends on the project's own criteria and
the observed severity of unresolved issues, not a devrules-wide numeric cutoff.
