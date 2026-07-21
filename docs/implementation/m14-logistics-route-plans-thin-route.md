# M14 — Logistics: thin `logistics-route-plans` (puerto de cache + use case)

**Estado:** implementado / **pendiente de merge**. Working tree listo para revisión
manual de Nico; ninguna escritura Git/GitHub ejecutada por el agente.

- **Rama:** `refactor/backend-modularization-m14-thin-logistics-route-plans`
- **Base exacta:** `4fedeffa68dfa6a680beff602bda12b5a31abfbc`
  (`refactor(logistics): move cache adapter to infrastructure (#1511)` = **M13 ya
  mergeado**)
- **Programa:** Fase C (Logistics infra + rutas), milestone **M14**
- **Autorización:** refactor **R2 estructural backend**, autorizado específicamente
  por Nico en la tarea actual (AGENTS.md §3), con arquitectura cerrada
  (route → use case → repository port + cache port → infrastructure adapters) y
  variante de serialización confirmada: **serializer puro síncrono**
  (`serializeSnapshot: (domainResult) => snapshot`), sin callbacks asíncronos ni
  acceso a request/reply/DB/cache/auth.

## 1. Objetivo y alcance

Adelgazar `server/routes/logistics-route-plans.fastify.ts`: la ruta deja de
importar y orquestar el cache directamente. El **puerto de cache** se introduce en
M14 porque aquí aparece su **primer consumidor real** (criterio del programa:
nunca interfaces vacías anticipadas, diferido deliberadamente desde M13).

**Incluido:** puerto opaco de cache, caso de uso de read-through + invalidación,
adapter mínimo en infrastructure, ruta delegando, retiro del shim legacy del
cache, realineación de contratos in-PR, documentación.
**Excluido:** M15, M16, M17; el cache canónico de M13 (intacto); `db-logistics`
(canónico y shim); schema; migraciones; dependencias; auth global; CORS; rutas de
field-visits/route-events/SLA.

## 2. Baseline R0 (medido en HEAD `4fedeff`)

| Métrica | Valor |
| --- | --- |
| LOC de la ruta (`wc -l`) | **2.283** → **2.260** tras M14 |
| Import de cache en la ruta | estático, 6 símbolos vía shim `server/lib/logistics-route-plans-cache.ts` (única fuga de capa) |
| Endpoints | 13 funcionales + 10 `OPTIONS` (sin cambios) |
| Read-through cacheados | 2 — `GET /` (listado) y `GET /:routePlanId/metrics` |
| Mutaciones con invalidación | 7 — heurística, `POST /`, `PATCH /:routePlanId`, `POST/PATCH` stops, lifecycle ×4 (helper compartido) |
| Op de cache sin call-site | `clearRoutePlanMetricsCacheByClinic` (no entra al puerto) |
| Queries/transacciones inline en la ruta | 0 (todo vía deps → UCs M07/M08) |

## 3. Diseño implementado

```text
route (HTTP: auth/RBAC/clinicId, parsing, status codes, X-Logistics-Cache)
  -> createRoutePlansCacheUseCases (application)
       -> LogisticsRoutePlansReadRepository   (puerto M07, reutilizado)
       -> LogisticsRoutePlansCacheRepository  (puerto M14, nuevo)
            -> createLogisticsRoutePlansCacheAdapter (infrastructure, M14)
                 -> logistics-route-plans-cache.ts   (canónico M13, intacto)
  -> deps seam (UCs M07/M08 + auth/audit)
       -> createLogisticsRoutePlansDbAdapter  (infrastructure, M14, carga lazy)
            -> db-logistics.ts                (canónico M12, intacto)
```

La ruta queda **sin ninguna referencia a `db-logistics`** (ni estática, ni
dinámica, ni type-only, ni textual): los 11 tipos de I/O y las 9 operaciones DB
llegan por el **adapter DB** de infrastructure, que re-expone referencias
directas del canónico (sin envolver resultados, sin alterar signatures,
null/undefined, errores ni transacciones). La carga default conserva su
laziness previa: el adapter se importa dinámicamente dentro de
`loadDefaultDeps`, así que registrar el plugin con todas las deps inyectadas
sigue sin cargar `server/db.ts`.

