# Changelog

This file records stable shared-template releases. The complete immutable release
identity is the SemVer version, monotonically increasing template revision,
annotated Git tag, and exact commit SHA. Git history remains authoritative.
Entries below the newest release describe historical behavior only. When an
older entry conflicts with a newer release, the newer contract is authoritative
and the older text must not be used as active Agent or automation policy.

## [4.0.7] - 2026-07-19

- Template revision: `43`.
- Kept the Simulator soft target at three and made user reporting explicit:
  report once in the observing task rather than injecting status into another
  task.
- Required explicit user instruction before any cross-task resource
  notification, limited one notification to each pressure episode and exact
  UDID, and prohibited automatic acknowledgment, progress, completion, and
  resource-restored message chains.
- Made every received resource notification advisory; device shutdown, build
  termination, and artifact cleanup require direct confirmation in the
  receiving task.
- Replaced generated MCP-table proxy edits with a Desktop launch-environment
  adapter and a scoped `node_repl` wrapper that reads the current loopback
  system proxy at helper launch. The repair no longer relies on configuration
  bytes that Desktop rewrites.

## [4.0.6] - 2026-07-19

- Template revision: `42`.
- Completed external-volume convergence by removing the exact untracked
  AppleDouble sidecar for a Git worktree entry during verified preflight and
  after updater mutations. Tracked paths remain project-owned, and unverified
  worktrees remain fail-closed.
- Cleared AppleDouble artifacts from verified devrules transaction metadata
  before receipt capture so one scheduled round can initialize and sign the
  project without depending on a later cleanup pass.

## [4.0.5] - 2026-07-19

- Template revision: `41`.
- Made autonomous convergence safe on external macOS volumes that synthesize
  AppleDouble sidecars or expose a fixed effective file mode. Cleanup is
  restricted to exact AppleDouble files in Git-verified metadata directories
  and action-owned untracked paths; mode normalization is accepted only after a
  same-repository capability probe proves the filesystem behavior.
- Preserved fail-closed receipt validation for tracked files, symlinks,
  unexpected content, unowned paths, uncertain modes, and concurrent changes.

## [4.0.4] - 2026-07-19

- Template revision: `40`.
- Kept the device runtime configuration as the authoritative source when the
  stable launcher selects a configured release. Scheduled auto-update can now
  atomically switch `runtime.json`; caller-provided template environment
  overrides remain explicit and intentionally non-switchable.

## [4.0.3] - 2026-07-19

- Template revision: `39`.
- Made downloaded runtimes contain the complete reachable Git object database
  and verify that closure before candidate selection. Cross-version project
  convergence no longer depends on bounded lazy blob fetches from a partial
  clone, while replace refs and legacy graft overlays remain disabled.
- Declared shared ownership for the two managed root design documents so clean
  repositories can complete first-time autonomous template initialization.

## [4.0.2] - 2026-07-19

- Template revision: `38`.
- Added a bounded, non-interactive GitHub REST readback when the primary Git
  release-tag query fails. The fallback still requires the exact remote
  annotated-tag object and peeled commit, is restricted to `github.com`, and
  never persists or reports credentials.
- Extended abandoned-lock recovery to per-project template synchronization.
  Recovery still requires a valid owner record, a provably absent process, and
  unchanged token and inode ownership; live, malformed, or unknown locks remain
  fail-closed.

## [4.0.1] - 2026-07-19

- Template revision: `37`.
- Excluded independent clones that declare the shared template identity from
  project convergence, preventing a template source checkout inside an enrolled
  workspace from being initialized as a product repository.
- Extended fixed-release checkout to the configured download timeout so valid
  private or partial-clone candidates are not rejected by the shorter generic
  Git timeout.
- Reported newer candidates that fail verification as `failed` with an explicit
  retry reason instead of incorrectly classifying the runtime as up to date.

## [4.0.0] - 2026-07-19

- Template revision: `36`.
- Added an explicitly opted-in device scheduler that discovers, verifies, and
  installs exact newer annotated releases into immutable versioned runtimes,
  switches the runtime atomically, refreshes already-installed device surfaces
  from the candidate release, and rolls activation back on failure.
- Added autonomous convergence for every enrolled direct-child independent Git
  worktree. Two fetch-backed checks require concrete local/upstream SHA equality;
  unavailable or unsafe projects are deferred and retried without commit, push,
  stash, reset, merge, rebase, or cross-project interruption.
