# PR-CLIENT-1 — Next client adaptive dashboard module

## Estado base

- Fecha: 2026-07-01.
- Repo: `C:\PORTAL-VETNEB`.
- Rama base confirmada: `main`.
- HEAD base confirmado: `b25d079 refactor(dashboard): introduce adaptive items per page foundation (#1215)`.
- Rama de trabajo: `feat/next-client-adaptive-dashboard-module`.
- Working tree inicial: limpio.
- PRs abiertos al inicio: 0.
- Ramas locales al inicio: solo `main`.
- Ramas remotas no mergeadas contra `origin/main`: 0.

## Scope incluido

- Migración de un solo módulo cliente adicional al contrato adaptive/zero-scroll.
- Módulo elegido: `ClinicInformesWorkspaceSummary`.
- Source-contract del módulo elegido.
- Documento de implementación del PR.

## Scope excluido

- No se toca backend, API, auth, DB, migraciones, cookies, CORS, CSP, rate limits, CI, workflows, dependencias, lockfiles ni snapshots.
- No se toca Admin servidor ni estrategia `limit/offset`.
- No se toca Particular.
- No se toca Clínica Tokens, Logística, ruta full `/dashboard/informes` ni CSS global.
- No se rediseña visualmente el módulo.

## Documentos vigentes usados

- `docs/implementation/adaptive-items-per-page-foundation.md` — 2026-07-01, commit `b25d079`.
- `docs/implementation/global-adaptive-dashboard-contract-baseline.md` — 2026-07-01, commit `865e784`.
- `docs/audit/global-zero-scroll-adaptive-dashboard-matrix.md` — 2026-07-01, commit `17a8df0`.
- `docs/implementation/clinic-tokens-adaptive-rows-per-page.md` — vigente al HEAD `b25d079`.
- `docs/audit/vetneb-enterprise-operational-platform-extreme-excellence-advisory.md` — 2026-07-01, commit `2cc2608`.
- `docs/implementation/clinic-dashboard-advanced-filter-bars.md` — 2026-06-29, usado como antecedente vigente del filtro in-memory en Informes Clínica.

## Documentos historicos excluidos como rectores

- Documentos anteriores al 29/06/2026 relacionados con dashboard/no-scroll/master-detail se conservaron como archivo historico, pero no definieron scope ni archivos a tocar.
- Ejemplos excluidos como rectores: `dashboard-internal-no-scroll-contract.md`, `dashboard-global-masked-master-detail.md`, `dashboard-global-viewport-zoom-adaptability.md` y auditorias dashboard del 17/06, 18/06, 26/06 y 28/06.

## Auditoria previa

- Base local confirmada limpia antes de la rama.
- Scripts nativos confirmados:
  - `pnpm test`.
  - `pnpm typecheck:test`.
  - `pnpm security:public-surface`.
  - `pnpm --dir frontend lint`.
  - `pnpm --dir frontend typecheck`.
  - `pnpm --dir frontend build`.
- E2E dirigidos confirmados:
  - `frontend/e2e/dashboard-viewport-zoom-adaptability.spec.ts`.
  - `frontend/e2e/dashboard-internal-no-scroll-contract.spec.ts`.
  - `frontend/e2e/dashboard-global-masked-master-detail.spec.ts`.
  - `frontend/e2e/dashboard-clinic-informes-mobile-parity.spec.ts`.

## Candidatos auditados

- `ClinicInformesWorkspaceSummary`: candidato elegido. Cliente puro, `usePagedRows(filteredReports, REPORTS_PAGE_SIZE)`, sin `limit/offset`.
- `ClinicParticularTokensCard`: descartado porque ya esta migrado a `useAdaptiveRowsPerPage`.
- `AdminMaintenanceDryRunCard`: descartado porque habia candidato seguro de prioridad Clinica.
- `AdminPricingEditorCard`: descartado porque habia candidato seguro de prioridad Clinica y su paginado `ITEMS_PER_PAGE = 1` funciona como wizard/editor.
- Admin servidor (`AdminReportsCard`, `AdminParticularTokensCard`, `AdminClinicsManagementCard`, `AdminSessionsReadOnlyCard`, `AdminUsersRolesReadOnlyCard`): descartado por `limit/offset` y bloqueo PR-SRV-0.
- Particular: descartado porque el contrato vigente lo clasifica como detail-only viewport-fit, no paginado adaptativo.

## Modulo elegido

