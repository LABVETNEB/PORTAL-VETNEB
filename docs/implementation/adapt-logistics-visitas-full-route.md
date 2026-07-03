# R-12 — Clínica `/dashboard/logistica/visitas` full route adaptive contract

## PR

`feat(clinic): adapt logistics visitas full route`

## Base

- Rama: `feat/clinic-logistics-visitas-full-route-adaptive`.
- Base: `main @ 52b0602 docs(clinic): audit logistics full routes adaptive contract (#1274)`.
- Fecha: 2026-07-03.

## Documentos usados

1. `docs/audit/final-global-vetneb-50-60-pr-roadmap.md` — R-12, Fase 2.
2. `docs/audit/clinic-logistics-full-routes-adaptive-contract-audit.md` (R-11) —
   auditoría rectora; contrato exacto de esta migración.

## Deuda original (R-11)

`frontend/src/app/dashboard/logistica/visitas/page.tsx` llamaba
`getLogisticsFieldVisits(requestOptions, { throwOnError: true })` sin enviar
`limit`/`offset`, aunque el endpoint backend
(`server/routes/logistics-field-visits.fastify.ts:1061-1062`,
`parsePositiveInt(request.query.limit, 50, 100)`) ya los soporta. Efecto real:
**truncamiento silencioso** al default del servidor (50 registros, offset 0),
sin paginación, sin indicio en la UI de que pudiera haber más datos, y sin
mecanismo adaptativo — el contrato "sin scroll" dependía únicamente de que
nunca hubiera más de 50 filas (P1, ver matriz de riesgos de R-11).

## Contrato nuevo

- `visitas/page.tsx` **sigue siendo un server component puro** — no se agregó
  ningún wrapper cliente, `matchMedia` ni `ResizeObserver`.
- Lee `offset` y `limit` desde `searchParams` (Next 15,
  `searchParams?: Promise<VisitasPageSearchParams>`, mismo patrón que
  `dashboard/informes/page.tsx`) y los normaliza server-side:
  - `normalizeOffset`: entero ≥ 0, default `0`.
  - `normalizeLimit`: entero ≥ 1, default `VISITAS_DEFAULT_LIMIT = 50`
    (paridad exacta con el default silencioso anterior), clamp máximo
    `VISITAS_MAX_LIMIT = 100` (mismo tope que el backend).
- El fetch pasa `{ limit, offset }` explícitos a `getLogisticsFieldVisits`
  (antes no se enviaba ningún parámetro).
- Pager real (`<nav aria-label="Paginación de visitas">`) con botones
  "Anterior"/"Siguiente" (`PublicRouteControl` variant `bare`, navegación por
  `href` `?offset=N&limit=M`, sin `next/link` ni `<a>`, consistente con
  `project_frontend_navigation_hardening`).
- Copy explícito: `Mostrando {visits.length} visitas · página {currentPage}`
  y, cuando corresponde, `· puede haber más visitas disponibles` — nunca se
  menciona un "total" porque el endpoint no lo expone.

## limit/offset — `frontend/src/lib/api.ts`

`getLogisticsFieldVisits` se extendió de forma **backwards-compatible**
agregando un tercer parámetro posicional opcional:

```ts
export async function getLogisticsFieldVisits(
  options?: RequestInit,
  readOptions: LogisticsReadOptions = {},
  params?: LogisticsFieldVisitsParams, // { limit?; offset? }
): Promise<FieldVisit[]>
```

El querystring sólo se construye cuando `params` trae `limit`/`offset`
(`URLSearchParams`, mismo patrón que `getReportsPaginated`). Los tres
consumidores existentes que llaman con 2 argumentos
(`dashboard/page.tsx`, `dashboard/logistica/page.tsx` — hub —, y
`getDashboardStats` dentro del propio `api.ts`) siguen recibiendo la URL sin
querystring, **idéntica a antes**. Ninguno de esos tres call-sites fue
tocado. No se modificó el backend: los parámetros ya existían en el endpoint.

## Paginación sin `total` — heurística de página llena

El endpoint devuelve `count` (tamaño de la página actual) y
`pagination: { limit, offset }`, nunca un `total` de universo. Por eso:

- `canGoPrevious = !visitsLoadError && offset > 0`.
- `canGoNext = !visitsLoadError && visits.length === limit` (página llena ⇒
  posible más). Esta heurística puede dar un falso positivo cuando el total
  real es un múltiplo exacto del `limit` pedido (ej. exactamente 50 registros
  con `limit=50`) — es un trade-off documentado y aceptado (mismo perfil que
  "Tokens admin" en `server-adaptive-pagination-strategy.md` §4), no un bug.
- No se calcula `pageCount` en ningún momento (no hay `total` con qué
  calcularlo).

## Métricas sobre la página visible

