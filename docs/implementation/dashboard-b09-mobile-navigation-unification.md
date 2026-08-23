# B09 — Mobile navigation unification: one model below 768px

Nivel 4 del programa B (auditoría §49). Sustituye los **cuatro** owners de navegación
móvil por uno solo y cierra el diferimiento explícito que dejó B08:

```text
LEGACY_MODULE_RAIL_PHYSICAL_RETIREMENT = DEFERRED_TO_B09   →   CLOSED
```

## 1. Estado base

```text
rama            feat/dashboard-b09-mobile-navigation-unification
HEAD base       82fe76d38c79358bdad2cce077c508e6d626f4e5
base            main = 82fe76d3 (fix particular viewport zoom, PR #1672)
dependencias    B08 CLOSED · B07 CLOSED · A08 CLOSED
cierra          el diferimiento de B08 sobre DashboardModuleRail
```

`frontend/src/app/globals.css` es valla dura: **no aparece en el diff**. Sus entradas
`[data-admin-mobile-bottom-nav]`, `[data-admin-mobile-module-menu]` y
`[data-clinic-mobile-bottom-nav]` en la lista no-callout quedan inertes; el contrato
estático B09 verifica que siguen exactamente como estaban.

## 2. Decisiones de Nico

```text
B09_TOUCH_POLICY          = OPTION_A   piso >=44x44 acotado a las superficies que B09 posee
B09_ADMIN_MOBILE_APPBAR_H = 48px       la banda pasa de 44 a 48 px
B09_CLINIC_HOME_ITEM      = PRESERVE   clínica conserva Inicio + los 5 módulos (6 ranuras)
```

## 3. F0 — medición dirigida antes de editar

La auditoría dejó la geometría **computada de los `clamp`, no medida**. F0 la midió en
Chromium sobre `next dev`, en los cuatro viewports del contrato, antes de tocar nada.

| Viewport | `main` hoy (`/dashboard`, rail) | `main` con bottom nav (ruta completa) | Δ `main` | rail liberado dentro del stage | **neto canvas** |
|---|---|---|---|---|---|
| 360×740 | 674.22 | 623.83 | −50.39 | +53.00 | **+2.61** |
| 390×844 | 791.00 | 740.61 | −50.39 | +53.00 | **+2.61** |
| 430×932 | 879.00 | 828.61 | −50.39 | +53.00 | **+2.61** |
| 768×1024 | 968.67 | 968.67 | 0 | 0 (rail ya `display:none`) | **0** |

```text
F0_VERTICAL_DELTA_PX = +2.61   (uniforme en los tres teléfonos; 0 en el boundary)
RAIL_RECT             = 345.63x49.00 @360 · tab 66.83x40 · pager prev/next 40x40
                        (53.00 px totales: 49.00 border-box + 4.00 margin-bottom)
CLINIC_BOTTOM_NAV_RECT= 360x50.39 @360 · ítem 60.00x49.39
ADMIN_BOTTOM_NAV_RECT = 360x51.19 @360 · ítem 72.00x50.19
KEBAB_TRIGGER_RECT    = 36x36     ← FAIL contra el piso de 44
MAIN_RECT             = admin 360x644.81 @360 (app bar medido: 44.00 exactos)
```

Dos hechos que la medición fijó y que cambiaron el diseño:

1. El rail vive **dentro** de `main` y los bottom nav **fuera**. Sustituir uno por otro
   no es neutro: es −50.39 px de `main` y +53.00 px dentro del stage.
2. El app bar admin medía **44.00 px exactos**. Un trigger de 44×44 lo llenaba entero y
   su borde desbordaba. De ahí `B09_ADMIN_MOBILE_APPBAR_H = 48px`.

## 4. Topología: antes y después

```text
ANTES                                        DESPUÉS
app shell (columna)                          app shell (columna)
  header  WorkspaceAppBar                      header  WorkspaceAppBar (admin móvil: 48px)
  frame   [drawer|rail]  main                  frame   [drawer|rail]  main
            └ clínica /dashboard <768:                   (sin navegación dentro de main)
              DashboardModuleRail DENTRO de main
  AdminMobileBottomNav | ClinicMobileBottomNav  DashboardMobileNav (un owner, ambos roles)
    └ AdminMobileModuleMenu                       └ overflow de DESTINOS integrado
  (kebab en el slot overflow del app bar)      (kebab en el slot overflow del app bar)
```

