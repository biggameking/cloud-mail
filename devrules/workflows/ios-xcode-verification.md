---
description: Risk-tiered iOS/Xcode verification that reuses one build-for-testing across focused unit and UI test runs.
ownership: shared
governs: agent
activation: conditional
enforcement: advisory
decision_owner: project
side_effects: local
---

# iOS/Xcode Verification

Use this workflow for local Xcode builds or tests when the task changes Swift,
Objective-C, Metal, app resources, Xcode project settings, or iOS UI behavior.

## Required Inputs

- Exact `.xcodeproj` or `.xcworkspace`, scheme, and test destination UDID.
- A task-owned DerivedData path outside the repository.
- Verification tier from `verification-plan.mjs` or explicit risk judgment.
- Focused test identifiers for a focused change.
- A valid `devrules/memory/ios-simulator-device-profile.json` when a persistent
  project Simulator is used.

Never target `booted` or a generic device name. Follow
`rules/ios-simulator-ownership.md` before mutating a device or running UI tests.
Validate the profile before the first persistent-device mutation:

```bash
node devrules/scripts/ios-simulator-profile.mjs \
  --profile devrules/memory/ios-simulator-device-profile.json
```

## Matrix

| Tier | Build lane | Test lane | Escalation |
| --- | --- | --- | --- |
| Low | Compile only when executable/build inputs changed. | No blanket test run; run the owning generator/resource check. | Raise if project/build metadata changed. |
| Focused | One incremental `build-for-testing`. | One or more `test-without-building -only-testing:...` runs. Re-run flaky candidates with iterations using the same build. | Add the affected test class or UI path when the focused result exposes broader risk. |
| Broad | One `build-for-testing` for the selected scheme/destination. | Affected unit/integration/UI suites with `test-without-building`; full scheme only when the changed contract truly spans it. | Add archive/signing/device lanes only when release or packaging boundaries changed. |

## Execution

1. Confirm the exact UDID exists, the automation App uses the profile's distinct
   bundle identity on that same device, inspect active xcodebuild/UI-test owners, and
   boot/wait for only the task-owned device when needed.
2. Resolve packages once. Do not delete DerivedData before attempting an
   incremental build.
3. Run `build-for-testing` once into the task-owned DerivedData path.
4. Run all selected suites with `test-without-building` against that same path.
5. If only a test source changed, rebuild once, then resume
   `test-without-building`; do not use `xcodebuild test` for every retry.
6. Separate unit and UI batches. UI tests require foreground ownership and are
   expected to be slower; do not make them the default proof for model-only work.
   Keep the persistent device at one UI worker. Route clean-state, destructive,
   identity-sensitive, or additional parallel workers to task-owned disposable
   devices instead.
7. Record build time, test execution time, selected tests, destination, and
   xcresult path. Diagnose worker materialization/launch stalls separately from
   actual test runtime.

Generate a safe command sequence when the helper is available:

```bash
node devrules/scripts/xcode-verification-plan.mjs \
  --project App.xcodeproj --scheme App --udid <UDID> \
  --derived-data /tmp/app-task-derived \
  --tier focused --only-testing AppTests/FeatureTests
```

The helper plans commands; it does not boot devices, launch Simulator, or run
Xcode. Review the plan before execution.

## Failure Boundaries

- A successful isolated DerivedData build proves source buildability but does
  not repair a broken Xcode GUI/Canvas cache.
- A timeout waiting for workers/install/launch is infrastructure evidence, not a
  failing assertion. Preserve the xcresult and retry only the blocked lane.
- Do not clear all DerivedData, restart Simulator globally, or stop another
  project's process as a generic recovery step.
