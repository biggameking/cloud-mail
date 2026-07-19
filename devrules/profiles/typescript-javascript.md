---
description: TypeScript and JavaScript code-health adapter.
ownership: shared
governs: agent
activation: conditional
enforcement: advisory
decision_owner: project
side_effects: none
---

# TypeScript And JavaScript

- Use the repository's Prettier/Biome/ESLint configuration; do not create a
  competing formatter.
- Preserve type information. Avoid `any`, unchecked casts, and optional chains
  that merely hide an invalid contract.
- Keep rendering separate from domain decisions, data access, provider SDKs,
  and privileged side effects.
- Expose feature modules through intentional public entry points; forbid deep
  imports across features where the lint/build system supports it.
- Hooks coordinate reusable stateful behavior; components render and handle
  local interaction. Do not turn hooks into unbounded service containers.
- Prefer explicit async error paths and cancellation. Do not leave floating
  promises or empty catches.
- Run the repository formatter check, ESLint/Biome, TypeScript typecheck, tests,
  and build lane relevant to the change.
