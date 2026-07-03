# R-05 · Admin Particular Tokens — server-adaptive pagination (OF cap + "Cargar más")

- **PR:** R-05
- **Fecha:** 2026-07-03
- **Base:** `main` @ `86eeed5` (docs(admin): confirm particular tokens total contract, #1266)
- **Rama:** `feat/admin-particular-tokens-server-adaptive-pagination`

## Decisión de origen (R-04)

`docs/implementation/admin-particular-tokens-total-contract.md` confirmó que `GET /api/admin/particular-tokens`
**no expone `total`** (ni `hasMore`/`hasNext` de red) y que añadir un `COUNT` real queda prohibido salvo
autorización explícita. La estrategia adoptada para R-05, ya fijada en
`docs/implementation/server-adaptive-pagination-strategy.md` §5/§8/§9 (fila "Tokens admin"), es:

> **OF (over-fetch) con cap + "Cargar más"**, `hasNext` derivado por heurística de página llena/superset,
> sin `total`, sin `pageCount` real. Cap superset propuesto: **30**.

## Contrato anterior (antes de este PR)

`AdminParticularTokensCard.tsx` mantenía **dos pipelines de fetch independientes**, ambos con la misma
heurística de página llena pero cardinalidad fija por dispositivo:

- Desktop: `PAGE_SIZE = 9`, estado `page`, `getAdminParticularTokens({ limit: 9, offset: page * 9 })`,
  `canGoNext = tokens.length === 9`.
- Mobile: `MOBILE_PAGE_SIZE = 10`, estado `mobilePage`, segundo fetch independiente
  `getAdminParticularTokens({ limit: 10, offset: mobilePage * 10 })`, `canGoNextMobile = mobileTokens.length === 10`.
- `matchMedia("(max-width: 767px)")` decidía **qué pipeline correr** (`isMobileViewport` gateaba el efecto
  que disparaba `loadMobileTokens`) — cardinalidad por dispositivo, el patrón que la matriz global prohíbe.

## Contrato nuevo (este PR)

Una única fuente de datos (`tokens`), una única medición (`useAdaptiveItemsPerPage`), una única paginación
cliente (`usePagedRows`) que alimenta **ambas** presentaciones (tabla desktop y lista mobile), igual al
patrón ya usado por Clínicas/Reportes/Sesiones (PR-SRV-1/2) pero con la variante **OF+cap** en vez de HY,
porque este endpoint no tiene `total` para clampar un re-fetch por resize.

### Fetch (over-fetch de superset, una sola vez)

```ts
const TOKENS_FALLBACK_ROWS = 9;   // fallback SSR/primer paint + piso desktop (App Shell "nueve filas")
const TOKENS_SUPERSET_CAP = 30;   // cap de over-fetch, per server-adaptive-pagination-strategy.md §8

const loadTokens = useCallback(async () => {
  const snapshot = await getAdminParticularTokens({ limit: TOKENS_SUPERSET_CAP, offset: 0 });
  setTokens(snapshot.particularTokens);
  setHasMoreFromServer(snapshot.particularTokens.length === TOKENS_SUPERSET_CAP);
}, []);
```

`loadTokens()` corre una vez al montar y en cada mutación/"Actualizar" (siempre desde `offset: 0`, reemplaza
el superset completo). No hay re-fetch por resize/zoom: la cardinalidad visible (`rowsPerPage`) sólo decide
cómo se pagina **en cliente** el superset ya cargado.

### "Cargar más" (heurística de página llena, sin `total`)

```ts
const loadMoreTokens = useCallback(async () => {
  if (isLoadingMoreTokens || !hasMoreFromServer) return;
  const snapshot = await getAdminParticularTokens({
    limit: TOKENS_SUPERSET_CAP,
    offset: tokens.length,
  });
  setTokens((current) => [...current, ...snapshot.particularTokens]);
  setHasMoreFromServer(snapshot.particularTokens.length === TOKENS_SUPERSET_CAP);
}, [isLoadingMoreTokens, hasMoreFromServer, tokens.length]);
```

`hasMoreFromServer` es la única heurística de "puede haber más": el último lote recibido llenó el cap. El
botón **"Cargar más"** sólo aparece cuando el admin llega a la última página cargada localmente
(`!pagedTokens.hasNext`) y `hasMoreFromServer` es verdadero; nunca hay auto-scroll infinito ni salto a
"última página" (no hay forma de calcular cuál es).

### Paginación cliente sobre el superset (`usePagedRows`)

```ts
const filteredTokens = tokens.filter((token) => matchesAdminParticularTokenFilters(token, appliedFilters, clinicOptions));
const pagedTokens = usePagedRows(filteredTokens, rowsPerPage);
const visibleTokens = pagedTokens.pageItems; // renderizado por tabla desktop Y lista mobile
```

`rowsPerPage` viene de `useAdaptiveItemsPerPage` midiendo el contenedor visible (tabla desktop o lista
mobile, exactamente uno de los dos vía CSS `hidden md:block` / `md:hidden`), con:

- `fallbackItems: TOKENS_FALLBACK_ROWS` (9, SSR/primer paint).
- `minItems: isDesktopMeasurement ? TOKENS_FALLBACK_ROWS : 1` — el piso de nueve filas en desktop preserva
  el contrato `expectNinePopulatedRows` del App Shell a 1366×768 (igual excepción ya documentada para
  Reportes/Users-Roles; Clínicas no tiene ese piso). Mobile no tiene piso (achica libremente en teléfonos
  bajos).
- `maxItems: TOKENS_SUPERSET_CAP` (30) — `rowsPerPage` nunca pide más filas por página de las que el
  superset puede tener cargadas.

### Eliminado

- `matchMedia` como fuente de cardinalidad (y como cualquier otra cosa: el componente ya no usa
  `window.matchMedia` en absoluto — la única señal de presentación es CSS).
- `MOBILE_PAGE_SIZE` y el segundo pipeline de fetch (`loadMobileTokens`, `mobileTokens`, `mobilePage`,
  `isLoadingMobileTokens`, `canGoNextMobile`, `isMobileViewport`).
- `filteredMobileTokens` (duplicado de `filteredTokens`, ya no existe una lista mobile independiente).
- `canGoNext`/`page` (estado de servidor por página); reemplazados por `pagedTokens.hasNext`/`pagedTokens.page`
  (estado 100% cliente sobre el superset ya cargado).

### Anti-carrera (§7 de la estrategia)

`latestRequestRef` (un único contador compartido entre `loadTokens` y `loadMoreTokens`) descarta cualquier
respuesta cuyo `requestId` ya no sea el vigente — evita que un "Actualizar" en vuelo pise el resultado de un
"Cargar más" concurrente o viceversa.

### Sin `pageCount` falso

El pager nunca muestra "Página X / Y": conserva el copy previo ("Página {n}" / "Pág. {n}") sin denominador,
igual que Reportes (que tampoco tiene `total`). `pagedTokens.pageCount` existe internamente (usePagedRows lo
expone) pero sólo gobierna el clamp de la página activa cuando el dataset cargado cambia (filtros, carga
más); nunca se renderiza como un total real de páginas del servidor.

## Archivos tocados

- `frontend/src/app/dashboard/admin/AdminParticularTokensCard.tsx` — migración completa descrita arriba.
- `frontend/src/components/dashboard/ParticularTokensCardPrimitives.tsx` — `ParticularTokensMobileList` pasa
  de `ComponentPropsWithoutRef<"div">` a `ComponentPropsWithRef<"div">` para poder medir su contenedor
  (`ref={setMobileBodyNode}`); sin cambio visual ni de comportamiento para el consumidor existente (Clínica
  no usa esta primitiva).
- `test/frontend-admin-particular-tokens.test.ts` — actualiza aserciones de fuente que referenciaban
  `filteredMobileTokens.map(...)` y `setPage(0); setMobilePage(0);` al nuevo contrato colapsado
  (`visibleTokens.map(...)`, `pagedTokens.setPage(0)`).
- `test/admin-tokens-enterprise-density.test.ts` — reemplaza el test de contrato de paginación fija (`PAGE_SIZE`,
  `canGoNext`) por el contrato adaptativo (constantes, `useAdaptiveItemsPerPage`, `usePagedRows`,
  `hasMoreFromServer`, ausencia de `matchMedia`/`MOBILE_PAGE_SIZE`/`isMobileViewport`) y agrega el test
  anti-carrera (mismo patrón que Reportes).
- `frontend/e2e/admin-tokens-mobile-toolbar-layout.spec.ts` — sube el fixture de 11 a 40 tokens (margen sobre
  el cap 30, mismo criterio que R-02/R-03) y reemplaza los `toHaveCount(10)`/`toHaveCount(6)` fijos por el
  patrón de "settle" (`toPass` con conteo estable) + aserciones acotadas, igual precedente que
  `admin-clinics-mobile-card-layout.spec.ts`.
- `frontend/e2e/admin-mobile-core-modules-no-scroll.spec.ts` — sube `MOCK_TOKENS` de 13 a 40 y
  `maxItemsPerPage` de Tokens en la tabla `MODULES` de 10 a 30 (cap real).
- `docs/implementation/admin-particular-tokens-server-adaptive-pagination.md` — este documento.

## Validaciones ejecutadas

- `pnpm test` — 2943/2943 verdes.
- `pnpm typecheck:test` — sin errores.
- `pnpm security:public-surface` — PASS (mismos 2 findings server-only preexistentes, no relacionados).
- `pnpm --dir frontend lint` — sin errores.
- `pnpm --dir frontend typecheck` — sin errores.
- `pnpm --dir frontend build` — build de producción exitoso.
- `pnpm --dir frontend exec playwright test e2e/admin-tokens-mobile-toolbar-layout.spec.ts` — 12/12 verdes.
- `pnpm --dir frontend exec playwright test e2e/admin-mobile-core-modules-no-scroll.spec.ts --grep "tokens"` — 4/4 verdes.
- `pnpm --dir frontend exec playwright test e2e/admin-mobile-core-modules-no-scroll.spec.ts` (suite completa,
  para confirmar que Clínicas/Reportes no se rompieron por el cambio de config compartida) — 14/14 verdes.
- `e2e/admin-mobile-core-pager.spec.ts` **no existe** en el repo (verificado con `ls frontend/e2e`); el
  archivo equivalente por nombre es `test/admin-mobile-core-pager-canonical-layout.test.ts` (unit, no e2e),
  que sólo referencia Clínicas/Reportes (no Tokens) y ya corrió dentro de `pnpm test`.
- `frontend/next-env.d.ts` quedó modificado por Playwright (regenerado a `./.next/dev/types/routes.d.ts`) y
  se revirtió con `git checkout -- frontend/next-env.d.ts` antes de cerrar el PR, después de lo cual se
  re-corrió `pnpm test` (2943/2943 verdes) para confirmar que no quedó contaminado.

## Fuera de scope

- Backend/API/auth/DB/migrations — `server/routes/admin-particular-tokens.fastify.ts`,
  `deps.listParticularTokens` y el tipo `AdminParticularTokensSnapshot` en `frontend/src/lib/api.ts` **no se
  tocaron**. No se agregó ningún `total`/`COUNT` real.
- CI/workflows, deps/lockfiles, snapshots, `globals.css`.
- Otros módulos Admin (Clínicas, Reportes, Auditoría, Alertas) y Clínica/Particular/Público.
- R-06 y cualquier PR posterior.

## Riesgos residuales

- Sin `total`, el admin no ve un conteo exacto de tokens particulares en el sistema ni un clamp garantizado
  a la "última página" — mismo riesgo aceptado y documentado en R-04, mitigado con "Cargar más" +
  heurística de página llena (idéntico patrón ya en producción en Reportes).
- Tras cualquier mutación (alta/baja de token) o clic en "Actualizar", el superset se recarga desde
  `offset: 0` con el cap base (30): si el admin había usado "Cargar más" varias veces antes de la mutación,
  esas páginas adicionales se descartan y hay que volver a pedirlas. Comportamiento intencional (evita
  aritmética de `offset` obsoleta tras un alta/baja que cambia el orden/conteo real) y consistente con que
  "Actualizar" ya recargaba desde cero en el contrato anterior.

## Confirmación

Sin cambios en `server/**`, `migrations/**`, CI/workflows, deps/lockfiles, snapshots ni `globals.css`. No se
ejecutó `git add/commit/push` ni se abrió PR — queda a cargo de Nico.
