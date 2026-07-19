---
title: Code Health Policy
description: Project-local tuning template for generic code-health ratchet budgets and exceptions.
ownership: seed
governs: agent
activation: conditional
enforcement: example
decision_owner: project
side_effects: none
applies_to:
  - repositories adopting the universal code-health rules
  - legacy codebases using no-new-debt enforcement
outputs:
  - project-local budget tuning
  - documented exclusions
  - large-file exceptions with exit conditions
related_rules:
  - devrules/rules/code-quality.md
  - devrules/rules/change-health.md
related_workflows:
  - devrules/workflows/code-change.md
last_reviewed: 2026-07-14
---

# Code Health Policy

Tune `devrules/config.json` only when repository evidence justifies changing the
portable defaults:

```json
{
  "codeHealth": {
    "mode": "ratchet",
    "fileLinesWarn": 500,
    "fileLinesNoGrowth": 800,
    "excludePaths": [
      "devrules/**"
    ],
    "largeFileAllowlist": []
  }
}
```

Project instances exclude `devrules/**` because those files are synchronized
template-controlled copies whose authoritative checks run in the shared
template. Product-local source, tests, scripts, and build logic remain in scope.

## Exception Contract

An allowlisted path must be generated, externally constrained, unusually
cohesive, or awaiting a bounded migration. Record the reason and exit condition
in the nearest README anchor or durable decision. Do not use an allowlist to
turn off review for an ordinary overloaded module.

The numeric defaults are review signals, not universal truths. Never shorten
required behavior, compress readable guidance, or split a cohesive module only
to satisfy a line threshold. When evidence supports cohesion, record an
exception; when responsibility is genuinely overloaded, refactor around the
real boundary rather than the number.

## Rollout

1. Start with `mode: ratchet` and inspect touched-file reports.
2. Fix false source/exclusion detection before changing budgets.
3. Baseline legacy debt without allowing it to grow.
4. Tighten project-specific budgets only after representative changes pass.
