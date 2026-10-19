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

`frontend/e2e/fixtures/dashboard-geometry-baseline.ts`, `records` (Win32): 8 registros × 7 campos = 56 (`regions.collection.y`, `regions.collection.height`, `regions.primaryContent.y`, `regions.pager.y`, `derived.chromeBeforePrimaryContentPx`, `derived.chromeBeforePrimaryContentRatio`, `derived.collectionCanvasHeight`). Captura `VETNEB_A02_GEOMETRY_CAPTURE=1` diferenciada campo a campo contra PRE: ningún otro campo fuera de tolerancia; la sonda independiente midió los mismos 56 valores. Teléfonos y las otras 20 superficies, sin tocar. `platformRecords.linux`, sin tocar.

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
| A02 Linux | BLOCKED: requiere una ejecución real de E2E Completeness sobre el head publicado |
| `e2e:full` | NOT_RUN (no pedido) |

## Linux (fase 2)

El guard C23b queda rojo en Linux (`linux: 768-1366 cells over 32 %`) hasta realinear los mismos 8 registros × 7 campos de `platformRecords.linux` desde el log de un run real de E2E Completeness (mismo procedimiento que PR1). A03 Linux no debería cambiar; se verifica en ese mismo run.

## Riesgos residuales

- Producto: el canvas no gana filas (vE no cambia `limit`); el aviso y los KPIs pasan al pie desde 768 px. Si se busca más densidad, vD es la alternativa medida (requiere R13 sobre A03).
- Margen a 1280×720: 5.95 px; depende del app bar de 68.11 px (B3). Corregir B3 lo amplía.
- La nota queda pegada al borde inferior de la tarjeta (borde contra borde); cosmético.
- Headers de tarjeta «Visitas de campo»/«Planes de ruta» siguen en 80 px (D-A no aplicado aquí para no tocar A03).

## Rollback

Revertir el commit squash: vuelven juntos las clases, el fixture y el guard. Sin datos ni backend.

## Incumplimientos C23b restantes

7 celdas de banda y 1 a 1920: `clinic-informes` (1280×720, 768×1024) y `clinic-informes-full` (5 + 1920). C23b no está completo.
