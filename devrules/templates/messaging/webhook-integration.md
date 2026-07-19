---
title: Webhook Integration
description: Pattern for incoming and outgoing webhooks, signatures, retries, event delivery, idempotency, and diagnostics.
ownership: seed
governs: product
activation: conditional
enforcement: example
decision_owner: project
side_effects: none
applies_to:
  - payment callbacks
  - automation callbacks
  - local API integrations
  - external notifications
  - provider events
use_when:
  - A project receives or sends asynchronous HTTP event callbacks.
do_not_use_when:
  - The integration is synchronous and has no callback/event delivery.
outputs:
  - webhook contract
  - signature policy
  - retry/idempotency policy
  - diagnostics plan
case_sources:
  - SetMail local API webhooks
  - OpsHub webhook settings
  - AutoMarketing webhook migrations and hooks
  - Mori webhook server
  - html-to-image webhook smoke scripts
related_workflows:
  - devrules/workflows/debug-root-cause.md
last_reviewed: 2026-06-11
---

# Webhook Integration

Webhooks are asynchronous contracts. Treat incoming and outgoing webhooks separately.

## Incoming Webhooks

Define:

- endpoint
- authentication or signature method
- raw body requirement
- idempotency key
- event type mapping
- validation
- processing queue
- response semantics
- diagnostics

## Outgoing Webhooks

Define:

- subscriber configuration
- event catalog
- signing secret
- retry policy
- timeout
- delivery log
- disable rules after repeated failures
- replay policy

## Diagnostics

Operators need:

- recent deliveries
- event type
- target endpoint
- status
- attempts
- next retry
- error category
- redacted payload preview

## Review Checklist

- Signatures are verified for incoming sensitive events.
- Event processing is idempotent.
- Outgoing delivery failures are visible.
- Retry policy avoids endless loops.
- Webhook payloads avoid secrets and unnecessary private data.