- Added device-local 0600 updater receipts, exact status/content/type/mode
  fingerprints, partial-run repair, bounded rounds, and persistent round-robin
  scheduling so updater-owned dirty work can resume without authorizing human
  or concurrent edits and tail projects cannot starve.
- Added deterministic selective synchronization by file ownership and
  `sync_module`, project manifest or explicit scope, dependency closure, and
  atomic module groups. Invalid scope and conflicts fail closed while unrelated
  safe modules remain independently transactional.
- Hardened abandoned-lock recovery, macOS and Windows scheduler health checks,
  scheduler uninstall verification, detached-runtime authority, and project
  entry paths against traversal, control-data writes, symlink topology, and
  unverified post-mutation bytes, with end-to-end regression coverage.

## [3.3.0] - 2026-07-19

- Template revision: `35`.
- Replaced the hard single-Simulator ceiling with a three-device soft target.
  Device count alone is report-only; cleanup requires sustained macOS memory
  pressure or an explicit lag signal, revalidated immediately before action.
- Added a device-local, lock-protected Simulator lease registry with explicit
  claim, heartbeat, manual reservation, release, and status commands. Cleanup
  now prefers only proven-inactive leases; unknown ownership fails closed. If
  pressure persists with only active devices, the oldest active lease may
  receive a release request, but its task is never stopped or interrupted.
- Added a validated project profile for one persistent Simulator containing a
  state-preserving manual-acceptance App and a distinct automation App. Normal
  automation stays on that device with one UI worker and app-container-only
  mutation; destructive, clean-state, identity-sensitive, and additional
  parallel workers use task-owned disposable devices.
- Added regression coverage for pressure sampling, apply-time revalidation,
  lease locking and renewal, fail-closed ownership, dual-App identity and
  allowlist validation, Apple project initialization, and hook routing.

## [3.2.0] - 2026-07-19

- Template revision: `34`.
- Added a hard pre-edit gate for GitHub-backed repositories: fetch first and
  require a clean attached branch at exact local/upstream equality before the
  first local write; unresolved dirty, ahead/behind, diverged, detached, or
  unverified state blocks editing without destructive cleanup.
- Made TestFlight build numbers and uploads individually authorized mutations.
  Added local release-artifact gates, configuration-policy reconciliation,
  one-failure root-cause stopping, Apple-state readback before number changes,
  and explicit planned/local/accepted/processed/distributed build accounting.
- Added the Codex browser network source repair introduced after `3.1.0`, with
  scoped loopback-proxy inheritance, ambient-network suppression, routing, and
  regression coverage.
- Reclassified entry line/byte budgets and similar heuristic size limits as
  advisory review signals; semantic completeness, readability, and coherent
  ownership must not be damaged to satisfy an arbitrary threshold.
- Kept GitHub publication identity verification fail-closed while allowing a
  read-only REST repository readback when the GitHub GraphQL endpoint is
  unavailable through the active network path.

## [3.1.0] - 2026-07-18

- Template revision: `33`.
- Archived superseded template decisions into `memory/decisions-archive.md`,
  sanitized private workspace paths from active memory, and completed
  governance frontmatter coverage for memory and design-styles surfaces.
- Slimmed the RevenueCat and Apple App Store launch workflows by moving
  reference material into conditional commerce/ops templates while preserving
  approval, dry-run, credential, and verification gates.
- Documented the v3 hook contract that runtime auto-injection selects only the
  single primary always target; conditional targets remain Agent-mediated
  catalog entries. Gave `game-development` an explicit primary and demoted the
  secondary iOS build debug route to conditional.
- Split shared control-plane helpers and large CLI clusters out of
  `scripts/devrules.mjs` into focused `devrules-lib` modules for filesystem
  actions, repository config/discovery, device registry, instance bootstrap,
  README anchors, legacy normalization, skills, and terminal audit. Added a
  deterministic skills/terminal regression selftest.

## [3.0.0] - 2026-07-17

- Template revision: `32`.
- Replaced implicit universal scope with governance metadata that separates
  ownership, activation, governed boundary, enforcement, decision owner, and
  side effects across Agent-readable rules, workflows, profiles, templates,
  and hooks.
- Removed the GPT-5.6 request-parameter overlay and made the host/user-selected
  Agent, model, and reasoning controls an explicit authority boundary; devrules
  no longer chooses product model/API parameters.
- Added profile-aware `minimal` / `standard` / `full` adoption. Manifests now
  record the selected profile, observed adoption level, and installed, enabled,
  and dormant modules separately. `AGENTS.md` remains the default project
  adapter; Cursor and other Agent entries are opt-in or bind-if-present.
