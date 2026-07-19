---
title: RevenueCat Store Products And Purchase QA
description: Conditional reference for real store products, environment lanes, purchase gates, and RevenueCat QA evidence.
ownership: shared
governs: release
activation: conditional
enforcement: gate
decision_owner: user
side_effects: external
applies_to:
  - RevenueCat store product setup
  - sandbox and TestFlight purchase testing
  - production purchase readiness
use_when:
  - Products, offerings, packages, notifications, or purchase evidence are in scope.
do_not_use_when:
  - The task only decides architecture or validates a management credential.
outputs:
  - store product checklist
  - environment-lane status
  - purchase QA evidence
  - release blockers
case_sources:
  - devrules/workflows/revenuecat-integration.md
related_workflows:
  - devrules/workflows/revenuecat-integration.md
  - devrules/workflows/apple-app-store-launch.md
last_reviewed: 2026-07-17
---

# RevenueCat Store Products And Purchase QA

Credential success is not product or purchase success. Every external create,
update, price, availability, notification, attachment, or submission action
still requires the main workflow's target binding, dry run, approval, serialized
mutation, and readback.

## Official References

- `https://www.revenuecat.com/docs/getting-started/displaying-products`
- `https://www.revenuecat.com/docs/getting-started/making-purchases`
- `https://www.revenuecat.com/docs/getting-started/restoring-purchases`
- `https://www.revenuecat.com/docs/getting-started/entitlements/ios-products`
- `https://www.revenuecat.com/docs/test-and-launch/sandbox`
- `https://www.revenuecat.com/docs/test-and-launch/sandbox/apple-app-store`
- `https://www.revenuecat.com/docs/test-and-launch/sandbox/test-store`
- `https://www.revenuecat.com/docs/platform-resources/server-notifications/apple-server-notifications`
- `https://developer.apple.com/help/app-store-connect/test-in-app-purchases/overview-of-testing-in-sandbox/`
- `https://developer.apple.com/help/app-store-connect/test-a-beta-version/testing-subscriptions-and-in-app-purchases-in-testflight/`

## Environment Lanes

| Lane | Use | Required boundary |
| --- | --- | --- |
| Test Store | Fast SDK, paywall, offering, mapping, and restore-UI checks | Never claim Apple receipt or production evidence |
| Sandbox/TestFlight | Real products, sandbox receipts, restore, renewal/refund, install/upgrade | Use real store App public key; transactions remain sandbox |
| Production | Approved products and live build behavior | Requires prior release and metadata gates |

Report lanes separately. Unit tests, StoreKit local testing, and Test Store alone
cannot establish `purchase-qa-ready`.

## Store Product Gate

- App record, bundle ID, capabilities, and platform topology match RevenueCat.
- Agreements, banking, tax, and paid-app prerequisites allow product work.
- Auto-renewable subscription group exists before its products.
- Each product records byte-identical product ID, reference name, duration/type,
  price, availability, localization, review notes/screenshot, tax/category,
  family-sharing decision, and current store status.
- Before mutation, read state and warnings; do not infer missing fields from a
  collapsed portal section or generic browser error.
- After each pass, warnings are empty and territory pricing is complete. Use an
  explicitly approved base territory before equalizing prices.
- First IAP/subscription is prepared with the app version when Apple requires it.

## RevenueCat Product Gate

- Import/create real store products in the intended RevenueCat App.
- Attach each product to the intended entitlement.
- Attach each product to the current offering through the intended package.
- Verify the app public key belongs to that RevenueCat App.
- Never mix Test Store products/keys with sandbox/TestFlight or production.
- Read back identifiers and attachment graph after mutation.

## Notification Gate

- Decide App Store Server Notifications scope for the milestone.
- When required, configure RevenueCat's Apple notification path and appropriate
  production/sandbox URLs.
- Record configured, deferred, or blocked state and reason.
- Do not claim release readiness when required server-side subscription event
  handling is missing.

## QA Ladder

1. Unit-test entitlement mapping, stable identity, missing config, state
   transitions, restore, retention, and plan-change logic.
2. Use Test Store/StoreKit local only for fast app-flow feedback.
3. Use Apple sandbox for purchase, restore, renewal, cancellation, billing
   retry/grace, refund/revoke, interruption, and applicable trial paths.
4. Use TestFlight for first-install and upgrade validation with real products.
5. Repeat purchase/restore/refresh on every shipped Apple platform when
   Universal Purchase is used.
6. Run production smoke only after approval/release, with production-safe key
   injection and bounded customer impact.

For trials or multiple plans, include fresh-account trial, cancellation during
trial, trial expiry and data retention, trial-to-plan change, lifetime purchase
during subscription, reinstall, restore, and effective entitlement timing.

## Evidence Record

After each run, record without private customer data:

- App User ID form (anonymous/stable, not raw sensitive identity).
- Product ID, platform, build, and environment.
- Purchase/restore/scenario and expected policy.
- RevenueCat CustomerInfo/entitlement result.
- App UI and retained-data state.
- Store/RevenueCat event evidence and timestamp.
- Failure, exact blocker, and next authorized action.

## Purchase-Ready Checklist

- Current offering loads real packages on every target platform.
- Fresh sandbox/TestFlight purchase activates intended entitlement.
- Relaunch preserves access across cached and refreshed CustomerInfo.
- Restore activates access for an account with purchase history.
- Renewal, cancellation, billing issue, refund/revoke, and expiry follow policy.
- Trial and plan-change timing follows platform behavior.
- User data remains non-destructive after entitlement loss.
- Signed-in cross-platform identity shares access only where intended.
- First install and upgrade both pass.
- Notification/reconciliation state is verified or explicitly deferred.

## Release Gate

For a first App Store product, prove independently:

- Product metadata is ready and store warnings are clear.
- App version has a processed/selectable build and required metadata/assets.
- Product is attached to the intended version only with explicit approval.
- Submission and production availability remain separate user-authorized
  external mutations.

If any required external input is missing, use `BLOCKED_BY_MANUAL_SETUP` and
name the exact field, account permission, credential, tester, build, metadata,
or approval. Never upgrade status from weaker-lane evidence.
