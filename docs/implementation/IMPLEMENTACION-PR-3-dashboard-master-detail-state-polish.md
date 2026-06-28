# PR-3 — Dashboard Master-Detail Density + Empty/Loading States Polish

## 1. Resumen ejecutivo

Mejoras de densidad visual, jerarquía, estados empty/loading/error y consistencia responsive en el patrón master-detail del dashboard. Sin cambios funcionales, sin alterar contratos API, sin dependencias nuevas.

## 2. Scope aplicado

1. Distribución de espacios — gap responsive en `MasterDetailWorkspace`, `pt-4` en `DashboardModuleWorkspace`.
2. Jerarquía visual — `min-height` en paneles master/detail para evitar colapso.
3. Lectura de tablas/listas — indicador de selección de fila con borde teal izquierdo.
4. Estados empty/loading/error — `EmptyState` y `LoadingState` en celdas de tabla admin (reemplaza texto plano).
5. Consistencia responsive — columna "Clínica" oculta en `< lg` en tabla de informes.
6. Claridad de selección/detalle — clase `dashboard-table-row-selected` con indicador visual premium.
7. Reducción de scroll innecesario — `dashboard-row-interactive` en filas de informes.
8. Calidad premium — nueva variante `"list"` en `LoadingState`, prop `size="sm"` en `EmptyState`.

## 3. No-alcance respetado

- No se crearon módulos nuevos.
- No se modificó auth.
- No se tocó backend (contratos API intactos).
- No se tocó base de datos ni migrations.
- No se tocó producción ni staging.
- No se cambió navegación global.
- No se introdujeron librerías nuevas.
- No se ejecutó git add/commit/push ni se abrió PR.

## 4. Archivos modificados

| Archivo | Tipo de cambio |
|---|---|
| `frontend/src/app/globals.css` | `min-height` en paneles, nueva clase `.dashboard-table-row-selected` |
| `frontend/src/components/dashboard/MasterDetailWorkspace.tsx` | gap responsive, `data-master-detail-workspace` |
| `frontend/src/components/dashboard/EmptyState.tsx` | prop `size="sm"\|"md"` |
| `frontend/src/components/dashboard/LoadingState.tsx` | variante `"list"`, tipo ampliado |
| `frontend/src/components/dashboard/DashboardModuleWorkspace.tsx` | `pt-4` en contenido |
| `frontend/src/app/dashboard/informes/page.tsx` | `cn`, `dashboard-row-interactive`, `dashboard-table-row-selected`, columna Clínica `hidden lg:table-cell` |
| `frontend/src/app/dashboard/admin/AdminSessionsReadOnlyCard.tsx` | `LoadingState`/`EmptyState` en tabla |
| `frontend/src/app/dashboard/admin/AdminFailedLoginAlertsReadOnlyCard.tsx` | `LoadingState`/`EmptyState` en tabla |
| `frontend/src/app/dashboard/admin/AdminClinicsManagementCard.tsx` | `LoadingState`/`EmptyState` en tabla |
| `test/frontend-dashboard-state-polish.test.ts` | contrato actualizado: variant `"list"`, prop `size` |
| `test/frontend-dashboard-private-shell-foundation.test.ts` | contrato actualizado: variant `"list"` |
| `test/frontend-admin-sessions-card.test.ts` | contrato actualizado: patrón loading/empty |
| `test/frontend-admin-failed-login-alerts-card.test.ts` | contrato actualizado: patrón loading/empty |
| `test/frontend-dashboard-informes.test.ts` | contrato actualizado: selector columna Clínica |

Archivo nuevo:

| Archivo | Tipo |
|---|---|
| `frontend/e2e/dashboard-master-detail-state-polish.spec.ts` | e2e smoke PR-3 |

## 5. Cambios implementados

### `globals.css`
- `min-height: 18rem` en `.dashboard-master-panel` y `.dashboard-detail-panel` — paneles no colapsan cuando están vacíos.
- Nueva clase `.dashboard-table-row-selected > td:first-child` — borde izquierdo teal 2px en la fila seleccionada de la tabla.

### `MasterDetailWorkspace.tsx`
- `gap-4` → `gap-3 xl:gap-5` — mayor densidad en mobile, más aire en desktop xl.
- Atributo `data-master-detail-workspace="true"` para targeting CSS/test.

### `EmptyState.tsx`
- Prop `size?: "sm" | "md"` (default `"md"` — backward compatible).
- `size="sm"`: `min-h-[8rem]`, padding reducido, ícono `h-9 w-9`, título `text-sm` — para uso dentro de celdas de tabla.

### `LoadingState.tsx`
- Tipo `variant` ampliado: `"table" | "cards" | "detail" | "timeline" | "list"`.
- Nueva variante `"list"`: skeleton de filas horizontales con ícono + texto + badge — para panel maestro no-tabular.

### `DashboardModuleWorkspace.tsx`
- `pt-4` en el contenedor de contenido — respiración entre header del workspace y contenido.

### `informes/page.tsx`
- Import `cn` desde `@/lib/utils`.
- `<TableRow>` con `className={cn("dashboard-row-interactive", isSelected && "bg-vetneb-cyan/10 dashboard-table-row-selected")}`.
- Columna "Clínica": `hidden lg:table-cell` en header y celda — elimina overflow horizontal en tablet/mobile.

