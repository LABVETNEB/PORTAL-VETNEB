# Dashboard CSS Architecture Cleanup (PR-CSS-1)

Refactor de arquitectura CSS del dashboard. **Cero cambios visuales, cero
cambios funcionales.** Solo se reorganiza el CSS del dashboard que estaba
acumulado en `frontend/src/app/globals.css` hacia archivos dedicados por
responsabilidad, para poder rediseñar el producto de forma eficiente en PRs
posteriores.

## Objetivo

`globals.css` mezclaba, en un único archivo de ~4.5k líneas, capas históricas
del dashboard (auth visual, no-scroll/zero-scroll, app-shell, rail, mobile
admin/clínica, viewport-zoom, premium grammar). Esta acumulación dificultaba
localizar y modificar reglas. Se separa el CSS **de dashboard** por
responsabilidad, sin tocar diseño ni comportamiento.

## Qué NO cambió

- Ninguna regla CSS fue modificada, agregada ni eliminada. Las secciones se
  **movieron verbatim** (comentarios `:start`/`:end` incluidos).
- Las reglas públicas/particulares y los primitivos compartidos (`.clinical-*`,
  `.render-*`, `.public-page-canvas`, tokens `:root`, `@layer base`) permanecen
  en `globals.css`.
- Sin cambios de rutas, lógica, backend, API, auth, DB, deps, lockfiles ni CI.

## Estructura resultante

`globals.css` conserva base/tokens, primitivos compartidos y todo el CSS
público. Al final del archivo importa, en orden, los archivos de dashboard:

```
frontend/src/styles/dashboard/
  dashboard-shell.css          → cockpit no-scroll, app-shell single-viewport, visibility contract
  dashboard-admin-mobile.css   → app-shell/hub/módulos mobile de Admin (10 secciones admin-mobile-*)
  dashboard-clinic-mobile.css  → paridad estructural de Clínica mobile (app-shell surface, cockpit hub)
  dashboard-surfaces.css       → auth visual, interacción, densidad filtros/tablas, premium grammar (hub/kpi/signal)
  dashboard-rail.css           → rail de navegación de módulos + paneles master/detail
  dashboard-responsive.css     → touch ergonomics, a11y teclado, viewport-zoom (tiers densidad), inline master-detail
  dashboard-zero-scroll.css    → sustrato de viewport fijo (ledger de límites, locks de columnas)
```

## Orden de importación = preservación de cascada

Todo el CSS de dashboard vive en `@layer components`, por lo que **el orden de
fuente decide qué regla gana** entre selectores de igual especificidad. Un
barrido de selectores sobre las 26 secciones detectó solo 5 dependencias de
orden entre secciones (el resto usa namespaces disjuntos `.dashboard-*` /
`.admin-*` / `.clinic-*` / `.hub-*`, por lo que su orden es libre):

1. `interaction-foundation` antes de `workspace-layout-polish` — `.dashboard-card/btn/row-interactive`
2. `auth-visual-system` antes de `global-inline-adaptive` — `.surface-soft`
3. `app-shell-visibility-contract` antes de `viewport-zoom` antes de `zero-scroll-substrate` — `.dashboard-app-shell`
4. `clinic-admin-structure-parity` antes de `premium-grammar` — `.clinic-cockpit-hub`
5. Orden interno del grupo `admin-mobile-*`

El orden de `@import` (`shell → admin-mobile → clinic-mobile → surfaces → rail →
responsive → zero-scroll`) y el orden de secciones dentro de cada archivo
(orden de fuente original) satisfacen las 5 restricciones. Tailwind v4 inlinea
los `@import` en su posición al compilar, así que la cascada compilada es
equivalente.

## Validación

- **Equivalencia de CSS compilado**: se compiló `globals.css` con el pipeline
  real (`@tailwindcss/postcss`) antes y después. Resultado: **mismo set de
  reglas** (1936 bloques idénticos al ordenar), idénticos conteos de
  `@media`/`@keyframes`/`@font-face`/`@supports`/`@layer`/`@property` y longitud
  normalizada idéntica. La única diferencia es el orden (seguro) y whitespace.
- `pnpm --dir frontend typecheck` → OK.
- `pnpm --dir frontend e2e:visual-contract` → contratos de layout/no-scroll.

Nota: `frontend` no define script `test`; su superficie de pruebas es Playwright
(`e2e:*`).

## Riesgos

- Bajo. El refactor es un movimiento verbatim con orden de cascada preservado y
  verificado por equivalencia de CSS compilado. El único vector teórico —
  colisiones entre selectores distintos que apunten al mismo elemento con igual
  especificidad — está cubierto por el análisis de secciones disjuntas y por la
  suite e2e de contratos visuales.
