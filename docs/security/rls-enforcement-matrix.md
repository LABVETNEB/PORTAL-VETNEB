# RLS / enforcement matrix — Portal VETNEB

## 1. Estado

Matriz documental de enforcement por tabla/familia de recurso para Portal
VETNEB.

Esta matriz nace como seguimiento de `docs/security/security-sessions-tenant-rls-audit.md`
y cubre el gap PR-S2: documentar por tabla/recurso cuál es el boundary esperado,
qué helper/ruta debe hacer cumplir ownership, qué test lo cubre y qué evidencia
runtime/staging falta.

Resultado actual: **NO-GO para considerar cerrado el bloque RLS/enforcement**
hasta completar evidencia runtime/staging sanitizada en los recursos críticos.

## 2. Alcance

Incluido:

- Tabla/familia de recurso.
- Boundary esperado.
- Enforcement esperado.
- Superficie/ruta crítica.
- Test o guardrail existente.
- Evidencia runtime/staging requerida.
- Estado documental.

Excluido:

- Cambios de DB.
- Cambios de RLS nativo en PostgreSQL/Supabase.
- Cambios de Drizzle schema o migraciones.
- Cambios de backend/API/auth.
- Cambios de tests.
- Cambios de CI.
- Validación con credenciales reales.

## 3. Interpretación de RLS en esta matriz

En este proyecto, este documento usa **RLS/enforcement** en sentido amplio:

- RLS nativo de base de datos si existiera o se agregara en el futuro.
- Enforcement equivalente en aplicación mediante helpers de auth, filtros por
  `clinicId`, `reportId`, `particularTokenId`, `tokenHash`, ownership checks y
  respuestas sin disclosure.
- Guardrails de test que impiden drift en ownership, IDOR, permisos y disclosure.

Esta matriz **no afirma** que exista RLS nativo activo en PostgreSQL/Supabase.
Cuando el enforcement sea application-level, se declara explícitamente como tal.

## 4. Principios obligatorios

- deny by default;
- no cross-tenant reads;
- no cross-tenant writes;
- no signed URL leak;
- no cookie/token/hash disclosure;
- no diferencia observable que permita enumerar recurso ajeno;
- admin global solo puede operar recursos con validación explícita y auditoría;
- particular/public token siempre queda limitado a su recurso vinculado;
- toda ruta cookie-auth mutante mantiene trusted-origin/CSRF boundary.

## 5. Matriz tabla/recurso

