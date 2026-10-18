# C21 · Migración clínica, lote 1: Informes (módulo + ruta completa)

## Estado base, alcance y auditoría previa

Base `436a55aceed0e48b4ce41248c587d61fc4e8e403` (PR-BUG-01 integrado, #1885) en `feat/dashboard-c21-clinic-reports-batch-1-v2`, igual a `origin/main`; `git merge-base --is-ancestor 436a55ac HEAD` verdadero. Árbol tracked limpio; se preservaron los dos untracked previos (`frontend/AGENTS.md`, `frontend/CLAUDE.md`, generados por `next dev`), los cinco stashes y el único worktree. Sin `AGENTS.md` anidados tracked. No se ejecutaron escrituras Git ni GitHub.

Scope: presentación de las dos superficies de Informes clínica (§53 del roadmap: «valida la unificación de shells de B10») sobre las primitivas existentes C01–C16, sus guards realineados, un spec E2E y este registro. Fuera de scope: backend, endpoints, AuthN/AuthZ, DB, dependencias, configuración, CSS/tokens, FSM de navegación, primitivas compartidas (no se modificó ningún owner C01–C20), `page.tsx` de la ruta completa, el shell B10, PR-BUG-01 y C22.

Criterio rector (el de C18–C20): **sólo se adopta una primitiva si es geométricamente neutra** frente a A02 y A03 y no cambia la semántica ni el contrato observable de la superficie.

| Superficie | Ruta | Owner | Shell |
| --- | --- | --- | --- |
| Módulo (S6) | `/dashboard?module=informes` | `ClinicInformesWorkspaceSummary.tsx` — filtro cliente de 7 campos sobre los informes recientes, `usePagedRows`, tabla ≥ 768 px y lista < 768 px, diálogo de detalle | `/dashboard` (B10) |
| Ruta completa | `/dashboard/informes` | `page.tsx` (servidor, `FilterBar` GET) + `InformesReportsList.tsx` — `limit/offset` server-adaptive por Server Action, recuperación de página, master-detail, deep link `?reportId=` | `ClinicDashboardShell module="informes"` + `ClinicFullRouteModuleStage` (B10) |

Diferencias legítimas que se conservan: el módulo filtra en cliente sobre un superset y pagina con `usePagedRows`; la ruta completa filtra por URL (GET) y pagina en el servidor. La política PR-BUG-01 (barra siempre renderizada) ya regía en ambas y no se tocó.

## Mapa de adopción

| Superficie | Adoptado | No adoptado y causa |
| --- | --- | --- |
| Módulo, escritorio | C01: el canvas medido (`data-clinic-reports-list-body`, con `row-pitch="regular"` y `canvas-reserve="table-head-above-md"`) **es** el `CollectionWorkspace`; `thead` → `CollectionHeader` (su alto queda ligado a `--dash-table-head-h`, la misma reserva A03 que ya aplicaba `zero-scroll.css`); `tbody` → `ContentList as="tbody"` con el mismo `divide-y`; filas → `ContentListItem as="tr"` con su marcador. C03: los dos vacíos («Sin informes para los filtros aplicados», «Sin informes recientes») | C02: el pager es el gemelo CMP-12 de `AdminMobileOpsPager` (paridad absoluta admin = clínica) y lleva `data-clinic-reports-pagination-controls`/`-status`, que el owner no propaga. C03 error: el aviso `.clinical-alert-warning role="alert"` con `DashboardRefreshButton` es el contrato operativo del fixture (`dashboard-operational-contract`); `CollectionState` cambiaría la acción real por un retry. C10/C11/C12: S6 es subsistema protegido (§7.8) con campos de 32 px; el pill de 40 px y los chips mueven A02 `filters` y la capacidad; el sheet cambiaría el portal acotado (`dashboardScopedPortal`, B05). C06/C07/C09: no hay operación masiva |
| Módulo, móvil | C01: la lista medida es `ContentList as="div"` (mismas clases, el `divide-y` sigue formando el pitch) y cada fila `ContentListItem as="div"` con `data-dashboard-adaptive-row` | Igual que escritorio |
| Módulo, detalle | C13: `DetailsPane` (nombre accesible «Detalle del informe #id») y `DetailsMetadata` para Estudio/Fecha/Archivo dentro del diálogo existente (`scrollableBody`; fuera de A02) | `DetailsActionDock`: `ReportFileActions` no es una lista de acciones `onClick` (resuelve URLs firmadas con `scope="clinic"`). C15 `DocumentViewer`: cambiaría el flujo de visualización y su frontera de seguridad |
| Ruta completa | C01: la rama vacío/error y el canvas master-detail son `CollectionWorkspace` (sus reglas ya estaban declaradas; `grid` sigue ganando sobre el `display:flex` de la capa `components`); el canvas de filas medido es `ContentList as="div"` (A02 lee `:scope > *`). C02: `CollectionPager variant="centered"` en modo slot: el owner aporta `nav`, reserva táctil, `data-dashboard-adaptive-reserved-region` y los selectores `data-dashboard-pager-*`; los botones fijados (`disabled={page <= 1}`, `aria-disabled`, `dashboard-pagination-btn`) siguen en la superficie, y el estado conserva su caja de 4,5 rem con `inline-block` dentro del slot. C03: error y vacío | `ContentListItem` en las filas: `CanonicalOperationalRow` ya es la fila compartida; envolverla agrega una caja por fila y mueve el pitch. C13 `DetailsHeader`/`DetailsTabs`/`DetailsMetadata` en el panel visible: el tablist es la región `sidePanel` de A02 y la cuadrícula 3×2 pasaría a una columna (cambio visual y PR-TRUNC). C14: el timeline ya es el adaptador `StudyTimeline` → `DetailsActivity`. C15: igual que el módulo |

## Archivos

Producto: `frontend/src/app/dashboard/ClinicInformesWorkspaceSummary.tsx`, `frontend/src/app/dashboard/informes/InformesReportsList.tsx`.

Pruebas nuevas: `test/architecture/dashboard-c21-clinic-reports-batch-1.test.ts` (guard + 12 mutaciones), `frontend/e2e/clinic/reports/clinic-c21-reports-batch-1.spec.ts` (cohorte `visual-contract`, capa `fixture`).

Guards realineados en el mismo PR, sin debilitar: B11 (censos C01 y C03 con los dos archivos; C02: la ruta completa entra al censo del owner con `variant="centered"` y el módulo queda explícitamente fuera; `<ErrorState` pasa a cero consumidores de producto), `dashboard-stable-geometry-reservation` (la ruta completa delega la región en el owner, cuya `nav` sigue declarando región y reserva táctil), `frontend-dashboard-informes` y `frontend-dashboard-empty-states` (anclas `<EmptyState`/`<ErrorState` → `<CollectionState variant=…>`), catálogo E2E 120→121 (clinic 28, fixture 76, visual-contract 43, ci 90, full 121; unión CI 90, mensajes 120/122), `e2e-completeness-workflow` 121 y censo 05A de importadores del lector canónico 432→433.

## RED → GREEN

El guard C21 aplicado a los fuentes de `HEAD` (leídos con `git show`) falla 2/2 con 22 violaciones, todas de migración; ninguno de los contratos preservados (filtros, PR-BUG-01, capacidad, recuperación, scope clínica, B10) falla sobre `HEAD`, lo que confirma que ya regían. Sobre el árbol C21 pasa 2/2 y rechaza sus 12 mutaciones. El spec E2E sobre las dos fuentes de `HEAD` (copiadas temporalmente y restauradas por copia, sha1 verificado) falla 3/6: las tres pruebas de migración; las tres de preservación (vacío por búsqueda, error de lectura con barras visibles, redirección sin sesión clínica) pasan en ambos lados porque son invariantes.

## Validaciones

| Gate | Estado |
| --- | --- |
| Guard C21 | PASSED 2/2 (RED 2/2 sobre `HEAD`, 22 violaciones) |
| Tests Node que anclan las dos superficies (27 archivos) | PASSED 289/289 |
| Censos 01B/05A, catálogo E2E, workflow de completitud, B11, régimen zero-scroll (con tracking simulado) | PASSED |
| Suite Node completa con los tres archivos nuevos simulados como trackeados | FAILED 5378/5380 (1 skip): sólo Auth 03B, que exige `DATABASE_URL`; ambiental y preexistente |
| Frontend `lint`, `typecheck`, `build`; `security:public-surface`; raíz `typecheck`, `typecheck:test`, `build` | PASSED |
| `pnpm validate:local` como cadena | NOT_RUN: su suite Node falla por la precondición ambiental Auth 03B; sus piezas se ejecutaron por separado |
| E2E C21 | PASSED 6/6 (RED 3/6 sobre `HEAD`) |
| A02 `clinic-informes`, `clinic-informes-full` (13 viewports, baseline Win32 sin cambios) | PASSED 2/2 |
| A03 `informes-reports-list`, `clinic-informes-summary` (`limit/offset` sin tocar el fixture) | PASSED 2/2 |
| Regresión dirigida: 34 specs que tocan Informes clínica más `internal-no-scroll-contract`, A08 `zero-scroll-baseline` y `responsive-cold-load-sentinel` | 883/894 PASSED; 11 FAILED, todas en `public-document-cache-policy` (páginas públicas; seleccionada sólo por la ruta `/informes-veterinarios`): bajo `next dev` exige la política del runner de producción. Las mismas 11 fallan con las fuentes de `HEAD`; no es una regresión C21 |
| `e2e:visual-contract`, `e2e:extended`, `e2e:public-clinic` completas | NOT_RUN: se ejecutaron sus specs afectados |
| `e2e:full` | NOT_RUN (baselines pixel Chromium-Linux) |
| `git diff --check` | PASSED |

## Riesgo residual

- A02 Linux no se mide localmente. Win32 no cambió en ninguna región; sólo `e2e-full-completeness` en CI lo confirma.
- Cambios visuales no geométricos aceptados por la gramática C01 (los mismos de C17–C18): la cabecera de la tabla del módulo toma el fondo de superficie de `.dashboard-collection-header` (sticky, sin contenedor de scroll) y la fila de cabecera gana el hover de `TableRow`; el diálogo de detalle del módulo muestra los metadatos en una columna.
- El error de la ruta completa conserva el envoltorio `<div role="alert">` alrededor de un `CollectionState` que también es `role="alert"` (anidamiento preexistente). Quitarlo estira el aviso como ítem flex; queda como hallazgo fuera de scope.
- Los guards que leen archivos trackeados verán los tres archivos nuevos recién después del staging; se verificaron con simulación de tracking.

Estado final: implementación local completa, sin staging, commit, push ni PR.