`frontend/src/app/dashboard/ClinicInformesWorkspaceSummary.tsx`.

Se eligio porque es un modulo Clinica, cliente, de bajo alcance, con paginacion in-memory y sin dependencia de fetch paginado dentro del componente. Cubre la familia B del contrato vigente sin tocar `MasterDetailWorkspace`, porque el detalle de este summary ya vive en `ModuleDialog`.

## Familia arquitectonica

Familia B — cliente master-detail ligero:

- Lista de informes + detalle acotado en dialog.
- Paginacion cliente con `usePagedRows`.
- Region de lista medible independiente del footer/pager.

## Contrato anterior

- `REPORTS_PAGE_SIZE = 3` gobernaba directamente `usePagedRows(filteredReports, REPORTS_PAGE_SIZE)`.
- La cantidad visible no dependia de la altura real del contenedor.
- La constante era verdad visual.

## Contrato nuevo

- `REPORTS_PAGE_SIZE` queda como `fallbackRows`.
- `rowsPerPage` deriva de `useAdaptiveRowsPerPage`.
- El hook mide `data-clinic-reports-list-body="true"` como contenedor real.
- La altura de fila/card se obtiene de la primera fila desktop y la primera card mobile renderizadas.
- El alto de `thead` se descuenta en desktop y colapsa a `0` cuando el layout desktop esta oculto.
- `usePagedRows(filteredReports, rowsPerPage)` conserva el clamp de pagina actual.
- No se usa `window`, `matchMedia`, `overflow-y-auto` ni `dashboard-inline-scroll`.

## Cambios

- `ClinicInformesWorkspaceSummary` importa `useAdaptiveRowsPerPage`.
- Se agregan callback refs por estado para contenedor, primera fila/card y `thead`.
- Se agregan `ResizeObserver` locales para medir alto real de fila/card y header.
- Se agrega `data-clinic-reports-list-body="true"` como region medida.
- El source-contract exige fallback preservado, uso del hook adaptive y ausencia de `matchMedia`.

## Archivos modificados

- `frontend/src/app/dashboard/ClinicInformesWorkspaceSummary.tsx`.
- `test/frontend-dashboard-home.test.ts`.
- `docs/implementation/next-client-adaptive-dashboard-module.md`.

## Validaciones

Ejecutadas con PNPM 10.8.1 explicito (`C:\Program Files\nodejs\pnpm.CMD`) porque el PNPM global del entorno reporto `11.7.0`.

- `node --experimental-strip-types --experimental-specifier-resolution=node --test test\frontend-dashboard-home.test.ts` — paso: 12/12.
- `pnpm test` — paso: 2906/2906.
- `pnpm typecheck:test` — paso.
- `pnpm build` — paso.
- `pnpm security:public-surface` — paso; reporto solo marcadores server-only esperados en `frontend/src/proxy.ts`.
- `pnpm --dir frontend lint` — paso.
- `pnpm --dir frontend typecheck` — paso.
- `pnpm --dir frontend build` — paso.
- `pnpm --dir frontend exec playwright test e2e/dashboard-viewport-zoom-adaptability.spec.ts` — paso: 60/60.
- `pnpm --dir frontend exec playwright test e2e/dashboard-internal-no-scroll-contract.spec.ts` — paso: 8/8.
- `pnpm --dir frontend exec playwright test e2e/dashboard-global-masked-master-detail.spec.ts` — paso: 16/16.
- `pnpm --dir frontend exec playwright test e2e/dashboard-clinic-informes-mobile-parity.spec.ts` — paso: 3/3.

`frontend/next-env.d.ts` fue regenerado por Next/Playwright y se restauro fuera del diff porque esta fuera de scope.

## Riesgos residuales

- La altura de la primera fila/card representa al resto de la pagina; si una fila posterior fuese mucho mas alta, podria quedar una medicion levemente optimista hasta el siguiente tick de `ResizeObserver`.
- La ruta full `/dashboard/informes` sigue siendo servidor paginado y queda fuera de este PR.
- Logistica conserva su deuda `dashboard-inline-scroll` documentada; no se toca en este PR.

## Resultado

`ClinicInformesWorkspaceSummary` quedo migrado al contrato adaptive por filas. `REPORTS_PAGE_SIZE` se conserva como fallback inicial y la cardinalidad visible pasa a derivarse de la medicion real del contenedor.

## Estado final

Pendiente de stage/commit/push/PR manual por Nico. No se avanzo al siguiente PR.
