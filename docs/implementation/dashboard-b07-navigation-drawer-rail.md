# B07 — NavigationDrawer (256 px) + NavigationRail (80 px)

Nivel 4 del programa B (auditoría §49). Crea las dos primitivas de navegación lateral y su
contrato geométrico. **No las monta**: esa es la frontera aprobada de este PR.

## 1. Estado base

```text
rama            feat/dashboard-b07-navigation-drawer-rail
HEAD            ffccb6a7678d8f61c8c96691885c759fe143e484
base            origin/main = ffccb6a7 (0 0 respecto de main)
dependencia     B06 — WorkspaceAppBar (PR #1665, d24c418b)
prerequisito    PR #1669 — canonicalización de globals.css (GLOBALS_ZERO_DIAGNOSTICS)
```

`frontend/src/app/globals.css` es valla dura de este PR: quedó canonizado en #1669 y **no aparece
en el diff de B07**.

## 2. Scope

**Incluido**

- `NavigationDrawer` y `NavigationRail` como primitivas de presentación puras.
- `dashboardModuleIcons.ts`: dueño único del mapa módulo → glifo.
- Bloque de tokens geométricos B07 en `tokens.css` y su aplicación en `navigation.css`.
- Reexports B07 en `presentation/navigation` y refuerzo del guard B01.
- Contrato estático ejecutable `test/architecture/dashboard-b07-navigation-drawer-rail.test.ts`.

**Excluido (no-alcance explícito)**

- Montar las primitivas en el shell y retirar `DashboardHorizontalNav` / `DashboardModuleRail` → **B08**.
- Navegación móvil `< 768 px` (dos bottom nav + kebab + module menu) → **B09**.
- Unificación de los dos app shells de clínica → **B10**.
- Degradar el hub a «Inicio» y consolidar los mapas de iconos legacy → **B13**.
- Recaptura de A02 y de A03: sus fixtures no se tocan (delta 0).
- Medición runtime 256/80 ±1 px → **B08** (§9).

## 3. Decisión arquitectónica: `B07_MODE = G-1`

```text
B07  crea las primitivas, sus tokens, su CSS, su barrel y su guard.
B08  las monta, migra los consumidores y retira la navegación legacy.
B09  resuelve el modelo móvil (< 768 px).
```

Motivo de la frontera: montar un segundo modelo de navegación junto al vivo produciría **doble
navegación** visible, movería `main` y re-paginaría los 15 consumidores adaptativos congelados por
A03 (el margen medido en `admin-clinics @1280x720` es 0.016 px: cualquier delta positivo cuesta una
fila). Separar creación de montaje deja B07 revertible de forma independiente.

## 4. Arquitectura

| Capa | Rol en B07 |
|---|---|
| `features/dashboard/config` | Dueño de ids, orden y labels. B07 no lo modifica. |
| `features/dashboard/application` | Dueño de la gramática `?module=` (`buildDashboardModuleHref`). |
| `components/dashboard/*` | **Ubicación física** de las primitivas y del dueño de iconos. |
| `features/dashboard/presentation/navigation` | **Frontera de reexport**, nunca dueño (B01). |

Las primitivas viven en `components/dashboard/` porque el barrel B01 es un módulo de reexport puro
cuyos targets deben resolver a `@/components/dashboard/*.tsx`
(`test/architecture/dashboard-presentation-import-boundaries.test.ts` lo verifica por path). Crear
implementación física dentro de `presentation/navigation/` convertiría la frontera en un hogar.

**Pureza de presentación.** El cierre de imports de primer orden de ambas primitivas
(`PublicRouteControl`, `config`, `application`, `clinic-hub-reset`, `routes`, `utils`,
`dashboardModuleIcons`) no alcanza `@/lib/api` ni la capa `app/` a ninguna profundidad. Por eso los
dos targets entran en el barrel B01 **bajo el mismo cierre transitivo** que los targets legacy: no
se añadió excepción, exclusión de path ni allowlist.

## 5. Ownership

```text
ids / orden / labels        features/dashboard/config/dashboardModules.ts
href `?module=`             features/dashboard/application/dashboardModuleNavigation.ts
iconos (React)              components/dashboard/dashboardModuleIcons.ts   ← nuevo, B07
geometría (px)              styles/dashboard/tokens.css (bloque B07)
render                      NavigationDrawer.tsx · NavigationRail.tsx
```

`dashboardModuleIcons.ts` **no es un segundo catálogo**: no posee labels, ni orden, ni aliases, ni
validación, ni construcción de href. Su exhaustividad es una propiedad de **tipos**
(`Record<AdminModule, LucideIcon>`), de modo que agregar un módulo al catálogo sin su glifo rompe
`typecheck`, no un test de censo. El motivo de que los iconos no vivan en `config/` es la regla de
frontera de esa capa: **sin imports de React**.

