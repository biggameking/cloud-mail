---
description: Explicitly extract a portable, evidence-backed named design style from one or more existing repositories.
ownership: shared
governs: product
activation: conditional
enforcement: advisory
decision_owner: project
side_effects: local
---

# Workflow · design-extract-style（从现有项目提取命名风格）

## Activation and boundary

Use only when the user explicitly asks to extract a portable named style or
publish one to the shared devrules library. This is an `adoption_task`; normal
project cleanup uses `design-adopt-existing-project.md` or `design-audit.md`.

Source repositories are read-only evidence. Record exact revisions, included
surfaces, exclusions, source relationships, proposed id/name, visibility, and
the intended review/publish boundary. Never publish product copy, routes,
credentials, customer data, business logic, private absolute paths, component
code, or distinctive identity without explicit authorization.

## 1. Gather evidence safely

When the bundled style-library script exists at the confirmed devrules path, run
extraction without its write flag first. Review planned sources, default ignores,
explicit exclusions, and structured evidence. Only then use its explicit output
and apply flags to write into the approved review workspace. It must not rewrite
source repositories.

A single-source extraction needs several representative surfaces and component
roles. Multiple sources require explicit common/divergent/source-specific
classification. Mechanical counts suggest candidates; they do not decide
semantic roles.

## 2. Reconcile portable design facts

Use the optional style-package template when helpful. Identify typography jobs,
semantic colors, spacing rhythm, layout hierarchy, shape/depth, motion, states,
component rules, negative constraints, and `notFor` cases. Require file or visual
evidence for claims and separate portable structure from brand/product identity.

Resolve incompatible signals deliberately: select a common rule, mark a variant,
or exclude the surface. Do not average unrelated systems into a generic style.

## 3. Author and validate the pack

Follow the selected library's current pack contract. The devrules library may
use `style.json`, an editable `DESIGN.md`, evidence, and application guidance;
those files are library artifacts, not a requirement for source or target
projects.

Use the library validator and offline design lint only when their confirmed local
scripts are present. Do not invoke package-on-demand tooling or install a missing
dependency. Also visually check representative index/list and detail/form
surfaces when the style claims cover them.

## 4. Publish separately

Publication is an external/shared write and is not implied by extraction. Review
the pack diff and privacy boundary, then use dry-run publish before explicit
apply. Refuse overwrites; evolving an existing id requires a deliberate version,
evidence, validation, and catalog update.

## Completion

- Source revisions, included/excluded surfaces, privacy/identity boundary, and
  evidence for every portable decision are recorded.
- Validation available in the selected library and representative visual checks
  pass; unavailable optional tools are `N/A`, not auto-installed.
- Source repositories are unchanged.
- Publishing occurred only when explicitly in scope, with overwrite protection
  and a reviewed diff.
