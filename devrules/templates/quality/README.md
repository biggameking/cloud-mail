---
title: Quality Domain Templates
description: Index for verification gates, testing strategy, evidence reports, completion audits, and release confidence.
ownership: shared
governs: agent
activation: conditional
enforcement: example
decision_owner: project
side_effects: none
applies_to:
  - all production projects
  - desktop apps
  - web apps
  - AI systems
  - multi-platform products
use_when:
  - A project needs confidence, evidence, acceptance criteria, or release gates.
do_not_use_when:
  - The task is a tiny mechanical edit with obvious verification.
outputs:
  - test strategy
  - verification gate
  - evidence report
  - completion audit
case_sources:
  - AutoMedia desktop completion audit
  - planner-v0 governance verification scripts
  - DeGit runtime job tests
  - NovelEditor QA scripts and benchmark probes
  - structureUI focused domain tests
related_workflows:
  - devrules/workflows/release.md
  - devrules/workflows/debug-root-cause.md
last_reviewed: 2026-06-11
---

# Quality Domain Templates

Quality templates turn "seems done" into repeatable evidence.

## Templates

| Template | Use For |
| --- | --- |
| `test-strategy.md` | Unit, integration, contract, E2E, visual, performance, and migration tests. |
| `verification-gates.md` | Required gates before merge/release and risk-based verification. |
| `evidence-reports.md` | Completion audit, handoff reports, release evidence, benchmark probes. |
| `code-health-policy.md` | Project-local tuning for touched-file ratchets, large-file budgets, exclusions, and documented cohesive-file exceptions. |
| `ios-simulator-device-profile.template.json` | Project-owned one-device/two-App Simulator identity, allowlist, and disposable-device exception contract. Copy it to `devrules/memory/ios-simulator-device-profile.json`, replace every example identity, and validate it before persistent-device mutation. |
