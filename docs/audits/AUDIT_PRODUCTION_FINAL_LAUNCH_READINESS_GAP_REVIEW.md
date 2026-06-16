# Production Final Launch Readiness Gap Review

Audit date: 2026-06-14

## Executive summary

- General status: code quality, CI, public availability, core security contracts, health, and selected E2E are green.
- Estimated readiness: approximately 92% for code/read-only technical controls, 75-80% for operational launch evidence, and 83-86% overall.
- Recommendation: **not launch-ready** until the launch blockers below are closed with sanitized evidence.
- Critical blocker: a public historical commit contains two remote database URLs with embedded non-generic passwords; rotation is not demonstrated and repository secret scanning is disabled.
- Operational blockers: local backup artifacts are not encrypted, no restore drill is recorded, authenticated production/staging workflows remain unverified, and launch/incident ownership is not formally closed.
- High residual risks: failed uploads can leave private orphan objects, there is no external alerting, and dependency health checks do not have server-side deadlines.

## Scope

Audited:

- Git state, open PRs, remote branches, and GitHub Actions state.
- Backend and frontend builds, types, tests, selected E2E, dependency audit, and public-surface security audit.
- Public health/readiness, API headers, CORS behavior on safe GET requests, and public frontend availability.
- Auth/session/cookie implementation, proxy behavior, dashboard redirects, report ownership/IDOR controls, contact/rate-limit controls, upload/storage, email configuration, Supabase boundaries, logs/request IDs, PWA/offline behavior, basic accessibility, and operational runbooks.
- Required environment-variable names, without reading or recording production values.
- Backup metadata and permissions only; backup content was not opened.

Out of scope:

- Functional fixes, deployments, production writes, real login attempts, real emails, uploads, downloads, migrations, feature work, and redesign.
- SEO was not audited and was not modified.

## Evidence

- Audited HEAD: `18582f5 ops(production): verify observability and launch readiness (#989)`.
- Audit branch: `audit/production-final-launch-readiness-gap-review`.
- Initial Git state: clean `main`, no open PRs, and no remote branches unmerged into `origin/main`.
- PR #989 checks: Backend CI `SUCCESS`, Frontend CI `SUCCESS`, Supabase Preview `SKIPPED`.
- `main` push CI for the audited HEAD:
  - Backend CI run `27506907378`: `success`.
  - Frontend CI run `27506907390`: `success`.
- `pnpm audit --prod`: passed, `No known vulnerabilities found`; tooling emitted a non-blocking Node.js `url.parse()` deprecation warning.
- `pnpm typecheck`: passed.
- `pnpm typecheck:test`: passed.
- `pnpm test`: **2697 tests, 2697 passed, 0 failed, 0 cancelled, 0 skipped, 0 todo, duration 10615.3988 ms**.
- `pnpm build`: passed; backend bundle generated.
- `pnpm --dir frontend lint`: passed.
- `pnpm --dir frontend typecheck`: passed.
- `pnpm --dir frontend build`: passed; 25 static pages generated and dynamic dashboard routes compiled.
- `pnpm security:public-surface`: passed with zero public findings; two server-only cookie-name identifier notices were informational.
- Selected E2E: **12 passed in 13.1 seconds** using Chromium and one worker.
- Production readiness command: `PASS readiness: /health returned 200 with database and storage up.`
- Production health snapshot: HTTP `200`, `success=true`, `status=ok`, database `up`, storage `up`.
- Public frontend GET checks: `/`, `/login`, `/contacto`, `/particulares`, `/servicios`, `/precios`, `/manifest.webmanifest`, and `/offline` returned HTTP `200` on both apex and `www` hosts.
- Safe CORS GET checks: apex and `www` origins received exact credentialed allow-origin headers; an invalid origin did not.
- Same-origin frontend proxy check: `GET /api/auth/me` returned the expected `401`, `Cache-Control: no-store`, API security headers, and an `x-request-id`.
- Targeted Git-history scan:
  - No real `.env` or `.env.local` file was found in Git history.
  - No Supabase JWT-like or Google refresh-token-like value was found by the targeted patterns.
  - Commit `a88a5e4` contains two remote PostgreSQL URLs with embedded non-generic passwords in historical `.env.example`.
  - The repository is public and GitHub secret scanning, validity checks, and push protection are disabled.
  - The current `.env.example` contains placeholders, but that does not invalidate historical credentials.
