---
title: AI Service Architecture
description: Provider-neutral AI service pattern for model execution, API key handling, rate limits, observability, and product integration.
ownership: seed
governs: product
activation: conditional
enforcement: example
decision_owner: project
side_effects: none
applies_to:
  - text generation
  - structured extraction
  - translation
  - embedding
  - image or multimodal generation
  - agent workflows
use_when:
  - Multiple features call AI providers.
  - Provider, model, key, quota, or fallback behavior must be configurable.
  - AI usage needs logging, admin controls, or billing integration.
do_not_use_when:
  - A one-off local script can call a single model without product state.
  - The project already has a complete AI execution boundary and only needs prompt copy changes.
outputs:
  - AI service boundary
  - provider adapter contract
  - request execution policy
  - API key and rate-limit plan
  - observability checklist
case_sources:
  - magic-novel-forge/docs/templates early AI service experience
  - NovelEditor/src/services/ai
  - NovelWiki/src/lib/ai/providers
  - planner-v0/lib/ai
  - structureUI/apps/web/lib/ai-assistant.ts
related_workflows:
  - devrules/workflows/debug-root-cause.md
last_reviewed: 2026-06-11
---

# AI Service Architecture

An AI service layer should make provider execution boring. Product code asks for a capability; the service resolves route, prompt, model, provider, credentials, safety limits, execution, parsing, and logging.

Examples in this file are illustrative patterns. Do not copy names, table shapes, or file paths blindly.

## Responsibility Split

| Layer | Responsibility | Should Not Do |
| --- | --- | --- |
| Feature caller | Provide business input and requested capability. | Pick provider keys directly. |
| Route resolver | Map capability and context to a model route. | Build prompt text. |
| Prompt resolver | Resolve prompt version, variables, user overrides, and final messages. | Execute network calls. |
| Provider adapter | Normalize provider-specific APIs. | Know product feature rules. |
| Execution service | Apply timeout, rate limit, retry, fallback, logging, and parsing. | Own UI state. |
| Admin/config layer | Manage providers, keys, routes, quotas, and model availability. | Bypass runtime validation. |

## Provider Adapter Pattern

The adapter should hide provider differences while preserving provider-specific diagnostics.

Illustrative interface:

- `providerId`: stable provider key.
- `supports`: capabilities such as chat, JSON output, tools, embeddings, image input, streaming.
- `listModels`: optional model discovery.
- `execute`: normalized request in, normalized response out.
- `classifyError`: converts provider errors into stable categories.

Useful adapter output fields:

- `text` or structured `data`.
- `usage`: input tokens, output tokens, estimated cost class if available.
- `rawProviderMeta`: sanitized metadata for diagnostics.
- `finishReason`: success, length, safety, tool-call, interrupted.
- `latencyMs`.

## Prompt And Agent Resolution

Do not hardcode long prompt strings inside feature UI or business modules when prompts must evolve.

Use a layered resolution model:

1. user or workspace override;
2. configured agent or prompt definition;
3. code fallback for safe defaults.

Recommended resolver output:

- `promptId`;
- `promptVersion`;
- `source`: user override, configured prompt, agent preset, or code fallback;
- final messages or structured prompt data;
- variable substitution diagnostics;
- safety or policy flags;
- cache metadata when prompts are reused.

Prompt changes that affect production behavior should have a synchronization or migration path. The project should document whether prompt content is code-owned, database-owned, admin-owned, or user-owned.

## API Key Handling

Prefer a key vault abstraction over scattered environment reads.

Patterns:

- Server-owned keys for platform features.
- User BYOK keys for personal workflows.
- Workspace or tenant keys for team products.
- Provider test buttons that only verify connectivity and model list access.
- Rotation metadata: who changed the key, when, and which features use it.

Never log full keys. Diagnostic views should show provider, key source, last four characters if policy allows, validation time, and failure category.

## Rate Limits And Budgets

AI limits should exist at multiple layers:

- Provider adapter limit: protects external API behavior.
- User/workspace quota: protects product fairness.
- Feature budget: prevents a single feature from consuming all allowance.
- Job-level budget: stops long-running agents from runaway loops.
- UI budget signal: lets the user know why execution paused or degraded.

A practical limiter records:

- actor and workspace
- feature route
- model route
- operation type
- estimated tokens or units
- actual usage after execution
- reservation, commit, and refund events if billing or credits are involved

## Execution Flow

1. Caller sends business input and capability.
2. Validate actor entitlement and feature availability.
3. Resolve feature route and model route.
4. Resolve prompt or agent execution plan.
5. Estimate input size and enforce budget.
6. Execute with provider adapter.
7. Parse and validate output.
8. Record usage, latency, model, prompt version, route, and outcome.
9. Return typed result plus recoverable diagnostics.

## Failure Categories

Use stable categories rather than provider-specific error strings:

- configuration missing
- authentication failed
- quota exceeded
- rate limited
- unsupported model or feature
- input too large
- output validation failed
- safety refusal
- provider unavailable
- timeout
- unknown provider error

For user-facing errors, explain the next action. For admin diagnostics, show route, provider, model, request size class, retry count, and sanitized provider code.

## Observability

Record enough to debug behavior without storing sensitive prompts by default.

Recommended event fields:

- `requestId`
- `actorId` or anonymous/session marker
- `workspaceId` if applicable
- `featureRoute`
- `providerId`
- `modelId`
- `promptId`
- `promptVersion`
- `agentId` if applicable
- `latencyMs`
- `usage`
- `status`
- `errorCategory`
- `fallbackUsed`

Sensitive payload capture should be opt-in, retention-limited, and permission-gated.

## Admin Operations

Admin AI configuration commonly needs:

- provider enable/disable
- key validation
- model discovery
- route assignment
- default fallback policy
- usage dashboard
- rate-limit controls
- prompt version publishing
- agent preset publishing
- incident kill switch per provider, route, or feature

Each mutation should be audited through the auth/admin templates when the project has privileged operators.

## Review Checklist

- Feature code does not import provider SDKs directly unless it is an adapter.
- Every provider call has timeout, retry policy, and stable error classification.
- Model selection is route-based, not hardcoded in UI components.
- Prompt resolution is traceable to prompt ID and version.
- Prompt ownership and synchronization path are documented.
- User or workspace prompt overrides are respected when the product supports them.
- Usage and latency are recorded at the execution boundary.
- API keys are never exposed to client bundles or logs.
- Admin changes are validated and auditable.
