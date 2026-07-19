---
title: Observability And Diagnostics
description: Pattern for logs, metrics, health checks, admin diagnostics, support views, and runtime evidence.
ownership: seed
governs: product
activation: conditional
enforcement: example
decision_owner: project
side_effects: none
applies_to:
  - production apps
  - AI services
  - billing systems
  - background jobs
  - desktop apps with local runtimes
use_when:
  - Failures need to be debugged without guessing.
  - Admin/support needs safe operational visibility.
do_not_use_when:
  - The project is a throwaway prototype with no persistent runtime.
outputs:
  - event taxonomy
  - health check plan
  - diagnostics surface
  - support checklist
  - privacy/redaction policy
case_sources:
  - DeGit/src/services/diagnostics.ts
  - DeGit/src/services/runtime-diagnostics.ts
  - DeGit/src/services/admin-diagnostics.test.ts
  - NovelWiki/src/components/admin/AdminChapterBillingObservabilityPanel.tsx
  - structureUI/apps/web/lib/ai-assistant.test.ts
  - auto-threads/supabase/functions/generate-daily-report
related_workflows:
  - devrules/workflows/debug-root-cause.md
  - devrules/workflows/release.md
last_reviewed: 2026-06-11
---

# Observability And Diagnostics

Observability gives engineering evidence. Diagnostics gives operators a safe way to inspect system state. Treat them as separate but connected layers.

## Event Taxonomy

Define events for:

- auth/session
- permission denial
- billing/webhook
- AI route execution
- background job
- export/backup/restore
- provider health
- data migration
- admin operation
- user-facing error

Each event should include trace/request ID, actor or system context, operation, status, latency where relevant, and stable error category.

## Health Checks

Health checks can include:

- app runtime
- database connectivity
- storage access
- queue availability
- AI provider configuration
- payment webhook endpoint
- email provider
- background job heartbeat

Separate public liveness from permissioned deep diagnostics.

## Admin Diagnostics Surface

Useful panels:

- environment summary without secrets
- provider configuration status
- recent failed jobs
- webhook processing failures
- AI route failures
- backup/export status
- version/build info
- feature flag state
- permissioned trace lookup

Never show raw secrets. For sensitive payloads, show redacted summaries and require elevated permission.

## Support Workflow

Support should be able to:

- find a user/workspace
- inspect relevant status
- see recent failed operations
- trigger safe retries
- export a diagnostic bundle if allowed
- escalate with trace IDs

Dangerous repair actions belong behind elevated operations.

## Review Checklist

- Logs use stable event names and error categories.
- Sensitive data is redacted by default.
- Health checks distinguish liveness and deep dependency status.
- Admin diagnostics cannot mutate state accidentally.
- Support views show enough evidence to avoid asking engineering for every failure.
