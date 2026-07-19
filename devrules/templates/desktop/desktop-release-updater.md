---
title: Desktop Release And Updater
description: Pattern for desktop packaging, signing, updater artifacts, release evidence, smoke tests, and rollback.
ownership: seed
governs: release
activation: explicit
enforcement: example
decision_owner: project
side_effects: none
applies_to:
  - Tauri apps
  - signed desktop apps
  - cross-platform desktop releases
  - local-first products
use_when:
  - A desktop app needs production packaging, signing, updater, or release evidence.
do_not_use_when:
  - The product is not distributed as a desktop binary.
outputs:
  - release inputs checklist
  - signing and packaging plan
  - updater publishing plan
  - smoke test checklist
  - rollback plan
case_sources:
  - SetMail release runbook
  - AutoMedia desktop completion audit
  - DeGit desktop build/release evidence
  - planner-v0 desktop build artifacts docs
related_workflows:
  - devrules/workflows/release.md
last_reviewed: 2026-06-11
---

# Desktop Release And Updater

Desktop release needs stronger evidence than a web deploy because users install signed binaries and updater artifacts.

## Release Inputs

Check:

- target commit
- version numbers across app/package/native crates
- signing materials
- updater endpoint/channel
- platform matrix
- changelog
- verification commands

## Build Outputs

Record expected artifacts:

- installer
- portable or package formats
- signature files
- updater manifest
- checksums
- release notes

## Smoke Test

After build:

- install app
- launch
- initialize local DB/storage
- run core workflow
- verify native bridge command
- verify local API or SDK if present
- verify updater check in test channel
- inspect logs for startup errors

## Rollback

Define:

- previous signed artifact location
- updater manifest rollback
- bad-release disable flag
- data migration rollback or recovery
- user communication path

## Review Checklist

- Release script does not depend on hidden local state.
- Signing keys are not stored in repo.
- Updater publishing is atomic.
- Smoke evidence is saved.
- Rollback does not overwrite previous good artifacts.
