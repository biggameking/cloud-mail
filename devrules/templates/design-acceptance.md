---
ownership: seed
governs: product
activation: conditional
enforcement: example
decision_owner: project
side_effects: none
---

<!-- ============================================================================
UI acceptance checklist — select the checks that match the changed boundary.
Project-native criteria and repository guidance take precedence. Mark a check
N/A with a short reason when it is genuinely inapplicable; do not invent work or
adopt tooling merely to fill every row.
============================================================================ -->

# UI Acceptance: <surface / component / change>

## Acceptance context

- Decision owner: <project role / user / reviewer>
- Acceptance source: <project criteria / task criteria / adopted rubric>
- Design system mode: <project_native / devrules_managed / adoption_task>
- UI change risk: <low / medium / high> — Reason: <why>
- Changed boundary and protected behavior: <...>
- Target platforms/devices/viewports and input modes: <...>
- Authentic content and states used for review: <...>

For `N/A`, record the reason beside the item. An affected safety,
accessibility, destructive-action, or data-consequence concern cannot be made
inapplicable merely to satisfy the checklist.

## 1. Task and information hierarchy

- [ ] The affected surface's purpose, primary task, and important information
      are understandable in the real product context. <or N/A + reason>
- [ ] Grouping, order, density, and emphasis reflect content relationships and
      the project's approved product/design direction. <or N/A + reason>
- [ ] The change does not introduce an unapproved capability, navigation path,
      or product ownership decision. <or N/A + reason>

## 2. Navigation, actions, and consequences

- [ ] Entry, exit, current location, and action priority follow the project's
      existing flow and target-platform conventions. <or N/A + reason>
- [ ] Labels describe the user's action or outcome; enabled/disabled and
      interactive/non-interactive elements are distinguishable. <or N/A + reason>
- [ ] Destructive, costly, external, or irreversible consequences have the
      project-required confirmation and recovery behavior. <or N/A + reason>

## 3. Authentic content

- [ ] Review used representative real-shaped content rather than lorem ipsum,
      fabricated metrics/endorsements, or ideal-length placeholders. <or N/A + reason>
- [ ] Interface copy is useful to the target user and does not unintentionally
      expose API, database, cache, stack, or other implementation detail.
      Technical detail remains valid when the target user genuinely needs it.
      <or N/A + reason>
- [ ] Empty/help/onboarding/marketing content is concise, truthful, and appropriate
      to the product instead of generic AI filler. <or N/A + reason>
- [ ] Dates, numbers, units, terminology, imagery, and localization follow the
      project's conventions. <or N/A + reason>

## 4. Applicable states and recovery

- [ ] Every state the changed boundary can actually enter has usable content,
      feedback, and recovery: for example loading, empty, error, success,
      restricted, offline, or no results. List checked states: <... / N/A>.
- [ ] Changed interactive elements cover their applicable focus/navigation,
      pressed/selected, disabled, loading, and error behavior. <or N/A + reason>
- [ ] Async actions provide feedback proportionate to duration and consequence,
      without fake success or hidden failure. <or N/A + reason>

## 5. Adaptive and robust layout

- [ ] Relevant device/viewports, safe areas, orientation, input mode, and
      appearance modes were inspected. List evidence: <... / N/A>.
- [ ] Representative short, long, localized, user-scaled, missing-media, and
      extreme-count content does not hide essential information or actions.
      <or N/A + reason>
- [ ] Touch/click targets, overflow, wrapping, truncation, scrolling, pagination,
      and virtualization follow target-platform and project requirements.
      <or N/A + reason>

## 6. Accessibility

- [ ] Semantics, labels, reading/navigation order, keyboard or platform focus,
      contrast, target size, announcements, text scaling, and reduced motion were
      checked where the change can affect them. <or N/A + reason>
- [ ] Accessibility verification used the project's existing automated/manual
      path; limitations and untested behavior are explicit. <or N/A + reason>

## 7. Active design-system consistency

- [ ] The change follows the project's actual design authority, components,
      semantic assets/styles, and platform conventions. <or N/A + reason>
- [ ] Generated artifacts, if any, were changed through their confirmed source
      and repository-declared regeneration/check command. <or N/A + reason>
- [ ] Project-native lint/test/build/preview or adopted design checks relevant to
      the change passed with fresh output. Commands/results: <... / N/A>.

`DESIGN.md`, `designmd`, package-manager design aliases, token generators,
changelogs, hooks, CI, and devrules scorecards are `N/A` unless the project has
explicitly adopted them or the user selected an adoption task.

## 8. Decision and residual risk

- [ ] Project/task-selected acceptance criteria are satisfied.
- [ ] Critical issues are resolved or the real blocker and affected boundary are
      explicit; major residual issues have an owner and verification plan.
- [ ] Optional scorecard: <N/A / link>. If used, its scale, weights, and thresholds
      were chosen by the project/task before review and do not override critical
      risk.
- [ ] Final evidence states what was inspected, which checks passed, which items
      are legitimately `N/A`, what was not verified, and remaining risk.
