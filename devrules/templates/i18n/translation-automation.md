---
title: Translation Automation
description: Pattern for provider-neutral translation scripts, batching, retries, progress saves, glossary support, and admin AI settings.
ownership: seed
governs: product
activation: conditional
enforcement: example
decision_owner: project
side_effects: none
applies_to:
  - multilingual apps
  - AI-assisted translation pipelines
  - docs/content translation
  - locale file maintenance
use_when:
  - Translation files need automated generation or update.
  - Provider, model, glossary, or retry behavior must be configurable.
do_not_use_when:
  - A small manual translation change is safer and faster.
outputs:
  - translation workflow
  - provider selection checklist
  - batching and retry policy
  - progress/resume plan
  - admin configuration notes
case_sources:
  - magic-novel-forge/docs/templates early i18n automation experience
  - planner-v0/lib/ai/translation-client.ts
  - planner-v0/lib/ai/i18n-settings-actions.ts
  - planner-v0/lib/i18n/script-runner.ts
related_workflows:
  - devrules/workflows/documentation-update.md
last_reviewed: 2026-06-11
---

# Translation Automation

Translation automation should be provider-neutral. Do not hardcode stale provider pricing or declare one vendor universally best. Choose by quality, privacy, language coverage, cost class, latency, and operational control.

## Workflow

1. Validate source locale.
2. Compare target locale keys.
3. Build missing or changed translation jobs.
4. Batch jobs by size and namespace.
5. Apply glossary and style instructions.
6. Translate with retry and timeout.
7. Save progress after each batch.
8. Validate placeholders and key parity.
9. Write report and require review for sensitive copy.

## Provider Selection Checklist

Evaluate:

- target language quality
- support for glossary or terminology
- structured JSON reliability
- privacy and data retention terms
- latency
- cost class
- regional availability
- admin-configurable keys
- fallback provider

Provider choice belongs in project configuration or admin settings, not in reusable template prose.

## Batching And Resume

Batching should consider:

- provider input limits
- namespace boundaries
- glossary context
- retry isolation
- partial file writes
- crash recovery

Progress save format should allow rerunning without duplicating work.

## Prompt Pattern

Translation prompts should include:

- source locale
- target locale
- product domain
- glossary
- placeholders that must remain unchanged
- tone guidance
- output format requirements
- examples for ambiguous terms

Do not ask the model to invent missing keys or restructure locale files unless that is the explicit task.

## Admin Configuration

Mature products may expose:

- translation provider
- model route
- API key source
- glossary editor
- retry count
- batch size
- validation strictness
- dry-run mode

Changing these should be permissioned and audited in admin products.

## Review Checklist

- Script has dry-run and resumable progress.
- Placeholders remain intact.
- Source and target keys match.
- Provider choice is configurable.
- Translation reports include changed namespaces.
- Sensitive/legal copy is marked for human review.