- Backup metadata:
  - Local backup root contains database and Storage artifacts dated 2026-06-08.
  - Windows encrypted-file attribute count is zero.
  - Extracted sensitive/database artifacts exist outside encrypted containers.
  - ACLs grant read access to the local Users group and modify access to Authenticated Users.
- Final Git state is recorded after cleanup in the final verification section of this report.

## Current strengths

- Security functional: production environment parsing is typed; production requires CORS configuration; cookies are separated by clinic, admin, and particular realms.
- Reports/IDOR: foreign and missing report access is normalized to generic `404`; production queries scope by report and clinic; public token lifecycle is covered.
- Dashboard auth: missing cookies and backend `401` responses reach a stable login redirect; `403`, `404`, network failures, and `5xx` remain distinct.
- Contact/rate-limit: payload validation, trusted-origin enforcement, response headers, and a fixed-window rate limit are implemented and tested.
- Observability: API responses carry `x-request-id`; errors include a safe correlation ID; logs redact tokens, query secrets, cookies, and signed URLs.
- Health: public health is credential-free and read-only, checks database and private Storage, and suppresses raw dependency errors.
- CI: backend CI includes dependency audits, migrations, typechecks, tests, and build; frontend CI includes lint, typecheck, build, public-surface audit, and Playwright E2E.
- PWA/static assets: manifest, offline route, service-worker registration, private-path exclusions, icons, dimensions, and static asset weight contracts are present.
- Basic accessibility: focus, ARIA, keyboard, dialog, skip-control, and responsive contracts have both static and Playwright coverage.
- Public surface: no public devtools exposure finding was detected after the production frontend build.

## What is not missing

- A production health endpoint and a strict read-only readiness verifier.
- Request correlation and safe public API error behavior.
- Separate auth realms and secure production cookie policy in code.
- CORS allowlisting and trusted-origin protection for unsafe methods.
- Cross-tenant report ownership tests and generic foreign-resource responses.
- Private Storage with signed URLs and bounded upload sizes.
- Persistent login rate limits for clinic, admin, and particular auth.
- Backend and frontend CI gates on the audited commit.
- PWA/offline foundations and basic accessibility guardrails.
- A documented backup/restore/rollback runbook.

## Launch blockers

| ID | Severity | Area | Evidence | Impact | Recommended action | Suggested PR |
|---|---|---|---|---|---|---|
| BLK-01 | Critical | Secret leakage | Public commit `a88a5e4` contains two remote DB URLs with embedded non-generic passwords; current placeholders do not remove Git history; secret scanning and push protection are disabled. | If either credential is still valid, unauthorized database access, data disclosure, corruption, or deletion is possible. | Rotate every affected DB credential before GO, verify old credentials fail, review provider access logs, enable secret scanning/push protection, run a full redacted history scan, and record sanitized evidence. | `ops(security): close historical database credential exposure` |
| BLK-02 | Critical | Backup/privacy/recovery | Backup artifacts from 2026-06-08 are present locally with no Windows encryption flag; extracted sensitive artifacts exist; ACLs permit broader local user access; no restore drill is recorded. | Sensitive clinical data can be exposed locally and recovery ability remains unproven during a production incident. | Restrict ACLs, encrypt or vault all DB/Storage backups, create a fresh launch backup, verify integrity, execute a non-production restore drill, and record pass/fail evidence. | `ops(recovery): encrypt backups and record restore drill` |
| BLK-03 | High | Authenticated production smoke | This audit intentionally used no credentials and performed no writes. Current readiness documents still lack real clinic/admin/particular login, secure-cookie, upload/download, report access, cross-tenant, email, and log-review evidence. | Public HTTP `200` and health cannot prove the core private workflows or privacy boundaries work in the deployed topology. | Run controlled staging first, then approved production smoke with dedicated test data and sanitized evidence; stop on any cookie, CORS, IDOR, Storage, email, or log leakage failure. | `test(production): record authenticated critical-flow smoke evidence` |
| BLK-04 | High | Rollback/incident/governance | The runbook exists, but restore/rollback execution, launch owner, incident commander/channel, and final technical/business approval remain open. | A failed launch may have no proven recovery path or accountable decision maker. | Assign named owners and incident channel, identify prior stable deploys, rehearse rollback, define stop thresholds, and sign the GO/NO-GO record against this commit. | `ops(launch): close rollback incident ownership and approvals` |

