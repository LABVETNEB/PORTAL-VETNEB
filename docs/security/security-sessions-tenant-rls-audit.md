# Security sessions, tenant isolation and RLS audit — PR-S1

## 1. Estado

Auditoría documental enfocada de seguridad para sesiones, aislamiento tenant y
RLS/enforcement de ownership en Portal VETNEB.

Resultado: **NO-GO operativo para considerar cerrado el bloque de seguridad
productiva** hasta completar evidencia runtime/staging sanitizada para sesiones
reales cruzadas, smokes post-deploy y revisión de logs sin secretos.

Esta auditoría no modifica backend, API, auth, base de datos, migraciones,
tests, CI ni dependencias. Su objetivo es consolidar el estado actual y fijar
guardrails para PRs posteriores.

## 2. Scope de PR-S1

Incluido:

- Inventario documental de seguridad vigente.
- Revisión de sesiones por superficie.
- Revisión de aislamiento tenant/resource ownership.
- Revisión documental de RLS/enforcement equivalente.
- Clasificación de gaps y PRs posteriores recomendados.

Excluido:

- Cambios de auth.
- Cambios de cookies.
- Cambios de middleware.
- Cambios de endpoints.
- Cambios de DB, schema, Drizzle o migraciones.
- Cambios de tests.
- Cambios de CI.
- Validaciones contra producción con credenciales reales.

## 3. Fuentes de verdad revisadas

| Fuente | Rol |
|---|---|
| `docs/SOURCES_OF_TRUTH.md` | Declara PR-S1 como auditoría docs-only enfocada de seguridad, sesiones, tenant isolation y RLS |
| `docs/security/RBAC_MATRIX.md` | Define actores, mecanismos de auth, scope obligatorio y gaps conocidos |
| `docs/security/ENDPOINT_PERMISSION_MATRIX.md` | Mapea endpoints críticos, actores permitidos, auth, tenant scope, respuestas y evidencia requerida |
| `docs/security/ENDPOINT_TEST_MATRIX.md` | Mapea superficies críticas, guardrails existentes, test faltante y smoke runtime requerido |
| `docs/security/csp-reporting-rollout.md` | Documenta CSP reporting y límites de alcance de seguridad frontend |
| `docs/governance/pr-readiness-review-checklist.md` | Checklist previo a PR y merge |
| `docs/qa/regression-strategy.md` | Selección de validaciones por riesgo |
| `docs/release/release-go-no-go-policy.md` | Criterios go/no-go para cambios productivos |

## 4. Modelo de sesiones auditado documentalmente

| Superficie | Actor | Cookie esperada | Scope runtime | Riesgo principal |
|---|---|---|---|---|
| Clínica | `clinic_owner` / `clinic_staff` | `app_session_id` | `auth.clinicId` | Lectura o mutación cross-tenant |
| Admin | Usuario administrativo | `admin_session_id` | Admin global con ownership checks explícitos | Bypass de ownership o mutación sin trazabilidad |
| Particular | Token particular autenticado | `particular_session_id` | `particularTokenId` + `clinicId` asociado | Acceso a reporte ajeno o disclosure de metadata |
| Public report token | Visitante con token público | Token en path | `tokenHash` -> reporte específico | Reuso, expiración omitida o signed URL leak |
| Public anonymous | Visitante sin sesión | N/A | Público | Abuso de endpoints públicos o enumeración |

Invariantes:

- No mezclar `admin_session_id`, `app_session_id` y `particular_session_id`.
- No usar `localStorage` ni `sessionStorage` como fuente de auth.
- No convertir `401`/`403` en éxito silencioso.
- No exponer tokens completos, hashes, cookies, signed URLs ni secretos.
- Toda mutación cookie-auth debe mantener trusted-origin/CSRF boundary.
- Logout debe invalidar la sesión esperada para su superficie.

## 5. Tenant isolation / ownership audit

### 5.1 Estado documental actual

Las matrices existentes declaran tenant isolation como principio obligatorio:

- deny by default
- tenant isolation
- no cross-tenant reads
- no cross-tenant writes
- no signed URL leak
- no cookie/token disclosure
- public/particular tokens limitados a report/resource scope

### 5.2 Superficies tenant críticas

| Superficie | Scope obligatorio | Evidencia existente | Gap abierto |
|---|---|---|---|
| Clinic reports | `auth.clinicId` | Tests de reportes y contratos cross-tenant | Falta evidencia runtime clinic A/B |
| Signed/download URLs | `clinicId`, `particularTokenId` o `tokenHash` | Tests de response disclosure y public/particular access | Falta evidencia runtime sin filtrar URL completa |
| Particular tokens | `auth.clinicId` + token/resource ownership | Tests de tokens y mutation permission surface | Falta smoke runtime con tenant aislado |
| Audit logs | Admin global, clinic por `clinicId`, particular por `particularTokenId` | Tests admin/clinic/particular audit | Falta export/runtime sanitizado |
| Workflow/status | `clinicId` o validación admin por recurso | Tests de status/workflow/resource ownership | Falta smoke con reporte ajeno |
| Storage/avatar/logo | Prefijo storage por `clinicId` | Tests de storage boundaries | Falta evidencia staging bucket/prefix |

## 6. RLS / enforcement audit

