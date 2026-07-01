# PR-CORE-1 — Adaptive items per page foundation

## Estado base

- Fecha: 2026-07-01.
- Rama base esperada: `main`.
- HEAD base esperado y confirmado: `865e784 test(dashboard): add global adaptive contract baseline (#1214)`.
- Rama de trabajo: `refactor/adaptive-items-per-page-foundation`.
- Working tree inicial: limpio.
- PRs abiertos al inicio: 0.
- Ramas locales al inicio: solo `main`.
- Ramas remotas no mergeadas contra `origin/main`: 0.

## Scope incluido

- Hook global reusable `useAdaptiveItemsPerPage`.
- `useAdaptiveRowsPerPage` conservado como wrapper semántico compatible.
- Source-contract de Clínica Tokens actualizado para cubrir la fundación global.
- Documentación de implementación de PR-CORE-1.
- Actualización del documento previo de Clínica Tokens.

## Scope excluido

- No se migran nuevos módulos.
- No se toca Admin productivo.
- No se toca Particular productivo.
- No se toca backend, API, auth, DB, migraciones, cookies, CORS, CSP, rate limits, CI, workflows, dependencias, lockfiles ni snapshots.
- No se cambia CSS, UI, fetch, paginación visible ni copy funcional de Clínica Tokens.

## Auditoría previa

Documentos obligatorios leídos:

- `docs/implementation/global-adaptive-dashboard-contract-baseline.md`.
- `docs/audit/global-zero-scroll-adaptive-dashboard-matrix.md`.
- `docs/implementation/clinic-tokens-adaptive-rows-per-page.md`.
- `docs/audit/vetneb-enterprise-operational-platform-extreme-excellence-advisory.md`.

Documentos relacionados leídos:

- `docs/implementation/dashboard-internal-no-scroll-contract.md`.
- `docs/implementation/dashboard-global-masked-master-detail.md`.
- `docs/implementation/dashboard-global-viewport-zoom-adaptability.md`.
- `docs/audit/dashboard-masked-master-detail-no-scroll-audit.md`.
- `docs/implementation/admin-enterprise-density-closeout.md`.
- `docs/implementation/clinic-enterprise-density-closeout.md`.
- `docs/audit/admin-enterprise-density-completion-audit.md`.
- `docs/audit/pr-vis-10-visual-regression-matrix.md`.

`docs/architecture` no existe en la base auditada.

## Por qué se crea `useAdaptiveItemsPerPage`

La matriz global zero-scroll define que la cardinalidad de filas/cards debe derivarse del contenedor real y no de constantes fijas, `matchMedia` o `window`. Clínica Tokens ya tenía un hook funcional pero semánticamente nombrado como filas. PR-CORE-1 extrae esa lógica a una fundación neutral para tablas, listas y cards, sin acoplarla a Tokens, Admin ni Particular.

## Problemas globales que resuelve

- Evita que cada módulo vuelva a implementar medición con `ResizeObserver`.
- Mantiene las constantes actuales como fallback inicial, no como verdad de cardinalidad.
- Permite medir el contenedor real con instalación tardía cuando el nodo aparece después de una carga async.
- Protege contra mediciones inválidas (`0`, negativos, `NaN`, `Infinity`) conservando el último valor válido.
- Mantiene `requestAnimationFrame` para desacoplar el cálculo del callback de resize.
- No escribe estilos, no introduce scroll y no usa `matchMedia` para cardinalidad.

## Relación con auditorías rectoras

- `global-adaptive-dashboard-contract-baseline.md`: PR-CORE-1 sigue la baseline vigente y no migra módulos; prepara una fundación reusable para próximos PRs.
- `global-zero-scroll-adaptive-dashboard-matrix.md`: implementa la pieza técnica `useAdaptiveItemsPerPage` descrita en el contrato global y deja `pageSize` fijo como fallback.
- `clinic-tokens-adaptive-rows-per-page.md`: conserva el comportamiento observable del piloto; `useAdaptiveRowsPerPage` pasa a delegar en la fundación global.
- `vetneb-enterprise-operational-platform-extreme-excellence-advisory.md`: cumple la Wave 1 de adaptive foundation sin adelantar registries, acciones enterprise ni Admin servidor.

## Contrato técnico

`useAdaptiveItemsPerPage` recibe:

- `containerNode`: nodo real medido.
- `fallbackItems`: cardinalidad inicial/fallback.
- `itemHeightPx`: altura real o estimada del ítem.
- `headerHeightPx`: descuento opcional.
- `safetyGapPx`: margen de seguridad opcional.
- `minItems` / `maxItems`: límites.
- `enabled`: activación opcional.

