---
title: Inbox Message Center
description: Pattern for durable project/user inboxes, system messages, support messages, read state, and cross-surface delivery.
ownership: seed
governs: product
activation: conditional
enforcement: example
decision_owner: project
side_effects: none
applies_to:
  - project collaboration
  - AI workflow products
  - admin/support systems
  - desktop apps with cloud sync
use_when:
  - Users need durable messages tied to projects, workflows, jobs, or support events.
do_not_use_when:
  - Messages are purely transient UI feedback.
outputs:
  - inbox scope
  - message lifecycle
  - read/ack model
  - sync and retention plan
  - review checklist
case_sources:
  - magic-novel-forge project inbox
  - NovelEditor project inbox
  - planner-v0 dashboard inbox sync
  - SetMail local message/API model
related_workflows:
  - devrules/workflows/devrules-memory-maintenance.md
last_reviewed: 2026-06-11
---

# Inbox Message Center

An inbox is durable product state. It should have lifecycle, ownership, and sync semantics.

## Scope Choices

- user inbox
- workspace inbox
- project inbox
- admin/support inbox
- system inbox
- job/workflow inbox

Choose scope based on who needs to act on the message.

## Message Lifecycle

Common states:

- created
- delivered
- read
- acknowledged
- actioned
- archived
- expired

Messages that require action should have a distinct acknowledgment or resolution state.

## Message Content

Use structured fields:

- title
- summary
- body or details
- severity
- source
- target object
- action link
- created time
- expiry
- read/ack state

Avoid storing secrets or full private payloads in generic inbox messages.

## Sync Notes

If inbox state syncs across devices:

- define read-state authority
- handle offline read/ack
- deduplicate by message ID
- preserve action state
- avoid replaying expired messages

## Review Checklist

- Inbox scope is clear.
- Read and ack semantics are distinct when needed.
- Messages link to actionable context.
- Retention and expiry are defined.
- Cross-device behavior is tested when relevant.
