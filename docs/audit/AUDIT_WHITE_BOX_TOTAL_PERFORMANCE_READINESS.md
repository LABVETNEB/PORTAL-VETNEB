# White Box Total Performance and Launch Readiness Audit

> Auditoría de caja blanca, read-only, end-to-end. Sin cambios de código, sin SEO,
> sin pruebas destructivas en producción. Único artefacto creado: este archivo.

## Executive summary

- **Estado general.** El código de Portal VETNEB está en buen estado de ingeniería:
  cliente DB y Supabase como singletons, índices amplios, paginación, batching de
  queries (sin N+1 detectados), service worker defensivo, headers de seguridad y
  2697 tests verdes. **No se hallaron cuellos de botella algorítmicos ni fugas de
  memoria graves.** Los riesgos de performance son acotados y de mitigación clara.
- **Recomendación.**
  - **Capa código / performance: GO WITH CONDITIONS** (condiciones: timeouts de DB,
    acotar/compartir los rate-limit en memoria, índice de orden por `created_at` y
    plan de stress en espejo antes de subir tráfico).
  - **Lanzamiento global de producción: NO-GO heredado** hasta cerrar los bloqueantes
    operativos del audit base #990 (rotación de credenciales históricas, backups
    cifrados + restore drill, smoke autenticado, gobierno de rollback/incidentes,
    alerting externo). Esos bloqueantes son operativos, no de código.
- **Riesgo principal.** `CONC-01`: el cliente Postgres no define `statement_timeout`
  ni `connect_timeout`/`idle_timeout` y corre con `max=3` conexiones por defecto. Tres
  queries lentas o colgadas pueden agotar el pool y bloquear **todo** el servicio bajo
  estrés. Es el primer punto de ruptura esperado en pruebas de carga.
- **Top 5 acciones.**
  1. Cerrar bloqueantes operativos heredados de #990 (BLK-01..04, HIGH-02).
  2. Añadir `statement_timeout` + `connect_timeout` + `idle_timeout` al cliente
     Postgres y ajustar `max` al plan de Supabase (`CONC-01`).
  3. Hacer compartidos/persistentes o acotados con purga los rate-limit secundarios
     en memoria (`MEM-01`/`CONC-04`).
  4. Agregar índice `reports(clinic_id, created_at desc)` para el orden de listados
     (`DB-01`).
  5. Ejecutar el plan de stress en staging espejo antes de habilitar tráfico real.

## Scope

- **Qué se auditó.** Backend Fastify (`server/**`, ~42.000 LOC, 101 archivos TS),
  esquema y migraciones Drizzle (`drizzle/**`), librerías de soporte (rate-limit,
  caches, email, supabase, env, health), frontend Next.js 16 / React 19
  (`frontend/src/**`, `next.config.ts`, middleware/proxy, service worker, manifest),
  scripts operativos (`scripts/**`), workflows CI (`.github/workflows`) y los reportes
  de auditoría previos como contexto de readiness.
- **Foco.** Performance real, complejidad algorítmica (Big O), CPU/memoria, fugas de
  memoria, concurrencia/bloqueos, queries y N+1, conexiones DB/API, pooling, cuellos
  de botella runtime y readiness para stress en espejo.
- **Fuera de alcance.** Implementación de fixes, modificación de código/tests/CI,
  rediseño visual, auditoría SEO, migraciones, dependencias nuevas, y cualquier
  escritura, upload, email, rotación o carga destructiva contra producción.
- **Confirmaciones.** No se auditó SEO. No se rediseñó nada. No se ejecutaron pruebas
  destructivas ni escrituras en producción (sólo `GET /health` read-only).

## Evidence

- **HEAD auditado.** `1126cbd05c0ec77c593f31fc2c91909a375c8435`
  — `audit(production): final launch readiness gap review (#990)`.
