# PR-ADMIN-CLIENT-1 / PR-CLIENT-2 — Admin client adaptive dashboard module

## Skill / modelo / esfuerzo

- Skill: Software Engineering / Repository Implementation — VETNEB Production Web
  Optimization Engineer.
- Modelo: Claude Sonnet con Extended Thinking (Opus no disponible en este entorno).
- Esfuerzo: High / Maximum.

## Estado base

- Fecha: 2026-07-01.
- Repo: `C:\PORTAL-VETNEB`.
- Rama base confirmada: `main`.
- HEAD base confirmado: `0d0c141 feat(dashboard): adapt next client-side dashboard module (#1216)`.
- Rama de trabajo: `feat/admin-client-adaptive-dashboard-module`.
- Working tree inicial: limpio.
- PRs abiertos al inicio: 0.
- Ramas locales al inicio: solo `main`.
- Ramas remotas no mergeadas contra `origin/main`: 0.

## Documentos vigentes usados (todos ≥ 29/06/2026)

- `docs/implementation/adaptive-items-per-page-foundation.md` — 2026-07-01, commit `b25d079`.
- `docs/implementation/global-adaptive-dashboard-contract-baseline.md` — 2026-07-01, commit `865e784`.
- `docs/implementation/next-client-adaptive-dashboard-module.md` — 2026-07-01, commit `0d0c141`.
- `docs/audit/global-zero-scroll-adaptive-dashboard-matrix.md` — 2026-07-01, commit `17a8df0`.
- `docs/implementation/clinic-tokens-adaptive-rows-per-page.md` — vigente al HEAD `0d0c141`.
- `docs/audit/vetneb-enterprise-operational-platform-extreme-excellence-advisory.md` — 2026-07-01, commit `2cc2608`.

## Documentos anteriores a 29/06/2026 excluidos como rectores

Toda auditoría/implementación de densidad Admin, master-detail, no-scroll o
rediseño de dashboard fechada ≤ 28/06/2026 (por ejemplo
`admin-enterprise-density-completion-audit.md`, `DASHBOARD_SINGLE_VIEWPORT_APP_SHELL_PLAN.md`,
`dashboard-horizontal-navigation-information-architecture.md`) se conservó
sólo como histórico. Ninguna definió scope, archivos a tocar ni contrato de
este PR.

## Candidatos Admin cliente auditados

- **`AdminMaintenanceDryRunCard.tsx`** — cliente puro: un único fetch
  (`getAdminMaintenancePurgeDryRun()`) trae el snapshot completo de candidatos;
  la paginación (`usePagedRows(snapshot?.candidates ?? [], 4)`) ocurre
  enteramente en memoria. Sin `limit`/`offset`, sin `matchMedia`, sin
  dualidad desktop/mobile (no existe `AdminMobileMaintenanceDryRunModule`
  equivalente para esta card desktop). **Elegido.**
- `AdminPricingEditorCard.tsx` — cliente (`usePagedRows(items, ITEMS_PER_PAGE)`),
  pero `ITEMS_PER_PAGE = 1` está documentado explícitamente en el propio
  código fuente como diseño intencional de wizard/editor: un formulario
  completo por página para caber en un viewport sin scroll, no una tabla de
  "más filas". Migrarlo a cardinalidad adaptativa contradice ese contrato de
  diseño (rompería el layout de un-formulario-por-página). **Descartado.**
- `AdminXxxReadOnlyCard` (Clínicas, Informes, Tokens, Sesiones, Roles,
  Auditoría, Alertas) y sus `AdminMobileXxxModule` — todos servidor
  `limit/offset` con dualidad desktop/mobile gobernada por `matchMedia`.
  **Descartados**, bloqueados hasta PR-SRV-0 según la matriz vigente.
- `AdminSchemaHealthStatusCard` / hub / tabs — sin paginación, familia D
  (cards resumen); fuera del alcance de este PR (no aplica cardinalidad
  adaptativa).

## Módulo elegido

`frontend/src/app/dashboard/admin/AdminMaintenanceDryRunCard.tsx`.

## Confirmación: NO es Admin servidor

