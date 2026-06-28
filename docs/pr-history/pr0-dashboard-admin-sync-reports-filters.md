# PR-0: fix(dashboard): stabilize admin workspace sync and reports filters

## Problema

Tres bugs de estabilidad independientes detectados en la auditoría premium:

1. **Admin workspace no sincroniza con URL**: `AdminDashboardWorkspaceController` usaba `useState(initialModule)` sin `useSearchParams` ni `useEffect`. Al usar back/forward del navegador la URL cambiaba pero el estado React no. Deep links como `/dashboard/admin?module=admin-clinics` no abrían el workspace directamente tras hidratación.

2. **`studyType` se perdía al hacer submit del FilterDrawer**: El form GET de `/dashboard/informes` tenía campos `query` y `status`, pero no `studyType`. Al filtrar, la URL perdía ese parámetro aunque existía en `buildActiveFilters` y se pasaba a `searchReportsPaginated`.

3. **`reportId` inválido seleccionaba silenciosamente `reports[0]`**: El patrón `reports.find(...) ?? reports[0] ?? null` hacía que un `?reportId=999` no encontrado en la página abriera el primer informe sin ninguna indicación visual.

## Causa raíz

1. Falta del patrón de sync URL ya implementado en `ClinicDashboardWorkspaceController` (useSearchParams + useEffect). La versión admin nunca se portó.
2. Input `studyType` ausente del form, aunque el parámetro existe en la URL y se procesa en el servidor.
3. Lógica de fallback excesivamente permisiva: no distingue "sin reportId" (default al primero) de "reportId no encontrado" (ninguno seleccionado).

## Solución

### 1. Admin workspace sync

- Agregado `ADMIN_MODULE_VALUES` (`as const`) y `parseModuleFromUrl(value: string | null): AdminModule | null` en `AdminDashboardWorkspaceController.tsx`.
- Importado `useSearchParams` de `next/navigation` y `useEffect` de `react`.
- `useState` sigue arrancando con `initialModule` (SSR correcto).
- `useEffect` sincroniza `activeModule` con `searchParams.get("module")` en cada cambio, habilitando back/forward.
- `admin/page.tsx` envuelve el controller en `<Suspense>` (obligatorio al usar `useSearchParams` en componente hijo).

### 2. studyType en filtros

- Agregado `<label>` con `<Input name="studyType" defaultValue={studyType} ...>` en el FilterDrawer de `/dashboard/informes`.
- Al hacer submit del form GET, `studyType` se incluye en la URL y no se pierde.
- Links de paginación y selección ya preservaban `studyType` via `buildInformesHref`.

### 3. reportId inválido

- Cambiada la lógica de `selectedReport`:
  - **Antes**: `reports.find(...) ?? reports[0] ?? null` (siempre abre el primero si no hay match)
  - **Después**: `selectedReportId === null ? (reports[0] ?? null) : (reports.find(...) ?? null)`
  - Sin `reportId` → primer informe como default (comportamiento esperado).
  - Con `reportId` no encontrado → `null`, se muestra el estado vacío del detalle en vez de abrir silenciosamente otro informe.

## Archivos tocados

| Archivo | Cambio |
|---|---|
| `frontend/src/app/dashboard/admin/AdminDashboardWorkspaceController.tsx` | Agrega useSearchParams, useEffect, ADMIN_MODULE_VALUES, parseModuleFromUrl |
| `frontend/src/app/dashboard/admin/page.tsx` | Agrega Suspense import + wrapper |
| `frontend/src/app/dashboard/informes/page.tsx` | Agrega studyType input, corrige selectedReport logic |
| `test/frontend-dashboard-admin.test.ts` | Agrega tests de URL sync y Suspense |
| `test/frontend-dashboard-informes.test.ts` | Agrega test de studyType en form |
| `test/frontend-dashboard-reports-master-detail.test.ts` | Actualiza assertion selectedReport + test nuevo |
| `frontend/e2e/dashboard-card-navigation-shell.spec.ts` | Agrega deep link, back/forward, invalid module tests |

## Tests agregados/actualizados

### Unitarios (test/)

