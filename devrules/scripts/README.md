---
description: Reference for devrules control-plane scripts, commands, safety contracts, and self-tests.
ownership: shared
governs: agent
activation: conditional
enforcement: advisory
decision_owner: project
side_effects: none
---

# devrules Scripts

This directory contains automation for maintaining the authoritative shared
devrules template and its project instances. `AGENTS.md`, `CLAUDE.md`, Cursor
rules, and other Agent entry files are adapters: their managed blocks point to
`devrules/always-readme.md` and must not duplicate shared rule bodies.

## Main CLI

```bash
devrules --help
```

The CLI supports:

- one device-local runtime locator plus a stable `devrules` launcher, so the
  shared template can move without rewriting callers;
- workspace and batch repository scanning;
- readiness classification;
- safe `apply-ready` initialization;
- registry inspect/refresh for devices, concrete workspaces, projects, and skills;
- non-secret developer-service account/project registry initialization, validation, inspection, and catalog generation;
- skills listing and task-based recommendation;
- template-only sync for repositories that are already compliant;
- ownership/module-aware template sync plus an explicitly installed device
  updater that verifies immutable releases and retries safe project convergence;
- Git preflight, mainline-first publish readiness, exact-account GitHub verification, exact-commit handoff, workspace status, and sync-transaction recovery;
- multi-device registry handoff for separately cloned workspaces;
- repository audit with a mandatory read-only shared-template content preflight;
- Godot project detection, source-root discovery, and game-workflow readiness recommendations;
- host/user-selected Agent and model boundary validation, including detection
  of legacy per-document model metadata without selecting product request
  parameters;
- terminal popup / visible console process audit;
- memory compaction;
- evolution suggestion collection;
- provider-neutral i18n source-unit scanning, diffing, job planning, validation, and baseline approval.
- read-only, risk-derived production change readiness validation for design, preflight, and post-release stages.
- touched-file code-health ratchets and language-profile detection;
- managed global Codex and Cursor guidance/hook installation for autonomous routing.
- seed idle-resource maintenance with a three-device soft Simulator target,
  sustained macOS pressure sampling, exact-owner fail-closed checks, one-device
  reclaim passes, device-local exact-UDID task leases/manual reservations, and
  apply-time revalidation, plus DerivedData,
  CoreSimulator caches, SwiftPM `.build`, Rust `target/`, and Gradle `build/`
  cleanup, with read-only SessionStart status checks and an optional,
  explicitly installed device scheduler.

## Safety Contract

- Writes default to dry-run.
- Mutation requires `--apply`.
- Entry files and README files are changed through managed blocks where possible.
- devrules owns shared rule and workflow bodies. Official Agent entry files own
  only their native tool/repository guidance plus a one-way pointer into
  devrules; devrules never routes back through or copies itself into them.
- Project-specific learning stays in the target repository instance.
- Shared template changes happen only during explicit template-maintenance work.
- Governance metadata separates ownership from applicability. Use
  `ownership: shared | seed | local`; use `activation`, `governs`,
  `enforcement`, `decision_owner`, and `side_effects` for routing and safety.
  Shared ownership never means always-on applicability.
- The active Agent, model, and reasoning controls are inherited from the user
  and host surface. devrules does not define a default/preferred model or
  product API fields such as reasoning mode or effort. Provider request
  parameters belong to project architecture only after that project selects a
  provider.
- GitHub Actions defaults to `automation.githubActionsPolicy=inherit`: preserve
  existing committed workflows, but require explicit approval before the Agent
  creates or materially changes hosted CI. `allow` records an approved lane;
  `deny` rejects workflows. Legacy `allowGitHubActions=true` is read only as a
  compatibility signal for `allow`.
- Shared-template `audit --strict` is a local content/schema gate. It reads the
  working tree and does not require a clean tree, commit, upstream, tag, or
  network. `template release-audit` is the separate explicit release gate; it
  fetches origin and verifies committed bytes, aligned release versions,
  upstream publication, and the exact annotated remote tag.
- The template root is an independent Git repository. `template.json` provides
  a monotonic identity/version/revision and declares the expected repository
  identity; apply additionally requires a clean commit, a real configured Git
  remote and a match with that declaration. Canonical publication requires
  current commit equality with the configured upstream; an installed immutable
  runtime may instead be detached at the exact annotated commit only when the
  remote tag object verifies exactly. A declaration or unpushed commit is not
  remote authority.