| Recurso | Tabla/familia | Boundary esperado | Enforcement esperado | Superficie crítica | Test/guardrail existente | Evidencia runtime requerida | Estado |
|---|---|---|---|---|---|---|---|
| Clinic identity | `clinics`, `clinic_users` | `clinic_users.clinic_id` -> `clinics.id` | Login clínica resuelve sesión a usuario y `auth.clinicId`; roles `clinic_owner` / `clinic_staff` no pueden cruzar tenant | `/api/auth/*`, `/api/clinic/*`, dashboard clínica | `test/auth.fastify.test.ts`, `test/clinic-permissions-middleware.test.ts`, `test/security-cross-auth-surface-boundaries.test.ts` | Smoke login/me/logout con clinic A/B y cookie flags | Abierto - pendiente runtime/staging |
| Admin identity | `admin_users`, `admin_sessions` | sesión admin separada | Admin usa `admin_session_id`; no comparte cookie ni helpers con clínica/particular | `/api/admin/auth/*`, `/api/admin/*` | `test/admin-auth.fastify.test.ts`, `test/admin-auth-middleware.test.ts`, `test/security-session-cookie-boundaries.test.ts` | Smoke admin login/me/logout con cookie flags | Abierto - pendiente runtime/staging |
| Clinic sessions | `active_sessions` | `token_hash` -> clinic user | Cookie `app_session_id`; hash server-side; logout invalida sesión de superficie clínica | `/api/auth/me`, `/api/auth/logout` | `test/auth-session-boundaries.test.ts`, `test/auth-cookie-persistence-contract.test.ts`, `test/session-last-access.test.ts` | Browser/runtime con expiración, logout y `me => 401` | Abierto - pendiente runtime/staging |
| Admin sessions | `admin_sessions` | `token_hash` -> admin user | Cookie `admin_session_id`; hash server-side; request cache no debe cruzar requests | `/api/admin/auth/me`, `/api/admin/auth/logout`, sesiones admin | `test/admin-auth-session-last-access-contract.test.ts`, `test/admin-auth-request-cache.test.ts`, `test/admin-sessions.fastify.test.ts` | Smoke admin + revocación de sesión sanitizada | Abierto - pendiente runtime/staging |
| Particular sessions | `particular_sessions` | `token_hash` -> `particular_token_id` | Cookie `particular_session_id`; sesión particular no accede a rutas clinic/admin | `/api/particular/auth/*` | `test/particular-auth.fastify.test.ts`, `test/particular-auth-session-last-access-contract.test.ts`, `test/security-cross-auth-surface-boundaries.test.ts` | Smoke particular login/me/logout y bloqueo cross-surface | Abierto - pendiente runtime/staging |
| Reports | `reports` | `reports.clinic_id` | Lecturas y mutaciones clinic deben filtrar por `auth.clinicId`; admin debe validar recurso objetivo | `/api/reports`, `/api/reports/:reportId/*`, `/api/admin/reports/*` | `test/security-cross-tenant-idor-contract.test.ts`, `test/security-resource-ownership-boundaries.test.ts`, `test/reports-status-session-last-access-contract.test.ts` | Clinic A/B: reporte ajeno no enumerable; respuestas 403/404 sanitizadas | Abierto - pendiente runtime/staging |
| Report status history | `report_status_history` | `report_id` -> `reports.clinic_id` | Status/history deriva ownership del reporte; no aceptar `clinicId` del body como autoridad | `/api/reports/:reportId/status`, workflow admin | `test/security-mutation-permission-surface.test.ts`, `test/admin-report-workflow.fastify.test.ts`, `test/reports-status-session-last-access-contract.test.ts` | Smoke cambio estado con reporte propio y bloqueo ajeno | Abierto - pendiente runtime/staging |
| Report access tokens | `report_access_tokens` | `clinic_id` + `report_id` + `token_hash` | Tokens clinic/admin deben mantener match clinic/report; public lookup usa hash y no revela diferencias peligrosas | `/api/report-access-tokens`, `/api/admin/report-access-tokens`, `/api/public/report-access/:token` | `test/report-access-tokens.fastify.test.ts`, `test/admin-report-access-tokens.fastify.test.ts`, `test/public-report-access.fastify.test.ts`, `test/report-access-token-edge.test.ts` | Token válido, revocado, expirado y cross-clinic con evidencia sanitizada | Abierto - pendiente runtime/staging |
| Particular tokens | `particular_tokens` | `clinic_id` + `report_id` + `token_hash` | Clínica gestiona solo tokens propios; particular ve solo token/reporte vinculado; no password model | `/api/particular-tokens`, `/api/particular/auth/*` | `test/particular-tokens.fastify.test.ts`, `test/particular-token-edge.test.ts`, `test/frontend-particulares-access-contract.test.ts` | Smoke token particular propio/ajeno y reporte vinculado/no vinculado | Abierto - pendiente runtime/staging |
| Particular tracking | `study_tracking_cases`, `study_tracking_notifications` | `clinic_id`, `report_id`, `particular_token_id` | Tracking debe estar scoped por clínica o token particular; notificaciones no cruzan tenant | `/api/study-tracking*`, `/api/admin/study-tracking*`, particular tracking | `test/token-study-tracking.test.ts`, `test/particular-tokens-runtime-timing-contract.test.ts`, `test/admin-study-tracking-session-last-access-contract.test.ts` | Smoke tracking clinic A/B + particular token controlado | Abierto - pendiente runtime/staging |
| Audit log | `audit_log` | actor scope + `clinic_id` / `report_id` / token actor-target | Admin global; clínica filtrada por `clinicId`; particular filtrado por token asociado; export sin secretos | `/api/admin/audit-log`, `/api/clinic/audit-log`, `/api/particular/audit-log` | `test/admin-audit.fastify.test.ts`, `test/clinic-audit.fastify.test.ts`, `test/particular-audit.fastify.test.ts`, `test/security/audit-export-boundaries.test.ts` | Export sanitizado por actor y revisión de logs sin cookies/tokens/signed URLs | Abierto - pendiente runtime/staging |
| Clinic public profile | `clinic_public_profiles`, `clinic_public_search` | `clinic_id` | Escritura clinic solo sobre `auth.clinicId`; superficie pública solo lectura sanitizada | `/api/clinic/profile`, `/profesionales/[clinicId]`, búsqueda pública | `test/clinic-public-profile.fastify.test.ts`, `test/frontend-seo-public-surface-extreme.test.ts` | Smoke edición perfil propio y lectura pública sin datos privados | Abierto - pendiente runtime/staging |
| Clinic avatar / logo storage | storage path + profile avatar fields | prefijo/path asociado a `clinicId` | Upload/delete solo con `auth.clinicId`; no path traversal; no overwrite cross-tenant | clinic profile avatar endpoints/storage | `test/security-resource-ownership-boundaries.test.ts`, storage boundary tests si aplican | Smoke bucket/prefix staging con evidencia sanitizada | Abierto - pendiente runtime/staging |
| Admin clinic management | `clinics`, `clinic_users`, related tenant rows | admin global auditado | Admin puede crear/editar/desactivar tenant con auditoría; hard-delete debe limpiar recursos relacionados sin filtrar mal | `/api/admin/clinics`, `/api/admin/users-roles/*` | `test/admin-clinics-auth-contract.test.ts`, `test/logistics-rbac-permission-contract.test.ts`, `test/security-write-attribution-boundaries.test.ts` | Smoke admin con tenant de prueba y evidencia de auditoría | Abierto - pendiente runtime/staging |
| Workflow | report workflow columns/tables | `report_id` -> `reports.clinic_id` | Admin workflow valida informe objetivo; clínica no muta workflow global fuera de su recurso | `/api/admin/report-workflow/*`, report status routes | `test/admin-report-workflow.fastify.test.ts`, `test/frontend-admin-report-workflow.test.ts`, `test/security-resource-ownership-boundaries.test.ts` | Smoke workflow admin con reporte propio/ajeno controlado | Abierto - pendiente runtime/staging |
| Logistics | `field_visits`, `route_plans`, `route_events`, SLA tables | `clinic_id`, route/visit ownership | Operaciones logísticas se filtran por clínica salvo admin explícito; SLA clinic/global debe respetar `scope` | logistics routes / admin logistics surfaces si aplican | `test/logistics-rbac-permission-contract.test.ts`, runtime contracts relacionados | Smoke logística clinic A/B si la superficie queda habilitada | Abierto - pendiente runtime/staging |
| Pricing/public catalog | pricing tables / cache | público o admin según ruta | Público solo lee catálogo permitido; admin muta con sesión admin y trusted origin | `/api/public-pricing`, `/api/admin-pricing` | `test/security-mutation-permission-surface.test.ts`, public surface tests | Smoke público sin auth y admin mutation controlada | Abierto - pendiente runtime/staging |
| CSP report endpoint | CSP reporting payloads | sin auth, sin sesión | Endpoint de reporte no debe aceptar ni persistir secretos; no interrumpe sesión | `/api/security/csp-report` | `docs/security/csp-reporting-rollout.md`, security header tests | Revisión de reportes sanitizados antes de enforcement | Abierto - pendiente runtime/staging |

