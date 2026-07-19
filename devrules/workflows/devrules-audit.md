---
description: Audit a repository's devrules adoption and context health.
ownership: shared
governs: agent
activation: conditional
enforcement: advisory
decision_owner: project
side_effects: local
---

# devrules Audit Workflow

Use this workflow to inspect whether a repository follows the devrules system.

## Audit Areas

| Area | Check |
| --- | --- |
| Profile and ownership | Resolve the selected `minimal`, `standard`, or `full` profile plus explicitly enabled surfaces; do not infer activation from copied files. |
| Entry binding | For profiles that bind an Agent entry, each configured entry preserves human content and contains one managed pointer to `devrules/always-readme.md`. |
| Core instance | The manifest and baseline files required by the selected profile exist and are internally consistent. |
| Memory | When durable memory is enabled, selected memory files follow retention, privacy, and distillation rules. Otherwise report `not_applicable`. |
| Workflows and hooks | When routing is enabled, structured activation conditions and selected project workflows are valid. Dormant registry entries are not missing work. |
| Context anchors | When anchors are selected, only the declared source roots and semantic modules require maintained anchors. |
| Config | When config participates in the selected profile, it is valid and records project-owned choices without silently expanding scope. |
| Automation | When automation is enabled, scripts default to dry-run, make side effects explicit, and use managed blocks for edits. |
| Template alignment | If a trusted shared-template source is available, report local content drift and sync conflicts read-only. This is context, not a prerequisite for evaluating local adoption. |

## Steps

1. Run the local content/adoption audit:

   ```bash
   devrules audit --repo <repo>
   ```

2. Resolve the selected profile and enabled surfaces from manifest, project
   config, and explicit project decisions. If selection is missing or
   contradictory, report that ambiguity; do not assume `full` to maximize the
   checklist.
3. Review core and entry findings, then only the conditional areas selected by
   that profile/config. Treat copied but inactive memory, hook, template,
   anchor, or automation assets as dormant library content.
4. Review shared-template comparison information when a trusted source is
   available:

   - `current`: no local sync action;
   - `update-available`: inspect `repo sync-template` as a separate dry-run;
   - `conflict`: preserve project-owned changes and resolve ownership before applying;
   - `unavailable` / `blocked`: report that template comparison was not
     completed, but continue the local content/adoption audit.

   `devrules audit --repo` does not certify clean Git state, upstream parity,
   tags, or publication readiness. Shared-template release work uses
   `devrules template release-audit` as a separate gate.
5. For batch work, run:

   ```bash
   devrules batch readiness --root <parent>
   ```

6. For batch dry-run application, run:

   ```bash
   devrules batch apply-ready --root <parent>
   ```

7. Record observed adoption level using `rules/system-maturity.md` separately
   from profile compliance. A higher level is not required for a healthy
   `minimal` or `standard` project.
8. Decide whether to fix applicable issues immediately, apply only the
   `readyToApply` group, or record a project-owned follow-up when durable memory
   is enabled.

## Output

An audit result should include:

- Selected adoption profile, its source, explicitly enabled surfaces, and any
  unresolved ownership/activation ambiguity.
- Local audit scope and profile-applicable issues; unselected surfaces should
  be `not_applicable`, not defects.
- Shared-template content comparison status, source identity, pending local
  content changes, conflicts, or unavailability in a separate `templateIssues`
  channel when that comparison ran; ordinary `--strict` evaluates local
  adoption issues only.
- Observed adoption level, clearly separated from profile compliance and project quality.
- Missing or duplicated entry bindings required by the selected profile/config
  as issues.
- Existing Agent entry files selected for devrules binding that lack the managed block.
- Missing files required by the selected profile as issues.
- Missing managed README anchors only when the project selected those anchor
  targets; otherwise anchors are `not_applicable`.
- Legacy devrules-like files that were not imported, or imports that still need
  human distillation, only when legacy normalization is part of the selected scope.
- Generated README placeholder content and empty project-profile command tables
  as recommendations only for an enabled surface, unless project config makes them strict.
- Batch readiness grouping: already ready, ready to apply, or needs review.
- Batch apply-ready summary: processed ready repositories and skipped already-ready or needs-review repositories.
- Recommended next step.

## Verification

If fixes are applied, rerun `devrules audit --repo <repo>` and confirm the
selected profile passes without duplicate managed blocks or newly activated
surfaces. Dirty working trees and offline/unavailable upstream state do not by
themselves invalidate this local audit. Run `devrules template release-audit`
only when the task is to certify and publish the shared template.

Last updated: 2026-07-17
