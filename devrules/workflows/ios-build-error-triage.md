---
description: Classify and repair iOS/Xcode build failures with root-cause-first package, DerivedData, module, signing, and preview diagnostics.
ownership: shared
governs: agent
activation: conditional
enforcement: advisory
decision_owner: project
side_effects: local
---

# iOS Build Error Triage

Use this workflow when an iOS, iPadOS, Catalyst, simulator, Xcode Canvas, or native-wrapper build shows multiple errors. The goal is to identify the first root failure, classify the cascades, apply the smallest repair, and verify the same build lane the user is looking at.

## Core Rule

Do not treat Xcode's issue count as the work list. A single package graph, SDK, signing, or module artifact failure can fan out into dozens or hundreds of "unable to resolve module", missing `.swiftmodule`, and dependency scanning errors. Find the first root cause before editing source code.

## Inputs

- User-visible symptom: screenshot, Xcode issue list, or terminal log.
- Active build lane: project or workspace, scheme, configuration, simulator/device, and whether the failure is in Canvas, simulator build, archive, tests, or package resolution.
- Package state: `Package.resolved`, manifest/package references, lockfiles for non-Swift stacks, and the active `SourcePackages` or dependency cache directory.
- Build cache state: active DerivedData path, package checkouts, repositories, module cache, index store, and any alternate successful build cache.
- First failing command/log, not only the final issue navigator summary.

## Category Taxonomy

| Category | Typical symptoms | Root check | Repair lane |
| --- | --- | --- | --- |
| Package graph or product resolution | `Missing package product`, `unable to resolve package`, target cannot find a package product | Inspect package URL/product name in project manifest and `Package.resolved`; check whether package checkouts exist in the active cache | Resolve packages, repair product reference, or seed/refresh only the active package cache |
| DerivedData / package cache divergence | CLI or isolated build succeeds, but Xcode GUI/Canvas fails; active `SourcePackages/checkouts` is empty or partial | Compare active Xcode DerivedData to the known-good DerivedData/package cache using the same `Package.resolved` | Seed from the known-good cache, or delete only the affected project's package cache and re-resolve |
| Nested package or submodule fetch stall | Build hangs at `Resolve Package Graph` or a package checkout submodule | Check whether the submodule is part of a built target or only an upstream fixture/vendor/test asset | Fetch the required dependency; skip submodule update only when it is proven non-build-required and record why |
| Cascading module artifacts | `Unable to resolve module dependency`, missing `.swiftmodule`, `.swiftdoc`, `.abi.json`, `.swiftsourceinfo` | Identify the upstream target/package that failed before these artifacts were produced | Fix the upstream package/target first; do not rewrite imports as a workaround |
| Clang dependency scanning | `Clang dependency scanning failure`, scanner cannot find standard or package modules | Check whether package/module artifacts are missing before blaming Clang | Fix package/module root first; clear module cache only if artifacts are present and scanner still fails |
| SDK/toolchain/deployment mismatch | SDK not found, destination unavailable, incompatible Swift/Xcode version | Check `xcodebuild -version`, SDK path, selected Xcode, destination, deployment target | Select the correct Xcode/destination or update supported build settings |
| Signing or credential prompt | codesign, provisioning, Keychain, Apple ID, private key, `Allow/Deny` dialogs | Determine whether the command may trigger macOS auth prompts | Follow `macos-credential-prompts.md`; do one bounded attempt, then switch to non-interactive setup or one deliberate user authorization window |
| Source/type/resource compile error | Swift type errors, asset/plist/string catalog errors after dependencies are available | Confirm package graph and target dependencies are healthy first | Fix the specific source/resource error with focused tests or build verification |
| Preview/Canvas JIT failure | Product builds but Canvas preview fails, stale preview, JIT executor errors | Check whether the preview host uses production root/state and whether Canvas is using stale build artifacts | Use `ios-live-preview-ui-iteration.md`; update production UI and thin preview host together |

Treat categories 1-3 and 6-7 as likely roots. Treat categories 4-5 as likely cascades until proven otherwise.

