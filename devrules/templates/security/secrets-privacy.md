---
title: Secrets And Privacy
description: Pattern for secret storage, private content handling, logging redaction, retention, and data minimization.
ownership: seed
governs: agent
activation: conditional
enforcement: example
decision_owner: project
side_effects: none
applies_to:
  - AI provider keys
  - payment secrets
  - OAuth tokens
  - local credentials
  - private user content
use_when:
  - A feature handles secrets, tokens, private data, prompts, files, or logs.
do_not_use_when:
  - The feature is purely public content with no sensitive data.
outputs:
  - secret inventory
  - redaction policy
  - retention policy
  - privacy checklist
case_sources:
  - SetMail security modules
  - planner-v0 desktop BYOK policy
  - DeGit encrypted sync
  - NovelWiki storage and prompt services
related_workflows:
  - devrules/workflows/release.md
last_reviewed: 2026-06-11
---

# Secrets And Privacy

Security design starts with an inventory.

## Secret Inventory

List:

- provider API keys
- OAuth tokens
- session cookies
- payment secrets
- webhook signing secrets
- local encryption keys
- user BYOK keys
- signing keys

For each secret define storage, access boundary, rotation, logging policy, and deletion path.

## Private Data Handling

Private data may include:

- prompts and generated outputs
- uploaded files
- email bodies
- user documents
- analytics identifiers
- billing records
- local paths

Minimize what crosses process, network, and logging boundaries.

## Redaction Policy

Redact:

- keys and tokens
- authorization headers
- private file paths when not needed
- raw provider payloads
- full prompts or documents unless explicitly captured under policy

## Review Checklist

- Secrets never enter client bundles.
- Logs are redacted by default.
- Sensitive debug capture is permissioned and retention-limited.
- User data deletion/export rules are known.
- Provider data retention terms are considered for AI and email integrations.
