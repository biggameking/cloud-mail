---
description: Universal workflow for adding, maintaining, and automating multilingual product adaptation.
ownership: shared
governs: product
activation: conditional
enforcement: advisory
decision_owner: project
side_effects: local
---

# i18n Multilingual Adaptation

Use this workflow when a project needs to add multilingual support, add or
remove locales, migrate hardcoded user-facing copy, update translation
resources, detect source content changes, or automate translation and
validation.

This workflow is template-owned and provider-neutral. Project instances should
add local commands, locale lists, source roots, and platform-specific resource
paths in their own hooks or memory.

## Purpose

Multilingual adaptation is not only translation. Treat it as a loop across
product copy, locale architecture, source extraction, translation jobs,
validation, UI fit, release safety, and future content drift detection.

The target outcome is a repeatable system where new or changed user-facing copy
is found automatically, converted into stable localization units, translated or
queued safely, validated across every supported locale, and reviewed where human
judgment is required.

## Inputs

Collect these before editing:

- current supported locales and planned locales;
- source locale and product-default fallback policy;
- UI source roots, content roots, email/notification templates, docs-like
  surfaces, and generated-copy boundaries;
- existing localization resources such as JSON, ICU messages, String Catalogs,
  `strings.xml`, gettext files, database-backed translations, or CMS records;
- existing translation helper APIs, locale providers, routing, user preference
  models, and formatting helpers;
- test, lint, typecheck, build, screenshot, or preview commands that prove i18n
  behavior;
- privacy, legal, billing, safety, or regulated-copy surfaces that require
  human review.

### Resolve The Requested Locale Scope

Determine the locale set before planning or editing, using this precedence:

1. Languages or locales explicitly named in the current user request.
2. The project-local default in `devrules/config.json:i18n.requiredLocales`,
   reinforced by project memory when useful.
3. Locales already declared by the product's authoritative localization
   resources or platform configuration.
4. The source locale only when no broader scope is available; ask before
   expanding release scope if that choice would materially affect the product.

An explicit user scope applies to the current task and must not silently replace
the project's durable default unless the user also asks to change that default.
Conversely, do not ask the user to repeat a locale list that is already recorded
in project configuration. Keep locale lists project-local: this universal
workflow owns the resolution rule, not any one product's supported languages.

## Done Criteria

The task is done only when:

1. Locale architecture and ownership are clear.
2. User-facing source copy is either localized or intentionally excluded.
3. Added or changed source copy has generated translation work for every
   required locale.
4. Missing keys, stale keys, placeholder drift, rich-text tag drift, plural
   drift, and empty translations are detected.
5. Development and tests expose missing translations instead of silently hiding
   them behind production fallback behavior.
6. Translation automation is dry-run first, resumable, provider-neutral, and
   reviewable.
7. Dense or important UI surfaces have text-fit verification for representative
   locales.
8. Local project commands, hooks, and memory explain how future Agents rerun the
   same loop.

## Phase 1: Classify The Work

Choose the smallest lane that covers the request:

| Lane | Use when | Primary output |
| --- | --- | --- |
| Architecture | The project is not localized yet or locale resolution is unclear. | Locale strategy, resource layout, runtime integration. |
| Hardcoded scan | Existing UI copy lives directly in source files. | Classified scan report and migration plan. |
| Content update detection | Copy or content changes over time and should trigger translation work. | Source-unit manifest, diff report, job queue. |
| Translation update | Locale resources exist and need missing or changed translations. | Translation job batches and review report. |
| Validation | Locale resources changed or i18n checks failed. | Key, placeholder, plural, syntax, and UI-fit evidence. |
| Platform local tuning | A project already has a generic workflow plus stack-specific rules. | Project-local hook, commands, tests, and exceptions. |

For a new multilingual rollout, run the lanes in this order:

1. Architecture
2. Hardcoded scan
3. Content update detection
4. Translation update
5. Validation
6. Platform local tuning

## Phase 2: Define Locale Architecture

Use `devrules/templates/i18n/localization-architecture.md`.

Decide and document:

- source locale;
- required locales for release and optional locales for future work;
- locale resolution order such as user setting, workspace setting, route,
  system/browser language, then product default;
- whether UI locale, user content locale, AI output locale, and documentation
  locale can differ;
- resource layout by domain, surface, route, package, or platform bundle;
- key naming convention and namespace ownership;
- runtime fallback policy for production and no-fallback policy for development
  checks;
