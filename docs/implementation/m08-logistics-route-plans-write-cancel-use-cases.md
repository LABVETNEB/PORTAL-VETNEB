# M08 — Casos de uso de escritura de route-plans/stops + lifecycle cancel (Fase B de Logistics)

> **Tipo:** Extracción de casos de uso (application) + puertos mínimos, detrás de
> los contratos por-ruta existentes. **Cero cambios de comportamiento observable.**
> **Scope primario:** backend runtime + tests + documentación de apoyo.

## 1. Base exacta

- **Rama:** `refactor/backend-modularization-m08-logistics-route-plans-write-cancel-use-cases`
  (creada manualmente por Nico desde `main` limpio).
- **Base `main` / HEAD:** `d21230fdb263eb0cbae1157dcb66866c25aba9d0`
  — refactor(logistics): extract route-plans application use cases (M07) (#1503).
- **Working tree inicial:** limpio · **Índice inicial:** vacío.
- **Documento rector:** `docs/audit/backend-enterprise-modularization-program-audit.md`
  (ID `ARCH-AUDIT-110`), §8 Fase B.

## 2. Autorización

R2 explícita de Nico para M08: "extraer únicamente los casos de uso de escritura
de route plans y route stops —create/update— y el lifecycle cancel hacia
`server/features/logistics/application/`. release, start y complete permanecen
fuera del scope. Deben preservarse sin cambios auth, sesiones, permisos, CORS,
trusted-origin, parsing, validaciones, contratos HTTP, mensajes, cache, timing,
auditoría, DB, queries, transacciones y serialización. Prohibido modificar
`server/db-logistics.ts`, schema, migraciones, frontend, dependencias, lockfiles,
CI o iniciar M09+."

## 3. Objetivo

Extraer, hacia `application/`, los casos de uso de escritura de planes de ruta
(create/update), de paradas de ruta (create/update) y de cancelación de plan
(lifecycle `cancel` únicamente), delegando en puertos mínimos derivados del seam
`LogisticsRoutePlansNativeRoutesOptions`, preservando exactamente el
comportamiento observable de `server/routes/logistics-route-plans.fastify.ts`.

## 4. Scope incluido

- Puertos `LogisticsRoutePlansWriteRepository` (create/update plan),
  `LogisticsRouteStopsWriteRepository` (create/update stop) y
  `LogisticsRoutePlanCancelRepository` (cancel).
- Casos de uso `createRoutePlansWriteUseCases`, `createRouteStopsWriteUseCases`,
  `createCancelRoutePlan`.
- Adaptación de 5 delegaciones en la ruta: `POST /`, `PATCH /:routePlanId`,
  `POST /:routePlanId/stops`, `PATCH /:routePlanId/stops/:routeStopId`, y la
  transición del handler compartido **sólo para `cancel`**.
- Tests unitarios nuevos; actualización del contrato de fuente de la ruta;
  realineación de anclas de fuente en el guard CSRF de lifecycle.
- Documentación: README de application, esta nota y status §8 del rector.

## 5. Scope excluido

- **`release`, `start`, `complete`**: sus registraciones conservan los mismos tres
  argumentos; el valor por defecto del helper mantiene la delegación directa existente.
- Sin cambios en `db-logistics.ts`, queries, transacciones, schema, migraciones,
  cache, auditoría, timing, serialización, parsing ni validaciones.
- Sin DI container, repositories genéricos, unit of work, event bus ni
  infraestructura.
- Sin guard nuevo en `test/architecture/**` (llega en M11).
- Sin iniciar M09+.

## 6. Estado previo

- Fase B con M06 (SLA overdue) y M07 (lecturas + heuristic) ya en `application/`.
- Los 5 flujos de escritura/cancel invocaban `deps.*` directamente. El lifecycle
  usa un helper compartido `handleRoutePlanLifecycleAction(action, request, reply)`
  con un único punto de delegación `deps.transitionClinicScopedRoutePlanStatus(id,
  clinicId, action)`, reutilizado por release/start/complete/cancel.

## 7. Diseño de los puertos

Tres puertos genéricos en `application/ports/`, sin imports, sin `any`:

- `LogisticsRoutePlansWriteRepository<TRoutePlan, TCreateInput, TUpdateInput>` —
  `createRoutePlan`, `updateClinicScopedRoutePlan`. Conservan `| null | undefined`
  para preservar el `500`/`404` sobre resultado ausente.
- `LogisticsRouteStopsWriteRepository<TRouteStop, TCreateInput, TUpdateInput>` —
  `createRouteStopForClinicRoutePlan`, `updateClinicScopedRouteStop`.
- `LogisticsRoutePlanCancelRepository<TResult>` — `cancelClinicScopedRoutePlan(id,
  clinicId)`. Sólo cancel; `TResult` opaco (el mapeo de rechazo/error queda en la
  ruta).

## 8. Diseño de los casos de uso

Delegación pura (patrón M06/M07): una sola llamada, retorno por identidad, sin
mutación, sin captura de errores, sin defaults, sin serialización.

- `createRoutePlansWriteUseCases(repo)` → `{ createRoutePlan, updateRoutePlan }`.
- `createRouteStopsWriteUseCases(repo)` → `{ createRouteStop, updateRouteStop }`.
- `createCancelRoutePlan(repo)` → `(id, clinicId) => repo.cancelClinicScopedRoutePlan(...)`.

`index.ts` exporta la superficie M08 junto a la de M06/M07, sin exports
preventivos.

## 9. Adaptación desde `LogisticsRoutePlansNativeRoutesOptions`

Tras resolver `deps` (junto a los adaptadores M07), una sola vez por registro:

```ts
const routePlansWrite = createRoutePlansWriteUseCases({
  createRoutePlan: deps.createRoutePlan,
  updateClinicScopedRoutePlan: deps.updateClinicScopedRoutePlan,
});
const routeStopsWrite = createRouteStopsWriteUseCases({
  createRouteStopForClinicRoutePlan: deps.createRouteStopForClinicRoutePlan,
  updateClinicScopedRouteStop: deps.updateClinicScopedRouteStop,
});
const cancelRoutePlan = createCancelRoutePlan({
  cancelClinicScopedRoutePlan: (id, clinicId) =>
    deps.transitionClinicScopedRoutePlanStatus(id, clinicId, "cancel"),
});
```

Los handlers delegan: `routePlansWrite.createRoutePlan/updateRoutePlan`,
`routeStopsWrite.createRouteStop/updateRouteStop`. El helper de lifecycle recibe
un 4º parámetro opcional `runTransition` cuyo **default reproduce exactamente el
comportamiento previo** (`(routePlanId, clinicId) =>
deps.transitionClinicScopedRoutePlanStatus(routePlanId, clinicId, action)`); sólo
la registración de `cancel` pasa `cancelRoutePlan`. Así:

- `release`/`start`/`complete`: las registraciones permanecen sin cambios y continúan
  delegando en `deps.transitionClinicScopedRoutePlanStatus` mediante el valor por
  defecto del helper.
- `cancel`: rutea la transición por el caso de uso de application.

Auth, permisos, `enforceTrustedOrigin`, parsing/validación, 500/404, cache
(invalidaciones), auditoría del lifecycle y serialización permanecen en la ruta y
sin cambios. No se tocó `handleRoutePlanLifecycleAction` salvo el parámetro
inyectable y su uso.

## 10. Cambios por archivo

- `application/ports/logistics-route-plans-write-repository.ts` — **CREATED**.
- `application/ports/logistics-route-stops-write-repository.ts` — **CREATED**.
- `application/ports/logistics-route-plan-cancel-repository.ts` — **CREATED**.
- `application/route-plans-write-use-cases.ts` — **CREATED**.
- `application/route-stops-write-use-cases.ts` — **CREATED**.
- `application/cancel-route-plan.ts` — **CREATED**.
- `application/index.ts` — **MODIFIED** (barrel: superficie M08).
- `application/README.md` — **MODIFIED** (sección M08).
- `server/routes/logistics-route-plans.fastify.ts` — **MODIFIED** (import, 3
  adaptadores, 4 delegaciones de escritura, helper de lifecycle con default +
  wiring de cancel). release/start/complete intactos.
- `test/unit/application/logistics/route-plans-write-use-cases.test.ts` — **CREATED**.
- `test/unit/application/logistics/route-stops-write-use-cases.test.ts` — **CREATED**.
- `test/unit/application/logistics/cancel-route-plan.test.ts` — **CREATED**.
- `test/integration/adapters/controllers/logistics-route-plans-api.test.ts` — **MODIFIED**
  (realineación de asserts update-plan/transición; contrato de delegación M08;
  frontera de imports).
- `test/security/security-csrf-mutating-route-coverage.test.ts` — **MODIFIED**
  (realineación del ancla de lifecycle: cancel con 4º arg; ver §14).
- `docs/implementation/m08-logistics-route-plans-write-cancel-use-cases.md` — **CREATED**.
- `docs/audit/backend-enterprise-modularization-program-audit.md` — **MODIFIED** (status §8).

Tests de runtime **sin cambios** y verdes: cache-runtime, metrics-runtime,
heuristic-runtime, audit-runtime (los stubs por Options se invocan una sola vez a
través de los casos de uso).

## 11. Contratos HTTP preservados

Sin cambios en: endpoints/métodos/prefijo, status codes (200/201/400/403/404/500),
payloads y mensajes (`"Plan de ruta creado correctamente"`, `"...actualizado..."`,
`"Parada de ruta creada..."`, `"...actualizada..."`, `"Estado del plan de ruta
actualizado correctamente"`, `"No se pudo crear el plan de ruta"`, `"Plan de ruta
no encontrado"`, `"Parada de ruta no encontrada"`, `"Plan de ruta o visita de
campo no encontrado"`), `currentStatus` de rechazo del lifecycle, CORS/OPTIONS,
`enforceTrustedOrigin`, auth, sesiones, permisos, scope clínico, cache
(invalidaciones por clínica/plan), auditoría (`LOGISTICS_ROUTE_PLAN_LIFECYCLE_CHANGED`
con `routePlanId`/`action`/`status`), DB/queries/transacciones y schema. Las
validaciones y el `parseEntityId`/`build*Input` siguen antes de la delegación.

## 12. Tests

- **Unit (nuevos):** forwarding por identidad (input/ids), una sola delegación,
  retorno por identidad (`strictEqual`), propagación de `null`, propagación del
  resultado de rechazo (cancel) y del error original por identidad, y frontera de
  imports de application.
- **Contrato de fuente (actualizado):** import por barrel (presencia, robusto a la
  expansión de miembros); composición de los 3 adaptadores antes de handlers; cada
  `deps.<op>` de escritura de plan/stop sólo en composición (`lastIndexOf <
  handlersStart`); handlers delegan; `cancel` pasa `cancelRoutePlan` al helper;
  release/start/complete registran con 3 args (default) y no pasan caso de uso;
  carga default `dbLogistics.*` presente; application sin imports HTTP/DB.
- **Runtime (sin cambios):** cache, metrics, heuristic y auditoría verdes.

## 13. Validaciones (estados canónicos)

| Gate | Comando | Estado |
| --- | --- | --- |
| 1 — unitarios nuevos | `pnpm exec tsx --test <3 unit>` | PASSED (16/16) |
| 2 — dirigidos M08 | unit + api + cache/metrics/heuristic/audit runtime + csrf | PASSED (78/78) |
| 3 — `pnpm validate:local` | typecheck + typecheck:test + test + build | PASSED (ver reporte) |
| 4 — `pnpm security:public-surface` | — | PASSED (ver reporte) |
| 5 — PR Governance local | requiere evento PR/`workflow_dispatch` con HEAD commiteado | BLOCKED |
| 6 — `git diff --check` | — | PASSED (ver reporte) |
| 7 — scope y artefactos | — | PASSED (ver reporte) |

## 14. Riesgos residuales

- **Realineación de anclas de fuente (in-PR, obligatoria por P2-D / R-01):** el
  contrato CSRF `security-csrf-mutating-route-coverage.test.ts` fijaba la firma de
  3 args de las 4 registraciones de lifecycle; cancel ahora tiene 4 args. Se
  realineó distinguiendo cancel, **preservando el invariante** (las 4 delegan al
  helper compartido que aplica `enforceTrustedOrigin`); no se debilitó ningún
  assert. Igual criterio para el ancla update-plan/transición del contrato de
  fuente.
- Registraciones de `release`, `start` y `complete` sin cambios y comportamiento
  preservado mediante el valor por defecto del helper compartido. Un futuro milestone que extraiga esas
  acciones sustituirá el default por sus casos de uso.
- Los puertos son estructurales/genéricos: un cambio de firma en las deps de
  escritura o en `transitionClinicScopedRoutePlanStatus` rompe en typecheck, no en
  runtime.
- La capa application aún sin guard propio (M11).

## 15. Rollback independiente

Revert de un único PR: los 5 flujos vuelven a invocar `deps.*` inline (incluida la
firma de 3 params del helper), se retiran los 6 archivos de application de M08 y
sus tests, y se restauran los asserts previos. No depende de revertir M06/M07 ni
afecta `db-logistics.ts`, cache, auditoría ni release/start/complete. Mismo
`dist/index.js` en deploy.

## 16. Estado final

M08 implementado: la capa application aloja las escrituras de planes y stops y la
cancelación de plan; los handlers correspondientes delegan; release/start/complete
quedan fuera y sin cambios; comportamiento observable idéntico; gates locales
verdes (Governance BLOCKED por diseño hasta que exista PR).

## 17. Readiness

- **M08: cerrado** (al merge de este PR).
- **Resto del lifecycle (release/start/complete) y M09+ (field-visits,
  route-events, guard de capa, closeout): no autorizados y no iniciados.** Cada
  milestone posterior requiere autorización R2 propia.
