# Logistics · application (orquestación)

> Capa **application** del contexto Logistics. **Contiene código** desde M06
> (SLA lectura/overdue), crece en M07 con las lecturas de planes de ruta y la
> generación heurística, y en M08 con las escrituras de planes y stops
> (create/update) y la cancelación de plan (lifecycle `cancel`). M09 agrega la
> actualización clinic-scoped de field visits detrás del PATCH existente, y M10
> el append explícito y las tres lecturas de route events. **M11 no agrega
> código productivo**: cierra la capa con el guard global de frontera y el
> contrato global de inventario de casos de uso.
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

## Qué vive aquí (M09)

- **`update-field-visit.ts`** — `createUpdateFieldVisit`: recibe `id`,
  `clinicId` y el input parcial completo ya autenticado y validado, delega una
  vez y devuelve el resultado sin transformarlo.
- **`ports/logistics-field-visit-update-repository.ts`** — puerto mínimo con
  `updateClinicScopedFieldVisit`, derivado del seam
  `LogisticsFieldVisitsNativeRoutesOptions`.

Sólo `PATCH /:fieldVisitId` consume este caso de uso. Trusted-origin, auth,
sesiones, permisos, parsing, validaciones, 404, mensaje, status HTTP y
serialización permanecen en la ruta. El status sigue siendo un campo opcional
del mismo PATCH junto con los demás campos actualizables: no se agrega máquina
de estados, compare-and-set, auditoría, eventos, side-effects ni idempotencia.

La asignación manual de una visita a un plan se representa mediante route
stops, y la automática mediante generación heurística de stops; ambos flujos ya
fueron extraídos en M07/M08. La ruta de field visits no tiene `/assign`, y M09
no agrega reasignación, unassign, DELETE ni restricciones de unicidad.

## Qué vive aquí (M10)

- **`create-route-event.ts`** — `createCreateRouteEvent`: append explícito de un
  evento de ruta con el input ya autenticado, validado y clinic-scoped; delega
  una vez y devuelve el resultado sin transformarlo.
- **`route-events-read-use-cases.ts`** — `createRouteEventsReadUseCases`:
  `listRouteEvents`, `listRoutePlanEvents` y `pollRouteEvents`, consumidos por
  `GET /`, `GET /route-plans/:routePlanId` y `GET /poll`.
- **Puertos** — `ports/logistics-route-event-write-repository.ts` y
  `ports/logistics-route-events-read-repository.ts`, genéricos, derivados del
  seam `LogisticsRouteEventsNativeRoutesOptions`.

Las lecturas no aplican defaults propios: `params` y `limit` ausentes se
reenvían como `undefined`. `OPTIONS`, CORS, trusted-origin, auth, RBAC, parsing,
paginación, `lastEventId`, serialización, el 404 sobre resultado ausente y
`writeAuditLog` (posterior al append) permanecen en la ruta. **M10 no agrega
ningún productor automático de eventos**: el append sigue provocado únicamente
por `POST /`, sin event bus, outbox, retry, deduplicación ni idempotency keys.

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

Frontera fijada por el guard global
`test/architecture/logistics-application-boundary-guard.test.ts` (M11), por los
tests unitarios de application en `test/unit/application/logistics/` y por los
contratos de fuente
`test/integration/adapters/controllers/logistics-sla-routes-api.test.ts` y
`logistics-route-plans-api.test.ts`.

## Qué protege M11 (cierre de capa)

M11 **no toca código productivo**: agrega dos contratos ejecutables que fijan lo
que M06–M10 dejaron implícito.

- **`test/architecture/logistics-application-boundary-guard.test.ts`** — guard
  global de frontera. **Auto-descubre** recursivamente todos los `.ts` de esta
  carpeta (incluido `ports/` y cualquier subdirectorio futuro): un caso de uso
  nuevo queda cubierto sin registrarlo a mano. Es *default-deny*: sólo permite
  imports que resuelvan **dentro de la capa** y el barrel público de dominio
  `../domain/index.ts`; todo lo demás es violación, incluidos los `import type`.
  `drizzle/schema` queda prohibido **también como tipo** — la capa habla con
  tipos estructurales o del barrel de dominio, nunca con tipos de persistencia.
  Cubre las cinco formas de import (`from`, `export … from`, `import()`,
  `require()`, `import "…"`), ignora comentarios y literales, detecta
  `process.*`, `fetch(` y accesos directos al filesystem, exige que los puertos
  declaren contratos y no implementaciones, y fija que los consumidores runtime
  importen la capa **por `index.ts`**, nunca por un archivo interno.
- **`test/unit/application/logistics/logistics-application-use-case-suite-completeness.test.ts`**
  — contrato global de inventario. **No es un runner agregador**: no importa ni
  reejecuta los nueve tests unitarios (`pnpm test` ya los descubre por glob).
  Verifica dinámicamente que cada módulo de caso de uso tenga test correlativo,
  que no haya tests huérfanos, que cada factory pública del barrel pertenezca a
  un módulo y esté cubierta por su test, que cada factory se componga
  **exactamente una vez** en las rutas de Logistics, y que cada puerto esté
  exportado como tipo, consumido por un caso de uso y referenciado por un test.

Los nueve tests unitarios y los cuatro contratos de fuente de M06–M10 siguen
intactos: el guard global los **subsume**, no los reemplaza.

## Qué vendrá después (no ahora)

`release`/`start`/`complete` (resto del lifecycle) permanecen fuera de la capa y
siguen usando el default del helper de lifecycle compartido.
GET/POST/location/time-windows de field visits permanecen fuera de M09 y se
difieren al thin-route M15. El siguiente milestone es **M12** (mover
`db-logistics.ts` completo a `infrastructure`, transacciones intactas): el guard
de M11 prohíbe `db-logistics` **por nombre de módulo**, de modo que sigue siendo
correcto antes y después de ese move. Cada puerto nuevo se introduce junto con su
primer consumidor real — nunca como interfaz vacía anticipada.

## Qué NO hacer

No crear services vacíos ni puertos/interfaces sin consumidor. No introducir
event bus, DI container ni repositories genéricos. No mover validaciones HTTP ni
serialización al caso de uso.