`ClinicMobileBottomNav` hacía `return null` en `/dashboard`; ésa era la razón exacta por
la que B08 no podía borrar el rail. B09 elimina la excepción, así que el owner cubre las
seis superficies de clínica y el rail queda sin ningún régimen visible.

## 5. Modelo de navegación

```text
>= 1280 px      NavigationDrawer   256 ±1 px   (B07/B08, sin cambios)
768 – 1279 px   NavigationRail      80 ±1 px   (B07/B08, sin cambios)
<  768 px       DashboardMobileNav             ← B09, único owner en ambos roles
                · admin   Inicio · Clínicas · Auditoría · Sesiones · Más
                · clínica Inicio · Operaciones · Informes · Logística · Perfil · Tokens
```

**Admin — corte primario.** `ADMIN_MOBILE_PRIMARY_MODULE_IDS` es un dato nuevo del
catálogo, **no** una derivación: el corte que se envía (`admin-clinics`, `audit-log`,
`admin-sessions`) no es la cabeza del orden canónico, es una curación de producto. Antes
vivía como `FIXED_DESTINATIONS`, un literal privado con sus propias etiquetas e iconos.

**Admin — overflow de destinos.** «Más» abre una hoja que pagina el catálogo **completo**
(5 por página), igual que el menú retirado: quien la abre ve la misma lista esté donde
esté. Clínica tiene 5 módulos y 6 ranuras, así que nunca genera overflow.

**Destinos ≠ acciones.** `AdminMobileKebabMenu` sigue siendo un owner separado. No es una
decisión estética: compone `DashboardLogoutControl` y `DashboardNotificationsBell`, y
ambos importan `@/lib/api`; fusionarlo arrastraría la capa de datos al boundary de
`presentation/navigation`. Además es el **único** portador de tema, notificaciones,
contraseña, sitio público y cierre de sesión en admin móvil, porque `mobile-admin.css`
oculta `[data-dashboard-desktop-actions]` por debajo de 768 px.

## 6. Módulo activo y el defecto que se corrige

```text
fuente        useSearchParams  →  parseAdminModule | parseClinicModule
optimista     subscribeClinicModuleActivate · subscribeClinicHubReset (clínica)
reconciliación un efecto sobre el valor parseado: la URL siempre manda al final
```

El owner usa `useSearchParams`, no `window.location` + `popstate` como los dos bottom nav
retirados. Es estrictamente más fuerte: el controller de clínica **restaura** el último
módulo en un `/dashboard` pelado con un `router.replace`, y un listener de `popstate`
nunca lo ve.

**Defecto corregido por construcción.** `AdminMobileBottomNav` leía `?module=` en crudo,
sin `parseAdminModule`. Con un valor desconocido el controller pintaba el hub mientras la
barra marcaba `aria-current` en «Más»; con un alias (`?module=maintenance`) el título
contextual caía a «Inicio» mientras el workspace mostraba Mantenimiento. Parsear primero
hace converger ambos. Los dos casos están cubiertos por el spec runtime.

## 7. Catálogo: cuatro copias retiradas

| Copia retirada | Dónde vivía | Owner canónico ahora |
|---|---|---|
| `FIXED_DESTINATIONS` (3 ids + labels + iconos) | `AdminMobileBottomNav` | `ADMIN_MOBILE_PRIMARY_MODULE_IDS` + `ADMIN_MODULE_NAV_LABELS` + `ADMIN_MODULE_ICONS` |
| `MODULES` (10 ids + labels + iconos) | `AdminMobileModuleMenu` | ídem |
| `ADMIN_MOBILE_TITLES` (10 labels) | `DashboardTopbar` | `ADMIN_MODULE_NAV_LABELS` |
| `CLINIC_*_ICONS` ×2 (mapas gemelos) | rail + bottom nav clínica | `CLINIC_MODULE_ICONS` |

**Cambio de etiqueta visible, intencional.** El menú retirado ya había derivado: decía
«Administración» para el módulo `admin` mientras el catálogo, el drawer y el rail dicen
«Resumen». Al leer del catálogo, la etiqueta móvil coincide con la de escritorio por
primera vez. Es la misma canonicalización que B08 documentó para clínica
(«Resumen» → «Operaciones»). El título de la tarjeta del hub y el `<title>` de la ruta
admin siguen diciendo «Administración»: son de `AdminDashboardWorkspaceController` y de
`admin/page.tsx`, fuera de scope (B13).

## 8. Ownership

