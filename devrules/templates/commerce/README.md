---
title: Commerce Domain Templates
description: Index for pricing, subscriptions, entitlement gates, credits, payment webhooks, and RevenueCat implementation references.
ownership: shared
governs: product
activation: conditional
enforcement: example
decision_owner: project
side_effects: none
applies_to:
  - SaaS applications
  - AI credit products
  - subscription products
  - usage-based billing products
  - desktop or mobile apps with cloud account billing
use_when:
  - A project needs paid plans, credit packs, usage quotas, invoices, or webhook-driven state.
  - Product features must be gated by entitlement rather than UI-only checks.
do_not_use_when:
  - The product is fully offline or has no monetization surface.
  - The task only changes marketing copy for an existing pricing page.
outputs:
  - pricing model
  - subscription lifecycle map
  - entitlement matrix
  - usage accounting plan
  - webhook handling checklist
case_sources:
  - planner-v0/lib/subscription
  - planner-v0/lib/stripe
  - NovelWiki/src/lib/stripe.ts
  - NovelWiki/src/lib/credits
  - NovelWiki/src/components/subscription
  - NovelWiki/src/components/credits
  - DeGit/src/components/subscription
  - structureUI/services/api/src/lib/stripe-billing.ts
  - FrameCast/cloud/src/stripe.ts
  - auto-threads/supabase/migrations/004_subscription_system.sql
related_workflows:
  - devrules/workflows/release.md
  - devrules/workflows/debug-root-cause.md
  - devrules/workflows/revenuecat-integration.md
last_reviewed: 2026-07-17
---

# Commerce Domain Templates

Commerce is a system of truth, not a modal. The durable model is:

1. Product packaging: plans, add-ons, packs, trials.
2. Provider integration: checkout, customer portal, webhook verification.
3. Local state: subscription, entitlement, credits, usage ledger.
4. Enforcement: server-side gating at feature and resource boundaries.
5. Support operations: refunds, manual grants, reconciliation, audit.

## Recommended Reading Order

| Task | Read |
| --- | --- |
| Design pricing plans and subscription lifecycle | `pricing-subscription.md` |
| Gate product features by plan, role, or resource limits | `entitlement-gating.md` |
| Charge, grant, reserve, consume, and reconcile credits | `credits-usage.md` |
| Process checkout and provider webhooks safely | `payment-webhook.md` |
| Decide RevenueCat project/platform/Web topology, identity, and app architecture | `revenuecat-topology.md` |
| Configure RevenueCat MCP/REST and Apple credentials safely | `revenuecat-credentials.md` |
| Configure store products and run purchase QA lanes | `revenuecat-store-qa.md` |

## Domain Principles

- Provider state is external evidence; local entitlement state is the product's fast read model.
- Webhooks should be idempotent, ordered defensively, and auditable.
- Credits should use a ledger, not only a mutable balance.
- Gating should happen where the expensive or privileged operation starts.
- Admin adjustments must record who changed what, why, and which support ticket or context justified it.
