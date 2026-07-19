---
title: Import Export Contracts
description: Pattern for data import/export, manifests, validation, deduplication, roundtrip checks, and user-facing import flows.
ownership: seed
governs: product
activation: conditional
enforcement: example
decision_owner: project
side_effects: none
applies_to:
  - data managers
  - desktop apps
  - content platforms
  - template libraries
  - migration tools
use_when:
  - Users or operators need to move data into or out of the product.
do_not_use_when:
  - Data never crosses product boundaries.
outputs:
  - import/export manifest
  - validation plan
  - deduplication policy
  - roundtrip test checklist
case_sources:
  - planner-v0 data import/export modules
  - structureUI exporters
  - DeGit prompt import/export
  - FrameCast project export modules
  - magic-novel-forge import/export services
related_workflows:
  - devrules/workflows/backup-maintenance.md
last_reviewed: 2026-06-11
---

# Import Export Contracts

Import/export is an integration surface. Treat formats and manifests as contracts.

## Export Package

Include:

- manifest
- version
- source app version
- created time
- data files
- asset files
- checksums when useful
- README or summary
- compatibility notes

## Import Flow

Import should:

- validate package shape
- preview contents
- detect duplicates
- map unsupported fields
- allow dry-run where possible
- report warnings
- preserve source provenance

## Deduplication

Deduplication can use:

- stable IDs
- content hashes
- user-selected merge keys
- import session IDs
- source file paths

Do not silently overwrite user content without preview.

## Roundtrip Check

Test:

1. create representative data
2. export
3. import into clean workspace
4. compare important records and files
5. verify UI opens imported content
6. verify unsupported fields are reported

## Review Checklist

- Export format has a version.
- Import validates before writing.
- Users can preview destructive or merging changes.
- Roundtrip test exists for important data.
- Sensitive data handling is documented.