### Blocker priority and verification

- `BLK-01`: priority `P0`, immediate and before any GO decision.
  - `git log --all --oneline -- .env.example`
  - Run a full history scanner with redacted output, for example `gitleaks git --redact`.
  - Verify in the database provider that every affected password was rotated and that the previous credentials are rejected.
  - `gh api repos/LABVETNEB/PORTAL-VETNEB --jq '{visibility:.visibility,security_and_analysis:.security_and_analysis}'`
- `BLK-02`: priority `P0`, before launch or any migration/data-changing release.
  - `Get-ChildItem C:\VETNEB-BACKUPS -Recurse -File`
  - `Get-Acl C:\VETNEB-BACKUPS`
  - Verify encrypted/vault storage and restricted ACLs without printing backup content.
  - Execute schema, login, report, and Storage smoke against a non-production restore target.
- `BLK-03`: priority `P0`, before exposing authenticated workflows to users.
  - `pnpm smoke:staging`
  - `pnpm smoke:upload`
  - Execute controlled clinic/admin/particular and cross-tenant checks with sanitized output.
- `BLK-04`: priority `P0`, before the launch window.
  - Verify prior stable deploy identifiers, owners, incident channel, rollback access, stop thresholds, and signed approval.
  - Re-run health, auth, CORS/cookies, reports, Storage, and email checks after the rehearsal.

## High-priority gaps

| ID | Severity | Area | Evidence | Impact | Recommended action | Suggested PR |
|---|---|---|---|---|---|---|
| HIGH-01 | High | Storage consistency/privacy | Report and avatar flows upload to Storage before DB persistence. There is no compensating delete if later DB/link/audit work fails. `storage_orphans` is explicitly `supported: false`. | Private clinical objects can remain unreferenced, untracked, and retained indefinitely after partial failures. | Add compensating cleanup for failed persistence, make audit/secondary work failure policy explicit, and add a safe orphan inventory/reconciliation job with dry-run evidence. | `fix(storage): compensate failed persistence and reconcile orphan objects` |
| HIGH-02 | High | Monitoring/alerting | The metrics baseline explicitly has no external APM, alert rules, or distributed metrics store. Public readiness is currently point-in-time only. | Outages, elevated `5xx`, email failures, auth attacks, or dependency degradation may remain unnoticed until a user reports them. | Add external uptime checks for frontend and API health, alert on health/5xx/auth/email thresholds, define escalation owners, and test one alert path before GO. | `ops(observability): add production alerts and escalation ownership` |
| HIGH-03 | High | Health/readiness resilience | Database and Storage checks run sequentially without server-side per-dependency deadlines. Only the external verifier has a 20-second timeout. | A stalled dependency can hang the health endpoint and make deploy probes or incident diagnosis ambiguous. | Bound each dependency check, run independent checks concurrently where safe, retain generic failure output, and add timeout regression tests. | `fix(ops): bound health dependency checks` |

## Medium-priority gaps