- Converted hook routing to structured conditional targets and made
  SessionStart device maintenance read-only unless automatic repair is
  explicitly selected.
- Split local working-tree content/schema audit from release authority audit,
  and added an idempotent governance-v3 migration plus negative regression
  coverage for model, product, device, release, and external-service overreach.
- Changed product architecture, iOS identity/data, design, landing-page,
  developer-service, GitHub Actions, simulator, and platform guidance from
  template-owned defaults into project/user-owned decisions with risk-based
  activation and explicit `N/A` paths.
- Made design lint local-only by default; the package-on-demand official CLI now
  runs only after explicit `--online` selection.

## [2.13.0] - 2026-07-17

- Template revision: `31`.
- Made devrules the explicit shared-rule authority: project and global Agent
  entry adapters now point one way into devrules and no longer duplicate code
  health or bootstrap rule bodies.
- Added a model-neutral Lean Prompt, autonomy, output, and same-evaluation-set
  contract for AI routes.
- Added a capability-gated GPT-5.6 overlay for Pro mode, max reasoning,
  persisted reasoning, explicit caching, Programmatic Tool Calling, multi-agent
  beta, and original image detail without leaking those controls into generic
  prompts or fallback models.
- Superseded by `3.0.0`: the overlay and its request-parameter prescriptions are
  no longer part of active devrules policy.

## [2.12.1] - 2026-07-17

- Template revision: `30`.
- Closed the superseded `codex/devrules-performance` history into `main` while
  preserving the newer v2.11+ implementations already published from its
  replacement branch; no runtime or managed-template content was reverted.

## [2.12.0] - 2026-07-17

- Template revision: `29`.
- Added a universal evidence-backed Landing Page workflow with conversion lanes,
  Claim Ledger truthfulness gates, modular briefs/templates, and dedicated routing.
- Added deterministic landing-page self-testing and integrated the workflow with
  design, SEO, template indexes, and compact task routing.

## [2.11.1] - 2026-07-17

- Template revision: `28`.
- Removed inherited trailing whitespace from the iOS Simulator ownership rule
  so downstream template syncs pass repository diff hygiene checks.

## [2.11.0] - 2026-07-17

- Template revision: `27`.
- Reduced mandatory orchestration context from 400+ lines to a compact core and
  changed Codex/Cursor routing to inject matched workflow targets rather than
  the full hook registry and repeated core-rule stack.
- Added low/focused/broad verification tiers, reusable Xcode
  `build-for-testing`/`test-without-building` plans with explicit Simulator
  ownership, and persistent task-delta audits across intermediate commits.
- Preserved v2.10.0 device scheduler self-repair, template audit preflight, and
  mainline GitHub publication gates while moving them off ordinary task paths.
- Added routing, verification-plan, Xcode-plan, and task-delta regression suites
  with compact-context budgets.

Release base: `2.10.0`, revision `26`, commit
`84d1ad007fe65a3b488f34582515f5dc19969d6a`.

## [2.10.0] - 2026-07-16

- Template revision: `26`.
- Added a read-only template-content preflight to `devrules audit`, so project
  audits expose pending template updates, ownership conflicts, and unverifiable
  provenance before adoption/maturity findings without suppressing partial-repo
  diagnostics.
- Made idle-resource maintenance device-autonomous across macOS and Windows:
  daily LaunchAgent / Task Scheduler pressure checks, Sunday full cleanup, free
  memory reporting, and 30-day Xcode, Rust, SwiftPM, and Gradle artifact reclaim.
- Added fail-closed active-build gates for Cargo/Rust, Xcode/Swift, and Gradle;
  matching artifact deletion is deferred and rechecked immediately before apply,
  while arbitrary build/dev-server/IDE processes are never terminated.
- Added pre-authorized, idempotent SessionStart bootstrap for Codex and Cursor.
  After a template pull, the next activated template/project session refreshes
  global hook assets and runs `ensure-agent --apply`: healthy schedulers receive
  zero writes, while missing, disabled, stale, or misconfigured schedulers are
  repaired automatically; unsupported/failing devices retain project fallback.
- Added a read-only `repo publish-readiness` gate for every GitHub publication.
  It audits `.gitignore`, untracked and likely build/secret artifacts, default
  and feature branch integration/cleanup, fetched remote divergence, the
  project-selected GitHub account/repository binding, active `gh` login, and
  repository/default-branch readback before a final push.
