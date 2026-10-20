# C23b · PR3 — Informes ruta completa (B1 + B4)

## Estado base, autorización y alcance

- Rama `feat/dashboard-c23b-pr3-informes-full`, base `f43d10f69192f53c1d5f00340e65e42ac5cd4a9d` (C23b PR2, #1894), igual a `main` (0/0). Árbol tracked limpio al inicio. Se preservaron `frontend/AGENTS.md` y `frontend/CLAUDE.md` (generados por `next dev`; **quedaron comiteados en el WIP**, ver «Continuación»), cero stashes y los worktrees `PORTAL-VETNEB-C17` y `PORTAL-VETNEB-D10`. Sin `AGENTS.md` anidados tracked. Sin escrituras Git ni GitHub.
- Autorización: implementación local y validación. **Sin R13 para PR3** (la de PR2 no se extiende): A02, A03 y el ledger C23b no se modificaron.
- Incluido: `clinic-informes-full` (`/dashboard/informes`) desde 768 px; B1 (header de tarjeta y tira de resumen) y B4 (cabecera «Lista de informes» con datos).
- Excluido: B2 (filtros progresivos), B3 (app bar 68.11 px a 1280×720), `clinic-informes` (módulo), Logística, C25, motor de capacidad, `limit`/`offset`/reservas, fixtures A02/A03/A05/A08, backend, auth, datos, dependencias y CI. Cabecera de los estados vacío/error de la lista: sin cambios (A02 mide el estado poblado; ver riesgos).

## Auditoría causal (HEAD, Win32, Chromium, `next dev`, DPR 1)

Primer dato según A02: primera fila de `[data-informes-rows-canvas]`, ancla `collection::scope > *`. La sonda temporal (fuera del catálogo, ya eliminada) reprodujo los 13 registros A02 congelados.

Descomposición a 1366×768 (chrome 472.08 px):

| Banda | Owner | y | Alto |
| --- | --- | ---: | ---: |
| App bar | `WorkspaceAppBar` (shell) | 0 | 55.33 |
| Padding de `main` + borde de tarjeta | shell, `ModuleCard` | 55.33 | 18.25 |
| Header «Informes disponibles» (título, descripción, `ModuleMetricRun`) | `page.tsx` `CardHeader` p-6 | 73.58 | **117** |
| Gap (`pt-4`) | `CardContent` | — | 16 |
| Filtros (dos filas desde `lg`: «Más filtros» + campos inline empujan Filtrar/Limpiar a una segunda fila) | `FilterBar` | 206.58 | 111.5 |
| Gap | `gap-4` | — | 16 |
| Tira Total / Mostrando / Página / Filtros | `InformesReportsList` | 334.08 | **56** |
| Gap | `gap-4` | — | 16 |
| Cabecera «Lista de informes» + instrucción + toggle C24 | `InformesReportsList` | 407.08 | **65** |
| Primera fila | `CanonicalOperationalRow` | 472.08 | 44 |

A 1280×720 la regla `max-height: 760px` ya compacta el header (61 px) y la cabecera de lista (62 px). Capacidad: `useDashboardCanvasCapacity` sobre el canvas de filas (pitch 44, 40 con `max-height: 760px`, tope 24): todo píxel que deja el chrome lo recibe el canvas, por lo que **cualquier** reducción por encima de la primera fila cambia `limit` (no existe una variante tipo vE de PR2: aquí no hay bloque que pueda pasar debajo de la colección).

Presupuesto: 1366/1024 ≤ 245.76 px (déficit 226.32), 1280 ≤ 230.40 (167.41), 834 ≤ 382.08 (58.25), 768 ≤ 327.68 (110.27), 1920 ≤ 240 (242.73).

## Alternativas evaluadas

| Alternativa | Decisión |
| --- | --- |
| `CollectionHeader` como owner de «Lista de informes» | **No aplicable** con su contrato actual: es un `<thead>` (`HTMLTableSectionElement`) y la lista es un `ContentList as="div"`; usarlo produce HTML inválido. Se reutiliza su token geométrico `--dash-collection-header-h` (36 px, ledger C01) |
| `WorkspaceHeader` / clase `.dashboard-workspace-header` (B11) | No usada: la regla clínica de reclaim la oculta dentro del workspace (igual que PR1/PR2); se reutiliza el token `--dash-workspace-header-h` (40 px) |
| Tira de resumen `md:hidden` | Descartada: saca Mostrando/Filtros también del árbol accesible |
| Tira de resumen al pie / dentro del pager | Descartada: el pager centrado ya anuncia rango y total (`rangeLabel`, CMP-09 `sr-only` + `aria-live`) y pinta «Pág. X / Y»; duplicar en el pager cambia su reserva (A05) |
| Mover el estado de filtros a la cabecera de lista | Descartada: añade contenido a la fila de 36 px y toca la frontera de B2 |
| Compactar filtros, gaps o padding de tarjeta | Fuera de alcance (B2 y reglas de densidad); no se usan para «cerrar» el presupuesto |

## Cambios (sólo clases `md:`; < 768 px DOM y CSS efectivos idénticos)

| Nodo | Antes | Después |
| --- | --- | --- |
| `CardHeader` (`page.tsx`) | `shrink-0 border-b …` (p-6, columna: 117 px) | `+ md:h-[var(--dash-workspace-header-h)] md:justify-center md:space-y-0 md:px-4 md:py-0` (40 px, token B11) |
| Contenedor título/descripción/run | `min-w-0` | `min-w-0 md:flex md:items-baseline md:gap-3` |
| «Seleccione un informe…» (`data-dashboard-chrome-secondary`) | visible ≥ 768 (ya oculto < 768 y con `max-height: 760px`) | `md:sr-only`: en el árbol accesible; la instrucción equivalente sigue pintada en la cabecera de lista |
| `ModuleMetricRun` `clinic-informes-full` (B14) | `mt-1 …` (segunda línea) | `+ md:mt-0` (en la fila del título; texto visible: Total resultados · En proceso · Disponibles) |
| Tira Total / Mostrando / Página / Filtros | `hidden … sm:grid sm:grid-cols-4 xl:min-w-[34rem]` | `hidden … sm:grid sm:grid-cols-4 md:sr-only` (fuera del flujo desde 768, legible por tecnología asistiva; `xl:min-w` quedaba inerte y se retiró) |
| Cabecera «Lista de informes» (estado con datos) | `… items-start … py-2.5` (2 líneas: 65 px) | `+ md:h-[var(--dash-collection-header-h)] md:items-center md:py-0` (36 px); heading `md:shrink-0`; instrucción en la misma fila, `truncate` + `title` (contrato C24) `md:mt-0 md:min-w-0` |

Información desde 768 px: Total → `ModuleMetricRun` (visible) y `rangeLabel` del pager; Página → pager (visible); Mostrando → `rangeLabel` (`sr-only`, `aria-live`) y tira `sr-only`; Filtros → controles inline con sus valores desde `lg`, variante del botón «Más filtros» entre 768 y 1023 y tira `sr-only`. **Trade-off declarado:** «Mostrando N–M» y «Filtros activos/Sin filtros» dejan de estar pintados como texto desde 768 px.

## Medición A02 (Win32, `derived.*`, definición sin cambios)

| Viewport | Antes | Después | Límite | Cumple | Déficit restante |
| --- | ---: | ---: | ---: | :---: | ---: |
| 1920×1080 | 482.73 px | 304.73 px | ≤ 240 px | ✗ | 64.73 px |
| 1600×900 | 480.20 (53.36 %) | 302.20 (33.58 %) | — | — | — |
| 1440×900 | 480.20 (53.36 %) | 302.20 (33.58 %) | — | — | — |
| 1366×768 | 472.08 (61.47 %) | 294.08 (38.29 %) | ≤ 32 % | ✗ | 48.32 px · 6.29 pp |
| 1280×720 | 397.81 (55.25 %) | 287.02 (39.86 %) | ≤ 32 % | ✗ | 56.62 px · 7.86 pp |
| 1024×768 | 472.08 (61.47 %) | 294.08 (38.29 %) | ≤ 32 % | ✗ | 48.32 px · 6.29 pp |
| 834×1194 | 440.33 (36.88 %) | 262.33 (21.97 %) | ≤ 32 % | ✓ | margen 119.75 px |
| 768×1024 | 437.95 (42.77 %) | 259.95 (25.39 %) | ≤ 32 % | ✓ | margen 67.73 px |
| 5 teléfonos | 310.77 · 310.67 · 310.56 · 310.48 · 310.41 | idéntico (0 campos) | — | — | — |

Alturas después (≥ 768): header 40.00 px, tira 1 × 1 px fuera del flujo, cabecera de lista 36.00 px; scroll de documento 0/0 en los 13 viewports.

Spec A02 sobre el árbol PR3: **FAILED 20/21** — sólo `clinic-informes-full`, 62 campos fuera de tolerancia, todos en los 8 viewports ≥ 768 (`regions.filters.y`, `regions.collection.y`, `regions.collection.height`, `regions.primaryContent.y`, `regions.sidePanel.y` (6 viewports ≥ 1024), `derived.chromeBeforePrimaryContentPx`, `derived.chromeBeforePrimaryContentRatio`, `derived.collectionCanvasHeight`). Teléfonos y las otras 20 superficies, sin drift. Es el drift esperado del cambio, no una regresión; no se re-capturó.

## A03 — impacto medido

Spec A03 serial sobre el árbol PR3 (`.next` en frío): 15/16 casos PASSED; **FAILED** la integridad de matriz. Diff de las 234 observaciones Win32 contra el baseline: **8 hojas** distintas, todas `informes-reports-list` en los 8 viewports ≥ 768; las otras 226 (los 14 consumidores restantes y los 5 teléfonos de Informes) idénticas. `source` = `server-request` sin cambio; `limit` = `offset` (página 2) = `secondPageCount`.

| Viewport | limit/offset/2ª página antes | después (medido) |
| --- | ---: | ---: |
| 1920×1080 | 11/11/11 | 15/15/15 |
| 1600×900 | 7/7/7 | 12/12/12 |
| 1440×900 | 8/8/8 | 12/12/12 |
| 1366×768 | 5/5/5 | 9/9/9 |
| 1280×720 | 6/6/6 | 9/9/9 |
| 1024×768 | 5/5/5 | 9/9/9 |
| 834×1194 | 14/14/14 | 18/18/18 |
| 768×1024 | 10/10/10 | 14/14/14 |

Causa: el canvas de filas crece exactamente lo que baja el chrome (+178 px; +110.8 a 1280×720) y `useDashboardCanvasCapacity` lo convierte en filas con el pitch de layout. No se tocó `limit`, `offset`, reservas, pitch ni el tope (24). `dashboard-adaptive-limit-baseline.ts` byte-idéntico a HEAD.

Acoplamiento adicional detectado: `frontend/e2e/clinic/reports/clinic-reports-workspace-1000.spec.ts` fija prefijos de IDs conocidos (`DELIVERED_IDS` = 6, `COMBINED_IDS` = 12) y falla a propósito cuando el tamaño de página los supera («known id prefix (6) must cover page 1 at page size 9»; «(12) … page 2 at page size 9»). Es consecuencia directa del mismo cambio de `limit` y queda dentro de la solicitud R13; no se modificó.

## Dependencia de B2 (no implementado)

B1 + B4 no alcanzan el presupuesto en 1366×768, 1024×768, 1280×720 ni 1920×1080. El residuo coincide con la banda de filtros: desde `lg` el `FilterBar` renderiza «Más filtros» **y** los campos inline, de modo que Filtrar/Limpiar caen a una segunda fila (111.5 px frente a 67.5 px entre 768 y 1023). Estimaciones (no medidas, sólo aritmética sobre la medición):

| Variante B2 | 1366/1024 | 1280 | 1920 |
| --- | ---: | ---: | ---: |
| Filtros en una fila (−44 px) | 250.08 px · 32.56 % ✗ (−4.32) | 243.02 · 33.75 % ✗ | 260.73 ✗ |
| `FilterRegion` 56 px (−55.5 px) | 238.58 · 31.07 % ✓ | 231.52 · 32.16 % ✗ (−1.12) | 249.23 ✗ |
| 56 px + B3 (app bar −12.11 px sólo a 1280) | ✓ | 219.41 · 30.47 % ✓ | ✗ |

1920×1080 necesita además ≈ 9–21 px adicionales (padding de `main` 10.65 px mayor que a 1366). B2 es S-protegido (§7.8) y exige A01 idéntico; cada px que libere vuelve a mover `limit` (A03) y la altura del canvas (A02). Todo requiere su propia autorización.

### Auditoría B2 (sobre `c1855757`, 2026-10-19; sin implementación)

**Causa de la segunda fila.** `FilterBar` (`module-card`) usa `lg:grid-cols-[1.4fr_0.8fr_1fr_auto]`, que son 4 columnas. Desde `lg` recibe 5 ítems: Buscar, el disparador «Más filtros» (`Dialog.Trigger asChild`: el `Button` es el ítem de grilla) y, por `hidden lg:contents`, Estado, Tipo y acciones. Filtrar/Limpiar caen a una segunda fila (+44 px = control 36 + `gap-2`). Además, el disparador duplica un tab stop junto a los mismos campos inline. Entre 768 y 1023 la banda mide 67.5 px y 768/834 ya cumplen.

**Reducción necesaria después de B1+B4:** 1366/1024 −48.32 · 1280 −56.62 · 1920 −64.73 (≤ 240 px). 768/834/1440/1600: 0 (fuera de banda o cumplen).

| Alternativa (estimada sobre bandas medidas) | Δ filtros ≥ `lg` | 1366/1024 | 1280 | 1920 | Riesgo funcional / A01 | A03 |
| --- | ---: | --- | --- | --- | --- | --- |
| A · disparador `lg:hidden` | −44 | 250.08 · 32.56 % ✗ | 243.02 · 33.75 % ✗ | 260.73 ✗ | Nulo (diálogo intacto < `lg`) | 6 hojas ≥ 1024 |
| **B · A + labels inline desde `lg`** (visibles, a la izquierda del control, vía `className` de `FilterBar`) | −66.5 | 227.58 · 29.63 % ✓ (18.18) | 220.52 · 30.63 % ✓ (9.88) | 238.23 ✓ (1.77, frágil) | Bajo: sin handler, nombres, GET, submit ni Limpiar | 6 hojas ≥ 1024 |
| C · A + labels `sr-only` desde `lg` (precedente C17 `labelHidden`) | −66.5 | igual que B | igual que B | igual que B | Bajo; peor que B en 3.3.2 (el select queda sin label visible) | 6 hojas |
| D · B2 del roadmap: `SuperSearchField` + `ActiveFilterChips` + `AdvancedFilterSheet` (banda ≈ 56) | −55.5 | 238.58 · 31.07 % ✓ (7.18) | 231.52 · 32.16 % ✗ (−1.12, exige B3) | 249.23 ✗ | Alto: el GET de servidor pasa a una isla cliente controlada; quitar un chip es una navegación nueva (§7.8); reemplazar `ModuleDialog` toca el censo B05 | 6 hojas |
| E · B + ritmo `pt-4/gap-4` → 8 | −82.5 | ✓ | ✓ | ✓ (17.77) | Densidad, fuera de B2 | 6 hojas |

**Recomendación: B como PR4 independiente.** Es el único camino que cierra 1366/1024/1280 sin B3 y deja 768/834 y los teléfonos sin drift. Usa sólo clases (`lg:hidden` en el `Button` disparador; `lg:[&_label]:grid-cols-[auto_minmax(0,1fr)] lg:[&_label]:items-center` en `FilterBar`), así que no toca `FilterField`, cuya firma ancla `frontend-dashboard-informes.test.ts:176`. A01 queda idéntico: `query`/`status`/`studyType`, `<FilterBar method="get" role="search">` (C21), Filtrar `type="submit"`, Limpiar `PublicRouteControl replace`, y el formulario del diálogo < `lg` sin cambios. 1920 queda con 1.77 px estimados: el primer gate de PR4 es medirlo con una sonda fuera del censo (`frontend/.c23b-probe/`, sin commitear). Si queda < 1 px, 1920 permanece en el ledger o requiere E aparte. La desviación respecto de la definición B2 del registro C23 (D) es decisión de Nico.

**Contratos.** A02: `clinic-informes-full` en los 6 viewports ≥ 1024 (`regions.filters.height`, `regions.collection.y`/`height`, `regions.primaryContent.y`, `regions.sidePanel.y`, `derived.*`; `regions.filters.y` sin cambios). A03: `informes-reports-list` en 6 hojas ≥ 1024 (+1/+2 filas, sin medir). A05: reserva del pager sin cambios. A08 y zero-scroll: se re-validan. Accesibilidad: labels `<label>` envolventes y visibles, un tab stop menos ≥ `lg`, y axe/teclado (`dashboard-accessibility-keyboard`) re-ejecutados. S-protegidos: la ruta completa no figura en S1–S7, pero §7.8 rige igual para su operativa. `clinic-informes` (S6, −57) queda fuera: es otra superficie y otro owner (`ClinicInformesWorkspaceSummary`), y va en su propio PR.

**Separación de scopes (§4).** B1+B4 (causa: chrome de tarjeta) y B2 (causa: grilla de filtros) son dos causas con rollbacks independientes, y PR3 se puede publicar sola con su R13 (ledger 7 → 5 celdas). No aplica la excepción mixed-scope: hacer una sola recaptura es conveniencia. Secuencia: PR3 (R13 en 8 viewports) → merge → PR4 B (R13 en 6 viewports, sobre el baseline de PR3).

## Continuación sobre el WIP `348d4c61` (2026-10-19)

**Corrección del estado base.** El commit WIP contiene tres archivos que este documento declaraba fuera del árbol: `frontend/AGENTS.md` y `frontend/CLAUDE.md` (bloque que genera `next dev`; tracked desde este commit, pasan a ser un `AGENTS.md` anidado con precedencia sobre el raíz) y la sonda `frontend/e2e/regression/zz-c23b-pr3-variants.spec.ts` (variante V5, que prueba CSS de B2 sobre `FilterBar`). Los tres quedan fuera del scope de PR3 y hay que retirarlos antes de publicar. Los JSON de la sonda no se conservaron: las mediciones válidas son las de este documento. Corrección local: la sonda se borró del árbol de trabajo (blob `0d1962a2` respaldado fuera del repositorio). `frontend/AGENTS.md` (`af3b7c84`) y `frontend/CLAUDE.md` (`43c994c2`) siguen en disco y salen del índice con `git rm --cached` [MANUAL-NICO], así que vuelven a quedar sin seguimiento. Con eso el catálogo queda en 124 y los guards de censo y C23b están PASSED 76/76.

**Guards sobre HEAD.** Guard C23 (PR1, PR2, PR3, ledger Win32/Linux) y B11/C24: PASSED. `e2e-completeness-workflow`: PASSED (el catálogo sigue en 124). `e2e-suite-catalog-completeness`: **FAILED 3** (`workspaceSpecs` 125 ≠ 124, más los dos casos en memoria que dependen de esa cuenta). Es una regresión real que introduce la sonda comiteada, no drift esperado de baseline: se resuelve retirando el archivo, sin tocar el censo. A02 (62 campos) y A03 (8 hojas) son el drift esperado del cambio; `clinic-reports-workspace-1000` (2) es el acoplamiento esperado al `limit`.

**Composición del chrome a 1366×768 después de B1+B4** (294.08 px = 38.29 %; presupuesto 245.76; déficit 48.32):

| Banda | Owner | Alto | % de 768 | Movible en B1+B4 |
| --- | --- | ---: | ---: | --- |
| App bar | shell (B3) | 55.33 | 7.20 | No |
| Padding de `main` + borde de tarjeta | shell / densidad | 18.25 | 2.38 | No |
| Header de tarjeta + `border-b` | B1 (token B11 40) | 41.00 | 5.34 | Sólo eliminándolo |
| `pt-4` de `CardContent` | densidad | 16.00 | 2.08 | No |
| `FilterBar` (dos filas desde `lg`) | B2 | 111.50 | 14.52 | No |
| `gap-4` | densidad | 16.00 | 2.08 | No |
| Cabecera «Lista de informes» | B4 (token C01 36) | 36.00 | 4.69 | No (aloja heading + toggle C24) |

B1+B4 ya están en sus tokens. El 14.52 % de filtros es la mayor banda y pertenece a B2.

**Techo de B1+B4 (aritmética sobre la medición, no medido).** La única reducción adicional dentro de B1+B4 es suprimir el header de tarjeta desde `md` y mover su contenido a la cabecera de lista: −41 px (`pt-4` se queda, porque es una regla de densidad). Resultado: 1366/1024 253.08 px (32.95 %, ✗ −7.32), 1280 246.02 px (34.17 %, ✗ −15.62) y 1920 263.73 px (✗ > 240). Costos: el título visible «Informes disponibles» desaparece (queda el de la app bar «Informes»), la jerarquía de headings cambia, el `ModuleMetricRun` B14 se reubica y, a 1024, la instrucción C24 ya truncada a ~113 px se queda sin espacio. Además, el canvas crece +41 y vuelve a mover `limit` en las mismas 8 hojas A03. Incluso sumando `pt-4 → 0` (densidad, fuera de scope; −57) quedan 1366/1024 ✓ (margen 8.68), 1280 con 0.38 px (frágil, como vB de PR2) y 1920 ✗. **Conclusión: con B1+B4 no se llega a ≤ 32 % en la banda ni a ≤ 240 px a 1920; B2 es condición necesaria.**

## Tests

- `test/architecture/dashboard-c23-responsive-integral.test.ts`: contrato de fuente B1 + B4 (clases exactas `md:`, descripción `md:sr-only`, run B14 inline, tira `md:sr-only` con sus cuatro etiquetas, `rangeLabel` del pager, cabecera de lista a `--dash-collection-header-h`, instrucción pintada, sin `<CollectionHeader>` en la lista, sin clase B11) con 10 mutaciones rechazadas. **Ledger C23b sin cambios** (lee el baseline A02 congelado, que no se tocó).
- `test/architecture/dashboard-b11-workspace-header.test.ts` (C24): el literal de clase de la instrucción se realinea a `dashboard-section-description truncate md:mt-0 md:min-w-0`; se mantiene exigido `truncate`, el `title` y el texto completo (una línea).
- Prueba causal: con `page.tsx` e `InformesReportsList.tsx` de `HEAD` (restaurados por copia), el guard PR3 FAILED 2/10 con 6 violaciones (header, fila, descripción, run, tira, cabecera de lista); restaurados (SHA-256 verificado), PASSED 10/10.

## Validaciones (Win32; una tarea pesada por vez; `frontend/.next` borrado antes de cada corrida E2E)

| Gate | Estado |
| --- | --- |
| Guard C23 (overlays, D-A, vE, B1+B4, ledger Win32/Linux) | PASSED 10/10 |
| Guards que anclan los dos owners (B08, B09, B10, B11/C24, B14, C21, capacidad, truncado, unitarios de dashboard y frontend) | PASSED 980/980 tras realinear C24 (antes: 1 FAILED, el literal C24) |
| `pnpm test` (suite Node completa) | FAILED 5407/5409 (1 skip): sólo `e2e-global-03b-authoritative-auth-boundary`, que exige `DATABASE_URL` (ambiental y preexistente) |
| Frontend `lint`, `typecheck`, `build`; `security:public-surface` | PASSED (exit 0; los dos hallazgos `server-only` de `proxy.ts` son informativos y preexistentes) |
| Raíz `typecheck`, `typecheck:test` | PASSED |
| `pnpm validate:local` como cadena | NOT_RUN: su `test` falla por 03B (ambiental); piezas corridas por separado; raíz `build` NOT_RUN (no toca `server/`) |
| A02 21×13 | **FAILED 20/21**: `clinic-informes-full`, 62 campos en 8 viewports ≥ 768 (drift esperado, pendiente R13) |
| A03 15×13 serial | **FAILED 15/16**: integridad, 8/234 hojas `informes-reports-list` ≥ 768 (pendiente R13) |
| A05 32/48/64 | PASSED 15/15 |
| A08 zero-scroll 21×13 | PASSED 21/21 |
| Informes y shell (C21, zero-internal-scroll, paginación adaptativa, fixture-pagination, mobile parity, adaptive rows, centered pager, controller/stage/metric-run parity, master-detail), a11y y teclado (`dashboard-accessibility-keyboard`, axe de C21/C24/B11/detail-text), recovery, zoom, layout polish, B10, B11 (incl. C03 vacío/error en Informes), C24, C23a | 430/432 PASSED (4 workers). FAILED 2: `clinic-reports-workspace-1000` (prefijos de IDs, ver A03) |
| A01 (contratos de filtros) | Sin cambios de código en `FilterBar` ni en S1–S7; guards C21/B11 de filtros PASSED. Spec S-protegido específico: NOT_RUN (Informes ruta completa no es S1–S7) |
| A02/A03 Linux | BLOCKED: requieren R13 y una ejecución real de E2E Completeness |
| `e2e:full` | NOT_RUN (no pedido; cohortes dirigidas cubren el contrato) |
| Artefactos | `test-results/`, `playwright-report/` y `.next` eliminados; `next-env.d.ts` sin cambios; sonda temporal eliminada |

## Solicitud R13 (pendiente)

Operación detenida: recaptura de baselines protegidos. Texto propuesto para que Nico decida:

- **Superficie:** `clinic-informes-full` (`/dashboard/informes`), consumidor A03 `informes-reports-list`.
- **Viewports:** los 8 ≥ 768 (1920×1080, 1600×900, 1440×900, 1366×768, 1280×720, 1024×768, 834×1194, 768×1024). Teléfonos: sin cambios.
- **A02 (`dashboard-geometry-baseline.ts`, Win32 `records` + overlay Linux real):** `regions.filters.y`, `regions.collection.y`, `regions.collection.height`, `regions.primaryContent.y`, `regions.sidePanel.y` (6 viewports ≥ 1024), `derived.chromeBeforePrimaryContentPx`, `derived.chromeBeforePrimaryContentRatio`, `derived.collectionCanvasHeight` = 62 campos por plataforma; valores antes/después en «Medición A02» (−178 px; −110.79 a 1280×720; filtros −77/−20.99; panel lateral −149/−84.65).
- **A03 (`dashboard-adaptive-limit-baseline.ts`, Win32 + `platformObservations.linux` real):** 8 hojas, campos `limit`, `offset`, `secondPageCount` y los textos derivados de la captura (`query`/`provenance` si aplican); antes/después en la tabla A03.
- **Ledger C23b:** salen `clinic-informes-full::w834x1194` y `::w768x1024` (7 → 5 celdas de banda); 1920 sigue en el ledger con 304.73 px; los valores de 1366/1280/1024 bajan a 0.38292/0.39864/0.38292.
- **Test acoplado:** `clinic-reports-workspace-1000.spec.ts`, ampliar `DELIVERED_IDS` (≥ 9) y `COMBINED_IDS` (≥ 18) desde la regla determinística del fixture.
- **Justificación causal:** B1+B4 retiran 178 px de chrome sobre la primera fila; el canvas medido crece lo mismo y el owner único de capacidad lo traduce en filas. No hay variante B1+B4 que reduzca chrome sin ampliar el canvas.
- **Impacto en A03:** 8/234 hojas; los otros 14 consumidores intactos. A05 y A08 PASSED sin cambios.
- **Pruebas previstas:** dos capturas Win32 en frío byte-idénticas (A02 `VETNEB_A02_GEOMETRY_CAPTURE=1` y A03 serial), overlay Linux desde E2E Completeness, guard C23 en ambas plataformas, A05/A08/C23a, `clinic-reports-workspace-1000` y el spec de paginación adaptativa de Informes.
- **Precondición fuera de R13:** retirar del árbol `frontend/e2e/regression/zz-c23b-pr3-variants.spec.ts`, `frontend/AGENTS.md` y `frontend/CLAUDE.md` (scope de PR3, no de baselines) y volver a correr `e2e:verify-catalog` antes de capturar.
- **Archivos:** `frontend/e2e/fixtures/dashboard-geometry-baseline.ts`, `frontend/e2e/fixtures/dashboard-adaptive-limit-baseline.ts`, `test/architecture/dashboard-c23-responsive-integral.test.ts` (ledger), `frontend/e2e/clinic/reports/clinic-reports-workspace-1000.spec.ts`, este documento.

Si no se autoriza, la alternativa es revertir B1+B4 (el cambio no puede publicarse con A02/A03 en rojo).

## Recaptura R13 Win32 (2026-10-20, autorizada por Nico sobre `c1855757`)

- **A02:** dos capturas `VETNEB_A02_GEOMETRY_CAPTURE=1` en frío (`.next` borrado), byte-idénticas (SHA-256 `4AFD4237…7DDA`). Contra el baseline: exactamente los 62 campos del manifiesto (8 por viewport ≥ 1024, 7 en 834/768); 0 en los teléfonos, `filters.height` y pager. Se reescribieron sólo esos 62 campos en `records` Win32, en 8 líneas. Linux sin tocar.
- **A03:** dos matrices completas en serie y en frío, byte-idénticas (SHA-256 `d1918608…`). Desvío funcional: exactamente las 8 hojas `informes-reports-list` ≥ 768 (24 campos). Se reescribieron sólo esas hojas Win32.
- **Tokens admin no absorbido:** `admin-particular-tokens::{w375x812,w412x915}` difieren sólo en `secondPageFixtureIds` y `provenance` (stub de 400 ítems congelado en #1650 frente al fixture compartido de 40 de #1740). Esas líneas son idénticas en `main` y ya figuraban como no absorbidas en PR1. `source`/`limit`/`offset`/`firstRenderedFixtureIndex`/`pageItemCount`/`secondPageCount` coinciden en las 13 hojas de ambas capturas. PR3 no toca admin, fixtures ni helpers. Valores congelados conservados.
- **Ledger C23b:** banda 7 → 5 (salen `clinic-informes-full::w834x1194` y `::w768x1024`; 1366/1024 = 0.38292, 1280 = 0.39864) y 1920 = 304.73 px. Los incumplimientos reales se mantienen.
- **`clinic-reports-workspace-1000.spec.ts`:** `DELIVERED_IDS` sube a 9 y `COMBINED_IDS` a 18, por la regla del fixture (id = 8400 + i; delivered `i % 4 === 0` más el legacy 8403; combinado `i % 20 === 0`).

| Gate (Win32) | Estado |
| --- | --- |
| A02 21×13 | PASSED 21/21 |
| A03 15×13 serial | PASSED 16/16 |
| A05 | PASSED 15/15 |
| A08 zero-scroll | PASSED 21/21 |
| C23a | PASSED 13/13 |
| Guard C23 + B11 + censos (76) | FAILED 1: ledger del lado **Linux** (pendiente del overlay, esperado); Win32, B11 y censos PASSED |
| `dashboard-informes-server-adaptive-pagination` | PASSED |
| `clinic-reports-workspace-1000` | Antes de la corrección: FAILED, determinista en 3/3 repeticiones («pagination advances to a later page…»). Después: **PASSED 15/15** (5 tests × 3, `--repeat-each=3`) |
| Linux A02/A03 | PENDING: E2E Completeness sobre el commit publicado |

**Fallo de `clinic-reports-workspace-1000`: no es de prefijos.** El trace muestra dos Server Actions, `{page:1,pageSize:9}` y `{page:2,pageSize:9}`. `settleWindow` se dio por estable sobre la ventana de fallback del servidor (`INFORMES_FALLBACK_ROWS` = 6, «page size 6») antes de observar la re-medición del cliente. Después el predicado de `advanceToNextPage` espera `pageSize 6` y no reconoce la acción de página 2. Antes de B1+B4, a 1280×720 la medición coincidía con el fallback (6) y esa transición no existía (ver el comentario del propio spec). La corrección de la espera de `settleWindow` la autorizó Nico aparte (2026-10-20).

- **Transición que había que observar:**
  1. El servidor renderiza la ventana de fallback (6 filas, «Pág. 1 / 167»).
  2. La hidratación del canvas ejecuta `measure()` síncrono en su layout effect (`useDashboardCanvasCapacity`), y `effectiveLimit` pasa a 9. El pager pasa a «1 / 112» mientras las filas siguen siendo 6.
  3. Se emite `{page:1,pageSize:9}` y llegan las 9 filas.
- **Por qué fallaba:** `expectWorkspaceReady` sólo exige que `#reports-master-list` sea visible, algo que el HTML del servidor ya cumple. El estado del paso 1 es coherente consigo mismo y satisface todas las aserciones de `settleWindow`. El error «known id prefix (24) must cover page 1 at page size 6», sin ninguna acción observada, junto con el trace (dos acciones con `pageSize 9`), prueba que asentó antes del commit de hidratación. Antes de B1+B4, a 1280×720 la medición daba justo el fallback (6) y el paso 2 no cambiaba nada.
- **Cambio** (sólo `clinic-reports-workspace-1000.spec.ts`, al comienzo de `settleWindow`): el bucle semántico existente se ejecuta después de dos condiciones observables:
  1. Que el cliente sea dueño del canvas: `__reactFiber$` en `[data-informes-rows-canvas="true"]`, el patrón de C21/C24.
  2. Que el render haya convergido: `waitForAdaptiveConvergence(page, "#reports-master-list")`, la primitiva de ciclos drenados que A03 usa para este consumidor.

  No hay sleeps, cambios de timeouts existentes, retries, skips ni cambios en aserciones, predicados, IDs, totales o filtros.
- **Pruebas causales** (los dos archivos se restauraron después de cada mutación, con hash verificado):

  | Espera | Mutación del componente | Resultado |
  | --- | --- | --- |
  | Anterior | Ninguna | FAILED 3/3 |
  | Corregida | Ninguna | PASSED 15/15 |
  | Corregida | Regresión real: el cliente nunca pide la ventana medida (`InformesReportsList` sin re-request) | **FAILED** con «first page: page indicator» esperado «1 / 167», recibido «1 / 112» |
  | Anterior | La misma regresión | **PASSED 3/3: falso verde** |

  Con la espera nueva, el test detecta una regresión que la anterior dejaba pasar.
- **Gates adicionales:** frontend `lint` y `typecheck` PASSED. B14, capacity single owner, A03 unit, security invariants y censos: PASSED (62/63; el único FAILED es el ledger Linux, pendiente del overlay).

## Riesgos residuales

- «Mostrando» y el estado de filtros dejan de pintarse como texto desde 768 px (quedan para tecnología asistiva y, los filtros, en sus controles desde `lg`).
- La instrucción «Click en un informe…» comparte fila con el heading y el toggle: a 1024×768 queda truncada a ~113 px (texto completo en el DOM y en `title`, contrato C24).
- La cabecera de los estados vacío/error de la lista conserva 2 líneas; al pasar de vacío a poblado la cabecera cambia de alto (no medido por A02/A03).
- A02/A03 en rojo hasta la recaptura autorizada; ningún head con este cambio puede pasar Backend/E2E Completeness sin ella.
- Defecto preexistente de B2: «Más filtros» y los campos inline conviven desde `lg` y fuerzan la segunda fila de filtros.

## Rollback

Revertir el commit squash: vuelven las clases y los dos guards. Sin datos ni backend.

## Estado de preparación

NO listo para publicar: A02 y A03 en FAILED por el drift esperado hasta que Nico autorice R13 y se recapturen Win32 + overlay Linux real. C23b sigue incompleto: 3 celdas de banda y 1 a 1920 de `clinic-informes-full`, más las 2 de `clinic-informes`, requieren B2 (y B3 para 1280).
