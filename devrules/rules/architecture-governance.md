---
description: Core rule for architecture-first feature development and cross-boundary change control.
ownership: shared
governs: agent
activation: conditional
enforcement: advisory
decision_owner: project
side_effects: none
---

# Architecture Governance

This rule applies before adding any medium or larger feature, broad behavior change, shared capability, or cross-boundary implementation.

Use it together with `modularity-and-dependencies.md` for dependency direction and public surfaces, and `change-health.md` for the no-new-debt ratchet. The ordinary implementation path remains `workflows/code-change.md`.

## Core Policy

New features must be designed in relation to the existing system before implementation. Do not default to stacking local patches when the request exposes a structural problem.

When a PRD, product brief, requirements document, research package, or redesign
defines user-facing capabilities, product domains, primary navigation, broad
journeys, ownership, or visible states, product architecture comes before
technical architecture. Run `workflows/product-architecture-review.md` and use
`templates/product-architecture-brief.md` before mapping the product into code
boundaries.

The product gate separates capability role from surface role, compares plausible
information architectures for broad product work, traces requirements through
capabilities, journeys, surfaces, and acceptance, and issues one
product-readiness verdict:

- `ready`
- `ready_with_reversible_assumptions`
- `blocked`

Do not enter Design Read, screen or surface specification, technical
architecture, or structural implementation when the verdict is `blocked`.
Technical architecture must not compensate for an undefined product model.

When an iOS/iPadOS change creates or materially changes persistence,
iCloud/CloudKit, authentication, data ownership, collaboration, sync, recovery,
deletion, or a server-owned user-data boundary, run
`workflows/ios-account-data-architecture.md` before committing to the affected
schema, identity, or migration contract. The project or user selects the data
topology; devrules does not prefer local-first, account-backed, or any provider
or key strategy. Block only the affected implementation while a material
ownership, privacy, data-integrity, migration, rollback, or recovery risk is
unresolved. A missing decision document is not itself a blocker, and purely
visual, copy-only, test-only, or mechanical changes need not create one.

Pure backend, infrastructure, protocol, or internal specifications that do not
change user capabilities, entry points, journeys, ownership, or visible states
record product-gate applicability as `not_required` and use the ordinary
architecture path. Applicability and readiness are separate; `not_required` is
not a readiness verdict.

Apply `first-principles-development.md` before choosing the architecture path. If the request starts from a failure, confusing behavior, or pressure to add a fallback, first identify the real problem and the boundary that should own the fix. A fallback or rollback is not an architecture solution unless the root cause is understood and explicit containment is the intended product or operational behavior.

Before implementation, classify the feature's relationship to current behavior:

- Reuse an existing module or service.
- Extend an existing boundary.
- Replace an obsolete path.
- Merge duplicated behavior.
- Isolate a platform, adapter, or integration concern.
- Refactor a boundary before adding the feature.

Check whether the current architecture can support the feature:

- Module boundaries and ownership.
- Data flow, state management, caching, and persistence.
- Auth, permissions, privacy, and safety boundaries.
- Platform differences and adapter seams.
- Existing reuse points and duplicate implementations.
- Public contracts, migrations, and compatibility needs.
- Test surface and verification cost.

If the feature crosses multiple modules, increases coupling, duplicates a core concept, or makes an overloaded module heavier, propose the smallest architecture adjustment first and then implement the feature through that shape.

If the product is already released and the change touches persistent state, public contracts, deployed clients, migrations, rollout, or recovery, also apply `production-change-governance.md` and `workflows/production-change.md`. Architecture fit does not by itself prove existing-user safety.

Only implement locally without an architecture review when the change is small, the boundary is clear, and the implementation does not add structural debt.

## Required Output For Medium+ Features

Before editing, state briefly:

1. Goal.
2. Constraints and existing boundaries.
3. Relationship to current features: reuse, extend, replace, merge, isolate, or refactor.
4. Minimal architecture approach.
5. Done criteria and checks.

For product-gated work, also state the gate artifact, product-readiness verdict,
and affected requirement, capability, journey, and surface IDs.

This can be short. The purpose is to force architectural thinking, not to create ceremony.

## Anti-Patterns

- Converting product-input sections or feature numbers directly into code
  modules, screens, or primary navigation.
- Using technical architecture to postpone an unresolved product model,
  ownership, scope, journey, or navigation decision.
- Adding another condition, fallback, or side path when the root issue is a confused boundary.
- Treating fallback, rollback, broad tolerance, or silent degradation as a substitute for solving the underlying design or contract problem.
- Copying feature logic into a second surface instead of extracting the shared behavior.
- Hiding new state in UI components when the domain or data layer owns it.
- Expanding a central module because it is convenient rather than correct.
- Treating broad feature work as a sequence of unrelated file edits.

## When Not To Use

Do not run a full architecture review for typo fixes, copy edits, isolated tests, dependency metadata, or narrow bug fixes with a known local root cause. If a small bug reveals a larger structural issue, escalate to this rule before the fix grows.
