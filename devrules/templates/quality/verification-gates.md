---
title: Verification Gates
description: Pattern for risk-based gates, CI/local commands, platform checks, release gates, and acceptance criteria.
ownership: seed
governs: agent
activation: conditional
enforcement: example
decision_owner: project
side_effects: none
applies_to:
  - CI pipelines
  - release workflows
  - multi-platform projects
  - desktop apps
  - safety-sensitive changes
use_when:
  - A project needs standard gates before merge, deploy, or release.
do_not_use_when:
  - No repeatable verification command exists and the task is exploratory.
outputs:
  - gate matrix
  - command list
  - acceptance criteria
  - residual risk notes
case_sources:
  - planner-v0 governance verification gates
  - AutoMedia desktop verification scripts
  - SetMail release runbook
  - DeGit CLI bridge smoke tests
related_workflows:
  - devrules/workflows/release.md
last_reviewed: 2026-06-11
---

# Verification Gates

Verification gates should be explicit and risk-based.

## Gate Types

- format/lint
- typecheck
- unit tests
- contract tests
- integration tests
- build
- migration validation
- security checks
- smoke tests
- visual checks
- platform-specific checks

## Acceptance Criteria

For each task define:

- what must work
- what must not regress
- commands run
- evidence produced
- known gaps
- owner of follow-up

## Platform Gates

Multi-platform projects should define:

- shared core checks
- web lane checks
- desktop/native checks
- mobile/iOS checks
- bridge/API contract checks
- manifest/route governance checks

## Review Checklist

- Required commands are documented.
- Gates match risk class.
- Local and CI commands are aligned.
- Failed gates block release or produce explicit residual risk.
- Evidence is saved for high-risk releases.
