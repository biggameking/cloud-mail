---
title: Security Domain Templates
description: Index for secrets, privacy, local security, sensitive operations, abuse paths, and security review.
ownership: shared
governs: agent
activation: conditional
enforcement: example
decision_owner: project
side_effects: none
applies_to:
  - SaaS apps
  - AI products
  - desktop apps
  - admin systems
  - payment systems
use_when:
  - A feature touches secrets, tokens, private content, local storage, payment, admin power, or external providers.
do_not_use_when:
  - The task has no security or privacy impact.
outputs:
  - secret handling policy
  - privacy boundary
  - local security checklist
  - review questions
case_sources:
  - SetMail security modules
  - planner-v0 BYOK and desktop key storage policy
  - DeGit encrypted sync and backup
  - cardforge RedditFlow crypto/auth modules
  - magic-novel-forge RLS and callback tests
related_workflows:
  - devrules/workflows/debug-root-cause.md
  - devrules/workflows/release.md
last_reviewed: 2026-06-11
---

# Security Domain Templates

Security templates are for design-time review. They do not replace project-specific threat modeling or dependency scanning.

## Templates

| Template | Use For |
| --- | --- |
| `secrets-privacy.md` | API keys, tokens, private content, logging, retention, redaction. |
| `local-security.md` | Desktop/local-first trust boundary, keychain, encryption, localhost API. |
| `security-review.md` | Review checklist for new sensitive features and release gates. |
