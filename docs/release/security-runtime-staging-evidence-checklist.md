# PR-S5 — Security runtime/staging evidence checklist

## Purpose

This checklist defines the runtime and staging evidence required before releasing the security block.

It is intended to provide auditable release-readiness evidence without exposing secrets, cookies, tokens, passwords, hashes, signed URLs, environment values, private payloads or tenant-sensitive data.

## Scope

This checklist covers release evidence for:

- Admin and clinic sessions.
- `admin_session_id` / `app_session_id` separation.
- RLS and tenant isolation.
- Cross-tenant smoke evidence.
- Secret sanitization.
- Private routes without session.
- PWA and private-cache behavior.
- Audit and runtime logs without secrets.
- Health and readiness evidence.
- Documentation continuity from PR-S1, PR-S2, PR-S3 and PR-S4.

## Explicit non-scope

This PR does not change:

- Backend code.
- API behavior.
- Authentication logic.
- Database schema.
- RLS policies.
- Migrations.
- Dependencies.
- Lockfiles.
- CI workflows.
- Package scripts.
- Runtime scripts.
- Production configuration.

## Evidence handling rules

- Do not paste real cookies, tokens, passwords, hashes, signed URLs or secret values.
- Do not paste full private response payloads.
- Redact tenant identifiers when evidence can reveal client or clinic data.
- Prefer screenshots, terminal summaries or sanitized excerpts.
- Keep only the minimum evidence required to prove release readiness.
- Any failed evidence item blocks release until resolved in a separate scoped PR.

## Evidence checklist

