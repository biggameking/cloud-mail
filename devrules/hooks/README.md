---
description: Structured routing registry contract for shared, seed, and project-local hooks.
ownership: shared
governs: agent
activation: conditional
enforcement: advisory
decision_owner: project
side_effects: local
---

# devrules Hooks

This directory separates template-owned and project-owned Agent hook definitions.

Hooks are agent-mediated routing triggers. They do not install Git hooks, IDE extensions, daemons, or background services by default.

Use `hooks.json` for hooks whose `ownership` is `shared` or `seed`. Put
repository-owned hooks (`ownership: local`) in `hooks.local.json`; template sync
never creates, rewrites, or deletes that overlay. Agents read both files. A
local hook with the same ID fully replaces the shared definition, so fields
from two definitions are never mixed and the routing card contains that ID only
once.

Ownership answers where a hook is maintained; it does not make the hook active.
Activation and authority are separate:

- `activation: always` is reserved for side-effect-free Agent core behavior.
- `activation: conditional` requires a machine-proven condition.
- `activation: explicit` requires a project or user opt-in.
- `decision_owner` identifies who selects a product, device, release, or
  external-service policy. devrules may enforce safety gates, but does not take
  ownership of those product decisions.

## Matcher Fields

Each hook may declare machine-checkable matcher fields next to its prose `when` description:

- `promptPatterns`: JavaScript regexes (case-insensitive) matched against the user prompt text.
- `pathPatterns`: glob-like patterns matched against edited or referenced file paths.
- `commandPatterns`: JavaScript regexes matched against shell commands.

The prose `when` explains the trigger for people. It does not prove a
conditional route by itself. Matcher fields let runtime trigger layers (Codex
`SessionStart`/`UserPromptSubmit` hooks, Cursor hooks, scripts) surface a hook
without reading every orchestration document. A hook with no matcher fields is
judgment-only and is surfaced through the generated routing card instead.

## Structured Route Entries

In schema v3, every item in `read` and `workflows` is an object:

```json
{
  "target": "revenuecat-integration.md",
  "activation": "always",
  "primary": true
}
```

- `target` is the exact document or workflow target.
- `activation` is `always`, `conditional`, or `explicit`. Here, `always` means
  whenever this hook has matched; it does not make the hook globally active.
- `condition` is required for `conditional` entries and must use structured
  facts or predicates. `route.*.*` facts are declarative semantic identifiers;
  no current runtime layer populates or infers their values. A prose `note`
  explains when an Agent should evaluate the route but cannot make a condition
  true.
- Every hook has exactly one `primary: true` target, and that target uses
  `activation: always`. It is the hook's sole primary route.
- Runtime hooks auto-inject only that primary target, subject to each runtime
  event's hook-count budget. They do not auto-inject conditional or explicit
  targets.
- Conditional targets form a secondary Agent-mediated catalog. After reading
  the primary, the Agent evaluates relevant entries using their structured
  conditions and `note` text as semantic guidance; this is not runtime fact
  inference.
- Explicit targets require explicit user or project authority. They are never
  auto-selected, even when their structured identifier or prose appears
  relevant.

Template `hooks.json` uses v3 objects. Legacy strings remain readable only in a
project-local override; a legacy string with trailing natural-language
conditions is treated conservatively and cannot become the automatic primary.

## Routing Card

`scripts/routing-card.mjs` compresses `hooks.json` (plus `hooks.local.json` when
present) into a managed block inside `.cursor/rules/devrules.mdc`. The card
contains only hook IDs and primary targets; matcher descriptions and full
read/run lists remain audit context. Successful template sync refreshes
configured entries and this card; use `devrules repo refresh-entries` when no
sync is needed.

```bash
node devrules/scripts/routing-card.mjs --repo <repo> --apply
```

Common events:

- `session_start`: read entry context and project profile.
- `before_edit`: route to workflows and nearest README anchors.
- `after_code_change`: run the touched-file code-health ratchet and repository-native checks.
- `user_facing_product_input`: conditionally review product architecture before
  the affected design or technical boundary; the project owns product choices.
- `ios_account_data_model_decision`: route an applicable iOS/iPadOS account and
  data decision without selecting an identity, storage, sync, or regional
  strategy for the project.
- `file_change`: update documentation, memory, or checks when relevant.
- `on_failure`: switch to root-cause debugging.
- `game_development_work`: route game planning and Godot work through the
  reusable starter workflows and templates when the repository adopts them.
