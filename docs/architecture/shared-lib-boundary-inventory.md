# Shared / Lib Boundary Inventory

> **Tipo:** Inventario técnico **docs-only**. No implementa, no mueve archivos, no
> renombra, no toca código, CSS, tests, `package.json`, lockfiles, CI ni schema.
> Único archivo modificado en este PR.
> **Refresh M01** — este documento es el **refresh vigente** de ARCH-3 ejecutado como
> **PR M01** (Fase 0 · Precondiciones) del
> [Backend Enterprise Modularization Program](../audit/backend-enterprise-modularization-program-audit.md)
> (ID `ARCH-AUDIT-110`). Sustituye el estado histórico previo al piloto por un inventario
> operativo para los milestones M01–M48.
> **Base:** `main` · **HEAD:** `f3e22a726c9ddd6f192ed3fa748a370263c7c89e`
> test(e2e): run frontend CI against production build (#1495).
> **Rama:** `docs/backend-modularization-m01`.
> **Fecha del refresh:** 2026-07-18.
> **Documentos rectores:**
> [ARCH-1](../audit/repository-domain-architecture-audit.md) (audit de dominio) ·
> [ARCH-2 (ADR)](./backend-boundary-adr.md) ·
> [ARCH-AUDIT-110 (programa)](../audit/backend-enterprise-modularization-program-audit.md).
> **ID documental:** ARCH-3 · **ID de ejecución del programa:** M01.

Etiquetas de trazabilidad (idénticas a las del programa):
`CONFIRMED` (verificado contra este HEAD) · `INFERRED` (derivado de evidencia verificada) ·
`UNVERIFIED` (no comprobado; se indica qué falta) · `NOT_FOUND` (buscado y ausente) ·
`CONTRADICTED` (la evidencia contradice una premisa previa).

---

## 0. Nota de refresh M01 — histórico vs HEAD vs destino

Este documento se leía como **inventario previo al piloto** (dejar el terreno listo para
ARCH-4). A la fecha, el bloque **Logistics Domain Architecture (ARCH-4 → ARCH-10) está
implementado**, y el programa `ARCH-AUDIT-110` reescribió la secuencia futura (110 → 48
PR). El refresh M01 reclasifica ARCH-3 en tres estados explícitos, que se mantienen
separados en todas las tablas:

- **HISTÓRICO (ARCH-3 original, HEAD `cdf4fb1`):** clasificación por imports que dejó el
  terreno para ARCH-4. Se conserva como referencia, pero **no** es la fuente de verdad
  operativa.
- **CONFIRMED (HEAD `f3e22a7`):** métricas y estructura reales de hoy, recalculadas desde
  archivos versionados (§2–§5). Prevalece sobre cualquier cifra histórica.
- **DESTINO (programa corregido §8 de ARCH-AUDIT-110):** capa/feature objetivo y milestone
  responsable de cada archivo (§4, §6). Es **recomendación de destino**, no estructura ya
  existente: ningún directorio de destino se crea en este PR.

### 0.1 Divergencias HISTÓRICO → HEAD detectadas [CONFIRMED]

| Ítem | ARCH-3 histórico (`cdf4fb1`) | HEAD actual (`f3e22a7`) | Evidencia |
|---|---|---|---|
| `server/features/logistics/domain/` | no existía (shell docs-only pendiente) | **3 archivos TS, 104 LOC**: `index.ts` (16, barrel), `pagination.ts` (52), `route-plan-field-visits.ts` (36) | `git ls-files server/features` + `wc -l` |
| Piloto Logistics | "LISTO para ARCH-4 (read-only shell)" — futuro | ARCH-4..ARCH-10 **implementados**: shell + 2 helpers puros extraídos + barrel + 2 guards | [ARCH-10 closeout](../implementation/arch-10-logistics-domain-architecture-closeout.md) |
| Qué se extrajo primero | recomendaba mover `sla-breach`/`route-planning` | lo que aterrizó fueron **helpers nuevos** (`route-plan-field-visits`, `pagination`); los 4 módulos grandes de `lib/logistics` **siguen sin mover** | §3.2 · [CONTRADICTED parcial] |
| `server/db-logistics.ts` | 1.322 LOC | **1.295 LOC** | `wc -l` |
| `server/lib/**` | "40 archivos, ~7.053 LOC" | **43 archivos, 7.053 LOC** (recuento de archivos corregido; LOC idéntica) | `wc -l` |
| `server/db*.ts` | "14 archivos, ~5.976 LOC" | **14 archivos, 5.949 LOC** (−27 = merma de `db-logistics`) | `wc -l` |
| `server/routes/*.fastify.ts` | "34 rutas, ~25.5k LOC" | **35 rutas, 25.513 LOC** | `wc -l` |
| Universo de tests anclados | "~30 tests de logística" (parcial) | **202 de 437** archivos de test anclan un path `server/` (§7) | `git grep` |

> Nota de reconciliación con el programa: la auditoría `ARCH-AUDIT-110` reportó `108
> archivos / 40.420 LOC`, `routes 34/25.513`, `188` tests ancla y `36 app.register`. Este
> refresh **confirma** 108 archivos y 40.420 LOC, pero **corrige** tres cifras verificables:
> rutas = **35** archivos (no 34), `app.register` con prefijo = **35** (no 36) y tests ancla
> = **202** (no 188). Las correcciones no alteran ninguna conclusión del programa; se
> documentan por trazabilidad (§2, §7).

---

## 1. Executive summary (HEAD `f3e22a7`)

Backend = monolito modular emergente de **108 archivos `.ts` / 40.420 LOC** bajo `server/`,
organizado **Package-by-Layer** con pertenencia a dominio expresada por naming — **excepto
Logistics**, único contexto con frontera de módulo real (`server/features/logistics/`) tras
el piloto ARCH-4..ARCH-10 [CONFIRMED].

- **`server/lib/` sigue siendo un cajón mixto (P2-A):** 43 archivos / 7.053 LOC conviven sin
  frontera declarada — dominio puro, adaptadores http, infra, audit cross-cutting y libs de
  seguridad congeladas. La separación existe sólo por import, no por carpeta.
- **Dominio puro ya sub-paqueteado y extraíble:** los 4 módulos de `server/lib/logistics/`
  (metrics/route-planning/sla-breach/time-window, ~1.5k LOC) importan **sólo tipos** de
  `drizzle/schema.ts`. **Aún no migrados** a `features/logistics/domain/` (lo migrado fue
  otro par de helpers nuevos). Igual condición: `study-tracking`, `report-*`, tokens y
  `professional-bank-eligibility`.
- **Único acoplamiento accidental domain→infra:** `lib/report-workflow-communication.ts`
  (importa `../db.ts` + schema + dispara email). Pertenece a Reports; su desacople por
  puertos es el corazón de la Fase I (M37).
- **`db-*` = repositorio de facto:** cada uno auto-contenido; **ningún `db-*` importa a otro
  `db-*`** [CONFIRMED]. Sólo `db-logistics` delega en dominio.
- **Superficies congeladas (no se tocan sin secuencia de seguridad dedicada):** Auth (3
  realms), `auth-security` (fan-in 34), `fastify-admin-auth`, `login-rate-limit`,
  `session-last-access`, cookies, CORS, CSP, rate limits.
- **Freno dominante:** **202 archivos de test** anclan paths literales de `server/` (§7).
  Cada move exige alinear sus anclas en el **mismo PR**.

**Logistics readiness:** el shell y la capa `domain` mínima ya existen; el programa continúa
en Fase A (mover los 4 módulos puros restantes). Riesgo del contexto: **bajo** (auto-contenido,
tests densos). **`server/lib` residual NO se reordena temprano** — se drena por features y lo
que quede se reclasifica al final (Fase K), por su blast radius (env fan-in 42, cors-headers
30, auth-security 34).

---

## 2. Inventario actual del backend (recalculado) [CONFIRMED]

`server/**/*.ts` — **108 archivos, 40.420 LOC**. Recuento por `git ls-files` + `wc -l` sobre
HEAD `f3e22a7`.

| Categoría | Archivos | LOC | Nota |
|---|---:|---:|---|
| `routes/*.fastify.ts` | **35** | 25.513 | 121 declaraciones `app.<método>` en rutas + 3 inline en `fastify-app.ts`; **35** `app.register` con prefijo |
| `db.ts` + `db-*.ts` | 14 | 5.949 | ningún `db-*` importa a otro `db-*` [CONFIRMED] |
| `lib/**` | 43 | 7.053 | 39 directos + 4 en `lib/logistics/` |
| `middlewares/` | 8 | 943 | `error-handler.ts` (82) **huérfano** |
| `features/logistics/**` | 3 | 104 | `domain/{index,pagination,route-plan-field-visits}.ts` |
| entrypoints | 4 | 848 | `index` (39), `bootstrap` (113), `preflight` (86), `fastify-app` (610) |
| `utils/` | 1 | 10 | `async-handler.ts` **huérfano** Express-era |
| **Total** | **108** | **40.420** | reconcilia: 35+14+43+8+3+4+1 = 108 |

**God-handlers (>1.000 LOC) [CONFIRMED, `wc -l`], 9 en total:**

| Archivo | LOC | Tipo |
|---|---:|---|
| `routes/logistics-route-plans.fastify.ts` | 2.241 | ruta |
| `routes/auth.fastify.ts` | 1.514 | ruta (Auth, congelado) |
| `routes/logistics-field-visits.fastify.ts` | 1.421 | ruta |
| `routes/clinic-public-profile.fastify.ts` | 1.316 | ruta |
| `db-logistics.ts` | 1.295 | repositorio de facto |
| `routes/admin-study-tracking.fastify.ts` | 1.205 | ruta |
| `routes/admin-auth.fastify.ts` | 1.044 | ruta (Auth, congelado) |
| `routes/study-tracking.fastify.ts` | 1.034 | ruta |
| `routes/logistics-route-events.fastify.ts` | 1.008 | ruta |

**Fan-in de `server/lib` (archivos de `server/` que importan cada módulo, estáticos +
dinámicos) [CONFIRMED, `git grep`]:**

`env` 42 · `auth-security` 34 · `cors-headers` 30 · `runtime-timing` 21 ·
`session-last-access` 17 · `fastify-admin-auth` 15 · `audit` 15 · `permissions` 14 ·
`supabase` 8 · `rate-limit-store` 8 · `list-pagination` 8 · `http-types` 8 · `email` 5.

> Metodología de fan-in: se cuentan archivos de `server/` que importan `lib/<módulo>`
> incluyendo **imports dinámicos** (`await import("../lib/auth-security.ts")` en los tres
> middlewares de auth y 31 rutas). Ignorar los dinámicos subcontabiliza `auth-security`
> (1→34), `env` (39→42), `supabase` (2→8) y `email` (3→5).

**Transacciones:** **11 call-sites de `.transaction(` en exactamente 3 archivos**:
`db-logistics.ts` (7), `db.ts` (2), `db-admin-clinics.ts` (2) [CONFIRMED]. **Email desde
rutas:** 5 archivos — `contact`, `particular-tokens`, `admin-particular-tokens`,
`study-tracking`, `admin-study-tracking` [CONFIRMED].

**Huérfanos Express-era (cero consumidores runtime; los mantiene vivo su único test
`test/unit/infrastructure/error-and-async-middleware.test.ts`) [CONFIRMED]:**
`server/utils/async-handler.ts` (10) y `server/middlewares/error-handler.ts` (82). Ambos son
el objetivo de **M02**.

**Registro Fastify [CONFIRMED]:** `fastify-app.ts` con 35 `app.register` con prefijo; el
prefijo `/api/reports` aparece **dos veces** (`fastify-app.ts:575` y `:580` — `reports` y
luego `reports-status`): el orden de registro es contrato (guard nuevo en M40).

---

## 3. Estado del piloto Logistics tras ARCH-4..ARCH-10 [CONFIRMED]

`server/features/logistics/` ya existe como **frontera de módulo real** (única en el backend).
El árbol de dominio vigente:

| Archivo | LOC | Estado |
|---|---:|---|
| `server/features/logistics/domain/index.ts` | 16 | Barrel público (ARCH-8). Re-exporta helpers puros; sin lógica. |
| `server/features/logistics/domain/route-plan-field-visits.ts` | 36 | Helper puro `normalizeGenerateHeuristicFieldVisitIds` (ARCH-5). |
| `server/features/logistics/domain/pagination.ts` | 52 | `LOGISTICS_DEFAULT_LIMIT/MAX_LIMIT`, `normalizeLogisticsLimit/Offset` (ARCH-7). |
| `server/features/logistics/{,domain,application,infrastructure,routes}/README.md` | — | Fronteras de capa declaradas (ARCH-4 shell); `application/infrastructure/routes` sin código aún. |

**Guards activos del contexto [CONFIRMED]:**
`test/architecture/logistics-domain-boundary-guard.test.ts` (pureza + consumo por barrel) ·
`test/unit/domain/logistics/logistics-domain-barrel.test.ts` (re-export idéntico) ·
`test/unit/domain/logistics/logistics-pagination.test.ts` ·
`test/unit/domain/logistics/logistics-heuristic-field-visit-ids.test.ts`.

**Divergencia clave respecto de ARCH-2/ARCH-3 histórico [CONTRADICTED]:** el plan preveía que
ARCH-5 movería `sla-breach.ts`. Lo que **realmente** se implementó fue la extracción de
**helpers nuevos** desde los handlers (normalización de ids de field visits + paginación). En
consecuencia, los **4 módulos puros grandes de `server/lib/logistics/` siguen en `lib/`, sin
mover**:

| `server/lib/logistics/` | LOC | Imports | Destino | Milestone |
|---|---:|---|---|---|
| `metrics.ts` | 829 | sólo tipos `drizzle/schema` | `features/logistics/domain/` | **M04** |
| `route-planning.ts` | 515 | sólo tipos `drizzle/schema` | `features/logistics/domain/` | **M03** |
| `sla-breach.ts` | 111 | tipo `SlaTargetType` | `features/logistics/domain/` | **M02b** |
| `time-window.ts` | 40 | sólo tipos schema | `features/logistics/domain/` | **M02b** |

---

## 4. Inventario vigente de `server/lib` [CONFIRMED clasificación por import]

`server/lib/**` — 43 archivos, 7.053 LOC. Clasificación por **imports reales** (no por
nombre); fan-in = archivos de `server/` que lo importan. `Estado`: **mover** (a una feature) ·
**permanecer/kernel** · **drenar** (sale con la feature que lo consume, no en un PR de `lib`) ·
**diferir** (a Fase K) · **congelado** (seguridad; sólo secuencia dedicada) · **eliminar**
(huérfano).

| Path (LOC) | Contexto / condición | Clasificación | Fan-in | Riesgo | Destino recomendado | Milestone | Estado |
|---|---|---|---:|---|---|---|---|
| `lib/logistics/metrics.ts` (829) | Logistics | domain | — | Bajo | `features/logistics/domain/` | M04 | mover |
| `lib/logistics/route-planning.ts` (515) | Logistics | domain | — | Bajo | `features/logistics/domain/` | M03 | mover |
| `lib/logistics/sla-breach.ts` (111) | Logistics | domain | — | Bajo | `features/logistics/domain/` | M02b | mover |
| `lib/logistics/time-window.ts` (40) | Logistics | domain | — | Bajo | `features/logistics/domain/` | M02b | mover |
| `lib/logistics-route-plans-cache.ts` (107) | Logistics | infrastructure (cache) | — | Bajo | `features/logistics/infrastructure/` | M13 | mover |
| `lib/study-tracking.ts` (648) | Study Tracking | domain | — | Bajo | `features/study-tracking/domain/` | M30 | mover |
| `lib/token-study-tracking.ts` (155) | Study Tracking | domain (token) | — | Bajo | `features/study-tracking/domain/` | M30 | mover |
| `lib/report-status.ts` (64) | Reports | domain | — | Bajo | `features/reports/domain/` | M36 | mover |
| `lib/report-study-types.ts` (69) | Reports | domain (catálogo) | — | Medio | `features/reports/domain/` | M36 | mover (census path-aware in-PR) |
| `lib/reports.ts` (105) | Reports | domain | — | Bajo | `features/reports/domain/` | M36 | mover |
| `lib/report-workflow-communication.ts` (57) | Reports | **acoplamiento accidental** (db+schema+email) | 1 | Medio | `features/reports/` (puerto datos + puerto notif) | M37 | mover (desacople) |
| `lib/report-access-token.ts` (171) | Report Access | domain (token) | — | Bajo | `features/report-access/domain/` | M34 | mover |
| `lib/particular-token.ts` (133) | Particular Access | domain (token) | — | Bajo | `features/particular-access/domain/` | M33 | mover |
| `lib/professional-bank-eligibility.ts` (124) | Public Professionals | domain | — | Bajo | `features/public-professionals/domain/` | M21 | movido; path legacy retirado en M24, cero consumidores |
| `lib/public-pricing-cache.ts` (54) | Pricing | infrastructure (cache) | — | Bajo | `features/pricing/infrastructure/` | M18 | movido byte-idéntico (M18 mergeado — PR #1519, squash `5f99b5f…`, 2026-07-21); **shim legacy retirado en M19 (mergeado y cerrado — PR #1521, squash `d1b2511…`, 2026-07-21)**: ambos shims legacy eliminados, rutas thin vía servicio directo, cero consumidores operativos |
| `lib/public-professionals-rate-limit.ts` (9) | Public Professionals | infra (wrapper) | — | Bajo | `features/public-professionals/infrastructure/` (store queda en lib) | M23 | movido; path legacy retirado en M24, store compartido intacto |
| `lib/public-report-access-rate-limit.ts` (4) | Report Access | infra (wrapper) | — | Bajo | con Report Access | M34 | mover (con ruta) |
| `lib/report-access-token-rate-limit.ts` (4) | Report Access | infra (wrapper) | — | Bajo | con Report Access | M34 | mover (con ruta) |
| `lib/permissions.ts` (57) | Users/Roles (autorización) | **shared kernel** | 14 | Medio | permanece en `lib` (kernel documentado) | M42 (docs+guard) | permanecer/kernel |
| `lib/audit.ts` (261) | Audit | cross-cutting | 15 | Bajo/Medio | puerto por contexto al extraer cada feature | drena por features | drenar |
| `lib/audit-log.ts` (462) | Audit | cross-cutting | 1 | Bajo/Medio | ídem | drena por features | drenar |
| `lib/admin-audit.ts` (20) | Audit | cross-cutting (wrapper) | — | Bajo | ídem | drena | drenar |
| `lib/clinic-audit.ts` (15) | Audit | cross-cutting (wrapper) | — | Bajo | ídem | drena | drenar |
| `lib/particular-audit.ts` (11) | Audit | cross-cutting (wrapper) | — | Bajo | ídem | drena | drenar |
| `lib/email.ts` (998) | Notificación | infrastructure | 5 | Bajo | cliente queda en `lib`; features consumen por puerto | M31/M37 (puerto) | diferir/drenar |
| `lib/supabase.ts` (200) | Storage | infrastructure | 8 | Bajo | cliente queda en `lib`; puerto storage por feature | M37/M39 (puerto) | diferir/drenar |
| `lib/rate-limit-store.ts` (207) | Infra compartida | infrastructure | 8 | Bajo | permanece en `lib`; wrappers migran con features | Fase K | diferir |
| `lib/env.ts` (244) | Infra kernel | infrastructure | 42 | **Alto (blast radius)** | `lib/infra` sólo al final, o no mover | M47 / no mover | diferir |
| `lib/logger.ts` (22) | Infra | infrastructure | 0 | Bajo | `lib/infra` (naming) | M47 | diferir |
| `lib/cors-headers.ts` (143) | HTTP | http adapter | 30 | **Alto** | `lib/http` con revisión | M46 | diferir |
| `lib/api-request-id.ts` (104) | HTTP | http adapter | 1 | Bajo | `lib/http` | M46 | diferir |
| `lib/api-response-security.ts` (65) | HTTP/seguridad | http adapter | 1 | Medio | `lib/http` **con revisión de seguridad** | M46 (SEC) | diferir/congelado |
| `lib/sensitive-response-cache.ts` (19) | HTTP/seguridad | http adapter | 1 | Medio | `lib/http` **con revisión de seguridad** | M46 (SEC) | diferir/congelado |
| `lib/http-runtime.ts` (85) | Observabilidad | infra (importa `db`) | 2 | Medio | `lib/infra` | M47 | diferir |
| `lib/runtime-timing.ts` (26) | Observabilidad | infra | 21 | Bajo | `lib/infra`; thin-PRs alinean imports | Fase K | diferir |
| `lib/schema-health.ts` (168) | Maintenance/ops | infra (importa `db`+supabase) | 1 | Medio | infra de ops; fuera de features | M20 (ownership KEEP, ops) | permanecer |
| `lib/contact-rate-limit.ts` (48) | Contact/ops | infra | — | Bajo | ops/plataforma; fuera de features | — (ops) | permanecer |
| `lib/http-types.ts` (36) | Contrato http | **shared técnico** | 8 | Bajo | shared técnico; candidato `lib/shared` (C3) | contingencia C3 | permanecer |
| `lib/list-pagination.ts` (54) | Paginación | **shared técnico** | 8 | Bajo | shared técnico; candidato `lib/shared` (C3) | contingencia C3 | permanecer |
| `lib/auth-security.ts` (47) | Auth | seguridad (hashing/rehash) | 34 | **Alto (security)** | — | secuencia seguridad C4 | congelado |
| `lib/fastify-admin-auth.ts` (354) | Auth | http adapter / auth guard | 15 | **Alto (security)** | — | secuencia seguridad C4 | congelado |
| `lib/login-rate-limit.ts` (195) | Auth | infra (auth) | 3 | Medio (auth) | — | secuencia seguridad C4 | congelado |
| `lib/session-last-access.ts` (13) | Auth/sesión | infra cross-cutting | 17 | Medio (auth) | — | secuencia seguridad C4 | congelado |

> Regla de no big-move (§8/restr. 17 del programa, R-06 del Risk Register): **no reordenar
> `server/lib` por taxonomía antes de las features.** `env`, `cors-headers` y `auth-security`
> concentran el mayor fan-in del backend; moverlos temprano maximiza el blast radius sin crear
> ninguna frontera que un guard no pueda fijar hoy sobre los paths actuales.

### 4.1 Inventario `db-*` [CONFIRMED]

`server/db*.ts` — 14 archivos, 5.949 LOC. Todos mezclan queries Drizzle + mapping + validación
(P1-B). **Ningún `db-*` importa a otro `db-*`** [CONFIRMED, `git grep`].

| Path (LOC) | Contexto | Mezcla | `.transaction(` | Destino | Milestone | Estado |
|---|---|---|:--:|---|---|---|
| `db.ts` (873) | infra compartida | pool + cliente Drizzle (kernel de datos) | 2 | permanece (base de todos los repos) | — | permanecer |
| `db-logistics.ts` (1.295) | Logistics | queries+mapping; **importa `lib/logistics`** | 7 | `features/logistics/infrastructure/` (archivo completo, tx intactas) | M12 | mover |
| `db-public-professionals.ts` (756) | Public Professionals | persistencia+mapping (SQL-drift-guard) | 0 | `features/public-professionals/infrastructure/` | M22 | movido; path legacy retirado en M24, SQL-drift preservado |
| `db-admin-clinics.ts` (694) | Clinics | persistencia+mapping+validación | 2 | `features/clinics/infrastructure/` (tx exactas) | M26 | mover |
| `db-audit.ts` (413) | Audit (cross-cutting) | persistencia+mapping | 0 | permanece (cross-cutting) | — | permanecer/drenar |
| `db-admin-users-roles.ts` (357) | Users/Roles | persistencia+validación | 0 | `features/users-roles/infrastructure/` | M43 | mover |
| `db-study-tracking.ts` (295) | Study Tracking | persistencia+mapping | 0 | `features/study-tracking/infrastructure/` | M31 | mover |
| `db-admin-sessions.ts` (286) | Sessions/Auth | persistencia | 0 | — | secuencia seguridad C4 | congelado |
| `db-report-workflow.ts` (220) | Reports | persistencia+mapping (side-effect email) | 0 | `features/reports/infrastructure/` (por puerto) | M37 | mover |
| `db-particular.ts` (204) | Particular Access | persistencia | 0 | `features/particular-access/infrastructure/` | M33 | mover |
| `db-report-access.ts` (168) | Report Access | persistencia | 0 | `features/report-access/infrastructure/` | M34 | mover |
| `db-pricing.ts` (160) | Pricing | CRUD + `serializePricingItem` + guard patch | 0 | `features/pricing/infrastructure/` | M18 | movido completo (M18 mergeado — PR #1519, squash `5f99b5f…`, 2026-07-21); path legacy conservado como shim temporal hasta M19; sólo 2 specifiers reapuntados |
| `db-maintenance.ts` (122) | Maintenance/ops | dry-run, schema-health | 0 | infra de ops; fuera de features | M20 (ownership KEEP, ops) | permanecer |
| `db-admin-failed-login-alerts.ts` (106) | Failed Login/Auth | persistencia | 0 | — | secuencia seguridad C4 | congelado |

---

## 5. Superficie de rutas relevante [CONFIRMED]

`server/routes/*.fastify.ts` — 35 archivos, 25.513 LOC. Rutas por contexto migrable (los
paths y contratos públicos **no cambian**; sólo se adelgaza el handler delegando en
application):

| Ruta (LOC) | Contexto | Prefijo | Destino thin-route | Milestone |
|---|---|---|---|---|
| `logistics-route-plans.fastify.ts` (2.241) | Logistics | `/api/logistics/route-plans` | thin (split lectura/escritura) | M14 |
| `logistics-field-visits.fastify.ts` (1.421) | Logistics | `/api/logistics/field-visits` | thin | M15 |
| `logistics-route-events.fastify.ts` (1.008) | Logistics | `/api/logistics/route-events` | thin | M16 |
| `logistics-sla.fastify.ts` (792) | Logistics | `/api/logistics/sla` | thin | M16 |
| `admin-pricing.fastify.ts` (513) / `public-pricing.fastify.ts` (136) | Pricing | `/api/admin/pricing`, `/api/pricing` | thin (query service directo) | M19 |
| `public-professionals.fastify.ts` (479) | Public Professionals | público estable | thin vía query service directo + rate-limit canónico; contratos intactos | M23 |
| `admin-clinics.fastify.ts` (987) / `clinic-public-profile.fastify.ts` (1.316) | Clinics | admin + público | thin (disclosure verde) | M27/M28 |
| `admin-study-tracking.fastify.ts` (1.205) / `study-tracking.fastify.ts` (1.034) / `particular-study-tracking.fastify.ts` | Study Tracking | admin/clínica/particular | thin + puerto email | M32/M32b |
| `particular-tokens.fastify.ts` (872) / `admin-particular-tokens.fastify.ts` (868) | Particular Access | tokens | thin | M33 |
| `report-access-tokens.fastify.ts` (873) / `admin-report-access-tokens.fastify.ts` (666) / `public-report-access.fastify.ts` | Report Access | tokens + rate limits públicos | thin | M34 |
| `admin-reports.fastify.ts` (838) / `admin-report-workflow.fastify.ts` (479) / `reports.fastify.ts` (769) / `reports-status.fastify.ts` (610) | Reports | doble registro `/api/reports` (orden contractual) | thin (orden preservado) | M39/M40 |
| `admin-users-roles.fastify.ts` (645) | Users/Roles | admin | thin | M43 |
| `auth.fastify.ts` (1.514) / `admin-auth.fastify.ts` (1.044) / `particular-auth.fastify.ts` (938) | Auth (3 realms) | — | **congelado** | secuencia C4 |
| `contact.fastify.ts` (393) / `admin-system-*.fastify.ts` / `app-version.fastify.ts` | Plataforma/ops | — | fuera de features | — |

---

## 6. Matriz origen-destino por contexto

Una **decisión canónica por path fuente**. `MOVE` (a una feature) · `KEEP` (permanece) ·
`DEFER` (Fase K) · `FROZEN` (secuencia de seguridad C4) · `REMOVE` (huérfano) · `CONTINGENCY`
(sólo si aplica). Compat/shim = re-export temporal documentado en la descripción del PR;
rollback = revert independiente del PR (§8). "Tests anclados" remite a §7.

| Contexto | Path origen | Capa actual | Path destino | Capa destino | Mxx | Prerequisitos | Contratos afectados | Guard | Compat/shim | Rollback | Riesgo | Decisión |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Logistics | `lib/logistics/{sla-breach,time-window}.ts` | domain (en lib) | `features/logistics/domain/` | domain | M02b | shell ARCH-4 (hecho) | ninguno (dominio puro) | `logistics-domain-boundary-guard` | sí (re-export) | revert PR | Bajo | MOVE |
| Logistics | `lib/logistics/route-planning.ts` | domain (en lib) | `features/logistics/domain/` | domain | M03 | M02b | ninguno | ídem | sí | revert | Bajo | MOVE |
| Logistics | `lib/logistics/metrics.ts` | domain (en lib) | `features/logistics/domain/` | domain | M04 | M03 | contratos de métricas por-ruta | ídem | sí | revert | Bajo | MOVE |
| Logistics | `db-logistics.ts` | infra (repo) | `features/logistics/infrastructure/` | infrastructure | M12 | Fase B | tx (7 call-sites); serialización ISO | infra guard (nuevo) | sí (documentado) | revert | Alto | MOVE |
| Logistics | `lib/logistics-route-plans-cache.ts` | infra (cache) | `features/logistics/infrastructure/` | infrastructure | M13 | M12 | `logistics-route-plans-cache-runtime` | ídem | sí | revert | Medio | MOVE |
| Pricing | `db-pricing.ts` + `lib/public-pricing-cache.ts` | infra | `features/pricing/infrastructure/` | infrastructure | M18 | precedente Logistics | serialización pricing | infra guard (`pricing-infrastructure-boundary-guard`) | shims retirados en M19 | revert | Bajo | MOVE (M18 mergeado — PR #1519, squash `5f99b5f…`, 2026-07-21). **M19 mergeado y cerrado — PR #1521, squash `d1b2511…`, 2026-07-21: rutas thin vía servicios directos `features/pricing/{admin,public}-pricing-service.ts`; ambos shims legacy retirados, cero consumidores operativos** |
| Public Professionals | `lib/professional-bank-eligibility.ts` | domain (en lib) | `features/public-professionals/domain/` | domain | M21 | M17 | ninguno | domain guard | retirado M24 | revert | Bajo | MOVE — canónico estable; path legacy ausente |
| Public Professionals | `db-public-professionals.ts` | infra | `features/public-professionals/infrastructure/` | infrastructure | M22 | M21 | SQL-drift-guard (histopatología) | infra guard | retirado M24 | revert | Medio | MOVE — canónico estable; path legacy ausente |
| Public Professionals | `lib/public-professionals-rate-limit.ts` | infra (wrapper) | `features/public-professionals/infrastructure/` | infrastructure | M23 | M22 | rate limit público | infra guard | retirado M24; store queda en lib | revert | Bajo | MOVE — canónico estable; path legacy ausente |
| Clinics | `db-admin-clinics.ts` | infra (repo) | `features/clinics/infrastructure/` | infrastructure | M26 | M25 | tx (2 call-sites); `reconcile-public-profile-db-contract` | infra guard | sí | revert | Alto | MOVE |
| Clinics | `middlewares/clinic-permissions.ts` | http/authz | permanece (RBAC clínica) | — | — | — | `clinic-permissions-middleware` | — | — | revert | Medio | KEEP |
| Study Tracking | `lib/{study-tracking,token-study-tracking}.ts` | domain (en lib) | `features/study-tracking/domain/` | domain | M30 | M17 | ninguno | domain guard (nuevo) | sí | revert | Bajo | MOVE |
| Study Tracking | `db-study-tracking.ts` | infra | `features/study-tracking/infrastructure/` | infrastructure | M31 | M30 | side-effect email → puerto | infra guard | sí | revert | Alto | MOVE |
| Particular Access | `lib/particular-token.ts` + `db-particular.ts` | domain+infra | `features/particular-access/{domain,infrastructure}/` | domain+infra | M33 | Fase G | contratos no-secrets/no-stack de token | domain+infra guard | sí | revert | Alto | MOVE |
| Report Access | `lib/report-access-token.ts` + `db-report-access.ts` + rate limits | domain+infra | `features/report-access/{domain,infrastructure}/` | domain+infra | M34 | M33 | rate limits públicos; anclas seguridad | domain+infra guard | sí | revert | Alto | MOVE |
| Reports | `lib/{report-status,report-study-types,reports}.ts` | domain (en lib) | `features/reports/domain/` | domain | M36 | Fase H | **census catálogo path-aware in-PR** (TEST-ARCH-15) | domain guard | sí | revert | Medio | MOVE |
| Reports | `lib/report-workflow-communication.ts` | **acoplamiento accidental** | `features/reports/` (puerto datos+notif) | application/infra | M37 | M36 | orden side-effects; email | app+infra guard | sí | revert | Alto | MOVE |
| Reports | `db-report-workflow.ts` | infra | `features/reports/infrastructure/` | infrastructure | M37 | M36 | consistencia DB↔email (sin compensación nueva) | infra guard | sí | revert | Alto | MOVE |
| Reports | `lib/supabase.ts` | infra (storage, 8 consumidores) | permanece; consumo por puerto storage | — | M37/M39 | — | `global-storage-report-safety` | — | por puerto | revert | Alto | KEEP (por puerto) |
| Users/Roles | `db-admin-users-roles.ts` | infra | `features/users-roles/infrastructure/` | infrastructure | M43 | M42 | search contract | infra guard | sí | revert | Medio | MOVE |
| Users/Roles | `lib/permissions.ts` | **shared kernel** (fan-in 14) | permanece en `lib` (documentado) | — | M42 | — | `logistics-rbac-permission-contract` y otros consumidores | guard de kernel (docs) | n/a | n/a | Alto si se mueve | KEEP |
| Audit/cross-cutting | `lib/{audit,audit-log,admin-audit,clinic-audit,particular-audit}.ts`, `db-audit.ts` | cross-cutting | permanece; puerto por contexto al extraer | — | drena por features | — | contratos audit por-ruta; orden audit→respuesta | — | por puerto | revert | Medio | KEEP/DEFER |
| Auth/security frozen | `auth.fastify`, `admin-auth.fastify`, `particular-auth.fastify`, `lib/{auth-security,fastify-admin-auth,login-rate-limit,session-last-access}.ts`, `db-admin-sessions.ts`, `db-admin-failed-login-alerts.ts`, `middlewares/{admin-auth,auth,particular-auth}.ts` | auth (3 realms) | — | — | — (fuera del programa) | diseño + sign-off | cookies, CSRF, rate limits por realm | 16 guards `architecture/security/*` | — | — | **Crítico** | FROZEN (C4) |
| Shared infra residual | `lib/{env,logger,cors-headers,api-request-id,api-response-security,sensitive-response-cache,runtime-timing,http-runtime,rate-limit-store}.ts` | http/infra | `lib/{http,infra}` **sólo al final** | — | M46/M47 | todas las features cerradas | headers/CORS/observabilidad por-ruta | guards de frontera | shims documentados | revert | Alto si se adelanta | DEFER |
| Shared técnico | `lib/{http-types,list-pagination}.ts` | shared | `lib/shared` (si se decide) | — | C3 | — | paginación/tipos http | — | — | revert | Bajo | CONTINGENCY |
| Plataforma/ops | `contact.fastify`, `lib/contact-rate-limit.ts`, `admin-system-*.fastify`, `lib/schema-health.ts`, `db-maintenance.ts`, `app-version.fastify.ts` | ops | permanece (no es bounded context) | — | M20 (ownership documentado; fuera de features) | — | health/version/contact | — | — | n/a | KEEP |
| Huérfanos | `server/utils/async-handler.ts`, `server/middlewares/error-handler.ts` (+ su test) | Express-era muerto | eliminado | — | **M02** | — | ninguno (cero consumidores runtime) | actualizar `tracked-source-inventory` | revert | Bajo | REMOVE |

---

## 7. Inventario de tests anclados a paths de `server/`

**Total de archivos de test versionados:** 437 (`test/**/*.ts`).
**Archivos que anclan al menos un path fuente de `server/`:** **202** [CONFIRMED, `git grep`].

> Metodología (reproducible): `git grep -lE "server/(routes|lib|db|db-|features|middlewares|
> utils|fastify-app|index|bootstrap|preflight)" -- 'test/*.ts' 'test/**/*.ts'`. Un match laxo
> de `"server/"` da 205; se descuentan **3** tests de UI frontend
> (`frontend-dashboard-{hub-hero,last-module,password-change-ui}`) que mencionan `server/` en
> prosa/paths de frontend sin anclar un módulo backend. Los 202 restantes anclan un path
> backend real. La cifra histórica de la auditoría (`188`) queda **CONTRADICTED**; el total
> operativo es **202**.

**Tipos de ancla observados [CONFIRMED, muestreados]:**

- **Import directo/estático** — `import { ENV } from "../../server/lib/env.ts"`
  (`test/helpers/fastify-app-route-stubs.ts`).
- **Import dinámico** — `await import("../../../server/lib/cors-headers.ts")`
  (`cors-headers-shared-helper.test.ts`, arneses de integración).
- **`readFileSync`/inspección de fuente** — `read("server/db-admin-clinics.ts")`
  (`admin-clinics-db-contract.test.ts`).
- **Listado/censo hardcodeado** — `path: "server/routes/auth.fastify.ts"` en
  `security-critical-route-surface-registry.test.ts` (28 paths); lista de fuentes en
  `tracked-source-inventory.test.ts`; catálogo en `report-study-types-catalog.test.ts`.
- **Regex de path / walker** — constante `domainDir = "server/features/logistics/domain"` +
  escaneo (`logistics-domain-boundary-guard.test.ts`).
- **Snapshot de registro / fixture-mock con module path** — `fastify-app-route-stubs.ts`,
  arneses `createFastifyApp`.
- **Guard de arquitectura/seguridad** — los 16 de `architecture/security/**`.

### 7.1 Tabla resumen por categoría (reconciliación) [CONFIRMED]

Cada archivo se asigna a **una** categoría primaria (por el path fuente que fija). Las
secundarias se anotan en §7.3 sin doble conteo.

| # | Categoría | Tests | Milestone(s) que alinea las anclas |
|---|---|---:|---|
| 1 | Auth / Sessions / Security | 40 | FROZEN (secuencia C4); DoD de cada cierre |
| 2 | DB / schema / infrastructure | 24 | M02 (huérfanos), per-contexto, DEFER M46/M47 |
| 3 | HTTP / CORS / observability | 21 | thin-PRs (M14+); `lib/http` DEFER M46 |
| 4 | Logistics | 18 | Fase A–C (M02b–M17) |
| 5 | Audit / cross-cutting | 16 | drena por feature; DoD de cada cierre |
| 6 | Reports | 14 | Fase I (M36–M41) |
| 7 | Report Access | 11 | Fase H (M34) |
| 8 | Public Professionals | 10 | Fase E (M21–M24) |
| 9 | Frontend/build (anclando backend) | 10 | n/a (no lo mueve el programa backend) |
| 10 | Study Tracking | 9 | Fase G (M30–M32b/M35) |
| 11 | Platform / Ops (Contact, Health, Version) | 7 | M20 (ownership documentado); permanece fuera de features |
| 12 | Global inventories & architecture guards | 7 | M01/M02 + cada fase |
| 13 | Clinics | 6 | Fase F (M25–M29) |
| 14 | Particular Access | 5 | Fase H (M33) |
| 15 | Users / Roles | 2 | Fase J (M42–M43) |
| 16 | Pricing | 2 | Fase D (M18–M20, cerrada) |
| | **Total** | **202** | suma exacta = 202 [CONFIRMED] |

### 7.2 Notas de clasificación

- **Regla primaria:** categoría = bounded context cuyo path fuente fija el test. Los censos
  repo-wide (`tracked-source-inventory`, `fastify-only-guardrail`, toolchain) → *Global
  guards*. Los guards de `architecture/security/**` que fijan superficies cruzadas de
  ruta/cookie/tenant → *Auth/Security*. Los tests de UI que anclan un path backend → *Frontend*.
- **`security-critical-route-surface-registry.test.ts`** fija **28** paths
  `server/routes/*.fastify.ts` + libs de seguridad: es el ancla más costosa; cualquier thin-PR
  que cambie un path de ruta la alinea en el mismo PR.
- **`report-study-types-catalog.test.ts`** censa el catálogo por lista hardcodeada
  (bloqueador conocido TEST-ARCH-15): el move de `lib/report-study-types.ts` exige el ajuste
  path-aware **en el mismo PR** (M36).
- **`env.ts` como ancla transversal de tests:** decenas de arneses de integración importan
  `server/lib/env.ts` dinámicamente. Es una razón adicional para **diferir** el move de `env`
  (Fase K): su blast radius de anclas de test excede al de código.

### 7.3 Archivos que cruzan contextos (categoría primaria + secundarias, sin doble conteo)

- `logistics-rbac-permission-contract.test.ts` — primaria **Logistics**; secundarias
  Users/Roles (`permissions.ts`), Clinics (RBAC clínica).
- `security-critical-route-surface-registry.test.ts` — primaria **Auth/Security**; secundaria
  todos los contextos con ruta (28 paths).
- `security-cross-tenant-idor-contract.test.ts` / `security-resource-ownership-boundaries.test.ts`
  — primaria **Auth/Security**; secundarias Clinics, Reports, Study Tracking (multi-tenant).
- `particular-study-tracking.fastify.test.ts` — primaria **Study Tracking**; secundaria
  Particular Access (realm de la ruta).
- `frontend-dashboard-logistics-hub.test.ts` — primaria **Frontend**; secundaria Logistics.
- `frontend-public-professionals-scalable-directory.test.ts` — primaria **Frontend**;
  secundaria Public Professionals.
- `global-storage-report-safety-contract.test.ts` / `storage-suite-completeness.test.ts` —
  primaria **Reports**; secundaria infraestructura Supabase.

### 7.4 Apéndice completo — paths de los 202 tests por categoría

**Logistics (18) — M02b–M17**
```
test/architecture/logistics-domain-boundary-guard.test.ts
test/integration/adapters/controllers/logistics-audit-runtime.test.ts
test/integration/adapters/controllers/logistics-route-plans-cache-runtime.test.ts
test/integration/adapters/controllers/logistics-route-plans-heuristic-runtime.test.ts
test/integration/adapters/controllers/logistics-route-plans-metrics-runtime.test.ts
test/integration/adapters/controllers/logistics-sla-routes-integration.fastify.test.ts
test/unit/contracts/clinic/logistics-rbac-permission-contract.test.ts
test/unit/domain/logistics/logistics-domain-barrel.test.ts
test/unit/domain/logistics/logistics-heuristic-field-visit-ids.test.ts
test/unit/domain/logistics/logistics-metrics-suite-completeness.test.ts
test/unit/domain/logistics/logistics-metrics.test.ts
test/unit/domain/logistics/logistics-pagination.test.ts
test/unit/domain/logistics/logistics-route-event-aggregation.test.ts
test/unit/domain/logistics/logistics-route-planning.test.ts
test/unit/domain/logistics/logistics-sla-compliance.test.ts
test/unit/infrastructure/logistics/logistics-route-plans-cache.test.ts
test/unit/infrastructure/logistics/logistics-sla-breach-runtime.test.ts
test/unit/migrations/logistics/logistics-time-windows-schema.test.ts
```

**Pricing (2) — M18–M20 (Fase D cerrada)**
```
test/integration/adapters/controllers/admin-pricing-api.test.ts
test/integration/adapters/controllers/public-pricing-api.test.ts
```

**Public Professionals (10) — M21–M24**
```
test/architecture/public-professionals-source-boundaries.test.ts
test/integration/adapters/controllers/public-professionals-logging-invariants.test.ts
test/integration/adapters/controllers/public-professionals-response-headers-invariants.test.ts
test/integration/adapters/controllers/public-professionals-route-surface-invariants.test.ts
test/integration/adapters/controllers/public-professionals.fastify.test.ts
test/unit/contracts/public-professionals/professional-bank-eligibility.test.ts
test/unit/contracts/public-professionals/public-professionals-query-parsing-invariants.test.ts
test/unit/contracts/public-professionals/public-professionals-rate-limit.test.ts
test/unit/contracts/public-professionals/public-professionals-registration-invariants.test.ts
test/unit/contracts/public-professionals/public-professionals-serialization-invariants.test.ts
```

**Clinics (6) — M25–M29**
```
test/integration/adapters/controllers/admin-clinics.fastify.test.ts
test/integration/adapters/controllers/clinic-public-profile.fastify.test.ts
test/unit/contracts/admin/admin-clinics-auth-contract.test.ts
test/unit/contracts/admin/admin-clinics-db-contract.test.ts
test/unit/contracts/clinic/clinic-management-route-policy.test.ts
test/unit/contracts/clinic/clinic-permissions-middleware.test.ts
```

**Study Tracking (9) — M30–M32b/M35**
```
test/architecture/audit-study-tracking-gaps.test.ts
test/integration/adapters/controllers/admin-study-tracking.fastify.test.ts
test/integration/adapters/controllers/particular-study-tracking.fastify.test.ts
test/integration/adapters/controllers/study-tracking.fastify.test.ts
test/unit/contracts/study-tracking/study-tracking-suite-completeness.test.ts
test/unit/contracts/study-tracking/token-study-tracking.test.ts
test/unit/domain/study-tracking/study-tracking-clinic-schema.test.ts
test/unit/domain/study-tracking/study-tracking-edge.test.ts
test/unit/domain/study-tracking/study-tracking.test.ts
```

**Particular Access (5) — M33**
```
test/integration/adapters/controllers/admin-particular-tokens.fastify.test.ts
test/integration/adapters/controllers/particular-tokens.fastify.test.ts
test/unit/contracts/admin/admin-particular-token-schema.test.ts
test/unit/contracts/particular/particular-token-edge.test.ts
test/unit/domain/particular-token.test.ts
```

**Report Access (11) — M34**
```
test/helpers/report-foreign-access-scope.ts
test/integration/adapters/controllers/admin-report-access-tokens.fastify.test.ts
test/integration/adapters/controllers/public-report-access.fastify.test.ts
test/integration/adapters/controllers/report-access-tokens.fastify.test.ts
test/unit/contracts/admin/admin-report-access-token-schema.test.ts
test/unit/domain/report-access-token-edge.test.ts
test/unit/domain/report-access-token-helpers.test.ts
test/unit/domain/report-access-token-serializers.test.ts
test/unit/domain/report-access-token.test.ts
test/unit/infrastructure/public-report-access-rate-limit.test.ts
test/unit/infrastructure/report-access-token-rate-limit.test.ts
```

**Reports (14) — M36–M41**
```
test/architecture/reports-suite-completeness.test.ts
test/architecture/storage-suite-completeness.test.ts
test/integration/adapters/controllers/admin-report-workflow.fastify.test.ts
test/integration/adapters/controllers/admin-reports.fastify.test.ts
test/integration/adapters/controllers/global-storage-report-safety-contract.test.ts
test/integration/adapters/controllers/reports-status.fastify.test.ts
test/integration/adapters/controllers/reports.fastify.test.ts
test/security/report-write-surface-ownership.test.ts
test/unit/contracts/admin/admin-report-workflow-contract.test.ts
test/unit/contracts/reports/permissions-and-report-status.test.ts
test/unit/contracts/reports/report-management-route-policy.test.ts
test/unit/contracts/reports/report-study-types-catalog.test.ts
test/unit/contracts/reports/report-workflow-communication-contract.test.ts
test/unit/domain/reports/reports.test.ts
```

**Users / Roles (2) — M42–M43**
```
test/integration/adapters/controllers/admin-users-roles.fastify.test.ts
test/unit/contracts/admin/admin-users-roles-search-contract.test.ts
```

**Audit / cross-cutting (16) — drena por feature; DoD de cada cierre**
```
test/architecture/audit-critical-flow-writes.test.ts
test/architecture/audit-separated-surfaces.test.ts
test/architecture/audit-suite-completeness.test.ts
test/architecture/security/security-write-attribution-boundaries.test.ts
test/integration/adapters/controllers/admin-audit.fastify.test.ts
test/integration/adapters/controllers/clinic-audit.fastify.test.ts
test/integration/adapters/controllers/particular-audit.fastify.test.ts
test/security/audit-export-boundaries.test.ts
test/security/security-audit-logging-phase-boundaries.test.ts
test/unit/contracts/admin/admin-audit-constants.test.ts
test/unit/contracts/admin/admin-audit-edge.test.ts
test/unit/contracts/admin/admin-audit.test.ts
test/unit/contracts/clinic/clinic-audit.test.ts
test/unit/infrastructure/audit-helper-domain-boundaries.test.ts
test/unit/infrastructure/audit-write.test.ts
test/unit/infrastructure/audit.test.ts
```

**Auth / Sessions / Security (40) — FROZEN (C4); DoD de cada cierre**
```
test/architecture/security/global-auth-boundary-contract.test.ts
test/architecture/security/security-access-lifecycle-boundaries.test.ts
test/architecture/security/security-actor-relationship-boundaries.test.ts
test/architecture/security/security-boundary-suite-completeness.test.ts
test/architecture/security/security-critical-route-surface-registry.test.ts
test/architecture/security/security-cross-auth-surface-boundaries.test.ts
test/architecture/security/security-cross-tenant-idor-contract.test.ts
test/architecture/security/security-mutation-permission-surface.test.ts
test/architecture/security/security-production-invariants.test.ts
test/architecture/security/security-rate-limit-isolation-boundaries.test.ts
test/architecture/security/security-resource-ownership-boundaries.test.ts
test/architecture/security/security-response-disclosure-boundaries.test.ts
test/architecture/security/security-sensitive-log-redaction-boundaries.test.ts
test/architecture/security/security-session-cookie-boundaries.test.ts
test/architecture/security/security-validation-cutoff-boundaries.test.ts
test/integration/adapters/controllers/admin-auth.fastify.test.ts
test/integration/adapters/controllers/admin-failed-login-alerts.fastify.test.ts
test/integration/adapters/controllers/admin-sessions.fastify.test.ts
test/integration/adapters/controllers/auth-authorization-integration.fastify.test.ts
test/integration/adapters/controllers/auth.fastify.test.ts
test/integration/adapters/controllers/login-rate-limit-operability.test.ts
test/integration/adapters/controllers/login-rate-limit-reset-on-success.test.ts
test/integration/adapters/controllers/particular-auth.fastify.test.ts
test/security/auth-password-change.test.ts
test/security/auth-session-boundaries.test.ts
test/security/security-csrf-mutating-route-coverage.test.ts
test/security/security-rate-limit-cross-realm-isolation.test.ts
test/security/security-trusted-origin-cors-boundaries.test.ts
test/unit/contracts/admin/admin-auth-middleware.test.ts
test/unit/contracts/admin/admin-auth-request-cache.test.ts
test/unit/contracts/admin/admin-auth-session-user-join-contract.test.ts
test/unit/contracts/particular/particular-auth-middleware.test.ts
test/unit/domain/session-last-access.test.ts
test/unit/infrastructure/api-production-session-contract.test.ts
test/unit/infrastructure/auth-cookie-persistence-contract.test.ts
test/unit/infrastructure/auth-middleware.test.ts
test/unit/infrastructure/auth-security-edge.test.ts
test/unit/infrastructure/auth-security-rehash-policy.test.ts
test/unit/infrastructure/auth-security.test.ts
test/unit/infrastructure/login-rate-limit.test.ts
```

**HTTP / CORS / observability (21) — thin-PRs (M14+); `lib/http` DEFER M46**
```
test/helpers/api-request-id-contract.ts
test/helpers/fastify-app-route-stubs.ts
test/integration/adapters/controllers/api-contract-smoke.test.ts
test/integration/adapters/controllers/api-error-content-type-contract.test.ts
test/integration/adapters/controllers/api-error-no-secrets-contract.test.ts
test/integration/adapters/controllers/api-error-no-stack-traces-contract.test.ts
test/integration/adapters/controllers/api-request-id-observability-contract.test.ts
test/integration/adapters/controllers/client-version-gate-contract.test.ts
test/integration/app/fastify-app.test.ts
test/security/backend-api-no-store-cache-contract.test.ts
test/unit/contracts/admin/admin-heavy-list-pagination-contract.test.ts
test/unit/domain/runtime-timing.test.ts
test/unit/infrastructure/backend-api-nosniff-responses-contract.test.ts
test/unit/infrastructure/cors-headers-shared-helper.test.ts
test/unit/infrastructure/http-bootstrap.test.ts
test/unit/infrastructure/request-logger-edge.test.ts
test/unit/infrastructure/request-logger-middleware.test.ts
test/unit/infrastructure/request-logger.test.ts
test/unit/infrastructure/trusted-origin-edge.test.ts
test/unit/infrastructure/trusted-origin-router-policy.test.ts
test/unit/infrastructure/trusted-origin.test.ts
```

**DB / schema / infrastructure (24) — M02 (huérfanos), per-contexto, DEFER M46/M47**
```
test/integration/adapters/controllers/global-public-surface-hardening-contract.test.ts
test/integration/adapters/controllers/performance-load-smoke.test.ts
test/unit/domain/rate-limit-store.test.ts
test/unit/infrastructure/db-pool-contract.test.ts
test/unit/infrastructure/email-gmail-api.test.ts
test/unit/infrastructure/email-html-templates.test.ts
test/unit/infrastructure/email-safe-metadata.test.ts
test/unit/infrastructure/email-success.test.ts
test/unit/infrastructure/env-db-pool.test.ts
test/unit/infrastructure/env.test.ts
test/unit/infrastructure/error-and-async-middleware.test.ts
test/unit/infrastructure/global-e2e-production-readiness-contract.test.ts
test/unit/infrastructure/global-performance-resilience-contract.test.ts
test/unit/infrastructure/logger-and-email.test.ts
test/unit/infrastructure/preflight.test.ts
test/unit/infrastructure/production-env-contracts.test.ts
test/unit/infrastructure/production-readiness.test.ts
test/unit/infrastructure/progress-production-invariants.test.ts
test/unit/infrastructure/supabase-bucket-health.test.ts
test/unit/infrastructure/supabase-recovery-edge.test.ts
test/unit/infrastructure/supabase-signed-url.test.ts
test/unit/infrastructure/supabase-storage-boundaries.test.ts
test/unit/infrastructure/supabase-upload-success.test.ts
test/unit/infrastructure/supabase.test.ts
```

**Platform / Ops — Contact, Maintenance/Health, App Version (7) — M20 (ownership documentado); permanece fuera de features**
```
test/integration/adapters/controllers/admin-system-health.fastify.test.ts
test/integration/adapters/controllers/admin-system-maintenance.fastify.test.ts
test/integration/adapters/controllers/admin-system-schema-health.fastify.test.ts
test/integration/adapters/controllers/contact-route.test.ts
test/unit/domain/schema-health.lib.test.ts
test/unit/infrastructure/app-version-gate-contract.test.ts
test/unit/infrastructure/contact-rate-limit.test.ts
```

**Global inventories & architecture guards (7) — M01/M02 + cada fase**
```
test/architecture/fastify-only-guardrail.test.ts
test/architecture/tracked-source-inventory.test.ts
test/helpers/dashboard-scope-guard.ts
test/unit/infrastructure/package-scripts-contract.test.ts
test/unit/infrastructure/package-scripts.test.ts
test/unit/infrastructure/pr-governance-single-scope-contract.test.ts
test/unit/infrastructure/quality-gate-impact-contract.test.ts
```

**Frontend/build (anclando backend) (10) — n/a (no lo mueve el programa backend)**
```
test/unit/ui/admin/frontend-dashboard-admin-section-tabs.test.ts
test/unit/ui/dashboard/frontend-dashboard-accessibility-focus-aria.test.ts
test/unit/ui/dashboard/frontend-dashboard-action-feedback-focus-polish.test.ts
test/unit/ui/dashboard/frontend-dashboard-filter-drawer-sticky-filters.test.ts
test/unit/ui/dashboard/frontend-dashboard-interaction-foundation.test.ts
test/unit/ui/dashboard/frontend-dashboard-logistics-hub.test.ts
test/unit/ui/dashboard/frontend-dashboard-mobile-polish-bottom-actions.test.ts
test/unit/ui/dashboard/frontend-dashboard-workspace-layout-polish.test.ts
test/unit/ui/public/frontend-public-professionals-scalable-directory.test.ts
test/unit/ui/public/frontend-pwa-global-operational-contract.test.ts
```

**Reconciliación:** 18+2+10+6+9+5+11+14+2+16+40+21+24+7+7+10 = **202** = total anclado
[CONFIRMED].

---

## 8. Protocolo obligatorio de alineación de guards (por milestone de move)

Todo milestone que mueva un archivo ejecuta esta secuencia, en este orden, en **un solo PR**:

1. Identificar `source path` y `destination path` exactos.
2. Consultar la **matriz M01** (§6) para la decisión canónica del source path.
3. Localizar **todos** los imports (estáticos + dinámicos) y los **tests anclados** (§7) del
   source path.
4. Enumerar los **guards de arquitectura y seguridad** afectados (§7.4 + los 16 de
   `architecture/security/**` si toca superficie de ruta/cookie/tenant).
5. Decidir **shim sí/no** (re-export temporal documentado) **antes** del move.
6. Mover **implementación y tests del dominio** en el mismo PR.
7. Actualizar **todos** los path anchors en el mismo PR (imports, censos, `readFileSync`,
   regex, snapshots).
8. **Preservar** el contenido y la fuerza de los asserts.
9. **Prohibido** borrar o debilitar tests para hacer pasar el move.
10. Ejecutar **primero** el test dirigido del módulo movido.
11. Ejecutar los **guards del contexto** (`logistics-domain-boundary-guard` y equivalentes).
12. Ejecutar `pnpm validate:local` (typecheck + typecheck:test + test + build).
13. Verificar que **no queden imports legacy** al path viejo (censo de la fase).
14. Verificar **rollback independiente** (revertir este PR no exige revertir el anterior).
15. Documentar la **evidencia** (comandos + resultados) en la descripción del PR.

**Señales de bloqueo (STOP — no forzar el move):**

- Path anchor sin propietario claro (un test fija el path y no está en §7).
- Guard rojo no explicado por el diff declarado.
- Contrato HTTP divergente (status/headers/cookies/serialización cambian).
- Cambio en límites de `.transaction(` (los 11 call-sites no se reparticionan).
- Test de seguridad debilitado o con asserts recortados.
- Necesidad de cambio de schema/migración para continuar.
- Ciclo de imports no resoluble.
- Comportamiento no cubierto por tests (documentar primero, mover después).
- Rollback que exige revertir otro PR (partición incorrecta).
- Archivos de Auth/seguridad tocados fuera de la secuencia dedicada (C4).

---

## 9. Baseline contractual para los milestones siguientes

Sólo se documenta lo verificable. Etiquetas por afirmación.

### 9.1 Logistics — módulos de rutas y registro Fastify [CONFIRMED]

Registro en `fastify-app.ts` (prefijos):
`/api/logistics/route-plans` · `/api/logistics/field-visits` · `/api/logistics/route-events` ·
`/api/logistics/sla` [CONFIRMED]. Cada módulo exporta un tipo `<X>NativeRoutesOptions` con
dependencias **ya inyectables** (repos, `hashSessionToken`, `getActiveSessionByToken`, `now`,
…) que los tests de integración usan como seam de puertos de facto [CONFIRMED, ARCH-AUDIT-110
§2.5].

**Endpoints reales (método + path relativo al prefijo):**

`/api/logistics/route-plans` [CONFIRMED, `logistics-route-plans.fastify.ts`]:
`POST /heuristic` · `POST /` (create) · `GET /` (list) · `GET /:routePlanId` ·
`PATCH /:routePlanId` · `GET /:routePlanId/metrics` · `GET|POST /:routePlanId/stops` ·
`PATCH /:routePlanId/stops/:routeStopId` · `POST /:routePlanId/{release,start,complete,cancel}`.
El ciclo de vida se opera con las acciones `release/start/complete/cancel` — **no existe
DELETE** [CONFIRMED; corrige la premisa de "Delete route plan"].

`/api/logistics/field-visits` [CONFIRMED, `logistics-field-visits.fastify.ts`]:
`GET /` · `POST /` · `PATCH /:fieldVisitId` · `GET|PUT /:fieldVisitId/location` ·
`GET|POST /:fieldVisitId/time-windows`.

**Endpoint de asignación de field visits [CONFIRMED — resuelve el `UNVERIFIED` de
ARCH-AUDIT-110 §7/PR15]:** no existe un endpoint `/assign` dedicado. La asignación de una
field visit a un plan se modela como **stop del plan**: `POST
/api/logistics/route-plans/:routePlanId/stops` (alta), `PATCH
.../stops/:routeStopId` (actualización), más la **generación heurística** `POST
/api/logistics/route-plans/heuristic`, que consume los ids de field visits vía el helper de
dominio `normalizeGenerateHeuristicFieldVisitIds`. El módulo `field-visits` gestiona CRUD +
ubicación + ventanas horarias, **no** la asignación a planes.

**Orden observable de side-effects [INFERRED de contratos existentes]:** validación →
persistencia → auditoría → respuesta, con la auditoría antes de la respuesta
(`logistics-audit-runtime.test.ts` fija la fase de auditoría). El UC migrado debe **preservar
este orden** [la verificación línea-a-línea del handler queda pendiente por PR de fase].

**Transacciones que no deben reparticionarse [CONFIRMED]:** `db-logistics.ts` tiene **7**
call-sites de `.transaction(`; se mueve el archivo completo (M12) sin tocar los límites.

**Cache [CONFIRMED]:** `lib/logistics-route-plans-cache.ts` (107) con contract-test de runtime
(`logistics-route-plans-cache-runtime.test.ts`); TTL/keys intactos en el move (M13).

**Headers/CORS/rate-limit/authz [CONFIRMED por fan-in]:** las rutas de logística importan
`cors-headers` y `auth-security` (dinámico); el adelgazamiento **delega** sin tocar esos
helpers (congelados/diferidos).

### 9.2 Otros contextos a adelgazar [CONFIRMED salvo indicación]

- **Reports:** doble registro `/api/reports` (`fastify-app.ts:575` y `:580`, orden
  `reports`→`reports-status`) = contrato de orden [CONFIRMED]; `report-workflow-communication`
  dispara email + toca `db` (único acoplamiento invertido) [CONFIRMED]; `supabase` con 8
  consumidores se consume por puerto, el cliente no se absorbe [CONFIRMED].
- **Clinics:** `db-admin-clinics` con 2 `.transaction(` [CONFIRMED];
  `reconcile-public-profile-db-contract` fija el mapping del perfil público [INFERRED del
  nombre del contrato; contenido no leído].
- **Public Professionals:** `professional-bank-eligibility` es dominio real [CONFIRMED];
  SQL-drift-guard de histopatología fija el SQL de `db-public-professionals`
  [INFERRED del test `public-professionals-*`].
- **Pricing:** `db-pricing` = CRUD + `serializePricingItem` + guard de patch; **sin reglas de
  dominio** [CONFIRMED, lectura de LOC/estructura; 160 LOC].

### 9.3 Ítems no verificados a nivel de línea

- `UNVERIFIED` — interior línea-a-línea de `clinic-public-profile.fastify.ts` (1.316) y
  `admin-study-tracking.fastify.ts` (1.205): no leídos completos en M01. Verificación
  pendiente: lectura dirigida en el PR de la fase correspondiente (F/G) antes de adelgazar.
- `UNVERIFIED` — orden exacto audit↔email↔respuesta en las 5 rutas con email: inferido de los
  contratos; confirmar con el contract-test de fase en M31/M37.
- `NOT_FOUND` — cache de Clinics: no existe en `lib` [CONFIRMED por ausencia].

---

## 10. Readiness downstream (programa corregido)

- **M01** (este PR) es la **precondición documental**: refresh del inventario + matriz
  origen-destino + protocolo de alineación de guards + censo de los 202 tests ancla.
- **M02** elimina los huérfanos Express-era (`utils/async-handler.ts`,
  `middlewares/error-handler.ts` + su test) y actualiza `tracked-source-inventory`.
- **Fase A (M02b–M05)** completa el dominio Logistics: mover `sla-breach`+`time-window`,
  `route-planning`, `metrics`; cerrar borrando `lib/logistics/` vacío y endureciendo el guard.
- **Fases B y C (M06–M17)** extraen application (puertos derivados de los `Options`),
  infrastructure (`db-logistics` completo, cache) y rutas delgadas.
- **Fases D–J** replican el patrón por contexto (Pricing, Public Professionals, Clinics, Study
  Tracking, Accesos por token, Reports, Users/Roles).
- **Auth queda fuera del programa** (3 realms + libs congeladas): sólo una **secuencia de
  seguridad dedicada (C4)** con diseño separado y sign-off.
- **`server/lib` residual se trata al final (Fase K, M46/M47)**, no antes; se drena por
  features.
- **No hay** event bus / outbox ni fragmentación de `drizzle/schema.ts` en este programa.
- **Cada milestone de código es R2** bajo `AGENTS.md`: requiere **autorización de scope
  individual de Nico** antes de ejecutarse.

---

## 11. Anexo histórico — inventario frontend (sin cambios en M01)

> Este anexo se conserva **tal cual** del ARCH-3 original. El refresh M01 tiene scope
> **backend** (`server/**` + tests ancla); el triaje de `frontend/src/lib` **no** forma parte
> de `ARCH-AUDIT-110` y no se recalcula aquí. Se mantiene como referencia.

`frontend/src/lib/**` mezcla shared-real vs dominio-en-cajón (P2-C): `api`, `api-error`,
`utils`, `routes`, `seo`, `theme`, `security/*`, `app-version`/`app-shell-release`/
`client-version-error` = shared legítimo cliente; `public-professionals`,
`public-pricing-cache`, `notification-destinations`, `admin-hub-reset`, `clinic-hub-reset`,
`dashboard-last-module`, `admin-access-error`, `dashboard-server-auth` = dominio en el cajón
común, destino `features/<domain>/`. El seam HTTP está sano: **ningún archivo de `frontend/`
importa `server/` ni `db`**. `components/ui/` (design system) y `types/index.ts` son shared
legítimo. `features/dashboard/` es el blueprint vivo (config/domain/application/presentation).
`drizzle/schema.ts` (+ `relations.ts`) es el **shared kernel temporal** backend; **no se
fragmenta** (rompería Drizzle y las migraciones 0000–0030).

---

## 12. Guardrails de este PR (M01)

- **docs-only:** sin código, sin CSS, sin tests, sin deps/lockfiles/CI, sin schema, sin
  stashes, sin `.claude`, sin worktrees.
- **No renames, no moves, no archivos nuevos.** Único archivo modificado:
  `docs/architecture/shared-lib-boundary-inventory.md`.
- No se crean directorios de destino ni capas ceremoniales; los destinos de §4/§6 son
  **recomendaciones**, no estructura existente.
- No event bus / outbox. No fragmentar `drizzle/schema.ts`. No tocar auth/security.
- No se modifica el documento rector `ARCH-AUDIT-110` ni ningún otro documento.

## 13. Validación (M01)

- `git diff --check` — sin whitespace/conflict markers.
- `git status --short --untracked-files=all` — único cambio: este archivo.
- `git diff --stat` / `git diff --name-only` — confirman alcance de un único archivo docs.
- Métricas derivadas de `git ls-files` + `wc -l` + `git grep` sobre HEAD `f3e22a7`, no de
  suposiciones por nombre; conteos reconciliados (§2, §7).
- `pnpm validate:local` / `pnpm test` / `pnpm build` / E2E / `security:public-surface`:
  `NOT_RUN` (PR docs-only; CI se salta por `paths-ignore` de `docs/**`).

## 14. Documentos relacionados

- [ARCH-1 — Repository Domain Architecture Audit](../audit/repository-domain-architecture-audit.md).
- [ARCH-2 — Backend Domain Boundary ADR](./backend-boundary-adr.md).
- [ARCH-AUDIT-110 — Backend Enterprise Modularization Program (audit)](../audit/backend-enterprise-modularization-program-audit.md).
- [ARCH-4 — Logistics domain shell](../implementation/logistics-domain-shell.md) ·
  [ARCH-5](../implementation/arch-5-logistics-domain-helper.md) ·
  [ARCH-6](../implementation/arch-6-logistics-domain-boundary-guard.md) ·
  [ARCH-7](../implementation/arch-7-logistics-second-domain-helper.md) ·
  [ARCH-8](../implementation/arch-8-logistics-domain-barrel.md) ·
  [ARCH-9](../implementation/arch-9-logistics-domain-barrel-import-guard.md) ·
  [ARCH-10 — cierre Logistics domain](../implementation/arch-10-logistics-domain-architecture-closeout.md).
- `server/features/logistics/README.md` — frontera del contexto (espejo de las reglas de
  dependencia).
- `docs/logistics/MVP_DOMAIN.md` — documento de dominio del piloto.

---

## Addendum de ejecución — cierre Fase A / M05

> **Alcance del addendum:** status de ejecución, no reinterpretación retroactiva. Las
> tablas y cifras M01 anteriores se conservan **tal cual** como snapshot histórico del
> estado previo al piloto; este addendum registra el estado **ejecutado** de la Fase A.
> **Base M05:** `main` · **HEAD:** `ba9de2a311031e9e56ceb8fec2bb8b3d27862c79`
> refactor(logistics): move metrics domain module (M04) (#1500).
> **Rama:** `refactor/backend-modularization-m05-logistics-domain-closeout`.
> **Fecha:** 2026-07-19.

**Milestones de la Fase A completados** (cada uno como move byte-idéntico, sin cambio
de comportamiento):

| Milestone | Módulo(s) movido(s) desde `server/lib/logistics/` | Destino canónico | Estado |
| --- | --- | --- | --- |
| M02b | `sla-breach.ts` (111) + `time-window.ts` (40) | `features/logistics/domain/` | completado |
| M03 | `route-planning.ts` (515) | `features/logistics/domain/` | completado |
| M04 | `metrics.ts` (829) | `features/logistics/domain/` | completado |
| M05 | — (cierre: docs + guard) | — | este closeout / completado al merge |

**Namespace de dominio legacy retirado.** Verificado con comandos reproducibles sobre
el HEAD base:

```powershell
git ls-files "server/lib/logistics/**"          # → 0 archivos versionados
Test-Path -LiteralPath "server/lib/logistics"   # → False (directorio ausente)
```

**Ubicación canónica actual del dominio** (`server/features/logistics/domain/`),
inventario y LOC recalculados vía `git ls-files "server/features/logistics/domain/*.ts" | xargs wc -l`:

| Módulo | LOC |
| --- | --- |
| `index.ts` (barrel público) | 91 |
| `metrics.ts` | 829 |
| `pagination.ts` | 52 |
| `route-plan-field-visits.ts` | 36 |
| `route-planning.ts` | 515 |
| `sla-breach.ts` | 111 |
| `time-window.ts` | 51 |
| **Total dominio** | **1.685** |

**Guard de cierre.** `test/architecture/logistics-domain-boundary-guard.test.ts`
conserva sus cuatro contratos (existencia + pureza + imports permitidos + consumo por
barrel) y suma tres contratos de cierre M05: inventario mínimo requerido (subconjunto,
no cerrado), ausencia del directorio legacy en checkout limpio y prohibición de imports
al dominio legacy en `server/**` y `test/**`. La cache vigente
`server/lib/logistics-route-plans-cache.ts` (guion, no `/`) queda explícitamente fuera
de la detección: es runtime legítimo hasta M13.

Las filas de la matriz origen-destino previas (`lib/logistics/*` → `features/logistics/domain/`,
milestones M02b/M03/M04) reflejaban el **plan**; con este addendum quedan **ejecutadas**.
Ninguna cifra histórica de la matriz M01 se altera.

---

## Addendum de ejecución — M46 / frontera HTTP residual

> **Fecha:** 2026-07-28. Este addendum registra el recenso de M46 sobre HEAD
> `4adb55a458e36d5905f8d0d497f5a5ef14b8512f`; no reescribe las métricas
> históricas M01 de las secciones anteriores.

**M46 — completado.** El estado actual previo al move era 27 archivos
TypeScript bajo `server/lib`. Los cuatro candidatos residuales recibieron
decisión final:

| Candidato | LOC | Fan-in runtime/test | Decisión | Path canónico |
| --- | ---: | ---: | --- | --- |
| `cors-headers.ts` | 143 | 30 / 1 | `KEEP` | `server/lib/cors-headers.ts` |
| `api-request-id.ts` | 104 | 1 / 3 imports directos | `MOVE` | `server/lib/http/api-request-id.ts` |
| `api-response-security.ts` | 65 | 2 / 2 | `MOVE` | `server/lib/http/api-response-security.ts` |
| `sensitive-response-cache.ts` | 19 | 1 / 2 | `MOVE` | `server/lib/http/sensitive-response-cache.ts` |

El move de los cuatro candidatos proyectaba 50 paths lógicos y fue
descartado. La decisión mixta proyectó 17 paths lógicos, preservó los blobs
de implementación y no usa barrel ni shims. `server/lib/http` queda cerrado
a los tres archivos movidos y sin dependencias hacia features, routes,
middlewares, DB, Auth, sesiones, cookies, email, Supabase o frontend.

`cors-headers.ts` queda retenido por su blast radius, no por ambigüedad: el
guard M46 fija su path y sus 30 consumidores runtime. CORS/trusted-origin,
orden de hooks, request ID, headers de seguridad y cache-control permanecen
sin cambio funcional. C5 — NOT_RUN. M48 — NOT_RUN. Detalle:
[`m46-http-lib-reclassification-closeout.md`](../implementation/m46-http-lib-reclassification-closeout.md).

## Addendum de cierre — Inventario final M48

> **Fecha:** 2026-07-28. Este addendum es el inventario vigente; las tablas M01
> anteriores permanecen como evidencia histórica.

El recenso final contiene 27 archivos TypeScript bajo `server/lib`: 24 en la
raíz y tres en `server/lib/http`. M46 quedó mergeado mediante PR #1585 y su
frontera HTTP contiene exactamente `api-request-id`,
`api-response-security` y `sensitive-response-cache`; `cors-headers.ts`
continúa como KEEP canónico con 30 consumidores runtime.

**M47 — NO-GO** fue reproducido sobre `env.ts`, `logger.ts`,
`http-runtime.ts`, `runtime-timing.ts` y `rate-limit-store.ts`: **0 MOVE,
5 KEEP, 0 DELETE**. `env.ts` solo ya cruza 46 consumidores runtime, Auth, DB,
CORS, storage y entrypoints, por lo que excede el máximo de 30 paths. La
agrupación coherente amplía todavía más el blast radius. No existe
`server/lib/infra` y no se creó shim, guard, closeout runtime, commit o PR M47.

Clasificación vigente:

- audit cross-cutting: `admin-audit`, `audit-log`, `audit`, `clinic-audit`,
  `particular-audit`;
- Auth/security congelado: `auth-security`, `fastify-admin-auth`,
  `login-rate-limit`, `session-last-access`;
- rate limits compartidos: `contact-rate-limit`,
  `public-report-access-rate-limit`, `report-access-token-rate-limit`,
  `rate-limit-store`;
- infra/cross-cutting KEEP: `env`, `logger`, `http-runtime`,
  `runtime-timing`, `email`, `supabase`;
- técnico compartido: `http-types`, `list-pagination`;
- kernels/ops: `permissions`, `schema-health`;
- HTTP M46: tres módulos en `server/lib/http`;
- CORS: KEEP en `server/lib/cors-headers.ts`.

**M48 — completado** localmente; **C5 — NOT_RUN**; Fase K y programa cerrados
con `CERTIFIED_WITH_RESIDUAL_RISKS`. Detalle:
[`m48-backend-modularization-final-certification.md`](../implementation/m48-backend-modularization-final-certification.md).
