# PR-7 — Dashboard Tables & Cards Consistency Polish

## 1. Resumen ejecutivo

Se aplicó consistencia visual y operativa a las tablas y cards del dashboard admin, sin cambiar lógica funcional ni contratos API. Los cambios son todos de presentación y organización de clases CSS: grids de estadísticas, footers de paginación, headers de cards y wrappers de tabla.

## 2. Scope aplicado

- Unificación de stats grid con clase `dashboard-filter-stats-grid` (4 cols) y nueva `dashboard-filter-stats-grid-5` (5 cols)
- Unificación del footer de paginación con `dashboard-table-pagination` + `dashboard-table-pagination-controls`
- Agregado del span `dashboard-pagination-context` en cards que lo omitían
- Consistencia del `CardHeader` en `AdminReportWorkflowViewerCard` (border-b + `lg:` breakpoint)
- Wrapper `dashboard-table-responsive` en `AdminReportWorkflowViewerCard`
- Select de workflow usando `field-select` en lugar de clases ad-hoc
- Fix de gap en skeleton de `StatsCards` (gap-4 → gap-3 para coincidir con render de datos)
- Nuevo bloque CSS `dashboard-tables-cards-consistency-polish` con 4 clases nuevas
- 28 nuevos test contracts en `frontend-dashboard-tables-cards-consistency-polish.test.ts`

## 3. No-alcance respetado

- Sin modificaciones a auth, sesiones, cookies, tokens ni credenciales
- Sin cambios de lógica funcional ni handlers
- Sin cambios a contratos API
- Sin nuevas dependencias
- Sin modificaciones a DB o migrations
- Sin cambios a GitHub Actions, CI, o GH CLI
- Sin cambios a producción/staging
- Sin módulos nuevos
- Sin rediseño global del dashboard

## 4. Archivos modificados

| Archivo | Tipo de cambio |
|---|---|
| `frontend/src/app/globals.css` | Nuevo bloque CSS con 4 clases |
| `frontend/src/app/dashboard/admin/AdminSessionsReadOnlyCard.tsx` | Stats grid + footer pagination class |
| `frontend/src/app/dashboard/admin/AdminFailedLoginAlertsReadOnlyCard.tsx` | Stats grid + footer pagination class |
| `frontend/src/app/dashboard/admin/AdminUsersRolesReadOnlyCard.tsx` | Stats grid-5 + footer pagination + context span |
| `frontend/src/components/dashboard/AdminReportWorkflowViewerCard.tsx` | CardHeader border/breakpoint + table wrapper + pagination + field-select |
| `frontend/src/components/dashboard/StatsCards.tsx` | Skeleton gap-4 → gap-3 |
| `test/frontend-dashboard-tables-cards-consistency-polish.test.ts` | 28 nuevos tests de contrato |

## 5. Cambios implementados

### globals.css — nuevo bloque

```
/* dashboard-tables-cards-consistency-polish:start */
@layer components {
  .dashboard-table-pagination          → flex col→row gap-2 responsive
  .dashboard-table-pagination-controls → flex items-center gap-2
  .dashboard-card-header-border        → border-b border-vetneb-line/70
  .dashboard-filter-stats-grid-5       → grid 1→5 cols gap-3
}
/* dashboard-tables-cards-consistency-polish:end */
```

### AdminSessionsReadOnlyCard.tsx

- `grid grid-cols-1 gap-3 md:grid-cols-4` → `dashboard-filter-stats-grid`
- Footer: `flex flex-col gap-2 md:flex-row...` → `dashboard-table-pagination`
- Controles: `flex items-center gap-2` → `dashboard-table-pagination-controls`

### AdminFailedLoginAlertsReadOnlyCard.tsx

- `grid grid-cols-1 gap-3 md:grid-cols-4` → `dashboard-filter-stats-grid`
- Footer: mismo patrón que sesiones

### AdminUsersRolesReadOnlyCard.tsx