- **Puerto** `LogisticsRoutePlansCacheRepository<TListSnapshot, TMetricsSnapshot>`:
  6 operaciones (get/set de listado, get/set de métricas, invalidación de listado
  por clínica, invalidación de métricas por plan). Genérico y opaco: application
  no conoce la forma del body cacheado. **Nota de diseño:** la instrucción
  enumeraba también "invalidación de métricas por clínica", pero esa operación
  (`clearRoutePlanMetricsCacheByClinic`) **no tiene ningún call-site** en la ruta
  (verificado en R0); incluirla violaría el criterio "únicamente las operaciones
  realmente utilizadas" de la misma instrucción, así que quedó fuera.
- **Use case** `createRoutePlansCacheUseCases({ repository, cache, now })`:
  - `getRoutePlansListSnapshot(params, serializeSnapshot)` — construye la misma
    clave (`clinic:|status:|planningMode:|objective:|limit:|offset:`), HIT
    retorna el snapshot cacheado; MISS consulta `listClinicRoutePlans`, ejecuta
    el serializer puro, escribe con la **misma marca de tiempo** de la lectura y
    retorna `{ snapshot, cacheStatus: "MISS" }`.
  - `getRoutePlanMetricsSnapshot(input, serializeSnapshot)` — misma clave
    (`clinic:|plan:|distanceTolerancePercent:|timeToleranceMin:|toleranceMin:`
    con la normalización previa de valores), HIT idéntico; MISS resuelve
    `Promise.all(getClinicScopedRoutePlan, listRouteStopsForClinicRoutePlan)`;
    plan ausente → `{ reason: "route_plan_not_found" }` **sin** `cacheStatus`.
  - En error (repositorio o serializer): **sin `cache.set`**, **sin
    `cacheStatus`**, error propagado sin envolver (→ la ruta no escribe header).
  - Invalidaciones con la semántica exacta previa:
    `invalidateAfterRoutePlanCreated` (sólo lista),
    `invalidateAfterRoutePlanMutation` (lista + métricas del plan, en ese orden),
    `invalidateAfterRouteStopMutation` (sólo métricas del plan).
- **Adapter** `createLogisticsRoutePlansCacheAdapter()`: composición mínima
  1:1 sobre los 6 símbolos del canónico. Sin Maps propias, sin TTL propio, sin
  tocar el canónico. Conformidad estructural con el puerto (infra no importa
  application).
- **Ruta**: conserva registro Fastify, schemas/parsing, auth/RBAC/clinic
  scoping, serialización concreta dentro del callback puro, mapeo de errores y
  `markLogisticsCacheStatus(reply, result.cacheStatus)`. La validación de
  tolerancias de métricas conserva su **posición previa** (tras el 404
  clinic-scoped): vive dentro del serializer y su rechazo se señaliza con el
  error tipado `MetricsToleranceValidationError`, que el handler traduce a 400
  sin cache.set y sin header. `loadDefaultDeps` conserva su forma y laziness,
  pero desde la corrección M14 compone las 9 operaciones DB desde
  `createLogisticsRoutePlansDbAdapter()` (infrastructure) en vez del shim
  `db-logistics`; los contratos M07/M08 se realinearon in-PR
  (`dbLogistics.*` → `routePlansDb.*`) sin debilitar ninguna regla.

## 4. Archivos (allowlist ejecutada)

