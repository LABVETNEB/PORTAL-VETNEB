# C22 · Migración clínica, lote 2: Tokens · Logística · Perfil · Operaciones

## Estado base, alcance y auditoría previa

Base `ca3e354834307a39f7dabb86572aa218e7859891` (C21 integrado, #1886; PR-BUG-01 integrado, #1885) en `feat/dashboard-c22-clinic-batch-2`; `git merge-base --is-ancestor` verdadero para ambos. Árbol tracked limpio; se preservaron los dos untracked previos (`frontend/AGENTS.md`, `frontend/CLAUDE.md`, generados por `next dev`), los cinco stashes y el único worktree. Sin `AGENTS.md` anidados tracked. No se ejecutaron escrituras Git ni GitHub.

Scope: presentación del resto de la superficie de clínica (§53 del roadmap) sobre las primitivas existentes C01–C16, sus guards realineados, un spec E2E y este registro. Fuera de scope: backend, endpoints, AuthN/AuthZ, DB, dependencias, configuración, CSS/tokens, FSM de navegación, primitivas compartidas (no se modificó ningún owner C01–C21), `LogisticsBoundedCanvas`, `ParticularTokensCardPrimitives`, el shell B10, PR-BUG-01, C23 y C24.

Criterio rector (el de C18–C21): **sólo se adopta una primitiva si es geométricamente neutra** frente a A02 y A03 y no cambia la semántica ni el contrato observable de la superficie.

«Logística (3 rutas)» se resolvió por código: las tres rutas que componen `LogisticsBoundedCanvas` (`/dashboard/logistica/metricas`, `/rutas`, `/visitas`; las tres variantes de `logistics-bounded-canvas` en §20.2). Como C22 es «el resto de la superficie de clínica», el módulo `?module=logistica` y el hub `/dashboard/logistica` también se migraron.

| Superficie | Ruta | Owner | Shell |
| --- | --- | --- | --- |
| Tokens (S7) | `/dashboard?module=tokens` | `ClinicParticularTokensCard.tsx` — ventana cliente (`getClinicParticularTokens`, superset ≤ 36), filtro de 6 campos con submit manual, `usePagedRows`, tabla ≥ 768 px y lista < 768 px, alta en 3 pasos, detalle y seguimiento | `/dashboard` (B10) |
| Logística, módulo | `/dashboard?module=logistica` | `ClinicLogisticaWorkspaceSummary.tsx` — visitas recientes, `usePagedRows`, filas botón, diálogo con enlace profundo a `/visitas` | `/dashboard` (B10) |
| Logística, hub | `/dashboard/logistica` | `page.tsx` (servidor) + `LogisticsCommandCenter.tsx` (servidor) + `LogisticsRecentListCanvas.tsx` (cliente) | `ClinicDashboardShell module="logistica"` + `ClinicFullRouteModuleStage` |
| Logística, 3 rutas | `/metricas`, `/rutas`, `/visitas` | `page.tsx` (servidor) — `limit/offset` por URL, `LogisticsBoundedCanvas` reescribe el `limit` medido, sin `total` (heurística página llena) | idem |
| Perfil | `/dashboard?module=perfil` | `ClinicPublicProfileCard.tsx` — formulario por secciones, avatar, contraseña | `/dashboard` (B10) |
| Operaciones | `/dashboard?module=operaciones` | `ClinicCommandCenter.tsx` (servidor) — pestañas Métricas/Recientes/Estado | `/dashboard` (B10) |

## Mapa de adopción

| Superficie | Adoptado | No adoptado y causa |
| --- | --- | --- |
| Tokens | C01: `thead` → `CollectionHeader` (alto ligado a `--dash-table-head-h` por `canvas-reserve="table-head-above-md"`), fila de cabecera y filas → `ContentListItem as="tr"`, `tbody` → `ContentList as="tbody"` con su `divide-y`; lista móvil → `ContentList as="div"` (mismas clases) con ítems `ContentListItem as="div"` que conservan `id` (ancla de notificaciones) y `data-dashboard-adaptive-row`. C03: los dos vacíos (el de carga conserva su texto como `variant="empty"`: misma caja) | `CollectionWorkspace`: el canvas medido es `ParticularTokensPanelBody`, primitiva compartida que su test ancla. C02: el pager usa `DASHBOARD_PAGER_RESERVATION` (no táctil), marcadores `data-clinic-access-pagination-*` que el owner no propaga y estado sólo-teléfono `Página N / M`; `centered` impone 40 px y `compact` exige `total`. C03 error: el error es la banda de subtítulo `role="alert"` (CMP-10), no un estado de colección. C10/C11/C12: S7 es subsistema protegido (§7.8). C13: el `dl` del detalle es de 2 columnas y `DetailsMetadata` lo pasaría a 1. C06/C07/C09: no hay operación masiva |
| Logística, módulo | C01: el panel → `CollectionWorkspace`; el canvas medido → `ContentList as="div"` (las filas siguen siendo hijos directos). C02: `DashboardPager` → `CollectionPager variant="centered"` (el adaptador sólo fijaba la variante: DOM idéntico). C03: vacío | `ContentListItem` en las filas: son `<button>` y el owner no ofrece ese elemento; envolverlas agregaría una caja por fila. C03 error: aviso `.clinical-alert-warning` con `DashboardRefreshButton` real. C13: `dl` de 2 columnas |
| Logística, hub | C01: la raíz de reserva de `LogisticsRecentListCanvas` → `CollectionWorkspace`; su canvas → `ContentList as="div"`. C02: `CollectionPager variant="centered"`. C03: los dos vacíos de `LogisticsCommandCenter` (import directo del owner: componente de servidor) | Errores `<p role="alert">` sin título ni ícono: `CollectionState error` los convertiría en tarjeta. Filas: `CanonicalOperationalRow` ya es la fila compartida |
| Logística, 3 rutas | C02: el `<nav>` manual → `CollectionPager variant="centered"` en modo slot (como C21): el owner aporta `nav`, reserva táctil, región y selectores; los `PublicRouteControl` por URL con `disabled={!canGoPrevious}`/`{!canGoNext}` siguen en la página; el estado conserva su caja de 4,5 rem con `inline-block`. C01: tabla de `/rutas` y `/visitas` con `CollectionHeader`, `ContentList as="tbody"` y filas `ContentListItem as="tr"`; listas móviles de las tres → `ContentList as="div"`. Import directo de los owners (páginas de servidor) | Estados inline (`clinical-table-state`, `surface-empty`, filas de error): `CollectionState` agregaría tarjeta e ícono. Bloques de métricas de escritorio: hijos directos del canvas medido de `LogisticsBoundedCanvas`; un `ContentList` agregaría una caja. `LogisticsBoundedCanvas` no se tocó |
| Perfil | — | Formulario con secciones (`ModuleCardSections`), sin colección, paginación ni detalle. Los estados de carga/guardado son textos de banda y pie con `role="alert"`/`role="status"` |
| Operaciones | C01: las dos listas recientes → `ContentList as="div" className="contents space-y-1.5"` con ítems `ContentListItem as="div" className="dashboard-list-row"` (sin caja nueva: `display: contents` y el mismo espaciado de 6 px). C03: los dos vacíos (import directo: servidor) | Avisos de error con `DashboardRefreshButton` real (tres). Lista «Atención requerida»: texto de estado, no colección |

PR-BUG-01 se conserva en S7: la barra se renderiza en la banda de herramientas antes y fuera de las ramas de colección; Aplicar/Limpiar resetean la página y reponen `loadErrorMessage`.

## Archivos

Producto: `frontend/src/components/dashboard/ClinicParticularTokensCard.tsx`, `frontend/src/app/dashboard/ClinicLogisticaWorkspaceSummary.tsx`, `frontend/src/app/dashboard/ClinicCommandCenter.tsx`, `frontend/src/app/dashboard/logistica/LogisticsCommandCenter.tsx`, `frontend/src/app/dashboard/logistica/LogisticsRecentListCanvas.tsx`, `frontend/src/app/dashboard/logistica/{metricas,rutas,visitas}/page.tsx`.

Pruebas nuevas: `test/architecture/dashboard-c22-clinic-batch-2.test.ts` (guard + 15 mutaciones; deriva las tres rutas de la unión `canvas` de `LogisticsBoundedCanvas` en lugar de declarar un registro literal: la banda 01B `A0-20-REGISTRIES` está en su techo de 133 y no se re-ancló), `frontend/e2e/clinic/shell/clinic-c22-batch-2.spec.ts` (cohorte `visual-contract`, capa `mocked` por la ventana de tokens).

Guards realineados en el mismo PR, sin debilitar: B11 (censos C01, C02 y C03 con las superficies C22; `<DashboardPager` y `<EmptyState` pasan a cero consumidores de producto salvo `DetailsEmptyState`; aserciones nuevas del modo slot de las tres rutas), `dashboard-capacity-single-owner` y `dashboard-stable-geometry-reservation` (las tres rutas delegan la región al owner C02 y no conservan una segunda copia de la reserva), `frontend-dashboard-logistics-hub` y `frontend-dashboard-clinic-command-center` (oráculo de vacío → `CollectionState variant="empty"`), catálogo E2E 121→122 (clinic 29, mocked 46, visual-contract 44, ci 91, full 122; unión CI 91, mensajes 121/123), `e2e-completeness-workflow` 122 y censo 05A de importadores del lector canónico 433→434.

## RED → GREEN

El guard C22 aplicado a los fuentes de `HEAD` (leídos con `git show`) falla 2/2 con 59 violaciones, todas de migración; ninguno de los contratos preservados (PR-BUG-01, acciones de S7, enmascarado de tokens, endpoint clínico, capacidad, URL `limit/offset`, `no-store`, redirección a login, B10, Perfil) falla sobre `HEAD`. Sobre el árbol C22 pasa 2/2 y rechaza sus 15 mutaciones. El spec E2E sobre los fuentes de `HEAD` (copiados temporalmente y restaurados por copia, sha1 verificado) falla 8/10: las ocho de migración; las dos de preservación (lectura fallida de tokens con barra visible, frontera clínica de las rutas) pasan en ambos lados.

## Validaciones

| Gate | Estado |
| --- | --- |
| Guard C22 | PASSED 2/2 (RED 2/2 sobre `HEAD`, 59 violaciones) |
| Tests Node que anclan las superficies C22 (42 archivos) | PASSED 471/471 |
| Censos 01B/05A, catálogo E2E, workflow de completitud, contrato mock ↔ Fastify, B11 (con tracking simulado) | PASSED 78/78 |
| Suite Node completa con los tres archivos nuevos simulados como trackeados | FAILED 5380/5382 (1 skip): sólo Auth 03B, que exige `DATABASE_URL`; ambiental y preexistente |
| Frontend `lint`, `typecheck`, `build`; `security:public-surface`; raíz `typecheck`, `typecheck:test`, `build` | PASSED |
| `pnpm validate:local` como cadena | NOT_RUN: su suite Node falla por la precondición ambiental Auth 03B; sus piezas se ejecutaron por separado |
| E2E C22 | PASSED 10/10 (RED 8/10 sobre `HEAD`) |
| A02 `clinic-tokens`, `clinic-logistica`, `clinic-logistica-full`, `clinic-log-metricas`, `clinic-log-rutas`, `clinic-log-visitas`, `clinic-perfil`, `clinic-operaciones` (13 viewports, baseline Win32 sin cambios) | PASSED 8/8 |
| A08 zero-scroll de las mismas 8 superficies | PASSED 8/8 |
| A03 `clinic-logistica-summary`, `clinic-particular-tokens`, `logistics-recent-list`, `logistics-bounded-canvas` + integridad dirigida (`limit/offset` sin tocar el fixture) | PASSED 5/5 |
| Regresión dirigida: 46 specs que tocan las superficies C22 (incluye `internal-no-scroll-contract`, `real-app-shell-no-scroll-contract`, `zero-scroll-mobile-boundary`, B05, B08–B12, B14, A05 `limit-invariance`, FSM clínica) | 1084/1089 PASSED en una corrida paralela. 5 FAILED, todas de navegación por clic bajo carga: reachability del hub ×2 e interaction-foundation pasan aisladas (28/28); FSM failure-matrix (admin, no tocado); Perfil «retry-by-resubmit» falla 3/4 con 2 workers **también sobre `HEAD`** (dos corridas A/B) y pasa 4/4 en serie: clic sin esperar hidratación, preexistente |
| `e2e:visual-contract`, `e2e:extended`, `e2e:public-clinic` completas | NOT_RUN: se ejecutaron sus specs afectados |
| `e2e:full` | NOT_RUN (baselines pixel Chromium-Linux) |
| `git diff --check` | PASSED |

## Riesgo residual

- A02 Linux no se mide localmente. Win32 no cambió en ninguna región de las 8 superficies; sólo `e2e-full-completeness` en CI lo confirma.
- Cambios visuales no geométricos aceptados por la gramática C01 (los mismos de C17–C21): las cabeceras de Tokens, Rutas y Visitas toman el fondo de superficie de `.dashboard-collection-header` (sticky, sin contenedor de scroll) y la fila de cabecera gana el hover de `TableRow`.
- Las tres rutas de servidor renderizan ahora el owner cliente `CollectionPager` con controles de servidor en sus slots; antes declaraban la reserva leyendo una constante exportada desde ese mismo módulo `"use client"`. A02/A08 y el E2E C22 miden la región en 40 px.
- Hallazgo preexistente fuera de scope: la celda de progreso de `/dashboard/logistica/rutas` (escritorio) renderiza `role="progressbar"` sin nombre accesible (axe `aria-progressbar-name`, serio). El spec C22 lo excluye sólo en esa ruta y lo deja nombrado.
- Los guards que leen archivos trackeados verán los archivos nuevos recién después del staging; se verificaron con simulación de tracking.

Estado final: implementación local completa, sin staging, commit, push ni PR.
