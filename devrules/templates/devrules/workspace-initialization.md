---
title: Workspace Initialization
description: Template for adopting devrules across repositories under a runtime-selected workspace root.
ownership: seed
governs: agent
activation: conditional
enforcement: example
decision_owner: project
side_effects: none
applies_to:
  - Codex-first workspaces
  - multi-repository local development folders
  - runtime-located devrules installations
use_when:
  - A user asks to initialize all Git repositories under a parent directory.
  - A canonical shared template should manage repositories on the same or a
    different disk.
do_not_use_when:
  - The task targets one known repository; use `devrules-instance.md` instead.
outputs:
  - readiness classification
  - safe apply command
  - skipped repository review list
related_rules:
  - devrules/rules/system-maturity.md
  - devrules/rules/script-governance.md
related_workflows:
  - devrules/workflows/devrules-initialize.md
  - devrules/workflows/devrules-audit.md
last_reviewed: 2026-07-15
---

# Workspace Initialization

This template describes the standard adoption path when one canonical shared
template manages repositories under a workspace root selected by the
device-local runtime locator.

## Workspace Shape

```text
internal-or-synced-disk/
`-- devrules/              # canonical shared template

workspace-or-external-disk/
|-- project-a/.git/
|-- project-b/.git/
`-- project-c/.git/
```

The template root and workspace root are independent. The shared template is
not a target product repository, and the workspace does not need a template
clone or symlink.

## Command Path

After installing the stable launcher:

```bash
devrules location audit
devrules workspace readiness
devrules workspace apply-ready
devrules workspace apply-ready --apply
```

For an explicit parent:

```bash
devrules batch readiness --root <workspace>
devrules batch apply-ready --root <workspace>
devrules batch apply-ready --root <workspace> --apply
```

## Readiness Groups

| Group | Meaning | Action |
| --- | --- | --- |
| `alreadyReady` | Repository already satisfies the configured target or is already adopted. | Skip unless auditing or upgrading. |
| `readyToApply` | Repository is not compliant yet but appears safe for automated initialization. | Apply with `apply-ready --apply` after reviewing dry-run output. |
| `needsReview` | Repository needs manual inspection, config tuning, or reduced scope. | Do not batch apply. Audit or initialize individually. |

## Instance Writes

For every initialized repository, the script may create or update:

- `AGENTS.md` managed block;
- existing compatible Agent entry files;
- repository-local `devrules/`;
- `devrules/config.json`;
- `devrules/manifest.json`;
- `devrules/hooks/`;
- `devrules/memory/`;
- managed README anchor blocks for selected source roots and semantic modules.

It must not delete legacy files, secrets, source code, or human-authored README prose.

## Review Checklist

- The workspace root is correct.
- The runtime-selected shared template is not inferred as a workspace target.
- Nested Git repositories are skipped unless recursive mode was explicitly requested.
- `readyToApply` count matches expectation.
- `needsReview` items are not mutated by batch apply.
- Dry-run planned writes match the requested scope.
- Post-apply audit passes for representative repositories.
