---
description: Generic browser automation and rendered frontend debugging workflow.
ownership: shared
governs: agent
activation: conditional
enforcement: advisory
decision_owner: project
side_effects: local
---

# Browser Automation Fix Workflow

Use this workflow when browser-driven testing, in-app browser inspection, Playwright, WebDriver, or manual rendered verification cannot proceed.

## Common Symptoms

| Symptom | First checks |
| --- | --- |
| Page does not load | Dev server running, correct URL/port, build errors, network errors. |
| Page is blank | Console errors, failed module imports, runtime exceptions. |
| Click/type fails | Selector stability, visibility, disabled state, overlay/modals. |
| Test times out | Long polling, animation loops, unresolved network requests, waiting strategy. |
| Visual result differs | CSS cascade, computed style, layout constraints, viewport size. |
| Logged-in site appears logged out | Wrong browser profile/window, stale auth-failed tab, or route/container failure before assuming session expiry. |

## Steps

1. Confirm target URL and port.
2. For tasks that depend on an existing logged-in browser session, identify the
   user's current frontmost browser window first, then list controllable
   browser/profile/window candidates before selecting one. Prefer the explicit
   candidate that represents that frontmost window. Never resolve a generic
   browser alias or default extension instance before candidate selection.
   `last-used` is only a tie-breaker; it is not proof that a profile owns the
   current frontmost window. Do not treat a default instance's stale login page
   as proof that the user is logged out.
3. Confirm the development or preview server is running.
4. Check terminal/build output for compile errors.
5. Inspect browser console and network failures.
6. Verify the selector or interaction target exists, is visible, and is enabled.
7. Check whether timers, realtime subscriptions, animation loops, or pending requests prevent idle states.
8. Prefer condition-based waits over fixed sleeps.
9. After a fix, rerun the smallest browser verification that reproduces the issue.

## Authenticated Browser Checks

When the target is a logged-in SaaS, dashboard, developer portal, or admin
console:

1. Determine which browser window is frontmost through the active browser or
   computer-control capability when it exposes that state. Record only
   non-secret evidence such as browser family, profile name, window title,
   active tab title, and URL. Do not inspect cookies, passwords, or browser
   profile files merely to discover the foreground window.
2. Enumerate available controllable browser/profile/window candidates before
   resolving any generic alias. Select in this order:
   - the explicit candidate proven to represent the current frontmost window;
   - a unique candidate whose active/open tab matches the user's visible URL,
     title, account, project/app, or page landmarks;
   - the last-used profile only when the first two signals are unavailable and
     a fresh target-page landmark check makes the match unique.
3. If the frontmost browser family or window is not supported by the available
   automation connector, report that capability boundary and ask for one
   deliberate browser switch or human-assisted action. Do not silently operate
   a different default profile or browser.
4. If frontmost state is unavailable and multiple candidates remain plausible,
   report `frontmost controllable browser unproven` and stop before external
   writes. Do not guess from candidate ordering.
5. Match the controlled profile to user-visible evidence: expected tab title,
   URL, account header, project/app name, or page landmark.
6. Read a small page-state signal after claiming the tab: current URL, title,
   body length, and a few expected landmarks.
7. If a wrong profile shows `authResult=FAILED`, login pages, or unrelated tab
   sets while another profile shows the authenticated page, switch profiles
   instead of asking the user to log in again.
8. If the correct profile is authenticated but a page is blank or has partial
   module/route errors, do not make an internal deep-link URL the next
   diagnostic: first return to a known rendered parent page through its visible
   navigation, then follow the target's visible links one level at a time and
   record which transition fails.
9. When a rendered, enabled control does not respond through a semantic
   selector, perform exactly one equivalent accessible-DOM or coordinate-based
   interaction before diagnosing authentication, profile selection, or a
   platform route failure. If that alternative works, classify the problem as
   an automation interaction-surface mismatch and preserve the proven browser
   context. If it also fails, record the control, the two interaction methods,
   and the resulting product/server error before escalating.

## Useful Checks

```bash
curl -I http://localhost:<port>
```

Search likely async blockers with the fastest local search tool available:

```bash
rg "setInterval|requestAnimationFrame|\\.subscribe\\(|EventSource|WebSocket" src app components lib server
```

## Selector Guidance

- Prefer accessible names and roles.
- Prefer stable `data-testid` only when user-facing selectors are unavailable.
- Avoid brittle selectors tied to layout depth or generated class names.
- Wait for a meaningful UI state, not merely for a timeout.

## Visual Debugging

For CSS/layout problems:

1. Inspect real DOM structure.
2. Inspect computed styles.
3. Check parent constraints before changing child styles.
4. Verify at relevant desktop and mobile viewports.
5. Capture screenshots when useful.

## Memory Update

If a browser issue reveals a repeatable project-specific pattern, record it in `devrules/memory/lessons.md`. If it should improve this shared workflow, record an evolution suggestion.

Last updated: 2026-07-11
