# B08 — Navigation migration: mounting the lateral model

Nivel 5 del programa B (auditoría §49). Monta `NavigationDrawer` / `NavigationRail` (B07) en
todas las superficies que dependían de la navegación desktop/tablet y retira la navegación
legacy **de ese régimen**. Cierra G7.

## 1. Estado base

```text
rama            feat/dashboard-b08-navigation-migration
HEAD base       b06fa8a9ff4d601ceb43c009c101055b8957e8d1
base            main = b06fa8a9 (merge B07, PR #1670)
dependencias    B07 CLOSED · A08 CLOSED · G4 zero-scroll congelado
cierra          G7
```

`frontend/src/app/globals.css` es valla dura: **no aparece en el diff**.

## 2. Auditoría previa (caja blanca) — y la corrección de contrato que produjo

El contrato inicial de B08 pedía **retiro físico de los dos** componentes legacy. El censo
previo a editar demostró que las dos retiradas **no son simétricas**:

| Componente | Régimen real medido | Consecuencia |
|---|---|---|
| `DashboardHorizontalNav` | **sólo ≥768 px**: `md:block` + `display:none !important` bajo `max-width: 767px` en `mobile-admin.css:145` y `mobile-clinic.css:124` | Retirarlo no toca ninguna superficie móvil |
| `DashboardModuleRail` | **todos los anchos**, y es la **única** navegación de módulos de clínica en `<768 px` sobre `/dashboard`, porque `ClinicMobileBottomNav` hace `return null` en esa ruta (`ClinicMobileBottomNav.tsx:98`) | Borrarlo deja `/dashboard` sin navegación en teléfono y adelanta B09 |

Evidencia ejecutable de lo segundo: cuatro specs de cohorte `public-clinic` → `ci` (contexto
required) afirman, en viewports móviles, que `[data-dashboard-module-rail="true"]` está visible
**con prev/next** y que `[data-clinic-mobile-bottom-nav="true"]` tiene count 0
(`dashboard-clinic-{informes,logistica,perfil,tokens}-mobile-parity.spec.ts`), y
`dashboard-mobile-shell-nav-contract.spec.ts` lo repite para las cinco pantallas móviles.

Nico corrigió el contrato sobre esa evidencia:

```text
LEGACY_HORIZONTAL_NAV_PHYSICAL_RETIREMENT = REQUIRED
LEGACY_MODULE_RAIL_DESKTOP_RETIREMENT     = REQUIRED
LEGACY_MODULE_RAIL_PHYSICAL_RETIREMENT    = DEFERRED_TO_B09
```

Hallazgo secundario: `DashboardHorizontalNav` era el **único** portador del control «Volver al
sitio público» en ≥768 px. Se retira con él (ver §12, riesgo 1).

## 3. Scope

**Incluido**

- `DashboardNavigationFrame`: el único punto de montaje de las dos primitivas.
- Retiro físico de `DashboardHorizontalNav.tsx` y de todas sus referencias ejecutables.
- Retiro del rail legacy del régimen ≥768 px (CSS, no borrado).
- Montaje en las 7 superficies que perdieron la navegación desktop/tablet.
- `activeModule: AdminModule | null` en ambas primitivas (estado hub de admin).
- Bloque CSS B08 en `navigation.css`.
- Contrato estático `test/architecture/dashboard-b08-navigation-migration.test.ts`.
- Contrato runtime `frontend/e2e/regression/dashboard-b08-navigation-migration.spec.ts`.
- Realineación de los guards que anclaban literalmente al owner retirado (§9).

**Excluido (no-alcance explícito)**

- Modelo móvil `<768 px`, unificación de los dos bottom navs y borrado final del rail → **B09**.
- Unificación de los dos app shells de clínica / conversión de las rutas completas → **B10**.
- Degradar el hub admin a «Inicio» → **B13**.
- `WorkspaceScaffold` / reestructuración toolbar-filters-collection → **B15**.
- Recaptura de A02 / A03 (§10).
- Limpieza de los selectores CSS muertos del nav retirado y de los tokens huérfanos
  `--dash-sidebar-rail` / `--dash-sidebar-expanded` (§12, riesgos 2 y 3).

