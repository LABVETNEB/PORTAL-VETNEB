# M03 · Mover route-planning al dominio Logistics

## Base exacta

- **Rama base:** `main`.
- **HEAD base:** `94e7a2b7ae8825d180265cb2d8a536149339f0a9` — `refactor(logistics): move SLA and time-window domain modules (M02b) (#1498)`.
- **Working tree inicial:** limpio.
- **Milestone:** Fase A — M03.
- **Documento rector:** [Backend Enterprise Modularization Program — Audit](../audit/backend-enterprise-modularization-program-audit.md) (PR 2 → **M03**; §8 Fase A).

## Objetivo

Migrar al bounded context Logistics el módulo de dominio puro que hoy vive en
`server/lib/logistics/route-planning.ts`:

- `route-planning.ts` — dominio **100% puro** (sin ningún import); se mueve a
  `server/features/logistics/domain/route-planning.ts` **byte-idéntico** y se
  re-exporta por el barrel público del dominio.

Preservando exactamente el comportamiento del algoritmo de planificación (heurística
nearest-next, objetivos `distance`/`time`/`sla`, ventanas duras, desempate
determinista, defaults, warnings y errores); alineando el consumidor runtime y los
tests anclados en el mismo PR; manteniendo verde el guard de frontera; sin tocar
rutas, endpoints, queries, transacciones, schema, DB ni contratos públicos; sin
introducir dependencias.

## Censo de importadores (evidencia `git grep`)

Path legacy `lib/logistics/route-planning`:

- **Runtime:** `server/db-logistics.ts` (único importador). Importa
  `buildHeuristicRoutePlan`, `type RoutePlanningPoint`, `type RoutePlanningVisit`.
  Verificado: ninguna ruta (`server/routes/**`) ni otro módulo de `server/**` importa
  el path legacy. `server/routes/logistics-route-plans.fastify.ts` usa
  `GenerateHeuristicRoutePlanInput/Result` (definidos en `db-logistics.ts`) y
  `RoutePlanningMode` (de `drizzle/schema.ts`) — **no** `route-planning.ts`.
- **Test:** `test/unit/domain/logistics/logistics-route-planning.test.ts` (importa
  `buildHeuristicRoutePlan`, `calculateHaversineKm`, `type RoutePlanningVisit`).

Símbolos exportados por el módulo (superficie pública completa):

- Valores: `buildHeuristicRoutePlan`, `calculateHaversineKm`.
- Tipos: `RoutePlanningObjective`, `RoutePlanningPoint`, `RoutePlanningTimeWindow`,
  `RoutePlanningVisit`, `BuildHeuristicRoutePlanOptions`, `PlannedRouteStop`,
  `HeuristicRoutePlanResult`.

Consumidores de símbolos que **no** anclan el path legacy (quedan verdes sin tocar):

- `test/unit/infrastructure/logistics/logistics-db.test.ts` — `assert.match(dbLogisticsSource, /buildHeuristicRoutePlan/)`:
  verifica que `db-logistics.ts` sigue llamando la heurística; sigue siendo cierto.
- `test/integration/adapters/controllers/logistics-route-plans-*` — ejercen la API de
  `db-logistics.ts`/la ruta (`GenerateHeuristicRoutePlan*`, `parseOptionalRoutePlanningPoint`),
  no el path legacy.

Docs que referencian el path legacy (fuera de scope, se dejan como baseline
histórico, no rompen build/tests/guards):
`docs/architecture/shared-lib-boundary-inventory.md`,
`docs/audit/AUDIT_WHITE_BOX_TOTAL_PERFORMANCE_READINESS.md`,
`docs/logistics/ADVANCED_OPTIMIZATION_GUARDRAILS.md` y el propio documento rector de
auditoría. No se modifican en esta tarea.

## Decisión shim / no-shim

Sin shim. El censo prueba que el único consumidor runtime del path legacy
(`db-logistics.ts`) se reapunta al barrel de `domain/` en el mismo PR; conservar un
re-export en `lib/logistics/` sólo por precaución habría sido código muerto. El
archivo legacy se elimina.

## Pureza del dominio y move byte-idéntico

- `route-planning.ts` **no tiene imports** (ni siquiera del shared kernel): es
  determinista, sin efectos secundarios, sin I/O ni framework. El move es una copia
  literal a `domain/route-planning.ts` — sin edición interna — por lo que git lo
  detecta como rename 100%.
- El guard `test/architecture/logistics-domain-boundary-guard.test.ts` walkea
  `server/features/logistics/domain/**` y valida automáticamente el archivo nuevo:
  no importa `db/env/fastify/infrastructure/routes/supabase/fs/http/https`, no accede
  a `process.*` ni `fetch(`, y sólo usa imports relativos internos o tipos del shared
  kernel (aquí, ninguno). Además exige que todo consumidor runtime importe el dominio
  **por el barrel**, no por un archivo interno.

## Barrel público

`server/features/logistics/domain/index.ts` re-exporta la superficie pública completa
de `route-planning.ts` sin transformarla: `buildHeuristicRoutePlan`,
`calculateHaversineKm` y los siete tipos. El adaptador de infraestructura de SLA sigue
sin re-exportarse. El barrel continúa siendo el único punto de entrada del dominio.

