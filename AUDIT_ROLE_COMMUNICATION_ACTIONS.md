# Role Communication & Actions Audit

## Executive summary
- **Estado general:** El modelo de comunicación entre roles de Portal VETNEB es maduro, consistente y está apto para producción. Existen tres dominios de autenticación estrictamente separados (admin / clínica / particular), cada uno con su propia cookie, su propio contexto de request y enforcement real en backend. La superficie pública no expone endpoints privados.
- **Riesgo global:** **Bajo.** No se hallaron escaladas de privilegio verticales ni horizontales, ni IDOR explotables, ni leakage lateral entre clínicas. El backend filtra por `clinicId`/sesión en todas las rutas clinic-scoped verificadas; el admin bloquea auto-revocación; los errores 5xx se sanitizan; los secretos no se exponen.
- **Bloqueadores:** Ninguno para la comunicación entre roles.
- **Recomendación:** **Ship.** Se aplicó un fix seguro de accesibilidad (nombre accesible del botón de revocar sesión) y se documentan 1 hallazgo Medium y varios Low como PRs diferidos. Ninguno bloquea el release.

## Baseline
- **Commit:** `bfb10fd fix(public): prevent tablet navigation overflow (#978)`
- **Branch:** `audit/role-communication-actions` (creada desde `main` en paridad con `origin/main`).
- **PRs abiertos:** ninguno (`gh pr list --state open` vacío).
- **Ramas no mergeadas:** ninguna (`git branch -r --no-merged origin/main` vacío).
- **Validaciones base (todas verdes antes de tocar código):**
  - `pnpm audit --prod` → **No known vulnerabilities found**
  - `pnpm test` → **2657 pass / 0 fail**
  - `pnpm build` → OK (dist/index.js 859.8kb)
  - `pnpm security:public-surface` → **PASS** (sin exposición devtools pública)
  - `pnpm --dir frontend lint` → OK
  - `pnpm --dir frontend typecheck` → OK
  - `pnpm --dir frontend build` → OK

## Skills used
- `vetneb-briefing-planificacion-diseno-desarrollo-pruebas` — recorte de scope, criterios de aceptación, no-alcance.
- `vetneb-security-production-invariants` — invariantes de cookies/sesiones/roles, sanitización, PWA cache, auditoría.
- `vetneb-protocolos-comunicacion` — HTTP/CORS/cookies/credentials, contratos frontend↔backend, superficies críticas.
- `vetneb-admin-dashboard-operational-actions` — acciones reales del dashboard admin (clínicas, precios, sesiones, intentos fallidos, auditoría, system health).
- `vetneb-staff-senior-full-stack-engineer` — diagnóstico multi-capa, contrato mínimo, tests.
- `vetneb-bugs-errores-optimizacion-rutas` — clasificación de fallos de ruta/endpoint/cookie/CORS/estado UI.
- `vetneb-web-end-to-end-global` — alcance global público/clínica/particular/admin/API.

## Discovered role model

El sistema **no** define "logística" ni "profesional" como identidades separadas: "profesional/clínica" es el mismo dominio (`app_session_id`) y "logística" es un sub-área del dashboard clínica gobernada por permisos. El modelo real:

