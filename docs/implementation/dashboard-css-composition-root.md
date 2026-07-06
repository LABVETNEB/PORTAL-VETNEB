# Dashboard CSS Composition Root (PR-CSS-1B)

Introduce un **composition root** para el CSS del dashboard. **Cero cambios
visuales, cero cambios funcionales.** Continúa el trabajo de
[`dashboard-css-architecture-cleanup.md`](./dashboard-css-architecture-cleanup.md)
(PR-CSS-1) y de la preparación de tests root en #1289: ahora los módulos de
dashboard quedan detrás de un único punto de entrada,
`frontend/src/styles/dashboard/index.css`.

## Objetivo

Tras PR-CSS-1, `globals.css` importaba siete archivos de dashboard de forma
directa. Este PR consolida esas importaciones en un único
`@import "../styles/dashboard/index.css"`, y `index.css` compone todos los
módulos. Así:

- `globals.css` queda como **global CSS entrypoint** (Tailwind, tokens `:root`,
  base/components globales, público, etc.).
- `dashboard/index.css` queda como **composition root**: la única lista de
  módulos de dashboard y el único lugar donde se decide el **orden de cascada**.

## Qué NO cambió

- Ninguna regla CSS fue modificada, agregada ni eliminada. Las secciones se
  **movieron verbatim** (comentarios `:start`/`:end` incluidos).
- El **orden de cascada entre módulos es idéntico** al de PR-CSS-1
  (`shell → mobile-admin → mobile-clinic → surfaces → navigation → responsive →
  zero-scroll`). El único reagrupamiento intra-módulo está en `surfaces.css`
  (ver más abajo) y es neutral para la cascada.
- No se tocó backend / API / auth / DB / Supabase / dependencias / lockfiles /
  CI. No se modificó `frontend/next-env.d.ts`.

## Arquitectura

```
frontend/src/app/globals.css            ← global entrypoint
  └─ @import "../styles/dashboard/index.css"   ← composition root
        ├─ @import "./tokens.css"
        ├─ @import "./shell.css"
        ├─ @import "./layout.css"
        ├─ @import "./mobile-admin.css"
        ├─ @import "./mobile-clinic.css"
        ├─ @import "./surfaces.css"
        ├─ @import "./interactions.css"
        ├─ @import "./tables.css"
        ├─ @import "./navigation.css"
        ├─ @import "./responsive.css"
        └─ @import "./zero-scroll.css"
```

`globals.css` **no** contiene más imports de dashboard que `index.css`, y no
duplica ninguna regla de los módulos.

## Tabla de responsabilidades

| Módulo | Responsabilidad | Origen PR-CSS-1 | Section markers |
| --- | --- | --- | --- |
| `tokens.css` | Slot reservado para tokens de dashboard (ver nota) | _(nuevo)_ | — |
| `shell.css` | Cockpit / launcher command shell (grilla y tiles del home) | `dashboard-shell.css` | `dashboard-no-scroll-cockpit` |
| `layout.css` | Primitivas de layout de módulo (surface/toolbar/body/tabs/pager/tabla) + contenedor raíz `.dashboard-app-shell` y su marco | `dashboard-shell.css` | `dashboard-single-viewport-app-shell`, `dashboard-app-shell-visibility-contract` |
| `navigation.css` | Nav lateral interactiva, workspace enter/header, paneles master-detail, panel del filter drawer | `dashboard-rail.css` | `dashboard-workspace-layout-polish` |
| `surfaces.css` | Superficies visuales (auth/main) + premium grammar (status dots, KPI chips, hub band, signal cards, module tiles, composición del hub) | `dashboard-surfaces.css` | `dashboard-auth-visual-system`, `dashboard-premium-grammar` |
| `interactions.css` | Interaction foundation (press/reduced-motion), action-feedback/focus, densidad de filtros/forms | `dashboard-surfaces.css` | `dashboard-interaction-foundation`, `dashboard-action-feedback-focus-polish`, `dashboard-filters-forms-density-polish` |
| `tables.css` | Consistencia de tablas y cards (paginación unificada, divisor de header, variante stats-grid) | `dashboard-surfaces.css` | `dashboard-tables-cards-consistency-polish` |
| `responsive.css` | Ergonomía táctil, hardening de teclado/a11y, adaptabilidad a zoom, densidad adaptativa inline (incl. `.dashboard-table-responsive`) | `dashboard-responsive.css` | `dashboard-responsive-touch-ergonomics`, `dashboard-accessibility-keyboard-hardening`, `dashboard-viewport-zoom-adaptability`, `dashboard-global-inline-adaptive` |
| `zero-scroll.css` | Substrato de densidad zero-scroll + overrides sin `@layer` que deben ganar **al final** de la cascada de dashboard | `dashboard-zero-scroll.css` | `dashboard-zero-scroll-substrate` |
| `mobile-clinic.css` | Paridad mobile de la clínica con el app-shell admin | `dashboard-clinic-mobile.css` | `clinic-admin-structure-parity` |
| `mobile-admin.css` | App-shell mobile de admin (aislamiento de capas, hub launcher, densidades de módulo) | `dashboard-admin-mobile.css` | `admin-mobile-*` |

> **Nota sobre tokens.** Los tokens globales (paleta HSL, motion/easing, radios)
> siguen en `app/globals.css` bajo `:root` (`@layer base`) porque son globales,
> no exclusivos del dashboard. Los tokens de acento en runtime
> (`--dash-accent-*`) permanecen colocados con sus consumidores en
> `surfaces.css` (premium grammar) para preservar esa sección verbatim y su
> resolución en cascada. `tokens.css` se importa primero para que cualquier
> token de dashboard que se agregue en el futuro esté disponible para todos los
> módulos siguientes.

## Orden de cascada (por qué el orden de imports importa)

El orden de `index.css` **reproduce exactamente** el orden previo de
`globals.css`. Es load-bearing en dos puntos:

- `responsive.css` **antes de** `zero-scroll.css`: ambos declaran
  `.dashboard-app-shell .dashboard-section-description` con la misma
  especificidad; el substrato zero-scroll debe ganar, por eso se importa último.
- Los módulos de superficie (`surfaces/interactions/tables`) van **antes de**
  `navigation.css`, igual que `dashboard-surfaces.css` iba antes de
  `dashboard-rail.css`.

`surfaces.css` reagrupa dos secciones de `dashboard-surfaces.css`
(`dashboard-auth-visual-system` + `dashboard-premium-grammar`) para juntarlas por
responsabilidad; `interactions.css` y `tables.css` toman las secciones
intermedias. Los namespaces de selectores de esas secciones son **disjuntos**,
por lo que el resultado computado de la cascada no cambia (verificado por los
contratos de texto y el suite `e2e:visual-contract`).

## Cómo modificar cada área

- **rail / navegación** → `navigation.css` (sección
  `dashboard-workspace-layout-polish`).
- **surfaces / premium grammar** → `surfaces.css`. Interacción, feedback y
  densidad de filtros/forms → `interactions.css`. Consistencia de tablas/cards →
  `tables.css`.
- **mobile-clinic** → `mobile-clinic.css` (sección
  `clinic-admin-structure-parity`).
- **mobile-admin** → `mobile-admin.css` (secciones `admin-mobile-*`).
- **zero-scroll** → `zero-scroll.css`. Recordar que se importa **último**; sus
  overrides sin capa están diseñados para ganar al final.
- **responsive** → `responsive.css` (touch, teclado/a11y, zoom, densidad inline).

Para agregar un módulo nuevo: crear el archivo bajo
`frontend/src/styles/dashboard/`, añadir un `@import "./nuevo.css";` en
`index.css` en la posición de cascada correcta, y documentar su responsabilidad
en la tabla de arriba. `globals.css` no debe volver a importar módulos de
dashboard directamente.

## Test helper

Los tests de contrato de dashboard leen el CSS **compuesto** vía
`test/helpers/read-dashboard-css-source.ts`. El helper ahora resuelve los
`@import` de dashboard de forma **recursiva** (globals → `index.css` → módulos),
de modo que los selectores y section markers se resuelven igual que antes,
estén importados directamente o a través del composition root.

## Validaciones ejecutadas

| Comando | Directorio | Resultado |
| --- | --- | --- |
| `pnpm test` | `C:\PORTAL-VETNEB` | ✅ 2961 pass / 0 fail |
| `pnpm build` | `C:\PORTAL-VETNEB` | ✅ bundle server OK |
| `pnpm typecheck` | `C:\PORTAL-VETNEB\frontend` | ✅ sin errores |
| `pnpm build` | `C:\PORTAL-VETNEB\frontend` | ✅ next build OK |
| `pnpm e2e:visual-contract` | `C:\PORTAL-VETNEB\frontend` | ✅ 273 passed |

Adicional: comparación multiset de las líneas de regla (no comentario/no vacías)
entre los módulos PR-CSS-1 y los módulos nuevos → **idéntica** (2409 líneas),
confirmando extracción verbatim.

## Confirmación

Refactor puramente estructural: **sin cambios funcionales ni visuales**. Solo se
consolidó la lista de imports de dashboard detrás de `dashboard/index.css`, se
renombraron los módulos por responsabilidad y se hizo recursivo el helper de
tests.
