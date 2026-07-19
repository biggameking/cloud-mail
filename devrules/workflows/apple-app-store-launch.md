---
description: Apple App Store launch workflow for identifiers, TestFlight, metadata, capabilities, review, and promotion.
ownership: shared
governs: external_service
activation: explicit
enforcement: gate
decision_owner: user
side_effects: external
---

# Apple App Store Launch Workflow

Use this workflow for Bundle ID registration, TestFlight, App Store Connect,
App Review, ASO/AEO, capabilities, screenshots, pricing, regions, signing, or
launch promotion.

Read the project entry, `always-readme.md`, and workflow-management rules first.
Run against the concrete repository, not a workspace parent selected only by a
runtime locator. Initialize/sync local devrules first when absent.

Before creating, reusing, rotating, or removing Apple identifiers, credentials,
products, or integrations, run
`developer-service-configuration-governance.md`. Maintain the non-secret
developer-services inventory as the canonical cross-provider map.

For packaging, upload, processing, compliance, tester groups, and TestFlight
iteration, conditionally read `../templates/ops/testflight-packaging.md`.
For subscriptions and RevenueCat, also run `revenuecat-integration.md`.

## Operating Contract

Apple launch work combines product, marketing, compliance, identity, signing,
and irreversible external effects.

- Require a current approved iOS account/data decision before capability choices
  for a new app or material persistence, iCloud, login, ownership, or recovery
  change. Run `ios-account-data-architecture.md` when missing/stale.
- Settle brand/search positioning before registering identifiers or finalizing
  store metadata.
- Assess the current brand before proposing renames.
- Derive capabilities and platform scope from code, entitlements, requirements,
  and approved product decisions.
- Do not invent form values, descriptions, phone numbers, reviewer credentials,
  cloud/privacy claims, or unsupported platform promises.
- Present options and obtain user decisions at product/compliance gates.
- Do not edit identifiers, names, project files, metadata, or external forms
  until the relevant proposal is approved.
- Dry-run external writes with account, team, app, identifier, environment,
  field values, consequences, and rollback/recovery limits.
- Require explicit approval before App ID creation, capability/profile changes,
  credential changes, first build upload, tester invitation, pricing/region
  save, Beta Review, or App Review submission unless the exact action is already
  authorized in the current request.
- Preserve a readback checkpoint after every external side effect.
- TestFlight is a required product loop, not proof of App Review readiness.
- Never commit, tag, push, or create release branches unless explicitly asked.

## Browser, Portal, Credential, And Signing Gates

Treat these as independent evidence chains:

1. **Controlled browser:** prove the selected current-session profile/window
   matches the user's visible account/app. Enumerate candidates and select an
   explicit browser ID; never let a generic alias choose silently.
2. **Portal rendering:** distinguish authenticated blank/partial route failures
   from an authentication boundary. Use bounded checks and known parent pages.
3. **Signing assets:** prove a local signing identity with private key and
   intermediate chain, matching provisioning profile, entitlements, team, and
   App ID.
4. **API credentials:** validate only through supported provider APIs/tools.
   Browser failure is not credential failure and does not authorize key creation.

After thread resume, reconnect, browser restart, or visible browser change,
re-prove controlled context. If it cannot match the visible logged-in page,
report `controlled Chrome profile unproven`, not session expiry.

Before archive/upload, record non-secret proof of signing identity, decoded
profile/application identifier, and a signed archive whose embedded profile and
signature use the same team. Run one archive per project/archive path at a time.

Apply `browser-automation-fix.md`,
`codex-browser-automation-fix.md`, and `macos-credential-prompts.md` as
applicable. Stop after the first credential prompt/auth failure; use bounded
operations and never expose private keys or tokens.

## Phase 1: Project Intake

Read:

- PRD, README, roadmap, release docs, website, and marketing sources.
- Xcode project/generator source of truth, targets, schemes, platforms, signing.
- Bundle IDs, entitlements, Info.plist, localization, and privacy manifests.
- StoreKit products, subscriptions, paywall logic, and RevenueCat integration.
- Existing app-store docs and approved iOS account/data decision.

Produce a fact map:

- Brand, localized display names, user, job, and product promise.
- Intended platforms based on targets and explicit scope, not portal capability.
- Bundle ID, App Groups, iCloud containers, StoreKit IDs, APNs topic, Keychain
  groups, URL schemes, and associated domains.
- Engineering project/target/scheme/module/archive/test names.
- Login, iCloud, push, AI, payments, UGC, encryption, children,
  finance/health, signing, and regional compliance surfaces.