| Role | Evidence | Routes (frontend) | Capabilities | Restrictions |
|---|---|---|---|---|
| **Visitante público** | Sin cookie de sesión; `frontend/src/proxy.ts` solo protege `/dashboard/*` | `/`, `/servicios`, `/profesionales`, `/profesionales/[clinicId]`, `/clinicas`, `/particulares`, `/contacto`, `/precios`, `/login`, landings SEO, `/offline` | Leer contenido público, buscar profesionales, ver precios públicos, enviar contacto, canjear token público de informe/particular | No accede a `/dashboard/*`; no llega a `/api/admin/*`, `/api/reports/*`, `/api/clinic/*`, `/api/logistics/*` |
| **Particular** (tutor) | Cookie `particular_session_id` → `req.particularAuth {tokenId, clinicId, reportId}` (`server/middlewares/particular-auth.ts`) | `/particulares` (login + visor móvil de informe/seguimiento) | Ver su informe vinculado, preview/download de su informe, ver su seguimiento, su audit-log | Acotado a su `particularTokenId`; token debe estar `isActive`; no ve datos de otras clínicas/tutores |
| **Clínica — staff** (`clinic_staff`) | Cookie `app_session_id` → `req.auth {clinicId, role, permissions}`; `server/lib/permissions.ts` | `/dashboard`, `/dashboard/informes`, `/dashboard/logistica/*` | Ver informes de su clínica, ver logística/SLA (read), perfil público, tokens particulares de su clínica, audit-log de su clínica | `canViewLogistics`/`canViewLogisticsSla` solo; **no** gestiona usuarios, **no** muta logística, **no** sube informes |
| **Clínica — owner** (`clinic_owner`) | Igual + `getClinicPermissions` | Igual | Todo lo de staff + `canManageClinicUsers`, `canManageLogistics{FieldVisits,RoutePlans,RouteEvents}` | **No** sube informes (`canUploadReports=false` para ambos roles: la subida es admin-only) |
| **Admin** | Cookie `admin_session_id` → `req.adminAuth {id, username}` (`server/middlewares/admin-auth.ts`, `server/lib/fastify-admin-auth.ts`) | `/dashboard/admin` (+ submódulos) | Clínicas (CRUD), precios, sesiones (ver/revocar), intentos fallidos, auditoría, system health, schema health, maintenance dry-run, users-roles, report-workflow, study-tracking, particular-tokens, report-access-tokens, subida de informes | No puede revocar su propia sesión admin; respuestas sanitizadas sin secretos |
| **Sistema / backend** | `server/fastify-app.ts` (hooks globales) | n/a | Aplica request-id, security headers, no-store en sensibles, trusted-origin, 404 handler, error handler sanitizado | No expone stack/details en 5xx; health público |

**Cookies por dominio** (defaults, gobernados por ENV): clínica `app_session_id`, admin `admin_session_id`, particular `particular_session_id`. En producción: `Secure=true`, `SameSite=None`, `HttpOnly` siempre.

## Role-action matrix

| Role | View | Create | Update | Delete | Search | Download | Upload | Status transitions | Communication targets |
|---|---|---|---|---|---|---|---|---|---|
| Público | Contenido público, profesionales, precios | Mensaje de contacto; canje de token público | — | — | Profesionales públicos | Informe vía token público/particular (signed URL) | — | — | → Sistema (email contacto), → Backend público |
| Particular | Su informe + seguimiento + su audit-log | — | Marcar notificación leída | — | — | Su informe (preview/download) | — | — | ← Clínica/Admin (informe, tracking, notificaciones) |
| Clínica staff | Informes, logística/SLA (read), perfil, tokens, audit clínica | Tokens particulares, tokens report-access (según permiso) | Perfil público clínica, estado informe (según permiso) | Avatar perfil | Informes, study-types | Informes de su clínica (signed URL) | — | Estado de informe (con permiso) | ↔ Admin (workflow), → Particular (tokens) |
| Clínica owner | Igual staff | Igual + gestión usuarios, visitas/rutas/ventanas logística | Igual + visitas/ubicación/ventanas logística | Avatar perfil | Igual | Igual | — | Igual + logística | Igual |
| Admin | Todo (clínicas, sesiones, auditoría, salud, intentos fallidos…) | Clínicas+usuario, tokens particulares, tokens report-access, study-tracking | Precios, clínicas, credenciales, roles, workflow, tinción, tracking | Clínica (typed-confirm), token particular | Clínicas, sesiones, auditoría, intentos fallidos | Informes (scope admin), export CSV intentos fallidos | Informes (`/api/admin/reports/upload`) | Workflow informe, stage tracking, revocar sesiones/tokens | → Clínica/Particular (provisión, vínculos, tracking) |
| Sistema | Health | Audit log writes | — | Purga (dry-run expuesto) | — | — | — | Expiración de sesiones | → Todos (errores sanitizados, headers) |

## Route protection matrix

