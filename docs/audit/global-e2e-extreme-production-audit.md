# Global E2E extreme production audit

Fecha: 2026-06-03
Rama: `audit/global-e2e-extreme-production-readiness`
Scope: G1 a G6 en un bloque de auditoria contractual, sin cambios de schema, migraciones, indices, WebAuthn, redisenos ni configuracion productiva innecesaria.

## Executive summary

Se audito la superficie web y backend de Portal Vetneb con foco en seguridad publica, auth, formularios/uploads, storage/signed URLs, performance/resiliencia y accesibilidad/mobile/UX critica.

El estado observado ya tenia una base fuerte: Fastify centraliza `X-Request-ID`, headers API, trusted-origin, no-store en APIs sensibles y sanitizacion de errores; el frontend mantiene headers de seguridad en `next.config.ts`; y la suite existente cubre cookies, CORS, rate limits, storage privado, errores sin secretos, errores sin stack traces, paginacion y boundaries de roles.

La accion aplicada en este PR es tests/docs only. Se agregaron guardrails globales para unir esas coberturas por G1-G6 y evitar regresiones entre familias de rutas. No se aplicaron cambios productivos porque la auditoria no encontro una falla real que exigiera ajuste de backend o frontend dentro del scope minimo permitido.

## Audited surfaces

- Backend app: `server/fastify-app.ts`
- Backend routes: `server/routes/*.fastify.ts`
- Backend middlewares: `server/middlewares/auth.ts`, `server/middlewares/admin-auth.ts`, `server/middlewares/particular-auth.ts`, `server/middlewares/trusted-origin.ts`, `server/middlewares/error-handler.ts`, `server/middlewares/request-logger.ts`
- Backend libs: `server/lib/api-request-id.ts`, `server/lib/api-response-security.ts`, `server/lib/sensitive-response-cache.ts`, `server/lib/supabase.ts`, `server/lib/report-access-token.ts`, `server/lib/list-pagination.ts`, rate-limit helpers, auth/security helpers
- DB access modules: `server/db*.ts`
- Frontend app: `frontend/src/app`, `frontend/src/components`, `frontend/src/lib`, `frontend/src/middleware.ts`
- Frontend config: `frontend/next.config.ts`, `frontend/playwright.config.ts`, `frontend/package.json`
- Security scripts: `scripts/security/audit-public-devtools-surface.mjs`
- Existing tests: `test/**/*.test.ts`
- Existing docs: `docs/security`, `docs/audit`, `docs/pr-817` through `docs/pr-825`, `docs/pr-history`

## Route inventory

| Surface | Runtime registration | Classification | Notes |
| --- | --- | --- | --- |
| `/`, `/health`, `/api/health` | `server/fastify-app.ts` | public/internal health | Public service and health responses keep JSON behavior through Fastify. |
| `/api/public/professionals` | `public-professionals.fastify.ts` | public | Search/detail with fixed-window public rate limits and CORS allowlist. |
| `/api/public/pricing` | `public-pricing.fastify.ts` | public | Cached public pricing snapshot with public cache headers. |
| `/api/public/report-access/:token` | `public-report-access.fastify.ts` | public token | Raw token validation, rate limit, token lifecycle, lazy signed URLs, audit. |
| `/api/contact` | `contact.fastify.ts` | public mutation | Contact payload validation and safe transport handling. |
| `/api/auth` | `auth.fastify.ts` | clinic auth | Clinic login/me/logout plus session cookie contract. |
| `/api/admin/*` | `admin-*.fastify.ts` | admin | Admin auth, reports, tokens, audit, sessions, maintenance, health, pricing, users/roles. |
| `/api/clinic/*` | `clinic-*.fastify.ts` | clinic | Clinic audit/profile management with clinic session and permission boundaries. |
| `/api/reports`, `/api/report-access-tokens`, `/api/particular-tokens`, `/api/study-tracking` | route-specific Fastify modules | clinic | Clinic scoped reads/writes with owner checks, pagination, signed URL laziness and audit. |
| `/api/particular/*` | `particular-*.fastify.ts` | particular | Particular token session, report URL access, study tracking and audit. |
| `/api/logistics/*` | logistics Fastify modules | clinic | Clinic logistics with role permissions and bounded list helpers. |
| `/dashboard/*` | `frontend/src/middleware.ts` | frontend protected | Clinic dashboard redirects to login; admin dashboard hides as 404 without admin cookie. |
| public pages | `frontend/src/app/*` | public web | SEO/metadata, public layout, contact, professionals, pricing and service pages. |