- `grid grid-cols-1 gap-3 md:grid-cols-5` → `dashboard-filter-stats-grid-5`
- Footer: `dashboard-table-pagination` + `dashboard-table-pagination-controls`
- **Agregado**: `<span className="dashboard-pagination-context" aria-live="polite" aria-atomic="true">` (faltaba)

### AdminReportWorkflowViewerCard.tsx

- `CardHeader className`: añadido `border-b border-vetneb-line/70` + `lg:flex-row lg:items-start lg:justify-between` (antes: `sm:flex-row sm:items-center sm:justify-between`)
- Tabla: envuelta en `<div className="dashboard-table-responsive">`
- Error alert: añadido `mt-4` para espaciado correcto sin padding del CardContent
- Footer pagination: `dashboard-table-pagination` + `dashboard-table-pagination-controls` + `dashboard-pagination-context`
- Workflow select: `rounded-md border border-input bg-background px-2 py-1.5 text-xs` → `field-select h-9 text-xs`

### StatsCards.tsx

- Loading skeleton: `gap-4` → `gap-3` para consistencia con render de datos

## 6. Tablas/cards cubiertas

| Card | Fixes |
|---|---|
| `AdminClinicsManagementCard` | Sin cambios (ya era consistente) |
| `AdminSessionsReadOnlyCard` | Stats grid, pagination footer |
| `AdminFailedLoginAlertsReadOnlyCard` | Stats grid, pagination footer |
| `AdminUsersRolesReadOnlyCard` | Stats grid-5, pagination footer, context span faltante |
| `AdminReportWorkflowViewerCard` | CardHeader border, lg breakpoint, table-responsive, field-select, pagination |
| `AdminPricingEditorCard` | Sin cambios (ya era consistente) |
| `AdminParticularTokensCard` | Sin cambios (no usa tabla paginada) |
| `StatsCards` | Skeleton gap fix |

## 7. Responsive desktop/tablet/móvil

- Todos los cambios de grid usan `md:` y `lg:` breakpoints exactos del design system
- `dashboard-table-pagination` usa `flex-col` en móvil → `flex-row` en `md:`
- `dashboard-filter-stats-grid` mantiene `grid-cols-1` en móvil → `md:grid-cols-4`
- `field-select` tiene sus propios media-adaptaciones via Tailwind
- `dashboard-table-responsive` mantiene `overflow-x: auto; -webkit-overflow-scrolling: touch`
- Sin scroll horizontal innecesario en mobile/tablet

## 8. Accesibilidad

- Spans `dashboard-pagination-context` tienen `aria-live="polite" aria-atomic="true"` (lectura de paginación por screen readers)
- No se eliminó ningún atributo ARIA existente
- `field-select` mantiene `focus-visible:ring-2 focus-visible:ring-ring/85`
- Todos los botones de paginación mantienen sus `disabled` states

## 9. Tests agregados o reforzados

**Archivo nuevo**: `test/frontend-dashboard-tables-cards-consistency-polish.test.ts`

- 2 tests: section markers en globals.css
- 4 tests: clases CSS nuevas con contratos de @apply
- 3 tests: uso de `dashboard-filter-stats-grid` / `dashboard-filter-stats-grid-5`
- 3 tests: uso de `dashboard-table-pagination` / `dashboard-table-pagination-controls`
- 3 tests: `dashboard-pagination-context` presente en cards con paginación
- 6 tests: consistencia de `AdminReportWorkflowViewerCard`
- 2 tests: `StatsCards` skeleton gap
- 4 tests: baseline de `Table` component (border, shadow, hover, headers)
- 2 tests: baseline de `AdminClinicsManagementCard` (sin regresión)

**Total**: 28 nuevos tests — todos pasan.

## 10. Comandos ejecutados

