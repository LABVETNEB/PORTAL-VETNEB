# Admin Report Upload Advanced Filter Bar

## Objetivo

Implementar una barra de filtros avanzada en Dashboard Administración -> Informes (`admin-report-upload`), alineada con el patrón operativo de Auditoría y Tokens particulares, sin cambiar backend, base de datos, dependencias, navegación global ni contratos API.

## Estado base

- Rama: `feat/admin-report-upload-filter-bar`.
- Base inspeccionada: `f1d8f16 feat(admin): add particular tokens advanced filters (#1189)`.
- Worktree inicial: limpio.
- Entorno: Windows, PowerShell, PNPM.

## Scope incluido

- Frontend del módulo `admin-report-upload`.
- Barra avanzada compacta para desktop/notebook/tablet.
- Diálogo compacto de filtros en mobile para preservar el contrato no-scroll.
- Filtros sobre la página/lista ya cargada por el módulo.
- Tests nativos PNPM del contrato de Admin Informes.
- Documentación de implementación.

## Scope excluido

- Backend, endpoints y contratos API.
- DB, Drizzle, migraciones y schema.
- Auth, cookies, CSRF, rate limits, CORS y CSP.
- Dependencias, `package.json`, `pnpm-lock.yaml` y workflows.
- Navegación global, sidebar y layout general del dashboard.
- Refactors de módulos ajenos.
- Commit, push, PR y stage.

## Auditoría previa

- Archivo frontend real: `frontend/src/app/dashboard/admin/AdminReportsCard.tsx`.
- Modal de subida real: `frontend/src/app/dashboard/admin/AdminReportsUploadPanel.tsx`.
- Montaje real del módulo: `frontend/src/app/dashboard/admin/page.tsx`, sección `id="admin-report-upload"`.
- Fuente de datos: `getAdminReportWorkflow({ limit, offset })`.
- Paginación existente: server-side con `PAGE_SIZE = 9`, `MOBILE_PAGE_SIZE = 10` y `pagination.hasMore`.
- Estado mobile existente: lista densa con `data-admin-mobile-core-module="reports"` y paginador `data-admin-mobile-core-pager="true"`.
- Tests existentes: `test/admin-reports-enterprise-density.test.ts`, `test/admin-mobile-core-pager-canonical-layout.test.ts` y E2E `frontend/e2e/admin-mobile-core-modules-no-scroll.spec.ts`.

## Columnas reales detectadas

La tabla inferior desktop muestra:

- Caso / paciente: `patientName` con fallback `Paciente sin registrar`, e `Informe #id`.
- Clínica: `clinicName` o fallback `Clínica #clinicId`.
- Estudio: `studyType` formateado con `studyLabel`.
- Estado: `workflowStage` mediante `AdminReportStatusBadge`; también se muestra alerta `Tinción`.
- Fecha: `uploadDate ?? createdAt`.
- Archivo: `fileName` o fallback `Sin archivo`.
- Acción: botón `Ver`.

La lista mobile muestra informe/paciente, clínica, estudio, estado y acción.

## Campos reales filtrados

- Informe: `Informe #id`.
- Clínica: `clinicName` o `clinicId`.
- Paciente: `patientName` visible o fallback.
- Estado: `workflowStage`.
- Estudio: etiqueta visible y slug real de `studyType`.
- Archivo: `fileName` o fallback visible.
- Desde/Hasta: rango de fecha.

No se agregaron filtros por tutor, usuario o responsable porque esos datos no están visibles en la tabla/lista del módulo.

## Decisión sobre fecha

El rango Desde/Hasta opera sobre `uploadDate ?? createdAt`, que es la fecha principal visible en la columna `Fecha` y en el detalle como `Carga`. `workflowUpdatedAt` también existe en el detalle, pero no es la fecha principal de la tabla inferior.

## Cambios

- Se agregó estado `filterDraft` y `appliedFilters`.
- Se agregaron helpers de normalización, matching textual, matching por estado y rango de fecha.
- Se renderiza una barra avanzada desktop/tablet con campos compactos y botones Aplicar/Limpiar.
- En mobile se usa un botón `Filtros` que abre un `ModuleDialog` con los mismos campos para evitar sumar altura permanente a la lista.
- Se usan `filteredReports` y `filteredMobileReports` sin modificar `getAdminReportWorkflow`.
- Se mantiene la paginación server-side existente y el contrato no-scroll.

## Archivos tocados

- `frontend/src/app/dashboard/admin/AdminReportsCard.tsx`
- `test/admin-reports-enterprise-density.test.ts`
- `docs/implementation/admin-report-upload-advanced-filter-bar.md`

## Comportamiento responsive

- Desktop ancho: barra horizontal compacta en una fila cuando hay ancho suficiente.
- Notebook/tablet: wrap controlado por grilla responsive.
- Android/iOS: filtros completos dentro de diálogo compacto; la lista conserva su altura operativa y el paginador existente.
- No se agregó `overflow-y-auto`, `overflow-y-scroll`, `overflow-auto`, `overflow-scroll` ni `data-dashboard-scroll-region`.

## Validaciones

| Comando | Resultado |
|---|---|
| `node --experimental-strip-types --experimental-specifier-resolution=node --test test/admin-reports-enterprise-density.test.ts` | Ejecutado y pasó: 8/8. |
| `git diff --check` | Ejecutado y pasó. Aviso CRLF esperado en Windows para `AdminReportsCard.tsx`. |
| `pnpm test` | Ejecutado con PNPM 10.8.1 y pasó: 2894/2894. |
| `pnpm --dir frontend typecheck` | Ejecutado y pasó. |
| `pnpm --dir frontend lint` | Ejecutado y pasó. |
| `pnpm --dir frontend build` | Ejecutado y pasó: Next build completo, 25 rutas. |
| `pnpm build` | Ejecutado y pasó: `dist/index.js` generado. |
| `pnpm security:public-surface` | Ejecutado y pasó: sin hallazgos públicos; notas server-only existentes en `frontend/src/proxy.ts`. |
| `pnpm --dir frontend exec playwright test e2e/admin-mobile-core-modules-no-scroll.spec.ts` | Ejecutado y pasó: 14/14. |

Nota: el PNPM del wrapper Codex era `11.7.0` y falló por mismatch de overrides con lockfile. Se restauró el entorno con `C:\Program Files\nodejs\pnpm.CMD` versión `10.8.1`, que coincide con `packageManager`, usando `install --frozen-lockfile` sin modificar `pnpm-lock.yaml`. El E2E requirió instalar el binario `chromium` de Playwright en caché local y luego pasó.

## Riesgos y regresión

- Riesgo funcional bajo: no se cambia API ni backend.
- Riesgo de alcance controlado: los filtros operan sobre la página/lista cargada, no sobre una búsqueda global server-side.
- Riesgo visual bajo-medio: se suma una barra desktop compacta; mobile evita altura permanente con diálogo.
- Riesgo residual: con filtros activos, la paginación sigue consultando páginas server-side existentes y filtra cada página cargada.

## Verificación visual

Realizada por E2E no-scroll/mobile específico:

- `frontend/e2e/admin-mobile-core-modules-no-scroll.spec.ts`: 14/14.

Pendiente solo de revisión visual manual final en:

`/dashboard/admin?module=admin-report-upload`

## Estado final

Implementación validada y lista para revisión manual. Sin commit, sin push, sin PR y sin stage.
