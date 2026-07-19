# Logistics · domain (reglas puras)

> Capa **domain** del contexto Logistics. **Contiene código** desde ARCH-5.
> Ver la frontera del contexto en [`../README.md`](../README.md) y el contrato en
> [ARCH-2](../../../../docs/architecture/backend-boundary-adr.md).

## Responsabilidad

Reglas de negocio **puras** de logística: cálculo de ventanas de tiempo,
planificación de rutas, detección de breach de SLA, métricas de cumplimiento de
rutas y paginación. Sin efectos secundarios, sin I/O, sin framework. Determinista y
testeable en aislamiento.

## Regla de dependencia

- **Puede importar:** el shared kernel (`drizzle/schema.ts`) **sólo como tipos**, y
  otras utilidades puras del propio contexto.
- **No puede importar:** `fastify`, el runtime de Drizzle, `env`, `http`, middleware
  de auth, React/Next ni ningún `db-*`.
- La dependencia apunta hacia adentro: `domain` no conoce el transporte HTTP ni el
  motor de persistencia. `infrastructure` depende de `domain`, nunca al revés.

Verificado por `test/architecture/logistics-domain-boundary-guard.test.ts`, que
además exige que todo consumidor runtime importe el dominio por el barrel público
(`index.ts`), nunca un archivo interno.

## Qué vive aquí

Cada archivo materializa código real (nunca stubs por dogma):

- **`pagination.ts`** (ARCH-7) — `LOGISTICS_DEFAULT_LIMIT`, `LOGISTICS_MAX_LIMIT`,
  `normalizeLogisticsLimit`, `normalizeLogisticsOffset`.
- **`route-plan-field-visits.ts`** (ARCH-5) — `normalizeGenerateHeuristicFieldVisitIds`.
- **`time-window.ts`** (M02b) — `DEFAULT_TIME_WINDOW_TIMEZONE`,
  `TIME_WINDOW_TIMEZONE_MAX_LENGTH`, `isValidTimeWindowRange`,
  `normalizeTimeWindowTimezone`, `assertValidTimeWindowRange`. Sin imports (100% puro).
- **`sla-breach.ts`** (M02b) — núcleo puro `markOverdueSlaBreaches` más sus tipos de
  dominio (`MarkOverdueSlaBreachesInput/Deps/Result/Notification`,
  `MarkOverdueSlaInstancesParams`). El tipo de las instancias marcadas es opaco
  (`TInstance`), de modo que el dominio sólo importa el tipo `SlaTargetType` del
  shared kernel y no se acopla al schema de fila de `slaInstances`. El adaptador con
  `db-*` (`markOverdueSlaBreachesWithDb`) vive en `../infrastructure/sla-breach-db.ts`,
  **no aquí**.
- **`route-planning.ts`** (M03) — heurística determinista de planificación de rutas:
  `buildHeuristicRoutePlan` (nearest-next por objetivo `distance`/`time`/`sla` con
  ventanas duras y desempate estable) y `calculateHaversineKm`, más sus tipos
  (`RoutePlanningObjective/Point/TimeWindow/Visit`, `BuildHeuristicRoutePlanOptions`,
  `PlannedRouteStop`, `HeuristicRoutePlanResult`). Sin imports (100% puro).
- **`metrics.ts`** (M04) — métricas puras de logística: cumplimiento de distancia de
  ruta (`calculateRouteDistanceCompliance`, `calculateKmPerCompletedVisit`), ventanas
  horarias (`classifyTimeWindowCompliance`, `summarizeWindowCompliance`), cumplimiento
  de SLA (`classifySlaCompliance`, `summarizeSlaCompliance`), agregación de eventos de
  ruta (`summarizeRouteEvents`, `getRouteEventBoundariesByRoutePlan`,
  `getRouteEventBoundariesByRouteStop`, `calculateDurationBetweenRouteEvents`) y
  cumplimiento por parada (`calculateBasicRouteComplianceMetrics`,
  `calculateRouteStopComplianceMetrics`), más sus 20 tipos. **Cero imports** (100%
  puro); toda su API se consume por el barrel.

## Barrel público

`index.ts` re-exporta la API anterior sin transformarla y es el único punto de
entrada del dominio. No re-exporta el adaptador de infraestructura.

## Certificación de cierre — Fase A (M05)

Con M05 la capa domain de Logistics queda **cerrada para la Fase A**:

- **Inventario mínimo presente:** `index.ts`, `pagination.ts`,
  `route-plan-field-visits.ts`, `time-window.ts`, `sla-breach.ts`,
  `route-planning.ts`, `metrics.ts` — comprobado como **subconjunto requerido**
  (no inventario cerrado) por el guard.
- **Namespace legacy ausente:** `server/lib/logistics/` está retirado (cero
  archivos versionados y directorio inexistente en un checkout limpio).
- **Imports externos por barrel:** todo consumidor runtime importa el dominio por
  `index.ts`; ningún archivo de `server/**` ni `test/**` apunta al dominio legacy.
- **Guard ejecutable:** `test/architecture/logistics-domain-boundary-guard.test.ts`
  (pureza + frontera + inventario + ausencia de legacy + prohibición de imports
  legacy).
- **M05 no cambia comportamiento runtime.** Futuras reglas de dominio se incorporan
  **sólo con código real y sus tests**, nunca como stubs anticipados.

## Qué NO hacer

No importar `db-*`, Drizzle runtime, `fastify`, `env` ni I/O. No crear stubs,
interfaces ni barrels vacíos.
