# C06 · useCollectionSelection: selección de colección

## Estado

**C06 = COMPLETE** en el estado publicado por este PR. La implementación runtime y sus pruebas quedaron validadas en el commit `f2e192a1a8617f177b752766f33eb4c45c040679`; el ajuste documental posterior no modifica runtime ni tests. La selección de página en móvil se resolvió con un host autorizado por Nico (ver «Bloqueo móvil histórico — RESUELTO»). La franja móvil existente aloja un checkbox nativo de página como slot presentacional de `AdminAuditFilterBar`, fuera del `<form>` S1 y sin lógica de selección en S1. La franja conserva 53 px, sin overflow ni overlap con «Filtros», y el target es de 36×36 en 320–767 px. No hay cambios de A03, `limit`, `offset`, pitch, canvas ni pager. E2E móvil: individual, múltiple, página parcial/completa, vaciado de página, persistencia entre páginas, teclado, foco, sin dialog, submit ni request, y axe; mutation proof de la página 5/5. Gates finales verdes (ver el rector).

## Owner

- **Ubicación:** `frontend/src/features/dashboard/presentation/surfaces/useCollectionSelection.ts`, único owner runtime. Es un módulo `"use client"` que sólo importa `react`, y se publica por `presentation/surfaces`.
- **API:** recibe `visibleIds` y devuelve `selectedIds` (copia), `selectedCount`, `isSelected`, `select`, `deselect`, `toggle`, `selectVisiblePage`, `toggleVisiblePage`, `clearSelection`, `allVisibleSelected` y `someVisibleSelected` (parcial).
- **Estado:** un `Set` de IDs, sin efectos ni requests, y sin re-render ante operaciones idempotentes.
- **Identidad:** el ID, nunca el índice. `1` y `"1"` son distintos y los duplicados visibles cuentan una vez.
- **Persistencia:** la selección sobrevive a los cambios de página y de dataset hasta `clearSelection`, que limpia globalmente.
- **Operaciones de página:** `selectVisiblePage` agrega sólo los `visibleIds`. `toggleVisiblePage` completa la página desde un estado parcial y, desde una página completa, deselecciona sólo los visibles.
- **Limpiar:** `clearSelection` limpia toda la selección en el hook (HOOK_CLEAR_SELECTION = PASS). El control visible para limpiar todo pertenece a la toolbar contextual de C07 (GLOBAL_CLEAR_UI = DEFERRED_TO_C07). En la UI actual, el checkbox de página vacía la página en desktop y tablet.

## Adopter: Auditoría admin, con un solo owner

`AdminAuditCard` crea la selección con `visibleIds` = los `row.id` renderizados (o `[]` si falla la carga). La comparten las dos formas de la colección.

**Tabla, ≥ 768 px:**
- Checkbox nativo de página: «Seleccionar los eventos de esta página», con la propiedad `indeterminate` real.
- Checkbox nativo por fila: «Seleccionar evento {id}».
- La fila seleccionada se marca con `data-state="selected"` sobre el skin existente de `TableRow`.
- Columna de 36 px sin overflow de 768 a 1920 px.

**Lista móvil, < 768 px:**
- Checkbox nativo por ítem con el mismo nombre accesible.
- Touch target de 36 × 36 dentro de la propia fila, con la marca `data-state="selected"`.
- Checkbox nativo de página («Seleccionar los eventos de esta página», con `indeterminate` real) en la franja móvil existente, mediante el slot presentacional `leadingSlot` de `AdminAuditFilterBar`, fuera del `<form>` S1.
- Sin cambios de pitch, canvas, pager ni filtros.

**Teclado y acciones:**
- Space alterna (comportamiento nativo) y Enter no hace nada.
- El orden de tabulación es selector → «Ver» en ambas formas.
- El selector nunca abre el detalle, y «Ver» no cambia la selección.
- No hay `onKeyDown`, ni `aria-selected` en filas, ni roles nuevos. El CSS se limita a clases de utilidad existentes.

## Bloqueo móvil histórico — RESUELTO

**Resolución final.** Nico autorizó usar la franja móvil existente como host visual. El checkbox nativo de página vive en el slot presentacional `leadingSlot` de `AdminAuditFilterBar`, fuera del `<form>` S1 y sin lógica de selección en S1. La franja sigue midiendo 53 px, sin overflow ni overlap con «Filtros», y el target es de 36×36 de 320 a 767 px. A03 drift = 0, `limit` y `offset` sin cambios, zero-scroll PASSED. El control no dispara submit, «Filtros», «Ver» ni requests. Mutation proof de la página: 5/5.