Los mapas de iconos legacy (`DashboardModuleRail`, `AdminMobileModuleMenu`, `ClinicMobileBottomNav`,
el controller admin) **no se migran aquí**: son superficies que poseen B08/B09/B13. B07 no agrega
una cuarta copia; el dueño nuevo sirve sólo a las primitivas nuevas.

## 6. Matriz canónica (15 módulos)

```text
Admin   = 10   (ADMIN_MODULE_IDS)
Clínica =  5   (CLINIC_MODULE_IDS)
Total   = 15
```

Las cardinalidades se verifican derivándolas del catálogo, no hardcodeándolas en las primitivas: el
test parsea `ADMIN_MODULE_IDS`/`CLINIC_MODULE_IDS` desde la fuente y exige 10 / 5 / 15 **antes** de
iterar, y además falla si cualquiera de esos ids aparece como literal dentro de Drawer o Rail.

## 7. Geometría

| Elemento | Valor | Token |
|---|---:|---|
| NavigationDrawer (ancho) | 256 px ±1 | `--dash-nav-drawer-w` + `--dash-nav-band` |
| NavigationRail (ancho) | 80 px ±1 | `--dash-nav-rail-w` + `--dash-nav-band` |
| Ítem de drawer (alto) | 40 px | `--dash-nav-item-h` |
| Ítem de rail (alto) | 56 px | `--dash-nav-rail-item-h` |
| Radio ítem de rail | 16 px | `--dash-nav-rail-item-radius` |
| Radio ítem de drawer | pill | `--dash-shape-full` |
| Padding drawer / rail | 8 px / 8 px 0 | `--dash-space-2` |
| Padding ítem de drawer | 0 12 px | `--dash-space-3` |
| Borde derecho | 1 px | `--dash-color-outline-subtle` |
| Radio contenedor | 0 | `--dash-shape-none` |
| Sombra | none | `--dash-elevation-none` |

El ancho se aplica como **banda** (`min-inline-size` / `max-inline-size` derivados del token), nunca
como ancho fijo paralelo, y ningún `.tsx` restata 256/80/40/56/16.

`--dash-nav-rail-item-radius` se declara porque la escala de shape B03 no tiene paso de 16 px
(cluster en 0.85 rem = 13.6 px y 1.1 rem = 17.6 px): redondear al más cercano sería un cambio
silencioso de geometría. El ítem de drawer sí usa la escala (`--dash-shape-full`), porque en una
fila de 40 px un pill **es** el radio 20 px especificado.

**Responsive**

```text
< 768 px        ninguna de las dos   (modelo móvil = B09)
768 – 1279 px   NavigationRail
>= 1280 px      NavigationDrawer
```

Las dos pueden coexistir en el DOM (es como B08 las montará) sin que se rendericen nunca a la vez:
el estado base es `display: none` y cada rango de viewport revela exactamente una.

**Sin estado persistido.** No hay `localStorage`, ni storage key nueva, ni botón de colapso manual,
ni `useState`/`useEffect`: cuál primitiva se ve es función pura del viewport y la decide el CSS.

## 8. Deep links y activación

- Todo href se construye con `buildDashboardModuleHref(basePath, item.moduleId)`; ninguna primitiva
  contiene `?module=` en código ejecutable.
- `basePath` sale de `ROUTES.dashboardAdmin` / `ROUTES.dashboard`.
- Clínica conserva `requestClinicModuleActivate(item.moduleId)` en el click, para que el controller
  intercambie el módulo antes del commit asíncrono de la URL.
- Navegación por `PublicRouteControl` (button + `router.push`). Prohibidos y verificados ausentes:
  `next/link`, `<a>`, `window.location`, `location.href`.
- Sólo el ítem activo lleva `aria-current="page"`.

## 9. Accesibilidad

```text
landmark              <nav> con aria-label propio por rol y por primitiva
                      (drawer: "Navegación lateral de…", rail: "Navegación lateral compacta de…")
aria-current          únicamente el módulo activo
drawer                label completo visible = nombre accesible
rail                  shortLabel visible + aria-label con el label completo + title de apoyo
iconos                aria-hidden="true" (decorativos)
foco                  outline: 2px solid var(--dash-color-focus-ring) + outline-offset: 2px
orden de tab          natural; sin roving tabindex, sin focus trap
reduced motion        @media (prefers-reduced-motion: reduce) → transition: none
forced colors         @media (forced-colors: active) → el activo se restata como outline
```

Dos decisiones que conviene no revertir sin leer esto:

1. **Los landmarks no se llaman «Navegación principal».** La nav horizontal legacy sigue usando ese
   nombre hasta B08; dos landmarks con el mismo nombre accesible son indistinguibles para un lector
   de pantalla.