- `AdminDashboardWorkspaceController syncs module from URL with useSearchParams and useEffect` — verifica presencia de useSearchParams, useEffect, ADMIN_MODULE_VALUES, parseModuleFromUrl, [searchParams] dependency.
- `admin page wraps AdminDashboardWorkspaceController in Suspense for useSearchParams` — verifica Suspense en page.tsx.
- `dashboard informes filter form includes studyType input to preserve it on submit` — verifica name="studyType", defaultValue={studyType}, aria-label.
- `dashboard informes reportId null selects first report by default without silent fallback` — verifica nuevo patrón `selectedReportId === null`.
- Actualizado: `dashboard informes composes master-detail...` — assertions ajustadas al nuevo patrón.

### E2E (frontend/e2e/)

- `/dashboard?module=operaciones` abre workspace directamente.
- `Volver a módulos` desde clinic deep link limpia query y vuelve al hub.
- Invalid clinic module query param → hub.
- `/dashboard/admin?module=admin-clinics` abre Clínicas workspace directamente.
- `/dashboard/admin?module=audit-log` abre Auditoría workspace directamente.
- `Volver a módulos` desde admin deep link limpia query y vuelve al hub admin.
- Invalid admin module query param → hub admin.
- Browser back desde admin workspace → hub.
- Browser forward después de back → workspace restaurado.

## Comandos ejecutados

```
pnpm --dir frontend lint          # PASS
pnpm --dir frontend typecheck     # PASS
pnpm --dir frontend build         # PASS — 25 rutas, sin errores
pnpm validate:local               # PASS — 2471 tests, 0 fail
pnpm security:public-surface      # PASS — sin findings de exposición pública
git diff --check                  # CLEAN
git restore frontend/next-env.d.ts frontend/tsconfig.json
```

## Riesgos

- **Suspense en admin/page.tsx**: Minimal. Es el patrón estándar de Next.js para componentes que usan `useSearchParams`. La carga de la ruta no cambia; el spinner solo aplica si el componente no se puede renderizar en el servidor.
- **selectedReport null para reportId no encontrado**: La UI ya tiene un `EmptyState` para `selectedReport === null` en el detalle. El cambio solo expone ese estado que antes quedaba oculto.
- **StudyType input visible**: Sin riesgo. No cambia contratos API. El campo ya existía como parámetro URL; solo se agrega el input para que el form GET lo preserve.

## Evidencia: AdminSectionTabs.tsx — no eliminado

`AdminSectionTabs.tsx` no tiene referencias como import React en ningún componente activo. Solo aparece mencionado en un comentario en `PublicRouteControl.tsx`. Sin embargo, el test suite `test/frontend-dashboard-admin-section-tabs.test.ts` verifica activamente la existencia del archivo y su contrato de componente (PR-7 scope test). Eliminarlo haría fallar esos tests.

**Decisión**: preservado. No es navegación principal (no se usa en `admin/page.tsx` ni en `AdminDashboardWorkspaceController`). Candidato a eliminación en un PR dedicado que actualice también los tests de PR-7.

## Evidencia: AdminSectionTabs NO es navegación principal

- `admin/page.tsx` no importa ni renderiza `AdminSectionTabs`.
- `AdminDashboardWorkspaceController.tsx` no importa ni renderiza `AdminSectionTabs`.
- La navegación admin es exclusivamente `DashboardModuleHub` → click card → `DashboardModuleWorkspace` con `onBack`.

## Evidencia: no se reintroduce scroll global

- `admin/page.tsx` mantiene `<main className="dashboard-main">` sin cambios en la clase.
- El contenedor `overflow-hidden` del shell no se toca.
- Tests E2E de `dashboard shell — no global scroll` y `admin shell — no global scroll` permanecen sin cambios y verifican el invariante.

## Evidencia: deep links cubiertos

- `/dashboard?module=operaciones` — test E2E nuevo: `"/dashboard?module=operaciones opens Centro de operaciones workspace directly"`.
- `/dashboard/admin?module=admin-clinics` — test E2E nuevo: `"/dashboard/admin?module=admin-clinics opens Clínicas workspace directly"`.
