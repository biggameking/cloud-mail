---
description: Promote reusable project-local devrules changes back into the shared template safely.
ownership: shared
governs: release
activation: explicit
enforcement: gate
decision_owner: project
side_effects: external
---

# devrules Template Promotion Workflow

Use this workflow when a project-local devrules rule, workflow, hook, script,
template, or convention may be useful across repositories.

## Goal

Keep the ownership and propagation lifecycle explicit:

1. The shared devrules template is the authority for shared rule, workflow,
   hook, script, and template bodies.
2. `AGENTS.md`, `CLAUDE.md`, Cursor rules, and other Agent entry files remain
   native adapters that point one way to `devrules/always-readme.md`; they do
   not carry copies of shared devrules bodies.
3. Project-specific learning stays in that project's `devrules/`.
4. Reusable learning is abstracted into the shared template only after review.
5. Released shared content converges by ownership and installed module without
   overwriting project-local seed/local content or conflicted shared modules.

Classify ownership separately from applicability:

| Ownership | Promotion behavior |
| --- | --- |
| `shared` | Maintain the reusable body in the shared template and sync it to eligible projects. Whether it runs is still determined by applicability metadata and runtime conditions. |
| `seed` | Maintain only a reusable starter. After adoption, project-local tuning is owned by the project unless a separate generic improvement is promoted. |
| `local` | Keep the body in the project instance. Do not promote it unless a distinct reusable pattern is explicitly reclassified. |

Use `governs`, `activation`, `enforcement`, `decision_owner`, and
`side_effects` to describe when a document applies and how it behaves. Shared
ownership does not mean always-on activation. Infer ownership from a clear
request or existing evidence; ask the user only when ambiguity would materially
change propagation or authority.

## Triggers

- A project-specific workflow or rule starts to look reusable.
- The same devrules gap appears in more than one repository.
- The user asks to make a project-local workflow, rule, hook, or mechanism
  general for all projects.
- A project implementation reveals a safer default that belongs in the shared
  template.

## Inputs

- The affected project instance under `<repo>/devrules/`.
- The canonical shared template selected by the device-local runtime locator.
- Any project-local evolution suggestion in
  `<repo>/devrules/memory/evolution-suggestions.md`.
- Current `repo sync-template`, `batch sync-template`, or
  `workspace sync-template` dry-run output when propagation is needed.

## Steps

1. **Classify ownership and applicability**
   - Infer `shared`, `seed`, or `local` when the request and repository evidence
     are clear. Ask before editing only when the unresolved choice would change
     authority, propagation, or project-local ownership.
   - Write `ownership` plus `governs`, `activation`, `enforcement`,
     `decision_owner`, and `side_effects` into workflow/rule frontmatter or the
     equivalent hook fields before syncing.
   - Treat `shared` as a content-authority classification, not an always-on
     runtime instruction.
   - Keep project-only commands, paths, private services, product naming, and
     release details inside the project instance.
   - Promote only portable rules, workflows, templates, scripts, or safety
     mechanisms.

2. **Start from the project instance**
   - If the need was discovered during concrete project work, update or test the
     project-local `devrules/` behavior first.
   - Record a concise suggestion in
     `devrules/memory/evolution-suggestions.md` when the idea may be generic but
     is not yet promoted.

3. **Abstract before template edits**
   - Remove project names, credentials, private URLs, narrow stack assumptions,
     and one-off commands.
   - Express the reusable part as a small rule, workflow step, template section,
     script behavior, or hook.
   - For shared conditional systems, describe activation, branch selection,
     judgment gates, and side effects before implementation steps.
   - For `seed` systems, make the boundary between reusable starter and
     project-local tuning explicit.
   - Keep the shared Agent-governance layer model-neutral. Inherit the Agent,
     model, and reasoning controls selected by the user or host; do not add a
     default/preferred model or product API request parameters. Provider-specific
     adapters are conditional project architecture after that project selects
     a provider.
   - Keep official Agent entry files as one-way pointers into
     `devrules/always-readme.md`. Do not promote a shared rule body into an
     `AGENTS.md`, `CLAUDE.md`, Cursor, or other entry adapter.

4. **Update the shared template intentionally**
   - Resolve the canonical shared template with `devrules location show`. Edit
     that template only during explicit template-maintenance work or direct
     user instruction; do not infer it from the current workspace parent.
   - Update indexes and routing files when a workflow, hook, script, or template
     becomes discoverable.
   - Do not promote `local` systems to the shared template.
   - If a promoted hook runs at SessionStart, keep its default path read-only.
     Installing or repairing a persistent scheduler requires an explicit
     `devrules idle ensure-agent --apply` action or the device operator's
     `DEVRULES_IDLE_SCHEDULER_AUTO_REPAIR=1` opt-in.
   - Preserve committed hosted CI under
     `automation.githubActionsPolicy=inherit`, but do not create or materially
     change GitHub Actions without explicit user approval. Use `allow` only for
     an approved lane and `deny` when hosted workflows must be rejected.
   - Record the template-side decision in
     `devrules/memory/decisions.md`.
   - Increment `template.json:revision` for every stable managed-template
     publication. Apply SemVer as defined in `git-multi-device-sync.md`: major for
     incompatible contracts, minor for backward-compatible capabilities, patch
     for compatible fixes/refinement. A revision must never be republished with
     different managed content.
   - Keep `template.json:version`, `scripts/devrules.mjs` `VERSION`, the latest
     `CHANGELOG.md` heading, and the final annotated `v<version>` tag aligned.
   - During editing, run the local content/schema gate:

     ```bash
     devrules audit --repo <template-root> --strict
     ```

     This gate reads working-tree content and may run while the tree is dirty,
     untagged, offline, or not yet published. It does not certify release state.
   - Commit the release, create its annotated `v<version>` tag, and push the
     commit and tag through the repository release flow. Then run:

     ```bash
     devrules template release-audit
     ```

     This explicit gate fetches origin and verifies a clean tree, aligned
     release identity, upstream publication, and the exact annotated remote
     tag. Only a passing release audit authorizes project apply. `devrules
     template status --fetch` remains useful observation, but it is not a
     substitute for the release gate.

