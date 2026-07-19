---
description: Fit check and application guidance for the Signal Newsroom design style package.
ownership: shared
governs: product
activation: conditional
enforcement: advisory
decision_owner: devrules
side_effects: none
---

# Applying Signal Newsroom

## Fit check

Use this style when the primary product behavior is reading, scanning, comparing,
or following authored stories. It works best when content has real headlines,
images, categories, dates, authors, and meaningful recency. Do not apply it to an
administration console solely because the same product also has editorial pages.

Before applying, run the normal Design Read. Confirm that an editorial newsroom
is the right concrete reference and that users benefit from mixed scanning and
long-form reading. If the product has a different core task, select another style
or document a deliberate hybrid.

## What application means

The pack supplies a semantic skeleton, not source code:

1. Copy `DESIGN.md` as the target repository's editable design source of truth.
2. Map existing semantic theme slots to the pack's colors, typography, spacing,
   radius, motion, and component contracts.
3. Preserve project information architecture and real content. Never import
   source product names, routes, copy, or business components.
4. Generate target-native token artifacts through `design-sync`; then migrate
   representative primitives and screens using the target stack's conventions.
5. Record any product-specific fork in `DESIGN-CHANGELOG.md`.

The application command refuses to replace a different `DESIGN.md`. Resolve that
case with `design-change.md`: compare the current source of truth with this pack,
choose whether to merge, fork, or stop, and keep the decision reviewable.

## Signature patterns

- Masthead and utility navigation use Inter; the publication or story title uses
  Playfair Display.
- Lead stories are image-led and receive more grid span than secondary stories.
- Source Serif 4 reading columns stay around 60–68ch with generous line height.
- Uppercase, tracked labels are compact and rare: categories, timestamps, live
  status, and navigation—not paragraphs or every heading.
- Thin rules divide sections. Cards are used only when content needs a distinct
  boundary or interaction model.
- Editorial red marks urgency or active context. Deep navy marks a high-signal
  band. Neither becomes an ornamental gradient.

## Verification

- Run `design-lint`, `design-sync`, `design-guard`, and repository-native checks.
- Review at least one index/feed, one detail/long-form page, and one narrow mobile
  viewport in light and dark mode.
- Confirm headline wrapping, 60–68ch reading width, image crop behavior, keyboard
  focus, reduced motion, contrast, loading/empty/error states, and real content.
- Reject the application if the result looks like a card dashboard wearing serif
  fonts; structure, hierarchy, and content density are part of this style.
