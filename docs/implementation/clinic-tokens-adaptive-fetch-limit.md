# R-16: Clinic Tokens adaptive fetch limit (C6)

## Estado base

- Rama: `feat/clinic-tokens-adaptive-fetch-limit`, creada desde `main` limpio en
  `84751cd`.
- Documento rector: `docs/audit/final-global-vetneb-50-60-pr-roadmap.md`.

## Deuda C6 (origen)

`clinic-tokens-adaptive-rows-per-page.md` (PR-PILOT-1 / PR-FIX-1 / PR-CORE-1)
activó `useAdaptiveRowsPerPage` en `ClinicParticularTokensCard`: `rowsPerPage`
pasó a medirse contra el contenedor real, con `minRows` por defecto `2` y
`maxRows` por defecto `50` (fundación `useAdaptiveItemsPerPage`, sin `maxRows`
explícito en la llamada del componente). Esos mismos PRs dejaron señalado como
riesgo residual (§"Riesgos residuales", PR-PILOT-1) que `loadTokens` seguía
pidiendo un cap fijo de fetch de diez filas, de forma explícitamente fuera de
scope. La matriz de auditoría (`global-zero-scroll-adaptive-dashboard-matrix.md`
§4.3, entrada C6) formalizó la contradicción: la medición de cardinalidad
visible quedó desacoplada del fetch que la alimenta.

## Por qué el cap fijo era insuficiente

`rowsPerPage` puede medir un valor mayor al cap de fetch en viewports altos
(hasta el techo de `50` del hook). Cuando eso ocurre, la UI mide espacio para
más filas de las que el fetch trajo: `filteredTokens` nunca supera las filas
efectivamente descargadas, `usePagedRows` no tiene con qué llenar la página
medida, y reaparece el mismo gap vertical que el piloto adaptativo vino a
eliminar — sólo que ahora causado por el fetch, no por la cardinalidad fija
original (`TOKENS_PAGE_SIZE`).

## Fórmula del superset

```
TOKENS_FETCH_PAGE_MULTIPLIER = 3
TOKENS_FETCH_LIMIT_FALLBACK = 12
TOKENS_FETCH_LIMIT_MAX = 36

effectiveFetchLimit = clamp(
  rowsPerPage * TOKENS_FETCH_PAGE_MULTIPLIER,
  TOKENS_FETCH_LIMIT_FALLBACK,
  TOKENS_FETCH_LIMIT_MAX,
)
```

Implementada como `resolveTokensFetchLimit(rowsPerPage)` en
`ClinicParticularTokensCard.tsx`, junto a las tres constantes. `loadTokens`
pasa a recibir `limit: number` como parámetro explícito en lugar de un literal
hardcodeado, y todos los llamadores (`useEffect` de montaje, botón
"Actualizar", recarga post-alta) le pasan `effectiveFetchLimit`.

## Cap máximo

`TOKENS_FETCH_LIMIT_MAX = 36` acota el over-fetch incluso si `rowsPerPage`
llega a su techo de `50` (`50 * 3 = 150` sin cap). El cap es deliberadamente
mayor al techo práctico observado en viewports reales para el módulo (evita
reintroducir gap en pantallas altas) sin llegar a pedir cientos de filas al
backend en un único fetch sin `total`/`cargar más`.

## Relación rowsPerPage visible vs fetchLimit superset

- `rowsPerPage` (medido por `useAdaptiveRowsPerPage`, sin cambios) sigue siendo
  la única fuente de cardinalidad **visible**: `usePagedRows(filteredTokens,
  rowsPerPage)` no se toca.
- `effectiveFetchLimit` es exclusivamente el tamaño del **snapshot** que se le
  pide al backend (`getClinicParticularTokens({ limit: effectiveFetchLimit,
  offset: 0 })`), siempre `>= rowsPerPage` gracias al multiplicador `3x` y al
  fallback `12` (mayor al `minRows` mínimo de `2`). El superset garantiza que
  siempre haya al menos una página completa de datos de sobra para filtrar y
  paginar en cliente, sin que el fetch decida cuántas filas se muestran.

## Garantías anti-loop

- El `useEffect` de carga depende únicamente de `[effectiveFetchLimit]`, no de
  `rowsPerPage`. Como `effectiveFetchLimit` es el resultado de un `clamp`,
  múltiples valores de `rowsPerPage` colapsan al mismo `effectiveFetchLimit`
  (p. ej. `rowsPerPage` 2, 3 o 4 devuelven igual `12` por el fallback), por lo
  que la mayoría de los recálculos de `rowsPerPage` (ResizeObserver, ticks de
  medición) no disparan un nuevo fetch.
- Sólo se dispara un nuevo `loadTokens(effectiveFetchLimit)` cuando el
  superset derivado efectivamente cambia de valor — exactamente el caso C6 que
  había que resolver (viewport alto que cruza a un `rowsPerPage` que implica
  más superset del ya cargado).
- `effectiveFetchLimit` no depende de `tokens.length` ni de nada que el propio
  fetch modifique, así que no hay retroalimentación circular: cargar tokens no
  cambia la altura del contenedor medido ni `rowHeightPx`/`tableHeaderHeightPx`
  (miden nodos de layout, no cantidad de filas).
- La selección (`selectedTokenId`) sigue reseteándose sólo si el token
  seleccionado desaparece del nuevo snapshot (`setSelectedTokenId` dentro de
  `loadTokens`, sin cambios de lógica).
- El tracking fan-out (`getClinicStudyTrackingCases` por token) sigue acotado
  al snapshot efectivamente cargado (`nextTokens.map(...)`), nunca a
  `effectiveFetchLimit` como techo teórico.

## Validaciones

- `git diff --check`
- `git restore frontend/next-env.d.ts` (si el dev server lo regeneró)
- `pnpm test`
- `pnpm typecheck:test`
- `pnpm typecheck`
- `pnpm --dir frontend lint`
- `pnpm --dir frontend build`
- e2e dirigido de Clínica Tokens (`dashboard-clinic-tokens-mobile-parity.spec.ts`)
  cuando aplica, sin editar sus contratos existentes.

## Archivos tocados

- `frontend/src/components/dashboard/ClinicParticularTokensCard.tsx`
- `test/frontend-dashboard-clinic-tokens.test.ts`
- `frontend/e2e/dashboard-clinic-tokens-mobile-parity.spec.ts` (el mock de
  `/api/particular-tokens` verificaba `limit === "10"` en el request; pasó a
  verificar el contrato observable — un entero dentro de `[12, 36]` — en vez
  de un literal que la fórmula del superset vuelve obsoleto)
- `docs/implementation/clinic-tokens-adaptive-fetch-limit.md` (nuevo)

## Confirmación de scope

Este PR no toca backend, `frontend/src/lib/api.ts` (el endpoint ya aceptaba
`limit`/`offset`), `frontend/src/app/globals.css`, Admin, Particular, Público,
logística, CI/workflows, dependencias, lockfiles ni snapshots visuales. No
restaura `MasterDetailWorkspace` (eliminado en R-15). No introduce
`matchMedia` ni scroll interno/global nuevo.
