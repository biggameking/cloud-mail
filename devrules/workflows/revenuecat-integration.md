---
description: RevenueCat integration, subscriptions, store credentials, paywalls, and purchase QA workflow.
ownership: shared
governs: external_service
activation: explicit
enforcement: gate
decision_owner: user
side_effects: external
---

# RevenueCat Integration Workflow

Use this workflow for RevenueCat projects, apps, SDKs, subscriptions, in-app
purchases, premium gates, paywalls, store credentials, MCP/REST automation, web
billing, or purchase QA.

Before creating or changing any external resource, run
`developer-service-configuration-governance.md`. Keep the project's non-secret
developer-services inventory current. This workflow owns implementation and
verification, not a second configuration ledger.

Also run `apple-app-store-launch.md` when Apple identifiers, Universal Purchase,
StoreKit, TestFlight, App Store metadata, review, or Apple credentials are in
scope.

## Conditional References

Open only the references needed for the task:

- `../templates/commerce/revenuecat-topology.md` for project/platform/Web
  billing/backend topology, identity, entitlement authority, client
  architecture, trials, plan changes, and data retention.
- `../templates/commerce/revenuecat-credentials.md` for project-local
  MCP/Management API access, REST fallback, Apple credential handling, secure
  upload, and credential-upload troubleshooting.
- `../templates/commerce/revenuecat-store-qa.md` for store product setup,
  notification gates, environment lanes, purchase scenarios, and QA evidence.
- `browser-automation-fix.md` for generic browser-control discipline.
- `codex-browser-automation-fix.md` for Codex browser route/session failures.

The main workflow remains authoritative for routing, approvals, sequencing,
status, safety, verification, documentation, and completion.

## Operating Contract

RevenueCat work has four ownership lanes. Completion requires every applicable
lane, not merely app code or Dashboard setup.

| Lane | Owns | Required evidence |
| --- | --- | --- |
| Product/architecture | Entitlement meaning, packages, identity, platform sharing | Approved decision and entitlement contract |
| App code | SDK, central service, paywall, purchase/restore, safe missing config | Tests, builds, smoke evidence |
| RevenueCat | Project, Apps, Products, Entitlements, Offerings, Packages, public keys | Project-local MCP/REST readback or screenshot |
| Store | Credentials, real products, pricing, availability, notifications, purchase lane | Boolean credential status and sandbox/TestFlight QA |

Default sequence:

1. Confirm commercial scope and whether RevenueCat is required now.
2. Decide topology, billing authority, identity, and platform sharing.
3. Approve entitlement, offering, package, and product identifiers.
4. Implement the SDK behind one central subscription service.
5. Dry-run intended Dashboard/store mutations and show target account, project,
   app, environment, identifiers, and consequences.
6. Obtain explicit user approval before external mutations unless that exact
   mutation was already authorized in the current request.
7. Configure RevenueCat through project-local official MCP or REST.
8. Configure store credentials through an approved secret-backed path.
9. Configure real store products, metadata, pricing, availability, and
   notification routing.
10. Run local verification, then Test Store, sandbox/TestFlight, and production
    lanes as applicable.
11. Read back every external mutation and update non-secret project records.

Do not make product-facing, account-authority, credential-scope, pricing,
availability, submission, or production choices on the user's behalf.

## Status Model

- `app-code-ready`: central service, safe missing config, testable entitlement
  state, and local tests/builds pass.
- `test-store-ready`: Test Store drives app-flow checks; no real-store evidence
  is implied.
- `configured`: intended RevenueCat resources exist, public key storage is safe,
  credential boolean readback succeeds, and secret checks pass.
- `product-ready`: real products match identifiers and metadata, store warnings
  are cleared, and products attach to the intended entitlement/offering/package.
- `purchase-qa-ready`: sandbox/TestFlight purchase, restore, renewal, and
  entitlement refresh pass on target platforms.
- `release-ready`: build and first product submission gates are ready; required
  metadata, screenshots, notifications, and remaining blockers are explicit.

Never promote status using evidence from a weaker environment lane.

## Safety And Authority Gates

- Never commit or print RevenueCat management secrets, webhook tokens, Apple
  `.p8` contents, service-account JSON, bearer tokens, cookies, or signing keys.
