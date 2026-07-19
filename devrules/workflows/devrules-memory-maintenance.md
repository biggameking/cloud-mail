---
description: Maintain project memory by distilling logs into decisions, lessons, and suggestions.
ownership: shared
governs: agent
activation: conditional
enforcement: advisory
decision_owner: project
side_effects: local
---

# devrules Memory Maintenance Workflow

Use this workflow when project memory is becoming noisy or when a durable decision or lesson appears.

For small immediate updates after a task, use `devrules-feedback-update.md` first. Use this workflow when memory needs compaction, distillation, or cleanup.

## Triggers

- A user gives a durable preference.
- A technical decision affects future work.
- A bug fix reveals a reusable lesson.
- `interaction-log.md` grows too long.
- Several notes should be converted into decisions or lessons.
- `devrules-feedback-update.md` produced enough notes that compaction is now useful.

## Steps

1. Read `rules/memory-governance.md`.
2. Review `memory/interaction-log.md`.
3. Move durable decisions to `memory/decisions.md`.
4. Move reusable lessons to `memory/lessons.md`.
5. Move cross-project improvement ideas to `memory/evolution-suggestions.md`.
6. Leave unresolved current context in `interaction-log.md`.
7. Archive or compact stale raw notes.

## Automation

Use the CLI for simple compaction:

```bash
devrules memory compact --repo <repo> --dry-run
devrules memory compact --repo <repo> --apply
```

The CLI uses simple textual heuristics. A human or Agent should still review important memory changes.

## Done Criteria

- Memory is shorter and more actionable.
- Decisions include context, decision, scope, and consequence.
- Lessons include symptom, root cause, and better next action.
- No secrets or raw credentials were written.

Last updated: 2026-06-19