```text
ids / orden / labels     features/dashboard/config/dashboardModules.ts
corte primario admin     features/dashboard/config/dashboardModules.ts  ← nuevo, B09
iconos                   components/dashboard/dashboardModuleIcons.ts        (B07)
href ?module=            features/dashboard/application/dashboardModuleNavigation.ts
geometría (px)           styles/dashboard/tokens.css (bloque B09)            ← nuevo
gramática de la barra    styles/dashboard/navigation.css (bloque B09)        ← nuevo
render + módulo activo   components/dashboard/DashboardMobileNav.tsx         ← nuevo
montaje                  components/dashboard/DashboardShellRouter.tsx
overflow de ACCIONES     components/dashboard/AdminMobileKebabMenu.tsx       (sin fusionar)
```

`DashboardMobileNav` **no posee nada**: ni ids, ni labels, ni orden, ni geometría, ni la
gramática `?module=`. El contrato estático lo verifica id por id contra el catálogo y
prohíbe cualquier `?module=` construido a mano.

## 9. Objetivos táctiles (B09_TOUCH_POLICY = OPTION_A)

Piso **≥44×44 CSS px**, autorizado como `--dash-mobile-nav-touch-min` en `tokens.css` y
**declarado** en cada control —no heredado por accidente de dividir la banda entre cinco
o seis ítems estirados, que es como los bottom nav retirados lo cumplían sin contrato.

| Control | Antes | Ahora |
|---|---|---|
| ítem primario de la barra | 50.19–51.19 alto (por consecuencia) | ≥44×44 declarado |
| enlace del overflow de destinos | 41.6 | ≥44 |
| botón de paginación del overflow | 36 | ≥44 |
| control de cierre del overflow | 36×36 | 44×44 |
| trigger del kebab | 36×36 | 44×44 |
| filas/acciones del kebab | 40 | ≥44 |
| `ThemeModeToggle` dentro del kebab | 36×36 | 44×44 vía `className` (prop del call-site) |
| campana dentro del kebab | 36×36 | 44×44 vía CSS de contexto |

Los dos últimos se dimensionan **localmente**: `ThemeModeToggle` es compartido con las
superficies públicas y `DashboardNotificationsBell` con clínica y escritorio, así que
ninguno se modifica globalmente. La campana necesitó un selector **descendiente**, no de
hijo directo: renderiza su trigger dentro de un wrapper `relative`.

**Riesgo residual declarado (B06/B11).** Los controles del app bar de **clínica** móvil
—tema (36), campana (36) y «Salir» (40)— siguen por debajo de 44. No son de B09: son del
app bar, y subirlos globalmente tocaría `ThemeModeToggle`, que es público. El spec de
`dashboard-mobile-shell-nav-contract` mantiene su piso histórico de 36 px para el clúster
del app bar y añade un piso separado de 44 px para lo que B09 posee.

## 10. Safe area y presupuesto vertical

```text
height:          calc(var(--dash-mobile-nav-h) + env(safe-area-inset-bottom))
padding-bottom:  env(safe-area-inset-bottom)
position:        relative   (nunca fixed: una barra fija dejaría main a altura completa)
flex:            0 0 auto   (el shell RESTA la banda)
```

El inset se suma a la banda y se descuenta como padding, de modo que la fila táctil
conserva su altura completa en un dispositivo con notch. `zero-scroll.css` alimenta su
`--dash-bottom-nav-h` desde el token único de B09 en lugar del clamp admin.

Los dos clamps por rol (3.2rem vs 3.15rem, 0.46svh vs 0.45svh) se resolvieron en **uno**:
esos 0.8 px de diferencia eran deriva, no una diferencia de rol.

## 11. Paths

**Añadidos**

```text
frontend/src/components/dashboard/DashboardMobileNav.tsx
frontend/e2e/regression/dashboard-b09-mobile-navigation-unification.spec.ts
test/architecture/dashboard-b09-mobile-navigation-unification.test.ts
```

**Retirados**

```text
frontend/src/components/dashboard/AdminMobileBottomNav.tsx
frontend/src/components/dashboard/ClinicMobileBottomNav.tsx
frontend/src/components/dashboard/AdminMobileModuleMenu.tsx
frontend/src/components/dashboard/DashboardModuleRail.tsx
```

**Modificados — runtime**

