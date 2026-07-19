---
title: Godot Game Template Adapter
description: Godot-specific forms for applying engine-neutral game contracts.
ownership: shared
governs: product
activation: conditional
enforcement: example
decision_owner: project
side_effects: none
last_reviewed: 2026-07-13
---

# Godot Adapter

Use these forms only after the relevant engine-neutral intent and evidence are clear. Record the project-selected Godot version, renderer, platforms, add-ons, naming, directories, test framework, and export commands locally.

## Index

| Template | Contract |
| --- | --- |
| `project-architecture.md` | Modules, state owners, communication, adapters, directories, and checks. |
| `scene-contract.md` | Purpose, lifecycle, API, signals, dependencies, ownership, and isolated test scene. |
| `data-resource-schema.md` | Resource/config identity, fields, validation, generation, and runtime conversion. |
| `export-matrix.md` | Presets, local commands, artifact identity, install, upgrade, and smoke checks. |
| `version-upgrade-review.md` | Evidence and migration plan for Godot, export-template, renderer, or add-on upgrades. |

## Adaptation Rules

- Prefer plain game-rule logic that can be verified without a live scene tree.
- Use direct calls, signals, groups, and Autoloads according to ownership and lifetime, not convenience.
- Separate authored `Resource`/config data from mutable runtime state and saves.
- Treat `.tscn`, `.tres`, import settings, project settings, and export presets as contracts that need reviewable diffs.
- Verify important behavior in an exported build; editor execution alone is insufficient release evidence.
