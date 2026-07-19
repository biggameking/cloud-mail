---
title: i18n Domain Templates
description: Index for localization architecture, hardcoded string scanning, content change detection, translation automation, and validation loops.
ownership: shared
governs: product
activation: conditional
enforcement: example
decision_owner: project
side_effects: none
applies_to:
  - multilingual web apps
  - mobile apps
  - desktop apps
  - docs and content platforms
  - admin consoles
use_when:
  - UI-facing strings need localization.
  - Existing hardcoded text must be migrated.
  - Translation automation, validation, or self-heal scripts are needed.
do_not_use_when:
  - The task only changes developer-only logs or internal variable names.
  - The project explicitly targets one language with no planned localization.
outputs:
  - locale architecture
  - string extraction plan
  - content change detection plan
  - translation automation plan
  - validation and self-heal checklist
case_sources:
  - magic-novel-forge/docs/templates early i18n automation experience
  - planner-v0/lib/i18n
  - planner-v0/lib/ai/translation-client.ts
  - planner-v0/lib/i18n/script-runner.ts
  - DeGit/src/i18n
  - FrameCast/src/shared/i18n
  - auto-threads/src/i18n
  - NovelWiki/src/store/i18nStore.ts
related_workflows:
  - devrules/workflows/i18n-multilingual-adaptation.md
  - devrules/workflows/documentation-update.md
  - devrules/workflows/debug-root-cause.md
last_reviewed: 2026-07-09
---

# i18n Domain Templates

Localization is a product architecture choice. Treat message keys, extraction scripts, translation providers, validation, and UI review as one loop.

## Recommended Reading Order

| Task | Read |
| --- | --- |
| Add or reorganize localization architecture | `localization-architecture.md` |
| Find and migrate hardcoded UI strings | `hardcoded-scan.md` |
| Detect changed source copy and stale translations | `content-change-detection.md` |
| Automate translations with provider selection and retries | `translation-automation.md` |
| Validate key parity, placeholders, and UI fit | `validation-self-heal.md` |

## Domain Principles

- Keep message keys stable and semantic; avoid keys that encode temporary copy.
- Separate UI locale, content locale, and user preference when the product needs them.
- Scan before refactoring; refactor before translation; validate after translation.
- Track source-copy fingerprints so changed content creates translation work instead of silently leaving stale target locales.
- Provider selection should be configurable and replaceable.
- Translation automation should save progress incrementally and resume safely.

## Default Automation Loop

Use `devrules/scripts/i18n-maintenance.mjs` as the shared report-first runner for
generic scan, diff, translation job planning, validation, and approved-baseline
updates:

```bash
node devrules/scripts/i18n-maintenance.mjs scan --repo <repo> --apply
node devrules/scripts/i18n-maintenance.mjs diff --repo <repo> --apply
node devrules/scripts/i18n-maintenance.mjs plan --repo <repo> --apply
node devrules/scripts/i18n-maintenance.mjs validate --repo <repo> --apply
node devrules/scripts/i18n-maintenance.mjs approve --repo <repo> --apply
```

Run commands without `--apply` first. The shared script never calls translation
providers and never rewrites product source or locale files; project-local
translator scripts may consume the generated job plan only after provider,
credential, batching, review, and apply rules are explicit.
