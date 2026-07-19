---
description: Universal workflow for iOS UI iteration using the project's fastest truthful visual lane.
ownership: shared
governs: agent
activation: conditional
enforcement: advisory
decision_owner: project
side_effects: local
---

# iOS Live Preview UI Iteration Workflow

Use this workflow for iOS app UI changes, regardless of whether the project is native Swift/SwiftUI/UIKit, React Native, Expo, Flutter, Kotlin Multiplatform, a hybrid WebView shell, or another stack that ultimately ships to iOS.

The core rule is stack-independent: use the fastest truthful visual lane the
project actually supports and keep it synchronized with the real product
implementation. A preview surface is often efficient; a simulator or physical
device is also a valid primary lane when no credible preview exists or platform
behavior is the boundary under test.

## When To Use

Use this workflow when the task involves:

- iOS UI or interaction changes.
- Frontend layout, copy density, navigation, modal, tab, sheet, or form changes in an iOS app.
- iPhone/iPad visual behavior, responsive layout, split view, safe-area, orientation, or dynamic type validation.
- Live preview, hot reload, Xcode Canvas, Storybook, Widgetbook, Expo/Metro, Flutter hot reload, or equivalent preview setup.
- A mismatch between simulator/device output and the preview surface.

Do not use it for purely backend work, store setup, signing, release, analytics plumbing, data migrations, or package management unless those changes block the UI preview loop.

## Principles

1. Product code is the source of truth. Never fix a visual issue only inside a preview wrapper, story, mock screen, or demo-only route.
2. A preview used as evidence must expose the real product component and the
   product state relevant to the change. It need not model every root tab,
   route, sheet, or error state when those boundaries are out of scope.
3. Prefer deterministic preview state. Persisted state, accounts, storage, live
   services, or manual navigation are acceptable only when they are the actual
   boundary under test and their limitations are reported.
4. Use the fastest truthful existing visual lane for the stack. Choose a
   simulator/device whenever it is the credible or required way to exercise the
   changed boundary, not only as a final smoke check.
5. A build passing is not visual verification. The changed UI must be reached in
   an appropriate preview, simulator, device, screenshot, or other project-owned
   visual lane before claiming it was inspected.
6. Do not claim "all pages/interactions are covered" unless the preview catalog/scenario registry has been reviewed and relevant states are present.
7. When a native SwiftUI project already uses a Debug development mode,
   deterministic fixtures, route restoration, or Debug-only hot reload can
   accelerate daily work. Do not introduce that product behavior as a shared
   requirement; use the project's existing preview and launch contracts.
8. Follow the project's selected device profile. When a simulator contains
   persistent development state that must be preserved, run destructive or
   state-resetting automated tests on an explicitly separate, resettable, or
   disposable destination.
9. Treat CoreSimulator device ownership and Simulator foreground ownership as separate resources. Before visible simulator control or handoff, follow `ios-simulator-handoff.md`; a different UDID isolates data but does not stop another UI test from taking the shared macOS foreground window.

## Entitlement Test State

Apply this section only when the changed product actually has entitlement or
purchase-controlled behavior.

- Use the project-defined personas needed for the changed path: free, paid,
  trial, expired, restricted, or another real state. No paid/Pro persona is a
  universal preview default.
- Cover purchase, restore, renewal, expiration, downgrade, or paywall behavior
  only when those boundaries are in scope, and keep each scenario explicit.
- Deterministic preview fixtures may represent product states for UI iteration,
  but must not be reported as evidence that a real authorization or purchase
  integration works.
- When the task verifies the provider integration itself, use the project's
  approved sandbox/test environment and verify both provider readback and the
  visible product gate. The shared workflow does not select a provider or
  require a live provider check for unrelated UI work.

## Visual Lane Selection

Identify the app stack first, then choose among the visual lanes the project
actually supports. The table lists candidates, not required tools or defaults.

