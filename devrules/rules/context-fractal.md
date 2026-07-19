---
description: Semantic README anchor system for fast Agent navigation.
ownership: shared
governs: agent
activation: conditional
enforcement: advisory
decision_owner: project
side_effects: none
---

# Context Fractal

The context fractal is a documentation system that keeps project structure legible as code changes. It favors semantic anchors over mechanical documentation.

## Purpose

README anchors help Agents quickly answer:

- What is this directory responsible for?
- Which files are entry points?
- What depends on what?
- What should be updated when this area changes?
- Which checks prove this area still works?

## Available Anchor Levels

The context fractal offers three anchor levels. A repository uses only the
levels selected by its installation profile or an explicit project decision;
the shared template does not require every project to create all three.

| Level | Location | Useful when |
| --- | --- | --- |
| 1. Repository | Root entry docs and `devrules/memory/project-profile.md` | The selected profile includes a project map or commands are otherwise hard to discover. |
| 2. Source root | Project-shaped source roots such as `src/`, `app/`, `server/`, `packages/*`, `src-tauri/src/`, `ios/`, `android/`, `cmd/`, `internal/`, or equivalents | The directory contains active source code. |
| 3. Semantic module | Feature modules, services, data layer, complex UI areas, native modules, shared packages, public contract boundaries | The directory owns behavior, interfaces, data shape, or risky side effects. |

Leaf detail anchors are optional. Add them only when a deep subdirectory is complex, reused, or risky enough that future Agents need a local map.

Do not create noisy README files for tiny folders that contain obvious implementation detail. When a source root has many same-depth implementation modules, record them as anchor candidates and create README files only when a task needs that boundary.

## Anchor Selection Heuristics

Create README anchors for directories that reduce future search cost. Do not anchor directories merely because they are deep.

Good automatic anchor targets:

- Source roots that contain active product, platform, backend, native, or shared code.
- Package or crate boundaries with their own manifest file.
- Feature modules with public routes, commands, screens, workflows, or exported registration.
- Platform lanes such as `ios/`, `android/`, `src-tauri/`, `electron/`, `workers/`, or `apps/*`.
- Shared domain layers such as `domain/`, `core/`, `services/`, `integrations/`, `api/`, `lib/`, or `packages/*`.
- Risky side-effect boundaries: auth/session, billing, migrations, sync, storage, AI provider calls, background jobs, native bridge, release packaging.
- Existing human README locations that already act as project maps.

Prefer candidate recording instead of README creation when:

- A directory is one of many same-depth implementation modules.
- The ownership is obvious from naming and no public surface exists.
- The files are generated, static assets, fixtures, snapshots, examples, or build output.
- A parent anchor already explains the child well enough.
- Creating dozens of anchors would make initialization noisy.

When in doubt, create fewer anchors and record candidates in `manifest.json` and `memory/project-profile.md`.

## README Template

```markdown
# Directory Name

<!-- DEVRULES:README-ANCHOR-START -->
## devrules Context Anchor

- Path: `relative/path`
- Anchor type: source-root | semantic-module | leaf-detail
- Last reviewed: YYYY-MM-DD

## Responsibility

Short description of what this directory owns.

## Key Files

| Path | Purpose | Public surface / side effects |
| --- | --- | --- |
| example.ts | Example responsibility | exportedName |

## Child Areas

| Path | Responsibility |
| --- | --- |
| child/ | Child responsibility |

## Workflows And Checks

Relevant workflows and verification commands.

## Update Rules

Update this anchor when responsibilities, public interfaces, key files, dependency direction, or workflows change.
<!-- DEVRULES:README-ANCHOR-END -->
```

When a README already exists, initialization should preserve the human-authored prose and insert or update only the managed anchor block.

## Update Triggers

Update anchors when:

- Files or directories are added, removed, renamed, or moved.
- Public exports, routes, commands, schemas, or APIs change.
- A module responsibility changes.
- A dependency direction changes.
- A repeated onboarding question reveals missing context.

## Source Root Detection

When the selected profile enables automatic anchor discovery, infer source
roots from project shape rather than a fixed `src/` assumption. These are
common signals, not mandatory names:

- Web: `src`, `app`, `pages`, `components`, `lib`, `server`, `api`.
- Monorepo: `apps/*`, `packages/*`.
- Desktop/native: `src-tauri/src`, `src-tauri`, `electron`, `native`.
- Mobile: `ios`, `android`, `app`, `src`, platform packages, shared core packages.
- Backend: `cmd`, `internal`, `pkg`, `routes`, `controllers`, `services`.
- Cross-platform shared code: `core`, `shared`, `domain`, `packages/*`, `modules/*`.

Project instances can override or refine this list in `devrules/manifest.json` or `memory/project-profile.md`.

Nested Git repositories should not be treated as source roots of the parent repository. Initialize them separately only when recursive workspace scanning is explicitly requested.

## Platform Lane Notes

When a mixed repository selects lane-level anchoring, these are useful starting
approaches:

| Shape | Anchor approach |
| --- | --- |
| React/Vite/Next web app | Anchor `src/`, `app/`, or `pages/`, then high-signal `modules/`, `routes/`, `services/`, `integrations/`, or `components/ui/`. |
| Mobile app | Anchor `ios/`, `android/`, and shared JS/TS/native source roots separately. |
| Desktop app | Anchor frontend and native runtime separately, such as `src-tauri/`, `electron/`, `crates/*`, and UI source roots. |
| Backend service | Anchor command entry points, API/routes, domain/service layers, migrations, jobs, and integration adapters. |
| Monorepo | Anchor `apps/*` and `packages/*` as package boundaries, then only semantic modules inside high-change packages. |

The goal is that an Agent can identify the correct lane before opening implementation files.

## Initialization Expectations

Apply this system only when context anchoring is included by the selected
installation profile or explicitly requested for an existing project:

- a minimal profile may use no generated anchors;
- a standard profile may add a project map and selected source-root anchors;
- a full profile may additionally add high-signal semantic anchors and record
  lower-signal candidates.

These are available footprints, not quality grades or automatic defaults.
Preserve existing human README prose, create no empty anchors merely to reach a
level, and record only candidates that would reduce future search cost.

Generated anchors are starting points. Future work should refine them when the
project continues to use the subsystem and responsibilities, public surfaces,
or checks actually change.

Last updated: 2026-07-17