| Route | Public/Private | Expected role | Enforcement evidence | Risk |
|---|---|---|---|---|
| `/`, `/servicios`, `/precios`, `/clinicas`, `/profesionales`, `/profesionales/[clinicId]`, `/particulares`, `/contacto`, `/login`, landings SEO | Public | Cualquiera | `proxy.ts` matcher solo cubre `/dashboard/*`; páginas marcadas `robots:noindex` donde corresponde | Bajo |
| `/dashboard`, `/dashboard/informes`, `/dashboard/logistica/*` | Private | Clínica | `proxy.ts`: sin `app_session_id` → `redirect /login?next=`; backend exige sesión en cada fetch | Bajo |
| `/dashboard/admin` (+ submódulos) | Private | Admin | `proxy.ts`: sin `admin_session_id` → **404** (oculta existencia); backend `authenticateFastifyAdmin` en cada ruta admin | Bajo |
| `/api/admin/*` | Private | Admin | `authenticateFastifyAdmin` (cookie `admin_session_id`) por ruta; 401 si falta/inválida/expira | Bajo |
| `/api/auth/*` | Private (login público) | Clínica | `auth.fastify.ts` lee solo `ENV.cookieName`; rate-limit login | Bajo |
| `/api/reports/*`, `/api/study-tracking/*`, `/api/particular-tokens/*`, `/api/report-access-tokens/*`, `/api/clinic/*` | Private | Clínica | `authenticateClinicUser`/`requireAuth` + scope `clinicId` + permiso de mutación | Bajo |
| `/api/logistics/*` | Private | Clínica (+permiso) | `authenticateClinicUser` + `enforceLogisticsPermission` + scope `clinicId` + trusted-origin en mutaciones | Bajo |
| `/api/particular/*` | Private | Particular | `requireParticularAuth` (cookie `particular_session_id`); acota a `particularTokenId` | Bajo |
| `/api/public/*`, `/api/contact`, `/api/report-access-tokens` (canje público) | Public | Cualquiera | Sin sesión; validación Zod; trusted-origin en mutaciones; rate-limit en pricing/professionals/report-access | **Medio** (contacto sin rate-limit — ver M1) |
| `/health`, `/api/health`, `/` | Public | Cualquiera | Solo metadata de servicio/salud, sin secretos | Bajo |

## API / endpoint communication matrix

| Endpoint (prefijo) | Method(s) | Caller role | Target data | Enforcement evidence | Error behavior | Risk |
|---|---|---|---|---|---|---|
| `/api/admin/*` | GET/POST/PATCH/DELETE | Admin | Clínicas, sesiones, precios, auditoría, salud, tokens | `authenticateFastifyAdmin` + trusted-origin en mutaciones + audit log | 401/403/404 sanitizado; self-revoke→400 | Bajo |
| `/api/auth/login`,`/me`,`/logout` | POST/GET | Clínica | Sesión clínica | Cookie `app_session_id`; rate-limit; clearCookie en expiración | 401 distinto por causa | Bajo |
| `/api/reports`,`/search`,`/:id/{history,preview-url,download-url}` | GET | Clínica | Informes de la clínica | `getReadClinicScope` (list/search→scope) y `getAuthorizedReport` (`clinicId!==` → **403**) | 401/403/404; signed URL solo tras autorizar | Bajo (oracle 403 vs 404 — ver L2) |
| `/api/logistics/*` | GET/POST/PUT/PATCH | Clínica | Visitas/rutas/SLA de la clínica | `enforceLogisticsPermission` + scope `clinicId` (`updateClinicScopedFieldVisit`) | 401/403/404 | Bajo |
| `/api/particular/auth/*`,`/study-tracking/*` | GET/POST/PATCH | Particular | Su informe/seguimiento | `requireParticularAuth`; token `isActive` | 401 (mensajes recoverable mapeados en `api.ts`) | Bajo |
| `/api/public/pricing`,`/professionals/*`,`/report-access` | GET/POST | Público | Precios/profesionales públicos, canje token | Sin sesión; rate-limit dedicado; 410 token revocado | 400/404/410/429 explícitos | Bajo |
| `/api/contact` | POST | Público | Email a VETNEB | Zod + trusted-origin; error SMTP→502 con metadata segura | 400/502 sanitizado | **Medio** (sin rate-limit) |
| `/api/clinic/profile`,`/profile/avatar` | GET/PATCH/POST/DELETE | Clínica (owner para mutar) | Perfil público de la clínica | `requireClinicManagementPermission`; avatar con path privado/sanitizado | 401/403 | Bajo |

## Cross-role communication flows

