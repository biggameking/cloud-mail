---
title: Performance Optimization
description: Pattern for rendering strategy, caching layers, data flow, budgets, and measurement.
ownership: seed
governs: product
activation: conditional
enforcement: example
decision_owner: project
side_effects: none
applies_to:
  - content sites
  - SaaS dashboards
  - AI products
  - editors
  - data-heavy apps
use_when:
  - A feature is slow, expensive, unstable under load, or likely to grow.
  - A project needs a performance plan before optimizing.
do_not_use_when:
  - No measurable goal or bottleneck hypothesis exists.
outputs:
  - performance goal
  - bottleneck hypothesis
  - rendering strategy
  - caching strategy
  - measurement and acceptance criteria
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

# Performance Optimization

Performance work should start with a goal and a hypothesis. The early performance template's decision-tree mindset remains useful, but keep implementation examples project-specific.

## Key Questions

- What user journey is slow?
- Is the bottleneck network, database, CPU, rendering, bundle size, provider latency, or job orchestration?
- Is the data public, user-specific, real-time, or offline?
- How fresh must the data be?
- Can the work be moved out of the interactive path?
- What metric proves improvement?

## Rendering Strategy

| Strategy | Use When | Watch Out For |
| --- | --- | --- |
| Static/pre-rendered | public content changes rarely | stale content and rebuild workflow |
| Incremental/static refresh | public content changes sometimes | invalidation complexity |
| Server-rendered | personalized or SEO-sensitive data | server latency and caching |
| Client-rendered | interactive app shell or local data | loading states and bundle size |
| Background job | long AI/export/analysis work | progress, cancellation, retries |
| Local/offline cache | desktop or offline-capable tools | sync conflict and stale auth |

## Caching Layers

Cache options:

- component memoization
- request cache
- client storage or IndexedDB
- server cache
- database materialized view
- queue/job result cache
- CDN/edge cache

Choose the highest layer that preserves correctness. Do not cache authorization-sensitive or entitlement-sensitive data without a clear invalidation rule.

## Data Flow Patterns

Read-heavy public data:

- pre-render or server cache
- invalidate on content update
- use CDN when safe

User-specific dashboard:

- server authorization
- request cache with user scope
- optimistic UI only for safe actions

Real-time collaboration:

- incremental updates
- conflict model
- backpressure
- reconnect behavior

AI or export jobs:

- enqueue long work
- stream semantic progress
- persist run state
- show retry/cancel/recover

Large dataset:

- pagination or virtualization
- search/filter server-side when needed
- avoid loading hidden detail data

## Measurement Plan

Record before and after:

- page or interaction latency
- Core Web Vitals where relevant
- API latency
- database query time
- job duration
- provider latency
- bundle size
- memory use
- error rate

Use production-like data volume when possible.

## Optimization Checklist

- Goal and metric are explicit.
- Slow path is reproduced.
- Bottleneck hypothesis is supported by evidence.
- Caching layer is scoped and invalidated.
- UI has loading, partial, and error states.
- Long work is moved to background or made resumable.
- Tests cover correctness around cache and permissions.
