---
title: RevenueCat Topology And App Architecture
description: Conditional reference for RevenueCat project, platform, Web billing, backend authority, identity, and client architecture decisions.
ownership: shared
governs: product
activation: conditional
enforcement: example
decision_owner: user
side_effects: none
applies_to:
  - apps using RevenueCat
  - cross-platform subscriptions
  - Web billing connected to native entitlements
use_when:
  - RevenueCat project or App boundaries must be chosen.
  - Identity, entitlement authority, trials, plan changes, or data retention are in scope.
do_not_use_when:
  - The task only verifies an already approved credential or store product.
outputs:
  - RevenueCat project and App topology
  - billing and entitlement authority decision
  - client subscription-service contract
  - identity and data-retention policy
case_sources:
  - devrules/workflows/revenuecat-integration.md
related_workflows:
  - devrules/workflows/revenuecat-integration.md
  - devrules/workflows/apple-app-store-launch.md
last_reviewed: 2026-07-17
---

# RevenueCat Topology And App Architecture

Use this reference after the main workflow routes a topology or architecture
decision. Examples must be adapted to approved project facts.

## Official References

- `https://www.revenuecat.com/docs/llms.txt`
- `https://www.revenuecat.com/docs/getting-started/configuring-sdk`
- `https://www.revenuecat.com/docs/customers/identifying-customers`
- `https://www.revenuecat.com/docs/customers/customer-info`
- `https://www.revenuecat.com/docs/platform-resources/apple-platform-resources/legacy-mac-apps`
- `https://www.revenuecat.com/docs/web/payment-integrations`
- `https://www.revenuecat.com/docs/web/paywalls`
- `https://www.revenuecat.com/docs/web/web-billing/web-purchase-links`
- `https://www.revenuecat.com/docs/integrations/webhooks/event-flows`

## Project And Platform Boundaries

- Same product across Apple, Android, and Web: one RevenueCat Project, multiple
  store-specific Apps, and deliberately shared entitlements.
- Unrelated products or user systems: separate Projects.
- Products share a Project only when paid access and identity are intentionally
  shared.
- One App Store Connect record spanning iOS/iPadOS/macOS normally uses Universal
  Purchase: one bundle ID and one RevenueCat Apple App.
- Create a legacy Mac App only for an intentional legacy/migration topology.
- Bundle ID sharing does not share application data. The app account/sync layer
  owns content; RevenueCat owns billing entitlement.

Record platforms, store records, bundle/package IDs, RevenueCat Project/Apps,
shared entitlements, and migration constraints before external writes.

## Web Billing And Backend Authority

Choose one Web lane: RevenueCat Web Billing, Stripe/Paddle connected through
RevenueCat, or no Web purchase support. Record regions, currencies, checkout,
customer identity, tax/refund owner, and native/Web entitlement sharing.

Contract:

1. Use the same stable application user identity where cross-platform access is
   intended; design anonymous linking and restore explicitly.
2. Configure the browser with the intended RevenueCat Web App public key.
3. RevenueCat is billing truth. Select exactly one trusted application
   entitlement projection; browser cache is never authority.
4. Authenticate webhooks, filter app/environment, deduplicate, acknowledge
   quickly, defer long work, and reconcile after gaps or ordering ambiguity.
5. Keep an event ledger with event/customer identity, event time, processing
   state, and safe errors; omit secrets and unnecessary payloads.
6. A Supabase authority should be updated through a trusted Edge Function or
   backend into an RLS-protected projection. A Cloudflare receiver should use
   Worker secrets and deferred work, then write through the same boundary.
7. Use D1 as authority only by explicit decision; never maintain competing
   Supabase and D1 entitlement authorities.
8. Test duplicate, retry, out-of-order, cancellation, expiration, refund,
   billing issue, sign-in/restore, and reconciliation behavior.

## Client Architecture

- Configure RevenueCat once in one subscription service.
- UI reads a central product entitlement state.
- Missing config yields setup-required/free behavior, not a crash or unrelated
  local-feature lockout.
- Offerings/packages and localized store metadata drive paywall UI; never
  hard-code live prices.
- Restore Purchases remains visible.
- Server-metered premium resources require server-side entitlement checks.

Example names such as `<project-entitlement>` and `<project-offering>` are
placeholders only; use the approved catalog byte-for-byte.

## Trials And Plan Changes

- Configure subscription trials as real store introductory offers. Store state
  owns eligibility, timing, renewal price, and cancellation.
- Never derive eligibility from install date, local flags, countdowns, or app
  clock.
- Show localized trial duration, recurring price/cadence, and cancellation path.
- Turning off renewal during a trial does not revoke access before trial end.
- Put interchangeable durations in one store subscription group and respect
  platform upgrade/downgrade/crossgrade timing.
- A lifetime purchase does not automatically cancel an active subscription.
- Keep every permitted package purchasable before, during, and after a trial;
  do not make plans trial-only.
- Keep an in-app plan-comparison/change route for active subscribers and test
  effective timing in the real sandbox.

## Identity And User Data

- Billing identity and content ownership are separate contracts.
- RevenueCat login/logout/alias/restore must never re-key or delete content.
- Never use email, display name, device name, IDFA, or a shared constant as App
  User ID.
- Signed-out anonymous identity requires documented merge and restore behavior.
- Expiry, cancellation, retry, refund, or revocation must not delete or
  destructively downgrade user-created data.
- Gate premium creation/mutation/export at command boundaries while preserving
  safe reading, deletion, and free-compatible actions by default.
- Preserve premium-only state in a non-destructive locked/read-only form.
- Define account retention independently from purchase state.

## Decision Checklist

- Project/App/platform topology is explicit.
- Billing truth and one application projection are named.
- Stable identity, anonymous merge, restore, and cross-platform behavior exist.
- Trial, plan-change, lifetime, and retention policies match store behavior.
- Client UI and backend enforcement read compatible entitlement contracts.
- Webhook authentication, idempotency, retry, and reconciliation are testable.
