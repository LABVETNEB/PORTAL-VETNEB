# Dashboard Module Config Catalog (PR-PRES-3)

> **Tipo:** extracción *behavior-preserving* de configuración. **No cambia UI, CSS,
> rutas Next, permisos, datos ni navegación.**
> **Base:** `main` limpio · **HEAD:** `e29b711` refactor(dashboard): introduce presentation boundaries (#1292)
> **Rama:** `refactor/dashboard-module-config-catalog`
> **Documentos rectores:**
> [`docs/audit/dashboard-presentation-primitives-architecture-audit.md`](../audit/dashboard-presentation-primitives-architecture-audit.md) (H1)
> · [`docs/implementation/dashboard-presentation-boundaries.md`](./dashboard-presentation-boundaries.md)
> **Modelo / esfuerzo:** Claude Opus 4.8 · high.

## 1. Objetivo

Materializar el primer catálogo real de la capa `config` del dashboard como
**fuente única de verdad** del registro de módulos por rol, cerrando la parte
segura del hallazgo **H1** de la auditoría (registro de módulos copiado
literalmente en 8+ archivos). La extracción es puramente estructural: mismo
comportamiento, mismos textos visibles, mismas rutas y URLs `?module=`.

Este PR implementa la porción **behavior-preserving y de bajo riesgo** de la
centralización: los *ids* canónicos, el orden, los alias admin, el default de
clínica, los helpers puros de parseo y la tabla de etiquetas de navegación de
clínica (que estaba duplicada literalmente entre el rail y el bottom-nav). Las
migraciones de las superficies admin con **labels específicos por superficie**
(sidebar, nav horizontal, quick-links, menú móvil, topbar) quedan para un PR
posterior porque unificar esos textos no es seguro sin cambiar lo visible.

## 2. Qué se creó

```
frontend/src/features/dashboard/config/
  dashboardModules.ts   ← catálogo: ids/orden por rol, alias admin, default
                          clínica, parse puro, labels de navegación clínica
  index.ts              ← barrel: ahora reexporta el catálogo (antes vacío)
```

`config/dashboardModules.ts` es **TypeScript puro**: sin `import` de React, sin
JSX y sin llamadas a API/`@/lib/api`. Los iconos son componentes React, así que
**no** entran al catálogo; cada superficie mantiene su propio *icon map* local
indexado por id (regla de frontera de la capa `config`).

### API pública del catálogo

| Export | Tipo | Reemplaza a |
|--------|------|-------------|
| `ADMIN_MODULE_IDS` | tupla `as const` (orden canónico) | `ADMIN_MODULE_VALUES` (controller) + `VALID_ADMIN_MODULES` (route) |
| `AdminModule` | tipo derivado de la tupla | unión declarada a mano en el controller |
| `ADMIN_MODULE_ALIASES` | mapa alias→id | copias en controller + route |
| `parseAdminModule(value)` | helper puro alias-aware | `parseModuleFromUrl` (controller) + `parseAdminModule` (route) |
| `CLINIC_MODULE_IDS` | tupla `as const` | `CLINIC_MODULE_VALUES` (controller) + `VALID_CLINIC_MODULES` (route) |
| `ClinicModule` | tipo derivado de la tupla | unión declarada a mano en el controller |
| `DEFAULT_CLINIC_MODULE` | `"operaciones"` | constante en el controller (ahora reexportada) |
| `parseClinicModule(value)` | helper puro | `parseModuleFromUrl` (controller) + `parseClinicModule` (route) |
| `CLINIC_MODULE_NAV_LABELS` | `{ moduleId, label, shortLabel }[]` | labels/shortLabels duplicados en rail + bottom-nav |

## 3. Consumidores migrados (mínimos y seguros)

| Archivo | Cambio | Compatibilidad |
|---------|--------|----------------|
| `app/dashboard/admin/AdminDashboardWorkspaceController.tsx` | consume `parseAdminModule` + `type AdminModule` del catálogo; borra la unión, la lista y el parse locales | **reexporta** `AdminModule` (`export type { AdminModule }`) para no romper `admin/page.tsx` |
| `app/dashboard/admin/page.tsx` | consume `parseAdminModule`; borra `VALID_ADMIN_MODULES` + alias + parse locales | — |
| `components/dashboard/ClinicDashboardWorkspaceController.tsx` | consume `DEFAULT_CLINIC_MODULE` + `parseClinicModule` + `type ClinicModule`; borra la unión, la lista, el default y el parse locales | **reexporta** `ClinicModule` y `DEFAULT_CLINIC_MODULE` para no romper sus importadores |
| `app/dashboard/page.tsx` | consume `parseClinicModule`; borra `VALID_CLINIC_MODULES` + parse locales; sigue importando `DEFAULT_CLINIC_MODULE` del controller | — |
| `components/dashboard/DashboardModuleRail.tsx` | `CLINIC_MODULE_RAIL_ITEMS` se deriva de `CLINIC_MODULE_NAV_LABELS` + icon map local | export y forma del array idénticos |
| `components/dashboard/ClinicMobileBottomNav.tsx` | `CLINIC_DESTINATIONS` se deriva de `CLINIC_MODULE_NAV_LABELS` + icon map local | forma del array idéntica |

Las superficies admin con labels por-superficie (`AdminDashboardSidebar`,
`DashboardHorizontalNav`, `AdminOverviewQuickLinks`, `AdminMobileModuleMenu`,
`AdminMobileBottomNav`, `DashboardTopbar` → `ADMIN_MOBILE_TITLES`) **no se
tocaron**: sus textos difieren entre superficies y unificarlos cambiaría lo
visible. Migrarlas a referenciar los ids del catálogo es trabajo del próximo PR.

## 4. Duplicación eliminada

- Lista de ids **admin**: 2 copias literales → 1 (`ADMIN_MODULE_IDS`).
- Mapa de alias **admin**: 2 copias → 1 (`ADMIN_MODULE_ALIASES`).
- Parse **admin**: 2 implementaciones → 1 (`parseAdminModule`).
- Representación doble del tipo **admin** (unión + array) → 1 (tipo derivado).
- Lista de ids **clínica**: 2 copias → 1 (`CLINIC_MODULE_IDS`).
- Parse **clínica**: 2 implementaciones → 1 (`parseClinicModule`).
- Representación doble del tipo **clínica** (unión + array) → 1 (tipo derivado).
- Tabla `label`/`shortLabel` de navegación **clínica**: 2 copias literales
  (rail + bottom-nav) → 1 (`CLINIC_MODULE_NAV_LABELS`).

## 5. Invariantes preservados

- Textos visibles: sin altas ni cambios; solo se reubican strings existentes.
- Orden visual: el orden canónico del catálogo es exactamente el orden actual.
- URLs `?module=` y aliases (`admin-upload-report`, `maintenance`): idénticos.
- Default de clínica: sigue `operaciones`; `/dashboard` abre directo el módulo.
- Iconos: sin cambios; siguen siendo componentes React locales por superficie.
- Frontera `config`: sin React/JSX/API en el catálogo.
- Contrato E2E/CSS (clases, anidamiento, `data-*`): intacto.

## 6. Guardrails de tests ajustados

Cinco aserciones *source-invariant* fijaban la **ubicación previa** de literales
que ahora viven en el catálogo. Se reubicaron para verificar el catálogo + el
cableado del consumidor, **sin cambiar su semántica** (cada módulo sigue
conocido/alcanzable, el default sigue `operaciones`, el sync por URL sigue vía
parse):

- `test/frontend-dashboard-remove-home-unified-workspace.test.ts` (3 aserciones)
- `test/frontend-dashboard-hub-hero.test.ts` (1 aserción)
- `test/frontend-dashboard-admin.test.ts` (1 aserción)

## 7. Validación

```powershell
# raíz (backend)
cd C:\PORTAL-VETNEB
pnpm test      # 2961 pass · 0 fail
pnpm build     # esbuild OK

# frontend
cd C:\PORTAL-VETNEB\frontend
pnpm typecheck # tsc --noEmit OK
pnpm build     # next build OK

# superficie de cambios
git -C C:\PORTAL-VETNEB diff --check
git -C C:\PORTAL-VETNEB diff -- frontend/next-env.d.ts   # sin cambios
```

Nota: si `pnpm build` (frontend) reescribe `frontend/next-env.d.ts`, se restaura
a su contenido original — no forma parte de este cambio.

## 8. Continuación

`config/dashboardModules.ts` deja la base para que **PR-PRES-4** migre las
superficies de navegación admin (sidebar, nav horizontal, quick-links, menú
móvil, bottom-nav, topbar) a derivar del catálogo, y para extraer
`useDashboardModuleNavigation` + `moduleActivationBus` a `application`, según la
sección 10 del documento rector.