## 4. Topología: antes y después

```text
ANTES                                    DESPUÉS
app shell (columna)                      app shell (columna)
  header                                   header
    WorkspaceAppBar   (B06, 56px)            WorkspaceAppBar  (B06, 56px, full width)
    DashboardHorizontalNav (~37px)         DashboardNavigationFrame (fila)
  main                                       [ drawer 256 | rail 80 ]   main
    (clínica /dashboard: + module rail)      (clínica /dashboard <768: + module rail)
```

La banda lateral consume **inline-size**; no toca el presupuesto vertical. El app bar sigue
siendo full-width por encima de la fila.

## 5. Modelo de navegación

```text
>= 1280 px      NavigationDrawer   256 ±1 px · ítem 40 px
768 – 1279 px   NavigationRail      80 ±1 px · ítem 56 px
<  768 px       modelo móvil existente, sin cambios (B09)
                · clínica /dashboard  → DashboardModuleRail (legacy, vivo)
                · resto               → Admin/ClinicMobileBottomNav
```

Ambas primitivas se montan siempre; el CSS revela exactamente una. Nunca hay dos navegaciones
laterales visibles, y por debajo de 768 px no hay ninguna.

## 6. Mapeo de `activeModule` por ruta

| Ruta | `surface` | `activeModule` | Origen |
|---|---|---|---|
| `/dashboard/admin?module=<id>` | `admin` | `parseAdminModule(module)` | URL viva |
| `/dashboard/admin` (hub) | `admin` | `null` | URL viva → sin `aria-current` |
| `/dashboard[?module=<id>]` | `clinic` | `parseClinicModule(module) ?? DEFAULT_CLINIC_MODULE` | URL viva |
| `/dashboard/informes` | `clinic` | `informes` | prop `module` |
| `/dashboard/logistica` | `clinic` | `logistica` | prop `module` |
| `/dashboard/logistica/metricas` | `clinic` | `logistica` | prop `module` |
| `/dashboard/logistica/rutas` | `clinic` | `logistica` | prop `module` |
| `/dashboard/logistica/visitas` | `clinic` | `logistica` | prop `module` |

Las superficies con gramática `?module=` leen la URL viva (`useSearchParams`, dentro de
`Suspense`), que es exactamente lo que hacía la nav horizontal retirada y lo que mantiene
`aria-current` correcto en click, deep link, reload, Back y Forward. Las rutas completas
**declaran** su módulo porque `?module=` no forma parte de su gramática; no hay tabla
pathname→módulo dentro de ningún componente.

El fallback de `Suspense` renderiza la misma banda con el mismo ancho (admin con `null`, clínica
con el default), de modo que el tick suspendido no puede mover `main`.

## 7. Deep-link contract

```text
href                buildDashboardModuleHref(basePath, moduleId)   (capa application)
basePath            ROUTES.dashboardAdmin | ROUTES.dashboard
destino canónico    /dashboard?module=<id>  también desde una ruta completa de clínica
clínica             requestClinicModuleActivate(moduleId) en el click (preservado)
navegación          PublicRouteControl (button + router.push)
prohibido           next/link · <a> · window.location · location.href
aria-current        únicamente el módulo activo; el hub admin no fabrica ninguno
```

## 8. Ownership

```text
ids / orden / labels     features/dashboard/config/dashboardModules.ts
href ?module=            features/dashboard/application/dashboardModuleNavigation.ts
iconos                   components/dashboard/dashboardModuleIcons.ts        (B07)
geometría (px)           styles/dashboard/tokens.css                          (B07)
render de la banda       NavigationDrawer.tsx · NavigationRail.tsx            (B07)
montaje + módulo activo  DashboardNavigationFrame.tsx                         ← nuevo, B08
layout de la fila        styles/dashboard/navigation.css (bloque B08)         ← nuevo, B08
```

`DashboardNavigationFrame` **no posee nada**: no declara ids, ni labels, ni orden, ni geometría,
ni `?module=`. El contrato estático lo verifica literal id por id contra el catálogo.

El orden adoptado es el **canónico del catálogo**, no el de uso de la nav retirada. Para clínica
eso cambia la primera etiqueta de «Resumen» a «Operaciones»: el dashboard de clínica no tiene hub,
y «Resumen» sugería uno.

