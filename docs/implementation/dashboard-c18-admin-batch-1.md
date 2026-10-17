# C18 · Migración administrativa, lote 1: Tokens · Clínicas · Auditoría

## Estado base, alcance y auditoría previa

Base `321abadb1ae9675125d720deffffc458a42b36ec` (C17 integrado) en `feat/dashboard-c18-admin-batch-1`, igual a `origin/main` (0/0). Árbol tracked limpio; se preservaron los dos untracked previos (`frontend/AGENTS.md`, `frontend/CLAUDE.md`, generados por `next dev`), los cinco stashes y el único worktree. Sin `AGENTS.md` anidados tracked. No se ejecutaron escrituras Git ni GitHub.

Scope: presentación de los tres módulos del lote (§53 del roadmap) sobre las primitivas existentes C01–C13, sus guards realineados, un spec E2E y este registro. Fuera de scope: backend, endpoints, AuthN/AuthZ, DB, dependencias, configuración, CSS/tokens, FSM de navegación (D10), primitivas compartidas (no se modificó ningún owner C01–C17) y C19+.

Criterio rector: **sólo se adopta una primitiva si es geométricamente neutra** frente a A02 (regiones) y A03 (`limit/offset`), porque los baselines Linux de A02 no pueden capturarse en esta máquina y AGENTS.md prohíbe modificar baselines sin evidencia.

## Mapa de adopción

| Módulo | Adoptado | No adoptado y causa |
| --- | --- | --- |
| Tokens (S2) | C01 `CollectionWorkspace`/`CollectionHeader`/`ContentList`/`ContentListItem` (tabla y lista móvil); C03 `CollectionState` (carga/vacío/error); C10 `SuperSearchField` en el buscador móvil de clínica (40 px = el `h-10` previo, mismo `<form>` y submit); C11 `ActiveFilterChips` desde `xl` sólo con filtros aplicados (32 px = `md:min-h-8` de la banda); C13 `DetailsPane` + `DetailsMetadata` en la pestaña Resumen del diálogo existente | C02: el pager tiene «Cargar más» (ventana cliente sin `total`); la variante `compact` exige `total` y la `centered` impone la reserva táctil de 40 px, que cambia la altura del canvas. C06/C07/C09: no existe operación masiva de tokens en el servidor; una selección sin acción no se agrega. C12: S2 no tiene filtro avanzado móvil (contrato B05) |
| Clínicas (S4) | C01 (tabla, filas de estado y tarjetas móviles); C03 (`EmptyState`/`LoadingState` → `CollectionState`, mismo skeleton `table`) | C10: el pill de 40 px reemplazaría campos de 32 px en la banda móvil y en la fila de escritorio (A02 `filters` y capacidad). C02: `compact` renderiza un `div` sin `aria-label`, perdería el landmark `nav` «Paginación de clínicas». C04 queda intacto |
| Auditoría (S1) | C01 completo (fila de cabecera como `ContentListItem`); C03 en tabla y módulo móvil; C12 `AdvancedFilterSheet` controlado que hospeda **el mismo** `FilterForm` GET; C13 `DetailsPane` + `DetailsMetadata` en el diálogo de detalle | C02: el `footer[aria-label="Paginación de auditoría"]` lo anclan E2E existentes y `compact` no lo expone. C11: quitar un chip exigiría reescribir la URL desde el cliente, lo que cambia el mecanismo protegido de S1 (§7.8). S1 no tiene campo de texto libre para C10 |

Contrato de URL de S1 preservado: `<FilterBar action="/dashboard/admin" method="get">`, `<input type="hidden" name="module" value="audit-log" />`, nombres `event/actorType/from/to/clinicId/reportId`, `Aplicar` como `type="submit"` y `Limpiar` como `PublicRouteControl` a `/dashboard/admin?module=audit-log`. El sheet no agrega `onSubmit`, `preventDefault` ni `router.push`; el guard C18 lo prohíbe.

Geometría: `CollectionHeader` se liga a `--dash-table-head-h` dentro de los canvas con `data-dashboard-canvas-reserve^="table-head"` (tokens.css, C01), igual que antes; la lista `ContentList` móvil usa `contents divide-y` para conservar los separadores de 1 px que forman el pitch medido. No se tocaron reservas de pager, canvas ni capacidades.

## Archivos

Producto: `frontend/src/app/dashboard/admin/AdminParticularTokensCard.tsx`, `AdminClinicsManagementCard.tsx`, `AdminAuditDenseTable.tsx`, `AdminAuditDetailDialog.tsx`, `AdminAuditFilterBar.tsx`, `AdminMobileAuditModule.tsx`.

