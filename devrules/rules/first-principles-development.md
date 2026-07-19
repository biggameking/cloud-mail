---
description: First-principles development rule for planning, coding, and debugging.
ownership: shared
governs: agent
activation: conditional
enforcement: advisory
decision_owner: project
side_effects: none
---

# First-Principles Development

This rule applies whenever an Agent plans development work, writes code, fixes a
bug, handles a failing check, or encounters unexpected behavior.

## Core Principle

Reason from the goal, constraints, current evidence, and root cause before
choosing an implementation. When a problem appears, first ask how to solve the
actual problem. Do not escape the problem by hiding it behind rollback,
fallback, broad tolerance, silent degradation, or scope avoidance.

Fallbacks and rollbacks are not root-cause fixes. During an active, high-impact
incident, however, an authorized owner may contain harm before diagnosis is
complete with a bounded rollback, feature flag, traffic stop, or similarly
reversible control. Containment must remain distinguishable from resolution.

## Required Thinking

Before planning or coding, state or internally confirm:

1. What outcome must be true when the task is complete?
2. What evidence explains the current behavior or failure?
3. What root cause or design constraint must be addressed?
4. What is the smallest change that solves that cause without hiding it?
5. What verification proves the problem is actually solved?

For non-trivial work, include the goal, constraints, and done criteria in the
user-facing plan before editing.

## Anti-Patterns

- Adding a fallback because the primary path is broken and unexplained, outside
  the bounded incident-containment case below.
- Swallowing errors, returning empty data, or using default values to make a
  failure disappear.
- Leaving a rollback or disabled path in place without an owner, evidence,
  review point, or root-cause follow-up.
- Adding retries before proving the failure is transient.
- Avoiding the failing surface and declaring a narrower task complete.
- Treating symptoms as the problem when the boundary, data flow, or contract is
  wrong.

## Acceptable Containment

Containment is acceptable when all of these are true:

- actual or imminent user, safety, security, data, availability, or material
  operational harm justifies acting before the full diagnosis;
- the action is authorized for the affected environment and is the smallest
  practical reversible step;
- available evidence is captured before or during containment when doing so
  does not prolong the harm;
- the rollback, flag, fallback, or guard is visible in code, logs, UX, incident
  reporting, or deployment state;
- scope, owner, review/expiry condition, and root-cause follow-up are recorded;
- containment itself is verified, but is not reported as the permanent fix.

For routine defects without active impact, reproduce and diagnose before adding
containment. For incidents, stop the harm first when necessary, then resume
root-cause work from the preserved evidence.

## Verification

A task is not complete until verification exercises the path that previously
failed or proves the planned behavior through the closest meaningful check:
test, typecheck, lint, build, smoke path, reproduction, or targeted inspection.

Last updated: 2026-07-17
