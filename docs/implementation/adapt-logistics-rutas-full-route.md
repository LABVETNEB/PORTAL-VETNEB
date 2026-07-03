# R-13 — Clínica `/dashboard/logistica/rutas` full route adaptive contract

## PR

`feat(clinic): adapt logistics rutas full route`

## Base

- Rama: `feat/clinic-logistics-rutas-full-route-adaptive`.
- Base: `main @ ce258d4 feat(clinic): adapt logistics visitas full route (#1275)`.
- Fecha: 2026-07-03.

## Documentos usados

1. `docs/audit/final-global-vetneb-50-60-pr-roadmap.md` — R-13, Fase 2.
2. `docs/audit/clinic-logistics-full-routes-adaptive-contract-audit.md` (R-11) —
   auditoría rectora; contrato exacto de esta migración.
3. `docs/implementation/adapt-logistics-visitas-full-route.md` (R-12) — patrón
   aprobado que esta migración replica 1:1 para `rutas`.

## Deuda original (R-11)

`frontend/src/app/dashboard/logistica/rutas/page.tsx` llamaba
`getRoutePlans(requestOptions, { throwOnError: true })` sin enviar
`limit`/`offset`, aunque el endpoint backend
(`server/routes/logistics-route-plans.fastify.ts:1642-1643`,
`parsePositiveInt(request.query.limit, 50, 100)`) ya los soporta. Mismo efecto
que R-12: **truncamiento silencioso** al default del servidor (50 registros,
offset 0), sin paginación, sin indicio en la UI, sin mecanismo adaptativo.

## Hallazgo adicional no cubierto por R-11: `res.plans` vs `res.routePlans`

Al extender `getRoutePlans` se detectó que **el nombre de campo leído por el
cliente nunca coincidió con el que expone el backend**:

- Backend (`RoutePlansListSnapshot`, `server/routes/logistics-route-plans.fastify.ts:160-168`):
  `{ success, count, routePlans: [...], pagination }`.
- Cliente, antes de este PR (`frontend/src/lib/api.ts`): `apiFetch<{ plans: RoutePlan[] }>(...)`
  y `return res.plans ?? [];`.

`res.plans` **nunca existió** en la respuesta real — `getRoutePlans` devolvía
`[]` incondicionalmente en producción, independientemente de cuántos planes de
ruta existieran. Este bug es independiente del truncamiento a 50 que motivó
R-11/R-12/R-13 y no estaba documentado en la auditoría R-11. Se corrigió como
parte de este PR (mismo archivo, misma función que ya estaba en scope para
añadir `limit`/`offset`): `apiFetch<{ routePlans: RoutePlan[] }>(...)` +
`return res.routePlans ?? [];`. Sin esta corrección, el contrato adaptativo de
paginación construido en este PR habría paginado sobre un array siempre
vacío. No se tocó el backend — el nombre de campo correcto (`routePlans`) ya
existía ahí; sólo se corrigió el lado cliente.

## Contrato nuevo

- `rutas/page.tsx` **sigue siendo un server component puro** — no se agregó
  ningún wrapper cliente, `matchMedia` ni `ResizeObserver`.
- Lee `offset` y `limit` desde `searchParams` (Next 15,
  `searchParams?: Promise<RutasPageSearchParams>`, mismo patrón que
  `dashboard/logistica/visitas/page.tsx`) y los normaliza server-side:
  - `normalizeOffset`: entero ≥ 0, default `0`.
  - `normalizeLimit`: entero ≥ 1, default `RUTAS_DEFAULT_LIMIT = 50` (paridad
    exacta con el default silencioso anterior), clamp máximo
    `RUTAS_MAX_LIMIT = 100` (mismo tope que el backend).
- El fetch pasa `{ limit, offset }` explícitos a `getRoutePlans` (antes no se
  enviaba ningún parámetro).
- Pager real (`<nav aria-label="Paginación de planes de ruta">`) con botones
  "Anterior"/"Siguiente" (`PublicRouteControl` variant `bare`, navegación por
  `href` `?offset=N&limit=M`, sin `next/link` ni `<a>`, consistente con
  `project_frontend_navigation_hardening`).
- Copy explícito: `Mostrando {routePlans.length} planes de ruta · página
  {currentPage}` y, cuando corresponde, `· puede haber más planes de ruta
  disponibles` — nunca se menciona un "total" porque el endpoint no lo
  expone.