| Area | Evidence required | Command or permitted source | Expected result | Status | Responsible / note |
| --- | --- | --- | --- | --- | --- |
| Backend health | Staging backend health responds successfully | Runtime /health request without cookies or secrets | Health response is successful and contains no secret values | Passed | Production /health returned HTTP 200 with success:true, status:ok, database:up and storage:up; no cookies, tokens or private payloads were used. |
| Backend readiness | Runtime readiness is stable before release | Runtime /health and API root request without cookies or secrets | Readiness endpoints respond successfully for the observed runtime | Passed | Production /health returned HTTP 200 with database/storage readiness; API root returned HTTP 200 with service identity and production environment. Deployment commit mapping remains tracked separately in the Deployment commit row. |
| Admin private route without cookie | Admin private surface rejects unauthenticated access | Terminal HEAD request without cookies | Request is rejected or redirected without exposing private data | Passed | No-session request to /dashboard/admin returned HTTP 307 to /login?next=%2Fdashboard%2Fadmin with Cache-Control: no-store, no-cache, must-revalidate; no private response body was printed. |
| Clinic private route without cookie | Clinic private surface rejects unauthenticated access | Terminal HEAD request without cookies | Request is rejected or redirected without exposing private data | Passed | No-session requests to /dashboard and /dashboard/informes returned HTTP 307 to login with Cache-Control: no-store, no-cache, must-revalidate; no private response bodies were printed. |
| Admin session cookie | Admin session uses `admin_session_id` only | Browser DevTools Application/Cookies with values redacted | Admin flow does not require or create `app_session_id` as admin session authority | Pending | Source review confirms admin session authority is represented as `admin_session_id` in `frontend/src/proxy.ts` and server env defaults, but browser/runtime cookie review was not performed. Do not mark Passed until cookie-name-only runtime evidence is collected without copying values. |
| Clinic session cookie | Clinic session uses `app_session_id` only | Browser DevTools Application/Cookies with values redacted | Clinic flow does not require or create `admin_session_id` as clinic session authority | Pending | Source review confirms clinic session authority is represented as `app_session_id` in `frontend/src/proxy.ts` and server env defaults, but browser/runtime cookie review was not performed. Do not mark Passed until cookie-name-only runtime evidence is collected without copying values. |
| Session separation | Admin and clinic session authorities remain separated | Manual two-browser or two-profile verification with cookie names only | No session authority mixing between admin and clinic surfaces | Pending | Source review confirms `/dashboard/admin` requires `admin_session_id` while non-admin dashboard routes require `app_session_id`; runtime two-surface cookie review was not performed, so this row remains Pending. |
| RLS tenant isolation | Tenant-scoped data remains isolated | Existing RLS matrix evidence and staging verification with sanitized identifiers | Tenant A cannot access Tenant B data | Pending | RLS/enforcement matrices remain represented, but runtime two-tenant cross-tenant smoke remains pending per PR #1116. This row must not be marked Passed until sanitized Clinic A/B evidence is executed and recorded. |
| Cross-tenant smoke | Cross-tenant smoke runbook evidence is collected | Existing cross-tenant smoke runbook, sanitized output only | Smoke attempt is blocked and produces no sensitive leakage | Pending | See "Runtime evidence gap - cross-tenant smoke and audit logging" below: the runbook itself records NO-GO and no live two-tenant smoke has been executed. |
| Audit logging | Security-relevant denied access is auditable | Staging logs, observability dashboard or approved audit source | Denied access is observable without logging secrets | Pending | See "Runtime evidence gap - cross-tenant smoke and audit logging" below: denied-login auditing has code/test evidence, cross-tenant resource denial has no audit event and no staging log review was performed. |
| Secret sanitization | Logs and evidence do not expose sensitive values | Manual review of submitted evidence and docs diff | No cookies, tokens, passwords, hashes, signed URLs or secret env values are present | Passed | Evidence was collected without cookies and without printing private API response bodies. Documentation diff was reviewed for secret-like values; no cookie values, bearer tokens, passwords, hashes, signed URLs or secret env values were recorded. |
| PWA cache | Private surfaces are not cached as reusable private content | Browser DevTools Application/Cache Storage/Service Worker review plus source/runtime verification | Private authenticated data is not available after logout or without session | Passed | Post-merge evidence after PR #1112/#1113: rontend/public/sw.js excludes /dashboard, /api/, /admin and responses with Set-Cookie from service-worker caching; production no-session /dashboard* requests redirect to login with Cache-Control: no-store, no-cache, must-revalidate; admin and clinic logout + Back + Ctrl+R did not display private dashboard data. |
| HTTP cache headers | Private responses have safe cache behavior | Production header verification plus source/runtime verification | Private responses are not cacheable in a way that exposes authenticated data | Passed | Post-merge evidence after PR #1112/#1113: production no-session requests to /dashboard, /dashboard/admin and /dashboard/informes return 307 to login with Cache-Control: no-store, no-cache, must-revalidate, Pragma: no-cache and cf-cache-status: DYNAMIC; rontend/next.config.ts declares Cache-Control: no-store, no-cache, must-revalidate for /dashboard/:path*. |
| Logout behavior | Logout invalidates private access | Browser verification after logout and reload/back navigation | Private data is not visible after logout | Passed | Post-merge evidence for `a69207c` / PR #1112: admin and clinic logout followed by Back + Ctrl+R did not display private dashboard data; browser remained outside the private dashboard / login-safe state. |
| Unauthorized API access | Private API endpoints do not return data without session | Sanitized terminal request without cookies; response bodies not printed | Response does not expose private records | Passed | Post-merge no-session probe against representative private API candidates returned no unexpected 2xx responses and did not print response bodies. Dashboard private routes /dashboard, /dashboard/admin and /dashboard/informes redirect to login without exposing private data. API status summary: /api/admin/auth/me=401; /api/admin/clinics=401; /api/admin/sessions=401; /api/admin/audit=404; /api/admin/alerts=404; /api/admin/reports=404; /api/admin/tokens=404; /api/auth/me=401; /api/clinic/me=404; /api/studies=404; /api/tokens=404; /api/reports=401. Web summary: /dashboard -> HTTP/1.1 307 Temporary Redirect location: /login?next=%2Fdashboard; /dashboard/admin -> HTTP/1.1 307 Temporary Redirect location: /login?next=%2Fdashboard%2Fadmin; /dashboard/informes -> HTTP/1.1 307 Temporary Redirect location: /login?next=%2Fdashboard%2Finformes. |
| Deployment commit | Staging evidence corresponds to expected release commit | Deployment dashboard, GitHub commit reference or approved release record | Evidence maps to the intended release commit | Pending | Not closed in this PR. Runtime health evidence was collected, but deployment commit mapping still requires approved deployment dashboard or release record evidence. |
| PR-S1 continuity | Session/security audit evidence remains represented | PR-S1 documentation or merged PR evidence | No unresolved session/security blocker remains | Pending | |
| PR-S2 continuity | RLS/enforcement matrix remains represented | PR-S2 documentation or merged PR evidence | RLS/enforcement expectations are covered | Pending | |
| PR-S3 continuity | Cross-tenant smoke evidence remains represented | PR-S3 runbook or merged PR evidence | Cross-tenant smoke path is covered | Pending | |
| PR-S4 continuity | Docs matrix drift guard remains represented | PR-S4 validation evidence | Security docs matrix guard remains green | Pending | |

