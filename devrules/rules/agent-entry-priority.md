---
description: How official Agent entry files bind to devrules without losing their original role.
ownership: shared
governs: agent
activation: conditional
enforcement: advisory
decision_owner: project
side_effects: none
---

# Agent Entry Priority

Official Agent entry files remain the stable interface for each CLI or IDE.
devrules does not replace them, but it is the authority for shared engineering
rules. Entry files point Agents into the project instance and may add only
repository- or tool-specific guidance; devrules must never depend on an entry
file for its shared rule bodies.

This rule must stay portable across Agent systems. The user and current host
select the active Agent surface; Codex, Claude Code, Cursor, Windsurf, and other
configured tools all enter the same repository-local
`devrules/always-readme.md` without devrules declaring one of them the default.

Scope matters: official entry files belong to concrete project repositories. A
workspace parent selected by the runtime locator is not an entry surface. Do
not create a workspace-parent `AGENTS.md`, `CLAUDE.md`, or IDE rule file merely
to point to the shared template, whether that template is elsewhere or uses a
legacy co-located layout.

## Principles

- Keep `AGENTS.md` as the Codex entry file.
- Keep `CLAUDE.md` as the Claude Code entry file.
- Keep IDE-specific files in their native locations.
- Preserve all existing human-authored content.
- Own only the managed devrules block.
- Place the managed block near the top so it is read before lower-priority project details.
- Configure additional Agent entry files in `devrules/config.json`; do not hard-code tool-specific forks into the orchestration layer.
- Keep the same managed block semantics across Agent surfaces; the only tool-specific difference should be the official filename and native frontmatter format.
- Apply this policy inside repository instances, not at a shared workspace parent.

## Managed Block

Use this exact marker shape so automation can update it idempotently:

```markdown
<!-- DEVRULES:ENTRY-START -->
## devrules Priority Context

Read `devrules/always-readme.md` before applying the project-specific guidance below. devrules is the authoritative shared engineering context; this entry file is an Agent adapter and may add only repository- or tool-specific instructions.

This managed block may be updated by `devrules/scripts/devrules.mjs`; preserve the surrounding official entry content.
<!-- DEVRULES:ENTRY-END -->
```

## Updating Entry Files

When initializing or auditing:

1. Confirm the target path is a project repository, not a locator-selected
   workspace parent.
2. If an entry file exists in the project repository, insert or update only the managed block.
3. If `AGENTS.md` is missing in the project repository, create a minimal Codex entry file with the managed block and a placeholder for project-specific content.
4. If `.cursor/rules/devrules.mdc` is missing in the project repository, create a minimal Cursor rule with native frontmatter (`alwaysApply: true`) and the managed block, then refresh its routing card.
5. Do not create `CLAUDE.md`, `.cursorrules`, `.windsurfrules`, or other IDE rule files unless they already exist, the user asks for them, or `devrules/config.json` explicitly lists them under `entryFiles.create`.
6. Existing files listed under `entryFiles.bindIfPresent` receive the managed block when present and are skipped when absent.
7. Never remove existing commands, architecture notes, PR instructions, or conventions.

## Default Entry Configuration

Template instances should start with this Cursor-aware policy:

```json
{
  "entryFiles": {
    "create": [
      "AGENTS.md",
      ".cursor/rules/devrules.mdc"
    ],
    "bindIfPresent": [
      "CLAUDE.md",
      ".cursorrules",
      ".windsurfrules"
    ]
  }
}
```

Project instances may add more entries, but every entry must point to the same `devrules/always-readme.md`.

Shared template workspaces should usually have no official Agent entry file (`AGENTS.md` / `CLAUDE.md`) at their parent root. Agents maintaining the template should open `devrules/` directly or a concrete project repository. A multi-repo Cursor workspace parent may keep a local always-on `.cursor/rules/devrules.mdc` that only routes Agents into each repository's own `devrules/always-readme.md`; that parent rule is workspace-local and must not become a second orchestration root.

## Binding Depth

The managed block should be near the top of the entry file, but it should not replace native tool instructions. Use this policy:

- Codex: create `AGENTS.md` if missing and place the managed block before project-specific guidance.
- Claude Code: update `CLAUDE.md` only when it already exists or is configured for creation.
- Cursor: create `.cursor/rules/devrules.mdc` when missing, preserve native YAML frontmatter, keep the managed block after frontmatter, and refresh the generated routing card.
- Template sync: after an unblocked sync, refresh configured root entries and the Cursor routing card; if only the entry layer drifted, use `devrules repo refresh-entries --repo <repo> --apply`.
- Windsurf/other IDE files: preserve frontmatter, rule metadata, and file format; insert the managed pointer in the closest valid markdown/rule section.
- Future Agents: add their entry file path to `devrules/config.json`; do not add a second orchestration root.

If an entry file already contains older devrules-like instructions, preserve them and import the legacy material into the project instance for manual cleanup rather than deleting it during initialization.

## Single Source Rule

The managed block must point directly to `devrules/always-readme.md`. Do not add intermediary routing files or alternate devrules entry paths.

Shared rules flow one way: `AGENTS.md` and other official entry files reference
devrules. Never make devrules route back through an entry file, and never copy a
devrules rule body into a managed entry block.

## Workspace Parent Exception

If a directory such as `GithubDev/` contains many repositories plus a shared `devrules/` symlink or template, treat it as a workspace parent. The parent can be recorded in the registry as a workspace path, but it should not be initialized as a product project and should not carry a parent-level `AGENTS.md`.

Only create an entry file at that parent if all of these are true:

1. The parent is itself a Git repository with user-authored project content.
2. The user explicitly wants the parent to be a managed project instance.
3. The parent has its own project-local `devrules/` instance or a documented reason to bind to the shared template.

Last updated: 2026-07-16
