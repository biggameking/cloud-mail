---
title: Localization Architecture
description: Pattern for locale strategy, message structure, routing, user preferences, admin configuration, and UI integration.
ownership: seed
governs: product
activation: conditional
enforcement: example
decision_owner: project
side_effects: none
applies_to:
  - web apps
  - mobile apps
  - desktop apps
  - admin consoles
  - content platforms
use_when:
  - A project needs multilingual UI, user locale preference, locale routing, or translation infrastructure.
do_not_use_when:
  - Only developer-facing logs or internal labels are changing.
outputs:
  - locale strategy
  - message file structure
  - routing and preference plan
  - component usage pattern
  - review checklist
case_sources:
  - magic-novel-forge/docs/templates early i18n automation experience
  - planner-v0/lib/i18n
  - DeGit/src/i18n
  - FrameCast/src/shared/i18n
  - auto-threads/src/i18n
related_workflows:
  - devrules/workflows/documentation-update.md
last_reviewed: 2026-06-11
---

# Localization Architecture

Localization architecture should make UI text easy to find, translate, validate, and review. It should not turn every component into a maze of string plumbing.

## Strategy Questions

- Which locales ship now?
- Which locales are planned?
- Is routing locale-prefixed, user-preference based, or app-setting based?
- Do UI language, content language, and generated AI language differ?
- How are missing translations handled?
- Who can update translations?
- Are translations bundled, fetched, or hybrid?

## Message Organization

Common organization options:

- by surface: `dashboard`, `settings`, `repo`, `admin`
- by domain: `billing`, `auth`, `editor`, `export`
- by route: useful for route-local bundles
- by package: useful for monorepos

Stable keys should describe meaning, not temporary copy:

- Good: `billing.plan.current`
- Risky: `billing.clickHereToUpgradeNow`

## Locale Preference

Locale resolution can use:

1. explicit user setting
2. workspace or organization setting
3. URL or route parameter
4. browser/system language
5. product default

Keep the decision inspectable. Locale bugs are hard to debug when every layer guesses independently.

## Component Pattern

Good component usage:

- UI components receive translated labels or use a local translation hook.
- Business logic does not compare translated strings.
- Error reason codes are translated at the boundary.
- Date, number, currency, and plural formatting use locale-aware formatters.

## AI And i18n

AI features may need:

- user UI locale
- source content locale
- target output locale
- glossary
- tone rules
- provider/model route for translation

Do not assume UI locale is always the desired generated content language.

## Review Checklist

- Locale choice has a single documented resolution order.
- Message files are organized by product domain or surface.
- Components do not hardcode user-facing text.
- Error codes translate at display boundaries.
- Missing translation behavior is visible in development.
- AI translation settings are configurable without hardcoding provider preference.