## Permitted evidence sources

The following sources are permitted for release evidence when outputs are sanitized:

- Browser DevTools Network tab.
- Browser DevTools Application/Cookies tab with values redacted.
- Browser DevTools Application/Cache Storage and Service Worker views.
- Staging deployment dashboard.
- Approved observability or runtime log dashboard.
- GitHub PR and check evidence.
- Existing PR-S1 to PR-S4 documentation.
- Existing cross-tenant smoke runbook evidence.

## Permitted command evidence pattern

Command evidence may be recorded only as sanitized proof.

Acceptable examples:

- Method and route checked.
- HTTP status.
- Whether redirect or rejection occurred.
- Expected cookie name observed.
- Expected cache header observed.
- Expected deployment commit observed.

Do not record:

- Cookie values.
- Bearer tokens.
- Passwords.
- Hashes.
- Signed URLs.
- Secret environment values.
- Full private JSON payloads.
- Tenant-identifying private data.

## Acceptance criteria

PR-S5 is acceptable when:

- The release checklist is complete.
- Each checklist row has an expected result.
- Evidence handling rules prohibit secret leakage.
- Admin and clinic session separation is explicitly covered.
- RLS and tenant isolation are explicitly covered.
- Cross-tenant smoke evidence is explicitly covered.
- PWA and private-cache behavior are explicitly covered.
- PR-S1, PR-S2, PR-S3 and PR-S4 continuity are represented.
- The change is documentation-only.
- No backend, API, auth, database, migration, dependency, lockfile, CI, script or test file is modified.

## Release blockers

Security release must be blocked if any evidence shows:

- Secret leakage in logs, screenshots, terminal output or documentation.
- `admin_session_id` and `app_session_id` authority mixing.
- Private route data visible without a valid session.
- Cross-tenant access succeeds.
- RLS enforcement fails.
- Private authenticated data remains available from cache after logout.
- Staging evidence belongs to an unexpected deployment commit.
- CI or required release checks are not green.
- Evidence is incomplete, ambiguous or not reproducible.

## Marking release ready

The release may be marked ready only after every required evidence row is completed, reviewed and free of sensitive values.

Recommended status values:

- `Pending`
- `Passed`
- `Blocked`
- `Not applicable`

Blocked items must be escalated into a separate scoped PR or incident note. This checklist must not be used to hide unresolved runtime, staging or security findings.

## Notes for future releases

For future security releases, copy this checklist into the release evidence record and complete it against the exact staging deployment commit being promoted.

Do not reuse old evidence for a new deployment unless the reviewer explicitly confirms that the runtime artifact, configuration and commit are unchanged.

## Runtime evidence — logout/back/reload after PR #1112

Date: 2026-06-24
Commit: `a69207c fix(security): invalidate dashboard logout sessions (#1112)`
Scope: post-merge browser verification of the PR-S5 logout behavior row.

Evidence recorded:

