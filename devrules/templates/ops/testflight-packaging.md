---
title: TestFlight Packaging And Upload
description: Conditional operating template for versioning, signing, archive/export/upload, processing, compliance, tester groups, and TestFlight iteration.
ownership: shared
governs: release
activation: conditional
enforcement: gate
decision_owner: user
side_effects: external
applies_to:
  - Apple platform TestFlight builds
  - internal and external beta distribution
use_when:
  - A real-device TestFlight package must be built, uploaded, or distributed.
  - A processed build, export compliance, tester group, or beta review must be diagnosed.
do_not_use_when:
  - The task stops at simulator/local build verification.
  - The release does not use TestFlight.
outputs:
  - signed archive and upload evidence
  - processed build and compliance status
  - tester distribution status
  - TestFlight iteration record
case_sources:
  - devrules/workflows/apple-app-store-launch.md
related_workflows:
  - devrules/workflows/apple-app-store-launch.md
  - devrules/workflows/macos-credential-prompts.md
  - devrules/workflows/browser-automation-fix.md
  - devrules/workflows/codex-browser-automation-fix.md
last_reviewed: 2026-07-17
---

# TestFlight Packaging And Upload

Use only after the Apple launch workflow approves product, identifiers,
capabilities, signing target, and the requested external actions. This template
does not authorize upload, tester invitations, Beta Review, App Review, or
source-control/release operations.

## Non-Negotiable Gates

- Bind Apple account/team, app record, bundle ID, platform, marketing version,
  build number, scheme, archive path, credential scope, and tester lane.
- Treat each proposed TestFlight build as a separate release mutation. Before
  changing its build number or uploading it, state why the previous build is
  insufficient, what changed, which local gates passed, and obtain explicit
  user approval for that specific build/upload. Prior upload approval is not a
  standing authorization for later build numbers.
- Show an archive/upload/distribution dry run and obtain explicit approval for
  each external mutation not already authorized.
- Never print/commit API private keys, passwords, sessions, or signing material.
- Run one archive/upload mutation at a time and preserve readback checkpoints.
- Stop after the first Keychain prompt/auth failure; follow
  `macos-credential-prompts.md`.
- Stop after the first archive, export, validation, signing, authentication, or
  upload failure. Diagnose the root cause and batch the smallest coherent fix;
  do not use repeated uploads or sequential speculative patches as discovery.
- Upload success is not distribution success. Verify processing, compliance,
  group/build state, tester eligibility, and installability.
- Beta Review and App Review are separate explicit approvals.
- Do not commit, tag, push, create a release branch, or change release metadata
  merely because a build was uploaded.

## Versioning

- Keep the marketing version stable during one TestFlight release cycle unless
  the user approves a new release version.
- A build number identifies an Apple build; it is not a count of user-requested
  releases or local archive attempts.
- Before allocating the next number, read back whether Apple accepted or
  consumed the current number. Reuse the current number when Apple allows it
  and no upload was accepted; otherwise explain the required increment and get
  approval before changing it.
- Increment the build number for each Apple-accepted replacement upload: for
  example `1.0 (1)`, `1.0 (2)`.
- Do not create `1.0.1`/`1.1` only to retry TestFlight.
- The selected public build may remain under the same marketing version.
- Before App Review, select the intended processed build; submission still
  requires explicit approval.

## Tester Lanes

- Internal testing is for accepted App Store Connect users and is the default
  active-development lane for the developer/account holder.
- External testing is for user-like beta testers. Never add them to Users and
  Access or internal groups as a workaround.
- Prefer stable internal and external groups over ad hoc assignments.
- Verify internal auto-distribution before claiming internal delivery.
- Do not claim external automatic distribution unless current API/UI supports
  it; record Beta Review/manual assignment requirements.
- External beta information may require description, feedback email, review
  contact name/email/phone, and login details. Fill only known facts; never
  invent phone numbers, accounts, or credentials.
- Disable "requires login" when accurate instead of fabricating reviewer access.
- Do not assign a build, notify testers, or submit Beta Review for an inactive
  external lane without explicit user opt-in.

Project-specific tester emails and roles belong in the project's non-secret
launch records, not this shared template.

## Packaging And Upload Checklist

1. Confirm intended platforms, destination, approved scheme/configuration, and
   whether repository release docs allow that configuration to leave the local
   QA lane. A local-only or simulator-only configuration must never be uploaded.
2. Reconcile release docs, scripts, scheme/configuration policy, and upload
   command. Any contradiction blocks the archive/upload path.