## Contratos preservados

- **route-planning (algoritmo):** heurística nearest-next; objetivos `distance`
  (leg conocido primero, luego minutos, luego tie-breakers), `time` (minutos primero)
  y `sla` (presión de ventana dura → fin de ventana → prioridad → minutos);
  normalización de visitas (fieldVisitId entero positivo, coordenadas dentro de rango,
  ventanas ordenadas, `isHard` default `true`); defaults `travelSpeedKmh = 35`,
  `fallbackLegMinutes = 15` (con `ceil`); `calculateHaversineKm` con `EARTH_RADIUS_KM = 6371`;
  redondeo `roundPlannedKm` a milésimas; warning por visitas sin coordenadas válidas;
  error exacto `routeStart must be a valid Date`; desempate estable por
  `priority`/`fieldVisitId`/`inputIndex`; `planningMode: "heuristic"`. Byte-idéntico
  respecto del archivo legacy.
- **db-logistics.ts:** sólo cambian imports (consume `buildHeuristicRoutePlan` y los
  tipos `RoutePlanningPoint`/`RoutePlanningVisit` por el barrel). Queries, tipos de
  entrada, mapping, transacciones y orden de operaciones intactos.

## Archivos

| Archivo | Cambio |
| --- | --- |
| `server/features/logistics/domain/route-planning.ts` | **CREATED (rename).** Move byte-idéntico desde `lib/logistics/`. |
| `server/lib/logistics/route-planning.ts` | **DELETED.** |
| `server/features/logistics/domain/index.ts` | **MODIFIED.** Barrel re-exporta `route-planning` (2 valores + 7 tipos). |
| `server/db-logistics.ts` | **MODIFIED.** Import de `route-planning` consolidado en el import del barrel (sólo imports). |
| `test/unit/domain/logistics/logistics-route-planning.test.ts` | **MODIFIED.** Import reapuntado al barrel (mismos 7 casos). |
| `test/unit/domain/logistics/logistics-domain-barrel.test.ts` | **MODIFIED.** +1 caso: re-export de `route-planning` por el barrel. |
| `server/features/logistics/README.md` | **MODIFIED.** Estado real post-M03. |
| `server/features/logistics/domain/README.md` | **MODIFIED.** Lista `route-planning`; sólo `metrics` queda para M04. |
| `docs/implementation/m03-logistics-route-planning-domain-move.md` | **CREATED.** Este documento. |

## Tests anclados

- `test/architecture/logistics-domain-boundary-guard.test.ts` — verde sin cambios;
  cubre automáticamente el archivo nuevo de `domain/` y exige que `db-logistics.ts`
  importe el dominio por el barrel (satisfecho por la consolidación del import).
- `test/unit/domain/logistics/logistics-route-planning.test.ts` — mismos 7 casos de
  comportamiento puro, import reapuntado al barrel.
- `test/unit/domain/logistics/logistics-domain-barrel.test.ts` — +1 caso que fija el
  re-export de `buildHeuristicRoutePlan`/`calculateHaversineKm` por el barrel.
- `test/unit/infrastructure/logistics/logistics-db.test.ts` — sin cambios (el
  call-site de `buildHeuristicRoutePlan` en `db-logistics.ts` sigue intacto).

**Reconciliación de casos:** route-planning 7 → 7 (import reapuntado); barrel 4 → 5 (+1).
M03 no elimina ningún caso.

## Validaciones

Ver la sección de validaciones del reporte de ejecución (gates dirigidos con
`pnpm exec tsx --test` sobre los tests de dominio/barrel/db, luego `pnpm validate:local`,
luego `git diff --check`).

## Riesgos residuales

- Bajo. El move es byte-idéntico, el módulo no tiene dependencias, y el cambio está
  cubierto por el guard de frontera, el test de dominio, el test de barrel y el de db.
- Referencias al path legacy quedan en `docs/architecture/shared-lib-boundary-inventory.md`
  y otros docs de auditoría/logística (no modificables en esta tarea): staleza
  documental, no rompe build/tests/guards. Se reconcilia en un pase de docs posterior.

## Rollback independiente

Revertir el PR restaura `server/lib/logistics/route-planning.ts` y el import de
`db-logistics.ts`; no hay cambios de schema, migraciones ni contratos que compliquen
el revert.

## Exclusiones

Sin cambios en `server/routes/**`, `server/fastify-app.ts`, `drizzle/**`,
`migrations/**`, schema, auth/sesiones/cookies/CORS/CSP/rate-limits/headers,
`frontend/**`, `package.json`, lockfiles, `.github/**`, `scripts/**`. No se inició
M04–M06. No se modificaron `docs/audit/backend-enterprise-modularization-program-audit.md`
ni `docs/architecture/shared-lib-boundary-inventory.md`.

## Readiness para M04

`metrics.ts` sigue en `server/lib/logistics/` (importa sólo tipos de schema). El
patrón M03 (move a `domain/`, re-exportar por el barrel, reapuntar el consumidor
`db-logistics.ts` y los tests) es directamente reutilizable, salvo que `metrics.ts`
sí importa tipos del shared kernel y tiene una superficie de símbolos mayor.