- Admin dashboard: after login, `/dashboard/admin`, logout, browser Back and `Ctrl+R`, private dashboard data was not displayed. Browser remained outside the private dashboard.
- Clinic dashboard: after login, `/dashboard`, logout, browser Back and `Ctrl+R`, private dashboard data was not displayed. Browser remained outside the private dashboard.
- CI for PR #1112: Backend CI push passed, Backend CI pull_request passed, Frontend CI pull_request passed; Supabase Preview skipped as expected.

Result:

- Logout behavior: Passed for admin and clinic post-merge runtime verification.
- HTTP cache headers and PWA cache rows remain pending unless separately verified in staging DevTools against the promoted deployment commit.

## Runtime evidence — HTTP cache headers and PWA cache after PR #1112/#1113

Date: 2026-06-24
Runtime code commit: `a69207c fix(security): invalidate dashboard logout sessions (#1112)`
Prior evidence commit: `02005a8 docs(security): record logout runtime evidence (#1113)`
Scope: PR-S5 runtime evidence for HTTP cache headers and PWA cache rows.

Evidence recorded:

- Production no-session request to `/dashboard` returned `307` to `/login?next=%2Fdashboard` with `Cache-Control: no-store, no-cache, must-revalidate`, `Pragma: no-cache` and `cf-cache-status: DYNAMIC`.
- Production no-session request to `/dashboard/admin` returned `307` to `/login?next=%2Fdashboard%2Fadmin` with `Cache-Control: no-store, no-cache, must-revalidate`, `Pragma: no-cache` and `cf-cache-status: DYNAMIC`.
- Production no-session request to `/dashboard/informes` returned `307` to `/login?next=%2Fdashboard%2Finformes` with `Cache-Control: no-store, no-cache, must-revalidate`, `Pragma: no-cache` and `cf-cache-status: DYNAMIC`.
- Source policy in `frontend/next.config.ts` declares `Cache-Control: no-store, no-cache, must-revalidate` for `/dashboard/:path*`.
- Service worker source in `frontend/public/sw.js` excludes `/dashboard`, `/api/`, `/admin` and responses with `Set-Cookie` from caching.
- Prior post-merge evidence from PR #1113 remains valid: admin and clinic logout followed by browser Back and `Ctrl+R` did not display private dashboard data.

Result:

- HTTP cache headers: Passed.
- PWA cache: Passed.

## Runtime evidence � unauthorized API access and secret sanitization

Date: 2026-06-24
Current evidence base commit: `9e453f4 docs(security): record cache and pwa runtime evidence (#1114)`
Scope: PR-S5 runtime evidence for unauthorized API access and secret sanitization rows.

Evidence recorded:

- No-session private API probe used only unauthenticated requests. No cookies, tokens or credentials were supplied.
- Private API response bodies were intentionally not printed to terminal or documentation.
- No-session private API candidates produced no unexpected `2xx` responses.
- API status summary: `/api/admin/auth/me=401; /api/admin/clinics=401; /api/admin/sessions=401; /api/admin/audit=404; /api/admin/alerts=404; /api/admin/reports=404; /api/admin/tokens=404; /api/auth/me=401; /api/clinic/me=404; /api/studies=404; /api/tokens=404; /api/reports=401`.
- No-session private dashboard requests remained blocked or redirected to login without exposing private data.
- Web status summary: `/dashboard -> HTTP/1.1 307 Temporary Redirect location: /login?next=%2Fdashboard; /dashboard/admin -> HTTP/1.1 307 Temporary Redirect location: /login?next=%2Fdashboard%2Fadmin; /dashboard/informes -> HTTP/1.1 307 Temporary Redirect location: /login?next=%2Fdashboard%2Finformes`.
- Submitted evidence and documentation diff contain no cookie values, bearer tokens, passwords, hashes, signed URLs or secret environment values.

Result:

- Unauthorized API access: Passed.
- Secret sanitization: Passed.

## Runtime evidence gap - cross-tenant smoke and audit logging

