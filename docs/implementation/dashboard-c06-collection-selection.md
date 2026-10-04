# C06 · useCollectionSelection: selección de colección

## Estado

**C06 = BLOCKED; no es COMPLETE.**

- Implementación local completa en desktop y tablet (≥ 768 px): owner único y adopter en la tabla de Auditoría.
- Bloqueo 1: la selección de página en móvil (< 768 px) no tiene host autorizado que no mueva A03.
- Bloqueo 2: la validación canónica depende de versionar tres archivos nuevos, y su stage no está autorizado.

C04 = NOT_STARTED/DEFERRED · C05 = BLOCKED · C07+ = NOT_STARTED · NEXT_SLOT = C04 (sin cambios).

## Base y alcance

- Base: `main` / `origin/main` en `21971134cfb238f388b1827feb047f313ed16b0b` (#1818).
- Rama local `feat/dashboard-c06-collection-selection`, sin worktree.
- Preservados: los untracked `frontend/AGENTS.md` y `frontend/CLAUDE.md` y los 5 stashes.
- Único `AGENTS.md` versionado: el raíz.

C06 (§50, nivel 8) depende sólo de C01 y se ejecutó antes que C04 por instrucción explícita de Nico. Introduce el modelo reutilizable de selección y un adopter real; no introduce operaciones sobre lo seleccionado.

No alcance:
- `SelectionToolbar` (C07).
- Menús (C08).
- `BulkActionMenu` (C09).
- Orden y `aria-sort` (C04).
- Pitch, reservas, capacidad y `limit` (C05/A07).
- Migración de módulos (C17+).
- Backend, API, auth, DB, dependencias, workflows y PWA.

## Skills

| Skill | Cargada | Rol | Uso real |
|---|---|---|---|
| `vetneb-briefing-planificacion-diseno-desarrollo-pruebas` | Sí | PRIMARY | Recorte de C06 frente a C04/C05/C07–C09 y criterios de cierre |
| `vetneb-staff-senior-full-stack-engineer` | Sí | PRIMARY | Owner del estado, API mínima, identidad por ID |
| `vetneb-admin-dashboard-operational-actions` | Sí | SECONDARY | Selección ≠ acción: «Ver» y paginación intactos |
| `vetneb-web-end-to-end-global` | Sí | SECONDARY | Teclado, foco, axe y E2E sobre un consumidor real |
| `vetneb-bugs-errores-optimizacion-rutas` | No | OFF | Sin bug preexistente causal |
| `vetneb-production-web-optimization-engineer` | No | OFF | Sin evidencia de performance |
| `vetneb-security-production-invariants` | No | OFF | C06 no toca auth ni permisos |

Contradicción: las skills listan `gh pr merge --squash --delete-branch`; AGENTS.md §5.9 lo prohíbe y prevalece.

## Censo

Ninguna colección tenía selección real (coincide con §18 y P1-16). Los `aria-selected` existentes son de tabs y listbox; los `selected*Id` son ítems de detalle.

Las 12 superficies de la fila C06–C09 de §54 son las 12 colecciones de §18. Su migración es C17–C22, así que C06 entrega la infraestructura más un adopter.

Auditoría es el único consumidor de las primitivas C01 que tiene paginación por servidor medida por A03/A05 y una acción primaria por fila.

## Arquitectura y semántica

Firma del owner:

```ts
useCollectionSelection<Id extends string | number>({ visibleIds }): {
  selectedIds; selectedCount; isSelected(id); select(id); deselect(id); toggle(id);
  selectVisiblePage(); toggleVisiblePage(); clearSelection();
  allVisibleSelected; someVisibleSelected;
}
```

- **Estado:** un `ReadonlySet<Id>` en `useState`.
- **Sin efectos colaterales:** sin efectos, refs, requests, `sort`, `limit` ni `offset`.
- **Transiciones idempotentes:** devuelven el mismo set si no cambian nada, sin re-render.
- **Página:** son sólo los `visibleIds`. `toggleVisiblePage` completa la página desde parcial y, desde completa, deselecciona sólo los IDs visibles.
- **Indeterminado:** `someVisibleSelected` significa parcial.
- **Persistencia:** cambiar de página o de dataset no borra la selección; sólo `clearSelection` limpia. El rector no fijaba esta política; es contrato C06.
- **Identidad:** el ID, nunca el índice. Un duplicado cuenta una vez y no hay coerción entre `1` y `"1"`.
- **Sin agregar:** `isSelectable` y el modo controlado, porque ningún consumidor real los necesita.

## Adopción desktop y tablet

Tabla de Auditoría:
- `AdminAuditCard` es dueño del estado; `visibleIds` son los `row.id` renderizados, y `[]` con error de carga.
- `AdminAuditDenseTable` agrega la columna de selección `w-9`.
- Checkboxes nativos de 18 px: uno de página, con indeterminado real vía la propiedad DOM, y uno por fila.
- Nombres accesibles: «Seleccionar los eventos de esta página» y «Seleccionar evento {id}».
- La fila seleccionada usa el `data-state="selected"` del `TableRow` existente. Cero CSS nuevo.

Teclado y foco:
- Space alterna (comportamiento nativo). Enter no alterna ni abre el detalle.
- Tab recorre: checkbox de página, y en cada fila selector → «Ver». El foco visible es el nativo.
- No hay `onKeyDown`, ni `aria-selected` en `tr`, ni roles nuevos.

Acción primaria: «Ver» sigue igual y el selector no la dispara.

## Bloqueo 1 — móvil (< 768 px)

**Causa exacta.** El DOM real de Auditoría móvil, medido a 320 × 568, 360 × 800, 375 × 812, 390 × 844, 412 × 915, 430 × 932 y 767 × 1024, se compone de:

1. `<form>` S1 oculto.
2. Franja de 53 px, renderizada por `AdminAuditFilterBar`, con el estado del filtro, las métricas B14 y el botón «Filtros».
3. Canvas medido por `useDashboardCanvasCapacity`.
4. Pager `AdminMobileOpsPager` de 40 px, compartido por 6 módulos.

A eso se suman dos datos medidos:
- En móvil no se renderiza `WorkspaceHeader`.
- La holgura del canvas (alto − filas × pitch) es de 2,5 px a 412 × 915, 2,9 px a 320 × 568 y como máximo 31,8 px (375 × 812).

Por lo tanto:
- Un control de «seleccionar página» dentro del canvas resta capacidad.
- Una fila nueva fuera del canvas lo encoge.
- En ambos casos el `limit` de A03 cambia.
- El único host de altura cero es la franja de filtros.

Nico no autorizó ninguna de las salidas: ocupar `AdminAuditFilterBar`/S1, mover cabecera o canvas, alterar reservas, capacidad, `limit` u `offset`, recapturar A03 ni adelantar C07. La lista móvil queda sin selección, sin cambios en su DOM.

**Lo que haría falta para completarlo (no diseñado ni implementado aquí).** Una de estas opciones, cada una con autorización explícita de Nico:

- **(a)** Un host de altura cero autorizado en la franja móvil del módulo, hoy dentro del archivo de S1.
- **(b)** Un contrato de reserva de capacidad para una cabecera de selección móvil, con recaptura autorizada de A03 (y A02/A05/A08 si cambian).
- **(c)** Una arquitectura de cabecera o toolbar contextual móvil (dominio de C07) que aloje el control. Exige reordenar el roadmap.

## Bloqueo 2 — validación canónica

Archivos nuevos untracked:
- `frontend/src/features/dashboard/presentation/surfaces/useCollectionSelection.ts`
- `test/unit/ui/dashboard/dashboard-c06-collection-selection.test.ts`
- `docs/implementation/dashboard-c06-collection-selection.md`

El lector canónico (`test/helpers/tracked-source-files.ts`) rechaza archivos no versionados por contrato.

Sobre el árbol real, sin preload ni tracked-state simulado, `test/architecture/**` + `test/unit/ui/**` dan 2 379 tests en PASSED, 1 omitido y 69 en FAILED. Los 69 se explican así:

- **48:** `source path is not a git-tracked file` del owner, en guards que recorren `frontend/src`.
- **17:** el mismo error para el unit C06, que el censo y otros guards de `test/**` leen.
- **1:** fallo a nivel de archivo de `dashboard-capacity-single-owner`, por el mismo rechazo del owner.
- **3:** censo 05A/01B. El piso de adopción es 411 y el corpus tracked real da 410.

Ningún fallo tiene otra causa. Se clasifican como BLOCKED: la precondición es versionar los tres archivos, y eso requiere autorización de Nico. `tracked-source-inventory` pasa 14/14 en el árbol real y no se modificó.

Una sesión anterior verificó esos guards con un preload que hacía visibles los archivos en `git ls-files`. Ese resultado era diagnóstico y no constituye gate de cierre.

## Censo 410 → 411

La métrica `A0-06-SUPPORT` · «importadores de helpers/tracked-source-files.ts» (`supportConsumerCensus`) cuenta los `.ts` tracked bajo `test/` cuyo `import` real resuelve a `test/helpers/tracked-source-files.ts`. Es un piso `NON_DECREASING`, y el contrato fija además el valor vigente exacto.

- El unit C06 importa `readSourceFile` desde ese helper: aporta exactamente +1.
- Ningún otro archivo de C06 cambia esa relación: el guard B11 ya lo importaba y no hay otros `.ts` untracked bajo `test/`.
- Pertenece legítimamente a la población: es un spec que lee source por el lector canónico.

Se mantiene, porque sin el realineo el censo quedaría en rojo (411 ≠ 410) en cuanto el test se versione. No se tocó el detector ni otro umbral. Hoy, con el test untracked, esas 3 aserciones dan 410 y quedan BLOCKED con la misma precondición.

## Verificación sobre el árbol real

Gates en PASSED:
- E2E `dashboard-b11-workspace-header.spec.ts`: 31/31, de los que 7 son C06.
  - A 1366 × 768: individual, múltiple, deselección, Space/Enter/Tab y foco visible; axe WCAG 2.1 A/AA sin violaciones con la página parcial; página completa por teclado y vaciado por click; «Ver» intacto; cero requests por selección.
  - Paginación: la página siguiente no tiene IDs seleccionados, y al volver se restauran la selección y el indeterminado. `limit` constante.
  - Geometría a 1920, 1280, 1024, 834 y 768 px: sin overflow, filas = pitch, cabecera 32 px.
  - A 390 px: sin selectores y A08 sin cambios.
- Mutation proof E2E (mutación temporal, restaurada con hash verificado): identidad por índice, selector sin toggle e indeterminado ausente hacen caer el spec.
- A02 21/21; A03 16/16 (195/195, 234/234, sin recaptura); A05 15/15; A08 21/21.
- Contratos zero-scroll: 66/66.
- `e2e:admin-mobile`: 136/136.
- `e2e:visual-contract`: 547 en PASSED, 1 omitido preexistente.
- `e2e:verify-catalog`: 7/7.
- `tracked-source-inventory`: 14/14.
- Frontend lint, typecheck y build, `pnpm typecheck:test`, `pnpm security:public-surface` y `git diff --check`.

Gates BLOCKED (precondición: versionar los archivos nuevos):
- Unit C06, con sus 7 mutaciones en memoria.
- Bloque C06 y cercos del guard B11.
- Censo 05A.
- Los guards que recorren `frontend/src`.

Otros:
- NOT_RUN: `pnpm validate:local` y `pnpm test` completo (gates de backend).
- BLOCKED: regresión visual Linux, porque no se puede ejecutar en Win32.

Realineos causales hechos en este PR:
- `dashboard-real-app-shell-no-scroll-contract` anclaba la primera celda como dato. Ahora exige el selector en la primera celda y Fecha no vacía en la segunda.
- Cercos C01–C03 del guard B11: `useCollectionSelection` deja de ser símbolo futuro. `SelectionToolbar`, `BulkActionMenu` y `aria-sort` siguen prohibidos.

## Riesgos residuales

- Móvil sin selección (bloqueo 1). Una selección hecha en la tabla persiste en el estado si el viewport se reduce, sin efecto visible.
- No hay UI de limpiar global: el checkbox de página vacía sólo la página.
- La selección fuera de página es deliberada. C07/C09 deben decidir el alcance de sus operaciones.
- P3 preexistente: `AdminAuditDenseTable` conserva un bloque `md:hidden` que nunca se ve.

## Rollback lógico

1. Quitar el owner, su export, el unit C06 y este documento.
2. Restaurar `AdminAuditCard.tsx` y `AdminAuditDenseTable.tsx` a `21971134`.
3. Retirar los bloques C06 del guard y del spec B11, y devolver `useCollectionSelection` a los cercos C01–C03.
4. Revertir el realineo de real-app-shell, el piso 411 del censo y la descripción del catálogo.

No requiere tocar datos ni backend.