- Never place raw secrets in source, docs, reports, terminal arguments,
  `devrules/memory/`, Info.plist source, Xcode project files, or package metadata.
- RevenueCat Dashboard automation must use the current repository's ignored
  `.env.local` value `REVENUECAT_MCP_API`; never silently reuse a global key.
- Add `.env.local` and local key directories to ignore rules before writing
  credentials.
- Public SDK keys may reach their intended client, but production values still
  follow the project's secure build-injection path.
- Web clients receive only the intended Web App public key. Management,
  webhook, and backend credentials stay in a trusted runtime.
- Bind account, project, app, store, bundle/package ID, environment, credential
  scope, and requested mutation before any write. Fail closed on mismatch.
- Prefer team/account credentials for durable integrations when available;
  preserve least privilege and explicit consumer/trust-boundary records.
- Use bounded commands for Keychain, signing, browser, and store operations.
  Stop after the first prompt, authorization failure, or unexplained stall.
- Do not create, rotate, revoke, upload, submit, price, publish, or change
  availability without explicit authority for that side effect.
- Serialize mutations against one store account. Poll one operation to a
  terminal state before starting the next.
- On rate limiting, record the operation, wait a bounded cooldown, retry once
  serially, then read state. Never fan out equivalent writes.
- Name exact blockers; do not imply production or purchase readiness.

## Required Decisions

Before implementation, record non-secret answers:

- Product boundary and RevenueCat Project/App topology.
- Platforms, Universal Purchase or separate records, and Web billing lane.
- Stable App User ID, anonymous/login/merge/restore behavior, and account owner.
- RevenueCat billing truth and the single application entitlement projection.
- Entitlement, offering, package, and byte-identical store product IDs.
- Trial, subscription group, upgrade/downgrade/crossgrade, lifetime, and data
  retention behavior.
- Store credential trust boundary and consumers.
- Active environment lane and evidence required to advance it.
- Web checkout, tax/refund owner, webhook receiver, deduplication, retry, and
  reconciliation path when Web is in scope.
- Notification scope and any deliberate milestone deferral.

Use `revenuecat-topology.md` to resolve these decisions. Stop for user choice
when evidence conflicts or the decision changes product behavior.

## App Implementation Gate

The app must:

- Configure RevenueCat once through a central subscription service.
- Expose one entitlement state to feature gates; views do not call RevenueCat
  directly.
- Map one stable signed-in user consistently across platforms when sharing is
  intended.
- Treat anonymous identity, login, logout, aliasing, restore, and merge as
  explicit flows that never re-key or delete user content.
- Handle a missing public key as setup-required/free-plan behavior, not a crash.
- Load offerings, packages, localized prices, and trial metadata dynamically.
- Keep Restore Purchases visible.
- Gate premium commands without deleting or destructively converting user data
  after cancellation, expiry, refund, billing retry, or revocation.
- Preserve previously verified access through transient network/read failures
  according to the approved policy.

Unit tests must cover entitlement mapping, identity stability, missing config,
purchase state transitions, restore, and applicable retention/plan-change paths.

## RevenueCat Configuration Gate

Use `revenuecat-credentials.md` before MCP/REST or Apple credential work.

Required pre-write smoke:

1. Load the repository-local credential without printing it.
2. Read the intended RevenueCat project and app.
3. Match project name, app bundle/package ID, environment, entitlement,
   offering, and product IDs to repository facts.
4. Present the intended create/update operations as a dry run.
5. Confirm external-mutation approval.

Required configuration/readback:

- Project and store-specific App match the approved boundary.
- Entitlement exists.
- Real products exist and attach to the entitlement.
- Current offering exists and packages attach to it.
- Public SDK key is stored through the approved local/build path.
- Real-store credential state is verified through non-secret boolean/status
  fields.

Use REST when first-class MCP cannot consume the project-local key or targets a
different account/project. REST is not permission to bypass approval, secret
handling, schema validation, or readback.

## Store And Release Lanes

Use `revenuecat-store-qa.md` for setup and checklists.

Keep these lanes separate:

