---
description: Reconcile fast-moving game documents and data into an evidence-backed canonical baseline.
ownership: seed
governs: product
activation: conditional
enforcement: advisory
decision_owner: project
side_effects: local
---

# Game Source Of Truth

## Trigger

Run when documents, milestone labels, metrics, architecture names, or authored/generated data disagree; before declaring a new canonical baseline; and before production starts after rapid ideation.

## Inputs

- All candidate product, design, technical, production, data, test, and release documents.
- Version history and known decisions.
- Current playable evidence, tests, and stakeholder constraints.
- `templates/game/core/source-of-truth-registry.md`.

## Responsibility Hats

- **Solo:** switch explicitly between Creative, Design, Engineering, Production, and QA review passes.
- **Team:** Production facilitates; domain owners reconcile claims; Product/Creative approves player and scope decisions; Engineering approves technical contracts; QA challenges unverifiable claims.

## Steps

1. Inventory every candidate source by domain, status, owner, editability, and last validation.
2. Extract conflicting claims into a decision table. Do not resolve conflicts by filename or version number alone.
3. Judge each claim against player intent, current evidence, feasibility, dependency impact, and testability.
4. Choose one canonical claim per fact and record the rationale. If evidence is missing, mark the claim `provisional` with an owner and validation date.
5. Create a new baseline named `V1`. This is a semantic reset: it supersedes prior draft numbering without deleting history.
6. Mark old documents `superseded`, `reference-only`, or `generated`; link each to its replacement.
7. Define the authoring pipeline for tabular and structured data: one editable source, deterministic generation, validation, and drift detection.
8. Update the glossary and stage definitions so the same terms have one meaning.
9. Run link, schema, and contradiction checks; review the registry with every required hat.

## Outputs

- Canonical V1 registry and conflict-resolution log.
- Supersession map and glossary.
- Canonical stage definitions and success metrics.
- Authored-versus-generated data map.
- List of provisional decisions with validation owners.

## Gates

- Every high-impact fact has exactly one editable canonical source.
- Prior versions remain traceable and cannot be mistaken for active instructions.
- Stage names, timing metrics, technical names, and data ownership are unambiguous.
- Generated artifacts identify their source and regeneration command or procedure.
- Provisional claims have a bounded validation plan.

## Done Criteria

The V1 registry is approved, all discovered conflicts are resolved or explicitly provisional, downstream workflows link to canonical sources, and a new contributor can identify the active fact without asking which version is real.
