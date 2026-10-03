# C01 · CollectionWorkspace + ContentList + ContentListItem + CollectionHeader

## Base y alcance

Base: `main` / `origin/main` en `4009ca77ae143b59f4ac649467af779a658511bc` (B15 y B16 fusionados por #1813). Rama local `feat/dashboard-c01-collection-workspace`, sin worktree. C01 es el primer slot del Programa C (§50) y depende sólo de B15. Establece las cuatro primitivas de colección y una adopción mínima; no inicia C02–C05 ni migra módulos (C17+).

## Censo previo

Fuente: código ejecutable (`grep` sobre `frontend/src`), con el documento rector como hipótesis. Hay **12 tablas** dentro de la gramática adaptativa y una tabla huérfana; el resto de las colecciones son listas o formularios.

| Módulo | Componente | Scroll owner real del `thead` | Cabecera | Ítem | Reserva de cabecera (A03) | Paginación |
|---|---|---|---|---|---|---|
| Auditoría (desktop) | `AdminAuditDenseTable` en `AdminAuditCard` | wrapper de `Table`, **no acotado** (canvas en bloque) | `thead` 32 px | `tr` compact 36 | `table-head-dense` 32 | servidor |
| Informes admin | `AdminReportsCard` | wrapper de `Table` | `thead` 32 | `tr` compact | `table-head-dense` | servidor |
| Tokens admin | `AdminParticularTokensCard` | wrapper de `Table` | `thead` 32 | `tr` compact | `table-head-dense` | ventana + slice cliente |
| Clínicas | `AdminClinicsManagementCard` | wrapper de `Table` dentro de `.dashboard-table-responsive` (`overflow-x: auto`, también contenedor de scroll) | `thead` 32 | `tr` compact | `table-head-dense` | servidor |
| Usuarios y roles | `AdminUsersRolesReadOnlyCard` | wrapper de `Table` dentro de `.dashboard-table-responsive` | `thead` 32 | `tr` compact | `table-head-dense` | servidor |
| Sesiones | `AdminSessionsReadOnlyCard` | idem | `thead` 32 | `tr` compact | `table-head-dense` | servidor |
| Intentos fallidos | `AdminFailedLoginAlertsReadOnlyCard` | wrapper de `Table` | `thead` 32 | `tr` compact | `table-head-dense` | servidor |
| Informes clínica | `ClinicInformesWorkspaceSummary` | ninguno: `table` cruda bajo `overflow-hidden` | `thead` 44 | `tr` regular | `table-head-above-md` | cliente |
| Tokens clínica | `ClinicParticularTokensCard` | ninguno: `table` cruda bajo `overflow-hidden` | `thead` 44 | `tr` regular | `table-head-above-md` | cliente |
| Logística rutas | `rutas/page.tsx` + `LogisticsBoundedCanvas` | wrapper de `Table` | `thead` 44 | `tr` tall | `table-head` | servidor (URL) |
| Logística visitas | `visitas/page.tsx` + `LogisticsBoundedCanvas` | wrapper de `Table` | `thead` 44 | `tr` tall | `table-head` | servidor (URL) |
| — | `AdminReportWorkflowViewerCard` | wrapper de `Table` | `thead` 44 | `tr` | ninguna | 0 consumidores (fuera de scope) |

Listas sin cabecera: las variantes móviles de las tablas admin (`article`/`div` con pitch `regular`), Informes ruta completa (`InformesReportsList`), Logística reciente y resumen, Mantenimiento (`card`) y Precios (`form`). Todas las tablas usan el lock de cabecera de `zero-scroll.css`: su alto **es** la reserva que descuenta `useDashboardCanvasCapacity`.

Diagnóstico de P2-10: el `thead` nunca era pegajoso y, además, en Auditoría el contenedor de scroll más cercano (el wrapper de `Table`) no estaba acotado, de modo que ni siquiera un `sticky` habría tenido dónde engancharse. Bajo zero-scroll ningún canvas productivo desborda, por lo que el comportamiento pegajoso sólo es observable con un dataset que desborde (harness E2E).

## Diseño y contrato

Ubicación: las primitivas extienden `components/ui/table.tsx`, que el documento rector declara base de `CollectionWorkspace` (§14.2), y se publican por el barrel existente `features/dashboard/presentation/surfaces` (§47.2, «reexportar durante la migración»). La carpeta destino `presentation/collection/` (§47.1) no se crea en C01: el lector canónico de la suite rechaza archivos no versionados, igual que en B11/B15/B16.

| Primitive | DOM | API | Owner de |
|---|---|---|---|
| `CollectionWorkspace` | `div` | atributos HTML + `ref`; marca `data-collection-workspace` | la zona de colección: columna flex acotada (`min-block-size: 0`). **No** es contenedor de scroll |
| `ContentList` | `tbody` (piel de `TableBody`) · `ul` · `ol` · `div` | `as` obligatorio + atributos del elemento | el contenedor de ítems; marca `data-content-list` |
| `ContentListItem` | `tr` (piel de `TableRow`) · `li` · `article` · `div` | `as` obligatorio + atributos del elemento | el ítem estructural; marca `data-content-list-item` |
| `CollectionHeader` | `thead` (piel de `TableHeader`) | atributos HTML + `ref`; marca `data-collection-header` | cabecera pegajosa de 36 px |

Ninguna primitiva hace fetch, conoce endpoints, auth, capacidad adaptativa, paginación, orden ni selección; no añade `role`, `aria-sort`, `aria-selected`, handlers ni tab stops. `as` es obligatorio para que la semántica la decida el consumidor: una tabla sigue siendo tabla y una lista de `article` sigue siéndolo. Las celdas `th` siguen siendo del consumidor, que es donde C04 colgará `aria-sort` sin cambiar esta API.

**Scroll y sticky.** El scroll owner de una tabla sigue siendo el wrapper existente de `Table`; C01 no crea contenedores de scroll. `CollectionWorkspace` es una columna flex que convierte al hijo `.dashboard-fitted-table` en un ítem flexionado de altura definida, y la regla existente `.dashboard-fitted-table > div { max-height: 100% }` pasa así a acotar al wrapper. `CollectionHeader` es `position: sticky; inset-block-start: 0`, nunca `fixed`, con fondo `--dash-color-surface` para que las filas no se transparenten al desplazarse.

**36 px y A03.** `--dash-collection-header-h: 36px` es el token canónico (§46). Dentro de un canvas con reserva de cabecera, el token se liga a `--dash-table-head-h`: la cabecera medida sigue siendo igual a la reserva que descuenta el motor de capacidad, por construcción. Llevar esa reserva a 36 px cambia la capacidad de los 15 consumidores y es trabajo de C05 junto con A07 (R13, §60). Por eso en Auditoría la cabecera mide 32 px (reserva densa congelada) y en un contexto sin reserva mide 36 px.

## Ledger CSS

| Owner anterior | Owner nuevo | Propiedad | Antes | C01 | Efecto |
|---|---|---|---|---|---|
| Ninguno | `tokens.css` | `--dash-collection-header-h` | ausente | 36 px; ligado a `--dash-table-head-h` bajo reserva | un solo ledger, A03 intacto |
| Ninguno | `tables.css` (`@layer components`) | `.dashboard-collection-workspace` | ausente | `display: flex; flex-direction: column; min-*-size: 0` | acota el frame de la tabla |
| `TableHeader` (sin posición) | `tables.css` (sin capa) | `position` de la cabecera | `static` | `sticky`, `inset-block-start: 0`, `z-index: 1`, fondo superficie | cabecera pegajosa respecto del frame |
| `TableHead` `h-11` | `tables.css` (sin capa) | alto de cabecera fuera de reserva | 44 px | `var(--dash-collection-header-h)` | 36 px canónico; la reserva A03 conserva mayor especificidad |

## Adopción mínima

Un solo módulo, Auditoría admin, porque ejerce las dos formas DOM con un consumidor A02/A03/A05/A08 de paginación por servidor y acciones reales por fila:

- **Tabla desktop.** El canvas medido de `AdminAuditCard` pasa a ser `CollectionWorkspace` conservando `ref`, `data-dashboard-adaptive-rows-canvas`, `data-dashboard-row-pitch`, `data-dashboard-canvas-reserve` y `className`. En `AdminAuditDenseTable`, `TableHeader` → `CollectionHeader`, `TableBody` → `ContentList as="tbody"` y la fila de datos → `ContentListItem as="tr"`. `Table`, `TableHead`, `TableCell`, el diálogo de detalle y el pager no cambian.
- **Lista móvil.** En `AdminMobileAuditModule`, el canvas pasa a `ContentList as="div"` y cada `article` a `ContentListItem as="article"`, con los mismos atributos. Sin `CollectionWorkspace`: el canvas ya es la región acotada y envolverlo sumaría un nodo sin función.

Cero nodos DOM añadidos: cada primitiva reemplaza el elemento que ya existía. Sin hooks, estado, memoización ni observadores nuevos.

## Verificación

- Unit `ui/table` (runtime, ejecuta `table.tsx` contra un stub de React): PASSED 8/8, incluye 2 casos C01.
- Guard de arquitectura B11/B15/B16/C01: PASSED 14/14, incluye 4 casos C01.
- Guards `test/architecture/**` + `test/unit/ui/**`: PASSED 2432/2433, 1 omitido condicional preexistente.
- E2E `dashboard-b11-workspace-header.spec.ts`: PASSED 17/17 (4 casos C01). Harness a 1366 × 768 y 390 × 844: cabecera 36 px, `sticky`, scroll owner = frame de `Table` dentro del workspace, un único scroller activo, workspace con `overflow: visible`, cabecera fijada al tope del frame tras desplazar 400 px, orden de tabulación intacto y panel B16 de 336 px. Auditoría real: cabecera = reserva A03 (32 px), cero scroll interno, diálogo de detalle y página siguiente operativos; lista móvil con canvas y acción por fila intactos.
- A02: PASSED, 21/21 superficies (273 combinaciones), baseline sin cambios.
- A03: PASSED, 16/16, 195/195 registros primarios y 234/234 hojas; fixture sin cambios.
- A05: PASSED, 15/15 consumidores; `limit` invariante. A08: PASSED, 21/21 superficies sobre 13 viewports.
- Contratos zero-scroll de AGENTS §10 y causales de Auditoría (`dashboard-internal-no-scroll-contract`, `dashboard-real-app-shell-no-scroll-contract`, `dashboard-zero-scroll-mobile-boundary`, `dashboard-viewport-zoom-adaptability`, `admin-mobile-ops-modules-no-scroll`): PASSED 130/130.
- Frontend lint, typecheck y build, `pnpm security:public-surface` y `git diff --check`: PASSED.
- No seleccionados: `pnpm validate:local` y `pnpm test` completo (gates de backend; C01 no toca `server/`), cohorte visual Linux (BLOCKED en Win32).
- Entorno: el primer `pnpm` sincronizó `node_modules` (next 16.3.5 → 16.3.6) con el lockfile ya versionado; `package.json` y `pnpm-lock.yaml` sin cambios.

## Riesgo y rollback lógico

Riesgo residual: el fondo opaco de la cabecera sustituye el 8 % de canvas que antes dejaba pasar el wrapper `bg-card/92` bajo la fila translúcida de la cabecera; el delta de color es sub-nivel o de un nivel RGB y la cohorte visual Linux no es ejecutable en Win32. El resto de las tablas conserva `TableHeader` sin `sticky` hasta su migración.

Rollback: revertir los dos consumidores de Auditoría, las primitivas y su export, los bloques `dashboard-c01-*` de `tokens.css` y `tables.css`, y los casos C01 de tests, spec y catálogo. No requiere cambios de datos ni de backend.

## No alcance

Sin backend, API, auth, DB, migraciones, dependencias, lockfile, workflows, PWA ni producción. Sin C02 (pager unificado), C03 (estados vacíos/error/carga), C04 (orden por columna), C05 (fila de 40 px y reserva de 36 px), C06+ (selección, toolbar contextual, menús, acciones masivas), P1-15 (lista/cuadrícula) ni migración de otros módulos. B15 y B16 sin cambios. Hallazgos fuera de scope: la lista `md:hidden` interna de `AdminAuditDenseTable` es inalcanzable (su sección es `hidden md:flex`) y `AdminReportWorkflowViewerCard` no tiene consumidores.
