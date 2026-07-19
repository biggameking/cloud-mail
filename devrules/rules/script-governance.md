---
description: Cross-platform automation rules for devrules scripts.
ownership: shared
governs: agent
activation: conditional
enforcement: advisory
decision_owner: project
side_effects: none
---

# Script Governance

Scripts in `devrules/scripts/` automate devrules maintenance. They must be safe to run in repositories with user work in progress.

Scripts are allowed and expected in project instances when they make context, audit, memory, or workflow maintenance repeatable. They are not a license to hide product behavior or project-specific side effects in the rules system.

## Defaults

- Prefer Node.js `.mjs` and standard library APIs.
- Support Windows and macOS paths. Normalize repository-relative paths to forward slashes in config, manifests, and reports.
- Resolve shared-template and workspace roots through the one device-local
  runtime locator defined in `devrules/scripts/runtime-location.md`. Keep
  machine absolute paths out of tracked template and project config.
- Default to dry-run for any command that can write files.
- Require explicit `--apply` for mutation.
- Print planned changes before applying.
- Use managed blocks for edits to human-owned files.
- Be idempotent across repeated runs.
- Retry transient Windows file-lock reads such as `EBUSY` or `EPERM` before failing a batch operation.
- Avoid shell-specific syntax in core scripts. When a shell command is unavoidable, document platform assumptions and provide an explicit report-only or no-op containment path only after the unsupported platform behavior is understood.
- On Windows, non-interactive child processes must not create visible terminal windows. Use `windowsHide: true` for Node child processes, `CREATE_NO_WINDOW` for Rust/Tauri commands, and `Start-Process -WindowStyle Hidden` for PowerShell background launches.
- On macOS, non-interactive automation must not create unbounded Keychain, signing, password, Allow/Deny, Always Allow, sudo, or privacy/security prompt loops. Prompt-prone commands need a preflight explanation, bounded timeout, and one-attempt stop rule.

## File Mutation Rules

Scripts may:

- Create missing devrules instance files.
- Insert or update managed blocks.
- Generate manifests and memory placeholders.
- Preserve existing project manifest maturity, semantic modules, anchor
  candidates, filled project-profile command tables, and local hook
  classifications during template sync.
- Normalize missing hook `scope` metadata without changing hook routing
  behavior. Baseline template hooks default to `universal`; unknown
  project-local hooks default to `local`.
- Create project-local `devrules/config.json` and `devrules/hooks/`.
- Report missing or stale managed README anchors.
- Report batch readiness groups before large-scale initialization.
- Apply batch initialization only to repositories classified as ready, while skipping already-ready and needs-review repositories.
- Bind configured Agent entry files through managed blocks.
- Collect project-local evolution suggestions into the template review file.

Scripts must not:

- Delete human-authored content.
- Downgrade a repository's existing devrules maturity level or blank local
  project facts during template synchronization.
- Rewrite official entry files wholesale.
- Modify secrets or environment files.
- Run destructive Git commands.
- Apply migrations, formatters, or codegen unless a workflow explicitly asks and the user confirms.
- Launch visible terminal windows for background/dev-helper processes unless the user explicitly needs an interactive console.

## Template Scripts Vs Project Scripts

| Script type | Location | Purpose | Promotion rule |
| --- | --- | --- | --- |
| Template script | Shared `devrules/scripts/` | Generic initialization, audit, memory compaction, evolution collection, managed-block maintenance. | Edit only during explicit template-maintenance work. |
| Project script | Repository instance `devrules/scripts/` | Project-local automation for anchors, checks, generated reports, or workflow helpers. | Keep local unless the same need repeats across projects; then write an evolution suggestion. |

Project scripts may call repository package scripts or platform tools only when the workflow explains the side effects. Prefer producing a report over mutating product files. If a project script needs to mutate files outside `devrules/` or managed blocks, it must require `--apply` and document the target scope.

## Cross-Platform Requirements

Shared scripts must run from Windows PowerShell, macOS shells, and Agent tool shells without relying on shell-specific quoting.

Use these conventions:

- Use Node.js filesystem APIs instead of shell pipelines for core logic.
- Normalize stored paths to repository-relative forward-slash paths.
- Read and write UTF-8 explicitly.
- Avoid PowerShell-only `echo` or `Set-Content` behavior for generated source files.
- Avoid Bash-only globbing or process substitution in shared scripts.
- Keep shell wrappers optional and thin when a project needs them.
- Treat file locks on Windows as transient and retry safe reads before failing batch work.

When a script cannot be cross-platform, mark the platform in its filename or README and provide a visible no-op or report-only containment path. Do not hide unsupported platform failures behind silent fallback behavior.

## macOS Credential And GUI Prompt Rules

Scripts and Agent commands that touch macOS credentials or protected system permissions must be designed for unattended execution.

Prompt-prone surfaces include:

- login keychain reads, unlocks, imports, and private-key access;
- `security find-*`, `security import`, and `security set-key-partition-list`;
- `codesign`, `xcodebuild archive`, `xcodebuild -exportArchive`, notarization, and Apple signing identities;
- browser cookie or password-store decryption;
- `sudo` and macOS privacy/security permission prompts.

Rules:

- Declare the credential or permission surface before running the command.
- Prefer dedicated keychains, scoped API keys, explicit environment variables, or already-authorized credentials over reading the user's login keychain interactively.
- Batch related signing or credential work after a single deliberate authorization window.
- Use bounded timeouts for commands that can hang behind an invisible GUI prompt.
- Stop after the first prompt, auth failure, or timeout. Do not retry in loops, do not launch parallel attempts, and do not keep asking the user for passwords.
- Do not print secrets, decrypted cookies, token values, private keys, or Keychain item values. Clean temporary credential files created for automation.
- If persistent `Always Allow` access is needed, surface the exact tool, keychain item, and tradeoff to the user instead of assuming it.

## CLI Contract

All commands should support:

- `--dry-run` as default behavior for writes.
- `--apply` to write.
- `--json` for machine-readable output when practical.
- `workspace` commands that prefer locator `workspaceRoots`, then use tracked
  template configuration only as a compatibility fallback.
- `repo sync-template --repo <repo>` for an explicitly selected adopted
  repository without sibling scanning or initialization side effects.
- `workspace sync-template --registered` for the current device's active,
  explicitly template-bound workspace shards; do not require a workspace-local
  template clone or symlink.
- Batch commands that summarize many repositories without dumping every file action by default.
- A safe batch apply command that defaults to dry-run and filters out repositories needing manual review.
- Readiness output must clearly state that `readyToApply` means "not compliant yet, but safe to initialize", not "already satisfies requirements".
- Clear exit codes: `0` success, non-zero for command errors.

## Script Documentation Contract

Every non-trivial script should have either inline `--help` output or a short entry in `devrules/scripts/README.md` with:

- purpose;
- read scope;
- write scope;
- default dry-run behavior;
- required flags for mutation;
- platform assumptions;
- verification command.

Agents should read `script-governance.md` and the script help before adding or running scripts that mutate files.

## Managed Blocks

Use stable marker comments:

```markdown
<!-- DEVRULES:NAME-START -->
managed content
<!-- DEVRULES:NAME-END -->
```

Automation owns only the content between markers.

## Baseline Commands

```bash
devrules location show
devrules location audit
devrules workspace scan
devrules workspace readiness
devrules workspace apply-ready --apply
devrules scan --root <parent>
devrules batch readiness --root <parent>
devrules batch apply-ready --root <parent> --apply
devrules repo sync-template --repo <repo>
devrules repo sync-template --repo <repo> --apply
devrules workspace sync-template --registered
devrules workspace sync-template --registered --apply
devrules init --repo <repo> --apply
devrules audit --repo <repo>
devrules workspace terminal-audit
devrules terminal-audit --repo <repo>
devrules memory compact --repo <repo> --apply
devrules evolution collect --root <parent> --apply
```

For large parent directories, run readiness before apply-ready. Repositories classified as needs-review require manual inspection or project-local config changes before mutation.

Last updated: 2026-07-15