- Shared-template control-plane paths come from the one device-local locator
  documented in `runtime-location.md`. Product repositories keep using
  repository-relative `devrules/...` paths; tracked template configuration must
  not contain one device's absolute template or workspace path.
- Stable releases use the tuple `SemVer + monotonic revision + exact commit SHA`.
  `template.json`, the CLI `VERSION`, and the latest `CHANGELOG.md` release must
  agree; mismatches block template authority. An annotated `v<version>` tag binds
  the human release name to the verified commit.
- Authority compares the manifest declaration, repository-local origin, and
  effective fetch/push URLs as one identity. Ports and repository-path case are
  significant; split remotes and `insteadOf` redirects to another repository
  are rejected. Replace refs and legacy grafts are forbidden, and managed Git
  objects are read with replacement objects disabled.
- Use a private GitHub repository by default because the versioned registry contains device names, project names, and device-local absolute workspace paths. A public remote is acceptable only after excluding or sanitizing the registry and reviewing the complete staged tree.
- Tracked template payload bytes and release identity come from the exact Git
  commit tree. Untracked, non-ignored paths remain visible for review, but
  uncommitted managed payloads and unsafe index flags block authority apply.
  Ignored machine metadata cannot change the manifest hash or propagate into a
  project; the non-Git fallback also excludes AppleDouble, `.DS_Store`, and
  `Thumbs.db`. Configured managed directories must remain Git trees and managed
  root files must remain regular blobs. Initial repository setup reuses this
  same collector.
- `repo sync-template`, `batch sync-template`, and `workspace sync-template`
  use the same versioned, baseline-protected transaction. Schema 4 of
  `devrules/.template-sync.json` binds file and module source hashes to released
  commit/revision provenance and records shared/seed/local source ownership
  separately from template/project instance ownership. Downgrades, mutable
  revisions, forged state, and silent remote-authority changes are blocked.
- A project can set `templateSync.moduleSelection` to `explicit` in its
  project-owned `devrules/config.json` and list `templateSync.modules` to
  narrow automatic synchronization. `manifest` remains the backward-compatible
  default. Dependencies and configuration/scripts atomic peers are included
  automatically; out-of-scope modules are preserved, never deleted.
- A local conflict defers its module, dependents, and atomic peers while
  independent modules may apply and report a partial result. Global authority,
  unsafe-state, topology, or revalidation failures block every write. Before
  apply, source and target hashes are revalidated. Writes are atomic, failures roll back
  automatically, and recovery journals live under the target Git directory.
  Recovery rejects mismatched repositories, unsafe or duplicate paths,
  symlinked storage, non-regular backups, and backup-hash mismatches before
  restoring any entry. Journal schema 2 records before/after fingerprints for
  every target; content outside those transaction states—including later human
  edits—blocks the complete recovery. Managed target leaves that are symbolic
  links or other non-regular objects also conflict before sync writes.
- Apply/recovery locks are owner-token and inode bound. They are never stolen
  solely because of age, and an old holder cannot unlink a replacement lock.
  Stale locks require deliberate operator inspection/removal. Target and state
  fingerprints are rechecked during backup and immediately before mutation.
- `workspace sync-template --registered` runs the same baseline-protected sync
  across the current device's active registered workspaces bound to this shared
  template. The binding is explicit, so an external-volume workspace does not
  need its own `devrules` clone or filesystem symlink.
- Registry output records both `deviceId` and concrete workspace path (`workspaceId`, `workspacePath`, and `workspaces[]`) so one device can safely use more than one synced workspace.
- Git versions only device-owned records under `registry/device-records/` and workspace-owned records under `registry/workspace-records/`. Refresh writes exactly the current device/workspace shards; `registry inspect` merges active shards in memory. Shared generated aggregate JSON files are ignored because they would recreate a cross-device Git conflict surface.
- Stored paths in generated project config, manifest, and reports should be repository-relative and use forward slashes. Registry paths may be absolute because they identify device-local workspace locations.
- Locator-selected workspace parents should not receive generated Agent entry
  files; entry-file creation belongs to project repositories selected for
  initialization.

## Common Commands

These commands assume the stable launcher is installed. For first-time
bootstrap only, invoke the following command; after that, use `devrules` so
callers remain independent of the current template path and can repair a stale
locator:

```bash
node <absolute-candidate-template>/scripts/devrules.mjs location install-launcher --apply
```

