# Security audit

## Threat model

The protected data includes message bodies, headers, attachment objects, mailbox ownership, authentication tokens, forwarding destinations, and Cloudflare credentials. Expected adversaries include unauthenticated Internet callers, malicious email senders, compromised ordinary users, and accidental operator disclosure.

Cloudflare necessarily processes inbound mail and stores the configured D1/R2/KV data. Therefore no honest implementation can promise absolute privacy against Cloudflare, account compromise, endpoint compromise, or legal process. The controls below minimize exposure and make the remaining trust boundary explicit.

## Remediated before deployment

- Incoming HTML is rendered only in a scriptless sandboxed iframe with a restrictive CSP.
- Attachment reads require authentication and verified ownership.
- The legacy public batch API is not mounted; its SQL is parameterized as defense in depth.
- Public registration is closed by default.
- The admin address cannot be claimed without the one-time Bootstrap Secret.
- Database initialization and admin registration are independently locked in KV and bootstrap is disabled after setup.
- Soft-deleted mailboxes/users reject incoming mail.
- CORS is restricted to `https://cloudmail.echoec.com` and API/static responses receive security headers.
- Sensitive integration credentials are read only from Worker Secrets and scrubbed from D1/KV/API output.
- Remote background URLs and active image formats such as SVG are rejected.
- Configurable notices render as text rather than trusted HTML.
- Login and sensitive mutation endpoints are rate-limited.
- Unexpected server errors return a generic response and log only a request identifier/error class.
- Per-mailbox forwarding rejects loops to `echoec.com` and normalizes external destinations.

## Residual risks and operational controls

- KV-based fixed-window rate limiting is eventually consistent and is not a substitute for Cloudflare WAF/Rate Limiting. Add an edge rule for `/api/login`, `/api/register`, and `/api/bootstrap` where the account plan permits.
- Email delivery and forwarding metadata remain visible to Cloudflare Email Routing. End-to-end content encryption is not provided.
- A compromised Cloudflare account can read or alter Worker resources. Require phishing-resistant MFA, least-privilege members, and account audit logs.
- A compromised browser session can read mail available to that user. Use a dedicated browser profile, full-disk encryption, device patching, and short operational sessions.
- D1 and R2 must be backed up together. Recovery remains unproven until a restore drill succeeds.
- Forwarding destinations must be verified in Cloudflare before delivery succeeds; the application cannot safely bypass that control.

## Release gate

Do not call the service production-ready until every item in `docs/ACCEPTANCE.md` has dated evidence. Re-run the security regression tests after every upstream merge.
