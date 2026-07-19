---
description: Diagnose, fix, and recover Codex.app Chrome browser networking and dead session routes.
ownership: shared
governs: agent
activation: conditional
enforcement: advisory
decision_owner: project
side_effects: local
---

# Codex Browser Automation Fix Workflow

Use this workflow for **Codex.app** browser-use failures. It covers the Chrome
extension bridge, the per-task browser route, and the generated
node_repl/browser-client launch boundary. Use `browser-automation-fix.md` for
ordinary Playwright, WebDriver, dev-server, or rendered-frontend failures
outside Codex.app.

## Fix The Actual Launch Boundary First

Chrome honors the macOS system proxy, but Node/Rust clients do not automatically
consume SystemConfiguration proxy settings. Codex Desktop also owns and
regenerates `[mcp_servers.node_repl]` for each browser task. Editing that
generated TOML table is not a durable fix: the desktop process removes unknown
keys when the next helper starts.

The supported desktop launch path reads
`BROWSER_USE_DISABLE_AMBIENT_NETWORK` and `CODEX_NODE_REPL_PATH` from the
desktop parent's process environment. Repair that boundary with:

```bash
node devrules/scripts/codex-browser-network.mjs status --json
node devrules/scripts/codex-browser-network.mjs ensure --apply --json
```

The repair installs three device-local managed assets:

- a `CODEX_NODE_REPL_PATH` wrapper under `~/.codex/hooks/`;
- a small launch-environment setter under `~/.codex/hooks/`;
- `~/Library/LaunchAgents/com.devrules.codex-browser-network.plist`.

Only two user-launch-domain variables are set:
`BROWSER_USE_DISABLE_AMBIENT_NETWORK=1` and the wrapper path. Generic
`HTTP_PROXY`, `HTTPS_PROXY`, and `NO_PROXY` are **not** placed in the
user's global launch environment. At each helper start, the wrapper reads
`scutil --proxy`, accepts only an unauthenticated loopback HTTP(S) endpoint,
sets Node/proxy variables for that helper process alone, and execs the bundled
node_repl binary. This keeps Clash routing scoped to browser control and follows
port changes without patching the app or plugin.

The ambient-network flag stops optional Statsig, Sentry, and identity requests
at their source. Page control remains on local Unix/native IPC. The command also
removes the obsolete devrules block from generated `config.toml`, preserves
unrelated keys, defaults to dry-run, and is idempotent.

After an applied launch-environment change, fully quit and restart
ChatGPT/Codex Desktop. Killing only a child helper cannot update the desktop
parent's process environment. A 120-second outer timeout is allowed for one
pre-fix diagnostic probe only; it is not the repair or steady-state contract.

## Failure Signatures

| Signal | Classification |
| --- | --- |
| Direct endpoint access times out while the same request through the Clash loopback proxy responds promptly | System proxy works; the helper is missing proxy adaptation. |
| A custom node_repl env block disappears or leaves one marker when a helper starts | Expected consequence of Desktop regenerating its owned MCP configuration; stop editing that table. |
| Desktop log reports `nodeReplPathSource=env-override` after restart | The scoped wrapper launch path is active. |
| New helper contains ambient/proxy variables while the desktop parent contains only ambient/wrapper variables | Correct scoping. |
| Page evaluate succeeds in about 30 seconds with Statsig timeouts | Old ambient-network backpressure is still active. |
| `No Codex browser route`, `No ChatGPT browser route`, or `tabID=undefined` | Route failure, often a consequence of an earlier forced timeout. |
| Extension/native-host selection fails before a browser can be selected | Static Chrome bridge problem; use packaged Chrome troubleshooting. |

The UI phrase “extension not available” is not root-cause evidence by itself.

## Architecture

```text
macOS System Proxy (Clash loopback)
             │ read at each helper launch
             ▼
scoped node_repl wrapper ── exec bundled node_repl
             │                     │
             │ proxy env           │ local page control
             ▼                     ▼
 optional helper HTTP     /tmp/codex-browser-use/<uuid>.sock
                                   ▲
                         Chrome extension/native host

LaunchAgent ── sets only ambient-disable + wrapper-path for Desktop startup
```

`proxyPort: 0` in `~/.codex/chrome-native-hosts-v2.json` remains normal for
the Unix-socket page-control path.

## One Bounded Root-Cause Probe

