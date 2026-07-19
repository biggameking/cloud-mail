---
title: Pricing And Subscription
description: Pattern for pricing models, subscription lifecycle, provider abstraction, plan state, and customer-facing billing surfaces.
ownership: seed
governs: product
activation: conditional
enforcement: example
decision_owner: project
side_effects: none
applies_to:
  - SaaS plans
  - AI subscription products
  - usage-limited products
  - desktop apps with cloud billing
use_when:
  - A product needs paid tiers, trials, upgrades, downgrades, cancellation, or billing portal integration.
do_not_use_when:
  - The product uses only one-time local purchases and has no server-side entitlements.
outputs:
  - pricing package model
  - subscription state map
  - provider integration boundary
  - customer billing UI checklist
  - admin billing checklist
case_sources:
  - planner-v0/lib/subscription
  - planner-v0/lib/stripe
  - NovelWiki/src/components/subscription
  - NovelWiki/src/lib/stripe.ts
  - DeGit/src/components/subscription
  - structureUI/services/api/src/lib/stripe-billing.ts
  - FrameCast/cloud/src/stripe.ts
related_workflows:
  - devrules/workflows/release.md
last_reviewed: 2026-06-11
---

# Pricing And Subscription

Pricing should be designed as product packaging plus a reliable state machine. Avoid scattering plan checks across UI copy, server handlers, and provider callbacks.

## Packaging Options

- Free plan with limits.
- Trial with time or usage boundary.
- Individual subscription.
- Team or workspace subscription.
- Usage-based add-on.
- Credit packs.
- Enterprise/manual plan.

Each package should define included features, limits, renewal behavior, downgrade behavior, and support expectations.

## Subscription State Map

Common states:

- no subscription
- trialing
- active
- past due
- paused
- cancelled but still active until period end
- cancelled and expired
- incomplete checkout
- manually granted

Keep provider-specific states mapped to product states. Product code should not need to understand every provider event name.

## Provider Boundary

A payment provider adapter typically handles:

- create checkout
- create billing portal session
- parse webhook event
- verify webhook signature
- fetch customer/subscription snapshot
- map provider product or price to local plan
- reconcile state

Provider code should not directly decide product feature access. It should update local subscription evidence; entitlement logic reads local state.

## Customer Billing Surface

Customer UI should show:

- current plan
- renewal or expiry
- included limits
- current usage
- upgrade/downgrade options
- invoice or portal link
- cancellation status
- trial status
- credit balance if applicable

Avoid hiding billing state behind only a modal. Users need confidence in what they are paying for.

## Admin Billing Surface

Admin UI may need:

- customer lookup
- subscription status
- provider customer link
- webhook event history
- manual entitlement grant
- credit adjustment
- failed payment notes
- support reason capture

Manual changes require audit and, for customer-impacting changes, elevated operation policy.

## Review Checklist

- Product plan state is local and queryable.
- Provider webhooks are idempotent.
- UI and server checks read the same entitlement source.
- Downgrade behavior is defined for over-limit resources.
- Manual grants and adjustments are audited.
- Tests cover trial expiry, cancellation, failed payment, and webhook replay.
