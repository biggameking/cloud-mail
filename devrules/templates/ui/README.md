---
title: UI Domain Templates
description: Index for design systems, admin console patterns, and product surface patterns.
ownership: shared
governs: product
activation: conditional
enforcement: example
decision_owner: project
side_effects: none
applies_to:
  - web apps
  - desktop-like apps
  - mobile-adapted web apps
  - admin consoles
  - product dashboards
use_when:
  - A project needs reusable UI rules, component states, layout patterns, or admin/product surface consistency.
  - A feature needs a professional product interface rather than isolated controls.
do_not_use_when:
  - The task only changes non-visual business logic.
  - A mature design system already provides the required rule.
outputs:
  - token map
  - component state checklist
  - layout rules
  - admin console pattern
  - product surface pattern
case_sources:
  - structureUI/apps/web
  - structureUI/packages/domain
  - DeGit/src/pages
  - DeGit/src/components/business
  - NovelWiki/src/components/admin
  - NovelEditor/src/modules/template-factory/components
  - FrameCast/src/dashboard
related_workflows:
  - devrules/workflows/browser-automation-fix.md
  - devrules/workflows/seo-optimization.md
last_reviewed: 2026-07-04
---

# UI Domain Templates

UI templates define product-grade surfaces. They are not landing-page prompts. For conversion-page structure and copy evidence, use the sibling `../landing-page/` library; use this domain to keep repeated product screens, admin consoles, editors, and dashboards coherent.

## Recommended Reading Order

| Task | Read |
| --- | --- |
| Define tokens, components, layout, states, and accessibility | `design-system.md` |
| Build admin consoles, product dashboards, editors, detail pages, or operational panels | `admin-product-ui.md` |
| Enforce a repo-wide design system with DESIGN.md as the single source of truth (token sync, hardcode gates, workflows) | `devrules/design-readme.md` |
| Extract or apply a named reusable style backed by existing project evidence | `devrules/workflows/design-extract-style.md`, `devrules/design-styles/README.md`, `devrules/workflows/design-apply-style.md` |
| Create or refactor a landing page while preserving the project design system | `../landing-page/README.md`, `devrules/workflows/landing-page.md`, then the routed design workflow |

## Domain Principles

- Product UIs should optimize repeated use, scanning, and action confidence.
- Admin screens need dense but calm information architecture.
- Component states are part of the design system: empty, loading, partial, error, disabled, permission-denied, success, destructive confirmation.
- Domain concepts should be visible in layout hierarchy, not hidden behind generic cards.
- Visual polish must be verified with screenshots when UI changes matter.
