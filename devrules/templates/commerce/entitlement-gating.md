---
title: Entitlement Gating
description: Pattern for feature access, plan limits, resource caps, paid AI routes, and server-side enforcement.
ownership: seed
governs: product
activation: conditional
enforcement: example
decision_owner: project
side_effects: none
applies_to:
  - SaaS feature gates
  - AI route access
  - export limits
  - workspace plans
  - subscription and credit products
use_when:
  - Feature access depends on plan, role, credit balance, usage, or workspace state.
do_not_use_when:
  - A feature is public and has no cost or permission boundary.
outputs:
  - entitlement matrix
  - enforcement boundary
  - denial reason codes
  - UI state checklist
  - test matrix
case_sources:
  - planner-v0/lib/subscription/helpers.ts
  - NovelWiki/src/components/subscription/UsageCard.tsx
  - NovelWiki/src/lib/credits
  - structureUI/apps/web/lib/export-watermark-policy.ts
  - structureUI/apps/web/lib/editor-command-availability.ts
related_workflows:
  - devrules/workflows/debug-root-cause.md
last_reviewed: 2026-06-11
---

# Entitlement Gating

Entitlement gating decides whether an actor may use a feature now. It should live at the operation boundary, not only in UI components.

## Entitlement Inputs

- actor
- workspace
- plan
- subscription state
- role or permission
- feature key
- resource count
- usage this period
- credit balance
- trial status
- admin override

Use stable feature keys such as `ai.longform`, `export.pdf`, `backup.restore`, or `team.seats`.

## Entitlement Matrix

For each feature define:

- required plan or add-on
- usage limit
- role or permission requirement
- credit requirement
- fallback behavior
- UI disabled reason
- upgrade path
- server error reason code

Keep the matrix close to product packaging, but enforce it in server-side code.

## Enforcement Boundaries

Enforce before:

- AI calls
- exports
- backup restore
- paid content generation
- seat invite
- high-cost background job
- provider API call

For expensive operations, reserve usage or credits before execution and commit/refund after result.

## Denial Reason Codes

Useful reason codes:

- not_authenticated
- plan_required
- subscription_inactive
- usage_limit_reached
- credit_required
- permission_required
- workspace_limit_reached
- feature_disabled
- admin_restricted

UI can translate reason codes into upgrade prompts, disabled states, or support actions.

## UI Patterns

- Show current usage next to gated actions when possible.
- Disable unavailable actions with a clear reason.
- Provide upgrade or credit purchase paths only when relevant.
- Avoid showing paid prompts that lead to server denial after a long setup flow.
- For admin-only gates, explain access rather than monetization.

## Review Checklist

- UI and server share feature keys and reason codes.
- Server enforcement happens before expensive work starts.
- Usage and credits cannot go negative through concurrent requests.
- Trial and cancellation edge cases are covered.
- Admin overrides are audited and scoped.
