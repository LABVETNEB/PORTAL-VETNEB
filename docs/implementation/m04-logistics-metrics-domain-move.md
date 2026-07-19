# M04 · Mover metrics al dominio Logistics

## Base exacta

- **Rama:** `refactor/backend-modularization-m04-metrics`.
- **HEAD base:** `56a7bab35af98cd4aa20709a9fb8cbf1792ecef9` — `refactor(logistics): move route-planning domain module (M03) (#1499)`.
- **Working tree inicial:** limpio; índice vacío.
- **Milestone:** Fase A — M04.
- **Documento rector:** [Backend Enterprise Modularization Program — Audit](../audit/backend-enterprise-modularization-program-audit.md) (Fase A → **M04**).

## Objetivo

Migrar al bounded context Logistics el módulo de dominio puro que hoy vive en
`server/lib/logistics/metrics.ts`:

- `metrics.ts` — dominio **100% puro** (sin ningún import); se mueve a
  `server/features/logistics/domain/metrics.ts` **byte-idéntico** y se re-exporta por
  el barrel público del dominio.

Preservando exactamente el comportamiento de todos los cálculos (distancia, ventanas
horarias, SLA, agregación de eventos y cumplimiento por parada), incluido el fallback
`Date.now()` de `classifySlaCompliance`; alineando el consumidor runtime y los tests
anclados en el mismo PR; manteniendo verde y sin relajar el guard de frontera; sin
tocar rutas (más allá de un import), endpoints, queries, transacciones, schema, DB ni
contratos públicos; sin introducir dependencias, clock abstractions ni refactors.

Tras M04, `server/lib/logistics/` queda **sin módulos de dominio**. No se inicia M05.

## Censo de importadores y anclas (evidencia `git grep`)

Path/símbolos legacy `server/lib/logistics/metrics`:

- **Runtime (`server/**`):** `server/routes/logistics-route-plans.fastify.ts` es el
  **único** consumidor runtime. Importaba `calculateRouteStopComplianceMetrics` y
  `type RouteStopComplianceInput` desde `../lib/logistics/metrics.ts`. Los otros tres
  route adapters (`logistics-field-visits`, `logistics-route-events`, `logistics-sla`)
  **no** importan métricas (verificado). Ningún otro módulo de `server/**` importa el
  path legacy.
- **Tests que importan el módulo:**
  - `test/unit/domain/logistics/logistics-metrics.test.ts` (import directo).
  - `test/unit/domain/logistics/logistics-route-event-aggregation.test.ts` (import directo).
  - `test/unit/domain/logistics/logistics-sla-compliance.test.ts` (import directo).
- **Tests que leen la fuente por literal:**
  - `test/unit/domain/logistics/logistics-metrics-suite-completeness.test.ts`
    (`readRepoFile("server/lib/logistics/metrics.ts")`, línea 79).
- **Tests que leen el source del route adapter (símbolos, no path legacy):**
  - `test/integration/adapters/controllers/logistics-route-plans-api.test.ts` — hace
    `assert.match(routeSource, /calculateRouteStopComplianceMetrics/)`,
    `/RouteStopComplianceInput/`, etc. **No** ancla el path legacy: sólo verifica que
    los símbolos siguen usándose en el handler. Como sólo cambia el import specifier,
    queda verde **sin tocar**.
- **Guard:** `test/architecture/logistics-domain-boundary-guard.test.ts` es genérico
  (walkea `server/features/logistics/domain/**`), cubre el archivo nuevo sin cambios.
- **Docs históricos (fuera de scope, se dejan como baseline):**
  `docs/architecture/shared-lib-boundary-inventory.md` (líneas 202, 311),
  `docs/logistics/ROLLING_ROADMAP.md` (líneas 333, 365, 407) y el propio documento
  rector de auditoría. Son prosa documental, no literales ejecutables; no rompen
  build/tests/guards. **No se modifican** en esta tarea.

Se verificó el censo hasta agotar `git grep`: no hay consumidores runtime fuera del
único route adapter autorizado, de modo que **no** aplica
`BLOCKED_SCOPE_EXPANSION_REQUIRED`.

