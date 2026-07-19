---
description: Generic workflow routing rules for devrules project instances.
ownership: shared
governs: agent
activation: conditional
enforcement: advisory
decision_owner: project
side_effects: none
---

# Workflow Management

This document routes user requests and repository events to the right devrules workflow. It is intentionally generic. Project instances may add project-specific workflows, but they should keep this routing table current.

In this workspace, references to "workflow", "rules", "工作流", or "规则" mean the devrules workflow/rule system by default. Do not create an unrelated project workflow system when the right action is to update `devrules/workflows/`, `devrules/rules/`, `devrules/hooks/`, or the shared template.

## 0. Governance Routing

Classify ownership, applicability, authority, and effects separately. Every
Markdown rule, workflow, and profile uses these v3 frontmatter fields:

| Field | Values | Question answered |
| --- | --- | --- |
| `ownership` | `shared`, `seed`, `local` | Where is the canonical document maintained? |
| `governs` | `agent`, `product`, `device`, `release`, `external_service` | Whose behavior or decision is being guided? |
| `activation` | `always`, `conditional`, `explicit` | What evidence activates it? |
| `enforcement` | `hard`, `gate`, `advisory`, `example` | What consequence may it impose? |
| `decision_owner` | `devrules`, `project`, `user` | Who makes the underlying choice? |
| `side_effects` | `none`, `local`, `external` | What state can execution change? |

Ownership controls the canonical write target; it never implies applicability:

| Ownership | Canonical write target | Propagation rule |
| --- | --- | --- |
| `shared` | Canonical devrules template. | Propagate only through an explicit template release/sync phase. |
| `seed` | Shared reusable starter; installed project copies may diverge. | Do not promote project tuning unless explicitly requested. |
| `local` | The affected repository's local `devrules/` instance. | Do not sync back automatically; promote a separately generalized pattern only on request. |

Infer ownership from the existing document and the user's requested target when
it is clear. Ask only when ambiguity would change the canonical write target.
Do not ask the user to reselect ownership on every edit.

`activation: always` is reserved for side-effect-free Agent conduct such as
safety, protecting user work, and honest evidence. Product, device, release,
and external-service policies are conditional or explicit, and devrules is not
their decision owner. An always-on rule cannot perform local or external side
effects.

Project-owned workflows may name local commands, source roots, services, or
release paths. Shared workflows must stay portable: no single project's URLs,
credentials, private data, product strategy, device policy, or provider choice
may leak into the template.

Hook `read` and `workflows` entries use structured
`target`/`activation`/`condition`/`primary` objects. A hook must have one
unconditional primary target. Conditional entries load only when their
machine-readable condition is proven; prose notes and legacy string qualifiers
cannot activate them. Explicit entries are never auto-selected and require a
recorded project or user opt-in.

GitHub Actions policy is project-owned and tri-state:

- `inherit` preserves the repository's existing policy and workflows; devrules
  neither creates nor removes hosted workflows.
- `allow` permits a newly proposed hosted workflow only after the relevant
  project/user approval and normal external-write review.
- `deny` rejects new hosted workflow adoption. Existing workflow removal is a
  separate destructive change and still requires explicit authorization.

None of these values selects a product CI strategy, job matrix, provider, or
model on the project's behalf.

## 1. Workflow Index

