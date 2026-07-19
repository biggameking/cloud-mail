---
description: Universal workflow for implementing code changes through the correct boundary and proving a non-negative health delta.
ownership: shared
governs: agent
activation: conditional
enforcement: advisory
decision_owner: project
side_effects: local
---

# Code Change Workflow

Use this workflow for production code, test code, executable scripts, build
logic, or configuration code changes.

## Goal

Deliver the requested behavior through the smallest correct boundary while
preserving or improving code health.

## Inputs

- User outcome and constraints.
- Repository entry guidance, project profile, and nearest README anchors.
- Existing implementation, callers, tests, and public contracts.
- Matching language profile under `devrules/profiles/` when repository guidance
  does not already answer the relevant language/tooling decision.
- Repository format, lint, typecheck, test, build, and architecture commands.

## Lane Selection

| Lane | Condition | Required preparation |
| --- | --- | --- |
| Tiny | Mechanical or clearly local behavior with no boundary pressure. | Read local context; implement and verify directly. |
| Local | One responsibility changes inside an established module. | State goal, constraints, done criteria, and focused checks. |
| Structural | Cross-module behavior, shared capability, duplicated logic, or an overloaded module. | Run `architecture-change-review.md` before implementation. |
| Failure | Bug, test failure, or unexpected behavior is the starting point. | Run `debug-root-cause.md` before choosing the fix. |

## Steps

1. Identify the current owner of the behavior and trace its real callers and
   side effects.
   For multi-stage work that will commit between phases, start a persistent
   task delta with `node devrules/scripts/task-delta.mjs start --repo <repo> --apply`.
2. Apply the compact core contract. Open `code-quality.md`,
   `modularity-and-dependencies.md`, or `change-health.md` only when the change
   presents a decision those rules resolve.
3. Select repository-native tools; load a language profile only when needed.
4. Decide whether the change reuses, extends, replaces, merges, isolates, or
   first refactors a boundary.
5. Protect current behavior with a focused test before refactoring when useful
   coverage is missing.
6. Implement one coherent change. Avoid unrelated cleanup and broad formatting.
7. Remove superseded behavior or record a bounded migration exit condition.
8. Select a verification tier and run only its required evidence:

   | Tier | Typical change | Required evidence |
   | --- | --- | --- |
   | Low | Documentation, metadata, generated refresh, or mechanical edit with no executable behavior. | Diff/format validation and the owning generator or document check when one exists. |
   | Focused | One established behavior boundary, local bug fix, or targeted test/script change. | Focused regression test or repeatable behavior check, relevant static check, and touched-file health audit. |
   | Broad | Cross-module/public contract, persistence/schema, dependency/build/signing, security/auth, migration, or release-critical change. | Focused checks plus affected integration/build/contract checks and architecture or release evidence where applicable. |

   Use `node devrules/scripts/verification-plan.mjs --repo <repo>` when present
   to classify the changed paths. Treat its result as a conservative plan that
   judgment may raise, never as proof that commands passed.
9. Run the generic touched-file ratchet when present:

   ```bash
   node devrules/scripts/code-health.mjs audit --repo <repo>
   ```

10. Review the final diff and update contracts, anchors, and durable decisions.
    For a multi-stage task, run `task-delta.mjs audit` before final acceptance
    and `task-delta.mjs clear --apply` only after the task is complete.

## Verification

Completion evidence must cover the changed boundary. A passing formatter alone
does not prove behavior; a passing unit test alone does not prove a public
contract or build. Report exact commands and any surface that could not run.

## When Not To Use

- Documentation-only changes with no executable behavior.
- Generated output refreshes governed by their own documented generator.
- Pure design-system work already routed through the more specific design
  workflow, unless it also changes executable product behavior.
