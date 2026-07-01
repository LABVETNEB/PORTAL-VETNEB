# PR-PILOT-1: Clinic Tokens adaptive rows per page

## Estado base

- Rama: `feat/clinic-tokens-adaptive-rows`, creada desde `main` en `17a8df0`.
- Working tree limpio antes de iniciar, sin PRs abiertos, sin ramas locales adicionales.
- Documentos de gobernanza ya mergeados: `docs/audit/vetneb-enterprise-operational-platform-extreme-excellence-advisory.md`
  y `docs/audit/global-zero-scroll-adaptive-dashboard-matrix.md`.

## Problema

`ClinicParticularTokensCard` paginaba la lista de tokens con una cardinalidad fija
(`TOKENS_PAGE_SIZE = 4`) sin relación con el espacio real disponible en el
contenedor de filas/cards. En viewports altos sobraba espacio vacío; en viewports
bajos el valor fijo podía seguir siendo más grande de lo que el contenedor podía
mostrar sin comprometer el contrato de no-scroll.

## Scope incluido

- Hook nuevo `useAdaptiveRowsPerPage` (cliente, genérico, sin dependencias del
  dominio Clínica).
- Integración exclusiva en `ClinicParticularTokensCard` (tabla desktop + lista
  mobile comparten el mismo `rowsPerPage`).
- `ParticularTokensPanelBody` acepta ahora `ref` (prop nativa de React 19, sin
  `forwardRef`) para exponer el nodo medido.
- Token CSS `--dash-row-h` agregado a la capa de densidad existente del App
  Shell (`.dashboard-app-shell`), con valores por tier (base/compact/dense/
  ultra-compact), igual que el resto de los tokens `--dash-*`.
- Test de contrato de fuente actualizado para reflejar `rowsPerPage` en lugar
  de `TOKENS_PAGE_SIZE` pasado directo a `usePagedRows`.

## Scope excluido

- No se tocó backend, API, auth, DB, migrations.
- No se tocó Admin ni Particular.
- No se tocó CI, workflows, dependencias, lockfiles ni snapshots visuales.
- No se generalizó el patrón a otros módulos del dashboard.
- No se modificaron specs de e2e (solo se ejecutaron los tres e2e dirigidos ya
  existentes, sin editarlos).
- No se cambió la firma de `usePagedRows`, el fetch (`limit: 10`), el footer/
  pager, los flujos de alta/filtros/detalle/diálogos, ni los `data-clinic-access-*`
  existentes.

## Diseño técnico

`useAdaptiveRowsPerPage` (`frontend/src/hooks/useAdaptiveRowsPerPage.ts`):

- Estado inicial = `fallbackRows` (`TOKENS_PAGE_SIZE`).
- `useLayoutEffect` + `ResizeObserver` sobre `containerRef.current`, con el
  cálculo real desacoplado vía `requestAnimationFrame`.
- Fórmula: `rowsPerPage = clamp(floor((containerHeight - headerHeightPx - safetyGapPx) / rowHeightPx), minRows, maxRows)`.
- Nunca retorna `0`, negativo, `NaN` ni `Infinity`; conserva el último valor
  válido si el contenedor no existe, mide `0`, o `rowHeightPx <= 0`.
- `minRows` default `2`, `maxRows` default `50`, `safetyGapPx` default `6`.
- No escribe estilos, no usa `matchMedia`, no lee `window` como fuente de
  verdad para decidir cardinalidad.

Integración en `ClinicParticularTokensCard`:

- `panelBodyRef` se pasa a `ParticularTokensPanelBody` (nodo con
  `data-clinic-access-list-body="true"`), que es el `containerRef` del hook.
- `rowHeightPx` se obtiene midiendo un probe invisible (`aria-hidden`,
  `pointer-events-none`, `opacity-0`, `position: absolute`) cuya altura es
  `var(--dash-row-h)`, vía su propio `ResizeObserver`. Esto resuelve el valor
  computado real del token CSS (los custom properties no se resuelven al leer
  `getComputedStyle` directamente sobre el elemento).
