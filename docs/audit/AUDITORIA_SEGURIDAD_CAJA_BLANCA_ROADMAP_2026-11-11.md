# Auditoría de seguridad de caja blanca y hoja de ruta — PORTAL-VETNEB

**Fecha:** 2026-11-11\
**Tipo:** auditoría estática de caja blanca + validaciones locales dirigidas. Docs-only.\
**Referencia comparativa:** `docs/audit/SEGURIDAD_DRIVE_REA_VETNEB_2026-11-10.md` (informe experimental Drive/REA, #1986).\
**Clasificación:** evidencia sanitizada. Sin secretos, cookies, tokens, URLs firmadas, datos clínicos ni valores de `.env`.\
**Autorización:** ninguna corrección implementada. Este documento no autoriza ni delega ninguna operación; cada PR del roadmap requiere pedido explícito de Nico (AGENTS §3.2).

---

## 1. Estado base

| Campo | Valor verificado |
|---|---|
| Rama | `main` |
| HEAD | `42f09525e8793f60959c4b8c5ede94297fd50762` (`feat(search): Global Search A S3 frontend and opaque navigation (#1993)`) |
| Árbol | limpio (`git status --short --untracked-files=all` vacío; `git diff --stat`/`--check` vacíos) |
| Stashes | 5 preexistentes, listados y **no manipulados** |
| AGENTS anidados | ninguno tracked fuera de la raíz; `.cursor/rules/*.mdc` existen como superficie subordinada (no reinspeccionadas en esta tarea) |
| Directorios vacíos no tracked | `frontend/src/app/__c15_probe`, `frontend/src/app/c15-probe` (vacíos, sin archivos; git no los versiona; no generan ruta) |

Skills cargadas (instaladas como `anthropic-skills:*`): `vetneb-security-production-invariants`, `vetneb-briefing-planificacion-diseno-desarrollo-pruebas`, `vetneb-protocolos-comunicacion`, `vetneb-staff-senior-full-stack-engineer`. Las cuatro estaban instaladas.

## 2. Scope

**Incluido:** backend Fastify (`server/**`), esquema Drizzle (`drizzle/schema.ts`, sólo lectura), frontend de seguridad (`frontend/next.config.ts`, `frontend/src/proxy.ts`, `frontend/src/lib/api.ts`, `frontend/src/lib/security/csp-policy.ts`, `frontend/public/sw.js`, route handlers de `frontend/src/app/api`), workflows de `.github/`, documentación de `docs/security/*`.

**Excluido (no-alcance):** producción, staging y cualquier DB real; `.env` reales; settings efectivos de GitHub/Render/Supabase; `C:\REA-LAB` y Google Drive; ejecución de RLS; suites completas (`pnpm test`, E2E); corrección de cualquier hallazgo.

## 3. Método y escala

- Cada hallazgo se re-verificó contra el HEAD de §1 con referencia `archivo:línea`. Los hallazgos del informe Drive/REA (V-xx) **no se heredaron**: se confirmaron, refutaron o reclasificaron.
- **Severidad** (impacto × probabilidad, con controles compensatorios): P0 explotable con impacto crítico · P1 alto · P2 medio · P3 bajo/defensa en profundidad · INFO.
- **Confianza de evidencia** (eje separado): ALTA = leído en código y/o fijado por test; MEDIA = depende de configuración productiva no observable desde el repo; BAJA = inferencia.
- Ningún hallazgo está confirmado en runtime productivo.

## 4. Controles positivos verificados

| Control | Evidencia |
|---|---|
| Argon2id para hashes nuevos; legacy SHA-256 sólo verify con comparación en tiempo constante y validación previa de encoding | `server/lib/auth-security.ts:4-66` |
| Tokens de sesión de 256 bits; en DB sólo hash | `server/lib/auth-security.ts:68-75`; columnas `token_hash` en `drizzle/schema.ts:514-553,1139-1157` |
| Fronteras de cookie fijas (`app_session_id`, `admin_session_id`) y guard de colisión para la de particular | `shared/session-cookie-names.ts`, `server/lib/session-cookie-names.ts` |
| Filtro de origen en métodos inseguros; sin Origin/Referer sólo pasa si no hay cookie de sesión | `server/middlewares/trusted-origin.ts:139-151`; hook global `server/fastify-app.ts:433` |
| `no-store` en toda `/api/*` privada; `nosniff` + `Referrer-Policy: no-referrer` en API | `server/lib/http/sensitive-response-cache.ts`, `server/lib/http/api-response-security.ts` |
| 5xx genérico; log de error con metadata allowlisted (sin URL, query, stack ni `code`) | `server/fastify-app.ts:479-502` |
| Redacción de tokens públicos y URLs firmadas en logs de request | `server/middlewares/request-logger.ts:16-26` |
| Scope tenant derivado de la sesión; clinicId de query ajeno ⇒ forbidden | `server/features/reports/domain/reports.ts:81-95` |
| Búsquedas guardadas filtradas por superficie + dueño | `server/features/global-search/infrastructure/global-search-state-repository.ts:130` |
| Acceso público por token: token revocado/expirado/clínica inconsistente ⇒ 404 indistinguible; acceso auditado | `server/features/report-access/application/public-report-access-operations.ts:40-97` |
| Bucket creado `public: false`; rutas de storage con prefijo `clinics/<id>/` + aleatorio + nombre saneado | `server/lib/supabase.ts:72-104` |
| Avatares validados por parseo de dimensiones (rechaza bytes inconsistentes con el MIME) | `server/features/clinics/domain/clinic-public-profile-validation.ts:391-415` |
| Frontend: `X-Frame-Options: DENY`, HSTS (prod), `Permissions-Policy`, `poweredByHeader: false`, `no-store` en `/dashboard/*` | `frontend/next.config.ts:41-82,120,154-170` |
| Llamadas del navegador same-origin (rewrite `/api/*` → backend) | `frontend/src/lib/api.ts:137-142`, `frontend/next.config.ts` (rewrites) |
| Service worker excluye `/api/` y `/dashboard` | `frontend/public/sw.js:66-67,94` |
| `CORS_ORIGIN` obligatorio en producción; `PUBLIC_SITE_URL` https en producción; `TRUST_PROXY` sólo IP/CIDR | `server/lib/env.ts:54-57,78-110,129-139,206-208` |
| Claves de rate limit persistidas sólo como hash | `drizzle/schema.ts:472-494`; `server/lib/rate-limit-store.ts:119-121` |
| CI: actions fijadas por SHA; `pull_request_target` de QGA ejecuta el validador de la base sobre el head como datos, sin credenciales persistidas, y el token de App se emite después de validar | `.github/workflows/qga-governance.yml` |
| Dependencias sin advisories conocidos | `pnpm audit --prod` y `pnpm audit`: exit 0 (§9) |

## 5. Hallazgos

| ID | Sev. | Conf. | Hallazgo | Evidencia | Origen REA |
|---|---|---|---|---|---|
| **SEC-01** | P1 | ALTA | El cambio de contraseña (clínica y admin) **no revoca las demás sesiones**; el audit registra `sessionMaintained: true`. No existe en el backend ninguna función de revocación masiva por usuario, por lo que tampoco el reseteo de credenciales hecho por admin sobre un usuario de clínica corta sesiones activas. Un test fija el comportamiento actual. | `server/routes/auth.fastify.ts:1376-1403`; `server/routes/admin-auth.fastify.ts:991`; `test/security/auth-password-change.test.ts:260,322` | V-01 confirmado y ampliado |
| **SEC-02** | P1 | MEDIA | `TRUST_PROXY` cae a `false` sin exigencia en producción. Con el navegador llamando same-origin vía rewrite de Next, el backend puede ver la IP del proxy/frontend como `request.ip` para todos los usuarios. Consecuencias si se confirma: el rate limit de acceso público (clave = **sólo IP**) se vuelve global (un abusador agota el cupo de todos); el de login (identificador + IP) permite bloquear cuentas conocidas desde cualquier origen; las IP auditadas pierden valor. | `server/lib/env.ts:257`; `server/fastify-app.ts:408`; `server/routes/public-report-access.fastify.ts:277`; `server/lib/login-rate-limit.ts:86-104` | V-03 reclasificado P1 por el rewrite |
| **SEC-03** | P1 | ALTA | Los tokens de particular **no tienen expiración ni `revokedAt`**; sólo `isActive`. Son credenciales de larga vida entregadas por email que dan acceso a informes y datos del paciente. (La desactivación sí es efectiva por request.) | `drizzle/schema.ts:589-638`; chequeo `isActive` en `server/routes/particular-auth.fastify.ts:400,761` | V-12 confirmado |
| **SEC-04** | P2 | ALTA | La respuesta de `GET /api/public/report-access/:token` contiene URLs firmadas y queda **fuera** del `no-store` global; el handler no fija `Cache-Control`. | `server/lib/http/sensitive-response-cache.ts:6`; `server/routes/public-report-access.fastify.ts:332-345` | Confirmado |
| **SEC-05** | P2 | ALTA | Errores PostgreSQL `23505/23503/22P02/42703` que llegan al handler global se convierten en 400 y **devuelven `error.message` crudo** en `error` y `details` (nombres de constraint/columna). Viola la invariante «no filtración de errores de DB». El test de integración evita ese camino deliberadamente. | `server/fastify-app.ts:229-233,496-501`; `test/integration/app/fastify-app.test.ts:1630` | Nuevo |
| **SEC-06** | P2 | ALTA | Rate limit **fail-open**: si el store falla, login de particular y cambio de contraseña (clínica/admin) siguen sin límite. Agravante: esos fallos se registran con `request.log.*`, que es **no-op** porque la app usa `logger: false` (21 call sites en `server/`). Un incidente como el 503 de `login_rate_limits` quedaría invisible. | `server/routes/particular-auth.fastify.ts:646-667`; `server/routes/auth.fastify.ts:1227-1258`; `server/fastify-app.ts:405-409` | «fail-open» confirmado; no-op de logs nuevo |
| **SEC-07** | P2 | ALTA | Cobertura de auditoría incompleta: login/logout de particular sin ningún `writeAuditLog`; logout de clínica y admin sin audit; no existe actor `particular` en la taxonomía; emisión de URLs firmadas a particular no auditada. | `server/routes/particular-auth.fastify.ts` (0 llamadas); `server/routes/auth.fastify.ts:1411-1437`; `server/lib/audit-log.ts:1-6` | V-02/V-13 confirmados |
| **SEC-08** | P2 | ALTA | Datos de paciente en auditoría y logs: el evento de subida de informe persiste `patientName`; el log de fallo de notificación vuelca `error.message` bajo la clave `errorName`. El pipeline de audit no tiene redacción central. | `server/features/reports/application/report-route-service.ts:437,449` | Nuevo |
| **SEC-09** | P2 | ALTA | Subida de informe no atómica: objeto en storage → inserción en DB → vínculo token/seguimiento, sin compensación. Un fallo intermedio deja objetos huérfanos o vínculos parciales. | `server/features/reports/application/report-route-service.ts:342-400` | V-14 confirmado |
| **SEC-10** | P2 | ALTA | URLs firmadas: TTL por defecto 15 min **sin cota superior** configurable; revocar un token no invalida URLs ya emitidas. Tokens de acceso público de informe admiten `expiresAt` nulo (sin vencimiento). | `server/lib/env.ts:146-150,266-267`; `server/features/report-access/report-access-token.ts:61` | Confirmado |
| **SEC-11** | P2 | ALTA | CSP sólo **Report-Only** con `'unsafe-inline'` y `'unsafe-eval'`; el sink de reportes **no emite nada en producción**, así que no existe telemetría para graduar a enforcement. | `frontend/src/lib/security/csp-policy.ts:41-42`; `frontend/src/app/api/security/csp-report/route.ts:13-15` | Confirmado; falta de telemetría nueva |
| **SEC-12** | P2 | ALTA | Cookies `SameSite=None` en producción aunque el navegador ya llama same-origin. Relajación innecesaria; el CSRF queda cubierto sólo por el filtro de origen (sin defensa en profundidad). | `server/lib/env.ts:259`; `frontend/src/lib/api.ts:137-142` | P2 del informe confirmado |
| **SEC-13** | P2 | ALTA | Administración sin MFA, sin timeout de inactividad (sólo expiración absoluta, 24 h por defecto, `SESSION_TTL_HOURS` sin cota) y sin estado «deshabilitado» para `admin_users`, `clinic_users` ni `clinics`: la baja de un acceso exige borrar. | `server/lib/fastify-admin-auth.ts:253-279`; `server/lib/env.ts:268`; `drizzle/schema.ts:188-231` | Nuevo |
| **SEC-14** | P3 | ALTA | `expiresAt` nulo ⇒ sesión sin vencimiento (fail-open) en los tres helpers. Hoy los writers siempre lo fijan, pero la columna es nullable. | `server/lib/fastify-admin-auth.ts:253`; `server/lib/fastify-clinic-auth.ts:157`; `server/routes/particular-auth.fastify.ts:385` | Nuevo |
| **SEC-15** | P3 | ALTA | La subida de informes confía en el MIME declarado; la detección por magic bytes sólo existe en el camino `?viewer=1`. Superficie sólo-admin. | `server/lib/supabase.ts:21,146`; `server/routes/admin-reports.fastify.ts:158-163` | Confirmado |
| **SEC-16** | P3 | ALTA | `GET /` expone `NODE_ENV`; `/health` y `/api/health` públicos con estado de DB/storage y uptime. | `server/fastify-app.ts:509-538`; `server/lib/http-runtime.ts:126-133` | Confirmado |
| **SEC-17** | P3 | ALTA | JSON-LD inyectado con `JSON.stringify` sin escapar `<` en 10 páginas. Hoy todos los datos son estáticos (sin argumentos dinámicos): riesgo latente si se alimenta con datos de clínica. | p. ej. `frontend/src/app/profesionales/page.tsx:18-22`, `frontend/src/app/layout.tsx:39` | V-18 confirmado, latente |
| **SEC-18** | INFO | MEDIA | Sin RLS nativa; el inicializador no verifica que un bucket preexistente sea privado. RLS sigue **bloqueada** por los criterios de entrada de AGENTS §14. | `server/lib/supabase.ts:95-104`; `docs/security/rls-enforcement-matrix.md` | V-15/V-16 confirmados |

Hallazgos de la referencia **no** reproducidos como defectos: el filtro de origen y el scoping por `auth.clinicId` son consistentes en las rutas de clínica revisadas (`reports`, `reports-status`, `study-tracking`, `logistics-*`, `particular-tokens`, `report-access-tokens`, `clinic-audit`, `global-search-states`); no se encontró IDOR estático. Eso no reemplaza la evidencia runtime cross-tenant (§8).

## 6. Contraste Drive/REA → VETNEB

| Ensayo Drive | Control equivalente en VETNEB | Estado VETNEB |
|---|---|---|
| E2 tercero sin permiso ⇒ login | 401 sin cookie; proxy redirige `/dashboard/*`; 404 indistinguible en recurso ajeno | Cubierto en código; falta evidencia runtime A/B |
| E3 revocación ⇒ nuevas requests rechazadas | Revocación admin de sesión (`auth.session.revoked`), `isActive` de particular | Parcial: no hay revocación al cambiar contraseña (SEC-01); URLs ya emitidas siguen vigentes (SEC-10) |
| E4 restringido ↔ por enlace | Tokens de acceso público con `revokedAt`/`expiresAt` | `expiresAt` opcional (SEC-10) |
| E5 caducidad | `expiresAt` de sesiones y tokens públicos | Tokens de particular sin caducidad (SEC-03) |
| E6 cabeceras HTTP | Headers de §4; CSP Report-Only | CSP no enforced y sin telemetría (SEC-11); valores productivos no capturados |
| E7 actividad | `audit_log` admin/clínica/público | Particular y logout fuera de audit (SEC-07) |
| E8 herencia | No aplica: no hay jerarquía de permisos heredados; el scope es por `clinicId` | — |
| E9 descarga | URL firmada con `download` | Sin `no-store` en la ruta pública (SEC-04) |
| E10 papelera | No existe papelera; borrado de storage directo | Huérfanos ante fallo parcial (SEC-09) |

## 7. Hoja de ruta por PR independientes

Reglas comunes a todos los PR: un scope primario, una causa, un rollback (AGENTS §4); rama desde `main` actualizado; tests de seguridad dirigidos + `pnpm validate:local` (backend) o gates de frontend (§6); los tests que fijan el comportamiento viejo se **realinean en el mismo PR**, nunca se debilitan; R2 requiere autorización explícita de Nico; nada se ejecuta contra DB real, staging ni producción sin delegación R3 específica.

### Ola 0 — Evidencia previa (R3, [MANUAL-NICO], sin código)

| ID | Objetivo | Entrega | Desbloquea |
|---|---|---|---|
| **EV-01** | Topología real Render → Next → Fastify: valor efectivo de `TRUST_PROXY`, IP vista por el backend, si algún cliente llama al backend cross-site | Acta sanitizada (§17), sin IPs reales completas | PR-SEC-04, PR-SEC-12 |
| **EV-02** | Privacidad efectiva del bucket de informes y política de acceso | Acta sanitizada | PR-SEC-18 |
| **EV-03** | Captura de **nombres y directivas** (no cookies) de headers productivos de `/`, `/dashboard`, `/api/public/report-access/<inválido>` | Acta sanitizada | PR-SEC-11b/c |

### Ola 1 — Correcciones rápidas, sin schema (paralelizables)

| PR | Scope | Riesgo | Cambio | Criterio de aceptación | Tests | Rollback |
|---|---|---|---|---|---|---|
| **PR-SEC-01** (SEC-04) | backend-only | R2 (headers) | `Cache-Control: no-store` en todas las respuestas de `/api/public/report-access/*` (éxito, 404, 409, 429) | Las 4 respuestas llevan `no-store`; el resto de `/api/public/*` no cambia | Integración con `app.inject` por status | Revert del commit |
| **PR-SEC-02** (SEC-05) | backend-only | R2 | Handler global: para códigos SQLSTATE mapeados a 400 responder mensaje fijo, nunca `error.message` | Un 23505 con mensaje de constraint no aparece en el body; status 400 preservado | Integración en `test/integration/app/fastify-app.test.ts` con los 4 códigos | Revert |
| **PR-SEC-03** (SEC-08) | backend-only | R1/R2 | Quitar `patientName` de la metadata de `report.uploaded`; corregir `errorName` para usar `error.name` | Audit y log sin campos clínicos libres | Unit del servicio de reportes; guard de claves prohibidas en metadata | Revert |
| **PR-SEC-04** (SEC-16) | backend-only | R2 | `GET /` sin `environment`; `/health` público reducido a `ok/status` | Body público sin entorno ni detalle de dependencias; health privado conserva detalle | Integración de `/`, `/health`, `/api/health` | Revert |
| **PR-SEC-05** (SEC-17) | frontend-only | R1 | Helper `serializeJsonLd` que escapa `<`, `>`, `&`, U+2028/2029 y guard que prohíbe `JSON.stringify` en `dangerouslySetInnerHTML` | 10 sitios migrados; guard rojo ante uso crudo | Unit del helper + guard en `test/unit/ui/` | Revert |

### Ola 2 — Sesiones y autenticación

| PR | Scope | Riesgo | Cambio | Depende de | Criterio de aceptación | Tests |
|---|---|---|---|---|---|---|
| **PR-SEC-06** (SEC-01) | backend-only | R2 (auth) | Función de repositorio «borrar sesiones del usuario excepto la actual»; usarla en cambio de contraseña de clínica y admin y en el reseteo de credenciales por admin (que borra todas) | — | Tras cambiar contraseña, otra sesión del mismo usuario recibe 401; la actual sigue válida; audit con `sessionsRevoked: n` | Realinear `test/security/auth-password-change.test.ts:260,322`; integración con 2 sesiones |
| **PR-SEC-07** (SEC-06, parte 1) | backend-only | R1 (observabilidad §16) | Reemplazar los 21 `request.log.*` por el logger estructurado con redacción | — | Ningún `request.log`/`app.log` en `server/`; eventos con `requestId` | Guard estático + test de redacción |
| **PR-SEC-08** (SEC-06, parte 2) | backend-only | R2 (rate limits) | Política fail-closed (o fallback en memoria acotado por proceso) cuando el store persistente falla en login, login particular y cambio de contraseña | PR-SEC-07 | Store que lanza ⇒ 503 o límite en memoria, nunca intentos ilimitados | Unit/integración con store que falla |
| **PR-SEC-09** (SEC-14, SEC-13 parcial) | backend-only | R2 (auth) | `expiresAt` nulo ⇒ sesión inválida; cota superior para `SESSION_TTL_HOURS`; timeout de inactividad configurable para admin usando `lastAccess` | — | Sesión con `expiresAt` nulo ⇒ 401; admin inactivo > umbral ⇒ 401 | Unit de los tres helpers |
| **PR-SEC-10** (SEC-02) | backend-only | R2 (config productiva) | Exigir `TRUST_PROXY` cuando `NODE_ENV=production` (fail-fast) con el valor que fije EV-01 | EV-01 | Arranque productivo sin `TRUST_PROXY` falla con mensaje claro; `request.ip` correcto detrás del proxy | Unit de `env`; integración con `X-Forwarded-For` |

### Ola 3 — Tokens y trazabilidad (incluye schema)

| PR | Scope | Riesgo | Cambio | Depende de | Criterio de aceptación |
|---|---|---|---|---|---|
| **PR-SEC-11a** (SEC-03) | schema-only | R2 (migración) | Columnas nullable `expires_at`, `revoked_at` en `particular_tokens`, con rollback SQL documentado | autorización R2 | `pnpm validate:local:schema` PASSED; rollback probado localmente |
| **PR-SEC-11b** (SEC-03) | backend-only | R2 (auth) | Login y sesiones de particular rechazan token vencido/revocado; política de vencimiento por defecto definida por Nico | PR-SEC-11a fusionado | Token vencido ⇒ 401 en login y en sesión viva |
| **PR-SEC-12** (SEC-10) | backend-only | R2 | Cota superior de `SUPABASE_SIGNED_URL_EXPIRES_IN_SECONDS`; TTL máximo obligatorio para tokens de acceso público nuevos | — | Config fuera de cota falla al arrancar; `expiresAt` nulo rechazado en creación |
| **PR-SEC-13** (SEC-07) | backend-only (+ schema si `actor_type` tiene constraint) | R2 | Actor `particular`; eventos de login/logout de las tres superficies y de emisión de URL firmada a particular, sin datos sensibles | PR-SEC-03 | Cada evento presente con metadata allowlisted; si requiere migración, se separa en PR schema-only previo |

### Ola 4 — Endurecimiento HTTP y archivos

| PR | Scope | Riesgo | Cambio | Depende de |
|---|---|---|---|---|
| **PR-SEC-14** (SEC-12) | backend-only | R2 (cookies) | `SameSite=Lax` en producción para las tres cookies | EV-01 sin consumidores cross-site |
| **PR-SEC-15a** (SEC-11) | frontend-only | R2 (CSP) | Telemetría productiva sanitizada del sink CSP (evento agregado, sin URL completa) | — |
| **PR-SEC-15b** | frontend-only | R2 | Nonce por request y eliminación de `'unsafe-eval'` en Report-Only | PR-SEC-15a + 2 semanas de reportes |
| **PR-SEC-15c** | frontend-only | R2 | Pasar a `Content-Security-Policy` enforced | PR-SEC-15b sin violaciones legítimas + EV-03 |
| **PR-SEC-16** (SEC-09) | backend-only | R2 | Compensación: borrar el objeto si la inserción en DB falla; vínculos token/seguimiento en una transacción | — |
| **PR-SEC-17** (SEC-15) | backend-only | R2 | Validar magic bytes en la subida de informes reutilizando el detector existente | — |

### Ola 5 — Estratégico (requiere decisión o diseño)

| PR | Scope | Riesgo | Contenido | Estado |
|---|---|---|---|---|
| **PR-SEC-18** (SEC-18) | ops/docs | R3 | Verificación de bucket privado y criterios de entrada RLS de §14 | BLOCKED hasta EV-02 y criterios §14 |
| **PR-SEC-19** (SEC-13) | docs-only → schema → backend | R2 | ADR de MFA para admin; luego estado «deshabilitado» para usuarios y clínicas (decisión de producto) | Pendiente de decisión |
| **PR-SEC-20** | test-only | R1 local / R3 staging | Integración cross-tenant A/B local con fixtures sintéticos; luego smoke staging según `docs/ops/CROSS_TENANT_SMOKE_EVIDENCE_RUNBOOK.md` | Staging BLOCKED sin delegación R3 |

**Orden recomendado:** Ola 0 en paralelo con Ola 1 → PR-SEC-06 (mayor reducción de riesgo por línea) → PR-SEC-07 → PR-SEC-08 → PR-SEC-10 → Ola 3 → Ola 4 → Ola 5.

**Exclusiones del roadmap:** refactors de auth, reemplazo del esquema de sesiones, cambios de dependencias, cambios de CI (salvo que un PR los requiera y se autorice aparte), cualquier ejecución sobre datos reales.

## 8. Cobertura y deuda de verificación

- Tests en el árbol: 648 archivos bajo `test/`; 134 specs E2E. Existe `test/architecture/security/security-cross-tenant-idor-contract.test.ts` (contrato estático), pero no hay prueba runtime A/B con DB.
- No verificado: valores productivos de headers, `TRUST_PROXY`, privacidad del bucket, TTL efectivo de URLs firmadas, uso cross-site del backend.
- No auditado línea a línea: los 38 archivos de rutas completos; se priorizaron auth, sesiones, superficies públicas, storage y rutas de clínica con parámetros de recurso.

## 9. Validaciones (estados canónicos, AGENTS §6)

| Gate | Estado | Detalle |
|---|---|---|
| `test/security/auth-password-change.test.ts` + `test/architecture/security/security-cross-tenant-idor-contract.test.ts` | PASSED | 23/23, exit 0. Confirma que hoy se fija `sessionMaintained: true` (SEC-01) |
| `pnpm audit --prod` | PASSED | exit 0, «No known vulnerabilities found» |
| `pnpm audit` | PASSED | exit 0 |
| `git diff --check` + `--no-index --check` del documento | PASSED | Sin errores de whitespace; scan de patrones de secreto sin coincidencias |
| `pnpm validate:local`, frontend lint/typecheck/build, E2E | NOT_RUN | Cambio docs-only; no aplica por impacto |
| Evidencia runtime staging/producción | BLOCKED | Sin delegación R3 (AGENTS §17) |

## 10. Contradicciones detectadas (para Nico)

1. Las cuatro skills indican `gh pr merge --squash --delete-branch` en el cierre manual. AGENTS §5.8/§5.9 exige `--match-head-commit <SHA>` y prohíbe acoplar `--delete-branch` (la eliminación va después del readback del merge). Prevalece AGENTS.
2. Las skills exigen etiquetar «Terminal 1 / Terminal 2» siempre; AGENTS §1 sólo cuando hay procesos simultáneos. Prevalece AGENTS.
3. Las skills fijan una «validación base» fija (`lint/typecheck/build/validate:local`); AGENTS §6 exige selección por impacto. Prevalece AGENTS.
4. El informe de referencia (§8.1) afirma que el CI tiene «permisos limitados»; se confirmó, pero QGA usa `pull_request_target` con secreto de App: hoy está bien aislado y debe seguir así (el validador nunca debe importar archivos del head).

## 11. Resultado y estado final

- **Resultado:** 0 P0, 3 P1 (SEC-01, SEC-02, SEC-03), 10 P2, 4 P3, 1 INFO. Aislamiento tenant aplicativo consistente en código; los riesgos principales están en el ciclo de vida de credenciales (revocación y caducidad), la topología de proxy y la trazabilidad.
- **Riesgo residual:** SEC-02 puede ser mayor o menor según EV-01; ninguna conclusión de este documento es evidencia runtime.
- **Estado final:** un único archivo nuevo en `docs/audit/`; sin cambios de código, tests, configuración, dependencias, workflows ni migraciones; sin operaciones Git/GitHub.
