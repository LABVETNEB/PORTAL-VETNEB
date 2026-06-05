# PR-4 — feat(dashboard): clinic command center

## Resumen

Rediseño conservador de `/dashboard` (clínica) como Command Center privado premium. La página ahora sigue el mismo patrón arquitectónico que `/dashboard/admin` (PR-3): `DashboardPageHeader` + `StickyActionBar` + componente de comando presentacional + secciones secundarias.

Se preservan íntegramente todos los fetches, variables de error, lógica de auth, rutas y handlers existentes. Solo se reorganizó la composición visual.

---

## Archivos modificados

| Archivo | Tipo | Descripción |
|---|---|---|
| `frontend/src/app/dashboard/page.tsx` | Modificado | Reorganización conservadora: agrega DashboardPageHeader, StickyActionBar, ClinicCommandCenter |
| `frontend/src/components/dashboard/StatusBadge.tsx` | Modificado (mínimo) | Agrega estados `scheduled` y `no_show` que faltaban mapear |
| `test/frontend-dashboard-home.test.ts` | Modificado | Adapta tests al nuevo layout (strings que pasaron a ClinicCommandCenter) |
| `test/frontend-dashboard-empty-states.test.ts` | Modificado | Redirige checks de empty/error states hacia ClinicCommandCenter |
| `test/frontend-dashboard-live-read-contract.test.ts` | Modificado | Extrae check de error message de API wrappers a nuevo test de ClinicCommandCenter |
| `test/frontend-visual-consistency.test.ts` | Modificado | Combina fuentes page.tsx + ClinicCommandCenter para checks visuales |

## Archivos creados

| Archivo | Descripción |
|---|---|
| `frontend/src/app/dashboard/ClinicCommandCenter.tsx` | Nuevo componente presentacional de resumen operativo clínica |
| `test/frontend-dashboard-clinic-command-center.test.ts` | Tests completos del nuevo componente (26 assertions) |

---

## Componentes creados

### `ClinicCommandCenter`

- **Ubicación**: `frontend/src/app/dashboard/ClinicCommandCenter.tsx`
- **Tipo**: Servidor presentacional (sin `"use client"`)
- **Props**: recibe todos los datos pre-procesados desde `page.tsx`

```typescript
type ClinicCommandCenterProps = {
  stats: DashboardStats | null;
  statsLoadError: boolean;
  recentReports: Report[];
  recentVisits: FieldVisit[];
  reportsLoadError: boolean;
  visitsLoadError: boolean;
};
```

**Secciones**:
1. **Estado operativo clínica** — KPI pills con `pendingReports` y `activeVisits` del stats derivado
2. **Métricas operativas** — heading + `StatsCards` (los 4 KPIs totales)
3. **Grid dos columnas** — Informes recientes + Visitas de campo, con `StatusBadge` y `EmptyState`

---

## Decisiones técnicas

### Patrón análogo a AdminCommandCenter

La estructura de la página sigue exactamente el patrón del admin dashboard (PR-3):
```
DashboardTopbar → DashboardPageHeader → StickyActionBar → [CommandCenter] → secciones secundarias
```

Esto garantiza coherencia en todos los dashboards privados.

### ClinicCommandCenter en app/dashboard/ (no en components/dashboard/)

Elegida ubicación `app/dashboard/ClinicCommandCenter.tsx` porque el componente es específico de la ruta clínica, igual que `AdminCommandCenter` vive en `app/dashboard/admin/`. No es un componente reutilizable entre páginas distintas.

### StickyActionBar con href-only (sin onClick)

El `StickyActionBar` es `"use client"` pero se usa directamente desde el server component `DashboardPage`. Las acciones usan solo `href: ROUTES.*` (sin callbacks), lo que es completamente serializable. El componente internamente usa `window.location.assign(href)` para la navegación.

### StatusBadge extendido con `scheduled` y `no_show`

`FieldVisit` tiene 6 estados (`pending`, `scheduled`, `in_progress`, `done`, `canceled`, `no_show`). StatusBadge solo mapeaba 4 de ellos; los 2 faltantes caían a `unknown`. Se agregaron:
- `scheduled` → Clock3, tono cyan/navy (similar a `uploaded`)
- `no_show` → AlertCircle, tono neutro/muted

Esto es el uso previsto del parámetro `status` de StatusBadge según la spec ("solo si falta mapear un estado real existente").

### EmptyState en lugar de `<p className="surface-empty">`

Reemplaza la versión en texto plano por el componente `EmptyState` de PR-1 con ícono contextual (ClipboardList para informes, Route para visitas). Los textos descriptivos mantienen exactamente las strings esperadas por los tests.

---

## KPIs: real vs derivados