## Risk matrix

| Surface | Routes/pattern | Classification | Risk | Severity | Existing coverage | Gap | Action in this PR | Future PR if out of scope |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Public pages and bundle | `frontend/src/app`, `.next/static`, public layout | public | Secret marker, debug leak, source-map or unsafe HTML exposure | high | `frontend-public-devtools-exposure-contract`, security auditor script | Global G1 link to backend route evidence was implicit | Added `global-public-surface-hardening-contract` and G1 registry | Add browser e2e production smoke against deployed build if needed |
| Public API headers | `/api/public/*`, `/api/health` | public | Missing nosniff/referrer or accidental session cookie | medium | API header tests, public route tests | Cross-route public API assertion was fragmented | Added runtime checks for public pricing/professionals/report-access | Add CDN/header staging evidence |
| Admin auth | `/api/admin/*` | admin | Admin route accidentally accepts wrong cookie or misses auth | critical | session/cross-auth boundary suites | Global PR-level auth registry was implicit | Added `global-auth-boundary-contract` | Add staging auth smoke with real admin account |
| Clinic auth | `/api/reports`, `/api/study-tracking`, logistics, clinic profile | clinic | Cross-clinic IDOR, permission bypass, unsafe mutation origin | critical | IDOR, mutation permission, trusted-origin, cookie boundaries | Route-family inventory needed one global guardrail | Added G2 auth registry | Add negative staging smoke for selected clinic pairs |
| Particular token auth | `/api/particular/*` | particular | Token session reuse or wrong cookie domain | high | particular auth/session tests, cross-auth tests | Global registry across particular routes was implicit | Added G2 auth registry | Add token rotation lifecycle audit later |
| Contact form | `/api/contact` | public mutation | Invalid payload, secret leak in errors, email failure handling | medium | contact-route and email-safe tests | Global G3 mapping was doc-only | Added G3 inventory in readiness contract | Add external mail provider staging failure drill |
| Uploads | `/api/admin/reports/upload`, clinic avatar upload | admin/clinic | Size limit, MIME bypass, path traversal, storage overwrite | high | multer/file size tests, supabase upload tests | Storage safety scattered across suites | Added `global-storage-report-safety-contract` anchors | Add malware scanning or content sniffing in future PR |
| Storage paths | reports and avatars in Supabase bucket | internal | Private `storagePath` exposure in JSON | critical | serializers, storage suite, public report tests | Need global lazy signing assertion | Added runtime serializer/list/public access checks | Add periodic object ACL audit |
| Signed URLs | preview/download endpoints | clinic/admin/particular/public token | Mass URL generation or stale TTL | high | signed URL tests, lazy signed URL PR history | Cross-surface lazy behavior needed one contract | Added storage report safety test | Add signed URL TTL observability |
| Access tokens | report access and particular tokens | clinic/admin/particular/public token | Raw token leakage, tokenHash leak, lifecycle bypass | critical | lifecycle, redaction, token route tests | Global G4 docs and runtime invalid-token check missing | Added invalid-token and valid public-access runtime checks | Add token replay telemetry |
| Heavy admin lists | admin clinics/sessions/audit/tokens/users | admin | Unbounded reads or massive exports | high | pagination contract, admin list tests | Need global G5 registry of DB surfaces | Added performance/resilience contract | Add query latency budget tests with seeded DB |
| Public rate limits | professionals and report access | public | Enumeration and availability degradation | medium | public rate-limit tests | Global isolation link was implicit | Added G5 registry and public invalid-token cut-off | Add external WAF/rate-limit staging evidence |
| Error responses | all API | all | Stack traces, secrets, missing requestId | high | API error no-stack/no-secret/content-type/request-id tests | No new runtime gap | Referenced in global contracts/docs | Keep expanding on new route families |
| Logging/audit | request logger and audit logs | all | Token/query leak in logs | high | sensitive log redaction boundaries | No new runtime gap | Referenced in G4/G5 contracts | Add log sink sampling in staging |
| Mobile/dashboard UX | `/dashboard`, public responsive pages | public/clinic/admin | Broken auth redirect/hide, invalid nesting, mobile layout regressions | medium | frontend mobile/public semantics tests | Global G6 readiness link was implicit | Added G6 registry | Add Playwright mobile smoke for authenticated dashboard |
| Frontend middleware | `/dashboard/:path*` | frontend protected | Admin dashboard discovery without admin cookie | medium | frontend middleware tests | Covered, but not linked to G6 matrix | Added auth/readiness registry anchor | Add route-level screenshot evidence |

