# R-14 — Clínica `/dashboard/logistica/metricas` full route adaptive contract

## PR

`feat(clinic): adapt logistics metricas full route`

## Base

- Rama: `feat/clinic-logistics-metricas-full-route-adaptive`.
- Base: `main @ 12a7ae4 feat(clinic): adapt logistics rutas full route (#1276)`.
- Fecha: 2026-07-03.

## Documentos usados

1. `docs/audit/final-global-vetneb-50-60-pr-roadmap.md` — R-14, Fase 2.
2. `docs/audit/clinic-logistics-full-routes-adaptive-contract-audit.md` (R-11) —
   auditoría rectora; contrato exacto de esta migración.
3. `docs/implementation/adapt-logistics-rutas-full-route.md` (R-13) — patrón
   de pager/limit/offset que esta migración reutiliza, adaptado al fan-out
   propio de métricas.

## Deuda original (R-11) y fan-out P1

`frontend/src/app/dashboard/logistica/metricas/page.tsx` llamaba
`getRoutePlans(requestOptions, { throwOnError: true })` sin `limit`/`offset`
(truncamiento silencioso a 50 planes, offset 0 — mismo defecto que R-12/R-13),
y además hacía **fan-out**: por cada plan de ruta devuelto, disparaba una
request adicional en paralelo vía `getRoutePlanMetrics(plan.id, ...)` dentro
de un `Promise.all`. Con el default silencioso de 50 planes, una sola carga
de página podía emitir **hasta 50 requests HTTP paralelos** al backend
(`GET /api/logistics/route-plans/:id/metrics` × N), sin paginación, sin cap,
sin indicio en la UI. Este es el hallazgo P1 que R-11 dejó documentado y
fuera de scope de R-12/R-13 (que explícitamente no tocaron `metricas/`).

## Contrato nuevo

- `metricas/page.tsx` **sigue siendo un server component puro** — sin
  wrapper cliente, `matchMedia` ni `ResizeObserver`.
- Lee `offset` y `limit` desde `searchParams` (Next 15,
  `searchParams?: Promise<MetricasPageSearchParams>`, mismo patrón que
  `rutas/page.tsx` y `visitas/page.tsx`).
- El fetch de planes pasa `{ limit, offset }` explícitos a `getRoutePlans`:
  `getRoutePlans(requestOptions, { throwOnError: true }, { limit, offset })`.
- El fan-out de métricas (`routePlans.map(plan => getRoutePlanMetrics(...))`)
  se ejecuta **únicamente sobre el array `routePlans` ya paginado** — nunca
  sobre un universo mayor. Al acotar `routePlans` a la página visible, el
  número de requests de métricas queda acotado a esa misma página.
- Pager real (`<nav aria-label="Paginación de métricas de ruta">`) con
  botones "Anterior"/"Siguiente" (`PublicRouteControl` variant `bare`,
  navegación por `href` `?offset=N&limit=M`), idéntico en estructura al de
  `rutas`/`visitas`.
- Copy explícito: `Mostrando {routeMetrics.length} métricas de ruta · página
  {currentPage}` y, cuando corresponde, `· puede haber más planes de ruta
  disponibles` — nunca se menciona un "total" porque el endpoint no lo
  expone.
- Las 4 cards resumen (Cumplimiento promedio / Paradas completadas /
  Duración promedio / Planes analizados) **no cambiaron su cálculo** —
  siguen agregando sobre `routeMetrics` — pero ahora `routeMetrics` está
  acotado a la página visible, y se agregó una leyenda explícita debajo de
  la grilla: `Métricas calculadas sobre la página visible (máximo {limit}
  planes), no sobre el total general de rutas.`

## Cap específico de métricas — por qué NO hereda el default de rutas/visitas

`rutas`/`visitas` usan `DEFAULT_LIMIT = 50` / `MAX_LIMIT = 100` porque su
endpoint backend expone ese default/max
(`parsePositiveInt(request.query.limit, 50, 100)`) y hacen **1 sola request**
por página. `métricas` en cambio hace **1 request adicional por plan
devuelto** (`getRoutePlanMetrics` por cada elemento de `routePlans`). Heredar
`limit=50` habría dejado intacto el fan-out P1 (hasta 50 requests de
métricas en paralelo), sólo que ahora "paginado" en vez de "todo el rato".
Por eso este PR define límites **propios y más bajos**, independientes del
default/max del endpoint `route-plans`:

