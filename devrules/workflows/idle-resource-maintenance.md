---
description: Seed workflow for device-scheduled monitoring and safe cleanup of idle Simulator processes, memory pressure, DerivedData, CoreSimulator caches, SwiftPM .build, Rust target/, and Gradle build/ artifacts.
ownership: seed
governs: device
activation: explicit
enforcement: advisory
decision_owner: project
side_effects: local
---

# Idle Resource Maintenance

Keep developer machines responsive by reclaiming safe Simulator boot/process
pressure, observing sustained macOS memory pressure, and removing stale Xcode
DerivedData / CoreSimulator caches, SwiftPM `.build`, Rust/Cargo `target/`, and
Gradle `build/` trees after long idle periods (default: 30 days for disk
artifacts). The default Simulator capacity is a soft target of three Booted
devices, not a hard maximum.

## Scheduler Status And Explicit Enablement

1. On Windows or macOS, the SessionStart scheduler check is read-only:

```bash
node devrules/scripts/idle-resource-maintenance.mjs agent-status --json
# or: devrules idle agent-status --json
```

   This command may inspect scheduler registration and managed files, but it
   must not create directories, wrappers, LaunchAgents, scheduled tasks, or
   other persistent state. Missing, disabled, stale, or misconfigured
   schedulers are reported; SessionStart does not repair them by default.

2. Installation or repair is a separate device-maintenance decision. Use a
   dry-run first, then apply only when the user or project has explicitly
   selected device-local scheduling:

```bash
node devrules/scripts/idle-resource-maintenance.mjs install-agent
node devrules/scripts/idle-resource-maintenance.mjs install-agent --apply
node devrules/scripts/idle-resource-maintenance.mjs ensure-agent --apply --json
```

   A device owner may deliberately enable SessionStart repair for that
   environment with `DEVRULES_IDLE_SCHEDULER_AUTO_REPAIR=1`. Absence of that
   exact opt-in keeps SessionStart status-only.

3. If an explicitly enabled scheduler is healthy and configuration-current,
   Agents may rely on the schedule and only run a lightweight `pressure` /
   `status` when Simulator count, memory pressure, or disk growth is visible in
   the current task.

4. If status inspection fails or the scheduler is unsupported, report that
   device automation is unavailable. Run project-local `pressure` / `status` /
   `plan` only when the current task or an explicit project policy calls for
   maintenance; do not turn an unhealthy status into an implicit install.

## Purpose And Trigger

Use this workflow when:

- the Booted count is above the configured soft target and sustained macOS
  memory pressure or explicit Simulator lag is present;
- Simulator.app is open with no booted devices;
- a repository or workspace has large idle `target/`, `.build`, or DerivedData
  folders;
- the user asks to free memory/disk after unused Apple, Rust, or Swift work;
- a SessionStart read-only check reports that an explicitly desired scheduler
  is not healthy.

## Safety Contract

- Default is dry-run (`status` / `plan`). Mutation requires `--apply`.
- Simulator count alone never authorizes shutdown. Automatic planning requires
  sustained reliable pressure samples or `--simulator-lag-observed`.
- One maintenance pass may plan at most one Simulator shutdown. Apply samples
  pressure and rechecks exact-UDID ownership again immediately before shutdown.
- An unavailable owner inventory, unresolved controller, active owner, or
  changed pressure state blocks shutdown. Absence of evidence is not evidence
  that a device is idle.
- Never erase or recreate a named persistent project Simulator to free space.
- Do not shut down a Simulator UDID that an active `xcodebuild` / XCTest owner
  is using.
- Respect `devrules/rules/ios-simulator-ownership.md`: no global
  `killall Simulator` while another owner is active.
- Do not delete `~/.cargo/registry` or `node_modules` by default.
- Do not run privileged `purge` / memory scrubbers; reclaim RAM by shutting
  unowned Simulators and quitting idle Simulator.app after the final planned
  shutdown.
- Do not automatically kill arbitrary `cargo`, `rustc`, dev-server, IDE, or
  user processes from a global age heuristic. A project Agent may stop only a
  process it can prove belongs to its completed task.
- Before scanning or removing DerivedData, Rust `target/`, SwiftPM `.build`, or
  Gradle `build/`, inspect active build processes. If the matching toolchain is
  active—or process inventory is unavailable and the target cannot be proven
  unrelated—defer that artifact lane and retry after the build finishes.
