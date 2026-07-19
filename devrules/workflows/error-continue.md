---
description: Create a compact continuation snapshot when work must resume in a new conversation or after interruption.
ownership: shared
governs: agent
activation: conditional
enforcement: advisory
decision_owner: project
side_effects: local
---

# Continuation Snapshot Workflow

Use this workflow when a task spans multiple conversations, a session is interrupted, or another Agent needs to continue without rereading the full history.

## Core Principle

The snapshot is a recovery artifact, not a second architecture document. It should preserve the minimum durable context needed to continue safely: goal, decisions, current state, touched files, verification, risks, and exact next actions.

## Trigger

- The user asks to continue later or hand off the work.
- The conversation is close to losing context.
- The task has meaningful partial implementation that should not be rediscovered.
- A workflow, bug investigation, or refactor needs a durable checkpoint.

## Output Location

Create or update one of these files, choosing the narrowest useful scope:

- `devrules/memory/interaction-log.md` for routine session notes.
- `docs/<task-name>-continuation.md` for task-level handoff notes.
- A project-specific tracker already used by the repository, if one exists.

## Snapshot Structure

Use the following sections. Mark technology-specific sections as `Not applicable` when they do not fit the project.

```markdown
# <Task Name> Continuation Snapshot

## Goal
- User-visible outcome.
- Non-goals or constraints.

## Current State
- What is already implemented or discovered.
- What is partially complete.
- What is intentionally untouched.

## Decisions
- YYYY-MM-DD - Decision title: reason and tradeoff.

## Files And Areas
| Path | Status | Notes |
|------|--------|-------|
| `path/to/file` | changed / inspected / planned | concise note |

## Domain Notes
- Data model, API, UI, CLI, mobile, desktop, infra, or package details that matter.
- Use `Not applicable` for irrelevant domains.

## Verification
- Commands run and result.
- Manual checks performed.
- Checks still needed.

## Risks
- Known uncertainty.
- Integration concern.
- Integration, versioning, or data transition issue.

## Next Actions
- [ ] First concrete next step.
- [ ] Second concrete next step.
```

## Steps

1. Reconstruct the current goal and done criteria from the conversation and latest files.
2. Record decisions only when they will prevent future re-litigation.
3. List touched files and directories with status, not full code dumps.
4. Include only domain notes that are relevant to the repository.
5. Record verification with exact commands when available.
6. End with concrete next actions that another Agent can execute directly.

## Safety Rules

- Do not invent completed work.
- Do not quote private or credential-like content.
- Do not require database, frontend, TypeScript, hooks, or deployment sections unless they apply.
- Prefer short, durable facts over narrative.

## Memory Update

After creating a continuation snapshot, add a one-line pointer to `devrules/memory/interaction-log.md` when the project has a devrules instance.
