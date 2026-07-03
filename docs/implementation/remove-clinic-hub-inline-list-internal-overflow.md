# R-10 — Remove clinic hub inline-list internal overflow

> Rama: `fix/clinic-hub-inline-list-overflow`
> Base: `2a9894d cleanup(admin): remove mobile compat shims (#1272)`
> Documento rector: `docs/audit/final-global-vetneb-50-60-pr-roadmap.md`

## Deuda original medida

`e2e/dashboard-viewport-zoom-adaptability.spec.ts` documentaba la surface
`"clinic hub (cockpit)"` con `allowMeasuredInternalScroll: true`, lo que
degradaba la medición de `assertNoMeasuredInternalVerticalScroll` de
asertiva a informativa para ese caso. Al promover la medición (quitando el
flag) el fallo focal reproducido fue:

| Viewport | Selector | Overflow medido |
| --- | --- | --- |
| tablet-768x1024 | `div.dashboard-inline-list.rounded-lg.border` | **12px** |
| mobile-390x844 | `div.dashboard-inline-list.rounded-lg.border` | **238px** |

El nodo señalado es `data-clinic-cockpit-modules="true"` (panel "Módulos
clínicos") dentro de `ClinicDashboardCockpit`, en
`frontend/src/components/dashboard/ClinicDashboardWorkspaceController.tsx`.

## Causa raíz

`.dashboard-inline-list` (definida en `globals.css`, fuera de scope) solo
declara `overflow-x: hidden`, sin fijar `overflow-y`. Por la regla de
"visible-pairing" del spec CSS Overflow (si uno de `overflow-x`/`overflow-y`
es distinto de `visible` y el otro queda en `visible`, el navegador computa
ese `visible` como `auto`), el navegador promueve implícitamente
`overflow-y: auto` sobre este `div`, convirtiéndolo en un contenedor de
scroll no intencional.

Por debajo de `lg` (1024px) el cockpit clínico pasa a una sola columna:
estado → fila de atención/continuidad/actividad → **Módulos clínicos** →
**Acciones principales**, todas apiladas como filas `auto` de un grid CSS
sin distribución `fr`. El contenido total de esa pila excede el alto
disponible del hub tanto en tablet (768×1024) como, de forma mucho más
severa, en mobile (390×844) — donde además `sm:grid-cols-2` no aplica
(breakpoint 640px) y los 5 módulos se apilan en 5 filas en vez de 3.

El único nodo de la pila con la promoción `overflow-x:hidden → overflow-y:auto`
es el panel de módulos, así que absorbe el déficit total como scroll medible.
El panel "Acciones principales" (vecino inmediato, mismo contenido
redundante: activa los mismos módulos mediante los mismos botones que ya
ofrecen las tiles y, en mobile, `ClinicMobileBottomNav`) usa
`overflow: hidden` explícito y absorbía el mismo déficit como **recorte
silencioso** (11px en tablet, ~60px en mobile) — no detectado por el
assert de scroll porque `overflow:hidden` no es `auto`/`scroll`, pero sí
violaría el requisito de "no clipping" del fix.

## Cambio aplicado

Todo el cambio queda contenido en
`ClinicDashboardWorkspaceController.tsx` (componente `ClinicDashboardCockpit`):

1. **Tiles de módulos siempre a 2 columnas** — se quita el prefijo `sm:` de
   `grid-cols-2` para que el panel "Módulos clínicos" use 2 columnas (3 filas
   para 5 ítems) en todos los anchos, incluido mobile (antes 1 columna/5
   filas por debajo de 640px).
2. **Piso de altura de tile reducido** — `min-h-12` (48px) → `min-h-11`
   (44px) en los botones de tile. En desktop el alto real ya lo define el
   `stretch` del grid (muy por encima del piso), así que el cambio solo
   tiene efecto donde el piso realmente limitaba (tablet), cerrando
   exactamente los 12px medidos (3 filas × 4px).
3. **Panel "Acciones principales" oculto por debajo de `md` (768px)** — este
   panel es una lista de botones que duplica exactamente la navegación de
   las tiles de "Módulos clínicos" (mismo `activateModule(moduleId)`) y, en
   mobile, la de `ClinicMobileBottomNav` (que ya se muestra solo `md:hidden`,
   es decir, por debajo de 768px). Ocultarlo en ese mismo rango
   (`hidden md:flex`) elimina la duplicación de navegación y libera el
   espacio que el panel de módulos necesitaba en mobile, sin remover
   ninguna funcionalidad única. En tablet (≥768px, sin bottom-nav) el panel
   se mantiene visible.
4. **Piso de altura de los botones de "Acciones principales" reducido** —
   `min-h-9` (36px) → `min-h-8` (32px), cerrando el recorte silencioso
   preexistente detectado en tablet (11px → ≤1px, dentro de la tolerancia
   de 2px del contrato).

Ningún cambio toca `globals.css`, copy, ni las rutas full-page de
Informes/Logística (R-11+).

## Assertion e2e activada

En `e2e/dashboard-viewport-zoom-adaptability.spec.ts`:

- Se eliminó el campo `allowMeasuredInternalScroll` del tipo `SurfaceCase` y
  de la entrada `"clinic hub (cockpit)"` en `CORE_SURFACES`.
- El loop principal (`for (const viewport of ALL_VIEWPORTS) … for (const
  surface of CORE_SURFACES)`) ya no condiciona
  `assertNoMeasuredInternalVerticalScroll` a un flag por-surface: ahora se
  ejecuta incondicionalmente para las 5 surfaces de `CORE_SURFACES`,
  incluida `"clinic hub (cockpit)"`, en los 7 viewports de `ALL_VIEWPORTS`
  (incluye `tablet-768x1024` y `mobile-390x844`).
- No se tocaron `EXTRA_SURFACES`, `FULL_PAGE_DEEPLINKS` ni ninguna otra
  surface/ruta: el gate solo se volvió asertivo donde antes era informativo.

## Validaciones

Todas ejecutadas en el árbol de trabajo tras el fix:

- `pnpm test` → 2951 tests backend, 0 fallos (tras revertir la regeneración
  de `frontend/next-env.d.ts` tras cada corrida de e2e/dev server).
- `pnpm typecheck:test` → sin errores.
- `pnpm typecheck` → sin errores.
- `pnpm --dir frontend lint` → sin errores.
- `pnpm --dir frontend build` → build de producción exitoso (Next.js 16,
  Turbopack), rutas de `/dashboard` y afines siguen dinámicas (`ƒ`) como
  antes.
- `pnpm --dir frontend exec playwright test
  e2e/dashboard-viewport-zoom-adaptability.spec.ts --project=chromium
  --grep "clinic hub"` → 7/7 passed (los 7 viewports de `ALL_VIEWPORTS`,
  incluidos tablet y mobile).
- `pnpm --dir frontend exec playwright test
  e2e/dashboard-viewport-zoom-adaptability.spec.ts --project=chromium`
  (spec completo) → 60/60 passed, sin regresión en admin, tokens,
  full-page deep-links, ni particulares.
- `pnpm --dir frontend exec playwright test
  e2e/dashboard-card-navigation-shell.spec.ts --project=chromium` → 67/67
  passed (incluye los tests que pinnean `data-clinic-cockpit-primary-actions`
  visible con 5 botones nombrados, ejecutados en el viewport desktop por
  defecto de Playwright donde el panel sigue visible).
- `pnpm --dir frontend exec playwright test
  e2e/dashboard-clinic-controller-workspace-parity.spec.ts --project=chromium`
  → 27/27 passed (incluye "hub exposes operational cockpit sections and
  primary actions" y los checks de 390×844 sin scroll ni overflow
  horizontal).

### Medición antes/después (`div.dashboard-inline-list` — panel de módulos)

| Viewport | Antes (scroll medido) | Después (scroll medido) |
| --- | --- | --- |
| tablet-768x1024 | 12px | 0px |
| mobile-390x844 | 238px | 0px |

### Medición antes/después (`data-clinic-cockpit-primary-actions` — recorte silencioso, no medido por el gate pero relevante para "no clipping")

| Viewport | Antes (`scrollHeight - clientHeight`) | Después |
| --- | --- | --- |
| tablet-768x1024 | 11px (recorte silencioso) | ≤1px (dentro de tolerancia) |
| mobile-390x844 | ~60px (recorte silencioso) | 0px (panel oculto, redundante con bottom-nav) |

## Confirmación sin globals.css

`git diff --stat` de este PR toca únicamente:

- `frontend/src/components/dashboard/ClinicDashboardWorkspaceController.tsx`
- `frontend/e2e/dashboard-viewport-zoom-adaptability.spec.ts`
- `docs/implementation/remove-clinic-hub-inline-list-internal-overflow.md`

`frontend/src/app/globals.css` no fue modificado.

## Confirmación sin R-11/R-12/R-13/R-14

No se tocaron rutas full-page de Logística/Informes
(`frontend/src/app/dashboard/logistica/**`,
`frontend/src/app/dashboard/informes/**`), ni `MasterDetailWorkspace` (R-15),
ni tokens de Clínica (R-16). El único componente de producción modificado es
`ClinicDashboardWorkspaceController.tsx`, y dentro de él solo la función
`ClinicDashboardCockpit` (el hub `/dashboard` sin `?module=`), no las
workspaces de módulo (`operaciones`, `informes`, `logistica`, `perfil`,
`tokens`) que se renderizan al navegar a un módulo.
