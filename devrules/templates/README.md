---
title: devrules Middle-Platform Template Library
description: Domain index for optional implementation templates used by project-local devrules instances.
ownership: shared
governs: product
activation: conditional
enforcement: example
decision_owner: project
side_effects: none
applies_to:
  - web applications
  - mobile applications
  - desktop applications
  - backend services
  - AI products
  - game projects
  - operational platforms
use_when:
  - A task needs reusable engineering patterns beyond local project rules.
  - A workflow asks for implementation guidance, examples, or review checklists.
  - A project is adding a reusable capability such as AI, auth, billing, i18n, deployment, or design systems.
do_not_use_when:
  - The answer is already clear from the local codebase and project README anchors.
  - The task only needs a small mechanical edit.
outputs:
  - selected domain template
  - implementation pattern options
  - review checklist
  - project-local adaptation notes
case_sources:
  - magic-novel-forge/docs/templates
  - planner-v0/lib
  - NovelEditor/src
  - NovelWiki/src
  - DeGit/src
  - auto-threads
  - FrameCast
  - structureUI
  - planner-v0 governance and sync docs
  - SetMail desktop/local-first architecture
  - OpsHub analytics and notification surfaces
  - AutoMedia desktop release audit practice
  - HumanSphere reporting and simulation practice
related_workflows:
  - devrules/workflows/devrules-initialize.md
  - devrules/workflows/devrules-audit.md
  - devrules/workflows/devrules-evolution-review.md
last_reviewed: 2026-07-15
---

# devrules Middle-Platform Template Library

This directory is an optional best-practice library. It is not part of the default read path. Agents should open it only when `devrules/always-readme.md`, a workflow, or the current task calls for reusable implementation guidance.

Templates are deliberately written as patterns and case hints, not mandatory schemas. Adapt names, tables, APIs, providers, and directory layouts to the target project.

## Domain Map

| Domain | Use For | Start Here |
| --- | --- | --- |
| `ai/` | AI provider adapters, model routing, prompt management, agent management, workflows, template extraction. | `ai/README.md` |
| `auth/` | Login, sessions, OAuth, route guards, authorization, admin permissions, elevated operations, audit logs. | `auth/README.md` |
| `commerce/` | Pricing, subscriptions, entitlements, credits, payment webhooks, and RevenueCat topology/credentials/store QA. | `commerce/README.md` |
| `analytics/` | Product analytics, event taxonomy, telemetry, reporting, KPI dashboards, insight loops. | `analytics/README.md` |
| `messaging/` | Notifications, inboxes, email delivery, webhooks, alerts, and user/system message surfaces. | `messaging/README.md` |
| `sync/` | Local-first data, offline queues, import/export, cloud/LAN sync, conflict resolution. | `sync/README.md` |
| `desktop/` | Tauri/native bridge, localhost API, SDK, secure local runtime, updater/release flow. | `desktop/README.md` |
| `security/` | Secrets, privacy, local trust boundaries, secure operations, threat and abuse review. | `security/README.md` |
| `quality/` | Verification gates, testing strategy, evidence reports, completion audits. | `quality/README.md` |
| `architecture/` | Modular boundaries, monorepo/lane governance, contracts, manifests, system shape. | `architecture/README.md` |
| `i18n/` | Locale architecture, hardcoded string scanning, translation automation, validation, self-heal loops. | `i18n/README.md` |
| `ops/` | Deployment, release readiness, TestFlight packaging, backup/export/restore, observability, admin diagnostics. | `ops/README.md` |
| `ui/` | Design tokens, component states, admin console patterns, product surface patterns. | `ui/README.md` |
| `landing-page/` | Evidence-backed conversion briefs and modular landing-page structures. | `landing-page/README.md` |
| `performance/` | Rendering strategy, caching, data loading, performance budgets, measurement. | `performance/README.md` |
| `game/` | Game preproduction, playable iteration, content/assets, balance, QA, saves, performance, release, and engine adapters. | `game/README.md` |
| `devrules/` | Project-local devrules instance structure, portable Agent context system, and maintenance contract. | `devrules/README.md` |

