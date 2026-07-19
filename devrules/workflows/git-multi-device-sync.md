---
description: Clean/equal pre-edit gating, mainline-first Git publication, exact-account GitHub push, and multi-device synchronization without stale overwrite or hidden local state.
ownership: shared
governs: device
activation: conditional
enforcement: advisory
decision_owner: project
side_effects: local
---

# Git Publication And Multi-Device Sync

Use the pre-edit gate in this workflow before the first local write in every
devrules-governed GitHub repository. Also use the full publication/handoff path
before every commit/push publication, whenever the repository is edited from
more than one device, or before switching an active task to another clone.

## Authority And Boundaries

- The configured Git remote is authoritative for shared history.
- GitHub may own shared history and project-selected hosted CI. Under
  `automation.githubActionsPolicy=inherit`, preserve clean committed workflows;
  an Agent needs explicit approval before adding or materially modifying hosted
  CI. `allow` records the approved scope, while only `deny` prohibits hosted
  workflows.
- The devrules authority repository should be private by default: its registry contains device/workspace/project metadata and absolute local paths even though it must never contain credentials or secret values.
- Each device uses a separate clone. Never synchronize an active `.git` directory through a file-sync product.
- Each device selects its canonical shared-template clone and product workspace
  roots through one untracked runtime locator. Product repositories keep
  relative `devrules/...` paths; do not commit device absolute paths to tracked
  config or require the template to live under a workspace.
- A branch and exact commit SHA are the handoff unit. A folder timestamp, stash, untracked file, or editor state is not a handoff.
- Feature/WIP branches are allowed during development. Final publication of
  completed work happens from the repository's configured default branch only,
  after branch review and integration.
- devrules automation never resets, force-pushes, auto-merges, auto-rebases,
  deletes branches, or silently stashes changes. A human/Agent publication run
  may explicitly delete a branch only after the gate proves it is merged,
  inactive, and no longer needed.

## Mandatory Pre-Edit Gate

Before the first local file mutation in a GitHub-backed repository:

1. Inspect the worktree, branch, upstream, remote URL, and untracked paths.
2. Fetch/prune the configured remote using the repository's approved account
   and network path. A stale tracking ref is not cloud-fresh evidence.
3. Require an attached branch, a configured upstream, a clean worktree, and
   exact local/upstream equality (`ahead=0`, `behind=0`).
4. When a trusted handoff SHA exists, also require the checked-out and upstream
   commits to match that SHA.
5. Only after the gate passes may local editing begin.

Preferred evidence:

```bash
devrules repo preflight --repo <repo> --fetch --expect-sha <handoff-sha>
```

When no handoff SHA exists, fetch and prove the same branch/upstream,
clean-worktree, and `0/0` conditions with scoped Git commands before editing.
Read-only inspection may proceed while the gate is unresolved.

If the worktree is dirty or the branch is ahead, preserve and review the work;
do not automatically package it into a prerequisite commit. Committing and
pushing existing work requires explicit authority and proportionate
verification. If the branch is behind, use fast-forward-only integration when
safe. Divergence, detached HEAD, missing upstream, failed fetch/authentication,
or uncertain remote identity blocks local writes until explicitly resolved.

## Publication Gate

Before the final commit/push sequence, run:

```bash
devrules repo publish-readiness --repo <repo> --fetch --verify-host
```

The command is read-only and fails closed. It reports:

- current, default, local, remote, merged, unmerged, WIP, and cleanup branch state;
- remote default-branch divergence after fetch;
- `.gitignore`, untracked paths, likely temporary/build output, and likely
  secret-bearing untracked files;
- the project inventory's exact GitHub `owner/repository` and central
  `accountRef` binding;
- the active `gh` login, repository identity, visibility, and default branch
  from GitHub readback.

If an intentional unfinished branch is not already active in another worktree,
declare it explicitly for that review:

```bash
devrules repo publish-readiness --repo <repo> --fetch --verify-host --wip-branches <branch-a,branch-b>
```

