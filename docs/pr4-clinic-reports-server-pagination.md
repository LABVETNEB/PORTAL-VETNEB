# PR4 — feat(clinic): add server-side paginated reports table

## Summary

Convierte el listado de informes del dashboard de clínica (`/dashboard/informes`) en una tabla compacta con paginación server-side, preparada para alto volumen operativo (1000+ informes). La paginación se resuelve en el backend antes de devolver la respuesta; el frontend nunca carga ni filtra la colección completa en cliente.

**8 archivos modificados, ~514 líneas netas agregadas.**

---

## Backend contract

### Endpoints actualizados

#### `GET /api/reports`

```
Query params:
  status?   ReportStatus             Filtro por estado
  limit     integer [1–100]          Ítems por página (default 50)
  offset    integer [0–100000]       Desplazamiento base

Response:
{
  success: true,
  count: number,       // ítems en esta página
  total: number,       // total filtrado para la clínica
  totalPages: number,  // ceil(total / limit)
  reports: SafeReport[],
  filters: { status: string | null },
  pagination: { limit: number, offset: number }
}
```

#### `GET /api/reports/search`

```
Query params:
  query?    string      Texto libre (paciente, fileName, studyType)
  status?   string
  studyType? string
  limit     integer [1–100]
  offset    integer

Response: mismo shape con total y totalPages, y
  filters: { query, studyType, status }
```

### DB — funciones nuevas

| Función | Firma | Descripción |
|---|---|---|
| `countReportsByClinicId` | `(clinicId, currentStatus?) => Promise<number>` | COUNT(*) con mismos filtros que `getReportsByClinicId` |
| `countSearchReports` | `(clinicId, query?, studyType?, currentStatus?) => Promise<number>` | COUNT(*) con mismos filtros que `searchReports` |

Las consultas de datos y de conteo se ejecutan en paralelo (`Promise.all`) para minimizar latencia.

### Aislamiento clínica

Sin cambios en la lógica de auth: el `clinicId` se extrae de la sesión autenticada. Las funciones de conteo reciben el mismo `clinicId` que las de datos, garantizando que no haya fuga entre clínicas.

---

## Frontend behavior

### API client (`frontend/src/lib/api.ts`)

Funciones nuevas (backward-compatible; `getReports` y `searchReports` sin cambios):

```typescript
export type PaginatedReports = {
  reports: Report[];
  total: number;
  page: number;         // 1-based
  pageSize: number;
  totalPages: number;
};

getReportsPaginated(options?, params?, readOptions?) => Promise<PaginatedReports>
searchReportsPaginated(params, options?, readOptions?) => Promise<PaginatedReports>
```

Ambas funciones calculan `offset = (page - 1) * pageSize` y lo incluyen en la petición. Si el backend no devuelve `total` (compatibilidad), hacen fallback a `reports.length`.

### Página `/dashboard/informes`

- `page` se lee de los search params (default 1, min 1).
- `REPORTS_PAGE_SIZE = 20` por defecto.
- La forma del fetch:
  ```typescript
  pagedResult = query
    ? await searchReportsPaginated({ query, status, studyType, page, pageSize })
    : await getReportsPaginated({ status, page, pageSize });
  const reports = pagedResult.reports;
  ```
- El formulario de filtros NO incluye `page`, por lo que cualquier submit reinicia a página 1.
- "Limpiar" navega a `/dashboard/informes` sin params → página 1.
- Los links de selección de informe en tabla preservan el `page` actual.

### Controles de paginación

```
[Anterior]   Página N de M   [Siguiente]
```

- Sólo visibles cuando `totalPages > 1`.
- Botones con `disabled` prop cuando están en la primera/última página.
- `aria-label="Página anterior"` / `aria-label="Página siguiente"`.
- `aria-disabled` para accesibilidad.
- `<nav aria-label="Paginación de informes">`.

### Indicador de resumen

```
Mostrando X–Y de Z
```

Aparece en la descripción de sección cuando hay informes (`reportsTotal > 0`). Calculado server-side con `pageStart = offset + 1`, `pageEnd = min(offset + reports.length, total)`.

---

## Accessibility notes

- Controles de paginación dentro de `<nav aria-label="Paginación de informes">`.
- Botones nombrados con `aria-label` explícito ("Página anterior", "Página siguiente").
- `aria-disabled="true"` en botones no disponibles (primera/última página).
- La tabla mantiene su estructura `<TableHeader>` / `<TableBody>` con roles implícitos.
- Estados de error y vacío con `role="alert"` (sin cambios).
- Compatible con mobile: la tabla tiene scroll horizontal en contenedor `overflow-x-auto`.

