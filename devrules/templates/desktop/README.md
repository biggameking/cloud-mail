---
title: Desktop Domain Templates
description: Index for native bridge, local API, SDK, secure desktop runtime, packaging, updater, and release evidence.
ownership: shared
governs: product
activation: conditional
enforcement: example
decision_owner: project
side_effects: none
applies_to:
  - Tauri apps
  - Electron-like apps
  - Rust/native desktop apps
  - local-first products
  - desktop companion apps
use_when:
  - A project has a native shell, local database, OS integrations, localhost API, or signed release flow.
do_not_use_when:
  - The project is web-only with no native runtime.
outputs:
  - native bridge boundary
  - local API/SDK plan
  - desktop release plan
  - secure local runtime notes
case_sources:
  - SetMail architecture and release runbook
  - AutoMedia desktop completion audit
  - DeGit Tauri services and CLI bridge
  - planner-v0 desktop lane and native bridge SDK
  - Mori and NovelX Tauri runtimes
  - FrameCast browser extension/storage patterns
related_workflows:
  - devrules/workflows/release.md
  - devrules/workflows/debug-root-cause.md
last_reviewed: 2026-06-11
---

# Desktop Domain Templates

Desktop products need explicit boundaries between UI, native runtime, local storage, OS integrations, and release distribution.

## Templates

| Template | Use For |
| --- | --- |
| `native-bridge.md` | UI to native command/event boundary, IPC contracts, OS capabilities. |
| `local-api-sdk.md` | Localhost API, SDK/CLI integration, automation clients, scoped tokens. |
| `desktop-release-updater.md` | Signed builds, updater channel, packaging, cross-platform evidence gates. |
