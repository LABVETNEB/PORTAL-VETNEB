# C23b · PR5 — Informes clínica (S6): CTA del módulo completo en el pie del paginador

## Estado base, autorización y alcance

- Rama `feat/dashboard-c23b-pr5-clinic-informes-s6`, base `700dc6dc836fb794eaf35e8be67862b8898f2fc4` (C23b PR4, #1896), igual a `main` y `origin/main`. Árbol tracked limpio al inicio. Se preservaron `frontend/AGENTS.md` y `frontend/CLAUDE.md` (untracked, generados por `next dev`), los 5 stashes y el único worktree. Sin `AGENTS.md` anidados tracked. Sin escrituras Git ni GitHub.
- Autorización: implementación local y validación. **R13 propia de PR5 autorizada por Nico (2026-10-20)**: ejecutada en Win32 (ver «Recaptura R13 Win32»). El overlay Linux y el retiro del ledger quedan pendientes de una corrida real de CI.
- Incluido: `clinic-informes` (`/dashboard?module=informes`), owner `frontend/src/app/dashboard/ClinicInformesWorkspaceSummary.tsx`, entre `md` (768 px) y `2xl` (1536 px).
- Excluido: `clinic-informes-full`, Logística, B3 (app bar 68.11 px a 1280×720), C25, componentes compartidos (`FilterBar`, `FullModuleRouteControl`, `ModuleDialog`, `DashboardPager`), CSS/tokens, motor de capacidad, fixtures A02/A03/A05/A08, backend, dependencias y CI.

## Estado inicial (ledger C23b, A02 congelado)

| Viewport | Chrome | Ratio | Presupuesto |
| --- | ---: | ---: | --- |
| 1280×720 | 250.95 | 34.854 % | ≤ 32 % (230.4 px) → faltan 20.55 px |
| 768×1024 | 344.45 | 33.638 % | ≤ 32 % (327.68 px) → faltan 16.77 px |

## Causa raíz

Descomposición de la banda a 1280×720 (A02): `workspace.y` 83.45 → filtros `y` 90.45, alto 60.5 → colección `y` 206.95. Entre el final de los filtros (150.95) y la colección hay 56 px. Son el gap de fila de la toolbar (8), una **segunda línea de 32 px** con «Abrir módulo completo», el `p-1.5` inferior (6), el borde (1) y el `p-2`+borde del panel (9). Toolbar: 6 + 60.5 + 8 + 32 + 6 + 1 = 113.5 px.

- La toolbar es `flex flex-wrap`. `renderAdvancedFilterForm()` es una grilla `FilterBar` de 9 columnas desde `lg` (`basis-[59rem]` = 944 px; 4 columnas desde `md`, `basis-[36rem]`). El CTA mide ~175 px. Hace falta 944 + 8 + 175 = 1127 px de línea. A 1280 hay 977.75 y a 1024, 901.84, así que el CTA se envuelve a una segunda línea. Lo mismo pasa a 1366 y a 1440 en Linux. Desde 1600 (Win32) cabe en la misma fila.
- A 768/834 la grilla de 4 columnas con 9 ítems ocupa 3 filas (155 px) y el CTA vuelve a envolverse (+40).
- `ModuleDialog` (disparador «Filtros», `md:hidden`) y el formulario móvil no pintan desde `md`. Aplicar/Limpiar están dentro de la grilla. La paginación (`nav` prev/next centrado, 40 px) va **debajo** de las filas y no cuenta como chrome. La cabecera de colección (thead, 44 px, reserva por token) no se toca.
- Por qué no sirve ponerlo en la misma fila: con el CTA en la línea, a 1280 la grilla quedaría en ~792 px (~916 necesarios). Estado mediría ~56 px y Paciente ~72, así que habría clipping. A 1024 sería peor.
- Por qué no sirven los filtros progresivos ni los labels inline: A01 S6 fija `desktopVisibility: FilterBar from md: up` con los 7 campos inline. Ocultar campos detrás de un diálogo cambia ese contrato. Los labels inline de PR4 ensanchan cada campo y no caben 9 columnas. Además rinden sólo ~15.5 px, por debajo de los 20.55 necesarios.

## Implementación (1 archivo de producto)

- `hasReportsFooter = !reportsLoadError && recentReports.length > 0`: el pie del paginador sólo existe con la lista cargada.
- Con pie, el contenedor de acciones de la toolbar agrega `md:hidden 2xl:flex`. Entre 768 y 1535 px la toolbar queda sólo con la grilla de filtros y desaparece la segunda línea. Desde 1536 (donde ya cabía en una fila) no cambia nada. Sin pie (error o sin informes), el CTA queda en la toolbar como antes.
- El pie (`data-clinic-reports-pagination-footer`) pasa a `relative` y suma, **después** del `nav` del paginador y fuera de él, `<div data-clinic-reports-footer-cta className="absolute inset-y-0 right-3 hidden items-center md:flex 2xl:hidden">{fullModuleLink}</div>`. Está fuera de flujo, así que el `nav` conserva ancho, reserva (`DASHBOARD_TOUCH_PAGER_RESERVATION`), centrado de Anterior/Siguiente y el contrato CMP-12. El CTA toma el borde derecho libre.
- Por debajo de 768 px el CTA del pie está en `display:none` y la toolbar sigue igual (Filtros + Abrir módulo completo).
- Un único CTA visible por régimen. La otra instancia queda en `display:none`, fuera del árbol de accesibilidad y del orden de tabulación. Mismo `FullModuleRouteControl`, mismo `href` y `aria-label`.

A01 S6 sin cambios: los 7 `FilterField`, `filterDraft`/`appliedFilters`, `onSubmit={applyAdvancedFilters}`, Limpiar → `INITIAL_REPORTS_FILTER_STATE`, `pagedReports.setPage(0)`, semántica de fechas (`matchesUploadDateRange`), selección y diálogo de detalle, `hidden shrink-0 md:grid`, `ModuleDialog` móvil y sus aria-labels.

## Mediciones (Win32, Chromium, `next dev`, `.next` borrado)

A02 en modo comparación contra el baseline congelado, `-g "clinic-informes geometry"`. Primera variante (CTA en el pie en todo `md+`): −40 en la banda, pero `filters.width` +182.66 a 1920/1600/1440 sin ganancia de chrome. Se acotó a `md`–`2xl`. Medición final:

| Viewport | Chrome antes | Chrome después | Ratio después | Presupuesto | Estado |
| --- | ---: | ---: | ---: | --- | --- |
| 1920×1080 | 210.73 | 210.73 | 19.51 % | ≤ 240 px | ✓ sin cambio |
| 1600×900 | 208.20 | 208.20 | 23.13 % | fuera de banda | sin cambio |
| 1440×900 | 208.20 | 208.20 | 23.13 % | fuera de banda | sólo `filters.width` 945.16 → 1127.81 |
| 1366×768 | 240.08 | **200.08** | 26.05 % | ≤ 32 % | ✓ |
| 1280×720 | 250.95 | **210.95** | **29.30 %** | ≤ 32 % | ✓ (margen 19.45 px) |
| 1024×768 | 240.08 | **200.08** | 26.05 % | ≤ 32 % | ✓ |
| 834×1194 | 346.83 | **306.83** | 25.70 % | ≤ 32 % | ✓ |
| 768×1024 | 344.45 | **304.45** | **29.73 %** | ≤ 32 % | ✓ (margen 23.23 px) |
| 5 teléfonos | — | sin cambio | — | fuera de banda | sin cambio |

Campos A02 Win32 que cambian: **36**.

- 7 por viewport en 1366, 1280, 1024, 834 y 768: `regions.collection.y`, `regions.collectionHeader.y`, `regions.primaryContent.y`, `derived.chromeBeforePrimaryContentPx` (−40), `derived.chromeBeforePrimaryContentRatio`, `regions.collection.height` y `derived.collectionCanvasHeight` (+44, o +40 a 1280; el canvas se cuantiza en filas).
- 1 a 1440: `regions.filters.width`.
- `regions.filters` (`y`, `height`), `pager`, `shell` y `workspace` sin cambios.

| Viewport | collection.y = collectionHeader.y | primaryContent.y | collection.height = canvas | ratio |
| --- | --- | --- | --- | --- |
| 1366×768 | 196.08 → 156.08 | 240.08 → 200.08 | 484 → 528 | 0.3126 → 0.26052 |
| 1280×720 | 206.95 → 166.95 | 250.95 → 210.95 | 404 → 444 | 0.34854 → 0.29299 |
| 1024×768 | 196.08 → 156.08 | 240.08 → 200.08 | 484 → 528 | 0.3126 → 0.26052 |
| 834×1194 | 302.83 → 262.83 | 346.83 → 306.83 | 792 → 836 | 0.29048 → 0.25698 |
| 768×1024 | 300.45 → 260.45 | 344.45 → 304.45 | 616 → 660 | 0.33638 → 0.29731 |

A03 (`A03_TARGET_MODULES=clinic-informes-summary`, Win32): cambian 5 hojas, +1 fila cada una. `source` (`client-slice`) sin cambio.

| Hoja | limit = offset = firstRenderedFixtureIndex = pageItemCount = secondPageCount |
| --- | --- |
| `w1366x768` | 10 → **11** |
| `w1280x720` | 9 → **10** |
| `w1024x768` | 10 → **11** |
| `w834x1194` | 17 → **18** |
| `w768x1024` | 13 → **14** |
| `w1920x1080`, `w1600x900`, `w1440x900`, 5 teléfonos | sin cambio |

`secondPageFixtureIds` se desplaza con la regla del fixture (`8400 + limit + 1 … 8400 + 2·limit`).

## Pruebas

Guard `test/architecture/dashboard-c23-responsive-integral.test.ts`, nueva sección **C23b PR5**. Verifica:

- `hasReportsFooter` exacto y la clase condicional de las acciones de la toolbar.
- El pie es `relative` y el CTA va después del `</nav>`, con la clase exacta.
- El `nav` del paginador queda intacto y hay dos `{fullModuleLink}`, con ruta y nombre accesible.
- El CTA movido no lleva `sr-only` ni `title`.
- Los 7 `FilterField` de A01 S6 y `hidden shrink-0 md:grid` siguen presentes.

Rechaza 12 mutaciones: sin `md:hidden`, sin `2xl:flex`, `hidden` global, pie incondicional, sin `2xl:hidden`, `lg:flex`, sin `relative`, sin `absolute`, `sr-only`, CTA dentro del `nav`, `labelHidden` en Archivo, y la grilla desde `lg`.

- Prueba causal sobre el archivo real: con el owner de HEAD, PR5 da FAILED 2 (los dos casos nuevos) y el resto 12/12. Restaurado (SHA-256 `81598de6…4681`): 14/14 PASSED.
- `dashboard-clinic-desktop-tablet-space.spec.ts`: el caso de Informes fijaba «filters and CTA share the top band», el contrato que PR5 cambia a propósito, y se realineó en el mismo cambio. Desde 1536 px el CTA sigue en la toolbar, en la misma fila. Por debajo:
  - Ningún CTA visible en la toolbar.
  - El CTA es visible en el pie, a la derecha de Siguiente y dentro del pie.
  - Los controles del pie no se solapan ni desbordan.
  - El resto sin cambios: 7 labels, Aplicar/Limpiar, paginador prev/next centrado y zero scroll.
- Sin specs E2E nuevos: el censo del catálogo no cambia.

## Gates (Win32; una tarea pesada por vez; `.next` borrado antes de A02)

| Gate | Estado |
| --- | --- |
| Guard C23 (14 casos, 12 mutaciones PR5) | PASSED 14/14; causal con HEAD: FAILED 2 |
| Frontend `lint`, `typecheck`, `build` | PASSED |
| `security:public-surface` | PASSED (los 2 hallazgos `server-only` de `proxy.ts` son preexistentes) |
| `pnpm test` (suite Node completa) | FAILED 5411/5413 (1 skip): sólo `e2e-global-03b-authoritative-auth-boundary`, que exige `DATABASE_URL` (ambiental y preexistente) |
| Cohorte dirigida, 2 workers: CLINIC-DT-SPACE, C21, A05 `limit-invariance`, A08 `zero-scroll-baseline`, C23a, paridad móvil de Informes, CMP-12, densidad operativa móvil, `dashboard-accessibility-keyboard`, axe key routes, internal/real-app-shell no-scroll, zero-scroll mobile boundary, real-pointer navigation (clic del CTA) | PASSED 316/316 |
| A02 21×13 | **FAILED 20/21**: sólo `clinic-informes`, los 36 campos del manifiesto (drift esperado, pendiente R13) |
| A03 15×13 serie completa | 15/15 consumidores capturados; integridad **FAILED**: 229/234 hojas idénticas, 5 divergentes, exactamente `clinic-informes-summary` (pendiente R13) |
| A02/A03 Linux | BLOCKED: requieren R13, head publicado y una corrida real de E2E Completeness |
| Guard ledger C23b | PASSED (lee el A02 congelado, sin tocar) |
| `pnpm validate:local`, raíz `build` | NOT_RUN: no se toca `server/`; `validate:local` falla sin DB (03B) |
| `e2e:full` | NOT_RUN: no pedido; la cohorte dirigida cubre el contrato |

`frontend/next-env.d.ts` sin cambios; sin `playwright-report/` ni `test-results/` en el diff.

## R13 de PR5 — manifiesto (autorizado 2026-10-20)

- **Superficie:** `clinic-informes` (`/dashboard?module=informes`), consumidor A03 `clinic-informes-summary`.
- **A02 Win32** (`frontend/e2e/fixtures/dashboard-geometry-baseline.ts`, `records`, líneas 379–384 en HEAD): 36 campos. Son 7 × {1366, 1280, 1024, 834, 768} con los valores de la tabla de arriba, más `regions.filters.width` a 1440 (945.16 → 1127.81). 1920/1600 y los teléfonos no cambian.
- **A02 Linux** (`platformRecords.linux`, líneas 680–685): se toma del log de una corrida real de E2E Completeness sobre el head publicado de PR5, nunca se copia de Win32. Expectativa a confirmar: Linux 1440 hoy envuelve (`chrome` 248.2, `collection.y` 204.2), así que ahí también cambiarían los 7 campos de −40 además de `filters.width`. Se esperan entonces 6 viewports × 7 campos + `filters.width` a 1440 ≈ 43 campos, sin 1920/1600.
- **A03 Win32** (`frontend/e2e/fixtures/dashboard-adaptive-limit-baseline.ts`, líneas 691–693, 702–703): 5 hojas. Cambian `limit`, `offset`, `firstRenderedFixtureIndex`, `pageItemCount`, `secondPageCount` y `secondPageFixtureIds`, según la tabla. `source`, `provenance`, `variantId` y `leafKey` sin cambio.
- **A03 Linux** (`platformObservations.linux`, líneas 961–973): desde el artifact `a03-matrix-observations.json` de esa corrida. Expectativa: las mismas 5 hojas más, posiblemente, `w1440x900` (Linux hoy 12, con la banda envuelta). El script falla cerrado ante cualquier divergencia fuera de `clinic-informes-summary`.
- **Paginación:** S6 es `client-slice` sobre `usePagedRows` y no tiene URL ni `offset` de servidor. Un `limit` mayor sólo cambia el tamaño de página. Aplicar y Limpiar siguen reseteando a la página 0.
- **Ledger C23b** (guard C23): `C23B_BAND_LEDGER` 2 → 0 (salen `clinic-informes::w1280x720` y `::w768x1024`). `C23B_WIDE_LEDGER` sigue vacío. Umbrales, `RATIO_EPSILON` y medición sin cambios. Con eso el ledger C23b queda **vacío**.
- **Invariancia de las otras 20 superficies:** medida. A02 da 20/21 superficies sin drift. A03 da 229/234 hojas idénticas (14 consumidores intactos, más las 8 hojas sin cambio de `clinic-informes-summary`).
- **Pruebas previstas en la R13:**
  - Dos capturas A02 Win32 en frío, byte-idénticas, que reescriben sólo los 36 campos (el script falla cerrado ante cualquier otro).
  - Dos A03 dirigidas en frío, byte-idénticas.
  - Overlay Linux desde E2E Completeness, sólo `clinic-informes` / `clinic-informes-summary`.
  - Guard C23 en ambas plataformas, con el ledger vacío.
  - A05, A08, C23a y CLINIC-DT-SPACE.

## Recaptura R13 Win32 (2026-10-20, autorizada por Nico)

Autorización limitada a C23b/PR5, `clinic-informes` (S6). Comprende la implementación y validación local, no commit, push, PR ni merge.

- **A02:** dos capturas `VETNEB_A02_GEOMETRY_CAPTURE=1` en frío (`.next` borrado), byte-idénticas (SHA-256 `b0b2fd51…b4f8`). Un script que falla cerrado reescribió sólo los 36 campos del manifiesto en los registros Win32, líneas 379–384. Aborta si un campo del manifiesto no cambió o si cualquier otro campo difiere de la captura más allá de la tolerancia del spec. `platformRecords.linux` sin tocar.
- **A03:** dos capturas `A03_TARGET_MODULES=clinic-informes-summary` en frío, byte-idénticas (SHA-256 `ede158aa…a657`). Se reemplazaron sólo las 5 hojas Win32 (líneas 691–693 y 702–703): 11, 10, 11, 14, 18. `moduleId`, `leafKey`, `source`, `provenance` y el orden de claves quedaron verificados iguales. `secondPageFixtureIds` se validó contra la regla `8400 + limit + 1 …` y las 8 hojas restantes sin drift. `platformObservations.linux` sin tocar.
- **Ledger C23b:** **no se retiró**. La autorización exige verificar antes el cumplimiento en ambas plataformas. Con el A02 Win32 realineado, el guard da FAILED sólo en `win32: 768-1366 cells over 32 %`: la banda Win32 ya está vacía y el ledger conserva las 2 entradas. Es el estado intermedio esperado. Se retiran junto con el overlay Linux.
- **Tabulación y solape del CTA** (caso de Informes de CLINIC-DT-SPACE, ampliado sin spec nuevo): entre 768 y 1366 px se verifica foco en Siguiente → Tab → CTA → Shift+Tab → Siguiente. El anillo de foco (2 px + offset 2) queda dentro del panel de la lista, que recorta. Los controles del pie no se solapan ni desbordan y el CTA queda a la derecha de Siguiente. PASSED 6/6.

| Gate (después de la recaptura) | Estado |
| --- | --- |
| A02 21×13 | PASSED 21/21 |
| A03 15×13 serie completa | PASSED 16/16 |
| CLINIC-DT-SPACE · Informes (6 viewports, con tabulación) | PASSED 6/6 |
| Guard C23 + catálogo + A03 unit | FAILED 1: el ledger, por la retención deliberada hasta el overlay Linux; 22 PASSED |
| `pnpm test` (suite Node completa) | FAILED 5410/5413 (1 skip): el ledger C23b (esperado, ver arriba) y 03B (ambiental) |
| A05, A08, C23a, C21, a11y/axe/teclado, zero-scroll | PASSED en la cohorte previa (316/316). El código de producto no cambió desde entonces y esos specs no leen los fixtures recapturados. NOT_RUN de nuevo |
| A02/A03 Linux | PENDING: requiere head publicado y una corrida real de E2E Completeness |

### Pasos pendientes después de la publicación

1. Nico publica el head y corre E2E Completeness.
2. Overlay A02 Linux: sólo los campos de `clinic-informes` que el log demuestre (estimado ~43, incluido 1440), nunca copiados de Win32.
3. Overlay A03 Linux: sólo las hojas `clinic-informes-summary` que el artifact demuestre.
4. Se verifica el cumplimiento en ambas plataformas y se retiran las 2 entradas del ledger (`C23B_BAND_LEDGER` vacío).
5. Guard C23 verde en ambas plataformas.

## Riesgos residuales

- Entre 768 y 1535 px el CTA cambia de lugar: deja la toolbar y pasa al pie del listado. En el orden de tabulación pasa a ir después de la lista y del paginador. Sigue visible, con el mismo nombre y la misma ruta.
- El CTA está posicionado de forma absoluta sobre la caja del `nav`, en el borde derecho libre. Si el paginador sumara contenido a la derecha, podría solaparse. El spec CLINIC-DT-SPACE lo detecta (`expectBandControlsDisjoint` sobre el pie).
- Linux 1440 envuelve hoy la banda. El overlay real puede sumar esa hoja A03; está previsto en el manifiesto.
- B3 (app bar 68.11 px a 1280×720) sigue abierto y fuera de scope.

## Rollback

Revertir el commit squash: vuelven la toolbar y el pie anteriores, la sección PR5 del guard y el caso de Informes de CLINIC-DT-SPACE. Sin datos ni backend.
