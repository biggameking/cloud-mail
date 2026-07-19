---
description: Rules for project memory, compaction, decisions, lessons, and evolution suggestions.
ownership: shared
governs: agent
activation: conditional
enforcement: advisory
decision_owner: project
side_effects: none
---

# Memory Governance

Memory exists to make future work faster and safer. It is not a transcript archive.

Every repository has its own memory. The shared template has only template-review memory. Do not let one project's private state leak into another project's instance or into the template.

When the user says "workflow", "rules", "工作流", or "规则", treat the request as devrules workflow/rule-system work by default. Classify whether the learning is project-specific, generally reusable, or explicit shared-template maintenance before writing memory or template files.

## Memory Files

| File | Write when | Keep it |
| --- | --- | --- |
| `memory/project-profile.md` | Stack, commands, source roots, entry points, or verification change. | Short and current. |
| `memory/decisions.md` | A durable technical, product, workflow, or architecture choice is made. | Stable, dated, scoped. |
| `memory/interaction-log.md` | A recent interaction contains useful context that has not yet been distilled. | Temporary and compactable. |
| `memory/lessons.md` | A reusable debugging or implementation lesson is learned. | Pattern-focused. |
| `memory/evolution-suggestions.md` | A lesson may improve the template system across projects. | Human-reviewable. |

## What To Record

Record:

- Durable user preferences.
- Architecture decisions and why they were made.
- Non-obvious project constraints.
- Repeated failure modes and root causes.
- Cross-project patterns worth standardizing.
- User feedback that changes how Agents should work in this repository.
- Initialization or audit findings that future Agents should not rediscover.

Do not record:

- Secrets, keys, tokens, passwords, cookies, private URLs with credentials.
- Long raw logs.
- One-off implementation chatter.
- Information already obvious from code or README anchors.

## Feedback Updates Within The Request Boundary

After a development interaction, decide whether durable context exists. Write it
only when the current request already authorizes repository changes or the user
explicitly asks for a memory update. For a read-only answer, review, diagnosis,
or plan, report the proposed durable note without writing it.

| Signal | Destination |
| --- | --- |
| User preference, durable convention, architectural constraint | `memory/decisions.md` or `memory/project-profile.md` |
| Repeated error, root cause, reusable debugging lesson | `memory/lessons.md` |
| In-progress state that another Agent may need before it is distilled | `memory/interaction-log.md` |
| Repeatable improvement that belongs in the shared template after human review | `memory/evolution-suggestions.md` during ordinary project work; template `memory/decisions.md` during explicit template maintenance |

Skip memory updates when the interaction was purely mechanical, obvious from code, or too noisy to help future work.

## Write Decision Matrix

Use this matrix before writing memory:

| Memory value | Write | Do not write |
| --- | --- | --- |
| Future Agent can avoid search or a known failure | Yes | No |
| It changes how this project should be edited, tested, or released | Yes | No |
| It is a one-off task note with no future use | No | Yes |
| It contains secrets, tokens, personal data, or private URLs with credentials | No | Yes |
| It is already captured in README anchors or stable code comments | Usually no | Yes unless the anchor should be updated |
| It applies to many repositories | Write an evolution suggestion during ordinary project work; update the shared template during explicit template maintenance | Do not copy project-local private details into the template |

Memory writes should be small. A useful memory update is usually one dated section or one table row, not a copied transcript.

## Immediate Interaction Protocol

At the end of a non-trivial interaction whose write boundary includes project
documentation or memory:

1. Check whether the user corrected the Agent's workflow, preference, or assumption.
2. Check whether a command, platform lane, entry point, or verification path was discovered.
3. Check whether a failure produced a reusable root cause.
4. Check whether unresolved state needs handoff before it becomes a durable decision.
5. Write the smallest matching memory entry, or skip the write when no durable
   context exists or the current request is read-only.

This protocol is Agent-mediated. It does not require a daemon or background watcher. Scripts can help compact or collect memory, but the Agent is responsible for judging what is worth keeping.

## Template Boundary

Project instances may write evolution suggestions, but they must not directly modify the shared template during ordinary project work. Template updates require explicit template-maintenance intent or a direct user instruction to make a rule/workflow generic for all projects.

Use:

```bash
devrules evolution collect --root <parent> --dry-run
devrules evolution collect --root <parent> --apply
```

Collected suggestions are review input. They are not automatically promoted into rules, workflows, scripts, or templates.

When template-maintenance intent is explicit:

1. Update the affected project instance first when the need was discovered inside a concrete project.
2. Abstract the reusable part so it does not contain project-local private commands, URLs, credentials, data, or narrow naming.
3. Update the shared template `devrules/` files intentionally.
4. Record a concise template decision in template-side `devrules/memory/decisions.md`.
5. Run `devrules workspace sync-template --registered --apply` for eligible
   repositories across registered workspace parents. Use
   `devrules batch sync-template --root <parent> --apply` only when one
   workspace parent is intentionally in scope. This sync is baseline-protected
   and incremental; report skipped repositories and any `conflict` actions
   separately.

## Privacy And Scope Boundary

- A repository instance may contain project-specific context only for that repository.
- Shared template memory may contain only reviewed generic evolution suggestions.
- Do not copy private implementation details, customer data, API URLs with credentials, or repository-specific secrets into the template.
- If a project lesson contains sensitive details, generalize it before writing an evolution suggestion.

## Decision Format

```markdown
## YYYY-MM-DD - Decision title

- Context: why the decision was needed.
- Decision: what was chosen.
- Scope: files, modules, or workflows affected.
- Consequence: what future Agents should preserve or revisit.
```

## Lesson Format

```markdown
## YYYY-MM-DD - Lesson title

- Symptom: what was observed.
- Root cause: what actually caused it.
- Better next time: the reusable action.
- Applies to: project areas or technology.
```

## Evolution Suggestion Format

```markdown
## YYYY-MM-DD - Suggestion title

- Observed in: repository or project family.
- Pattern: repeated issue or opportunity.
- Suggested template change: rule, workflow, script, or template to adjust.
- Confidence: low | medium | high.
```

## Compaction

Run memory compaction when `interaction-log.md` becomes noisy or older notes have been distilled.

Compaction should:

1. Extract durable decisions into `decisions.md`.
2. Extract reusable lessons into `lessons.md`.
3. Preserve unresolved context in `interaction-log.md`.
4. Move superseded shared-template decisions to `decisions-archive.md` when
   retaining their historical context is useful.
5. Archive or remove stale raw notes.

`decisions-archive.md` is historical context only and is never active
authority. Project memory must not create this file unless project policy
explicitly selects an archive.

Last updated: 2026-07-17
