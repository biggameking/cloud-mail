---
title: devrules Project Instance
description: Structure and operating contract for a repository-local devrules instance.
ownership: shared
governs: agent
activation: conditional
enforcement: example
decision_owner: project
side_effects: none
applies_to:
  - repositories initialized with devrules
  - multi-agent project maintenance
  - template instance review
use_when:
  - A repository needs a profile-sized devrules instance or an existing instance needs review.
do_not_use_when:
  - The repository is not being initialized with devrules.
outputs:
  - instance directory structure
  - entry binding policy
  - memory contract
  - adoption profile and observed-level checklist
case_sources:
  - devrules/scripts/devrules.mjs
  - devrules/rules/context-fractal.md
  - devrules/rules/workflow-management.md
  - devrules/rules/memory-governance.md
related_workflows:
  - devrules/workflows/devrules-initialize.md
  - devrules/workflows/devrules-audit.md
  - devrules/workflows/devrules-memory-maintenance.md
  - devrules/workflows/devrules-feedback-update.md
  - devrules/workflows/devrules-evolution-review.md
last_reviewed: 2026-07-17
---

# devrules Project Instance

A project-local `devrules/` directory is an instance of the shared template system. It belongs to that repository. Project-specific changes, memory, and evolution suggestions stay inside the repository instance.

## Profile-Driven Structure

The project chooses an adoption profile. The CLI's safe bootstrap fallback is
`minimal`; choosing it does not rate the repository's quality or prevent later
opt-in. Preserve an existing profile unless the project explicitly changes it.

| Profile | Active contract | Not required merely by this profile |
| --- | --- | --- |
| `minimal` | Official Agent entry pointer, smallest usable instance, core Agent safety/orchestration, and manifest. | Generated README anchors, active hook routing, durable-memory cadence, automation, or evolution loop. |
| `standard` | Minimal plus the project-selected routing, config, memory, hooks, workflows, or templates used in normal work. | Semantic-module anchors and evolution automation unless separately enabled. |
| `full` | Standard plus explicitly selected source/semantic anchors, automation, compaction, or evolution-review surfaces. | Unused integrations or project/product policy choices. |

A template sync may leave additional library files present. Presence is not
activation: audit and Agent behavior follow the manifest/profile, structured
routing conditions, and project config. Adoption profiles control activation,
not distribution footprint; a future lean-footprint mode would be a separate,
explicit installation choice.

The complete instance can contain these surfaces:

```text
devrules/
├── always-readme.md
├── config.json
├── manifest.json
├── rules/
├── workflows/
├── hooks/
├── templates/
├── scripts/
└── memory/
    ├── project-profile.md
    ├── decisions.md
    ├── interaction-log.md
    ├── lessons.md
    └── evolution-suggestions.md
```

`devrules/always-readme.md` is the only devrules orchestration entry. Official files such as `AGENTS.md` and `CLAUDE.md` keep their original responsibilities and point agents to this entry first.

## Configuration

`devrules/config.json` describes initialization and audit behavior without
editing the shared script. Explicit initialization may install this descriptor
for compatibility even under `minimal`; its presence does not activate every
documented subsystem. The manifest/profile and conditional routes remain the
activation source of truth.

Use it to:

- define the workspace parent used by workspace commands;
- describe compatible Agent surfaces while keeping one orchestration root;
- configure which Agent entry files are created or bound when present;
- include or exclude source roots;
- include, exclude, promote, or ignore semantic module anchors;
- change the maximum number of automatic module anchors per source root;
- disable or add project-local hooks;
- define memory feedback policy and template suggestion boundaries;
- document script automation defaults;
- tune audit strictness.

## Entry Binding

Entry files should preserve existing content and include a managed block that instructs the agent to read:

- `devrules/always-readme.md`

The block should be marker-based and idempotent. Do not replace the official entry file's native purpose.

Baseline entry policy:

- create or update `AGENTS.md` for Codex so it points to
  `devrules/always-readme.md` while preserving project-local content;
- create or bind `.cursor/rules/devrules.mdc`, `CLAUDE.md`, `.cursorrules`,
  `.windsurfrules`, or other Agent entries only when the corresponding Agent
  surface is selected by project/runtime configuration;
- do not create compatibility entry files solely because the shared template
  knows how to manage them.

## Memory Contract

Use durable project memory when the selected profile/config enables it or the
project explicitly requests it. A present placeholder does not authorize
unsolicited memory writes.

Project memory files:

- `project-profile.md`: stable project shape, stack, important directories, commands.
- `decisions.md`: durable decisions and rationale.
- `interaction-log.md`: recent interaction trail for compaction and review.
- `lessons.md`: project-specific practices learned through work.
- `evolution-suggestions.md`: suggestions that may later be promoted to the shared template after human review.

