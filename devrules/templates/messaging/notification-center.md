---
title: Notification Center
description: Pattern for in-app notifications, toasts, alerts, user preferences, unread state, and notification diagnostics.
ownership: seed
governs: product
activation: conditional
enforcement: example
decision_owner: project
side_effects: none
applies_to:
  - product apps
  - admin consoles
  - desktop apps
  - automation tools
use_when:
  - Users need visible feedback, alerts, notification preferences, or unread indicators.
do_not_use_when:
  - A single local ephemeral toast is enough and no architecture is needed.
outputs:
  - notification types
  - delivery rules
  - preference model
  - UI state checklist
  - diagnostics checklist
case_sources:
  - OpsHub notification bell and notifications routes
  - DeGit notification runtime
  - NovelWiki notification store
  - AutoMarketing notification panel
  - GameArtFactory notification center
related_workflows:
  - devrules/workflows/browser-automation-fix.md
last_reviewed: 2026-06-11
---

# Notification Center

Separate notification types:

- ephemeral toast
- persistent in-app notification
- admin alert
- background job progress
- security or billing warning
- cross-device or system message

## Delivery Rules

Define:

- trigger
- target audience
- severity
- persistence
- read/ack behavior
- delivery channel
- deduplication key
- expiry
- action link

## Preferences

Notification preferences can be:

- global
- per workspace
- per device
- per channel
- per severity

Per-device preferences are useful in desktop products where local notifications differ from cloud or web notifications.

## UI Pattern

Good surfaces include:

- bell or center entry
- unread count
- severity visual treatment
- timestamp
- source
- action button
- mark read/acknowledge
- filters
- empty state

## Review Checklist

- Toasts do not replace durable messages when users need history.
- Duplicate notifications are collapsed.
- Preferences are respected consistently.
- Critical alerts are not silently hidden.
- Notification actions are permission-checked.