- Identity lane, data authority/owner, immutable keys, external mappings,
  sign-out/account-switch behavior, migration status, and decision artifact.

For a first Apple app, explain the normal order: Identifiers/App ID, required
signing/profile assets, App Store Connect record/materials, then
archive/upload/TestFlight. Start elsewhere only for an evidenced blocker.

Phase guardrail: start from product truth and intended platform promises, not
Apple form fields or every platform the portal can display.

## Phase 2: Interactive Decisions

For product-facing choices, present 5-10 options where meaningful, with a
recommendation, pros/cons, downstream impact, and exact proposed values:

- Keep/change brand, positioning, app name, and subtitle.
- Bundle ID namespace and platform/app-record strategy.
- Capabilities now versus deferred.
- Categories, locale keyword bank, and screenshot story.
- Pricing/IAP/subscription approach and regions.
- Review-note positioning and public promotion copy.

Stop for user decision before:

- Brand change, App ID registration, or broad release-identifier change.
- First build upload.
- Final store name, subtitle, category, SKU, price, or regions.
- Compliance/provisioning-impacting capability changes.
- Mainland China availability or external marketing publication.
- Beta Review or App Review submission.

Check current policy for encryption, login, payments, children, health,
finance, UGC, and mainland China instead of relying on memory.

For mainland China, separately assess APP filing; website ICP filing/applicable
license; every domain, IP, hosting provider, or access resource including third
parties; and category documents. Local-first/iCloud, no custom backend/domain,
or Sign in with Apple alone does not prove exemption.

Phase guardrail: product, compliance, account-authority, and irreversible
choices are explicit user decisions, never inferred from form defaults.

## Phase 3: Brand And Search Positioning

Assess current brand for:

- Product/use-case fit and high-intent search clarity.
- Memorability, pronunciation, ownership, and recommendation.
- Differentiation from generic utilities, plugins, or clones.
- Expansion across platforms, pricing, website, docs, and related products.
- Conflict, spelling, abbreviation, and misleading-promise risk.

If strong, recommend keeping it and continue; do not create rename options
unless requested. If materially weak, present candidate directions and wait for
choice before changing anything.

Create/update `docs/app-store/` drafts:

- Positioning and canonical AEO entity sentence.
- Persona, jobs, high-intent scenarios.
- Name/subtitle candidates with character counts.
- Locale keyword banks within Apple's current limits; avoid repeating
  title/subtitle/category words.
- Description, promotional text, screenshot story, review notes, and launch
  copy tied to implemented behavior.
- Website metadata/schema targets when relevant.

Phase guardrail: freeze approved product language before identifiers; search
copy must describe real users and workflows, not generic keyword stuffing.

## Phase 4: Identifier And Capability Strategy

Prefer explicit App IDs and an operationally justified reverse-domain namespace.
For one ecosystem product across Apple platforms, prefer a platform-neutral
Bundle ID and shared record only when targets and entitlement model support it.
Do not force multi-platform scope or preserve `.ios`/`.mac` suffixes without an
intentional separate-record/migration reason.

| Capability | Enable only with evidence |
| --- | --- |
| iCloud/CloudKit | iCloud data/documents are implemented and approved |
| App Groups | Targets/extensions share approved containers |
| Push | Remote or CloudKit subscription/silent push exists |
| Background Modes | Implemented audio/location/Bluetooth/processing/remote notification |
| In-App Purchase | Digital goods/subscriptions and store setup exist |
| Sign in with Apple | App account or third-party login requires it |
| Associated Domains | Universal links, passkeys, web credentials, or App Clips exist |
| Keychain Sharing | Approved targets share credentials |
| Apple Pay/Wallet/Health/Home/NFC | Product requirement and compliance path exist |

iCloud does not require Sign in with Apple. Optional login must not re-key local
or iCloud content. If login is account-principal evidence, prove linking,
migration, merge, recovery, unlinking, and deletion behavior.

Capability changes require matching App ID, entitlements, profiles, builds, and
review notes. Missing code/config alignment is a signing/build blocker, not just
a portal checkbox.

Phase guardrail: enable implemented capabilities, document deferred migration
cost, and keep iCloud, app accounts, and third-party login distinct.

## Phase 5: Local Alignment And Rename

Separate release identifiers from engineering names. For pre-launch apps, align
release identity and then perform only the approved scoped rename:

- Update XcodeGen/Tuist/Bazel/etc. source of truth first.
- Align projects, targets, schemes, product names, app structs, tests,
  directories, scripts, archive paths, and UI-test flags.
- Leave historical docs separate unless they feed current store materials.
- Record intentionally deferred old names.

