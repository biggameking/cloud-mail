---
description: Universal rules for cohesive modules, explicit public surfaces, and enforceable dependency direction.
ownership: shared
governs: agent
activation: conditional
enforcement: advisory
decision_owner: project
side_effects: none
---

# Modularity And Dependencies

Apply this rule when adding a file, module, package, service, shared utility,
integration, public API, or dependency between existing areas.

## Boundary First

Do not force one architecture pattern onto every repository. First identify the
project's existing semantic boundaries and the responsibility that should own
the behavior. Prefer a modular monolith or the project's current structure over
new processes, services, packages, or abstraction layers without demonstrated
pressure.

Every meaningful module should have:

- one coherent responsibility;
- an identifiable owner or owning layer;
- a small public surface;
- explicit dependencies and side effects;
- tests at the boundary where behavior matters.

## Dependency Direction

Use the repository's architecture and language/package visibility as the first
source of truth. The following are boundary heuristics, not a requirement to
introduce Domain-Driven Design or a `domain/application/infrastructure` layer:

- When the project separates UI/transport from application or domain behavior,
  keep business rules, authorization, and persistence ownership out of ad hoc
  view/controller glue.
- When a stable core/domain boundary exists, avoid making it depend directly on
  concrete UI or replaceable provider details unless that dependency is an
  intentional project convention.
- Put provider and platform details behind a narrow adapter when doing so keeps
  multiple callers from duplicating a volatile protocol. One local caller does
  not require an adapter by itself.
- Use a module's public entry point when it declares a stable public boundary.
  A deep import is a problem when it bypasses package visibility or couples a
  consumer to another owner's private implementation; it can be legitimate
  inside one cohesive module or where repository tooling/conventions require it.
- Treat dependency cycles as a design signal. Resolve accidental ownership
  cycles; document intentional cycles imposed by framework, plugin, generated,
  or runtime registration patterns when the project permits them.
- Give shared mutable state an explicit authority. Replicas, caches, offline
  stores, and eventually consistent views may have multiple physical copies
  when synchronization and conflict rules are explicit.

## Abstraction Gate

Add an abstraction only when it does at least one of these:

- removes real duplication with the same semantics;
- isolates a dependency that changes independently;
- creates a stable contract needed by multiple consumers;
- makes a boundary meaningfully easier to test;
- replaces, and allows deletion of, an obsolete path.

Do not add interfaces, factories, repositories, coordinators, managers, or
plugin systems solely because future variation is imaginable. A little local
duplication is often cheaper than the wrong shared abstraction. Revisit it when
the repeated shape and variation axis are evidenced.

## Boundary Smells

- A feature requires unrelated edits across many modules.
- A central file or service keeps gaining branches for independent features.
- The same business decision appears in UI, API, worker, and persistence code.
- A module imports another module's private files.
- Tests require constructing most of the application for one rule.
- A generic utility package grows unrelated helpers.
- Adding one integration leaks its SDK types throughout the system.
- Old and new paths remain active with no deletion or migration plan.

When a smell appears, choose the smallest boundary correction before adding the
feature. Do not start a broad rewrite unless the feature cannot be delivered
safely through an incremental seam.

## Mechanical Enforcement

When the project already enforces a boundary or repeated drift justifies a new
check, encode it through the stack's build targets, package visibility, import
rules, architecture tests, or lint configuration. Do not introduce enforcement
machinery solely because the stack supports it.

When a repository enforces boundary exceptions, follow its required record and
include enough context to explain the source, target, reason, and review
condition. Do not create exception paperwork for conventions the project
already treats as normal.
