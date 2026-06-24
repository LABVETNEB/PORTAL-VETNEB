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
| Backend health | Staging backend health responds successfully | Staging health endpoint checked manually or with a sanitized terminal capture | Health response is successful and contains no secret values | Pending | |
| Backend readiness | Runtime readiness is stable before release | Staging readiness endpoint, deployment dashboard or approved observability source | Readiness is successful for the expected deployment commit | Pending | |
| Admin private route without cookie | Admin private surface rejects unauthenticated access | Browser incognito, DevTools Network, or terminal request without cookies | Request is rejected or redirected without exposing private data | Pending | |
| Clinic private route without cookie | Clinic private surface rejects unauthenticated access | Browser incognito, DevTools Network, or terminal request without cookies | Request is rejected or redirected without exposing private data | Pending | |
| Admin session cookie | Admin session uses `admin_session_id` only | Browser DevTools Application/Cookies with values redacted | Admin flow does not require or create `app_session_id` as admin session authority | Pending | |
| Clinic session cookie | Clinic session uses `app_session_id` only | Browser DevTools Application/Cookies with values redacted | Clinic flow does not require or create `admin_session_id` as clinic session authority | Pending | |
| Session separation | Admin and clinic session authorities remain separated | Manual two-browser or two-profile verification with cookie names only | No session authority mixing between admin and clinic surfaces | Pending | |
| RLS tenant isolation | Tenant-scoped data remains isolated | Existing RLS matrix evidence and staging verification with sanitized identifiers | Tenant A cannot access Tenant B data | Pending | |
| Cross-tenant smoke | Cross-tenant smoke runbook evidence is collected | Existing cross-tenant smoke runbook, sanitized output only | Smoke attempt is blocked and produces no sensitive leakage | Pending | |
| Audit logging | Security-relevant denied access is auditable | Staging logs, observability dashboard or approved audit source | Denied access is observable without logging secrets | Pending | |
| Secret sanitization | Logs and evidence do not expose sensitive values | Manual review of submitted evidence | No cookies, tokens, passwords, hashes, signed URLs or secret env values are present | Pending | |
| PWA cache | Private surfaces are not cached as reusable private content | Browser DevTools Application/Cache Storage/Service Worker review | Private authenticated data is not available after logout or without session | Pending | |
| HTTP cache headers | Private responses have safe cache behavior | Browser DevTools Network headers review | Private responses are not cacheable in a way that exposes authenticated data | Pending | |
| Logout behavior | Logout invalidates private access | Browser verification after logout and reload/back navigation | Private data is not visible after logout | Passed | Post-merge evidence for `a69207c` / PR #1112: admin and clinic logout followed by Back + Ctrl+R did not display private dashboard data; browser remained outside the private dashboard / login-safe state. |
| Unauthorized API access | Private API endpoints do not return data without session | Sanitized terminal request or browser Network request without cookies | Response does not expose private records | Pending | |
| Deployment commit | Staging evidence corresponds to expected release commit | Deployment dashboard, GitHub commit reference or approved release record | Evidence maps to the intended release commit | Pending | |
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