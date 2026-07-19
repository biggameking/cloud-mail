---
ownership: seed
governs: product
activation: conditional
enforcement: example
decision_owner: project
side_effects: none
---

<!-- ============================================================================
Design Review Scorecard — optional, project-selected UI review aid.
Use only when the project or task explicitly adopts a scorecard. Otherwise use
the project's native acceptance criteria and keep the evidence/issue sections.
============================================================================ -->

# Design Review Scorecard: <surface / component / change>

## Review contract

- Decision owner: <project role / user / reviewer>
- Acceptance source: <project criteria / task criteria / adopted rubric>
- Design system mode: <project_native / devrules_managed / adoption_task>
- UI change risk: <low / medium / high> — Reason: <why>
- Numeric scoring explicitly adopted: <yes / no>
- Target platforms, devices, or viewports: <...>
- Evidence inspected: <preview / screenshots / tests / accessibility checks / ...>

### Risk-based review depth

| Risk | Typical scope | Minimum evidence |
| --- | --- | --- |
| Low | Narrow copy, token, asset, or known component-state change | Focused project-native check plus inspection of the affected state/surface. |
| Medium | New component/page, multiple states, or adaptive-layout impact | Representative content and states, relevant sizes/modes, accessibility behavior, and repository checks. |
| High | Broad redesign, core journey/navigation, safety-sensitive UI, or wide design-system migration | Explicit project/task acceptance, representative end-to-end surfaces and recovery states, accessibility review, and proportionate product/architecture evidence. |

Risk selects evidence depth; it does not automatically require a devrules
artifact or a numeric score.

## Review dimensions

Mark a dimension `N/A` when it is genuinely outside the changed boundary. Give a
reason and name the evidence used instead, if any. Do not mark an affected
safety, accessibility, or data-consequence concern `N/A` merely to pass review.

| Dimension | Applies? | Project-selected weight (optional) | Rating / evidence |
| --- | --- | ---: | --- |
| Structure and hierarchy | <yes / N/A + reason> |  | Purpose, information priority, and primary task are understandable. |
| Task and flow fit | <yes / N/A + reason> |  | Actions, navigation, consequences, and recovery match the approved product flow. |
| Active design-system consistency | <yes / N/A + reason> |  | Existing components, semantic assets/styles, and platform patterns are followed. |
| Platform and adaptive fit | <yes / N/A + reason> |  | Relevant devices/viewports, input modes, safe areas, text scaling, and layout changes are checked. |
| State and content coverage | <yes / N/A + reason> |  | Applicable loading, empty, error, restricted, long-content, and recovery cases use authentic content. |
| Accessibility | <yes / N/A + reason> |  | Labels, navigation/focus, contrast, targets, motion, announcements, and scaling are checked where affected. |
| Professional detail | <yes / N/A + reason> |  | Copy, rhythm, imagery, and interaction feedback are coherent and contain no unintended implementation leakage. |

## Optional numeric rubric

Use a numeric total only when the project/task selected weights, scale, and
thresholds before review. A team may adopt a 100-point scheme for comparison or
trend tracking, but devrules supplies no universal pass number. Numeric totals do
not override a critical issue, the project's release criteria, or the decision
owner's risk judgment.

- Selected scale and weights: <N/A / describe>
- Pre-agreed interpretation: <N/A / describe pass-revise boundaries>
- Result: <N/A / value>

## Findings

- Critical — user safety, accessibility exclusion, data consequence, broken core
  task, or another project-defined release blocker:
- Major — material usability, consistency, state, or adaptive-layout issue:
- Minor — localized polish or maintainability issue:
- N/A decisions and reasons:

## Decision

- Outcome: <pass / revise / re-scope / blocked by a real unresolved risk>
- Decision rationale: <tie to selected acceptance source and evidence>
- Required review or rollback layer: <N/A / product decision / flow / surface spec / component / visual change>
- Owners and verification for unresolved items: <...>

Passing means the project/task-selected acceptance criteria are satisfied and no
unresolved issue exceeds the agreed risk tolerance. Missing devrules paperwork,
an unused numeric score, or a legitimately documented `N/A` is not by itself a
failure.
