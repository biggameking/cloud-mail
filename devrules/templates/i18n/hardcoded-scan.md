---
title: Hardcoded String Scan
description: Pattern for finding, classifying, and migrating hardcoded UI strings without breaking code semantics.
ownership: seed
governs: product
activation: conditional
enforcement: example
decision_owner: project
side_effects: none
applies_to:
  - existing apps being internationalized
  - UI refactors
  - admin consoles
  - docs-like product surfaces
use_when:
  - A project needs to detect or migrate hardcoded user-facing text.
do_not_use_when:
  - Strings are internal code identifiers, CSS classes, test IDs, route names, or developer logs.
outputs:
  - scan scope
  - classification rules
  - migration plan
  - false-positive policy
  - verification checklist
case_sources:
  - magic-novel-forge/docs/templates early i18n automation experience
  - planner-v0/lib/i18n/script-definitions.ts
  - planner-v0/lib/i18n/script-runner.ts
  - DeGit/src/i18n/locales
related_workflows:
  - devrules/workflows/documentation-update.md
last_reviewed: 2026-06-11
---

# Hardcoded String Scan

A hardcoded string scan should classify strings before editing. Automated migration is powerful, but blind replacement breaks tests, routes, CSS selectors, and domain constants.

## Scan Scope

Include:

- UI components
- pages/routes
- dialogs and toasts
- validation messages
- empty states
- admin labels
- user-facing errors
- email or notification templates if in scope

Usually exclude:

- tests unless testing visible copy
- route constants
- CSS class names
- data attributes
- analytics event names
- enum values
- dev-only logs
- API error codes

## Classification

Classify findings:

- translate now
- translate later
- not user-facing
- key already exists
- generated/content text
- external provider text
- unsafe automated change

The "unsafe automated change" bucket is important. It prevents automation from making semantic edits in fragile files.

## Migration Pattern

1. Run scan and produce a report.
2. Review false positives.
3. Create or reuse message namespace.
4. Replace strings in small batches by surface.
5. Run typecheck/tests.
6. Validate key parity across locales.
7. Screenshot important surfaces if visual fit matters.

## Key Generation

Prefer keys based on meaning and location:

- `settings.account.title`
- `export.dialog.confirmButton`
- `admin.billing.failedWebhook`

Avoid keys generated from full English sentences when the copy is likely to change.

## Automation Guardrails

- Keep a dry-run mode.
- Show diffs before applying.
- Preserve formatting.
- Avoid changing files with syntax errors.
- Skip strings inside comments unless requested.
- Never translate secrets, IDs, or provider config names.

## Review Checklist

- Scan report distinguishes user-facing from internal strings.
- Migration keeps business constants intact.
- Message keys are stable and readable.
- Tests or typecheck catch broken imports.
- Screens with dense UI are reviewed for text fit.
