---
description: Risk-tiered product architecture review artifact; use only when the product boundary is activated.
ownership: shared
governs: product
activation: conditional
enforcement: advisory
decision_owner: project
side_effects: none
---

# Product architecture brief: <product or change>

Use the project’s existing decision format when one exists. This template is a
structured option, not a required storage location or product model. Complete
only the sections needed for the selected tier and mark the rest `N/A` with a
short reason.

## 0. Activation, applicability, and status

- Activation signal: <capability / journey / entry point / navigation /
  surface ownership / product data ownership / visible state>
- Applicability: <required / not_required>
- Applicability evidence:
- Risk tier: <light / standard / full / N/A>
- Risk-tier reason:
- Product decision owner: <project role or user / N/A>
- Review owner:
- Review date:
- Product-readiness verdict:
  <ready / ready_with_reversible_assumptions / blocked / N/A>
- Related product/IA baseline: <link / N/A with reason>
- Related requirements: <link / N/A with reason>
- Next workflow: <workflow / N/A>

If applicability is `not_required`, set the tier and verdict to `N/A`, record
the evidence, and stop. `N/A` is also valid for any section irrelevant to the
selected tier. It is not valid for hiding an unresolved material decision.

## 1. Review depth

| Tier | Required sections | Conditional sections |
| --- | --- | --- |
| `light` | 0, 2, 3, 9, 12 | Any section touched by the change |
| `standard` | 0-3, 5-7, 9-12 | 4 and 8 when useful; 6 IA options only for a real broad IA choice |
| `full` | 0-5, 7-12 | 6 when a genuine broad IA choice exists; otherwise justified `N/A` |

Full review is reserved for a new product, core navigation, product
data/account ownership, or another high-risk and
difficult-to-reverse commitment. Missing paperwork or identifiers does not
raise the tier.

## 2. Outcome and boundary

- User result:
- Target users and context:
- In scope:
- Intentionally unchanged:
- Non-goals:
- Version boundary:
- Success measure:

## 3. Changed behavior and acceptance evidence

| Scenario | Entry | Expected result | Error or recovery | Acceptance evidence | Owner |
| --- | --- | --- | --- | --- | --- |
| <success or recovery scenario> | <entry> | <result> | <recovery / N/A> | <test, observation, screenshot, report> | <owner> |

All tiers complete this section with representative content on the target
platform or channel.

## 4. Sources and material conflicts

| Source or current behavior | Authority/confidence | Material conflict or assumption | Impact | Recommendation | Decision owner | Gate effect |
| --- | --- | --- | --- | --- | --- | --- |
| <source> | <owner; high/medium/low> | <conflict / none> | <impact / N/A> | <recommendation> | <owner / N/A> | <blocker / later / none> |

Record only conflicts material to the selected tier. Do not turn an inference
into an approved requirement.

## 5. Affected product model

Stable IDs are optional. Use the project’s existing identifiers or add
`REQ-*`, `CAP-*`, `FLOW-*`, `SURFACE-*`, and `DEC-*` only when they improve
traceability. Their absence cannot by itself block the review.

### Capabilities and ownership

| Capability or ID | User outcome | Product domain | Capability role | Surface role | Authoritative owner | Change |
| --- | --- | --- | --- | --- | --- | --- |
| <capability> | <outcome> | <domain> | <core / supporting / cross_cutting / background / configuration> | <primary_destination / secondary_destination / contextual_action / setting / no_direct_surface> | <owner> | <new / changed / unchanged> |

### Affected journeys and surfaces

| Journey or ID | Surface/entry or ID | Key decision | Success | Recovery | Required states | Dependencies |
| --- | --- | --- | --- | --- | --- | --- |
| <journey> | <surface or entry> | <decision / N/A> | <result> | <recovery> | <loading, empty, restricted, offline... / N/A> | <data, permission, platform... / N/A> |

Light work may replace these tables with a sentence confirming the existing
capability, journey, IA, and owner remain unchanged.

## 6. Information-architecture options

