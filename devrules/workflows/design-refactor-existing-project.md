---
description: Refactor an existing product UI through proportionate, auditable boundaries without silently redefining product or protected behavior.
ownership: shared
governs: product
activation: conditional
enforcement: advisory
decision_owner: project
side_effects: local
---

# Workflow · design-refactor-existing-project（存量 UI 优化施工）

Use when an existing product needs real UI improvement rather than documentation
or token adoption alone. The workflow is design-system neutral: it follows the
project's active design authority and does not require `DESIGN.md`, Node scripts,
fixed artifact paths, a state machine file, or a numeric scorecard.

Business logic, API, data model, authentication, payment, storage, analytics, and
other non-UI contracts remain protected unless the user explicitly expands scope.

## 1. Choose the least disruptive mode

Derive mode from the requested outcome and evidence; there is no universal
default.

| Mode | Use when | Typical boundary |
| --- | --- | --- |
| `incremental` | Product structure works and debt is localized. | Semantic styles, components, states, accessibility, and focused hierarchy. |
| `hybrid` | One or more core surfaces need structural improvement while most product boundaries remain sound. | Selected flows/pages plus incremental standardization elsewhere. |
| `full_redesign` | Product/IA and visual system are explicitly in scope and current structure cannot support the goal. | Broad product and UI work after proportionate upstream decisions are resolved. |

Use product/architecture review only when a real capability, navigation, flow,
ownership, or high-risk contract decision is unresolved. Missing devrules
paperwork is not itself a stop condition.

## 2. Establish activation and protection

Classify the repository with `rules/design-agent-rules.md`. Locate the current
design authority, UI entry points, navigation, shared components, style/assets,
tests, preview path, protected directories, and user-visible behavior to retain.

Record a lightweight phase plan in the repository's existing task/design area or
the task itself. `docs/ui-refactor/`, devrules inventory scripts, state JSON, and
scorecard templates are optional aids only when the project has selected them.

## 3. Read-only intake and audit

Before structural edits:

- inventory high-value screens, flows, shared components, and duplicated roles;
- inspect authentic content, loading/empty/error/recovery/permission/offline
  states, adaptive layout, appearance modes, and accessibility;
- distinguish visual debt from product, data, or service problems;
- identify protected assets and current behavior that must survive.

Use project-native inventory/audit tools. A bundled devrules script may be used
only when its runtime/path is confirmed and the user selected that output; it is
not a prerequisite.

## 4. Build foundations only as needed

Create or repair semantic assets/styles and base components before broad page
replacement when that reduces repeated risk. In `devrules_managed` mode this may
include updating `DESIGN.md` and declared generated outputs. In
`project_native` mode use the existing asset, theme, component, and documentation
owners.

Do not add a token tool, UI framework, or package simply to match devrules. Each
new reusable component follows `design-new-component.md`.

## 5. Refactor in verifiable slices

Work one coherent page or flow at a time:

1. state the primary task, content priority, components, states, retained
   behavior, allowed changes, and rollback/revert boundary;
2. implement through shared owners without changing protected contracts;
3. run focused project-native checks and visually inspect representative content,
   devices/viewports, appearance modes, and accessibility;
4. capture unresolved debt before expanding to the next slice.

Secondary surfaces and edge states are included based on risk and requested
scope, not a mandatory fixed phase count.

## 6. Final review and handoff

Assess information hierarchy, consistency, authentic content, adaptive behavior,
state coverage, platform conventions, and accessibility. If the project already
uses a scorecard, apply its rubric; otherwise use evidence and unresolved-issue
severity. DevRules does not impose a numeric pass threshold.

Report what changed, what was preserved, commands and previews actually checked,
remaining debt, risks, and a safe revert point. Do not add compatibility wrappers
or silent fallbacks to hide a refactor defect; reduce scope or revert the failing
slice while preserving evidence.

## Completion

- Refactor mode and phase boundaries match the actual risk and request.
- Changed surfaces pass relevant project-native functional, visual, and
  accessibility verification with authentic content and states.
- Protected product/technical behavior did not change without authorization.
- Optional managed artifacts, commands, state files, and scorecards are `N/A`
  when not adopted.
