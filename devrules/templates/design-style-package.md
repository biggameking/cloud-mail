---
title: Design Style Package Review
description: Editorial review form for turning extracted UI evidence into a portable named style pack.
ownership: seed
governs: product
activation: conditional
enforcement: example
decision_owner: project
side_effects: none
---

# Design Style Package Review

## Identity

- Proposed id / name / version:
- One-sentence concrete reference:
- Suitable products and surfaces:
- Explicit `notFor` cases:

## Evidence boundary

| Source | Commit | Included surfaces | Excluded surfaces | Why |
| --- | --- | --- | --- | --- |
|  |  |  |  |  |

Privacy check: no product copy, routes, credentials, customer data, private
absolute paths, business logic, or source component code enters the pack.

## Shared design language

For each row, cite at least two source files or explain why a single-source claim
is sufficiently repeated across three representative screens.

| Area | Portable decision | Evidence | Semantic reason | Confidence |
| --- | --- | --- | --- | --- |
| Typography roles |  |  |  |  |
| Color roles |  |  |  |  |
| Layout and density |  |  |  |  |
| Spacing and shape |  |  |  |  |
| Depth and imagery |  |  |  |  |
| Motion |  |  |  |  |
| Components and states |  |  |  |  |

## Divergence decisions

| Difference | Common rule / optional variant / exclusion | Reason |
| --- | --- | --- |
|  |  |  |

## Negative constraints

- This style never:
- Brand/source-specific patterns deliberately omitted:
- Misapplication signals that should stop adoption:

## Pack and verification

- [ ] `style.json` contains stable identity, suitability, sources, and exclusions.
- [ ] `DESIGN.md` contains lintable semantic tokens plus rationale and component rules.
- [ ] `evidence.json` records commits, files, common signals, divergences, and decisions.
- [ ] `application.md` defines fit, mapping, conflicts, and representative QA.
- [ ] `design-style-library validate` passes.
- [ ] `design-lint --offline` passes with zero errors/warnings.
- [ ] Source repositories remain unchanged.