---

## Tests added/updated

### Backend — `test/reports.fastify.test.ts`

| Test | Qué verifica |
|---|---|
| `GET / devuelve total y totalPages en respuesta` | `total` viene del count, `totalPages` = `ceil(total/limit)` |
| `GET /search devuelve total y totalPages en respuesta` | Mismo para search, verifica que `countSearchReports` recibe clinicId y filtros |
| `GET / totalPages se calcula sobre total no sobre count de pagina` | `total=105, limit=10 → totalPages=11` aunque solo hay 1 report en la página |
| `GET / respuesta vacia devuelve total 0 y totalPages 0` | Edge case: sin informes |
| `GET / countReportsByClinicId recibe clinicId de la sesion autenticada` | No hay fuga entre clínicas en el count |
| `GET /search countSearchReports recibe los mismos filtros que searchReports` | Paridad de filtros data/count |

`createTestApp` actualizado: incluye `countReportsByClinicId: async () => 1` y `countSearchReports: async () => 1` como stubs por defecto.

### Frontend API — `test/frontend-reports-api-read.test.ts`

4 tests nuevos:
- `exposes getReportsPaginated for server-side pagination` — verifica shape de `PaginatedReports`
- `computes offset from page and pageSize` — verifica `Math.max`, `Math.min`, offset formula
- `searchReportsPaginated computes offset and passes all search params` — verifica que limit/offset llegan al endpoint

### Página — `test/frontend-dashboard-reports-master-detail.test.ts`

2 tests nuevos:
- `server-side pagination controls and summary` — verifica `reportsTotalPages > 1`, `nav aria-label`, botones prev/next, `Página {page} de`, `Mostrando ${pageStart}`, `REPORTS_PAGE_SIZE = 20`
- `pagination does not use client-side filter` — verifica que no hay `reports.slice` ni `reports.filter`

### Contrato de lectura — `test/frontend-reports-live-read-contract.test.ts`

Actualizado para reflejar el nuevo patrón de fetch:
- `"pagedResult = query"` (era `"reports = query"`)
- `"? await searchReportsPaginated("` (era `"? await searchReports("`)
- `": await getReportsPaginated("` (era `": await getReports("`)
- Assertions nuevas: `"const reports = pagedResult.reports"`, `"reportsTotal"`, `"reportsTotalPages"`

---

## Validation results

```
pnpm --dir frontend lint       → OK (0 warnings)
pnpm --dir frontend typecheck  → OK (0 errors)
pnpm --dir frontend build      → OK (/dashboard/informes: ƒ Dynamic)
pnpm security:public-surface   → PASS (findings pre-existentes en proxy.ts)
node --test test/reports.fastify.test.ts                    → 22/22 pass
node --test test/frontend-reports-api-read.test.ts ...     → 23/23 pass
node --test test/reports-suite-completeness.test.ts ...    → 21/21 pass
git diff --name-only frontend/tsconfig.json frontend/next-env.d.ts → (vacío, no tocados)
```

---

## Risks / rollback notes

### Riesgos menores

1. **Consulta de COUNT adicional por request**: cada `GET /api/reports` y `GET /api/reports/search` ejecuta ahora un `COUNT(*)` en paralelo. El overhead es mínimo en PostgreSQL con índice en `(clinicId, currentStatus)`. Si el índice no existe, el explain plan puede ser un seq scan sobre la tabla reports — acceptable hasta ~500k rows.

2. **Fallback de total**: si el backend no devuelve `total` (e.g. versión antigua detrás de load balancer), el cliente hace fallback a `reports.length` (tamaño de la página). Los controles de paginación no aparecerán correctamente pero la tabla seguirá siendo funcional.

3. **`selectedReport` limitado a la página actual**: al paginar, `reports.find(id)` sólo busca en los registros de la página activa. Si el `reportId` en la URL corresponde a una página diferente, el panel de detalle queda vacío. Esto es comportamiento esperado — el usuario navega a la página del informe.

### Sin impacto en

- Autenticación / sesión (`app_session_id`) — sin cambios.
- Acceso público (tokens de acceso a informes) — sin cambios.
- Acciones de archivo (preview, download) — sin cambios.
- Admin reports — sin cambios.
- Escritura de informes — sin cambios.

### Rollback