| Lane | Valid evidence | Cannot prove |
| --- | --- | --- |
| RevenueCat Test Store | SDK wiring, offering/paywall UI, entitlement mapping, restore UI | Apple receipts, real products, sandbox renewal, TestFlight, production |
| Sandbox/TestFlight | Real-store purchase, receipt validation, restore, renewal/refund, install/upgrade | Production review approval or live billing |
| Production | Approved-product live purchase/restore and production entitlement behavior | Missing earlier gates |

TestFlight uses sandbox transactions with the real store App public SDK key and
real products, never Test Store products or keys.

For a first App Store subscription, independently prove:

1. The subscription is ready to submit.
2. The new app version has its build and required metadata.
3. The ready product is attached only after explicit submission authority.

Do not mark `purchase-qa-ready` from unit tests, local StoreKit, or Test Store
alone. Do not mark `release-ready` until sandbox/TestFlight evidence and store
metadata readiness are both addressed or exact blockers are named.

## RevenueCat-Specific Browser Deltas

Apply the generic browser workflows linked above, then:

- Prove the selected Dashboard account, project, App, and bundle/package ID from
  visible landmarks before a RevenueCat write.
- Treat a connected MCP/global credential that targets another RevenueCat
  project as an account-boundary failure; switch to project-local MCP/REST.
- Prefer MCP/REST for non-visual resource configuration and readback.
- Use Dashboard UI only when the needed RevenueCat action is unavailable through
  approved API tooling.
- For Apple credential upload, verify accepted file/type requirements and local
  file-access permission before retrying; use the credential template's
  root-cause checklist rather than repeated uploads.
- Keep important user tabs open and preserve the latest readback/checkpoint.

A browser route/profile failure does not prove RevenueCat authentication or
Apple credentials are invalid. Diagnose each evidence chain independently.

## Verification

Local:

- Relevant unit/integration tests and platform builds pass.
- Secret scan covers touched files, key blocks, API/bearer tokens, and known
  prefixes.
- `git check-ignore` proves local credential files/directories are ignored.
- `git ls-files` proves `.p8`, `.env.local`, and local credential inventories
  are untracked.
- `git diff --check` passes.

External:

- Project-local MCP/REST readback targets the intended project/app.
- Store app and bundle/package ID match.
- Products attach to intended entitlement, offering, and packages.
- Public key exists in secure storage without being printed.
- Apple credential status reads configured without exposing credential values.
- Product price/duration/availability/localization/review metadata match.
- Notifications are configured or explicitly deferred with a reason.
- Sandbox/TestFlight purchase and restore activate expected entitlement.
- Cross-platform identity shares access only as approved.
- Web billing, webhook authentication/filtering/idempotency/retry/reconciliation,
  and the single entitlement projection pass end to end when applicable.

If external setup blocks a check, report `BLOCKED_BY_MANUAL_SETUP` and the exact
missing field, account permission, approval, or credential.

## Documentation

Maintain only non-secret records:

- Integration/launch report with project/app/product identifiers, lane status,
  evidence, blockers, and dates.
- Canonical developer-services inventory with provider/account/app mappings,
  credential names/scopes/consumers/status, and lifecycle.
- Local ignored credential inventory with key names, IDs, paths, secret-store
  names, purpose, status, and last verification date; never raw values.
- Project decision and lesson records when required by local devrules policy.

Do not write raw secrets to any documentation or memory file.

## Done Criteria

RevenueCat work is complete only when:

- Current official docs were checked for each used SDK/API/store surface.
- Required topology, authority, identity, product, and lifecycle decisions are
  approved and recorded.
- App code uses a central entitlement service and safe missing configuration.
- Public client keys are injected safely; secrets are neither printed nor
  tracked.
- Every external mutation was authorized, serialized, and read back.
- Dashboard/store resources are configured or exact blockers are named.
- Product metadata and entitlement/offering/package wiring are complete or an
  exact `product-ready` blocker is named.
- Test Store, sandbox/TestFlight, and production statuses are reported
  separately.
- Applicable purchase, restore, renewal, cancellation, refund/revoke,
  plan-change, retention, identity, and Web reconciliation QA passes, or is
  `BLOCKED_BY_MANUAL_SETUP` with specific missing inputs.
- Tests, builds, secret checks, ignore/tracking checks, and project reports pass
  and are current.
