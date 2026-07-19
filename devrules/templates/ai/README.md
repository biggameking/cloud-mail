---
title: AI Domain Templates
description: Index for AI middle-platform patterns covering providers, routes, prompts, agents, workflows, and template extraction.
ownership: shared
governs: product
activation: conditional
enforcement: example
decision_owner: project
side_effects: none
applies_to:
  - AI-native products
  - AI-assisted SaaS features
  - content generation systems
  - agentic automation
  - translation and extraction pipelines
use_when:
  - A project calls external or local AI models.
  - AI behavior must be configurable, observable, or reusable across features.
  - Prompts, agents, routes, or generated templates need product-grade management.
do_not_use_when:
  - A one-off script can call a single model with no product surface.
  - The project already has a mature AI platform and only needs a local bug fix.
outputs:
  - AI service boundary
  - model routing policy
  - prompt management plan
  - agent management plan
  - workflow and evaluation plan
case_sources:
  - magic-novel-forge/docs/templates early AI service experience
  - NovelEditor/src/services/ai
  - NovelEditor/src/services/promptDefinitionService.ts
  - NovelEditor/src/services/promptAssemblyService.ts
  - NovelEditor/src/services/agentService.ts
  - NovelEditor/src/modules/template-factory
  - NovelEditor/src/modules/agent-learning
  - NovelWiki/src/lib/ai
  - NovelWiki/src/lib/prompts
  - DeGit/src/pages/Prompts
  - DeGit/src/pages/FlowMode
  - auto-threads/src/components/agent
  - structureUI/apps/web/lib/ai-assistant.ts
related_workflows:
  - devrules/workflows/debug-root-cause.md
  - devrules/workflows/devrules-audit.md
last_reviewed: 2026-06-11
---

# AI Domain Templates

AI capability should be treated as a platform layer, not a scattering of direct provider calls. The useful separation is:

1. Provider adapters and request execution.
2. Model registry and model discovery.
3. Feature routes that choose models and fallback behavior.
4. Prompt registry and effective prompt resolution.
5. Agent definitions that compose prompts, variables, tools, and workflow steps.
6. Observability, usage, rate limits, and admin configuration.

## Recommended Reading Order

| Task | Read |
| --- | --- |
| Build a provider-neutral AI service | `ai-service.md` |
| Route features to different models | `model-routing.md` |
| Manage prompts, versions, overrides, and variables | `prompt-management.md` |
| Manage preset and custom agents | `agent-management.md` |
| Build single-agent, multi-agent, pipeline, learning, or revision flows | `agent-workflows.md` |
| Extract reusable templates from examples or documents | `template-factory.md` |

## Domain Principles

- Prompt definitions and agent definitions are separate assets. A prompt can be reused by many agents; an agent can compose many prompts.
- Feature routes should express product intent, not provider names. For example, route by `longform_polish`, `entity_extraction`, or `repo_analysis`, then resolve to a model.
- Runtime code should accept a resolved execution plan rather than reading every configuration source directly.
- User overrides should be explicit, scoped, and reversible.
- Usage accounting and observability belong near the execution boundary, not only in UI state.
- Failed AI calls should produce debuggable evidence: route, provider, model, prompt version, token/size estimate, latency, and sanitized error category.
- Keep shared Agent governance model-neutral. Product-owned provider adapters
  and request parameters belong in the project only after that project selects
  the provider and capability.

## Case Patterns To Borrow

- NovelEditor separates model configuration, route policy, provider resolution, request building, prompt building, and response parsing.
- NovelEditor keeps prompt definitions and agent definitions as first-class concepts, enabling user-custom agents without duplicating every prompt.
- NovelWiki uses provider adapters and feature-specific services, which keeps entity extraction and chapter summary logic independent from provider selection.
- DeGit separates prompt manager UI from agent runtime memory, stream, safety review, and persistence.
- auto-threads shows admin-facing agent definitions, routing rules, and workflow design as operational product surfaces.
