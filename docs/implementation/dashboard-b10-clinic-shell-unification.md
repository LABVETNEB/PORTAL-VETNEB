# B10 — Unificación del app shell de clínica

```text
B10_DECISION          = OPCIÓN A (shell compartido: topbar + navigation frame + main)
P0-04                 = cerrado en su mitad de OWNERSHIP; la mitad geométrica pasa a B11/B15
BASE_SHA              = 437c73a1934f6f84971a5496cdc43665ba150e0b (main, #1673 B09)
RAMA                  = feat/dashboard-b10-clinic-shell-unification
DOM                   = equivalente (0 cambios CSS, 0 cambios de geometría)
```

## 1. Estado base

`437c73a1` es el merge de B09 (#1673). En ese punto **las dos bandas que P0-04 midió
ya no existían**: B08 (#1671) retiró `DashboardHorizontalNav` y B09 retiró
`DashboardModuleRail`. La auditoría de caja blanca previa a este PR lo verificó contra
el baseline A02 congelado: a 1920×1080, `clinic-informes` (module shell),
`clinic-informes-full` y `clinic-logistica-full` registran **el mismo**
`shell.topbar = {0,0,1920,55.33}` y **el mismo** `shell.main = {255, 55.33, 1665, 1024.67}`,
con `horizontalNav: null` y `moduleRail: null` en las tres.

Lo que sobrevivía no era un segundo shell: era una segunda **declaración** del primero.
Cada una de las seis rutas de clínica repetía por su cuenta:

```tsx
<DashboardTopbar title=… subtitle=… notifications="clinic" />
<DashboardNavigationFrame surface="clinic" [module=…]>
  <main className="dashboard-main" …>
```

Seis veces la misma respuesta a «qué superficie soy» y «de qué frame cuelga el workspace».

## 2. Scope

Un solo owner para exactamente tres responsabilidades, y ninguna más:

1. `DashboardTopbar` (rol de notificación de clínica incluido)
2. `DashboardNavigationFrame` (`surface="clinic"` + el `module` que declara cada ruta)
3. `<main className="dashboard-main">` (incluidos sus atributos por ruta)

## 3. No-alcance (declarado y verificado por guard)

```text
B11  WorkspaceHeader de 40px y descripción del módulo fuera del flujo permanente
B15  consolidar DashboardPageHeader + DashboardModuleWorkspace en WorkspaceScaffold
B13  degradar el hub a «Inicio» o cambiar la entrada inicial
B09  corregir el aria-current del bottom nav en las rutas completas
A02/A03  recapturar baselines win32 obsoletos heredados de B09
```

Ninguna de las cuatro primeras es una omisión: la propia auditoría global asigna la
consolidación del header a B11 (§49) y del scaffold a B15 (§14.2, «Layout → Consolidar en
`WorkspaceScaffold`»). Hacerlas aquí sería B11/B15 con etiqueta de B10.

## 4. Arquitectura antes / después

```text
ANTES  (×6 rutas)                    DESPUÉS (×1 owner)
route.tsx                            route.tsx
├ <DashboardTopbar …/>               └ <ClinicDashboardShell title subtitle [module] …>
├ <DashboardNavigationFrame …>            └ children            (idénticos, mismo orden)
│   └ <main className="dashboard-main">
│        └ contenido                 ClinicDashboardShell.tsx
                                     ├ <DashboardTopbar notifications="clinic" …/>
                                     └ <DashboardNavigationFrame surface="clinic" module={module}>
                                          └ <main className="dashboard-main" …>{children}</main>
```

`ClinicDashboardShell` es **server component** (sin `"use client"`), así que la frontera
cliente queda exactamente donde estaba: el topbar y el frame siguen siendo las hojas
cliente de una ruta servidor, y `children` sigue renderizándose en el servidor.

## 5. API mínima

```ts
type ClinicDashboardShellProps = {
  title: string;                    // app bar, por ruta
  subtitle: string;                 // app bar, por ruta
  module?: ClinicModule;            // rutas completas; ausente en /dashboard (decide la URL)
  mainStyle?: CSSProperties;        // sólo /dashboard/logistica (ledger sticky-action)
  mainAdaptiveReservation?: boolean;// sólo /dashboard/logistica (raíz de reserva A05)
  children: ReactNode;
};
```

`mainStyle` existe para que el literal
`"--dash-sticky-action-h": STICKY_ACTION_RESERVED_BLOCK_SIZE` **siga declarado en la ruta
que monta la barra**, que es donde `dashboard-stable-geometry-reservation.test.ts:103` lo
ancla y donde tiene una sola fuente. El shell no inventa el valor: lo transporta.

## 6. Por qué los direct children son contractuales

Dos reglas ya en producción leen la posición de los hijos directos de `main`:

```css
.dashboard-main > :not([hidden]) ~ :not([hidden])          /* responsive.css — ritmo */
.dashboard-main:has(> [data-sticky-action-bar="true"])     /* zero-scroll.css — reserva */
```

B09 ya pagó por olvidarlo una vez: retirar el rail convirtió un segundo hijo en hijo único
y **borró en silencio un `--dash-rhythm` en los 13 viewports**. Por eso `children` entra
como hijo directo de `main`, en orden de ruta, sin wrapper intermedio, y por eso tanto el
guard estático como el spec E2E cuentan y anclan esos hijos.

## 7. Archivos

**Creados (3)**

```text
frontend/src/components/dashboard/ClinicDashboardShell.tsx
test/architecture/dashboard-b10-clinic-shell-unification.test.ts
frontend/e2e/regression/dashboard-b10-clinic-shell-unification.spec.ts
```

**Runtime modificado (6)** — sólo la costura del shell; ni datos, ni searchParams, ni
metadata, ni auth, ni contenido:

```text
frontend/src/app/dashboard/page.tsx
frontend/src/app/dashboard/informes/page.tsx
frontend/src/app/dashboard/logistica/page.tsx
frontend/src/app/dashboard/logistica/metricas/page.tsx
frontend/src/app/dashboard/logistica/rutas/page.tsx
frontend/src/app/dashboard/logistica/visitas/page.tsx
```

**Guards realineados in-PR (12)** — ninguna aserción eliminada, ninguna debilitada, ningún
skip. Cada una se re-ancla donde ahora vive la verdad:

```text
test/architecture/dashboard-b08-navigation-migration.test.ts       frame/main/orden: 1× en el shell + montaje por ruta
test/architecture/dashboard-b09-mobile-navigation-unification.test.ts  fence B10 liberado a medias (ver §8)
test/architecture/e2e-suite-catalog-completeness.test.ts           censo 85→86 y derivados
test/unit/infrastructure/e2e-completeness-workflow.test.ts         censo de catálogo 85→86
test/unit/ui/dashboard/frontend-dashboard-home.test.ts             import/notifications/orden
test/unit/ui/dashboard/frontend-dashboard-informes.test.ts         import/notifications
test/unit/ui/dashboard/frontend-dashboard-logistica.test.ts        import/notifications/slice de main
test/unit/ui/dashboard/frontend-dashboard-logistica-metricas.test.ts   import/notifications
test/unit/ui/dashboard/frontend-dashboard-logistica-rutas.test.ts      import/notifications
test/unit/ui/dashboard/frontend-dashboard-logistica-visitas.test.ts    import/notifications
test/unit/ui/frontend/frontend-visual-consistency.test.ts          main asserted en su owner
test/unit/ui/frontend/frontend-notifications-bell.test.ts          rol clinic asserted en el shell
frontend/e2e/suites/catalog.ts                                     alta del spec B10
```

**Eliminados: 0. CSS: 0. Backend: 0. Dependencias: 0. Workflows: 0.**

## 8. El fence B10 de B08/B09: qué se liberó y qué no

Ambos guards tenían un fence «la topología de las 5 rutas completas es de B10». Se liberó
**sólo la mitad que B10 realmente resuelve** (que declaren su propio `DashboardTopbar`).
La otra mitad —la que de verdad protege a las rutas— **queda intacta y sin tocar**:

```ts
assert.equal(source.includes("ClinicDashboardWorkspaceController"), false,
  "es una ruta real, no un estado ?module=");
```

Convertir las rutas completas en estado `?module=` del controller rompería sus deep links.
B10 comparte el **shell**, nunca el **controller**.

## 9. Invariantes preservadas

```text
ROUTE_URLS           las 6 rutas y ROUTES.* intactas
DEEP_LINKS           ?module=, ?query/status/studyType/reportId, ?offset/limit intactos
BACK_FORWARD         clinicNavigationState.ts sin tocar
LAST_MODULE          restore + storage keys sin tocar
LOGOUT               handleLogout vive en DashboardTopbar, sin re-envolver
LATERAL_NAV          mismo surface y mismo module por ruta
MOBILE_NAV           montado por DashboardShellRouter, sin cambios
ZERO_SCROLL          A08 verde 21×13 = 273 combinaciones
SAFE_AREA            sin consumidores nuevos ni retirados
A05                  raíz de reserva y ledger sticky-action preservados en /dashboard/logistica
```

## 10. Validaciones

| Gate | Resultado |
|---|---|
| `pnpm --dir frontend lint` | **PASSED** · exit 0 |
| `pnpm --dir frontend typecheck` | **PASSED** · exit 0 |
| `pnpm --dir frontend build` | **PASSED** · las 6 rutas siguen dinámicas (ƒ) |
| `pnpm build` (backend) | **PASSED** · exit 0 |
| `pnpm security:public-surface` | **PASSED** · sin hallazgos nuevos; 0 `data-*` nuevos |
| `pnpm --dir frontend e2e:verify-catalog` | **PASSED** · 6/6 |
| Guard B10 (arquitectura) | **PASSED** · 15/15 + control de mutación |
| Guard B08 realineado | **PASSED** · 21/21 |
| Guard B09 realineado | **PASSED** · 16/16 |
| Spec E2E B10 | **PASSED** · 36/36 |
| `pnpm --dir frontend e2e:visual-contract` | **PASSED** · 422 passed · 1 skipped · 0 failed |
| `pnpm validate:local` | **FAILED** · 4360/4363 · los 2 fallos son preexistentes (§11) |

**Control de mutación del guard B10.** Un guard que no puede fallar no es un guard. Se
retiró `mainAdaptiveReservation` de `/dashboard/logistica` sobre el árbol de trabajo, el
guard **falló nombrando la aserción A05**, y se restauró de forma verificada
(`git diff --numstat` idéntico antes y después). No se usó ningún comando Git destructivo.

## 11. Fallos preexistentes (NO son de B10)

Los dos son exactamente los que `docs/implementation/dashboard-b09-mobile-navigation-unification.md`
§15.5 declaró en la base `82fe76d3`:

```text
dashboard-adaptive-limit-baseline.test.ts
  "A03 frozen baseline is complete, exact and source-backed"
  Lee sólo: fixtures/dashboard-adaptive-limit-baseline.ts, helpers/dashboard-adaptive-limit-matrix.ts,
            regression/dashboard-adaptive-limit-baseline.spec.ts
frontend-dashboard-reports-master-detail.test.ts
  "dashboard informes pagination is server-adaptive and does not use client-side array filtering"
  Lee sólo: app/dashboard/informes/InformesReportsList.tsx
```

Clasificación verificada, no supuesta: `git diff --name-only HEAD` sobre esos cuatro
archivos devuelve **vacío**. B10 no tocó ninguna de sus entradas, así que su resultado es
idéntico al de la base.

## 12. Deuda heredada: A02/A03 win32 obsoletos

B09 realineó **sólo** `platformRecords.linux`: todos los hunks de
`dashboard-geometry-baseline.ts` en `437c73a1` empiezan en línea ≥352, dentro del bloque
`platformRecords.linux` que abre en 345, y el propio mensaje del commit dice *«Win32
records are unchanged»*.

Evidencia directa: el registro **win32** de `clinic-informes @ w390x844` todavía declara
`"moduleRail":{…,"height":49}` y `"bottomNav":null` — el runtime anterior a B09, que ya no
existe (el registro linux del mismo par dice `"moduleRail":null,"bottomNav":{…,"height":51.19}`).

Consecuencia: **en Windows, A02/A03 fallan en los cinco viewports `<768px` desde antes de
B10**. B10 no los recaptura (prohibido por scope: sería convertir un guard en espejo del
cambio que vigila, y la recaptura es Chromium-Linux). Bajo Opción A el impacto de B10 sobre
ambos es **NONE por construcción**, porque el DOM renderizado no cambia.

## 13. Residual declarado: aria-current móvil en rutas completas

`DashboardMobileNav` deriva su módulo activo **sólo** de `?module=`
(`MobileNavWithUrl`), y `parseClinicModule(null) === null`. En las 5 rutas completas, por
debajo de 768px la barra marca **«Inicio»** mientras la banda lateral marca
Informes/Logística por encima de 768px.

**B10 preserva ese comportamiento deliberadamente** y lo **fija con una aserción propia**
en el spec E2E, para que cambiarlo más adelante sea una decisión y no un efecto colateral.
Corregirlo exigiría que el shell publicara su `module` también al owner móvil, lo cual
cambia comportamiento visible en 5 rutas: es un follow-up con decisión de Nico, no B10.

## 14. Riesgos residuales

1. **A02/A03 win32 obsoletos** (§12). Cohorte `extended`, no required: no bloquean el merge,
   pero tampoco sirven como oráculo «antes/después» en Windows hasta su recaptura.
2. **aria-current móvil en rutas completas** (§13). Declarado y fijado por test.
3. **Dos fallos preexistentes de `pnpm test`** (§11), ajenos a B10.
4. **Selectores CSS inertes** de B08/B09 (`[data-dashboard-horizontal-nav-shell]` en
   `globals.css`, `mobile-admin.css`, `mobile-clinic.css`, `surfaces.css`). Ningún `.tsx`
   los emite. Ya declarados como residual de B09; `globals.css` es valla dura y limpiarlos
   es otro scope.

## 15. Rollback lógico

`git revert` del PR restaura las seis declaraciones por ruta y elimina el shell. No hay
estado persistido, ni migración, ni cambio de contrato HTTP, ni CSS: la reversión es
puramente de composición de render. Los guards realineados vuelven con el mismo revert.
B10 no depende de B11/B13/B15 ni los bloquea.
