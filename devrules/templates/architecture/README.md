---
title: Architecture Domain Templates
description: Index for modular boundaries, monorepo/platform lanes, contract governance, manifests, and system shape.
ownership: shared
governs: agent
activation: conditional
enforcement: example
decision_owner: project
side_effects: none
applies_to:
  - large apps
  - monorepos
  - multi-platform products
  - modular desktop/web systems
  - shared libraries
use_when:
  - A project needs structural guidance, module boundaries, shared contracts, or platform split rules.
do_not_use_when:
  - The task is a small local fix inside an established module.
outputs:
  - module boundary map
  - platform lane policy
  - contract governance plan
case_sources:
  - planner-v0 platform sync boundary checklist
  - SetMail architecture
  - structureUI packages/domain separation
  - OpsHub apps/packages split
  - DeGit services and Tauri module split
related_workflows:
  - devrules/workflows/architecture-change-review.md
  - devrules/workflows/devrules-audit.md
last_reviewed: 2026-07-01
---

# Architecture Domain Templates

Architecture templates help agents preserve system shape. Use them before broad refactors, platform splits, or new shared packages.

`devrules/rules/architecture-governance.md` is the mandatory gate for medium+ features and cross-boundary changes. `devrules/workflows/architecture-change-review.md` decides whether a change can safely stay local or needs a small boundary adjustment first.

`modular-boundaries.md` is the primary template for that adjustment when the issue is responsibility, layering, data access, side effects, UI/domain separation, or service ownership. Use the workflow to decide whether the template is needed; do not open every architecture template by default.

## Templates

| Template | Use For |
| --- | --- |
| `modular-boundaries.md` | Responsibilities, layers, adapters, services, UI, data access, side effects. |
| `monorepo-platform-lanes.md` | Web/desktop/mobile lanes, shared packages, capability-specific divergence. |
| `contract-governance.md` | API/route/event/schema/manifest contracts and verification. |
