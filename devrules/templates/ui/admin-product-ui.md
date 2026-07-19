---
title: Admin And Product UI Patterns
description: Pattern for admin consoles, product dashboards, editor surfaces, detail pages, forms, lists, and operational panels.
ownership: seed
governs: product
activation: conditional
enforcement: example
decision_owner: project
side_effects: none
applies_to:
  - admin consoles
  - SaaS dashboards
  - AI configuration panels
  - content editors
  - desktop-like web apps
use_when:
  - A feature needs a usable product surface rather than isolated controls.
do_not_use_when:
  - The task only changes underlying business logic.
outputs:
  - screen information architecture
  - state and action model
  - admin/product layout checklist
  - verification plan
case_sources:
  - NovelWiki/src/components/admin
  - DeGit/src/pages/Prompts
  - DeGit/src/pages/FlowMode
  - NovelEditor/src/modules/template-factory/components
  - structureUI/apps/web/components
  - FrameCast/src/dashboard
related_workflows:
  - devrules/workflows/browser-automation-fix.md
last_reviewed: 2026-06-11
---

# Admin And Product UI Patterns

Product UI should support repeated work. Admin UI should make risk, status, and action boundaries obvious.

## Information Architecture

For each screen define:

- primary object
- primary action
- secondary actions
- filters or navigation
- status indicators
- empty/loading/error states
- permission-denied state
- destructive actions
- audit or history if relevant

## Admin Console Pattern

Good admin consoles usually include:

- scoped navigation by domain
- searchable tables or lists
- detail panel or page
- explicit action buttons
- status badges
- safe retry controls
- reason capture for manual changes
- audit/history section
- diagnostics link or trace ID

Avoid hiding operationally important state in hover-only UI.

## AI Configuration UI

AI admin surfaces often need:

- provider list
- key validation status
- model discovery
- route assignment
- prompt version publishing
- agent preset publishing
- usage and error charts
- kill switch

Separate read-only diagnostics from configuration changes.

## Editor/Product Surface Pattern

Editors and dashboards benefit from:

- persistent navigation
- clear current selection
- preview/detail split when comparing assets
- command availability rules
- autosave or explicit save state
- undo/redo where domain needs it
- export/import flows
- job progress surface for long tasks

## Forms

Forms should include:

- field-level labels and help
- validation before submit
- server error mapping
- dirty state
- cancel/reset behavior
- optimistic updates only when safe
- disabled or loading state

## Review Checklist

- Primary object and action are clear on first viewport.
- Status and permissions are visible before action.
- Long-running operations expose progress and recovery.
- Destructive actions require explicit confirmation and reason when needed.
- Admin actions are auditable.
- UI is verified across desktop and mobile/compact widths when supported.
