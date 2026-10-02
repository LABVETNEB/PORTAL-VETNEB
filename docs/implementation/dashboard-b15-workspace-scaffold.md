# B15 · WorkspaceScaffold

Base: `main` / `origin/main` en `0abfa974a83f3c0a36b3902ab0785a427acf9efe`. Implementación local en `codex/dashboard-b15-workspace-scaffold`.

## Objetivo y frontera

`WorkspaceScaffold` es el owner de la composición interna. Se publica desde `features/dashboard/presentation/layout` y su implementación convive con `ModuleSurface` en un archivo `.tsx` ya seguido por Git, siguiendo la compatibilidad de `WorkspaceHeader` en B11. Las variantes `module`, `page-header`, `surface`, `mobile` y `full-route` reproducen las cinco formas DOM preexistentes. Los slots se renderizan en orden `toolbar → filters → collection → details → footer`; el header B11 precede a esos slots en la variante `module`.

El shell B10, navegación B08/B09, entrada B13 y métricas B14 conservan sus owners. B15 no crea `UtilitySidePanel`, `DetailsPane`, primitivas de colección o filtros, ni altera fetch, endpoints, auth, capacidad adaptativa o datos. Las regiones vacías son slots estructurales; el contenido operativo continúa dentro de los módulos actuales. El hub admin usa la variante de encabezado sin introducir un workspace adicional.

## Censo previo y migración

| Owner anterior | Consumo real | Nuevo owner | Geometría |
|---|---|---|---|
| `DashboardModuleWorkspace` | 2 controladores: admin y clínica raíz | Adaptador `module` | Mismos `section`, header, viewport, clases y atributos A02/A08 |
| `DashboardPageHeader` | Hub de `/dashboard/admin` | Adaptador `page-header` | Mismo `div` y clases; mantiene `h1` |
| `ModuleSurface` | `AdminCommandCenter` | Adaptador `surface` | Mismos surface, toolbar y body; overflow del body sin cambio |
| `ClinicMobileModuleFrame` | 0 consumidores JSX actuales | Adaptador `mobile` de compatibilidad | Misma sección y clase si se vuelve a montar |
| `ClinicFullRouteModuleStage` | 5 rutas completas de clínica | Adaptador `full-route` dentro del stage existente | Mismos section y viewport; `main` sigue siendo hijo directo del shell |

No se cambió ninguna regla CSS. El width proviene del stage y sus hijos `min-w-0` existentes; el scaffold define una sola secuencia de composición sin sumar ancho, `max-width`, padding, gap, altura, `overflow`, `position` o scroll container. Las clases `.dashboard-module-surface`, `.dashboard-module-toolbar`, `.dashboard-module-body` y `.clinic-mobile-module-frame` mantienen sus reglas y sus owners físicos. `WorkspaceHeader` mantiene la banda B11 de 40 px.

## Matriz de los 15 consumidores adaptativos

Universo canónico: `dashboard-adaptive-limit-matrix.ts` y `useDashboardCanvasCapacity` (17 owners físicos; 15 IDs). En la tabla, `M` es `DashboardModuleWorkspace`, `R` es `ClinicFullRouteModuleStage`; ambos convergen en `WorkspaceScaffold`. `local` indica que toolbar, filtros, colección, detalle y footer siguen compuestos por el módulo, como exige la preservación de negocio. A02/A08 cubren la superficie A02 correspondiente, A03/A05 cubren el ID adaptativo directamente. Todos requieren migración por su wrapper compartido, sin editar el hook.

| ID A03 | Ruta | Workspace / header | Toolbar / filtros / colección / detalle / footer | Owner del limit | A02 / A03 / A05 / A08 | Migración |
|---|---|---|---|---|---|---|
| admin-audit-log | `/dashboard/admin?module=audit-log` | M / B11 | `AdminAuditCard` local | `AdminAuditCard` | sí / sí / sí / sí | M |
| admin-report-upload | `/dashboard/admin?module=admin-report-upload` | M / B11 | `AdminReportsCard` local | `AdminReportsCard` | sí / sí / sí / sí | M |
| admin-particular-tokens | `/dashboard/admin?module=admin-particular-tokens` | M / B11 | `AdminParticularTokensCard` local | `AdminParticularTokensCard` | sí / sí / sí / sí | M |
| admin-clinics | `/dashboard/admin?module=admin-clinics` | M / B11 | `AdminClinicsManagementCard` local | `AdminClinicsManagementCard` | sí / sí / sí / sí | M |
| admin-users-roles | `/dashboard/admin?module=admin-users-roles` | M / B11 | `AdminUsersRolesReadOnlyCard` local | `AdminUsersRolesReadOnlyCard` | sí / sí / sí / sí | M |
| admin-sessions | `/dashboard/admin?module=admin-sessions` | M / B11 | `AdminSessionsReadOnlyCard` local | `AdminSessionsReadOnlyCard` | sí / sí / sí / sí | M |
| admin-failed-login-alerts | `/dashboard/admin?module=admin` | M / B11 | `AdminCommandCenter` local | `AdminFailedLoginAlertsReadOnlyCard` | sí / sí / sí / sí | M |
| admin-pricing | `/dashboard/admin?module=admin-pricing` | M / B11 | `AdminPricingEditorCard` / `AdminMobilePricingModule` local | Ambos componentes | sí / sí / sí / sí | M |
| informes-reports-list | `/dashboard/informes` | R / header local | `InformesReportsList` local | `InformesReportsList` | sí / sí / sí / sí | R |
| admin-maintenance | `/dashboard/admin?module=admin-maintenance` | M / B11 | `AdminMaintenanceDryRunCard` / `AdminMobileMaintenanceModule` local | Ambos componentes | sí / sí / sí / sí | M |
| clinic-informes-summary | `/dashboard?module=informes` | M / B11 | `ClinicInformesWorkspaceSummary` local | mismo componente | sí / sí / sí / sí | M |
| clinic-logistica-summary | `/dashboard?module=logistica` | M / B11 | `ClinicLogisticaWorkspaceSummary` local | mismo componente | sí / sí / sí / sí | M |
| clinic-particular-tokens | `/dashboard?module=tokens` | M / B11 | `ClinicParticularTokensCard` local | mismo componente | sí / sí / sí / sí | M |
| logistics-recent-list | `/dashboard/logistica` | R / header local | `LogisticsRecentListCanvas` (2 variantes) | mismo componente | sí / sí / sí / sí | R |
| logistics-bounded-canvas | `/dashboard/logistica/{metricas,rutas,visitas}` | R / header local | `LogisticsBoundedCanvas` (3 variantes) | mismo componente | sí / sí / sí / sí | R |

