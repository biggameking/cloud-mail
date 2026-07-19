---
description: Prevent repeated macOS Keychain, signing, password, sudo, and security prompt loops during Agent work.
ownership: shared
governs: device
activation: conditional
enforcement: advisory
decision_owner: project
side_effects: local
---

# macOS Credential Prompt Diagnostics

Use this workflow when a task may trigger, or the user reports, macOS Keychain,
signing private-key, password, Allow/Deny, Always Allow, sudo, or
privacy/security permission dialogs.

## Goal

Keep unattended Agent work from getting stuck behind invisible macOS GUI
authorization prompts, and keep the user from being asked for the same password
over and over.

## Prompt-Prone Surfaces

| Surface | Examples | Preferred Path |
| --- | --- | --- |
| Keychain reads | `security find-generic-password`, browser cookie decryption, token lookup | Avoid secret reads unless required; use scoped env/API credentials already provided for the task. |
| Signing keys | `codesign`, `xcodebuild archive`, `xcodebuild -exportArchive`, certificate private-key access | Dedicated signing keychain, unlocked once, with explicit key partition list when appropriate. |
| Apple uploads | App Store Connect upload, notarization, `altool`, `notarytool`, Transporter | App Store Connect API key or documented CI credential path. |
| Keychain imports | `security import`, certificate/profile setup | Import once into a dedicated keychain and verify non-interactively. |
| System elevation | `sudo`, privacy/security permission prompts | Avoid if possible; otherwise request one deliberate authorization window and bound the command. |

## Execution Rules

1. Preflight before running the prompt-prone command:
   - name the credential or permission surface;
   - explain why it is needed;
   - identify whether a non-interactive path exists.
2. Batch related work. Do not trigger one prompt per command when the operations
   can be prepared and run together.
3. Use bounded timeouts for commands that can block behind a GUI prompt.
4. Stop after the first prompt, auth failure, or timeout. Do not retry in loops,
   launch parallel attempts, or keep asking for passwords.
5. If user action is required, ask for one deliberate authorization window and
   state the exact operation to authorize. Mention `Always Allow` only when
   persistent access is genuinely intended and the tool/keychain item is clear.
6. Do not rely on screenshots for macOS security dialogs; they may be hidden
   from capture. Diagnose from command scope, logs, and process state.
7. Never print secrets, decrypted cookies, tokens, private keys, or Keychain
   values. Clean temporary credential files created for the task.

## Safe Patterns

### Apple signing and TestFlight

- Prefer App Store Connect API keys for upload automation.
- Prefer a dedicated signing keychain for certificates used by Agent builds.
- Pass the keychain explicitly to signing/export commands when supported.
- Verify signing access once before starting a long archive/export/upload chain.
- If the login keychain prompts for private-key access, stop and move to a
  dedicated keychain or one deliberate user authorization window.

### Browser automation

- Do not decrypt browser cookies just to reuse a web session unless the user
  explicitly asked for that path and no safer connector/API path exists.
- Prefer active browser automation in the already-open user session when
  available.

### `sudo`

- Avoid `sudo` for project work unless the task truly requires system-level
  changes.
- If required, explain the system path affected and run a bounded command.
- Do not repeatedly invoke `sudo` after a failed password or expired timestamp.

## Verification

- The command either completes without repeated prompts or stops after one
  bounded failure.
- The final report names the blocked operation and the safer next path.
- No secrets or credential values were printed or written to devrules memory.
- Temporary credential files were removed or explicitly left in a documented,
  intended location.

## Memory Updates

If a project needs a stable credential setup, record only non-secret facts in
`devrules/memory/project-profile.md`: keychain name, certificate identity label,
API key identifier, provisioning profile names, and verification commands.

If the issue is a reusable cross-project failure mode, add an evolution
suggestion rather than storing credentials or private transcripts.

Last updated: 2026-07-02
