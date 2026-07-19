---
description: Workflow for activating a synced devrules workspace on another device without losing registry or project state.
ownership: shared
governs: device
activation: conditional
enforcement: advisory
decision_owner: project
side_effects: local
---

# Multi-Device Registry Handoff

Use this workflow when the shared `devrules/` template or a product repository is handed to another device through Git, or when an Agent on a different machine needs to prove the exact remote commit before editing.

## Purpose

GitHub (or the configured Git remote) carries committed template and product history. A new device uses a separate clone, verifies the handed-off commit, registers its concrete workspace path, and reviews template plans without touching dirty, stale, divergent, or conflicted repositories.

## Safety Rules

- Treat the runtime locator's `templateRoot` as the shared template, not as a
  product repository. It may live outside every product workspace.
- Treat `<workspace>` as a workspace parent, not as a project instance, unless
  it is explicitly its own repository. Do not create a parent-level `AGENTS.md`
  merely because the runtime locator selects it.
- Do not store tokens, API keys, account credentials, browser data, cookies, or raw private transcripts in `devrules/registry`.
- Run dry-runs before applying changes.
- Never synchronize an active `.git` directory with Nutstore, iCloud Drive, Dropbox, or another file-sync product.
- Run `repo preflight --fetch` before editing after a device handoff.
- Finish work with a clean, pushed branch and `repo handoff --fetch`; do not use stash as cross-device state.
- Do not use `git reset`, automatic merge/rebase, `push --force`, or branch deletion as a synchronization shortcut.
- Do not initialize or sync `needsReview` repositories unless the user asks for a separate review.
- Do not overwrite project-local `devrules/memory/`, `devrules/manifest.json`, or `devrules/config.json`.
- If the automatic device ID is not stable, set `DEVRULES_DEVICE_ID` before running refresh.
- Keep one stable, unique device ID per physical device. Never reuse an ID on a different device because that would make both clones own the same device shard.
- Keep `workspaceId` and `workspacePath` in registry output. The same device may have multiple synced workspace folders, and project records must not collapse across those paths.
- Treat `registry/device-records/` and `registry/workspace-records/` as the only versioned registry authority. `registry inspect` builds aggregate views in memory; do not reintroduce shared generated aggregate JSON files.
- A device refresh may modify only its own device shard and current workspace shard. If another registry path changes, stop and review before committing.
- Any malformed or identity-mismatched authority record blocks registry apply before the first write. Recover it from reviewed Git history; do not regenerate over unknown bytes.

## Activation Steps

1. Confirm the workspace root.
   - The root is a parent directory that contains product Git repositories; it
     does not need a `devrules` clone or symlink.
   - The root path is part of registry identity. Do not substitute another local path unless you are intentionally registering another workspace.
2. Read `devrules/scripts/runtime-location.md` and
   `devrules/registry/README.md`. Configure one device-local locator and audit it
   before using registered workspace commands.
   On Windows/macOS, the first Agent session after pulling inspects the
   idle-resource scheduler without changing it:

```bash
node <template-root>/scripts/idle-resource-maintenance.mjs agent-status --json
```

   Missing, disabled, or stale scheduling is a finding, not permission to write
   device state. If the user or project explicitly selects global hooks or
   scheduled maintenance, review the dry-run and perform that separate
   maintenance operation:

```bash
node <template-root>/scripts/global-devrules.mjs install --json
node <template-root>/scripts/idle-resource-maintenance.mjs install-agent --json
# after explicit review/authorization:
node <template-root>/scripts/global-devrules.mjs install --apply --json
node <template-root>/scripts/idle-resource-maintenance.mjs ensure-agent --apply --json
```

   The device owner may explicitly opt into SessionStart scheduler repair by
   setting `DEVRULES_IDLE_SCHEDULER_AUTO_REPAIR=1` for that environment.
   Without that exact opt-in, SessionStart remains status-only. If inspection
   or an explicitly requested install fails, report it and use task-local
   maintenance only when relevant.
3. Identify this device.
   - Default order: `DEVRULES_DEVICE_ID`, `COMPUTERNAME`, hostname.
   - Keep IDs short and stable, for example `jax`, `laptop`, or `office-pc`.
4. Verify the template authority and Git state before inspecting the registry.

```bash
devrules location audit
devrules template status
devrules repo preflight --repo <template-root> --fetch --expect-sha <handoff-sha>
devrules workspace git-status --root <workspace>
devrules registry inspect --root <workspace> --json
devrules registry refresh --root <workspace>
devrules workspace sync-template --registered
devrules evolution collect --root <workspace>
devrules batch readiness --root <workspace>
```

5. Review the complete dry-run. Any template conflict or version/authority error blocks all writes for that repository. If a command reports `needsReview`, dirty/ahead/behind/diverged state, or a template conflict, do not force it inside this workflow.

   For registry refresh, confirm that the write plan contains exactly the current device record and current workspace record. Other devices' records and shared aggregate files must not be write targets.

6. Apply only after the user has reviewed the affected repositories. Use a clean template-upgrade branch and keep the upgrade in a separate commit/PR:

```bash
devrules registry refresh --root <workspace> --apply
devrules workspace sync-template --registered --apply
devrules evolution collect --root <workspace> --apply
```

7. Report:
   - current device ID;
   - current workspace ID and path;
   - project counts by status;
   - skills count;
   - skipped `needsReview` repositories;
   - any command failures or unresolved risks.

## Activation Prompt

Use this prompt when handing the synced workspace to an Agent on another device:

```text
You are on a Git-handed-off devrules workspace. Read devrules/registry/README.md and multi-device-registry-handoff.md first. Treat GitHub/the configured remote as authority and never file-sync an active .git directory. Run template status and repo preflight --fetch --expect-sha <handoff-sha>, then workspace git-status, registry inspect, registry refresh dry-run, workspace sync-template dry-run, evolution collect dry-run, and batch readiness. Do not apply automatically. Any dirty/ahead/behind/diverged state, source-version error, or template conflict blocks the affected repository until reviewed. After approved work is committed and pushed, run repo handoff --fetch and pass its exact SHA to the next device.
```

## When Not To Use

Do not use this workflow for ordinary product work inside a child repository. For child repository work, read that repository's official entry file and its `devrules/always-readme.md` first.
