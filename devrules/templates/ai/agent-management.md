---
title: Agent Management
description: Pattern for preset agents, custom agents, prompt references, variables, workflow steps, parent-child agents, and governance.
ownership: seed
governs: product
activation: conditional
enforcement: example
decision_owner: project
side_effects: none
applies_to:
  - AI assistants
  - workflow agents
  - creative generation agents
  - analysis agents
  - user-customizable agent platforms
use_when:
  - Users or admins need to create, edit, select, or compose agents.
  - Agents need reusable prompts, variables, model routes, tools, memory, or workflow steps.
do_not_use_when:
  - The product only has a fixed chat assistant with no reusable roles or workflows.
outputs:
  - agent asset model
  - preset/custom agent policy
  - variable and prompt reference plan
  - workflow step plan
  - governance checklist
case_sources:
  - magic-novel-forge/docs/templates early AI service experience
  - NovelEditor/src/services/agentService.ts
  - NovelEditor/src/types/agent.ts
  - NovelEditor/src/components/agents/AgentSelector.tsx
  - NovelEditor/src/modules/agent-learning
  - auto-threads/src/types/agent.ts
  - auto-threads/src/components/agent
  - DeGit/src/pages/FlowMode
  - DeGit/src/types/agentRuntime.ts
related_workflows:
  - devrules/workflows/debug-root-cause.md
last_reviewed: 2026-06-11
---

# Agent Management

Agent management is the product layer above prompts and model routes. An agent is not just one prompt. It is a reusable operating profile that can reference prompts, variables, tools, memory, routes, workflow steps, and review policies.

## Agent Asset Types

| Asset | Purpose |
| --- | --- |
| Preset agent | Product-maintained default role. |
| Custom agent | User or workspace-defined role. |
| Agent version | Immutable published snapshot. |
| Prompt reference | Link from agent to prompt definition/version. |
| Variable set | User-configurable slots used by prompts or steps. |
| Tool permission | Allowed tools or integration capabilities. |
| Workflow step | Ordered action in a pipeline. |
| Memory policy | What can be remembered, summarized, or forgotten. |
| Evaluation profile | How agent quality is tested. |

## Prompt-Agent Separation

Keep these responsibilities separate:

- Prompt definition: reusable instruction content.
- Agent definition: role, routing, tools, variables, workflow, memory, defaults.
- Workflow definition: sequence and dependency between agent steps.
- Runtime state: current run, messages, artifacts, decisions, errors, usage.

This separation enables:

- one prompt reused by many agents
- one agent with multiple prompt references
- user customization without duplicating product prompts
- prompt updates without changing agent identity
- agent A/B tests without rewriting runtime logic

## Preset And Custom Agents

Preset agents:

- curated by product or admins
- versioned and reviewed
- safe defaults for common workflows
- may be read-only for normal users

Custom agents:

- scoped to user, workspace, or project
- can override prompt references, variables, route classes, or step ordering
- should be exportable/importable when users invest in them
- should include validation before activation

Useful states:

- draft
- active
- archived
- disabled by admin
- incompatible with current model routes

## Variable System

Agent variables are the user-customization core. They should be visible, named, and documented.

Examples:

- writing style
- target audience
- project domain
- evidence policy
- output format
- risk tolerance
- preferred language
- source material scope

Validation should catch missing required variables, oversized context, invalid enum choices, and unsafe override attempts.

## Workflow Steps

An agent can be a single-step executor or part of a pipeline.

Step fields often include:

- step key
- prompt reference
- model route
- input source
- output target
- validation rule
- retry/fallback policy
- human review requirement
- next-step condition

Avoid making workflow steps opaque strings. Operators need to inspect and debug them.

## Parent And Child Agents

Parent-child relationships are useful when one orchestrator delegates to specialized workers:

- planner -> researcher -> writer -> reviewer
- repository analyzer -> file explorer -> summarizer
- story architect -> world builder -> chapter polisher

Define:

- what the parent may delegate
- what child outputs must return
- how budget is shared
- how memory is summarized between agents
- how conflicts are resolved

## Governance

Agent systems need guardrails:

- Tool permissions are explicit.
- Destructive actions require confirmation or elevated operation policy.
- Runtime budget has a hard stop.
- Agent memory is scoped and inspectable.
- Hidden system policies are not editable by normal users.
- Runs can be paused, resumed, cancelled, and audited.
- Output validation is separate from model confidence.

## Review Checklist

- Agents reference prompt definitions instead of duplicating all prompt text.
- Custom agent edits are scoped and reversible.
- Tool access is visible and least-privileged.
- Runtime state is separated from agent definition.
- Agents have version or change history when they affect production behavior.
- Parent-child delegation has budget, memory, and failure boundaries.
- User-facing agent selectors explain what each agent does in product language.
