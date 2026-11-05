# Perfil de Clínica: layout institucional en dos columnas

## Estado base

Base: `origin/main` @ `cb66221f` (incluye #1958 V10 y #1960). Rama: `feat/dashboard-clinic-profile-two-column-layout`,
creada desde `main` en un worktree limpio. Alternativa A de la exploración visual (tres propuestas medidas en Chromium);
no se implementó B ni C.

## Alcance

Incluido: composición del panel «Perfil» del Dashboard Clínica desde 768 px (`ClinicPublicProfileCard.tsx` y un bloque CSS
delimitado en `frontend/src/styles/dashboard/navigation.css`), más los guards y specs que anclaban la estructura anterior.

Excluido (deliberado): teléfonos (<768 px) sin cambios de DOM ni de comportamiento, `formState`, `activeTabId`,
`handleSubmit`, handlers y validación del avatar, `PasswordChangePanel`, rutas, endpoints, payloads, permisos, backend,
otros módulos, tipografía y colores globales, A02/A03 y snapshots PNG (no se recapturó ninguno).

## Diseño

| Régimen | Distribución |
|---|---|
| ≥1200 px | Grilla `minmax(17rem,1fr) / minmax(0,2fr)` (~33 % + ~67 %). Izquierda: identidad y publicación. Derecha: filas de apertura exclusiva y barra de acciones con «Guardar perfil público». |
| 768–1199 px | Banda horizontal (identidad + publicación en dos columnas) sobre el editor. |
| <768 px | Igual que antes: chips, toolbar, resumen de completitud, guardado y contraseñas. |

Columna institucional: logo (96 px; 80 px en tablet; 64 px en escritorio ≤800 px de alto), nombre, especialidad, localidad y
país del perfil guardado, selector de imagen, «Guardar imagen» / «Quitar imagen», badge real de publicación, calidad
(`qualityScore` / `minimumQualityScore`, sólo si la respuesta trae ambos números), requisitos obligatorios y recomendados
pendientes, observaciones de publicación y el control `isPublic`.

No se muestra «Cambios sin guardar» ni contadores del tipo «4/4»: el frontend no tiene seguimiento de cambios ni el
catálogo completo de campos para calcularlos.

## Contratos preservados

- Un único `<form id="clinic-public-profile-form">`; `PasswordChangePanel` queda fuera de él y montado/oculto (conserva estado).
- Apertura exclusiva con `activeTabId`; las filas siguen siendo `<button aria-expanded aria-controls>`.
- Validación nativa acotada a la sección abierta; los valores viven en `formState`.
- `isPublic`: un solo setter y un solo `checked={formState.isPublic}`; se renderiza dos veces y se muestra una (copia móvil
  dentro de «Contenido», copia institucional desde 768 px).
- Avatar: el `<input type="file">` real sigue en el DOM (`sr-only` desde 768 px) con su handler, `accept`, límites y
  `URL.revokeObjectURL`; un `<label>` con aspecto de botón lo abre y muestra el foco del input (`peer-focus-visible`).

## Decisiones de implementación

- Tailwind 4 emite las variantes arbitrarias `min-[…]` antes que los breakpoints del tema, por lo que un `min-[1200px]:` no
  sobrescribe un `md:`. Los valores de tablet y de escritorio son mutuamente excluyentes (`md:max-[1199px]:` / `min-[1200px]:`).
- El tamaño del logo por régimen vive en el bloque CSS (`clinic-profile-two-column`), que también compacta el panel en
  viewports cortos (≤800 px de alto): oculta la ayuda de formatos y la línea «Ninguna imagen seleccionada», reduce gaps y
  alto de filas. Sin esa compactación el peor caso (4 obligatorios + 4 recomendados + observación) desbordaba a 1280×720 y 1024×768.
- Las filas miden 44 px (40 px con ≤800 px de alto; 36 px en tablet corta): 52 px se descartó antes de implementar y la
  tablet de 1024×768 sólo cabe con el panel compactado.
- Los chips de pendientes usan texto de tinta con borde/fondo destructivo suave: `text-destructive` daba 2,9:1 en dark-gray (axe serious).
- Sin resúmenes truncados por fila: el guard de integridad de truncamiento exige revelar el valor completo.

## Validación (Windows, Chromium, datos sintéticos)

| Gate | Estado |
|---|---|
| Guards de código (`frontend-clinic-public-profile`, CLINIC-DT, password-change-ui, truncation-integrity) | PASSED (38/38) |
| `pnpm test` (raíz) | 5478 ejecutados, 5476 PASSED; 1 FAILED ambiental (`e2e-global-03b` exige `DATABASE_URL`), 1 skipped |
| `pnpm typecheck`, `pnpm typecheck:test`, `pnpm --dir frontend typecheck`, `pnpm --dir frontend lint` | PASSED |
| `pnpm --dir frontend build`, `pnpm security:public-surface` | PASSED |
| E2E perfil (CLINIC-DT ×6 viewports ×3 pruebas, no-scroll del shell, móvil, paridad de estado, accesibilidad móvil) | PASSED |
| `e2e:visual-contract`, `e2e:ci`, `e2e:extended` | 1111+1717+287 PASSED; fallos no atribuibles (ver abajo) |
| Matriz propia Zero Scroll (8 viewports × 2 temas × 5 estados × 2 datasets = 160 estados) | 0 px de scroll de documento y de `main`, 0 recortes, Guardar visible, 0 solapamientos |
| Geometría y tamaño tipográfico claro vs dark-gray | 80 estados comparados, 0 diferencias |
| axe (WCAG 2.2 AA + best-practice) en 100 estados ≥768 px | 0 serious/critical; 1 moderate preexistente (`heading-order` del `h3` sr-only de `PasswordChangePanel`) |

Fallos observados y su clasificación:

- `dashboard-list-font-size-theme-parity` (clinic-perfil, 4 viewports ≥768): causado por este rediseño; el censo de tamaños
  claros se realineó con valores medidos (`dashboard-list-font-size-light-baseline.ts`). La paridad claro/oscuro sigue en 0 px.
- A02 `clinic-log-visitas`: falla también con el código base (Logística, sin relación con Perfil).
- `dashboard-page-request-recovery` (audit log), B11 C08 @390, C24 V5 Informes admin, C25 F-T4 métricas de logística,
  A03 `admin-audit-log`: fallaron en la corrida de cohorte y pasaron al repetirlas con este mismo código (flakes preexistentes).
- No se ejecutó `e2e:full` ni baselines Linux (A02/A03 de Linux y PNG): NOT_RUN.

## Baselines (R13)

No se modificó ningún registro A02/A03 ni PNG: `clinic-perfil` de A02 sólo registra la geometría del shell/workspace, que no
cambia. Único censo realineado: tamaños de fuente claros de `clinic-perfil` ≥768 px. Las capturas Linux de E2E
Completeness que incluyan el Perfil ≥768 px cambiarán; su promoción requiere autorización y expediente R13 propio.

## Riesgos residuales

- Sin evidencia Linux (Chromium-Linux) del nuevo Perfil.
- Con más de ~8 pendientes de publicación o con `publicationErrors` extensos, la columna institucional podría exceder el
  alto en 1024×768 corta; el caso límite medido (4+4+1 observación) cabe.
- La copia móvil y la institucional de `isPublic` son dos nodos: cualquier cambio de texto o de comportamiento debe hacerse
  en `renderPublishCheckbox`.
