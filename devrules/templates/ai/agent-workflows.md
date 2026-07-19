---
title: Agent Workflows
description: Patterns for single-agent, multi-agent, pipeline, benchmark, learning, and revision workflows.
ownership: seed
governs: product
activation: conditional
enforcement: example
decision_owner: project
side_effects: none
applies_to:
  - agent runtime systems
  - AI content pipelines
  - code or repository analysis agents
  - long-form writing workflows
  - automation dashboards
use_when:
  - AI behavior needs multiple steps, multiple agents, memory, review, or learning loops.
  - Runs must be persisted, resumed, streamed, cancelled, or audited.
do_not_use_when:
  - A direct AI completion is enough and there is no workflow state.
outputs:
  - workflow architecture
  - runtime state plan
  - memory and budget policy
  - review/evaluation plan
  - failure handling checklist
case_sources:
  - NovelEditor/src/modules/agent-learning
  - NovelEditor/src/services/ai/incrementalGenerator.ts
  - DeGit/src/pages/FlowMode
  - DeGit/src/services/agent-runtime-job-runner.ts
  - auto-threads/src/components/agent/WorkflowDesigner.tsx
  - structureUI/apps/web/lib/ai-action-graph.ts
  - structureUI/apps/web/lib/ai-assistant-memory.ts
related_workflows:
  - devrules/workflows/debug-root-cause.md
last_reviewed: 2026-06-11
---

# Agent Workflows

Agent workflows turn AI from request/response into a controlled process. Treat workflow runs as first-class product objects when they are long, expensive, collaborative, or user-visible.

## Workflow Shapes

| Shape | Use When | Example |
| --- | --- | --- |
| Single-agent run | One role can complete the task. | Rewrite a paragraph. |
| Pipeline | Ordered steps transform an artifact. | extract -> outline -> draft -> polish. |
| Router | Input determines which agent or route runs. | classify request -> choose specialist. |
| Multi-agent review | Several agents evaluate or improve output. | writer -> critic -> reviser. |
| Human-in-loop | User approval is required at boundaries. | approve generated plan before execution. |
| Learning loop | The system distills examples into improved playbooks. | corpus ingestion -> benchmark -> revision. |
| Background job | Runtime exceeds interactive latency. | long export, daily report, large analysis. |

## Runtime State

A workflow run commonly tracks:

- run ID
- actor and workspace
- workflow version
- current step
- step inputs and outputs
- artifacts
- token or cost budget
- memory snapshot
- status: queued, running, waiting, paused, completed, failed, cancelled
- progress messages
- resumability marker
- audit and diagnostics metadata

Persist enough state to resume or explain failure. Do not rely only on in-memory UI state for expensive workflows.

## Memory Policy

Agent memory should be scoped:

- run memory: temporary step context
- project memory: durable project facts
- user preference memory: stable user customization
- workspace memory: team-shared context
- evaluation memory: examples and benchmark outcomes

Rules:

- Summarize long context before storing.
- Store provenance when memory affects future decisions.
- Allow inspection and deletion where user data is involved.
- Keep sensitive data out of general prompt memory.
- Use memory budgets to prevent context bloat.

## Streaming And Progress

Good progress events are semantic, not only token streams:

- plan created
- model selected
- source loaded
- draft generated
- validation failed
- fallback used
- waiting for review
- artifact saved

This makes UI, logs, and support diagnostics much easier.

## Human Review Boundaries

Require review when:

- workflow will mutate user data
- workflow will spend significant credits
- output is legally or commercially sensitive
- destructive operations are planned
- a fallback route changes expected quality

Review payload should include proposed action, reason, input summary, expected output, cost/budget class, and rollback option.

## Evaluation And Learning

Learning loops are safer when separated from production runtime:

1. Collect examples or failed runs.
2. Normalize and anonymize if needed.
3. Distill playbook or prompt candidates.
4. Run benchmark smoke tests.
5. Compare quality against baseline.
6. Publish as a new prompt, agent, or route version.

Do not let an agent silently rewrite its own production instructions without review.

## Failure Handling

For every step define:

- retryable errors
- fallback route
- validation rule
- partial artifact policy
- cancellation behavior
- user recovery action
- audit event

Common anti-patterns:

- infinite planning loops
- hidden retries that spend user credits
- memory accumulation without source tracking
- one giant prompt for every step
- runtime state stored only in the component tree

## Review Checklist

- Workflow steps have clear inputs, outputs, and validation.
- Long runs can be cancelled and resumed.
- Budget limits are enforced per run and per step.
- Progress events are useful for UI and diagnostics.
- Human review boundaries are explicit.
- Learning/evaluation is separated from production publication.
