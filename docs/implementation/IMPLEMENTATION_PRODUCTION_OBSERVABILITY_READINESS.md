# Production Observability and Launch Readiness

## Summary

- Verifies the existing public health contract for database and private storage.
- Adds a credential-free, read-only readiness command for local or deployed APIs.
- Prevents raw dependency errors from appearing in the public health payload.
- Runs the public-surface security audit immediately after the frontend build in CI.

## Problem

- The degraded health response could include raw database or storage error messages.
- The existing production smoke is broader than an operational health probe.
- Frontend CI built the application without an explicit post-build public-surface gate.
- Launch information was spread across several operational documents.

## Scope

- Public `/health` and `/api/health` response safety.
- Read-only verification of `GET /health`.
- Environment-variable presence checklist using names only.
- Existing request ID, safe error, logging, CORS, cookie, proxy, CI, and incident contracts.
- Manual production checks that cannot be completed without controlled access.

## Explicitly out of scope

- SEO
- Metadata
- Sitemap
- Robots
- OpenGraph
- JSON-LD/schema
- Public copy changes

## Files changed

- `server/lib/http-runtime.ts`
- `scripts/ops/verify-production-readiness.mjs`
- `test/production-readiness.test.ts`
- `test/helpers/report-foreign-access-scope.ts`
- `.github/workflows/frontend-ci.yml`
- `test/unit/infrastructure/frontend-ci-workflow.test.ts`
- `IMPLEMENTATION_PRODUCTION_OBSERVABILITY_READINESS.md`

## Health checks

- `GET /health` and `GET /api/health` share the existing runtime health handler.
- Healthy status is HTTP `200` with `success`, `status`, `checks.database`,
  `checks.storage`, `uptimeSeconds`, `responseTimeMs`, and `timestamp`.
- Database and Storage checks are read-only.
- Degraded status remains HTTP `503`, with dependency state reported only as
  `up` or `down`.
- Raw dependency error messages, stack traces, paths, credentials, and
  connection details are not included.

Run the focused verifier with one of these forms:

```powershell
node scripts/ops/verify-production-readiness.mjs --url <backend-base-url>
node scripts/ops/verify-production-readiness.mjs <backend-base-url>
```

The optional `READINESS_BASE_URL` variable can supply the same base URL. The
script performs one `GET /health`, sends no credentials, writes nothing, does
not print the response body, and exits nonzero for configuration, network,
HTTP, JSON, shape, database, or storage failures.

## Observability

- API responses retain the existing safe `x-request-id` correlation contract.
- Internal API failures return a generic public error while server logs retain
  method, path, status, message, and request ID.
- Existing logging contracts redact public access tokens and prevent direct
  logging of cookies, passwords, SMTP credentials, and service credentials.
- The readiness verifier prints only a pass/fail summary and never dumps
  environment variables or health payloads.

## Required environment variables

Presence and deployment-policy checklist, names only:

- `ADMIN_COOKIE_NAME`
- `CONTACT_TO`
- `COOKIE_NAME`
- `CORS_ORIGIN`
- `DATABASE_MAX_CONNECTIONS`
- `DATABASE_URL`
- `GMAIL_API_CLIENT_ID`
- `GMAIL_API_CLIENT_SECRET`
- `GMAIL_API_FROM`
- `GMAIL_API_REFRESH_TOKEN`
- `LAB_UPLOAD_USERNAMES`
- `MAX_UPLOAD_FILE_SIZE_MB`
- `NODE_ENV`
- `OWNER_OPEN_ID`
- `PARTICULAR_COOKIE_NAME`
- `PORT`
- `SESSION_TTL_HOURS`
- `SMTP_FROM`
- `SMTP_HOST`
- `SMTP_PASS`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SUPABASE_ANON_KEY`
- `SUPABASE_DB_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_SIGNED_URL_EXPIRES_IN_SECONDS`
- `SUPABASE_STORAGE_BUCKET`
- `SUPABASE_URL`
- `TRUST_PROXY`

Database connectivity requires one of `SUPABASE_DB_URL` or `DATABASE_URL`.
Email readiness requires one complete transport configuration plus
`CONTACT_TO` when email is part of the launch.

## Secret leakage controls

- Public health fields are allowlisted by the readiness verifier.
- Unexpected top-level or dependency fields fail verification.
- Degraded dependency exceptions are converted to generic `down` states.
- Tests inject connection and credential-shaped sentinel strings and assert
  that neither the health payload nor command output contains them.
- The command rejects URLs containing embedded credentials.

## CORS / cookies / proxy

- Production CORS origins must exactly match approved frontend origins.
- Credentialed CORS must never use a wildcard origin.
- Clinic, admin, and particular sessions retain separate cookie names.
- Production cookies remain `HttpOnly`, `Secure`, and `SameSite=None`.
- `TRUST_PROXY` must match the deployed reverse-proxy topology and remain
  governed by the typed environment contract.
- Real HTTPS login, persistence, logout, and preflight behavior remain manual
  launch checks.

## Storage / database / email readiness

- Public health directly verifies database connectivity and Storage bucket
  access without writes.
- Storage health uses bucket metadata lookup only; it does not upload, delete,
  or create objects.
- Email configuration is visible indirectly through the authenticated admin
  system health surface.
- No email is sent by the readiness command or this PR.
- Delivery must be confirmed manually only when email is included in the
  release scope.

## Launch checklist

- [ ] Candidate commit and deployment artifact are identified.
- [ ] Required backend environment-variable names are present in the provider.
- [ ] No environment values are copied into logs, tickets, screenshots, or PRs.
- [ ] Database backup and Storage backup evidence are current.
- [ ] `GET /health` passes the read-only verifier.
- [ ] Authenticated admin health reports expected service configuration.
- [ ] Frontend build completes before `security:public-surface`.
- [ ] CORS preflight and all three session-cookie domains work over real HTTPS.
- [ ] Relevant authenticated smoke tests pass without exposing credentials.
- [ ] Rollback owner, previous deployment, and decision threshold are recorded.

## Incident checklist

- [ ] Record UTC time, deployment identifier, HTTP status, and request ID only.
- [ ] Stop launch progression when public health is not HTTP `200`.
- [ ] Distinguish database `down` from storage `down` using generic health state.
- [ ] Review provider logs without copying request bodies, cookies, tokens, or
  environment values.
- [ ] Verify provider status and dependency connectivity with read-only tools.
- [ ] Roll back the application when the failure began with the candidate deploy.
- [ ] Escalate database or Storage recovery through the existing backup and
  rollback runbook.
- [ ] Re-run health, CORS, cookie, and critical endpoint checks after recovery.

## Validation

- `pnpm audit --prod`
- `pnpm typecheck`
- `pnpm typecheck:test`
- `pnpm test`
- `pnpm build`
- `pnpm --dir frontend lint`
- `pnpm --dir frontend typecheck`
- `pnpm --dir frontend build`
- `pnpm security:public-surface`
- Relevant E2E: `dashboard-auth-redirect.spec.ts` and `visual-smoke.spec.ts`

## Remaining manual checks

- Provider-side environment presence with all values hidden.
- Production health against the deployed candidate.
- Authenticated admin system and schema health.
- Real HTTPS CORS, cookie persistence, and logout behavior.
- Private Storage policy, signed URL expiry, upload, download, and restore drill.
- Email provider configuration and controlled delivery when included in launch.
- Provider logs, alerts, backup evidence, rollback access, and on-call ownership.

## Out of scope

- SEO changes
- Feature changes
- Data migrations
- Provider changes