| Flow | Source role | Target role/system | Data exchanged | Current behavior | Risk | Recommendation |
|---|---|---|---|---|---|---|
| Contacto | Público | Sistema (email) | name/email/clinicName/message | Zod valida; email enviado o 202 si SMTP off; errores no filtran detalles SMTP al cliente | **Medio** (abuso/flood) | M1: añadir rate-limit (PR diferido) |
| Canje token informe | Público/Particular | Backend → Storage | token → signed URL | 410 si revocado/expirado; no expone payload de informe ajeno | Bajo | Mantener |
| Provisión clínica | Admin | Clínica | clínica + usuario inicial | `createAdminClinicWithUser`; refresca listado; no expone hash/credenciales | Bajo | Mantener |
| Vínculo token particular | Admin/Clínica | Particular | reportId ↔ token (validando `clinicId`) | Bloquea vínculo cross-tenant (CTIDOR-008/011) | Bajo | Mantener |
| Workflow de informe | Admin ↔ Clínica | Estado/stage informe | stage, special-stain | Admin muta workflow; clínica observa estado; ambos auditados | Bajo | Mantener |
| Tracking de estudio | Admin → Clínica/Particular | Seguimiento + notificaciones | stages, ETA, notas | Notificaciones por superficie (`admin`/`clinic`/`particular`) | Bajo | Mantener |
| Revocación de sesión | Admin | Clínica/Particular/Admin | revoca sesión por id | Self-revoke admin bloqueado (400); auditado | Bajo | Mantener |
| Errores de sistema | Sistema | Todos | mensaje de error | 5xx → "Error interno"; 4xx → mensaje específico; sin stack/secretos | Bajo | Mantener |

## Findings by severity

### Critical
| ID | Area | Finding | Evidence | Impact | Recommendation | Implemented |
|---|---|---|---|---|---|---|
| — | — | Ninguno | — | — | — | — |

### High
| ID | Area | Finding | Evidence | Impact | Recommendation | Implemented |
|---|---|---|---|---|---|---|
| — | — | Ninguno | — | — | — | — |

### Medium
| ID | Area | Finding | Evidence | Impact | Recommendation | Implemented |
|---|---|---|---|---|---|---|
| **M1** | Público → Sistema | `/api/contact` no aplica rate-limit. La guardia trusted-origin no detiene clientes scripted sin `Origin` y sin cookie (`isTrustedOriginRequest` permite método inseguro sin origin ni cookie). | `server/routes/contact.fastify.ts` (sin import de rate-limit); `test/contact-route.test.ts` no espera rate-limit; `server/middlewares/trusted-origin.ts:137-151` | Flood de email/SMTP, costo y posible bloqueo del transporte; abuso del canal de contacto | Añadir rate-limit por IP siguiendo el patrón existente (`server/lib/login-rate-limit.ts`, `public-report-access-rate-limit.ts`) | **No (PR diferido)** |

### Low / Polish
| ID | Area | Finding | Evidence | Impact | Recommendation | Implemented |
|---|---|---|---|---|---|---|
| **L1** | Admin UX/a11y | El botón "Revocar" repetía el mismo nombre accesible en todas las filas (el botón hermano "Editar clínica X" sí estaba desambiguado). | `AdminSessionsReadOnlyCard.tsx` (acción crítica destructiva cross-role) | Usuario de lector de pantalla no distingue qué sesión revoca | Añadir `aria-label` por sesión + motivo cuando es la sesión actual | **Sí (este branch)** |
| **L2** | Clínica/Particular | Informe ajeno-existente devuelve **403** y inexistente **404** en `/:id/{history,preview-url,download-url}` → oráculo de existencia de IDs. | `server/routes/reports.fastify.ts:458-483` (`getAuthorizedReport`) | Enumeración de existencia de reportIds entre clínicas (no expone contenido) | Es decisión documentada (CTIDOR-002 fija 403). Evaluar unificar a 404 en download/preview en un PR de hardening | **No (by design / PR diferido)** |
| **L3** | Clínica UX | Cookie `app_session_id` presente pero inválida/expirada pasa el proxy (chequeo de presencia) y el dashboard muestra estados de error en vez de redirigir a `/login`. | `frontend/src/proxy.ts:24-43`; `app/dashboard/page.tsx` (flags `*LoadError`) | UX inconsistente al expirar sesión; no es problema de seguridad (backend rechaza con 401) | Al recibir 401 en server-fetch del dashboard, limpiar cookie y redirigir a `/login` (PR diferido) | **No (PR diferido)** |
| **L4** | Contrato API | Lecturas con fallback silencioso a `[]` (`getReports`/`getLogisticsFieldVisits`/`getRoutePlans` sin `throwOnError`) pueden enmascarar fallos de backend como "vacío". | `frontend/src/lib/api.ts:124-157,418-456` | Difícil distinguir "sin datos" de "backend caído" en superficies que no usan `throwOnError` | El dashboard ya usa `throwOnError:true` donde importa; documentar y revisar usos restantes | **No (informativo)** |

