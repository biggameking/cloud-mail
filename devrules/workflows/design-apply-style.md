---
description: Explicitly select and safely apply a named shared design style to a target repository as an editable project fork.
ownership: shared
governs: product
activation: conditional
enforcement: advisory
decision_owner: project
side_effects: local
---

# Workflow · design-apply-style（按名称应用共享设计风格）

## Activation

Use only when the user explicitly requests a named style or asks to select one
from the devrules style library. This is an `adoption_task`; ordinary UI work
does not activate style tooling. Applying a style does not authorize copying
source product code, identity, routes, content, Agent instructions, or business
components.

## 1. Discover and assess fit

When the bundled library script exists at the confirmed devrules path, list and
validate the requested style in dry-run/read-only mode. Read its `style.json`,
application guidance, design source, provenance, and constraints.

Compare users, core task, content, density, target platform, accessibility, and
surface types with `suitableFor`/`notFor`. Use a proportionate Design Read only
when direction is genuinely open. Stop, select another style, or define a
deliberate hybrid if fit is poor.

## 2. Plan and resolve target authority

Run the library's apply command without its write flag first. Review every
planned output and the target repository's existing design authority. If a
different design source exists, choose merge, explicit replacement, or
cancellation; never bypass a conflict or silently overwrite it.

The target must decide whether the applied design source becomes its managed
authority. A style application alone does not enable npm aliases, `designmd`,
hooks, CI, or dependencies.

## 3. Apply only the approved outputs

After reviewing the dry run, use the script's explicit apply mode for the chosen
target. Integrate semantic roles through target-native components, assets, and
task runner. Preserve product structure, authentic content, accessibility, and
platform conventions.

Run design lint/sync/check only when the target has adopted and declared those
commands. Otherwise use its existing checks and record managed commands as
`N/A`. Do not install a missing tool merely to follow the pack.

## 4. Verify representative surfaces

Inspect at least one high-level/list surface and one detail/form or long-content
surface when both are in scope. Cover relevant mobile/narrow layout, appearance
modes, focus/platform navigation, contrast, text scaling, reduced motion,
loading, empty, error, long content, missing media, and responsive behavior.

Record style provenance and target-specific deviations in the target's existing
design/history location, or in the task if no durable record was requested.

## Completion

- Explicit style choice, fit evidence, dry-run review, and target authority are
  recorded.
- Conflict protection was preserved and only approved outputs were written.
- Target-native checks and representative visual/accessibility inspection pass.
- No tool, dependency, hook, CI workflow, or history file was imposed merely by
  applying the style.