| Archivo | Cambio |
| --- | --- |
| `server/features/logistics/application/ports/logistics-route-plans-cache-repository.ts` | **NUEVO.** Puerto opaco de cache (6 ops con consumidor real). |
| `server/features/logistics/application/route-plans-cache-use-cases.ts` | **NUEVO.** Use case de read-through + invalidaciones; claves reproducidas carácter por carácter. |
| `server/features/logistics/application/index.ts` | **MODIFICADO.** Exporta factory, tipos del UC y el puerto. |
| `server/features/logistics/infrastructure/logistics-route-plans-cache-adapter.ts` | **NUEVO.** Adapter mínimo del puerto sobre el canónico M13. |
| `server/features/logistics/infrastructure/logistics-route-plans-db-adapter.ts` | **NUEVO** (autorización acotada, path 15). Superficie DB consumida por la ruta: factory con referencias directas a las 9 operaciones canónicas + re-export de los 11 tipos de I/O. Sólo importa `./db-logistics.ts`. |
| `server/routes/logistics-route-plans.fastify.ts` | **MODIFICADO.** Delegación de cache al UC; helpers de clave removidos; header desde `cacheStatus`; 7 invalidaciones vía UC; **cero referencias a `db-logistics`** (tipos y carga default vía adapter DB, lazy). |
| `server/lib/logistics-route-plans-cache.ts` | **ELIMINADO.** Shim legacy sin consumidores productivos. |
| `test/unit/application/logistics/route-plans-cache-use-cases.test.ts` | **NUEVO.** 14 tests (HIT/MISS, claves exactas, aislamiento clinic/plan, errores sin set, not_found, invalidación exacta, serializer sólo en MISS, misma marca de tiempo get/set). |
| `test/integration/adapters/controllers/logistics-route-plans-api.test.ts` | **MODIFICADO.** Anclas realineadas (listado/métricas vía UC, import-list, `dbLogistics.*` → `routePlansDb.*`) + 2 tests M14 nuevos (delegación de cache/DB + pureza de la capa M14); bloqueo textual de `db-logistics` en la ruta (estático/dinámico/type-only). Sin debilitar anclas. |
| `test/architecture/logistics-infrastructure-boundary-guard.test.ts` | **MODIFICADO.** Contratos M13 del shim reemplazados por M14: shim del cache retirado y no recreable, contratos de ambos adapters (cache: sólo canónico, sin Maps propias; DB: sólo canónico, sin queries/transacciones propias), la ruta no importa canónicos ni referencia `db-logistics`. Reglas M12 intactas. |
| `server/features/logistics/README.md` | **MODIFICADO.** Estado M13 mergeado + M14. |
| `server/features/logistics/application/README.md` | **MODIFICADO.** Sección M14 + futuro. |
| `server/features/logistics/infrastructure/README.md` | **MODIFICADO.** Adapter, shim retirado. |
| `docs/audit/backend-enterprise-modularization-program-audit.md` | **MODIFICADO.** Status M13 mergeado + Status M14. |
| `docs/implementation/m14-logistics-route-plans-thin-route.md` | **NUEVO.** Este documento. |

**Nota de allowlist:** el contrato de la API vive en
`test/integration/adapters/controllers/logistics-route-plans-api.test.ts` (la
allowlist lo citaba bajo `test/unit/application/...`, path que no existe; se
trató como el mismo archivo previsto). Con la autorización acotada del adapter
DB, el total es de **15 paths**; no fue necesario ningún archivo fuera de la
allowlist.

**Denylist respetada (cero cambios):** cache canónico M13 (byte-idéntico),
`db-logistics.ts` (canónico y shim), `sla-breach-db.ts`, `server/db.ts`,
`server/fastify-app.ts`, rutas field-visits/route-events/SLA, `domain/**`,
`drizzle/**`, `migrations/**`, manifests/lockfiles, `.github/**`, `frontend/**`,
auth global/cookies/sesiones/CORS/CSP/rate limits, M15+.

## 5. Invariantes preservadas (antes = después)

- Métodos+paths de los 13 endpoints + 10 `OPTIONS`; schemas y parsing; bodies y
  mensajes; status codes (200/201/204/400/401/403/404/409/500).
- `X-Logistics-Cache` HIT/MISS sólo en 200 cacheados; **ausencia de header en
  errores y 404** (sin `cacheStatus` no hay header).