## Per-role audit

### Public visitor
- **Routes:** páginas públicas + landings SEO + `/login` + `/offline`. `proxy.ts` no intercepta rutas públicas.
- **Actions:** leer, buscar profesionales públicos, ver precios públicos, enviar contacto, canjear token público/particular.
- **Communication:** Público → Sistema (email contacto), Público → Backend público (pricing/professionals/report-access).
- **Errors:** 400 (validación Zod), 404 (ruta), 410 (token revocado/expirado), 429 (rate-limit en pricing/professionals/report-access), 502 (SMTP). Sanitizados.
- **Risks:** **M1** contacto sin rate-limit. Resto bajo.
- **Tests:** `contact-route.test.ts`, `public-professionals-*`, `public-report-access`, `global-public-surface-hardening-contract.test.ts`, `frontend-seo-public-surface-extreme.test.ts`.

### Particular
- **Routes:** `/particulares` (login + visor móvil). API `/api/particular/*`.
- **Actions:** ver/preview/download su informe; ver su seguimiento; marcar notificación leída; su audit-log.
- **Communication:** recibe de Clínica/Admin (informe, tracking, notificaciones). No emite hacia otras clínicas.
- **Errors:** 401 con mensajes "recoverable" mapeados a `null` en `api.ts` (sesión inválida/expirada/token inactivo).
- **Risks:** Bajo. Acotado a `particularTokenId`; token `isActive` requerido; CTIDOR-009 cubre acceso cruzado.
- **Tests:** `particular-auth*.test.ts`, `particular-study-tracking*.test.ts`, `particular-token*.test.ts`, `frontend-particulares-*`.

### Professional / Clinic
- **Routes:** `/dashboard`, `/dashboard/informes`, `/dashboard/logistica/*`. API `/api/auth/*`, `/api/reports/*`, `/api/study-tracking/*`, `/api/particular-tokens/*`, `/api/report-access-tokens/*`, `/api/clinic/*`, `/api/logistics/*`.
- **Actions:** ver/buscar informes de la clínica; descargar (signed URL); gestionar tokens particulares/report-access (según permiso); perfil público; logística (read todos, mutación solo owner); audit clínica.
- **Communication:** ↔ Admin (workflow/tracking de informes); → Particular (emisión de tokens).
- **Errors:** 401 (no autenticado/sesión inválida/expirada — limpia cookie), 403 (cross-tenant / permiso insuficiente / origin), 404, 400.
- **Risks:** Bajo. `clinicId` filtrado en todas las rutas; `clinic_staff` no muta; uploads no permitidos a clínica. L2/L3 menores.
- **Tests:** `reports.fastify.test.ts`, `logistics-*`, `clinic-permissions-middleware.test.ts`, `auth-session-boundaries.test.ts`, `security-cross-tenant-idor-contract.test.ts`.

### Admin
- **Routes:** `/dashboard/admin` (404 sin cookie). API `/api/admin/*`.
- **Actions:** clínicas (crear con usuario, editar, eliminar con confirmación tipeada, credenciales, roles), precios (persistencia múltiple), sesiones (ver/revocar con confirmación; bloqueo self-revoke), intentos fallidos (ver/filtrar/exportar CSV), auditoría (ver/filtrar/paginar sanitizado), system/schema health, maintenance dry-run, report-workflow, study-tracking, tokens.
- **Communication:** → Clínica/Particular (provisión, vínculos, tracking, revocación).
- **Errors:** 401/403/404 sanitizados; self-revoke 400; 5xx sin stack.
- **Risks:** Bajo. Auditoría escrita en acciones sensibles; sin exposición de hash/token/cookie.
- **Tests:** `admin-*.fastify.test.ts`, `frontend-admin-*-card.test.ts`, `admin-dashboard-sections-contract.test.ts`, `frontend-admin-metadata-guard.test.ts`.

