# C23 · Responsive integral — C23a implementado, C23b auditado

## Estado base, alcance y auditoría previa

Base `c8a167331b29407cb2b60a7af193fe7dc827d4ea` (C22 integrado, #1887; `git merge-base --is-ancestor` verdadero) en `feat/dashboard-c23-responsive-integral`. Árbol tracked limpio al inicio; se preservaron los dos untracked previos (`frontend/AGENTS.md`, `frontend/CLAUDE.md`, generados por `next dev`), los cinco stashes y el único worktree. Sin `AGENTS.md` anidados tracked. No se ejecutaron escrituras Git ni GitHub.

Decisión de Nico (2026-10-18): C23 se separa en **C23a** (responsive sin geometría: navegación por banda, overlays, foco, sheets, búsqueda y filtros móviles, E2E de 13 viewports) y **C23b** (reducción de chrome a ≤ 32 % entre 768 y 1366 px), que sólo se audita y propone. No se autoriza rebaseline de A02 ni cambios de A03/A08.

Fuera de scope: backend, endpoints, AuthN/AuthZ, DB, dependencias, configuración, CSS/tokens, FSM de navegación, fixtures y baselines A02/A03/A08, C24 y C25.

## 1. Criterio contractual del 32 %

- Definición: «Chrome total antes del dato ≤ 240 px · ≤ 32 % del viewport en 768–1366» (§26), «% del alto del viewport antes de la primera fila» (§22.2), criterio de cierre de C23–C24 en §54 y §62.5.
- Método: el que A02 ya congela, `derived.chromeBeforePrimaryContentPx` = `y` del primer bloque de contenido primario (primera fila de datos cuando hay colección) y `chromeBeforePrimaryContentRatio` = ese valor / `innerHeight`. No se re-midió con otro método.
- Aplicabilidad a las cinco superficies: §62.5 declara como baseline del criterio «29.9–54.7 %», y el 54.7 % es `/dashboard/logistica/rutas` y `/visitas` (rutas completas). El universo medido en §22.2 incluye las rutas completas; el umbral **aplica** a las cinco.
- Estructural vs funcional (§46): el chrome objetivo es app bar 56 + header 40 + toolbar 48 + filtros 56 + cabecera de colección 36 = 236 px. Filtros y cabecera de colección cuentan como chrome por contrato; tira de métricas y descripción del módulo tienen destino 0 px (§26). La descomposición runtime (abajo) muestra que **ninguna** región por encima de la primera fila es un dato de la colección: todo es chrome contractual.

## 2. Las cinco superficies sobre el umbral

Procedencia: `frontend/e2e/fixtures/dashboard-geometry-baseline.ts`, schema `a02-geometry-baseline/1`, `baseCommit` `553d5c7d37058b34fdb75e717675f841b3116942`. Las cuatro rutas completas vienen de la realineación Win32 B08 (2026-08-21) y fueron re-observadas iguales en todas las pasadas posteriores; `clinic-informes` viene de la realineación CLINIC desktop/tablet (2026-10-07, PR #1829), con overlay Linux independiente (run 37586662433). Los registros Win32 y Linux dan **los mismos 17 valores** en la banda. Sonda runtime en `HEAD` (`c8a16733`, Chromium, DPR 1): valores idénticos al baseline.

| Superficie | 1366×768 | 1280×720 | 1024×768 | 834×1194 | 768×1024 | 1920×1080 (px) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `clinic-informes` (`/dashboard?module=informes`) | 31.3 | **34.9** | 31.3 | 29.0 | **33.6** | 210.7 |
| `clinic-informes-full` (`/dashboard/informes`) | **61.5** | **55.3** | **61.5** | **36.9** | **42.8** | **482.7** |
| `clinic-logistica-full` (`/dashboard/logistica`) | **39.7** | **43.8** | **39.7** | 29.2 | **33.8** | **315.3** |
| `clinic-log-rutas` | **34.8** | **38.7** | **34.8** | 23.4 | 27.1 | **278.2** |
| `clinic-log-visitas` | **34.8** | **38.7** | **34.8** | 23.4 | 27.1 | **278.2** |

17 celdas sobre 32 % en la banda y 4 superficies sobre 240 px a 1920. Las 16 superficies restantes cumplen en los 13 viewports.

**Clasificación: las 17 + 4 desviaciones son PREEXISTENTES.** Están en el baseline congelado antes de C23, la sonda en `HEAD` las reproduce y C23a no cambia ninguna (A02 21/21 PASSED sin tocar el fixture). Ninguna es introducida por C23a ni queda indeterminada. Antecedente: el gate G9 («≤ 32 % en 768–1366 (B11–B14), antes de C17») nunca cerró — B11 aplicó el header de 40 px sólo a las 15 superficies de `DashboardModuleWorkspace` (excluyó las rutas completas) y B14 (reubicar métricas) no tiene registro de implementación.

### Descomposición runtime a 1366×768 (y de la primera fila)

| Superficie | Bandas por encima de la primera fila |
| --- | --- |
| `clinic-informes-full` (472 px) | app bar 55.3 · header de tarjeta con descripción 117 · padding 16 · filtros en dos filas 111.5 · tira de métricas (Total/Mostrando/Página/Filtros) 56 · cabecera «Lista de informes» con instrucción 65 · gaps |
| `clinic-logistica-full` (304.6 px) | app bar 55.3 · header «Centro de logística» 45.5 · nota «Estado operativo» 65.5 · header de tarjeta «Visitas de campo» 80 · gaps |
| `clinic-log-rutas` / `-visitas` (267.6 px) | app bar 55.3 · header de tarjeta (título, «Mostrando…», «Conteos calculados…») 120 · tira de conteos 29 · cabecera de tabla 44 |
| `clinic-informes` (240.1 px; 250.9 a 1280×720) | app bar 55.3 (68.1 a 1280×720) · toolbar de filtros y acciones 113.5 · cabecera de tabla 44 |

Hallazgo transversal preexistente: a 1280×720 el app bar mide **68.11 px** en las 21 superficies (Win32 y Linux), fuera del contrato B06 de 56 ±2 px; el catálogo E2E ya lo nombra como «win32 topbar-height drift» documentado. B06 midió que cualquier cambio de esa banda (> 0.016 px) mueve `limit` de A03, así que no se corrige aquí.

## 3. Matriz de los 13 viewports canónicos

Fuente: `DASHBOARD_GEOMETRY_VIEWPORTS` (A02). No se usaron viewports exploratorios fuera de esa lista; el spec C23a usa 1024×768 y 390×844, ambos canónicos.

| Viewport | Navegación | Ancho de `main` | Chrome % (21 sup.) | Scroll | Filtros | Detalle | Foco / Escape / overlays |
| --- | --- | ---: | ---: | --- | --- | --- | --- |
| 1920×1080 | drawer 256 | 1665 | 6.4–44.7 | documento, body y `main` 0 px; sólo canvas contratados (A08) | banda de toolbar inline (S1–S7) | `UtilitySidePanel` 336 en columna / `ModuleDialog` | búsqueda global combobox (Escape cierra lista, foco queda) |
| 1600×900 | drawer 256 | 1345 | 7.6–53.4 | idem | inline | columna 336 | idem |
| 1440×900 | drawer 256 | 1185 | 7.6–53.4 | idem | inline | columna 336 | idem |
| 1366×768 | drawer 256 | 1111 | 8.3–61.5 | idem | inline | columna 336 | idem |
| 1280×720 | drawer 256 | 1025 | 10.5–55.3 | idem | inline | columna 336 | idem |
| 1024×768 | rail 80 | 945 | 8.3–61.5 | idem | inline | overlay 336 sin reducir la colección | idem |
| 834×1194 | rail 80 | 755 | 5.9–36.9 | idem | inline | overlay 336 | idem |
| 768×1024 | rail 80 | 689 | 6.7–42.8 | idem | inline | overlay 336 | idem |
| 430×932 | barra inferior | 430 | 5.9–33.3 | idem | toolbar compacta + `AdvancedFilterSheet` (Radix, foco atrapado y devuelto) donde existe | ancho completo / `ModuleDialog` | kebab y «Más»: Escape devuelve foco, clic fuera cierra, exclusivos, cierran al salir del régimen |
| 412×915 | barra inferior | 412 | 6.0–34.0 | idem | idem | idem | idem |
| 390×844 | barra inferior | 390 | 6.5–36.8 | idem | idem | idem | idem |
| 375×812 | barra inferior | 375 | 6.8–38.2 | idem | idem | idem | idem |
| 360×800 | barra inferior | 360 | 6.9–38.8 | idem | idem | idem | idem |

Bajo 768 px el umbral del 32 % no aplica; la tabla registra el valor sin juzgarlo.

## 4. C23a — implementado

### Defectos reproducidos en `HEAD` (sonda RED)

1. Escape dentro de la hoja «Más» (destinos admin) → foco en `<body>`.
2. «Cerrar menú de módulos» → foco en `<body>`.
3. Escape dentro del kebab de acciones (admin y clínica) → foco en `<body>`.
4. Kebab y «Más» abiertos a la vez (por teclado o puntero): dos overlays sobre `main`.
5. El kebab no se cerraba con un clic fuera.
6. Abrir «Más», pasar a ≥ 768 px y volver: la hoja reaparecía abierta (`aria-expanded` seguía en `true`).

### Cambio

- `useMobileOverlayDismissal` (nuevo, `components/dashboard/`, sólo importa `react`): al abrir publica un evento y cierra el otro overlay; cierra con un `pointerdown` capturado fuera del disparador y del panel sin mover el foco (la política de los menús C08); cierra al salir del régimen `(max-width: 767px)`.
- `DashboardMobileNav`: refs del disparador «Más» y de la hoja; Escape y «Cerrar» pasan por `dismissOverflow`, que devuelve el foco a «Más»; elegir un destino sigue cerrando sin robar el foco (navegación). Se conservan las cadenas que ancla el guard B09 (`Escape`, `aria-expanded={overflowOpen}`, etc.).
- `DashboardMobileKebabMenu`: refs del disparador y del menú; Escape devuelve el foco al disparador.

Sin cambios de CSS, tokens, DOM visible, `data-*`, rutas, endpoints ni permisos: los overlays cerrados no participan de la geometría, por eso A02/A03/A08 no cambian.

### Primitivas reutilizadas

`NavigationDrawer`/`NavigationRail` (B07/B08), `DashboardMobileNav` (B09), `WorkspaceAppBar` (B06), `AdvancedFilterSheet` (C12, ya adoptado en Auditoría e Informes admin), `UtilitySidePanel`/`DetailsPane` (B16/C13), `ModuleDialog` (Radix). Ninguna se modificó salvo los dos owners de overlays móviles.

### Pruebas

- `test/architecture/dashboard-c23-responsive-integral.test.ts`: contrato de overlays (11 mutaciones rechazadas), presencia del spec en el catálogo con la matriz canónica importada, y el **ledger C23b**: las celdas sobre presupuesto del baseline A02 (ambas plataformas) son exactamente las 17 + 4 declaradas, con sus valores. Sólo puede encogerse vía C23b.
- `frontend/e2e/regression/dashboard-c23-responsive-integral.spec.ts` (cohorte `visual-contract`, capa `fixture`, 10 casos): por rol, los 13 viewports con un solo dueño de navegación por banda (drawer 256 ±1, rail 80 ±1, barra inferior debajo de `main` con slots ≥ 44 px), un único `aria-current` dentro del catálogo del rol, búsqueda global sólo desde 768 px y kebab sólo debajo, sin overlay abierto y sin scroll de documento; búsqueda acotada al rol y operable por teclado; los cinco comportamientos de overlay; sheet de filtros de Auditoría con Escape y foco devuelto; sin sesión, las tres bandas redirigen a login.

### RED → GREEN

| Prueba | `HEAD` (owners restaurados por copia, sha1 verificado) | C23a |
| --- | --- | --- |
| Guard C23 | 2/4 FAILED (10 violaciones del contrato nuevo); ledger y catálogo pasan | 4/4 PASSED |
| E2E C23a | 5/10 FAILED: exactamente los cinco casos de overlay; bandas, búsqueda, sheet de filtros y frontera de rol pasan en ambos lados (invariantes preexistentes) | 10/10 PASSED |

### Corrección P1 de la revisión de PR #1888 (thread `PRRT_kwDOR5qlsc6tr-Oa`)

Causa: el kebab aloja `DashboardNotificationsBell`, cuyo diálogo móvil se porta a `document.body`. El primer `useMobileOverlayDismissal` decidía «fuera» con `contains` del DOM en un `pointerdown` capturado en `document`: toda presión dentro del diálogo era externa, el kebab se cerraba y desmontaba la campana antes del `click`. Reproducido en navegador sobre `78bdfa4d`: tras pulsar «Actualizar», diálogo y kebab desaparecen y no sale ningún GET a `/api/admin/study-tracking/notifications`.

Alternativas: (A) tratar el portal como parte del límite lógico; (B) mantener montada la campana fuera del kebab mientras su diálogo esté abierto. Se adoptó A con el árbol React como límite: el owner marca con `onPointerDown` su disparador y su panel, React propaga ese evento a través de los portales, y el hook decide en `window` (burbuja, después del dispatch de React) cerrando sólo ante presiones no marcadas. B reestructuraba el kebab (anclas CMP-01) y dejaba un diálogo vivo sin el owner que restaura el foco. Sin selectores, timers ni supresión de eventos; el cierre exterior auténtico, Escape, la exclusividad, el régimen y la devolución de foco quedan iguales.

RED → GREEN: el spec C23a (13 casos, tres nuevos de Notificaciones) falla sólo en el caso P1 sobre los tres archivos de `78bdfa4d` (sha1 restaurado) y pasa 39/39 con `--repeat-each=3` tras el fix; el guard C23 (16 mutaciones) falla 2/4 con 13 violaciones sobre `78bdfa4d` y pasa 4/4. El fixture sirve una lista vacía y E2E-GLOBAL-11 prohíbe stubear ese GET, así que ítems, paginación y «Marcar todo como leído» se verifican en su estado real (vacío, sin paginación, deshabilitado), no con datos inventados.

## 5. Validaciones

| Gate | Estado |
| --- | --- |
| Guard C23 | PASSED 4/4 |
| Suite Node completa con los 3 archivos nuevos simulados como trackeados | FAILED 5383/5386 (1 skip): sólo `e2e-global-03b-authoritative-auth-boundary` (exige `DATABASE_URL`, ambiental y preexistente) |
| Frontend `lint`, `typecheck`, `build`; `security:public-surface`; raíz `typecheck`, `typecheck:test`, `build` | PASSED |
| `pnpm validate:local` como cadena | NOT_RUN: su suite Node falla por la precondición ambiental 03B; piezas ejecutadas por separado |
| E2E C23a | PASSED 10/10 |
| A02 21×13 (baseline Win32 sin cambios) | PASSED 21/21 |
| A08 zero-scroll 21×13 | PASSED 21/21 |
| A03 límite adaptativo + A05 invariancia 32/48/64 (fixtures sin cambios) | PASSED 31/31 |
| Regresión dirigida de los owners tocados: B06, B08, B09, C12, contrato de nav móvil, sync de navegación global, tres specs de shell admin móvil | 176/178 PASSED con 2 workers. Los 2 FAILED son la búsqueda global de B06 entrando por `?hub=1`: la URL termina en `?module=admin` porque el `replace` de B13 (hub → Resumen) pisa la navegación. Preexistente: A/B con repeat ×3 en serie, `HEAD` falla 2/6 y C23a 1/6 (más 1/2 y 2/2 en las corridas sueltas), siempre en el mismo punto, a 1366×768 donde los overlays C23a no existen. No atribuible a C23a |
| A02 Linux | NOT_RUN localmente: sólo `e2e-full-completeness` en CI |
| `e2e:full` | NOT_RUN |

Guards realineados en el mismo cambio, sin debilitar: catálogo E2E 122 → 123 (regression 27, fixture 77, visual-contract 45, ci 92, full 123, unión CI 92, mensajes 122/124), `e2e-completeness-workflow` 123 y censo 05A de importadores del lector canónico 434 → 435.

## 6. C23b — auditoría y propuesta (sin implementación)

### Criterio de aceptación de C23b

1. Las 17 celdas del ledger bajan a ≤ 32 % en 768–1366 y las 4 de 1920 a ≤ 240 px, medidas por A02 en Win32 y Linux.
2. A02 re-capturado sólo para las superficies tocadas y sólo en ≥ 768 px, con overlay Linux real; cero cambios en las otras.
3. A03: los `limit` que cambien se re-basan con autorización explícita (R13), con antes/después por consumidor, variante y viewport; A05 (invariancia 32/48/64) sigue verde.
4. A08 y C23a verdes; móvil (< 768 px) sin cambios; axe sin violaciones serias; operativa de S1–S7 idéntica (A01).
5. El ledger del guard C23 se vacía en el mismo PR.

### Alternativas

| Alternativa | Qué cambia | Reducción estimada (1366×768) | Cumple | Impacto en `limit` (A03) | Costo |
| --- | --- | --- | --- | --- | --- |
| **B1 · Extender B11/B14 a las rutas completas** (recomendada) | header de tarjeta → `WorkspaceHeader` 40 px con descripción fuera del flujo (accesible, no `title`); tira de métricas/conteos → toolbar o pager; nota informativa de Logística → disclosure | informes-full −77 −56 · rutas/visitas −80 −29 · logística −40 −65.5 | rutas, visitas y logística sí; informes-full ≈ 33 % (requiere B2) | sube en `logistics-bounded-canvas` (3 variantes) y `logistics-recent-list`; informes-full sube | medio: 4 superficies, 32 registros A02 por plataforma |
| **B2 · Filtros progresivos en Informes clínica** | toolbar/filtros de dos filas → `SuperSearchField` 40 + `FilterChip`/overflow (C10/C11) + `AdvancedFilterSheet` | informes-full −55; clinic-informes −57 (resuelve 1280×720 y 768×1024) | sí, combinado con B1 | sube en `clinic-informes` y `clinic-informes-full` | alto: S-protegido (§7.8); exige A01 idéntico |
| **B3 · Corrección del app bar a 1280×720** | 68.1 → 56 px | −12 px en las 21 superficies a 1280×720 | no alcanza solo | cambia en los 15 consumidores a 1280×720 (B06: holgura 0.016 px) | alto en A03; correctivo separado |
| **B4 · Cabecera de lista de Informes a 36 px** | «Lista de informes» + instrucción → `CollectionHeader` 36 | −29 | complemento | sube | bajo |
| Redefinir la métrica (excluir filtros/cabecera) | — | — | — | — | **rechazada**: §46 los incluye; sería reinterpretar el contrato |
| Excepción documental para rutas completas | — | — | — | — | **no recomendada**: §62.5 incluye su baseline; exige enmienda del roadmap por Nico |

Orden propuesto: B1 (rutas de Logística) → B1+B4 (Informes ruta completa) → B2 (Informes, con A01) → B3 como correctivo aparte. Cada paso es un PR con su propio rebaseline autorizado.

### Impacto transversal

- **Capacidad de filas**: el canvas crece en la misma medida que baja el chrome; con pitch 37–45 px, −80 px suman ~2 filas a 1366×768. Es una mejora de producto, pero rompe la igualdad exacta de A03, que hoy es el contrato.
- **Paginación**: el `limit` de las rutas de Logística viaja por URL; un `limit` mayor cambia `offset` y enlaces compartidos ya emitidos siguen siendo válidos (sólo cambia el tamaño de página).
- **Responsive**: limitar los cambios a ≥ 768 px deja intactos los 105 registros de teléfono.
- **Accesibilidad**: la descripción que sale del flujo debe quedar en `aria-describedby` o en un disclosure, nunca sólo en `title`; los conteos movidos a la toolbar necesitan región `status` si cambian.
- **Migración**: ~4–6 PR; cada uno con A02 Win32 + overlay Linux vía E2E Completeness y re-baseline A03 de 2–4 consumidores × 8 viewports.

## Riesgo residual

- A02 Linux no se mide localmente; C23a no cambia geometría y Win32 quedó igual.
- `pointerdown` capturado cierra el kebab ante cualquier presión fuera de él, también sobre controles de `main`: es el comportamiento de los menús C08, y la presión sigue llegando a su destino.
- Las dos superficies siguen siendo disclosures no modales (sin focus trap), como las definió B09; el foco devuelto cubre la salida.

Estado final: C23a implementado localmente, sin staging, commit, push ni PR. C23b: auditoría y propuesta, sin implementación.
