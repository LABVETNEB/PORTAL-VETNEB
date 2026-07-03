# R-07 — Clínica `/dashboard/informes` full route server-adaptive pagination

## PR

`feat(dashboard): adapt informes full route server pagination`

Séptimo módulo migrado por el roadmap rector
(`docs/audit/final-global-vetneb-50-60-pr-roadmap.md`, Fase 1), y el primero
fuera de Admin: la ruta full `/dashboard/informes` (Clínica) tenía la
cardinalidad fija en 6 filas (`REPORTS_PAGE_SIZE`) señalada como pendiente en
la matriz canónica (`PR-SRV-0 §4`, fila "Ruta full `/dashboard/informes` fija
en 6 filas").

## Base

- Rama de trabajo: `feat/dashboard-informes-server-adaptive-pagination`.
- Base: `main @ e38975b feat(admin): adapt audit server pagination to viewport (#1268)`.
- Fecha: 2026-07-03.

## Documentos usados

1. `docs/audit/final-global-vetneb-50-60-pr-roadmap.md` — R-07, Fase 1.
2. `docs/implementation/admin-audit-server-adaptive-pagination.md` (R-06) —
   patrón RF debounced de referencia (medición → Server Action → offset por
   estado de cliente, anti-race por request-id).
3. `frontend/src/hooks/useAdaptiveItemsPerPage.ts` — hook genérico reutilizado
   sin cambios.

## Contrato anterior

`frontend/src/app/dashboard/informes/page.tsx` era un server component puro:
leía `page`/`query`/`status`/`studyType`/`reportId` desde `searchParams`,
llamaba `getReportsPaginated`/`searchReportsPaginated` con
`REPORTS_PAGE_SIZE` fijo = 6, y paginaba con `PublicRouteControl` (`href`
`?page=N`, full page reload). La selección de informe también navegaba por
`href` (`?reportId=N`). El pager sólo se mostraba si `reportsTotalPages > 1`.

## Contrato nuevo

- **Nuevo cliente colapsado**: `InformesReportsList.tsx` (`"use client"`)
  concentra medición, `offset` de estado, fetch y render de la lista/detalle/
  pager. `page.tsx` sigue siendo un server component: resuelve filtros desde
  `searchParams`, hace el fetch inicial (con `INFORMES_FALLBACK_ROWS` como
  tamaño de página de arranque, antes de la primera medición real) y pasa el
  resultado como props iniciales.
- **Server Action nuevo**: `informes.actions.ts` (`getInformesPage`), mismo
  patrón que `admin-audit.actions.ts` — reenvía cookies, `cache: "no-store"`,
  y redirige a login en 401 (`redirectToLoginOnUnauthorized`).
- **Constantes en módulo aparte**: `informes.constants.ts` (sin `"use
  client"`) expone `INFORMES_FALLBACK_ROWS = 6` e `INFORMES_LIMIT_CAP = 24`.
  Ver "Bug real encontrado" más abajo — es la razón de que esta migración
  necesite un tercer archivo que R-06 no necesitó (Auditoría nunca compartió
  una constante entre su server component y su client component).
- `useAdaptiveItemsPerPage` mide el contenedor de filas (`dashboard-inline-
  scroll`) y la altura de la primera fila (medida en un `div` que envuelve
  sólo el botón de la fila, nunca el panel de detalle expandible, para que la
  selección de un informe no contamine la medición).
- **Sin piso desktop**: a diferencia de Tokens/Reports/Audit/Users-Roles
  (Admin, `expectNinePopulatedRows`), esta es una ruta full de Clínica sin
  contrato de App Shell pinneado — `minItems: 1` en ambos contextos
  (memoria del proyecto: *"App Shell spec pins 9 rows for tokens/reports/
  audit/users-roles (not clinics)"*).
- **Selección de informe**: pasa de navegación por `href`
  (`PublicRouteControl` + `?reportId=N`, full reload) a estado de cliente
  (`useState`, botón `onClick`) — el detalle ya vive en las filas cargadas,
  no requiere una nueva petición ni un reload de página. El deep-link inicial
  por `?reportId=N` se sigue leyendo en `page.tsx` como valor inicial.
- **Paginación**: pasa de `href` (`?page=N`) a botones `onClick` con `offset`
  en estado de cliente (mismo motivo que R-06: el `limit` ya no es fijo, la
  aritmética de página por URL dejaría de ser válida).
- **Pager siempre visible**: se retira el gate `reportsTotalPages > 1`
  (requisito explícito de R-07); antes el pager desaparecía con pocos
  resultados.
- **Resumen compacto oculto en mobile**: el bloque Total/Mostrando/Página/
  Filtros pasa de `grid` a `hidden sm:grid` — ver "No-clipping en mobile" más
  abajo.

## Bug real encontrado durante el desarrollo (y por qué existe `informes.constants.ts`)

Next.js convierte **todos** los exports nombrados de un archivo `"use
client"` en referencias de cliente opacas — incluida una constante numérica
simple. `page.tsx` (server component) importaba inicialmente
`INFORMES_FALLBACK_ROWS` directamente desde `InformesReportsList.tsx`
(`"use client"`) para usarla como `pageSize` del fetch SSR inicial. En
runtime, ese import no era el número `6`: era una referencia de cliente, y
las operaciones aritméticas (`Math.max(1, params.pageSize ?? 20)`, etc.) la
convertían en `NaN`. Esto se propagaba silenciosamente a `pagedResult.
pageSize` (SSR) → prop `initialPageSize` (cliente) → `offset` inicial =
`(initialPage - 1) * NaN` = `NaN` — sin ningún error de compilación ni de
tipos (`NaN` es un `number` válido para TypeScript). El síntoma visible era
"Página NaN / 167" / "Mostrando NaN-NaN" en producción, detectado con
Playwright (`console.log` temporal + verificación en HTML servido) durante
la validación e2e de este PR, no por `tsc`/`eslint`/`pnpm test`.

**Fix**: mover las constantes compartidas a un módulo plano sin `"use
client"` (`informes.constants.ts`), importado tanto por el server component
(`page.tsx`) como por el client component (`InformesReportsList.tsx`). Este
riesgo no se manifestó en R-06 porque Auditoría nunca compartió una
constante numérica entre su server component (`admin/page.tsx`) y su client
component (`AdminAuditCard.tsx`) para aritmética SSR — `admin/page.tsx` sí
importa `ADMIN_AUDIT_FALLBACK_ROWS` desde `AdminAuditCard.tsx`, pero sólo
para pasarla como argumento de función (`{ limit: ADMIN_AUDIT_FALLBACK_ROWS
}`), no para una expresión aritmética cuyo resultado se persiste en estado —
el mismo bug podría existir ahí de forma latente si esa constante alguna vez
resultara `NaN`, pero como es siempre el literal `9` compilado, nunca se
manifestó. Se documenta aquí como riesgo de patrón para futuras migraciones
(R-08 en adelante) que compartan constantes numéricas entre server y client
component de un mismo módulo: **la constante debe vivir en un archivo sin
`"use client"`**.

## Cómo se recomputa `offset`

Igual regla que R-06 (el endpoint de reports expone `total`):

```
nextOffset = Math.max(0, Math.min(
  Math.floor(currentOffset / effectiveLimit) * effectiveLimit,
  (Math.ceil(total / effectiveLimit) - 1) * effectiveLimit,
));
```

Sólo corre cuando `effectiveLimit` cambia (`previousLimitRef`); un cambio de
filtros (formulario GET, full page reload) resetea todo por remount, `offset`
inicial vuelve a `0`.

## Cómo se evita la carrera

- **Request id** (`latestRequestRef`): igual que R-06, una respuesta cuyo id
  ya no es el vigente se descarta.
- **Debounce de medición**: `ResizeObserver` + `requestAnimationFrame` +
  comparación de medición previa, mismo patrón que R-01..R-06.

## No-clipping en mobile (390×844)

Con el resumen compacto siempre visible (`grid` sin condición), el contenido
fijo (header de card + formulario de filtros de 3 campos, que en mobile
stackea verticalmente) + resumen (grid 2×2, ~120px) dejaba menos espacio
vertical del necesario para que la sección de lista (encabezado + al menos 1
fila + pager) entrara dentro del `Card` (`overflow-hidden`) — el pager
quedaba recortado visualmente (no reflejado en `document.body.scrollHeight`,
que seguía sin scroll global, pero sí en un recorte silencioso dentro del
`Card`). Verificado con Playwright (`getBoundingClientRect` en `nav` de
paginación vs. `card`/viewport). Fix: el resumen compacto pasa a `hidden
sm:grid` (se sigue viendo en tablet/desktop ≥640px; en mobile los mismos
datos ya son parcialmente redundantes con "Página X de Y" del pie del pager).
Con ese cambio el pager queda dentro del `Card` y del viewport en 390×844,
1366×768 y 1440×900 (verificado con e2e).

## Archivos tocados

- `frontend/src/app/dashboard/informes/page.tsx` — se retira la lógica de
  lista/detalle/pager (movida al cliente); mantiene resolución de filtros
  desde `searchParams`, fetch inicial SSR (fallback de arranque) y manejo de
  401.
- `frontend/src/app/dashboard/informes/InformesReportsList.tsx` — **nuevo**,
  client component con medición adaptativa, Server Action de re-fetch,
  estado de `offset`/selección, y todo el render de lista/detalle/pager que
  antes vivía en `page.tsx`.
- `frontend/src/app/dashboard/informes/informes.actions.ts` — **nuevo**,
  Server Action `getInformesPage` (RF debounced), mismo patrón de reenvío de
  cookies y redirect-on-401 que `admin-audit.actions.ts`.
- `frontend/src/app/dashboard/informes/informes.constants.ts` — **nuevo**,
  `INFORMES_FALLBACK_ROWS`/`INFORMES_LIMIT_CAP` en módulo sin `"use client"`
  (ver "Bug real encontrado").
- `frontend/e2e/dashboard-informes-server-adaptive-pagination.spec.ts` —
  **nuevo**, e2e focalizado: pager siempre visible, sin scroll externo, filas
  sin clipping horizontal, navegación anterior/siguiente funcional, sin
  parámetro `page` en la URL, y el fix de no-clipping en 390×844/1366×768/
  1440×900.
- `test/frontend-dashboard-informes.test.ts`,
  `test/frontend-dashboard-reports-master-detail.test.ts`,
  `test/frontend-dashboard-empty-states.test.ts`,
  `test/frontend-dashboard-mobile-polish-bottom-actions.test.ts`,
  `test/frontend-dashboard-filter-drawer-sticky-filters.test.ts`,
  `test/frontend-notification-click-anchors.test.ts`,
  `test/frontend-report-download-action.test.ts`,
  `test/frontend-reports-live-read-contract.test.ts` — alineados al contrato
  nuevo (aserciones de contenido movidas al archivo donde ese contenido vive
  ahora; ninguna aserción de comportamiento se elimina, sólo se reubica).

## Fuera de scope (no tocado)

- `ClinicInformesWorkspaceSummary.tsx` (resumen de informes en el hub de
  Clínica, `?module=informes`) — ya migrado en un PR previo, no forma parte
  de R-07.
- Backend/API/auth/DB/migraciones — sólo lectura; `getReportsPaginated`/
  `searchReportsPaginated` ya aceptaban `page`/`pageSize` y exponen `total`.
- CI/workflows, deps/lockfiles, snapshots, `globals.css`.
- Otros módulos Clínica (logística, tokens particulares del lado clínica),
  Admin, Particular, Público.
- R-08 (cleanup de shims residuales) — no adelantado.

## Validaciones ejecutadas

PNPM 10.8.1.

- `pnpm test` — 2945/2945.
- `pnpm typecheck:test` — OK.
- `pnpm security:public-surface` — PASS (sólo marcadores server-only
  esperados en `frontend/src/proxy.ts`).
- `pnpm --dir frontend lint` — OK.
- `pnpm --dir frontend typecheck` — OK.
- `pnpm --dir frontend build` — OK.
- `pnpm --dir frontend exec playwright test e2e/dashboard-informes-server-adaptive-pagination.spec.ts` — 5/5.
- `pnpm --dir frontend exec playwright test e2e/dashboard-clinic-informes-mobile-parity.spec.ts e2e/clinic-reports-fixture-pagination.spec.ts` — 7/7 (contratos previos de la ruta hub/summary y de la fixture de 1000 informes siguen intactos).
- `frontend/next-env.d.ts` fue regenerado por Playwright durante los e2e y se
  restauró (`git checkout --`) antes del diff review, por estar fuera de
  scope (mismo procedimiento documentado en R-06).

## Riesgos residuales

- **Resumen compacto oculto en mobile (P2, cosmético)**: en viewports <640px
  ya no se ve el bloque Total/Mostrando/Página/Filtros; el pie del pager
  ("Página X de Y") sigue comunicando la posición. Aceptado para cumplir el
  requisito explícito de no-clipping sin tocar `FilterBar`/`globals.css`
  (fuera de scope).
- **Deep-link a informe no persiste tras paginar/seleccionar otro (P2)**: la
  selección de informe pasó de navegación por URL a estado de cliente; el
  `?reportId=N` inicial se sigue respetando al cargar la página, pero
  seleccionar otro informe ya no actualiza la URL (antes sí, vía
  `PublicRouteControl replace`). Se aceptó para poder paginar sin recargar
  la página completa en cada selección — el mismo trade-off que R-06 hizo
  con Auditoría (paginación por estado de cliente en vez de por URL).
- **Sin salto a última página**: igual que el resto de los módulos migrados,
  el pager sólo avanza/retrocede de a una página.
- **QA manual pendiente**: iOS/Android real y zoom físico 100–175% siguen
  siendo obligatorios antes de cualquier gate bloqueante (PR-SRV-0 §10.5).

## Confirmaciones

- Un solo módulo tocado: ruta full `/dashboard/informes` (Clínica).
- `ClinicInformesWorkspaceSummary.tsx` no fue tocado.
- Backend/API/auth/DB/migraciones no tocados.
- CI/workflows, deps/lockfiles, snapshots, `globals.css` no tocados.
- Estrategia RF debounced ejecutada (no over-fetch); anti-race por
  request-id; offset recomputado con `total` (regla 1, PR-SRV-0 §6); sin
  `matchMedia`; pager siempre visible.
- No se hizo `git add`/`commit`/`push`/`gh pr create`.