Los 4 contadores superiores (`Pendientes`/`Programadas`/`En curso`/
`Completadas`) siguen calculándose con `visits.filter(...)` sobre el array
que llegó en la página actual — comportamiento sin cambios funcionales, pero
ahora está **aclarado explícitamente** en la UI con un texto nuevo:
`Conteos calculados sobre la página visible, no sobre el total general de
visitas.` Antes esta ambigüedad no estaba señalizada (los 50 registros por
default hacían que "página visible" y "todo lo que existe" se confundieran
visualmente).

## E2E — `frontend/e2e/dashboard-logistica-visitas-full-route-adaptive.spec.ts`

4 tests, `chromium`, sesión fixture ya establecida
(`app_session_id=e2e_populated_clinic_session`, servida por
`frontend/e2e/fixtures/admin-populated-api-server.mjs`, **sin modificar** ese
archivo):

1. **3 viewports críticos** (`1440x900`, `1366x768` desktop corto,
   `390x844` mobile): pager siempre visible, `Anterior`/`Siguiente`
   deshabilitados en el estado inicial (dataset fixture = 3 visitas, muy por
   debajo del `limit` default de 50 ⇒ no hay página siguiente real), texto de
   alcance de página visible presente, y **sin scroll externo**
   (`html`/`body` `scrollHeight <= clientHeight + 2px` tolerancia) ni overflow
   horizontal del pager.
2. **Heurística de página llena + navegación real**: navega con
   `?limit=3&offset=0` (el fixture siempre sirve exactamente 3 visitas
   ignorando el querystring, así que pedir `limit=3` fuerza de forma
   determinística el estado "página llena" sin depender de datos reales ni
   de modificar el fixture compartido); confirma `Siguiente` habilitado,
   click, la URL pasa a `offset=3&limit=3`, el indicador pasa a "Página 2",
   `Anterior` se habilita; click en `Anterior` vuelve a `offset=0` /
   "Página 1".

No se depende de datos de producción en ningún test.

## Validaciones ejecutadas

- `git diff --check` — limpio.
- `pnpm test` — 2954/2954 (incluye 3 tests nuevos de contrato en
  `test/frontend-dashboard-logistica-visitas.test.ts`).
- `pnpm typecheck:test` — sin errores.
- `pnpm typecheck` — sin errores.
- `pnpm --dir frontend lint` — sin errores.
- `pnpm --dir frontend build` — build de producción exitoso;
  `/dashboard/logistica/visitas` sigue listada como ruta dinámica (`ƒ`,
  server-rendered), confirmando que sigue siendo server component.
- `pnpm --dir frontend exec playwright test
  e2e/dashboard-logistica-visitas-full-route-adaptive.spec.ts
  --project=chromium` — 4/4 passed.
- `git restore frontend/next-env.d.ts` ejecutado después de correr Playwright
  (regenera la ruta de dev del dev server) y antes de repetir `pnpm test` /
  `pnpm typecheck:test`, que se re-confirmaron en verde tras el restore.

## Confirmaciones de scope

- **Sin backend/API/auth/DB/server/migraciones**: `server/**` sólo se leyó
  (`logistics-field-visits.fastify.ts`) para confirmar los límites
  `parsePositiveInt(..., 50, 100)` ya soportados; no se modificó ningún
  archivo de `server/`.
- **Sin `globals.css`**: el pager reutiliza clases ya existentes
  (`dashboard-pagination-btn`, `dashboard-pagination-context`,
  `dashboard-surface`, etc.) creadas por PRs anteriores (`informes`); no se
  agregó ni modificó ninguna regla CSS.
- **Sin `rutas/`, `metricas/` ni `LogisticsCommandCenter.tsx`**: no se tocó
  ningún archivo de esas rutas ni del hub; los tres consumidores que aún
  llaman `getLogisticsFieldVisits` sin `limit`/`offset`
  (`dashboard/page.tsx`, `dashboard/logistica/page.tsx`,
  `getDashboardStats`) mantienen exactamente el mismo comportamiento gracias
  a la compatibilidad hacia atrás de la firma extendida.
- **Sin R-13/R-14/R-15/R-16**: no se avanzó paginación de `rutas` (R-13),
  fan-out de `métricas` (R-14), ni se tocó `MasterDetailWorkspace` (R-15) o
  Tokens Clínica (R-16). Quedan documentados en R-11 como próximos PRs,
  fuera de este scope.
- **Sin Admin, Particular ni Público**: archivos tocados son exclusivamente
  `frontend/src/app/dashboard/logistica/visitas/page.tsx`,
  `frontend/src/lib/api.ts` (extensión backwards-compatible de una función),
  `test/frontend-dashboard-logistica-visitas.test.ts`, el e2e nuevo, y este
  documento.

## Archivos tocados

- `frontend/src/app/dashboard/logistica/visitas/page.tsx`
- `frontend/src/lib/api.ts`
- `test/frontend-dashboard-logistica-visitas.test.ts`
- `frontend/e2e/dashboard-logistica-visitas-full-route-adaptive.spec.ts` (nuevo)
- `docs/implementation/adapt-logistics-visitas-full-route.md` (nuevo, este documento)
