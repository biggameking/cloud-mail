---
title: AI Model Routing
description: Pattern for mapping product features to AI routes, model selection, fallback, model discovery, and route policy.
ownership: seed
governs: product
activation: conditional
enforcement: example
decision_owner: project
side_effects: none
applies_to:
  - AI products with multiple features
  - products with multiple providers or model tiers
  - AI cost and quality optimization
  - translation and extraction pipelines
use_when:
  - A feature needs different models for quality, speed, cost, context size, or modality.
  - Admins or users need configurable model choices.
  - Fallback behavior must be predictable.
do_not_use_when:
  - The product has exactly one AI call and no foreseeable provider or model variation.
outputs:
  - feature route catalog
  - model selection policy
  - fallback policy
  - model discovery workflow
  - route review checklist
case_sources:
  - NovelEditor/src/services/ai/modelRoutePolicyService.ts
  - NovelEditor/src/services/ai/gatewayRouteService.ts
  - NovelEditor/src/services/ai/modelDiscoveryService.ts
  - NovelEditor/src/services/ai/resolvedModelService.ts
  - NovelWiki/src/lib/ai/model-routing.ts
  - planner-v0/lib/ai/assistant-suite.ts
related_workflows:
  - devrules/workflows/debug-root-cause.md
last_reviewed: 2026-06-11
---

# AI Model Routing

Model routing converts product intent into execution choices. Do not make UI components choose raw model IDs. Let them request a capability such as `chapter_summary`, `repo_analysis`, `translation`, `longform_polish`, or `image_reference_generation`.

## Route Types

| Route Type | Example Use | Key Selection Factors |
| --- | --- | --- |
| Generation | draft text, creative rewrite, chat | quality, style control, context size |
| Extraction | entity extraction, metadata parsing | structured output reliability |
| Classification | intent detection, routing, moderation | speed, low cost, consistency |
| Translation | UI copy, content translation | locale quality, glossary support |
| Embedding | semantic search, clustering | embedding dimension, storage cost |
| Multimodal | image analysis, visual QA | modality support, payload limits |
| Agent step | planning, execution, review | tool support, reasoning depth, budget |

## Route Definition Pattern

A route usually records:

- Stable route key.
- Product feature or workflow step.
- Required model capabilities.
- Preferred provider and model tier.
- Fallback candidates.
- Timeout and retry policy.
- Budget class.
- Output contract: text, JSON, tool call, stream, embedding.
- Safety policy.
- Autonomy policy: allowed side effects, approval gates, stop conditions, and
  handoff behavior.
- Optional execution capabilities such as persisted reasoning, server-side
  compaction, programmatic tool stages, extended context, or provider-specific
  effort modes.
- Admin visibility and editability.

This is a pattern, not a required schema.

## Capability-Gated Execution

Treat every non-portable execution feature as a route capability, not a global
prompt assumption. Before enabling one:

1. Confirm the selected provider, model, API surface, SDK, and account expose
   the capability.
2. Define a portable fallback that preserves the user-visible output contract,
   or mark the route unavailable rather than silently changing semantics.
3. Put feature-specific request fields and prompt adapters behind the provider
   boundary.
4. Test the primary and fallback routes independently, including tool output,
   approval behavior, final response validation, latency, and cost limits.
5. Record why the capability is needed and remove the overlay if measurements
   do not justify its complexity.

Model overlays document these gated differences. They refine this route policy;
they do not override the model-neutral prompt, safety, evidence, or approval
contracts.

## Selection Policy

Prefer a layered decision:

1. Product default route.
2. Tenant or workspace override.
3. User BYOK preference if allowed.
4. Runtime constraints such as context length, modality, speed, budget, or region.
5. Incident override or kill switch.
6. Fallback when the primary candidate is unavailable.

Keep all overrides explainable. A diagnostics panel should be able to answer: "Why did this request use this model?"

## Fallback Policy

Fallback is not just retrying another model. Define:

- Which errors are fallback-eligible.
- Whether output quality may degrade.
- Whether the user should be told.
- Whether the fallback consumes the same budget.
- Whether prompt format must change.
- Whether structured output validation must be rerun.

Avoid silent fallback for operations where reproducibility, legal review, or paid quality tiers matter.

## Model Discovery

Model discovery is useful when providers frequently change model catalogs or when users bring their own keys.

Discovery should:

- Validate credentials without exposing secrets.
- List supported models with capabilities.
- Cache results with a refresh time.
- Mark deprecated or unavailable models.
- Prevent selection of models that cannot satisfy route requirements.

## Cost And Quality Classes

Do not hardcode exact provider pricing in templates. Instead, classify route options:

- `fast`: short tasks, low latency, low reasoning demand.
- `balanced`: default product work.
- `premium`: high-stakes or user-visible quality.
- `long-context`: large documents, codebases, transcripts.
- `structured`: JSON or schema-sensitive extraction.
- `local/offline`: privacy, desktop, or no-network mode.

Map these classes to providers inside the project instance.

## Route Review Checklist

- Route names describe product capability, not provider brand.
- Each route declares required capabilities.
- Provider/model overlays are enabled only after capability detection and have
  an explicit portable fallback or fail-closed behavior.
- Fallback is explicit and tested.
- Admin or support can inspect effective route decisions.
- Route changes are audited when they affect cost, quality, or user entitlement.
- UI copy explains degraded mode when fallback changes user expectations.
- Tests cover unavailable primary model, invalid model config, and structured output failure.
