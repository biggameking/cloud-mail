---
title: Performance Domain Templates
description: Index for rendering, caching, data loading, performance budgets, and measurement patterns.
ownership: shared
governs: product
activation: conditional
enforcement: example
decision_owner: project
side_effects: none
applies_to:
  - content sites
  - SaaS dashboards
  - AI products
  - data-heavy editors
  - real-time or offline-capable apps
use_when:
  - A feature is slow, expensive, unstable under load, or likely to grow.
  - A project needs performance budgets or measurement before optimization.
do_not_use_when:
  - The task is purely textual documentation.
  - No measurable performance goal exists yet.
outputs:
  - bottleneck hypothesis
  - rendering strategy
  - caching strategy
  - data loading plan
  - measurement plan
case_sources:
  - magic-novel-forge/docs/templates early performance optimization experience
  - structureUI/apps/web/lib
  - DeGit/src/pages/FlowMode
  - NovelEditor/src/services/ai
  - FrameCast/src/projects
related_workflows:
  - devrules/workflows/browser-automation-fix.md
  - devrules/workflows/debug-root-cause.md
last_reviewed: 2026-06-11
---

# Performance Domain Templates

Performance work starts with a user-visible goal and a bottleneck hypothesis. Avoid changing caching, rendering, and data loading layers without a measurable before/after path.

## Recommended Reading Order

| Task | Read |
| --- | --- |
| Choose rendering, caching, data loading, and measurement strategies | `performance-optimization.md` |

## Domain Principles

- Optimize the path users actually take.
- Measure before and after.
- Cache at the highest layer that preserves correctness.
- Do not let convenience caches hide stale authorization or paid entitlement state.
- Treat AI calls, export jobs, and large document parsing as asynchronous or resumable when they can exceed interactive latency.
