# C20 · Migración administrativa, lote 3: Precios · Mantenimiento · Estado del sistema · Resumen

## Estado base, alcance y auditoría previa

Base `597eb838d5dd64e038631a25faaea92ae5b39f7c` (C19 integrado, #1883) en `feat/dashboard-c20-admin-batch-3`, igual a `origin/main`. Árbol tracked limpio; se preservaron los dos untracked previos (`frontend/AGENTS.md`, `frontend/CLAUDE.md`, generados por `next dev`), los cinco stashes y el único worktree. Sin `AGENTS.md` anidados tracked. No se ejecutaron escrituras Git ni GitHub.

Scope: presentación de los cuatro módulos del lote (§53 del roadmap: «colecciones no tabulares, casos especiales») sobre las primitivas existentes C01–C16, sus guards realineados, un spec E2E y este registro. Fuera de scope: backend, endpoints, AuthN/AuthZ, DB, dependencias, configuración, CSS/tokens, FSM de navegación, primitivas compartidas (no se modificó ningún owner C01–C19), `page.tsx` y C21.

Criterio rector (el de C18/C19): **sólo se adopta una primitiva si es geométricamente neutra** frente a A02 y A03 y si no cambia la semántica de la superficie. Ninguna superficie no tabular se convirtió en tabla.

## Mapa de adopción

| Módulo | Adoptado | No adoptado y causa |
| --- | --- | --- |
| Precios (escritorio) | C01 `CollectionWorkspace` como canvas medido de los formularios (ya era columna flex `min-h-0`); C01 `ContentList as="div" className="contents divide-y …"` alrededor de las filas (el separador se mide en el pitch); C02 `CollectionPager variant="compact"` en lugar de su adaptador `CompactPager` (DOM idéntico, probado por `dashboard-stable-geometry-reservation`); C03 para error (`tone="warning"`, conserva `role="alert"`), carga (conserva «Cargando precios...», que A02 espera) y vacío | `ContentListItem`: cada fila es un `<form>` nativo con submit; C01 no tiene variante `form` y envolverlo agregaría 1 px por fila. `CollectionHeader`: la cabecera de columnas es una fila `aria-hidden` de una grilla, no un `thead`. C10/C11/C12: no hay búsqueda ni filtros que representar. C06/C07/C09: «Guardar todos» ya opera sobre los ítems modificados; inventar selección viola §7.8 |
| Precios (móvil) | C01 `ContentList` `contents` en el catálogo (los botones siguen siendo ítems flex del canvas con gap); C03 para carga y vacío («Sin precios configurados.», que A02 rechaza como estado cargado) | Las filas son el `<button>` que selecciona el estudio; `ContentListItem` no tiene variante `button`. El error queda como texto (no había anuncio y agregar un `alert` aquí es un cambio de comportamiento ajeno a la migración). Los dos `AdminMobileOpsPager` siguen igual |
| Mantenimiento (escritorio) | El canvas medido **es** el `ContentList` (A03 cuenta `[data-admin-maintenance-candidates-list] > *`, así que no se interpone ningún envoltorio); cada grupo es `ContentListItem as="div"`; C02 compact directo; C03 para el error del dry-run (ahora anunciado con `role="alert"`; antes era una banda muda) y para el estado inicial | Totales: cuatro métricas, no una colección. Sólo se llama al endpoint dry-run; ninguna acción destructiva |
| Mantenimiento (móvil) | Canvas = `ContentList`, filas = `ContentListItem` con el marcador A03 intacto; C03 para «Analizando…», «Sin análisis ejecutado», «Sin candidatos de limpieza.» y la carga del esquema («Consultando estado de esquema…», que A02 espera) | Errores como texto, igual que C19 |
| Estado del sistema | `AdminSchemaHealthStatusCard` (compartida con la pestaña Esquema de Mantenimiento): C03 para la carga (mismo texto); columnas faltantes como `ContentList as="ul"` + `ContentListItem as="li"`. Móvil: la lista de servicios es `ContentList`/`ContentListItem` sobre la misma grilla de filas iguales; C03 para la carga del esquema | Error del esquema: se conserva `.clinical-alert-error` con `role="alert"` porque es el detector de error de la matriz A02 (`CLINICAL_ERROR_ALERT`) y la sanitización `HTTP …`. Runtime: cuatro métricas. Servicios de escritorio: grilla server-rendered en `page.tsx`; adoptar C01 metería el barrel cliente de `surfaces` en la página de servidor sin ganar comportamiento |
| Resumen | Ninguna primitiva de colección: métricas (`role="group"`), notas y accesos rápidos (`nav`) no son una colección. La pestaña Alertas ya usa la tarjeta migrada en C19 | `DetailsMetadata` (C13) reemplaza la geometría de las tarjetas por una `dl` en columna; `StatusBadge` cambia la paleta de estado. Ambas alteran A02 |

Geometría: `CollectionWorkspace` y `ContentList` sólo agregan `data-*` y, en el primer caso, reglas que el canvas ya declaraba; los envoltorios `contents` no generan caja. Pitch, gap, reservas de pager y capacidades no se tocaron. Los textos de carga que la matriz A02 usa como `forbidden` se conservan como `label` de C03.

## Archivos

Producto: `frontend/src/app/dashboard/admin/AdminPricingEditorCard.tsx`, `AdminMobilePricingModule.tsx`, `AdminMaintenanceDryRunCard.tsx`, `AdminMobileMaintenanceModule.tsx`, `AdminSchemaHealthStatusCard.tsx`, `AdminMobileHealthModule.tsx`.

Pruebas nuevas: `test/architecture/dashboard-c20-admin-batch-3.test.ts` (guard + 12 mutaciones), `frontend/e2e/admin/shell/admin-c20-batch-3.spec.ts` (cohorte `visual-contract`, capa `mocked`).

Guards realineados en el mismo PR, sin debilitar: B11 (censos C01 y C03 con los seis archivos; C02: los dos consumidores compactos pasan al owner y se exige que mantengan `variant="compact"` y `usePagedRows`), `dashboard-capacity-single-owner` (la reserva de pager reconoce `CollectionPager`, el owner al que delegan los dos nombres legacy), `frontend-admin-pricing-card` y `frontend-admin-maintenance-dry-run-card` (anclas del pager y del estado; el oráculo del error ahora exige el `CollectionState variant="error"` con `message={error}` sólo con error), catálogo E2E 119→120 (admin 24, mocked 45, visual-contract 42, ci 89, full 120), `e2e-completeness-workflow` 120 y censo 05A de importadores del lector canónico 431→432.

## RED → GREEN

El guard C20 aplicado a los fuentes de `HEAD` (leídos con `git show`) falla 2/2 con 31 violaciones; sobre el árbol C20 pasa 2/2 y rechaza sus 12 mutaciones. El spec E2E se probó por mutación temporal: quitar el `divide-y` de la lista de Precios y cambiar el título del error del dry-run hacen fallar las 2 pruebas afectadas; las fuentes se restauraron por copia (sha1 verificado).

## Validaciones

| Gate | Estado |
| --- | --- |
| Guard C20 | PASSED 2/2 (RED 2/2 sobre `HEAD`, 31 violaciones) |
| Tests Node dirigidos (17 archivos que anclan los módulos y las primitivas, más los censos con tracking simulado) | PASSED |
| Suite Node completa con los dos archivos nuevos simulados como trackeados | FAILED 5375/5377 (1 skip): sólo Auth 03B, que exige `DATABASE_URL`; ambiental y preexistente |
| Frontend `lint`, `typecheck`, `build`; `security:public-surface`; raíz `typecheck:test` | PASSED |
| `pnpm validate:local` como cadena | NOT_RUN: su suite Node falla por la precondición ambiental Auth 03B; sus piezas se ejecutaron por separado |
| E2E C20 | PASSED 7/7 (mutación: 2/2 RED) |
| A02 `admin-resumen`, `admin-estado`, `admin-precios`, `admin-mantenimiento` y A03 `admin-pricing`, `admin-maintenance` (baselines sin cambios) | PASSED 6/6 |
| Regresión dirigida: medición de Precios, config/status móviles, zero-scroll interno, app shell real, frontera móvil, A08, cold-load sentinel, B11, visibilidad del shell | PASSED 190/190 |
| C17/C18/C19/C20, FSM de navegación admin y matriz de fallos (C10/D10), teclado | PASSED 125/125 |
| `e2e:admin-mobile` | PASSED 159/159 |
| `e2e:visual-contract` y `e2e:extended` completas | NOT_RUN: se ejecutaron sus specs afectados |
| `e2e:full` | NOT_RUN (baselines pixel Chromium-Linux) |
| `git diff --check` | PASSED |

## Riesgo residual

- A02 Linux no se mide localmente; sólo `e2e-full-completeness` en CI lo confirma.
- Los dos archivos nuevos sólo los ven los censos trackeados después del staging; se verificaron con simulación de tracking.

Estado final: implementación local completa, sin staging, commit, push ni PR.
