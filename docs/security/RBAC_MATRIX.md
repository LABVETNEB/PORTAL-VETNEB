# RBAC matrix — Portal VETNEB

## 1. Estado

- Matriz documental obligatoria para produccion.
- **NO-GO** si existe endpoint critico sin owner, actor o test asociado.
- Esta matriz **no reemplaza** pruebas runtime/staging ni smoke de produccion.

## 2. Actores

| Actor | Identidad | Mecanismo de auth | Scope | Permisos esperados | Riesgo principal |
|---|---|---|---|---|---|
| Public anonymous | Visitante sin sesion | Sin cookie/token | Publico | Salud publica, catalogo publico, contacto publico | Enumeracion de superficie y abuso de endpoints publicos |
| Public report token | Acceso publico por token de informe | Token en path (`/api/public/report-access/:token`) | Token -> reporte especifico | Visualizar/descargar solo reporte asociado al token valido | Reuso de token, expiracion/revocacion omitida, leakage de URL firmada |
| Particular token | Usuario particular con token vinculado | Login particular + cookie `particular_session_id` | `particularTokenId` y `clinicId` asociados | Ver `me`, preview/download de su reporte vinculado, logout | Acceso a reporte ajeno, disclosure de metadata |
| Clinic user | Usuario de clinica (`clinic_owner` / `clinic_staff`) | Login clinic + cookie `app_session_id` | `auth.clinicId` | CRUD limitado por permisos de clinica, reportes y tokens clinic-scoped | Lectura/escritura cross-tenant (IDOR) |
| Clinic admin (alias operativo) | Variante de rol de clinica con mayor permiso operativo | Misma sesion clinic | Mismo `auth.clinicId` | Operaciones de gestion de clinica dentro de su tenant | Escalada horizontal dentro de otras clinicas |
| Admin | Usuario administrativo | Login admin + cookie `admin_session_id` | Global con validaciones de ownership explicitas por recurso | Gestion global, auditoria, workflow, schema-health | Bypass de ownership, mutaciones sin trazabilidad |
| System/service internal | Proceso interno backend/infra | Contexto interno controlado (sin exposicion publica) | Infra/ruta interna | Health checks, tareas internas, observabilidad | Exposicion accidental de secretos o superficies internas |

## 3. Principios RBAC

- deny by default
- tenant isolation
- no cross-tenant reads
- no cross-tenant writes
- no signed URL leak
- no cookie/token disclosure
- admin no debe saltar validaciones de ownership salvo operacion explicita y auditada
- public/particular tokens siempre limitados a report/resource scope

## 4. Matriz actor/recurso