```powershell
# Terminal 1
pnpm --dir frontend lint           # ✓ sin errores
pnpm --dir frontend typecheck      # ✓ sin errores
pnpm --dir frontend build          # ✓ 26 páginas generadas
pnpm validate:local                # ✓ 2579/2579 tests pass, build OK
git restore frontend/next-env.d.ts frontend/tsconfig.json  # artefactos restaurados
git status --short                 # confirmado estado limpio
git diff --stat                    # confirmado diff mínimo
```

## 11. Resultado de validación

```
pnpm --dir frontend lint       → ✓ (sin warnings)
pnpm --dir frontend typecheck  → ✓ (sin errores TS)
pnpm --dir frontend build      → ✓ (26 páginas, Next.js 15.5.18)
pnpm validate:local
  typecheck          → ✓
  typecheck:test     → ✓
  test               → ✓ 2579 pass / 0 fail / 0 skip
  build (esbuild)    → ✓ 859.8kb dist/index.js
```

## 12. Riesgos residuales

- `AdminReportWorkflowViewerCard` tiene `CardContent p-0` (edge-to-edge table). El `dashboard-table-responsive` wrapper es nested dentro del `Table` que ya tiene `overflow-auto` en su propio div interno (`table.tsx`). Doble overflow es inocuo — el scroll real ocurre en el div interno del `Table`. No se cambia el comportamiento; solo se agrega el wrapper para consistencia semántica con el resto del código.
- `dashboard-filter-stats-grid-5` usa `md:grid-cols-5` — en pantallas entre `md` y `lg`, las 5 columnas pueden quedar compactas. Esto es el comportamiento previo (`grid-cols-5` hardcodeado); no se regresa.

## 13. Estado final de git

```
Branch: feat/dashboard-tables-cards-consistency-polish
Base:   3dad112 feat(dashboard): polish filters and forms density (#930)

 M frontend/src/app/dashboard/admin/AdminFailedLoginAlertsReadOnlyCard.tsx
 M frontend/src/app/dashboard/admin/AdminSessionsReadOnlyCard.tsx
 M frontend/src/app/dashboard/admin/AdminUsersRolesReadOnlyCard.tsx
 M frontend/src/app/globals.css
 M frontend/src/components/dashboard/AdminReportWorkflowViewerCard.tsx
 M frontend/src/components/dashboard/StatsCards.tsx
?? test/frontend-dashboard-tables-cards-consistency-polish.test.ts

6 files changed, 54 insertions(+), 15 deletions(-)
1 new test file (untracked, 28 tests)
```

No hay stage, commit, push ni PR creado.

## 14. Instrucciones manuales para Nico

```bash
# Terminal 1 — desde C:\PORTAL-VETNEB
git status
git add frontend/src/app/globals.css \
        frontend/src/app/dashboard/admin/AdminFailedLoginAlertsReadOnlyCard.tsx \
        frontend/src/app/dashboard/admin/AdminSessionsReadOnlyCard.tsx \
        frontend/src/app/dashboard/admin/AdminUsersRolesReadOnlyCard.tsx \
        frontend/src/components/dashboard/AdminReportWorkflowViewerCard.tsx \
        frontend/src/components/dashboard/StatsCards.tsx \
        test/frontend-dashboard-tables-cards-consistency-polish.test.ts
git status
git commit -m "feat(dashboard): polish tables and cards consistency"
git push -u origin feat/dashboard-tables-cards-consistency-polish
```

Si `gh pr create` falla (api.github.com caído desde la red local):
- Crear el PR manualmente desde **GitHub web** en la branch `feat/dashboard-tables-cards-consistency-polish`
- Base: `main`, título: `feat(dashboard): polish tables and cards consistency`
- Esperar checks de CI o reintentar `gh pr checks --watch` cuando la API vuelva
- Mergear con squash y eliminar la branch: `gh pr merge --squash --delete-branch`

> Si GitHub API sigue caída: Nico debe crear/cerrar el PR por GitHub web o reintentar `gh` cuando `api.github.com` vuelva a responder.
