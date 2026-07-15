# Production acceptance record

Evidence captured on 2026-07-15 (Asia/Shanghai). A checked item has repeatable local output or live Cloudflare evidence. Secrets and message bodies are intentionally omitted.

## Local release gates

- [x] `pnpm exec vitest run` passes in `mail-worker`: 2 files, 11/11 tests, Vitest 4.1.10. The suite includes receive/forward routing coverage for disabled forwarding, enabled forwarding exactly once, and soft-deleted mailbox rejection.
- [x] `pnpm run build` passes in `mail-vue`: Vite 8.1.4, 2,465 modules.
- [x] Wrangler 4.110.0 production dry-run succeeds with KV, D1, R2, assets, custom domain variables, registration off, bootstrap off, and no Workers AI binding.
- [x] `git diff --check` succeeds.
- [x] Secret-value comparison reports zero matches in tracked files; `.env.local` and `backups/` are ignored.
- [x] SHA-256-verified OSV Scanner 2.4.0 reports `No issues found` for both pnpm lockfiles.

## Cloudflare infrastructure

- [x] Worker `cloudmail-echoec` is live at `https://cloudmail.echoec.com`; current version `b59c01fb-a444-4353-bcd7-7cead6fb1269`.
- [x] Production D1, KV, R2, and assets bindings resolve; no Workers AI binding is present.
- [x] Public registration is false; bootstrap is disabled; both one-time KV locks are present.
- [x] `GET /api/login-attacker` returns 401 and `POST /api/bootstrap` returns 404 after setup.
- [x] Allowed-origin API response returns `Access-Control-Allow-Origin: https://cloudmail.echoec.com`; an untrusted Origin receives no allow-origin header.
- [x] API/static responses include restrictive security headers; the document includes HSTS and CSP.

## Mail and administration flows

- [x] `admin@echoec.com` authenticates using the locally generated operator password.
- [x] Admin created `privacytest@echoec.com`; the mailbox and forwarding settings read back through the authenticated API.
- [x] Gmail-origin test `CLOUDMAIL-E2E-20260714143117` was received and stored as application email ID 1.
- [x] Independent test `CLOUDMAIL-FWD-20260715-2`, sent by `gua1234@agent.qq.com`, was received and stored as application email ID 2.
- [x] The independent test was forwarded to verified destination `xiealan555@gmail.com`; Gmail received it and classified it as Spam.
- [x] HTML rendering regression verifies an opaque scriptless sandbox and restrictive iframe CSP; executable `<script>` content is removed.
- [x] A live attempt to forward to `loop@echoec.com` returned HTTP 400 and left the verified forwarding configuration unchanged.
- [x] Independent multipart test `CLOUDMAIL-HTMLATT-20260715-2` was received as email ID 4 with one 161-byte attachment. Production Webmail stripped `<script>`, `onerror`, `<form>`, and `javascript:` content; its iframe had an empty-permission sandbox, `no-referrer`, and an embedded CSP. The R2 object downloaded successfully and its SHA-256 exactly matched the source fixture (`73ea4271e29cc95179b83dba191690b90022195faef44e366d6f55ac14fcfc3f`).
- [x] With forwarding disabled, independent test `CLOUDMAIL-NOFWD-20260715-2` was received as email ID 3 and displayed in Webmail; forwarding was then restored to `xiealan555@gmail.com`. A Gmail `in:anywhere` search in the authenticated target account returned only `CLOUDMAIL-HTMLATT-20260715-2`, confirming the no-forward subject was absent from Inbox, Spam, Trash, and all other mail.
- [x] Disposable account `deletiontest-20260715@echoec.com` was soft-deleted before independent test `CLOUDMAIL-DELETED-20260715-2`; no email row was created for the subject, and the routing regression test confirms a deleted account returns rejection before storage or forwarding.
- [x] The same target Gmail `in:anywhere` search found no `CLOUDMAIL-DELETED-20260715-2` message, while `CLOUDMAIL-HTMLATT-20260715-2` appeared once with `acceptance-attachment.txt`, completing the forwarding-side acceptance evidence.

## Recovery and audit

- [x] Production D1 export is encrypted with Windows DPAPI (CurrentUser) at `backups/cloudmail-echoec-20260715.sql.dpapi`; the plaintext export was deleted.
- [x] The encrypted D1 export was decrypted into a temporary file, imported into temporary APAC D1 `3ebb5398-861a-4828-b4df-f045bae51154`, queried successfully (2 active users, 3 active accounts, 2 emails), and the plaintext and temporary database were deleted.
- [x] R2 bucket `cloudmail-echoec-attachments` contained 0 objects / 0 B at the recovery point, so the matching attachment backup set is empty.
- [x] Resource and routing identifiers are recorded below without credentials or message content.

## Production identifiers

- Account: `a0ad4d75c38c21f63cbd49bb8cdd4a22`
- Zone: `024f25a5028d71efe86aa6e784e64cd6`
- D1: `21749445-43a8-413c-88cd-ae6d76ec36dc`
- KV: `55b3b01537f64c70bcab450ab7ce502a`
- R2: `cloudmail-echoec-attachments`
- Catch-all Email Routing rule: `efc166a7587f411497bfe434b0f255e5` (`all` -> Worker `cloudmail-echoec`)
- Preserved exact forwarding rule: `cb6e3dc3b07d4a73abdb42572a849a05`
- Verified destination record: `07fdad5c83324b9a9da0c4fe114cef83`
