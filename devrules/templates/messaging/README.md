---
title: Messaging Domain Templates
description: Index for notification centers, inboxes, email delivery, webhooks, alerts, and user/system message surfaces.
ownership: shared
governs: product
activation: conditional
enforcement: example
decision_owner: project
side_effects: none
applies_to:
  - SaaS apps
  - desktop apps
  - automation platforms
  - admin consoles
  - content products
use_when:
  - A project needs to notify users, deliver email, receive webhooks, or manage in-product messages.
do_not_use_when:
  - The task only needs a local toast with no persistence or delivery rules.
outputs:
  - notification architecture
  - inbox/message center design
  - email delivery plan
  - webhook integration plan
case_sources:
  - SetMail SMTP queue, local API, SSE, and webhooks
  - OpsHub notifications and webhooks pages
  - NovelWiki notification store
  - DeGit notification runtime
  - AutoMarketing notifications and webhooks
  - magic-novel-forge project inbox
related_workflows:
  - devrules/workflows/debug-root-cause.md
  - devrules/workflows/release.md
last_reviewed: 2026-06-11
---

# Messaging Domain Templates

Messaging covers transient UI feedback, durable inbox messages, email delivery, provider callbacks, alerts, and webhooks. Do not treat all of these as the same thing.

## Templates

| Template | Use For |
| --- | --- |
| `notification-center.md` | In-app notifications, toasts, alerts, delivery preferences, unread state. |
| `inbox-message-center.md` | Durable project/user inbox, system messages, support messages, read/ack flows. |
| `email-delivery.md` | Email templates, queues, retries, provider abstraction, deliverability. |
| `webhook-integration.md` | Incoming/outgoing webhooks, signatures, retries, event delivery, diagnostics. |