- **Rama.** `main` (working tree limpio; `HEAD == origin/main`).
- **Validaciones ejecutadas (locales, no destructivas).**
  - `pnpm typecheck` → OK (sin errores).
  - `pnpm typecheck:test` → OK (sin errores).
  - `pnpm test` → **2697 pass / 0 fail / 0 skipped**, `duration_ms ≈ 11730`.
  - `pnpm build` → OK, `dist/index.js 864.5kb` (esbuild).
  - `pnpm audit --prod` → **No known vulnerabilities found** (sólo `DEP0169`
    deprecation warning informativo de `url.parse()` en una dependencia transitiva).
  - `pnpm security:public-surface` → **PASS**, sin exposición pública de devtools;
    únicos hallazgos `[server-only]` (identificadores de cookie en `frontend/src/proxy.ts`,
    código de servidor, no expuesto al navegador). Re-ejecutado tras `frontend build`
    con `.next` presente: PASS.
  - `pnpm --dir frontend lint` → OK.
  - `pnpm --dir frontend typecheck` → OK.
  - `pnpm --dir frontend build` → OK (públicas estáticas, dashboards dinámicos,
    `Proxy (Middleware)` presente).
- **Resultado exacto de `pnpm test`.**
  `ℹ tests 2697 / ℹ pass 2697 / ℹ fail 0 / ℹ cancelled 0 / ℹ skipped 0 / ℹ todo 0 / ℹ duration_ms 11730.8603`.
- **Resultado E2E.**
  `pnpm --dir frontend e2e dashboard-auth-redirect.spec.ts visual-smoke.spec.ts --project=chromium --workers=1`
  → **12 passed (13.2s)** (2 redirect auth + 10 visual smoke desktop/mobile).
- **Resultado readiness producción.**
  `node scripts/ops/verify-production-readiness.mjs --url https://api.vetneb.com.ar`
  → **PASS** — `/health returned 200 with database and storage up` (verificado GET-only).
- **Estado git.** Tras E2E, `frontend/next-env.d.ts` quedó regenerado al path dev
  (comportamiento conocido); fue revertido con `git checkout --`. `git status --short`
  final: **limpio**. `git diff --check`: **limpio**. Sin artefactos temporales.

## Architecture map

- **Backend.** Fastify 5 (ESM; `tsx` en dev, bundle `esbuild` en prod). Rutas montadas
  bajo prefijos `/api/**` desde `server/fastify-app.ts`. Hooks globales: `requestId`,
  headers de seguridad, `requireTrustedOrigin`, y `onSend` (`no-store` para APIs
  sensibles + inyección de `requestId` en errores). Error handler mapea códigos PG
  `23505/23503/22P02/42703` → 400 y enmascara 5xx. `logger: false` (logging propio).
- **Frontend.** Next.js 16 / React 19 App Router. Páginas públicas estáticas (`○`),
  dashboards dinámicos (`ƒ`). Middleware `frontend/src/proxy.ts` (matcher
  `/dashboard/:path*`) gatea por presencia de cookie de sesión (sin DB). `/api/*` se
  reescribe a la API por `next.config.ts rewrites`. Service worker propio (`public/sw.js`)
  con caché defensiva. Headers de seguridad + CSP report-only + HSTS en prod.
- **DB.** `postgres.js` cliente único (`prepare:false`, `max=ENV.databaseMaxConnections`
  default 3, clamp 1..10) + `drizzle-orm`. Singleton de módulo. `closeDbConnection` en
  shutdown. **Sin** `statement_timeout`/`connect_timeout`/`idle_timeout`.
- **Storage.** Supabase JS singleton (service role), bucket privado, signed URLs TTL
  `signedUrlExpiresInSeconds` (default 900s). MIME allowlist y sanitización de paths.
- **Email.** `nodemailer` SMTP (transporter cacheado por clave) **o** Gmail API vía
  `fetch` (token OAuth por envío, sin caché ni timeout).
- **Auth.** 3 realms separados: clínica (`app_session_id`), admin (`admin_session_id`),
  particular (`particular_session_id`). Cookies httpOnly, token hasheado (sha256), sesión
  en DB. Validación inline por ruta Fastify (2 queries DB/request + escritura de
  `lastAccess` throttled). Login rate-limit **persistente en DB** para los 3 realms.
- **CI.** `.github/workflows/backend-ci.yml`, `frontend-ci.yml` (toolchain pnpm/Node
  fijado, verificado por tests).