- Genuine broad IA choice exists: <yes / no>
- Evidence:

If `no`, record why the current constraints leave one credible structure and
mark the option comparison `N/A`. Do not invent a second option. If `yes`,
compare at least two plausible structures:

| Option | Structure and owner | User-goal alignment | Coverage | Platform adaptation | Migration cost | Risks |
| --- | --- | --- | --- | --- | --- | --- |
| A | | | | | | |
| B | | | | | | |

- Recommended or selected option:
- Decision status: <approved / recommended_pending_decision / blocked>
- Decision owner:
- Evidence and trade-offs:

## 7. Cross-cutting behavior, states, and accessibility

| Boundary | Scope | Shared behavior or state | Owner | Recovery | Applicability |
| --- | --- | --- | --- | --- | --- |
| <search, create/import, share/export, sync, permissions, AI, commerce, help> | <scope> | <behavior> | <owner> | <recovery> | <applies / N/A with reason> |

Cover only affected loading, empty, partial, error, restricted, offline,
paywalled, content-size, accessibility, and platform-input states.

## 8. Affected traceability

| Source requirement or plain-language need | Capability | Journey | Surface or no-surface decision | Acceptance evidence | Status |
| --- | --- | --- | --- | --- | --- |
| <source or need> | <capability> | <journey> | <surface / no direct surface> | <evidence> | <covered / open / blocked> |

For light work, plain-language references are enough. For full work, include
every affected high-risk requirement; full-project traceability is not required
unless the project has independently chosen it.

## 9. Decisions and reversible assumptions

### Material decisions

| Decision or ID | Evidence | Status | Consequence if unresolved | Owner | Revisit trigger |
| --- | --- | --- | --- | --- | --- |
| <decision> | <evidence> | <approved / open> | <impact> | <project role or user> | <trigger> |

### Reversible assumptions

| Assumption | Bounded impact | Owner | Review date or trigger | Rollback path |
| --- | --- | --- | --- | --- |
| <assumption> | <scope> | <owner> | <date or trigger> | <how to reverse> |

`ready_with_reversible_assumptions` is invalid when an assumption lacks these
fields or creates an irreversible product or data commitment.

## 10. High-risk dependencies, migration, and recovery

For light and standard reviews, complete only touched rows and mark the rest
`N/A`. Full reviews must cover each applicable high-risk boundary.

| Boundary | Current state | Proposed commitment | Constraint/decision owner | Migration or compatibility | Rollback/recovery | Evidence needed |
| --- | --- | --- | --- | --- | --- | --- |
| Data/account/identity ownership | | | | | | |
| Permissions/security/privacy | | | | | | |
| Safety/legal/commercial/regulatory | | | | | | |
| Existing routes/links/automation/content | | | | | | |
| Durable user expectations/platform dependencies | | | | | | |

## 11. Readiness verdict

- Verdict: <ready / ready_with_reversible_assumptions / blocked>
- Blocking decision and consequence: <decision and impact / none>
- Blocking decision owner: <owner / N/A>
- Evidence required to unblock: <evidence / N/A>
- Reversible assumptions: <list / none>
- Independent reversible work that may continue: <scope / none>
- Next workflow:

Verdict rules:

- `ready`: material decisions for the selected tier are resolved.
- `ready_with_reversible_assumptions`: only explicit, owned, bounded, and
  reversible assumptions remain.
- `blocked`: an unresolved material decision would make implementation unsafe
  or commit an unapproved high-impact direction.

Missing `REQ-*`, `CAP-*`, `FLOW-*`, `SURFACE-*`, or `DEC-*` identifiers,
optional sections, or a second IA option cannot alone produce `blocked`.

## 12. Long-lived source updates and N/A record

- Requirements updates: <updates / N/A with reason>
- Product/IA baseline updates: <updates / N/A with reason>
- Design-system updates: <updates / N/A with reason>
- Technical architecture updates: <updates / N/A with reason>
- Acceptance/journey evidence updates: <updates / N/A with reason>
- Remaining sections intentionally marked `N/A`: <sections and reasons>
