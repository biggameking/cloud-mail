---
description: Universal workflow for safely opening, verifying, and handing off an iOS Simulator without interfering with other projects or test workers.
ownership: shared
governs: device
activation: conditional
enforcement: advisory
decision_owner: project
side_effects: local
---

# iOS Simulator Handoff

Use this workflow whenever an Agent opens or switches a visible Simulator window, launches an app for manual inspection, hands a simulator back to the user, diagnoses an External Display window, or works while several iOS projects or UI-test workers are active.

Read `devrules/rules/ios-simulator-ownership.md` first.

## Goal, Constraints, And Done Criteria

- **Goal:** show the intended project build in the normal window of the exact assigned simulator device.
- **Constraints:** preserve persistent development data; do not touch other projects' devices or processes; do not compete with active UI automation for the shared Simulator foreground.
- **Done:** the exact normal window and intended app are visible, the title does not say `External Display`, the state remains correct after a short stability interval, and the user receives the manual path when requested.

## 1. Resolve The Exact Lane

Read and validate `devrules/memory/ios-simulator-device-profile.json` when the
project uses the shared one-device/two-App contract. Read any additional
project-owned documentation or scripts for
the destination policy, lane (if any), runtime, and device name. The shared
devrules registry does not carry Simulator models, names, counts, or UDIDs. On
the current Mac, use a read-only CoreSimulator device listing to resolve the
project-selected destination to one unique UDID, then record:

- project and scheme;
- lane: Development, QA, Tests, or disposable worker;
- simulator runtime;
- exact device name and UDID;
- expected bundle identifier and build/commit when relevant.
- project-owned bundle allowlist when the selected profile declares this device
  isolated to the project, including relevant test runners, widgets, and
  extensions.

For the default profile, resolve both product roles before work begins:

- `manualAcceptance` is the state-preserving App handed to the user for manual
  clicks and must not be overwritten by an automation build with the same ID;
- `automation` is the separate App identity used by XCTest/UI automation on the
  same UDID, with every runner and extension recorded in `bundleAllowlist`.

Use a disposable exact UDID only when the profile classifies the run as clean
state, destructive device-wide state, identity-sensitive, or an additional
parallel UI worker. A disposable exception is task-scoped, not a new persistent
project lane.

Fail closed when the device is ambiguous. Do not substitute a generic model, the first booted device, or a similarly named device, and do not reuse another Mac's UDID as cross-device authority. When no device profile exists, do not invent a persistent naming or fleet policy; resolve an existing exact destination from the project/user before mutation.

Before the first mutation, claim the exact device lease:

```bash
devrules idle lease-claim --project-id <stable-project-id> \
  --task-id <current-task-id> --udid <exact-udid> --apply
```

Refresh it with `lease-heartbeat` during long Simulator work. A conflicting,
stale, or unknown lease blocks mutation until its owner releases it or the user
resolves the ownership; do not overwrite the device-local registry.

When the selected profile declares project isolation, list the exact device's
user-installed bundles before installation and compare them with the allowlist.
Remove a confirmed foreign project bundle only when this task installed it or
has explicit cleanup authority, then read the list again. Do not erase the
device, remove an unknown bundle, or borrow another project's assigned device
when the destination is unhealthy.

## 2. Preflight Shared Foreground Ownership

Before controlling Simulator UI:

1. Inspect active simulator devices with the full Xcode toolchain selected.
2. Inspect active `xcodebuild`, UI-test runners, `simctl`, hot-reload, and automation processes.
3. Extract destination UDIDs or device names from command lines when available.
4. Classify each active process as this task, another task in the same project, another project, or unknown.

The process check is diagnostic and read-only. Do not print credentials or unrelated environment values.

Treat an unknown process that may control Simulator UI as a competing foreground owner until it is identified.

If another project or worker is running UI automation, or an unknown process may control Simulator UI, record that foreground ownership is unavailable. In that state:

- background builds and exact-UDID inspection may continue;
- exact-UDID install/terminate operations may continue only when they cannot affect the other owner;
- application launch, window switching, Simulator restart, rotation, screenshots intended as final evidence, and manual handoff must wait or be reported as blocked;
- never stop the competing process without explicit authorization.

## 3. Open The Normal Device Window

Prefer the user's manual path for handoff:

1. Open the **Simulator** application normally.
2. If the device window already exists, choose `Window → <exact device name> – <runtime>`.
3. Otherwise choose `File → Open Simulator → <runtime> → <exact device name>`.

Do not use Xcode's generic device-type `Open In` menu as a substitute for the Simulator device menu; it may collapse custom device names into repeated model labels.

Automation may drive the same Simulator menus when foreground ownership is available. It must not use `-CurrentDeviceUDID` as a visual handoff shortcut.

## 4. Launch And Verify The Intended App

After the normal window is selected:

1. Confirm the title exactly identifies the assigned device and runtime.
2. Confirm the title does not contain `External Display`.
3. Install the intended build on the explicit UDID without uninstalling or erasing the persistent development device unless the task explicitly requires clean state.
4. Launch the expected bundle only after foreground ownership is available.
5. Verify a product landmark from the intended app rather than relying on process-launch success.
6. When build provenance matters, verify the installed build or commit marker matches the delivery source of truth.
7. Wait a short stability interval, normally 5–10 seconds, then re-check the frontmost window title and product landmark.
8. For user handoff, convert the task lease into a time-bounded manual
   reservation with `lease-reserve-manual`, an explicit reservation duration,
   and `--apply`. If no manual handoff remains, use `lease-release --apply`.

If another window becomes frontmost during the interval, do not fight it. Re-run the ownership preflight and identify the competing process.

## 5. Recover From Wrong Window Types

### External Display auxiliary window

- Close only the auxiliary window.
- Do not treat its black content as an app failure.
- Reopen the normal device window through `Window` or `File → Open Simulator`.
- Do not restart Simulator globally if another owner is active.

### Another project keeps taking focus

- Inspect active UI-test/build destinations.
- Report the owning project/process category and target device.
- Wait or ask for authorization before stopping it.
- Do not repeatedly reopen or relaunch the desired device.

### Simulator menu or UI is stuck

- First dismiss only the affected menu/window.
- A Simulator app restart is allowed only after the preflight proves there is no competing foreground owner and the restart will not disrupt user-authorized work.
- Never use a global restart as the first recovery step.

## 6. Handoff Report

Report:

- exact device name and UDID used;
- whether another foreground owner was detected;
- normal window title verified;
- intended app landmark verified;
- stability re-check result;
- manual menu path;
- anything not verified.
- bundle-isolation result when the selected device profile requires it,
  including whether this task removed any bundle it owned.
- lease state and reservation expiry, or explicit release result.

Do not claim the simulator is ready when only the device is booted, the launch command returned a PID, the wrong window is frontmost, or another test can immediately take control.
