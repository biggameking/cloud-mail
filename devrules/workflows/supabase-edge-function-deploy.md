---
description: Supabase Edge Function deployment workflow for projects that use Supabase functions.
ownership: shared
governs: external_service
activation: explicit
enforcement: gate
decision_owner: user
side_effects: external
applies_to: supabase-edge-functions
---

# Supabase Edge Function Deploy Workflow

Use this workflow only in repositories that use Supabase Edge Functions.
Run `developer-service-configuration-governance.md` and the target-selection,
credential-lane, integration, and verification gates in
`supabase-project-operations.md` first. This file is the narrow deployment
branch for one or more explicitly affected functions; it is not a separate
account/project configuration system.

## Trigger

- A file under the project's Supabase function directory changes.
- Function environment variables or secrets change.
- Function routing, authorization, or integration behavior changes.

## Preconditions

- Supabase CLI is installed and authenticated.
- The intended account/organization, project reference, API URL, and environment
  match the project's non-secret inventory and canonical application config.
- The management credential logical name is explicitly selected for this
  account/project. CLI last-link state is not target authority.
- The project reference is available from project config or environment, not
  hard-coded in this template.
- The target environment is known: local, staging, or production.

## Steps

1. Identify the changed function name.
2. Identify changed shared modules, required secret names, auth/JWT behavior,
   CORS policy, webhook idempotency, and downstream database/storage effects.
3. Run local or targeted checks when available.
4. Deploy the smallest affected function:

   ```bash
   supabase functions deploy <function-name> --project-ref <project-ref>
   ```

5. If several functions share changed code, deploy each affected function explicitly.
6. Read back deployment state and verify the function with a smoke request,
   integration test, webhook test, or dashboard/API status.
7. Inspect bounded logs for auth, CORS, runtime, retry, or downstream failures
   without printing secrets or customer data.
8. Update the developer-services inventory and project deployment docs if
   commands, secret names, consumers, or function ownership changed.

## Safety Rules

- Do not store project refs, service-role keys, or function secrets in template rules.
- Do not deploy all functions unless shared code or release policy requires it.
- Do not deploy production functions without understanding the current branch and environment.
- Never expose a Supabase secret/service-role credential to the caller or log.
- A function rollback does not reverse database, Storage, webhook, or external
  side effects; plan those separately.

## Verification

- Confirm deployment completed without CLI errors.
- Confirm the read-back project reference and function belong to the intended environment.
- Confirm the function responds as expected.
- Confirm logs do not show auth, CORS, or runtime failures.
- Confirm idempotency and downstream state when the function receives webhooks
  or performs retries.

Last updated: 2026-07-11