```bash
devrules location show --json
devrules location audit --json
devrules location configure --template-root <template> --workspace-root <workspace>
devrules location configure --template-root <template> --workspace-root <workspace> --apply
devrules location install-launcher --apply
devrules workspace readiness
devrules template status --fetch
devrules template release-audit
devrules template auto-update status --json
devrules template auto-update agent-status --json
devrules template auto-update run --dry-run --json
devrules template auto-update run --apply --reconcile-ownership
devrules template auto-update ensure-agent --apply --reconcile-ownership
devrules repo preflight --repo <repo> --fetch
devrules repo publish-readiness --repo <repo> --fetch --verify-host
devrules repo handoff --repo <repo> --fetch
devrules repo sync-template --repo <repo>
devrules repo sync-template --repo <repo> --apply
devrules repo refresh-entries --repo <repo>
devrules repo refresh-entries --repo <repo> --apply
devrules repo recover-sync --repo <repo> --transaction <id>
devrules repo recover-sync --repo <repo> --transaction <id> --apply
devrules workspace git-status --root <workspace>
devrules workspace apply-ready
devrules workspace apply-ready --apply
devrules registry inspect --root <workspace> --json
devrules registry refresh --root <workspace>
devrules registry refresh --root <workspace> --apply
devrules registry retire --type device|workspace --id <id>
devrules registry retire --type device|workspace --id <id> --apply
devrules services init --project <project>
devrules services init --project <project> --apply
devrules services validate --root <workspace> --strict
devrules services inspect --root <workspace> --project <project-id>
devrules services catalog --root <workspace>
devrules services catalog --root <workspace> --apply
devrules skills list --json
devrules skills recommend --query "<task>" --json
devrules batch sync-template --root <workspace>
devrules batch sync-template --root <workspace> --apply
devrules batch sync-template --root <workspace> --adopt-current-baseline --apply
devrules batch sync-template --root <workspace> --reconcile-ownership --apply
devrules workspace sync-template --registered
devrules workspace sync-template --registered --apply
devrules audit --repo <repo>
devrules audit --repo <repo> --strict
node devrules/scripts/code-health.mjs audit --repo <repo>
node devrules/scripts/code-health.mjs audit --repo <repo> --all --strict
node devrules/scripts/global-devrules.mjs install
node devrules/scripts/global-devrules.mjs install --apply
node devrules/scripts/global-devrules.mjs audit
node devrules/scripts/codex-browser-network.mjs status --json
node devrules/scripts/codex-browser-network.mjs ensure --apply --json
node devrules/scripts/codex-browser-network-selftest.mjs
node devrules/scripts/code-health-selftest.mjs
node devrules/scripts/model-game-selftest.mjs
node devrules/scripts/skills-terminal-selftest.mjs
node devrules/scripts/prompt-governance-selftest.mjs
node devrules/scripts/governance-v3-migrate.mjs --root devrules --json
node devrules/scripts/governance-v3-selftest.mjs
node devrules/scripts/github-actions-policy-selftest.mjs
node devrules/scripts/developer-services-registry-selftest.mjs
node devrules/scripts/idle-resource-maintenance-selftest.mjs
node devrules/scripts/device-maintenance-bootstrap-selftest.mjs
node devrules/scripts/task-delta-selftest.mjs
node devrules/scripts/verification-plan-selftest.mjs
node devrules/scripts/xcode-verification-plan-selftest.mjs
node devrules/scripts/ios-simulator-profile.mjs --profile devrules/memory/ios-simulator-device-profile.json
node devrules/scripts/ios-simulator-profile-selftest.mjs
node devrules/scripts/design-selftest.mjs
node devrules/scripts/design-hooks-selftest.mjs
node devrules/scripts/landing-page-selftest.mjs
node devrules/scripts/production-readiness-selftest.mjs
devrules workspace terminal-audit
devrules terminal-audit --repo <repo>
devrules memory compact --repo <repo> --apply
devrules evolution collect --root <workspace> --apply
node devrules/scripts/production-readiness.mjs --plan <plan.json> --stage design
node devrules/scripts/production-readiness.mjs --plan <plan.json> --stage preflight
node devrules/scripts/production-readiness.mjs --plan <plan.json> --stage post-release
```

`ios-simulator-profile.mjs` is read-only and fail-closed. It validates the
project-owned one-persistent-device/two-App contract: distinct manual and
automation bundle IDs on the same device, a complete runner/extension
allowlist, app-container-only single-worker automation, and explicit disposable
device reasons for clean/destructive state, identity-sensitive cases, and
parallel UI workers. Seed the project file from
`templates/quality/ios-simulator-device-profile.template.json`; replace every
example identity before using the profile as mutation authority.

