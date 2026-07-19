---
description: Generic user-data backup/export coverage workflow.
ownership: shared
governs: release
activation: explicit
enforcement: gate
decision_owner: project
side_effects: external
---

# Backup Maintenance Workflow

Use this workflow when a project stores user-owned data and provides backup, restore, export, or account portability features.

## Core Principle

Any user-owned data that would cause loss or harm if omitted must be included in backup/export coverage unless there is an explicit product or security reason to exclude it.

## Triggers

- A new table, collection, file store, object bucket, or local database stores user-owned data.
- A schema change adds a user ownership field or relationship.
- A feature introduces user-generated content, settings, credentials, projects, documents, or history.
- Backup/export UI reports uncovered data.
- Restore/import logic changes.

## Steps

1. Identify all user-owned data stores.
2. Classify each store:
   - Must backup: user-created content, settings, project state, paid user assets.
   - Sensitive export: credentials, tokens, secrets, private keys; usually omit, encrypt, or redact.
   - System only: logs, analytics, platform config, public catalog data; usually exclude.
3. Update the project's backup/export registry.
4. Update restore/import mapping and ownership reassignment rules.
5. Add or update tests for export and restore paths.
6. Update README anchors and project memory if the backup architecture changed.

## Safety Checks

- Do not export raw secrets unless the product explicitly supports encrypted secret backup.
- Restore must not let one user claim another user's data.
- Imports should validate ownership, schema version, and record shape.
- Large exports should chunk or stream where needed.
- Export format changes should document version impact and restore behavior.

## Verification

- Export a sample account with representative data.
- Inspect the archive or payload structure.
- Restore into a clean test account or local fixture.
- Confirm excluded data is intentionally excluded.
- Confirm sensitive fields are redacted, encrypted, or omitted.

## Memory Update

Record durable backup architecture decisions in `devrules/memory/decisions.md`. If the project reveals a reusable backup pattern for other projects, add an evolution suggestion.

Last updated: 2026-06-11