| Stack | Primary preview lane | Runtime verification lane |
| --- | --- | --- |
| SwiftUI native | Xcode Canvas using `#Preview`/`PreviewProvider`, product preview host, deterministic environment fixtures. | iOS Simulator or device via Xcode/xcodebuild. |
| UIKit native | UIView/UIViewController previews through SwiftUI wrappers, storyboard previews, snapshot harness, or a routeable debug/preview catalog. | iOS Simulator or device. |
| React Native / Expo | Metro Fast Refresh, Expo preview, Storybook/component catalog, fixture-backed screens. | iOS Simulator/device for native module and bridge behavior. |
| Flutter | Hot reload, Widgetbook/story catalog, golden/widget tests with deterministic fixtures. | iOS Simulator/device for platform channels and native packaging. |
| Kotlin Multiplatform iOS shell | Native iOS preview lane for the shell plus fixture-backed shared-state adapters. | iOS Simulator/device for shared/native interop. |
| Hybrid WebView / Capacitor / Ionic | Browser/mobile viewport preview plus iOS shell preview for native chrome and WebView integration. | iOS Simulator/device for WebView, permissions, and plugin behavior. |
| Unknown/mixed | Find the fastest existing truthful preview/hot-reload loop; if none exists, use proportional simulator/device verification and propose a catalog only when repeated work justifies it. | Existing project-selected simulator/device lane. |

## Required Flow

1. State the UI goal, constraints, and done criteria.
2. Identify the stack and current preview mechanism:
   - native SwiftUI/UIKit: search for `#Preview`, `PreviewProvider`, preview hosts, app root, route models, fixture factories;
   - React Native/Expo: search for Storybook/catalog routes, Metro scripts, screen registry, fixture providers;
   - Flutter: search for Widgetbook, stories, golden tests, widget previews, sample app entry points;
   - hybrid: search for browser preview scripts, WebView shell, native plugin mocks.
3. Identify the simulator lane for runtime work:
   - resolve the lane and lifetime from the project-selected device profile;
   - use a separate resettable/disposable destination when a test would destroy
     state the selected development destination must preserve;
   - give each concurrent mutating worker an exact non-conflicting destination.
   Before visible runtime control, run the foreground-ownership preflight in `ios-simulator-handoff.md`.
4. Locate the production screen/component. Make UI changes there, not inside a preview-only duplicate.
5. If the project has selected a preview lane for this task, check whether the
   changed state is reachable there. Otherwise identify the proportional
   runtime or visual lane that will provide evidence.
6. When a preview lane is selected but the state is not reachable, add or
   update a scenario/story/catalog entry only if that is within scope and uses:
   - production components;
   - real navigation or screen registry paths;
   - deterministic fixtures;
   - explicit state for tabs, routes, selected records, sheets, dialogs, permissions, loading, empty, and error variants as needed.
7. Cover device classes relevant to the change:
   - iPhone compact width;
   - iPad regular width/split behavior when the app supports iPad;
   - dynamic type or accessibility size when text density/layout is affected;
   - dark/light mode when colors or contrast changed.
8. Verify the selected visual lane, then add runtime verification when relevant:
   - preview/story/catalog compiles or renders when selected;
   - app build passes;
   - focused tests pass where state, navigation, fixtures, or view models changed;
   - simulator/device smoke covers behavior the preview cannot prove, or serves
     as the primary visual lane when no credible preview exists.
9. Final report must separate:
   - production UI files changed;
   - preview/story/scenario files changed;
   - simulator lane and device used when runtime behavior was checked;
   - verification performed;
   - preview states not inspected or impossible to exercise.

## Preview Surface Requirements

Projects that opt into a preview catalog or scenario registry should select
states that materially reduce iteration and verification cost, such as:

- app root or primary shell;
- first launch/onboarding where relevant;
- primary tabs/routes;
- important detail/editor screens;
- major sheets/modals/dialogs;
- empty/loading/error states;
- representative populated state;
- iPhone and iPad variants when both are supported;
- dark/light and dynamic type coverage for layout-sensitive changes.