2. **El bloque CSS de B07 es *unlayered*.** `PublicRouteControl` emite utilidades Tailwind
   (`focus-visible:outline-none`, `focus-visible:ring-*`) que viven en `@layer utilities`; una regla
   de foco dentro de `@layer components` perdería la cascada y el bloque sólo *parecería* accesible.
   Es la misma disciplina que el bloque B06 de `layout.css`.

Los objetivos táctiles `< 768 px` no se tocan: los posee B09.

## 10. Vallas de scope (verificadas por test)

| Valla | Contenido | Estado |
|---|---|---|
| B08 | `DashboardHorizontalNav.tsx`, `DashboardModuleRail.tsx` existen y siguen exportados por el barrel | intacto |
| B09 | `AdminMobileBottomNav`, `ClinicMobileBottomNav`, `AdminMobileModuleMenu` | intacto |
| B06 | `WorkspaceAppBar` + `--dash-app-bar-h: 56px` declarado una sola vez | intacto |
| G-1 | ninguna superficie renderiza `<NavigationDrawer>` ni `<NavigationRail>` | verificado |

## 11. Tests

```text
RED     test/architecture/dashboard-b07-navigation-drawer-rail.test.ts
        ejecutado ANTES de implementar: 22 fail / 3 pass (las 3 verdes son las vallas
        B08/B09/G-1, que describen estado preexistente), exit code 1
GREEN   25 / 25 PASSED tras la implementación

B01     test/architecture/dashboard-presentation-import-boundaries.test.ts   PASSED
        (reforzado: NavigationDrawer y NavigationRail añadidos a
        NAVIGATION_REQUIRED_EXPORTS, sin excepciones ni exclusiones de path)
B06     test/architecture/dashboard-b06-workspace-app-bar.test.ts            PASSED (12/12)
```

Diseño fail-closed del contrato B07: cada censo comprueba su propia cardinalidad antes de iterar
(cierre de imports > 1 archivo, 10/5/15 módulos, 6 tokens geométricos), y toda aserción negativa
corre contra la fuente **sin comentarios**, porque las primitivas documentan deliberadamente los
constructos que tienen prohibido usar.

## 12. Runtime diferido

```text
B07_RUNTIME_GEOMETRY = DEFERRED_TO_B08
B07_RUNTIME_E2E      = NOT_RUN
```

Motivo real, no administrativo: **bajo G-1 no existe superficie runtime B07**. Ningún consumidor
monta las primitivas, ninguna clase nueva coincide con DOM existente, y `tokens.css` sólo agrega
custom properties. Escribir un spec de Playwright para B07 exigiría montar artificialmente los
componentes o invadir B08; fabricar esa cobertura sería peor que declararla ausente.

Por eso tampoco se tocaron `frontend/e2e/suites/catalog.ts` ni sus censos de completitud: sin spec
nuevo no hay conteo que realinear.

**B08 hereda la medición.** Debe verificar, sobre superficie montada:

```text
Drawer 256 ±1 px · Rail 80 ±1 px · ítem drawer 40 px · ítem rail 56 px
click · estado activo · ?module= · deep link directo · reload · Back · Forward
desktop · tablet · light · dark-gray
overflow horizontal = 0 · scroll vertical del documento = 0 · app bar B06 intacta
```

Ninguno de esos puntos se declara PASSED en B07.

## 13. Riesgo residual

1. **Orden divergente hasta B08.** `DashboardHorizontalNav` ordena los módulos admin por uso
   (Resumen, Clínicas, Informes…), mientras las primitivas nuevas siguen el orden canónico del
   catálogo. Conviven sin conflicto porque B07 no monta nada, pero B08 debe elegir explícitamente
   uno de los dos órdenes al migrar.
2. **Mapas de iconos legacy duplicados.** Siguen cuatro copias en las superficies de B08/B09/B13.
   B07 no agrega una quinta, pero tampoco las consolida.
3. **Tokens huérfanos 72/240.** `--dash-sidebar-rail` (4.5 rem) y `--dash-sidebar-expanded` (15 rem)
   siguen en `responsive.css` como deuda del sidebar retirado por B02. B07 declara los suyos (80/256)
   y verifica por test que **no** reutiliza los huérfanos; eliminarlos es limpieza aparte.
4. **Geometría runtime sin medir.** Ver §12: el ±1 px sólo puede observarse con las primitivas
   montadas.
5. **Escala de state-layer sin consumir.** El estado activo usa roles de color (`surface-muted`,
   `primary`) en vez de la escala `--dash-state-*`, que exigiría `color-mix()` — un mecanismo que
   hoy no existe en el repo. Introducirlo es una decisión de B04/B12, no de B07.

## 14. Rollback lógico

B07 es revertible de forma independiente: no migra consumidores, no retira nada y no altera DOM
existente. Revertir el PR elimina tres archivos nuevos, dos bloques CSS delimitados por sentinelas,
seis líneas del barrel y seis del guard B01; ninguna superficie viva cambia de comportamiento.