Date: 2026-06-24
Evidence base commit: `b7e2894 docs(security): record unauthorized and secret evidence (#1115)`
Scope: documentation-only review of existing runbooks, security matrices and automated tests for the PR-S5 cross-tenant smoke and audit logging rows. No staging or production access, no live tenant sessions and no observability dashboard were available in this session.

### What was inspected

- `docs/ops/CROSS_TENANT_SMOKE_EVIDENCE_RUNBOOK.md` defines checks CT-01 through CT-16 for Clinic A/B, particular tokens and public tokens. The runbook's own stated result is **NO-GO** until an authorized cross-tenant smoke is executed and recorded with a technical and a business responsible.
- `docs/security/rls-enforcement-matrix.md` and `docs/security/security-sessions-tenant-rls-audit.md` mark every tenant-scoped resource row, including `Audit log`, as `Abierto - pendiente runtime/staging`.
- `docs/security/ENDPOINT_TEST_MATRIX.md` lists existing guardrails for the audit log surface (`test/admin-audit.fastify.test.ts`, `test/clinic-audit.fastify.test.ts`, `test/particular-audit.fastify.test.ts`, `test/security-audit-logging-phase-boundaries.test.ts`) but keeps its production status `Abierto - pendiente evidencia runtime/staging` because the required smoke ("export y revision de redaccion") has not run.
- `test/security-cross-tenant-idor-contract.test.ts` is a documentation-contract test covering 15 cross-tenant IDOR scenarios (`CTIDOR-001`..`CTIDOR-015`). Every entry hardcodes `productionReadinessStatus: "pending_runtime_staging_evidence"`; the test validates contract shape only, not actual runtime behavior.
- `test/security-audit-logging-phase-boundaries.test.ts` confirms, via source inspection of `server/lib/audit.ts` and route files, that `writeAuditLog` is called only after successful mutations (login succeeded, report status changed, report uploaded, access token created/revoked, public report accessed), with metadata normalization, sanitized request paths, and audit-write failures isolated from the business response.
- `server/lib/audit-log.ts` defines the full `AUDIT_EVENTS` enum (21 events). All 21 are success-path events; none represents a denied or cross-tenant-blocked attempt.
- `server/routes/admin-failed-login-alerts.fastify.ts`, `server/db-admin-failed-login-alerts.ts` and `test/admin-failed-login-alerts.fastify.test.ts` show a separate, real mechanism that records denied **login** attempts (`missing_credentials`, `invalid_credentials`, `rate_limited`) per surface (admin/clinic/particular) with `ipAddress`, `userAgent` and `createdAt`, with no password or secret stored. The route requires an authenticated admin session, and the existing test confirms a `401` response without an admin session and a sanitized response shape when one is present.

### What is missing

- No staging or production smoke with two real or controlled tenant sessions (Clinic A / Clinic B) has been executed or recorded for checks CT-01 through CT-16. This requires live access to a staging or controlled-production environment with two test clinics, which was not available in this session.
- No audit event exists today for a cross-tenant resource-access denial (403/404 IDOR). The only denied-access audit trail found covers failed **login** attempts, not cross-tenant resource access attempts (runbook checks CT-04, CT-06, CT-08, CT-11, CT-12, CT-14).
- No staging or observability log export was reviewed for secret-free content in this session, since no staging logs or observability dashboard access was available.
- The canonical security matrices (`rls-enforcement-matrix.md`, `ENDPOINT_TEST_MATRIX.md`, `security-sessions-tenant-rls-audit.md`) still declare these surfaces `Abierto - pendiente runtime/staging` or NO-GO. Marking this checklist `Passed` while those remain open would create documentation drift of the kind PR-S4's guard is meant to prevent.

### Exact manual steps to close (Nico / responsible operator)