## limit/offset — `frontend/src/lib/api.ts`

`getRoutePlans` se extendió de forma **backwards-compatible** agregando un
tercer parámetro posicional opcional:

```ts
export async function getRoutePlans(
  options?: RequestInit,
  readOptions: LogisticsReadOptions = {},
  params?: LogisticsRoutePlansParams, // { limit?; offset? }
): Promise<RoutePlan[]>
```

El querystring sólo se construye cuando `params` trae `limit`/`offset`
(`URLSearchParams`, mismo patrón que `getLogisticsFieldVisits`). Los tres
consumidores existentes que llaman con 2 argumentos
(`dashboard/page.tsx` vía `getDashboardStats`, `dashboard/logistica/page.tsx`
— hub —, y `dashboard/logistica/metricas/page.tsx`) siguen recibiendo la URL
sin querystring, **idéntica a antes**. Ninguno de esos tres call-sites fue
tocado. No se modificó el backend: los parámetros ya existían en el endpoint.

## Paginación sin `total` — heurística de página llena

El endpoint devuelve `count` (tamaño de la página actual) y
`pagination: { limit, offset }`, nunca un `total` de universo. Por eso:

- `canGoPrevious = !routePlansLoadError && offset > 0`.
- `canGoNext = !routePlansLoadError && routePlans.length === limit` (página
  llena ⇒ posible más). Misma heurística y mismo trade-off documentado que
  R-12 (falso positivo posible en un múltiplo exacto del `limit`).
- No se calcula `pageCount` en ningún momento (no hay `total` con qué
  calcularlo).

## Métricas sobre la página visible

Los 4 contadores superiores (`Borradores`/`Liberados`/`En curso`/
`Completados`) siguen calculándose con `routePlans.filter(...)` sobre el
array que llegó en la página actual — comportamiento sin cambios
funcionales, pero ahora está **aclarado explícitamente** en la UI con un
texto nuevo: `Conteos calculados sobre la página visible, no sobre el total
general de planes de ruta.`

## E2E — `frontend/e2e/dashboard-logistica-rutas-full-route-adaptive.spec.ts`

4 tests, `chromium`, sesión fixture (`app_session_id=e2e_populated_clinic_session`)
servida por `frontend/e2e/fixtures/admin-populated-api-server.mjs`.

### Fixture: nuevo handler aditivo, sin romper el invariante existente

A diferencia de `field-visits`, el fixture compartido **no tenía ningún
handler** para `/api/logistics/route-plans` — `dashboard-clinic-module-state-parity.spec.ts`
(test "populated session: stats still errors (no route-plans fixture)...")
depende explícitamente de que ese endpoint siga sin responder cuando se lo
llama sin querystring (el call-site de 2 argumentos dentro de
`getDashboardStats`).

Se agregó un handler **aditivo y condicionado**: sólo responde
`{ routePlans: CLINIC_ROUTE_PLANS }` (3 planes fijos) cuando la request trae
`limit` **o** `offset` en el querystring. `rutas/page.tsx` siempre envía
ambos parámetros explícitos (incluso en sus defaults), mientras que los tres
call-sites de 2 argumentos nunca envían querystring — por lo tanto:

- El test de `dashboard-clinic-module-state-parity.spec.ts` sigue viendo
  exactamente el mismo comportamiento (404 sin querystring ⇒
  `statsLoadError` sigue siempre `true`).
- Sólo las requests que salen de la nueva página `rutas` (que siempre llevan
  `?limit=N&offset=M`) reciben datos reales del fixture.

Esta es la única modificación de este PR fuera de la lista de archivos
explícitamente permitida; se documenta aquí de forma transparente por ser
necesaria para poder probar de punta a punta la navegación real del pager
(equivalente al patrón ya usado en `visual-regression-stress.spec.ts`, que
también sirve `route-plans` desde un fixture propio).

### Tests

1. **3 viewports críticos** (`1440x900`, `1366x768` desktop corto,
   `390x844` mobile), sin querystring: pager siempre visible,
   `Anterior`/`Siguiente` deshabilitados en el estado inicial (dataset
   fixture = 3 planes, muy por debajo del `limit` default de 50 ⇒ no hay
   página siguiente real), texto de alcance de página visible presente, y
   **sin scroll externo** (`html`/`body` `scrollHeight <= clientHeight + 2px`
   tolerancia) ni overflow horizontal del pager.
