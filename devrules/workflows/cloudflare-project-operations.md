---
description: Multi-account Cloudflare identity, token, resource, binding, migration, deployment, rollback, and verification workflow.
ownership: shared
governs: external_service
activation: explicit
enforcement: gate
decision_owner: user
side_effects: external
applies_to: cloudflare-projects
---

# Cloudflare Project Operations Workflow

Use this workflow whenever a project creates, configures, deploys, migrates,
audits, or removes Cloudflare Workers, Pages, domains, routes, storage, queues,
AI resources, environment bindings, or automation credentials. Read
`service-project-operations-core.md` first; it owns the shared goal,
inventory, environment-file, selection-group, preflight, deployment, and
verification contract. Run `developer-service-configuration-governance.md`
first for account, credential, environment, reuse, consumer, and lifecycle
decisions. Cloudflare adds a least-privilege token requirement to the core
goal: bind every automated operation to one explicit scoped token.

## Required Project Record

Follow the core inventory contract. The Cloudflare-specific non-secret fields
for `devrules/memory/developer-services-inventory.md` are:

- account name and account ID; zone/domain ownership when applicable;
- each Worker, Pages project, environment, route, custom domain, cron trigger,
  and deployment pipeline;
- D1 database, R2 bucket, KV namespace, Queue, Durable Object, Vectorize index,
  service binding, and other resource IDs/names;
- the exact binding name → resource → environment map declared by the canonical
  Wrangler configuration;
- non-secret variable names, secret logical names, consumer deployables, and
  secret-store references;
- token logical name/ID, permission set, account/resource scope, consumer,
  rotation/revocation policy, and last verification;
- current deployment/version identifier, migration state, health endpoint, and
  latest provider readback.

Several Workers, Pages projects, or storage targets may intentionally coexist;
they must not be collapsed merely because they share one Cloudflare account or
Wrangler repository.

## Local Environment File Contract

Cloudflare automation credentials and local project environment values follow
the core `.env.local`/`.env` contract. Cloudflare specifics:

- Typical local automation names include `CLOUDFLARE_API_TOKEN` and
  `CLOUDFLARE_ACCOUNT_ID`; a file containing `CLOUDFLARE_API_TOKEN`, a Global
  API key, database credential, or webhook secret must be ignored by Git.
- Wrangler may not automatically load every repository-specific filename in
  every command path. The project deployment wrapper must explicitly load the
  chosen file and export only the allowlisted Wrangler system variables needed
  by that command.
- Local Worker runtime variables may also use the project's supported
  `.dev.vars`/environment-specific mechanism, but this does not replace the
  canonical `.env.local`/`.env` automation credential contract. Document any
  mapping between them.

## Credential And Reuse Rules

| Resource | Classification | Rule |
| --- | --- | --- |
| Account ID / zone ID / resource ID | Non-secret identity | Record and compare before writes; an ID does not grant access by itself. |
| Scoped API token | Conditionally shared secret | Prefer one token per account, environment class, automation purpose, and permission set. Reuse only when all four plus the consumer trust boundary match. |
| Account-owned API token | Account automation secret | Prefer for durable automation when supported; bind it to one account and narrow resources/permissions. |
| User API token | Ephemeral/rotatable secret | Record the human owner and offboarding/role-change trigger; avoid making an individual's broad token an anonymous shared CI credential. |
| Global API key plus email | Legacy broad credential | Do not introduce for new automation. Migrate to scoped API tokens where the required API supports them. |
| Worker/Pages runtime secret | Deployable/environment-specific secret | Store with the provider's secret mechanism; never place in Wrangler `vars`, source, or bulk-copied environment files. |
| Non-secret `vars` and bindings | Versioned deployment config | Keep names and intended values/resources in canonical configuration; review environment inheritance and replacement behavior. |

Different Cloudflare accounts require different token identity. A token may be
shared across several deployables only when they are in the same account and
the provider scope, permission, environment policy, purpose, owner, consumers,
and blast radius are intentionally identical. Convenience alone is not reuse
evidence.

If a project can select between Cloudflare accounts, deployables, D1 databases,
or other stateful targets, model the alternatives as a selection group under
the core selectable-target contract.

## Hard Target Preflight

Run the core Hard Target Preflight. Cloudflare specifics:

- Resolve `CLOUDFLARE_ACCOUNT_ID` plus the API-token logical name without
  printing values.
- Verify the token with the Cloudflare verification endpoint or a bounded
  read-only command, then confirm the returned identity can access the
  intended account and resources.
- Inspect the exact Wrangler config path and environment. Compare deployable
  names, compatibility settings, routes/domains, bindings, and resource IDs
  with provider readback.
- Inventory required variables and secrets by name. Distinguish plain config,
  runtime secret, Wrangler system credential, and local-only development
  value.
- Use an explicit `--env <environment>` or the equivalent canonical
  environment selection for every environment-specific command. A local
  `.env.<environment>` or profile may extend the canonical `.env.local`/`.env`
  contract when the project documents its precedence, but the selected account
  and environment must still be verified. If identity or a binding target is
  ambiguous, fail closed.

