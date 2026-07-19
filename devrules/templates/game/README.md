---
title: Game Development Template Library
description: Engine-neutral game production forms with a separate Godot adapter layer.
ownership: shared
governs: product
activation: conditional
enforcement: example
decision_owner: project
side_effects: none
applies_to: [game projects, prototypes, live or premium releases]
use_when: [a game workflow requests a reusable form, a project needs a canonical production contract]
outputs: [project-local game documents, reviewable evidence, explicit stage decisions]
last_reviewed: 2026-07-13
---

# Game Development Template Library

These are seed forms. Copy only the selected form into the project instance, remove irrelevant sections, and fill it with project evidence. Do not edit a shared template to store project facts.

## Boundaries

- `core/` is engine-neutral and owns player intent, production evidence, content contracts, quality, and release readiness.
- `engines/godot/` adapts the core contracts to Godot scenes, nodes, resources, signals, Autoloads, import, and export.
- Project-specific game rules, identifiers, values, engine versions, platform targets, credentials, and release paths belong in the project.
- General architecture, analytics, accessibility, localization, performance, security, and operations templates remain authoritative for their domains.

## Core Index

| Template | Use |
| --- | --- |
| `core/source-of-truth-registry.md` | Select canonical V1 facts and supersede conflicting drafts. |
| `core/game-concept-brief.md` | Define player promise, loop, pillars, constraints, and risks. |
| `core/stage-gates.md` | Define evidence-based production stages and exits. |
| `core/feature-brief.md` | Govern a player-facing design or feature change. |
| `core/prototype-experiment.md` | Time-box one uncertainty and its decision threshold. |
| `core/asset-brief.md` | Specify a visual, audio, UI, narrative, or content deliverable. |
| `core/asset-manifest.md` | Track provenance, import, ownership, and runtime use. |
| `core/level-content-spec.md` | Specify reusable level/content intent and validation. |
| `core/tuning-note.md` | Record a controlled balance change and evidence. |
| `core/playtest-report.md` | Separate observations, interpretation, and decision. |
| `core/performance-baseline.md` | Freeze budgets, scenarios, and measurements. |
| `core/save-schema-migration.md` | Define schema changes, migration, recovery, and fixtures. |
| `core/release-readiness.md` | Record release gates, exceptions, artifacts, and authority. |

## Godot Index

Start with `engines/godot/README.md`.

| Template | Use |
| --- | --- |
| `engines/godot/project-architecture.md` | Record module, state, adapter, and directory boundaries. |
| `engines/godot/scene-contract.md` | Define a reusable scene's lifecycle and dependencies. |
| `engines/godot/data-resource-schema.md` | Define authored Resource/config contracts and validation. |
| `engines/godot/export-matrix.md` | Define repeatable platform exports and install checks. |
| `engines/godot/version-upgrade-review.md` | Assess an engine/add-on/template upgrade before adoption. |

## Selection Route

1. Run the matching game workflow.
2. Open only the forms named by that workflow.
3. Store filled forms with the project's canonical documents or evidence.
4. Link decisions and generated outputs back to their editable source.
5. Retire obsolete filled forms explicitly instead of accumulating competing versions.
