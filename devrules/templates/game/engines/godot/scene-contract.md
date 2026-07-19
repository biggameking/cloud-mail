---
title: Godot Scene Contract
description: Form for a reusable Godot scene's ownership, API, lifecycle, dependencies, and tests.
ownership: seed
governs: product
activation: conditional
enforcement: example
decision_owner: project
side_effects: none
last_reviewed: 2026-07-13
---

# Scene Contract

## Identity

- Scene path and owner:
- Purpose and explicit non-responsibilities:
- Instantiated by / lifetime / teardown authority:
- Owned child nodes and mutable state:

## Public Contract

| Kind | Name/type | Direction | Semantics/invariant | Lifecycle timing |
| --- | --- | --- | --- | --- |
| Method/property | | | | |
| Signal | | | | |
| Resource/config | | | | |

## Dependencies

| Dependency | Required/optional | Injection/lookup mechanism | Failure behavior | Test substitute |
| --- | --- | --- | --- | --- |
| | | | | |

## Lifecycle And States

- Creation/configuration/ready order:
- Active, paused, disabled, failure, and teardown states:
- Scene-tree, group, input, physics, and process assumptions:
- Persistence and restore behavior:

## Verification

- Minimal isolated test scene:
- Domain/unit checks:
- Signal/lifecycle checks:
- Integration and exported-build scenario:
- Performance density/budget:
- Migration notes for callers/scenes/saves:
