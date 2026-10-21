# PR-DRV-02 · Enlace de salto al contenido en el dashboard

## Estado base, autorización y alcance

- Rama `fix/dashboard-drv02-skip-to-content`, base `a696daec2221559501b411e38db0f541970ceb95` (= `main` = `origin/main`, PR-BUG-03 #1899). Al iniciar, el árbol tracked estaba limpio. Untracked preservados: `frontend/AGENTS.md` y `frontend/CLAUDE.md` (regenerados por `next dev`). Cinco stashes preexistentes intactos; un único worktree. No hay `AGENTS.md` anidados tracked.
- Autorización de Nico (2026-10-21): implementación local y validación R1 de PR-DRV-02. Sin `git add`, commit, push, PR ni merge.
- Origen: propuesta v2 (`origin/docs/dashboard-drive-evolution-proposal`), §10 DRV-08, §15.3 y §15.6. Es una mejora **conveniente**, no la corrección de un incumplimiento: WCAG 2.4.1 ya se cumple con el landmark `main` (ARIA11). No es prerrequisito de C26.
- Incluido: montar `SkipToContent` en el shell compartido, agregar `id="main-content"` a los dos `<main>`, una sección de guard, un spec E2E, el catálogo y sus censos.
- Excluido: `SkipToContent.tsx` y `globals.css` (sin cambios), CSS, geometría, tokens, fixtures A02/A03/A05/A08, `dashboard/error.tsx`, C26, P2-05, PR-TRUNC, deudas D5–D8 de C25, backend, dependencias y CI.

## Justificación de accesibilidad

Antes del cambio, quien navega con teclado recorría el app bar y hasta 11 ítems de drawer o rail antes de llegar al primer control de `main`. Con el cambio, el primer Tab enfoca «Saltar al contenido principal» y Enter lleva el foco a `main`. Objetivo §16: primer control de `main` a ≤ 2 pulsaciones de Tab (enlace y luego el control). El E2E lo mide.

## Arquitectura

- **Una instancia**, en `DashboardShellRouter`, owner compartido de admin y clínica, como primer hijo de `.dashboard-app-shell` y antes de `BackForwardCacheGuard`, del frame, de `DashboardMobileNav` y del portal root. No se agregó ningún wrapper.
- **Frontera client/server**: `DashboardShellRouter` ya es `"use client"` y `SkipToContent` también, así que la frontera no se mueve. `ClinicDashboardShell` sigue siendo Server Component, y sólo gana un atributo estático en `<main>`.
- **Geometría**: el control es `position: fixed` y está trasladado fuera del viewport hasta recibir foco. Como hijo con posición fija de un contenedor flex, no participa del flujo: no agrega una caja a la columna del shell, `main` no cambia de caja y el control no extiende el área desplazable.
- **Destinos**: `admin/page.tsx` tiene `<main id="main-content" className="dashboard-main">`. En `ClinicDashboardShell.tsx`, `<main id="main-content" …>` conserva clase, `data-dashboard-adaptive-reservation`, `style` y `children` directos. Las rutas son excluyentes, así que en cada documento hay un solo `#main-content`.
- Se descartaron dos alternativas. Una instancia por shell duplicaría el owner. Un enlace nuevo no hace falta, porque el componente existente ya cumple la regla «sin `<a>` ni `next/link»` de AGENTS §10.

## Evidencia RED (antes de tocar producción)

- Guard estático: 4 tests, **3 FAILED** y 1 PASSED. Fallaron porque el shell router no importa `SkipToContent`, porque `admin/page.tsx` no tiene `<main id="main-content">` y porque `SkipToContent` sólo lo montaba `PublicLayout`. El test que pasó fija el contrato del componente reutilizado, que ya existía. El guard se escribió primero como archivo propio. Antes de cerrar se movió, con las mismas aserciones, a una sección de `dashboard-b10-clinic-shell-unification.test.ts` (ver «Censos»).
- E2E (`dashboard-drv02-skip-to-content.spec.ts`): **8/8 FAILED**, porque `main#main-content` no existe en ninguna de las superficies.

## Cambios productivos

| Archivo | Cambio |
| --- | --- |
| `frontend/src/components/dashboard/DashboardShellRouter.tsx` | `import { SkipToContent }` y `<SkipToContent />` como primer hijo del shell (+4 líneas, con comentario) |
| `frontend/src/app/dashboard/admin/page.tsx` | `id="main-content"` en `<main>` |
| `frontend/src/components/dashboard/ClinicDashboardShell.tsx` | `id="main-content"` en `<main>` |

## Pruebas y realineaciones

- `test/architecture/dashboard-b10-clinic-shell-unification.test.ts`, sección PR-DRV-02 (4 tests). Verifica:
  - una sola instancia, importada desde `@/components/public/SkipToContent`;
  - que nada se renderiza antes del control y que éste precede al guard de BFCache, al frame, a `{children}`, a la navegación móvil y al portal root;
  - un solo `<main>` con `id="main-content"`, clase `dashboard-main` y sin `tabIndex` en admin y en clínica;
  - en todo `frontend/src`, que `SkipToContent` lo montan sólo `PublicLayout` y el shell router, y que `main-content` lo declaran sólo los tres owners, una vez cada uno;
  - el contrato del botón reutilizado: `aria-controls`, `tabindex` temporal, ni `<a>` ni `next/link`.
- Hay cuatro anclas literales de `<main className="dashboard-main">` del admin. Se realinearon al literal nuevo, sin debilitarlas, en: B10, `frontend-dashboard-admin-command-center`, `frontend-dashboard-admin` y `frontend-visual-consistency`.
- E2E nuevo: `frontend/e2e/regression/dashboard-drv02-skip-to-content.spec.ts`, cohorte `visual-contract`, capa `fixture`, P1.
- Censos: `e2e-suite-catalog-completeness` (125→126 specs, regression 29→30, fixture 77→78, visual-contract 47→48, ci 94→95, full 125→126) y `e2e-completeness-workflow` (125→126).
- Censo 01B: la banda A0-06 «specs en `test/architecture` (raíz)» está saturada (98 de 78 ± 20). Un archivo nuevo la ponía en 99 y en rojo. No se ensanchó la banda, porque es una decisión de política. Siguiendo el precedente de PR-DRV-03 y PR-BUG-03, el guard vive como sección de B10, que ya ancla los dos `<main>`. Así tampoco se mueve el ancla de adopción del lector canónico (435).

## Matriz de accesibilidad (Chromium real, sesiones fixture pobladas)

| Superficie | 1366 × 768 | 390 × 844 |
| --- | --- | --- |
| Administración (`/dashboard/admin?module=admin-report-upload`) | PASSED | PASSED |
| Clínica dashboard (`/dashboard?module=informes`) | PASSED | PASSED |
| Clínica ruta completa (`/dashboard/informes`) | PASSED | PASSED |

En cada celda se verifica lo siguiente:

- Antes del Tab: nada tiene foco, el control está fuera de pantalla, hay un solo `#main-content` y un solo botón.
- Primer Tab: el foco va al control, que se pinta dentro del viewport, y A08 queda en 0 con el control enfocado.
- Enter: el foco va a `main#main-content`, al que resuelve `aria-controls`, y `main` está dentro del viewport. A08 queda en 0 y no cambia ningún `scrollTop`/`scrollLeft` de `main` ni de sus ancestros.
- Siguiente Tab: el foco cae dentro de `main` y se retira el `tabindex` temporal.
- Además: la URL, `history.length` y `aria-current` no cambian, y no hay peticiones de documento ni RSC.

Casos extra, ambos PASSED:

- Shift+Tab desde el control lo devuelve fuera de pantalla.
- Con forced-colors, el control enfocado conserva un `outline` real.

Estabilidad: 40/40 con `--repeat-each=5`.

Hallazgo en el diseño del E2E: con `prefers-reduced-motion: reduce` emulado, la regla global de `globals.css` impone `transition-duration: 0.01ms` a todo, también a este control. El revelado se completa entonces en el cuadro siguiente, y bajo carga la lectura inmediata veía el control todavía fuera. El spec no emula reduced motion: sin esa emulación, la transición del control es 0 s y el cambio es síncrono. En Shift+Tab, la página pierde el foco y se lee el cuadro ya asentado con `expect.poll`. Las aserciones no se relajaron.

## Validaciones (estados canónicos, AGENTS §6)

| Gate | Estado |
| --- | --- |
| Sección PR-DRV-02 del guard B10 (RED → GREEN) | PASSED (19/19 en el archivo) |
| E2E PR-DRV-02 | PASSED (8/8; 40/40 repetido) |
| Guard público `frontend-public-skip-link-contract` y guards de shell (B05, B09, B10, boundaries, private-shell, shell, lateral-navigation, interaction-foundation, workspace-layout-polish, remove-home, admin, visual-consistency, route-error-boundaries) | PASSED |
| `pnpm --dir frontend lint` | PASSED |
| `pnpm --dir frontend typecheck` | PASSED |
| `pnpm --dir frontend build` | PASSED |
| `pnpm security:public-surface` | PASSED (los dos hallazgos `server-only` de `proxy.ts` son preexistentes) |
| `e2e:visual-contract` (A08 desktop, B09/B10, teclado, DRV-02/03) | FAILED en la cohorte: 1021 passed y 1 failed. El fallo es C23a «pressing inside the portaled dialog…», un timeout de `waitForRequest` en «Activar notificaciones». Aislado y con el cambio aplicado: PASSED 5/5 (flake de carga, ajeno al control de salto) |
| A02 `dashboard-geometry-baseline` | PASSED 21/21 superficies × 13 viewports |
| A03 `dashboard-adaptive-limit-baseline` | PASSED 16/16 (195/195 + 234/234). En una primera corrida conjunta falló `admin-audit-log` a 1280 × 720 («page 2 renders different rows than page 1») y, por ser serial, 15 tests no corrieron. Aislado: 3/3. Spec completo: 16/16 |
| A05 `dashboard-limit-invariance` | PASSED 15/15 |
| A08 móvil `dashboard-zero-scroll-mobile-boundary` | PASSED 8/8 |
| A01 `dashboard-operational-contract` | PASSED 1/1 |
| `e2e:admin-mobile` | PASSED 160/160 |
| Suite unitaria completa, con el spec nuevo simulado como trackeado | FAILED en 1 de 5428: `e2e-global-03b`, porque requiere `DATABASE_URL` (ambiental). Los otros 5426 PASSED |
| Censos 01B / 05A con el estado post-commit simulado | PASSED |
| `pnpm validate:local`, `db:migrate` | BLOCKED: sin DB local |
| `e2e:full`, `e2e:extended` completo | NOT_RUN: no se pidieron, y los specs de contrato pertinentes se corrieron individualmente |
| `git diff --check` | PASSED |

## Impacto visual

Ninguno en reposo: el control sólo se pinta mientras tiene foco, en la esquina superior izquierda (`position: fixed`, `z-index: 100`), sobre el app bar. A02 21/21 y A08 sin cambios lo confirman. No cambian clases, dimensiones, breakpoints, wrappers, grid, flex, overflow, topbar, sidebar ni navegación.

## Rollback

`git revert` del commit. Los tres archivos de producción vuelven a su estado previo sin migraciones ni datos. Las realineaciones de tests y del catálogo se revierten junto con él.

## Riesgos residuales

- `frontend/src/app/dashboard/error.tsx` renderiza su propio `<main>` sin `id`. En ese estado de error el control no hace nada (sale temprano sin error). Queda fuera de alcance.
- Mientras el control está enfocado, cubre la esquina superior izquierda del app bar (marca o título). Es el comportamiento estándar de un enlace de salto y desaparece al perder el foco.
- Con `prefers-reduced-motion: reduce`, el revelado tiene la transición global de 0.01 ms, igual que en la superficie pública. No es perceptible.
- C23a (notificaciones del kebab) y A03 `admin-audit-log` mostraron un fallo cada uno bajo carga de cohorte. En aislamiento pasan, y su mecanismo (petición de notificaciones, paginación del servidor) no involucra al control de salto.

## Estado final

READY para revisión local. Sin commit, push ni PR, que siguen como [MANUAL-NICO] o requieren una delegación posterior.