`audit --strict` preserves normal audit output but exits non-zero when an
error-severity finding exists. For the shared template it validates the current
working-tree content and schema only, so normal development may be dirty,
untagged, offline, or not yet published. It intentionally reports release state
as unchecked. Run `template release-audit` explicitly after the release commit
and annotated tag have been pushed; that command is the clean/version/upstream/
remote-tag publication gate. Ordinary legacy project audits remain advisory
unless strict mode is requested.

Repository audit compares template-managed project content and sync-state
provenance with the current shared template before checking adoption. It reports
`current`, `update-available`, `conflict`, or `blocked`; the comparison is
read-only, preserves project-owned files, and uses the same planner as
`repo sync-template` so audit and apply cannot drift into different meanings.

Godot repositories are identified by a root `project.godot`. Source discovery recognizes `.gd` and `.gdshader` files and conditionally considers conventional `scenes/`, `scripts/`, `autoload/`, `addons/`, and `resources/` roots. Scene and resource files (`.tscn`, `.tres`, and `.res`) count as anchor-relevant context. The generated `.godot/` cache remains excluded. Audits validate unique hook IDs and safely parseable local hook references; Godot repositories that have not yet adopted the game-development seed receive a recommendation without affecting non-game repositories.

For separately cloned devices, optionally set a stable ID before refresh. Each physical device must use a different ID because the ID determines ownership of its Git-authoritative shard:

```bash
$env:DEVRULES_DEVICE_ID = "jax"
devrules registry refresh --root <workspace> --apply
```

Run registry commands once per concrete workspace path that should be tracked on a device. For example, `/Volumes/.../GithubDev` and `/Users/.../GithubDev` are distinct workspaces even when they use clones of the same shared `devrules` repository.

For template changes, prefer:

```bash
devrules audit --repo <template-root> --strict
devrules template release-audit
devrules registry refresh --root <workspace> --apply
devrules workspace sync-template --registered
devrules workspace sync-template --registered --apply
```

The first command is safe during local editing. Run the release audit only
after the version/revision/changelog, release commit, annotated tag, upstream,
and remote tag are aligned. Project apply remains blocked until that released
authority exists.

Run `registry refresh --root <workspace> --apply` once for each workspace parent
that should participate. After that, `workspace sync-template --registered`
finds this device's active workspaces through their explicit template binding;
it does not require `<workspace>/devrules` to exist. The dry-run reports source
authority, revision, transaction plan, copies, deletions, writes, and conflicts
before mutation. Do not apply from session hooks.

For one explicitly selected, already adopted repository, use `repo sync-template --repo <repo>`. It invokes the transactional template-sync planner/apply path, then refreshes configured root entry bindings and the Cursor routing card when the orchestration module is safe. It does not scan sibling repositories, detect source roots, or generate README anchors. Use `repo refresh-entries --repo <repo>` to repair entry bindings and the routing card without syncing template files.

Use `--adopt-current-baseline` only when every current file must be preserved as
project-owned. Use `--reconcile-ownership` for an explicit migration from an
untrusted legacy `.template-sync.json` when classified `shared` content should
follow the current verified release while `seed`, `local`, AppleDouble, and
retired extra bytes remain project-owned. Both rebuild schema 4 provenance;
ordinary sync fails closed instead of guessing.

For autonomous released-template convergence, first review
`workflows/template-auto-update.md` and run the dry-run. The independent device
scheduler is never installed by SessionStart. Once explicitly installed, it
verifies newer exact annotated releases, switches the device runtime, and
initializes or syncs only repositories that pass two fetch-backed clean/equal
Git gates with concrete matching local/upstream SHAs. Discovery is limited to
direct-child independent worktrees and reports every backup, migration,
control, nested, duplicate, template, or escaping-symlink exclusion. Dry-run
reports discovered projects as `unchecked`; apply accounts each as applied,
current, or deferred. An exact updater-owned dirty receipt may resume an
interrupted/partial run, while any unreceipted change fails closed. Every
deferred repository is retried on later runs, including when the runtime release
is already current. It never commits or pushes product changes, and it never
opts into the separate idle-resource scheduler. A verified abandoned updater
lock may be recovered only after dead-PID plus token/inode validation; all
ambiguous lock ownership remains locked. Existing updater and maintenance
scheduler files refresh from the activated release without granting new opt-in.

