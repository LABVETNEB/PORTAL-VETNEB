# R-15 — cleanup(frontend): remove dead MasterDetailWorkspace primitive

## Objetivo

Eliminar la primitiva `MasterDetailWorkspace.tsx` (0 consumidores runtime,
evidencia previa en `docs/implementation/adaptive-master-detail-workspace.md`)
y los tests source-contract que pinneaban sus patrones prohibidos por el
contrato global no-scroll: `overflow-y-auto`, `calc(100vh-13rem)` y el
atributo `data-master-detail-workspace` como si fueran un contrato de
runtime real, cuando no lo eran.

## Evidencia de 0 consumidores runtime

`git grep -n "MasterDetailWorkspace" -- frontend/src` (previo a este PR),
excluyendo el propio archivo de la primitiva, devolvió **cero resultados**.
Ningún componente de `frontend/src/app/**` ni `frontend/src/components/**`
importaba o renderizaba `<MasterDetailWorkspace`. Las únicas referencias al
nombre fuera del propio archivo eran:

- Documentación (`docs/audit/**`, `docs/implementation/**`,
  `docs/pr-history/**`) — histórico, no tocado por este PR.
- Aserciones negativas en `test/**` que confirmaban activamente que las
  superficies reales (`informes/page.tsx`, `InformesReportsList.tsx`) **no**
  la usaban (`assert.equal(source.includes("<MasterDetailWorkspace"), false)`).
- Tests source-contract que leían el archivo de la primitiva directamente
  (`readFileSync`) para pinnear su forma exacta, incluyendo
  `xl:max-h-[calc(100vh-13rem)]` y `xl:overflow-y-auto`.

Se verificó por separado que las clases CSS `dashboard-master-panel` /
`dashboard-detail-panel` **sí** tienen un consumidor runtime real —
`frontend/src/app/dashboard/informes/InformesReportsList.tsx` — y están
definidas en `frontend/src/app/globals.css`. Por eso ni `globals.css` ni esa
lista ni sus clases fueron tocados: son un contrato vigente e independiente
de la primitiva muerta, que sólo compartía nombres de clase con ella.

## Archivo eliminado

- `frontend/src/components/dashboard/MasterDetailWorkspace.tsx`

## Tests limpiados (sólo aserciones sobre la primitiva muerta)

- `test/frontend-dashboard-reports-master-detail.test.ts`: se removió el
  test `"MasterDetailWorkspace keeps reusable two-panel layout contract"`
  completo (el que pinneaba `overflow-y-auto`/`calc(100vh-13rem)`), la
  constante `MASTER_DETAIL_WORKSPACE_PATH`, las lecturas/aserciones de
  `masterDetailSource` en el test de scope, y las aserciones negativas
  redundantes `source.includes("<MasterDetailWorkspace")`.
- `test/frontend-dashboard-workspace-layout-polish.test.ts`: se removió la
  sección `"Component: MasterDetailWorkspace"` completa (5 tests que leían
  el archivo de la primitiva) y su constante `MASTER_DETAIL_PATH`. Los tests
  que verifican que `globals.css` define `.dashboard-master-panel` /
  `.dashboard-detail-panel` **se mantuvieron intactos**: verifican un
  contrato CSS todavía consumido por `InformesReportsList.tsx`.
- `test/frontend-dashboard-accessibility-focus-aria.test.ts`: el test
  combinado `"PR-8 MasterDetailWorkspace and StudyTimeline expose named
  panels and textual states"` se redujo a
  `"PR-8 StudyTimeline expose named panels and textual states"`, quitando
  únicamente las aserciones sobre `workspaceSource` y su lectura del archivo
  eliminado; las aserciones sobre `StudyTimeline` se conservaron sin cambios.
- `test/frontend-dashboard-mobile-polish-bottom-actions.test.ts`: el test
  combinado `"PR-9 MasterDetailWorkspace and AdminSectionTabs avoid
  horizontal page overflow"` se redujo a `"PR-9 AdminSectionTabs avoid
  horizontal page overflow"`, quitando la lectura de la primitiva; las
  aserciones sobre `AdminSectionTabs` se conservaron sin cambios.