## 9. Paths

**Añadidos**

```text
frontend/src/components/dashboard/DashboardNavigationFrame.tsx
frontend/e2e/regression/dashboard-b08-navigation-migration.spec.ts
test/architecture/dashboard-b08-navigation-migration.test.ts
test/unit/ui/dashboard/frontend-dashboard-lateral-navigation.test.ts
```

**Retirados**

```text
frontend/src/components/dashboard/DashboardHorizontalNav.tsx
test/unit/ui/dashboard/frontend-dashboard-horizontal-nav.test.ts
```

**Modificados — runtime**

```text
frontend/src/components/dashboard/DashboardTopbar.tsx          retiro de import + render del nav horizontal
frontend/src/components/dashboard/NavigationDrawer.tsx         AdminModule | null + doc
frontend/src/components/dashboard/NavigationRail.tsx           AdminModule | null + doc
frontend/src/components/dashboard/DashboardModuleRail.tsx      sólo doc (régimen <768)
frontend/src/features/dashboard/presentation/navigation/index.ts
frontend/src/styles/dashboard/navigation.css                   bloque B08
frontend/src/app/dashboard/page.tsx                            (+6 rutas)
```

**Modificados — contratos realineados** (todos anclaban literalmente al owner retirado; ninguno
se debilita, varios se refuerzan)

```text
test/architecture/dashboard-b07-navigation-drawer-rail.test.ts   valla B08 + G-1 → postcondición B08
test/architecture/dashboard-b06-workspace-app-bar.test.ts        header de una sola banda
test/architecture/dashboard-presentation-import-boundaries.test.ts  B01: -nav, +frame
test/architecture/dashboard-b04-surface-token-migration.test.ts  banda lateral = chrome persistente
test/architecture/e2e-suite-catalog-completeness.test.ts         censos 82→83, ci 48→49
test/unit/infrastructure/e2e-completeness-workflow.test.ts       censo 82→83
test/unit/ui/admin/admin-{sessions,tokens,users-roles}-enterprise-density.test.ts
test/unit/ui/dashboard/frontend-dashboard-remove-home-unified-workspace.test.ts
frontend/e2e/helpers/dashboard-geometry-matrix.ts                + anclas de la banda lateral
frontend/e2e/suites/catalog.ts                                   alta del spec B08
frontend/e2e/admin/shell/admin-mobile-{final-polish,ops-modules}-no-scroll.spec.ts
frontend/e2e/clinic/shell/dashboard-{interaction-foundation,clinic-controller-workspace-parity}.spec.ts
frontend/e2e/clinic/shell/remove-dashboard-home-unified-workspace.spec.ts
frontend/e2e/platform/app-shell/dashboard-{card-navigation-shell,workspace-layout-polish,viewport-zoom-adaptability}.spec.ts
frontend/e2e/regression/evidence/remove-home-unified-workspace-screenshots.spec.ts
```

Criterio aplicado a los specs E2E: lo que era **navegación de módulos en desktop** se reapunta a
la banda lateral; lo que era **el pager prev/next del rail** se traslada al viewport móvil, que es
el único régimen donde ese pager sigue existiendo. Ninguna aserción se borra: se le asigna su
régimen real.

## 10. A02 / A03 / A05–A08 y el motor de capacidad

No se recapturó A02 ni A03, no se tocó ningún fixture baseline y no se cambió ningún `limit`
esperado.

```text
A02 dashboard-geometry-baseline      cohorte extended · NOT_RUN local · CAMBIO TARGET ESPERADO
A03 dashboard-adaptive-limit-baseline cohorte extended · NOT_RUN local · REVISAR (ver abajo)
A05 dashboard-limit-invariance        cohorte extended · NOT_RUN local
```

Lo que B08 mueve, y por qué la clasificación importa:

- **Inline-size de `main`**: se reduce en 256 px (≥1280) u 80 px (768–1279). A02 congela
  geometría, así que **fallará por diseño**: es un cambio TARGET de B08, no una regresión.