## Selection Rules

1. Read the domain README first.
2. Open only the templates relevant to the task.
3. Treat examples as illustrative patterns, not required implementation contracts.
4. Prefer local project conventions over these templates when they conflict.
5. If a project produces reusable lessons, write them to its own `devrules/memory/evolution-suggestions.md`; do not directly mutate this shared template library from a project instance.

## Design-System Operating Forms

`product-architecture-brief.md` is the universal product gate form consumed by
`workflows/product-architecture-review.md`. It owns review evidence for product
inputs, capability and surface models, journeys, IA options, decisions,
traceability, and the product-readiness verdict.

The root-level `design-*` files (`design-read.md`,
`design-product-brief.md` compatibility entry, `design-ui-audit.md`,
`design-acceptance.md`, `design-component-spec.md`, `design-page-spec.md`,
`design-screen-inventory.md`, `design-component-inventory.md`,
`design-debt-report.md`, `design-refactor-state.md`,
`design-refactor-task.md`, `design-review-scorecard.md`,
`design-qa-report.md`, `design-handoff-report.md`,
`design-style-package.md`) plus `ui-primitive.tsx.template` and
`DESIGN-CHANGELOG.template.md` are operating forms consumed by the design-system
workflows (`devrules/workflows/design-*.md`), not domain pattern documents.
Their entry point is `devrules/design-readme.md`.

`ios-account-data-decision.md` is an optional decision aid for materially
changed iOS/iPadOS persistence, iCloud, login, ownership, or recovery boundaries.
Use an existing project decision format when available. It records only the
applicable topology, identity/key choices, lifecycle, migration, and regional
gates; irrelevant fields may be `N/A` with a reason.

## Cross-Domain Routes