1. Confirm explicit authorization for the target environment (staging or controlled production) and identify two test clinics (`Clinic A`, `Clinic B`) with independent sessions and owned resources, per `docs/ops/CROSS_TENANT_SMOKE_EVIDENCE_RUNBOOK.md` section 3.
2. Execute checks CT-01 through CT-16 from that runbook manually, with the technical and business responsible present.
3. Record only the sanitized evidence columns allowed in runbook section 5 (status codes, `signedUrl=present/absent`, `foreignReportVisible=false`, cookie flags without values) in the runbook's own evidence table (section 11), not pasted directly into this checklist file.
4. For the audit logging row specifically, additionally check `/api/admin/audit-log` (or the approved observability/log source) after a denied cross-tenant attempt and confirm whether any event is recorded. If none is recorded, treat the absence of a cross-tenant-denial audit event as a documented product gap for a future scoped PR rather than a checklist failure to hide.
5. Review the exported or queried audit and failed-login-alert output and confirm it contains no cookies, tokens, passwords, hashes, signed URLs or secret environment values before recording any excerpt.
6. Update this checklist's two rows to `Passed` only after steps 1-5 produce sanitized evidence with a PASS result per runbook section 9, and update `docs/security/rls-enforcement-matrix.md` / `docs/security/ENDPOINT_TEST_MATRIX.md` in a coordinated follow-up so the matrices do not drift apart.

### How to sanitize evidence before recording it

- Use only the evidence patterns from runbook section 5 (status codes, presence/absence flags, redacted actor labels such as `Clinic A` / `Clinic B`).
- Never paste cookie values, bearer tokens, passwords, hashes, signed URLs, full response bodies or real patient/tutor data.
- Prefer terminal status summaries (method, route, HTTP status) over raw logs or screenshots that could contain private data.

### Why this was not marked Passed

- Cross-tenant smoke requires a live two-tenant runtime smoke that has not been executed. The runbook itself still declares NO-GO, and the only related automated test is a static contract that self-declares `pending_runtime_staging_evidence` for all 15 scenarios.
- Audit logging has real, tested evidence for denied **login** attempts only. It has no audit trail for cross-tenant resource denial, and no staging or observability log review was available in this session. Marking it Passed would overstate current evidence and contradict the still-open status in `rls-enforcement-matrix.md` and `ENDPOINT_TEST_MATRIX.md`.


## Runtime evidence - backend health, readiness and no-session private routes

Date: 2026-06-24
Evidence base commit: `94d798f docs(security): record cross-tenant and audit evidence (#1116)`
Scope: PR-S5 runtime evidence for backend health/readiness and private dashboard routes without session.

Evidence recorded:

- Backend health: production `/health` returned HTTP 200 with `success:true`, `status:ok`, `database:up` and `storage:up`.
- Backend readiness: production `/health` and API root responded successfully without cookies, tokens or private payloads.
- Admin private route without cookie: no-session request to `/dashboard/admin` returned HTTP 307 to login with `Cache-Control: no-store, no-cache, must-revalidate`.
- Clinic private routes without cookie: no-session requests to `/dashboard` and `/dashboard/informes` returned HTTP 307 to login with `Cache-Control: no-store, no-cache, must-revalidate`.
- Source review: `frontend/src/proxy.ts` separates dashboard authority between `admin_session_id` for admin dashboard routes and `app_session_id` for non-admin dashboard routes.
- Source review: `frontend/src/lib/api.ts` keeps admin and clinic logout endpoints separated.
- Automated validation: `pnpm test` passed 2831/2831.

Result:

- Backend health: Passed.
- Backend readiness: Passed.
- Admin private route without cookie: Passed.
- Clinic private route without cookie: Passed.
- Admin session cookie: Pending until runtime cookie-name-only evidence is collected.
- Clinic session cookie: Pending until runtime cookie-name-only evidence is collected.
- Session separation: Pending until runtime two-surface cookie-name-only evidence is collected.
- RLS tenant isolation: Pending until cross-tenant Clinic A/B smoke is executed and recorded.
- Deployment commit: Pending until approved deployment dashboard or release record maps runtime evidence to the intended deployment commit.