- Claves de cache idénticas carácter por carácter (orden, separadores,
  `?? ""`, normalización de tolerancias); TTL 5 min; misma marca de tiempo en
  get/set; snapshot cacheado = **body ya serializado**, igual que antes.
- Invalidaciones exactas por mutación (alcance y orden).
- Precedencia 404 clinic-scoped → 400 tolerancias en métricas; DB consultada
  antes de validar tolerancias (posición previa conservada).
- Auth de sesión de clínica, RBAC `canManageLogisticsRoutePlans` sobre métodos
  unsafe, trusted-origin, clinic scoping por `auth.clinicId`.
- Auditoría `LOGISTICS_ROUTE_PLAN_LIFECYCLE_CHANGED` (posición: antes de la
  invalidación, como antes); heurística con `planningDurationMs`; lifecycle
  release/start/complete fuera de application (contrato M08 intacto).
- Cache canónico M13: 107 LOC, cero imports, 9 exports, Maps y TTL intactos
  (`git diff` vacío sobre ese archivo).
- DB canónico M12 (7 transacciones) y shim `server/db-logistics.ts`: intactos
  (`git diff` vacío sobre ambos); laziness de la carga default preservada
  (deps totalmente inyectadas siguen sin cargar `server/db.ts`).

## 6. Riesgo residual y rollback

- **Riesgo de comportamiento: bajo.** El read-through se movió con claves y
  semántica fijadas por 14 tests unitarios nuevos y por el contract-test de
  runtime del cache, que pasa **sin cambiar expectativas**.
- **Shim DB (`server/db-logistics.ts`): intacto y sin consumo desde
  route-plans.** La ruta dejó de consumirlo en M14 (tipos y carga default vía el
  adapter DB de infrastructure); el shim permanece **sólo** porque las rutas de
  field-visits, route-events y SLA lo importan hasta M15/M16. Su eliminación
  global sigue prevista para M17 (o cuando desaparezca el último consumidor).
- Comentario histórico en `logistics-domain-boundary-guard.test.ts:232-234`
  menciona el path del shim del cache ya retirado como ejemplo de no-match del
  regex; es sólo un comentario explicativo (fuera de la allowlist, se dejó
  intacto).

Rollback independiente y sin efectos de datos: restaurar el shim de
`server/lib`, revertir la ruta al import directo, borrar puerto/UC/adapter y su
test, revertir las anclas de `logistics-route-plans-api` y del guard de
infraestructura, y los 5 archivos documentales.

## 7. Validaciones

| Gate | Estado |
| --- | --- |
| Dirigido — `route-plans-cache-use-cases` (14 tests nuevos) | **PASSED** |
| Dirigidos — `logistics-route-plans-api` (+2 M14) · cache-runtime (sin cambios de expectativas) · guard infraestructura · guard application · completeness suite | **PASSED** |
| Dirigidos — heuristic-runtime · metrics-runtime · audit-runtime · validation-cutoff · CSRF coverage · production-invariants · global-auth · RBAC contract · guard domain · audit-suite-completeness | **PASSED** (78 tests) |
| `pnpm validate:local` (`typecheck && typecheck:test && test && build`) | ver informe final |
| `pnpm security:public-surface` | **NOT_RUN** (sin superficie pública/frontend) |
| `pnpm validate:local:schema` | **NOT_RUN** (sin schema/migraciones) |
| E2E (Playwright) | **NOT_RUN** (sin frontend) |
| `db:migrate` local | **NOT_RUN** (sin schema) |
| Escrituras Git/GitHub | **BLOCKED** para el agente — **[MANUAL-NICO]** |

## 8. Siguiente milestone

**M15 — thin `logistics-field-visits`.** No adelantado aquí. Fase C **no
cerrada**; M14 **no se declara cerrado hasta el merge**.

## 9. Operaciones [MANUAL-NICO]

El agente **no** ejecutó ninguna escritura Git/GitHub. Pendientes de Nico:
`git add`, `git commit`, `git push`, creación de PR, `gh pr checks --watch` (en
la rama del PR activo, sin número), merge.
