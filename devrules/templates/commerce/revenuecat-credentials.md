---
title: RevenueCat Credentials And Secure Upload
description: Conditional reference for RevenueCat MCP/REST credentials, Apple IAP keys, secure upload, and root-cause troubleshooting.
ownership: shared
governs: external_service
activation: conditional
enforcement: gate
decision_owner: user
side_effects: external
applies_to:
  - RevenueCat Dashboard automation
  - Apple store credential configuration
use_when:
  - MCP or Management API access is required.
  - Apple IAP credentials must be stored, uploaded, rotated, or diagnosed.
do_not_use_when:
  - The task only changes app UI with no credential or Dashboard access.
outputs:
  - credential scope and storage decision
  - authenticated project readback
  - non-secret credential status
  - credential failure diagnosis
case_sources:
  - devrules/workflows/revenuecat-integration.md
related_workflows:
  - devrules/workflows/revenuecat-integration.md
  - devrules/workflows/developer-service-configuration-governance.md
  - devrules/workflows/browser-automation-fix.md
  - devrules/workflows/codex-browser-automation-fix.md
last_reviewed: 2026-07-17
---

# RevenueCat Credentials And Secure Upload

This template adds detail to the main workflow. It never authorizes external
mutation. Dry-run, account binding, explicit approval, and readback remain
mandatory.

## Official References

- `https://www.revenuecat.com/docs/tools/mcp`
- `https://www.revenuecat.com/docs/tools/mcp/setup`
- `https://www.revenuecat.com/docs/service-credentials/itunesconnect-app-specific-shared-secret/in-app-purchase-key-configuration`
- `https://developer.apple.com/help/app-store-connect/configure-in-app-purchase-settings/overview-for-configuring-in-app-purchases/`

## Secret Safety

- Never commit, print, log, document, or place in CLI arguments any management
  key, webhook secret, bearer token, `.p8` contents, cookie, or signing key.
- Never store raw secrets in source, reports, memory files, Info.plist source,
  Xcode files, package metadata, or shell scripts.
- Add `.env.local` and local key paths to ignore rules before writing secrets.
- Use `700` directories and `600` temporary/key files; delete temporary request
  and config files immediately.
- Store only non-secret names, IDs, paths, scopes, consumers, status, and last
  verification dates in inventories.
- Stop after the first Keychain prompt, auth failure, or stall. Do not loop
  secret access or browser upload.

## Credential Distinctions

| Item | Scope | Rule |
| --- | --- | --- |
| RevenueCat public SDK key | One RevenueCat App/client | Intended client only; production value uses secure injection |
| `REVENUECAT_MCP_API` | Management API account/project access | Secret; repository-root ignored `.env.local` |
| App Store Connect API/upload key | ASC automation/upload | Not the RevenueCat Apple IAP credential |
| Apple IAP Key ID | One IAP key | Metadata; project-scoped secret store |
| Apple Issuer ID | Apple team/account | Metadata; validate as a clean UUID |
| Apple `.p8` | Private signing material | Secret; secure key folder/manager, never source control |

Prefer team/account keys for durable integrations. Apple IAP keys may serve apps
in one account; split by trust boundary, not mechanically per app. Record every
consumer. Revoke/replace after leak, loss, or ownership change and rerun QA.

## RevenueCat MCP And REST

Official endpoint: `https://mcp.revenuecat.ai/mcp`.

Project-local standard:

1. Read `REVENUECAT_MCP_API` from repository-root `.env.local`.
2. Never fall back silently to a globally configured RevenueCat MCP key.
3. Smoke-read the target project/App and match account boundary, project name,
   bundle/package ID, entitlement, offering, and product IDs.
4. Show the planned writes and obtain required external-mutation approval.
5. Prefer official MCP only when it is proven to consume that key and target.
6. Otherwise use Management API REST with bearer data kept out of output and
   arguments.
7. Discover/validate the current API schema before writes.
8. Read back created/updated resources without exposing credentials.

For Apple App updates, credential fields belong under `app_store`; top-level
`subscription_private_key`, `subscription_key_id`, or
`subscription_key_issuer` fields indicate an invalid payload shape.

## Apple Metadata Validation

Before every upload:

- Trim and validate Issuer ID as exactly one 36-character UUID with no quotes,
  backticks, commas, spaces, fences, or copied punctuation.
- Validate IAP Key ID as the clean identifier, commonly 10 uppercase
  alphanumeric characters, matching the `.p8` filename.
- Confirm the file is an In-App Purchase key, not merely an API/upload key.
- Confirm key team/account, RevenueCat App, and bundle ID match.
- Validate shape without printing values.

Visually plausible metadata is insufficient; hidden punctuation can cause Apple
signature rejection while RevenueCat reports only a retryable server error.

## Secure Upload Procedure

1. Confirm exact account/project/App/bundle target and approved credential trust
   boundary.
2. Confirm mutation authority and present a dry run.
3. Verify ignored secure path/secret-manager storage and permissions.
4. Validate `.p8` locally with `openssl pkey -in <file> -noout`.
5. Read Issuer ID and Key ID from project-scoped secure storage.
6. Validate shapes and filename relationship without outputting values.
7. Build a `600` temporary request file from secure inputs.
8. Send through proven project-local MCP/REST file-based input.
9. Delete temporary files immediately.
10. Read back `subscription_key_configured: true` or equivalent boolean status.
11. Update only non-secret inventory and integration status.

## Root-Cause Troubleshooting

Do not keep retrying failed uploads.

Check:

- `.p8` parses and is the intended IAP key.
- Key ID matches filename; Issuer ID is a clean UUID.
- Key, issuer, bundle ID, and app belong to the same Apple boundary.
- Normal RevenueCat reads/writes succeed with the repository-local key.
- Direct and explicit-proxy non-secret tests isolate network path without
  exposing credentials.
- Official Apple App Store Server Library or equivalent accepts the credential
  combination. Prefer official tooling over hand-rolled JWT probes; DER ECDSA
  signatures can create false 401 conclusions.
- REST payload nests Apple fields under `app_store`.
- Browser file access and accepted file constraints are verified only after
  generic browser workflows pass.

| Symptom | Likely cause/action |
| --- | --- |
| No key in account settings | Public SDK keys are under project Apps/API keys |
| Missing IAP key/bundle banner | Complete Apple app credential mapping |
| Configured boolean is false | Upload was not accepted; validate before retry |
| Existing key named for upload | Keep its purpose; use an actual IAP key |
| Active-key limit reached | Reuse by approved trust boundary or rotate/revoke |
| Unexpected credential fields | Correct `app_store` nesting |
| Retryable 500 | Validate downstream Apple credential metadata exactly |
| Official Apple tool returns 401 | Team/key/type/metadata/propagation mismatch |
| Browser can list tabs but not navigate | Follow Codex browser route workflow |

## Completion Evidence

- Credential scope, owner, consumers, storage, and lifecycle are recorded
  without values.
- Account/project/App target was proven before mutation.
- Explicit authority and dry-run evidence exist.
- Temporary material was deleted and ignore/tracking checks pass.
- Boolean/status readback confirms configuration.
- No secret appears in logs, docs, memory, Git, or final summary.