- `headerHeightPx` se obtiene midiendo el `<thead>` de la tabla desktop. En
  mobile ese `<thead>` vive dentro de un contenedor `hidden md:block`, por lo
  que su altura medida es `0` automáticamente y no se descuenta nada — cumple
  el requisito de no descontar header de tabla en mobile sin lógica adicional.
- `usePagedRows(filteredTokens, rowsPerPage)` reemplaza el uso directo de
  `TOKENS_PAGE_SIZE`; la firma de `usePagedRows` no cambia.
- `TOKENS_PAGE_SIZE = 4` permanece en el archivo como `fallbackRows`.
- `setPage(0)` en cambios de filtros (`applyAdvancedFilters`,
  `clearAdvancedFilters`) se preserva sin modificaciones.

CSS (`frontend/src/app/globals.css`):

- `--dash-row-h` se agrega junto a `--dash-list-pad-y` dentro del bloque base
  de `.dashboard-app-shell` y se ajusta en los tres media queries de altura ya
  existentes (`max-height: 860px / 760px / 680px`), siguiendo el mismo patrón
  fluido (`clamp()`) que el resto de los tokens de densidad. No se creó un
  sistema de breakpoints nuevo.

## Archivos modificados

- `frontend/src/hooks/useAdaptiveRowsPerPage.ts` (nuevo)
- `frontend/src/components/dashboard/ClinicParticularTokensCard.tsx`
- `frontend/src/components/dashboard/ParticularTokensCardPrimitives.tsx`
- `frontend/src/app/globals.css`
- `test/frontend-dashboard-clinic-tokens.test.ts`
- `docs/implementation/clinic-tokens-adaptive-rows-per-page.md` (nuevo)

## Validaciones

- `pnpm test` — 2905 tests, 0 fallos.
- `pnpm typecheck:test` — sin errores.
- `pnpm --dir frontend lint` — sin errores.
- `pnpm --dir frontend build` — build de producción exitoso.
- `pnpm --dir frontend exec playwright test e2e/dashboard-clinic-tokens-mobile-parity.spec.ts` — 3/3 passed.
- `pnpm --dir frontend exec playwright test e2e/dashboard-internal-no-scroll-contract.spec.ts` — 8/8 passed.
- `pnpm --dir frontend exec playwright test e2e/dashboard-global-masked-master-detail.spec.ts` — 16/16 passed.
- `frontend/next-env.d.ts`, regenerado por el dev server de Playwright durante
  la corrida de e2e, fue revertido antes del commit (ver `[[feedback_next_env_regeneration]]`).

## Riesgos residuales

- El `rowHeightPx` medido vía probe con `var(--dash-row-h)` es una
  aproximación única para fila desktop (tabla) y fila mobile (card); ambos
  layouts tienen alturas ligeramente distintas en la práctica, por lo que
  `rowsPerPage` puede quedar levemente conservador o levemente generoso según
  el layout activo. No se detectó overflow en los e2e dirigidos.
- `maxRows` queda en el default del hook (`50`); dado que `loadTokens` sigue
  pidiendo `limit: 10`, el techo práctico visible sigue acotado por el fetch,
  no por el hook.
- No se agregó cobertura e2e nueva que fuerce específicamente el
  redimensionamiento del contenedor para validar el recálculo dinámico de
  `rowsPerPage` (reservado explícitamente para PR-PILOT-2).

## Rollback

Revertir el commit del PR restaura `usePagedRows(filteredTokens, TOKENS_PAGE_SIZE)`
como cardinalidad fija, elimina el hook nuevo y el token `--dash-row-h`, sin
efectos en backend, datos ni otros módulos.

## Confirmación de scope

Este PR no toca backend, API, auth, DB, migrations, Admin, Particular, CI,
dependencias, lockfiles, snapshots visuales, ni specs de e2e existentes.
