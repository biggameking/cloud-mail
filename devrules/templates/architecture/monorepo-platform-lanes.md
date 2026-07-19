---
title: Monorepo And Platform Lanes
description: Pattern for web, desktop, mobile, native-shell lanes, shared packages, manifests, route contracts, and platform capability splits.
ownership: seed
governs: agent
activation: conditional
enforcement: example
decision_owner: project
side_effects: none
applies_to:
  - monorepos
  - web plus desktop products
  - web plus mobile products
  - shared core packages
  - platform-specific capability layers
use_when:
  - A product spans multiple platforms or lanes.
  - Shared business rules must stay aligned while UI/runtime capabilities differ.
do_not_use_when:
  - The repository has one platform and no planned split.
outputs:
  - lane classification
  - shared package map
  - platform capability policy
  - verification checklist
case_sources:
  - planner-v0 platform sync boundary checklist
  - planner-v0 lane route contracts
  - OpsHub apps/packages split
  - AutoMedia desktop-only trunk audit
related_workflows:
  - devrules/workflows/release.md
last_reviewed: 2026-06-11
---

# Monorepo And Platform Lanes

When a product spans platforms, classify every feature before implementation.

## Lane Types

- web
- desktop
- iOS/mobile
- native shell
- backend/API
- shared packages

## Lane Anchor Map

Use README anchors and project profile notes to make lanes discoverable:

| Lane | Common roots | Anchor focus |
| --- | --- | --- |
| Web UI | `src/`, `app/`, `pages/`, `components/`, `routes/` | routes, state, UI kit, data hooks, browser-only constraints |
| Desktop/native | `src-tauri/`, `electron/`, `crates/*`, `native/` | commands, filesystem, updater, capabilities, sidecars |
| Mobile | `ios/`, `android/`, `app/`, shared source roots | platform permissions, native modules, shared business logic |
| Backend/API | `server/`, `api/`, `cmd/`, `internal/`, `workers/` | routes, jobs, storage, auth, deployment surface |
| Shared | `packages/*`, `core/`, `domain/`, `shared/` | contracts, domain rules, test fixtures, dependency direction |

Each lane should have an owner, verification command, and known cross-lane contracts.

## Shared Packages

Common shared layers:

- design tokens
- UI kit
- domain core
- API contracts
- native bridge SDK
- test fixtures
- config schemas

## Feature Classification

Core shared feature:

- business rules are shared
- API contracts are shared
- permissions and entitlements are shared
- each lane ships compatible behavior

Platform capability feature:

- OS/runtime capability differs
- implementation can diverge
- shared business rules must not fork
- capability detection is explicit

## Governance Artifacts

Useful artifacts:

- app manifest per lane
- route contract per lane
- feature manifest
- package boundary rules
- verification scripts

## Review Checklist

- Feature is classified before work starts.
- Shared contracts do not fork silently.
- Platform-specific code is isolated.
- Deferred lane work is documented.
- Verification covers affected lanes.
- README anchors identify the right lane before implementation files are opened.
