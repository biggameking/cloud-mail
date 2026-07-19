---
description: Workflow for evaluating medium+ features and cross-boundary changes before implementation.
ownership: shared
governs: agent
activation: conditional
enforcement: advisory
decision_owner: project
side_effects: local
---

# Architecture Change Review

Use this workflow before adding a medium or larger feature, changing behavior across modules, introducing shared infrastructure, or touching a boundary that other features depend on.

## Inputs

- User request and desired outcome.
- Product-architecture applicability, artifact, and verdict when the change
  originates from user-facing product inputs.
- Current project profile and nearest README anchors.
- Relevant module boundaries, contracts, workflows, and tests.
- Any known constraints from product, platform, data, auth, i18n, release, or deployment rules.

## Steps

1. Resolve the product-architecture branch.
   - If product inputs define user-facing capabilities, domains, navigation,
     broad journeys, ownership, or visible states, run
     `product-architecture-review.md` first.
   - Stop when its verdict is `blocked`.
   - If applicability is `not_required`, record why before continuing.
2. Define the goal, constraints, and done criteria.
3. Map the feature to existing behavior.
   - Reuse, extend, replace, merge, isolate, or refactor.
4. Identify the affected boundaries.
   - UI, state, domain logic, data access, adapters, permissions, background work, contracts, tests, and platform lanes.
5. Look for structural pressure.
   - Duplication, central-module growth, hidden dependencies, mixed responsibilities, or hard-to-test paths.
6. Choose the smallest architecture move that keeps the system clean.
   - Prefer existing patterns.
   - Add an abstraction only when it removes real duplication, isolates changing behavior, or makes extension safer.
   - Keep broad rewrites out of scope unless the feature cannot be implemented safely otherwise.
7. Implement through the chosen boundary.
8. Verify behavior with the closest relevant tests, lint, typecheck, build, or smoke checks.
9. Update README anchors or memory when the architecture shape, command surface, or durable decision changed.

## Review Checklist

- Does this feature fit an existing responsibility, or does it need a new boundary?
- Will this change make an already large file, module, component, or service heavier?
- Is there duplicated logic that should become a shared utility, service, hook, package, or adapter?
- Are state ownership, side effects, and data flow explicit?
- Are permissions, data safety, i18n, release, and platform differences accounted for when relevant?
- Can the change be tested at the right level without brittle setup?
- Is the proposed architecture adjustment smaller than the long-term debt it prevents?

## Output

For non-trivial work, include a short pre-edit note:

```text
Goal: ...
Constraints: ...
Architecture relationship: reuse/extend/replace/merge/isolate/refactor ...
Product architecture applicability: required / not_required
Product readiness: ready / ready_with_reversible_assumptions / blocked / N/A
Product architecture artifact: ...
Affected requirement / capability / flow / surface IDs: ...
Approach: ...
Done criteria: ...
```

Keep the note concise. If the feature is small and clearly local, say why local implementation is safe and proceed.

## When Not To Use

Skip this workflow for tiny local fixes, mechanical formatting, isolated documentation edits, and tests that do not change production structure. Use `debug-root-cause.md` first when the task is primarily a failure investigation.
