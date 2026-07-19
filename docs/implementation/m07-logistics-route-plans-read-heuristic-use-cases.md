# M07 — Casos de uso de lectura de route-plans + generate-heuristic (Fase B de Logistics)

> **Tipo:** Extracción de casos de uso (application) + puertos mínimos, detrás de
> los contratos por-ruta existentes. **Cero cambios de comportamiento observable.**
> **Scope primario:** backend runtime + tests + documentación de apoyo.

## 1. Base exacta

- **Rama:** `refactor/backend-modularization-m07-logistics-route-plans-read-heuristic-use-cases`.
- **Base `main` / HEAD:** `89af3cb3724625494513198f20f9be6f5cd09c34`
  — refactor(logistics): extract SLA overdue use case (M06) (#1502).
- **Working tree inicial:** limpio · **Índice inicial:** vacío.
- **Documento rector:** `docs/audit/backend-enterprise-modularization-program-audit.md`
  (ID `ARCH-AUDIT-110`), §8 Fase B.

## 2. Autorización

R2 explícita de Nico para M07: "auditar e implementar exclusivamente los casos de
uso Logistics route-plans de lectura y generate-heuristic definidos por el
documento rector y el seam existente, preservando HTTP, auth, sesiones, permisos,
CORS, cache, auditoría, DB, queries, transacciones, schema y comportamiento
observable; sin iniciar M08 ni milestones posteriores". No cubre M08+.

## 3. Objetivo

Extraer, hacia `server/features/logistics/application/`, los casos de uso de
lectura de planes de ruta (list, detalle, stops, y las dos lecturas que alimentan
metrics) y el de generación heurística, delegando en puertos mínimos derivados
del seam `LogisticsRoutePlansNativeRoutesOptions`, preservando exactamente el
comportamiento observable de `server/routes/logistics-route-plans.fastify.ts`.

## 4. Scope incluido

- Puerto de lectura `LogisticsRoutePlansReadRepository` (3 operaciones:
  `listClinicRoutePlans`, `getClinicScopedRoutePlan`,
  `listRouteStopsForClinicRoutePlan`) y puerto `LogisticsRoutePlanGenerator`
  (`generateHeuristicRoutePlan`).
- Casos de uso `createRoutePlansReadUseCases` (list/get/listStops) y
  `createGenerateHeuristicRoutePlan`.
- Adaptación de 5 handlers de la ruta para delegar: `GET /`, `GET /:routePlanId`,
  `GET /:routePlanId/metrics`, `GET /:routePlanId/stops`, `POST /heuristic`.
- Tests unitarios nuevos; actualización del contrato de fuente de la ruta.
- Documentación: README de application, esta nota y status §8 del rector.

## 5. Scope excluido

- Escrituras (`POST /`, `PATCH /:routePlanId`, stops create/update, lifecycle
  release/start/complete/cancel): siguen llamando a `deps.*` directamente (M08).
- Sin cambios en `db-logistics.ts`, queries, transacciones, cache
  (`logistics-route-plans-cache.ts`), auditoría, schema ni migraciones.
- Sin DI container, repositories genéricos, unit of work, event bus ni archivo de
  `infrastructure`.
- Sin mover cálculo de metrics (ya es dominio `calculateRouteStopComplianceMetrics`)
  ni tocar el domain.
- Sin guard nuevo en `test/architecture/**` (llega en M11).

## 6. Estado previo

- Fase B iniciada en M06 (`application/` con el UC SLA overdue).
- Los 5 handlers de lectura/heuristic invocaban `deps.*` directamente tras auth →
  permisos → parsing (y cache/timing donde aplica).
- Seam existente `LogisticsRoutePlansNativeRoutesOptions` con las deps de lectura
  y `generateHeuristicRoutePlan`; carga default lazy desde `db-logistics.ts` en
  `loadDefaultDeps`.

## 7. Diseño de los puertos

`ports/logistics-route-plans-read-repository.ts`:

- `LogisticsRoutePlansReadRepository<TRoutePlan, TRouteStop, TListParams>` con las
  3 operaciones de lectura. Genérico: en la ruta se infieren `RoutePlan`,
  `RouteStop` y `ListRoutePlansParams` sin casts; no importa `db-logistics.ts` ni
  `drizzle/schema.ts`. `getClinicScopedRoutePlan` conserva `| null | undefined`
  para preservar el `if (!routePlan) → 404`.

`ports/logistics-route-plan-generator.ts`:

- `LogisticsRoutePlanGenerator<TInput, TResult>` con una sola operación;
  `TInput`/`TResult` opacos (la validación de input y el mapeo de rechazo/error
  viven en la ruta). Cero imports en ambos puertos, sin `any`.

## 8. Diseño de los casos de uso

`route-plans-read-use-cases.ts`:

- `createRoutePlansReadUseCases(repository)` → `{ listRoutePlans, getRoutePlan,
  listRoutePlanStops }`. Cada método delega exactamente una vez y devuelve el
  resultado del puerto por identidad, sin mapear, clonar ni capturar errores.

`generate-heuristic-route-plan.ts`:

- `createGenerateHeuristicRoutePlan(generator)` → `(input) => Promise<TResult>`.
  Una sola delegación; preserva el resultado (éxito o rechazo `reason`) por
  identidad y propaga el error original.

`index.ts` exporta la superficie M07 junto a la de M06, sin exports preventivos.

## 9. Adaptación desde `LogisticsRoutePlansNativeRoutesOptions`

Tras resolver `deps`, en el cuerpo del plugin (una sola vez, no por request):

```ts
const routePlansRead = createRoutePlansReadUseCases({
  listClinicRoutePlans: deps.listClinicRoutePlans,
  getClinicScopedRoutePlan: deps.getClinicScopedRoutePlan,
  listRouteStopsForClinicRoutePlan: deps.listRouteStopsForClinicRoutePlan,
});
const generateHeuristicRoutePlan = createGenerateHeuristicRoutePlan({
  generateHeuristicRoutePlan: deps.generateHeuristicRoutePlan,
});
```

Los handlers pasan a llamar `routePlansRead.listRoutePlans/getRoutePlan/
listRoutePlanStops` y `generateHeuristicRoutePlan`. Todo lo demás (auth,
permisos, `enforceTrustedOrigin` para heuristic, parsing/400, cache get/set y
`X-Logistics-Cache`, `createRuntimeTimer`/`planningDurationMs`, invalidación de
cache tras generar, serialización, 404, envelope) permanece intacto. La carga
default desde `db-logistics.ts` no se movió.

## 10. Cambios por archivo

- `server/features/logistics/application/ports/logistics-route-plans-read-repository.ts` — **CREATED**.
- `server/features/logistics/application/ports/logistics-route-plan-generator.ts` — **CREATED**.
- `server/features/logistics/application/route-plans-read-use-cases.ts` — **CREATED**.
- `server/features/logistics/application/generate-heuristic-route-plan.ts` — **CREATED**.
- `server/features/logistics/application/index.ts` — **MODIFIED** (barrel: superficie M07).
- `server/features/logistics/application/README.md` — **MODIFIED** (sección M07).
- `server/routes/logistics-route-plans.fastify.ts` — **MODIFIED** (import del barrel,
  composición de los dos adaptadores, delegación de los 5 handlers de
  lectura/heuristic). Escrituras y lifecycle intactos.
- `test/unit/application/logistics/route-plans-read-use-cases.test.ts` — **CREATED**.
- `test/unit/application/logistics/generate-heuristic-route-plan.test.ts` — **CREATED**.
- `test/integration/adapters/controllers/logistics-route-plans-api.test.ts` — **MODIFIED**
  (asserts de lectura/heuristic → delegación; contrato de delegación M07; frontera
  de imports de application).
- `docs/implementation/m07-logistics-route-plans-read-heuristic-use-cases.md` — **CREATED**.
- `docs/audit/backend-enterprise-modularization-program-audit.md` — **MODIFIED** (status §8).

Tests de runtime **sin cambios** y verdes: `logistics-route-plans-cache-runtime`,
`-metrics-runtime`, `-heuristic-runtime`, `logistics-audit-runtime` (los stubs por
Options siguen invocándose una sola vez a través de los casos de uso).

## 11. Contratos HTTP preservados

Sin cambios en: endpoints/métodos/prefijo, status codes (200/201/400/403/404),
payloads (`routePlans`/`routePlan`/`routeStops`/`planning`/`metrics`/`pagination`),
header `X-Logistics-Cache` (HIT/MISS), `planningDurationMs`, `missingFieldVisitIds`,
textos de error, CORS/OPTIONS, `enforceTrustedOrigin` para heuristic, auth,
sesiones, permisos (`canManageLogisticsRoutePlans` bajo métodos unsafe), scope
clínico, cache TTL/keys, orden de auditoría de lifecycle, DB/queries/transacciones
y schema. Las validaciones (fechas, tolerancias, `MAX_ROUTE_PLAN_FIELD_VISIT_IDS`)
siguen antes de la llamada al caso de uso.

## 12. Tests

- **Unit (nuevos):** forwarding exacto por identidad (params, id/clinicId, input y
  su `fieldVisitIds`), una sola delegación por método, retorno por identidad
  (`strictEqual`), propagación de `null`, propagación del error original y del
  resultado de rechazo `reason`, y frontera de imports de application.
- **Contrato de fuente (actualizado):** import por barrel; composición de ambos
  puertos antes de los handlers; cada `deps.<op>` de lectura/heuristic sólo en la
  zona de composición (no dentro de handlers, verificado por `lastIndexOf < handlersStart`);
  handlers delegan en los casos de uso; carga default `dbLogistics.*` presente;
  escrituras siguen en `deps.*`; application sin imports HTTP/DB.
- **Runtime (sin cambios):** cache HIT/MISS, metrics, heuristic (timing, warnings,
  missing ids, invalidación) y auditoría de lifecycle verdes.

## 13. Validaciones (estados canónicos)

| Gate | Comando | Estado |
| --- | --- | --- |
| 1 — unitarios nuevos | `pnpm exec tsx --test <2 unit>` | PASSED (12/12) |
| 2 — dirigidos M07 | unit + api + cache/metrics/heuristic/audit runtime | PASSED (55/55) |
| 3 — `pnpm validate:local` | typecheck + typecheck:test + test + build | PASSED (ver reporte) |
| 4 — `pnpm security:public-surface` | — | PASSED (ver reporte) |
| 5 — PR Governance local | requiere evento PR/`workflow_dispatch` con HEAD commiteado | BLOCKED |
| 6 — `git diff --check` | — | PASSED (ver reporte) |
| 7 — scope y artefactos | — | PASSED (ver reporte) |

## 14. Riesgos residuales

- El contrato de delegación usa `indexOf("app.options(")` como frontera
  composición/handlers; si M14 (thin route) reordena la composición o los handlers,
  se realinea en el mismo PR (patrón asumido por los source-contracts del repo).
- Los puertos son estructurales/genéricos: un cambio de firma en las deps de
  lectura o en `GenerateHeuristic*` se propaga por inferencia (falla typecheck, no
  runtime).
- La capa application aún no tiene guard propio (M11); la frontera la fijan los
  tests unitarios y el contrato de fuente.

## 15. Rollback independiente

Revert de un único PR: los 5 handlers vuelven a invocar `deps.*` inline, se retiran
los 4 archivos de application de M07 y sus tests, y se restauran los asserts
previos del contrato. No depende de revertir M06 ni afecta `db-logistics.ts`,
cache, auditoría ni ninguna otra ruta. Mismo `dist/index.js` en deploy.

## 16. Estado final

M07 implementado: la capa application aloja los casos de uso de lectura de
route-plans y de generación heurística; los 5 handlers delegan; comportamiento
observable idéntico; gates locales verdes (Governance BLOCKED por diseño hasta que
exista PR).

## 17. Readiness

- **M07: cerrado** (al merge de este PR).
- **M08 (UC route-plans escritura + lifecycle `cancel`): no autorizado y no
  iniciado.** Cada milestone posterior requiere autorización R2 propia.
