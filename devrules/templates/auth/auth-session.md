---
title: Auth Session Architecture
description: Pattern for login, session context, OAuth callback, API request auth, route guards, and client hooks.
ownership: seed
governs: product
activation: conditional
enforcement: example
decision_owner: project
side_effects: none
applies_to:
  - web apps
  - desktop apps with cloud accounts
  - mobile apps
  - browser extensions
  - API-backed products
use_when:
  - A project needs user identity, sign-in, sign-up, OAuth, token refresh, or protected routes.
  - Server requests need consistent actor context.
do_not_use_when:
  - The product has no user identity or protected state.
outputs:
  - session context boundary
  - route guard plan
  - OAuth callback checklist
  - API auth helper pattern
  - client hook checklist
case_sources:
  - planner-v0/lib/auth
  - DeGit/src/stores/authStore.ts
  - DeGit/src/services/auth-session-preference.ts
  - FrameCast/src/account/oauth-client.ts
  - auto-threads/src/components/auth
  - NovelWiki/src/components/auth
related_workflows:
  - devrules/workflows/debug-root-cause.md
  - devrules/workflows/ios-account-data-architecture.md
last_reviewed: 2026-07-15
---

# Auth Session Architecture

Authentication should produce a stable actor context for every protected action. Keep session loading, request context, route guards, and client UI state separate.

## Core Boundaries

| Boundary | Purpose |
| --- | --- |
| Auth provider adapter | Integrates email/password, OAuth, SSO, magic link, or desktop auth. |
| Session resolver | Converts request/token/storage state into actor context. |
| Request context | Makes actor, workspace, locale, and auth method available to server handlers. |
| Route guard | Redirects or blocks navigation based on session state. |
| API auth helper | Validates actor before API or server actions execute. |
| Client hooks/store | Provides UI state and auth actions without becoming the security boundary. |

## Session Context Pattern

A useful session context answers:

- Is the user authenticated?
- Who is the actor?
- Which workspace or tenant is active?
- Which auth method was used?
- Is the session fresh enough for sensitive operations?
- Are tokens expired or refreshable?
- What should happen when auth fails?

Avoid letting every feature parse tokens independently.

## OAuth Callback Checklist

- Validate state/nonce.
- Exchange code server-side where applicable.
- Store tokens according to platform security model.
- Resolve provider identity according to the approved account/data lane. Create
  or resolve an internal user principal only for an account-backed product.
- Handle account linking carefully.
- Redirect to a safe post-login target.
- Surface provider errors without leaking tokens.
- Test cancelled login, repeated callback, expired code, and wrong state.

## iOS Account And Data Decision

When adding Apple, Google, email, or another login materially changes ownership,
persistence, sync, recovery, or migration in an iOS/iPadOS app, run
`devrules/workflows/ios-account-data-architecture.md`. The project owns the
topology and key strategy.

- Decide whether authentication owns content, only authorizes access, or acts as
  optional feature/recovery linkage. Do not silently change existing ownership
  or deletion behavior.
- Choose and document an internal-key, provider-key, or composite-key strategy
  from project requirements and migration constraints; devrules does not
  mandate a `user_id` shape.
- Treat mutable or provider-scoped identifiers as primary keys only when the
  project has explicitly accepted their stability, linking, and migration
  consequences.
- Specify account linking, unlinking, duplicate detection, merge, provider loss,
  recovery, deletion, and guest/local-data migration before implementation.

## Route Guards

Guard levels:

- public route
- anonymous-only route, such as sign-in
- authenticated route
- workspace-required route
- admin route
- elevated-operation route

Route guards improve UX, but server-side checks still protect data and mutations.

## Client Hook Pattern

Client auth hooks should expose:

- current session snapshot
- loading and error states
- sign-in and sign-out actions
- refresh or revalidate action
- session freshness signal
- active workspace or account switch action if needed

Keep provider SDK objects behind the hook or adapter so components remain portable.

## Desktop And Extension Notes

For desktop or browser-extension apps:

- Separate local session preference from cloud identity.
- Handle offline mode explicitly.
- Use a secure storage mechanism appropriate to the platform.
- Design OAuth callback handoff and deep-link flows with tests.
- Avoid assuming browser cookies are the only session source.

## Review Checklist

- Server handlers receive session context from one resolver.
- Client route guards are backed by server authorization.
- OAuth callback handles replay, cancellation, and invalid state.
- iOS authentication follows the approved identity lane and cannot silently
  re-key existing data.
- Sign-out clears local UI state and server/session tokens appropriately.
- Tests cover expired session, missing session, and role/workspace mismatch.