| KPI | Origen | Derivado de |
|---|---|---|
| `pendingReports` | `DashboardStats.pendingReports` | Calculado en `getDashboardStats()` del API client: `reports.filter(r => r.status !== "delivered").length` |
| `activeVisits` | `DashboardStats.activeVisits` | Calculado en `getDashboardStats()`: visitas con status `scheduled` o `in_progress` |
| `totalReports` | `DashboardStats.totalReports` | `reports.length` |
| `activePlans` | `DashboardStats.activePlans` | Planes con status `released` o `in_progress` |
| Informes recientes | `reports.slice(0, 3)` | Primeros 3 informes del fetch de `/api/reports` |
| Visitas recientes | `visits.slice(0, 3)` | Primeras 3 visitas del fetch de `/api/logistics/field-visits` |

No se inventó ninguna métrica. Todos los datos provienen de los fetches ya existentes en `page.tsx`.

---

## Cómo se mantuvo la lógica existente

**page.tsx** conserva íntegramente:
- `getDashboardRequestOptions()` con cookie forwarding y `cache: "no-store"`
- Try/catch para `getDashboardStats`, `getReports`, `getLogisticsFieldVisits`
- `await Promise.all([...])` para reads paralelos
- Variables `stats`, `statsLoadError`, `reports`, `reportsLoadError`, `visits`, `visitsLoadError`
- `const recentReports = reports.slice(0, 3)` y `const recentVisits = visits.slice(0, 3)`
- `DashboardTopbar` con `title`, `subtitle`, `notifications="clinic"` sin cambio
- `ClinicPublicProfileCard` y `ClinicParticularTokensCard` sin cambio

Los datos se pasan como props a `ClinicCommandCenter`. La lógica de negocio, auth, y fetching no se movió ni modificó.

---

## Tests actualizados y nuevos

### Nuevos: `test/frontend-dashboard-clinic-command-center.test.ts`
26 assertions cubriendo:
- Existencia y ubicación del componente
- Límites de scope (no importa API/auth/middleware/public)
- No hace fetching
- No es client component
- Contrato de props exportadas
- Secciones operativas (KPI pills, StatsCards, grids)
- Empty states con EmptyState
- Error alerts con role=alert
- Layout responsive (grid 2 cols)
- Integración con page.tsx (props pasadas correctamente)
- Navegación sin next/link ni `<a>` directo
- StatusBadge extendido con scheduled/no_show

### Modificados (mínimo no-breaking)
Los tests existentes se adaptaron para:
- Buscar strings de contenido en `ClinicCommandCenter.tsx` en lugar de `page.tsx`
- Usar `combinedSource` (page + ClinicCommandCenter) para checks visuales
- Eliminar checks de helper functions (`getReportStatusVariant` etc.) que ya no están en page.tsx

---

## Validaciones ejecutadas

| Comando | Resultado |
|---|---|
| `pnpm test` | ✅ 2348 pass, 0 fail, 1 skip |
| `pnpm --dir frontend typecheck` | ✅ 0 errores |
| `pnpm --dir frontend lint` | ✅ 0 warnings |
| `pnpm --dir frontend build` | ✅ Build exitoso, /dashboard es ƒ (Dynamic) |
| `pnpm security:public-surface` | ✅ PASS — no public devtools exposure |
| `git diff --check` | ✅ Sin whitespace errors |
| `git diff --stat` | ✅ 6 archivos modificados, 2 nuevos |

---

## Riesgos residuales

- **EmptyState height**: `min-h-[11rem]` puede hacer las cards más altas cuando no hay datos. Impacto visual menor, aceptado.
- **StickyActionBar mobile/desktop**: El componente fija en `bottom-0` en mobile y `sticky top-[4.75rem]` en desktop. Este comportamiento estaba ya definido en PR-3.
- **StatusBadge `no_show` y `scheduled`**: El tono de color `scheduled` (cyan) podría confundirse visualmente con `processing`. Aceptable para esta iteración.

---

## Confirmación de no-cambios en scope prohibido

| Área | Estado |
|---|---|
| `app/api/*` | ✅ Sin cambios |
| `middleware.ts` | ✅ Sin cambios |
| `package.json` | ✅ Sin cambios |
| `pnpm-lock.yaml` | ✅ Sin cambios |
| `next-env.d.ts` | ✅ Sin cambios |
| `next.config.ts` | ✅ Sin cambios |
| `sitemap.ts` / `robots.ts` | ✅ Sin cambios |
| Rutas públicas | ✅ Sin cambios |
| Backend/server | ✅ Sin cambios |
| SEO / metadata | ✅ Sin cambios (robots noindex preservado) |
| `/dashboard/informes` | ✅ Sin cambios |
| Auth / cookies | ✅ Sin cambios |
