# C23b · PR4 — Informes ruta completa: B2 mínima, variante B (labels inline)

## Estado base, autorización y alcance

- Rama `feat/dashboard-c23b-pr4-informes-b2`, base `b746e0b2dac5747ea5ec545fcc1488709e65a3fe` (C23b PR3, #1895). Árbol tracked limpio al inicio. Se preservaron `frontend/AGENTS.md` y `frontend/CLAUDE.md` (untracked, generados por `next dev`), los 5 stashes y el único worktree. Sin `AGENTS.md` anidados tracked. Sin escrituras Git ni GitHub.
- Autorización: implementación local de la variante B y validación. La R13 de PR3 no se extiende. **R13 propia de PR4 autorizada por Nico (2026-10-20)**, limitada a `clinic-informes-full` / `informes-reports-list` (ver «Recaptura R13 Win32»).
- Incluido: `clinic-informes-full` (`/dashboard/informes`) desde `lg` (1024 px), sólo en `page.tsx`.
- Excluido: B2 completa del roadmap (`SuperSearchField`, chips, `AdvancedFilterSheet`), variante E (densidad `pt-4`/`gap-4`), B3 (app bar), C25, `clinic-informes` (S6), componentes compartidos (`FilterBar`, `FilterField`, `ModuleDialog`), motor de capacidad, `limit`/`offset`/reservas, fixtures A02/A03/A05/A08, backend, dependencias y CI.

## Causa

`FilterBar` (`module-card`) define 4 columnas desde `lg` (`lg:grid-cols-[1.4fr_0.8fr_1fr_auto]`), pero recibe 5 ítems: Buscar, el disparador «Más filtros» (`Dialog.Trigger asChild`: el `Button` es el ítem de grilla) y, por `hidden lg:contents`, Estado, Tipo y acciones. Filtrar/Limpiar pasan a una segunda fila (banda de 111.5 px). Ver la auditoría B2 en `dashboard-c23b-pr3-informes-full.md`.

## Cambios (`frontend/src/app/dashboard/informes/page.tsx`, 2 líneas)

- **A:** el `Button` disparador de «Más filtros» agrega `lg:hidden`. El disparador sigue siendo el hijo de `Dialog.Trigger asChild` de `ModuleDialog` (`aria-haspopup="dialog"`, `aria-expanded`, `aria-controls`). Por debajo de `lg` no cambia nada; desde `lg` sale de la grilla y del orden de tabulación. Estado y Tipo siguen inline desde `lg`.
- **B:** el `className` de `FilterBar` agrega `lg:[&_label]:grid-cols-[auto_minmax(0,1fr)] lg:[&_label]:items-center lg:[&_label]:gap-x-1.5`. La definición de columnas existente se conserva. Cada `<label>` de `FilterField` (texto `<span>` y control) pasa a una fila: el texto visible a la izquierda del control. El selector descendiente no alcanza el formulario del diálogo, porque Radix lo porta a `document.body`.

A01 sin cambios: `query`/`status`/`studyType`, `<FilterBar method="get" role="search">`, Filtrar `type="submit"`, Limpiar `PublicRouteControl replace`, y el formulario GET del diálogo.

## Medición A02 (Win32, Chromium, `next dev`, `VETNEB_A02_GEOMETRY_CAPTURE=1`, `.next` borrado)

Captura y corrida de comparación con los mismos valores. Los 6 viewports ≥ 1024 bajan exactamente **−66.5 px** (banda de filtros 111.5 → 45: una fila de 36 + `py-1` + borde). Los 7 inferiores a 1024 quedan sin ninguna diferencia.

| Viewport | Chrome antes | Chrome después | Ratio después | Presupuesto | Estado |
| --- | ---: | ---: | ---: | --- | --- |
| 1920×1080 | 304.73 | **238.23** | 22.06 % | ≤ 240 px | ✓ (margen 1.77 px) |
| 1600×900 | 302.20 | 235.70 | 26.19 % | fuera de banda | — |
| 1440×900 | 302.20 | 235.70 | 26.19 % | fuera de banda | — |
| 1366×768 | 294.08 | 227.58 | **29.63 %** | ≤ 32 % | ✓ (margen 18.18 px) |
| 1280×720 | 287.02 | 220.52 | **30.63 %** | ≤ 32 % | ✓ (margen 9.88 px) |
| 1024×768 | 294.08 | 227.58 | **29.63 %** | ≤ 32 % | ✓ (margen 18.18 px) |
| 834×1194 | 262.33 | 262.33 | 21.97 % | ≤ 32 % | ✓ (sin cambio) |
| 768×1024 | 259.95 | 259.95 | 25.39 % | ≤ 32 % | ✓ (sin cambio) |
| 430×932 | 310.77 | 310.77 | 33.34 % | fuera de banda | sin cambio |
| 412×915 | 310.67 | 310.67 | 33.95 % | fuera de banda | sin cambio |
| 390×844 | 310.56 | 310.56 | 36.80 % | fuera de banda | sin cambio |
| 375×812 | 310.48 | 310.48 | 38.24 % | fuera de banda | sin cambio |
| 360×800 | 310.41 | 310.41 | 38.80 % | fuera de banda | sin cambio |

La medición real coincide con la estimación de la auditoría (−66.5). El margen a 1920 es de 1.77 px: cumple, pero es estrecho. Cualquier px adicional de chrome a 1920 lo devuelve al ledger.

Campos A02 que cambian, por viewport ≥ 1024 (8 × 6 = **48 campos** Win32): `regions.filters.height` (111.5 → 45), `regions.collection.y`, `regions.primaryContent.y`, `regions.sidePanel.y`, `derived.chromeBeforePrimaryContentPx` (−66.5), `regions.collection.height`, `derived.collectionCanvasHeight` (+66.5) y `derived.chromeBeforePrimaryContentRatio`. `regions.filters.y` no cambia.

| Viewport | collection.y / primaryContent.y | sidePanel.y | collection.height = canvas | ratio |
| --- | --- | --- | --- | --- |
| 1920×1080 | 304.73 → 238.23 | 367.73 → 301.23 | 699.69 → 766.19 | 0.28216 → 0.22058 |
| 1600×900 | 302.2 → 235.7 | 365.2 → 298.7 | 528.61 → 595.11 | 0.33578 → 0.26189 |
| 1440×900 | 302.2 → 235.7 | 365.2 → 298.7 | 530.2 → 596.7 | 0.33578 → 0.26189 |
| 1366×768 | 294.08 → 227.58 | 357.08 → 290.58 | 407.06 → 473.56 | 0.38292 → 0.29633 |
| 1280×720 | 287.02 → 220.52 | 350.02 → 283.52 | 366.36 → 432.86 | 0.39864 → 0.30628 |
| 1024×768 | 294.08 → 227.58 | 357.08 → 290.58 | 413.34 → 479.84 | 0.38292 → 0.29633 |

## Medición A03 (`A03_TARGET_MODULES=informes-reports-list`, Win32)

El canvas crece 66.5 px y el owner único de capacidad lo convierte en filas. Cambian 6 hojas (≥ 1024); las 7 inferiores coinciden con el baseline. `source` y `provenance` no cambian.

| Hoja | limit / offset / secondPageCount |
| --- | --- |
| `w1920x1080` | 15 → **17** |
| `w1600x900` | 12 → **13** |
| `w1440x900` | 12 → **13** |
| `w1366x768` | 9 → **10** |
| `w1280x720` | 9 → **10** |
| `w1024x768` | 9 → **10** |
| `w834x1194`, `w768x1024`, 5 teléfonos | sin cambio (18, 14, 10, 10, 8, 7, 7) |

**Test de 1000 informes** (`clinic-reports-workspace-1000.spec.ts`, 1280×720, page size 9 → 10): FAILED 2/5 por los prefijos conocidos, el acoplamiento previsto: «status filter: known id prefix (9) must cover page 1 at page size 10» y «combined page 2: known id prefix (18) must cover page 2 at page size 10». Los otros 3 casos PASSED.

## Verificación de contratos

Sonda temporal fuera del catálogo (`frontend/.c23b-probe/`, con su propia config, ya eliminada), sobre los 13 viewports:

- **≥ 1024 (6/6 PASSED):** «Más filtros» oculto; Buscar, Estado y Tipo de estudio con el texto del label visible, a la izquierda del control, sin solape ni clipping (`scrollWidth ≤ clientWidth`). Los controles y Filtrar/Limpiar quedan en una sola fila dentro del formulario. Sin overflow horizontal del formulario ni del documento. Tab desde Buscar: Estado → Tipo → Filtrar → Limpiar. axe sobre `[role="search"]`: 0 violaciones. El control más angosto, a 1024, es Tipo con 133 px.
- **< 1024 (7/7 PASSED):** el disparador está visible y los campos inline ocultos. Enter abre «Filtros de informes» con Estado, Tipo y Filtrar; Escape lo cierra y el foco vuelve al disparador.
- **Contraprueba causal:** con `page.tsx` de HEAD, los 6 casos ≥ 1024 FAILED (el disparador sigue visible) y los 7 inferiores PASSED igual. Así se confirma que debajo de 1024 el comportamiento es el previo. Archivo restaurado (SHA-256 `99be4215…5580`).

## Guard C23 (`test/architecture/dashboard-c23-responsive-integral.test.ts`)

Se agregó la sección **C23b PR4 · B2 variante B**: `className` exacto de `FilterBar` (GET, `role="search"`, aria-label, densidad) y del disparador; todos los tokens nuevos con `lg:`; formulario GET del diálogo; bloque `hidden lg:contents`; orden Buscar → Estado → Tipo → Filtrar → Limpiar; `status`/`studyType` presentes en el diálogo y en línea; los dos Limpiar con `replace`; sin `labelHidden` ni `[&_label]:sr-only|hidden`; `FilterField` sigue renderizando el texto antes del control.

- 11 mutaciones rechazadas: quitar `lg:hidden`; `hidden` global; quitar la columna inline; mover la columna a `md:`; quitar `items-center`; `lg:grid-cols-5`; `[&_label]:sr-only`; inline sin `lg:contents`; `method="post"`; `labelHidden`; span de `FilterField` en `sr-only`.
- Prueba causal sobre el archivo real: con `page.tsx` de HEAD, PR4 FAILED 2 («the FilterBar keeps its GET search form…», «the «Más filtros» trigger is hidden from lg only»). Restaurado (hash verificado): 12/12 PASSED.
- Ledger C23b **sin cambios**: lee el A02 congelado, que no se tocó, y sigue verde.
- No se agregó ningún spec E2E al catálogo.

## Validaciones (Win32; una tarea pesada por vez; `.next` borrado antes de las corridas E2E)

| Gate | Estado |
| --- | --- |
| Guard C23 (12 casos) | PASSED 12/12 |
| Guards que anclan `page.tsx`/`FilterBar` (B04, B05, B08, B09, B10, B11, B14, C21, C23, informes, filter drawer, empty states, master-detail, mobile polish, 401, report download/upload, live read, PWA) | PASSED 221/221 |
| `pnpm test` (suite Node completa) | FAILED 5409/5411 (1 skip): sólo `e2e-global-03b-authoritative-auth-boundary`, que exige `DATABASE_URL` (ambiental y preexistente). Ver «Suite Node» |
| Frontend `lint` | PASSED (exit 0; el único warning era de la sonda, ya eliminada) |
| Frontend `typecheck`, `build`; `security:public-surface` | PASSED (exit 0; los 2 hallazgos `server-only` de `proxy.ts` son preexistentes) |
| A02 21×13 | **FAILED 20/21**: `clinic-informes-full`, 48 campos en 6 viewports ≥ 1024 (drift esperado, pendiente R13) |
| A03 `informes-reports-list` | **FAILED** integridad: 6/13 hojas ≥ 1024 (pendiente R13) |
| `clinic-reports-workspace-1000` | **FAILED 2/5**: prefijos de IDs (acoplamiento a `limit`, pendiente R13) |
| Cohorte dirigida (A05 `limit-invariance`, A08 `zero-scroll-baseline`, C23a, B11, C24, C21, informes zero-internal-scroll, fixture pagination, mobile parity, server adaptive pagination, master-detail polish, `dashboard-accessibility-keyboard`, axe key routes, internal/real-app-shell no-scroll contract, zero-scroll mobile boundary, detail-text, zoom, layout polish, page-request recovery), 4 workers | 363/364 PASSED. FAILED 1: C23a «kebab … portaled Notificaciones» a 390 px (timeout de `waitForRequest` de notificaciones bajo carga); aislado `--repeat-each=3`, PASSED 9/9. No toca Informes ni `lg` |
| Sonda B2 13 viewports | PASSED 13/13 (contraprueba HEAD: 6 FAILED / 7 PASSED) |
| A01 S-protegidos | Sin cambios en S1–S7; la ruta completa no figura en S1–S7. Invariantes de filtros cubiertas por el guard y la sonda |
| A02/A03 Linux | BLOCKED: requieren R13 y una corrida real de E2E Completeness |
| `pnpm validate:local`, raíz `build` | NOT_RUN: no se toca `server/`; `validate:local` falla sin DB (03B) |
| `e2e:full` | NOT_RUN: no pedido; las cohortes dirigidas cubren el contrato |

### Suite Node

La primera corrida dio FAILED 3 en los censos 01B/05A («specs que normalizan CRLF a mano: 17 supera la cota de no-regresión 16»). La causa era una regresión real del guard nuevo: normalizaba CRLF a mano en lugar de apoyarse en el lector canónico. Se retiró esa normalización (el lector canónico ya entrega LF y las anclas multilínea siguen presentes) sin tocar el censo. Segunda corrida: 5409/5411, con el único FAILED en 03B (ambiental). La prueba causal del guard se repitió después del ajuste: HEAD da FAILED 2 y el árbol 12/12.

## Solicitud R13 de PR4 (autorizada 2026-10-20; ejecutada en Win32, ver abajo)

- **Superficie:** `clinic-informes-full` (`/dashboard/informes`), consumidor A03 `informes-reports-list`.
- **Viewports:** los 6 ≥ 1024 (1920×1080, 1600×900, 1440×900, 1366×768, 1280×720, 1024×768). 834/768 y teléfonos: sin cambios.
- **A02** (`frontend/e2e/fixtures/dashboard-geometry-baseline.ts`): 48 campos en 6 registros Win32 `records`, con los valores de «Medición A02», y los mismos 48 campos en `platformRecords.linux`, tomados del log de una corrida real de E2E Completeness sobre el head de PR4. Nunca se copian de Win32.
- **A03** (`frontend/e2e/fixtures/dashboard-adaptive-limit-baseline.ts`): 6 hojas × 3 campos (`limit`, `offset`, `secondPageCount`) = 18 campos Win32 (registros de las líneas 730–735 en HEAD). Las mismas 6 hojas en `platformObservations.linux` (líneas 935–940), desde el artifact `a03-matrix-observations.json` de esa corrida. `source` y `provenance` no cambian.
- **Ledger C23b** (`test/architecture/dashboard-c23-responsive-integral.test.ts`): salen `clinic-informes-full::w1366x768`, `::w1280x720` y `::w1024x768` de la banda (5 → 2; quedan sólo las 2 celdas de `clinic-informes`, S6). También sale `clinic-informes-full::w1920x1080` del ledger ancho (1 → 0, `C23B_WIDE_LEDGER` vacío). Se retiran por cumplimiento medido, sin cambiar los umbrales ni la medición.
- **Test acoplado** (`frontend/e2e/clinic/reports/clinic-reports-workspace-1000.spec.ts`): `DELIVERED_IDS` agrega `8436` (10 ≥ página 1 a page size 10) y `COMBINED_IDS` agrega `8780, 8800` (20 ≥ página 2). Se derivan de la regla del fixture (id = 8400 + i; delivered `i % 4 === 0` más el legacy 8403; combinado `i % 20 === 0`). Sin cambios en aserciones, esperas ni timeouts.
- **Justificación causal:** la banda de filtros baja 66.5 px; el canvas crece lo mismo y `useDashboardCanvasCapacity` lo traduce en +1/+2 filas. Ninguna variante B2 reduce chrome sin ampliar el canvas.
- **Pruebas previstas:** dos capturas A02 Win32 en frío byte-idénticas; dos A03 serie completas en frío byte-idénticas (sólo deben divergir las 6 hojas); overlay Linux desde E2E Completeness (sólo `clinic-informes-full` / `informes-reports-list`); guard C23 en ambas plataformas; A05/A08/C23a; `clinic-reports-workspace-1000` con `--repeat-each=3`; adaptive pagination de Informes.

## Recaptura R13 Win32 (2026-10-20, autorizada por Nico)

- **A02:** dos capturas `VETNEB_A02_GEOMETRY_CAPTURE=1` en frío (`.next` borrado), byte-idénticas (SHA-256 `0366c9a9…55c4`). Se reescribieron sólo los 48 campos del manifiesto en los 6 registros Win32 ≥ 1024 (líneas 429–434). El script falla cerrado si cualquier otro campo difiere de la captura. `platformRecords.linux` sin tocar.
- **A03:** dos capturas dirigidas (`A03_TARGET_MODULES=informes-reports-list`) en frío, byte-idénticas (SHA-256 `4adccca8…1b71`). Se reescribieron sólo `limit`/`offset`/`secondPageCount` de las 6 hojas Win32 ≥ 1024 (líneas 730–735: 10, 10, 10, 13, 13, 17), con `source`/`provenance`/`endpoint` verificados iguales. Las 7 hojas inferiores no tienen drift. `platformObservations.linux` sin tocar.
- **Ledger C23b:** banda 5 → 2 (quedan `clinic-informes::w1280x720` y `::w768x1024`, S6, fuera de scope); ancho 1 → 0. Umbrales, `RATIO_EPSILON` y medición sin cambios.
- **`clinic-reports-workspace-1000.spec.ts`:** `DELIVERED_IDS` + `8436` (10) y `COMBINED_IDS` + `8780, 8800` (20), por la regla del fixture (la regla reproduce el total combinado de 50). Sin cambios en aserciones, esperas ni timeouts.

| Gate (Win32, después de la recaptura) | Estado |
| --- | --- |
| A02 21×13 | PASSED 21/21 |
| A03 15×13 serie completa | PASSED 16/16 |
| `clinic-reports-workspace-1000` + `dashboard-informes-server-adaptive-pagination`, `--repeat-each=3` | PASSED 30/30 |
| Guard C23 + catálogo + A03 unit + censo 01B/05A + workflow (31) | FAILED 1: ledger del lado **Linux** (pendiente del overlay, esperado); Win32 y el resto PASSED |
| Frontend `lint`, `typecheck`; raíz `typecheck:test` | PASSED |
| A05, A08, C23a, C21, a11y/axe/teclado, zero-scroll | PASSED en la cohorte previa sobre el mismo código de producto (`page.tsx` SHA-256 `99be4215…5580`); los fixtures recapturados no son leídos por esos specs. NOT_RUN de nuevo |
| A02/A03 Linux | PENDING: requiere un head publicado y una corrida real de E2E Completeness |

## Overlay Linux (PENDING)

Precondición: Nico publica el head (commit + push) y E2E Completeness corre sobre ese SHA. Después: A02 desde el log (sólo los 48 campos de `clinic-informes-full`, idénticos entre intentos) y A03 desde el artifact `a03-matrix-observations.json` (sólo las 6 hojas `informes-reports-list`), reescritos en `platformRecords.linux` / `platformObservations.linux`. Nada se copia de Win32. Luego, guard C23 en ambas plataformas.

## Riesgos residuales

- Margen de 1.77 px a 1920×1080: cualquier crecimiento futuro del chrome lo devuelve al ledger. Sigue siendo el viewport binding.
- A 1024 los controles Estado y Tipo miden ~133 px: el placeholder «Filtrar por tipo de estudio...» queda cortado visualmente (el label visible y el `aria-label` siguen completos).
- Si el diálogo está abierto y la ventana cruza a ≥ 1024, el diálogo sigue abierto hasta Escape/Cerrar con el disparador ya oculto, por lo que el retorno de foco no tiene destino visible (no medido). Es un caso de redimensionamiento, no de uso normal.
- Hasta el overlay Linux, el guard C23 (Backend CI) y A02/A03 Linux (E2E Completeness) quedan en rojo en Linux a propósito.
- `clinic-informes` (S6) conserva 2 celdas en el ledger (fuera de scope; otro owner).

## Rollback

Revertir el commit squash: vuelven las dos clases y la sección PR4 del guard. Sin datos ni backend.