- Standardized mainline-first publication: feature branches remain available
  during development, completed and tested work is merged into the configured
  default branch, only proven merged branches are cleaned, remote updates are
  merged without destructive overwrite, and missing remotes are created
  private only under the explicitly selected project account.

Release base: `2.8.0`, revision `25`, commit
`9ed135d5172aa4fcd32177b72847df8b8e080acc`.

## [2.8.0] - 2026-07-16

- Template revision: `25`.
- Hardened global Cursor installation and audit: invalid JSON now fails closed;
  managed events are repaired to one exact command/matcher/timeout definition;
  unrelated hooks remain untouched; the portable routing core is installed and
  audited with the runtime hook.
- Made runtime-profile discovery portable across explicit overrides, Windows
  `%LOCALAPPDATA%`, XDG configuration, and the Unix default.
- Defined project-local same-ID hooks as complete replacements for shared hooks
  in both runtime routing and generated routing cards.
- Added `repo refresh-entries`; successful repository/batch/workspace template
  sync now refreshes configured root Agent entries and the Cursor routing card,
  while blocked sync performs no entry writes.
- Extended project audit to require a valid always-on Cursor rule, exactly one
  routing-card block, and current generated content.
- Split global-install, routing, and entry-refresh regression coverage into
  focused self-tests, including dry-run, preservation, drift repair,
  idempotence, multi-repo routing, and invalid-JSON cases.
- Made the authority symlink fixture portable on Windows without requiring
  administrator privileges; the real filesystem-symlink case reports an
  explicit skip when Windows symlink privilege is unavailable.

Release base: `2.7.8`, revision `24`, commit
`1c3b5f46bb611457591e7d3b92718d015bf70c7b`.

## [2.7.8] - 2026-07-16

- Template revision: `24`.
- Simulator ownership now requires each persistent named project device to keep
  only that project's user-installed bundles, audits the exact UDID before
  accepting evidence, and removes confirmed foreign bundles without erasing the
  device.
- Explicitly forbids borrowing another project's named simulator as a temporary
  healthy fallback and defines contamination recovery for the responsible task.
- Fixed workspace Git discovery so ordinary directories inside a repository are
  not misclassified as additional nested repositories.
- Restored the global-install self-test fixture's Codex/Cursor hook parity so
  the full template gate covers the current multi-surface installer contract.

Release base: `2.7.7`, revision `23`, commit
`bb1c05f671859d02f73d7989d656d9788de6f7ee`.

## [2.7.7] - 2026-07-16

- Template revision: `23`.
- Idle-resource seed: daily LaunchAgent (weekday `pressure`, Sunday full
  `apply`), fast `pressure` command, Gradle `build/` age prune, `devrules idle`
  CLI wrapper, Cursor sessionStart boot-pressure hint, and Simulator-handoff
  hook routing into idle reclaim when extras remain Booted.

Release base: `2.7.6`, revision `22`, commit
`7f862539a6c087f5a747cebdab50361d8566ba47`.

## [2.7.6] - 2026-07-16

- Template revision: `22`.
- Strengthened seed idle-resource maintenance: script reads
  `config.json` → `idleResourceMaintenance`, adds SwiftPM `.build` and
  CoreSimulator/Caches age prune, and keeps Simulator boot-pressure reclaim.
- Clarified device-first autonomy: install the weekly macOS LaunchAgent when
  missing; otherwise project Agents must invoke the seed script themselves.
- Documented non-goals: no named Simulator erase, no cargo registry /
  `node_modules` wipe, no privileged memory `purge`.

Release base: `2.7.5`, revision `21`, commit
`92f328d8d72ef54d2e1981b3be604bf80af01bd4`.

## [2.7.5] - 2026-07-16

- Template revision: `21`.
- Restored template authority after incomplete 2.7.4 publishing: the tagged
  2.7.4 commit aligned CLI `VERSION` with `template.json` but left
  `CHANGELOG.md` at 2.7.3 and a dirty worktree, which blocked every
  `workspace sync-template` apply.
- Records the intended 2.7.4 changelog entry below and publishes a clean
  SemVer + revision + tag + SHA tuple so registered project sync can proceed.

Release base: `2.7.4`, revision `20`, commit
`e5150de4d06f7ae018cd5fb9dfa69a23c874c202`.

## [2.7.4] - 2026-07-16

- Template revision: `20`.
- Fixed template authority for 2.7.3: align the CLI `VERSION` constant with
  `template.json` / changelog so `template status` and sync apply are unblocked.
