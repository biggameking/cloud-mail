# echoec.com deployment runbook

## Architecture

This service is a Cloudflare Email Worker and webmail control plane, not an IMAP/SMTP server.

```text
Internet sender
  -> Cloudflare Email Routing for echoec.com
  -> cloudmail-echoec Email Worker
  -> D1 message metadata + R2 attachment objects
  -> https://cloudmail.echoec.com admin/webmail
  -> optional per-mailbox forwarding to a Cloudflare-verified destination
```

## Production resources

Create these resources in the Cloudflare account that owns `echoec.com`:

- Worker: `cloudmail-echoec`
- D1: `cloudmail-echoec-db`, binding `db`
- KV: `cloudmail-echoec-kv`, binding `kv`
- R2: `cloudmail-echoec-attachments`, binding `r2`
- Custom Domain: `cloudmail.echoec.com`
- Email Routing rule: catch-all `*@echoec.com` to Worker `cloudmail-echoec`
- Verified forwarding destination: `xiealan555@gmail.com`

Do not put secrets in `wrangler.toml`, D1, KV, screenshots, logs, or documentation. `jwt_secret` and `BOOTSTRAP_TOKEN` must be Wrangler secrets.

## Deployment order

1. Authenticate Wrangler with the correct Cloudflare account. If Wrangler OAuth fails before producing an authorization code, create a user API token with a short expiry and resource scope limited to the owning account and `echoec.com`. Store it only in ignored `mail-worker/.env.local`; never paste it into chat or command history.
2. Create D1, KV, and R2, then copy only their non-secret IDs/names into `mail-worker/wrangler.toml`.
3. Set `jwt_secret` and `BOOTSTRAP_TOKEN` with `wrangler secret put`.
4. Deploy with bootstrap enabled.
5. `POST /api/bootstrap` once with `X-Bootstrap-Token` to initialize D1.
6. Register `admin@echoec.com` once through `POST /api/register`, with the same bootstrap header and a user-chosen strong password.
7. Confirm both KV locks exist: `security:bootstrap:complete` and `security:admin-registration:complete`.
8. Set `ENABLE_BOOTSTRAP = "false"`, redeploy, and verify `/api/bootstrap` returns 404.
9. Enable Email Routing, verify the destination address from its confirmation email, and route catch-all mail to the Worker.
10. Execute the acceptance tests in `docs/ACCEPTANCE.md`.

After R2 is enabled and all three storage bindings exist, steps 3 through 7 can be
performed without printing secrets by running:

```powershell
rtk pwsh -NoProfile -File mail-worker/scripts/initialize-production.ps1 -ConfirmProduction
```

The script deliberately does not disable bootstrap or perform the final redeploy.
Review the initialization result first, then set `ENABLE_BOOTSTRAP = "false"` with
a source-controlled edit and deploy again.

Before using a token, validate the ignored local file without printing its contents:

```powershell
rtk pwsh -NoProfile -File mail-worker/scripts/validate-local-deploy-env.ps1
```

After production verification, revoke the short-lived deployment token in the Cloudflare dashboard and securely delete `.env.local`. The deployed Worker continues to run without the deployment API token.

## Backup and restore

Create an encrypted, access-controlled backup before upgrades and at least daily thereafter:

```powershell
rtk pnpm --dir mail-worker exec wrangler d1 export cloudmail-echoec-db --remote --output cloudmail-echoec-db.sql
```

R2 attachments require a separate object backup policy. A D1 export alone is not a complete mailbox backup. Test restoration in a separate D1/R2 environment; never test restores against production.

Use D1 Time Travel as an additional recovery layer, not as the only backup. Record the Worker version ID after every successful deploy so `wrangler rollback <VERSION_ID>` can be used for application rollback.

## Secret rotation

- Rotate `jwt_secret` after a suspected session compromise; this invalidates all existing JWTs.
- Rotate `BOOTSTRAP_TOKEN` after initialization, then keep bootstrap disabled.
- Do not enable Telegram, Resend, S3, OAuth, or Workers AI unless the feature is explicitly needed and separately reviewed.
- Cloudflare forwarding accepts only destinations verified in the account. Per-mailbox destinations in this application must match that verified set operationally.
