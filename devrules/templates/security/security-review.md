---
title: Security Review
description: Practical review checklist for sensitive features, admin operations, billing, AI providers, sync, and release gates.
ownership: seed
governs: agent
activation: conditional
enforcement: example
decision_owner: project
side_effects: none
applies_to:
  - sensitive feature reviews
  - release readiness
  - admin and billing changes
  - AI and provider integration
use_when:
  - A feature changes trust boundaries, secrets, permissions, payments, or data movement.
do_not_use_when:
  - The change is purely cosmetic and has no data or execution impact.
outputs:
  - risk classification
  - review checklist
  - required verification
  - residual risk notes
case_sources:
  - planner-v0 governance gates
  - SetMail release and security docs
  - DeGit diagnostics and backup tests
  - magic-novel-forge RLS/callback contract tests
related_workflows:
  - devrules/workflows/release.md
last_reviewed: 2026-06-11
---

# Security Review

Use this as a lightweight review before shipping sensitive changes.

## Risk Questions

- What new data can be read?
- What new data can be written or deleted?
- What secrets are introduced?
- What external provider is trusted?
- What happens if the operation is replayed?
- Can offline or stale state bypass permission or entitlement?
- What is logged?
- What can an admin do now that they could not before?

## Required Evidence

Based on risk:

- permission tests
- webhook signature tests
- secret redaction tests
- backup/restore roundtrip
- sync conflict tests
- payment replay tests
- local API auth tests
- migration rollback notes

## Residual Risk Notes

Document:

- accepted risks
- deferred mitigations
- owner
- review date
- rollback or kill switch

## Review Checklist

- Trust boundary is named.
- Sensitive data flow is minimized.
- Permissions are server/native-side, not UI-only.
- Secrets are redacted and rotated.
- Replay and idempotency are considered.
- Release plan includes rollback.
