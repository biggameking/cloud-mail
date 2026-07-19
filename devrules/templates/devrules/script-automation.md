---
title: Script Automation
description: Template for designing safe devrules automation in template and project instances.
ownership: seed
governs: agent
activation: conditional
enforcement: example
decision_owner: project
side_effects: none
applies_to:
  - devrules/scripts helpers
  - cross-platform repository maintenance
  - managed-block generators
use_when:
  - Adding or reviewing automation under `devrules/scripts/`.
  - Making initialization, audit, memory, or anchor maintenance repeatable.
do_not_use_when:
  - A normal package script outside devrules already covers the task.
outputs:
  - script scope definition
  - CLI contract
  - verification checklist
related_rules:
  - devrules/rules/script-governance.md
related_workflows:
  - devrules/workflows/devrules-script-automation.md
last_reviewed: 2026-06-19
---

# Script Automation

Scripts in `devrules/scripts/` should make the context system easier to maintain. They should not become hidden product logic.

## Script Design Card

Before implementing a script, define:

| Field | Answer |
| --- | --- |
| Purpose | What repeated maintenance task does this automate? |
| Owner | Template-level or project-local? |
| Read scope | Which files/directories may be read? |
| Write scope | Which files/directories may be changed with `--apply`? |
| Managed blocks | Which markers does the script own? |
| Platforms | Windows, macOS, or both? |
| Verification | Which dry-run/apply/idempotence checks prove it works? |

## CLI Contract

Recommended flags:

```bash
node devrules/scripts/name.mjs --dry-run
node devrules/scripts/name.mjs --apply
node devrules/scripts/name.mjs --json
node devrules/scripts/name.mjs --help
```

Rules:

- dry-run is the default for writes;
- `--apply` is required for mutation;
- summaries are concise by default;
- `--json` returns machine-readable output for other scripts;
- exit code `0` means success, non-zero means command error.

## Cross-Platform Checklist

- Use Node.js filesystem APIs for core work.
- Read and write UTF-8 explicitly.
- Normalize stored paths to forward slashes.
- Avoid shell pipelines for file mutation.
- Avoid PowerShell-only and Bash-only syntax in shared scripts.
- Retry transient Windows file lock errors when safe.
- Keep shell wrappers optional and documented.

## Promotion Path

If a project-local script becomes useful across multiple repositories:

1. Write a project-local evolution suggestion.
2. Collect suggestions from the workspace.
3. Review for privacy and scope fit.
4. Promote the smallest generic behavior into the shared template script.

Do not copy private project assumptions into the template.
