---
description: Universal safety rules for iOS Simulator device isolation, foreground-window ownership, and cross-project coordination.
ownership: shared
governs: device
activation: conditional
enforcement: advisory
decision_owner: project
side_effects: none
---

# iOS Simulator Ownership

CoreSimulator devices isolate application data, but the macOS Simulator app is one shared foreground UI. Different UDIDs prevent data corruption; they do not prevent another project's UI test, launch, or window command from changing the visible simulator window.

## Ownership Model

- **Device ownership** covers one explicit simulator UDID, its boot state, installed apps, containers, permissions, keychain, files, and logs.
- **Foreground ownership** covers the shared Simulator app, its active window, menus, External Display windows, orientation, scale, and user-visible focus.
- A task may mutate its assigned device without owning another device. It may control the shared foreground only after proving that no other active project or test owns it.
- A booted device is not proof that its normal main window is open, frontmost, stable, or showing the intended application.

## Device Profile Boundary

This shared rule does not choose a Simulator model, runtime, name, number of
devices, or single-device policy. Those are project/device-profile decisions.
A profile may select a persistent project device, isolated development and test
lanes, shared explicitly assigned devices, or disposable devices. The default
project profile is one persistent device with two distinct product identities
installed together: a state-preserving manual-acceptance App and a separate
automation App. The automation App, its UI-test runners, widgets, and extensions
belong in the same exact bundle allowlist.

Store that selection at
`devrules/memory/ios-simulator-device-profile.json`, seeded from
`devrules/templates/quality/ios-simulator-device-profile.template.json`, and
validate it with `node devrules/scripts/ios-simulator-profile.mjs --profile
devrules/memory/ios-simulator-device-profile.json`. A project may choose a
different documented profile, but must not silently create a second persistent
device merely because automation is running.

Preserve the project's existing selection. When no profile or project-owned
destination exists, use read-only discovery and obtain an explicit destination
for mutating work; do not create, rename, erase, or delete persistent devices
merely to match a shared-template example.

## Required Invariants

1. Resolve the exact project lane and UDID before any mutating `simctl`, `xcodebuild`, Xcode, or Simulator action, and before accepting device-specific evidence. Read-only discovery may list booted devices, but never use `booted`, a generic device name, or another project's device as the mutation or verification target.
2. Before opening, switching, restarting, rotating, or otherwise controlling Simulator UI, inspect active `xcodebuild`, UI-test, automation, and simulator-launch processes and identify their destination UDIDs when available.
3. If another project or concurrent worker is running UI automation, foreground ownership is unavailable. Do not compete for focus. Continue only with background-safe work, wait when explicitly requested, or report the blocker.
4. Do not terminate another project's tests or processes without explicit authorization.
5. While another simulator owner is active, do not run global UI actions such as `killall Simulator`, Close All, global shutdown, or unscoped Simulator restarts.
6. Do not use `open -a Simulator --args -CurrentDeviceUDID ...` for visual handoff. It does not prove a normal device window and can surface an External Display auxiliary window.
7. A visual handoff must use the normal Simulator window selected by exact runtime and device name. Its title must match the intended device and must not contain `External Display`.
8. Point-in-time success is insufficient. Re-check the exact frontmost window and visible application after a short stability interval before declaring readiness.
9. When the user asks to open the simulator manually, provide the exact Simulator menu path and stop automating the foreground unless the user asks for further control.
10. When the selected device profile declares a persistent device isolated to
    one project, its user-installed applications must match that project's
    bundle allowlist. Test runners, widgets, and extensions produced by the
    project count as owned applications.
11. When isolation is part of the selected profile, compare user-installed
    bundles on the exact UDID with the project-owned allowlist before accepting
    test or visual evidence. Remove a confirmed foreign bundle only when the
    current task owns that contamination or has explicit cleanup authority. If
    ownership is unknown or the app is active, fail closed and preserve the
    device; never erase it as cleanup.
12. If the current task contaminates another project's device, stop using it,
    remove only the bundles installed by the current task, verify the original
    project's allowlist remains, and resolve an authorized destination matching
    the current project's selected device profile before continuing.
13. Before a task mutates or relies on a persistent Simulator, claim an exact
    device-local lease with project ID, task ID, and UDID. Refresh the heartbeat
    during long Simulator work; explicitly release it when finished, or create
    a time-bounded manual reservation when handing the device to the user.
14. Classify devices as `ACTIVE`, `MANUAL_RESERVED`, `PROVEN_INACTIVE`, or
    `UNKNOWN`. Only an explicit release or an expired reservation that was
    explicitly authorized for reclaim proves inactivity. A stale heartbeat,
    missing process, device-directory timestamp, or absent lease is `UNKNOWN`,
    not idle.
15. Count above the soft target never authorizes cross-task interruption. When
    sustained pressure remains after every proven-inactive device is exhausted,
    report the condition to the user in the observing task first. Do not send a
    cross-task, cross-thread, or cross-session message unless the user explicitly
    asks for that notification. An authorized notification may ask the oldest
    active lease owner to release one exact UDID, but it does not authorize
    stopping, interrupting, killing, or cleaning the owning task. Refusal,
    silence, or identity ambiguity stays in the observing task's report.
16. In the default one-device/two-App profile, manual and automation bundle IDs
    must differ while both target the same exact project device. Persistent-device
    automation is single-worker and app-container-only. Clean-device-state,
    destructive device-wide state, identity-sensitive, and parallel UI-worker
    runs use task-owned disposable devices and tear them down under the same task.
17. A cross-task notification is advisory only. The receiving task must not
    mutate its device, processes, build, or artifacts until the user confirms
    that exact action in the receiving task. Do not send automatic acknowledgments,
    progress updates, completion notices, or "resource restored" messages between
    tasks. One user-authorized release request is the maximum for one pressure
    episode and exact UDID; later updates remain in the observing task unless the
    user explicitly requests another notification.

## Prohibited Recovery Shortcuts

- Do not erase or recreate a persistent development device to fix a window-selection problem.
- Do not restart the shared Simulator app while another project is testing merely to clear a stuck menu or focus state.
- Do not repeatedly relaunch the target app while another UI test is stealing focus; diagnose the competing owner first.
- Do not treat an External Display window, black auxiliary window, stale generic device, or test harness terminal state as acceptance evidence.
- Do not use another project's named device as a temporary healthy fallback, even for headless unit tests.

Use `devrules/workflows/ios-simulator-handoff.md` for the operational preflight, opening, recovery, and verification sequence.

## Idle Boot Pressure

Booted devices can consume significant memory, but the shared rule does not set
a universal hard maximum. The shared maintenance seed uses three devices as a
soft target and current machine pressure to decide whether cleanup is useful.
Idle maintenance must remain
read-only until a shutdown action is authorized by the selected profile or the
user, skip UDIDs owned by active tests or builds, and never erase or delete
persistent devices as routine pressure cleanup.