### 6.1 Hallazgo

No se encontró un documento dedicado en `docs/security/*` que describa
explícitamente el estado de RLS o una matriz tabla-a-tabla de enforcement de
ownership.

Esto no prueba ausencia de protección en runtime. El estado documental actual
muestra que el enforcement se expresa principalmente como:

- auth helpers por superficie;
- cookies separadas por dominio de auth;
- filtros por `auth.clinicId`, `clinicId`, `particularTokenId` o `tokenHash`;
- tests de IDOR, ownership, permission surface y response disclosure;
- matrices endpoint/recurso con evidencia runtime pendiente.

### 6.2 Riesgo

Sin una matriz RLS/enforcement dedicada, existe riesgo de drift entre:

- endpoint permission matrix;
- queries reales;
- helper de auth usado;
- tabla/recurso protegido;
- evidencia runtime/staging;
- decisión release go/no-go.

### 6.3 Criterio de cierre recomendado

Para cerrar el bloque RLS/enforcement en un PR posterior, documentar por tabla o
familia de recurso:

| Recurso | Tabla/familia | Enforcement esperado | Ruta crítica | Test existente | Evidencia runtime |
|---|---|---|---|---|---|
| Reports | reportes / storage asociado | `reportId` + `clinicId` o token válido | report read/download/status | ownership/IDOR tests | clinic A/B staging |
| Report access tokens | tokens de informe | token hash + clinic/report match | public/clinic/admin token routes | token lifecycle tests | token válido/revocado/expirado |
| Particular tokens | particular token + report link | `particularTokenId` + `clinicId` | particular auth/report routes | particular/token tests | token particular controlado |
| Audit log | audit events | actor scope + tenant filter | admin/clinic/particular audit routes | audit tests | export sanitizado |
| Clinic profile/storage | clinic profile/avatar | `auth.clinicId` + prefix storage | clinic profile/avatar routes | storage boundary tests | bucket/prefix staging |

## 7. Runtime/staging evidence gaps

Los documentos actuales mantienen estado abierto por falta de evidencia
runtime/staging en las áreas siguientes:

| Gap | Riesgo | Evidencia requerida | Estado |
|---|---|---|---|
| Sesiones reales clinic A/B | IDOR no detectado por unit/integration tests | Requests/responses sanitizados con 403/404/410 esperados | Abierto |
| Smoke cross-tenant post-deploy | Regresión RBAC en release | Run de smoke staging y producción firmado | Abierto |
| Logs sin signed URLs/cookies | Exposición de datos sensibles | Extracto sanitizado con timestamp/responsable | Abierto |
| Endpoint drift | Endpoint nuevo sin matriz/security owner | Diff revisado entre rutas, matrices y tests | Abierto |
| Logout/idempotencia por superficie | Sesiones persistentes tras logout | Smoke login/me/logout/me por clinic/admin/particular | Abierto |
| CORS/cookies reales | Cookies inseguras o origen indebido aceptado | Validación browser/runtime con cookie flags | Abierto |
| RLS/enforcement documental | Drift tabla-query-endpoint | Matriz tabla/recurso con enforcement y evidencia | Abierto |

## 8. NO-GO conditions

Mantener decisión **NO-GO** para declarar cerrado el bloque de seguridad si se
cumple cualquiera de estas condiciones:

- endpoint crítico sin actor permitido definido;
- endpoint crítico sin auth/scope esperado;
- endpoint crítico sin test/guardrail asociado;
- ruta cookie-auth mutante sin trusted-origin/CSRF boundary;
- signed URL o token completo en logs, UI o documentación;
- diferencia observable que permita enumerar recurso ajeno;
- sesión admin/clinic/particular mezclada o reutilizada entre superficies;
- evidencia runtime/staging pendiente para cross-tenant crítico;
- RLS/enforcement no documentado para recurso crítico nuevo.

## 9. PRs posteriores recomendados

| PR | Tipo | Objetivo | Scope esperado |
|---|---|---|---|
| PR-S2 | docs-only | Matriz RLS/enforcement por tabla/familia de recurso | `docs/security/*` |
| PR-S3 | docs-only o scripts-only | Runbook de smoke cross-tenant con evidencia sanitizada | `docs/ops/*` o scripts smoke si se aprueba explícitamente |
| PR-S4 | tests-only | Guardrail de drift entre rutas críticas y matrices security | `test/security-*` |
| PR-S5 | docs-only | Checklist de evidencia runtime/staging para release security | `docs/release/*` o `docs/security/*` |
| PR-S6 | implementation-only si aplica | Fix puntual detectado por evidencia runtime | Scope mínimo según hallazgo |

## 10. Recomendación final

No implementar cambios de auth/API/DB dentro de PR-S1.

Cerrar PR-S1 solo como consolidación documental de estado y riesgos. Los
siguientes pasos deben dividirse en PRs pequeños, empezando por matriz
RLS/enforcement docs-only y luego evidencia runtime/staging controlada.

Antes de cualquier cambio productivo de seguridad, aplicar:

- `docs/governance/pr-readiness-review-checklist.md`;
- `docs/qa/regression-strategy.md`;
- `docs/release/release-go-no-go-policy.md`;
- `docs/ops/BACKUP_RESTORE_ROLLBACK.md`.
