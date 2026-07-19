# Logistics · domain (reglas puras)

> Capa **domain** del contexto Logistics. **Contiene código** desde ARCH-5.
> Ver la frontera del contexto en [`../README.md`](../README.md) y el contrato en
> [ARCH-2](../../../../docs/architecture/backend-boundary-adr.md).

## Responsabilidad

Reglas de negocio **puras** de logística: cálculo de ventanas de tiempo,
planificación de rutas, detección de breach de SLA y paginación. Sin efectos
secundarios, sin I/O, sin framework. Determinista y testeable en aislamiento.

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

## Barrel público

`index.ts` re-exporta la API anterior sin transformarla y es el único punto de
entrada del dominio. No re-exporta el adaptador de infraestructura.

## Qué NO hacer

No importar `db-*`, Drizzle runtime, `fastify`, `env` ni I/O. No crear stubs,
interfaces ni barrels vacíos. `metrics.ts` sigue en `server/lib/logistics/` y se
migrará en M04.