```text
frontend/src/features/dashboard/config/dashboardModules.ts        + ADMIN_MOBILE_PRIMARY_MODULE_IDS
frontend/src/features/dashboard/presentation/navigation/index.ts  −4 exports, +1
frontend/src/components/dashboard/DashboardShellRouter.tsx        un solo montaje
frontend/src/components/dashboard/DashboardTopbar.tsx             título derivado del catálogo
frontend/src/components/dashboard/ClinicDashboardWorkspaceController.tsx  sin rail en el stage
frontend/src/components/dashboard/AdminMobileKebabMenu.tsx        geometría local del toggle + doc
frontend/src/components/dashboard/{NavigationDrawer,NavigationRail,DashboardModuleWorkspace}.tsx   doc
frontend/src/features/dashboard/application/dashboardModuleNavigation.ts  doc
```

**Modificados — CSS**

```text
frontend/src/styles/dashboard/tokens.css        bloque de geometría B09
frontend/src/styles/dashboard/navigation.css    −rail, +bloque B09 (gramática única)
frontend/src/styles/dashboard/mobile-admin.css  −bottom nav, −module menu, appbar 48px, piso táctil
frontend/src/styles/dashboard/mobile-clinic.css −bottom nav
frontend/src/styles/dashboard/surfaces.css      3 anclas B04 → 1
frontend/src/styles/dashboard/zero-scroll.css   ledger desde el token único
```

**Modificados — contratos realineados** (ninguno se debilita; varios se refuerzan)

```text
test/architecture/dashboard-b08-navigation-migration.test.ts      deferral → CLOSED, fence 6→4
test/architecture/dashboard-b07-navigation-drawer-rail.test.ts    MOBILE_OWNED_UNTIL_B09 → retirado
test/architecture/dashboard-presentation-import-boundaries.test.ts  4 targets → 1
test/architecture/dashboard-b04-surface-token-migration.test.ts   anclas de chrome y overlay
test/architecture/dashboard-dead-component-retirement.test.ts     nota de secuencia
test/architecture/e2e-suite-catalog-completeness.test.ts          censos 84→85, ci 50→51, vc 16→17
test/unit/infrastructure/e2e-completeness-workflow.test.ts        censo 84→85
test/unit/ui/dashboard/frontend-dashboard-{remove-home-unified-workspace,hub-hero,lateral-navigation}.test.ts
frontend/e2e/suites/catalog.ts                                    alta del spec B09
frontend/e2e/helpers/dashboard-geometry-matrix.ts                 bottomNav: unión → un atributo
frontend/e2e/regression/dashboard-b08-navigation-migration.spec.ts  rail: oculto → inexistente
frontend/e2e/platform/app-shell/dashboard-mobile-shell-nav-contract.spec.ts  +piso 44 separado
frontend/e2e/platform/app-shell/dashboard-{zero-scroll-mobile-boundary,card-navigation-shell,viewport-zoom-adaptability}.spec.ts
frontend/e2e/clinic/{logistics,profile,reports,tokens}/dashboard-clinic-*-mobile-*.spec.ts
frontend/e2e/clinic/logistics/dashboard-logistica-mobile-action-bar-reachability.spec.ts
frontend/e2e/clinic/shell/{dashboard-interaction-foundation,remove-dashboard-home-unified-workspace}.spec.ts
frontend/e2e/admin/shell/admin-mobile-*.spec.ts                   (10 specs, migración de selector)
frontend/e2e/regression/evidence/remove-home-unified-workspace-screenshots.spec.ts
```

Criterio aplicado a los specs: **ninguna aserción de producto se borra**. Lo que era
navegación de módulos se reapunta al owner nuevo; lo que probaba exclusivamente el pager
prev/next del rail se retira, porque era una segunda gramática sobre el mismo conjunto
ordenado —el mismo argumento con el que B07 declinó reproducirlo— y no un destino. La
aserción que ese pager vehiculaba (un click mueve el módulo **y** confirma la URL
canónica) se conserva sobre el owner nuevo.

## 12. Selectores

```text
[data-admin-mobile-bottom-nav="true"]   → [data-dashboard-mobile-nav="admin"]
[data-clinic-mobile-bottom-nav="true"]  → [data-dashboard-mobile-nav="clinic"]
[data-*-bottom-nav-item="true"]         → [data-dashboard-mobile-nav-item="<id>|home|overflow"]
[data-admin-mobile-module-menu="true"]  → [data-dashboard-mobile-nav-overflow="true"]
[data-admin-mobile-module-link="true"]  → [data-dashboard-mobile-nav-overflow-link="<id>"]
[data-dashboard-module-rail*]           → (retirado)
```

