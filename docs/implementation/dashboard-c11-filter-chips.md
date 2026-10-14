# C11 · FilterChip, FilterOverflow y ActiveFilterChips

## Estado base y contrato

Rama `feat/dashboard-c11-filter-chips`, basada en `067996dc` (C10, PR #1866), sin divergencia con `origin/main`. El roadmap `AUDITORIA_GLOBAL_DASHBOARD_VETNEB_VS_DRIVE.md` asigna a C11 los chips, el overflow y los filtros activos (§50, §47.1), con P1-02, P1-03 y P2-11, y absorbe SB-04, SB-05, SB-08 (parte de chips), SB-09, SB-11 y SB-12 (§51.1). §46 fija el chip: 32 px de alto, ancho `clamp(96px, auto, 160px)`, padding `0 12px`, radio 8, borde 1 px `outline`, sin sombra, body-sm w500, tolerancia ±2; la región de filtros mide 56 px y el objetivo táctil bajo 768 px es ≥ 44 px. §45.2 exige foco con `outline` real. §60 (R6, R7) exige que todo filtro siga alcanzable y que el overflow tenga teclado completo y axe. C12 (`AdvancedFilterSheet`) queda fuera.

## Auditoría de filtros S1–S7

| Superficie | Autoridad | Aplicación | Limpieza | Paginación |
|---|---|---|---|---|
| S1 Auditoría | query string (`<form method="get">`) | submit nativo | navegación a `?module=audit-log` sólo con filtros | vía URL |
| S2 Tokens admin | `filterDraft` + `appliedFilters` locales | `Aplicar` | `INITIAL_FILTER_STATE` en draft y aplicados, sólo con filtros | `setPage(0)` |
| S3 Informes admin | idem | `Aplicar` | idem, siempre | `setOffset(0)` |
| S4 Clínicas | `searchQuery` local | al cambiar (debounce) | — | — |
| S5 Usuarios y roles | `searchQuery`, `userType`, `role` | al cambiar (debounce en texto) | — | `setOffset(0)` en selects y búsqueda confirmada |
| S6 Informes clínica | draft + aplicados | `Aplicar` | siempre, cierra el diálogo | `setPage(0)` |
| S7 Tokens clínica | draft + aplicados | `Aplicar` | siempre | `setPage(0)` |

Ninguna superficie tiene una operación de retirada individual; las limpiezas globales tienen efectos distintos (navegación, reset de draft y aplicados, cierre de diálogo). Las fechas mantienen la semántica protegida de §7.4. Los componentes reutilizables existentes son `FilterBar`/`FilterField`, el `ActionMenu` de C08 y el `SuperSearchField` de C10.

## Decisión de adopción

Adoptar C11 en una superficie productiva exigiría inventar la retirada individual (qué campo vaciar, si se toca el draft, si se reinicia la página o se navega), algo que §7.8 prohíbe. El roadmap asigna la migración de módulos a C18–C22 y no designa un consumidor C11. Por eso C11 publica primitivas controladas y las verifica en un arnés dentro del `WorkspaceScaffold` real de Auditoría, junto al campo C10. **No son visibles en producción**. P1-02 y P1-03 quedan resueltos a nivel de primitiva (una fila de 56 px con capacidad medida) y se cierran en cada superficie cuando la adopte.

## API

- `ActiveFilter = { id, label, value, onRemove?, disabled? }`. `id` debe ser estable, único y no vacío; un id vacío o repetido lanza un error (fail-closed), porque claves, foco y overflow dependen de él.
- `FilterChip({ label, value, onRemove?, removeLabel?, disabled? })`: sin `onRemove` es de sólo lectura. El botón de quitar se nombra `"{removeLabel} {label}: {value}"`, y el texto completo queda en el DOM y en `title` aunque se trunque visualmente.
- `FilterOverflow({ filters, onClearAll?, clearAllLabel?, removeLabel?, disabled? })`: compone `ActionMenu`/`ActionMenuItem` de C08. El disparador `+N` se nombra `"+N filtros activos"`; cada filtro oculto es un ítem que lo quita, o un ítem deshabilitado si el filtro no es removible.
- `ActiveFilterChips({ filters, onClearAll?, clearAllLabel?, removeLabel?, label?, disabled?, returnFocusRef?, className? })`: es un `role="group"` con una lista de chips. Sin filtros no renderiza nada. La limpieza global aparece sólo si el consumidor pasa `onClearAll`.

## Owner de estado y overflow

El consumidor es el único dueño de los filtros: el componente los lee en cada render y no los guarda. Sólo conserva estado de UI: cuántos chips caben, el ancho reservado para el disparador y la intención de foco tras una retirada. No hay fetch, URL, router, temporizadores ni almacenamiento.

Política de overflow: una capa de medición inerte (`aria-hidden`, `inert`, `visibility:hidden`, de tamaño 0) renderiza los mismos chips, el disparador y la limpieza global. Con el ancho real de la fila (`ResizeObserver`), el componente muestra en orden el prefijo más largo que cabe junto al disparador y la limpieza global. El resto pasa, en orden, al menú. Si no cabe ningún chip, la limpieza global también pasa al menú y la fila sólo reserva el ancho del disparador. Escape, la navegación con flechas, Home/End, Tab y el cierre al redimensionar siguen siendo de C08.

Foco: si el control con foco desaparece tras una retirada, el foco pasa al chip que ocupa el mismo índice, luego al último chip, luego al disparador y por último a `returnFocusRef`. Tras retirar desde el menú, el foco va al disparador si sigue presente. Tras la limpieza global va a `returnFocusRef`. Si el consumidor no retira el filtro, el foco no se mueve.

## Archivos

- `frontend/src/features/dashboard/presentation/filters/FilterChip.tsx`, `FilterOverflow.tsx` y `ActiveFilterChips.tsx` (nuevos); `filters/index.ts` (exports).
- `test/architecture/dashboard-c11-filter-chips.test.ts`: guard + mutation proof.
- `frontend/e2e/regression/dashboard-c11-filter-chips.spec.ts` (nuevo) y `frontend/e2e/suites/catalog.ts` (entrada `visual-contract`).
- Realineaciones autorizadas por Nico:
  - anclas de catálogo en `e2e-suite-catalog-completeness.test.ts` y `e2e-completeness-workflow.test.ts` (+1 spec);
  - adopción canónica 423→424 y re-anclaje de la banda LOC de `frontend/e2e/**` 43756→54817 (sin ampliar la tolerancia) en `test-global-01b-census-contract.test.ts`;
  - excepción estrecha del guard C08 en `dashboard-b11-workspace-header.test.ts`: `FilterOverflow.tsx` sólo puede nombrar `ActionMenu`.

## Validación

- **Guard C11.** RED antes de la implementación (fuentes inexistentes); GREEN 2/2 después. Mutation proof en memoria con 7/7 mutaciones detectadas: export retirado, menú propio, dominio/URL, `role="menu"` propio, copia de filtros, radio y sombra.
- **E2E C11.** 9/9 tests, cada uno repetido en `next dev` (×5) y en `next start` (×3), todos en verde. Los tests cubren:
  - de cero a ocho filtros, en orden;
  - un callback por clic, Enter o Space, y Escape neutro;
  - orden de tabulación, foco visible (outline ≥ 2 px) y restauración de foco;
  - overflow por teclado (flechas, Escape) y por puntero;
  - etiquetas largas (≤ 160 px, nombre completo), disabled por filtro y global, identidades inválidas y axe con el menú abierto y cerrado;
  - geometría en 1920×1080, 1366×768, 1280×720, 834×1194, 768×1024, 390×844 y 320×568, más un redimensionado A-B-A en caliente: chips de 32 px (44 px bajo 768), 96–160 px, radio 8, borde 1 px, sin sombra visible, región de 56 px, sin desborde del documento según `MAX_DOCUMENT_SCROLL_DELTA_PX`, sin solapes, todos los filtros alcanzables y objetivos táctiles ≥ 44 px.
- **Mutation proof en navegador.** Sin restauración de foco → rojo. Sin cálculo de capacidad → 7/7 geometrías en rojo. Al restaurar, verde.
- **Compatibilidad.** B15, C08, C09, C10 y C11 bajo `next start`: 132/132 (×3). A02, A05 y A08 PASSED. A03 PASSED 16/16 en corrida aislada (195 registros primarios / 234 hojas); en la corrida concurrente previa falló `admin-failed-login-alerts` por timeout de concurrencia, una superficie que C11 no toca.
- **C10 en `next dev`.** Falla de forma intermitente (5/36) con el barrel idéntico a HEAD: su arnés se inyecta antes de que termine la hidratación. Es preexistente y no aparece bajo `next start`. El arnés C11 espera la hidratación de `<main>` y no la sufre.
- **Gates.** Frontend lint, typecheck y build, `typecheck:test`, `security:public-surface`, `e2e:verify-catalog` 7/7, build backend y `git diff --check`: PASSED. `pnpm test`, con los archivos nuevos simulados como trackeados: 5330 PASSED, 1 SKIPPED y 1 FAILED ambiental (`e2e-global-03b`, sin DB aislada). Por esa precondición, `validate:local` queda BLOCKED.

## Scope, riesgo y rollback

Fuera de scope: los superbuscadores S1–S7, backend, DB, dependencias, CI, navegación, C04/C05, C12–C26 y las primitivas C08/C09/C10 (C10 no se modifica).

Riesgos residuales:
- Cada adopción (C18–C22) debe decidir su operación de retirada individual dentro de §7.8 y probar el `limit` de A03.
- Si el menú está abierto y un redimensionado lo cierra (C08), el foco vuelve al disparador; si ese disparador desaparece porque ahora caben todos los chips, el foco no se restaura.
- La capa de medición duplica los chips en el DOM (inerte y oculta).

Rollback: retirar los archivos C11, su export, la entrada de catálogo y las realineaciones listadas. Ningún dato ni contrato de consulta requiere rollback.