This declaration does not merge, delete, or push anything. It only records that
the named branch was reviewed as unfinished for the current publication.

### Required order

1. Inspect `git status`, staged/unstaged changes, `.gitignore`, and every
   untracked path. Keep necessary source; remove or ignore temporary files,
   local credentials, logs, caches, and build output. Prove secret-bearing local
   files are ignored with `git check-ignore`.
2. Fetch the remote. If the default branch is behind, use `git pull --ff-only`
   when possible. If history diverged, inspect both sides and make one explicit
   reviewed merge; never reset or force-push to discard either side.
3. Inspect every local and remote non-default branch. Merge only functionality
   whose implementation and relevant tests are complete. Preserve unfinished
   branches as explicit WIP.
4. Check out the default branch and merge each completed branch. Resolve
   conflicts by understanding both versions and preserving all intended
   behavior; do not select one side wholesale merely to finish the merge.
5. Re-run relevant tests on the integrated default-branch tree.
6. Delete only local branches proven merged and no longer needed. Do not delete
   a branch checked out by another worktree or owned by unfinished work. Keep a
   completed remote feature branch as `cleanup-after-push` until the integrated
   default branch is safely on the remote.
7. Re-run `publish-readiness`. The final push may proceed only from the clean,
   integrated default branch with matching GitHub account/repository readback.
   After that push succeeds, delete remote branches proven merged into the now-
   published default branch, fetch/prune, and run the gate once more.

### GitHub account and repository selection

- Each GitHub repository keeps one active `provider: github` binding in
  `devrules/memory/developer-services-inventory.json`. The binding names the
  exact `owner/repository` and references a non-secret central account record in
  `devrules/registry/developer-account-records/`.
- Never infer the target account from the currently active browser, credential,
  or `gh` session. Read back the active login and repository before writing.
- `biggameking` is the configured account for repositories explicitly bound to
  `github:biggameking`; it is not a universal hard-coded owner. Other
  repositories use their own recorded binding, like Supabase and Cloudflare.
- If no remote repository exists, first select and verify the exact account,
  then create `<owner>/<repository>` as private and configure `origin`. Remote
  creation is an external write and must be part of the user's explicit publish
  request. Never create a public repository by default.

## Release Identity And Versioning

Use the complete tuple `version + revision + exact commit SHA` for every stable
template handoff. A version alone orders releases for humans; it cannot prove
byte identity or resolve two devices that independently chose the same version.

- `MAJOR` (`A.0.0`): incompatible template, CLI, sync-state, or public workflow
  contract that requires explicit migration.
- `MINOR` (`A.B.0`): a backward-compatible capability, subsystem, workflow, or
  public command.
- `PATCH` (`A.B.C`): backward-compatible fixes, documentation/rule refinement,
  and test or safety corrections without a new capability.
- `template.json:revision`: increment for every stable managed-template
  publication, regardless of SemVer level. Never reuse a revision with different
  content.
- Git tag `vA.B.C`: create once on the final verified release commit. Do not move
  or recreate a published tag.
- `CHANGELOG.md`: latest heading, `template.json:version`, and the CLI `VERSION`
  must agree before publication.

Assign the final version only to the integrated release candidate, then verify
that exact version again on the default branch after merge. File inactivity or
a quiet period may prompt review but never auto-publishes incomplete work. For
Nutstore archives, include version, revision, and short SHA in the immutable
filename, for example
`devrules-<version>-r<revision>-<shortsha>.zip`.

## Start On A Device

1. Obtain the handed-off branch and exact commit SHA.
2. For shared-template work, inspect `devrules/scripts/runtime-location.md` and
   run `devrules location audit`. Configure or switch the single locator only
   after the candidate clone has been fetched and inspected.
3. Fetch and verify before editing:

```bash
devrules repo preflight --repo <repo> --fetch --expect-sha <sha>
```

4. Follow the reported state:

| State | Required action |
| --- | --- |
| clean, equal, exact SHA | Work may start. |
| behind only | Update with `git pull --ff-only`, then rerun preflight. |
| ahead only | Push and verify before changing devices. |
| diverged | Stop; review and choose an explicit rebase or merge. |
| dirty | Commit to a WIP/feature branch and push. Do not hand off via stash. |
| detached or no upstream | Attach/set the intended branch and upstream first. |

## Finish, Publish, And Hand Off

1. Run the publication gate above and integrate completed branches into the
   default branch.
2. Run repository checks appropriate to the integrated change.
3. Commit every intended change from the default branch. Confirm no secret,
   machine-local artifact, temporary file, or build product is staged.
4. Push the default branch without force.
5. Remove only verified merged feature branches locally and remotely, then
   fetch/prune and confirm the default branch is clean and equal to upstream.
6. Generate a verified handoff:

```bash
devrules repo handoff --repo <repo> --fetch --json
```

7. Pass the resulting version, revision, branch, and exact commit SHA to the next
   device. The next device must use that SHA with `repo preflight --fetch --expect-sha`.

## Workspace Review

Use a read-only local comparison across sibling repositories:

```bash
devrules workspace git-status --root <workspace>
```

Add `--fetch` only when network/authentication prompts are acceptable. Without it, remote freshness is explicitly reported as unchecked.

## Template Upgrade Lane

Keep template propagation separate from product work:

1. `template status` must be ready.
2. Product target must pass Git preflight and have no project-local `devrules/` changes.
3. Run template dry-run and review all repositories.
4. Apply on a dedicated upgrade branch.
5. Commit only the template upgrade and its versioned `.template-sync.json` state.
6. Run project checks and use a PR for protected branches.

Any template conflict blocks every write for that repository. Do not bypass it with a full-copy replacement.

## Recovery

Template apply stores a local transaction journal under the target repository's Git directory. Failures roll back automatically. To inspect or restore a completed transaction:

```bash
devrules repo recover-sync --repo <repo> --transaction <id>
devrules repo recover-sync --repo <repo> --transaction <id> --apply
```

Recovery first validates the selected repository, transaction ID, every managed
relative destination, backup location, regular-file type, hash, and symlink
boundary. One invalid entry blocks every recovery write. A valid recovery
restores files to their pre-transaction bytes. Commit history remains the
primary durable recovery path.

## Acceptance Matrix

For the devrules authority repository, run the automated suites locally first.
They use temporary repositories and local bare remotes only. This is the
current repository's release practice, not a universal ban on project-owned
hosted verification:

```bash
node scripts/devrules-sync-selftest.mjs
node scripts/registry-runtime-selftest.mjs
node scripts/template-authority-selftest.mjs
node scripts/template-sync-ownership-selftest.mjs
node scripts/runtime-location-selftest.mjs
node scripts/design-selftest.mjs
node scripts/model-game-selftest.mjs
node scripts/github-actions-policy-selftest.mjs
node scripts/git-publish-readiness-selftest.mjs
node scripts/developer-services-registry-selftest.mjs
node scripts/production-readiness-selftest.mjs
node scripts/code-health-selftest.mjs
```

Then verify the real authority repository and workspace without changing product repositories:

```bash
devrules template status --fetch --json
devrules location audit --json
devrules repo preflight --repo . --fetch --expect-sha "$(git rev-parse HEAD)" --json
devrules repo handoff --repo . --fetch --json
devrules registry refresh --root <workspace> --json
devrules workspace git-status --root <workspace> --json
git status --short
```