```ts
const METRICAS_DEFAULT_LIMIT = 12;
const METRICAS_MAX_LIMIT = 24;
```

- Default `12`: una carga de página sin querystring dispara como máximo 12
  requests de métricas en paralelo (antes: hasta 50).
- Cap máximo `24` (clamp vía `Math.min(parsed, METRICAS_MAX_LIMIT)` en
  `normalizeLimit`): ningún valor de `limit` en la URL, por más alto que se
  pida, puede forzar más de 24 requests de métricas simultáneos. Esto es
  intencional y **distinto** del cap de `rutas`/`visitas` (100) porque el
  costo por ítem no es 1 request sino 1 request de planes + 1 request de
  métricas por plan.

## limit/offset — sin tocar `frontend/src/lib/api.ts`

`getRoutePlans` ya soporta `{ limit?, offset? }` desde R-13
(`LogisticsRoutePlansParams`), de forma backwards-compatible. Este PR **no
modificó `frontend/src/lib/api.ts`** — sólo cambió el call-site en
`metricas/page.tsx` para pasar el tercer argumento que antes no enviaba.
`getRoutePlanMetrics` tampoco se tocó: sigue aceptando un `planId` y
devolviendo `RouteMetrics[]` (0 o 1 elemento).

## Paginación sin `total` — heurística de página llena

El endpoint `route-plans` no expone un `total` de universo, igual que en
R-13:

- `canGoPrevious = !routePlansLoadError && offset > 0`.
- `canGoNext = !routePlansLoadError && routePlans.length === limit` (página
  llena ⇒ posible más). Mismo trade-off documentado que R-12/R-13 (falso
  positivo posible en un múltiplo exacto del `limit`).
- No se calcula `pageCount` en ningún momento.

## Métricas sobre la página visible

`routeMetrics` se deriva exclusivamente de `routePlans` (el array ya
paginado): las 4 cards resumen, el listado detallado por plan y el conteo
"Mostrando N métricas de ruta" reflejan **sólo la página actual**, nunca el
total general de rutas. Esto está declarado explícitamente en la UI (ver
"Contrato nuevo" arriba) para que no se interprete como una métrica global.

## E2E — `frontend/e2e/dashboard-logistica-metricas-full-route-adaptive.spec.ts`

5 tests, `chromium`, sesión fixture (`app_session_id=e2e_populated_clinic_session`)
servida por `frontend/e2e/fixtures/admin-populated-api-server.mjs`.

### Fixture: excepción R-14, aditiva y gateada

`metricas/page.tsx` ahora envía `limit`/`offset` explícitos, por lo que sus
requests a `/api/logistics/route-plans` empiezan a coincidir con el handler
que R-13 ya había agregado (gateado por presencia de `limit` **y** `offset`
en el querystring) y reciben los 3 `CLINIC_ROUTE_PLANS` fijos (ids 8601,
8602, 8603). Ese handler **no se modificó**.

Se agregó un handler nuevo, exclusivo de R-14, para
`GET /api/logistics/route-plans/:id/metrics` (antes inexistente en el
fixture): responde `{ metrics }` con una entrada fija por cada id de
`CLINIC_ROUTE_PLANS` (`CLINIC_ROUTE_METRICS_BY_PLAN_ID`), gateado también
por sesión de clínica poblada. Es **aditivo y aislado**:

- No modifica el handler de `route-plans` ni el de `field-visits`.
- No afecta ningún test existente de `rutas`, `visitas` ni del hub
  (`dashboard-clinic-module-state-parity.spec.ts` sigue sin ver este path).
- Sólo responde a un path (`/api/logistics/route-plans/:id/metrics`) que
  ningún otro spec del fixture compartido ejercitaba.

### Por qué el fan-out se valida por contenido renderizado y no por red

`metricas/page.tsx` es un server component puro: las llamadas a
`getRoutePlans`/`getRoutePlanMetrics` ocurren en el servidor de Next.js
(SSR → fixture), no en el navegador. `page.on("request")` de Playwright sólo
observa tráfico del navegador, así que no puede contar las requests
servidor-a-servidor. Por eso el fan-out acotado a la página visible se
valida verificando que se renderiza **exactamente 1 card de detalle por
plan de la página** (`.surface-soft` count === 3, ni más ni menos), en vez
de instrumentar contadores de red en el fixture compartido (evitado a
propósito para no introducir estado global que interfiera con tests
concurrentes de otros specs sobre el mismo servidor).

### Tests

