---
title: Product Analytics
description: Pattern for analytics questions, metrics, funnels, cohorts, retention, segmentation, and product dashboards.
ownership: seed
governs: product
activation: conditional
enforcement: example
decision_owner: project
side_effects: none
applies_to:
  - SaaS applications
  - growth products
  - content products
  - AI features
  - admin analytics
use_when:
  - A team needs to understand usage, activation, retention, conversion, or feature impact.
  - A product surface needs analytics panels or reports.
do_not_use_when:
  - The task only needs runtime logs or debugging traces.
outputs:
  - analytics question map
  - metric definitions
  - funnel/cohort design
  - dashboard plan
  - review checklist
case_sources:
  - OpsHub analytics app routes
  - planner-v0 analytics and admin analytics pages
  - AutoMarketing analytics hooks and reports
  - HumanSphere simulation reporting
  - NovelWiki novel metrics
related_workflows:
  - devrules/workflows/release.md
last_reviewed: 2026-06-11
---

# Product Analytics

Product analytics begins with questions:

- Are users reaching the first meaningful success?
- Which features create durable value?
- Where do users drop out?
- Which paid limits or gates affect conversion?
- Which AI routes produce useful outputs?
- Which operational failures harm users?

## Metric Types

| Type | Examples |
| --- | --- |
| Activation | first project created, first successful export, first AI run completed |
| Engagement | weekly active workspace, saved draft count, prompt library usage |
| Retention | day/week/month return, cohort survival, repeat purchase |
| Conversion | trial to paid, credit purchase, upgrade after limit reached |
| Quality | successful job rate, accepted AI suggestion, rollback rate |
| Operations | failed webhook count, background job latency, restore success |

## Funnel Pattern

Define:

- entry event
- intermediate milestones
- success event
- failure or abandon event
- segment dimensions
- expected time window
- privacy constraints

Funnels should not depend on brittle UI-only events when server-side evidence exists.

## Cohort And Segmentation

Useful segments:

- account age
- plan or entitlement
- workspace size
- platform or lane
- locale
- source channel
- AI route or model class
- feature flag variant

Keep segment fields stable. Avoid storing raw personal content as dimensions.

## Analytics Surface

Dashboards should show:

- current value
- trend
- comparison window
- data freshness
- filters
- metric definition
- known limitations
- drilldown path

For admin surfaces, add operational actions only when permissioned and audited.

## Review Checklist

- Metrics have explicit definitions.
- Events are emitted from trustworthy boundaries.
- Dashboards state data freshness and filters.
- Privacy and retention are documented.
- Product and operational metrics are named distinctly.