| ID | Severity | Area | Evidence | Impact | Recommended action | Suggested PR |
|---|---|---|---|---|---|---|
| MED-01 | Medium | Health HTTP contract | Production `/health` and `/api/health` return JSON text with `Content-Type: text/plain`; neither sends explicit `Cache-Control: no-store`. `/api/health` still has request ID and API security headers. | Strict clients/probes may reject the MIME contract, and intermediaries have no explicit freshness directive. | Return through Fastify serialization or flush headers correctly; add production-contract tests for JSON MIME and no-store. | `fix(ops): normalize health response headers` |
| MED-02 | Medium | Public rate limits | Contact, public report access, public professionals, and token mutation limits use process-local memory stores; they reset on restart and do not coordinate replicas. | Abuse protection weakens during restarts, scale-out, or multi-instance routing. | Move critical public/mutation limits to a shared store or edge/WAF control and verify behavior across restart/replica boundaries. | `fix(security): persist public and mutation rate limits` |
| MED-03 | Medium | Upload validation | Report upload checks declared MIME and size but does not verify PDF/image magic bytes or scan content; avatar validation is stronger. | Renamed or malformed content can enter private Storage and later reach signed download consumers. | Validate file signatures and structure before upload; evaluate asynchronous malware scanning for report files. | `fix(upload): validate report file signatures` |
| MED-04 | Medium | PWA cache lifecycle | Production uses `SW_VERSION=2026-05-23-pwa-global-v1`; PWA icons changed on 2026-06-14 and icon responses are immutable for one year. Existing installed clients may retain old precache entries because `sw.js` content/version did not change. | Installed clients can serve stale immutable assets despite a successful deployment. | Version the service-worker cache whenever precached immutable assets change and add a contract tying the version to precache revisions. | `fix(pwa): version precache with immutable asset changes` |

## Low-priority / post-launch improvements

| ID | Severity | Area | Evidence | Impact | Recommended action | Suggested PR |
|---|---|---|---|---|---|---|
| LOW-01 | Low | Accessibility assurance | Strong ARIA/focus/keyboard contracts exist, but no axe, pa11y, or equivalent automated runtime scanner is installed. | Some semantic or contrast regressions may escape contract-based tests. | Add a small automated accessibility smoke on critical public and login routes, plus one manual screen-reader check per release. | `test(a11y): add automated critical-route accessibility smoke` |
| LOW-02 | Low | Dependency maintenance | CI audits dependencies, but repository Dependabot security updates are disabled. | Security updates require manual discovery and scheduling. | Enable dependency security updates with conservative review and CI requirements. | `ops(dependencies): enable security update automation` |
| LOW-03 | Low | Tooling hygiene | `pnpm audit --prod` emits the Node.js `url.parse()` deprecation warning from tooling. | No observed runtime failure, but future toolchain versions may become noisier or stricter. | Trace the warning during routine dependency maintenance and update the responsible tool when available. | `chore(tooling): remove audit deprecation warning` |

## Manual production checks still required

- [ ] Confirm all required variable names are present in Render with values hidden.
- [ ] Confirm historical DB credentials are rotated and old credentials are rejected.
- [ ] Confirm clinic, admin, and particular cookies are `HttpOnly`, `Secure`, and `SameSite=None` over real HTTPS.
- [ ] Confirm real login persistence, expiry, revocation, and logout for all three auth realms.
- [ ] Confirm production CORS and trusted-origin behavior through the deployed frontend, including both approved frontend hosts.
- [ ] Confirm frontend domains and API domain resolve to the intended deploys and certificates.
- [ ] Confirm Supabase DB schema health through the authenticated admin endpoint.
- [ ] Confirm Supabase Storage bucket privacy, service-role permissions, signed URL expiry, and no public URL fallback.
- [ ] Confirm Gmail API or SMTP transport and `CONTACT_TO` through a controlled, approved delivery test.
- [ ] Confirm report upload, preview, download, and replacement behavior using dedicated non-sensitive test data.
- [ ] Confirm cross-tenant report/token/tracking attempts return generic denial without disclosure.
- [ ] Confirm backup freshness, encryption/vault storage, integrity, and restricted ACLs.
- [ ] Complete a non-production DB and Storage restore drill.
- [ ] Review production logs for request IDs, redaction, no cookies, no raw tokens, no signed URLs, and no secrets.
- [ ] Configure and test external uptime, dependency, `5xx`, auth-abuse, and email alerts.
- [ ] Identify previous stable backend/frontend deploys and rehearse rollback.
- [ ] Assign launch owner, technical approver, business approver, incident commander, and incident channel.