| Workflow | Trigger | Output |
| --- | --- | --- |
| `devrules-initialize.md` | A repository needs devrules adoption or upgrade. | Instance `devrules/`, entry bindings, manifest, memory files. |
| `devrules-audit.md` | Compare project devrules with the shared template, then check repository adoption. | Template alignment, findings, maturity level, missing anchors, recommended fixes. |
| `devrules-memory-maintenance.md` | Interaction logs grow, decisions need capture, repeated lessons appear. | Compacted memory and updated decisions/lessons. |
| `devrules-feedback-update.md` | A normal task reveals a durable preference, lesson, command, or cross-project improvement idea. | Project-local memory update or evolution suggestion. |
| `devrules-evolution-review.md` | Multiple projects repeat the same pattern or pain point. | Template evolution suggestions for human review. |
| `devrules-template-promotion.md` | A project-local devrules change should become a reusable shared-template rule, workflow, hook, script, or template. | Generalized template update, decision record, baseline-protected project sync, conflict report. |
| `devrules-script-automation.md` | Adding, changing, or relying on scripts under `devrules/scripts/`. | Safe cross-platform automation with documented read/write scope. |
| `git-multi-device-sync.md` | Before the first local write in a GitHub-backed repository, or when it is committed/pushed, edited across devices, or handed off. | Fetch-backed clean/equal pre-edit proof, worktree/gitignore audit, branch integration and cleanup review, exact account/repository readback, default-branch publication, exact commit handoff. |
| `multi-device-registry-handoff.md` | A separately cloned shared template is opened on another device or needs local activation. | Git authority verification, device identification, registry dry-run, template plan, skipped unsafe repositories. |
| `code-change.md` | Production code, tests, scripts, build logic, or executable configuration will change. | Smallest correct boundary, non-negative code-health delta, and verification evidence. |
| `product-architecture-review.md` | A product input defines or materially changes user-facing capabilities, product domains, navigation, broad journeys, ownership, or visible states. | Critical input review, capability and surface model, journeys, IA options, traceability, decisions, and product-readiness verdict. |
| `architecture-change-review.md` | A medium+ feature, broad behavior change, shared capability, or cross-boundary implementation is requested. | Relationship to existing architecture, smallest boundary adjustment, implementation plan, verification scope. |
| `game-source-of-truth.md` | Fast-moving game documents, stage labels, metrics, technical names, or authored/generated data disagree. | Canonical V1 registry, supersession map, unresolved-decision list, migration plan. |
| `game-preproduction.md` | A game idea or major direction needs bounded discovery before production. | Product pillars, non-goals, risk register, stage gates, prototype sequence. |
| `game-design-change.md` | A mechanic, economy, progression, onboarding, or player-facing rule changes. | Testable feature brief, impact map, displaced scope, acceptance and stop conditions. |
| `game-prototype-playtest.md` | A game hypothesis needs a time-boxed prototype and unbiased playtest. | Prototype experiment, evidence, Keep/Iterate/Kill decision. |
| `godot-module-architecture.md` | A Godot scene, Autoload, cross-module signal, state owner, Resource, or save boundary changes. | Scene contract, dependency/state map, test-scene and lifecycle evidence. |
| `game-data-balance.md` | Authored data, generation, formulas, economy, progression, spawns, loot, or tuning changes. | Validated data diff, experiment evidence, tuning note, rollback values. |
| `game-asset-integration.md` | Visual, audio, level, narrative, localization, UI, or other game content enters the build. | Traceable source/export/import records and in-build acceptance evidence. |
| `game-qa-regression.md` | A game defect, risky integration, milestone, or release candidate needs verification. | Reproduction record, risk classification, regression coverage, current evidence. |
| `game-save-compatibility.md` | Persistent fields, stable IDs, serialization, or compatibility commitments change. | Versioned schema, migrations, golden saves, recovery and compatibility report. |
| `game-performance-profiling.md` | A game performance baseline, hot path, entity budget, or platform target changes. | Reproducible scenario, profiler capture, frame/memory comparison, regression verdict. |
| `godot-export-release.md` | A Godot milestone build, release candidate, export preset, or channel promotion is requested. | Reproducible local export, install smoke, release evidence, rollback plan. |
| `game-retrospective.md` | A prototype, playtest wave, milestone, release, or repeated production failure ends. | Evidence-based lessons, 1-3 bounded improvements, local/promotion routing. |
| `production-change.md` | A released product change affects persistent data, schema/format, contracts, mixed client versions, migration, rollout, rollback, or recovery. | Risk-derived production plan, compatibility/migration evidence, staged release, recovery proof, post-release reconciliation. |
| `documentation-update.md` | Files/directories/interfaces changed. | Updated README anchors and file/module documentation. |
| `debug-root-cause.md` | A bug, failing check, runtime error, or repeated failed attempt appears. | Root cause analysis, minimal fix, verification, lesson if reusable. |
| `ios-build-error-triage.md` | iOS/Xcode build, package resolution, module dependency, dependency scanning, SDK, signing, or Canvas build failures appear. | Root/cascade classification, smallest cache/package/source repair, same-lane build verification, reusable error bucket. |
| `ios-account-data-architecture.md` | An iOS/iPadOS task materially changes persistence, iCloud/CloudKit, login, data ownership, primary keys, collaboration, recovery, or migration. Pure UI/mechanical work does not trigger it. | Project-selected topology and key/identity strategy, data authority and lifecycle behavior, plus only applicable migration/privacy/regional gates. |
| `terminal-popup-diagnostics.md` | Terminal windows flash, `cmd.exe`/PowerShell popups appear, or dev servers spawn visible consoles. | Process evidence, terminal-audit findings, hidden child-process fix plan. |
| `macos-credential-prompts.md` | macOS Keychain, signing, password, Allow/Deny, Always Allow, sudo, or privacy/security prompts appear or may block unattended work. | Prompt source, one-attempt stop rule, non-interactive credential plan, cleanup checklist. |
| `ios-live-preview-ui-iteration.md` | iOS app UI work needs fast visual iteration, live preview, hot reload, Canvas/story/catalog coverage, or iPhone/iPad state verification. | Stack lane selection, product-synchronized preview coverage, runtime verification split, stale preview debugging. |
| `ios-simulator-handoff.md` | An Agent opens, switches, launches, verifies, or hands off a visible iOS Simulator; an External Display window appears; or multiple projects/tests may contend for Simulator. | Validated one-device/two-App project profile when selected, exact device and foreground-owner preflight, normal-window opening, non-interference guardrails, stable handoff evidence. |
| `idle-resource-maintenance.md` | The user requests device maintenance, a project device profile opts in, or idle Simulator/process, memory pressure, cache, or scheduler health is explicitly being investigated. | Read-only status/pressure/plan by default; scheduler install/repair and cleanup require explicit opt-in/apply. |
| `i18n-multilingual-adaptation.md` | A project needs multilingual support, changed user-facing source copy detection, locale resource updates, translation automation, or i18n validation. | Locale architecture, source-unit inventory, translation job plan, validation/self-heal gates, project-local hook guidance. |
| `browser-automation-fix.md` | Browser automation or rendered frontend testing hangs/fails. | Diagnosed browser/dev-server issue and verified fix. |
| `codex-browser-automation-fix.md` | Codex.app Chrome/browser automation is requested; reports `No Codex/ChatGPT browser route` or `tabID=undefined`; or page operations incur a fixed delay with Statsig/network timeouts. | Installed or repaired the scoped node_repl wrapper/launch environment, restarted the Desktop parent when required, recovered stale route state once, and verified prompt continued page-level control. |
| `error-continue.md` | A long task must be resumed in another session. | Continuation note with state, decisions, files, checks, next steps. |
| `backup-maintenance.md` | User data, exports, restore paths, migration safety, or backup coverage changes. | Backup/restore expectations, validation, and memory note. |
| `note-reference-integration.md` | AI features need user-selected notes, references, snippets, or external context. | Reference adapter shape, selection semantics, and integration checklist. |
| `developer-service-configuration-governance.md` | Developer accounts, external service projects/apps, identifiers, keys, credentials, products, integrations, environments, selectable same-provider bindings, or cross-project reuse need creation or review. | Minimum identity, authorization, secret-safety, and readback evidence; a managed inventory only when the project selects that profile. |
| `apple-app-store-launch.md` | Apple App Store launch, Bundle ID, TestFlight, App Store Connect, capabilities, ASO/AEO, or review preparation. | Interactive launch decisions, identifier/capability map, metadata drafts, form-fill guardrails, verification evidence. |
| `revenuecat-integration.md` | RevenueCat, subscriptions, premium gates, paywalls, in-app purchases, RevenueCat MCP, or store credentials. | Entitlement architecture, Dashboard/MCP setup, store credential handling, secure key storage, purchase QA, troubleshooting evidence. |
| `service-project-operations-core.md` | A provider project-operations workflow (Supabase, Cloudflare) is triggered; read the shared skeleton first. | Shared identity, inventory, environment-file, selection-group, preflight, deployment, and verification contract. |
| `supabase-project-operations.md` | Supabase account/project selection, keys, schema, RLS, Auth, Storage, functions, webhooks, migrations, backup, or multi-environment deployment. | Explicit account/project/environment identity, credential lanes, versioned schema workflow, least-privilege service changes, readback, and drift evidence. |
| `cloudflare-project-operations.md` | Cloudflare account/token selection, Workers, Pages, domains, routes, bindings, D1/R2/KV/Queues/Durable Objects/Vectorize, migrations, or deployment. | Explicit account/environment/resource map, scoped token contract, allowlisted config/secrets, smallest deployment, state-aware rollback, and readback. |
| `release.md` | Preparing a project release. | Release validation, changelog/release notes, platform checks. |
| `seo-optimization.md` | SEO/AEO/GEO work for content or web surfaces. | Technical/content optimization and validation. |
| `landing-page.md` | A landing page, marketing page, conversion page, launch page, or product-site homepage needs copy, creation, or structural refactor. | Evidence-backed conversion brief, project-selected structure path, claim-safe copy, routed implementation, and conversion QA. |
| `prisma-database.md` | Prisma schema, migration, generated client, or Prisma access code changes. | Safe schema workflow, client/server boundary checks, verification. |
| `supabase-edge-function-deploy.md` | Supabase Edge Function code, secrets, routing, or deployment changes after the project target is established. | Targeted function deployment, provider readback, smoke/integration verification, and downstream checks. |
| `design-read.md` | Any request that will produce new UI after any required product-architecture gate passes. | Design Read: users, core tasks, density, concrete references, design-language choice, layout direction, and routing to the right design workflow. |
| `design-init-new-project.md` | A new repository needs the unified UI design system (DESIGN.md + tokens + gates). | DESIGN.md source of truth, generated token artifacts, wired Tailwind/CSS, git/CI design gates. |
| `design-adopt-existing-project.md` | An existing repository's UI styles are scattered and need consolidation. | Inventory + UI audit (keep/remove/unify), reverse-engineered DESIGN.md, ratchet migration, exemption baseline. |
| `design-refactor-existing-project.md` | An existing repository needs actual UI optimization/refactor, not just token adoption. | Mode selection, phased intake/audit/tokens/components/screens/states/QA/handoff, rollback-aware delivery. |
| `design-new-component.md` | A new UI component or variant is needed. | Registered component spec in DESIGN.md, synced tokens, primitive implementation, guard-clean code. |
| `design-new-page.md` | A new page or large view is needed. | Design Read summary, page spec with component inventory, composed UI with loading/empty/error states, acceptance checklist pass. |
| `design-change.md` | Any visual/styling adjustment is requested. | Token-first DESIGN.md edit, designmd diff, regenerated artifacts, changelog entry; UI audit first for redesign-level scope. |
| `design-audit.md` | Periodic design drift audit, AI-flavored copy cleanup, or exemption cleanup. | Triaged drift list (tokenize/fix/exempt), content-quality pass, reduced allowlist, spec-implementation reconciliation. |
| `design-extract-style.md` | One or more existing repositories should become a portable named design style. | Evidence boundary, reconciled shared language, validated style pack, catalog publication. |
| `design-apply-style.md` | A target repository should use a named style from the shared catalog. | Fit decision, conflict-safe editable DESIGN.md fork, provenance, integration verification. |
| `design-port-to-new-project.md` | Another repository should directly fork one source project's complete UI system. | Copied DESIGN.md + design kit, re-initialized instance, fork-point changelog. |