- Note: the annotated `v2.7.4` tag points at the VERSION-alignment commit; the
  changelog text for that release is recorded in the 2.7.5 commit tree.

Release base: `2.7.3`, revision `19`, commit
`a749f0d9ef044d724ffac4c7daf8f2fb59839bbe`.

## [2.7.3] - 2026-07-16

- Template revision: `19`.
- Cursor entry binding is now first-class on initialize: create
  `.cursor/rules/devrules.mdc` with native frontmatter (`alwaysApply: true`)
  and the managed devrules priority block, then refresh the routing card.
- Runtime config normalization keeps the Cursor rule on `entryFiles.create`
  even when older project configs only listed `AGENTS.md`.
- Documented that a multi-repo Cursor workspace parent may keep a local
  always-on routing rule that points Agents into each repository's own
  `devrules/always-readme.md` without becoming a second orchestration root.

Release base: `2.7.2`, revision `18`, commit
`08d0e11a63b508e86cb39fa7e60c2f5b01c449f8`.

## [2.7.2] - 2026-07-16

- Template revision: `18`.
- Extended `scripts/global-devrules.mjs` so one installer/auditor covers both
  Codex and Cursor (`--surface all|codex|cursor`), preserving unrelated hook
  entries on each surface.
- Fixed Cursor multi-repo workspace resolution: the routing hook now prefers
  edited/referenced file paths when locating the product repository, so a
  parent workspace cwd no longer suppresses trigger injection.
- Documented the shared installer path in `hooks/README.md`.

Release base: `2.7.1`, revision `17`, commit
`fee36a1a14974a257445495445c0e2be45d57878`.

## [2.7.1] - 2026-07-16

- Template revision: `17`.
- Added `hooks/cursor-global-routing-hook.mjs`, the portable Cursor user-level
  hook that injects devrules orientation at `sessionStart`, surfaces matching
  hooks after edits and shell commands through `postToolUse`
  `additional_context` (per-conversation dedupe), and writes trigger telemetry
  to `~/.cursor/log/devrules-cursor-hook.jsonl`.
- Documented the Cursor runtime trigger layer and its manual installation in
  `hooks/README.md`.
- Superseded by `3.0.0`: current hooks do not write invocation telemetry.

Release base: `2.7.0`, revision `16`, commit
`0e3c2337706bbbd60a8a9fde3630a4f510c5f229`.

## [2.7.0] - 2026-07-16

- Template revision: `16`.
- Added machine-checkable matcher fields (`promptPatterns`, `pathPatterns`,
  `commandPatterns`) to every hook in `hooks/hooks.json` so runtime hooks in
  Codex and Cursor can deterministically match triggers instead of relying on
  prose-only `when` descriptions.
- Added `scripts/routing-card.mjs`, which generates a compact routing card
  from `hooks.json` (plus `hooks.local.json` when present) into the
  repository's `.cursor/rules/devrules.mdc` as a managed
  `DEVRULES:ROUTING-START/END` block, making hook routing always-on context
  for Cursor agents.
- Documented the runtime trigger layer expectations in `hooks/README.md`.

Release base: `2.6.0`, revision `15`, commit
`272325e459b4d87186fe0f780367c9661d87bff7`.

## [2.6.0] - 2026-07-15

- Template revision: `15`.
- Added a mandatory pre-implementation iOS/iPadOS account and data architecture
  gate with an approved project decision artifact.
- Made local-first persistence with explicit `local_only` or iCloud sync the
  default, while requiring an explicit product decision for account-backed
  ownership.
- Separated application-owned immutable keys from Apple, Google, email,
  CloudKit, device, and billing identities across auth, sync, RevenueCat, and
  App Store launch guidance.
- Distinguished reduced self-operated backend/domain/IP surface from mainland
  China APP filing and category-specific compliance; local+iCloud is not treated
  as an automatic filing exemption.

Release base: `2.5.1`, revision `14`, commit
`2ecba256aead8f3863ea17b0901da55e1d80053f`.

## [2.5.1] - 2026-07-15

- Template revision: `14`.
- Clarified that read-only device discovery may inspect booted simulators while
  every mutation and device-specific verification still requires the exact UDID.
- Resolves Simulator UDIDs from the current Mac's read-only CoreSimulator
  inventory instead of treating shared registry data or another Mac's UDID as
  cross-device authority.
- Treats unidentified Simulator-controlling processes as competing foreground
  owners and makes rule-before-workflow routing explicit.

