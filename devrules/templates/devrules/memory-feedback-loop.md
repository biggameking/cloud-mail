---
title: Memory Feedback Loop
description: Template for turning daily Agent interactions into durable project-local memory.
ownership: seed
governs: agent
activation: conditional
enforcement: example
decision_owner: project
side_effects: none
applies_to:
  - repository-local devrules instances
  - multi-agent development sessions
  - long-lived product repositories
use_when:
  - A task produces a durable user preference, project convention, lesson, or template suggestion.
do_not_use_when:
  - The task was mechanical and produced no future-useful context.
outputs:
  - updated project memory
  - compactable interaction notes
  - evolution suggestions when appropriate
related_rules:
  - devrules/rules/memory-governance.md
related_workflows:
  - devrules/workflows/devrules-feedback-update.md
  - devrules/workflows/devrules-memory-maintenance.md
last_reviewed: 2026-06-19
---

# Memory Feedback Loop

The feedback loop turns daily development interaction into a small set of durable context files.

## End-Of-Task Gate

Before ending a non-trivial task, ask:

| Question | Destination |
| --- | --- |
| Did the user correct a durable workflow preference? | `memory/decisions.md` |
| Did the task reveal a stable command, source root, platform lane, or verification path? | `memory/project-profile.md` |
| Did a failure reveal a reusable root cause? | `memory/lessons.md` |
| Is there unresolved state another Agent must continue from? | `memory/interaction-log.md` |
| Would this improve many repositories? | `memory/evolution-suggestions.md` |

If none apply, skip memory.

## Entry Shapes

Decision:

```markdown
## YYYY-MM-DD - Decision title

- Context: why this matters.
- Decision: what future Agents should do.
- Scope: affected files, modules, workflows, or commands.
- Consequence: what to preserve or revisit.
```

Lesson:

```markdown
## YYYY-MM-DD - Lesson title

- Symptom: what was observed.
- Root cause: what actually caused it.
- Better next time: reusable action.
- Applies to: area or technology.
```

Evolution suggestion:

```markdown
## YYYY-MM-DD - Suggestion title

- Observed in: repository or project family.
- Pattern: repeated issue or opportunity.
- Suggested template change: rule, workflow, script, or template to adjust.
- Confidence: low | medium | high.
```

## Compaction

`interaction-log.md` is temporary. Compact it when it becomes noisy:

```bash
devrules memory compact --repo <repo>
devrules memory compact --repo <repo> --apply
```

Compaction should move durable items into decisions or lessons and archive the raw interaction log.

## Template Boundary

Project memory is local to the repository. The shared template should receive only reviewed, generalized suggestions. Use:

```bash
devrules evolution collect --root <workspace> --apply
```

Collection is not promotion. A human still decides which suggestions become template rules.
