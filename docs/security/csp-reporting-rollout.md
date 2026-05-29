# CSP reporting rollout — Portal VETNEB

## 1. Scope

This document is documentation-only. It does not add schema, routes,
migrations, dependencies, middleware, layout changes or runtime behavior.
It records the operative state of CSP reporting as of PRs #748–#753 and
the conditions required before any future promotion to enforcement.

## 2. Current state

| Attribute | Value |
|---|---|
| CSP mode | `Content-Security-Policy-Report-Only` |
| Enforcing CSP | **absent — intentional** |
| Report sink | `/api/security/csp-report` |
| `report-uri` | always present (same-origin fallback, browser-compatible) |
| `report-to` | only when `NEXT_PUBLIC_SITE_URL` resolves to a trusted canonical HTTPS origin |
| `Reporting-Endpoints` | only when `NEXT_PUBLIC_SITE_URL` resolves to a trusted canonical HTTPS origin |
| HSTS preload | **absent — intentional** |
| Nonce runtime global | **absent — intentional** |

Report-Only mode collects violation reports without blocking any resource.
No request is rejected. No user session is disrupted.

## 3. Headers emitted per environment

### Without `NEXT_PUBLIC_SITE_URL` (or with an unsafe value)

```
Content-Security-Policy-Report-Only: default-src 'self'; ...; report-uri /api/security/csp-report
```

`report-to` and `Reporting-Endpoints` are **not emitted**.

### With a trusted canonical `NEXT_PUBLIC_SITE_URL` (e.g. `https://portal.vetneb.com`)

```
Reporting-Endpoints: csp-endpoint="https://portal.vetneb.com/api/security/csp-report"
Content-Security-Policy-Report-Only: default-src 'self'; ...; report-uri /api/security/csp-report; report-to csp-endpoint
```

Both `report-uri` and `report-to` are emitted so older browsers (report-uri)
and modern browsers (Reporting API v1 via report-to) are covered.

## 4. What makes a canonical trusted origin

`NEXT_PUBLIC_SITE_URL` is accepted only if all of the following hold:

- Protocol is `https:`.
- Hostname is non-empty and not a loopback address (`localhost`, `127.*`, `0.0.0.0`, `::1`).
- No credentials (`user:pass@`).
- Path is `/` or empty (no path, query, or fragment beyond the root).

Any value that fails validation silently falls back to report-uri-only mode.
No error is thrown. No Reporting-Endpoints header is emitted.

Source: `frontend/src/lib/security/csp-policy.ts` → `resolveCanonicalReportingOrigin()`.

## 5. Relevant env variable

| Variable | Required | Effect |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | No | When set to a canonical HTTPS root origin, enables `report-to` and `Reporting-Endpoints`. Omitting or setting an unsafe value keeps report-uri-only mode. |

Do not set `NEXT_PUBLIC_SITE_URL` to a local or development URL. The guard
will reject it and the behavior is identical to the unset case.

## 6. Intentional absences

### No enforcing `Content-Security-Policy`

The `Content-Security-Policy` (enforcing) header is not emitted.
Report-Only mode is the deliberate first step: collect data, validate
no legitimate resources are blocked, then promote to enforcement in a
dedicated PR with evidence.

### No HSTS preload

`Strict-Transport-Security` uses `max-age=63072000; includeSubDomains`
(production-only). The `preload` directive is absent. HSTS preload
submission requires a separate explicit decision with domain-level commitment.

### No nonce runtime global

The CSP builder supports nonce injection (`buildReportOnlyCsp({ nonce })`)
but no runtime nonce is generated globally. Activating a nonce requires a
dedicated middleware change, per-request nonce generation, and propagation
to all inline scripts and styles — a separate PR.

## 7. Source of truth

| Concern | File |
|---|---|
| CSP policy builder | `frontend/src/lib/security/csp-policy.ts` |
| Security header assembly | `frontend/next.config.ts` → `buildSecurityHeaders()` |
| CSP report endpoint | `frontend/src/app/api/security/csp-report/route.ts` |
| Smoke contract | `test/frontend-csp-report-uri-contract.test.ts` (tests 13–15) |
| Builder contract | `test/frontend-csp-policy-builder-contract.test.ts` |
| Payload contract | `test/frontend-csp-report-endpoint-contract.test.ts` |
| Production path invariants | `test/security-production-invariants.test.ts` |

## 8. Local validation

Run from `C:\PORTAL-VETNEB` (Terminal 1):

```powershell
pnpm security:public-surface   # must output: PASS security/public-surface
pnpm test                      # must not introduce new failures
pnpm build
pnpm -C frontend typecheck
```

The smoke contract tests (`smoke(no siteUrl)`, `smoke(secure siteUrl)`,
`smoke(insecure siteUrl)`) in `test/frontend-csp-report-uri-contract.test.ts`
cover the three `NEXT_PUBLIC_SITE_URL` scenarios without booting Next.js.

## 9. Expected signals before promoting to enforcement

Do not open a `Content-Security-Policy` enforcement PR until all of the
following conditions are met:

- [ ] Report-Only has been active in production for a minimum observed period (recommended: ≥ 2 weeks).
- [ ] CSP violation reports collected at `/api/security/csp-report` show no violations from legitimate first-party resources.
- [ ] All legitimate inline scripts and styles are either removed or covered by a nonce or hash (requires nonce PR first).
- [ ] `frame-src` and `connect-src` allowlists are confirmed accurate for all production integrations (Google Maps, etc.).
- [ ] A rollback plan for the enforcement PR is documented and tested.
- [ ] `pnpm security:public-surface` passes.
- [ ] All CSP contract tests pass.

Promoting to enforcement while violations from legitimate resources exist
will break the application for real users. Report-Only + violation analysis
is the mandatory gate.

## 10. Rollback

### Disable `report-to` / `Reporting-Endpoints` without losing `report-uri`

Unset or clear `NEXT_PUBLIC_SITE_URL` in the production environment.
The guard will reject the empty/unsafe value and fall back to report-uri-only
mode automatically. No code change is required.

### Disable all CSP reporting

Remove or comment out the `Content-Security-Policy-Report-Only` block in
`frontend/next.config.ts` → `buildSecurityHeaders()`. Requires a deploy.

### Disable the report endpoint

Remove or guard `frontend/src/app/api/security/csp-report/route.ts`.
Reports sent by browsers will receive 404 (browsers ignore report delivery
failures). No user-facing impact.

## 11. Out of scope for this document

- Enabling `Content-Security-Policy` enforcement (separate PR, after evidence).
- Activating nonce runtime global (separate PR).
- Adding HSTS preload (separate explicit decision).
- Configuring CSP violation alert thresholds or rate limits on the report endpoint.
- Defining report retention policy.
- Any migration, schema, dependency, UI, or auth change.