## Synchronization Self-Test

```bash
node devrules/scripts/devrules-sync-selftest.mjs
node devrules/scripts/registry-runtime-selftest.mjs
node devrules/scripts/template-authority-selftest.mjs
node devrules/scripts/template-sync-ownership-selftest.mjs
node devrules/scripts/template-sync-selective-selftest.mjs
node devrules/scripts/template-auto-update-selftest.mjs
node devrules/scripts/template-auto-update-agent-selftest.mjs
node devrules/scripts/template-auto-update-lock-selftest.mjs
node devrules/scripts/runtime-location-selftest.mjs
node devrules/scripts/global-devrules-selftest.mjs
node devrules/scripts/cursor-routing-selftest.mjs
node devrules/scripts/cursor-entry-selftest.mjs
```

The synchronization self-test covers ignored filesystem metadata, initial-init
filtering, repository-scoped dry-run/apply/no-op behavior, project identity and
local-hook preservation, conflict zero-write guarantees, monotonic source
identity, deletion safety, rollback, and Git handoff states. The registry
runtime self-test covers multi-device sharding, explicit template bindings,
same-device multi-workspace retention, offline-root reporting, aggregate views,
malformed-record zero-write blocking, idempotence, and retirement. Both use
temporary Git repositories and local bare remotes only.

The template-authority self-test covers committed-blob binding,
`assume-unchanged` identity spoofing, uncommitted managed payload rejection,
blocked initial-sync zero-write behavior, non-bypassable remote authority,
fetch-backed freshness, canonical and forged-state rejection, remote-authority
migration and identity-boundary blocking, managed-root and target-leaf shape
checks, recovery-journal path containment, and later-human-edit preservation.

Agent/model-selection boundaries, legacy metadata detection, hook-registry
validation, and Godot/game-development routing have a focused companion
regression suite:

```bash
node devrules/scripts/model-game-selftest.mjs
node devrules/scripts/prompt-governance-selftest.mjs
node devrules/scripts/skills-terminal-selftest.mjs
```

The skills/terminal self-test locks skills list/recommend JSON shapes, ranking
invariants, and terminal-audit finding schemas in temporary fixtures.

The prompt-governance self-test keeps Agent entry adapters pointed one way into
the authoritative devrules body, protects the model-neutral Lean Prompt and
capability-routing contracts, and rejects shared defaults for a model name,
reasoning strength, or provider request field. Product-specific model routing
remains a project-owned architecture decision.

These self-tests work only in temporary Git repositories. Together they verify exact-SHA
preflight and handoff, ahead/behind/diverged states, template authority and
published-upstream enforcement, legacy-state adoption, persistent project-file
ownership, idempotence, mutable-revision and downgrade blocking,
repository-wide zero-write conflicts, safe and conflicting deletions,
injected-failure rollback, manual transaction recovery, shared/local hook
separation, registry lock exclusion, multi-device registry sharding with disjoint write paths,
same-device multi-workspace retention, runtime aggregation, malformed-record
zero-write blocking, and tombstone-based
device/workspace retirement. It creates local bare remotes and does not contact
GitHub.

Run syntax checks and all focused self-test suites locally before commit and
push. Before final publication, `repo publish-readiness --fetch --verify-host`
must also review `.gitignore`, untracked paths, likely build/secret artifacts,
local and remote branch disposition, default-branch divergence, and the
centrally configured GitHub account/repository binding. Then run
`template release-audit` after the release commit and annotated tag are present
on the verified remote. Under `githubActionsPolicy=inherit`, existing committed
workflows are preserved; adding or materially changing hosted CI still requires
the user's explicit approval, while `deny` blocks it. The complete acceptance
criteria are recorded in `workflows/git-multi-device-sync.md`.

## Code Health And Global Codex Scripts

`code-health.mjs` is read-only. By default it inspects changed and untracked
handwritten source files, reports final-newline/trailing-whitespace issues,
warns on review-budget pressure, and fails when a changed file above the
no-growth budget grows further. `--all` inventories all source files and
`--strict` promotes warnings to failure. Project tuning lives under
`devrules/config.json:codeHealth`; generated/vendor paths and justified cohesive
large files may be excluded explicitly.

