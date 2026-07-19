---
description: Initialize or upgrade a repository with a project-local devrules instance.
ownership: shared
governs: agent
activation: conditional
enforcement: advisory
decision_owner: project
side_effects: local
---

# devrules Initialize Workflow

Use this workflow when a user asks to apply devrules to one or more repositories.

## Goal

Install or normalize a project-local `devrules/` instance with the smallest
active contract the project selected, while preserving official Agent entry
files, project facts, and existing documentation.

## Inputs

- Template root: the canonical shared template selected by the device-local
  runtime locator.
- Target root: parent directory containing Git repositories, or a single repository.
- Mode: dry-run by default, apply only with explicit confirmation or `--apply`.
- Adoption profile: `minimal`, `standard`, or `full`. For a new repository,
  resolve an explicit `--profile` first, then project/runtime configuration;
  use `minimal` only as the safe fallback. Preserve an existing repository's
  selected profile unless the project explicitly changes it.
- Enabled surfaces: project-selected memory, hooks, context anchors,
  automation, or evolution features. Template files may be installed as a
  dormant library without activating those surfaces.
- Template update scope: `devrules/config.json` may set
  `templateSync.moduleSelection` to `explicit` and list module IDs in
  `templateSync.modules`. The default `manifest` mode follows
  `manifest.json#installedModules`. Declared dependencies and atomic peers are
  added automatically; excluded modules retain their existing bytes and
  provenance.
- Workspace mode: workspace commands use the first locator `workspaceRoots`
  entry unless `--root` is provided. Tracked template configuration is a
  compatibility fallback only when the locator has no workspace root.

## Steps

1. Identify the target:
   - single repository: use `--repo <repo>`;
   - parent directory: use `--root <parent>`;
   - locator-selected workspace: use `devrules workspace readiness` /
     `devrules workspace apply-ready`;
   - an explicit shared-template path identifies the source only. Do not infer
     its parent as the target workspace unless the user passes that parent with
     `--root` or configures it in the runtime locator.
2. Scan target directories for Git repositories.
3. Resolve the selected adoption profile before planning writes:
   - `minimal`: bind the official Agent entry to the smallest usable instance
     and manifest;
   - `standard`: add only the routing, config, memory, hooks, workflows, or
     templates the project selects for normal work;
   - `full`: add explicitly selected anchors, automation, compaction, or
     evolution surfaces on top of `standard`.
4. Record observed adoption separately from the selected profile. A higher
   observed level is not a quality score, and must not silently select a larger
   profile.
5. Read project-local `devrules/config.json` or root `devrules.config.json` when present.
6. Create the missing baseline instance files. If synchronization also copies
   optional library files, leave them dormant unless profile/config routing
   activates them.
7. Import legacy devrules-like Markdown when normalization is in scope:
   - old root `always-readme.md` into `devrules/memory/legacy-context.md`;
   - old `rules/` into `devrules/rules/`;
   - old `workflow/` or `workflows/` into `devrules/workflows/`;
   - old `.agent/` Markdown into the closest matching `devrules/` directory.
8. Create `manifest.json` and the files required by the selected profile. An
   explicit initialization may also install config, hook, script, template, or
   memory placeholders as a dormant compatibility library. Record installed,
   enabled, and dormant modules separately; placeholder presence is never
   permission for later unsolicited writes.
9. Add or update the managed devrules priority block in configured Agent entry files:
   - create or update `AGENTS.md` for Codex by default, preserving existing content;
   - create `.cursor/rules/devrules.mdc` with Cursor frontmatter and a routing
     card only when Cursor is a selected Agent surface;
   - bind `CLAUDE.md`, `.cursorrules`, `.windsurfrules`, or additional entries
     only when project/runtime `entryFiles` configuration selects them;
   - do not materialize compatibility entry files for tools the project does not use.
10. Only for `full` or another explicit context-anchor opt-in, create or update
    managed README anchors for selected source roots and high-signal semantic
    modules. Record lower-signal directories as candidates instead of creating
    empty README files.
11. A template installation may include `devrules/hooks/`, but only a selected
    profile/config route enables hook routing. Keep routes structured and
    conditional; file presence alone does not enable a hook or downstream
    workflow.
12. For batch initialization, treat `readyToApply` as "not compliant with the
    configured target profile yet, but safe for automated initialization";
    apply only that group.
13. Report the selected profile, observed adoption level, enabled and dormant
    surfaces, repositories initialized or skipped, and any item needing manual review.

## Existing Instance Upgrade Protocol

Use this protocol when a repository already has `devrules/` and the task is to
pull shared-template improvements into it:

1. Prefer `repo sync-template --repo <repo> --apply` for one adopted repository,
   or `batch sync-template --root <workspace> --apply` for an intentional
   workspace scope, over `init --repo <repo> --sync-template --apply`.