1. Run the status command. Treat `drift` and `restart-required` as distinct:
   drift means managed assets/launch variables need repair; restart-required
   means the current desktop parent has not loaded them.
2. Inspect `scutil --proxy`; record only enablement, host, and port.
3. When needed, compare one bounded direct request with the same request through
   the loopback proxy. A prompt proxied HTTP response proves reachability even
   when its status is 4xx.
4. Run `ensure --apply`, then fully restart Desktop once if reported.
5. Initialize Chrome once, reuse one binding/tab, and run a small read-only
   evaluate. Record elapsed time and whether Statsig timeout messages remain.

Do not repeat deep page probes with the default timeout. Forced termination
creates route churn and obscures the first cause.

## Recovery After A Forced Timeout

1. Repair the launch boundary before changing route state.
2. Fully restart Desktop if the status requires it.
3. Reuse a healthy browser binding and obtain a fresh tab only if the previous
   tab is stale.
4. If exact route errors persist, inspect socket age and holders:

   ```bash
   find /tmp/codex-browser-use -maxdepth 1 -type s -mmin +10 -print
   lsof -U <exact-socket-path>
   ```

5. Quarantine only sufficiently old sockets with zero holders. Move exact paths
   into a recoverable temporary directory; never glob or touch held/fresh
   sockets:

   ```bash
   quarantine_dir=$(mktemp -d /tmp/codex-browser-use-quarantine.XXXXXX)
   mv <exact-verified-unheld-socket> "$quarantine_dir/"
   ```

6. Reconnect once and repeat the bounded probe. Do not loop through resets,
   extension reinstalls, or socket cleanup.

## Verification

After the required desktop restart:

1. Status returns `ready`.
2. Desktop/app-server contains
   `BROWSER_USE_DISABLE_AMBIENT_NETWORK=1` and
   `CODEX_NODE_REPL_PATH=<managed-wrapper>`, without global proxy variables
   installed by devrules.
3. The desktop log reports `nodeReplPathSource=env-override`.
4. A new helper contains `NODE_USE_ENV_PROXY`, `HTTP_PROXY`,
   `HTTPS_PROXY`, and `NO_PROXY` only when a static loopback system proxy is
   active. Inspect only named keys; never print the full environment.
5. A small page evaluate returns promptly without the previous fixed
   approximately 30-second delay or Statsig timeout sequence.
6. A follow-up locator/read succeeds in the same browser process.
7. No new route or `tabID=undefined` error appears.
8. Finalize tabs as the final browser action.

Success requires prompt returned page state plus continued same-session control.

## Root-Cause Evidence Rules

- Do not describe the helper as network-forbidden when direct-versus-proxy
  evidence proves a proxy adaptation gap.
- Do not persist browser-helper env in Desktop-owned
  `[mcp_servers.node_repl.env]`; it is generated and rewritten.
- Do not put generic proxy variables into the user's global launch environment.
  Use the scoped wrapper.
- Do not use `--disable-sandbox`, enable Clash TUN, patch signed/checksummed
  app or plugin assets, reinstall a healthy extension, edit Chrome secure
  state, or “fix” `proxyPort: 0`.
- Do not hardcode one user's Clash port in the shared workflow or wrapper. Read
  the current loopback endpoint from `scutil --proxy`.
- A longer outer timeout is diagnostic headroom, never prevention.

## Runtime Paths

| Path | Role |
| --- | --- |
| `~/.codex/hooks/devrules-node-repl-proxy-wrapper.zsh` | Per-helper dynamic proxy adapter. |
| `~/.codex/hooks/devrules-codex-browser-launch-env.zsh` | Sets the two Desktop launch variables. |
| `~/Library/LaunchAgents/com.devrules.codex-browser-network.plist` | Reapplies launch variables at login. |
| `~/.codex/config.toml` | Desktop-owned generated MCP config; inspect, do not use as the fix. |
| `~/Library/Logs/com.openai.codex/<YYYY/MM/DD>/codex-desktop-*.log` | Runtime-path and route evidence. |
| `/tmp/codex-browser-use/*.sock` | Per-task page-control sockets. |

## Memory Update

When evidence supersedes an earlier diagnosis, correct it explicitly. Store only
the reusable signature and verified fix; never store page names, credentials,
cookies, raw logs, or private paths.

Last updated: 2026-07-19
