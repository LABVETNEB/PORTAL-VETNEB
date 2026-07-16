# E2E-ORG-3 clinic domain organization audit

Fecha: 2026-07-15

## Estado base

- Rama: `test/e2e-organize-clinic-domain`.
- HEAD inicial: `26f092215954f809dd4bbc97da6f676f3901357e`.
- `origin/main`: `26f092215954f809dd4bbc97da6f676f3901357e`.
- Worktree inicial: limpio.
- Worktree unico: `C:/PORTAL-VETNEB`.

## Scope incluido

- Aplicar E2E-ORG-3 conforme a la auditoria existente.
- Mover exactamente 21 specs clinic a subdirectorios de ownership bajo `frontend/e2e/clinic/**`.
- Actualizar catalogo, scope guard y referencias operativas autorizadas.
- Validar preservacion de contenido de specs, especialmente Informes.

## Scope excluido

- Nueva auditoria general de la suite.
- Backend, API, auth, DB, migraciones, dependencias, lockfiles, CI/workflows y governance.
- Cambios funcionales en specs, codigo de producto, fixtures, helpers, snapshots o configuracion Playwright.
- Correccion del P1 de Informes.

## Auditoria previa

Precondiciones verificadas:

| Control | Resultado |
| --- | --- |
| Rama | `test/e2e-organize-clinic-domain` |
| Working tree inicial | limpio |
| HEAD | `26f092215954f809dd4bbc97da6f676f3901357e` |
| `origin/main` | `26f092215954f809dd4bbc97da6f676f3901357e` |
| Worktrees | solo `C:/PORTAL-VETNEB` |
| Catalogo | guard verde, 72 specs catalogados |
| Origenes | 21 presentes |
| Destinos | 21 ausentes |

Documentos y anclas leidos antes de modificar:

- `docs/audit/e2e-enterprise-organization-audit.md`
- `docs/implementation/test-suite-enterprise-organization-convention.md`
- `frontend/e2e/suites/catalog.ts`
- `frontend/package.json`
- `test/helpers/dashboard-scope-guard.ts`
- `test/architecture/e2e-suite-catalog-completeness.test.ts`
- `git show --stat --summary 26f0922`
- `git show 26f0922 -- frontend/e2e/suites/catalog.ts frontend/package.json test/helpers/dashboard-scope-guard.ts`

## Movimientos

| Origen | Destino |
| --- | --- |
| `frontend/e2e/clinic-informes-zero-internal-scroll.spec.ts` | `frontend/e2e/clinic/reports/clinic-informes-zero-internal-scroll.spec.ts` |
| `frontend/e2e/clinic-reports-fixture-pagination.spec.ts` | `frontend/e2e/clinic/reports/clinic-reports-fixture-pagination.spec.ts` |
| `frontend/e2e/clinic-reports-workspace-1000.spec.ts` | `frontend/e2e/clinic/reports/clinic-reports-workspace-1000.spec.ts` |
| `frontend/e2e/dashboard-clinic-informes-mobile-parity.spec.ts` | `frontend/e2e/clinic/reports/dashboard-clinic-informes-mobile-parity.spec.ts` |
| `frontend/e2e/dashboard-informes-server-adaptive-pagination.spec.ts` | `frontend/e2e/clinic/reports/dashboard-informes-server-adaptive-pagination.spec.ts` |
| `frontend/e2e/dashboard-clinic-logistica-mobile-parity.spec.ts` | `frontend/e2e/clinic/logistics/dashboard-clinic-logistica-mobile-parity.spec.ts` |
| `frontend/e2e/dashboard-logistica-metricas-full-route-adaptive.spec.ts` | `frontend/e2e/clinic/logistics/dashboard-logistica-metricas-full-route-adaptive.spec.ts` |
| `frontend/e2e/dashboard-logistica-rutas-full-route-adaptive.spec.ts` | `frontend/e2e/clinic/logistics/dashboard-logistica-rutas-full-route-adaptive.spec.ts` |
| `frontend/e2e/dashboard-logistica-visitas-full-route-adaptive.spec.ts` | `frontend/e2e/clinic/logistics/dashboard-logistica-visitas-full-route-adaptive.spec.ts` |
| `frontend/e2e/logistics-mobile-no-horizontal-table.spec.ts` | `frontend/e2e/clinic/logistics/logistics-mobile-no-horizontal-table.spec.ts` |
| `frontend/e2e/dashboard-clinic-tokens-mobile-parity.spec.ts` | `frontend/e2e/clinic/tokens/dashboard-clinic-tokens-mobile-parity.spec.ts` |
| `frontend/e2e/dashboard-clinic-perfil-mobile-operability.spec.ts` | `frontend/e2e/clinic/profile/dashboard-clinic-perfil-mobile-operability.spec.ts` |
| `frontend/e2e/dashboard-clinic-controller-workspace-parity.spec.ts` | `frontend/e2e/clinic/shell/dashboard-clinic-controller-workspace-parity.spec.ts` |
| `frontend/e2e/dashboard-clinic-mobile-content-reachability.spec.ts` | `frontend/e2e/clinic/shell/dashboard-clinic-mobile-content-reachability.spec.ts` |
| `frontend/e2e/dashboard-clinic-mobile-operational-density.spec.ts` | `frontend/e2e/clinic/shell/dashboard-clinic-mobile-operational-density.spec.ts` |
| `frontend/e2e/dashboard-clinic-module-state-parity.spec.ts` | `frontend/e2e/clinic/shell/dashboard-clinic-module-state-parity.spec.ts` |
| `frontend/e2e/remove-dashboard-home-unified-workspace.spec.ts` | `frontend/e2e/clinic/shell/remove-dashboard-home-unified-workspace.spec.ts` |
| `frontend/e2e/dashboard-interaction-foundation.spec.ts` | `frontend/e2e/clinic/shell/dashboard-interaction-foundation.spec.ts` |
| `frontend/e2e/dashboard-adaptive-rows.spec.ts` | `frontend/e2e/clinic/shell/dashboard-adaptive-rows.spec.ts` |
| `frontend/e2e/dashboard-centered-pager.spec.ts` | `frontend/e2e/clinic/shell/dashboard-centered-pager.spec.ts` |
| `frontend/e2e/dashboard-master-detail-state-polish.spec.ts` | `frontend/e2e/clinic/shell/dashboard-master-detail-state-polish.spec.ts` |