## Censo de exports

Superficie pública completa del módulo (verificada contra el archivo real; **sin
`export *`**): **12 funciones + 20 tipos**, sin exports adicionales.

- **Funciones (12):** `calculateRouteDistanceCompliance`, `calculateKmPerCompletedVisit`,
  `classifyTimeWindowCompliance`, `summarizeWindowCompliance`,
  `calculateBasicRouteComplianceMetrics`, `classifySlaCompliance`,
  `summarizeSlaCompliance`, `summarizeRouteEvents`,
  `getRouteEventBoundariesByRoutePlan`, `getRouteEventBoundariesByRouteStop`,
  `calculateDurationBetweenRouteEvents`, `calculateRouteStopComplianceMetrics`.
- **Tipos (20):** `NumericMetricInput`, `TimeWindowComplianceStatus`,
  `RouteDistanceComplianceInput`, `RouteDistanceComplianceMetrics`,
  `TimeWindowComplianceInput`, `TimeWindowComplianceResult`, `WindowComplianceSummary`,
  `BasicRouteComplianceInput`, `BasicRouteComplianceMetrics`, `SlaComplianceStatus`,
  `SlaComplianceInput`, `SlaComplianceResult`, `SlaComplianceSummary`,
  `RouteEventMetricInput`, `RouteEventBoundary`, `RouteEventAggregationSummary`,
  `RouteEventDurationResult`, `RouteStopComplianceInput`, `RouteStopComplianceMetric`,
  `RouteStopComplianceSummary`.
- **Internos NO re-exportados:** `roundMetric`, `normalizeNonNegativeNumber`,
  `normalizeNonNegativeInteger`, `getDateMs`, `calculateMinuteDelta`,
  `isValidRouteEvent`, `toRouteEventBoundary`, `sortRouteEvents`,
  `normalizeRouteStopId`, `calculateActualMinutesFromPreviousArrival`.

El barrel `domain/index.ts` re-exporta explícitamente las 12 funciones y, como tipos,
los 20 tipos.

## Divergencia documental

**CONTRADICTED.** La documentación histórica clasificaba `metrics.ts` como un módulo
de dominio que importa **sólo tipos** de `drizzle/schema.ts`
(`docs/architecture/shared-lib-boundary-inventory.md`; el README del contexto también
lo afirmaba). El código real **no contiene ningún import**: es cálculo puro sobre
valores, fechas y arrays. Esto **no bloquea** el move — refuerza que el módulo es
dominio puro.

- Los documentos rectores históricos (`shared-lib-boundary-inventory.md`,
  `backend-enterprise-modularization-program-audit.md`) **permanecen como baseline
  histórico** y no se modifican.
- La afirmación viva se **corrige** en los READMEs del contexto y del dominio: se
  elimina el "importa sólo tipos" y se declara **cero imports**.

## Decisión arquitectónica (shim / no-shim)

Sin shim. El censo prueba que el único consumidor runtime del path legacy
(`logistics-route-plans.fastify.ts`) se reapunta al barrel de `domain/` en el mismo
PR, y que todos los tests anclados se alinean también aquí. Conservar un re-export en
`lib/logistics/` sólo por precaución sería código muerto. El archivo legacy se elimina
y `server/lib/logistics/` queda sin módulos de dominio.

## Move byte-idéntico y pureza

- `metrics.ts` **no tiene imports**: determinista, sin efectos secundarios, sin I/O ni
  framework. El move es una copia literal a `domain/metrics.ts` (SHA-256 idéntico
  verificado, sin edición interna), por lo que git lo detecta como rename de alta
  similitud al stagear ambos lados.
- El guard walkea `domain/**` y valida el archivo nuevo automáticamente: no importa
  `db/env/fastify/infrastructure/routes/supabase/fs/http/https`, no accede a
  `process.*` ni `fetch(` (usa `Date.now()`, `Math.*`, `Date#getTime`, `toFixed`), y
  sólo admite imports relativos internos o tipos del shared kernel (aquí, **ninguno**).
  Además exige que todo consumidor runtime importe el dominio **por el barrel**.