The implementation varies by stack. A project without a catalog may use its
existing preview, simulator, snapshot, or device lane; propose a catalog when
repeated manual navigation is demonstrably costly rather than treating its
absence as a maturity defect.

## Product-Synchronized Preview Patterns

Use only the patterns that match a preview system the project already has or
has deliberately chosen to add.

### Native SwiftUI

- Keep product preview hosts thin: install preview dependencies, set explicit app state, then render the real app root.
- Use real navigation models/routes/tabs rather than fake menu screens.
- Disable persisted preview state when possible, especially `UserDefaults`-driven selected tabs or last-opened records.
- Put deterministic fixtures in a preview fixture factory or in-memory repository.
- When the project has selected a persistent Debug lane, route restoration can
  reduce repeated navigation after incremental rebuilds. Treat it as a
  project-owned enhancement, not shared product behavior.
- Keep Xcode Canvas for local layout/state coverage and product-root sanity checks, but do not depend on Canvas as the only full-app interaction surface.
- If hot reload tooling such as InjectionIII/Inject is used, keep it Debug-only and additive. It may speed up SwiftUI body/layout changes, but model, stored-property, navigation-contract, package, and API changes still require a normal incremental build.
- If fixtures or route restoration materially change launch behavior, preserve
  a project-approved way to exercise production-like state; the repository
  decides whether that is a build configuration, launch argument, environment
  setting, or no special mechanism.

### UIKit

- Preview real `UIViewController` or `UIView` instances through a lightweight SwiftUI wrapper or snapshot harness.
- Drive controllers with fixture services/coordinators instead of hand-built fake screens.
- Keep storyboard/debug catalogs routeable to production controllers.

### React Native / Expo

- Use Storybook or a routeable preview screen registry for production components/screens.
- Keep stories fixture-backed and close to the real screen props/navigation contracts.
- Use Fast Refresh for visual iteration, then simulator/device for native module, gesture, permission, and bridge checks.

### Flutter

- Use Widgetbook/story catalogs or focused sample entry points for screens and states.
- Keep widget previews fixture-backed and free of live backend requirements.
- Use golden/widget tests for stable layout states when visual regressions matter.

### Hybrid/WebView

- Use browser/mobile viewport previews for web UI, then a native shell preview or simulator pass for WebView chrome, safe areas, native permissions, and plugin integration.
- Do not treat browser preview as proof of native shell behavior.

## Simulator Device Lifecycle

A runtime is a shared OS image; a simulator device is a stateful app container,
permissions, keychain, photos, files, logs, and foreground UI environment.
Separate UDIDs isolate device data but still share the macOS Simulator
foreground.

The project/device profile owns fleet policy. The shared default is one
persistent project device with the manual-acceptance App and a distinct
automation App installed together. This avoids another always-booted test
device while protecting the user's manual state from automation bundle
replacement. Valid exceptions include:

| Profile pattern | Device lifetime and naming | Appropriate when |
| --- | --- | --- |
| Persistent isolated | One stable project-named device with distinct manual and automation App bundle IDs. | Normal development, user click-through acceptance, and single-worker app-container-safe automation. |
| Explicit shared | An existing device is assigned exactly for a task, with coordinated app/state ownership. | The project intentionally shares a device and does not require persistent isolation. |
| Disposable | A task or worker creates/receives a temporary exact UDID and tears it down under the same scope. | Tests reset state, parallel workers need isolation, or clean-state verification is required. |

Record the default contract in
`devrules/memory/ios-simulator-device-profile.json` and validate it with
`scripts/ios-simulator-profile.mjs`. The profile must record the exact device
selector, both App identities, runner/extension allowlist, single UI worker,
and disposable-device exception reasons. It does not prescribe an iPhone model
or runtime.

Regardless of profile:

- resolve the exact UDID before mutation and do not target the first `booted`
  device;
- do not erase a persistent stateful destination to fix an unrelated test;
- use a different exact destination when an automated run would destroy state
  the assigned device is meant to preserve;
