# PR-3 - Reports Master-Detail + Study Timeline

## Resumen

Se transformo `/dashboard/informes` en un workspace operativo privado con layout master-detail. La lista de informes queda como panel maestro, el detalle del informe seleccionado queda como panel principal, y el proceso del estudio se muestra con `StudyTimeline`. Las acciones reales de visualizacion/descarga siguen usando `ReportFileActions` y ahora tambien quedan visibles en `StickyActionBar`.

## Archivos modificados

- `frontend/src/app/dashboard/informes/page.tsx`
- `frontend/src/components/dashboard/StickyActionBar.tsx`
- `test/frontend-dashboard-informes.test.ts`

## Componentes creados

- `frontend/src/components/dashboard/MasterDetailWorkspace.tsx`
- `frontend/src/components/dashboard/StudyTimeline.tsx`
- `test/frontend-dashboard-reports-master-detail.test.ts`

## Decisiones tecnicas

- `MasterDetailWorkspace` es puro layout: recibe `master`, `detail`, `emptyDetail`, `selectedId` y `className`; no importa datos, API, auth, middleware ni componentes publicos.
- `StudyTimeline` recibe pasos ya formados. No calcula fechas ni negocio; solo renderiza estado visual con icono, texto y fecha/placeholder.
- `/dashboard/informes` sigue siendo server component y conserva los fetches existentes con cookies forwardeadas y `cache: "no-store"`.
- La seleccion se maneja con `reportId` en query param y `PublicRouteControl`, evitando `next/link` y tags `<a>` por el contrato global del repo.
- `StickyActionBar` recibio un ajuste no breaking: `children?: ReactNode`, usado para alojar `ReportFileActions` sin duplicar logica de descarga/preview.

## Logica existente preservada

- Se mantienen `getReports`, `searchReports`, `getReportsRequestOptions`, filtros por `query/status/studyType`, manejo de error y empty state.
- Se mantienen `ReportFileActions` y sus endpoints existentes para preview/download.
- No se cambian endpoints, autenticacion, middleware, backend, rutas publicas, SEO, dependencias ni calculos de fechas.
- No se implementa `FilterDrawer`, clinic command center, logistica hub, admin tabs ni rutas nuevas.

## Timeline sin cambiar negocio

Los steps se derivan solo de campos ya presentes en `Report`:

- `uploaded`: usa `uploadDate` o `createdAt`.
- `processing`: usa el `status/currentStatus` existente y muestra `updatedAt` solo cuando el estado actual es `processing`.
- `ready`: usa `updatedAt` cuando el informe esta `ready` o `delivered`.
- `delivered`: usa `updatedAt` solo cuando el informe esta `delivered`.

No se agrega `estimatedDeliveryAt`, no se usa `new Date()` y no se recalculan fechas.

## Validaciones ejecutadas

- `git diff --stat`: PASS. Tracked diff: `456 insertions(+), 116 deletions(-)` en 3 archivos modificados; los nuevos archivos quedan untracked hasta staging manual.
- `git diff --check`: PASS. Git aviso normal de CRLF en `frontend/src/app/dashboard/informes/page.tsx` y `frontend/src/components/dashboard/StickyActionBar.tsx`.
- `pnpm test`: PASS, 2319 tests pass, 1 skipped.
- `pnpm build`: PASS.
- `pnpm security:public-surface`: PASS, sin findings publicos. Solo notas server-only existentes en `frontend/src/proxy.ts`.
- `pnpm --dir frontend lint`: PASS.
- `pnpm --dir frontend typecheck`: PASS.
- `pnpm --dir frontend build`: PASS.
- Browser local: `/dashboard/informes` responde como ruta privada y redirige a `/login?next=%2Fdashboard%2Finformes` sin error de render inmediato.

## Riesgos residuales

- La seleccion por `reportId` recarga server-side en lugar de ser client-side instantanea. Se eligio para conservar fetch/auth/server rendering sin introducir logica nueva.
- La timeline usa `updatedAt` como fecha disponible del estado alcanzado cuando no hay fechas de workflow mas granulares en el payload clinic actual.
- La verificacion visual autenticada del workspace completo queda pendiente de una sesion clinic valida.

## Confirmacion de scope

- Sin cambios en backend/server.
- Sin cambios en API routes.
- Sin cambios en auth.
- Sin cambios en middleware.
- Sin cambios en SEO, sitemap o robots.
- Sin cambios en rutas publicas.
- Sin cambios en `package.json`, `pnpm-lock.yaml`, `next-env.d.ts`, `next.config.ts` ni dependencias.
- Sin `next/link`, `<Link>` ni `<a>` en los archivos nuevos o modificados de esta PR.
