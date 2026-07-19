---
title: devrules Portable Agent Context System
description: General blueprint for turning devrules into a project-local, Agent-neutral, continuously maintained context system.
ownership: seed
governs: agent
activation: conditional
enforcement: example
decision_owner: project
side_effects: none
applies_to:
  - repositories using any configured Agent surface
  - web applications
  - mobile applications
  - desktop applications
  - backend services
  - monorepos
use_when:
  - Designing or reviewing the devrules system itself.
  - Initializing many repositories from one template.
  - Adapting devrules to a new Agent, platform, or project shape.
do_not_use_when:
  - A normal product task only needs local project code and README anchors.
outputs:
  - system boundaries
  - initialization contract
  - memory loop
  - automation contract
related_rules:
  - devrules/rules/agent-entry-priority.md
  - devrules/rules/context-fractal.md
  - devrules/rules/memory-governance.md
  - devrules/rules/script-governance.md
  - devrules/rules/system-maturity.md
related_workflows:
  - devrules/workflows/devrules-initialize.md
  - devrules/workflows/devrules-feedback-update.md
  - devrules/workflows/devrules-evolution-review.md
  - devrules/workflows/devrules-script-automation.md
last_reviewed: 2026-07-19
---

# devrules Portable Agent Context System

devrules is a template-to-instance system for keeping fast-changing project code anchored to stable Agent context.

## Core Invariants

- `devrules/always-readme.md` is the single orchestration root inside each repository instance.
- Official Agent entry files keep their native role and point to `devrules/always-readme.md`.
- Shared rules remain devrules-owned; seed templates may be adapted by project
  instances and local policy remains project-owned.
- Project-specific learning stays in that project's `devrules/memory/`.
- Cross-project learning is written as an evolution suggestion and promoted to the template only by explicit review.
- Automation defaults to dry-run, writes only with `--apply`, and owns only managed blocks unless a workflow says otherwise.
- Workspace adoption starts with readiness classification and applies only repositories that are safe for automation.

## Instance Topology

```text
repo/
├── AGENTS.md
├── CLAUDE.md                  # optional, only when the project uses Claude
├── .cursorrules               # optional, only when present or configured
├── devrules/
│   ├── always-readme.md       # orchestration root
│   ├── config.json            # project-local tuning
│   ├── manifest.json          # detected state and maturity
│   ├── hooks/
│   ├── memory/
│   ├── rules/
│   ├── scripts/
│   ├── templates/
│   └── workflows/
└── source roots and README anchors
```

## Three-Level Context Fractal

| Level | Artifact | Purpose |
| --- | --- | --- |
| Repository | Entry files plus `devrules/memory/project-profile.md` | Project identity, stack, source roots, commands, verification. |
| Source root | Managed README anchors under active roots | Where code lives and which broad lane owns which behavior. |
| Semantic module | Managed README anchors under high-signal modules | Public interfaces, dependencies, side effects, checks, update rules. |

Leaf anchors are optional. Add them only for complex or risky subdirectories.

## Feedback Memory Loop

1. Agent completes or advances a task whose write boundary includes project
   documentation or memory.
2. Agent asks whether the interaction produced durable context.
3. Agent writes the shortest useful note into project memory when authorized;
   read-only requests may report a proposed note without writing it:
   - project map or command: `project-profile.md`;
   - durable choice: `decisions.md`;
   - reusable failure/root cause: `lessons.md`;
   - unresolved handoff state: `interaction-log.md`;
   - cross-project improvement: `evolution-suggestions.md`.
4. Periodically compact noisy interaction logs.
5. Periodically collect evolution suggestions from many repositories for manual template review.

## Workspace Initialization

Resolve the canonical shared template and registered workspace roots through
the device runtime locator. Do not infer template authority merely because a
`devrules/` directory sits beside many repositories.

Use:

```bash
devrules workspace scan
devrules workspace readiness
devrules workspace apply-ready --apply
```

For an explicit parent:

```bash
devrules batch readiness --root <parent>
devrules batch apply-ready --root <parent> --apply
```

`apply-ready` should skip repositories that are already ready or need review.

## Dynamic Maintenance

Project facts and reusable learning are maintained by normal Agent interactions.
Separately, a device may explicitly install the released-template updater to
verify immutable releases and converge eligible project instances without a
SessionStart write. The updater never invents or promotes project-local facts.

| Event | Route |
| --- | --- |
| New session | Read the entry file and `always-readme.md`; load project profile or a matching hook only when current context is insufficient. |
| Before non-trivial edit | Read nearest README anchors and route through workflow management. |
| File or boundary change | Update README anchors or project profile when responsibilities change. |
| Failure | Use root-cause debugging and write a lesson only when reusable. |
| User correction or durable preference | Write a decision or project-profile note. |
| Cross-project pattern | Write an evolution suggestion in the project instance. |
| Noisy interaction log | Compact memory and archive raw notes. |
| Published template release | An opted-in device scheduler verifies and installs the release, then safely converges clean/equal projects; ineligible projects remain deferred. |

This keeps the repository instance current while preventing the shared template from absorbing project-local private details.

## Agent Binding Policy

The template's example entry configuration currently supports:

- create `AGENTS.md`;
- bind existing `CLAUDE.md`;
- bind existing `.cursorrules`;
- bind existing `.windsurfrules`;
- create `.cursor/rules/devrules.mdc` when missing and keep its managed block and routing card current.

Projects may keep, remove, or add entry surfaces in `devrules/config.json` for
the Agents they actually use. Every managed entry points to the same
`always-readme`; do not fork it per Agent.

## Template Promotion Policy

Promote a project suggestion into the template only when it is:

- repeated across repositories or clearly general;
- free of private project data;
- small enough to express as a rule, workflow step, script behavior, or template section;
- safer than leaving Agents to rediscover it.

Rejected suggestions should remain project-local or be marked as project-specific.

## Script Automation Policy

Shared scripts belong under `devrules/scripts/` and should be cross-platform. Project-local scripts may extend the instance, but they need explicit read/write scope and dry-run behavior. Promote a project script to the shared template only after it appears generally useful across repositories and can be expressed without private assumptions.