### Admin cards (3 componentes)
- Separación de estados en `<TableBody>`: `isPending` → `<LoadingState variant="table" compact />`, vacío/error → `<EmptyState size="sm" />` o texto.
- Reemplaza texto plano `"Cargando..."` por skeleton animado accesible.

## 6. Estados empty/loading/error cubiertos

| Superficie | Loading | Empty | Error |
|---|---|---|---|
| Informes tabla master | SSR (no aplica) | `<EmptyState border-0>` | `<ErrorState>` existente |
| Sesiones admin tabla | `<LoadingState variant="table" compact>` | `<EmptyState size="sm">` | texto + alerta arriba |
| Intentos fallidos admin tabla | `<LoadingState variant="table" compact>` | `<EmptyState size="sm">` | texto + alerta arriba |
| Clínicas admin tabla | `<LoadingState variant="table" compact>` | `<EmptyState size="sm">` | alerta arriba |
| Panel detalle informes | `emptyDetail` existente | `<EmptyState m-5>` | N/A (SSR) |

## 7. Responsive desktop/tablet/móvil

- **Desktop (xl+)**: gap `xl:gap-5` entre paneles, columnas full visibles.
- **Tablet (lg)**: columna Clínica visible (lg:table-cell), paneles apilados en 1 col antes de xl.
- **Móvil (< lg)**: columna Clínica oculta (`hidden`), paneles full-width apilados, indicador de selección teal visible.
- `StickyActionBar` posición fixed mobile / sticky desktop — no afectado.
- `DashboardModuleWorkspace` `pt-4` consistente en todos los breakpoints.

## 8. Tests agregados o reforzados

**Nuevo e2e** — `frontend/e2e/dashboard-master-detail-state-polish.spec.ts` (7 tests):
- Master panel visible con clase `.dashboard-master-panel`.
- Detail panel con atributo `data-detail-state`.
- `data-master-detail-workspace="true"` presente.
- Tabla existente en master panel.
- Sin overflow horizontal en 768px (tablet).
- Sin overflow horizontal en 375px (mobile).
- Contrato PR-2: filter bar region visible.

**Tests de contrato actualizados** (5 archivos):
- `frontend-dashboard-state-polish.test.ts` — variant `"list"` + prop `size`.
- `frontend-dashboard-private-shell-foundation.test.ts` — variant `"list"`.
- `frontend-admin-sessions-card.test.ts` — patrón loading/empty nuevo.
- `frontend-admin-failed-login-alerts-card.test.ts` — patrón loading/empty nuevo.
- `frontend-dashboard-informes.test.ts` — selector columna Clínica con `hidden`.

## 9. Comandos ejecutados

```powershell
# Terminal 1
pnpm --dir frontend lint           # PASS (0 warnings)
pnpm --dir frontend typecheck      # PASS (0 errors)
pnpm --dir frontend build          # PASS (25/25 pages)
pnpm validate:local                # PASS (EXIT=0)
```

## 10. Resultado de validación

| Comando | Resultado |
|---|---|
| `pnpm --dir frontend lint` | ✅ Sin errores ni warnings |
| `pnpm --dir frontend typecheck` | ✅ Sin errores TypeScript |
| `pnpm --dir frontend build` | ✅ 25/25 páginas, 0 errores |
| `pnpm validate:local` | ✅ EXIT=0, todos los tests backend+contrato pasaron |

## 11. Riesgos residuales

- El `min-height: 18rem` en los paneles podría verse excesivo en viewports muy pequeños (< 320px). Bajo impacto — no hay soporte oficial para < 375px.
- `LoadingState variant="list"` no es usado aún en ninguna superficie de producción — es una extensión de API para uso futuro.
- E2e tests nuevos requieren servidor local en `http://127.0.0.1:3000` para correr (`pnpm e2e`).

## 12. Estado final de git

```
branch: feat/dashboard-master-detail-state-polish
 M frontend/src/app/dashboard/admin/AdminClinicsManagementCard.tsx
 M frontend/src/app/dashboard/admin/AdminFailedLoginAlertsReadOnlyCard.tsx
 M frontend/src/app/dashboard/admin/AdminSessionsReadOnlyCard.tsx
 M frontend/src/app/dashboard/informes/page.tsx
 M frontend/src/app/globals.css
 M frontend/src/components/dashboard/DashboardModuleWorkspace.tsx
 M frontend/src/components/dashboard/EmptyState.tsx
 M frontend/src/components/dashboard/LoadingState.tsx
 M frontend/src/components/dashboard/MasterDetailWorkspace.tsx
 M test/frontend-admin-failed-login-alerts-card.test.ts
 M test/frontend-admin-sessions-card.test.ts
 M test/frontend-dashboard-informes.test.ts
 M test/frontend-dashboard-private-shell-foundation.test.ts
 M test/frontend-dashboard-state-polish.test.ts
?? frontend/e2e/dashboard-master-detail-state-polish.spec.ts
```

14 archivos modificados, 1 archivo nuevo. Sin stage, sin commit, sin push.