`global-devrules.mjs` installs and exactly audits the runtime trigger layer for both Agent surfaces.
Default `--surface all` covers Codex (`$CODEX_HOME` managed `AGENTS.md` block plus
`SessionStart`/`UserPromptSubmit` hooks) and Cursor (`~/.cursor/hooks.json` plus
`devrules-cursor-hook.mjs` for `sessionStart`/`postToolUse`/`beforeSubmitPrompt`/
`stop`). Use `--surface codex` or `--surface cursor` to scope one side. Install
is a dry-run by default and requires `--apply`; unrelated guidance and hook
entries remain untouched. Invalid existing JSON fails closed instead of being
overwritten. The managed Agent entry block is only a pointer into devrules; it
does not contain a second copy of shared rules. `audit` verifies managed assets
plus exact event command, matcher, timeout, cardinality, and version metadata
without writing.

`code-health-selftest.mjs` verifies code-health behavior in temporary Git
repositories. `global-devrules-selftest.mjs` separately covers dry-run safety,
content preservation, exact Codex/Cursor installation and audit, drift repair,
invalid-JSON fail-closed behavior, and idempotence. `cursor-routing-selftest.mjs`
and `cursor-entry-selftest.mjs` cover local same-ID override, Windows/runtime
profile lookup, multi-repo routing, generated-card preservation, refresh, and
entry audit behavior. Every suite removes its temporary fixtures.

`routing-card.mjs` generates a compact routing card from `hooks.json` (plus
`hooks.local.json` when present) into the repository's
`.cursor/rules/devrules.mdc` as a managed `DEVRULES:ROUTING-START/END` block,
so Cursor's always-applied entry rule carries only hook-id-to-target routes;
matcher prose stays out of default context. It is
dry-run by default, requires `--apply` to write, accepts `--repo <dir>` or
`--root <dir>` for batch generation, and writes only that managed block.
Regenerate the card after hook changes; successful template sync does this
automatically.

`idle-resource-maintenance.mjs` is the seed reclaim tool for Simulator
boot/process and memory pressure plus aged build caches. Codex/Cursor
SessionStart runs `devrules idle agent-status --json`, which is read-only and
never installs, repairs, or registers a scheduler by default. Install or repair
explicitly with `devrules idle ensure-agent --apply`; device-local operators may
opt into the same repair path at SessionStart with
`DEVRULES_IDLE_SCHEDULER_AUTO_REPAIR=1`. An installed scheduler uses a macOS
LaunchAgent or hidden Windows Task Scheduler job (weekday `pressure`, Sunday
full `apply`). Without one, project Agents run
`devrules idle status|pressure|plan|apply` themselves. Parameters come from
`config.json` → `idleResourceMaintenance` and remain configurable device/project
policy rather than global product defaults. Exact-UDID ownership uses
`lease-status`, `lease-claim`, `lease-heartbeat`, `lease-reserve-manual`, and
`lease-release`; mutation requires `--apply` and writes only the lock-protected,
atomic device-local registry under `~/.config/devrules/`. Safe by default: no named-device
erase, no arbitrary process kill, no cargo registry or `node_modules` wipe,
and no privileged memory purge. Use `uninstall-agent --apply` to remove the
device schedule and generated wrapper.
Full plans inspect Cargo/Rust, Xcode/Swift, and Gradle process activity before
walking their artifact trees; an active lane or unavailable process inventory
defers matching deletes, and apply re-checks the gate before removal.

`routing-performance-selftest.mjs` protects the compact-context budget and
verifies that the Codex hook returns matched workflows without injecting the
full code-rule stack on every coding prompt.

`codex-browser-network.mjs` audits or repairs the Codex Desktop `node_repl`
launch boundary. It installs a user LaunchAgent plus a scoped wrapper, disables
optional browser-client ambient networking, and reads an unauthenticated
loopback HTTP(S) endpoint from macOS `scutil --proxy` at each helper launch.
Generic proxy variables are not added to the user's global launch environment.
Writes require `ensure --apply`; a stale Desktop reports `restart-required`.
`status` exits with code 2 for configuration drift or a stale runtime.
`codex-browser-network-selftest.mjs` covers proxy parsing, wrapper/LaunchAgent
generation, legacy generated-config cleanup, and preservation of unrelated
configuration.

`verification-plan.mjs` classifies the current Git delta as `low`, `focused`,
or `broad` and prints the minimum evidence categories for that tier. It plans
checks but never treats a path heuristic as proof that a command passed.

