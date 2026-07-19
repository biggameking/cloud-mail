---
description: Explicitly port one project's design system into another project as a full fork.
ownership: shared
governs: product
activation: conditional
enforcement: advisory
decision_owner: project
side_effects: local
---

# Workflow · design-port-to-new-project（显式移植项目设计体系）

## Activation

Use only when the user explicitly asks to port one source project's design
system into a target project. This is a higher-coupling choice than applying a
portable named style. It does not authorize copying product identity, business
content, Agent rule bodies, an entire `devrules/` instance, or source-project
automation.

## 1. Establish source and target boundaries

Record exact source/target repositories and revisions, the design artifacts in
scope, licensed/brand assets, component-code reuse permission, target platform
and stack, and protected target behavior. Keep source read-only.

If only portable visual language is desired, use `design-extract-style.md` and
`design-apply-style.md` instead. If the target already has a design authority,
choose merge, replacement, or cancellation explicitly before writing.

## 2. Plan the smallest portable set

Prefer semantic roles and documented component behavior over a blind directory
copy. A selected set may include a design source, semantic assets/tokens,
component specifications, and reusable components compatible with the target.

Copy no source changelog, allowlist, credentials, private paths, routes, product
copy, analytics, CI workflow, hook, or Agent entry content. Create target-owned
history/provenance only if the target uses it.

## 3. Integrate with target-native tooling

Discover the target package/task runner, design authority, build, and preview
commands. Port values and components through those boundaries. Use managed
`DESIGN.md`, sync, lint, or diff tooling only when the target explicitly adopts
it as part of this task; otherwise those steps are `N/A`.

Do not invoke package-on-demand commands or install dependencies without normal
approval. Do not replace unrelated configuration for the source project's
convenience.

## 4. Adapt rather than clone identity

Validate fit against target users, tasks, density, content, platform, and
accessibility. Preserve semantic structure only where it genuinely fits. Brand,
typography, navigation, content hierarchy, and platform conventions belong to
the target and may require deliberate divergence.

## 5. Verify

Compare representative target list/dashboard and detail/form surfaces, relevant
states, long/authentic content, viewport/device sizes, appearance modes, focus or
platform navigation, contrast, text scaling, and reduced motion. Run the exact
target-native checks discovered earlier.

## Completion

- User-approved source/target scope and provenance are recorded.
- The target has one design authority and no copied Agent rule body or source
  product identity.
- Representative behavior and visuals pass target-native checks.
- Managed tooling, history, hooks, and CI are included only when explicitly
  chosen; otherwise they are `N/A`.
