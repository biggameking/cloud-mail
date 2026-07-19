---
title: Agent And Model Selection Boundary
description: Shared devrules inherits the Agent and model selected by the user or host and never chooses product API parameters.
ownership: seed
governs: agent
activation: conditional
enforcement: hard
decision_owner: user
side_effects: none
applies_to:
  - Agent-readable devrules rules, workflows, templates, and operating guides
use_when:
  - Reviewing whether shared guidance is portable across Agent/model choices.
  - Migrating legacy per-document model declarations.
do_not_use_when:
  - The product itself is choosing an AI provider or request shape; that belongs to project architecture and implementation.
outputs:
  - model-selection boundary review
  - portability gaps and project-local alternatives
---

# Agent And Model Selection Boundary

The active Agent, model, and reasoning controls come from the user and the host
surface, such as the model selected in Codex App. devrules must use that actual
selection. It does not define a default model, preferred model, reasoning
strength, or provider request parameter.

## Shared Rule

- Shared documents inherit the current runtime selection; they do not repeat a
  model compatibility declaration in each file.
- A user-selected model is never replaced or silently supplemented by a
  devrules default.
- Shared rules describe goals, evidence, permissions, and capability needs.
  When a capability is unavailable, report the gap or use a portable path that
  preserves the requested outcome.
- Do not place provider request fields such as reasoning mode or effort in the
  shared Agent-governance layer.

## Product Boundary

A product may intentionally use OpenAI or another provider and may expose model
and request controls. Those are product architecture decisions owned by that
project. devrules may help evaluate them when the task explicitly concerns the
product's AI integration, but it must not preselect them through a global
overlay or universal workflow.

Provider-specific examples must therefore be conditional on a provider already
selected by the project. They are examples or adapters, not shared defaults.

## Compatibility Evidence

Record compatibility findings in focused test results, release notes, or a
project-local decision when the distinction matters. Do not turn observed
compatibility into executable routing metadata unless the project itself owns
that router.

Legacy per-document `model_support` declarations are ignored during project
operation and removed during an explicit v3 migration. Their former `default`
or `preferred` values never override the host selection.
