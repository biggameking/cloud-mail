---
title: i18n Content Change Detection
description: Pattern for detecting source copy updates and turning them into safe translation work.
ownership: seed
governs: product
activation: conditional
enforcement: example
decision_owner: project
side_effects: none
applies_to:
  - multilingual apps
  - docs and content platforms
  - email and notification templates
  - CMS-backed product copy
  - locale automation scripts
use_when:
  - User-facing source copy changes over time.
  - Translation work should be generated from source diffs.
  - A project needs stale-translation and removed-key detection.
do_not_use_when:
  - A project has no ongoing localized content maintenance.
outputs:
  - source-unit inventory
  - content diff report
  - translation job plan
  - stale-key report
  - approval and review checklist
case_sources:
  - magic-novel-forge/docs/templates early i18n automation experience
  - planner-v0/lib/i18n/script-runner.ts
  - planner-v0/lib/i18n/script-definitions.ts
  - DeGit/src/i18n/locales
  - FrameCast/src/shared/i18n
related_workflows:
  - devrules/workflows/i18n-multilingual-adaptation.md
  - devrules/workflows/documentation-update.md
last_reviewed: 2026-07-09
---

# i18n Content Change Detection

Use content change detection to keep localization work aligned with changing
source copy. The goal is to detect what changed, decide which locales are stale,
and produce reviewable translation work without blind rewrites.

## Sources To Inventory

Include product-owned user-facing copy:

- UI components, pages, routes, dialogs, menus, toasts, and empty states;
- validation and user-facing error messages;
- onboarding, paywall, legal, privacy, billing, and account-management copy;
- email, notification, push, and in-app message templates;
- bundled help, markdown, release notes, and product docs;
- CMS seed content that ships with the product;
- app store metadata or screenshot copy when the release workflow includes it.

Usually exclude:

- developer logs and comments;
- test IDs, analytics event names, route names, enum values, CSS classes, and
  storage keys;
- private user-authored content;
- third-party provider strings that the project cannot control;
- secrets, credentials, API keys, and configuration names.

## Source Unit Shape

Generate a source-unit inventory with records like this, adapted to the
project's stack:

```json
{
  "id": "settings.language.title",
  "sourceLocale": "en",
  "text": "Language",
  "kind": "ui_label",
  "namespace": "settings.language",
  "sourcePath": "src/settings/LanguagePanel.tsx",
  "semanticPath": "settings/language/panel/title",
  "placeholders": [],
  "richTextTags": [],
  "pluralCategories": [],
  "links": [],
  "context": "Settings panel title",
  "risk": "normal",
  "fingerprint": "sha256:..."
}
```

Recommended fields:

| Field | Purpose |
| --- | --- |
| `id` | Stable localization key or generated temporary identity. |
| `sourceLocale` | Locale used as the translation source. |
| `text` | Source text or structured ICU message. |
| `kind` | UI label, validation message, email subject, legal copy, etc. |
| `namespace` | Product surface, package, route, or message bundle. |
| `sourcePath` | File path or content record reference. |
| `semanticPath` | Stable product location used when files move. |
| `placeholders` | Variables such as `%@`, `{count}`, `%1$s`, or template slots. |
| `richTextTags` | Markup or component tags that targets must preserve. |
| `pluralCategories` | Required plural/select branches. |
| `links` | Link tokens or route references that must remain intact. |
| `context` | Translator note or developer-provided meaning. |
| `risk` | `normal`, `legal`, `billing`, `privacy`, `security`, or `brand`. |
| `fingerprint` | Hash of normalized translatable meaning and structure. |

## Fingerprint Rules

Fingerprints should be stable enough to avoid noise and strict enough to catch
meaningful translation drift.

Hash:

- normalized source text or structured message;
- placeholder names and order;
- rich-text tag names and order;
- plural/select branches;
- semantic context when there is no stable key.

Do not hash:

- absolute paths;
- line numbers;
- whitespace-only formatting;
- generated timestamps;
- comments that do not help translators.

When a stable key exists, the key is identity and the fingerprint answers "did
the meaning or required structure change?" When no key exists, a temporary
identity can combine semantic path and normalized source text until migration
creates a real key.

## Diff Classification

Compare the current inventory with the previous approved inventory.

| Classification | Detection | Action |
| --- | --- | --- |
| Added | New stable key or new temporary source unit. | Create target-locale work for every required locale. |
| Changed | Same key, different fingerprint. | Mark existing target translations stale. |
| Moved | Same key and fingerprint, different path. | Update inventory only. |
| Removed | Previous key no longer appears. | Report stale locale entries; remove after review. |
| Placeholder drift | Placeholder set differs by locale or from source. | Block validation. |
| Risky | Risk class is legal, billing, privacy, security, or brand. | Require human review even if automation translates. |
| Excluded | Scanner found intentional internal text. | Keep exclusion reason auditable. |