## 6. Checks de enforcement por recurso nuevo

Todo recurso crítico nuevo debe declarar antes de merge:

| Pregunta | Requisito |
|---|---|
| ¿Cuál es la tabla/familia protegida? | Nombre explícito en esta matriz o PR que la actualiza |
| ¿Cuál es el boundary? | `clinicId`, `reportId`, `particularTokenId`, `tokenHash`, admin scope o público |
| ¿Quién es el actor permitido? | Public, clinic, admin, particular o service internal |
| ¿Dónde se enforcea? | Helper de auth, query, middleware, route guard o RLS nativo |
| ¿Qué pasa sin auth? | `401`, público permitido o no aplica |
| ¿Qué pasa cross-tenant? | `403/404/410` sin disclosure o lista filtrada |
| ¿Qué test lo fija? | Unit/integration/security/e2e explícito |
| ¿Qué evidencia runtime falta? | Smoke staging/prod sanitizado con responsable |

## 7. NO-GO

Mantener **NO-GO** si:

- tabla/recurso crítico no aparece en esta matriz;
- ruta crítica no tiene actor y boundary definidos;
- enforcement depende de input cliente como autoridad de tenant;
- admin global omite ownership check en recurso sensible;
- signed URL, token, hash o cookie aparece en logs o UI;
- respuesta cross-tenant permite enumerar existencia de recurso;
- no existe test/guardrail asociado;
- evidencia runtime/staging crítica sigue pendiente para release productivo.

## 8. Próximos PRs recomendados

| PR | Tipo | Objetivo |
|---|---|---|
| PR-S3 | docs-only o scripts-only | Runbook/smoke cross-tenant con evidencia sanitizada |
| PR-S4 | tests-only | Guardrail de drift rutas críticas ↔ matrices security |
| PR-S5 | docs-only | Checklist release security evidence |
| PR-S6+ | implementation-only | Fix puntual si la evidencia runtime detecta bypass real |

## 9. Validación PR-S2

Validación esperada:

- `git diff --check`;
- scope check: solo `docs/security/rls-enforcement-matrix.md`;
- revisión manual contra `docs/security/security-sessions-tenant-rls-audit.md`;
- sin cambios en backend/API/auth/DB/migraciones/tests/CI.