- `test/frontend-dashboard-filter-drawer-sticky-filters.test.ts`: se removió
  la aserción negativa redundante `source.includes("<MasterDetailWorkspace")`
  dentro del test de scope de `informes/page.tsx`.
- `test/frontend-dashboard-informes.test.ts`: se removieron las dos
  aserciones negativas redundantes sobre el import y el uso JSX de
  `MasterDetailWorkspace` en `informes/page.tsx`.

Ningún test perdió cobertura sobre una superficie real: en todos los casos
lo removido era exclusivamente la lectura/pinneo del archivo de la
primitiva muerta o una aserción que confirmaba su ausencia (trivialmente
cierta una vez borrado el archivo).

## Por qué `overflow-y-auto` / `calc(100vh-13rem)` contradicen el contrato global

El contrato no-scroll global de Portal VETNEB (ver
`docs/audit/global-zero-scroll-adaptive-dashboard-matrix.md` y
`docs/implementation/dashboard-no-scroll-cockpit` en memoria de proyecto)
prohíbe scroll interno rígido y unidades `100vh` fijas: ambas rompen la
adaptación a viewport/zoom real y a barras móviles dinámicas (deben usarse
`dvh` + medición adaptativa, no `calc(100vh-Nrem)` hardcodeado). La
primitiva `MasterDetailWorkspace` fijaba exactamente esos dos patrones
prohibidos (`xl:max-h-[calc(100vh-13rem)] xl:overflow-y-auto`) en su panel
maestro, y los tests source-contract los pinneaban como si fueran un
requisito activo. Al no tener consumidores runtime, mantenerlos vivos sólo
generaba deuda: cualquier futuro PR que reintrodujera la primitiva heredaría
automáticamente un patrón ya prohibido por el contrato vigente. Eliminar la
primitiva y sus tests pinneadores cierra esa condición de parada documentada
en `docs/implementation/adaptive-master-detail-workspace.md` (PR-MD-1).

## Confirmación — sin cambios de runtime behavior

- Ninguna página ni componente de `frontend/src/app/**` fue modificado.
- `frontend/src/app/dashboard/logistica/**` no fue tocado.
- `frontend/src/app/dashboard/informes/**` no fue tocado (no había import
  runtime de `MasterDetailWorkspace` que remover).
- `frontend/src/app/globals.css` no fue tocado.
- No se introdujo ninguna primitiva de reemplazo.
- No se agregó CSS.

## Confirmación — sin backend/globals/deps/Admin/Particular/Público/R-16+

- No se tocó `server/`, `drizzle/`, `shared/`, auth, middleware, ni ninguna
  ruta de API.
- No se tocó `package.json` ni `pnpm-lock.yaml` (ni raíz ni `frontend/`).
- No se tocó CI/workflows ni snapshots.
- No se tocó Admin, Particular ni superficie pública.
- No se avanzó R-16 (Tokens Clínica) ni ningún PR posterior del roadmap.

## Archivos tocados por este PR

- `frontend/src/components/dashboard/MasterDetailWorkspace.tsx` (eliminado)
- `test/frontend-dashboard-reports-master-detail.test.ts`
- `test/frontend-dashboard-workspace-layout-polish.test.ts`
- `test/frontend-dashboard-accessibility-focus-aria.test.ts`
- `test/frontend-dashboard-mobile-polish-bottom-actions.test.ts`
- `test/frontend-dashboard-filter-drawer-sticky-filters.test.ts`
- `test/frontend-dashboard-informes.test.ts`
- `docs/implementation/remove-dead-master-detail-workspace.md` (este doc)

## Validaciones ejecutadas

- `git diff --check` — sin errores de whitespace.
- `git restore frontend/next-env.d.ts` — ejecutado tras cada comando que
  pudo reescribirlo (`pnpm test`, `pnpm --dir frontend build`).
- `pnpm test` — 2954/2954 tests, 0 fallos.
- `pnpm typecheck:test` — sin errores.
- `pnpm typecheck` — sin errores.
- `pnpm --dir frontend lint` — sin errores.
- `pnpm --dir frontend build` — build de producción exitoso (Next.js 16.2.7,
  Turbopack), incluyendo `/dashboard/informes` y las rutas full de
  `/dashboard/logistica/*` sin cambios de rutas ni de output.
