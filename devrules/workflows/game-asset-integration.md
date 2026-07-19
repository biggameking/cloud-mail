---
description: Standardize game asset and content intake, provenance, import, integration, and in-build validation.
ownership: seed
governs: product
activation: conditional
enforcement: advisory
decision_owner: project
side_effects: local
---

# Game Asset And Content Integration

## Trigger

Run for new or revised visual, animation, audio, narrative, level, localization, UI, or other content entering the game build.

## Inputs

- Approved asset/content brief and acceptance criteria.
- Source file, license/provenance, naming and import constraints.
- Target scene/content contract and `templates/game/core/asset-manifest.md` or `templates/game/core/level-content-spec.md`.

## Responsibility Hats

- **Solo:** Art/Audio/Content creates; Technical Art/Engineering validates constraints; QA checks representative gameplay and platforms.
- **Team:** Discipline lead approves quality; creator owns source; technical owner owns import/integration; legal/production tracks rights; QA owns in-build coverage.

## Steps

1. Confirm player purpose, target context, variants, platform, accessibility, and performance budget.
2. Register source ownership, license, attribution, generation/edit history, and replacement restrictions.
3. Validate naming, dimensions, scale, pivots, color/audio settings, loops, compression, collision, animation, localization, and export profile as applicable.
4. Keep editable source separate from runtime-ready imports; record the conversion path.
5. Integrate through the owning module or content schema, not an arbitrary scene path.
6. Check missing references, defaults, fallback presentation, reimport stability, and source-control diffs.
7. Validate in a representative build under gameplay lighting, camera, mix, UI scale, language, input, and performance conditions.
8. Approve, revise, quarantine, or reject; update the manifest and affected budgets.

## Outputs

- Registered source and runtime artifact.
- Provenance/license record and import settings.
- Integration references and representative-build evidence.
- Approval status and follow-up work.

## Gates

- Rights and source ownership are known.
- Asset/content meets technical and player-facing acceptance criteria.
- Reimport is repeatable and does not depend on undocumented local settings.
- Missing or incompatible content fails visibly during validation.
- Representative-build quality and budget checks pass.

## Done Criteria

The approved content is traceable from source to runtime use, reproducibly imported, valid in context, covered by manifest and regression checks, and free of unresolved licensing or budget risk.
