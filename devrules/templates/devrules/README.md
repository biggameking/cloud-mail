---
title: devrules Domain Templates
description: Index for project-local devrules instance structure and maintenance.
ownership: shared
governs: agent
activation: conditional
enforcement: example
decision_owner: project
side_effects: none
applies_to:
  - repositories initialized with devrules
  - template evolution work
  - multi-repository engineering systems
use_when:
  - A repository needs a project-local devrules instance.
  - The template system itself is being reviewed or extended.
do_not_use_when:
  - A task only needs a domain implementation template.
  - A repository has not opted into devrules.
outputs:
  - instance structure
  - memory contract
  - entry binding policy
  - maturity checklist
case_sources:
  - devrules/scripts/devrules.mjs
  - devrules/rules/context-fractal.md
  - devrules/rules/memory-governance.md
related_workflows:
  - devrules/workflows/devrules-initialize.md
  - devrules/workflows/devrules-audit.md
  - devrules/workflows/devrules-memory-maintenance.md
  - devrules/workflows/devrules-feedback-update.md
  - devrules/workflows/devrules-evolution-review.md
last_reviewed: 2026-06-19
---

# devrules Domain Templates

Use this domain when initializing or maintaining a repository-local devrules instance.

## Templates

| Template | Use For |
| --- | --- |
| `devrules-instance.md` | Project-local directory structure, entry binding, memory files, and maturity checklist. |
| `system-blueprint.md` | Portable system design for Agent-neutral entry binding, workspace initialization, context anchors, automation, and memory loops. |
| `workspace-initialization.md` | Batch adoption from a shared template `devrules/` directory into sibling Git repositories. |
| `memory-feedback-loop.md` | Turning daily Agent interactions into concise project-local memory and evolution suggestions. |
| `script-automation.md` | Designing safe cross-platform scripts under `devrules/scripts/`. |
| `model-support.md` | Recording the host/user model-selection boundary and project-owned compatibility evidence without choosing an Agent or model. |
| `external-workflow-adoption-review.md` | Extracting the smallest non-overlapping increment from an external Agent workflow or harness. |

## Maintenance Rules

- Keep these templates aligned with `devrules/always-readme.md` and core rules.
- Do not add project-local private context here.
- Promote only general patterns that apply across multiple repositories or project families.
- Use the external-workflow adoption review only during explicit template maintenance; it must not become a normal-task lifecycle.
