# M10 — Casos de uso de route events (Fase B de Logistics)

## 1. Baseline

- Rama: `refactor/backend-modularization-m10-logistics-route-events-use-cases`
- Base/HEAD al iniciar: `d9a210e08195e78774a72cd223bcbbcf2228dbee`
  (`refactor(logistics): extract field-visit update use case (#1505)`)
- Working tree inicial: limpio. Índice inicial: vacío.
- Rama creada desde `main` limpio. PRs abiertos antes de iniciar: 0.

## 2. Autorización R2

Autorización explícita y acotada a la extracción hacia `application` de las
**cuatro operaciones de datos ya existentes** en
`server/routes/logistics-route-events.fastify.ts`, sin ampliación por
inferencia y sin operaciones Git/GitHub de escritura.

## 3. Scope incluido

Cuatro handlers, cuatro operaciones, una delegación cada una:

| Handler | Operación previa (dep directa) | Delegación M10 |
| --- | --- | --- |
| `POST /` | `deps.createRouteEvent(input)` | `createRouteEvent(input)` |
| `GET /` | `deps.listClinicRouteEvents(params)` | `routeEventsRead.listRouteEvents(params)` |
| `GET /poll` | `deps.listIncrementalClinicRouteEvents(clinicId, afterId, limit)` | `routeEventsRead.pollRouteEvents(clinicId, afterId, limit)` |
| `GET /route-plans/:routePlanId` | `deps.listRouteEventsForClinicRoutePlan(routePlanId, clinicId, params)` | `routeEventsRead.listRoutePlanEvents(routePlanId, clinicId, params)` |

## 4. Scope excluido

`OPTIONS` permanece **íntegramente** en Fastify (no entra a application). Fuera
de M10 y no implementados: eventos automáticos desde route-plan lifecycle,
route-stop status, field-visit status o generación heurística; evento automático
de `no_show`; extracción de `release`/`start`/`complete`; cambios en `cancel`;
validación de pertenencia stop↔plan; orden por `eventTime`; update/delete de
route events; endpoints nuevos; tipos de evento nuevos; sanitización funcional
nueva; event bus, outbox, retry, deduplicación, idempotency keys y optimistic
locking. Sin repository genérico, sin DI container, sin Unit of Work nueva.

## 5. Auditoría previa

- Las cuatro operaciones ya existían en el seam `Options`
  (`LogisticsRouteEventsNativeRoutesOptions`) con default desde
  `db-logistics.ts` en `loadDefaultDeps`; no hubo que crear dependencias nuevas.
- `POST /` es un append explícito: no existe ningún productor automático de
  route events en el resto del contexto Logistics. M10 **no** introduce uno.
- La auditoría (`AUDIT_EVENTS.LOGISTICS_ROUTE_EVENT_CREATED`) ocurre **después**
  del append y sólo si el append devolvió un evento; el aislamiento de errores
  del audit writer no se modifica.
- El RBAC (`canManageLogisticsRouteEvents`) sólo actúa sobre métodos unsafe, por
  lo que en la práctica gobierna `POST /`; se preserva tal cual en los cuatro
  handlers.

## 6. Diseño

### Puertos

- `ports/logistics-route-event-write-repository.ts` —
  `LogisticsRouteEventWriteRepository<TRouteEvent, TCreateInput>`, con la única
  operación `createRouteEvent`.
- `ports/logistics-route-events-read-repository.ts` —
  `LogisticsRouteEventsReadRepository<TRouteEvent, TListParams, TRoutePlanListParams>`,
  con `listClinicRouteEvents`, `listRouteEventsForClinicRoutePlan` y
  `listIncrementalClinicRouteEvents`.

Ambos son estrechos, genéricos y estructurales, derivados del seam `Options`. No
importan Fastify, `db-logistics.ts`, Drizzle ni `drizzle/schema.ts`.

### Casos de uso

- `create-route-event.ts` — `createCreateRouteEvent` devuelve
  `createRouteEvent(input)`: una sola delegación, resultado por identidad
  (incluyendo `null`/`undefined`), errores propagados sin captura.
- `route-events-read-use-cases.ts` — `createRouteEventsReadUseCases` agrupa
  `listRouteEvents`, `listRoutePlanEvents` y `pollRouteEvents`, cada una con una
  sola delegación, mismos argumentos y mismo orden, sin defaults propios
  (`params`/`limit` ausentes se reenvían como `undefined`).

### Composición

En la ruta, una sola vez por registro del plugin, después de resolver `deps` y
antes de los handlers. El seam `Options`, `loadDefaultDeps` y el resto de las
dependencias quedan sin cambios.

## 7. Contratos preservados

