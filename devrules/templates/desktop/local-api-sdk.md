---
title: Local API And SDK
description: Pattern for localhost APIs, SDKs, CLIs, scoped local tokens, SSE/event streams, and automation clients.
ownership: seed
governs: product
activation: conditional
enforcement: example
decision_owner: project
side_effects: none
applies_to:
  - local-first desktop apps
  - automation tools
  - developer-facing products
  - desktop apps with SDKs
use_when:
  - External local clients need to automate or integrate with a desktop app.
do_not_use_when:
  - There is no local automation or SDK surface.
outputs:
  - local API boundary
  - auth/scope model
  - SDK contract
  - event stream plan
  - diagnostics checklist
case_sources:
  - SetMail localhost API and Python SDK
  - DeGit CLI bridge and command manifest
  - planner-v0 desktop runtime APIs
related_workflows:
  - devrules/workflows/debug-root-cause.md
last_reviewed: 2026-06-11
---

# Local API And SDK

A localhost API is a durable integration surface. Treat it like a real API even if it only runs on the user's machine.

## Local API Pattern

Define:

- base URL discovery
- auth method
- token scopes
- route catalog
- request/response envelope
- error contract
- rate limits
- CORS/origin policy
- event stream or webhook support

## SDK/CLI Pattern

SDKs should include:

- typed client
- examples
- error classes
- streaming support if needed
- retry guidance
- version compatibility
- local server discovery

## Security Rules

- Bind to localhost unless remote access is explicit.
- Use scoped tokens.
- Avoid unauthenticated destructive routes.
- Redact secrets in logs.
- Show active automation access in UI where appropriate.

## Review Checklist

- API contract is documented and tested.
- SDK examples match actual API behavior.
- Token scopes are enforced server-side.
- Local automation failures are diagnosable.
- Event streams can reconnect safely.