- Re-check the process inventory immediately before apply so a build that
  started after planning cannot race an aged-directory removal. Routine output
  exposes only process category, PID, and executable name, not full commands.
- CleanMyMac or other GUI cleaners are not substitutes for `simctl` control.
- Thresholds come from `devrules/config.json` → `idleResourceMaintenance`,
  overridable by CLI flags.

## Inputs

- Device runtime locator workspace roots (`devrules location show`).
- Optional overrides: `--idle-days`, `--soft-booted-target`,
  `--memory-pressure-free-warn-percent`, `--pressure-sample-count`,
  `--pressure-sample-interval-ms`, `--simulator-lag-observed`, and
  `--root <workspace>`. Legacy `--max-booted` and
  `--memory-free-warn-percent` spellings remain compatibility aliases.
- Xcode toolchain via `DEVELOPER_DIR` or
  `/Applications/Xcode.app/Contents/Developer`.

## Device-Local Lease Protocol

The registry defaults to `~/.config/devrules/simulator-leases.json`; it is
device-local and must not be committed. Mutation is dry-run without `--apply`:

```bash
devrules idle lease-status --json
devrules idle lease-claim --project-id <project> --task-id <task> --udid <udid> --apply
devrules idle lease-heartbeat --project-id <project> --task-id <task> --udid <udid> --apply
devrules idle lease-reserve-manual --project-id <project> --task-id <task> \
  --udid <udid> --manual-reservation-minutes 120 --apply
devrules idle lease-release --project-id <project> --task-id <task> --udid <udid> --apply
```

| Lease state | Meaning | Automatic shutdown |
| --- | --- | --- |
| `ACTIVE` | Fresh task heartbeat or exact-UDID controller. | Never. |
| `MANUAL_RESERVED` | Time-bounded user verification handoff. | Never before expiry. |
| `PROVEN_INACTIVE` | Explicit release or explicitly reclaimable manual reservation expired. | Candidate only under confirmed pressure above the soft target. |
| `UNKNOWN` | Missing/stale lease, unavailable registry, or ambiguous ownership. | Never. |

If pressure persists above the soft target and no proven-inactive device exists,
the plan may identify the oldest active lease as a release-request candidate.
Report that candidate to the user in the observing task. Do not send a request
to another task unless the user explicitly asks for that notification. It must
name the exact UDID and must never stop, interrupt, kill, or clean the owning
task.

## User Reporting And Cross-Task Notifications

Resource reporting belongs in the task that performed the observation. Use one
concise commentary update when user attention is useful, or include it in that
task's final response when no immediate decision is needed. Routine healthy
status and scheduler output stays in the command result/log and does not need a
user-visible interruption.

Use this report shape:

```text
Resource status: <booted-count> Booted (soft target 3); sustained pressure
<present/absent>; active or unresolved owners <summary>. No build, device, or
artifact was changed. If release is needed, specify the project and exact UDID.
```

The reporting and authorization boundary is strict:

- Count above the soft target without sustained pressure is informational. Do
  not send any cross-task message.
- Even under sustained pressure, report in the observing task first. A
  cross-task notification requires an explicit user instruction to send it.
- Send at most one advisory request for one pressure episode and exact UDID.
  Do not send automatic acknowledgments, reminders, progress updates,
  completion notices, or resource-restored messages.
- The receiving task treats the notification as context only. Stopping a build,
  shutting down a device, or deleting artifacts requires the user to confirm
  that exact mutation in the receiving task.
- If the user does not authorize contact or mutation, continue background-safe
  work where possible and report the limitation in the observing task.

## Execution

### 1. Status (always safe)

```bash
node devrules/scripts/idle-resource-maintenance.mjs status --json
```

Report reliable pressure samples, host free-memory diagnostics, booted
simulators, owner-inventory availability, competing/unresolved owners,
device scheduler health, active build lanes, deferred cleanup lanes, and stale
artifact counts. Active-lane deferral is expected safety behavior, not a reason
to terminate the build.

### 2. Pressure (fast, simulators/processes only)

```bash
node devrules/scripts/idle-resource-maintenance.mjs pressure
node devrules/scripts/idle-resource-maintenance.mjs pressure --apply
```

Use after Simulator handoff or when RAM feels tight. No disk walks.
The fast path still snapshots build-process categories so memory pressure from
active Cargo/Rust, Xcode/Swift, or Gradle work is visible without terminating it.

### 3. Plan (full disk + simulators)

