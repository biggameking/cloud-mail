---
title: Godot Project Architecture
description: Form for explicit Godot module, state, scene, service, and adapter boundaries.
ownership: seed
governs: product
activation: conditional
enforcement: example
decision_owner: project
side_effects: none
last_reviewed: 2026-07-13
---

# Godot Project Architecture

## Baseline

- Godot/editor and export-template version:
- Renderer and target platforms:
- Language(s), add-ons, test tools:
- Project directory/naming conventions:
- Headless and local export commands:

## Module Map

| Module | Responsibility | Owned state | Public inputs/outputs | Dependencies | Test scene/check |
| --- | --- | --- | --- | --- | --- |
| | | | | | |

## Process-Wide Services

| Autoload/service | Why process-wide | API/signals | Mutable state | Persistence/platform adapter | Alternative rejected |
| --- | --- | --- | --- | --- | --- |
| | | | | | |

## Communication Rules

- Owned/local direct calls:
- Observed events/signals and payload contracts:
- Group membership/broadcast use:
- Scene changes and lifecycle authority:
- Input, audio, persistence, telemetry, and platform adapters:

## Review

- [ ] Every mutable state has one owner.
- [ ] Dependencies are explicit and directional.
- [ ] Domain rules do not depend unnecessarily on presentation nodes.
- [ ] Reusable modules have isolated tests/scenes.
- [ ] Editor-only and platform-specific assumptions are isolated.
- [ ] Scene/resource/save migrations are planned.
