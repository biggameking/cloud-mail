export function formatCliHelp({ version, defaultAdoptionProfile }) {
  return `
devrules ${version}

Usage:
  devrules location show [--config-path <file>] [--json]
  devrules location audit [--config-path <file>] [--json]
  devrules location configure --template-root <dir> [--workspace-root <dir>] [--dry-run|--apply] [--json]
  devrules location install-launcher [--target <file>] [--dry-run|--apply] [--json]
  devrules scan --root <dir> [--json]
  devrules init --root <dir> [--dry-run|--apply] [--profile minimal|standard|full] [--sync-template] [--prune-generated-anchors] [--json]
  devrules init --repo <dir> [--dry-run|--apply] [--profile minimal|standard|full] [--sync-template] [--prune-generated-anchors] [--json]
  devrules audit --repo <dir> [--strict] [--json]
  devrules repo preflight --repo <dir> [--fetch] [--expect-sha <sha>] [--json]
  devrules repo publish-readiness --repo <dir> --fetch --verify-host [--default-branch <name>] [--wip-branches <a,b>] [--accounts <dir>] [--json]
  devrules repo handoff --repo <dir> --fetch [--json]
  devrules repo sync-template --repo <dir> [--dry-run|--apply] [--adopt-current-baseline|--reconcile-ownership] [--json]
  devrules repo refresh-entries --repo <dir> [--dry-run|--apply] [--json]
  devrules repo recover-sync --repo <dir> --transaction <id> [--dry-run|--apply] [--json]
  devrules workspace git-status [--root <dir>] [--fetch] [--json]
  devrules template status [--fetch] [--json]
  devrules template release-audit [--json]
  devrules template auto-update status [--json]
  devrules template auto-update run [--dry-run|--apply] [--allow-major] [--reconcile-ownership] [--json]
  devrules template auto-update agent-status [--json]
  devrules template auto-update ensure-agent [--dry-run|--apply] [--schedule HH:MM] [--reconcile-ownership] [--json]
  devrules template auto-update uninstall-agent [--dry-run|--apply] [--json]
  devrules registry inspect --root <dir> [--json]
  devrules registry refresh --root <dir> [--dry-run|--apply] [--json]
  devrules registry retire --type device|workspace --id <id> [--dry-run|--apply] [--json]
  devrules services init [--project <dir>] [--dry-run|--apply] [--json]
  devrules services validate [--root <dir>] [--accounts <dir>] [--recursive] [--strict] [--json]
  devrules services inspect [--root <dir>] [--accounts <dir>] [--project <id>] [--provider <name>] [--account <ref>] [--recursive] [--json]
  devrules services catalog [--root <dir>] [--accounts <dir>] [--out <dir>] [--recursive] [--dry-run|--apply] [--json]
  devrules skills list [--json]
  devrules skills recommend --query <task> [--json]
  devrules batch readiness --root <dir> [--json]
  devrules batch apply-ready --root <dir> [--dry-run|--apply] [--json]
  devrules batch sync-template --root <dir> [--dry-run|--apply] [--adopt-current-baseline|--reconcile-ownership] [--json]
  devrules workspace scan [--root <dir>] [--json]
  devrules workspace readiness [--root <dir>] [--json]
  devrules workspace apply-ready [--root <dir>] [--dry-run|--apply] [--json]
  devrules workspace sync-template [--root <dir>] [--registered|--current-only] [--dry-run|--apply] [--adopt-current-baseline|--reconcile-ownership] [--json]
  devrules workspace terminal-audit [--root <dir>] [--json]
  devrules terminal-audit --repo <dir> [--json]
  devrules memory compact --repo <dir> [--dry-run|--apply] [--json]
  devrules evolution collect --root <dir> [--dry-run|--apply] [--json]
  devrules idle status|pressure|plan|apply|agent-status|install-agent|ensure-agent|uninstall-agent [--apply] [--json] [idle script flags]

Global option: --config-path <file> selects one device-local runtime profile for any command.
Writes default to dry-run. Use --apply to mutate files.
Device-local template and workspace locations live in one runtime.json outside Git. See devrules/scripts/runtime-location.md.
Install the stable launcher once, then use \`devrules <command>\` from any directory without coupling callers to a template clone path.
Before first installation, invoke \`node <absolute-candidate-template>/scripts/devrules.mjs location install-launcher --apply\` as the only path-coupled bootstrap step.
Template-local \`audit --strict\` validates working-tree content and schema without requiring a clean tree, release tag, upstream, or network access.
Use \`template release-audit\` as the separate release gate; it fetches origin and verifies clean committed bytes, aligned versions, upstream publication, and the exact annotated remote tag.
Template apply still requires released authority: a clean, committed template Git repository with a configured remote and a monotonic template.json revision.
Template conflicts block every write for that repository. Recovery journals are stored under the target repository's Git directory.
Use repo preflight --fetch before starting on another device; use repo handoff --fetch only after every commit is pushed.
Use repo publish-readiness --fetch --verify-host before final publication to inspect Git ignore hygiene, untracked files, default/feature branches, remote divergence, and the configured GitHub account/repository identity.
Default initialization uses the ${defaultAdoptionProfile} adoption profile. Profiles describe installed devrules surface, not project quality.
Use --profile standard|full only when the project wants the additional managed surfaces. Legacy --maturity 1|2|3 remains an upgrade alias. Use --sync-template when upgrading an already initialized project instance from the current template.
Use repo sync-template for one explicitly named adopted repository; after a successful template sync it also refreshes configured root entry files and the Cursor routing card.
Use repo refresh-entries to repair configured root entry bindings and the Cursor routing card without syncing template files.
Repository audit starts with a read-only shared-template content comparison and reports it in a separate templateIssues channel; ordinary --strict evaluates local adoption issues only.
Use batch sync-template to update only generic devrules template files in already adopted repositories.
Use workspace sync-template to update every registered workspace that points at this shared template, useful when one device has multiple workspace parent directories.
Use template auto-update run for a one-shot released-template check and safe project convergence. It defaults to dry-run; scheduled apply requires an explicitly installed device agent.
Major releases remain blocked unless a manual run uses --allow-major or the device policy explicitly enables them.
Use --adopt-current-baseline only for explicit migration from pre-baseline sync state; it records current project files as baseline without overwriting them.
Use --reconcile-ownership only for explicit migration from untrusted legacy state: shared files converge to the released template while seed and local files remain project-owned.
Use --prune-generated-anchors only to remove stale README files that contain no human content beyond a generated devrules anchor.
Workspace commands prefer the device-local runtime workspace roots. The tracked template config and template parent remain compatibility fallbacks when no runtime locator exists.
Readiness groups mean: alreadyReady = already compliant, readyToApply = not compliant yet but safe for automated initialization, needsReview = inspect before mutation.
`;
}
