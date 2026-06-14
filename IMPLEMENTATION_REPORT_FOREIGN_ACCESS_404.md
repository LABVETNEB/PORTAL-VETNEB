# Report Foreign Access 404

## Summary
- Unified foreign and missing report access as the same generic `404` response.
- Added clinic-scoped report lookup by `id + clinicId`.
- Preserved owner, admin, session, permission, conflict, rate-limit, and server-error behavior.

## Problem
- Clinic report history, preview, download, and status routes loaded a report by ID first.
- A missing report returned `404`, while a report owned by another clinic returned `403`.
- Public report tokens also exposed different responses for malformed, revoked, and expired tokens.
- Those differences allowed callers to infer that a report or token existed.

## Scope
- Clinic report read routes and report status updates.
- Clinic report-access-token and particular-token report linking.
- Particular linked-report preview and download.
- Public report access by token.
- Report ownership queries and related backend, frontend-contract, and security tests.

## Files changed
- `server/db.ts`
- `server/db-report-access.ts`
- `server/routes/reports.fastify.ts`
- `server/routes/reports-status.fastify.ts`
- `server/routes/report-access-tokens.fastify.ts`
- `server/routes/particular-tokens.fastify.ts`
- `server/routes/study-tracking.fastify.ts`
- `server/routes/particular-auth.fastify.ts`
- `server/routes/public-report-access.fastify.ts`
- Related report, token, frontend-contract, and security guardrail tests under `test/`

## Previous behavior
- `GET /api/reports/:reportId/history` returned `403` for a foreign report and `404` for a missing report.
- `GET /api/reports/:reportId/preview-url` returned `403` for a foreign report and `404` for a missing report.
- `GET /api/reports/:reportId/download-url` returned `403` for a foreign report and `404` for a missing report.
- `PATCH /api/reports/:reportId/status` returned `403` for a foreign report and `404` for a missing report.
- Some clinic linking routes returned ownership-specific errors after loading a foreign report.
- Public token access returned distinct `400`, `404`, and `410` responses for unusable tokens.

## New behavior
- Missing and foreign reports return:

```json
{
  "success": false,
  "error": "Informe no encontrado"
}
```

- The response does not include report IDs, clinic IDs, storage paths, token details, or ownership information.
- Owner access still returns the existing success payload.
- Admin report preview and download remain available to authenticated admins.
- A valid public token for a report that is not yet available keeps the existing `409` state response.

## Ownership model
- Production report reads now use `getClinicScopedReportById(reportId, clinicId)`.
- The database query filters by both report ID and clinic ID in one `WHERE` clause.
- Public token lookup joins reports only when token and report clinic IDs match.
- Test dependency compatibility retains an injected `getReportById` fallback that applies the same clinic filter before returning a report.

## 404 unification
- Clinic history, preview, download, and status routes use the same lookup and response for missing and foreign reports.
- Clinic report-token creation and particular-token report linking use the same generic `404`.
- Particular report preview and download use the same generic `404`.
- Malformed, unknown, revoked, expired, or clinic-mismatched public report tokens use the same generic `404`.
- Runtime tests compare status, body shape, body text, and absence of sensitive fields.

## 401 / 403 / 500 behavior
- Missing, invalid, or expired dashboard sessions still return `401`; the existing dashboard redirect to login remains unchanged.
- Permission failures that do not reveal a specific report, such as missing management permission, remain `403`.
- Blocked origins remain `403`.
- Real dependency exceptions remain `500` and are not converted to `404`.
- Rate limiting remains `429`.

## Tests
- Updated report read and status tests for foreign-versus-missing equivalence.
- Added explicit `500` regression tests.
- Added clinic report-token and particular-token linking equivalence tests.
- Added particular linked-report equivalence tests.
- Updated public token lifecycle tests and cross-tenant security contracts.
- Added frontend contract coverage preventing permission-specific copy.
- Kept owner, admin, list scoping, session `401`, and dashboard redirect coverage.

## Validation
- `pnpm typecheck`: passed.
- `pnpm typecheck:test`: passed.
- `pnpm test`: passed with 2691 tests, 2691 passed, 0 failed, 0 skipped, and 0 cancelled in 10347.3394 ms.
- `pnpm build`: passed.
- `pnpm audit --prod`: passed with no known vulnerabilities. The package tooling emitted a non-blocking Node.js `url.parse()` deprecation warning.
- `pnpm security:public-surface`: passed with no public devtools exposure findings.
- `pnpm --dir frontend lint`: passed.
- `pnpm --dir frontend typecheck`: passed.
- `pnpm --dir frontend build`: passed.
- `pnpm --dir frontend e2e dashboard-auth-redirect.spec.ts visual-smoke.spec.ts --project=chromium --workers=1`: passed with 12 tests.

## Residual risk
- Cross-clinic behavior is covered by injected Fastify route tests, exact foreign-versus-missing response comparisons, and structural security contracts.
- The selected E2E suite validates dashboard authentication redirects and visual stability, but it does not provision two real clinics and exercise a live database cross-tenant attempt.
- Production ownership enforcement is still applied in the database query itself with `reportId + clinicId`, reducing the chance of an application-layer ownership bypass.

## Out of scope
- Dashboard redesign or general visual changes.
- SEO, PWA, contact, pricing, email, upload, or storage redesign.
- New roles or broad permission changes.
- Database migrations or new dependencies.
- Changes to the dashboard `401` redirect implementation.