`task-delta.mjs` stores a task's starting SHA under the repository Git directory
(not the worktree), then keeps verification and code-health scoped to
`baseline..HEAD` plus current edits even after intermediate phase commits.
`start` and `clear` follow the dry-run default and write only with `--apply`.

`xcode-verification-plan.mjs` turns an explicit project/workspace, scheme,
Simulator UDID, DerivedData path, tier, and test filters into one
`build-for-testing` command followed by reusable `test-without-building` lanes.
It is plan-only and never takes Simulator foreground ownership.
`devrules-lib/hooks.mjs` keeps hook-registry derivation and legacy metadata
normalization out of the main CLI. `devrules/hooks/hooks.json` is the single
portable hook catalog; initialization filters and extends that catalog for the
detected stack instead of maintaining a second embedded copy.

`devrules-lib/runtime-location.mjs` owns the device-local locator, validation,
configuration, and launcher installation. `devrules-lib/runtime-launcher-source.mjs`
owns the self-contained stable launcher, including recovery after the prior
template path becomes unavailable. `devrules-lib/workspace-runtime.mjs` owns
workspace path identity, explicit template-binding comparison, and offline-root
status so the main CLI does not duplicate or grow those contracts.

Read scope:

- Git metadata and candidate source files in the requested repository;
- project-local `devrules/config.json`;
- `$CODEX_HOME/AGENTS.md`, Codex/Cursor `hooks.json`, managed hook assets, and
  the device runtime locator profile.

Write scope:

- `code-health.mjs`: none;
- `global-devrules.mjs --apply`: only its marked Codex `AGENTS.md` block,
  managed Codex/Cursor hook command entries, the named Codex/Cursor hook
  assets, their routing core, and `device-maintenance-bootstrap-core.mjs`;
- `idle-resource-maintenance.mjs install-agent --apply` / `ensure-agent
  --apply`: the per-user macOS
  LaunchAgent or Windows Task Scheduler entry plus its generated wrapper and
  logs under `~/.config/devrules`; `apply --apply` removes only planned aged
  build/cache paths after a process-activity re-check and safely unowned
  Simulator resources;
- all `*-selftest.mjs` suites: temporary directories only.

## i18n Maintenance Script

`i18n-maintenance.mjs` is a zero-dependency, provider-neutral helper for multilingual adaptation. It reads source files, locale resources, and optional `devrules/config.json:i18n` settings, then writes only i18n report artifacts when `--apply` is passed.

Read scope:

- configured source roots/globs for user-facing copy;
- configured locale resources such as `.xcstrings`, `.strings`, JSON locale files, ARB files, and Android `strings.xml`;
- previous generated and approved inventories under the configured report directory.

Write scope with `--apply`:

- `devrules/reports/i18n/source-units.json`;
- `devrules/reports/i18n/content-diff.json`;
- `devrules/reports/i18n/translation-jobs.json`;
- `devrules/reports/i18n/validation-report.json`;
- `devrules/reports/i18n/source-units.approved.json`.

Common loop:

```bash
node devrules/scripts/i18n-maintenance.mjs scan --repo <repo>
node devrules/scripts/i18n-maintenance.mjs scan --repo <repo> --apply
node devrules/scripts/i18n-maintenance.mjs diff --repo <repo>
node devrules/scripts/i18n-maintenance.mjs plan --repo <repo> --apply
node devrules/scripts/i18n-maintenance.mjs validate --repo <repo>
node devrules/scripts/i18n-maintenance.mjs approve --repo <repo> --apply
node devrules/scripts/i18n-maintenance-selftest.mjs
```

The script never calls translation providers and never rewrites product source or locale files. `plan` creates reviewable translation jobs; a project-local translator script may consume those jobs only when the project has explicitly designed provider credentials, batching, review, and apply behavior.

## Production Readiness Validator

`production-readiness.mjs` validates a project-owned JSON record created from `templates/ops/production-change-plan.template.json`. It is zero-dependency, cross-platform, and strictly read-only.

Read scope:

- the exact JSON file passed with `--plan`.

Write scope:

- none; there is no `--apply` mode.

The three stages are cumulative:

- `design`: architecture, impact-derived risk, compatibility, migration, rollout, rollback/recovery, observability, and planned verification;
- `preflight`: passed checks, upgrade paths, restore/recovery evidence, production-scale evidence, release status, and risk-based approvals;
- `post-release`: preflight plus monitoring completion, migration reconciliation, and cleanup ownership.