| Task | Read |
| --- | --- |
| Turn a PRD, brief, research package, or broad redesign into an implementable product model | `devrules/workflows/product-architecture-review.md`, `product-architecture-brief.md`, then `devrules/workflows/design-read.md` and/or `devrules/workflows/architecture-change-review.md` after a passing verdict |
| Build AI feature with admin-configurable providers | `ai/ai-service.md`, `ai/model-routing.md`, `auth/admin-permission.md`, `ops/observability-diagnostics.md` |
| Add prompt library or prompt editor | `ai/prompt-management.md`, `ui/admin-product-ui.md`, `i18n/localization-architecture.md` |
| Review product-owned model capabilities | `ai/model-routing.md`; keep provider request parameters in the project-selected adapter |
| Add custom agents or multi-step automation | `ai/agent-management.md`, `ai/agent-workflows.md`, `performance/performance-optimization.md` |
| Add paid AI credits | `commerce/credits-usage.md`, `commerce/entitlement-gating.md`, `commerce/payment-webhook.md`, `ai/model-routing.md` |
| Integrate RevenueCat across native/Web apps | `devrules/workflows/revenuecat-integration.md`, then the conditional `commerce/revenuecat-topology.md`, `commerce/revenuecat-credentials.md`, and `commerce/revenuecat-store-qa.md` references |
| Add admin console | `auth/admin-permission.md`, `auth/elevated-operations-audit.md`, `ui/admin-product-ui.md`, `ops/observability-diagnostics.md` |
| Prepare production release | `ops/release-readiness.md`, `ops/production-change-plan.md` when state/contracts/clients are affected, `ops/deployment-runbook.md`, `ops/backup-export-restore.md`, `ops/observability-diagnostics.md` |
| Package and distribute a TestFlight build | `devrules/workflows/apple-app-store-launch.md`, then `ops/testflight-packaging.md` |
| Organize developer accounts, external apps, identifiers, credentials, products, environments, and cross-project API reuse | `ops/developer-services-inventory.md`, `security/secrets-privacy.md`, `devrules/workflows/developer-service-configuration-governance.md` |
| Operate Supabase projects across accounts and environments | `ops/developer-services-inventory.md`, `security/secrets-privacy.md`, `devrules/workflows/supabase-project-operations.md` |
| Operate Cloudflare Workers/Pages/resources across accounts and environments | `ops/developer-services-inventory.md`, `security/secrets-privacy.md`, `devrules/workflows/cloudflare-project-operations.md` |
| Internationalize an existing app | `i18n/localization-architecture.md`, `i18n/hardcoded-scan.md`, `i18n/content-change-detection.md`, `i18n/translation-automation.md`, `i18n/validation-self-heal.md` |
| Add analytics or KPI reporting | `analytics/product-analytics.md`, `analytics/telemetry-events.md`, `analytics/reporting-insights.md`, `ui/admin-product-ui.md` |
| Add notifications, inbox, or webhooks | `messaging/notification-center.md`, `messaging/inbox-message-center.md`, `messaging/webhook-integration.md`, `ops/observability-diagnostics.md` |
| Add local-first or cloud sync | `sync/local-first-sync.md`, `sync/offline-queue.md`, `sync/conflict-resolution.md`, `architecture/contract-governance.md` |
| Start or change iOS/iPadOS persistence, iCloud, login, account ownership, primary keys, collaboration, or recovery | `devrules/rules/ios-account-data-model.md`, `devrules/workflows/ios-account-data-architecture.md`, `ios-account-data-decision.md`, then `sync/local-first-sync.md` and `auth/auth-session.md` only as applicable |
| Build desktop/native app runtime | `desktop/native-bridge.md`, `desktop/local-api-sdk.md`, `desktop/desktop-release-updater.md`, `security/local-security.md` |
| Harden sensitive data or secrets | `security/secrets-privacy.md`, `security/local-security.md`, `auth/elevated-operations-audit.md`, `quality/verification-gates.md` |
| Split project into shared and platform-specific layers | `architecture/monorepo-platform-lanes.md`, `architecture/modular-boundaries.md`, `architecture/contract-governance.md` |
| Initialize or evolve the devrules system itself | `devrules/system-blueprint.md`, `devrules/devrules-instance.md` |
| Batch initialize a workspace from a shared template | `devrules/workspace-initialization.md`, `devrules/devrules-instance.md` |
| Capture durable feedback or long-term memory | `devrules/memory-feedback-loop.md` |
| Add or review devrules scripts | `devrules/script-automation.md` |
| Establish or enforce a repo-wide UI design system (DESIGN.md single source of truth) | `ui/design-system.md`, `devrules/design-readme.md`, `devrules/workflows/design-read.md`, `devrules/workflows/design-init-new-project.md` |
| Create, rewrite, or structurally refactor a landing page | `landing-page/README.md`, `landing-page/brief.md`, the selected landing-page template, `devrules/rules/landing-page.md`, `devrules/workflows/landing-page.md` |
| Reconcile conflicting game documents or start game preproduction | `game/README.md`, `game/core/source-of-truth-registry.md`, `game/core/game-concept-brief.md`, `game/core/stage-gates.md` |
| Design, prototype, test, or release a Godot game | `game/README.md`, `game/engines/godot/README.md`, `architecture/modular-boundaries.md`, `quality/verification-gates.md` |
| Extract or apply a reusable named style | `devrules/workflows/design-extract-style.md`, `devrules/templates/design-style-package.md`, `devrules/design-styles/README.md`, `devrules/workflows/design-apply-style.md` |

## Maintenance Rules

- Keep templates provider-neutral unless a provider-specific behavior is essential to the pattern.
- Avoid exact pricing tables, real project IDs, real secrets, and stale deployment URLs.
- Use project names only as case-source signals, not as project-specific instructions.
- Keep domain READMEs aligned with the actual files in each domain.
- Keep `last_reviewed` current when materially changing a template.