- inspect active UI-test/build destinations before controlling the visible
  Simulator window and do not disrupt another owner;
- clean up disposable devices created by the current task, but do not delete,
  rename, or normalize persistent devices to conform to shared examples.
- do not create a separate persistent automation device for ordinary tests;
  use a disposable device only for clean/destructive device state,
  identity-sensitive behavior, or additional parallel UI workers.

## Stale Preview Debugging

When simulator/device output changed but preview did not, debug in this order:

0. If the Canvas or preview surface shows a paused/sleeping/stale banner, treat the current image as invalid evidence until the preview is resumed and re-rendered. A successful build does not prove that the visible Canvas snapshot is fresh.
1. Is the active preview/story/catalog entry the one currently shown by the tool?
2. Does that preview route to the changed production screen?
3. Is the preview using explicit deterministic state, or is it reading old persisted app state?
4. Are fixtures hiding the changed state?
5. Is the edited production file included in the preview build/bundle?
6. Is the preview tool paused, cached, or rendering a previous variant?
7. Are build/package/module errors preventing preview rebuild?
8. Only after these checks, clear preview caches, DerivedData, Metro cache, Flutter build cache, or equivalent stack cache.

Do not keep editing UI blindly while the preview surface is stale. Fix the preview route/state first.

For native SwiftUI package/feature work where stale invalidation is a recurring
problem, consider two complementary preview lanes:

- a product-root preview that reaches the changed screen through the real app
  root, navigation model, and deterministic fixture state;
- a direct production-screen preview beside the edited view file, still using
  the real production component and preview dependencies.

Use the direct preview to catch package/component invalidation quickly. Use the
product-root preview to prove the real route still reaches the same screen. If
the product-root Canvas shows UI that was removed from the source, the preview
is stale by definition and verification is not complete.

When a project uses an app-target preview host as the main Canvas surface, an
explicit preview identity or build stamp can help distinguish stale Canvas
output from current code. This is optional diagnostic metadata and cannot
replace product UI verification.

## Verification Guidance

Use the repository's official commands from `devrules/memory/project-profile.md`, README anchors, package scripts, or project files.

For native Xcode projects, use the repository's selected Xcode build interface.
Resolve the scheme and exact destination, build the relevant target, and run
focused tests when behavior changed. Availability of a particular Agent tool
does not make it the project default.

Use the exact simulator destination selected by the project profile. A
persistent development destination, QA destination, or test pool is used only
when that lane exists; otherwise choose an explicitly assigned safe destination
for the verification's state and isolation needs.

For other stacks, run the closest equivalents:

- typecheck/lint/build;
- story/catalog render check if available;
- widget/unit/snapshot/golden tests;
- simulator/device smoke for native integration.

Always run a whitespace/diff sanity check such as `git diff --check` when the repository uses Git.

For UI changes, include at least one negative freshness check before claiming
the Canvas was inspected: name a visible UI element or label removed by the
change and confirm it no longer appears in the active preview. If it still
appears, continue stale-preview debugging instead of reporting completion.

## Memory And Template Updates

If a project lacks a preview lane and UI work repeatedly requires costly
simulator-only iteration, propose a preview catalog. Record or promote that
decision only when the user or repository workflow selects it.

## Done Criteria

- The UI change is implemented in production components/screens.
- The changed state is reachable in the selected truthful visual lane; a
  preview-specific claim is made only when a preview was actually used.
- Preview fixtures/state are deterministic enough for the claim when a preview
  lane was used, with any intentional live dependency reported.
- Runtime verification, when needed, used the exact authorized simulator
  destination and did not mutate state that its selected profile preserves.
- Visible simulator handoff, when performed, passed the exact-window, non-External-Display, competing-owner, and stability checks in `ios-simulator-handoff.md`.
- Relevant iPhone/iPad and interaction states are covered or explicitly listed as not applicable.
- Build/tests/checks passed, or exact blockers are documented.
- The final response does not imply visual inspection of preview states that were not actually inspected.
