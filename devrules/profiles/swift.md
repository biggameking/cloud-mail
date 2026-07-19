---
description: Swift code-health adapter.
ownership: shared
governs: agent
activation: conditional
enforcement: advisory
decision_owner: project
side_effects: none
---

# Swift

- Use repository SwiftFormat/SwiftLint rules and Xcode formatting conventions.
- Keep SwiftUI views focused on presentation and local interaction. Move domain
  decisions, persistence, networking, permissions, and provider behavior to
  their owning production components.
- Make state ownership explicit. Avoid duplicated `@State`, singleton state,
  and hidden environment dependencies that can disagree.
- Respect actor isolation and structured concurrency. Do not silence sendability
  or main-actor problems with unchecked annotations without a proven invariant.
- Model errors and absence explicitly; avoid empty catches and default values
  that conceal failed data paths.
- Split large files by semantic responsibility, not one extension per arbitrary
  line budget.
- Validate the active Xcode/app target, focused tests, lint/format checks, and
  real product preview/runtime lane when UI changes.
