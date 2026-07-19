---
description: Canonical contract for locating the shared devrules template and workspace roots on one device.
ownership: shared
governs: agent
activation: conditional
enforcement: hard
decision_owner: devrules
side_effects: none
---

# devrules Runtime Location

This document is the canonical contract for locating the shared devrules
template on one device. Product repositories continue to use repository-relative
paths such as `devrules/always-readme.md`; only shared-template control-plane
commands use this device-local location profile.

## One Device-Local Setting

The durable locator is intentionally outside Git and outside the synced
template:

- macOS and Linux: `~/.config/devrules/runtime.json`
- Windows: `%LOCALAPPDATA%\devrules\runtime.json`

Example:

```json
{
  "schemaVersion": 1,
  "templateRoot": "/path/to/the/canonical/devrules",
  "workspaceRoots": [
    "/path/to/a/workspace-parent"
  ]
}
```

`templateRoot` identifies the one shared template clone whose scripts and
managed files are authoritative on this device. `workspaceRoots` identifies the
parent directories that contain product repositories. The template does not
need to be a child of a workspace root, and a workspace root does not need a
`devrules` symlink or clone.

Do not place device-specific absolute paths in the tracked template
`config.json`. Different devices may mount disks at different paths, and Git or
file synchronization must not make one device overwrite another device's
locator.

## Configure And Inspect

Before the stable launcher is installed, invoke the CLI from a known template
clone:

```bash
node scripts/devrules.mjs location configure \
  --template-root <canonical-devrules> \
  --workspace-root <workspace-parent>

node scripts/devrules.mjs location configure \
  --template-root <canonical-devrules> \
  --workspace-root <workspace-parent> \
  --apply

node scripts/devrules.mjs location show --json
node scripts/devrules.mjs location audit --json
node scripts/devrules.mjs location install-launcher
node scripts/devrules.mjs location install-launcher --apply
```

Writes are dry-run by default. `--apply` is required to write the profile or
launcher. Repeating the same command is idempotent.

After installation, use the stable command from any directory:

```bash
devrules location show
devrules location configure \
  --template-root <new-canonical-devrules> \
  --workspace-root <workspace-parent> \
  --apply
devrules template status
devrules workspace scan
devrules workspace sync-template --registered
```

On macOS/Linux the default command is `~/.local/bin/devrules`. On Windows the
installer writes `devrules.mjs` plus a `devrules.cmd` shim under
`%LOCALAPPDATA%\devrules\bin`; ensure that directory is on `PATH` before using
the short command name.

The launcher reads the same profile and executes
`<templateRoot>/scripts/devrules.mjs`. Its `location configure` bootstrap is
self-contained, so the command above can repair the profile even after the old
template path has moved or become unavailable. The next invocation uses the new
location.

## Resolution Precedence

The resolver uses this order:

1. Temporary environment override.
2. Device-local `runtime.json`.
3. Script-relative compatibility fallback when no explicit locator exists.

Supported temporary overrides are:

- `DEVRULES_RUNTIME_CONFIG`: use another locator file, primarily for tests or a
  deliberate temporary profile.
- `DEVRULES_TEMPLATE_ROOT`: override only the shared template root.
- `DEVRULES_WORKSPACE_ROOTS`: override workspace roots using the platform path
  delimiter (`:` on macOS/Linux, `;` on Windows).

The stable launcher also accepts `--config-path <file>` or
`--config-path=<file>` on every command. It uses that profile to locate the
canonical CLI and forwards the normalized profile path to the child process, so
`location show`, `location audit`, and ordinary control-plane commands all use
the same explicit selection.

Environment variables are escape hatches, not a second durable configuration
system. Normal device setup should have exactly one `runtime.json`.

An explicitly selected locator or override is fail-closed. If the file is
malformed or the template is missing or invalid, commands report the source and
stop instead of silently falling back to another clone. Workspace roots may be
temporarily offline; location audit reports that state, and workspace commands
must skip or fail visibly without creating the missing mount path, while
template-only commands remain available.

## Template And Project Boundary

There are two different path contracts:

| Path | Owner | Contract |
| --- | --- | --- |
| Shared template root | Device-local locator | One canonical clone supplies scripts and managed template bytes. |
| Product `devrules/` instance | Product repository | Repository-relative, versioned with the product, and owns project memory/config/hooks. |

Do not replace product instances with symlinks to the shared template. Template
propagation stays baseline-protected and copies only managed template files;
project identity and local learning remain in each repository.

The runtime profile also separates `templateRoot` from `workspaceRoots`. This
supports a canonical template on an internal synced disk while product
repositories remain on an external volume whose filesystem cannot host the
same synchronization or symlink arrangement.

## Git And File-Sync Safety

Git remains the authority for template history and cross-device handoff. A
file-sync product may synchronize ordinary template working files for rapid
availability, but it must not synchronize an active `.git` directory. Keep each
device's Git metadata local, verify `template status`, and use exact pushed SHAs
for handoff.

When switching `templateRoot`:

1. Fetch and inspect the candidate clone.
2. Confirm its expected remote, clean state, branch/upstream, and exact commit.
3. Change the one device-local profile.
4. Run `devrules location audit` and `devrules template status`.
5. Run registered workspace commands as dry-runs before any `--apply`.

If an external workspace is offline, template-only commands may continue, but
workspace commands must report the missing root and must not create a
replacement directory at that mount path.