Retorna:

- `itemsPerPage`.

El hook:

- observa `containerNode` con `ResizeObserver`;
- agenda medición con `requestAnimationFrame`;
- se instala cuando `containerNode` pasa de `null` a nodo real;
- conserva el último valor válido ante mediciones inválidas;
- sanitiza fallback, límites, alturas y descuentos;
- no depende de `window`, `matchMedia`, breakpoints ni estilos escritos desde JS.

## Wrapper semántico

`useAdaptiveRowsPerPage` queda como wrapper fino para preservar el contrato público de módulos que hablan de filas:

- mantiene `fallbackRows`, `rowHeightPx`, `minRows`, `maxRows` y `rowsPerPage`;
- delega en `useAdaptiveItemsPerPage`;
- preserva `minRows` default efectivo en `2`, como el piloto previo.

## Límites de este PR

- Clínica Tokens sigue usando `useAdaptiveRowsPerPage`.
- `TOKENS_PAGE_SIZE` sigue siendo fallback.
- `usePagedRows(filteredTokens, rowsPerPage)` se preserva.
- No se toca la medición real de filas/cards en `ClinicParticularTokensCard`.
- No se agregan primitivas visuales ni cambios CSS.

## Riesgos residuales

- La fundación no migra por sí sola los módulos Admin/Clínica/Particular pendientes.
- Admin servidor sigue bloqueado hasta PR-SRV-0 por estrategia `limit/offset`.
- Los próximos consumidores deberán elegir correctamente el contenedor real a medir.
- Los e2e de resize y visual regression siguen siendo necesarios para cada módulo migrado.

## Próximos PRs derivados

- PR-CORE-2: primitiva `AdaptivePaginatedRegion` / `AdaptiveModuleSurface`, si el segundo consumidor lo justifica.
- PR-CLIENT-1: segundo módulo cliente Clínica, respetando master-detail.
- PR-SRV-0: estrategia servidor antes de cualquier Admin `limit/offset`.
- PR-CLEAN-1: eliminar `PAGE_SIZE`, `MOBILE_PAGE_SIZE` y `matchMedia` como fuente de cardinalidad después de migraciones controladas.

## Archivos modificados

- `frontend/src/hooks/useAdaptiveItemsPerPage.ts`.
- `frontend/src/hooks/useAdaptiveRowsPerPage.ts`.
- `test/frontend-dashboard-clinic-tokens.test.ts`.
- `docs/implementation/adaptive-items-per-page-foundation.md`.
- `docs/implementation/clinic-tokens-adaptive-rows-per-page.md`.

## Validaciones

Ejecutadas con PNPM 10.8.1 explícito (`C:\Program Files\nodejs\pnpm.CMD`) porque el PNPM del PATH reportó `11.7.0` y el repo declara `packageManager: pnpm@10.8.1`.

- `node --test test/frontend-dashboard-clinic-tokens.test.ts` — pasó: 14/14.
- `pnpm test` — pasó: 2906/2906.
- `pnpm typecheck:test` — pasó.
- `pnpm build` — pasó.
- `pnpm security:public-surface` — pasó; reportó sólo marcadores server-only esperados en `frontend/src/proxy.ts`.
- `pnpm --dir frontend lint` — pasó.
- `pnpm --dir frontend typecheck` — pasó.
- `pnpm --dir frontend build` — pasó.
- `pnpm --dir frontend exec playwright test e2e/dashboard-viewport-zoom-adaptability.spec.ts` — primer intento no ejecutó asserts porque el `webServer` de Playwright resolvió PNPM 11 del PATH; reintento con `C:\Program Files\nodejs` prepended al PATH pasó: 60/60.
- `pnpm --dir frontend exec playwright test e2e/dashboard-clinic-tokens-mobile-parity.spec.ts` — pasó: 3/3.
- `pnpm --dir frontend exec playwright test e2e/dashboard-internal-no-scroll-contract.spec.ts` — pasó: 8/8.
- `pnpm --dir frontend exec playwright test e2e/dashboard-global-masked-master-detail.spec.ts` — pasó: 16/16.
- `git diff --check` — pasó, sin salida.

`frontend/next-env.d.ts` fue regenerado por Next/Playwright durante las validaciones y se restauró antes del diff review porque está fuera de scope.

## Resultado

PR-CORE-1 crea la fundación global de cardinalidad adaptativa y mantiene Clínica Tokens como consumidor semántico por filas, sin cambios observables esperados.

## Estado final

Pendiente de stage/commit/push/PR por Nico. No se avanzó al PR siguiente.