1. **3 viewports críticos** (`1440x900`, `1366x768` desktop corto,
   `390x844` mobile), sin querystring (limit default = 12): pager siempre
   visible, `Anterior`/`Siguiente` deshabilitados (dataset fixture = 3
   planes, muy por debajo de 12 ⇒ no hay página siguiente real), exactamente
   3 cards de detalle (`.surface-soft`) renderizadas, leyenda de página
   visible con el cap (`máximo 12 planes`) presente, y **sin scroll externo**
   ni overflow horizontal del pager.
2. **Agregados reales calculados end-to-end**: navega sin querystring y
   verifica que las 4 cards resumen reflejan los valores exactos derivados
   de las 3 métricas fixture (cumplimiento promedio 85%, paradas
   completadas 15/23, duración promedio 49 min) y que los 3 badges de
   cumplimiento por plan (90%/65%/100%) están presentes — confirma que el
   pipeline fetch→fan-out→agregación funciona con datos reales del fixture,
   no sólo que el markup existe.
3. **Heurística de página llena + navegación real**: navega con
   `?limit=3&offset=0` (fuerza `routePlans.length === limit` de forma
   determinística); confirma `Siguiente` habilitado, click, la URL pasa a
   `offset=3&limit=3`, el indicador pasa a "Página 2", `Anterior` se
   habilita; click en `Anterior` vuelve a `offset=0` / "Página 1".

No se depende de datos de producción en ningún test.

## Validaciones ejecutadas

- `git diff --check` — limpio (sólo warning informativo de line-endings
  LF→CRLF de Git en Windows, no bloqueante).
- `pnpm test` — verde, 2960/2960 (incluye tests actualizados en
  `test/frontend-dashboard-logistica-metricas.test.ts` y el contrato
  compartido `test/frontend-logistics-metrics-live-read-contract.test.ts`,
  que siguió pasando sin modificaciones).
- `pnpm typecheck:test` — sin errores.
- `pnpm typecheck` — sin errores.
- `pnpm --dir frontend lint` — sin errores.
- `pnpm --dir frontend build` — build de producción exitoso;
  `/dashboard/logistica/metricas` sigue listada como ruta dinámica (`ƒ`,
  server-rendered), confirmando que sigue siendo server component.
- `pnpm --dir frontend exec playwright test
  e2e/dashboard-logistica-metricas-full-route-adaptive.spec.ts
  --project=chromium` — 5/5 passed.
- `git restore frontend/next-env.d.ts` ejecutado después de correr
  Playwright (regenera la ruta de dev del dev server) y antes de repetir
  `pnpm test` / `pnpm typecheck:test`, que se re-confirmaron en verde tras
  el restore.

## Confirmaciones de scope

- **Sin backend/API/auth/DB/server/migraciones**: no se modificó ningún
  archivo de `server/`; `frontend/src/lib/api.ts` tampoco se tocó (las
  funciones que este PR usa ya existían con la firma necesaria desde R-13).
- **Sin `globals.css`**: el pager reutiliza clases ya existentes
  (`dashboard-pagination-btn`, `dashboard-pagination-context`,
  `dashboard-surface`, `surface-soft`, etc.); no se agregó ni modificó
  ninguna regla CSS.
- **Sin `visitas/`, `rutas/` ni `LogisticsCommandCenter.tsx`**: no se tocó
  ningún archivo de esas rutas ni del hub.
- **Sin R-15/R-16**: no se avanzó `MasterDetailWorkspace` (R-15) ni Tokens
  Clínica (R-16). Quedan documentados en R-11/R-13 como próximos PRs, fuera
  de este scope.
- **Sin Admin, Particular ni Público**: archivos tocados son
  `frontend/src/app/dashboard/logistica/metricas/page.tsx`,
  `test/frontend-dashboard-logistica-metricas.test.ts`, el e2e nuevo, el
  fixture compartido de e2e (adición aditiva y gateada, ver sección de
  E2E), y este documento.

## Archivos tocados

- `frontend/src/app/dashboard/logistica/metricas/page.tsx`
- `test/frontend-dashboard-logistica-metricas.test.ts`
- `frontend/e2e/dashboard-logistica-metricas-full-route-adaptive.spec.ts` (nuevo)
- `frontend/e2e/fixtures/admin-populated-api-server.mjs` (adición aditiva y
  gateada, fuera de la lista de scope original — ver justificación en la
  sección de E2E)
- `docs/implementation/adapt-logistics-metricas-full-route.md` (nuevo, este documento)
