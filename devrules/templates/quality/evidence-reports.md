---
title: Evidence Reports
description: Pattern for completion audits, handoff reports, benchmark probes, release evidence, and verification summaries.
ownership: seed
governs: agent
activation: conditional
enforcement: example
decision_owner: project
side_effects: none
applies_to:
  - large changes
  - release candidates
  - desktop builds
  - migration projects
  - agent-generated work
use_when:
  - Work needs durable proof, handoff, or audit trail.
do_not_use_when:
  - A small change can be summarized in a normal final message.
outputs:
  - evidence report structure
  - completion audit checklist
  - handoff notes
  - benchmark/probe record
case_sources:
  - AutoMedia desktop completion audit
  - SetMail release runbook
  - NovelEditor benchmark probe artifacts
  - DeGit phase verification reports
  - magic-novel-forge rollout reports
related_workflows:
  - devrules/workflows/release.md
  - devrules/workflows/documentation-update.md
last_reviewed: 2026-06-11
---

# Evidence Reports

Evidence reports are useful when work spans many files, platforms, or risk boundaries.

## Report Structure

Include:

- objective
- scope
- files/modules touched
- verification commands
- evidence artifacts
- passed gates
- failed or skipped gates
- remaining risks
- handoff notes

## Completion Audit

Audit whether:

- stated objective is actually complete
- non-goals stayed out of scope
- tests or checks match risk
- docs/runbooks were updated
- release or rollback path is clear
- temporary files were removed

## Benchmark Probe

For performance or runtime work, record:

- probe command
- environment
- before/after numbers
- thresholds
- artifact path
- interpretation

## Review Checklist

- Evidence can be reproduced.
- Skipped checks are explained.
- Report points to artifacts rather than dumping logs.
- Handoff is useful to another engineer or agent.
