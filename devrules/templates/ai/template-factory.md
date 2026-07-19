---
title: AI Template Factory
description: Pattern for extracting reusable templates from examples, cleaning source material, adapting formats, and maintaining prompt/template libraries.
ownership: seed
governs: product
activation: conditional
enforcement: example
decision_owner: project
side_effects: none
applies_to:
  - content template libraries
  - prompt template factories
  - document-to-template workflows
  - creative production systems
  - reusable generation playbooks
use_when:
  - Users upload or select examples and want reusable templates.
  - A project needs extraction, cleanup, adaptation, preview, and library management.
do_not_use_when:
  - The output is a single one-off generation with no reusable artifact.
outputs:
  - extraction workflow
  - cleanup policy
  - format adaptation plan
  - template library structure
  - quality checklist
case_sources:
  - NovelEditor/src/modules/template-factory
  - NovelEditor/src/prompts/template-factory
  - NovelEditor/src/modules/template-library
  - NovelEditor/src/modules/prompt-generator
  - FrameCast/src/templates
  - DeGit/src/components/business/FileTemplates
related_workflows:
  - devrules/workflows/documentation-update.md
last_reviewed: 2026-06-11
---

# AI Template Factory

A template factory turns raw examples into reusable structured assets. It is useful for prompts, writing templates, video templates, document formats, code file templates, and repeatable creative patterns.

## Workflow

1. Ingest source material.
2. Clean encoding, formatting, boilerplate, and noise.
3. Segment into meaningful parts.
4. Extract reusable structure.
5. Detect variables and optional sections.
6. Adapt format for target surface.
7. Generate preview and examples.
8. Save to a library with metadata.
9. Track usage, feedback, and revisions.

## Source Material Types

- pasted text
- uploaded document
- selected project file
- generated artifact
- screenshot-derived description
- prompt history
- manually curated example
- external public template

Record source provenance when the template will be reused in a product or team setting.

## Cleanup Policy

Useful cleanup stages:

- normalize encoding
- remove duplicate whitespace
- preserve meaningful line breaks
- detect headings and sections
- strip unrelated headers/footers
- convert tables or lists into stable structure
- remove accidental secrets or personal data
- retain a diff or preview of cleanup changes

Do not over-clean creative material until style is lost. Let the user inspect changes when fidelity matters.

## Extraction Pattern

Template extraction should identify:

- purpose
- audience
- required inputs
- optional inputs
- repeated sections
- style/tone constraints
- output format
- examples
- anti-examples
- validation rules

For AI prompt templates, also identify:

- system instruction boundary
- user-provided variable slots
- examples that should remain examples
- constraints that should become validation checks
- model route assumptions

## Format Adaptation

The same template may need different output formats:

- Markdown
- JSON-like structured output
- UI form config
- prompt pack
- document outline
- video or slide storyboard
- code file scaffold

Keep adaptation separate from extraction. A good extracted template can be rendered into many formats.

## Library Management

Template library records often need:

- name
- category
- tags
- source
- version
- preview
- required variables
- example output
- compatibility notes
- author or owner
- usage count
- last reviewed date

For product UIs, include search, filters, preview, detail panel, duplicate, edit, archive, import, and export.

## Quality Checklist

- Template has a clear purpose and output.
- Variables are named in product language.
- Required inputs are distinguishable from optional inputs.
- The source material was cleaned without losing important structure.
- Preview output is representative.
- Template can be adapted without rewriting extraction logic.
- Sensitive source data is removed or permissioned.
- Users can manually adjust the extracted result before saving.