Project-specific workflows may be added when a repository has recurring needs such as database migrations, i18n, payment integration, native packaging, data backup, AI-service integration, or security review.

## 2. Routing Rules

Use the most specific workflow that applies.

Project instances may also define active routing triggers in `devrules/hooks/hooks.json` and optional `devrules/hooks/hooks.local.json`. Check both before selecting workflows for non-trivial tasks.

| Request or event | Workflow |
| --- | --- |
| "Initialize devrules", "apply this system", new repo onboarding | `devrules-initialize.md` |
| "Audit rules", "check adoption", "is this repo compliant" | `devrules-audit.md` (template content preflight first) |
| Repeated user preference, architecture decision, durable lesson | `devrules-memory-maintenance.md` |
| Day-to-day feedback that should be remembered after a task | `devrules-feedback-update.md` |
| Same lesson appears across multiple repositories | `devrules-evolution-review.md` |
| Project-local devrules workflow/rule/hook/script should become generic for all projects | `devrules-template-promotion.md` |
| User says workflow/rules/工作流/规则 without naming application code | Treat as devrules workflow/rule-system work; classify with Governance Routing before editing |
| Add or modify scripts in `devrules/scripts/` | `devrules-script-automation.md` |
| Run a devrules script that can mutate files | `devrules-script-automation.md` plus the task-specific workflow |
| First local write in a GitHub-backed repository; Git commit/push, publication, repository creation, branch integration/cleanup, another-device edit, handoff, stale clone, or ahead/behind/diverged state | `git-multi-device-sync.md`; the fetch-backed clean/equal pre-edit gate is mandatory, and `developer-service-registry-governance.md` applies to GitHub account/repository selection |
| Cloned devrules template opened on another device or new machine activation | `multi-device-registry-handoff.md` plus `git-multi-device-sync.md` |
| Production code, tests, scripts, build logic, or executable configuration changes | `code-change.md`; use `architecture-change-review.md` first for structural work and `debug-root-cause.md` first when the request starts from a failure |
| New feature, broad feature, shared capability, or cross-boundary behavior change | `architecture-change-review.md` before implementation |
| PRD, product brief, requirements, research, or redesign defines user-facing capabilities, product domains, navigation, broad journeys, ownership, or visible states | `product-architecture-review.md` before Design Read, surface specification, technical architecture, or implementation; a `blocked` verdict stops the chain |
| Released product changes persistent data, schema/file format, API/event/import-export contract, deployed client compatibility, permissions, billing, migration, rollout, rollback, or recovery | `production-change.md` plus `architecture-change-review.md` when system boundaries also change |
| Game documents or data disagree about the current version, stage, metric, architecture name, or source of truth | `game-source-of-truth.md` before planning or implementation |
| New game, game direction reset, or movement from ideation into preproduction | `game-preproduction.md` |
| New or changed game mechanic, progression, economy, content family, onboarding, or player-facing rule | `game-design-change.md`, then `game-prototype-playtest.md` when evidence is missing |
| Time-boxed gameplay/UX/technical hypothesis or external playtest | `game-prototype-playtest.md` |
| Godot Scene, Autoload, signal, Resource, state ownership, serialization, or cross-module change | `godot-module-architecture.md` plus `architecture-change-review.md` for medium+ scope |
| Game data, balance, progression, economy, spawn, loot, or formula change | `game-data-balance.md` |
| Game visual/audio/content/level asset enters or changes in a playable build | `game-asset-integration.md` |
| Game bug, milestone regression, save/input/render/audio/platform failure | `game-qa-regression.md`; use `debug-root-cause.md` first for diagnosis |
| Game save schema, stable ID, serialization, migration, or corruption handling change | `game-save-compatibility.md` |
| Game frame time, memory, loading, shader, physics, navigation, entity, or platform budget | `game-performance-profiling.md` |
| Godot export, milestone package, release candidate, or channel promotion | `godot-export-release.md` plus generic `release.md` |
| Prototype, playtest wave, game milestone, or release has ended | `game-retrospective.md` |
| New file, removed file, moved module, interface change | `documentation-update.md` |
| Failing build/test/lint/runtime behavior | `debug-root-cause.md` |
| iOS/Xcode build failures, many Xcode issue-list errors, SwiftPM package product missing, module dependency failures, Clang dependency scanning failures, SDK/destination build failures, signing build failures, or Canvas build failures | `ios-build-error-triage.md` first, then `debug-root-cause.md`; add `ios-live-preview-ui-iteration.md` when Canvas or live-preview behavior is part of the failure |
| Substantive iOS/iPadOS development with a missing/stale account/data decision; first or changed persistence, iCloud/CloudKit, Sign in with Apple/Google, email login, data ownership, primary keys, collaboration, or account recovery | Read `rules/ios-account-data-model.md`, then run `ios-account-data-architecture.md` before implementation; add `product-architecture-review.md` for new/broad product work and `production-change.md` for released-data migration. Purely visual/copy/mechanical UI changes may defer an initial artifact. |
| Flashing terminal windows, popup console flicker, visible `cmd.exe`/PowerShell windows | `terminal-popup-diagnostics.md` first, then `debug-root-cause.md` for the affected project code |
| macOS Keychain dialogs, password prompts, Allow/Deny, Always Allow, signing private-key prompts, `sudo`, or privacy/security permission prompts | `macos-credential-prompts.md` first, then the task-specific workflow |
| iOS app UI changes, frontend interaction changes, live preview/hot reload setup, Xcode Canvas, Storybook/Widgetbook/catalog previews, simulator-preview mismatch, iPhone/iPad visual verification | `ios-live-preview-ui-iteration.md`; also use `design-change.md` for styling-only adjustments or `design-refactor-existing-project.md` for broad UI refactors |
| Open/switch/launch/verify a visible iOS Simulator, hand it to the user, diagnose `External Display`, or work while another iOS UI test/project is active | Read `rules/ios-simulator-ownership.md` first, then run `ios-simulator-handoff.md`; use `debug-root-cause.md` when the wrong window or repeated focus change is already occurring |
| Too many Booted simulators, idle Simulator.app/processes, memory pressure, free RAM/disk after unused Apple/Rust/Swift/Gradle work, stale DerivedData/`target/`/`.build`/`build` older than the project threshold | `idle-resource-maintenance.md`; inspect `agent-status`, pressure, status, and plan first. Scheduler repair or cleanup requires explicit opt-in/apply. |
| Frontend visual issue or browser automation cannot proceed | `browser-automation-fix.md` first, then `debug-root-cause.md` if code root cause is found |
| Codex.app Chrome/browser automation is requested or fails ("extension not available", `No Codex/ChatGPT browser route`, `tabID=undefined`), or page reads show a fixed delay with Statsig/network timeouts | `codex-browser-automation-fix.md`; audit/repair the managed node_repl wrapper and launch environment, restart the Desktop parent if required, then run one bounded page probe |
| Long task interrupted or handoff needed | `error-continue.md` |
| User data backup, export, restore, or migration safety | `backup-maintenance.md` |
| AI generation needs selected user references or note context | `note-reference-integration.md` |
| Developer portal/service app, project, identifier, key, credential, product, webhook, environment, selectable same-provider backend, or shared API configuration is created, reused, rotated, audited, switched, or removed | `developer-service-registry-governance.md` and `developer-service-configuration-governance.md` first, validate/inspect the structured registry, then use the provider-specific workflow |
| Add multilingual support, add/remove supported locales, migrate hardcoded UI copy, automate translation, detect changed source copy, or validate locale resources | `i18n-multilingual-adaptation.md`; also use any project-local i18n workflow when present |
| Apple App Store launch, Bundle ID, Apple Developer identifiers, TestFlight, App Store Connect, app capabilities, ASO/AEO for an Apple app, screenshots, review notes, IAP/subscriptions, or mainland China APP-filing/network-resource compliance concerns | Confirm `ios-account-data-architecture.md` has an approved current decision when persistence, iCloud, or login is in scope; use `developer-service-configuration-governance.md` for identifiers/credentials/products/integrations, then `apple-app-store-launch.md`; add `release.md` when packaging/build readiness is also requested |
| RevenueCat, subscriptions, premium gates, paywalls, in-app purchases, monetization, RevenueCat MCP, public SDK keys, project-local `REVENUECAT_MCP_API`, or store credentials | `developer-service-configuration-governance.md` then `revenuecat-integration.md`; add `apple-app-store-launch.md` when Apple StoreKit/App Store Connect is in scope |
| RevenueCat Web Billing, Web Paywalls, web checkout, or RevenueCat webhooks hosted on Supabase/Cloudflare | `developer-service-configuration-governance.md`, then `revenuecat-integration.md`, plus `supabase-project-operations.md` and/or `cloudflare-project-operations.md` for the selected backend |
| Supabase account/project selection, publishable/secret/management keys, database migrations, RLS, Auth, Storage, cron, webhooks, or environment deployment | `developer-service-configuration-governance.md` then `supabase-project-operations.md`; add `backup-maintenance.md` for backup/restore or risky user-data changes |
| Cloudflare account/token selection, Workers, Pages, routes/domains, `wrangler` config, secrets/vars, D1, R2, KV, Queues, Durable Objects, Vectorize, cron, bindings, migration, deploy, or rollback | `developer-service-configuration-governance.md` then `cloudflare-project-operations.md`; add `backup-maintenance.md` for stateful data recovery scope |
| Release, packaging, changelog, deployment readiness | `release.md` plus project-specific release workflow if present; add `production-change.md` when released state, contracts, clients, or recovery are affected |
| User-facing strings in an i18n project | `i18n-multilingual-adaptation.md` plus the project-local i18n workflow when present |
| Prisma schema or database access change | `prisma-database.md` if the project uses Prisma |
| Supabase Edge Function change | `supabase-project-operations.md` for target/credential/integration gates, then `supabase-edge-function-deploy.md` |
| Database/schema/user-data change | `production-change.md` for compatibility, migration, rollout, and recovery; add the project database workflow and `backup-maintenance.md` for implementation-specific backup coverage |
| Landing page / 落地页 / 营销页 / 转化页 / launch page / product-site homepage creation, copy, or structural refactor | `landing-page.md` as the outer coordinator; it routes downward to the applicable product-architecture, design, SEO, and analytics workflows |
| Any request that will produce new UI ("做个界面/页面/官网/后台", new project UI, redesign) | Resolve `product-architecture-review.md` first when its applicability is `required`, then run `design-read.md` and the routed design workflow |
| "统一设计规范" / "建立设计系统" / bootstrap a design system in a new repo | `design-read.md` then `design-init-new-project.md` |
| Scattered UI styles, hardcoded colors everywhere, "收敛样式" | `design-adopt-existing-project.md` (with `templates/design-ui-audit.md`) |
| Existing project UI optimization/refactor, "整体优化 UI", "重构页面", "提升已有界面质感/结构" | `design-read.md` then `design-refactor-existing-project.md` |
| New UI component or component variant | `design-new-component.md` |
| New page, view, or major screen with UI work | `design-new-page.md` |
| "调 UI" / change colors, typography, spacing, rounding, restyle requests | `design-change.md` (redesign scope: UI audit first) |
| design-guard findings pile up, AI-flavored copy, exemption list grows, periodic design audit | `design-audit.md` |
| "从 X 项目提取风格" / turn one or more repositories into a reusable template style | `design-extract-style.md` |
| "应用 X 风格" / apply a saved named style to a repository | `design-apply-style.md` |
| "直接复制 X 项目完整 UI" / tightly coupled one-source replication | `design-port-to-new-project.md` |

