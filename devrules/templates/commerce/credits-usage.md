---
title: Credits And Usage Accounting
description: Pattern for credit ledgers, reservations, consumption, refunds, usage records, and AI cost accounting.
ownership: seed
governs: product
activation: conditional
enforcement: example
decision_owner: project
side_effects: none
applies_to:
  - AI credit systems
  - usage-based SaaS features
  - export quotas
  - subscription usage limits
  - paid background jobs
use_when:
  - A feature consumes limited units, credits, tokens, jobs, seats, exports, or storage.
do_not_use_when:
  - The product has no limited usage or paid resource consumption.
outputs:
  - usage unit model
  - credit ledger pattern
  - reservation/commit/refund policy
  - reconciliation checklist
  - user/admin usage UI checklist
case_sources:
  - NovelWiki/src/lib/credits
  - NovelWiki/src/components/credits
  - planner-v0/lib/ai/usage-tracking.ts
  - planner-v0/lib/ai/usage-types.ts
  - structureUI/services/api/src/lib/ai-rate-limit.ts
related_workflows:
  - devrules/workflows/debug-root-cause.md
last_reviewed: 2026-06-11
---

# Credits And Usage Accounting

Credits and usage are financial-adjacent product state. Use a ledger mindset even if the first implementation is lightweight.

## Usage Units

Common units:

- AI request
- token estimate
- generated chapter
- image generation
- export job
- storage GB
- seat
- automation run
- translation character
- background job minute

Pick units users can understand, but keep internal mapping flexible.

## Ledger Pattern

Prefer append-only events:

- grant
- purchase
- reserve
- consume
- refund
- expire
- adjust
- migrate

The displayed balance is derived from ledger events or periodically snapshotted with reconciliation.

## Reservation Flow

For long or uncertain operations:

1. Estimate cost.
2. Reserve credits or usage allowance.
3. Execute operation.
4. Commit actual cost.
5. Refund unused reserve or failed operation.
6. Record operation linkage for support.

This prevents race conditions and gives users clear failure recovery.

## Usage Records

Usage records should link:

- actor
- workspace
- feature
- route or job type
- operation ID
- estimated units
- actual units
- model/provider when AI is involved
- status
- timestamp

Do not store full sensitive prompts as usage records.

## User UI

Users usually need:

- current balance or usage
- included quota
- reset date
- recent usage
- failed/refunded operations
- purchase or upgrade path

## Admin UI

Admins may need:

- adjustment form with reason
- user/workspace usage history
- suspicious usage flags
- failed reservation cleanup
- provider cost reconciliation
- export of usage records

All manual changes should go through elevated operations and audit.

## Review Checklist

- Concurrent operations cannot over-consume.
- Failed jobs refund or release reservations.
- Ledger changes are auditable.
- User-visible usage matches server enforcement.
- Provider usage can be reconciled with product usage.
- Expiration and migration policies are explicit.
