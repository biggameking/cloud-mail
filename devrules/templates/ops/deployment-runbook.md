---
title: Deployment Runbook
description: Pattern for deployment profile, environments, secrets, CI/CD, platform choices, database state, rollback, and smoke checks.
ownership: seed
governs: release
activation: explicit
enforcement: example
decision_owner: project
side_effects: none
applies_to:
  - web apps
  - APIs
  - serverless functions
  - desktop apps with cloud services
  - worker-based systems
use_when:
  - A project is being prepared for staging, production, or repeatable deployment.
do_not_use_when:
  - The task is a local-only experiment with no persistent users or services.
outputs:
  - deployment profile
  - environment inventory
  - CI/CD contract
  - database/state plan
  - smoke check and rollback plan
case_sources:
  - magic-novel-forge/docs/templates early deployment experience
  - auto-threads/supabase/functions
  - FrameCast/cloud
  - structureUI/services/api
related_workflows:
  - devrules/workflows/release.md
  - devrules/workflows/supabase-edge-function-deploy.md
last_reviewed: 2026-06-11
---

# Deployment Runbook

A deployment runbook should make production changes repeatable. Keep it provider-neutral unless the project has already chosen a platform.

## Deployment Profile

Document:

- application type
- runtime
- build command
- start command
- environment names
- hosting platform
- database and storage
- background jobs
- external providers
- health check endpoint
- rollback method

## Environment Inventory

Group variables by purpose:

- authentication
- database
- storage
- AI providers
- payment providers
- email/notification
- analytics
- feature flags
- deployment platform

For each variable record:

- required or optional
- public or secret
- build-time or runtime
- local/staging/production source
- rotation owner

Never put real secrets in the template or repository docs.

## CI/CD Contract

Typical stages:

1. install
2. lint
3. typecheck
4. unit tests
5. integration tests where available
6. build
7. database migration check
8. deploy
9. smoke check
10. notify or record release

Keep platform commands in project-local docs.

## Database And State

Before deploy:

- migration order is known
- backup exists if migration is risky
- rollback behavior is known
- seed data is separated from production data
- long-running migrations have a plan
- read/write compatibility is considered for rolling deploys

## Smoke Checks

Smoke checks should cover:

- home or app shell
- login/session
- key API route
- database read
- database write if safe
- AI/provider health if relevant
- billing webhook endpoint if relevant
- admin diagnostics if relevant

## Rollback

Define:

- what can roll back automatically
- what needs manual rollback
- whether database migrations are reversible
- how to disable risky features with flags
- who approves rollback
- where incident notes are recorded

## Review Checklist

- Runbook names all required environments and secrets.
- Deployment does not depend on a developer's local machine state.
- Smoke checks are executable and small.
- Rollback criteria are explicit.
- Database migrations have backup/restore considerations.