## Translation Job Plan

Create jobs from added and changed source units:

```json
{
  "jobId": "i18n-2026-07-09-settings-language-title-ja",
  "sourceUnitId": "settings.language.title",
  "sourceLocale": "en",
  "targetLocale": "ja",
  "reason": "added",
  "namespace": "settings.language",
  "risk": "normal",
  "placeholders": [],
  "requiresHumanReview": false
}
```

Batch jobs by:

- namespace or product surface;
- risk class;
- target locale;
- provider token or payload limit;
- review ownership.

Do not batch unrelated legal, billing, safety, or privacy copy with ordinary UI
labels. Those lanes need clearer review reports.

## Automation Guardrails

- Default to report-only or dry-run.
- Require explicit apply for locale-file writes.
- Save progress after each batch.
- Keep a resumable job state.
- Preserve key order and file formatting.
- Write changed namespaces and risk buckets to a report.
- Never translate secrets or private user content.
- Never call external providers in normal CI unless explicitly designed.
- Never mark the new inventory approved until validation passes.

## Project Config Pattern

Project instances may add an i18n section to their local config or workflow.
Keep paths repository-relative.

```json
{
  "i18n": {
    "sourceLocale": "en",
    "requiredLocales": ["en", "ja", "zh-Hans"],
    "resourceFiles": ["src/i18n/**/*.json"],
    "sourceRoots": ["src", "content"],
    "sourceGlobs": ["src/**/*.{ts,tsx}", "content/**/*.md"],
    "excludeGlobs": ["**/*.test.*", "**/*.spec.*"],
    "maxFiles": 20000,
    "maxFileBytes": 1048576,
    "generatedInventory": "devrules/reports/i18n/source-units.json",
    "approvedInventory": "devrules/reports/i18n/source-units.approved.json",
    "diffReport": "devrules/reports/i18n/content-diff.json",
    "validationReport": "devrules/reports/i18n/validation-report.json",
    "jobPlan": "devrules/reports/i18n/translation-jobs.json",
    "reportDir": "devrules/reports/i18n",
    "reviewRiskKinds": ["legal", "billing", "privacy", "security", "brand"]
  }
}
```

This is a pattern, not a required schema. Reuse the project's existing config
system when one already exists.

The shared template ships a conservative zero-dependency runner:

```bash
node devrules/scripts/i18n-maintenance.mjs scan --repo <repo>
node devrules/scripts/i18n-maintenance.mjs diff --repo <repo>
node devrules/scripts/i18n-maintenance.mjs plan --repo <repo>
node devrules/scripts/i18n-maintenance.mjs validate --repo <repo>
node devrules/scripts/i18n-maintenance.mjs approve --repo <repo> --apply
```

All mutating report writes require `--apply`. The runner does not call a
translation provider and does not rewrite locale files; it creates source-unit,
diff, validation, and job-plan artifacts that a project-local translator can
consume after review.

For very large apps, start with locale resources as the primary inventory and
keep source scanning focused to touched surfaces. Split batches by namespace and
locale so review, provider limits, and retry behavior stay manageable.

## Platform Notes

| Platform | Preferred detection |
| --- | --- |
| React, Vue, Svelte, Solid | AST parse components and localization helper calls; scan JSX/text nodes cautiously. |
| Next.js or route-based web apps | Track route namespaces and server/client component boundaries. |
| SwiftUI and Apple apps | Inspect String Catalogs, `LocalizedStringResource`, `String(localized:)`, `Text`, and app-language override helpers. |
| Android | Inspect `strings.xml`, plurals, Compose string resources, and XML layout references. |
| Backend/API | Translate user-visible error codes at response or client boundary, not internal codes. |
| Docs/content | Fingerprint markdown frontmatter, headings, body sections, and embedded UI labels separately. |
| Email/notifications | Track subject, preview text, body, action labels, and legal footer separately. |

## Verification Checklist

- Current source inventory can be regenerated deterministically.
- Added and changed source units produce translation jobs.
- Moves do not cause unnecessary retranslation.
- Removed source units produce stale-key reports before deletion.
- Placeholder, rich-text, link, and plural structures are preserved.
- Risky copy is separated for human review.
- Validation passes before the approved inventory is updated.
- Reports are concise enough for future Agents to act on.
