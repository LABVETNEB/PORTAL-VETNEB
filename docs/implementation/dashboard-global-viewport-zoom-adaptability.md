# Dashboard global — Viewport-aware Adaptive App Shell (adaptabilidad real a tamaño de pantalla y zoom)

- **Rama:** `fix/dashboard-global-viewport-zoom-adaptability`
- **Base:** `main` @ `6daae2b fix(ci): restore post-dashboard global validation (#1016)`
- **Fecha:** 2026-06-17
- **Tipo:** Implementación frontend/CSS + tests E2E + documentación. Sin cambios de backend, API, payloads, auth ni dependencias.

## 1. Problema observado

En el navegador, ambos dashboards (Clínica y Administración) se veían **proporcionados sólo con Chrome al 50%**. A 80–100% de zoom el layout quedaba **grande/denso**, perdía equilibrio visual y no se adaptaba al viewport efectivo: paddings, gaps, alturas de paneles y listas se sentían sobredimensionados para el alto disponible.

El App Shell ya era de pantalla fija correcta (`h-dvh overflow-hidden` en el shell + `.dashboard-main { overflow-hidden }`, contrato PR-A/#1014) y con master-detail enmascarado en ambos dashboards (#1015). Pero **fijaba la pantalla sin adaptar la densidad**.

## 2. Causa técnica

El shell adaptaba **posición** (pantalla fija, sin scroll global) pero **no densidad**. Toda la métrica interna estaba escrita en unidades `rem` **fijas**:

- `.dashboard-main` con padding `px-3/sm:px-6/lg:px-8` + `py-3/sm:py-5/lg:py-6` y `space-y-4/sm:space-y-6`.
- `.dashboard-master-panel` / `.dashboard-detail-panel` con `min-height: 18rem` rígido (en single-column forzaba ≥36rem).
- Cockpit, `ModuleSurface`, `ModuleTabs`, tabs, list-rows, etc. con gaps/paddings/alturas fijos.

**El zoom del navegador cambia el viewport efectivo en píxeles CSS.** Una pantalla 1920×1080 a 150% se comporta como ~1280×720 CSS px; a 50% se comporta como un viewport mucho mayor. Con medidas fijas, a 50% "sobra" altura y todo se ve equilibrado; a 100% la misma métrica fija queda densa para el alto real. El problema no era el App Shell: era que **la densidad no era función del viewport efectivo**.

## 3. Por qué el zoom manual no es solución

Bajar Chrome a 50% sólo **infla artificialmente el viewport efectivo** para que la métrica fija "entre". No es operable (texto minúsculo, dependencia del usuario) y no escala a distintas pantallas. La solución correcta es que el shell **adapte densidad** al viewport efectivo, de modo que a 100% se vea proporcionado por sí mismo. Tampoco se resolvió con:

- `zoom` CSS global (deforma todo y no es adaptativo).
- Reducción indiscriminada de `font-size` global (degrada legibilidad).
- Scroll global (rompe el contrato de pantalla fija PR-A/#1014).
- Parches módulo por módulo sin contrato común.

## 4. Solución: Viewport-aware Adaptive App Shell

Capa **global de densidad** por **variables CSS** scoped a `.dashboard-app-shell` (envuelve TODAS las rutas `/dashboard/**` de ambos dashboards vía `DashboardShellRouter`). Los tokens son **fluidos** con `clamp()` keyed a ancho (`vw`) y al **alto efectivo del viewport** (`vh`), y **escalonan a modo compacto** con `@media (max-height/-width)`.

Como el zoom del navegador cambia el alto del viewport CSS, las media queries por alto hacen que el shell **se compacte automáticamente bajo zoom**, sin zoom manual, sin `zoom` CSS y sin reducir el font global. Los tokens se aplican con selectores de **mayor especificidad** (`.dashboard-app-shell …`), por lo que **no se editan** los strings `@apply`/className pineados por tests, y el contrato no-scroll se preserva (toda reducción sólo ayuda a entrar).

### 4.1. Tokens de densidad (`globals.css`, sección `dashboard-viewport-zoom-adaptability`)

| Token | Rol | Base (fluido) |
|---|---|---|
| `--dash-header-h` | alto de header (documentado; chrome ya estable por ancho) | `4.5rem` → `4/3.6rem` compacto |
| `--dash-sidebar-rail` / `--dash-sidebar-expanded` | ancho de sidebar (rail 4.5rem / expand 15rem, ya adaptativo por ancho 2xl) | `4.5rem` / `15rem` |
| `--dash-pad-x` | padding horizontal de página | `clamp(0.75rem, 0.45rem + 1vw, 2rem)` |
| `--dash-pad-y` | padding vertical de página | `clamp(0.6rem, 0.4rem + 0.7vh, 1.5rem)` |
| `--dash-rhythm` | ritmo vertical entre secciones de `main` | `clamp(0.6rem, 0.4rem + 0.7vh, 1.5rem)` |
| `--dash-gap` | gap entre paneles/cards | `clamp(0.55rem, 0.35rem + 0.55vh, 1rem)` |
| `--dash-card-pad` | padding interno de cards | `clamp(0.65rem, 0.45rem + 0.5vw, 1rem)` |
| `--dash-panel-min` | alto mínimo de paneles master/detail (reemplaza el rígido 18rem) | `clamp(6rem, 1rem + 18vh, 18rem)` |
| `--dash-control-h` | altura de filtros/controles | `clamp(2rem, 1.75rem + 0.6vh, 2.5rem)` |
| `--dash-tab-h` | altura de tabs | `clamp(1.9rem, 1.6rem + 0.7vh, 2.25rem)` |
| `--dash-cockpit-gap` | gap del cockpit (hub) | `clamp(0.5rem, 0.3rem + 0.6vh, 1.15rem)` |
| `--dash-list-pad-y` | densidad vertical de filas de lista | `clamp(0.4rem, 0.3rem + 0.25vh, 0.65rem)` |
| `--dash-secondary-font` | densidad tipográfica de texto secundario (sólo modo compacto) | `0.75rem` → `0.7rem` |

### 4.2. Escalones de modo compacto (automáticos por alto)

- `@media (max-height: 860px)` — laptop común a 100% (1366×768 / 1280×720 / 1536×864 efectivo): reduce pad-y, ritmo, gap, card-pad, panel-min, cockpit-gap.
- `@media (max-height: 760px)` — laptop chico / zoom alto: además header-h, tab-h, list-pad.
- `@media (max-height: 680px)` — zoom fuerte en panel 1080p (~1280×720 efectivo): valores ultra-compactos + `--dash-secondary-font`.
- `@media (max-width: 1280px)` — ancho efectivo angosto: padding de página acotado.

### 4.3. Superficies que consumen los tokens (scoped, sin tocar strings pineados)

`.dashboard-main` (padding + ritmo), `.dashboard-cockpit` (gap), `.dashboard-module-surface` / `.dashboard-module-tabs` (gap), `.dashboard-module-tab` (min-height), `.dashboard-master-panel` / `.dashboard-detail-panel` (min-height fluido), `.dashboard-list-row` (padding vertical). En modo compacto (`max-height: 760px`): topbar (vía su hook `[data-dashboard-topbar-polish]`, sin editar className) y `.dashboard-section-description` (texto secundario).

## 5. Contrato visual nuevo

- Sin scroll global en `html`, `body`, shell ni `.dashboard-main` (preservado de PR-A/#1014; verificado en toda la matriz).
- **No depende de zoom 50%.** A 100% entra proporcionado por densidad adaptativa.
- Si baja el alto disponible (pantalla chica o zoom alto), **modo compacto automático**: menos padding vertical, gaps, alturas de headers/filtros internos, densidad de cards, badges/timeline secundarios y alto visible de listas.
- No se oculta información crítica; el chrome (sidebar nav + header) permanece visible en desktop.
- Sin superposición filtros/lista/detalle; sin re-apilar formulario+lista+detalle (preservado de #1015).
- Legibilidad mantenida: **no** se reduce el font global; sólo texto secundario en modo ultra-compacto.

## 6. App Shell, no página web

El dashboard se trata como **Adaptive Dashboard App Shell**: navegación lateral fija, header fijo, `main` fijo, densidad adaptativa al viewport efectivo. El chrome ya era estable por ancho (sidebar rail `w-[4.5rem]` → expand `2xl:w-60`; header `min-h-[4.5rem]`); la capa nueva ataca la **densidad del contenido**, que era el origen real del desbalance a 100%.

## 7. Archivos modificados

| Archivo | Cambio |
|---|---|
| `frontend/src/app/globals.css` | Nueva sección `dashboard-viewport-zoom-adaptability` (tokens de densidad fluidos + escalones compactos + aplicación scoped). No se editó ningún `@apply`/regla pineada existente. |
| `frontend/e2e/dashboard-viewport-zoom-adaptability.spec.ts` | **Nuevo** E2E de adaptabilidad viewport/zoom (matriz de viewports × ambos dashboards) + pruebas de que la densidad se compacta al achicarse el alto efectivo. |
| `docs/implementation/dashboard-global-viewport-zoom-adaptability.md` | **Nuevo** este documento. |

No se modificó backend, `frontend/next-env.d.ts`, `package.json`/lock, ni componentes/strings pineados.

## 8. Viewports cubiertos (E2E)

- **Desktop real:** 1920×1080, 1600×900, 1366×768, 1280×720.
- **Viewport efectivo / zoom:** 1536×864 (≈ zoom alto en 1920×1080), 1280×720 (zoom más exigente).
- **Tablet / móvil:** 768×1024, 390×844.

Superficies (ambos dashboards): Clínica hub, Informes in-shell, Tokens particulares, Logística in-shell (todas en la matriz completa, incl. móvil); Administración hub, Resumen/Alertas, Mantenimiento, Roles clínica; rutas full-page deep-link (`/dashboard/informes`, `/dashboard/logistica`) en la matriz desktop + zoom efectivo. Pruebas de adaptabilidad: el padding de página y el `min-height` de paneles **disminuyen** al pasar de 1920×1080 a 1280×700.

### Nota de contrato sobre rutas full-page

Las rutas `/dashboard/informes` y `/dashboard/logistica` son los **deep-links de "página completa"**, gemelos de los módulos in-shell `?module=informes` / `?module=logistica`. La garantía de no-scroll estricta a **todo viewport, incluido móvil**, la entregan los **módulos in-shell** (validados a 390×844). Las rutas full-page se validan en la matriz desktop + zoom efectivo (el caso real del reclamo de "100% de zoom"); en móvil 390 px su `LogisticsCommandCenter` (página vertical con `space-y-5`/`gap-6` y dos cards apiladas, patrón heredado) puede exceder marginalmente — es comportamiento de página completa, cubierto operativamente por el módulo in-shell.

## 9. Comportamiento compacto (resumen)

A medida que baja el alto efectivo (pantalla chica o zoom alto): padding de página y ritmo vertical se reducen; el `min-height` de paneles master/detail pasa de fluido (hasta 18rem) a 4–5rem; gaps de módulos/tabs y altura de tabs bajan; filas de lista se densifican; el header se compacta vía su hook; el texto secundario reduce un punto. El contenido crítico y las acciones primarias permanecen visibles.

## 10. Validaciones ejecutadas

| Comando | Resultado |
|---|---|
| `pnpm --dir frontend lint` | ✓ OK |
| `pnpm --dir frontend typecheck` | ✓ OK |
| `pnpm test` (nativos) | ✓ OK |
| `pnpm --dir frontend build` | ✓ OK |
| `pnpm build` (backend) | ✓ OK |
| `pnpm security:public-surface` | ✓ PASS |
| `pnpm audit --prod` | ✓ OK |
| E2E `dashboard-viewport-zoom-adaptability.spec.ts` (nuevo) | ✓ 56/56 |
| E2E suite dashboard (no-scroll, masked master-detail, shell, layout polish, a11y, etc.) | ✓ 170/170 |

`frontend/next-env.d.ts` se restauró tras cada `next dev`/`next build` (sin cambios finales).

## 11. Riesgos / remanentes

- **Riesgo bajo.** Cambio CSS aditivo (nueva sección delimitada) que sólo **reduce** densidad por viewport; no toca overflow del shell ni strings pineados. Toda reducción ayuda al contrato no-scroll.
- **Datos reales:** los E2E corren en modo degradado (`NEXT_PUBLIC_API_URL=""`). El fit con datos reales sigue acotado por las listas paginadas (`usePagedRows`/`CompactPager`) de #1015; la densidad adaptativa sólo mejora el margen.
- **Rutas full-page deep-link en móvil:** ver §8. La adaptabilidad estricta móvil vive en los módulos in-shell; las páginas completas heredan el patrón vertical previo (no regresado, sólo más compacto).
- **Sin cambios de seguridad/API:** no se tocaron payloads, endpoints, separación de sesión (`app_session_id`/`admin_session_id`) ni invariantes; `security:public-surface` y `audit --prod` en verde.