## Matriz de contratos preservados

Idénticos byte a byte (move sin edición interna):

- **Numéricos:** redondeo a 6 decimales; `-0` → `0`; negativos/no-finitos → `null`;
  enteros no negativos para conteos; división por cero → resultados actuales;
  tolerancias inclusivas `<=`; tratamiento especial de `plannedKm === 0`.
- **Ventanas horarias:** estados `early`/`on_time`/`late`/`no_window`/`missing_actual`;
  tolerancia default `0`; ventanas inválidas → `no_window`; sin llegada →
  `missing_actual`; signos de `deltaFromWindowMin`; tasa y denominador.
- **SLA:** estados `active`/`paused`/`breached`/`resolved`/`canceled`/`missing_due_date`;
  prioridad canceled → resolved → paused → breached → active; **fallback `Date.now()`
  intacto**; overdue/remaining/resolvedLate; rate y conteos.
- **Eventos:** filtrado de inválidos; orden cronológico ascendente estable; source
  vacío → `"unknown"`; normalización de ids; first/last; agrupación por route plan y
  route stop; semántica de eventos faltantes; duración en minutos.
- **Paradas:** orden por `sequence` y luego `fieldVisitId`; minutos entre llegadas;
  out-of-sequence; tolerancias de distancia y tiempo; conteos de desviaciones;
  missing arrival; estructura y orden de `stopMetrics`.
- **Route adapter:** sólo cambia el import (barrel en vez del path legacy). Handlers,
  endpoints, validaciones, `buildRouteStopComplianceInputs` y el call-site
  `metrics: calculateRouteStopComplianceMetrics(metricInputs.inputs)` intactos.

Sin cambios de mensajes, keys, nullability, nombres de campos ni orden observable.

## Cambios aplicados (archivos)

| Archivo | Cambio |
| --- | --- |
| `server/features/logistics/domain/metrics.ts` | **CREATED (rename).** Move byte-idéntico (SHA-256 idéntico) desde `lib/logistics/`. |
| `server/lib/logistics/metrics.ts` | **DELETED.** `server/lib/logistics/` queda sin módulos de dominio. |
| `server/features/logistics/domain/index.ts` | **MODIFIED.** Barrel re-exporta métricas: 12 funciones + 20 tipos, explícitos, sin `export *`. |
| `server/routes/logistics-route-plans.fastify.ts` | **MODIFIED.** Import reapuntado al barrel (`../features/logistics/domain/index.ts`); sólo la declaración de import. |
| `test/unit/domain/logistics/logistics-metrics.test.ts` | **MODIFIED.** Import → barrel (mismos casos/asserts). |
| `test/unit/domain/logistics/logistics-route-event-aggregation.test.ts` | **MODIFIED.** Import → barrel (mismos casos/asserts). |
| `test/unit/domain/logistics/logistics-sla-compliance.test.ts` | **MODIFIED.** Import → barrel (mismos casos/asserts). |
| `test/unit/domain/logistics/logistics-metrics-suite-completeness.test.ts` | **MODIFIED.** Literal `readRepoFile` → `server/features/logistics/domain/metrics.ts` (mismos asserts). |
| `test/unit/domain/logistics/logistics-domain-barrel.test.ts` | **MODIFIED.** +2 casos de métricas (disponibilidad de 12 + comportamiento representativo) e import consolidado. |
| `test/architecture/logistics-domain-boundary-guard.test.ts` | **UNCHANGED_AFTER_REVIEW.** Genérico; cubre el archivo nuevo y exige barrel. No se relajó. |
| `server/features/logistics/README.md` | **MODIFIED.** Estado real post-M04; corrección "cero imports". |
| `server/features/logistics/domain/README.md` | **MODIFIED.** Lista `metrics` en "Qué vive aquí"; elimina la nota de migración pendiente. |
| `docs/implementation/m04-logistics-metrics-domain-move.md` | **CREATED.** Este documento. |

## Tests anclados

