---
description: Risk-tiered product architecture review for changes that affect user capabilities, journeys, navigation, surface ownership, or product data ownership.
ownership: shared
governs: product
activation: conditional
enforcement: gate
decision_owner: project
side_effects: none
---

# Product architecture review

Activate this workflow only when the requested change affects a user-facing
capability, journey, entry point, navigation structure, product-domain or
surface ownership, visible state, or product data ownership. The project or
user owns product choices. devrules supplies review structure and evidence
requirements; it does not choose the product model.

A PRD, research package, analytics finding, redesign request, or current product
behavior can be an input. None is automatically an executable screen list,
module list, backlog, or navigation model.

## Applicability and N/A

Record one applicability result before reviewing:

| Applicability | Use when | Result |
| --- | --- | --- |
| `required` | The change affects one of the product boundaries above. | Select a risk tier and review only the applicable depth. |
| `not_required` | The change is backend-only, infrastructure-only, mechanical, or local implementation inside an already approved product model. | Record the evidence and route to the ordinary architecture or code workflow. Product verdict is `N/A`. |

`N/A` is legitimate for sections that do not apply to the selected tier or
change. Record a short reason instead of fabricating requirements, IA options,
surfaces, decisions, or dependencies. Do not use `N/A` to conceal an unresolved
material product decision.

## Select the risk tier

Choose the lowest tier that still covers the real decision risk. A larger
document, more stakeholders, or missing identifiers does not by itself raise
the tier.

| Tier | Use when | Minimum review |
| --- | --- | --- |
| `light` | A small, reversible change stays inside an approved capability, journey, navigation model, and ownership boundary. Examples include a narrow state, copy-backed behavior, local entry-point refinement, or a contained surface enhancement. | Outcome and scope; affected owner/surface; success and recovery behavior; dependencies actually touched; acceptance evidence. |
| `standard` | A capability, journey, surface, or entry point changes materially, but the existing product domains, core navigation, and data ownership remain stable and the change is reversible. | Targeted capability/journey/surface mapping; material source conflicts; cross-cutting effects; relevant states and dependencies; acceptance evidence. |
| `full` | A new product; a core-navigation change; a product data/account ownership change; or another high-risk, difficult-to-reverse product commitment involving safety, privacy, legal/commercial constraints, migration, or durable user expectations. | Full product model, affected traceability, high-risk decisions and dependencies, migration/rollback or recovery, and acceptance evidence. |

Do not select `full` for routine feature work merely to obtain more paperwork.
If one full-tier trigger is present, review the affected high-risk boundary at
full depth; unrelated areas may remain standard, light, or `N/A`.

## Decision ownership and evidence

For every material open choice, name the project or user decision owner. The
reviewer may recommend an option and explain trade-offs, but must not silently
turn an inference into an approved requirement.

Use the smallest useful evidence set:

- approved product inputs and their authority or confidence;
- current production behavior, routes, surfaces, and ownership facts;
- user research, support evidence, or analytics when available and relevant;
- platform, accessibility, safety, privacy, commercial, legal, localization,
  performance, migration, and release constraints actually touched;
- representative content and acceptance observations for the target channel.

## Review steps

### 1. Establish outcome and boundary

For every tier, state the user result, target context, in-scope behavior,
non-goals, version boundary, and authoritative decision owner. Identify what is
intentionally unchanged.

### 2. Review the source critically

Record only material contradictions, duplicate entry points, missing states,
unclear ownership, version conflicts, unsupported assumptions, or requirements
without a user outcome. For each issue, capture evidence, impact,
recommendation, owner, status, and whether the unresolved consequence blocks
this change.

Missing `REQ-*`, `CAP-*`, `FLOW-*`, `SURFACE-*`, or `DEC-*` identifiers is never
by itself a reason to block implementation. Use stable identifiers when they
make a standard or full review easier to trace, or when the project already
uses them. Light reviews may use plain-language references.

### 3. Model only the affected product structure

Separate capability purpose from presentation:

- capability roles: `core`, `supporting`, `cross_cutting`, `background`, or
  `configuration`;
- surface roles: `primary_destination`, `secondary_destination`,
  `contextual_action`, `setting`, or `no_direct_surface`.