| Actor | Recurso | Leer | Crear | Actualizar | Borrar/revocar | Scope obligatorio | Evidencia requerida | Estado produccion |
|---|---|---|---|---|---|---|---|---|
| Clinic user | reportes | Si (solo tenant propio) | No en `/api/reports` | No en `/api/reports` | No en `/api/reports` | `auth.clinicId` | `test/reports.fastify.test.ts`, `test/security-cross-tenant-idor-contract.test.ts`, smoke staging con 2 clinicas | Abierto - pendiente evidencia runtime/staging |
| Admin | uploads PDF | No por ruta clinic | Si (`/api/admin/reports/upload`) | No | No | sesion admin + validacion `clinicId` objetivo | `test/admin-reports.fastify.test.ts`, `test/smoke-upload-script-contract.test.ts`, smoke upload autenticado | Abierto - pendiente evidencia runtime/staging |
| Clinic user / Particular token / Public report token | signed/download URLs | Si solo si recurso vinculado | No | No | No | `clinicId` o `particularTokenId` o `tokenHash` | `test/reports.fastify.test.ts`, `test/particular-auth.fastify.test.ts`, `test/public-report-access.fastify.test.ts`, logs sanitizados | Abierto - pendiente evidencia runtime/staging |
| Clinic user / Admin | report access tokens | Si (scoped) | Si (scoped) | Parcial (revoke/link) | Si (revoke) | `auth.clinicId` o validacion admin de `clinicId` | `test/report-access-tokens.fastify.test.ts`, `test/admin-report-access-tokens.fastify.test.ts`, contrato CTIDOR | Abierto - pendiente evidencia runtime/staging |
| Clinic user / Admin / Particular token | particular tracking | Si (scoped) | Si (segun rol) | Si (segun rol) | No hard-delete expuesto | `clinicId`, `particularTokenId` | `test/study-tracking.fastify.test.ts`, `test/admin-study-tracking.fastify.test.ts`, `test/particular-study-tracking.fastify.test.ts` | Abierto - pendiente evidencia runtime/staging |
| Admin / Clinic user / Particular token | audit log | Si (scoped por actor) | No | No | No | admin global, clinic por `clinicId`, particular por `particularTokenId` | `test/admin-audit.fastify.test.ts`, `test/clinic-audit.fastify.test.ts`, `test/particular-audit.fastify.test.ts` | Abierto - pendiente evidencia runtime/staging |
| Clinic user / Admin | workflow/status | Si (scoped) | Si (casos tracking) | Si (`status`, `stage`, `special-stain`) | No | `clinicId` o validacion admin por recurso | `test/reports-status.fastify.test.ts`, `test/admin-report-workflow.fastify.test.ts`, `test/architecture/security/security-resource-ownership-boundaries.test.ts` | Abierto - pendiente evidencia runtime/staging |
| Clinic user | clinic profile | Si | No | Si (`PATCH /api/clinic/profile`) | No | `auth.clinicId` | `test/clinic-public-profile.fastify.test.ts`, smoke staging clinic | Abierto - pendiente evidencia runtime/staging |
| Clinic user | avatar/logo storage | Si (via perfil firmado) | Si (`POST /avatar`) | Si (replace) | Si (`DELETE /avatar`) | prefijo storage por `clinicId` | `test/supabase-upload-success.test.ts`, `test/supabase-storage-boundaries.test.ts`, smoke avatar | Abierto - pendiente evidencia runtime/staging |
| Admin | admin schema health | Si | No | No | No | sesion admin + trusted origin | `test/admin-system-schema-health.fastify.test.ts`, `test/smoke-staging-script-contract.test.ts` | Abierto - pendiente evidencia runtime/staging |
| Public anonymous | contact form | No lectura de datos internos | Si (`POST /api/contact`) | No | No | origen permitido + payload valido | `test/contact.fastify.test.ts` (si aplica), smoke de contacto y health admin | Abierto - pendiente evidencia runtime/staging |
| Todos los actores autenticados | auth/session | `GET /me` segun dominio | `POST /login` segun dominio | Renovacion implicita de sesion | `POST /logout` | cookie correcta por dominio (`app`, `admin`, `particular`) | `test/security-cross-auth-surface-boundaries.test.ts`, `test/security-session-cookie-boundaries.test.ts` | Abierto - pendiente evidencia runtime/staging |

## 5. Gaps conocidos

| Gap | Riesgo | P0 relacionado | Evidencia requerida | Estado |
|---|---|---|---|---|
| Falta evidencia runtime con sesiones reales cruzadas (clinic A/B) | IDOR no detectado en staging/prod | P0-015 | Capturas sanitizadas de requests/responses con 403/404/410 esperados | Abierto |
| Falta cierre operativo de smoke cross-tenant post-deploy | Regresion RBAC en release | P0-015, P0-022 | Run de smoke staging y smoke produccion firmado | Abierto |
| Falta evidencia de revision de logs sin leakage de signed URLs/cookies | Exposicion de datos sensibles | P0-010, P0-023 | Extracto de logs sanitizado con timestamp y responsable | Abierto |
| Matriz documental aun no valida cobertura al 100% de endpoints nuevos | Drift entre codigo y seguridad documental | P0-015 | Actualizacion de matrices por release + diff revisado | Abierto |