### Logistics
- **Routes:** **No es un rol/identidad separado.** Es el sub-área `/dashboard/logistica/*` del dashboard clínica + APIs `/api/logistics/*`, gobernado por permisos de clínica.
- **Actions:** ver (todos los usuarios de clínica), mutar visitas/rutas/ventanas/eventos (solo `clinic_owner` vía `canManageLogistics*`); SLA read-only.
- **Communication:** dentro del dominio clínica; sin cruce con otras clínicas (scope `clinicId`).
- **Errors:** 401, 403 ("Permisos insuficientes para logistica"), 404 (recurso no encontrado o de otra clínica).
- **Risks:** Bajo. `enforceLogisticsPermission` + `updateClinicScopedFieldVisit(id, clinicId, …)` impiden alteración cross-tenant.
- **Tests:** `logistics-rbac-permission-contract.test.ts`, `logistics-field-visits-api.test.ts`, `logistics-route-plans-api.test.ts`, `logistics-sla-routes-integration.fastify.test.ts`, `frontend-dashboard-logistica*`.

### System / backend
- **Routes:** hooks globales en `fastify-app.ts`; `/health`, `/api/health`, `/`.
- **Actions:** request-id, security headers, no-store en sensibles, trusted-origin, 404/error handlers sanitizados, escritura de audit log.
- **Communication:** → todos los roles (errores sanitizados, headers de seguridad).
- **Errors:** 5xx → "Error interno del servidor" sin `details`; 4xx → mensaje específico; sin stack ni secretos.
- **Risks:** Bajo.
- **Tests:** `fastify-app.test.ts`, `api-error-no-secrets-contract.test.ts`, `api-error-no-stack-traces-contract.test.ts`, `backend-api-no-store-cache-contract.test.ts`, `api-request-id-observability-contract.test.ts`.

## Security review
- **Horizontal privilege escalation (clínica↔clínica):** Mitigado. `getReadClinicScope`/`getAuthorizedReport`/`updateClinicScopedFieldVisit` filtran por `clinicId`; listas/búsquedas ocultan filas ajenas; descargas validan ownership antes de firmar URL. Cubierto por `security-cross-tenant-idor-contract.test.ts` (CTIDOR-001…015) y `security-resource-ownership-boundaries.test.ts`.
- **Vertical privilege escalation (staff→owner→admin):** Mitigado. `requireClinicManagementPermission`/`enforceLogisticsPermission` bloquean mutaciones de `clinic_staff`; dominios admin/clínica/particular no comparten cookie ni contexto.
- **IDOR:** Mitigado. IDs validados (`parseReportId`, `parseEntityId`, `parseSessionId`) y autorización por `clinicId`/`particularTokenId`. Manipular `?clinicId=` ajeno → 403 ("No autorizado para consultar otra clinica").
- **Session/cookies:** Tres cookies separadas; `HttpOnly` siempre; `Secure` + `SameSite=None` en producción; cada dominio lee/escribe solo su cookie (`security-session-cookie-boundaries.test.ts`). Expiración limpia la cookie y devuelve 401.
- **CSRF:** `requireTrustedOriginForFastify` global + `enforceTrustedOrigin` por ruta: métodos inseguros exigen Origin/Referer en allowlist; sin Origin + con cookie de sesión → 403. Cubierto por `security-trusted-origin-cors-boundaries.test.ts`.
- **CSP:** `frontend/src/app/api/security/csp-report` + nonce; `frontend-csp-*` tests.
- **Public surface:** `pnpm security:public-surface` PASS; marcadores sensibles solo server-only en `proxy.ts`.
- **Storage/cache:** Bucket privado, `upsert:false`, signed URL con TTL ENV, filenames sanitizados (`supabase-storage-boundaries.test.ts`). SW no cachea privados/API.
- **Logs/errors:** Request logger redacta tokens/query; trusted-origin no loguea cookies; contacto loguea solo metadata SMTP segura. 5xx sanitizado.
- **Signed URLs/files:** Generados solo tras autorizar ownership; nunca para informe de otra clínica (CTIDOR-002/003).

