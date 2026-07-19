---
description: Prisma database change workflow for projects that use Prisma.
ownership: shared
governs: product
activation: conditional
enforcement: advisory
decision_owner: project
side_effects: local
applies_to: prisma
---

# Prisma Database Workflow

Use this workflow only in repositories that use Prisma for schema management or database access.

## Core Principles

- Keep schema changes explicit and reviewable.
- Generate clients after schema changes.
- Treat browser/client imports of server-only Prisma code as a defect.
- Handle row-level security, policies, and database-specific features explicitly when Prisma does not manage them.
- Never commit secrets or direct database URLs.

## Trigger

- `prisma/schema.prisma` changes.
- A migration is added, removed, renamed, or edited.
- Database access code changes.
- A user-owned table/model is added or changed.
- Generated Prisma client is stale.

## Steps

1. Inspect the existing Prisma setup and package scripts.
2. Modify `prisma/schema.prisma` or migration files using project conventions.
3. Create a migration through the project's official command, for example:

   ```bash
   npx prisma migrate dev --name describe_change
   ```

4. Regenerate Prisma Client:

   ```bash
   npx prisma generate
   ```

5. If the project uses Supabase RLS or database policies, update policy scripts/docs separately.
6. If the schema stores user-owned data, run the backup/data-safety workflow.
7. Run relevant typecheck, test, or build commands.

## Client/Server Boundary

Prisma belongs on the server side. Do not import Prisma Client into browser bundles, React client components, mobile frontend code, or other client-only runtime surfaces.

If browser code needs data, use an API route, server action, backend service, or generated SDK appropriate to the project.

## Verification

- Migration applies cleanly in the intended environment.
- Prisma Client generation succeeds.
- Database access tests or smoke checks pass.
- No server-only Prisma imports appear in client bundles.
- Backup/export coverage is updated when user data was added.

Last updated: 2026-06-11
