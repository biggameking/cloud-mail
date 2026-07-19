---
description: Capture useful day-to-day development feedback into project-local memory.
ownership: shared
governs: agent
activation: conditional
enforcement: advisory
decision_owner: project
side_effects: local
---

# devrules Feedback Update Workflow

Use this workflow when an interaction reveals context that future Agents should preserve.

## Goal

Turn daily development feedback into concise project-local memory without polluting the shared template or storing noisy transcripts.

## Triggers

- The user states a durable preference or project convention.
- A task reveals a repeated failure mode, root cause, or workflow gap.
- The Agent learns a project-specific command, source root, platform lane, or verification expectation.
- Several repositories show the same problem and the pattern may deserve a template evolution suggestion.

## Steps

1. Read `devrules/rules/memory-governance.md`.
2. Classify the feedback:
   - project profile update;
   - durable decision;
   - reusable lesson;
   - temporary interaction state;
   - template evolution suggestion.
3. Write only the minimal durable note to the matching file under this repository's `devrules/memory/`.
4. If the item may apply across repositories, write it to this repository's `memory/evolution-suggestions.md` instead of editing the template.
5. If the user explicitly asks to make the mechanism generic, continue with `devrules-template-promotion.md`.
6. If the memory file grows noisy, run or recommend memory compaction.

## Classification Table

| Feedback | Destination | Example shape |
| --- | --- | --- |
| Stable project command, source root, platform lane, verification gate | `memory/project-profile.md` | Update the managed map when detected data changed, or add one concise project note. |
| User preference, architecture decision, workflow convention | `memory/decisions.md` | Date, context, decision, scope, consequence. |
| Root cause or repeated failure mode | `memory/lessons.md` | Symptom, root cause, better next time, applies to. |
| Useful but unresolved handoff state | `memory/interaction-log.md` | Short dated note with next action and affected files. |
| Pattern that should improve many repos | `memory/evolution-suggestions.md` | Observed in, pattern, suggested template change, confidence. |

## Skip Conditions

Do not write memory when:

- the information is already obvious from code, README anchors, or existing memory;
- the task was a small mechanical edit with no durable context;
- the note would contain secrets, raw logs, credentials, or private data;
- the idea is speculative and has not affected work yet;
- a README anchor update is the better place to store the context.

## Template Escalation

Project work may produce template suggestions, but it must not directly edit the shared template. Use this path:

1. Write the suggestion in the repository instance under `devrules/memory/evolution-suggestions.md`.
2. Later run `devrules evolution collect --root <parent> --apply` through the
   stable shared-template launcher.
3. Use `devrules-template-promotion.md` to abstract, update the shared template, sync, and report conflicts.
4. Review collected suggestions manually before changing shared rules, workflows, scripts, or templates.

## Verification

- The memory note is dated, scoped, and actionable.
- No secrets, credentials, private tokens, raw logs, or long transcripts were recorded.
- The shared template was not changed unless the current task is explicit template maintenance.

## Done Criteria

- Future Agents can use the note to work faster or safer.
- Project-specific learning remains in the project instance.
- Cross-project learning is captured as a reviewable suggestion.

Last updated: 2026-07-05