5. **Sync with baseline protection**
   - Snapshot project-local state before applying:
     `devrules/manifest.json`, `devrules/config.json`,
     `devrules/memory/project-profile.md`, and
     `devrules/hooks/hooks.json`, plus `devrules/hooks/hooks.local.json` when
     present.
   - Invoke the stable launcher, which resolves the one device-local shared
     template. Do not invoke a project's copied `devrules/scripts/devrules.mjs`
     as the control plane. Audit the locator, then for one explicitly selected
     repository run:

     ```bash
     devrules location audit
     devrules repo sync-template --repo <repo>
     devrules repo sync-template --repo <repo> --apply
     ```
   - An unblocked repository sync also refreshes configured root Agent entries
     and the Cursor routing card. Use `repo refresh-entries` only when repairing
     that entry layer without changing the template instance.

     This command uses the transactional template-sync path followed by the
     focused entry refresh. It does not scan sibling repositories or run full
     initialization, source discovery, or README-anchor generation.

   - For all repositories registered and explicitly bound to this shared
     template on the current device, run:

     ```bash
     devrules workspace sync-template --registered
     devrules workspace sync-template --registered --apply
     ```

   - A device may instead opt into the independently scheduled released-template
     convergence path in `template-auto-update.md`. SessionStart remains
     read-only; installing that scheduler is a separate explicit device action.

   - Use `batch sync-template --root <workspace> --apply` only when a single
     workspace parent is intentionally in scope.
   - Treat `conflict` as an intentional module protection signal. It means a
     project file differs from the last known template baseline. That module,
     its dependent modules, and any atomic peers are deferred; unrelated safe
     modules may still apply atomically and report `partial=true`.
   - Template authority failures, unsafe state structure, target topology
     changes, or source/target revalidation failures are global blockers and
     leave every managed byte unchanged.
   - Treat invalid or unverifiable `.template-sync.json` as a separate
     fail-closed state. `--adopt-current-baseline` preserves every current file
     as project-owned. For a deliberate ownership migration, inspect the
     dry-run and use `--reconcile-ownership`; current `shared` files converge to
     the release while `seed` and `local` bytes remain project-owned. Do not
     hand-edit hashes or ownership to bypass the gate.
   - Do not use full-copy replacement to bypass conflicts.
   - Do not use `init --sync-template` as the routine propagation command for
     already adopted repositories. If it is used for targeted repair, verify it
     preserved existing project maturity, source roots, semantic modules,
     command tables, and local hook classifications.

6. **Resolve conflicts manually when needed**
   - For each conflicted project file, compare the project-local content with the
     template improvement.
   - Merge only the generic part that is safe for that project.
   - Leave project-specific divergences local.
   - Refresh the baseline only after the merge decision is clear.

7. **Verify propagation**
   - Run `devrules audit --repo <template-root> --strict` while editing the
     shared template.
   - Run `devrules template release-audit` after the release commit and
     annotated tag are published and before project apply.
   - Run `devrules batch readiness --root <workspace>` for every explicit
     workspace parent that received changes.
   - Run `devrules audit --repo <repo>` for every repository that received
     changes.
   - Diff the project-local snapshot from step 5 and confirm no local project
     facts were blanked or downgraded by template propagation.
   - Search for the promoted mechanism across project instances when the change
     must be present everywhere.
   - Report synced repositories, skipped repositories, conflicts, and remaining
     manual merges.

## Do Not Promote

- Secrets, credentials, tokens, private URLs, customer data, or raw logs.
- One project's release path, product terms, app IDs, service names, or local
  scripts unless they are generalized.
- Experimental ideas that have not improved real project work.
- Changes that belong in application code instead of devrules.

## Done Criteria

- The project-local need is preserved in the project instance.
- The reusable part is generalized in the shared template.
- Ownership and applicability metadata are present and valid.
- Shared rule bodies live in devrules; Agent entry files contain only native
  guidance and one-way devrules pointers.
- No shared default selects an Agent/model, reasoning strength, provider, or
  product request parameter.
- The template decision is recorded.
- The local strict content/schema audit passes, and the explicit release audit
  passes before any project apply.
- Eligible projects receive the change through baseline-protected sync.
- Any conflicts are reported and left for explicit merge, not overwritten.

Last updated: 2026-07-19
