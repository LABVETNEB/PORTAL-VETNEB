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
3. **Panel "Acciones principales" oculto por debajo de `lg` (1024px)** — este
   panel es una lista de botones que duplica exactamente la navegación de
   las tiles de "Módulos clínicos" (mismo `activateModule(moduleId)`) y, en
   mobile, la de `ClinicMobileBottomNav` (que se muestra solo `md:hidden`,
   es decir, por debajo de 768px). Ocultarlo con `hidden lg:flex` elimina la
   duplicación de navegación y libera el espacio que el panel de módulos
   necesita tanto en mobile como en tablet. Solo a partir de `lg` (1024px),
   cuando el cockpit pasa a dos columnas (`lg:grid-cols-[minmax(0,1fr)_minmax(0,0.82fr)]`,
   línea 315), el panel vuelve a mostrarse junto a las tiles.
4. **Piso de altura de los botones de "Acciones principales" reducido** —
   `min-h-9` (36px) → `min-h-8` (32px). Sin efecto visual en `lg`+ (el alto
   real lo define el `stretch` del grid, muy por encima del piso); se
   mantiene por consistencia con el piso reducido de las tiles y porque
   cerraba un recorte silencioso preexistente en escritorio angosto.

Ningún cambio toca `globals.css`, copy, ni las rutas full-page de
Informes/Logística (R-11+).

### Iteración 2 — corrección post-CI (commit `430f0c1`)

La primera iteración de este fix (commit `69e25f3`) usaba `hidden md:flex`
(el panel de acciones reaparecía a partir de 768px, es decir, ya visible en
tablet-768x1024, apilado bajo "Módulos clínicos" en el layout de una sola
columna). Localmente esa versión medía 0px de overflow en los 7 viewports,
pero **Frontend CI falló** en el mismo caso con:

```
adaptive app shell — tablet-768x1024 › clinic hub (cockpit) fits without global scroll
internal vertical scroll on div.dashboard-inline-list.rounded-lg.border
Expected <= 2
Received 8
```

El ajuste `min-h-12 → min-h-11` en las tiles cerraba el déficit de forma
exacta (0px de margen) cuando el panel de acciones seguía compitiendo por
el mismo espacio en tablet; esa medición al límite resultó sensible a
diferencias sub-píxel de renderizado de fuentes entre el entorno local y el
runner de CI, produciendo el `Received 8` intermitente.

La corrección (`md:flex` → `lg:flex`) elimina la causa del ajuste al límite
en vez de afinarlo más: en tablet (768–1023px) el panel de acciones ya no
compite por espacio en absoluto (no se renderiza), así que "Módulos
clínicos" dispone de toda la fila sin depender de un cálculo de píxeles
exacto. Verificado con diagnóstico directo (no solo pass/fail): el
`overflowY` medido en `div.dashboard-inline-list` es **0px** con
`selector: null` (ningún elemento de la pila activa la promoción
`overflow-y: auto`) en los 7 viewports de `ALL_VIEWPORTS`, con margen real,
no un ajuste al límite.

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

Todas ejecutadas en el árbol de trabajo con el fix corregido (`lg:flex`,
commit `430f0c1`):

- `git status --short --untracked-files=all` → limpio antes y después de
  cada corrida (una vez restaurado `next-env.d.ts`).
- `git diff --check` → sin conflictos ni whitespace issues.
- `pnpm --dir frontend exec playwright test
  e2e/dashboard-viewport-zoom-adaptability.spec.ts --project=chromium
  --grep "clinic hub"` → 7/7 passed (los 7 viewports de `ALL_VIEWPORTS`,
  incluidos tablet-768x1024 y mobile-390x844), con `overflowY: 0` y
  `selector: null` verificado por diagnóstico directo (no solo pass/fail).
- `git restore frontend/next-env.d.ts` → revertida la regeneración del dev
  server de Playwright antes de correr `pnpm test`.
- `pnpm test` → 2951 tests backend, 0 fallos.
- `pnpm typecheck:test` → sin errores.
- `pnpm typecheck` → sin errores.
- `pnpm --dir frontend lint` → sin errores.
- `pnpm --dir frontend build` → build de producción exitoso (Next.js 16,
  Turbopack), rutas de `/dashboard` y afines siguen dinámicas (`ƒ`) como
  antes.
- `git restore frontend/next-env.d.ts` + `git status --short
  --untracked-files=all` → árbol de trabajo limpio al final, sin
  `next-env.d.ts` modificado.

Adicionalmente, para descartar regresión en la surface completa y en los
specs que pinnean la estructura del cockpit:

- `pnpm --dir frontend exec playwright test
  e2e/dashboard-viewport-zoom-adaptability.spec.ts --project=chromium`
  (spec completo) → 60/60 passed, sin regresión en admin, tokens,
  full-page deep-links, ni particulares.
- `pnpm --dir frontend exec playwright test
  e2e/dashboard-card-navigation-shell.spec.ts --project=chromium` → 66/67
  passed; el único fallo (`admin hub renders Administración card`, surface
  Admin, fuera de scope de este PR) es un flake confirmado — pasa en
  aislamiento (`--grep` sobre ese único test, 1/1 passed). No relacionado
  con el cambio de `md:flex` a `lg:flex` en Clínica. Los tests que pinnean
  `data-clinic-cockpit-primary-actions` visible con 5 botones nombrados
  (ejecutados en el viewport desktop 1280×720 por defecto de Playwright,
  ≥1024px) siguen pasando sin cambios.
- `pnpm --dir frontend exec playwright test
  e2e/dashboard-clinic-controller-workspace-parity.spec.ts --project=chromium`
  → 27/27 passed (incluye "hub exposes operational cockpit sections and
  primary actions" y los checks de 390×844 sin scroll ni overflow
  horizontal).

### Medición antes/después (`div.dashboard-inline-list` — panel de módulos)

Medido con `readWorstInternalVerticalScroll` (recorre `main` buscando el
peor `overflow-y: auto|scroll` medido, no solo pass/fail):

| Viewport | Antes de R-10 | Iteración 1 (`md:flex`, CI) | Iteración 2 (`lg:flex`, actual) |
| --- | --- | --- | --- |
| tablet-768x1024 | 12px | 8px (CI, `Received 8` — ajuste al límite sensible a render) | **0px**, `selector: null` |
| mobile-390x844 | 238px | 0px (local) | **0px**, `selector: null` |

Todos los demás viewports de `ALL_VIEWPORTS` (desktop, zoom-eff, laptop):
**0px**, `selector: null` en las tres iteraciones.

### Medición antes/después (`data-clinic-cockpit-primary-actions` — recorte silencioso, no medido por el gate pero relevante para "no clipping")

| Viewport | Antes de R-10 | Después (`lg:flex`) |
| --- | --- | --- |
| tablet-768x1024 | 11px (recorte silencioso) | N/A — panel no se renderiza (`hidden` hasta `lg`), no compite por espacio ni se recorta |
| mobile-390x844 | ~60px (recorte silencioso) | N/A — panel no se renderiza, redundante con `ClinicMobileBottomNav` |
| desktop / laptop / zoom-eff (≥1024px) | sin recorte | sin recorte (0px, panel visible en layout de 2 columnas) |

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