| Requirement | Evidence | Pass criterion |
| --- | --- | --- |
| Runtime path switching | runtime-location self-test plus `location audit` | One device-local profile independently selects a valid canonical template and workspace roots; changing it switches the next launcher process, invalid templates fail closed, and offline workspaces are reported without creating paths. |
| Template source authority | `template status --fetch` plus authority self-tests | Source is a clean, exact annotated-tag commit in its own Git repository; actual remote matches `template.json`; upstream exists; local commit, upstream, and remote tag object agree. A declaration-only, lightweight-tagged, stale, or unpublished source is rejected. |
| Exact start state | `repo preflight --fetch --expect-sha` | `ready=true`, fetch was checked, branch is attached, worktree is clean, expected/local/upstream SHA are equal, and `ahead=0`, `behind=0`. |
| Verified device handoff | `repo handoff --fetch` and handoff self-test | Record contains branch and exact SHA and reports the same clean/equal state. Dirty, ahead, behind, detached, missing-upstream, and diverged states are blocked. |
| Conflict isolation guarantee | selective-module, dependency-closure, and conflicting-deletion self-tests | The conflicted module, its dependents, and atomic peers receive no writes; independent safe modules may apply in one rollback-capable transaction and report a partial result. Global authority/state failures leave every managed byte unchanged. |
| Transaction safety and recovery | injected-failure rollback and manual-recovery self-tests | Failed apply restores pre-transaction bytes; a completed journal can be restored explicitly; repeat sync remains valid. |
| Managed deletion safety | safe/conflicting-deletion and ownership-lifecycle self-tests | A file removed by a newer template is deleted only when its provenance-checked owner is `template` and the project copy still matches its baseline. Project-owned files survive content convergence, removal, and reintroduction. |
| Sync-state trust | forged-state, legacy migration, selective-module, and remote-authority migration self-tests | Schema 4 binds each file and module to released commit/revision provenance. Path aliases, injected hashes, unsafe state, and silent repository-identity changes fail closed. Explicit adoption preserves existing files; explicit ownership reconciliation updates shared content while preserving seed/local bytes. |
| Autonomous convergence | template-auto-update and scheduler self-tests | Exact annotated releases install under versioned detached paths; major upgrades require explicit authority; every runtime workspace repository is enrolled; two fetch-backed Git gates precede mutation; current-version retries converge deferred projects; scheduler status and project accounting are observable. |
| Monotonic template identity | mutable-revision and downgrade self-tests | Reusing a revision with changed content and applying an older revision/version are rejected. |
| Shared/local hook separation | hooks self-test | Shared `hooks/hooks.json` propagates while `hooks.local.json` remains device-local and unchanged. |
| Concurrent registry safety | `registry-runtime-selftest.mjs` plus the sync lock self-test | Devices/workspaces own separate Git-authoritative records; two devices have no shared refresh path; one device retains multiple workspace registrations; aggregate views are computed in memory; malformed authority blocks before every write; lock contention blocks overlapping local writers; identical refresh produces no diff; retirement is explicit. |
| Read-only workspace visibility | `registry refresh` without `--apply` and `workspace git-status` | All intended workspaces/repositories, including the root and template repository, are reported; no product repository is mutated. |
| Local regression gate | syntax checks plus all local self-test suites | This repository's required verification runs locally before commit/push. Under `automation.githubActionsPolicy=inherit`, clean committed workflows are preserved; Agent-added or materially modified hosted CI requires explicit approval. `allow` records that approved scope, and `deny` prohibits hosted workflows. |
| Publication readiness | `git-publish-readiness-selftest.mjs` plus real `repo publish-readiness --fetch --verify-host` | Final publication is on the default branch; remote history is fetched; GitHub account/repository identity matches the registry; no unclassified branches, immediately cleanable refs, untracked paths, or likely local secrets/build output remain. A remote completed branch may be `cleanup-after-push` only until its integrated default commit is safely remote, then it is deleted and the gate is rerun. |
| Final local cleanliness | `git status --short` | Output is empty after verification. |

Do not declare a cross-device handoff complete merely because the automated suites pass. The real authority repository must also have a published upstream commit, and the fetch-backed preflight and handoff commands must pass.

No active `.git` directory may be managed by a file-sync product.

Last updated: 2026-07-19
