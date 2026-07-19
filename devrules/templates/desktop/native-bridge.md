---
title: Native Bridge
description: Pattern for UI-native boundaries, Tauri commands, event streams, local services, OS capabilities, and bridge contracts.
ownership: seed
governs: product
activation: conditional
enforcement: example
decision_owner: project
side_effects: none
applies_to:
  - Tauri apps
  - desktop apps with Rust/native backend
  - apps with local filesystem, keychain, or OS integrations
use_when:
  - UI needs to call native services or subscribe to native events.
do_not_use_when:
  - The app is browser-only.
outputs:
  - command boundary
  - event boundary
  - bridge contract
  - security checklist
case_sources:
  - SetMail Tauri IPC architecture
  - DeGit Tauri API modules
  - planner-v0 native bridge SDK
  - Mori channel and command modules
  - RealEx command/service split
related_workflows:
  - devrules/workflows/debug-root-cause.md
last_reviewed: 2026-06-11
---

# Native Bridge

The native bridge is a trust boundary. UI should orchestrate; native services should own protocol-heavy, security-sensitive, and OS-specific logic.

## Boundary Pattern

UI:

- renders screens
- collects user intent
- invokes bridge commands
- subscribes to events
- displays state

Native runtime:

- validates input
- accesses filesystem/keychain/database
- talks to OS APIs
- performs protocol work
- emits events
- enforces local security policy

## Command Contract

Each command should define:

- name
- input shape
- output shape
- errors
- permission/capability requirement
- side effects
- idempotency if relevant

## Event Contract

Native events should define:

- event name
- payload
- source module
- ordering expectations
- retention if persisted
- unsubscribe behavior

## Review Checklist

- UI does not duplicate native business logic.
- Commands validate inputs before side effects.
- Sensitive data does not cross into UI unless necessary.
- Bridge errors are stable and testable.
- Event listeners are cleaned up.
