---
description: Keep semantic README anchors and project documentation synchronized with code changes.
ownership: shared
governs: agent
activation: conditional
enforcement: advisory
decision_owner: project
side_effects: local
---

# Documentation Update Workflow

Use this workflow when code structure, module responsibilities, dependencies, exports, routes, commands, schemas, or public interfaces change.

## Triggers

- New, moved, renamed, or deleted files/directories.
- Public API, command, route, schema, type, or export changes.
- Module responsibility changes.
- Dependency direction changes.
- A future Agent would need new context to understand the affected area.

## Steps

1. Read `devrules/rules/context-fractal.md`.
2. Identify the nearest source root or semantic module README.
3. Update the README only where the change affects responsibility, key files, architecture notes, workflows, or update log.
4. Update higher-level README anchors only if the change affects their overview.
5. Update `devrules/memory/project-profile.md` if source roots, commands, stack, or architecture anchors changed.
6. Avoid mechanical README churn for trivial leaf implementation changes.

## README Anchor Template

```markdown
# Directory Name

> Maintenance: update this file when responsibilities, files, dependencies, exports, or workflows in this directory change.

## Responsibility

Short description of what this directory owns.

## Key Files

| Path | Purpose | Main dependencies | Public surface |
| --- | --- | --- | --- |
| example.ts | Example responsibility | package/module | exportedName |

## Architecture Notes

Important data flow, boundaries, or constraints.

## Workflows

Relevant workflows or checks for changes in this area.

## Update Log

- YYYY-MM-DD: Created.
```

## Verification

- Confirm README statements match the actual file tree.
- Confirm command names, paths, and exports are accurate.
- Run the closest relevant check for the code change.
- If the repository has the CLI installed, run:

  ```bash
  devrules audit --repo .
  ```

## When Not To Update

Do not update README anchors for tiny implementation-only edits that do not change responsibilities, interfaces, dependencies, or workflows.

Last updated: 2026-06-11
