---
description: Define and review modular Godot scene, state, signal, resource, and autoload boundaries.
ownership: seed
governs: agent
activation: conditional
enforcement: advisory
decision_owner: project
side_effects: local
---

# Godot Module Architecture

## Trigger

Run before a medium+ Godot feature, a new shared subsystem, cross-scene state, Autoload addition, data contract, or refactor of coupled scenes/scripts.

## Inputs

- Canonical feature brief and project architecture.
- Current scene tree, scripts, resources, signals, Autoloads, data flow, and tests.
- Target Godot version and platform constraints.
- `templates/game/engines/godot/project-architecture.md`, `templates/game/engines/godot/scene-contract.md`, and `templates/game/engines/godot/data-resource-schema.md`.

## Responsibility Hats

- **Solo:** Game Engineering designs boundaries; Design validates authoring ergonomics; QA designs isolated scene and integration checks.
- **Team:** Technical lead owns architecture; gameplay engineers own domain modules; technical design/art validates editor workflows; QA owns test seams; Production records migration risk.

## Steps

1. Map the player behavior to existing modules and decide reuse, extension, replacement, isolation, or refactor.
2. Assign authoritative state ownership. Domain rules should not depend on presentation nodes when a plain script/resource boundary is sufficient.
3. Define scene contracts: purpose, inputs, outputs, lifecycle, owned children, external dependencies, signals, failure states, and test scene.
4. Choose communication deliberately: direct calls for owned/local relationships, signals for observed events, groups for explicit broadcast membership, and Autoloads only for true process-wide services.
5. Define Resource/config schemas separately from runtime mutable state; identify stable IDs and validation rules.
6. Keep platform, persistence, audio, input, telemetry, and storefront concerns behind adapters.
7. Review node lookup fragility, circular signals, implicit scene-tree dependencies, duplicated state, and editor-only assumptions.
8. Plan migrations for scenes, resources, saves, and tests; implement the smallest architecture move.
9. Verify unit-like domain tests, minimal scene tests, integration path, headless checks where feasible, and exported-build behavior.

## Outputs

- Updated architecture and scene contracts.
- State ownership and communication map.
- Resource/data schema and adapter boundaries.
- Migration plan and focused verification evidence.

## Gates

- Every mutable state has one authoritative owner.
- No new Autoload exists only to avoid designing an interface.
- Cross-module dependencies are explicit and directional.
- Each reusable scene/module has a minimal isolated verification path.
- Engine/editor/platform concerns do not own game-rule decisions.

## Done Criteria

The feature works through documented boundaries in isolation and integration, affected scenes/resources/saves are migrated, representative exported behavior passes, and architecture documentation matches the implementation.
