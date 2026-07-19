---
title: i18n Validation And Self-Heal
description: Pattern for validating locale files, placeholder parity, missing keys, stale keys, UI fit, and safe self-heal loops.
ownership: seed
governs: product
activation: conditional
enforcement: example
decision_owner: project
side_effects: none
applies_to:
  - multilingual apps
  - locale automation scripts
  - CI checks
  - admin translation tools
use_when:
  - Locale files must remain consistent across many surfaces or languages.
  - Translation automation needs repair and verification loops.
do_not_use_when:
  - The project has one small locale file and no automation.
outputs:
  - validation checklist
  - self-heal policy
  - CI gate plan
  - UI review checklist
case_sources:
  - magic-novel-forge/docs/templates early i18n automation experience
  - DeGit/src/i18n/index.test.ts
  - FrameCast/src/shared/i18n/i18n.test.ts
  - planner-v0/lib/i18n
related_workflows:
  - devrules/workflows/debug-root-cause.md
last_reviewed: 2026-06-11
---

# i18n Validation And Self-Heal

Validation protects localization from silent drift. Self-heal can repair obvious gaps, but it should not hide broken source architecture.

## Validation Checks

- source locale is valid JSON or module shape
- every target has the same keys
- no unexpected extra keys unless allowed
- placeholders match
- rich-text tags match
- plural forms are valid
- no empty translations in required namespaces
- no untranslated source copy in target locale unless intentionally allowed
- no duplicate key paths

## Self-Heal Policy

Safe automatic repairs:

- copy source key as temporary fallback with a marker
- fill missing target key via translation provider
- remove stale key only in dry-run report first
- normalize key ordering
- format files consistently

Risky repairs needing review:

- rewriting many keys
- changing placeholders
- changing legal or billing copy
- translating safety/security text
- restructuring namespace layout

## CI Gate

CI can enforce:

- key parity
- placeholder parity
- syntax validity
- no missing required namespaces
- no hardcoded string regression if scanner is stable

Keep AI translation out of normal CI unless explicitly designed for it. CI should validate, not unpredictably rewrite.

## UI Fit

Validate important surfaces for:

- button overflow
- narrow mobile layouts
- tabs and segmented controls
- dense admin tables
- long German-like compound words
- CJK line-height and font fallback
- right-to-left layout if supported

## Review Checklist

- Validation can run locally and in CI.
- Self-heal writes a report.
- Risky repairs require human review.
- Locale tests cover missing keys and placeholders.
- Dense UI screens are visually checked for supported locales.