## Execution Steps

1. Stop duplicate package resolves/builds for the same project before running new commands. Parallel SwiftPM/Xcode resolves often make cache diagnosis noisy.
2. Capture a fresh build log for the user's active lane. Prefer the real active Xcode DerivedData when the issue is visible in Xcode or Canvas; an isolated temporary DerivedData build is useful for comparison but is not sufficient proof by itself.
3. Extract high-signal errors in order. Useful patterns:
   - `Missing package product`
   - `Resolve Package Graph`
   - `Unable to resolve module dependency`
   - `couldn't be opened because there is no such file`
   - `Clang dependency scanning failure`
   - `SDK .* cannot be located`
   - `CodeSign`, `provisioning`, `keychain`, `No signing certificate`
   - `error:` from the first failing target
4. Classify each visible error as root or cascade. If a package product is missing, resolve that before touching module imports. If a target module artifact is missing, find why its target did not build.
5. Inspect package state:
   - Confirm the product/package exists in project configuration and package lock/resolution files.
   - For app projects, confirm `Package.resolved` or the platform-equivalent lockfile is tracked or intentionally generated. If it is ignored, treat dependency resolution as non-reproducible until the policy is fixed.
   - Confirm the active `SourcePackages/checkouts` and repository cache contain the required package revisions.
   - If another build cache succeeds with the same package revisions, compare it against the active failing cache.
6. Apply the smallest fix:
   - For package cache divergence, seed the active cache from the known-good cache only when the revisions match; otherwise run a targeted dependency resolve.
   - Preserve SwiftPM cache repository origins. Do not change an active `SourcePackages/repositories/*` `origin` from the package's declared URL to a `file://` mirror; Xcode validates the cache against the original URL and may reject it as invalid, then fetch again.
   - When local mirrors are needed to avoid network stalls or reuse a known-good cache, use a temporary Git `url.<file://mirror>.insteadOf <original-url>` configuration for the resolve/build process, or preseed matching checkouts while keeping repository metadata aligned with the project and `Package.resolved`.
   - For a broken active cache without a known-good source, remove only the affected project's package cache or checkout and re-resolve. Do not clear all global DerivedData as a first move.
   - If `xcodebuild test` reaches its diagnostics phase and fails with `xcrun: error: unable to find utility "simctl"` while `DEVELOPER_DIR` is set, inspect `xcode-select -p`. When it still points to Command Line Tools, the diagnostics child may ignore `DEVELOPER_DIR`. Do not require `sudo xcode-select --switch` as the first repair: place a temporary `xcrun` wrapper earlier in `PATH` that exports the intended full-Xcode `DEVELOPER_DIR` and delegates to `/usr/bin/xcrun`, then rerun the exact test command. Keep that wrapper process-local and out of the repository; only request a global toolchain switch if the controlled wrapper cannot reproduce a passing test lane.
   - For nested submodule stalls, prove whether the submodule participates in the build. If optional, skip its update with a recorded rationale. If required, fetch it and verify the package product builds. For upstream package submodules such as GRDB's `SQLiteCustom/src`, prefer a temporary URL rewrite or local mirror over broad DerivedData cleanup.
   - For module and Clang scanning cascades, rebuild after the upstream package/target fix; clear module cache only if the artifacts exist and the scanner still fails.
   - For source errors, make focused code/resource edits after dependency resolution is green.
7. Verify the same lane:
   - Run the project/scheme build on the active destination.
   - If Canvas is the user-visible lane, also refresh or rebuild the preview and confirm package/module errors disappear.
   - If simulator runtime behavior matters, use simulator build/run tools after the build is green.
8. Record a reusable lesson when the failure mode is likely to recur.

## Release Signing Preflight

For device archives, distinguish portal-side registration from local signing
readiness. Do not call an Apple login or portal issue the root cause until the
following local gates have been checked:

1. Verify that Keychain exposes at least one usable distribution/development
   identity with `security find-identity -v -p codesigning`; a certificate
   without its matching private key is not an identity.
