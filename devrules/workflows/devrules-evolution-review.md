---
description: Review project-local suggestions before upgrading the shared devrules template.
ownership: shared
governs: agent
activation: conditional
enforcement: advisory
decision_owner: project
side_effects: local
---

# devrules Evolution Review Workflow

Use this workflow when multiple repositories reveal the same rule, workflow, template, or script improvement.

## Principle

Project instances may suggest template improvements, but the shared template does not auto-learn from projects. A human decides what graduates into the template.

Ordinary project work writes suggestions only to the project instance. Template maintenance work may collect and review those suggestions.

## Steps

1. Collect suggestions:

   ```bash
   devrules evolution collect --root <parent> --dry-run
   ```

2. Group suggestions by theme:
   - Entry binding.
   - Context anchors.
   - Memory governance.
   - Immediate feedback updates.
   - Workflow hook.
   - Script automation.
   - Stack-specific template.
3. Reject one-off project-specific needs.
4. Promote only repeated, general, low-risk patterns.
5. Use `devrules-template-promotion.md` for accepted items so abstraction,
   template edits, baseline-protected sync, and conflict reporting stay
   consistent.
6. Update template rules, workflows, scripts, or templates explicitly.
7. Record the template decision in template-side memory or changelog.

## Promotion Criteria

Promote a suggestion when:

- It appeared in more than one repository or is clearly general.
- It reduces repeated Agent confusion or manual work.
- It does not hard-code a single project's stack, URL, credentials, or naming.
- It can be expressed as a small rule, workflow step, template section, or safe script behavior.

## Done Criteria

- Suggestions are collected.
- Accepted changes are made intentionally.
- Rejected suggestions remain in project memory or are marked as project-specific.
- Template files contain no private project data.

Last updated: 2026-07-05