Los `canvasNode` de los 17 owners continúan apuntando a sus elementos internos. Los atributos `data-dashboard-module-workspace`, `data-dashboard-module-viewport`, `data-dashboard-adaptive-reservation` y `data-dashboard-row-pitch`, así como los tokens de reserva del pager, no se movieron ni renombraron. El nuevo `data-workspace-scaffold` sólo identifica al root de módulo o ruta completa y no altera CSS.

## Verificación y cierre

El test de arquitectura B15 fue rojo antes del runtime y verde después. Los seis casos E2E B15 están en el spec B11 ya catalogado en `visual-contract` y CI: comprueban un root, ancho, orden y cero scroll exterior en admin, clínica y ruta completa, a 390 y 1366 px. B15 E2E cerró 6/6 y B11+B15 10/10.

La auditoría posterior aisló los baselines Win32 desactualizados de B15. B09 / #1673 (24-ago) fijó el app bar admin móvil en 48 px para alojar el control táctil de 44 px; la documentación de B10 y E2E-GLOBAL-10A demuestra que los records Win32 quedaron en la topología anterior. Una captura local de los 273 pares identificó 217 records y 2.737 campos desactualizados; se realinearon únicamente esos records, sin tocar runtime, CSS, selectores ni tolerancias.

A03 reveló seis hojas Win32 residuales de `admin-particular-tokens` y `admin-pricing`, ya declaradas como deuda histórica por el fixture y por CMP/B14. Se actualizaron sólo `limit`, `offset` y `secondPageCount` en 18 campos. Las dos corridas frías dirigidas de `admin-particular-tokens::w360x800` observaron 11/11/11; la matriz completa posterior cerró 16/16, 195/195 registros primarios y 234/234 hojas. Las seis hojas conservan `source: client-slice`; no cambió endpoint, método ni transporte.

Tras el ajuste de renderizado sin cambio DOM, A05/A08 se repitieron juntos y cerraron 36/36. Los seis casos B15 volvieron a cerrar 6/6 sin el aviso React de keys que aparecía en el primer render. A02 y A03 se repitieron sobre el árbol final y cerraron sus matrices completas.

Readback final: A02 está PASSED (21/21, 273/273) y A03 está PASSED (16/16, 195/195 registros primarios, 234/234 hojas). A05 y A08 cerraron 36/36: 15/15 de invariancia y 21/21 de zero-scroll. Los contratos E2E B10–B15 cerraron 91/91 y los guards seleccionados de arquitectura/UI cerraron 98/98. `pnpm --dir frontend lint`, `typecheck`, `build` y `pnpm security:public-surface` están PASSED; catálogo y `git diff --check` también están PASSED.

El `pnpm test` amplio no es un gate seleccionado para este cambio frontend y queda BLOCKED_BY_ENVIRONMENT: el único fallo es `e2e-global-03b-authoritative-auth-boundary.fastify.test.ts`, que exige `DATABASE_URL` o `SUPABASE_DB_URL` para la DB aislada `portal_vetneb_ci`. `pnpm validate:local` no fue seleccionado, porque AGENTS.md lo exige para cambios de backend y B15 no toca backend.

Estado: B15 COMPLETE. `WorkspaceScaffold` conserva una única composición de slots y los adaptadores preservan el DOM medido, la capacidad adaptativa, navegación y contratos A02/A03/A05/A08. B16 es NEXT_SLOT.

Rollback lógico: retirar la delegación de los cinco adaptadores y volver a colocar sus mismos árboles JSX, sin revertir B10–B14 ni tocar CSS o baselines. B16 queda como siguiente bloque sólo si los gates de B15 cierran verdes.