2. Decode the selected provisioning profile and verify its name, team,
   application identifier, expiry, entitlement set, and the certificate it
   permits. Confirm that generator/project signing settings select this profile
   rather than relying on stale automatic-selection state.
3. Verify the Apple intermediate certificate chain when a certificate and
   private key appear to match but `find-identity` still reports zero valid
   identities. Missing Apple Worldwide Developer Relations intermediates are a
   local trust-chain issue, not evidence of an expired browser login.
4. Generate the Xcode project from its source of truth after signing changes.
   Do not patch only generated project files when XcodeGen, Tuist, or another
   generator owns those settings.
5. Run one bounded archive for each scheme/archive path. Do not start parallel
   archives while a compiler, signing service, or credential prompt may still
   be active.
6. After success, inspect the archived app with `codesign -d --verbose=4` and
   decode its embedded profile. The signer, team identifier, bundle identifier,
   and `get-task-allow` value must match the intended release lane.

Never record profile contents, private keys, certificate exports, account
credentials, or API tokens in diagnostics or devrules memory.

## Automation-Friendly Error Buckets

Use these buckets for summaries, scripts, or future auto-fix classifiers:

- `package-product-missing`: `Missing package product`, package product target cannot resolve.
- `package-lockfile-ignored`: app/package lockfile exists but is ignored or absent from version control, making dependency resolution depend on local caches.
- `package-resolve-stall`: log remains in package graph resolution or nested checkout/submodule update.
- `deriveddata-package-cache-empty`: active `SourcePackages/checkouts` or repositories are empty while lockfiles require packages.
- `module-artifact-cascade`: missing `.swiftmodule`, `.swiftdoc`, `.abi.json`, `.swiftsourceinfo`, or `Unable to resolve module dependency`.
- `clang-scanner-cascade`: `Clang dependency scanning failure`, especially after a package/module artifact miss.
- `toolchain-sdk-mismatch`: SDK, selected Xcode, destination, Swift version, or deployment target mismatch.
- `signing-credential-block`: codesign/provisioning/keychain/Apple credential issue.
- `source-compile`: real Swift/ObjC/resource/compiler error after dependencies are healthy.
- `preview-canvas-state`: build succeeds but Canvas is stale, on the wrong route/state, or JIT preview-specific.

Each bucket summary should include root/cascade status, first evidence line, affected cache/path if relevant, applied fix, and verification command.

## SwiftPM Cache Repair Guardrails

- Treat `Package.resolved` plus package manifests/project configuration as the source of truth. If they declare the product correctly and the active cache is empty or partial, repair the cache before editing product imports or target dependencies.
- Keep active SwiftPM repository remotes pointing at the package's original URL. Use local mirrors through temporary Git URL rewriting, not by rewriting the active repository `origin`.
- If an Xcode GUI lane fails but an isolated CLI or MCP lane succeeds, compare the exact active DerivedData `SourcePackages` directory the GUI is using. A successful alternate DerivedData proves the source can build; it does not automatically repair Canvas or the Xcode GUI cache.
- Do not use "clean all DerivedData" as the first repair. Target only the affected project's package cache, checkout, repository cache, module cache, or submodule after the root bucket is known.

## Verification

Completion requires evidence that the root bucket is fixed:

- The relevant Xcode or CLI build ends with `BUILD SUCCEEDED`, or the remaining failure is a new first root error with evidence.
- The active dependency cache contains the required package products and revisions.
- Error scans no longer show the original root patterns.
- For Canvas issues, the preview route/state is refreshed and still mirrors production UI.

## Memory Update

Add to `devrules/memory/lessons.md` when a specific package/cache/toolchain failure repeats or teaches a reusable diagnostic. Promote only stack-neutral lessons to the shared template.

## When Not To Use

- Pure UI design changes with no build or preview failure: use the design or live-preview workflow.
- Backend/web-only build failures: use the stack's own build/debug workflow plus `debug-root-cause.md`.
- Release/archive signing flows where credential prompts are the known main issue: start with `macos-credential-prompts.md`, then return here if build errors remain.

Last updated: 2026-07-07
