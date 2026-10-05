# C07 · SelectionToolbar contextual

## Estado

**C07 = COMPLETE** en el árbol local, sobre `main@1d318059` (C06 #1819). `WorkspaceToolbar = DefaultToolbar ⇄ SelectionToolbar` (audit §8) queda implementado en Auditoría admin, en las dos formas de la colección y sobre el único owner C06. No crea franja nueva, no cambia la capacidad y no adelanta C08/C09.

## Owner

- **Ubicación:** `frontend/src/features/dashboard/presentation/surfaces/SelectionToolbar.tsx`. Es el único owner del swap, un módulo `"use client"` que se publica por `presentation/surfaces`.
- **API:** `selectedCount`, `onClearSelection` y `children` (la DefaultToolbar del host). No recibe `CollectionSelection` ni crea estado: lee el owner C06 sólo a través de esos dos valores.
- **Swap:** con `selectedCount === 0`, la toolbar devuelve `children` tal cual, sin wrapper. Con una selección, ocupa el mismo slot con un `div role="group" aria-label="Selección"` que contiene el contador (`aria-live="polite"`: «1 seleccionado» / «N seleccionados») y un botón «Limpiar» (`aria-label="Limpiar selección"`, `type="button"`).
- **Limpiar:** llama a `onClearSelection` (es decir, `clearSelection` de C06, que limpia toda la selección, también la que está fuera de la página) y mueve el foco al checkbox de página (`[data-collection-selection="page"]`) de la misma `section`, porque el botón se desmonta. Sin foco atrapado.
- **Botón:** mide 32 px de alto en ≥ 768 («acción de toolbar») y 40 px en < 768, igual que «Filtros» en la franja. En < 640 se muestra sólo el icono, con un mínimo de 40×40, para que el contador no se trunque a 320 px.

## Hosts reales del WorkspaceToolbar en Auditoría

No existe todavía un componente `WorkspaceToolbar` ni una franja canónica de 48 px. El swap ocurre dentro de los hosts existentes, cuya altura no cambia:

| Forma | Host | DefaultToolbar (sustituida) | Fuera del swap |
|---|---|---|---|
| Tabla (≥ 768) | `<header className="flex min-h-12 …">` de `AdminAuditCard`, que mide 57 px | métricas B14 + «N coincidencias» | título `h2` (`aria-labelledby` de la sección) |
| Lista (< 768) | Franja móvil de `AdminAuditFilterBar`, que mide 53 px | «Todos los eventos / Filtros activos» + métricas | checkbox de página C06 (`leadingSlot`) y «Filtros» |

`AdminAuditFilterBar` sólo recibe un slot presentacional, `renderToolbar(defaultToolbar)`. Lo renderiza después del `<form>` S1, entre el checkbox de página y «Filtros». La palabra `selection` sigue sin aparecer en S1.

## Fuera de alcance

C04 (orden), C05 (fila de 40 px, BLOCKED), C08 (menús), C09 (`BulkActionMenu` y acciones bulk), backend, API, DB, `limit`, `offset`, pager, pitch, reservas A03 y CSS. Tampoco se crea la franja canónica `WorkspaceToolbar` de 48 px, porque añadirla movería la capacidad A03.

## Verificación

| Gate | Resultado |
|---|---|
| Unit C06 + C07 (`dashboard-c06-collection-selection`) | PASSED 15/15 |
| Guards B11/C01–C07 (`dashboard-b11-workspace-header`) | PASSED 27/27 |
| Mutation proof de la toolbar (unit) | 6/6: swap invertido, swap eliminado, contador que no usa `selectedCount`, `onClearSelection` eliminado y foco no restaurado |
| Mutation proof de los adopters (guard) | 6/6: contador fijo, clear desviado, segunda toolbar, segundo owner en móvil, DefaultToolbar descartada y slot eliminado |
| E2E C06 + C07 (`dashboard-b11-workspace-header`, `-g C0[67]`) | PASSED 27/27 (C07: 13) |
| Geometría C07 | header de tabla 57 → 57 px, franja móvil 53 → 53 px, canvas sin cambio, sin overflow, sin overlap, contador sin truncar a 1920/1280/1024/834/768 y 767/430/412/390/375/360/320 px |
| A03 | PASSED 16/16 (234/234 hojas, 195/195 registros), sin recaptura |
| `e2e:visual-contract` (incluye A08 y contratos zero-scroll desktop) | PASSED 567, 1 omitido preexistente |
| `e2e:admin-mobile` | PASSED 136/136 |
| `dashboard-zero-scroll-mobile-boundary` | PASSED 8/8 |
| Guards `test/architecture/**` + `test/unit/ui/**` | PASSED 2470/2472: 1 omitido preexistente; `tracked-source-inventory` falla sólo con el preload que simula como tracked el owner nuevo (14/14 sin preload) |
| `pnpm test` completo (con el mismo preload) | 4788/4791: el artefacto del preload y `e2e-global-03b`, que exige `DATABASE_URL` (ambiental, ajeno a C07) |
| `e2e:verify-catalog` | PASSED 7/7 |
| Frontend lint, typecheck y build; `typecheck:test`; `security:public-surface` | PASSED |

## Riesgos residuales

- La selección fuera de página se cuenta y se limpia. C09 debe decidir el alcance de las acciones bulk.
- El contador se anuncia de forma polite sólo cuando cambia con la toolbar ya montada. La primera aparición la anuncia el checkbox que la provoca.

## Rollback lógico

Revertir el commit C07. Sin datos ni backend.