- how dates, numbers, currency, lists, plurals, gender, and relative time are
  formatted;
- how right-to-left layout will be handled if any supported locale needs it.

Keep business logic independent from translated strings. Translate error codes,
status labels, and validation messages at display boundaries.

## Phase 3: Scan And Classify Existing Copy

Use `devrules/templates/i18n/hardcoded-scan.md`.

Scan before migrating. Classify findings as:

- translate now;
- translate later;
- not user-facing;
- key already exists;
- generated or user-authored content;
- external provider copy;
- unsafe automated change.

Prefer AST or framework-aware extraction when available. Use literal search only
as a first pass. Do not blindly replace strings that may be route names, CSS
classes, analytics event names, test identifiers, enum values, API error codes,
storage keys, product configuration, secrets, or developer logs.

Migrate by surface or namespace, not by massive global replacement. Keep the
diff reviewable and run tests after each meaningful batch.

## Phase 4: Detect Source Content Updates

Use `devrules/templates/i18n/content-change-detection.md`.

Every project that expects ongoing multilingual maintenance should maintain a
project-local source-unit inventory. The inventory should be generated, not
hand-authored.

Default template automation: run the `scan` (dry-run first, then `--apply`)
and `diff` steps of the canonical command loop in
[Phase 8](#phase-8-wire-continuous-detection).

Use the dry-run scan first to tune `devrules/config.json:i18n` source roots,
resource files, exclusions, source locale, and required locales. Use `--apply`
only to write `devrules/reports/i18n/source-units.json` after the scan scope is
reasonable.

Each extracted unit should capture enough data to decide whether translation
work is needed:

- stable key when one exists;
- source file or content record;
- product surface or namespace;
- source text or structured message;
- source locale;
- placeholders, ICU variables, rich-text tags, plural categories, and link
  tokens;
- developer context or translator note when available;
- semantic path such as route, component, email template, settings panel, or
  package;
- normalized source fingerprint;
- last-seen timestamp or commit reference.

Diff the current inventory against the previous approved inventory:

| Diff | Meaning | Automation action |
| --- | --- | --- |
| Added unit | New user-facing source copy appeared. | Create keys or translation jobs for all required locales. |
| Changed fingerprint | Existing source meaning or placeholders changed. | Mark all target translations stale and queue updates. |
| Moved only | Same key/fingerprint moved to another file. | Update inventory, do not retranslate. |
| Removed unit | Source copy disappeared. | Report stale locale keys; remove only after review. |
| Placeholder drift | Variables changed without matching target updates. | Block validation until fixed. |
| Excluded unit | Scanner found intentional non-UI text. | Record exclusion reason in the report or project config. |

Do not use English text alone as identity. Prefer stable keys. For unkeyed
legacy copy, derive a temporary identity from semantic path plus normalized text
so copy moves do not produce uncontrolled duplicate translation jobs.

## Phase 5: Translate Or Queue Updates

Use `devrules/templates/i18n/translation-automation.md`.

Translation work creation uses the `plan` step (dry-run first, then
`--apply`) of the canonical command loop in
[Phase 8](#phase-8-wire-continuous-detection). This creates reviewable translation jobs under `devrules/reports/i18n/`. It
does not call a provider and does not write locale files. Project-local
translation automation may consume the job plan only after provider credentials,
batching, glossary, retry, review, and apply rules are explicit.

Translation automation must be:

- dry-run first;
- resumable after partial failure;
- provider-neutral;
- batch-limited;
- glossary-aware;
- placeholder-preserving;
- safe around legal, billing, privacy, safety, and security copy;
- explicit about human-review requirements.

Automation may fill missing translations or update stale translations after a
source change. It must not silently rewrite reviewed copy, change product names,
change placeholders, alter legal meaning, or invent source keys.

Keep provider credentials out of devrules files. Use project-local environment
variables, secret stores, or admin settings. Never write API keys, translated
private user data, or provider responses containing sensitive data into memory
files.

## Phase 6: Validate And Self-Heal

Use `devrules/templates/i18n/validation-self-heal.md`.

Default template validation uses the `validate` step (dry-run first, then
`--apply`) of the canonical command loop in
[Phase 8](#phase-8-wire-continuous-detection).

`--apply` writes only `devrules/reports/i18n/validation-report.json`. It does
not repair resources. Keep project-local self-heal commands separate and make
their write scope explicit.

Validation should check at least:

- locale resource syntax;
- key parity across required locales;
- missing required namespaces;
- stale keys;
- empty values;
- placeholder parity;
- ICU plural/select validity;
- rich-text tag parity;
- link token parity;
- duplicate keys;
- untranslated source copy in target locales when disallowed;
- hardcoded user-facing string regressions when the scanner is stable.

Self-heal is allowed only for obvious, reviewable repairs:

- normalize ordering or formatting;
- create a dry-run report for stale keys;
- queue missing translations;
- insert temporary marked fallback only when the project explicitly allows that
  during migration.

Self-heal must not hide architecture defects. If missing translations should be
visible in development, tests should fail or show missing-key markers instead of
falling back silently.

## Phase 7: Verify UI And Platform Behavior

Run the closest project checks:

- locale validation tests;
- typecheck or compiler checks;
- unit tests for locale resolution and formatter behavior;
- screen or component tests for important surfaces;
- visual previews or screenshots for dense layouts;
- build checks for platforms that compile localization resources.

Manually or automatically inspect representative locales:

- one short Latin locale;
- one long Latin locale such as German or French;
- one CJK locale if supported;
- one right-to-left locale if supported;
- any region-specific locale such as `pt-BR`, `zh-Hans`, or `zh-Hant`.

Watch for overflow in buttons, tabs, segmented controls, navigation bars,
tables, empty states, dialogs, billing copy, onboarding, notifications, and
settings screens.

## Phase 8: Wire Continuous Detection

In a project instance, add or update hooks so future Agents run this workflow
when any of these change:

- localization resource files;
- supported locale lists;
- locale provider, routing, or user preference code;
- UI component files with user-facing literals;
- email, notification, markdown, CMS seed, help, or docs-like templates that
  ship inside the product;
- translation automation scripts;
- scanner, validator, or content fingerprint config.

Recommended automation shape:

1. `scan`: extract source units and write a report.
2. `diff`: compare source-unit inventory with the previous approved inventory.
3. `plan`: generate added, changed, removed, stale, and unsafe-review buckets.
4. `translate`: create or update target locale values only with explicit apply.
5. `validate`: enforce key, placeholder, plural, and syntax parity.
6. `review`: mark legal, billing, privacy, security, and high-visibility copy
   for human review.
7. `approve`: update the approved inventory only after checks pass.

The shared script implements this report-first loop. This is the canonical
command block; Phases 4-6 run its individual steps:

```bash
node devrules/scripts/i18n-maintenance.mjs scan --repo <repo> --apply
node devrules/scripts/i18n-maintenance.mjs diff --repo <repo> --apply
node devrules/scripts/i18n-maintenance.mjs plan --repo <repo> --apply
node devrules/scripts/i18n-maintenance.mjs validate --repo <repo> --apply
node devrules/scripts/i18n-maintenance.mjs approve --repo <repo> --apply
```

Approve only after the diff and validation output have been reviewed. Approval
copies the generated source-unit inventory to the approved baseline, so future
diffs detect only new or changed source copy.

For very large products with thousands of strings, keep the loop incremental:

- configure `sourceRoots`, `sourceGlobs`, `resourceFiles`, and `excludeGlobs`
  by product surface or namespace instead of scanning the entire repository;
- prefer resource-file inventory as the source of truth once keys exist;
- batch translation jobs by namespace, target locale, risk, and reviewer;
- cap provider batches in project-local translator scripts and save progress
  after each batch;
- run full validation in CI, but run focused scans for the touched namespace
  during normal development;
- keep generated inventories out of human memory files and review summaries;
  link reports instead of pasting thousands of strings.

CI should validate and report. It should not call external translation providers
or rewrite locale files unless the project has deliberately designed that path.

## Project-Local Documentation

After adapting this workflow to a repository, record:

- supported locales and release tiers in `devrules/memory/project-profile.md`;
- project-specific workflow or hook entries for resource paths and commands;
- durable fallback/no-fallback decisions in `devrules/memory/decisions.md`;
- reusable cross-project improvements in
  `devrules/memory/evolution-suggestions.md`;
- scanner false-positive rules in the project-local config or workflow.

Do not record secrets, private translation provider payloads, or raw user
content in devrules memory.

## When Not To Use

Do not use this workflow for:

- developer-only logs;
- internal identifiers;
- test fixtures that are not visible product copy;
- user-authored content that should stay in the user's original language;
- one-off copy edits in a single-language product with no localization plan.

Last updated: 2026-07-19
