---
description: Establish repeatable game performance budgets, representative scenarios, profiling evidence, and regression gates.
ownership: seed
governs: product
activation: conditional
enforcement: advisory
decision_owner: project
side_effects: local
---

# Game Performance Profiling

## Trigger

Run when setting a baseline, adding performance-sensitive systems/content, observing frame or memory regressions, changing platforms/renderers, or preparing a milestone/release.

## Inputs

- Declared hardware/platform profile, build configuration, and budgets.
- Representative worst-case scenes, saves, scripts, camera paths, and seeds.
- Prior baseline and `templates/game/core/performance-baseline.md`.

## Responsibility Hats

- **Solo:** Engineering profiles and fixes; Design validates representative load; QA controls scenario; Production governs budget exceptions.
- **Team:** Performance/engine owner owns measurement; domain owners fix hotspots; Design defines representative density; QA reproduces; Release approves exceptions.

## Steps

1. Define budgets for frame time and its relevant CPU/GPU portions, memory, loading, save/load, startup, and other platform-critical measures.
2. Freeze representative scenarios, duration, camera/input path, seed, build type, thermal/power state, and capture method.
3. Measure a clean baseline outside the editor; record distributions and spikes, not only averages.
4. Reproduce regressions and locate the dominant cost with the engine/platform profiler before optimizing.
5. Change one bottleneck class at a time; preserve correctness and visual/player intent.
6. Rerun the same scenario and compare against baseline, budget, and variance.
7. Test nearby densities, long-session behavior, loading transitions, content variants, and target hardware.
8. Automate stable smoke thresholds where reliable; keep deep profiling evidence reviewable.
9. Accept, revise, defer with approved budget exception, or block release.

## Outputs

- Versioned baseline and scenario definition.
- Profiles identifying dominant costs.
- Before/after measurements and correctness evidence.
- Budget status and approved exceptions.

## Gates

- Measurement uses a representative non-editor build and declared hardware.
- Scenario and capture method are repeatable.
- Root cause is profiled rather than inferred from symptoms.
- Improvements do not violate gameplay, visuals, stability, or memory elsewhere.
- Exceptions have owner, rationale, player impact, and expiry milestone.

## Done Criteria

Relevant scenarios meet budgets or have an explicit release-authority exception, latest measurements are archived with build identity, and the regression can be detected again using the same protocol.
