---
title: Reporting And Insights
description: Pattern for reports, scheduled insights, KPI dashboards, admin analytics, evidence packs, and decision loops.
ownership: seed
governs: product
activation: conditional
enforcement: example
decision_owner: project
side_effects: none
applies_to:
  - executive dashboards
  - product analytics
  - operational reports
  - AI quality reports
  - simulation or content reports
use_when:
  - Users or operators need periodic or on-demand reports.
  - Data must be turned into decisions, recommendations, or evidence packs.
do_not_use_when:
  - Raw event storage is enough and no report consumer exists.
outputs:
  - report contract
  - dashboard layout plan
  - scheduled report workflow
  - insight review checklist
case_sources:
  - HumanSphere reporting modules
  - auto-threads daily reports
  - AutoMarketing report generator
  - planner-v0 idea analytics reports
  - NovelWiki book analytics
related_workflows:
  - devrules/workflows/release.md
  - devrules/workflows/documentation-update.md
last_reviewed: 2026-06-11
---

# Reporting And Insights

Reports should move from raw data to decision support. A good report explains what changed, why it may matter, and what to inspect next.

## Report Contract

Define:

- audience
- cadence
- data sources
- filters
- metric definitions
- comparison window
- freshness
- narrative or insight rules
- export format
- permission rules

## Dashboard Layout

Useful sections:

- headline KPIs
- trend chart
- breakdown table
- anomaly or change explanation
- failed jobs or data quality warning
- recommended actions
- drilldown links

Avoid dashboards that only show numbers without definitions or next steps.

## Scheduled Reports

Scheduled report workflow:

1. collect source data
2. validate completeness
3. compute metrics
4. generate narrative
5. persist report snapshot
6. notify subscribers
7. expose retry and audit information

For AI-generated narratives, store source metrics and model route separately from the prose.

## Evidence Packs

For release, audit, or incident workflows, evidence packs may include:

- commands run
- test results
- screenshots
- metric snapshots
- logs or trace IDs
- decisions and risks

Keep evidence pack generation repeatable and timestamped.

## Review Checklist

- Report has a named audience and purpose.
- Metrics are defined and reproducible.
- Data freshness is visible.
- Generated insights are traceable to source data.
- Permissions prevent leaking sensitive operational or customer data.
