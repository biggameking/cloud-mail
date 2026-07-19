---
title: Admin Permission System
description: Pattern for dual-dimension admin roles, permission groups, elevated verification, audit logs, and resource-level admin controls.
ownership: seed
governs: product
activation: conditional
enforcement: example
decision_owner: project
side_effects: none
applies_to:
  - admin consoles
  - SaaS back offices
  - internal tools
  - operational dashboards
  - content moderation systems
use_when:
  - A project needs privileged user management, billing operations, data export, backup, AI route changes, or system diagnostics.
  - Admin actions need permission checks beyond a simple isAdmin flag.
do_not_use_when:
  - The product has no privileged operator surface.
outputs:
  - role and permission model
  - permission naming pattern
  - admin operation matrix
  - elevated verification plan
  - audit checklist
case_sources:
  - magic-novel-forge/docs/templates early admin permission experience
  - planner-v0/lib/permissions
  - planner-v0/lib/admin/audit-utils.ts
  - NovelWiki/src/lib/admin
  - NovelWiki/src/components/admin
  - auto-threads/src/components/admin
related_workflows:
  - devrules/workflows/backup-maintenance.md
  - devrules/workflows/debug-root-cause.md
last_reviewed: 2026-06-11
---

# Admin Permission System

A serious admin system should not rely on `isAdmin` alone. The early dual-dimension permission idea remains valuable: separate platform/operator authority from business-domain authority.

## Dual-Dimension Role Model

| Dimension | Meaning | Example |
| --- | --- | --- |
| Operator/admin dimension | What system-level actions the person can perform. | manage users, view diagnostics, configure AI routes. |
| Business/domain dimension | What domain scope or content area the person governs. | billing, content, translation, support, project workspace. |

This avoids granting broad system power just because someone needs domain-specific operations.

## Permission Naming

Use stable action names:

- `users.read`
- `users.update_role`
- `billing.view`
- `billing.adjust_credit`
- `ai.config.read`
- `ai.config.update`
- `prompts.publish`
- `backup.create`
- `backup.restore`
- `export.create`
- `diagnostics.view`
- `system.audit.read`

Prefer explicit action names over broad buckets like `manage_all`.

## Permission Groups

Groups are product conveniences, not hidden policy. Examples:

- Support: read users, read billing summary, view job status.
- Billing operator: adjust credits, view invoices, retry webhook reconciliation.
- AI operator: edit routes, validate keys, publish prompts, inspect usage.
- Content moderator: review reports, hide content, restore content.
- System operator: backup, restore, diagnostics, audit logs.

Every group should expand to explicit permissions.

## Admin Operation Matrix

For each admin operation record:

- operation name
- required permission
- required elevated verification
- target resource
- irreversible or reversible
- audit event fields
- notification requirement
- rollback or recovery path

This matrix is more useful than long prose when reviewing safety.

## Elevated Verification

Require elevated verification when actions are destructive, costly, privacy-sensitive, or security-sensitive.

Examples:

- restore backup
- delete user data
- change billing balance
- export private data
- rotate provider keys
- publish production prompt or agent
- disable provider route
- impersonate support session

Verification can be OTP, re-auth, approval workflow, hardware key, or internal change request depending on risk.

## Audit Log Pattern

Audit records should include:

- actor
- operation
- target type and target ID
- before/after summary when safe
- reason or ticket
- verification method
- permission used
- result
- timestamp
- request or trace ID

Do not store secrets, full private payloads, or full prompts unless there is a defined secure retention policy.

## Resource-Level Admin Controls

Admin permission does not automatically grant all resource access. Consider:

- support can see metadata but not private content
- billing can adjust credits but not read user documents
- AI operator can inspect route failures but not raw sensitive prompts
- data export requires both permission and user/customer context

## Review Checklist

- There is no single `isAdmin` bypass for all operations.
- Admin permissions are checked server-side at every mutation boundary.
- Permission groups expand to explicit permissions.
- Elevated operations require freshness or approval.
- Audit logs are written for both success and failure where useful.
- Admin UI hides unavailable actions but does not replace server checks.
- Tests cover privilege escalation attempts and cross-domain admin limits.
