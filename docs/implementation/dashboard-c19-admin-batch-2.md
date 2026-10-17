# C19 · Migración administrativa, lote 2: Usuarios · Sesiones · Intentos fallidos

## Estado base, alcance y auditoría previa

Base `aa6b324975c1c7f275309aa1ffbd4517fc3a479a` (C18 integrado, #1882) en `feat/dashboard-c19-admin-batch-2`, igual a `origin/main`. Árbol tracked limpio; se preservaron los dos untracked previos (`frontend/AGENTS.md`, `frontend/CLAUDE.md`, generados por `next dev`), los cinco stashes y el único worktree. Sin `AGENTS.md` anidados tracked. No se ejecutaron escrituras Git ni GitHub.

Scope: presentación de los tres módulos del lote (§53 del roadmap) sobre las primitivas existentes C01–C16, sus guards realineados, un spec E2E y este registro. Fuera de scope: backend, endpoints, AuthN/AuthZ, DB, dependencias, configuración, CSS/tokens, FSM de navegación, primitivas compartidas (no se modificó ningún owner C01–C18) y C20/C21.

Criterio rector (el mismo de C18): **sólo se adopta una primitiva si es geométricamente neutra** frente a A02 y A03, porque los baselines Linux de A02 no pueden capturarse en esta máquina y AGENTS.md prohíbe modificarlos sin evidencia.

## Mapa de adopción

| Módulo | Adoptado | No adoptado y causa |
| --- | --- | --- |
| Usuarios | C01 `CollectionWorkspace`/`CollectionHeader`/`ContentList`/`ContentListItem` en la tabla (canvas `table-head-dense`, cabecera 32 px = `[&_th]:h-8` previo) y en la lista móvil (`contents divide-y divide-vetneb-line/70`, conserva el separador del pitch); C03 `CollectionState` para carga y vacío en escritorio y móvil (mismos textos); C13 `DetailsPane` + `DetailsMetadata` en el diálogo de detalle de sólo lectura | C02: el pager de escritorio es un `footer` con `aria-label` anclado por E2E y el móvil es `AdminMobileOpsPager`; `compact` pierde el landmark y `centered` impone la reserva táctil de 40 px. C10: el pill de 40 px reemplazaría campos de 32/28 px de la banda (A02 `filters`). C11/C12: los filtros son selects con efecto inmediato; no hay estado «aplicado» que representar. C04/C06/C07/C09: el servidor no ordena ni tiene operación masiva |
| Sesiones | C01 en tabla y lista móvil; C03 para carga y vacío | Error de carga de escritorio: se conserva `.clinical-alert-error` con `role="alert"` porque es el detector de estado de error de la matriz A02 (`dashboard-geometry-matrix.ts`) y C03 `error` duplicaría el anuncio que ya hace la banda. Error móvil: el encabezado ya lo anuncia (`role="alert"`); un segundo `alert` sería una regresión de accesibilidad, así que el marcador sigue siendo texto. C02/C10/selección: mismas causas que Usuarios; revocar es por fila y la sesión admin actual sigue sin poder revocarse |
| Intentos fallidos | C01 en la tabla de la pestaña Alertas y en la lista del chip móvil (`contents divide-y divide-vetneb-line/60`); C03 directo en lugar de los adaptadores `EmptyState`/`LoadingState`; C13 en el diálogo de detalle (los valores ausentes usan la gramática «Sin dato» de `DetailsMetadata`) | Banda `clinical-alert-error` sobre el canvas: su altura forma parte del canvas medido. C02: la reserva táctil ya es la del módulo (`DASHBOARD_TOUCH_PAGER_RESERVATION`) y el footer no es un landmark etiquetado de C02. Exportación CSV, filtros y paginación sin cambios |

Geometría: `CollectionHeader` se liga a `--dash-table-head-h` dentro de los canvas `table-head*` (C01), igual que antes. `CollectionWorkspace` convierte el canvas en columna flex; el hijo `.dashboard-fitted-table` (Usuarios, Sesiones) se estira igual que en el canvas de Auditoría desde C01, y la tabla de Intentos usa `.dashboard-table-responsive`, que no crece. Las listas móviles conservan el separador de 1 px (Tailwind v4 lo dibuja como `border-bottom`). No se tocaron reservas de pager, canvas ni capacidades.

## Archivos

Producto: `frontend/src/app/dashboard/admin/AdminUsersRolesReadOnlyCard.tsx`, `AdminUserRoleDetailDialog.tsx`, `AdminSessionsReadOnlyCard.tsx`, `AdminFailedLoginAlertsReadOnlyCard.tsx`, `AdminFailedLoginDetailDialog.tsx`.

Pruebas nuevas: `test/architecture/dashboard-c19-admin-batch-2.test.ts` (guard + 12 mutaciones), `frontend/e2e/admin/shell/admin-c19-batch-2.spec.ts` (cohorte `visual-contract`, capa `mocked`: Sesiones e Intentos fallidos no los sirve el fixture; Usuarios usa el fixture poblado sin doble declaración).

Guards realineados en el mismo PR, sin debilitar: B11 (censo de consumidores C01 y C03 con los tres módulos; Intentos fallidos sale de los adaptadores legacy), PR-TRUNC (regiones de los dos diálogos = `DetailsPane`; las aserciones de valor completo pasan a `value: user.username` / `value: clinicLabel`), `frontend-admin-failed-login-alerts-card` (carga vía `<CollectionState variant="loading"`), catálogo E2E 118→119 (admin 23, mocked 44, visual-contract 41, ci 88, full 119), `e2e-completeness-workflow` 119 y censo 05A de importadores del lector canónico 430→431.

## RED → GREEN

El guard C19 aplicado a los fuentes de `HEAD` (copias leídas con `git show`) falla 2/2 con 31 violaciones; sobre el árbol C19 pasa 2/2 y rechaza sus 12 mutaciones de regreso a la gramática previa (incluida la revocación de la sesión actual y la pérdida de los separadores). El spec E2E también se probó por mutación temporal: quitar los separadores de la lista móvil de Intentos y habilitar la revocación de la sesión actual hacen fallar 2 de sus 5 pruebas; las fuentes se restauraron por copia.

## Validaciones

| Gate | Estado |
| --- | --- |
| Guard C19 | PASSED 2/2 (RED 2/2 sobre `HEAD`) |
| Tests Node dirigidos (35 archivos que anclan los módulos y las primitivas) | PASSED 372/372 tras el realineamiento |
| Suite Node completa con los dos archivos nuevos simulados como trackeados (hook de loader) | FAILED 5373/5375 (1 skip): sólo Auth 03B, que exige `DATABASE_URL`; ambiental y preexistente |
| Frontend `lint`, `typecheck`, `build`; `security:public-surface`; raíz `typecheck:test` | PASSED |
| `pnpm validate:local` como cadena | NOT_RUN: su suite Node falla por la precondición ambiental Auth 03B; sus piezas se ejecutaron por separado arriba |
| E2E C19 | PASSED 5/5 |
| A02 `admin-sesiones`, `admin-usuarios` y A03 `admin-users-roles`, `admin-sessions`, `admin-failed-login-alerts` (baselines sin cambios) | PASSED 5/5 |
| Regresión dirigida: `e2e/admin/users/` (5 specs), ops/status/final-polish/layer-isolation móviles, integridad de texto de detalle, contratos zero-scroll interno, app shell real y frontera móvil, C13 | PASSED 189/189 |
| `e2e:admin-mobile` | PASSED 159/159 |
| `e2e:visual-contract` y `e2e:extended` completas | NOT_RUN: se ejecutaron sus specs afectados |
| `e2e:full` | NOT_RUN (baselines pixel Chromium-Linux) |
| `git diff --check` | PASSED |

## Riesgo residual

- A02 Linux no se midió localmente; ninguna región cambió de geometría en Win32, pero sólo `e2e-full-completeness` en CI lo confirma.
- La pestaña Alertas de escritorio (Intentos fallidos) no tiene región A02 propia; queda cubierta por A03 y por el spec C19.
- Los guards que leen archivos trackeados verán los dos archivos nuevos recién después del staging; se verificaron con simulación de tracking.

Estado final: implementación local completa, sin staging, commit, push ni PR.