Release base: `2.5.0`, revision `13`, commit
`b532203c5335674f50e8ab2842a3bda2fd45baf1`.

## [2.5.0] - 2026-07-15

- Template revision: `13`.
- Added universal iOS Simulator ownership rules that distinguish exact-UDID
  device isolation from shared macOS Simulator foreground-window ownership.
- Added a fail-closed Simulator handoff workflow with competing-process and
  destination preflight, exact normal-window selection, External Display
  recovery, and a stability re-check before declaring the handoff ready.
- Routed Simulator opening, visual verification, and handoff through the new
  governance from the shared hook registry, workflow index, and iOS live-preview
  workflow without changing project-local device data or stopping other workers.

Release base: `2.4.0`, revision `12`, commit
`d6fad847ac757a903779412b7befaf08b58c1d57`.

## [2.4.0] - 2026-07-15

- Template revision: `12`.
- Added a universal product-architecture gate between product inputs and design
  or technical implementation, including critical requirement review,
  capability and surface roles, user journeys, IA comparison, traceability, and
  explicit product-readiness verdicts.
- Separated product/IA facts, visual-system facts, and technical-architecture
  facts; routed blocked product decisions away from Design Read, surface
  specification, and implementation.
- Added `repo sync-template --repo <repo>` for a single baseline-protected,
  transactional repository upgrade without sibling scanning or initialization
  side effects.
- Bound tracked managed-template bytes and release identity to the exact Git
  commit tree, rejected unsafe index flags and uncommitted managed payloads,
  and excluded machine metadata from the non-Git fallback.
- Added fetch-backed remote authority checks, exact annotated-tag verification,
  adopted-root and symlink containment, per-target apply/recovery locking,
  non-bypassable production authority, transactional initial sync,
  source-commit revalidation, managed-root type checks, target-leaf topology
  protection, and all-entry recovery-journal containment before writes.
- Bound declared authority to the single effective fetch/push repository,
  including port and case-sensitive path identity; rejected `insteadOf`
  redirects, split URLs, Git replace refs, and graft overlays. Canonical object
  reads always disable replacement objects.
- Recovery journals now record before/after fingerprints. Manual or automatic
  recovery refuses unknown later content across the complete transaction before
  restoring any entry, so recovery cannot overwrite post-transaction human
  edits.
- Locks use unique owner tokens and inode ownership, never age-only takeover;
  preflight fingerprints are checked again during backup and immediately before
  each write, including `.template-sync.json`, to close late-edit windows.
- Upgraded `.template-sync.json` to a provenance-checked schema that binds the
  complete baseline to a prior released Git tree and records explicit
  `template` or `project` ownership. Legacy state fails closed unless an
  operator explicitly rebuilds it with `--adopt-current-baseline`; adopted
  project files remain protected across convergence, removal, and
  reintroduction.
- Added one device-local runtime locator for the canonical shared template and
  independent workspace roots, plus a stable cross-platform launcher that can
  repair the locator after the prior template path becomes unavailable and
  honors per-invocation custom config paths across all subcommands.
- Added explicit registry template bindings so external workspaces no longer
  need a shared-template clone or filesystem symlink.
- Routed the main CLI, global Codex installer, and developer-services registry
  through the same fail-closed path resolver; added offline-root reporting and
  focused runtime-location regression coverage.
- Added product-gate, ignored-artifact, source-identity, project-identity,
  single-repository, index-spoofing, forged-state, authority-migration,
  authority-identity, managed-root shape, target-symlink, recovery-human-edit,
  legacy-state adoption, remote-staleness, idempotence, rollback, and
  conflict-zero-write regression coverage.

Release base: `2.3.0`, revision `11`, commit
`a558152f52a7a490a15726b7f54e15fda4ea72e5`.

## [2.3.0] - 2026-07-14

- Template revision: `11`.
- Added the shared named design-style library and the evidence-backed
  extract/review/publish/apply lifecycle.
- Published `signal-newsroom` as the first reusable style pack, synthesized from
  the public editorial surfaces of Fooling and Story Fooling.
- Added dry-run-first style-library automation with validation, idempotent apply,
  and no-overwrite conflict protection.
- Formalized SemVer, monotonic revision, exact-SHA handoff, and version-tag rules
  for cross-device synchronization and Nutstore backup naming.
- Added a release gate that rejects mismatches between `template.json`, the
  devrules CLI version, and the latest changelog release.

Release base: `2.2.2`, revision `10`, commit
`2954414027995ce0cecafade1116fd25295db193`.