- `release_request`: run release readiness.
- `payment_or_subscription_work`: run RevenueCat/subscription/store-credential workflow.
- `after_decision_or_repeated_lesson`: update memory.
- `after_task_feedback`: capture durable project feedback or template evolution suggestions.
- `devrules_workspace_initialization`: initialize or upgrade sibling Git repositories from a shared template.
- `script_automation`: add, change, or run scripts under `devrules/scripts/`.
- `git_pre_edit_publish_or_device_handoff`: require fetch-backed clean/equal
  GitHub state before the first local write, then govern publication and device
  handoff without destructive cleanup.
- `codex_browser_automation_request_or_failure`: audit or repair the Codex.app
  node_repl ambient-network/system-proxy boundary, then recover dead browser
  routes only when they remain after the parent process reload.
- `ui_design_work`: route UI/design tasks to the design-system workflows and gates.

`codex-global-code-health-hook.mjs` is the portable source asset used by
`scripts/global-devrules.mjs`. The installer copies it into the user's Codex
home and registers `SessionStart` and `UserPromptSubmit` without replacing
unrelated hook configuration. It routes coding context and any explicit
registry prompt route, including non-coding browser-automation requests; it does
not edit a repository or replace repository-local `AGENTS.md` discovery.

Both Codex and Cursor SessionStart hooks import
`device-maintenance-bootstrap-core.mjs`. On Windows/macOS the default is the
read-only `agent-status --json` check. SessionStart does not install, repair, or
rewrite a scheduler unless device-local configuration or the documented
environment flag explicitly opts into auto-repair. A user may also run
`ensure-agent --apply --json` as an explicit maintenance action. Unsupported or
failed status checks emit project fallback guidance instead of killing
processes or blocking session startup.

Released-template updates use a separate device scheduler documented in
`workflows/template-auto-update.md`. SessionStart neither installs nor invokes
that updater. Its status is observed with `devrules template auto-update
status` and `agent-status`; installation requires an independent explicit
`template auto-update ensure-agent --apply` opt-in.

`cursor-global-routing-hook.mjs` is the portable source asset for the Cursor
runtime trigger layer. Install or refresh it with the shared installer:

```bash
node devrules/scripts/global-devrules.mjs install --surface cursor --apply
node devrules/scripts/global-devrules.mjs audit --surface all
```

The installer copies the hook, its side-effect-free routing core, and the
device-maintenance bootstrap core to `~/.cursor/hooks/` and
registers it in `~/.cursor/hooks.json` for `sessionStart`, `postToolUse`
(matcher `Write|StrReplace|EditNotebook|Shell`), `beforeSubmitPrompt`, and
`stop` without replacing unrelated Cursor hooks. It injects a devrules
orientation context at session start, surfaces matching hooks (via
`pathPatterns`/`commandPatterns`) as `additional_context` after edits and shell
commands with per-conversation dedupe, and resolves the product repository from
edited file paths so multi-repo parent workspaces still trigger correctly.
SessionStart, `beforeSubmitPrompt`, and `stop` do not write logs or state.
`postToolUse` writes only best-effort per-conversation dedupe state after it
injects a concrete route; no state is written when no route is injected.

The hook resolves the device runtime profile from `DEVRULES_RUNTIME_CONFIG`
when set, `%LOCALAPPDATA%/devrules/runtime.json` on Windows, and
`$XDG_CONFIG_HOME/devrules/runtime.json` or `~/.config/devrules/runtime.json`
elsewhere.

## Design System Git Hooks (declared exception)

The UI design subsystem (entry: `devrules/design-readme.md`) additionally ships real Git-level gates. They are opt-in and never installed automatically:

- `design-pre-commit.mjs`: commit gate — design-lint (when DESIGN.md is staged) + design-sync `--check` + design-guard `--staged`.
- `design-githooks/pre-commit`: the shim Git invokes via `core.hooksPath`.
- `design-install-hooks.mjs`: opt-in installer (`node devrules/hooks/design-install-hooks.mjs`); detects husky and does not overwrite an existing hooks path.
- `ci/design-check.yml`: inactive reference template only. The repository's
  `githubActionsPolicy` controls adoption: `inherit` preserves existing
  repository policy without creating or deleting workflows, `allow` permits an
  explicitly approved hosted workflow, and `deny` rejects new hosted workflow
  adoption. devrules does not preselect which product checks should run.

Agent-mediated routing for design tasks stays in `hooks.json` (`ui-design-standards`); the Git hooks are only installed when a repository adopts the design system via its workflows.
