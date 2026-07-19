---
title: Authorization Policy
description: Pattern for resource-level authorization, policy boundaries, route guards, server checks, and testable access decisions.
ownership: seed
governs: product
activation: conditional
enforcement: example
decision_owner: project
side_effects: none
applies_to:
  - SaaS products
  - team workspaces
  - content platforms
  - admin tools
  - desktop apps with synced resources
use_when:
  - Access depends on actor, role, workspace, ownership, plan, or resource state.
  - A project needs consistent server-side permission decisions.
do_not_use_when:
  - Only public read-only content is involved.
outputs:
  - authorization boundary
  - policy decision pattern
  - resource access matrix
  - denial handling plan
  - policy test checklist
case_sources:
  - planner-v0/lib/permissions/check-permission.ts
  - planner-v0/lib/auth/api-request.ts
  - NovelWiki/src/lib/admin
  - DeGit/src/stores/adminStore.ts
  - structureUI/services/api/src/routes/auth.ts
related_workflows:
  - devrules/workflows/debug-root-cause.md
last_reviewed: 2026-06-11
---

# Authorization Policy

Authorization should be explicit and testable. Do not mix access decisions deeply into query code or UI conditionals without a named policy boundary.

## Policy Inputs

Common inputs:

- actor identity
- workspace or tenant
- role and permission grants
- resource owner
- resource visibility
- subscription or entitlement
- operation type
- session freshness
- environment or admin mode

Use only the inputs needed for the decision. Hidden dependencies make policy behavior hard to audit.

## Decision Pattern

A policy decision should produce:

- allow or deny
- reason code
- optional user-facing explanation
- required permission or entitlement
- audit metadata for privileged checks

Reason codes help UI, logs, and support without exposing implementation details.

## Where To Enforce

Enforce at:

- API route or server action boundary
- data mutation service
- background job start
- file/export generation
- billing or entitlement-consuming operation
- admin operation boundary

UI checks can hide or disable controls, but they are not sufficient.

## Resource-Level Patterns

Examples:

- Owner can edit private draft.
- Workspace editor can update shared project.
- Viewer can read but not export.
- Admin can inspect user job metadata but not private content by default.
- Paid plan can run high-cost AI route.
- Trial user can run limited feature subset.

When resource rules become complex, consider policy functions per resource type rather than a single universal permission table.

## Denial Handling

Good denial handling:

- returns stable reason codes
- avoids saying whether private resources exist when that leaks data
- suggests next action when appropriate
- logs enough for debugging
- avoids fallback behavior that accidentally grants broader access

## Test Checklist

- anonymous actor
- authenticated but wrong workspace
- owner
- collaborator
- admin without required permission
- admin with permission
- expired or stale session
- missing entitlement
- archived or deleted resource
- cross-tenant access attempt
