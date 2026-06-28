# PR-5 — feat(dashboard): logistics hub operational

## Objetivo

Rediseño conservador de `/dashboard/logistica` como hub operativo premium. La página mantiene toda la lógica de fetch, auth y rutas existentes, y añade `DashboardPageHeader`, `StickyActionBar` y `LogisticsCommandCenter` siguiendo el patrón establecido en PR-4 (ClinicCommandCenter) y PR-3 (AdminCommandCenter).

## Archivos modificados

| Archivo | Acción |
|---|---|
| `frontend/src/app/dashboard/logistica/page.tsx` | Rediseñado: añade DashboardPageHeader, StickyActionBar, LogisticsCommandCenter |
| `frontend/src/app/dashboard/logistica/LogisticsCommandCenter.tsx` | Nuevo componente presentacional |
| `test/frontend-dashboard-logistica.test.ts` | Actualizado para reflejar nueva arquitectura |
| `test/frontend-dashboard-logistics-hub.test.ts` | Tests de contrato nuevos para el hub |
| `docs/pr-5-dashboard-logistics-hub.md` | Este documento |

## Decisiones de diseño

### LogisticsCommandCenter — presentacional puro

El componente no hace fetch. Recibe `fieldVisits`, `routePlans`, `fieldVisitsLoadError`, `routePlansLoadError` como props. La lógica de fetching permanece en `page.tsx` (Server Component), que es el único lugar con acceso a cookies y caché.

### KPIs derivados, no inventados

- **Visitas activas**: `fieldVisits.filter(v => v.status === "in_progress" || v.status === "scheduled").length`
- **Planes activos**: `routePlans.filter(p => p.status === "in_progress" || p.status === "released").length`
- **Total visitas**: `fieldVisits.length`

Todos se derivan directamente de los arrays ya cargados. Ningún dato es inventado.

### StickyActionBar — navegación real

Las tres acciones usan rutas existentes del registro `ROUTES`:
- **Ver visitas** → `ROUTES.dashboardLogisticaVisitas`
- **Ver rutas** → `ROUTES.dashboardLogisticaRutas`
- **Ver métricas** → `ROUTES.dashboardLogisticaMetricas`

No se usa `next/link` ni `<a>` directamente. La navegación usa `window.location.assign` vía `StickyActionBar`.

### Listas limitadas a 5 items

`fieldVisits.slice(0, 5)` y `routePlans.slice(0, 5)` — evita scroll vertical excesivo en el hub. Las páginas de detalle (`/visitas`, `/rutas`) mantienen la vista completa.

### StatusBadge para visitas de campo

Los estados de visita (`scheduled`, `in_progress`, `done`, `canceled`, `no_show`, `pending`) están mapeados en `StatusBadge`. Para planes de ruta se usa `Badge + getRoutePlanStatusVariant/Label` de `@/lib/utils` para mostrar correctamente `draft`, `released`, `planned`, `completed`.

### Sin gradientes decorativos ni shadow-xl

Se usan únicamente clases utilitarias del design system existente: `dashboard-surface`, `dashboard-list-row`, `dashboard-kpi-pill`, `surface-note-info`, `dashboard-section-heading`.

## Scope estricto

**No tocado:**
- Backend, API routes, auth, middleware
- SEO / rutas públicas
- `package.json`, `pnpm-lock.yaml`, `next-env.d.ts`
- Sub-páginas `/visitas`, `/rutas`, `/metricas`
- Páginas del resto del dashboard

## Tests

### Tests actualizados
- `test/frontend-dashboard-logistica.test.ts` — refleja la nueva estructura (DashboardPageHeader + StickyActionBar + LogisticsCommandCenter)

### Tests nuevos
- `test/frontend-dashboard-logistics-hub.test.ts` — cubre:
  - Existencia y scope de LogisticsCommandCenter
  - Props contract tipado
  - Banner operativo con KPI pills
  - Listas con StatusBadge / Badge
  - EmptyState cuando no hay datos
  - Errores con `role="alert"`
  - Layout responsive (1 col mobile, 2 col desktop)
  - Sin next/link ni `<a>`
  - Sin imports prohibidos (API/auth/public/middleware)
  - Scope: sin cambios en package.json, pnpm-lock.yaml, backend

## Validaciones

```
pnpm test                          ✓
pnpm build                         ✓
pnpm security:public-surface       ✓
pnpm --dir frontend lint           ✓
pnpm --dir frontend typecheck      ✓
pnpm --dir frontend build          ✓
```
