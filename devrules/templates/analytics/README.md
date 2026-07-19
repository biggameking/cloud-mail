---
title: Analytics Domain Templates
description: Index for product analytics, telemetry event design, reporting, KPI dashboards, and insight loops.
ownership: shared
governs: product
activation: conditional
enforcement: example
decision_owner: project
side_effects: none
applies_to:
  - SaaS products
  - AI products
  - content platforms
  - admin consoles
  - operational dashboards
use_when:
  - Product behavior, usage, conversion, reliability, or business outcomes need measurement.
  - A project needs event taxonomy, telemetry, reporting, or insight dashboards.
do_not_use_when:
  - The task only needs low-level debug logging.
  - There is no product or operational decision tied to the data.
outputs:
  - analytics question map
  - event taxonomy
  - KPI/reporting model
  - dashboard checklist
  - governance notes
case_sources:
  - OpsHub analytics surfaces
  - planner-v0 analytics pages and actions
  - structureUI ops telemetry
  - html-to-image telemetry and insights
  - AutoMarketing analytics pages
  - HumanSphere reporting modules
  - NovelWiki prompt A/B tests and novel metrics
related_workflows:
  - devrules/workflows/debug-root-cause.md
  - devrules/workflows/release.md
last_reviewed: 2026-06-11
---

# Analytics Domain Templates

Analytics should answer product and operational questions. Start with decisions, not charts.

## Templates

| Template | Use For |
| --- | --- |
| `product-analytics.md` | Product questions, funnels, cohorts, KPI definitions, and analysis surfaces. |
| `telemetry-events.md` | Event taxonomy, event contracts, instrumentation boundaries, privacy rules. |
| `reporting-insights.md` | Reports, dashboards, scheduled insights, admin analytics, evidence loops. |

## Principles

- Every tracked event should support a decision, diagnostic, or user-visible improvement.
- Product analytics and operational telemetry can share infrastructure but should not blur semantics.
- Event names and properties are contracts. Treat breaking changes deliberately.
- Privacy and retention rules belong in the analytics design, not as an afterthought.