- **Observability.** Logging estructurado por request (`console.log` en rutas reports),
  `[API ERROR]` con `requestId`. **Sin APM/alerting externo** (per #990).
- **Production runtime.** Render (API + frontend) + Supabase (DB pooler transaction
  mode + Storage). Shutdown graceful (SIGINT/SIGTERM → cierra server + DB). Limpieza de
  sesiones expiradas sólo en preflight (arranque).

## Code complexity findings

| ID | Archivo | Línea/función | Complejidad actual | Complejidad esperada | Riesgo | Recomendación | PR sugerido |
|---|---|---|---|---|---|---|---|
| CPLX-01 | `server/lib/logistics/route-planning.ts` | `buildHeuristicRoutePlan` (while + map+sort+findIndex+splice) | O(n²·log n) por plan | O(n²) o O(n log n) | Bajo (cap `MAX_ROUTE_PLAN_FIELD_VISIT_IDS=100` ⇒ ≤~70K ops) | Mantener el cap; si se sube, seleccionar el mínimo en O(n) sin `sort` y usar índice en vez de `findIndex`+`splice` | `perf(logistics): linearize heuristic candidate selection` |
| CPLX-02 | `server/db.ts` | `searchReports`/`countSearchReports` (`ilike '%q%'`) | O(filas_por_clínica) (scan, wildcard inicial no indexable) | O(log n) con índice trigram | Medio a escala | `pg_trgm` GIN en `patient_name`/`file_name`/`study_type` si crece la latencia | `perf(db): add trigram search index for reports` |
| CPLX-03 | `server/db.ts` | `countReports*` (`count(*)` por request) | O(filas filtradas) | O(log n) parcial / keyset | Bajo-Medio | Mantener (paralelo al listado); migrar a keyset si el volumen por clínica crece | `perf(reports): keyset pagination for large clinics` |
| CPLX-04 | `server/db-logistics.ts`, `server/db-admin-clinics.ts` | agregaciones con `Map` desde queries batched | O(n) agrupación | O(n) | Nulo | Patrón correcto; sin acción | — |

## Memory leak findings

| ID | Archivo | Patrón | Riesgo memoria | Impacto producción | Evidencia | Recomendación |
|---|---|---|---|---|---|---|
| MEM-01 | `contact.fastify.ts:358`, `public-report-access.fastify.ts:271`, `public-professionals.fastify.ts:265`, `report-access-tokens.fastify.ts:623`, `admin-report-access-tokens.fastify.ts:419` | `createMemoryRateLimitStore()` = `Map` sin purga (sólo reset perezoso en mismo key) | Crecimiento lento, acotado por nº de keys distintas (IP/token hasheados) durante la vida del proceso | Per-instancia; en Render reinicia al redeploy | `rate-limit-store.ts:60` (no hay `cleanupExpired` ni cota de tamaño) | Mover a store persistente/compartido (como login) o agregar barrido periódico / cota LRU |
| MEM-02 | `server/lib/logistics-route-plans-cache.ts:8-9` | `Map` con TTL 5min, evict sólo en `get`; entradas no re-pedidas persisten hasta `clear*`/restart | Acotado por (clinic,filtro) distintos | Bajo-Medio | TTL presente pero sin sweeper ni `maxSize` | Cota de tamaño + barrido periódico |
| MEM-03 | `server/preflight.ts:45`, `server/db.ts` (`deleteExpired*Sessions`) | Sesiones expiradas (clínica/admin/particular) y `login_failed_attempts`/`audit_log` sólo se limpian en arranque | Crecimiento de DB (no de proceso) en uptimes largos | Medio (bloat → degradación gradual de scans) | Limpieza sólo en preflight; rate-limit DB sí purga en acceso | Job programado (cron/pg) de purga + retención de auditoría/failed-attempts |
| MEM-04 | (global) | Sin `setInterval`/`setTimeout` residentes ni listeners globales sin cleanup | Nulo | — | grep de timers: sólo en tests | Sin acción |

## Concurrency and blocking findings

| ID | Área | Riesgo concurrencia | Impacto | Evidencia | Recomendación |
|---|---|---|---|---|---|
| CONC-01 | Pool Postgres | Sin `statement_timeout`/`connect_timeout`/`idle_timeout` con `max=3` | **Alto bajo estrés**: 3 queries lentas/colgadas agotan el pool y bloquean todo el servicio | `server/db.ts:23-26` (sólo `prepare:false` + `max`) | Añadir timeouts (statement ~10-15s, connect ~10s, idle), ajustar `max` al plan de Supabase pooler |
| CONC-02 | I/O externa | `fetch` a Gmail API (token + send) y ops de Supabase Storage sin `AbortController`/timeout | Medio: un handler puede colgarse esperando I/O externa | `server/lib/email.ts:298-411`, `server/lib/supabase.ts` (sin signal) | Timeout por `AbortController` en toda I/O saliente; cachear token Gmail (~1h) |
| CONC-03 | Upload de informes | Storage primero, DB después (historial transaccional) | Medio: si falla la DB tras subir, queda objeto huérfano en Storage | `supabase.uploadReport` → `db.upsertReport` (`server/db.ts:537`) | Borrado compensatorio ante fallo o reconciliación periódica de huérfanos |
| CONC-04 | Rate-limit multi-instancia | Limiters secundarios en memoria no se comparten entre instancias | Medio: límites más débiles al escalar horizontalmente (login sí es DB, seguro) | `MEM-01` + Render multi-instancia | Store compartido/persistente para limiters secundarios |
| CONC-05 | Fan-out | `Promise.all` siempre sobre pares fijos (listado+count, visitas+ventanas), no sobre arrays de usuario | Nulo | `reports.fastify.ts:592`, `db-logistics.ts:897-956` | Patrón correcto; sin acción |

## Database and query findings

| ID | Archivo | Query/función | Patrón | Índice requerido | Riesgo | Evidencia | PR sugerido |
|---|---|---|---|---|---|---|---|
| DB-01 | `server/db.ts:758,779` | `getReportsByClinicId`/`searchReports` (`order by created_at desc`, limit/offset) | Filtro por `clinic_id` + sort por `created_at` sin índice compuesto | `reports(clinic_id, created_at desc)` | Medio | Índices existentes cubren `clinic_id`, `(clinic_id, upload_date)`, `(clinic_id, study_type)`, `(clinic_id, current_status)`, `status_changed_at` — **no** `created_at` | `perf(db): index reports(clinic_id, created_at)` |
| DB-02 | `server/db.ts:797,850` | búsqueda `ilike '%q%'` | Wildcard inicial no indexable → scan dentro de la clínica | GIN `pg_trgm` (opcional) | Medio a escala | `searchReports` filtros `or(ilike...)` | `perf(db): trigram index for report search` |
| DB-03 | `server/db.ts:816,834` | `count(*)` por listado | Conteo filtrado por request | parcial/compuesto (ya parcialmente cubierto) | Bajo-Medio | `countReportsByClinicId`/`countSearchReports` | `perf(reports): keyset pagination` |
| DB-04 | múltiples rutas | paginación `limit/offset` | offsets profundos escanean y descartan | — | Bajo | `parseOffset`/`list-pagination.ts` | `perf(api): keyset for deep pages` |
| DB-05 | `db-report-access.ts:150`, `db.ts` sesiones, `db-admin-clinics.ts:277` | lookups por `token_hash`/PK; users por `inArray` | Indexado/batched, **sin N+1** | (ok) | Nulo | `report_access_tokens_token_hash_idx`, `active/admin_sessions_token_hash_idx`, `inArray(clinicIds)` | — |

> No se crean migraciones. Sólo se proponen índices.

## Connection pooling and external dependency findings

| ID | Recurso | Estado actual | Riesgo | Recomendación | Prioridad |
|---|---|---|---|---|---|
| POOL-01 | Cliente Postgres | Singleton `postgres.js`, `prepare:false` (correcto para pgBouncer transaction), `max=3` (clamp 1..10), sin timeouts | Pool chico sin timeouts ⇒ bloqueo total ante queries lentas (`CONC-01`) | Timeouts + ajustar `max` al plan; mantener `prepare:false` | Alta |
| POOL-02 | Supabase JS | Singleton, sin creación por request | Bajo | Mantener; opcional `auth: { persistSession:false }` | Baja |
| POOL-03 | SMTP/Gmail | Transporter SMTP cacheado; token Gmail por envío, sin timeout | Latencia/cuelgue en picos de email | Cachear token Gmail; `AbortController` (`CONC-02`) | Media |
| POOL-04 | Proxy Next `/api/*` | Reescritura browser→Next→backend | Hop extra; carga del server Next escala con tráfico de API | Evaluar origen API directo (CORS credentialed ya soportado) o aceptar el hop | Media |
| POOL-05 | Detección pool exhausto | Sólo en preflight (best-effort skip) | No hay backpressure en runtime | Métrica de uso de pool + alerta | Media |

## Runtime and production bottlenecks

| ID | Área | Descripción | Impacto | Recomendación |
|---|---|---|---|---|
| RT-01 | `/health` | `select 1` + Supabase Storage `getBucket` en cada llamada, sin caché ni timeout | Probes de alta frecuencia o stress sobre `/health` fan-out a Storage externo + pool de 3 conns | Separar liveness barato vs readiness con caché de N s y timeout por dependencia |
| RT-02 | Logging | `console.log` por request (rutas reports) + `[API ERROR]` | Bajo-Medio: escrituras a stdout pueden generar backpressure del event loop bajo alta carga | Logging async/batched o muestreo si la carga es alta |
| RT-03 | Estado en memoria | Rate-limit/caches secundarios se pierden al reiniciar y no se comparten entre instancias | Límites/caché degradados tras redeploy o al escalar | Persistir/compartir (`MEM-01`/`CONC-04`) |
| RT-04 | Bundle server | `dist/index.js` 864.5kb | Nulo | Sin acción |
| RT-05 | Dead code | Middlewares Express `auth.ts`/`admin-auth.ts`/`requestLogger` no usados por Fastify (sólo se importan helpers puros de `request-logger.ts`) | Mantenibilidad | `chore: remove unused Express middlewares` |

## Staging mirror stress-test plan

### Requisitos de staging espejo

- Misma versión de código (mismo HEAD que producción).
- Mismas variables por **nombre**, nunca valores reales; secretos sólo de staging.
- DB clonada o dataset sintético equivalente (volúmenes realistas: clínicas, informes,
  tokens, visitas, sesiones). Sin PII real si es posible.
- Storage con dataset seguro (archivos dummy); bucket privado equivalente.
- Render/Supabase con sizing comparable (mismo plan de pooler y de instancia).
- Logs habilitados; alerting de prueba; backups y rollback definidos.
- Usuarios de prueba dedicados por realm (clínica/admin/particular).
- Nunca apuntar la carga a `api.vetneb.com.ar` (producción).

### Escenarios de carga propuestos

| Escenario | Usuarios concurrentes | Duración | Métrica objetivo | Punto de ruptura esperado | Riesgo | Herramienta sugerida |
|---|---:|---:|---|---|---|---|
| 1. `/health` | 50 → 300 | 5 min | p95 < 300ms | Saturación pool 3-conns + rate-limit de Storage (`RT-01`) | Medio | k6 / autocannon |
| 2. Login clínica | 20 → 100 | 5 min | p95 < 800ms; 0 falsos 429 | argon2 CPU-bound + escritura rate-limit DB | Medio | k6 |
| 3. Login admin | 10 → 50 | 5 min | p95 < 800ms | Igual que #2 | Medio | k6 |
| 4. Dashboard clínica (sesión válida) | 50 → 200 | 10 min | p95 < 600ms | 2 queries/req auth × pool 3 (`CONC-01`) | Alto | k6 |
| 5. Dashboard informes (listado) | 50 → 200 | 10 min | p95 < 700ms | Sort por `created_at` sin índice (`DB-01`) | Alto | k6 |
| 6. Dashboard logística (rutas/métricas) | 20 → 80 | 10 min | p95 < 800ms | Caché en memoria + planner O(n²) (cap 100) | Medio | k6 |
| 7. Listado informes paginado profundo | 30 → 120 | 10 min | p95 < 800ms | offset profundo (`DB-04`) | Medio | k6 |
| 8. Búsqueda informes (`ilike`) | 20 → 80 | 10 min | p95 < 900ms | scan trigram-less (`DB-02`) | Medio-Alto | k6 |
| 9. Descarga informe (signed URL) | 30 → 120 | 10 min | p95 < 900ms | Llamada Storage signed URL sin timeout (`CONC-02`) | Medio | k6 |
| 10. Acceso público por token | 50 → 250 | 10 min | p95 < 700ms | rate-limit en memoria per-instancia (`MEM-01`) | Medio | k6 |
| 11. Profesionales públicos | 50 → 250 | 10 min | p95 < 600ms; cache hit alto | TTL caché pricing/professionals | Bajo | k6 / autocannon |
| 12. Contacto (POST) | 10 → 40 | 5 min | 429 correcto > umbral; 0 emails reales en staging | rate-limit memoria + I/O email sin timeout | Medio | k6 |
| 13. Upload simulado (staging) | 10 → 40 | 5 min | p95 < 1500ms; 0 huérfanos | Storage-first sin compensación (`CONC-03`) | Medio | k6 / Playwright |
| 14. Generación/consulta signed URLs | 30 → 120 | 10 min | p95 < 900ms | Storage API throughput | Medio | k6 |
| 15. Navegación pública (SSR/estático) | 100 → 500 | 10 min | p95 < 500ms | Proxy Next + SSR (`POOL-04`) | Medio | k6 / Playwright load-light |
| 16. PWA/offline | 20 → 80 | 5 min | offline fallback correcto | Caché SW (cliente) | Bajo | Playwright |

**Criterios de corte (abort):** error rate > 2% sostenido, p95 > 2× objetivo,
`5xx` por pool exhausto, latencia DB creciente sin meseta, o cualquier degradación de
Supabase. Herramientas sugeridas (sin implementar): k6, Artillery, autocannon
(endpoints read-only), Playwright load-light, métricas de Supabase y logs/metrics de Render.

## Launch blockers

> De **esta** auditoría (código/performance) **no surgen nuevos bloqueantes duros**.
> Los bloqueantes vigentes son **operativos**, heredados del audit base #990, y dominan
> la decisión de lanzamiento.

| ID | Severidad | Área | Evidencia | Impacto | Acción recomendada | PR sugerido |
|---|---|---|---|---|---|---|
| BLK-01 | Crítico (P0) | Secret leakage | #990: commit histórico `a88a5e4` con dos URLs de DB con passwords no genéricos; rotación no demostrada; secret scanning deshabilitado | Acceso no autorizado a la base si la credencial sigue válida | Rotar toda credencial afectada, verificar rechazo de la vieja, revisar logs del proveedor, habilitar scanning/push protection, evidencia sanitizada | `ops(security): rotate exposed historical database credentials and document evidence` |
| BLK-02 | Crítico | Backups/recovery | #990: backups 2026-06-08 locales sin cifrado, ACLs amplias, sin restore drill | Exposición local de datos clínicos + recuperación no probada | Restringir ACLs, cifrar/vault, backup fresco, verificar integridad, restore drill no productivo con evidencia | `ops(backups): encrypt sensitive backups and complete restore drill` |
| BLK-03 | Alto | Smoke autenticado | #990: sin evidencia de login/cookie/upload/download/token/cross-tenant/email en topología desplegada | `200` público no prueba flujos privados ni fronteras de privacidad | Smoke controlado en staging y luego producción con datos de prueba y evidencia sanitizada | `test(production): add authenticated smoke checklist and evidence` |
| BLK-04 | Alto | Rollback/gobierno | #990: ejecución de rollback, owner de lanzamiento, comandante de incidente y aprobación final abiertos | Lanzamiento sin camino de recuperación probado ni responsable | Asignar owners y canal, ensayar rollback, umbrales de corte, firmar GO/NO-GO contra este commit | `ops(launch): close rollback incident ownership and approvals` |

## High-priority gaps

| ID | Severidad | Área | Evidencia | Impacto | Acción |
|---|---|---|---|---|---|
| HIGH-PERF-01 | Alta | Pool/timeouts DB | `CONC-01` (`server/db.ts:23-26`) | Bloqueo total del servicio ante queries lentas bajo estrés | Timeouts + tuning de `max` antes del stress test |
| HIGH-02 | Alta | Observability | #990: sin APM/alertas/uptime externo | Outages/`5xx`/ataques auth pasan inadvertidos | Uptime externo + alertas health/5xx/auth/email + escalamiento |
| HIGH-PERF-03 | Alta | Rate-limit distribuido | `MEM-01`/`CONC-04` | Límites secundarios débiles al escalar; fuga de memoria lenta | Store compartido/persistente o cota + purga |

## Medium-priority gaps

| ID | Área | Evidencia | Acción |
|---|---|---|---|
| MED-01 | Índice de orden | `DB-01` | `reports(clinic_id, created_at desc)` |
| MED-02 | Limpieza de DB | `MEM-03` | Job de purga de sesiones expiradas + retención auditoría |
| MED-03 | Health probe | `RT-01` | Liveness barato vs readiness cacheada + timeouts |
| MED-04 | I/O externa sin timeout | `CONC-02` | `AbortController` en Gmail/Storage; cachear token Gmail |
| MED-05 | Huérfanos de Storage | `CONC-03` | Compensación de borrado o reconciliación |
| MED-06 | Proxy Next API | `POOL-04` | Evaluar origen API directo vs hop SSR |

## Low-priority improvements

| ID | Área | Evidencia | Acción |
|---|---|---|---|
| LOW-01 | Búsqueda trigram | `DB-02` | `pg_trgm` GIN sólo si crece la latencia de búsqueda |
| LOW-02 | Paginación keyset | `DB-03`/`DB-04` | Keyset para clínicas grandes / páginas profundas |
| LOW-03 | Planner logística | `CPLX-01` | Linealizar selección si se sube el cap de 100 |
| LOW-04 | Caché logística | `MEM-02` | Cota de tamaño + barrido |
| LOW-05 | Dead code | `RT-05` | Remover middlewares Express no usados |
| LOW-06 | Logging | `RT-02` | Logging async/muestreo bajo alta carga |

## Suggested PR roadmap

Ordenado por riesgo (operativo primero, luego performance):

1. `ops(security): rotate exposed historical database credentials and document evidence` (BLK-01)
2. `ops(backups): encrypt sensitive backups and complete restore drill` (BLK-02)
3. `test(production): add authenticated smoke checklist and evidence` (BLK-03)
4. `ops(launch): close rollback incident ownership and approvals` (BLK-04)
5. `ops(observability): add production alerts and escalation ownership` (HIGH-02)
6. `perf(db): add statement/connect/idle timeouts and tune postgres pool` (CONC-01)
7. `perf(rate-limit): make secondary limiters shared/persistent or bounded with sweep` (MEM-01/CONC-04)
8. `perf(db): add reports(clinic_id, created_at) index for list ordering` (DB-01)
9. `ops(db): scheduled cleanup of expired sessions and audit retention` (MEM-03)
10. `perf(health): split liveness vs cached readiness with dependency timeouts` (RT-01)
11. `perf(io): add AbortController timeouts to Gmail/Storage and cache Gmail token` (CONC-02)
12. `chore(server): remove unused Express middlewares` (RT-05)
13. `perf(db): trigram search index for reports if latency grows` (DB-02)

## Performance optimization candidates

| ID | Área | Optimización | Riesgo de cambio | Valor esperado | Validación requerida |
|---|---|---|---|---|---|
| OPT-01 | Pool DB | Timeouts + `max` afinado | Bajo | Evita bloqueo total bajo estrés | Stress #4/#5 antes/después |
| OPT-02 | Índice reports | `(clinic_id, created_at desc)` | Bajo (sólo índice) | Menor latencia/CPU de listado | `EXPLAIN ANALYZE` + stress #5 |
| OPT-03 | Rate-limit | Persistente/compartido + purga | Medio | Sin fuga; límites consistentes multi-instancia | Stress #10/#12 |
| OPT-04 | Health | Liveness vs readiness cacheada | Bajo | `/health` deja de saturar pool/Storage | Stress #1 |
| OPT-05 | I/O externa | Timeouts + token Gmail cacheado | Bajo | Sin handlers colgados; menos requests OAuth | Stress #9/#12/#14 |
| OPT-06 | Búsqueda | `pg_trgm` GIN | Bajo (índice) | Búsqueda sub-lineal | Stress #8 + `EXPLAIN` |
| OPT-07 | Limpieza DB | Job de purga | Bajo | Tablas acotadas, scans estables | Métrica de tamaño/tiempo |

## Do-not-touch-in-production list

- Carga destructiva / stress contra producción.
- Writes reales (DB/Storage) sin autorización.
- Emails reales de prueba.
- Uploads reales de prueba.
- Rotaciones de credenciales sin ventana y plan de rollback.
- Migraciones sin rollback verificado.
- Cambios de proveedores/variables reales.
- Borrado de objetos de Storage o filas de DB durante diagnóstico.
- Impresión de `.env`, URLs completas de DB, cookies, tokens o secretos.

## Go / No-Go recommendation

**Capa código / performance: GO WITH CONDITIONS.** El código está limpio: sin N+1,
sin fugas graves, sin O(n²) sin acotar; 2697 tests verdes, build OK, readiness 200.
Condiciones previas a habilitar tráfico real: timeouts de pool DB (`CONC-01`), acotar
o compartir los rate-limit en memoria (`MEM-01`/`CONC-04`), índice de orden por
`created_at` (`DB-01`) y ejecutar el plan de stress en staging espejo.

**Lanzamiento global: NO-GO heredado.** Persisten bloqueantes operativos de #990
(credenciales históricas no rotadas, backups sin cifrar y sin restore drill, smoke
autenticado y gobierno de rollback/alerting pendientes). Hasta cerrarlos con evidencia
sanitizada, la decisión global es NO-GO. Riesgo principal de código: `CONC-01`.

## Appendix: commands run

> Sólo lectura. Sin secretos, sin URLs completas de DB, sin tokens.

```text
# Fase 1 — base
git fetch --prune
git status --short --untracked-files=all     -> limpio
git log -1 --oneline                         -> 1126cbd audit(production): final launch readiness gap review (#990)
git branch --show-current                    -> main
git rev-parse HEAD == git rev-parse origin/main -> 1126cbd05c0ec77c593f31fc2c91909a375c8435
gh pr list --state open                      -> (vacío)
git branch -r --no-merged origin/main        -> (vacío)

# Fase 6 — validaciones locales
pnpm typecheck                               -> OK
pnpm typecheck:test                          -> OK
pnpm test                                    -> tests 2697 / pass 2697 / fail 0 / duration_ms 11730.86
pnpm audit --prod                            -> No known vulnerabilities found (warning DEP0169 informativo)
pnpm build                                   -> dist/index.js 864.5kb (OK)
pnpm security:public-surface                 -> PASS (hallazgos [server-only] en proxy.ts)
pnpm --dir frontend lint                     -> OK
pnpm --dir frontend typecheck                -> OK
pnpm --dir frontend build                    -> OK (públicas estáticas, dashboards dinámicos, Proxy middleware)
pnpm security:public-surface (post-build)    -> PASS

# Fase 6 — E2E (chromium, 1 worker)
pnpm --dir frontend e2e dashboard-auth-redirect.spec.ts visual-smoke.spec.ts --project=chromium --workers=1
                                             -> 12 passed (13.2s)

# Fase 6 — readiness producción (GET-only)
node scripts/ops/verify-production-readiness.mjs --url https://api.vetneb.com.ar
                                             -> PASS readiness: /health returned 200 with database and storage up.

# Cierre — working tree
git checkout -- frontend/next-env.d.ts       (revertir regeneración dev tras E2E)
git status --short --untracked-files=all     -> limpio
git diff --check                             -> limpio
```