2. If `init --sync-template` is used for a single repository, treat it as a
   template-file sync plus missing-file repair. It must not downgrade the
   repository's selected adoption profile, separately observed adoption level,
   semantic modules, anchor candidates, enabled surfaces, or filled
   project-profile command table.
3. Before applying, capture the current project-local state:
   `devrules/manifest.json`, `devrules/config.json`,
   `devrules/memory/project-profile.md`, and `devrules/hooks/hooks.json` when
   each surface exists or is enabled; record other paths as `N/A`.
4. After applying, compare those files for unintended loss of local project
   facts. Template files may change; project identity, source roots, commands,
   and local hook classifications must not be blanked by a template sync.
5. Run `audit --repo <repo>` after the sync. Resolve new issues that apply to
   the selected profile; do not enlarge the profile merely to clear a warning.

## Workspace Batch Protocol

Use this protocol when the runtime-selected shared template should initialize
repositories under one workspace root, regardless of whether the template and
workspace live on the same disk:

1. Run `devrules location audit`, then `devrules workspace readiness`, or use
   `devrules batch readiness --root <workspace>` for an explicit parent.
2. Review the three groups:
   - `alreadyReady`: already adopted or compliant with the configured target profile;
   - `readyToApply`: not adopted yet, but safe for automated initialization;
   - `needsReview`: requires manual config, source-root tuning, legacy review, or reduced scope.
3. Run `devrules workspace apply-ready` or
   `devrules batch apply-ready --root <workspace>` without `--apply` to inspect
   planned writes.
4. Run the same command with `--apply` only for the `readyToApply` group.
5. Audit individual repositories that were skipped or need review before applying manual changes.

Do not use broad `init --root <workspace> --apply` for routine batch adoption. `apply-ready` is safer because it skips repositories that need judgment.

## Safety Rules

- Do not overwrite human-authored entry content.
- Do not delete unrelated user files during initialization.
- Do not initialize nested repositories unless recursive scanning is explicitly requested.
- Do not treat nested Git repositories as source roots or semantic modules of the parent repository.
- New initialization uses the `minimal` profile when neither the user nor
  project/runtime configuration selects a profile. Use `--profile standard` or
  `--profile full` only for an intentional opt-in. Legacy `--maturity 1|2|3`
  is an upgrade alias, not the preferred interface and not a project-quality rating.
- Do not overwrite existing README prose; update only the managed devrules anchor block.
- Do not generate README files for every directory just because it contains source code.
- Use `--prune-generated-anchors` only to remove stale README files that contain no human content beyond a generated devrules anchor.
- Use `devrules/config.json` to tune source roots, semantic anchors, candidates, ignored paths, and hooks before batch initialization.
- Do not create anchors, activate hooks, start a memory cadence, or enable
  automation solely because the shared template contains those files.
- For parent-directory batch work, prefer `batch apply-ready --root <parent> --apply` over `init --root <parent> --apply`; the safer batch command skips repositories that are already compliant, have too many automatic targets/candidates, or need manual review.
- For a locator-selected workspace, prefer `devrules workspace readiness` and
  `devrules workspace apply-ready --apply`.
- For an already adopted repository, prefer `batch sync-template` over
  re-running initialization. Initialization may repair missing files, but
  template sync must preserve project-local memory, manifest facts, and filled
  command tables.
- Do not delete legacy files during normalization unless the user explicitly asks for cleanup.

## Verification

- For a single repository, run `devrules audit --repo <repo>` and verify the
  selected profile and enabled surfaces.
- For a parent scan or batch, run `devrules scan --root <parent>` and
  `devrules batch readiness --root <parent>`.
- For a locator-selected workspace, run `devrules location audit`, then
  `devrules workspace readiness`.
- When editing the shared template itself, run
  `devrules audit --repo <template-devrules-dir>`; this enters template audit
  mode and should not require a nested `devrules/` instance.
- For an authorized bulk application, first run
  `devrules batch apply-ready --root <parent>` as dry-run, then rerun with
  `--apply` only after reviewing skipped repositories and confirming the
  `readyToApply` group really should be initialized.
- For an authorized locator-selected workspace application, first run
  `devrules workspace apply-ready` as dry-run, then rerun with `--apply`.
- Confirm the audit evaluates the selected profile and reports unselected
  surfaces as `not_applicable`, not missing requirements.
- Run initialization twice and confirm entry blocks and any selected README
  anchors are not duplicated.
- Confirm legacy imports are idempotent and source files remain in place.

## Memory Updates

- Update `memory/project-profile.md` only when durable project memory is enabled
  or the project explicitly requests that update.
- When evolution feedback is enabled, add `memory/evolution-suggestions.md`
  entries only for repeatable improvements to the template.

Last updated: 2026-07-17