Confirmado. `getAdminMaintenancePurgeDryRun()` no recibe parámetros de
paginación (ni `limit` ni `offset`); devuelve el snapshot completo de
candidatos de limpieza en una sola llamada, disparada manualmente por el
botón "Analizar limpieza". Toda la paginación visible es en memoria
(`usePagedRows`), igual que en `ClinicParticularTokensCard` y
`ClinicInformesWorkspaceSummary`.

## Familia arquitectónica

Familia A — cliente simple paginado (misma familia que el piloto
`ClinicParticularTokensCard` y que `AdminPricingEditorCard`, aunque este
último quedó descartado por su semántica de wizard).

## Contrato anterior

- `usePagedRows(snapshot?.candidates ?? [], 4)` — cardinalidad fija de `4`
  candidatos por página, sin relación con el alto real del contenedor
  (`min-h-0 flex-1 space-y-2 overflow-hidden`).
- La constante `4` era verdad visual directa.

## Contrato nuevo

- `CANDIDATES_FALLBACK_ROWS = 4` queda como `fallbackRows` (fallback inicial
  de SSR/primer paint, no gobierna la cardinalidad después de medir).
- `rowsPerPage` deriva de `useAdaptiveRowsPerPage({ containerNode: candidatesListNode, fallbackRows: CANDIDATES_FALLBACK_ROWS, rowHeightPx })`.
- El hook mide `candidatesListNode` (el mismo div `min-h-0 flex-1 space-y-2
  overflow-hidden` que ya servía de región de lista, ahora también expuesto
  como `data-admin-maintenance-candidates-list="true"`).
- `rowHeightPx` se obtiene midiendo con `ResizeObserver` la primera fila
  real renderizada (`MaintenanceCandidateRow`, vía `ref` nativo de React 19
  sin `forwardRef`, igual patrón que `ParticularTokensPanelBody`), sumando
  `CANDIDATE_ROW_GAP_PX = 8` (el gap real de `space-y-2` entre filas) para
  que el cálculo `floor(availableHeight / itemHeightPx)` no sobreestime
  cuántas filas caben — cada fila "cuesta" su propia altura más el gap que
  la separa de la siguiente.
- No hay header/`thead` dentro de la región medida (es una lista simple, no
  una tabla), así que `headerHeightPx` permanece en su default `0`.
- `usePagedRows(snapshot?.candidates ?? [], rowsPerPage)` conserva el clamp
  de página existente (sin cambios en `usePagedRows`).
- No se usa `window`, `matchMedia`, `overflow-y-auto` ni
  `dashboard-inline-scroll`.

## Cambios

- `AdminMaintenanceDryRunCard.tsx`:
  - Importa `useLayoutEffect` y `type Ref` de `react`, y
    `useAdaptiveRowsPerPage` de `@/hooks/useAdaptiveRowsPerPage`.
  - Agrega `CANDIDATES_FALLBACK_ROWS`, `CANDIDATE_ROW_HEIGHT_FALLBACK_PX` y
    `CANDIDATE_ROW_GAP_PX` como constantes de módulo.
  - `MaintenanceCandidateRow` acepta ahora `ref?: Ref<HTMLDivElement>` como
    prop nativa (React 19) y la reenvía al `<div>` raíz de la fila.
  - `AdminMaintenanceDryRunCard` agrega estado para el nodo del contenedor
    de la lista (`candidatesListNode`), el nodo de la primera fila
    (`firstCandidateRowNode`) y `rowHeightPx`; un `useLayoutEffect` con
    `ResizeObserver` mide la primera fila real; `useAdaptiveRowsPerPage`
    deriva `rowsPerPage`; `usePagedRows` pasa a usar `rowsPerPage` en vez de
    la constante `4`.
  - El div de la lista de candidatos gana `ref={setCandidatesListNode}` y
    `data-admin-maintenance-candidates-list="true"`; el `.map` pasa índice
    para asignar `ref={index === 0 ? setFirstCandidateRowNode : undefined}`
    sólo a la primera fila.
  - Cero cambios visuales: mismas clases Tailwind, mismo markup, mismo
    `CompactPager`, mismos textos y estados.
