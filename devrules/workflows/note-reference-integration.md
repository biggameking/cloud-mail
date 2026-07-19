---
description: Generic workflow for adding user-selected reference context to AI generation features.
ownership: shared
governs: agent
activation: conditional
enforcement: advisory
decision_owner: project
side_effects: local
---

# AI Reference Context Integration Workflow

Use this workflow when an AI generation feature should let users include notes, documents, memories, examples, or other project context.

## Goal

Add optional user-selected reference context without changing the base prompt contract or forcing every generation to include extra material.

## Design Requirements

- Reference context is optional.
- Selected references are visible to the user before generation.
- The feature works when no references are selected.
- Context is appended or injected through a clear adapter function.
- The AI call records enough metadata to debug which references were used, without storing private content in logs.

## Generic Integration Steps

1. Identify the AI generation entry point.
2. Add state for selected reference IDs and prepared reference text.
3. Add a selection control using the project's existing UI patterns.
4. Build final prompt or message payload through a dedicated adapter.
5. Reset selected references when the dialog, page, or task closes if persistence is not intended.
6. Add tests or smoke checks for:
   - no references selected,
   - one reference selected,
   - multiple references selected,
   - unavailable or deleted reference.

## Adapter Shape

```typescript
type ReferenceContext = {
  ids: string[];
  renderedText: string;
};

function withReferenceContext(basePrompt: string, context: ReferenceContext): string {
  if (!context.renderedText.trim()) return basePrompt;
  return `${basePrompt}\n\nReference context:\n${context.renderedText}`;
}
```

Adapt names and data shape to the project.

## When Not To Use

- Structured extraction tasks where free-form references would reduce determinism.
- Safety-critical prompts where extra context could override policy or validation.
- Very small one-click AI helpers where reference selection adds more friction than value.

## Documentation

Update the relevant README anchor with:

- Where references are selected.
- How reference text is inserted.
- What metadata is stored.
- Any privacy constraints.

Last updated: 2026-06-11