- **Presupuesto vertical**: la nav horizontal retirada ocupaba ~37 px *dentro del header*, y el
  rail legacy ~39 px *dentro de `main`* en la clínica. Retirarlos **libera** altura, de modo que
  el `limit` adaptativo sólo puede subir o quedarse igual, nunca bajar. A03 congela la ventana
  actual, así que también puede moverse — hacia arriba.

Ninguna de las dos se «arregla» aquí. Recapturar A02/A03 es una decisión de Nico y un PR propio,
con su propia evidencia; hacerlo dentro de B08 convertiría un guard en un espejo del cambio que
debía vigilar. A05–A07 siguen siendo el guard estructural contra el acoplamiento
geometría → `limit` y no se tocaron.

## 11. Gates

Ver el informe de la entrega para los estados canónicos observados. Selección por impacto (§6
AGENTS): frontend visual + `test/architecture` ⇒ test dirigido → guards realineados → lint →
typecheck → build → `security:public-surface` → `validate:local` → cohorte `visual-contract`.

## 12. Riesgos residuales

1. **«Volver al sitio público» desaparece de ≥768 px.** Era un control exclusivo de
   `DashboardHorizontalNav`. En admin móvil sobrevive dentro de `AdminMobileKebabMenu`; en
   escritorio no hay reemplazo. Ninguna aserción lo cubría. Reponerlo pertenece al app bar (B06)
   o al drawer (B12/B13), no a esta retirada.
2. **Selectores CSS muertos.** `[data-dashboard-horizontal-nav-shell="true"]` sigue declarado en
   `globals.css:98`, `surfaces.css:648`, `mobile-admin.css:15,145` y `mobile-clinic.css:124`. Son
   inertes. No se limpian aquí por dos razones: `globals.css` es valla dura de este PR, y el
   ancla de `surfaces.css` está fijada literalmente por el manifiesto B04, cuya reescritura es
   otro scope.
3. **Tokens huérfanos 72/240.** `--dash-sidebar-rail` y `--dash-sidebar-expanded` siguen en
   `responsive.css`. B08 verifica por test que **no** los reutiliza; eliminarlos es deuda aparte.
4. **A02/A03 pendientes de decisión.** Ver §10.
5. **Doble owner de navegación de clínica hasta B09.** Entre 0 y 767 px manda el rail legacy;
   desde 768 px manda la banda lateral. Es una frontera declarada y verificada en los dos
   sentidos por el spec B08, pero sigue siendo dos componentes para una función hasta que B09 la
   cierre.
6. **Desfase óptimo de `aria-current` en clínica.** El stage cambia de módulo de forma optimista
   (`requestClinicModuleActivate`) mientras la banda sigue la URL. La divergencia dura el commit
   del router (sub-segundo) y converge siempre; el señal de hub-reset que cambia el stage sin
   tocar la URL sólo lo emiten superficies `<768 px`, donde la banda no pinta.

## 13. Rollback lógico

B08 es revertible como unidad: restaurar `DashboardHorizontalNav.tsx` y su import/render en
`DashboardTopbar`, eliminar `DashboardNavigationFrame.tsx` y sus 7 montajes, y quitar el bloque
`dashboard-b08-navigation-migration` de `navigation.css` (lo que devuelve el rail legacy a
≥768 px). No hay estado persistido, ni migración de datos, ni cambio de contrato HTTP: la
reversión es puramente de render. Los contratos realineados vuelven con el mismo revert.

## 14. Fronteras que B08 NO cruzó

```text
B09   modelo móvil intacto: ClinicMobileBottomNav conserva su early return en /dashboard,
      AdminMobileBottomNav / KebabMenu / ModuleMenu / HubLauncher / HubPager sin cambios,
      ADMIN_MOBILE_TITLES sigue declarado y consumido en DashboardTopbar
B10   las 5 rutas completas de clínica conservan su propio shell (DashboardTopbar + main)
      y NO se convirtieron al controller de /dashboard
B13   DashboardModuleHub sigue vivo y renderizado por el controller admin; el hub NO se
      degradó a «Inicio» y el estado null NO fabrica aria-current
B15   no se introdujo WorkspaceScaffold ni se reestructuró toolbar/filters/collection
```

Los cuatro están verificados por aserciones del contrato estático B08, no sólo declarados aquí.
