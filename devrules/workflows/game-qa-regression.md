---
description: Reproduce, classify, verify, and prevent regressions in playable game builds.
ownership: seed
governs: product
activation: conditional
enforcement: advisory
decision_owner: project
side_effects: local
---

# Game QA And Regression

## Trigger

Run for reported defects, milestone validation, risky integrations, release candidates, or changes to core loops, data, saves, input, rendering, audio, platform, or build configuration.

## Inputs

- Exact build/version, platform, hardware profile, configuration, save, locale, input device, and seed.
- Expected behavior from canonical sources.
- Reproduction evidence and affected risk map.
- Existing automated, smoke, compatibility, and exploratory suites.

## Responsibility Hats

- **Solo:** QA pass reproduces and scopes; Engineering pass fixes root cause; Design pass confirms intent; Release pass judges residual risk.
- **Team:** QA owns reproduction and severity; domain owner fixes; Design/Product resolves expectation; Production triages; Release owns go/no-go.

## Steps

1. Reproduce on the reported build before changing code or data; record deterministic conditions where possible.
2. Separate expected-behavior ambiguity from implementation defect and update the canonical source if needed.
3. Classify severity by player/data/release impact and priority by urgency, reach, and workaround.
4. Reduce to the smallest reliable reproduction and identify affected boundaries.
5. Add a focused regression test or repeatable check before or with the fix when practical.
6. Fix the root cause; do not hide unknown failures with retries, silent fallbacks, or skipped paths.
7. Verify the original reproduction, adjacent states, negative paths, persistence, and platform variants.
8. Run the risk-based regression set and inspect the latest results.
9. Close only with evidence; otherwise document residual risk, owner, expiry, and release decision.

## Outputs

- Reproduction record and severity/priority.
- Root-cause note and fix reference.
- Regression coverage and verification evidence.
- Residual-risk or closure decision.

## Gates

- Build and environment identity are sufficient to reproduce.
- Expected behavior is canonical and unambiguous.
- The root cause is explained at the owning boundary.
- Verification includes the original case and likely neighbors.
- Release-blocking severity has no unapproved open item.

## Done Criteria

The defect is fixed or explicitly accepted by release authority, focused regression evidence passes in the relevant build, and the issue can no longer recur silently through the same path.