```bash
node devrules/scripts/idle-resource-maintenance.mjs plan \
  --idle-days 30 \
  --soft-booted-target 3 \
  --memory-pressure-free-warn-percent 15
```

Typical planned actions:

- at most one `simulator.shutdown` when sustained pressure is confirmed, count
  is above the soft target, and the exact UDID is safely unowned;
- `simulator.deleteUnavailable` for Apple-unavailable device records;
- `simulator.quitApp` when Simulator.app is idle with zero Booted devices;
- `derivedData.remove` for DerivedData folders idle >= threshold;
- `coreSimulatorCache.remove` for `CoreSimulator/Caches` entries idle >= threshold;
- `rustTarget.remove` for workspace `target/` trees idle >= threshold;
- `swiftBuild.remove` for workspace SwiftPM `.build` trees idle >= threshold;
- `gradleBuild.remove` for workspace Gradle `build/` trees idle >= threshold.

### 4. Apply

```bash
node devrules/scripts/idle-resource-maintenance.mjs apply --apply
```

Agents should show the plan summary before the first apply in a session unless
the user already requested cleanup.

## Agent Autonomy Rules

| Device state | Agent duty |
| --- | --- |
| SessionStart on Windows/macOS | Run `agent-status --json` only. Do not create or repair scheduler state. |
| LaunchAgent / Task Scheduler healthy and current | Optional `status` only when pressure is visible. |
| Scheduler explicitly selected but missing or stale | Report the finding. Use a reviewed `install-agent --apply` or `ensure-agent --apply`; do not defer an implicit repair to a later SessionStart. |
| SessionStart auto-repair explicitly enabled | `DEVRULES_IDLE_SCHEDULER_AUTO_REPAIR=1` permits the idempotent repair path for that environment; report whether it changed state. |
| Scheduler unsupported | Use project-local `status` / `pressure` / `plan` when the current task or selected project policy requires maintenance. |
| Active ownership conflict | Do not shutdown contested UDIDs; follow ios-simulator-ownership instead. |
| Owner inventory unavailable or controller unresolved | Fail closed; report only. |
| Lease registry unavailable, lease stale, or device unleased | Classify as `UNKNOWN`; report only. |
| Manual reservation active | Preserve it even if the owning task is quiet. |
| Pressure persists, count is above target, and all leases are active | Report the oldest active lease candidate in the observing task. Contact it only after explicit user instruction; never stop its task. |
| Count above soft target without sustained pressure | Report only; do not shut down or contact another task. |
| Cargo/Rust, Xcode/Swift, or Gradle build active | Defer only the matching artifact lane, never kill the build, and retry cleanup after it finishes. |
| Build process inventory unavailable | Fail closed for build-artifact deletion and retry when inventory works. |
| User is mid-demo on a Simulator | Skip shutdown/quit; only report. |

After iOS handoff or UI verification, a count above `--soft-booted-target`
remains informational unless sustained pressure or explicit lag is also
present. Do not contact another task merely because the soft target is exceeded.

## Verification

- Confirm three Booted devices produce no shutdown action.
- Confirm four or more Booted devices without sustained pressure produce no
  shutdown action.
- Confirm one pressure pass plans at most one shutdown and apply blocks when
  pressure or ownership changes after planning.
- Confirm reclaimable file deletes are gone or shrunk.
- With a toolchain build active, confirm its matching lane is reported as
  deferred and produces no remove action; re-run after the build exits.
- Confirm `agent-status` reports the correct scheduler, registration, current
  configuration, and healthy status without changing device state.
- Confirm a default SessionStart check creates or modifies no wrapper,
  LaunchAgent plist, scheduled task, or scheduler directory.
- Confirm repeated `ensure-agent --apply` reports `changed: false` and does not
  recreate a healthy task. A disabled or drifted fixture remains unchanged
  after default SessionStart and is repaired only by an explicit apply or
  explicit auto-repair opt-in.
- Logs: `~/.config/devrules/logs/idle-resource-maintenance.*`

## Memory Updates

- Record a short lesson only when a machine-specific path or threshold needed
  local tuning.
- Do not store device UDIDs with secrets; UDIDs alone are acceptable in
  project-local notes when needed for ownership.

## When Not To Use

- Do not use this workflow to fix a stuck External Display window (use
  `ios-simulator-handoff.md`).
- Do not use it to delete a project's only assigned Simulator device.
- Do not broaden into general home-directory cleanup.

Last updated: 2026-07-19
