---
description: Add, change, or run devrules automation scripts safely across Windows and macOS.
ownership: shared
governs: agent
activation: conditional
enforcement: advisory
decision_owner: project
side_effects: local
---

# devrules Script Automation Workflow

Use this workflow when a task adds, changes, audits, or relies on scripts under `devrules/scripts/`.

## Goal

Keep devrules automation useful, explicit, idempotent, and safe in repositories with active user work.

## Triggers

- A user asks to automate devrules initialization, audit, memory, hooks, or README anchor maintenance.
- An Agent needs to add a project-local helper under `devrules/scripts/`.
- A workflow depends on running a devrules script that may write files.
- A project-local script pattern looks reusable across repositories.

## Inputs

- Script location: shared template script or project-local script.
- Intended read scope.
- Intended write scope.
- Default mode: dry-run or apply.
- Platform target: Windows, macOS, or both.
- Related workflow that justifies any mutation outside `devrules/` or managed blocks.

## Steps

1. Read `devrules/rules/script-governance.md`.
2. Confirm whether the script belongs in the shared template or only this repository instance.
3. Prefer Node.js `.mjs` and standard library APIs for shared scripts.
4. Define CLI behavior before implementation:
   - dry-run default;
   - explicit `--apply` for mutation;
   - `--json` when output may be consumed by other tools;
   - stable exit codes;
   - concise human summary.
5. Document read/write scope in script help or `devrules/scripts/README.md`.
6. Make file edits idempotent with managed blocks where possible.
7. Normalize stored paths to repository-relative forward-slash paths.
8. Run the script in dry-run mode first.
9. Run with `--apply` only when the dry-run output matches the requested scope.
10. If the script pattern should improve the shared template, write an evolution suggestion instead of silently generalizing project-local private logic.

## Safety Rules

- Do not run destructive Git commands.
- Do not delete human-authored content.
- Do not mutate secrets, environment files, or credential stores.
- Do not hide migrations, deploys, package installs, or formatters inside devrules automation unless the user explicitly requested that behavior and the relevant workflow documents it.
- Do not rely on shell-specific syntax in shared scripts.
- Do not use project-local private data in the shared template.

## Verification

- Run the script with `--dry-run` or default mode.
- Run the narrow command with `--apply` only when mutation is intended.
- Re-run the same command and confirm idempotence.
- On script changes, run at least one Windows-compatible path and one POSIX-style path scenario when practical.
- For initialization scripts, run readiness/audit commands after changes.

## Memory Updates

- Record project-specific script behavior in `memory/project-profile.md` when future Agents need the command.
- Record reusable failure modes in `memory/lessons.md`.
- Record cross-project automation ideas in `memory/evolution-suggestions.md`.

## When Not To Use

- A normal product task only runs package scripts already documented by the project.
- A one-off shell command is enough and does not become part of devrules.
- The automation would be safer as a project package script outside `devrules/`.

Last updated: 2026-06-19