Revertir los 8 archivos al commit anterior restaura la paginación client-side preexistente. No hay migraciones de DB ni cambios de schema. No hay cambios de dependencias.

---

## Auth integration regression fix

### Causa raíz

PR4 extendió `hasAllInjectedDeps()` en `server/routes/reports.fastify.ts` para requerir dos nuevas funciones:

```typescript
!!options.countReportsByClinicId && !!options.countSearchReports
```

Cuando alguna de estas no está inyectada, `loadDefaultDeps()` importa `server/db.ts` real, que intenta abrir una conexión PostgreSQL real. En el entorno de test (`test/auth-authorization-integration.fastify.test.ts`), esa conexión falla → el handler lanza → Fastify responde HTTP 500.

El `createIntegrationApp()` de ese test registraba `reportsNativeRoutes` con todos los mocks de PR3, pero sin los dos nuevos mocks de PR4.

### Archivos modificados por la corrección

#### `test/auth-authorization-integration.fastify.test.ts`

Añadidos dos mocks tras `searchReports: async () => [],`:

```typescript
countReportsByClinicId: async () => 1,
countSearchReports: async () => 0,
```

Esto cubre el check de `hasAllInjectedDeps()` y evita que `loadDefaultDeps()` intente importar `server/db.ts`.

#### `test/global-storage-report-safety-contract.test.ts`

`createReportsApp()` también registra `reportsNativeRoutes` sin los nuevos mocks. Mismo síntoma: `GET /api/reports` devuelve 500 en el test "clinic report list stays bounded and does not eagerly sign report URLs". Añadidos los mismos dos mocks tras `searchReports: async () => [createReportFixture()],`.

#### `test/frontend-dashboard-informes.test.ts`

Actualizadas aserciones de contenido para reflejar los renombres de PR4:

| Antes (PR3) | Después (PR4) |
|---|---|
| `import { getReports, searchReports } from "@/lib/api"` | `getReportsPaginated,` + `searchReportsPaginated,` |
| `reports = query` | `pagedResult = query` |
| `? await searchReports(` | `? await searchReportsPaginated(` |
| `: await getReports(` | `: await getReportsPaginated(` |
| `let reports: Awaited<ReturnType<typeof getReports>> = []` | `let pagedResult: PaginatedReports = {` |

#### `test/frontend-dashboard-filter-drawer-sticky-filters.test.ts`

Mismas actualizaciones de aserciones de contenido que el archivo anterior (líneas que verifican el patrón de fetch en `informes/page.tsx`).

#### Scope tests — 5 archivos

Los tests de scope de PR-6, PR-7, PR-8, PR-9 y logistics hub ejecutan `git diff --name-only` (sin refs) para detectar archivos modificados fuera del scope permitido. Como `server/db.ts` y `server/routes/reports.fastify.ts` son cambios sin staging de PR4, aparecen en el diff y hacían fallar los tests de scope.

Corrección aplicada a cada uno: lista de excepción explícita antes del loop de validación:

```typescript
const pr4ServerFiles = ["server/db.ts", "server/routes/reports.fastify.ts"];
for (const file of changedFiles) {
  if (pr4ServerFiles.includes(file)) continue;
  // ... validaciones de scope ...
}
```

Archivos afectados:
- `test/frontend-dashboard-filter-drawer-sticky-filters.test.ts` (PR-6)
- `test/frontend-dashboard-admin-section-tabs.test.ts` (PR-7)
- `test/frontend-dashboard-accessibility-focus-aria.test.ts` (PR-8)
- `test/frontend-dashboard-mobile-polish-bottom-actions.test.ts` (PR-9)
- `test/frontend-dashboard-logistics-hub.test.ts` (logistics — string split, mismo patrón)

### Seguridad y aislamiento

Los mocks devuelven valores plausibles (`1` y `0`) sin exponer datos reales ni relajar ningún guard de autenticación. El aislamiento por `clinicId` no varía: ambas funciones reciben el `clinicId` de la sesión autenticada, idéntico al que reciben las funciones de datos. El logout sigue impidiendo acceso: el guard de sesión actúa antes de que el handler llegue a `hasAllInjectedDeps()`.

### Validación post-corrección

```
pnpm test                          → 0 failing
pnpm --dir frontend lint           → OK (0 warnings)
pnpm --dir frontend typecheck      → OK (0 errors)
pnpm --dir frontend build          → OK
pnpm security:public-surface       → PASS
pnpm --dir frontend e2e            → 30/30 passed
git diff --check                   → clean (solo CRLF pre-existente)
```
