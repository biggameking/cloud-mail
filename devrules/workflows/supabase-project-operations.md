---
description: Multi-account Supabase project identity, credentials, schema, services, deployment, and verification workflow.
ownership: shared
governs: external_service
activation: explicit
enforcement: gate
decision_owner: user
side_effects: external
applies_to: supabase-projects
---

# Supabase Project Operations Workflow

Use this workflow whenever a project creates, links, configures, migrates,
deploys, audits, or removes Supabase resources. Read
`service-project-operations-core.md` first; it owns the shared goal,
inventory, environment-file, selection-group, preflight, deployment, and
verification contract. Run `developer-service-configuration-governance.md`
first for account, project, credential, environment, consumer, reuse, and
lifecycle decisions. This workflow owns Supabase operations;
`supabase-edge-function-deploy.md` owns the smaller targeted Edge Function
deployment procedure.

## Required Project Record

Follow the core inventory contract. The Supabase-specific non-secret fields
for `devrules/memory/developer-services-inventory.md` are:

- account/organization name and non-secret organization ID when useful;
- project name, project reference, API URL, region, lifecycle status, and
  environment;
- Auth providers, redirect/callback origins, and email/SMS provider ownership;
- migration directory, schemas, extensions, RLS coverage, database functions,
  and backup/restore owner;
- Storage buckets and policy owner;
- Edge Functions, cron jobs, webhooks, third-party integrations, and secret
  logical names;
- canonical environment-variable names, credential consumers, and secret-store
  references;
- the latest CLI/API/Dashboard readback and any drift or cleanup action.

## Local Environment File Contract

Supabase project URLs, public keys, server keys, management tokens, database
URLs, and integration credentials follow the core `.env.local`/`.env`
contract. After resolving a multi-account profile, verify the active project
reference and URL.

## Identity And Credential Lanes

| Lane | Typical material | Allowed consumers | Reuse boundary |
| --- | --- | --- | --- |
| Client/public | Publishable key or legacy `anon` key, project URL | Browser, mobile, desktop, or other untrusted client protected by RLS | Only the intended Supabase project and environment; it is public, not universally interchangeable. |
| Trusted runtime | Secret key or legacy `service_role` key | Edge Function, trusted backend, controlled CI job | Server-side only; project-specific; bypass capability means it must never ship to a client. |
| Management automation | Supabase personal access token or approved management credential | CLI, CI, Management API automation | Bind to the explicit operator/service identity and automation purpose; never use as an application runtime credential. |
| Database administration | Direct or pooler database URL/password | Migration runner, backup/restore, approved server component | Project and environment specific; distinguish direct, session-pooler, and transaction-pooler use. |
| Integration secret | Webhook authorization token, SMTP/API credential, OAuth client secret | Named function or provider integration | One explicit purpose and environment unless provider scope proves safe sharing. |

Use canonical application variable names, such as a project URL plus a
client-public key and a separately named server-secret key. Multi-account local
profiles may map profile-specific secret-store entries into those canonical
names, but deployed code and CI must consume the canonical contract. Do not
make application code branch on a developer's account alias.

### Selectable Supabase Projects

Follow the core selectable-target contract. Supabase specifics: distinct
project references/API URLs with declared account and credential boundaries
are valid alternatives (operator-selected database profiles, independent
customer data planes, failover targets, or a controlled migration pair). For
a profile adapter such as `ACTIVE_SUPABASE_PROFILE=A|B`, keep `PROFILE_A_*`
and `PROFILE_B_*` separate, then materialize only the selected profile into
canonical runtime names. Before any migration, function deployment, release,
or administrative query, prove that the canonical project URL/reference
belongs to the selected profile. Independently hosted projects do not contain
the same users or data, even when they share migrations.

## Hard Target Preflight

Run the core Hard Target Preflight. Supabase specifics:

- Resolve the account/organization, project name, project reference, and API
  URL; a mismatch with the canonical environment configuration blocks the
  operation.
- Inspect the repository's Supabase config, migration directory, generated
  types, functions, storage declarations, and deployment commands.