**Bloqueo original, conservado como registro.** Mediciones a 320×568, 360×800, 375×812, 390×844, 412×915, 430×932 y 767×1024.

**Composición real de la superficie móvil**, de arriba abajo:
1. `<form>` S1 oculto.
2. Franja de 53 px dentro de `AdminAuditFilterBar` (S1), con estado, métricas y «Filtros».
3. Canvas medido.
4. `AdminMobileOpsPager` de 40 px, compartido por 6 módulos.

No hay `WorkspaceHeader` en móvil.

**Holgura del canvas** (alto − ítems × pitch):

| Viewport | Holgura |
|---|---|
| 412×915 | 2,5 px |
| 320×568 | 2,9 px |
| 767×1024 | 19 px |
| 430×932 | 19,3 px |
| 390×844 | 19,7 px |
| 360×800 | 20 px |
| 375×812 | 31,8 px |

Todas quedan por debajo del touch target de 36 px. Un control de «seleccionar página»:
- dentro del canvas, resta capacidad (A03);
- en una fila nueva, encoge el canvas (A03);
- en la franja, invade S1;
- en el pager, usa el pager compartido como selector;
- en una toolbar, adelanta C07.

Con el contrato de ese momento, todas esas opciones estaban prohibidas. El bloqueo se cerró con la opción 1 (un host de altura cero en la franja móvil), sin reserva de capacidad, sin recaptura de A03 y sin C07.

## Censo

A0-06-SUPPORT = 411 en el árbol Git real. El unit C06, ya versionado, importa `test/helpers/tracked-source-files.ts`. El piso coincide con la realidad; no hubo cambio de umbral en esta etapa.

## Verificación (estado Git real, sin simulación)

| Gate | Resultado |
|---|---|
| Unit C06 + guard B11/C01–C06 + censo + `tracked-source-inventory` | PASSED: 60/60 sobre el estado Git real, y el guard B11 con la adopción móvil final da 24/24 |
| Mutation proof del owner | unit, 7/7 |
| Mutation proof del adopter | E2E, 10/10, restaurado por hash: identidad por índice, indeterminado ausente, selector que dispara «Ver», selector móvil ausente, selector móvil que desborda la fila; página móvil: control eliminado, `toggleVisiblePage` roto, indeterminado ausente, conexión a «Filtros», franja que crece |
| E2E `dashboard-b11-workspace-header` | PASSED 38/38 (21 C06). Desktop 1366×768: individual, múltiple, parcial/completa, vaciado de página, teclado, foco, «Ver», persistencia entre páginas y axe. Geometría desktop/tablet a 1920, 1280, 1024, 834 y 768 px. Móvil 390×844: individual, múltiple, página parcial/completa, vaciado de página, teclado, «Ver», persistencia entre páginas y axe. Geometría móvil en los 7 viewports, con franja de 53 px |
| A02 | PASSED 21/21 |
| A03 | PASSED 16/16 (195/195, 234/234), sin recaptura |
| A05 | PASSED 15/15 (corrida previa al checkbox de página móvil, que no cambia reservas) |
| A07 | PASSED: el owner único de capacidad está en los guards |
| A08 | PASSED 21/21 |
| Contratos zero-scroll | PASSED 66/66 |
| `e2e:admin-mobile` | PASSED 136/136 |
| `e2e:visual-contract` | PASSED 554, 1 omitido preexistente |
| Guards `test/architecture/**` + `test/unit/ui/**` | PASSED 2465/2466, 1 omitido preexistente |
| `e2e:verify-catalog` | PASSED 7/7 |
| Frontend lint, typecheck y build | PASSED |
| `typecheck:test` | PASSED |
| `security:public-surface` | PASSED |
| `git diff --check` | PASSED |
| `pnpm validate:local` / `pnpm test` completo | NOT_RUN: gates de backend; C06 no toca `server/` |
| Visual Linux | BLOCKED en Win32 |

## Riesgos residuales

- La UI para limpiar toda la selección está diferida a C07.
- La selección fuera de página es deliberada: C07 y C09 deben decidir el alcance de sus operaciones.
- P3 preexistente: un bloque `md:hidden` muerto en `AdminAuditDenseTable`.

## Rollback lógico

Revertir los commits C06 de este PR. Sin datos ni backend.
