---
description: Discover, verify, install, and safely converge released devrules templates across one opted-in device.
ownership: shared
governs: release
activation: explicit
enforcement: gate
decision_owner: user
side_effects: external
---

# Autonomous Template Update Workflow

Use this workflow when enabling, running, auditing, or repairing device-level
devrules release updates. The updater is a control-plane service: it changes the
active shared-template runtime and eligible project working trees, but it never
commits or pushes a product repository.

## Safety Invariants

- SessionStart remains read-only. Autonomous writes come only from the
  separately installed device scheduler or a manual `--apply` invocation.
- A candidate must be a newer annotated release tag whose version, monotonic
  revision, exact commit, remote tag object, declared source repository, and
  default-branch ancestry all verify.
- Runtime releases live under immutable versioned paths and are checked out at
  detached exact-tag commits. The canonical source repository still releases
  from its clean published default branch.
- Major upgrades require a one-time `--allow-major` decision or an explicit
  persisted device policy. The default scheduled policy never crosses a major
  version automatically.
- Workspace roots come from the device runtime locator as well as compatible
  registry records. Direct-child independent Git worktrees are the default
  project boundary; nested repositories, archives, migration staging trees,
  and the shared template source require separate explicit enrollment.
- A project mutation requires two fetch-backed checks proving an attached
  branch with concrete, identical local/upstream commit SHAs. Ordinary dirty,
  ahead, behind, diverged, detached, unborn, offline, missing-upstream,
  ambiguous-remote, or fetch-failed repositories are deferred with zero
  automatic writes. A dirty worktree may resume only when a device-local 0600
  receipt proves its exact status and every dirty byte was written and
  fingerprinted by an earlier updater run; any human or concurrent edit
  invalidates that authority.
- `shared` files follow the released template; `seed` files become
  project-owned after first installation; `local` files are never synchronized.
  Each project may narrow automatic updates with the project-owned
  `devrules/config.json#templateSync` module scope; invalid or unknown scopes
  fail closed, and dependency/atomic closure is mandatory.
  A module conflict defers that module plus its dependency/atomic closure while
  independent safe modules may commit in one rollback-capable transaction.
- The updater never stashes, resets, merges, rebases, commits, pushes, deletes
  branches, erases project data, or bypasses a template-sync conflict.

## Commands

Read-only observation:

```bash
devrules template auto-update status --json
devrules template auto-update agent-status --json
devrules template auto-update run --dry-run --json
```

Manual one-shot activation and convergence:

```bash
devrules template auto-update run --apply --reconcile-ownership
```

Add `--allow-major` only after reviewing the major-version migration. A manual
major upgrade does not make later major upgrades automatic.

Install or repair the independent scheduler only after device-local opt-in:

```bash
devrules location install-launcher --apply
devrules template auto-update ensure-agent --apply --reconcile-ownership
```

Remove that opt-in with:

```bash
devrules template auto-update uninstall-agent --apply
```

## Execution Sequence

1. Validate the device update lock. A schema-valid lock whose recorded process
   is conclusively absent may be recovered after token/inode revalidation;
   live, unreadable, invalid, or indeterminate ownership remains locked. Then
   acquire the lock exactly once and write a `running` status record.
2. Resolve the active runtime profile and require a switchable device-local
   `runtime.json` for apply.
3. Verify the current exact release and query the authoritative remote for
   newer annotated tags.
4. Clone a candidate into staging, verify its complete release identity and
   ancestry, then install it under `releases/v<version>`.
5. Atomically switch the runtime locator and refresh global managed assets.
   Refresh the idle-resource scheduler and template-update scheduler only when
   each was already installed. Scheduler source is loaded from the verified new
   release; template update opt-in does not grant simulator-maintenance opt-in.
6. Discover direct-child independent worktrees under every enrolled workspace
   root. Record excluded migration/backup/control, nested, duplicate, template,
   and escaping-symlink candidates. For each enrolled project, run the Git
   gates, initialize a clean unadopted repository with the minimal profile, or
   run ownership-aware template sync for an adopted one.
7. Persist one accounting-complete status: every discovered project is exactly
   `applied`, `current`, or `deferred`. A deferred project may also report
   `partialApplied` and its blocked modules.
8. On a later run, retry every deferred repository even when no newer template
   release exists.

If runtime activation fails, restore the previous runtime and device surfaces.
If a project transaction fails, its journal rolls the project bytes back. A
successful partial module transaction is not rolled back merely because another
module remains deferred; that distinction is explicit in status output.

## Acceptance

- Dry-run creates no runtime, scheduler, status, or project changes. It reports
  enrolled projects as `unchecked`, not `deferred`, because project Git gates
  and convergence are intentionally not executed.
- Agent installation is idempotent and stores its device policy outside Git.
- Exact remote release verification rejects lightweight, rewritten, stale,
  mutable-revision, wrong-repository, or non-descendant candidates.
- Project accounting satisfies
  `discovered = applied + current + deferred` on every completed run.
- Discovery evidence identifies the direct-child scope and reports every
  exclusion; nested independent worktrees require their own enrolled workspace.
- Repeated current-version runs continue convergence and become no-ops after all
  eligible repositories are current.
- Final evidence includes release identity, scheduler health, workspace/project
  counts, per-project reasons, relevant self-tests, and a clean release audit.

Last updated: 2026-07-19
