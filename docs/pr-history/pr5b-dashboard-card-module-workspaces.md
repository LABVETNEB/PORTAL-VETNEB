# PR5B — feat(dashboard): convert cards into module workspaces

## Objetivo

Transformar el dashboard de clínica y el dashboard admin en aplicaciones de pantalla única sin scroll global. Las cards del hub ahora actúan como entradas a workspaces internos en lugar de anclas de scroll.

## Arquitectura implementada

### Hub + Workspace Controller

Cada dashboard tiene un Client Component controller que gestiona el estado hub/workspace:

- **`ClinicDashboardWorkspaceController`** (`frontend/src/components/dashboard/ClinicDashboardWorkspaceController.tsx`)  
  Gestiona 5 módulos: operaciones, informes, logistica, perfil, tokens.  
  Estado activo sincronizado con `?module=X` en la URL vía `router.replace`.  
  `initialModule` derivado de `searchParams` en el Server Component padre (hidratación URL → estado).

- **`AdminDashboardWorkspaceController`** (`frontend/src/app/dashboard/admin/AdminDashboardWorkspaceController.tsx`)  
  Gestiona 10 módulos administrativos.  
  Estado booleano `showWorkspace` + `pendingHashRef` para activar tabs de `AdminSectionTabs` vía `window.location.hash` en el `useEffect` post-render.  
  Back: `history.replaceState` + `router.replace` limpian hash y URL.

### RSC Composition Pattern

Los Server Components padres (`page.tsx`) construyen `ReactNode` slots y los pasan al controller:

```tsx
// page.tsx (Server Component)
const commandCenterSlot = <AdminCommandCenter {...props} />;
const alertsSectionSlot = <section>...</section>;
const sectionTabsSlot = <AdminSectionTabs tabs={[...]} />;

return <AdminDashboardWorkspaceController
  workspaces={{ commandCenter: commandCenterSlot, alertsSection: alertsSectionSlot, sectionTabs: sectionTabsSlot }}
  systemStatus={systemStatus}
/>;
```

### Zero Global Scroll

Requisito: `document.documentElement.scrollHeight ≤ document.documentElement.clientHeight` en `/dashboard` y `/dashboard/admin`.

Implementación:
- `DashboardShellRouter`: `<div className="flex flex-1 flex-col min-w-0 overflow-hidden">` contiene el scroll
- Hub (cards) y workspaces usan `overflow-y-auto` internamente
- `DashboardModuleWorkspace`: `<div className="min-h-0 flex-1 overflow-y-auto">` para scroll interno del workspace

### DashboardModuleWorkspace

Nuevo componente (`frontend/src/components/dashboard/DashboardModuleWorkspace.tsx`) — envuelve el contenido del workspace activo con:
- Botón "Volver a módulos" (`onBack`)
- Título y descripción del módulo
- `data-dashboard-module-workspace={moduleId}` para selectores E2E
- `min-h-0 flex-1 overflow-y-auto` para scroll interno sin desbordamiento global

### DashboardModuleHub — cambios

- `href` ahora es opcional; se agrega `onClick?: () => void` y `moduleId?: string`
- Cards con `onClick` renderizan como `<button>` nativo con `data-dashboard-module-card={moduleId}`
- Cards con `href` mantienen el comportamiento anterior (`PublicRouteControl`)

## Archivos modificados

| Archivo | Cambio |
|---|---|
| `frontend/src/components/dashboard/DashboardModuleHub.tsx` | `href` opcional, `onClick`/`moduleId`, botón nativo con data attr |
| `frontend/src/components/dashboard/DashboardShellRouter.tsx` | `overflow-hidden` en contenedor flex interior |
| `frontend/src/components/dashboard/DashboardModuleWorkspace.tsx` | **nuevo** — wrapper workspace con back button |
| `frontend/src/components/dashboard/ClinicDashboardWorkspaceController.tsx` | **nuevo** — controller de workspaces clínica |
| `frontend/src/app/dashboard/page.tsx` | Reescritura: `searchParams`, `initialModule`, slots al controller |
| `frontend/src/app/dashboard/ClinicInformesWorkspaceSummary.tsx` | **nuevo** — resumen 3 informes recientes + CTA |
| `frontend/src/app/dashboard/ClinicLogisticaWorkspaceSummary.tsx` | **nuevo** — resumen 3 visitas recientes + CTA |
| `frontend/src/app/dashboard/admin/AdminDashboardWorkspaceController.tsx` | **nuevo** — controller de workspaces admin |
| `frontend/src/app/dashboard/admin/page.tsx` | Reescritura: slots RSC, `AdminDashboardWorkspaceController` |
| `frontend/e2e/dashboard-card-navigation-shell.spec.ts` | Reescritura: tests hub/workspace, back, no-scroll |
| `frontend/e2e/admin-clinic-edit-drawer.spec.ts` | `navigateToGestionTab` entra al workspace vía card antes de buscar tabs |

## Tests actualizados

Tests de unidad actualizados para reflejar que `DashboardModuleHub` y `adminCards` viven dentro de los controllers, no directamente en `page.tsx`:

- `test/frontend-dashboard-admin.test.ts`
- `test/frontend-dashboard-admin-command-center.test.ts`
- `test/frontend-dashboard-admin-section-tabs.test.ts`
- `test/frontend-dashboard-home.test.ts`
- `test/frontend-dashboard-clinic-command-center.test.ts`
- `test/frontend-dashboard-mobile-polish-bottom-actions.test.ts`
- `test/unit/ui/frontend/frontend-visual-consistency.test.ts`

## Atributos de accesibilidad E2E

| Atributo | Elemento | Uso |
|---|---|---|
| `data-dashboard-module-hub` | `DashboardModuleHub` container | Detecta estado hub visible |
| `data-dashboard-module-card={moduleId}` | `<button>` de cada card | Activa workspace específico |
| `data-dashboard-module-workspace={moduleId}` | `DashboardModuleWorkspace` section | Detecta workspace activo |

## Validaciones ejecutadas

- `pnpm --dir frontend typecheck` → OK
- `pnpm --dir frontend lint` → OK
- `pnpm --dir frontend build` → OK
- `pnpm test` → 2466/2466 pass
- `pnpm --dir frontend e2e --workers=2` → 69/69 pass
- `pnpm security:public-surface` → PASS (sin nuevos hallazgos)
- `git diff --check` → sin errores de whitespace

## No alcance

- Sin cambios en backend, API contracts, auth, middleware, proxy, SEO
- Sin cambios en dependencias, lockfiles, tsconfig, next-env
- Sin cambios en `/dashboard/informes`, `/dashboard/logistica` (rutas completas siguen existiendo)
