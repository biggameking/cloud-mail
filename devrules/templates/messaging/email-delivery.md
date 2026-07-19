---
title: Email Delivery
description: Pattern for email templates, send queues, retries, provider abstraction, local SMTP, and delivery diagnostics.
ownership: seed
governs: product
activation: conditional
enforcement: example
decision_owner: project
side_effects: none
applies_to:
  - transactional email
  - notification email
  - verification email
  - local-first mail tools
  - automation products
use_when:
  - A project sends email or manages SMTP/provider delivery.
do_not_use_when:
  - Email is not part of the product.
outputs:
  - email template plan
  - send queue pattern
  - retry policy
  - diagnostics checklist
case_sources:
  - SetMail SMTP queue and templates
  - html-to-image email verification and email smoke scripts
  - planner-v0 notification settings
related_workflows:
  - devrules/workflows/release.md
last_reviewed: 2026-06-11
---

# Email Delivery

Email delivery needs templates, queueing, retries, and diagnostics. Direct send calls from UI handlers become hard to debug.

## Template Pattern

Email templates should define:

- purpose
- audience
- subject
- body variants
- locale
- variables
- preview data
- compliance footer if required

Keep provider-specific markup isolated when possible.

## Send Queue

A send queue records:

- recipient
- template
- variables
- status
- attempt count
- next retry time
- provider message ID
- failure category
- created time

This makes retries and support diagnostics practical.

## Delivery Rules

- Validate recipients.
- Rate-limit automated sends.
- Deduplicate repeated notifications.
- Separate transactional from marketing consent.
- Store provider errors as stable categories.
- Avoid logging full message content when sensitive.

## Review Checklist

- Sending is not a hidden side effect of rendering UI.
- Failed sends can be retried or inspected.
- Templates can be previewed.
- Locale and variable validation exist.
- Provider credentials are secret-managed.