- `test/frontend-admin-maintenance-dry-run-card.test.ts`: actualizado para
  reflejar el nuevo import de React, el nuevo import del hook adaptive, la
  llamada `usePagedRows(..., rowsPerPage)`, el `ref` de `MaintenanceCandidateRow`,
  y agrega un test dedicado que verifica el uso del hook adaptive, el
  fallback preservado, el atributo `data-*` del contenedor medido, la ref de
  primera fila, y la ausencia de `matchMedia`/`overflow-y-auto`.

## Archivos modificados

- `frontend/src/app/dashboard/admin/AdminMaintenanceDryRunCard.tsx`
- `test/frontend-admin-maintenance-dry-run-card.test.ts`
- `docs/implementation/admin-client-adaptive-dashboard-module.md` (este documento)

## Validaciones

Ejecutadas con PNPM 10.8.1 (coincide con `packageManager` del repo).

- `node --experimental-strip-types --experimental-specifier-resolution=node --test test/frontend-admin-maintenance-dry-run-card.test.ts` — pasó: 11/11.
- `pnpm test` — pasó: 2907/2907.
- `pnpm typecheck:test` — pasó.
- `pnpm security:public-surface` — pasó; sólo marcadores server-only esperados en `frontend/src/proxy.ts`.
- `pnpm --dir frontend lint` — pasó.
- `pnpm --dir frontend typecheck` — pasó.
- `pnpm --dir frontend build` — pasó.
- `pnpm --dir frontend exec playwright test e2e/dashboard-viewport-zoom-adaptability.spec.ts` — pasó: 60/60.
- `pnpm --dir frontend exec playwright test e2e/dashboard-internal-no-scroll-contract.spec.ts` — pasó: 8/8.
- `pnpm --dir frontend exec playwright test e2e/dashboard-global-masked-master-detail.spec.ts` — pasó: 16/16.
- No existe e2e dirigido específico previo para `AdminMaintenanceDryRunCard`
  (grep de `AdminMaintenanceDryRunCard` / `admin-maintenance-candidates-list`
  / `Mantenimiento seguro dry-run` sobre `frontend/e2e` sin resultados); la
  cobertura aplicable son las tres specs globales de arriba.

`frontend/next-env.d.ts` fue regenerado por Next/Playwright durante las
corridas de e2e y se restauró (`git checkout --`) antes del diff review,
fuera de scope.

## Riesgos residuales

- La altura de la primera fila representa al resto de la página; candidatos
  posteriores con `destructiveAction`/`reason` presentes cuando la primera
  fila no los tiene (o viceversa) pueden dejar una medición levemente
  optimista o conservadora hasta el siguiente tick de `ResizeObserver` —
  mismo riesgo ya documentado y aceptado en `ClinicInformesWorkspaceSummary`
  para filas de altura heterogénea.
- `CANDIDATE_ROW_GAP_PX = 8` asume el valor renderizado de `space-y-2`
  (0.5rem con `root font-size` de 16px, consistente con el resto del design
  system). Si ese token cambiara globalmente, este valor debería
  actualizarse junto con él.
- No hay techo de datos conocido en `MaintenancePurgeDryRunSnapshot.candidates`;
  `maxItems` queda en el default del hook (`50`), igual que en los módulos
  Clínica ya migrados.

## Fuera de scope

- `AdminPricingEditorCard` (wizard de un ítem por página, no aplica).
- Todo Admin servidor (`AdminXxxReadOnlyCard`, `AdminMobileXxxModule`),
  bloqueado hasta PR-SRV-0.
- Clínica, Particular.
- Backend, API, auth, DB, migraciones, CORS, CSP, rate limits.
- CI, workflows, dependencias, lockfiles, snapshots.
- CSS global (`globals.css` no se tocó).
- Rediseño visual del módulo.

## Resultado

`AdminMaintenanceDryRunCard` queda migrado al contrato adaptive por filas.
`CANDIDATES_FALLBACK_ROWS` (antes literal `4`) se conserva como fallback
inicial y la cardinalidad visible pasa a derivarse de la medición real del
contenedor de candidatos. Es el primer módulo Admin adaptativo (cliente) del
roadmap (PR-CLIENT-2 en la matriz vigente).

## Estado final

Pendiente de stage/commit/push/PR manual por Nico. No se avanzó al PR
siguiente.
