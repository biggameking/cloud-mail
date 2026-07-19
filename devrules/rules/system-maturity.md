---
description: devrules adoption profiles, observed levels, and profile-aware audit criteria.
ownership: shared
governs: agent
activation: conditional
enforcement: advisory
decision_owner: project
side_effects: none
---

# System Adoption

devrules adoption is incremental. These levels describe how much of the devrules
system a repository has chosen to operate; they are not a score for product,
code, team, or repository quality.

Adoption is measured per repository instance. The repository's selected
installation profile and manifest describe the intended footprint. Do not infer
that a higher level is better, require a level merely because a repository is
large, or compare unrelated projects by their level.

## Levels

| Level | Name | Criteria |
| --- | --- | --- |
| 0 | Not adopted | No devrules instance or entry binding. |
| 1 | Entry bound | Official entry file contains the devrules priority block. |
| 2 | Instance installed | Repository has the smallest usable `devrules/` instance and the artifacts required by its selected profile. |
| 3 | Context anchored | The selected profile maintains useful README anchors for chosen source roots or semantic modules. |
| 4 | Workflow active | Selected workflows, routing, or feedback surfaces are used during normal development. |
| 5 | Evolution loop | Audits, compaction, and cross-project evolution suggestions are regularly maintained and reviewed before template promotion. |

## Continuous Maintenance Signals

Initialization is not the end state. A repository records Level 4 only when
normal Agent work actually uses the opted-in workflow features:

- tasks enter through `always-readme.md`, plus the project profile when selected;
- hooks route non-trivial work when hook routing is selected;
- README anchors are updated when anchoring is selected and their boundaries change;
- memory captures durable user feedback, decisions, and reusable lessons when durable memory is selected;
- scripts are run in dry-run before mutation and their reports are understandable.

Level 5 requires a cross-project review loop:

- project instances write evolution suggestions locally;
- the template collects suggestions for human review;
- accepted suggestions are promoted into generic rules, workflows, templates, or scripts;
- rejected suggestions stay project-local or are marked as not general.

## Installation Profiles

Installation profile is a project choice, not a global default. Preserve an
existing selection. For a new installation, use the profile requested by the
user or repository owner; when no selection exists, present the available
footprints without silently choosing the largest one.

| Profile | Intended footprint | Typical adoption evidence |
| --- | --- | --- |
| `minimal` | Agent entry binding plus the smallest usable devrules instance and manifest. | Level 1-2; no generated README-anchor requirement. |
| `standard` | Minimal footprint plus the routing, memory, and context surfaces the project explicitly selects. | Often Level 2-4; source-root anchors or hooks are present only when selected. |
| `full` | Standard footprint plus broader semantic anchors, automation, compaction, or evolution review chosen by the project. | Often Level 3-5; each optional subsystem must still be in active use. |

Profiles describe installation scope; levels describe observed adoption. A
`minimal` repository can be healthy and well governed. A `full` repository does
not satisfy an audit merely because more files exist.

## Audit Signals

An audit should check only the requirements of the repository's selected
profile and explicitly enabled subsystems. Shared baseline checks include:

- The selected profile is explicit and valid in the manifest.
- Required entry binding exists and is not duplicated.
- Files required by the selected profile exist and are internally consistent.
- Managed README anchors and anchor candidates are correct when context anchoring
  is selected.
- A hook registry exists and is valid when hook routing is selected.
- Configuration is valid when the selected profile creates it.
- Installed work systems declare their ownership/scope metadata.
- Existing configured Agent entry files contain exactly one managed devrules block.
- Legacy `always-readme.md`, `rules/`, `workflow/`, `workflows/`, and `.agent/`
  Markdown content is handled according to the chosen migration scope.

Missing artifacts from an unselected profile are `not_applicable`, not defects.
Audits must not raise the installation profile or adoption level as a side
effect.

## Workspace Adoption

When template `devrules/` is placed under a parent directory that contains many sibling Git repositories, use workspace-level commands:

```bash
devrules workspace readiness
devrules workspace apply-ready --apply
```

This scans the first device-local locator workspace root, then falls back to
tracked template configuration only when the locator defines no workspace.
Explicit `--root` overrides both. Batch application should mutate only
repositories classified as ready to apply.

`readyToApply` means a repository is not yet compliant but appears safe for automated initialization. It does not mean the repository already satisfies devrules.

Last updated: 2026-07-17
