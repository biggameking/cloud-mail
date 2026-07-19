---
description: Audit design consistency, content quality, and accessibility across an existing UI.
ownership: shared
governs: product
activation: conditional
enforcement: advisory
decision_owner: project
side_effects: local
---

# Workflow · design-audit（设计一致性、内容与可访问性审计）

Use for a requested audit, a risk-based pre-release review, or visible design
drift. A fixed calendar cadence is a project choice.

## 1. Activate the correct system

Classify the repository using `rules/design-agent-rules.md` and identify its real
design owner. In `project_native` mode audit against native platform guidance,
components, assets, tests, and repository docs. Managed `DESIGN.md`, guard,
sync/check, changelog, and allowlist concepts are `N/A` unless already adopted.

## 2. Gather evidence without changing behavior

Discover existing audit/lint/test/preview commands from project manifests and
guidance. Run the smallest relevant set. If an adopted managed system declares
guard, inventory, or sync-check commands, capture their structured output; do not
invent npm aliases or install a scanner to satisfy this workflow.

Inspect representative high-value and high-risk surfaces for:

- inconsistent semantic values or duplicated component responsibilities;
- incomplete focus, navigation, labeling, contrast, text scaling, touch target,
  motion, and loading/empty/error/recovery states;
- placeholder, fabricated, implementation-focused, or redundant interface copy;
- adaptive-layout failures with long/authentic content;
- generated artifacts that no longer match their confirmed source.

## 3. Classify each finding

- **align**: bring an isolated deviation back to an existing project pattern;
- **evolve**: update the authoritative system because repeated evidence shows a
  legitimate new semantic need;
- **except**: retain a justified brand, chart, third-party, or platform-specific
  case in the repository's normal exception mechanism;
- **defer**: record an owned, bounded item when immediate change is outside the
  task or unsafe.

Frequency may inform judgment but does not automatically create a token. An
increase in exceptions is a review signal, not a universal failure threshold.

## 4. Report and verify

Use the project's existing issue/report location, or return the audit in the task
when no durable artifact was requested. Rank findings by user impact and risk;
include evidence, proposed owner, and a repeatable verification path.

If fixes are in scope, apply them through the actual design owner and rerun the
relevant project-native checks plus visual/accessibility inspection. Do not turn
an audit request into an unapproved redesign or toolchain migration.

## Completion

- Activation mode, authority, surfaces, content/states, and commands inspected
  are explicit.
- Each finding has evidence, severity, and a safe disposition.
- Fresh verification is reported for any applied fixes.
- Managed artifacts/commands are clearly `N/A` where not adopted.
