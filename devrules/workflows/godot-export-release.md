---
description: Produce and validate repeatable Godot exports through the project's selected release lane.
ownership: seed
governs: release
activation: explicit
enforcement: gate
decision_owner: project
side_effects: external
---

# Godot Export And Release

## Trigger

Run for milestone builds, release candidates, channel promotion, Godot/export-template upgrades, or changes to export presets, signing, packaging, platform plugins, or distribution configuration.

## Inputs

- Approved source revision, Godot version, export templates, lockfiles/add-ons, and release notes.
- `templates/game/engines/godot/export-matrix.md`, `templates/game/core/release-readiness.md`, save/performance/QA evidence, and credential plan.
- Project-recorded export/release command and destination configuration.

## Responsibility Hats

- **Solo:** Engineering builds; QA validates clean installation; Release verifies identity, credentials, backup, and promotion.
- **Team:** Build/release engineering owns reproducibility; platform owners own packaging/signing; QA owns matrix; Product approves notes and go/no-go.

## Steps

1. Freeze candidate revision, version identifiers, data/assets, Godot/editor version, export templates, add-ons, and presets.
2. Validate imported resources and project configuration from a clean local state.
3. Run required tests, data validation, save compatibility, licensing, accessibility, localization, privacy, and performance gates.
4. Export through the project's recorded non-interactive lane where supported.
   Preserve an existing local or hosted lane. An Agent needs explicit approval
   before adding or materially modifying hosted GitHub Actions; only an explicit
   `automation.githubActionsPolicy=deny` prohibits them.
5. Record artifact hashes, sizes, platform identity, signing/notarization status, and source revision without logging secrets.
6. Install on a clean target environment and smoke startup, input, display, audio, core loop, save/load, quit/relaunch, and platform integration.
7. Validate upgrades from the supported prior version and fresh installs separately.
8. Review blockers and approved exceptions; decide go/no-go.
9. Promote the exact verified artifact through the authorized project release lane; archive evidence and rollback inputs.

## Outputs

- Reproducible export commands and completed export matrix.
- Identified, hashed, and signed/notarized artifacts where applicable.
- Clean-install, upgrade, smoke, save, and performance evidence.
- Go/no-go record, release notes, and rollback inputs.

## Gates

- Export is tied to an immutable source and configuration identity.
- No editor-only or machine-local hidden state is required.
- The exact artifact passes clean-install and supported-upgrade checks.
- Secrets are handled outside logs and source control.
- All blockers are closed or explicitly accepted by release authority.

## GitHub Actions Policy

- `inherit` is the default: preserve clean committed workflows and the
  project's established release lane.
- `allow` records explicit approval for the selected hosted CI change; it does
  not authorize unrelated workflows, external writes, or costly runs.
- `deny` prohibits hosted workflows for the project.

Local export and verification can remain the repository's chosen practice, but
devrules does not make that product decision for every Godot project.

## Done Criteria

The exact approved artifacts are reproducible, verified on the declared matrix, promoted through the authorized project lane, and accompanied by evidence sufficient to identify, support, or roll back the release.
