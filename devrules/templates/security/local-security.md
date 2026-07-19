---
title: Local Security
description: Pattern for desktop/local-first trust boundaries, keychain, encryption, localhost APIs, local files, and automation tokens.
ownership: seed
governs: agent
activation: conditional
enforcement: example
decision_owner: project
side_effects: none
applies_to:
  - desktop apps
  - local-first apps
  - local APIs
  - sync clients
  - developer automation tools
use_when:
  - A project stores data locally or exposes local automation.
do_not_use_when:
  - The product is server-only and does not store local secrets.
outputs:
  - local trust boundary
  - key storage plan
  - local API security policy
  - local file access checklist
case_sources:
  - SetMail local-first trust model
  - DeGit Tauri auth and encrypted sync
  - planner-v0 desktop BYOK storage
  - Mori local channels and security modules
related_workflows:
  - devrules/workflows/debug-root-cause.md
last_reviewed: 2026-06-11
---

# Local Security

Local apps are not automatically safe. They have different attack surfaces: filesystem, localhost ports, keychain, IPC, plugins, update channels, and local automation.

## Local Trust Boundary

Define:

- which data is local-only
- which data syncs
- which process owns secrets
- which UI surfaces may display secrets
- which local clients may automate the app
- what happens on shared machines

## Key Storage

Prefer OS keychain or encrypted storage for:

- mail credentials
- OAuth tokens
- AI BYOK keys
- local API tokens
- sync encryption keys

Avoid plain local storage for secrets.

## Local API Security

For localhost APIs:

- bind narrowly
- require scoped tokens
- validate origin where relevant
- rate-limit destructive routes
- expose active access in settings
- log access without leaking payloads

## File Access

For local files:

- request user-chosen paths
- sandbox where platform allows
- avoid following unsafe symlinks for destructive operations
- validate import packages
- protect backup and export destinations

## Review Checklist

- Local secrets are not stored in plaintext.
- Local APIs require scoped auth.
- IPC commands validate input.
- Update channel is signed or verified.
- Local logs do not leak private data.
