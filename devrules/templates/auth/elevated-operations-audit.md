---
title: Elevated Operations And Audit
description: Pattern for OTP, re-auth, approvals, sensitive admin actions, audit logs, and operational evidence.
ownership: seed
governs: product
activation: conditional
enforcement: example
decision_owner: project
side_effects: none
applies_to:
  - admin consoles
  - billing systems
  - backup and restore tools
  - AI configuration tools
  - data export tools
use_when:
  - An operation is destructive, costly, privacy-sensitive, or security-sensitive.
  - The product needs traceable support or compliance evidence.
do_not_use_when:
  - The operation is low-risk and already covered by normal authorization.
outputs:
  - elevated operation classification
  - verification policy
  - audit event contract
  - support/recovery checklist
case_sources:
  - magic-novel-forge/docs/templates early admin permission experience
  - planner-v0/lib/permissions/otp.ts
  - planner-v0/lib/admin/audit-utils.ts
  - planner-v0/lib/data-backup
  - planner-v0/lib/data-export
  - DeGit/src/services/backup-job-runner.ts
  - DeGit/src/services/admin-diagnostics.test.ts
related_workflows:
  - devrules/workflows/backup-maintenance.md
  - devrules/workflows/release.md
last_reviewed: 2026-06-11
---

# Elevated Operations And Audit

Some operations require more than a normal permission check. Elevated operation policy makes risk visible and recoverable.

## Risk Classes

| Class | Examples | Typical Requirement |
| --- | --- | --- |
| Sensitive read | private export, diagnostic payload, prompt trace | permission plus audit |
| Sensitive write | role change, billing adjustment, prompt publish | permission plus fresh session or OTP |
| Destructive | delete, restore, revoke, purge | elevated verification plus confirmation |
| Security config | key rotation, provider disable, webhook secret change | elevated verification plus audit |
| Customer-impacting | plan downgrade, credit reset, account suspension | reason and support trace |

## Verification Options

- Recent password re-auth.
- One-time verification code.
- Provider MFA if available.
- Approval by another admin.
- Signed internal change request.
- Local device confirmation for desktop tools.

The choice depends on product maturity and risk. Do not fake security with a modal confirmation for high-risk actions.

## Confirmation Copy

Confirmation screens should show:

- exact operation
- target
- irreversible effects
- expected recovery path
- required reason
- verification method

Avoid vague "Are you sure?" prompts for destructive operations.

## Audit Event Contract

Audit events should be structured and queryable:

- actor ID
- actor role or permission used
- operation
- target type
- target ID
- reason
- verification method
- result
- error category if failed
- trace ID
- timestamp

When before/after state is useful, store summarized diffs rather than full sensitive payloads.

## Support And Recovery

Every elevated operation should define:

- how support can find the event
- whether the action can be reverted
- who must approve reversal
- whether users must be notified
- what evidence is retained
- how long evidence is retained

## Review Checklist

- Risk classes are documented.
- Server-side code enforces verification freshness.
- Audit logging happens even when the operation fails after verification.
- Reasons are required for customer-impacting actions.
- Sensitive details are redacted in logs and UI.
- Tests cover expired verification and replayed verification attempts.