- Local link state under `.supabase/`, CLI defaults, last-used browser
  sessions, and similarly named projects are discovery hints only; require an
  explicit profile or credential reference and pass `--project-ref` (or
  equivalent) on mutation commands.

## Database And Schema Workflow

Treat versioned migrations in the repository as the schema source of truth.

1. Pull or inspect authoritative remote state before adopting an existing
   project, then establish a clean migration baseline.
2. Create a forward migration for each schema, function, trigger, extension,
   grant, RLS policy, seed-contract, or storage-policy change.
3. Test from a clean local reset or isolated branch when available. Run schema,
   application, RLS, and generated-type checks.
4. Review destructive operations, data transforms, locking risk, backup
   readiness, and the forward-repair plan before production.
5. Compare local and remote migration history. Repair history only with
   evidence; never mark a migration applied merely to bypass an error.
6. Apply migrations to one explicitly named environment at a time, with one
   deployer per project.
7. Read back migration history, schema objects, RLS/policy state, and a safe
   application query after deployment.

Do not use Dashboard SQL or direct production edits as a convenient fallback.
For an approved emergency change, capture the reason and evidence, immediately
reconcile it into a migration, pull/diff remote state, and verify that source
and remote state agree.

## Security Gates

- Enable and verify RLS for every exposed user-data table or view; test both
  allowed and denied access paths using non-privileged identities.
- Treat a server secret/service-role credential as an RLS-bypassing trust
  boundary. Keep it behind a narrow server adapter and never log it.
- Review grants, schema exposure, function execution permissions, and
  `security definer` functions. Pin a safe `search_path` and authorize inside
  the function rather than assuming the caller is trusted.
- Keep administrative and customer-data queries out of browser code even when
  the public key itself is safe to expose.
- Verify Auth redirect URLs, allowed origins, email templates/providers, and
  production rate/abuse controls per environment.
- Keep Storage bucket visibility and object policies explicit; a bucket name or
  signed URL mechanism is not an authorization policy.
- Run provider security checks plus repository secret scanning before release.

## Service Change Sequence

Use the smallest applicable branch:

- **Auth:** update providers, callbacks, templates, and secrets; test signup,
  login, refresh, logout, recovery, and account-linking behavior.
- **Storage:** update bucket/config and versioned policy changes; test object
  ownership, denied access, upload limits, and signed URL expiry.
- **Edge Functions:** follow `supabase-edge-function-deploy.md`; deploy only
  affected functions and verify auth, CORS, logs, and downstream effects.
- **Cron/webhooks/integrations:** record source, destination, auth logical name,
  events, retry/idempotency policy, and health/readback evidence.
- **Backups/restore:** follow `backup-maintenance.md`; a configured backup is
  not complete until restore evidence and ownership exist.

## RevenueCat Web Lane

Follow the core RevenueCat web lane. Supabase specifics:

1. Anchor the stable application user ID in Supabase Auth; do not authorize
   paid access from an anonymous browser-only flag.
2. Prefer a dedicated Supabase Edge Function webhook endpoint with an
   authorization secret, event-id idempotency ledger, fast acknowledgement,
   and deferred processing where needed.
3. Use the trusted Supabase server credential only inside the webhook/backend
   boundary to update an RLS-protected entitlement projection.
4. If Supabase stores the product projection, record RevenueCat as the billing
   authority and the projection's reconciliation/readback policy; do not let
   Cloudflare D1 or browser state become a second conflicting authority.

## Deployment And Verification

Run the core Deployment And Verification sequence. Supabase smoke checks
include health, auth, RLS, function, and webhook behavior relevant to the
change. Code/function rollback does not reverse a database migration or
customer-data change.

## Done Criteria

The core Done Criteria apply, plus:

- Schema changes are versioned, tested, applied serially, and read back.
- RLS, grants, privileged functions, Storage policies, and server-only secrets
  were checked for the affected surface.
- Only the smallest service/function/database target was changed.

## Official References

- [Supabase deployment and branching](https://supabase.com/docs/guides/deployment)
- [Supabase database migrations](https://supabase.com/docs/guides/deployment/database-migrations)
- [Supabase production checklist](https://supabase.com/docs/guides/deployment/going-into-prod)
- [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys)

Last updated: 2026-07-19