Pruebas nuevas: `test/architecture/dashboard-c18-admin-batch-1.test.ts` (guard + prueba de mutación), `frontend/e2e/admin/shell/admin-c18-batch-1.spec.ts` (cohorte `visual-contract`).

Guards realineados en el mismo PR (sin debilitar): B11 (censos C01/C03 y orden de la franja C07 con el disparador del sheet), B05 (dos call sites `dashboardScopedPortal`, nueva aserción del sheet S1 y selector E2E del sheet), PR-TRUNC (región del detalle de auditoría = `DetailsPane`), C04 (fila de escritorio = `ContentListItem as="tr"`), `frontend-dashboard-admin` (alerta de error vía el owner C03), A01 (`<AdvancedFilterSheet` en lugar de `<ModuleDialog` en los markers S1), catálogo E2E 117→118 (admin 22, fixture 75, visual-contract 40, ci 87, full 118), `e2e-completeness-workflow` 118 y censo 05A de importadores del lector canónico 429→430.

## RED → GREEN

El guard C18 aplicado a los fuentes de `HEAD` (leídos con `git show`) falla 2/2; sobre el árbol C18 pasa 2/2, y cada una de sus 13 mutaciones de regreso a la gramática previa es rechazada.

Un guard E2E existente también se realineó: `admin-tokens-mobile-toolbar-layout.spec.ts` buscaba el campo de clínica con rol `textbox`; el pill C10 expone `role="searchbox"` con el mismo nombre accesible.

## Validaciones

| Gate | Estado |
| --- | --- |
| Guard C18 | PASSED 2/2 (RED 2/2 sobre `HEAD`) |
| Tests Node dirigidos (35 archivos que anclan los módulos) | PASSED 372/372 |
| Suite Node completa con los dos archivos nuevos simulados como trackeados (hook de loader, sin tocar el índice) | FAILED 5369/2/1: Auth 03b (exige `DATABASE_URL`, ambiental, preexistente) y A01 S1, realineado después y PASSED 13/13 |
| Censos 01B/05A, catálogo E2E, workflow de completitud, mock backend (con simulación de tracking) | PASSED |
| Frontend `lint`, `typecheck`, `build`; `security:public-surface`; raíz `typecheck`, `typecheck:test`, `build` | PASSED |
| `pnpm validate:local` como cadena | NOT_RUN: su suite Node falla por la precondición ambiental Auth 03b sin DB y por los archivos nuevos aún no trackeados; sus piezas se ejecutaron por separado arriba |
| E2E C18 | PASSED 4/4 |
| A02 `admin-tokens`, `admin-clinicas`, `admin-auditoria` (13 viewports, baseline Win32 sin cambios) | PASSED 3/3 |
| A03 `admin-particular-tokens`, `admin-clinics`, `audit-log` | PASSED 3/3, `limit/offset` exactos sin tocar el fixture |
| A03 «matrix integrity» | FAILED por selección: exige 15 archivos de observación y la corrida filtró 3 módulos; no es una regresión |
| Regresión dirigida: Clínicas ×3, admin shell ×2, Tokens toolbar, accesibilidad por teclado, recuperación de página, app shell real, contratos zero-scroll interno y móvil, B05 | PASSED 140 + 1 skip preexistente; las 3 fallas iniciales de Tokens toolbar (rol `searchbox`) PASSED 17/17 tras el realineamiento |
| `e2e:admin-mobile` | PASSED 159/159 |
| `e2e:visual-contract` y `e2e:extended` completas | NOT_RUN: se ejecutaron sus specs afectados; la cohorte completa conserva los residuales D10 conocidos ajenos a C18 |
| `e2e:full` | NOT_RUN (baselines pixel Chromium-Linux) |
| `git diff --check` | PASSED |

## Riesgo residual

- A02 Linux no se midió localmente; como ninguna región cambió de geometría en Win32, no se esperan derivas, pero sólo `e2e-full-completeness` en CI lo confirma.
- El sheet S1 ya no usa `dashboardScopedPortal` (mismo patrón que C17 en S3): monta en `document.body`; B05 lo cubre por el selector del sheet.
- Los guards que leen archivos trackeados verán los dos archivos nuevos recién después del staging; se verificaron con simulación de tracking.

Estado final: implementación local completa, sin staging, commit, push ni PR.