## Referencias actualizadas

- `frontend/e2e/suites/catalog.ts`: 21 entradas clinic apuntan a los nuevos paths; metadata y cohortes preservadas.
- `test/helpers/dashboard-scope-guard.ts`: agregado `frontend/e2e/clinic`; preservado `frontend/e2e/dashboard`.
- `frontend/package.json`: sin cambios; ya delega las cohortes al runner y no contiene listas literales de specs.

Referencias no actualizadas por scope:

- `scripts/governance/quality-gate-impact-policy.mjs`
- bloque `quality-gate-taxonomy` generado en `test/README.md`

Esas referencias son taxonomy/governance y quedan excluidas por la prohibicion explicita de tocar governance en E2E-ORG-3.

## Evidencia

- Total specs tracked: 72 antes y despues.
- Duplicados fisicos: 0.
- Origenes post-move: 21 ausentes.
- Destinos post-move: 21 presentes.
- Renames: 21 `R100`.
- `clinic-reports-workspace-1000.spec.ts` SHA-256 antes/despues: `0a4e78cb4f1782cb6bf0a1949295daecf68108f08129fcda00b3c11055803893`.
- `clinic-reports-workspace-1000.spec.ts`: 6 llamadas reales a `test.fail` antes/despues.
- Titulo de tests del spec critico preservado; no hubo cambios de assertions, condiciones, timeouts ni expectativas.
- Imports: solo `@playwright/test`; no hubo cambios inesperados de imports.

## Validaciones

| Comando | Resultado |
| --- | --- |
| `git diff --check` | passed |
| `node --experimental-strip-types --experimental-specifier-resolution=node --test test/architecture/e2e-suite-catalog-completeness.test.ts` | 5 passed |
| `pnpm typecheck:test` | timeout inicial 120s; reintento passed |
| `pnpm exec tsx --test test/architecture/e2e-suite-catalog-completeness.test.ts` | 5 passed |
| `pnpm test` | 3107 passed |
| `pnpm --dir frontend lint` | passed |
| `pnpm --dir frontend typecheck` | passed |
| `pnpm --dir frontend build` | passed |
| `pnpm --dir frontend e2e:public-clinic` | 116 passed |
| `pnpm --dir frontend e2e:smoke` | 41 passed |
| `pnpm --dir frontend e2e:visual-contract` | 273 passed |
| `pnpm --dir frontend e2e:ci` | 562 passed |
| `pnpm --dir frontend e2e:verify-teardown` | passed |
| `pnpm build` | passed |
| `pnpm security:public-surface` | passed |

Puertos:

- Antes de Playwright: 3000/3107 libres.
- Entre focales y `e2e:ci`: 3000/3107 libres.
- Despues de Playwright: 3000/3107 libres.

## Resultado

PASS. E2E-ORG-3 quedo aplicado de forma mecanica, sin cambios funcionales en specs y con validacion local completa.

## Riesgo residual

Bajo. La unica deuda observada es taxonomy/governance con patrones representativos legacy, excluida del alcance actual y prevista para un lote governance/CI posterior.

## Estado final

Cambios locales pendientes de revision humana. No se ejecuto stage manual, commit, push ni operaciones remotas.
