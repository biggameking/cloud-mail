---
title: Prompt Management
description: Pattern for prompt registry, versioning, variables, overrides, effective prompt resolution, review, and prompt library UI.
ownership: seed
governs: product
activation: conditional
enforcement: example
decision_owner: project
side_effects: none
applies_to:
  - prompt libraries
  - configurable AI features
  - multi-agent systems
  - prompt A/B testing
  - content generation platforms
use_when:
  - Prompts must be reused, edited, reviewed, localized, tested, or versioned.
  - Users or admins can customize prompt behavior.
  - Agents need to reference shared prompt definitions.
do_not_use_when:
  - A prompt is truly local to a small script and has no product lifecycle.
outputs:
  - prompt registry pattern
  - variable strategy
  - override resolution policy
  - lean prompt contract
  - prompt publishing workflow
  - prompt QA checklist
case_sources:
  - magic-novel-forge/docs/templates early AI service experience
  - NovelEditor/src/services/promptDefinitionService.ts
  - NovelEditor/src/services/promptAssemblyService.ts
  - NovelEditor/src/services/promptTemplateService.ts
  - NovelEditor/src/modules/production-prompt-library
  - NovelWiki/src/lib/prompts
  - NovelWiki/src/components/prompts
  - DeGit/src/pages/Prompts
  - auto-threads/src/components/prompt
related_workflows:
  - devrules/workflows/documentation-update.md
  - devrules/workflows/debug-root-cause.md
last_reviewed: 2026-06-11
---

# Prompt Management

Prompt management turns prompts from hidden strings into versioned product assets. The core idea from the earlier AI template remains important: prompts and agents should be separated.

An agent references prompt definitions; prompt definitions can be reused, reviewed, tested, and overridden independently.

## Lean Prompt Contract

Write the smallest prompt that completely specifies the task. This contract is
model-neutral and applies before any provider or model overlay:

- State the outcome, relevant constraints, acceptance evidence, and output
  shape concretely.
- Give each instruction once at the highest effective scope. Remove repeated or
  paraphrased copies across system, developer, agent, workflow, and task layers.
- Include only tools, context, examples, and edge cases that can affect the
  current decision.
- Make autonomy boundaries explicit: actions the runtime may perform directly,
  actions requiring approval, and conditions that require stopping or handing
  off.
- Specify response length, tone, structure, and machine-readable contracts when
  the consumer depends on them. Do not rely on vague requests such as "be
  concise" when a concrete limit or schema exists.
- Structure long context with stable labels and keep instructions distinct from
  reference material and untrusted user content.

Do not add prompt text merely because a newer model is available. Change one
prompt behavior at a time, tie the change to an observed failure or product
requirement, and compare it with the previous version on the same evaluation
set.

## Prompt Asset Types

| Asset | Purpose |
| --- | --- |
| Prompt definition | Canonical instruction or message template. |
| Prompt version | Immutable snapshot used by runtime and audit. |
| Prompt variant | Alternative wording for testing, locale, model, or tone. |
| Variable definition | Named input slot with purpose and validation hint. |
| Prompt package | Group of prompts for one feature, workflow, or agent. |
| User override | User or workspace customization layered over a base prompt. |
| Prompt run record | Execution evidence for review and debugging. |

## Prompt Registry Pattern

A registry should answer:

- What prompt exists?
- Which feature or agent uses it?
- Which version is published?
- Which variables are required?
- Which model routes are compatible?
- Who can edit, approve, or publish?
- What changed between versions?
- Which runs used a version?

Store prompt versions immutably when possible. Editing a published prompt should create a new version, not mutate old execution history.

## Variable Strategy

Variables are the safe customization surface. Examples:

- `audience`
- `tone`
- `sourceText`
- `locale`
- `domainGlossary`
- `projectContext`
- `styleGuide`
- `previousDraft`

Variable guidance should include:

- expected type or format
- required or optional
- maximum size
- default value
- sanitization policy
- whether user input may override it

## Effective Prompt Resolution

Resolve prompts in a predictable order:

1. System or product safety preamble.
2. Base prompt definition.
3. Published version selection.
4. Model-specific adapter text when needed.
5. Locale or domain variant.
6. Workspace override.
7. User override.
8. Runtime variables.
9. Final size check and truncation policy.

The runtime should be able to show an "effective prompt summary" without exposing hidden safety text or secrets.

## Override Policy

Useful override scopes:

- Global default.
- Feature default.
- Workspace or tenant.
- User.
- Project or document.
- One run only.

Override risk levels:

- Low: tone, output style, language.
- Medium: workflow ordering, detail level, examples.
- High: safety constraints, system instructions, hidden policies, provider config.

High-risk overrides should require admin permission, review, or a separate advanced mode.

## Prompt Library UI Patterns

Prompt management benefits from a dedicated product surface:

- prompt list with tags, feature, status, and version
- detail panel with rendered preview
- variable editor with examples
- diff between versions
- test run panel
- usage history
- publish/archive controls
- import/export for prompt packs

Avoid a single giant text area without metadata. It becomes impossible to audit.

## Prompt QA

Before publishing:

- Record the baseline model route, prompt version, tool set, and decoding or
  reasoning controls needed to reproduce the comparison.
- Test happy path, empty input, long input, and adversarial input.
- Validate output format if the consumer expects JSON or structured data.
- Run against the intended model route and at least one fallback route.
- Compare prompt revisions on the same cases and track at least task completion,
  evidence completeness, approval correctness, output-contract validity,
  latency, and cost or token usage where observable.
- Reject a leaner prompt if it makes completion, evidence, safety, or approval
  behavior worse; smaller text is an optimization, not the acceptance target.
- Check locale and tone when the prompt is user-facing.
- Record examples of good and bad outputs.
- Verify that sensitive system policy is not exposed in debug UI.

## Case Hints

- NovelEditor's prompt assembly pattern is a useful model for resolving prompt definitions, variables, and runtime context.
- NovelWiki's prompt templates and A/B components show prompt operations as a product feature, not only developer config.
- DeGit's prompt manager separates prompt skill modeling, details UI, analysis cache, and tests.
- auto-threads separates scenario, role, and prompt configuration, which is a useful mental model for agent prompt composition.
