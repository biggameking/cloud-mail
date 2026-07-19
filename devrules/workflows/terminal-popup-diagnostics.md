---
description: Diagnose and prevent Windows terminal popup flicker from child processes, dev servers, and desktop sidecars.
ownership: shared
governs: device
activation: conditional
enforcement: advisory
decision_owner: project
side_effects: local
---

# Terminal Popup Diagnostics

Use this workflow when the user reports flashing terminal windows, console popup flicker, or repeated transient `cmd.exe`/PowerShell windows during development.

## Goal

Identify whether popup flicker comes from the Agent/tooling layer, an active dev server, or project code that spawns visible Windows console processes. Prefer a reusable fix over one-off suppression.

## Common Root Causes

| Surface | Risk Pattern | Preferred Fix |
| --- | --- | --- |
| Node scripts | `child_process.spawn/exec/execFile` without `windowsHide: true`. | Add a shared child-process helper and set `windowsHide: true` for non-interactive commands. |
| Node scripts | `shell: true`, `detached: true`, `cmd.exe`, `powershell.exe`, `npx`, `npm`, or `vite` from a GUI/tool process. | Avoid shell mode where possible; otherwise set `windowsHide: true` and pipe or ignore stdio intentionally. |
| Rust/Tauri | `std::process::Command` or `tokio::process::Command` on Windows without `CREATE_NO_WINDOW`. | Centralize a Windows-hidden command helper using `std::os::windows::process::CommandExt`. |
| Rust/Tauri | Explicit `CREATE_NEW_CONSOLE`. | Use only for intentionally user-visible terminals; otherwise replace with `CREATE_NO_WINDOW`. |
| PowerShell | `Start-Process` without `-WindowStyle Hidden`. | Add `-WindowStyle Hidden` for non-interactive background processes. |
| Dev servers | GUI/Agent starts `npm run dev`, `vite`, or `tauri dev` through `cmd.exe /c`. | Prefer the Agent's integrated terminal/session APIs or hidden wrappers for background servers. |

## Steps

1. Capture current process evidence:

   ```powershell
   Get-CimInstance Win32_Process |
     Where-Object { $_.Name -match '^(cmd|powershell|pwsh|node|npm|pnpm|yarn|bun|cargo|conhost)\.exe$' } |
     Select-Object ProcessId,ParentProcessId,Name,CommandLine
   ```

2. Run the devrules audit:

   ```bash
   devrules workspace terminal-audit
   ```

   For a single repository:

   ```bash
   devrules terminal-audit --repo <repo>
   ```

3. Prioritize `high` findings in active desktop, dev-server, sidecar, or Agent-runner repositories.
4. Ignore findings in docs, generated output, historical temp directories, and intentionally user-visible install flows unless they match the reported timing.
5. Fix by adding a shared launcher/helper rather than repeating one-off flags.
6. Rerun `terminal-audit` and the affected dev command.

## Fix Patterns

### Node

```js
import { spawn } from 'node:child_process';

const child = spawn(command, args, {
  cwd,
  stdio: ['ignore', 'pipe', 'pipe'],
  windowsHide: true,
});
```

### Rust

```rust
use std::process::Command;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

fn hidden_command(program: &str) -> Command {
    let mut command = Command::new(program);
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(CREATE_NO_WINDOW);
    }
    command
}
```

### PowerShell

```powershell
Start-Process -FilePath $exe -ArgumentList $args -WindowStyle Hidden -Wait
```

## Verification

- `devrules terminal-audit --repo <repo>` shows reduced high findings for the
  changed path.
- The affected dev workflow no longer creates visible `cmd.exe`, PowerShell, or console windows.
- The process still exits, logs, and reports errors correctly; do not hide failures by discarding stderr without another report path.

## Memory Updates

If a project-specific popup root cause is fixed, add a short lesson to `devrules/memory/lessons.md`. If the same root cause appears in several repositories, add an evolution suggestion for the shared template.

Last updated: 2026-06-29