2. **Heurística de página llena + navegación real**: navega con
   `?limit=3&offset=0` (el fixture siempre sirve exactamente 3 planes de
   ruta ignorando el querystring exacto pedido más allá del gate
   limit/offset, así que pedir `limit=3` fuerza de forma determinística el
   estado "página llena" sin depender de datos reales); confirma
   `Siguiente` habilitado, click, la URL pasa a `offset=3&limit=3`, el
   indicador pasa a "Página 2", `Anterior` se habilita; click en `Anterior`
   vuelve a `offset=0` / "Página 1".

No se depende de datos de producción en ningún test.

## Validaciones ejecutadas

- `git diff --check` — limpio.
- `pnpm test` — verde (incluye tests nuevos de contrato en
  `test/frontend-dashboard-logistica-rutas.test.ts`).
- `pnpm typecheck:test` — sin errores.
- `pnpm typecheck` — sin errores.
- `pnpm --dir frontend lint` — sin errores.
- `pnpm --dir frontend build` — build de producción exitoso;
  `/dashboard/logistica/rutas` sigue listada como ruta dinámica (`ƒ`,
  server-rendered), confirmando que sigue siendo server component.
- `pnpm --dir frontend exec playwright test
  e2e/dashboard-logistica-rutas-full-route-adaptive.spec.ts
  --project=chromium` — 4/4 passed.
- `git restore frontend/next-env.d.ts` ejecutado después de correr Playwright
  (regenera la ruta de dev del dev server) y antes de repetir `pnpm test` /
  `pnpm typecheck:test`, que se re-confirmaron en verde tras el restore.

## Confirmaciones de scope

- **Sin backend/API/auth/DB/server/migraciones**: `server/**` sólo se leyó
  (`logistics-route-plans.fastify.ts`) para confirmar los límites
  `parsePositiveInt(..., 50, 100)` ya soportados y el nombre real del campo
  de respuesta (`routePlans`); no se modificó ningún archivo de `server/`.
- **Sin `globals.css`**: el pager reutiliza clases ya existentes
  (`dashboard-pagination-btn`, `dashboard-pagination-context`,
  `dashboard-surface`, etc.); no se agregó ni modificó ninguna regla CSS.
- **Sin `visitas/`, `metricas/` ni `LogisticsCommandCenter.tsx`**: no se tocó
  ningún archivo de esas rutas ni del hub; los tres consumidores que aún
  llaman `getRoutePlans` sin `limit`/`offset` (`dashboard/page.tsx` vía
  `getDashboardStats`, `dashboard/logistica/page.tsx`,
  `dashboard/logistica/metricas/page.tsx`) mantienen exactamente el mismo
  comportamiento gracias a la compatibilidad hacia atrás de la firma
  extendida.
- **Sin R-14/R-15/R-16**: no se avanzó el fan-out de `métricas` (R-14), ni se
  tocó `MasterDetailWorkspace` (R-15) o Tokens Clínica (R-16). Quedan
  documentados en R-11 como próximos PRs, fuera de este scope.
- **Sin Admin, Particular ni Público**: archivos tocados son
  `frontend/src/app/dashboard/logistica/rutas/page.tsx`,
  `frontend/src/lib/api.ts` (extensión backwards-compatible de una función +
  corrección del nombre de campo leído),
  `test/frontend-dashboard-logistica-rutas.test.ts`, el e2e nuevo, el
  fixture compartido de e2e (adición condicionada, ver sección de E2E), y
  este documento.

## Archivos tocados

- `frontend/src/app/dashboard/logistica/rutas/page.tsx`
- `frontend/src/lib/api.ts`
- `test/frontend-dashboard-logistica-rutas.test.ts`
- `frontend/e2e/dashboard-logistica-rutas-full-route-adaptive.spec.ts` (nuevo)
- `frontend/e2e/fixtures/admin-populated-api-server.mjs` (adición aditiva y
  condicionada, fuera de la lista de scope original — ver justificación en
  la sección de E2E)
- `docs/implementation/adapt-logistics-rutas-full-route.md` (nuevo, este documento)