## Configuration Source Of Truth

- Treat the selected `wrangler.jsonc`, `wrangler.toml`, or equivalent generated
  config as the source of truth for deployable names, compatibility settings,
  bindings, plain variables, routes, and environments.
- Keep secrets in Cloudflare secrets and an approved local/CI secret store.
  Commit only required secret names when the tooling supports declarations.
- Never bulk-copy every process or `.env` value into a Worker/Pages project.
  Use an allowlist classified as `plain variable` or `secret`, and exclude
  Cloudflare credentials, database admin URLs, management tokens, and unrelated
  project values.
- Treat Dashboard configuration as live-state readback, not a second casual
  source of truth. Reconcile intentional Dashboard-only values into the
  documented ownership model.
- Review deploy semantics before adding or changing `vars`; configuration can
  replace Dashboard-managed values. Do not commit an empty variable block as a
  harmless placeholder.
- Generate and validate binding/environment types when the project supports it.

## Resource And Migration Gates

Before deployment, enumerate every referenced resource and prove the ID/name
belongs to the selected account and environment:

- D1 database and migration directory/history;
- R2 buckets and object lifecycle/CORS policy;
- KV namespaces and cache/consistency expectations;
- Queues, producers, consumers, retry/dead-letter behavior;
- Durable Objects and required class migrations;
- Vectorize/AI indexes and model/resource ownership;
- service bindings, dispatch namespaces, cron triggers, routes, and domains.

For D1, keep sequential migrations in source control, list pending migrations,
and explicitly choose local or remote execution. Prefer the immutable database
name or verified database ID over a reusable binding alias when applying remote
migrations. Apply to one database/environment at a time, then read back the
migration table and a safe schema/application query.

Treat Durable Object migrations and destructive storage changes as separate
high-risk data operations. A successful Worker code rollback does not reverse
D1, KV, R2, Queue, Vectorize, or Durable Object state.

## Deployment Sequence

1. Run targeted tests, type checks, build/bundle, configuration validation, and
   a local/preview smoke test.
2. Capture the intended account, environment, deployable, source/config
   fingerprint, pending migrations, binding map, and current deployment ID.
3. Back up or establish forward-repair evidence for risky data changes.
4. Apply required migrations serially and read them back before code that
   depends on them receives production traffic.
5. Deploy the smallest affected Worker, Pages project, or configuration target.
   Do not deploy every service merely because several live in one repository.
6. For high-risk Workers, upload a version and verify a preview/version target
   before promotion or use a deliberate gradual deployment when the project's
   release policy supports it.
7. Read back the active deployment/version, routes, bindings, and resource
   identities from Cloudflare.
8. Run HTTP/API health checks plus relevant cron, queue, storage, database,
   domain, TLS, and downstream integration checks.
9. Inspect bounded logs and error metrics without exposing secrets or customer
   data; update the inventory and deployment record.

## Rollback And Recovery

- Record the previous known-good deployment/version before release.
- Worker version rollback restores code/configuration captured by that version,
  but not changes in associated storage. Verify current bindings still exist
  and remain compatible before rollback.
- Do not describe code rollback as a database rollback. Use backward-compatible
  migrations, forward repair, or an approved/tested restore path.
- If a binding/resource was deleted or a Durable Object migration occurred,
  treat rollback eligibility as unproven until Cloudflare readback confirms it.
- After rollback, rerun identity, binding, migration, health, domain, queue, and
  integration checks and record the new active deployment.

## RevenueCat Web Lane

Follow the core RevenueCat web lane. Cloudflare specifics:

1. Keep secret/management credentials in Worker secrets or another trusted
   backend; use a Queue or deferred task for longer webhook work.
2. If Supabase is the application database, Cloudflare should act as
   gateway/processor and write through the defined Supabase server boundary;
   do not create an independent D1 entitlement authority by accident.
3. Record webhook environment/app filters, secret logical name, consumer,
   retry/reconciliation policy, and provider readback in the inventory.

## Done Criteria

The core Done Criteria apply, plus:

- Token identity/scope and every binding target were explicitly matched before
  mutation.
- Plain variables, runtime secrets, Wrangler credentials, and local-only values
  are classified and transferred only through allowlists.
- D1 or other stateful migrations were applied serially and read back.
- Active version/deployment, routes, bindings, health, and downstream behavior
  were read back after deploy or rollback.
- Code rollback and data recovery are documented as separate mechanisms.

## Official References

- [Cloudflare API token creation and scope](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/)
- [Wrangler system environment variables](https://developers.cloudflare.com/workers/wrangler/system-environment-variables/)
- [Workers secrets](https://developers.cloudflare.com/workers/configuration/secrets/)
- [Workers environment variables](https://developers.cloudflare.com/workers/configuration/environment-variables/)
- [Cloudflare D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/)
- [Workers versions and deployments](https://developers.cloudflare.com/workers/versions-and-deployments/)
- [Workers rollbacks](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/)

Last updated: 2026-07-19