If no workflow applies, follow normal engineering practice and add an evolution suggestion only if the task reveals a repeatable process worth standardizing.

## 3. Workflow Selection Checklist

Before editing:

1. Read the nearest relevant README anchors.
2. Apply `first-principles-development.md`: identify the actual problem, evidence, root cause, smallest real fix, and verification before reaching for fallback or rollback.
3. For executable code changes, apply `code-quality.md`, `modularity-and-dependencies.md`, `change-health.md`, and the matching `profiles/` language guidance.
4. Check `devrules/hooks/hooks.json` and optional `devrules/hooks/hooks.local.json` for shared and project-local event triggers; load only proven structured routes.
5. Confirm the existing `ownership`, `activation`, and `decision_owner`. Ask only when ambiguity changes the canonical write target or underlying product/project decision.
6. If a project-local devrules change may become generic, run `devrules-template-promotion.md`; do not propagate it automatically.
7. Check whether the task touches documentation, memory, data safety, i18n, release, or automation.
8. Select only the triggered workflow documents.
9. If implementation guidance is needed, read `devrules/templates/README.md` and then only the selected template.
10. State the goal, constraints, and done criteria briefly for non-trivial changes.

After editing:

1. Run relevant repository-native checks and `code-health.mjs audit` for executable code changes when present.
2. Update README anchors when structure or interfaces changed.
3. Update memory only for durable decisions, repeated lessons, useful project feedback, or cross-project suggestions.
4. If a shared template change was made, record the template decision; sync eligible project instances only in an explicit propagation phase.
5. Report verification and remaining risks.

## 4. Workflow Document Contract

Each workflow should include:

- Frontmatter with `description`, `ownership`, `governs`, `activation`,
  `enforcement`, `decision_owner`, and `side_effects`.
- Purpose and trigger.
- Inputs and prerequisites.
- Execution steps.
- Verification.
- Memory or documentation updates.
- When not to use it.

Keep workflow documents focused. Move stack-specific implementation examples into templates when they would distract from the general procedure.

## 5. Maintaining This Index

When a workflow is added, renamed, or removed in `devrules/workflows/`:

1. Update the workflow index.
2. Update routing rules if the workflow changes task selection.
3. Confirm its ownership, activation, decision owner, enforcement, and side-effect boundary.
4. Record a short note in `devrules/memory/decisions.md` if the change affects how future Agents work.

Last updated: 2026-07-17