## Findings corrected

- No backend/frontend production defect was corrected in this PR.
- No product source file was changed.
- No DB schema, migration, index, WebAuthn, UI redesign, productive config or dependency was changed.

## Accepted and documented findings

- Public professionals intentionally signs avatar URLs during public serialization. This is accepted as an existing public profile behavior and remains bounded by route rate limits; it is not the report signed URL lazy contract.
- Public pricing intentionally uses public cache headers instead of `no-store`.
- `/api/public/report-access/:token` intentionally exposes signed preview/download URLs only after token validation, lifecycle checks and access recording.
- Frontend admin dashboard without admin cookie intentionally returns 404 instead of redirecting, reducing route discovery.
- Staging/deployed evidence is out of this local PR scope and remains documented as future operational validation.

## Guardrails added

- `test/global-e2e-production-readiness-contract.test.ts`
  - G1-G6 registry tying runtime files, existing guardrails, docs and validation scripts.
- `test/global-public-surface-hardening-contract.test.ts`
  - Runtime public API checks for headers, no session cookies, no public body leaks, public professionals storage path hiding and invalid report-token cut-off.
- `test/architecture/security/global-auth-boundary-contract.test.ts`
  - Route-family auth registry for admin, clinic, particular and public surfaces.
- `test/global-storage-report-safety-contract.test.ts`
  - Runtime checks for safe report serialization, bounded report list with no eager signed URLs and public report access without `storagePath` or `tokenHash`.
- `test/global-performance-resilience-contract.test.ts`
  - Global pagination clamps, heavy-surface markers, sensitive no-store boundaries, request-id/security/logging wiring and validation scripts.

## Validation evidence

Commands required for this PR:

- `pnpm test` - passed, 2240 passed, 1 skipped, 0 failed.
- `pnpm build` - passed, backend bundle generated successfully.
- `pnpm security:public-surface` - passed, no public exposure findings. The auditor reported the documented server-only cookie-name identifiers in `frontend/src/middleware.ts`.
- `pnpm typecheck` - passed.
- `pnpm typecheck:test` - passed.
- `git diff --check` - passed.

The local validation run was completed on 2026-06-03.

## Prioritized recommendations

1. Keep the new global guardrails as the PR-level map and continue putting detailed route behavior in focused route tests.
2. Add staging evidence for auth boundaries, public headers and no-leak behavior once a stable staging environment is available.
3. Add latency/query-budget tests with seeded DB only in a future performance PR, because that exceeds this tests/docs-only scope.
4. Add operational storage ACL review outside the app test suite, because object-store permission drift is environment-level.
5. Keep signed URL generation lazy for report files; if a future UI needs mass previews, require explicit pagination and audit evidence first.