La superficie queda en el **valor**, no en el nombre del atributo: es lo que permite una
sola gramática CSS parametrizada por `[data-vetneb-app-shell-surface]`. Ningún nombre
`data-*` contiene un stem sensible (`security:public-surface` los bloquea por nombre).

## 13. A02 / A03 / A08

```text
A02 dashboard-geometry-baseline       cohorte extended · NOT_RUN local · CAMBIO TARGET
A03 dashboard-adaptive-limit-baseline cohorte extended · NOT_RUN local · CAMBIO TARGET
A08 dashboard-zero-scroll-baseline    cohorte visual-contract · PASSED (21x13 completo)
```

Lo que B09 mueve, y por qué la clasificación importa:

- **A02** deja de medir `module-rail` en `/dashboard` móvil y pasa a medir `bottom-nav`
  ahí; el app bar admin móvil sube 44 → 48 px. La forma del registro se conserva (el
  selector del rail sigue en la matriz y ahora resuelve a nada, como el nav horizontal
  desde B08), así que la desaparición se lee como un cambio medido y no como un cambio de
  esquema.
- **A03** puede moverse en clínica móvil por los **+2.61 px** medidos en F0, y en admin
  móvil por los −4 px del app bar. En clínica el canvas sólo puede crecer; en admin sólo
  puede encogerse.

Ninguna de las dos se «arregla» aquí. **No se recapturó ningún fixture congelado**:
hacerlo dentro de B09 convertiría un guard en un espejo del cambio que debía vigilar, y
la recaptura es Chromium-Linux only. Es una decisión de Nico y un PR propio.

A08 sí debía quedar verde y quedó verde sobre la matriz completa.

## 14. Fronteras que B09 NO cruzó

```text
B10   las 5 rutas completas de clínica conservan su propio shell (DashboardTopbar + main)
      y NO se convirtieron al controller de /dashboard. Alcanzan la barra porque está
      montada a nivel de SHELL, que es donde ya estaba antes de B09.
B13   DashboardModuleHub y AdminMobileHubLauncher/HubPager siguen vivos; el hub NO se
      degradó a «Inicio» y el estado null no fabrica aria-current
B11   los controles del app bar de clínica (<44px) quedan declarados como residual
B15   no se introdujo WorkspaceScaffold ni se reestructuró toolbar/filters/collection
```

Los cuatro están verificados por aserciones del contrato estático B09, no sólo declarados
aquí.

## 15. Riesgos residuales

1. **A02/A03 pendientes de decisión.** Ver §13. Cohorte `extended`, no required.
2. **App bar de clínica móvil por debajo de 44 px.** Declarado en §9; pertenece a B06/B11
   porque subirlo toca `ThemeModeToggle`, compartido con las superficies públicas.
3. **Selectores CSS muertos en `globals.css`.** Las tres entradas no-callout de los
   componentes retirados siguen declaradas y son inertes. `globals.css` es valla dura; el
   comportamiento que aportaban al menú de módulos se reafirma sobre el owner nuevo
   (`user-select`/`-webkit-touch-callout` en `.dashboard-mobile-nav-overflow`), y la
   barra ya estaba cubierta por el selector `nav` de esa misma lista.
4. **Etiqueta «Administración» → «Resumen» en móvil.** Canonicalización deliberada (§7).
5. **Dos fallos preexistentes de `pnpm test` en la base `82fe76d3`**, ajenos a B09:
   `dashboard-adaptive-limit-baseline.test.ts` (el fixture A03 contiene un `]` anidado y
   líneas de comentario dentro del bloque que el test separa con `split`, así que
   `JSON.parse` lanza) y `frontend-dashboard-reports-master-detail.test.ts` (ancla de
   fuente sobre `InformesReportsList.tsx`). Todos los archivos que ambos leen son
   idénticos byte a byte a la base.

## 16. Rollback lógico

B09 es revertible como unidad: restaurar los cuatro componentes y sus montajes,
reponer el `return null` de `ClinicMobileBottomNav` en `/dashboard`, reponer el render
del rail en el controller de clínica y el `@media (min-width: 768px)` que lo ocultaba,
y quitar los bloques B09 de `navigation.css` y `tokens.css`. No hay estado persistido, ni
migración de datos, ni cambio de contrato HTTP: la reversión es puramente de render. Los
contratos realineados vuelven con el mismo revert.
