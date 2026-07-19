---
title: Payment Webhook Handling
description: Pattern for provider webhook verification, idempotency, event ordering, reconciliation, and support diagnostics.
ownership: seed
governs: product
activation: conditional
enforcement: example
decision_owner: project
side_effects: none
applies_to:
  - subscription products
  - checkout flows
  - credit purchases
  - billing portals
  - payment provider integrations
use_when:
  - A payment provider sends asynchronous events that update local product state.
do_not_use_when:
  - The product has no external payment provider or asynchronous billing state.
outputs:
  - webhook verification plan
  - idempotency policy
  - event mapping checklist
  - reconciliation plan
  - diagnostics checklist
case_sources:
  - planner-v0/lib/stripe
  - NovelWiki/src/lib/stripe.ts
  - structureUI/services/api/src/lib/stripe-billing.ts
  - FrameCast/cloud/src/stripe.ts
related_workflows:
  - devrules/workflows/release.md
  - devrules/workflows/debug-root-cause.md
last_reviewed: 2026-06-11
---

# Payment Webhook Handling

Payment webhooks are asynchronous evidence from a provider. They must be verified, idempotent, observable, and reconcilable.

## Webhook Boundary

Webhook handler responsibilities:

- read raw request body if the provider requires it
- verify signature
- parse event
- deduplicate event ID
- map provider event to local command
- update local billing state in a transaction where possible
- record processing result
- return provider-expected status

Do not run unrelated long jobs inside the webhook request. Queue follow-up work if needed.

## Idempotency

Store processed event IDs with:

- provider
- event ID
- event type
- received timestamp
- processing status
- linked local object
- error category if failed

Webhook retries should not duplicate credits, grants, or plan changes.

## Event Ordering

Providers may deliver events out of order. Protect state by:

- fetching current provider snapshot for important transitions
- using provider timestamps carefully
- applying local state transitions only when valid
- reconciling periodically
- making cancellation and renewal behavior explicit

## Event Mapping

Map provider events to product commands:

- checkout completed -> create or update customer entitlement
- subscription updated -> map provider state to product state
- invoice paid -> renew or grant usage
- invoice failed -> mark at risk or past due
- subscription cancelled -> set end-of-period behavior
- payment refunded -> adjust credit or support state

Names differ across providers; keep the product commands stable.

## Diagnostics

Admin/support should be able to see:

- recent events
- processing status
- linked customer and subscription
- mapped product action
- error category
- retry/replay action if safe
- reconciliation status

Do not expose raw webhook secrets or full provider payloads broadly.

## Review Checklist

- Signature verification uses the raw body when required.
- Event processing is idempotent.
- Credit grants cannot duplicate on retry.
- State transitions handle out-of-order events.
- Failed events are visible to admin diagnostics.
- Reconciliation can repair missed or failed webhook events.