Memory should be concise, dated, and reviewed. Do not store secrets.

After normal tasks, update memory only when the interaction produced durable context: a preference, decision, command, source-root fact, repeated failure, reusable lesson, or cross-project improvement idea.

## Local Evolution Contract

When local evolution is enabled, repository instances may evolve independently:

- Add project-specific workflows when a recurring task exists in this repository.
- Add project-specific scripts when automation is safer than repeated manual edits.
- Add project-specific templates when they encode local architecture.
- Keep these local unless the same pattern appears across many repositories.
- For cross-project reuse, write a suggestion to `memory/evolution-suggestions.md`; do not edit the shared template from ordinary project work.

## Workspace Commands

When the project intentionally uses workspace-wide management, workspace
commands scan sibling Git repositories under the selected parent:

```bash
devrules workspace scan
devrules workspace readiness
devrules workspace apply-ready --apply
```

Use explicit parent commands when the target root is elsewhere:

```bash
devrules batch readiness --root <parent>
devrules batch apply-ready --root <parent> --apply
```

Always review readiness before applying batch changes. `readyToApply` means safe to initialize, not already compliant.

## Observed Adoption Levels

Levels describe observed use, not project quality and not the installation
profile itself. See `rules/system-maturity.md` for the authoritative criteria.

| Level | Meaning |
| --- | --- |
| 1 | Official entry files point to `devrules/always-readme.md`. |
| 2 | A usable project-local instance and manifest satisfy the selected profile. |
| 3 | Profile-selected source or semantic anchors are actively maintained. |
| 4 | Selected workflows, routing, memory, or automation are actively used. |
| 5 | Audit, compact, and evolution review form a closed loop. |

Do not raise the profile or level to satisfy an audit. Missing surfaces from an
unselected profile are `not_applicable`, not defects.

## README Anchor Pattern

When the selected profile/config enables context anchors, directory README
anchors should be short and functional:

- responsibility
- key files
- dependencies
- common workflows
- update rules
- last reviewed date

They are not essays. They exist to help agents quickly locate the right files.

Do not generate README anchors mechanically for every directory. For a
`full` profile or another explicit anchor opt-in, initialization may:

- anchor the selected project-shaped source roots;
- anchor selected high-signal semantic modules such as package boundaries, stable architecture lanes, platform boundaries, or existing README locations;
- record lower-signal module candidates in `manifest.json` and `project-profile.md` for task-driven promotion.

Anchors should live inside a managed block:

```markdown
<!-- DEVRULES:README-ANCHOR-START -->
## devrules Context Anchor

- Path: `relative/path`
- Anchor type: source-root | semantic-module
- Last reviewed: YYYY-MM-DD

...
<!-- DEVRULES:README-ANCHOR-END -->
```

When a README already exists, preserve the human prose and update only the managed anchor block.

## Legacy Normalization

Initialization should import old devrules-like Markdown into the instance:

- old root `always-readme.md` into `devrules/memory/legacy-context.md`;
- old root `rules/` into `devrules/rules/`;
- old root `workflow/` or `workflows/` into `devrules/workflows/`;
- old `.agent/` Markdown into the closest matching `devrules/` directory.

Do not delete legacy files automatically. Keep imports marked with their source path so a human can distill them into canonical project memory, rules, workflows, or evolution suggestions.

## Hook Registry

When hook routing is enabled, `devrules/hooks/hooks.json` defines project-local
Agent triggers. These are not Git hooks or background services; they are
structured routing hints. Conditional and explicit targets do not activate
merely because they are present in the registry.

## Review Checklist

- The manifest records `minimal`, `standard`, or `full`, and audit uses that profile.
- `devrules/always-readme.md` and the files required by the selected profile exist.
- Official entry files preserve existing content and include the managed priority pointer.
- `manifest.json` records version, time, entry bindings, enabled modules, the
  selected adoption profile, and any separately observed adoption level.
- Config, memory, hooks, templates, and automation are checked only when the
  selected profile/config enables them.
- When memory is enabled, feedback updates are written to project-local memory,
  not the shared template.
- Legacy imports are recorded when old devrules-like files are discovered.
- Source-root and selected semantic-module README anchors exist only when the
  project claims the corresponding adoption/profile surface.
- When anchoring is enabled, candidates are recorded instead of materialized as
  empty README files.
- When hook routing is enabled, `devrules/hooks/hooks.json` reflects the project stack.
- Templates are copied as optional guidance, not default context.
- Scripts are idempotent and safe by default.
