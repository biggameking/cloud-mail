---
title: External Workflow Adoption Review
description: Seed checklist for extracting only non-overlapping value from an external Agent workflow or harness.
ownership: seed
governs: agent
activation: explicit
enforcement: advisory
decision_owner: project
side_effects: none
applies_to:
  - explicit devrules template maintenance
  - major model or Codex capability upgrades
  - external Agent workflow and skill-pack reviews
use_when:
  - Considering ideas from another harness, workflow repository, or Agent framework.
do_not_use_when:
  - Normal product implementation already has a selected project workflow.
outputs:
  - overlap classification
  - smallest useful increment
  - adopt, defer, reject, or no-change decision
---

# External Workflow Adoption Review

Use this only during explicit template maintenance. The goal is to find a real missing capability, not to import another lifecycle.

## Review Questions

1. Is the capability already native to the active model?
2. Is it already provided by the active Agent product, such as goals, plans, review, subagents, worktrees, hooks, sandboxing, approvals, or memory?
3. Does devrules already provide an equivalent rule, workflow, template, memory path, or script?
4. What unique gap remains?
   - project facts;
   - domain knowledge;
   - cross-repository governance;
   - deterministic automation;
   - a repeated, evidenced failure mode.
5. Can the gap be addressed with one principle, template, check, or script instead of a mandatory process?
6. What representative evidence would prove the increment helps without creating prompt or coordination overhead?

## Decision

Choose one:

- `adopt-minimal`: add only the non-overlapping increment.
- `defer`: useful idea, but evidence or compatibility is insufficient.
- `reject-overlap`: the model, Agent surface, or existing devrules already owns it.
- `no-change-needed`: the current system is sufficient.

Record the source, overlap analysis, minimum proposed delta, affected files, model support, verification, and rollback path. Do not add a normal-task hook for this review.