## UX and accessibility review
- **Dashboard:** Componentes dedicados `EmptyState`/`ErrorState`/`LoadingState`; flags `*LoadError` por sección.
- **Forms:** Validación cliente + Zod servidor; mensajes específicos y sanitizados.
- **Tables:** Sesiones/auditoría con paginación y `aria-busy` en acciones.
- **Modals:** Revocación con `window.confirm` explícito; eliminación de clínica con confirmación tipeada (`confirmClinicName`).
- **Confirmations:** Acciones destructivas (revocar sesión, eliminar clínica) requieren confirmación.
- **Keyboard / Screen reader:** `aria-label` desambiguado en "Editar clínica X"; **corregido en este branch** el botón "Revocar" para tener nombre accesible por sesión (L1).
- **Dark gray:** Modo soportado (PR #977).
- **Mobile:** Visor particular móvil; navegación tablet corregida (#978).

## Testing review
- **Existing coverage:** 2657 tests backend + suites frontend (source-contract). Cobertura exhaustiva de fronteras: `security-cross-tenant-idor-contract`, `security-cross-auth-surface-boundaries`, `security-session-cookie-boundaries`, `security-mutation-permission-surface`, `security-critical-route-surface-registry`, `global-auth-boundary-contract`, `logistics-rbac-permission-contract`, `frontend-dashboard-middleware` (proxy).
- **Missing coverage:** rate-limit de `/api/contact` (no existe → M1); redirección de dashboard ante 401 server-side (L3).
- **New tests added:** assertion en `frontend-admin-sessions-card.test.ts` que fija el nombre accesible por sesión del botón Revocar (lock de L1).
- **Fragile tests:** Guardas de scope `PR-*` que ejecutan `git diff --name-only` sobre el working tree (`frontend-dashboard-*` ). Permanecen verdes: ninguno de los archivos tocados (root `*.md`, `frontend/src/app/dashboard/admin/*`, `test/*`) coincide con sus prefijos/archivos bloqueados.
- **Recommended tests:** test de rate-limit de contacto (con el PR M1); test de redirect-on-401 del dashboard (con el PR L3).

## Implemented fixes in this branch
| Fix | File(s) | Reason | Validation |
|---|---|---|---|
| Nombre accesible por sesión en botón Revocar (L1) | `frontend/src/app/dashboard/admin/AdminSessionsReadOnlyCard.tsx` | Acción destructiva cross-role sin nombre accesible desambiguado | `pnpm --dir frontend lint/typecheck/build`, `pnpm test` |
| Guardrail del nombre accesible | `test/frontend-admin-sessions-card.test.ts` | Bloquear regresión de L1 | `pnpm test` |

## Deferred PR backlog
| Priority | Suggested PR title | Area | Reason | Risk | Validation |
|---|---|---|---|---|---|
| Alta | `feat(security): rate-limit public contact endpoint` | `server/routes/contact.fastify.ts` | M1: contacto público sin rate-limit | Cambio de comportamiento de endpoint → requiere diseño y tests | Tests éxito/limit/headers Retry-After |
| Media | `fix(reports): unify foreign report access to 404` | `server/routes/reports.fastify.ts` | L2: evitar oráculo 403 vs 404 en download/preview | Cambia semántica documentada (CTIDOR-002) → revisar contrato | Actualizar IDOR contract + tests |
| Media | `fix(dashboard): redirect to login on server-side 401` | `app/dashboard/*` | L3: sesión expirada muestra error en vez de redirigir | UX; tocar render server-side del dashboard | Test de redirect-on-401 |
| Baja | `chore(api): audit silent empty-array fallbacks` | `frontend/src/lib/api.ts` | L4: distinguir vacío de fallo de backend | Bajo; revisar consumidores | Tests de `throwOnError` |

## Production recommendation
- **Ship now:** Sí. La comunicación entre roles está apta para producción: separación de dominios, enforcement backend real, sin leakage ni escaladas, errores sanitizados, auditoría presente, 2657 tests verdes + fix de a11y aplicado.
- **Ship after fixes:** Programar M1 (rate-limit de contacto) como primer PR diferido post-merge; no bloquea el release de comunicación entre roles.
- **Must not ship because:** N/A — no hay bloqueadores de comunicación entre roles.
