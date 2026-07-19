---
description: Ratchet rule requiring each code change to preserve or improve code health.
ownership: shared
governs: agent
activation: conditional
enforcement: advisory
decision_owner: project
side_effects: none
---

# Change Health

Every code change must leave the touched system no harder to understand,
change, test, or operate than before. Perfection is not required; negative
health drift is not accepted silently.

## Change Classification

Before editing, classify the change as one or more of:

- reuse an existing responsibility;
- extend an existing public boundary;
- replace an obsolete path;
- merge duplicated behavior;
- isolate a provider, platform, or side effect;
- refactor a pressured boundary before adding behavior.

Tiny local changes can proceed without ceremony when the responsibility is
clear and no structural debt is added.

## No-Patch Ratchet

- Reproduce failures and identify the root cause before changing behavior.
- Add or update a focused regression test when practical.
- Do not stack a new condition, fallback, retry, flag, cache, or duplicate state
  on top of an unexplained design problem.
- When another special case appears for the same concept, reconsider the data
  representation or owning boundary.
- Delete superseded paths in the same change, or record a bounded migration and
  deletion condition.
- Separate behavior-preserving refactoring from feature/bug behavior when the
  combined diff would hide either one.
- Keep changes self-contained and reviewable. Line count is not the goal; one
  coherent intent is.
- Treat numeric size and complexity budgets as review signals, not automatic
  refactor orders. Prefer a documented cohesive exception over artificial
  splitting, compressed readability, duplicated glue, or lost behavior.

## Legacy Debt

Do not require an unrelated whole-repository cleanup before useful work. Apply
an incremental ratchet:

- no new lint or type errors;
- no new dependency cycle or forbidden cross-boundary import;
- no increase in an over-budget file without an explicit exception;
- no duplicated business rule or silent failure path;
- touched complexity stays level or decreases unless the added behavior and
  verification justify it;
- new files and modules meet the current standard immediately.

## Completion Gate

Before declaring completion:

1. Review the final diff for accidental scope and dead paths.
2. Run the closest relevant checks and read fresh output.
3. Run the repository's code-health audit when available.
4. Confirm comments, tests, contracts, and README anchors match the new shape.
5. Report health improvements, accepted exceptions, unverified surfaces, and
   any explicit follow-up.

An emergency containment may temporarily violate the normal shape only when
the user impact requires it, the root cause is understood, the containment is
visible, and the real correction has an owner and exit condition.