Human output is concise by default; `--json` provides stable machine-readable findings. Exit code `0` passes, `1` means readiness findings, and `2` means CLI/file/JSON error.

Verification:

```bash
node devrules/scripts/production-readiness-selftest.mjs
```

The self-test covers passing all stages, risk understatement, missing compatibility, unsafe native/browser-local migration atomicity, missing rollout stop criteria, incomplete restore/check evidence, critical approvals, premature closure, starter-template placeholders, CLI JSON output, and template/Hook integration. It writes only to an OS temporary directory and removes its fixture.

## Design System Scripts

Independent from `devrules.mjs`: zero-dependency Node tools for the UI design subsystem (entry: `devrules/design-readme.md`). They read `design.config.json` (not the devrules OS `config.json`).

```bash
node devrules/scripts/design-sync.mjs             # DESIGN.md -> design-tokens.css / tailwind.design.json / design-tokens.json + stamp
node devrules/scripts/design-sync.mjs --check     # verify DESIGN.md and generated artifacts are in sync (pre-commit/CI gate)
node devrules/scripts/design-lint.mjs             # local DESIGN.md quality checks; --online explicitly selects the external CLI
node devrules/scripts/design-guard.mjs            # scan source for hardcoded UI values and placeholder/AI-flavored copy
node devrules/scripts/design-guard.mjs --inventory  # aggregate legacy hardcoded values for audits
node devrules/scripts/design-inventory.mjs --root . --json  # read-only screen/component/style debt inventory
node devrules/scripts/design-inventory.mjs --root . --out docs/ui-refactor --apply  # write inventory reports
node devrules/scripts/design-refactor-state.mjs --state docs/ui-refactor/design-refactor-state.json  # validate phase state
node devrules/scripts/design-style-library.mjs extract --source ../app --id proposed-style --json  # read-only evidence preview
node devrules/scripts/design-style-library.mjs list  # discover named shared styles
node devrules/scripts/design-style-library.mjs apply --style <id> --repo ../target  # conflict-safe dry-run
node devrules/scripts/design-selftest.mjs         # template-maintenance self-test over .selftest fixture
node devrules/scripts/design-hooks-selftest.mjs   # git hook install + pre-commit design gate self-test
node devrules/scripts/landing-page-selftest.mjs   # landing-page workflow and routing contract self-test
```

Declared deviation from the dry-run default: `design-sync.mjs` writes its outputs directly because they are declared generated artifacts — stamped, hash-verified by `--check`, and never hand-edited. Shared modules live in `scripts/design-lib/` (config / frontmatter / colors / report).

`design-inventory.mjs` and `design-refactor-state.mjs` are conservative automation for UI refactor planning. They do not rewrite product source. `design-inventory.mjs` writes reports only with `--out ... --apply`; otherwise it prints a summary or JSON. `design-refactor-state.mjs` validates a state JSON file and can optionally verify artifact paths with `--check-files`.

`design-style-library.mjs` implements the shared named-style lifecycle. `extract`
scans UI evidence and writes only to an explicit review workspace with `--apply`;
source repositories stay read-only. `publish` and `apply` also default to dry-run,
refuse overwrite conflicts, and require `--apply` for writes. The style package
contract and command examples are in `devrules/design-styles/README.md`.

`design-selftest.mjs` is read-only for the template tree. It runs from
`devrules/.selftest` so the fixture's `design.config.json` is resolved the same
way a real project resolves its root config, asserts that sync/lint pass and
guard catches intended violations while honoring allowlist and inline
suppressions, verifies the shared conditional product-architecture contract
and its risk-tiered design/technical routing, verifies style
extraction/publication/application safety in temporary directories, then
creates a temporary Git repo to verify
`devrules.mjs init` and `batch sync-template` propagate product architecture,
design roots, release identity, and the named-style library. The propagation
check expects `git` to be available on `PATH`.

`landing-page-selftest.mjs` is read-only and deterministic. It verifies the
shared conditional rule/workflow/brief/template set, explicit template
selection, Claim Ledger statuses, conditional SaaS modules, dedicated hook and
indexes, one-way routing into design/SEO workflows, and aligned
manifest/CLI/changelog release metadata. Subjective copy
quality and browser conversion behavior remain project-level verification.

## Adding Scripts

Before adding a script, read:

- `devrules/rules/script-governance.md`
- `devrules/workflows/devrules-script-automation.md`
- `devrules/templates/devrules/script-automation.md`
