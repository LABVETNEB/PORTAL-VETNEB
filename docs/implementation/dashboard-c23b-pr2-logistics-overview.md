# C23b · PR2 — Logística ruta completa (variante vE)

## Estado base, autorización y alcance

- Rama `feat/dashboard-c23b-pr2-logistics-overview`, base `a2c91ab19cd57f263c32004391948f39cf140506` (C23b PR1, #1893). Árbol tracked limpio al inicio. Se preservaron `frontend/AGENTS.md`, `frontend/CLAUDE.md` (untracked, generados por `next dev`), los cinco stashes, el único worktree y las ramas C23b/C25 anteriores. Sin escrituras Git ni GitHub.
- Autorización R13 de Nico (2026-10-19), literal: «Autorizo R13 exclusivamente para C23b/PR2, variante vE, en clinic-logistica-full: los 8 registros A02 ≥768 × 7 campos (Win32 y overlay Linux real), el ledger C23b y sus tests, sin cambios en A03/A05/A08 ni en otros contratos».
- Incluido: `clinic-logistica-full` (`/dashboard/logistica`) desde 768 px; sus 8 registros A02 Win32; el ledger C23b y el contrato de fuente vE.
- Excluido: `clinic-log-rutas`/`-visitas` (PR1), `clinic-informes` e `-informes-full`, B2, B3 (app bar 68.11 px a 1280×720), B4, C25, C26, el motor de capacidad, A03/A05/A08, backend, auth, datos, dependencias y CI. Overlay Linux: fase 2, desde una ejecución real.

## Auditoría causal (HEAD, Win32, Chromium, `next dev`, DPR 1)

Primer dato según A02: primera fila del primer `[data-logistics-recent-list-canvas]` visible (Visitas de campo), ancla `collection::scope > *`. HEAD reproduce el baseline (A02 PASSED) y A03 26/26 hojas de `logistics-recent-list`.

Descomposición a 1366×768 (chrome 304.61 px):

| Banda | Owner | y | Alto | Función |
| --- | --- | ---: | ---: | --- |
| App bar | `WorkspaceAppBar` (shell) | 0 | 55.33 | fuera de scope |
| Padding de `main` + borde de tarjeta | `.dashboard-main`, `ModuleCard` | 55.33 | 18.25 | compartido por 21 superficies |
| Header «Centro de logística» + chips Visitas/Rutas/Métricas | `LogisticsCommandCenter` | 73.58 | 45.5 | identidad + navegación |
| Gap | `gap-5` | — | 20 | — |
| Nota «Estado operativo logística» + `ModuleMetricRun` | `LogisticsCommandCenter` | 139.08 | 65.53 (97.53 < 1024) | aviso + KPIs (B14) |
| Gap | `gap-5` | — | 20 | — |
| Header «Visitas de campo» | `CardHeader` p-6/pb-3 | 224.61 | 80 | título + subtítulo |
| Primera fila | `CanonicalOperationalRow` | 304.61 | 44 | dato |

Capacidad: `floor((canvas + 6) / (pitch + 6))`, pitch 44 (40 con `max-height: 760px`), `maxItems 12`; reproduce las 26 hojas. Holgura antes del siguiente `limit` (A03): 1366 16.47 px, 1280 39.11, 1024 30.19, 834 48.45, 768 28.95; 1920 tope en 12.

Reducción necesaria: 1920 ≥ 75.27 px, 1366/1024 ≥ 58.85, **1280 ≥ 85.08** (celda que manda), 768 ≥ 18.80.

## Experimentos (CSS inyectado en Playwright, sonda temporal ya eliminada)

| Variante | Qué cambia (≥ 768) | Δ chrome ≥ lg / < lg | 5 celdas | Margen a 1280 | A03 Win32 |
| --- | --- | ---: | --- | ---: | --- |
| vA | header 40 + gap 12 + headers de tarjeta D-A 40 | −61.5 / −61.5 | ✗ 1280, ✗ 1920 | −23.58 | 14 hojas cambian |
| vB | vA + gap 8 + nota con padding reducido | −85.5 / −97.5 | ✓ | **0.42** (frágil) | 14 hojas |
| vC | vA + nota al pie | −139 / −171 | ✓ | 53.95 | 14 hojas |
| vD | vB + nota sin caja | −99.5 / −111.5 | ✓ | 14.42 | 14 hojas (+1/+2) |
| **vE** | header 40 + nota al pie | −91.03 / −123.03 | ✓ | **5.95** | **0 hojas** |

En vE el canvas sólo crece lo que libera el header (+5.5 px ≥ lg; +2.75 por tarjeta < lg), menos que la holgura mínima de cada viewport: ningún `limit` cambia.

## Diseño vE

Sólo clases `md:` en `LogisticsCommandCenter.tsx`; DOM, orden de lectura y de tabulación iguales; por debajo de 768 px el CSS efectivo es idéntico a la base.

| Nodo | Antes | Después |
| --- | --- | --- |
| Header «Centro de logística» | `… px-3 py-1.5` (45.5 px) | `+ md:h-[var(--dash-workspace-header-h)] md:flex-nowrap md:py-0` (40 px, token B11) |
| Nota «Estado operativo» | `surface-note-info shrink-0` | `+ md:order-last` (orden visual, debajo de las listas) |

- Auditoría rectora §7 permite «orden visual de zonas (sin alterar el flujo ni el orden de tabulación)»; la nota no contiene controles enfocables, así que el foco no cambia. El texto, el kicker y las tres métricas B14 siguen pintados; sin `sr-only`, sin `title`.
- No se usa `.dashboard-workspace-header` (oculta por la regla clínica dentro del workspace) ni se mueve `ModuleMetricRun` (CMP-05 lo ancla en teléfonos).

## Medición A02 (Win32)

| Viewport | Antes | Después | Límite | Cumple |
| --- | ---: | ---: | ---: | :---: |
| 1920×1080 | 315.27 px | 224.23 px | ≤ 240 px | ✓ |
| 1600×900 | 312.73 (34.75 %) | 221.70 (24.63 %) | — | — |
| 1440×900 | 312.73 (34.75 %) | 221.70 (24.63 %) | — | — |
| 1366×768 | 304.61 (39.66 %) | 213.58 (27.81 %) | ≤ 32 % | ✓ |
| 1280×720 | 315.48 (43.82 %) | 224.45 (31.17 %) | ≤ 32 % | ✓ |
| 1024×768 | 304.61 (39.66 %) | 213.58 (27.81 %) | ≤ 32 % | ✓ |
| 834×1194 | 348.86 (29.22 %) | 225.83 (18.91 %) | ≤ 32 % | ✓ |
| 768×1024 | 346.48 (33.84 %) | 223.45 (21.82 %) | ≤ 32 % | ✓ |
| 5 teléfonos | 245.69 · 245.59 · 245.48 · 278.84 · 278.77 | idéntico | — | — |

`frontend/e2e/fixtures/dashboard-geometry-baseline.ts`, `records` (Win32): 8 registros × 7 campos = 56 (`regions.collection.y`, `regions.collection.height`, `regions.primaryContent.y`, `regions.pager.y`, `derived.chromeBeforePrimaryContentPx`, `derived.chromeBeforePrimaryContentRatio`, `derived.collectionCanvasHeight`). Captura `VETNEB_A02_GEOMETRY_CAPTURE=1` diferenciada campo a campo contra PRE: ningún otro campo fuera de tolerancia; la sonda independiente midió los mismos 56 valores. Teléfonos y las otras 20 superficies, sin tocar. `platformRecords.linux`: overlay real en fase 2 (sección Linux).

## Tests

- `test/architecture/dashboard-c23-responsive-integral.test.ts`: ledger C23b de 11 a 7 celdas de banda y de 2 a 1 a 1920 (salen las 5 de `clinic-logistica-full`); contrato de fuente vE (header exacto `md:`, nota `md:order-last` sin `sr-only`/`hidden`, nota antes de las listas en el DOM, textos presentes, sin `title` nativo, B14 dentro de la nota, sin clase B11) con 7 mutaciones rechazadas. Se reutiliza el harness de mutación del archivo.
- Sin cambios en `frontend-dashboard-logistics-hub.test.ts` (sus anclas de texto siguen presentes).

## Validaciones Win32

Una tarea pesada por vez; `frontend/.next` borrado antes de las corridas E2E.

| Gate | Estado |
| --- | --- |
| Guards C23 (Win32), B10, B11, B14, C22 + unitarios del hub de Logística | PASSED salvo el ledger C23b en Linux (ver Linux) |
| `pnpm test` | FAILED 5404/5407 (1 skip): ledger C23b Linux (intencional) y `e2e-global-03b-authoritative-auth-boundary` (`DATABASE_URL`, ambiental y preexistente). Censos 01B verdes |
| Frontend `lint`, `typecheck`, `build`; raíz `typecheck`, `typecheck:test`; `security:public-surface` | PASSED |
| `pnpm validate:local` como cadena | NOT_RUN: su suite Node falla por las dos causas anteriores; piezas corridas por separado |
| A02 21×13 | PASSED 21/21 |
| A08 zero-scroll 21×13 | PASSED 21/21 |
| A05 32/48/64 | PASSED 15/15 |
| A03 15×13 serial (fixture sin cambios) | PASSED 16/16 (234 hojas) |
| Logística: alcance de acciones (teléfonos + 768), paridad móvil, C22 (incluye axe del hub), CMP-05, C23a, B10, B11, B14 | PASSED 203/203 |
| A02 Linux | Overlay aplicado desde el run `39310041309` (ver Linux); PASS remoto pendiente de E2E Completeness sobre el head que publique Nico |
| `e2e:full` | NOT_RUN (no pedido) |

## Linux (fase 2) — overlay A02 real

Causa raíz del bloqueo en el head `1ba2eb53310d3a05bf37e6103d73f3e57a4ccb82`: Win32 se realineó, pero `platformRecords.linux` conservaba la geometría previa de los 8 registros ≥ 768 de `clinic-logistica-full`; el ledger C23b (que ya no lista Logística) se evalúa sobre ambas plataformas, así que Backend CI fallaba con `linux: 768-1366 cells over 32 %` y E2E Completeness con `clinic-logistica-full: geometry drift` (thread P1 `PRRT_kwDOR5qlsc6uEXQj`).

Fuente: E2E Completeness run `39310041309`, job `118256950508`, head `1ba2eb53310d3a05bf37e6103d73f3e57a4ccb82`, chromium/linux; 1874 passed, 1 failed (A02 `clinic-logistica-full`). El sanitizer elimina el adjunto, así que se usan los valores `actual` del log: 56 líneas (8 viewports × 7 campos), idénticas en los tres intentos (168 líneas), cada `expected` igual al valor Linux versionado (56/56, 0 discrepancias), identidad de superficie, viewport (`innerWidth`/`innerHeight`) y campo verificada por script. Ningún teléfono ni otra superficie fuera de tolerancia.

| Viewport | collection.y | collection.height | primaryContent.y | pager.y | chromePx | chromeRatio | canvasHeight |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1920×1080 | 224.23 | 675.66 | 224.23 | 899.89 | 224.23 | 0.20762 | 675.66 |
| 1600×900 | 221.7 | 504.58 | 221.7 | 726.28 | 221.7 | 0.24633 | 504.58 |
| 1440×900 | 221.7 | 506.17 | 221.7 | 727.88 | 221.7 | 0.24633 | 506.17 |
| 1366×768 | 213.58 | 383.03 | 213.58 | 596.61 | 213.58 | 0.2781 | 383.03 |
| 1280×720 | 224.45 | 328.39 | 224.45 | 552.84 | 224.45 | 0.31174 | 328.39 |
| 1024×768 | 213.58 | 389.31 | 213.58 | 602.89 | 213.58 | 0.2781 | 389.31 |
| 834×1194 | 225.83 | 298.28 | 225.83 | 524.11 | 225.83 | 0.18914 | 298.28 |
| 768×1024 | 223.45 | 217.78 | 223.45 | 441.23 | 223.45 | 0.21821 | 217.78 |

(Ratios redondeados a 5 decimales en la tabla; el fixture conserva el valor serializado exacto del log.) Los 56 valores Linux observados coinciden campo a campo con los Win32; no se copió ninguno de Win32. Campos realineados en `platformRecords.linux`: los mismos siete de Win32; diff verificado campo a campo contra HEAD: 56 campos, 8 líneas, nada más. Se actualizó además el comentario de procedencia del fixture (la frase «Linux pending…» quedaba obsoleta).

Prueba causal (mutación controlada): con los 8 registros Linux revertidos a sus valores de HEAD, `dashboard-c23-responsive-integral.test.ts` FAILED 7/8 (`C23b ledger … linux: 768-1366 cells over 32 %`); restaurado el archivo propio (SHA-256 idéntico antes/después), PASSED 8/8.

Ledger tras el overlay, ambas plataformas (273 registros cada una): celdas sobre presupuesto = 7 de banda + 1 a 1920, todas `clinic-informes`/`clinic-informes-full`, iguales al ledger.

Invariancia: `frontend/e2e/fixtures/dashboard-adaptive-limit-baseline.ts` (A03, 234 hojas con `limit`/`offset`/capacidad) byte-idéntico a HEAD y a `main`; contratos A05/A08 sin cambios. En el run Linux de procedencia: A03 16/16, A08 21/21, A05 15/15 PASSED (evidencia del head `1ba2eb53`, no del head nuevo).

### Validaciones del overlay Linux (Win32 local, sobre el árbol con el overlay)

| Gate | Estado |
| --- | --- |
| `dashboard-c23-responsive-integral.test.ts` (vE + ledger, Win32 y Linux) | PASSED 8/8 |
| Mutante (8 registros Linux de HEAD) / restaurado | FAILED 7/8 como se espera / PASSED 8/8 |
| `e2e-suite-catalog-completeness.test.ts` | PASSED |
| `pnpm validate:local` | FAILED: `typecheck` y `typecheck:test` pasan; `test` 5405/5407 (1 skip) con un único fallo, `e2e-global-03b-authoritative-auth-boundary` (exige DB local `portal_vetneb_ci`; ambiental y preexistente); la cadena no llega a `build` |
| Raíz `build` (aparte) | PASSED |
| Frontend `typecheck`, `lint` | PASSED |
| Frontend `build`, `security:public-surface` | NOT_RUN: el cambio no toca `frontend/src` |
| A02 Linux local | BLOCKED: Win32 no puede ejecutar el baseline Linux; lo decide E2E Completeness en CI |
| A02/A03/A05/A08 Win32 | NOT_RUN: registros Win32 y fixtures A03/A05/A08 sin cambios desde las corridas de fase 1 |
| `e2e:full` | NOT_RUN (no pedido) |

Estado previo a CI final: sin PASS remoto del head nuevo; requiere los cuatro contextos required y E2E Completeness sobre el commit que publique Nico.

## Riesgos residuales

- Producto: el canvas no gana filas (vE no cambia `limit`); el aviso y los KPIs pasan al pie desde 768 px. Si se busca más densidad, vD es la alternativa medida (requiere R13 sobre A03).
- Margen a 1280×720: 5.95 px; depende del app bar de 68.11 px (B3). Corregir B3 lo amplía.
- La nota queda pegada al borde inferior de la tarjeta (borde contra borde); cosmético.
- Headers de tarjeta «Visitas de campo»/«Planes de ruta» siguen en 80 px (D-A no aplicado aquí para no tocar A03).
- Overlay Linux: sin evidencia remota del head nuevo hasta que corran Backend CI y E2E Completeness; el A02 Linux del resto de superficies sigue siendo el congelado previamente.

## Rollback

Revertir el commit squash: vuelven juntos las clases, el fixture y el guard. Sin datos ni backend.

## Incumplimientos C23b restantes

7 celdas de banda y 1 a 1920: `clinic-informes` (1280×720, 768×1024) y `clinic-informes-full` (5 + 1920). C23b no está completo.
