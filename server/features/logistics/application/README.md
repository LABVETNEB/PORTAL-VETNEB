# Logistics · application (orquestación)

> Capa **application** del contexto Logistics. **Contiene código** desde M06
> (SLA lectura/overdue), crece en M07 con las lecturas de planes de ruta y la
> generación heurística, y en M08 con las escrituras de planes y stops
> (create/update) y la cancelación de plan (lifecycle `cancel`).
> Ver la frontera del contexto en [`../README.md`](../README.md) y el contrato en
> [ARCH-2](../../../../docs/architecture/backend-boundary-adr.md).

## Responsabilidad

Orquesta **casos de uso** de logística: coordina reglas de `domain` con datos
provistos por `infrastructure`, aplicando la secuencia de un flujo (validar →
resolver → persistir → responder) sin conocer detalles de HTTP ni de persistencia
concreta.

## Qué vive aquí (M06)

- **`list-overdue-active-sla-instances.ts`** — caso de uso
  `createListOverdueActiveSlaInstances`: recibe un input ya autenticado, validado
  y clinic-scoped desde la ruta, delega exactamente una vez en el puerto de
  lectura y devuelve el resultado sin mutarlo, propagando los errores del puerto
  sin envolverlos.
- **`ports/logistics-sla-read-repository.ts`** — puerto mínimo
  `LogisticsSlaReadRepository`: una sola operación semántica
  (`listOverdueActiveClinicSlaInstances`), derivada del seam
  `LogisticsSlaNativeRoutesOptions`. Genérico sobre el tipo de instancia y de
  target para no filtrar tipos concretos de DB/schema hacia application.
- **`index.ts`** — barrel público con la superficie de M06, sin exports
  preventivos para milestones futuros.

El adaptador real del puerto se construye **en la ruta**
(`server/routes/logistics-sla.fastify.ts`) desde la dependencia ya resuelta en
`deps`; la carga default desde `db-logistics.ts` sigue viviendo en la zona de
composición de la ruta, no aquí.

## Qué vive aquí (M07)

- **`route-plans-read-use-cases.ts`** — `createRoutePlansReadUseCases`: agrupa las
  lecturas de planes de ruta (`listRoutePlans`, `getRoutePlan`,
  `listRoutePlanStops`) consumidas por los handlers de list, detalle, metrics y
  stops. Cada método delega exactamente una vez en el puerto y devuelve su
  resultado sin mutarlo.
- **`generate-heuristic-route-plan.ts`** — `createGenerateHeuristicRoutePlan`:
  caso de uso de generación heurística; delega una vez en el puerto generador y
  preserva tal cual el resultado de éxito o rechazo del dominio.
- **`ports/logistics-route-plans-read-repository.ts`** —
  `LogisticsRoutePlansReadRepository`, genérico sobre plan/stop/params, derivado
  del seam `LogisticsRoutePlansNativeRoutesOptions`.
- **`ports/logistics-route-plan-generator.ts`** — `LogisticsRoutePlanGenerator`,
  con `TInput`/`TResult` opacos.

El timing (`planningDurationMs`), la cache de listas/metrics, la invalidación de
cache tras generar, la serialización, el mapeo de rechazo/error y las
validaciones (400) permanecen en `server/routes/logistics-route-plans.fastify.ts`.
Los adaptadores se componen una sola vez por registro del plugin desde `deps`.

## Qué vive aquí (M08)

- **`route-plans-write-use-cases.ts`** — `createRoutePlansWriteUseCases`:
  `createRoutePlan` y `updateRoutePlan`, consumidos por los handlers `POST /` y
  `PATCH /:routePlanId`.
- **`route-stops-write-use-cases.ts`** — `createRouteStopsWriteUseCases`:
  `createRouteStop` y `updateRouteStop`, consumidos por `POST /:routePlanId/stops`
  y `PATCH /:routePlanId/stops/:routeStopId`.
- **`cancel-route-plan.ts`** — `createCancelRoutePlan`: cancela un plan de ruta
  (lifecycle `cancel` únicamente), consumido por `POST /:routePlanId/cancel`.
- **Puertos** — `ports/logistics-route-plans-write-repository.ts`,
  `ports/logistics-route-stops-write-repository.ts` y
  `ports/logistics-route-plan-cancel-repository.ts`, genéricos, derivados del
  seam.

Cada método de escritura/cancel delega exactamente una vez y devuelve el
resultado del puerto sin mutarlo (incluyendo `null`/rechazo del dominio). El
500/404 sobre resultado ausente, la invalidación de cache, la auditoría del
lifecycle y la serialización permanecen en la ruta. **`release`, `start` y
`complete` quedan fuera de M08**: siguen usando la dep directa vía el default del
helper de lifecycle compartido.

## Regla de dependencia

- **Puede importar:** `domain`, **puertos** (interfaces) y el shared kernel.
- **No puede importar:** `fastify`, un `db-*` concreto, el runtime de Drizzle,
  React/Next ni `http`.
- Habla con el exterior a través de **puertos**, no de implementaciones concretas.
  `infrastructure` (o la zona de composición de la ruta) implementa esos puertos;
  `application` no los implementa.
- HTTP, auth, cookies, CORS, parsing de query, validaciones de transporte y
  serialización permanecen en `routes`. La persistencia concreta permanece fuera
  de application.

Frontera fijada por los tests unitarios de application en
`test/unit/application/logistics/` y por los contratos de fuente
`test/integration/adapters/controllers/logistics-sla-routes-api.test.ts` y
`logistics-route-plans-api.test.ts`.

## Qué vendrá después (no ahora)

`release`/`start`/`complete` (resto del lifecycle) y M09–M11 (field-visits,
route-events, guard de capa y closeout) **no están iniciados**. Cada puerto nuevo
se introduce junto con su primer consumidor real — nunca como interfaz vacía
anticipada.

## Qué NO hacer

No crear services vacíos ni puertos/interfaces sin consumidor. No introducir
event bus, DI container ni repositories genéricos. No mover validaciones HTTP ni
serialización al caso de uso.