### Required environment-variable names

Backend/runtime:

- `NODE_ENV`
- `PORT`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_DB_URL` or `DATABASE_URL`
- `DATABASE_MAX_CONNECTIONS`
- `SUPABASE_STORAGE_BUCKET`
- `COOKIE_NAME`
- `ADMIN_COOKIE_NAME`
- `PARTICULAR_COOKIE_NAME`
- `CORS_ORIGIN`
- `TRUST_PROXY`
- `OWNER_OPEN_ID`
- `LAB_UPLOAD_USERNAMES`
- `MAX_UPLOAD_FILE_SIZE_MB`
- `SUPABASE_SIGNED_URL_EXPIRES_IN_SECONDS`
- `SESSION_TTL_HOURS`
- `GMAIL_API_CLIENT_ID`
- `GMAIL_API_CLIENT_SECRET`
- `GMAIL_API_REFRESH_TOKEN`
- `GMAIL_API_FROM`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`
- `CONTACT_TO`

Frontend:

- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_SITE_URL`

## Launch checklist

- [x] Audited commit is identified and reproducible.
- [x] Backend and Frontend CI are green on the audited HEAD.
- [x] Local dependency audit, typechecks, tests, builds, public-surface audit, and selected E2E are green.
- [x] Public API health reports database and Storage `up`.
- [x] Public frontend and operational PWA routes return HTTP `200`.
- [ ] Rotate and invalidate historical database credentials.
- [ ] Enable repository secret scanning and push protection.
- [ ] Produce fresh encrypted DB and Storage backups with restricted access.
- [ ] Complete and document restore and rollback drills.
- [ ] Complete authenticated staging and production smoke.
- [ ] Verify secure cookies, real CORS, report IDOR, Storage, email, and log redaction in the deployed topology.
- [ ] Configure and test production alerts.
- [ ] Assign launch and incident owners/channel.
- [ ] Record final technical and business GO approval.

## Rollback and incident checklist

- [ ] Record UTC time, audited commit/deploy identifiers, affected surface, HTTP status, and request ID.
- [ ] Freeze further deploys and data-changing operations.
- [ ] Confirm incident commander, technical owner, business owner, and incident channel.
- [ ] Check `/health` and distinguish database from Storage degradation without copying raw payloads into public channels.
- [ ] Inspect provider logs with redaction; do not copy cookies, tokens, signed URLs, credentials, request bodies, or backup content.
- [ ] Compare against the previous stable backend/frontend deploys and environment-variable names.
- [ ] Roll back the application and environment configuration first when the incident began with the candidate deploy.
- [ ] Restore DB or Storage only with explicit authorization, verified backup integrity, and a documented impact decision.
- [ ] Re-run health, auth, CORS/cookies, report access, Storage, email, and public route smoke after recovery.
- [ ] Record final state, residual impact, owner, follow-up actions, and the decision to resume or remain rolled back.

## Risk register

| Risk | Probability | Impact | Mitigation | Status |
|---|---|---|---|---|
| Historical DB credential remains valid | Unknown until provider verification | Critical | Rotate, invalidate, inspect access logs, enable scanning | Open/blocker |
| Local backup disclosure | Medium | Critical | Encrypt/vault, restrict ACLs, minimize extracted copies | Open/blocker |
| Restore or rollback fails during incident | Medium | Critical | Non-production restore and rollback drills | Open/blocker |
| Private deployed workflows differ from tested contracts | Medium | High | Authenticated staging/production smoke | Open/blocker |
| Partial upload leaves sensitive orphan objects | Medium | High | Compensation and orphan reconciliation | Open |
| Production degradation is not alerted | High | High | External monitoring, alert rules, owners | Open |
| Health endpoint hangs on dependency stall | Low-Medium | High | Per-dependency timeout and tests | Open |
| Public abuse limits reset or split across processes | Medium | Medium | Shared rate-limit store or WAF | Open |
| Malformed content passes declared MIME validation | Low-Medium | Medium | Magic-byte/structure validation and scanning | Open |
| Installed PWA retains stale immutable assets | Medium | Low-Medium | Cache-version discipline | Open |

## Go / No-Go recommendation

**NO-GO**

The audited code and CI are healthy, and the public deployment is available.
However, a public historical DB credential exposure has no demonstrated rotation.
Backups are not encrypted and restore/rollback capability is not proven.
Core authenticated, Storage, email, cookie, IDOR, and log checks lack deployed evidence.
Launch ownership and incident response are not formally assigned.
GO can be reconsidered only after all four launch blockers have sanitized closure evidence.

## Suggested next PRs

1. `ops(security): close historical database credential exposure`
2. `ops(recovery): encrypt backups and record restore rollback evidence`
3. `test(production): record authenticated critical-flow smoke evidence`
4. `fix(storage): compensate failed persistence and reconcile orphan objects`
5. `fix(ops): bound health checks and normalize response headers`
6. `ops(observability): add production alerts and incident ownership`
7. `fix(pwa): version precache with immutable asset changes`

## What remains for 99-100%

- Sanitized proof that all historically exposed DB credentials were rotated and invalidated.
- Secret scanning and push protection enabled on the public repository.
- Fresh encrypted DB and Storage backups with restricted access and verified hashes.
- Successful non-production restore and rollback drills.
- Authenticated staging and production smoke for all critical roles and report workflows.
- Real email delivery verification or formal exclusion from the launch scope.
- Production log-redaction review and working external alerts.
- Storage compensation/orphan reconciliation and bounded health checks.
- Named launch/incident owners and signed GO approval.

## Out of scope

- SEO.
- Redesign.
- Features.
- Migrations.
- New providers.

## Appendix: commands run

| Command/check | Result |
|---|---|
| `git checkout main`, `git pull --ff-only`, `git fetch --prune` | Passed; base matched expected HEAD |
| `gh pr list --state open` | No open PRs |
| `git branch -r --no-merged origin/main` | No unmerged remote branches |
| `git switch -c audit/production-final-launch-readiness-gap-review` | Passed |
| Mandatory `rg` operational inventory | Completed |
| Documentation, workflows, packages, readiness script, and public-surface script review | Completed |
| `pnpm audit --prod` | Passed; no known vulnerabilities |
| `pnpm typecheck` | Passed |
| `pnpm typecheck:test` | Passed |
| `pnpm test` | 2697 passed, 0 failed, 0 skipped |
| `pnpm build` | Passed |
| `pnpm --dir frontend lint` | Passed |
| `pnpm --dir frontend typecheck` | Passed |
| `pnpm --dir frontend build` | Passed |
| `pnpm security:public-surface` | Passed; zero public findings |
| `pnpm --dir frontend e2e dashboard-auth-redirect.spec.ts visual-smoke.spec.ts --project=chromium --workers=1` | 12 passed |
| `node scripts/ops/verify-production-readiness.mjs --url https://api.vetneb.com.ar` | Passed |
| Public GET checks for API/frontend/PWA routes | Passed |
| Safe GET CORS checks for apex, `www`, and invalid origin | Approved origins allowed; invalid origin not allowed |
| GitHub Actions inspection for PR #989 and audited `main` HEAD | Backend and Frontend CI successful |
| Targeted tracked/history secret scan | Historical DB credential exposure found; no current env secret file found |
| GitHub repository security settings inspection | Secret scanning, push protection, validity checks, and Dependabot security updates disabled |
| Local backup metadata/ACL inspection | Unencrypted sensitive artifacts and broad local ACLs confirmed |

Prohibited release actions were not executed: `git add`, `git commit`, `git push`, `gh pr create`, `gh pr checks --watch`, and merge.