- `test/architecture/logistics-domain-boundary-guard.test.ts` — verde sin cambios;
  cubre `domain/metrics.ts` y exige que `logistics-route-plans.fastify.ts` importe el
  dominio por el barrel (satisfecho).
- `test/unit/domain/logistics/logistics-metrics.test.ts` — mismos casos, import → barrel.
- `test/unit/domain/logistics/logistics-route-event-aggregation.test.ts` — mismos casos,
  import → barrel.
- `test/unit/domain/logistics/logistics-sla-compliance.test.ts` — mismos casos,
  import → barrel.
- `test/unit/domain/logistics/logistics-metrics-suite-completeness.test.ts` — mismos
  asserts, literal reapuntado al nuevo path (los `export function …` siguen presentes).
- `test/unit/domain/logistics/logistics-domain-barrel.test.ts` — +2 casos que fijan la
  disponibilidad de las 12 funciones vía barrel y su comportamiento representativo por
  familia (distancia, ventana, básico, SLA, eventos, parada).
- `test/integration/adapters/controllers/logistics-route-plans-api.test.ts` — sin
  cambios; verifica símbolos en el source del handler, no el path legacy.

**Reconciliación de casos:** barrel 5 → 7 (+2); metrics/aggregation/sla/completeness sin
cambio de conteo (sólo import/literal); guard e integración sin cambio. **M04 no elimina
ningún caso.**

## Validaciones

Dirigidas (`pnpm exec tsx --test` sobre guard + barrel + los 3 tests de métricas + los
2 realineados + suite-completeness + integración del route adapter): **PASSED** — 69
tests, 69 pass, 0 fail, 0 skip, exit 0.

Gate general (`pnpm validate:local` = `typecheck && typecheck:test && test && build`):
**PASSED** — 3143 tests, 3142 pass, 0 fail, 1 skip (pre-existente), build
`dist/index.js` 838.7kb, exit 0.

`git diff --check`: PASSED. `pnpm security:public-surface`: NOT_RUN (no se tocó
superficie pública). Frontend, E2E, schema y migraciones: NOT_RUN.

## Riesgos residuales

- Bajo. Move byte-idéntico, módulo sin dependencias, cubierto por el guard de frontera,
  el test de dominio (metrics/aggregation/sla/completeness), el test de barrel y la
  integración del route adapter.
- Referencias al path legacy quedan en `docs/architecture/shared-lib-boundary-inventory.md`
  y `docs/logistics/ROLLING_ROADMAP.md` (fuera de scope autorizado): staleza documental,
  no rompe build/tests/guards. Se reconcilia en un pase de docs posterior.

## Rollback independiente

Revertir el PR restaura `server/lib/logistics/metrics.ts` y el import de
`logistics-route-plans.fastify.ts`; no hay cambios de schema, migraciones ni contratos
que compliquen el revert.

## Exclusiones

Sin cambios en `server/db-logistics.ts`, `server/fastify-app.ts`, otras rutas,
`application/**`, `infrastructure/**`, `drizzle/**`, `migrations/**`, schema, queries,
transacciones, auth/sesiones/cookies/CORS/CSP/rate-limits/headers, `frontend/**`,
`package.json`, lockfiles, `.github/**`, `scripts/**`. No se creó ningún shim, service,
port, repository, adapter, event bus ni barrel secundario. No se modificaron
`docs/audit/backend-enterprise-modularization-program-audit.md` ni
`docs/architecture/shared-lib-boundary-inventory.md`. No se inició M05.

## Readiness para M05

Con `metrics.ts` migrado, `server/lib/logistics/` queda vacío de dominio; lo que resta
del contexto en ubicación legacy es `server/db-logistics.ts` (persistencia + dominio
mezclados, candidato a repositorio en M12), `server/lib/logistics-route-plans-cache.ts`
(infra de contexto) y los cuatro route adapters. El patrón M02b/M03/M04 (move a
`domain/`, re-exportar por el barrel, reapuntar consumidores y tests) sigue siendo
reutilizable para los siguientes pasos.
