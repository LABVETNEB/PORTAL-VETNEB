# C24 · Alternancia lista/cuadrícula

## Estado base, alcance y auditoría previa

- Rama `feat/dashboard-c24-list-grid-toggle`, base `d29c1351` (C23a, #1888), que contiene C22 (#1887).
- Objetivo contractual (roadmap §50, nivel 11; hallazgo P1-15 de §30): alternancia lista/cuadrícula **donde aporta valor** (informes, clínicas, documentos), con `ContentGrid`/`ContentGridItem` como destino de §47.1.
- Alcance: frontend-only. Sin backend, DB, endpoints, dependencias, CI, CSS global, baselines A02/A03/A08, C23b ni C25.

## 1. Matriz de superficies

| Superficie | Owner | Veredicto | Justificación |
| --- | --- | --- | --- |
| Informes clínica, ruta completa `/dashboard/informes` | `app/dashboard/informes/InformesReportsList.tsx` | **Elegible, implementada** | Lista maestra sobre un canvas medido (`useDashboardCanvasCapacity`, pitch `regular`); la cuadrícula reusa canvas, página, `limit` y paginador |
| Informes admin (≥ 768 px) | `app/dashboard/admin/AdminReportsCard.tsx` | **Elegible, implementada** | Tabla con selección C06 y reserva `table-head-dense`; la franja de cabecera de la cuadrícula ocupa la misma reserva y aloja «Seleccionar página» |
| Clínicas admin (≥ 768 px) | `app/dashboard/admin/AdminClinicsManagementCard.tsx` | **Elegible, implementada** | Orden C04 server-side en la cabecera; la franja de la cuadrícula aloja los mismos dos controles |
| Listas móviles (< 768 px) de Informes y Clínicas admin | mismos owners | No elegible | Ya son listas de tarjetas; una cuadrícula de una columna sería redundante. La lista se fuerza por debajo de 768 px |
| Módulo Informes del hub de clínica | `app/dashboard/ClinicInformesWorkspaceSummary.tsx` | No elegible | Resumen embebido; Informes clínica queda cubierto por la ruta completa |
| Documentos | — | No elegible / requiere autorización | No existe colección de documentos: el archivo es un adjunto por informe, accesible desde el detalle y el visor C15/C16. Miniaturas exigirían URL firmada o fetch por tarjeta (backend, privacidad, rendimiento) |

## 2. Diseño

### Primitivas

- `surfaces/collection-view.ts` (puro, sin imports): `COLLECTION_VIEWS`, `COLLECTION_GRID_REGIME = "(min-width: 768px)"` (frontera móvil B09/C23a), `resolveCollectionView` y `collectionGridRows(limit, columns) = max(1, ceil(limit / columns))`.
- `surfaces/CollectionViewToggle.tsx`: `useCollectionView()` (estado en memoria, `useSyncExternalStore` sobre la media query con snapshot de servidor `false`, de modo que SSR pinta la lista) y `CollectionViewToggle` (`role="group"` nombrado «Vista de …», dos `<button type="button">` con `aria-pressed`, `aria-label` y `title`, foco visible; `hidden md:inline-flex`).
- `surfaces/ContentGrid.tsx`: `ContentGrid` (columnas y filas como **entradas**; no mide nada) y `ContentGridItem` (`article`/`div`). Vive fuera de `components/ui/table.tsx`, que queda idéntico a `HEAD`: el guard C01 prohíbe geometría (`style=`, `overflow`) en los primitivos C01.
- Reutilizadas: `CollectionWorkspace`, `ContentList`, `CollectionHeader`, `CollectionPager`, `CollectionState`, `useCollectionSelection`, `SelectionToolbar`, `ActionMenu`, `DetailsPane`, `ModuleDialog`.
- Descartadas: persistencia en URL, `localStorage` o servidor (no existe contrato previo que la habilite); un hook de capacidad propio de la cuadrícula (cambiaría A03).

### Contrato de capacidad (A03)

La cuadrícula se dibuja **dentro del mismo canvas medido** (mismo elemento, `ref` y atributos) y sus filas son `collectionGridRows(effectiveLimit, columnas)`. La altura del canvas no depende de su contenido, así que el `limit` medido, el `offset`, el request y el paginador son los de la lista. Cambiar de vista no emite ninguna petición. Las tarjetas no llevan `data-dashboard-adaptive-row` (no quedan fijadas al pitch).

| Superficie | Columnas | Datos de la tarjeta | Acciones |
| --- | --- | --- | --- |
| Informes clínica | 2 | `#id · paciente`, estudio, fecha, estado | La tarjeta es el mismo botón de selección (`id="report-N"`, `aria-current`, mismo `aria-label`); detalle en el panel `lg` o «Ver detalle» |
| Informes admin | 3 | Paciente, estado, Tinción, `Informe #id`, clínica, estudio; Fecha desde `lg` y Archivo desde `xl` (mismos breakpoints que las columnas) | Checkbox C06, «Ver» y menú de acciones (`xl`, igual que la lista) |
| Clínicas admin | 3 | Nombre, `#id`, email, usuario `+N`, fecha de actualización con `title` creada/actualizada | «Editar clínica …» con las mismas condiciones de `disabled` |

### Filtros, orden, selección y paginación

- Informes admin: los filtros de cliente (`filteredReports`) y la selección C06 son los mismos owners; la franja de la cuadrícula aloja el checkbox de página con la misma etiqueta y el mismo handler.
- Clínicas admin: búsqueda server-side y orden C04 intactos. La franja de la cuadrícula (`role="group"` «Ordenar clínicas») repite los dos controles `ClinicsSortHeaderButton`, derivados de `appliedSort`; como fuera de un `<th>` no hay `aria-sort`, cada control anuncia su estado (`announceState`).
- Informes clínica: los filtros viajan por URL (contrato S7 existente); la paginación usa la misma ventana.
- Ningún handler de vista resetea filtros, búsqueda, orden, selección ni ventana (lo verifica el guard).

### Responsive

- ≥ 768 px: selector visible, cuadrícula opcional.
- < 768 px: selector oculto y lista forzada (`resolveCollectionView`); la preferencia se conserva en memoria y vuelve al cruzar de nuevo 768 px.
- Drawer, rail, bottom nav y overlays C23a no se tocan.
- La descripción «Click en un informe…» comparte fila con el selector en Informes clínica y se trunca a una línea (`truncate` + `title`, texto completo en el DOM), igual que el patrón existente de copia secundaria bajo 768 px. Sin eso, a 1024×768 pasaba a dos líneas (ver §4).

## 3. Matriz de los 13 viewports canónicos

Medida por `dashboard-c24-list-grid-toggle.spec.ts` (Chromium, Win32) en Informes admin (A03 fixture) e Informes clínica (fixture poblada). En cada viewport: cero scroll de documento; desde 768 px, una tarjeta por fila de la lista, todas dentro del canvas y sin overflow horizontal interno, sin request al cambiar de vista.

| Viewport | Selector | Informes admin | Informes clínica |
| --- | --- | --- | --- |
| 1920×1080, 1600×900, 1440×900, 1366×768, 1280×720, 1024×768 | Visible | Cuadrícula 3 columnas | Cuadrícula 2 columnas |
| 834×1194, 768×1024 | Visible | Cuadrícula 3 columnas | Cuadrícula 2 columnas |
| 430×932, 412×915, 390×844, 375×812, 360×800 | Oculto | Lista móvil original | Lista original |

Cruce 1366 → 390 → 1366 con la cuadrícula elegida: a 390 se ve la lista móvil y no hay grid; al volver, la cuadrícula reaparece con `aria-pressed="true"`.

## 4. Evidencia RED → GREEN

| Paso | Evidencia |
| --- | --- |
| RED de ausencia | Guard y unitario C24 antes de implementar: 7/8 fallaban (módulos inexistentes, owners sin adoptar, spec ausente); el único verde era la aserción negativa de no adopción |
| RED de defecto (E2E) | Primera corrida de la spec: a 834×1194, 2/23 tarjetas de Informes admin con overflow horizontal interno (badge + «Tinción» + `Informe #id` sin encoger en ~220 px; `overflow-hidden` recortaba el id). Fix: el id se trunca (`min-w-0 truncate`) |
| RED de defecto (A02/A03) | A02 `clinic-informes-full` a 1024×768: `collection.y` 472.08 → 492.08, canvas 235.34 → 215.34 (Δ 20); A03 `informes-reports-list::w1024x768`: `limit` 5 → 4. Causa: el selector angostaba la columna de la descripción, que pasó a dos líneas. Fix: descripción truncada a una línea (§2). Sin tocar baselines |
| GREEN | Guard C24 y unitario en verde; spec C24 7/7, y 21/21 con `--repeat-each=3`; A02 `clinic-informes-full` 13/13 y matriz A03 195/234 en verde tras el fix |

Defectos de la propia spec corregidos en el camino (no de producto): la búsqueda con debounce de Clínicas se estabilizaba contra el request previo; el `setViewportSize` sobre una página de Informes viva dejaba huérfano un request de ventana; la página 2 de Informes admin se leía antes de pintarse.

## 5. Guards y mutaciones

- **Guard C24**, integrado como sección de `test/architecture/dashboard-b11-workspace-header.test.ts` (que ya aloja C01, C03, C04, C06 y C09): owner puro, toggle accesible sin persistencia ni I/O, `ContentGrid` fuera de `ui/table`, canvas medido compartido (conteo de `ref` igual a `HEAD`), `limit` intacto, sin owner de capacidad nuevo, sin reset de estado atado a la vista, tarjetas sin `data-dashboard-adaptive-row`, sin fetch, preview ni miniatura por tarjeta, reserva de cabecera, selección C06 y handlers compartidos, breakpoints de Fecha/Archivo/menú, descripción de una línea, no adopción de listas móviles y resumen del hub, spec y catálogo.
  - Motivo de la integración: un archivo nuevo en `test/architecture` dejaba el censo 01B en 99 (banda 78 ± 20) y el registry literal en 134 (banda 106 ± 27); dos aserciones `.length, n` lo llevaban a 624 (banda 498 ± 125). Las bandas no se ampliaron. Las aserciones se reescribieron como comparaciones exactas de arreglos.
- **C04 realineado** sin debilitar:
  - B11: `toggleColumnSort` pasa de «exactamente uno por clave» a una secuencia exacta por región: `TableHead` = `[name, createdAt]`, franja de la cuadrícula = `[name, createdAt]`, resto del archivo = `[]`. La franja deriva `ariaSort` de `appliedSort` y lleva `announceState` en ambos controles. Prueba de mutación nueva: rechaza una tercera llamada (fuera de las cabeceras y dentro de la franja), una clave equivocada en cada cabecera, la eliminación en cada cabecera, el orden invertido y la falta de franja (8 mutantes).
  - Unitario C04: cuatro anclas de mutación que dejaron de ser únicas («name → createdAt», «aria-sort ahead of the rows (icon)», «Fechas orders by updatedAt», «Fechas control stops announcing…») se anclan al control del `TableHead` por su indentación propia; los 30 mutantes siguen muertos.

## 6. Pruebas E2E

`frontend/e2e/regression/dashboard-c24-list-grid-toggle.spec.ts`, cohorte `visual-contract`, capa `mocked` (Clínicas usa el mismo stub de `GET /api/admin/clinics` que la spec C04; el fixture no sirve esa ruta, así que no hay doble declaración y E2E-GLOBAL-11 pasa sin tocar sus ledgers). Siete casos: Informes clínica (alternancia, ventana, selección, teclado, paginación sin repetidos, axe; vacío y error sin selector), Informes admin (ventana, filtros, selección de página a través del cambio, Ver con retorno de foco, paginación, axe; paridad de breakpoints a 1024), Clínicas admin (orden C04 con estado hablado y `aria-sort` al volver a la lista, búsqueda, Editar, paginación, axe) y las dos matrices de 13 viewports.

## 7. Validaciones

| Gate | Estado |
| --- | --- |
| Guard C24 (sección de B11) + unitario C24 | PASSED |
| Guards C04 realineados (B11 + unitario) | PASSED |
| Tests anclados a los owners y primitivas (41 archivos) | PASSED salvo la spec C24, que faltaba; luego cubierta |
| Catálogo E2E, censo 01B, `e2e-completeness-workflow`, E2E-GLOBAL-11 | PASSED 38/38 |
| E2E C24 | PASSED 7/7 y 21/21 (`--repeat-each=3`) |
| Regresión dirigida (Clínicas ×3, C17, core móvil admin, Informes clínica ×4, adaptive rows, pager centrado, master-detail, integridad de detalle, recuperación de página, teclado, B11, app shell sin scroll, C23a) | 294/296 con 10 workers. Los 2 FAILED se repitieron en serie ×3: 78/78 PASSED. `dashboard-adaptive-rows` falló por `net::ERR_NO_BUFFER_SPACE` (sockets, ambiental); `admin-mobile-core-modules-no-scroll` 390×844 es el flake rotativo conocido de admin-mobile |
| A02 geometría 21×13 (baseline Win32 sin cambios) | PASSED: 20/21 superficies en la corrida completa y `clinic-informes-full` 13/13 al re-ejecutarla tras el fix (antes: FAILED a 1024×768, atribuible a C24 y corregido). El cambio posterior de Informes admin sólo afecta a la cuadrícula, que no es la vista por defecto |
| A03 matriz 15×13 (fixtures sin cambios) | PASSED en una corrida completa tras el fix (antes: FAILED en `informes-reports-list::w1024x768`, misma causa) |
| A08 zero-scroll 21×13 + A05 invariancia 15×13 | PASSED 36/36 (re-ejecutado después del fix) |
| `e2e:visual-contract` | 1004/1006. Los 2 FAILED (C13 sin requests en Auditoría; C23a notificaciones en el kebab) no tocan superficies C24 y pasan aislados ×3: 90/90 |
| Frontend `lint`, `typecheck`, `build`; `security:public-surface`; raíz `typecheck`, `typecheck:test`, `build` | PASSED |
| Suite Node completa con los archivos nuevos simulados como trackeados | FAILED 5397/5399 (1 skip): sólo `e2e-global-03b-authoritative-auth-boundary`, que exige `DATABASE_URL` o `SUPABASE_DB_URL` (ambiental y preexistente) |
| `pnpm validate:local` como cadena | NOT_RUN: su suite Node falla por la precondición ambiental 03B; piezas ejecutadas por separado |
| A02/A03 Linux | NOT_RUN localmente; sólo en CI |
| `e2e:full` | NOT_RUN |

Guards realineados en el mismo cambio, sin debilitar: catálogo E2E 123 → 124 (regression 28, mocked 47, visual-contract 46, ci 93, full 124, unión CI 93, mensajes 123/125, selección compartida 93) y `e2e-completeness-workflow` 124. El censo 05A queda en 435: no se agregó ningún importador del lector canónico.

## 8. Riesgos y limitaciones

- Preferencia de vista sólo en memoria: se pierde al recargar o al navegar a otra URL de filtros en Informes clínica (filtros por URL). Persistirla exige un contrato nuevo (URL o almacenamiento) y una autorización explícita.
- La franja de orden de la cuadrícula de Clínicas no usa `aria-sort` (no hay `th`); su estado se anuncia en el nombre accesible del control.
- Documentos y miniaturas quedan fuera: requieren una colección y un endpoint que no existen.
- Linux no se ejecutó localmente; A02/A03 Linux quedan para CI.
- C23b sigue pendiente: el ledger de chrome ≤ 32 % de `dashboard-c23-responsive-integral.test.ts` no se tocó y C24 no reduce cabeceras ni filtros.
