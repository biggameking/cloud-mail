---
description: Explicitly initialize a devrules-managed design system for a new project.
ownership: shared
governs: product
activation: conditional
enforcement: advisory
decision_owner: project
side_effects: local
---

# Workflow · design-init-new-project（显式初始化托管设计体系）

## Activation

Use only when the user or repository owner explicitly chooses to establish a
devrules-managed design system. A new project does not automatically require
`DESIGN.md`, Node, Tailwind, shadcn, `designmd`, npm scripts, hooks, or hosted CI.
If the project already has a design system, prefer it or use
`design-adopt-existing-project.md` for a deliberate migration.

## 1. Confirm fit and boundaries

Record the target platform/stack, existing design assets, source-of-truth choice,
package/task runner, generated-file policy, and the requested adoption scope.
Use `design-read.md` only if product/design direction is materially open.

Before writing, present the managed artifacts to be introduced and confirm they
do not compete with an existing authority. Keep Agent instructions centralized:
the repository Agent entry points to devrules and does not receive a copy of this
rule body.

## 2. Establish only the selected artifacts

Possible managed artifacts include:

- a project-owned `DESIGN.md` created from a suitable template;
- a project-owned design changelog when durable design history is useful;
- `design.config.json` and generated semantic assets when the selected stack can
  consume them;
- component specifications and project-native documentation links.

These are options, not a universal bundle. Record omitted items as `N/A`.
Templates are starting points and must be adapted to the project; do not install
frameworks or replace existing components to match a template.

## 3. Integrate with the existing task runner

Inspect the repository's manifests first. If the owner chooses the bundled
devrules scripts, map sync/check/lint/guard tasks into the repository's existing
runner and naming convention. Do not assume npm and do not add `designmd` or any
other dependency unless explicitly approved.

Run the exact commands now declared by the project and review their output.
Generated files must have one documented source and a repeatable check mode.

## 4. Integrate components incrementally

Connect semantic assets/tokens to the existing UI stack without replacing
unrelated configuration. Add or migrate primitives only as required for the
requested first surfaces; use `design-new-component.md` for reusable additions.
Verify that current UI remains visually and behaviorally intact unless a redesign
was explicitly requested.

## 5. Optional automation

Local hooks and hosted CI are separate choices. Explain their write/execution
boundary and obtain the normal approval before installing a hook or creating an
external workflow. Initialization is complete without either one when the
project does not want them.

## Completion

- Explicit adoption and the chosen artifact/tool boundary are recorded.
- There is one authoritative design source, with no copied Agent rule body.
- Declared project-native commands regenerate/check outputs repeatably without an
  unapproved dependency.
- Representative UI and accessibility behavior were verified.
- Hooks, CI, changelog, templates, and managed checks are `N/A` where not chosen.
