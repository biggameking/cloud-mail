---
description: Add or extend a UI component under the project's design contract and component inventory.
ownership: shared
governs: product
activation: conditional
enforcement: advisory
decision_owner: project
side_effects: local
---

# Workflow · design-new-component（新增或扩展组件）

Use when a reusable UI component or an existing component variant is needed.

## 1. Confirm the project's system

Classify design tooling using `rules/design-agent-rules.md`, then locate the
project's component directory, public component API, design guidance, tests, and
platform conventions. A missing `DESIGN.md` is normal in `project_native` mode.

## 2. Check reuse before adding surface area

In order:

1. reuse an existing component as-is;
2. extend an existing component with a coherent variant or size;
3. add a new component only when anatomy, behavior, or semantic responsibility
   is materially different.

Do not create a near-duplicate in feature code. Do not stretch an existing
component into unrelated responsibilities merely to avoid a new type.

## 3. Define the contract

Use the repository's existing component documentation or test convention to
record the necessary anatomy, variants, sizes, states, semantic styling,
accessibility, usage, and non-goals. In `devrules_managed` mode the project may
use `templates/design-component-spec.md` and register the result in its active
`DESIGN.md`; otherwise those artifacts are `N/A`.

Include only states the component can actually enter. Cover focus or platform
navigation, disabled and loading semantics, labels, text scaling, and motion
preferences where applicable.

## 4. Implement through project-native boundaries

Follow the project's component location, naming, style source, and dependency
policy. Use its semantic assets/tokens when they exist. Do not introduce a token
generator, component library, or package dependency just because a devrules
template mentions one.

If the project has generated design artifacts, update their confirmed source and
run the declared generator; never hand-edit outputs.

## 5. Verify

Discover and run the relevant repository commands: focused component tests,
typecheck/build/lint, design checks if adopted, and the closest preview or visual
test. Inspect representative content and all affected states at appropriate
sizes and appearance modes.

## Completion

- Reuse/variant/new-component choice is justified by the actual component API.
- The implementation and documentation/tests agree on behavior and states.
- Accessibility and representative visual states were checked.
- No unrequested tool, hook, CI workflow, or parallel design source was added.