Verify project/scheme list, build settings, Bundle ID, entitlements, Info.plist,
signing identity, selected-platform builds, and active-source old-name scans.
Treat duplicate scheme output as blocking only after inspecting real scheme
files and target selection.

Keep release identifiers stable after upload unless migration cost is explicitly
accepted. Document temporary engineering-name debt and follow-up checks.

Phase guardrail: pre-launch alignment is cheapest before testers, subscriptions,
screenshots, support docs, and public search signals exist.

## Phase 6: App Store Connect Materials

Draft before portal entry:

- Name, subtitle, SKU, categories, age-rating assumptions.
- Description, promotional text, what's new, privacy summary, locale keywords.
- Screenshot/preview story by supported device class.
- Review path, login/test account, paywall, iCloud/offline behavior, hardware,
  test data, and known reviewer constraints.
- Pricing/IAP/subscription mapping, regions, and compliance notes.

Verify every claim. Title/subtitle carry strong positioning; keywords fill gaps;
description explains concrete workflow, user, local/cloud/privacy behavior, and
platform scope; review notes reduce reviewer uncertainty.

Phase guardrail: each platform is a separate promise even under one App ID;
metadata, assets, behavior, and review paths must match actual target support.

## Phase 7: Authorized Portal Execution

Only fill approved values after reading current state.

1. Prove browser/API account, team, app, and environment.
2. Search existing App IDs, records, profiles, keys, products, and testers to
   avoid duplicates.
3. Present exact field/capability mutations and dry-run consequences.
4. Confirm approval for the specific external action.
5. Apply one bounded mutation.
6. Read back and checkpoint resulting identifiers/state.
7. Stop before final Register, upload, price/region save, Beta Review, or App
   Review submission unless specifically authorized.

For TestFlight, authorization is build-specific: before changing a build number
or uploading a replacement, explain why the currently processed/local candidate
is insufficient and present the completed local release evidence. A previous
upload request does not authorize additional build numbers or upload attempts.

Prefer App Store Connect API keys and dedicated signing keychains for supported
automation. A 403 is an authority boundary; use a signed-in browser only for the
specific approved action, not to broaden credential permissions.

For TestFlight packaging/upload, follow
`../templates/ops/testflight-packaging.md`. Upload success alone is not
TestFlight success: processing, export compliance, groups/testers, and
installability must be verified.

Phase guardrail: browser automation executes settled strategy; API and browser
failures remain independent, and every external write has a readback checkpoint.

## Phase 8: Validation And Release Decision

Run applicable checks:

- Current Apple documentation/policy and field limits.
- Xcode project list, build settings, and selected-platform builds.
- `plutil` for Info.plist/entitlements and StoreKit config validation.
- Signing/profile/archive validation without repeated prompts.
- Static release audit, localization/visible strings, and old identifier scan.
- Screenshot/icon dimensions, format, color mode, and upload acceptance.
- TestFlight processing, export compliance, intended tester availability, and
  real-device install/run.
- Privacy, pricing/IAP, regions, review notes, and residual compliance blockers.

Record commands, evidence, external readbacks, approvals, and residual risk in
`docs/app-store/`.

Do not submit for App Review because one build processed. Continue real-device
feedback, meaningful fixes, new build numbers, metadata/assets/privacy,
pricing/IAP, region, and review preparation until the user accepts a release
candidate and explicitly approves submission.

Phase guardrail: first TestFlight success starts the release loop; it does not
finish launch preparation or authorize source-control/review actions.

## Completion Criteria

- Product/platform/account-data facts are current and approved.
- Brand, identifiers, capabilities, store fields, pricing, and regions have
  explicit decisions where required.
- No external mutation occurred without target binding, dry run, authority,
  serialized execution, and readback.
- Secrets/private keys were neither printed nor committed.
- Signing identity, profile, entitlements, archive signature, and team match.
- Store metadata/assets accurately reflect implemented supported behavior.
- TestFlight packaging checklist passes or exact blockers are named.
- Real-device TestFlight feedback was resolved or accepted as residual risk.
- Relevant builds, plist/config/static/localization/asset checks pass.
- App Review/Beta Review submission remains separately approved and evidenced.
- Documentation and non-secret developer-services inventory are current.
- No commit, tag, push, release branch, or release metadata change was made
  without explicit user instruction.

## When Not To Use This Workflow

- Non-Apple release with no Apple dependency: use `release.md`.
- Generic SEO unrelated to App Store metadata: use `seo-optimization.md`.
- Pure implementation before launch decisions: use normal architecture and
  verification workflows first.

Last updated: 2026-07-19
