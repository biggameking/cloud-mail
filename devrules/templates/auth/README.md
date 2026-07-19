---
title: Auth Domain Templates
description: Index for authentication, authorization, admin permissions, elevated operations, and audit patterns.
ownership: shared
governs: product
activation: conditional
enforcement: example
decision_owner: project
side_effects: none
applies_to:
  - SaaS products
  - admin consoles
  - internal tools
  - desktop apps with cloud accounts
  - mobile and web apps with protected routes
use_when:
  - A project needs login, sessions, OAuth, permission checks, admin roles, or audit logs.
  - Privileged operations need explicit verification and traceability.
do_not_use_when:
  - The project has no user identity or privileged operations.
  - The task only adjusts a public static page.
outputs:
  - session context plan
  - authorization boundary
  - permission model
  - elevated operation policy
  - audit checklist
case_sources:
  - magic-novel-forge/docs/templates early admin permission experience
  - planner-v0/lib/auth
  - planner-v0/lib/permissions
  - NovelWiki/src/lib/auth
  - NovelWiki/src/lib/admin
  - DeGit/src/stores/authStore.ts
  - DeGit/src/services/auth-session-preference.ts
  - FrameCast/src/account/oauth-client.ts
  - auto-threads/src/components/auth
related_workflows:
  - devrules/workflows/debug-root-cause.md
  - devrules/workflows/devrules-audit.md
last_reviewed: 2026-06-11
---

# Auth Domain Templates

Authentication answers "who is acting." Authorization answers "what may this actor do here." Admin permissions answer "which privileged product operations may this actor perform." Audit answers "what happened, why, and under which verified context."

## Recommended Reading Order

| Task | Read |
| --- | --- |
| Add login, session, OAuth, API auth, route guards, or client hooks | `auth-session.md` |
| Add policy checks for user, tenant, project, or resource access | `authorization-policy.md` |
| Add admin roles and permission groups | `admin-permission.md` |
| Add OTP, re-auth, approval, or audit logs for sensitive operations | `elevated-operations-audit.md` |

## Domain Principles

- Keep identity lookup separate from permission decisions.
- Put server-side authorization before data access, not only in UI routing.
- UI guards are helpful ergonomics, not security boundaries.
- Admin permission checks should be explicit at every mutation boundary.
- Sensitive operations should have two layers: permission plus elevated verification.
- Audit logs should store stable actor, target, operation, result, and reason metadata without leaking secrets.

## Case Patterns To Borrow

- planner-v0 separates request auth helpers, admin request helpers, permission types, OTP, hooks, and data backup/export permissions.
- NovelWiki separates admin core services from billing/admin queue concerns.
- DeGit stores session preference and auth state separately from Tauri API auth methods.
- FrameCast keeps OAuth client behavior covered with focused tests, useful for callback and token-edge cases.
