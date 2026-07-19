---
trigger: always_on
description: Authoritative compact devrules orchestration entry reached from official Agent entry files.
ownership: shared
governs: agent
activation: always
enforcement: hard
decision_owner: devrules
side_effects: none
---

# devrules Orchestration Core

This is the single devrules entry; other context loads only when a route, instruction, failure, or boundary requires it.

## Operating Contract

1. System, developer, user, and deeper repository instructions outrank devrules.
2. Work from goals, constraints, evidence, and root cause. Bounded containment
   may reduce harm, but is not root-cause resolution; do not hide defects with
   broad tolerance, retries, or silent degradation.
3. Before non-trivial edits, state goal, constraints, and done criteria; locate
   the behavior owner, callers, tests, side effects, and nearest guidance.
4. Before the first local write in a GitHub-backed repository, use
   `workflows/git-multi-device-sync.md` to fetch and prove a clean attached
   branch at exact upstream equality. Unverified, dirty, ahead/behind, diverged,
   detached, or missing-upstream state blocks writes, not read-only inspection.
5. Keep changes focused and modular. Preserve dependency direction, explicit
   interfaces, repository conventions, and the selected code-health policy.
6. For bugs or failed checks, reproduce and gather evidence before changing code.
7. Verify the changed boundary in proportion to risk, read fresh output, review
   the diff, and report passed checks, limitations, and remaining risk.
8. Keep secrets and private data out of source, logs, artifacts, and memory.
9. Treat line, byte, file-size, and similar numeric budgets as review signals
   unless an evidenced platform limit makes them hard. Never delete required
   meaning, compress readability, or split a coherent owner merely to hit a
   heuristic threshold; document the justified exception instead.

## Fast Routing

Do not read `hooks/hooks.json`, `rules/workflow-management.md`, every core rule,
or every language profile by default.

1. Enter through the official Agent file, then treat this as the authoritative shared engineering context; use the entry only for tool/project specifics.
2. Read `memory/project-profile.md` only when project shape, commands, source
   roots, or architecture are not already known.
3. Use the generated routing card or injected hook context to select the
   smallest applicable workflow.
4. Read the nearest README/instruction for files being changed.
5. For executable changes, read `workflows/code-change.md`; open a language
   profile or code-health rule only when a real decision depends on it.
6. Open other workflows, rules, templates, and memory only when triggered.

| Task signal | Minimum route |
| --- | --- |
| Executable code/config change | `workflows/code-change.md` |
| Failure, regression, unexpected behavior | `workflows/debug-root-cause.md` |
| Medium+ feature or cross-boundary change | `workflows/architecture-change-review.md` |
| Product input changes capabilities/navigation/ownership | `workflows/product-architecture-review.md` |
| Landing page creation, conversion copy, or structural refactor | `workflows/landing-page.md` |
| Documentation-only change | `workflows/documentation-update.md` |
| devrules system change | `workflows/devrules-evolution-review.md` |
| Shared-template autonomous update or scheduler | `workflows/template-auto-update.md` |
| Release or deployed persistent-contract change | `workflows/release.md`, plus production-change governance when applicable |

If routing is ambiguous, inspect only the matching hook entry. The full hook
registry is an audit/debug surface, not mandatory session context.

## Template And Instance Boundary

| Mode | Location | Write policy |
| --- | --- | --- |
| Shared template | Canonical Git clone resolved by device runtime locator | Change only for explicit template maintenance. |
| Project instance | Repository-local `devrules/` | Normal project work and project-specific memory. |

Never infer the shared template from a workspace parent. Resolve it with
`devrules location show`. Project facts stay in instances; reusable ideas are
promoted explicitly.

Every Agent-readable rule, workflow, profile, template, or hook declares its
ownership independently from when it applies:

- `shared`: devrules owns the portable source of truth; project Agent entry
  files point to it instead of copying its body.
- `seed`: devrules supplies a starter that the project may intentionally adapt.
- `local`: the project owns it; shared sync does not rewrite it.

`activation` (`always`, `conditional`, or `explicit`) determines applicability;
shared ownership never means universal activation. `decision_owner` identifies
who selects a conditional choice; ask only when a material decision is unresolved.
Shared content excludes project-private data and narrow release assumptions;
template sync preserves project identity and blocks on provenance conflicts.

The active Codex host and user select the working model and reasoning controls.
devrules must not set a default model, prefer a concrete model, or turn OpenAI
API request parameters into product requirements. Capability-specific guidance
may be used only after the current host exposes and selects that capability.

## Change And Verification Contract

For executable production code, tests, scripts, build logic, or configuration:

1. Follow `workflows/code-change.md`.
2. Add focused regression coverage for behavior changes where practical.
3. Run repository-native checks in proportion to risk; do not automatically run
   every available check.
4. When installed, finish with:

   ```bash
   node devrules/scripts/code-health.mjs audit --repo .
   ```

Escalate to architecture review only for medium+ features, broad behavior,
shared capabilities, public contracts, or cross-boundary changes.

## GitHub Publication

GitHub policy belongs to the repository or user. `inherit` preserves committed
workflows; adding or materially changing hosted CI requires explicit approval.
`allow` and `deny` are project choices. Before publication, run
`devrules repo publish-readiness`; never overwrite divergence or clean an unproven branch.

## Memory And Automation

Write durable learning only for a stable command, source root, decision,
constraint, repeated failure, or user preference. Use
`rules/memory-governance.md` for the exact target; do not record routine activity
or private transcript detail.

Scripts are dry-run by default where state changes are possible. SessionStart
device maintenance and template-update observation remain read-only. Autonomous
template convergence may run only through a separately installed device
scheduler whose policy was explicitly opted into; simulator-maintenance and
template-update schedulers have independent authority. An automatic repair
requires its own explicit user/project opt-in, while an explicit maintenance
command may install or repair it. Otherwise ask before destructive actions,
external writes, material cost, or scope expansion. Scripts update only
documented managed surfaces.

Use the request as the authority boundary: answers, reviews, diagnosis, and
planning are read-only unless the user also asks for a change; build/fix/change
requests authorize focused local edits and proportionate verification. They do
not implicitly authorize external publication, destructive cleanup, production
mutation, or a materially different product decision.

## Done Criteria

A task is complete when:

- requested outcome and acceptance criteria are met;
- the final diff is focused and has no accidental/generated files;
- relevant checks passed with fresh output, or limitations are explicit;
- documentation/contracts/memory changed only where behavior requires it;
- Git and external state match the requested workflow.

Shared-template local maintenance additionally requires applicable selftests and
the local content audit. It does not require a clean tree, network, upstream,
tag, or publication to count as locally verified. When a release or propagation
is requested, run the separate `devrules template release-audit` and satisfy its
version, provenance, clean-tree, tag, upstream, and remote-publication checks.