3. Verify App ID, capabilities, entitlements, provisioning profile, signing
   identity/private key, Apple intermediate chain, and release settings.
4. Verify decoded profile application identifier/team matches the target.
5. Verify all locally detectable release blockers before upload, including the
   final IPA's effective entitlements/signature, export-compliance declaration,
   privacy manifest, onboarding/seed-data behavior, user-data preservation,
   production feature flags, and absence of local QA overrides.
6. Prefer an approved App Store Connect API key for upload automation.
7. Archive with the repository's official scheme/configuration and unique path.
8. Verify archive signature, embedded profile, Bundle ID, version/build, icons,
   privacy manifest, extension rules, and entitlements.
9. Export with an explicit options file or documented project command, then
   repeat validation against the final upload artifact rather than source files
   or the archive alone.
10. Present the build-specific evidence and upload reason; upload only after
    explicit authority for that build.
11. Record delivery UUID and poll boundedly until processed or a concrete error.
12. Never re-upload blindly. After one rejection/failure, return to root-cause
    diagnosis and the full local gate, then request approval again for any next
    upload.

## Export Compliance

Before claiming deliverability:

- Resolve `Missing Compliance`.
- Inspect the current binary for non-exempt encryption.
- Answer App Store Connect deliberately using current evidence.
- Persist `ITSAppUsesNonExemptEncryption` only when accurate.
- Revisit the decision whenever encryption behavior changes.
- Read back that processed build no longer has unresolved compliance.

## Distribution Checklist

1. Wait until the build is available for testing.
2. Confirm intended internal users are accepted App Store Connect users.
3. Add/verify the internal group and automatic distribution only with approval.
4. For the default internal lane, stop without starting external Beta Review.
5. If the user opts into external testing, use External Testing and validate
   required beta information.
6. Review final button labels; never press `Submit for Beta App Review` or an
   equivalent final action without explicit approval.
7. Verify from API/state and UI when applicable: processed build, compliance,
   selected groups, tester invite/acceptance state, Beta Review state, and
   target-device/account install/download.
8. Record app ID, bundle ID, build, delivery UUID, group, tester state,
   compliance answer, approvals, and residual risks in `docs/app-store/`.

## Iteration Loop

1. Install/run on real target devices.
2. Capture onboarding, first launch, permissions, import, sync, paywall,
   reading/editing, crashes, performance, and visual friction.
3. Convert findings to product/code tasks.
4. Fix meaningfully and pass the full local release gate. Explain why a new
   Apple build is required, then obtain build-specific authority before
   incrementing, re-archiving, or uploading.
5. Repeat until the user accepts a release candidate.

Maintain a concise build ledger that distinguishes `planned`, `local archive`,
`upload accepted`, `processed`, and `distributed`. Never infer upload count or
release authority from the highest configured build number.

Do not submit for App Review merely because processing or installation passed.

## Blocker Map

| Blocker | Response |
| --- | --- |
| Browser appears logged out despite visible session | Prove explicit profile/window; do not infer expiry |
| Portal `/apps` is blank | Treat as authenticated route/container failure; use known page/API |
| Capability/profile mismatch | Align App ID, entitlements, profile, settings; rebuild |
| Keychain prompt loop | Stop and use dedicated keychain/one authorization window |
| Processing delay | Poll boundedly; do not duplicate upload |
| Build number used | Increment, rebuild, and upload with approval |
| Missing Compliance | Inspect binary, answer accurately, persist matching declaration |
| Validation rejection | Fix concrete icon/plist/extension/privacy/entitlement error |
| API 403 | Treat as permission boundary; use only an authorized browser action |
| Internal tester absent | Require accepted App Store Connect user |
| Tester sees developer registration | Remove wrong internal/user invite; use External Testing |
| External setup requires beta information | Fill known facts; request missing required data |
| Final Beta Review button reached | Stop unless that submission is explicitly approved |
| Screenshot disappears | Check Apple format/dimensions and browser local-file access |

## Completion Evidence

- Signed archive, profile, entitlements, Bundle ID, team, version/build match.
- Upload result and processed build readback are recorded.
- Export compliance is resolved accurately.
- Intended group/build mapping and tester eligibility are proven.
- At least one intended target device/account can install when usable delivery
  is the goal, or the exact pending acceptance/review blocker is named.
- Every external mutation has approval and post-write verification.
- No secret or unauthorized source-control/release mutation occurred.