Endpoints, métodos, prefijo, payloads, query/path params, status codes (200,
201, 400, 401, 403, 404), mensajes, forma de respuestas (`pagination`,
`polling`, `lastEventId`, `count`, `routePlanId`), `serializeRouteEvent`,
conversión de fechas, event types y sources, payload libre, `eventTime`,
`lat`/`lng`, `clinicId`, `routePlanId`, `routeStopId`, comportamiento
append-only, orden `id` ASC, cursor `afterId`, `limit`/`offset`, nullability,
tenant scope, queries, transacciones, atomicidad, comportamiento cross-tenant y
para plan inexistente, idempotencia actual (duplicados permitidos) y
comportamiento ante fallos de auditoría.

Permanecen en Fastify: `OPTIONS`, CORS, trusted-origin, auth, cookie
`app_session_id`, hash/lookup/refresh/borrado de sesión, RBAC, `clinicId`
derivado de la sesión, parsing, validaciones, defaults, límites, paginación,
mensajes, status, envelopes, serialización, `no-store`, `writeAuditLog` y el
orden append → auditoría.

## 8. Archivos

### Nuevos

- `server/features/logistics/application/create-route-event.ts`
- `server/features/logistics/application/route-events-read-use-cases.ts`
- `server/features/logistics/application/ports/logistics-route-event-write-repository.ts`
- `server/features/logistics/application/ports/logistics-route-events-read-repository.ts`
- `test/unit/application/logistics/create-route-event.test.ts`
- `test/unit/application/logistics/route-events-read-use-cases.test.ts`
- `test/integration/adapters/controllers/logistics-route-events-integration.fastify.test.ts`
- `docs/implementation/m10-logistics-route-events-use-cases.md`

### Modificados

- `server/routes/logistics-route-events.fastify.ts` (import, composición única,
  cuatro delegaciones)
- `server/features/logistics/application/index.ts` (barrel M10)
- `server/features/logistics/application/README.md`
- `test/integration/adapters/controllers/logistics-route-events-api.test.ts`
- `docs/audit/backend-enterprise-modularization-program-audit.md` (sólo estado
  de M10)

## 9. Tests

- **Unitarios** (2 archivos): una llamada por operación, mismos argumentos y
  orden, retorno por identidad, arrays vacíos, `null`/`undefined` preservados,
  propagación del error original, ausencia de mutación de input, ausencia de
  defaults, ausencia de llamadas adicionales, y frontera de imports.
- **Contrato source-anchored**: imports application, composición desde las
  cuatro deps, cuatro delegaciones, ausencia de las cuatro invocaciones directas
  en los handlers, `OPTIONS`/auth/RBAC/trusted-origin/parsing/serialización
  intactos, orden append → audit, y frontera de imports de los cuatro archivos
  application. No se debilitó ninguna assertion de seguridad previa.
- **Runtime Fastify nuevo**: los cuatro handlers extremo a extremo con fixture
  local por el seam `Options` (sin tocar
  `test/helpers/fastify-app-route-stubs.ts`), incluyendo 201/400/401/403/404,
  tenant autenticado sobre `clinicId` del body, payload completo, serialización,
  audit posterior, ausencia de audit ante fallo o ausencia del append,
  propagación de error, ausencia de deduplicación, defaults y límites de
  `GET`/`poll`/`route-plans`, listas vacías y `lastEventId`.

## 10. Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Cambio silencioso de comportamiento en 4 handlers a la vez | Runtime test nuevo por handler + contrato source-anchored actualizado |
| Defaults introducidos por la capa application | Tests unitarios que fijan `undefined` reenviado tal cual en `params` y `limit` |
| Pérdida del orden append → auditoría | Assertion de orden observable en runtime y regex de secuencia en el contrato |
| Frontera application contaminada | Guard de imports en los tests unitarios y en el contrato |

## 11. Deuda preexistente (fuera de M10)

`POST /` acepta `routePlanId` y `routeStopId` de forma independiente: **no** se
valida que el stop informado pertenezca al plan informado. Este mismatch es
**preexistente** y se documenta como deuda; corregirlo sería un cambio funcional
y queda explícitamente fuera de esta autorización.

## 12. Ausencia deliberada de automatismos

M10 extrae exactamente lo que ya existía. No se agregó ningún productor
automático de eventos (lifecycle, stop status, field-visit status, heurística,
`no_show`), ni event bus, outbox, retry, deduplicación, idempotency keys u
optimistic locking. El append sigue siendo explícito y provocado sólo por
`POST /`.

## 13. Rollback

Revertir el commit del PR restaura las cuatro invocaciones directas: los
archivos de application quedan huérfanos pero inertes, y el seam `Options`,
`db-logistics.ts`, el schema y las transacciones nunca se tocaron.

## 14. Estado final

**M10 — implementado / pendiente de merge.** M11 (guard de capa application +
suite de UCs + closeout) permanece pendiente.