For light work, confirm the existing owner and journey remain valid. For
standard work, map changed capabilities, journeys, surfaces, and recovery. For
full work, establish the affected product domains, authoritative owners, core
and recovery journeys, and cross-cutting scope. Services, data entities, or
technical mechanisms do not become primary destinations without product
evidence.

### 4. Compare IA options only when there is a real IA choice

Compare at least two plausible information-architecture options only when the
change presents a genuine, broad IA choice—for example a new product, competing
core-navigation structures, or a broad reorganization with multiple viable
owners. Evaluate user-goal alignment, boundary clarity, capability coverage,
platform adaptation, migration cost, and future growth.

If current constraints leave one credible structure, record the constraint and
evidence; mark the second-option comparison `N/A`. Do not invent a weak second
option to satisfy the template. Light and standard changes with stable IA do
not require an IA comparison.

### 5. Cover states and dependencies proportionately

Review the states that can change the outcome: loading, empty, partial, error,
restricted, offline, paywalled, accessibility, long content, and platform input.
Mark unrelated states `N/A`.

For high-risk boundaries, explicitly identify:

- data, account, identity, permission, and ownership dependencies;
- safety, privacy, security, legal, commercial, or regulatory constraints;
- existing routes, links, automation, stored data, or user expectations that
  require migration or compatibility handling;
- rollback, recovery, deletion, and revisit triggers;
- external decision owners and evidence still required.

When iOS/iPadOS work actually changes persistence, account, collaboration,
recovery, iCloud/CloudKit, or data ownership, route the affected decision to
`ios-account-data-architecture.md`. Do not infer an account-backed model from a
login screen or provider SDK.

### 6. Establish acceptance evidence

All tiers must state how the changed behavior will be evaluated. Walk the
affected success and recovery journey with representative content on the target
platform or channel. Link only the requirements and decisions that are in
scope; full-project traceability is unnecessary for a light change.

For full reviews, preserve this relationship for every affected high-risk
requirement:

```text
source -> capability -> journey -> surface or no-surface decision -> acceptance evidence
```

## Product-readiness verdict

When applicability is `required`, issue exactly one verdict:

- `ready`: material decisions for the selected tier are resolved and acceptance
  evidence is defined.
- `ready_with_reversible_assumptions`: only low-risk, bounded assumptions remain;
  each has an owner, review date or trigger, bounded impact, and rollback path.
- `blocked`: an unresolved material scope, ownership, journey, IA, navigation,
  safety, data, migration, or source conflict would make implementation unsafe
  or commit the product to an unapproved high-impact direction.

A missing document section, identifier, optional IA comparison, or preferred
format cannot by itself produce `blocked`. Blocking must cite the unresolved
decision, consequence, owner, and evidence needed. A blocked verdict stops only
the affected structural decision or implementation; independent reversible
work may continue when its boundary is explicit.

## Outputs and source boundaries

Use `templates/product-architecture-brief.md` or an equivalent project-native
artifact. The format is replaceable; the risk decision and evidence are not.

- Product requirements own approved outcomes, scope, constraints, and
  acceptance intent.
- The product/IA baseline owns capability and surface ownership, journeys,
  navigation, and cross-cutting scope.
- The design system owns visual, component, interaction, motion, and
  accessibility presentation standards.
- Technical architecture owns code boundaries, state, contracts, data flow,
  adapters, migrations, and tests.
- The review brief records the risk tier, evidence, decisions, and verdict; it
  does not replace those long-lived sources.

Route subsequent UI or technical work to the project’s applicable design or
architecture workflow after the affected gate passes. Do not require a managed
design subsystem when the project has not adopted one.

## Done criteria

- Applicability, risk tier, activation reason, and project/user decision owner
  are explicit.
- Review depth matches the real risk; irrelevant sections have a justified
  `N/A`.
- Material conflicts, ownership, states, dependencies, and recovery are clear.
- Two IA options exist only for a genuine broad IA choice.
- High-risk changes preserve migration, rollback/recovery, and acceptance
  evidence.
- The verdict follows unresolved consequences, not document completeness or ID
  formatting.
