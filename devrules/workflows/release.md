---
description: Generic release readiness workflow for web, desktop, mobile, backend, and package projects.
ownership: shared
governs: release
activation: explicit
enforcement: gate
decision_owner: project
side_effects: external
---

# Release Workflow

Use this workflow when preparing a release, deployment, package publication, or user-facing version handoff.

## Phase 1: Scope Confirmation

- Identify release target: web deployment, desktop build, mobile build, backend service, package, or documentation release.
- Confirm branch, version, changelog source, and release owner.
- Check whether the repository has project-specific release or packaging workflows.
- Determine whether the release changes persistent state, schema/file format, public contracts, mixed client versions, permissions, billing, migration, or recovery. If so, run `production-change.md`; this release workflow does not replace its stage gates.

## Phase 2: Quality Gates

Run the repository's relevant checks:

- Typecheck.
- Lint.
- Tests.
- Build.
- Migration validation.
- Security or dependency checks when release risk warrants them.
- Platform-specific verification for desktop or mobile.
- `production-readiness.mjs --stage design` and `--stage preflight` when a production change plan is required.

Record exact commands and outcomes.

## Phase 3: Release Notes

Release notes should include:

- User-visible changes.
- Bug fixes.
- Breaking changes.
- Migration or configuration requirements.
- Known limitations.
- Verification evidence.

Do not claim platform support or feature completeness without verification.

## Phase 4: Packaging Or Deployment

Use the repository's official commands and platform documentation. Avoid hard-coded commands in this generic workflow. If the project has a specific release workflow, follow it after completing this generic readiness pass.

## Phase 5: Post-Release Verification

- Confirm deployed or packaged artifact is available.
- Smoke-test the most important user path.
- Confirm version/changelog matches shipped functionality.
- Record any follow-up in project memory or issue tracker.
- For a production change plan, complete its monitoring, reconciliation, and cleanup evidence, then run `production-readiness.mjs --stage post-release`.

## Done Criteria

- Release scope is clear.
- Required checks passed or risks are explicitly documented.
- Release notes are accurate.
- Artifact or deployment is verified.
- Cross-platform claims have evidence.
- Any triggered production change plan passes its required stage gates.

Last updated: 2026-07-14
