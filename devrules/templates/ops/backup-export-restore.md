---
title: Backup Export Restore
description: Pattern for data backup, export, restore, retention, cleanup, integrity checks, and roundtrip testing.
ownership: seed
governs: product
activation: conditional
enforcement: example
decision_owner: project
side_effects: none
applies_to:
  - SaaS products
  - desktop apps with local or cloud data
  - content platforms
  - admin tools
  - data-heavy editors
use_when:
  - A project stores user data, generated artifacts, project files, or operational state that must be recoverable.
do_not_use_when:
  - No persistent data exists.
outputs:
  - backup scope
  - export format plan
  - restore policy
  - retention and cleanup policy
  - roundtrip test checklist
case_sources:
  - planner-v0/lib/data-backup
  - planner-v0/lib/data-export
  - DeGit/src/services/backup-job-runner.ts
  - DeGit/src/services/tauri-api/backup.ts
  - FrameCast/src/projects/export-job.ts
  - NovelWiki/src/lib/export
related_workflows:
  - devrules/workflows/backup-maintenance.md
last_reviewed: 2026-06-11
---

# Backup Export Restore

Backup is not complete until restore is tested. Export is not complete until the user or operator can understand what the archive contains.

## Scope

Define what is included:

- user profile
- workspace/project records
- documents/content
- generated artifacts
- settings
- prompt or agent configs
- billing evidence if allowed
- audit logs if allowed
- files or blobs

Define what is excluded:

- secrets
- provider tokens
- cache
- transient jobs
- data owned by another tenant

## Export Format

Good exports include:

- manifest
- version
- created time
- source app/version
- data files
- file checksums
- schema notes
- user-readable README

Choose JSON, CSV, ZIP, database dump, or custom package based on recovery and user expectations.

## Restore Policy

Restore decisions:

- overwrite or merge
- dry-run preview
- conflict handling
- partial restore support
- permission required
- elevated verification
- rollback after restore failure
- schema migration during restore

## Retention And Cleanup

Policy should cover:

- backup frequency
- retention period
- storage location
- encryption
- cleanup job
- manual deletion
- legal hold or compliance constraints

## Roundtrip Test

Test:

1. create sample data
2. export or backup
3. delete or isolate original
4. restore into clean environment
5. verify counts and key records
6. verify files open
7. verify permissions and ownership
8. verify app can run on restored data

## Review Checklist

- Backup excludes secrets.
- Restore requires appropriate permission and verification.
- Export has manifest and version.
- Roundtrip restore is tested.
- Cleanup does not delete active or unverified backups.
