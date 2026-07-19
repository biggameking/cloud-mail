---
description: Root-cause-first debugging workflow for build, runtime, test, and behavior failures.
ownership: shared
governs: agent
activation: conditional
enforcement: advisory
decision_owner: project
side_effects: local
---

# Debug Root Cause Workflow

Use this workflow when something fails or behaves surprisingly.

## Core Principle

Fix the root cause. Apply `devrules/rules/first-principles-development.md` before changing code: reason from the observed symptom, evidence, constraints, and failing boundary. Avoid broad fallback logic, rollback, catch-all tolerance, or masking symptoms unless the root cause is understood and containment is explicitly justified.

## Steps

1. Capture the exact symptom:
   - Command or user action.
   - Error output.
   - Expected behavior.
   - Actual behavior.
2. Identify the smallest reproducible path.
3. Trace the flow from entry point to failing behavior.
4. Form specific hypotheses.
5. Validate hypotheses with targeted reads, tests, logs, or reproduction.
6. Apply the smallest fix that addresses the root cause.
7. Run relevant verification.
8. Record a reusable lesson only if the issue is likely to recur.

## Anti-Patterns

- Adding null checks without understanding why the value is null.
- Swallowing errors to make a test pass.
- Replacing a specific failure with a broad retry.
- Adding fallback or rollback before proving why the primary path failed.
- Editing unrelated files while debugging.
- Restarting servers repeatedly without reading logs.

## Verification

Use the closest meaningful check:

- Unit or integration test.
- Typecheck.
- Lint.
- Build.
- Browser or app smoke test.
- Targeted script or API call.

## Memory Update

Write to `memory/lessons.md` when the root cause teaches a reusable project pattern. Write to `memory/evolution-suggestions.md` only if it should improve the shared template.

Last updated: 2026-07-06
