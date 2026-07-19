---
description: Explicitly adopt an existing project's design system into devrules-managed design artifacts.
ownership: shared
governs: product
activation: conditional
enforcement: advisory
decision_owner: project
side_effects: local
---

# Workflow · design-adopt-existing-project（显式收编存量设计体系）

## Activation

Use only when the user explicitly wants to adopt devrules-managed design tooling
for an existing repository. Normal UI maintenance and cleanup remain
`project_native` and do not require this migration.

The first managed source must describe the valuable order that already exists;
it is not permission for an unrelated redesign. If the goal is actual UI
improvement, use `design-refactor-existing-project.md`. If the goal is a portable
shared style, use `design-extract-style.md`.

## 1. Protect the current system

Inventory the existing design authority, platform assets, components, style
files, build/task runner, generated files, representative pages, protected brand
assets, and current visual tests. Record which authority will be retained,
replaced, or linked before creating `DESIGN.md` or config.

Do not install tools or rewrite production UI during this read-only phase.

## 2. Collect technical and experience evidence

Use the project's existing inventory/audit tools if present. If the user selected
the bundled devrules scanner and its runtime is available, it may be run first in
dry-run mode and then with an explicit output path. The exact command is
discovered from the repository or confirmed script path; npm aliases are not
assumed.

Alongside mechanical values, inspect:

- product navigation and patterns users already rely on;
- brand, accessibility, and platform-native assets to preserve;
- repeated colors, typography, spacing, shape, motion, and component states;
- placeholder or implementation-focused copy that should not be canonized;
- known exceptions such as charts, third-party content, or fixed brand colors.

## 3. Define the managed source

Create the minimum selected managed artifacts. When `DESIGN.md` is chosen, map
existing semantics into it and explain why each durable role exists. Do not force
the project into a particular token count, framework naming scheme, or component
inventory.

Connect generated outputs only when the target stack benefits from them. Keep
the old source until equivalence is verified; avoid a big-bang replacement.

## 4. Migrate with a no-new-debt ratchet

Choose a project-specific sequence based on risk:

1. observe current findings without blocking unrelated work;
2. migrate repeated semantic roles and component patterns incrementally;
3. preserve documented exceptions with reasons;
4. tighten only rules the migrated boundary can already satisfy.

Fixed frequencies, week counts, severities, and CI gates are advisory examples,
not universal requirements. The repository owner chooses enforcement and timing.

## 5. Verify and hand off

Run the commands now declared by the repository. Compare representative surfaces
before and after with authentic content, relevant states, appearance modes, and
accessibility behavior. Record remaining debt and the next safe boundary.

Local hooks or hosted CI require separate approval and may remain `N/A`.

## Completion

- Explicit adoption, retained design authority, protected assets, and migration
  boundary are documented.
- Managed artifacts describe the current valuable system without silently
  redesigning the product.
- Generated outputs, if selected, are repeatable and visually equivalent on the
  checked surfaces.
- No new dependency, hook, CI workflow, or enforcement threshold was imposed
  without project/user choice.
