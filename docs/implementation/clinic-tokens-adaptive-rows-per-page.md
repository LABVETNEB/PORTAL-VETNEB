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

## PR-FIX-1 — Activation fix

### Bug detectado por PR-PILOT-2

Al redactar el e2e de PR-PILOT-2 (cobertura de resize dinámico, comparando
filas visibles entre viewport alto y bajo) se detectó que `rowsPerPage` nunca
se movía de `TOKENS_PAGE_SIZE = 4`, sin importar la altura real del
contenedor. Medido directamente en runtime (sin recargar la página, sólo
cambiando `setViewportSize`): el contenedor pasó de 632px → 56px → 1542px de
alto y la cantidad de filas renderizadas se mantuvo en 4 en los tres casos.

### Causa raíz

`tokens` arranca en `[]`; mientras `tokens.length === 0` se renderiza
`ParticularTokensEmptyPanel`, no el panel real, así que el nodo del
contenedor (`panelBodyRef.current`, antes un `useRef`) y los nodos del probe
de altura de fila y del `<thead>` eran `null` en el primer commit. Los tres
`useLayoutEffect` que dependían de esos refs corrían una única vez contra un
ref todavía `null` y hacían early-return:

- Los dos efectos locales del componente (probe de fila, `<thead>`) tenían
  array de dependencias `[]` — nunca se re-ejecutaban.
- El efecto de `useAdaptiveRowsPerPage` dependía de `containerRef` (el mismo
  objeto `ref` siempre — React compara por identidad, no por `.current`),
  `headerHeightPx` y `rowHeightPx` (ambos nunca cambiaban porque dependían de
  los otros dos efectos, ya rotos). Ningún valor del array de dependencias
  cambiaba jamás entre el render inicial (contenedor `null`) y el render
  donde `tokens` se poblaba y el panel real se montaba, así que el
  `ResizeObserver` nunca llegaba a instalarse.

### Por qué `useRef` + `useLayoutEffect` no alcanzaba

Un `useRef` tiene identidad estable durante toda la vida del componente;
asignar `.current` no dispara re-render ni re-ejecuta efectos. Un
`useLayoutEffect` con dependencias `[]` (o con dependencias que nunca
cambian) sólo ve el valor de `.current` que existía en el primer commit. Si
el nodo real se monta en un commit posterior (como acá, detrás de un fetch
async), el efecto ya corrió y nunca vuelve a intentarlo.

### Por qué callback ref + `useState` corrige el problema

Reemplazando `useRef` por `useState<HTMLElement | null>(null)` y pasando el
setter como `ref` (patrón nativo de callback ref), React re-renderiza en el
momento exacto en que el nodo pasa de no existir a existir. Incluyendo ese
valor de estado en el array de dependencias del efecto, el
`useLayoutEffect` se re-ejecuta cuando el nodo real aparece, e instala el
`ResizeObserver` contra el contenedor correcto.

- `useAdaptiveRowsPerPage.ts`: la opción `containerRef: RefObject<...>` pasó
  a ser `containerNode: HTMLElement | null`; el efecto depende de
  `containerNode` en vez de un objeto `ref` estable.
- `ClinicParticularTokensCard.tsx`: `panelBodyRef`, `rowHeightProbeRef` y
  `tableHeaderRef` (los tres `useRef`) pasaron a ser `panelBodyNode`,
  `rowHeightProbeNode`/`tableHeaderNode` (más tarde reemplazados también, ver
  sección siguiente) respaldados por `useState`, con `ref={setXNode}` en el
  JSX.

## PR-FIX-1 — Mobile row height precision fix

### Segundo bug detectado

Al validar el fix de activación contra los e2e dirigidos existentes
(`dashboard-clinic-tokens-mobile-parity.spec.ts`), el viewport más angosto
(360×740, con contenido de tutor/paciente intencionalmente largo) mostró
overflow real dentro de la lista: contenedor de 282.9px de alto, contenido
de 372px (~89px de clipping), con 6 cards mobile de ~62px cada una.

### Causa raíz

`rowHeightPx` se medía con un único probe invisible atado al token CSS
`--dash-row-h` (pensado para una fila de tabla desktop de una sola línea,
~37-44px). Ese mismo valor se usaba para calcular cuántas filas entraban
tanto en la tabla desktop como en la lista de cards mobile. La card mobile
real, con nombre de tutor/paciente largo, envuelve a 2-3 líneas y mide
~62px real — el hook subestimaba ~20-25px por fila en mobile, calculaba más
filas de las que entraban, y el contenido desbordaba el contenedor. Este
riesgo ya estaba documentado como residual en el diseño original de
PR-PILOT-1 ("rowHeightPx es una aproximación única compartida... puede
quedar levemente conservador o levemente generoso"), pero nunca se había
observado en un e2e porque el hook estaba inactivo (bug de activación).

### Solución: medición real por layout, sin breakpoints hardcodeados

Se eliminó el probe sintético de `--dash-row-h` y se reemplazó por
medición directa de la primera fila/card real ya renderizada:

- `firstDesktopRowNode`: ref (callback + `useState`) sobre el primer `<tr>`
  de la tabla (`pagedTokens.pageItems[0]`).
- `firstMobileRowNode`: ref sobre la primera card mobile
  (`pagedTokens.pageItems[0]`).
- Un único `useLayoutEffect` observa ambos nodos con `ResizeObserver` y usa
  `Math.max(desktopHeight, mobileHeight)` como `rowHeightPx`.

Como el layout inactivo vive detrás de una clase Tailwind `hidden`/`md:hidden`
(`display: none` en su ancestro), su fila mide `0` en `getBoundingClientRect()`
— tomar el máximo de las dos mediciones da siempre la altura real del
layout visible, sin decidir por un breakpoint hardcodeado ni por
`matchMedia`.

### Archivos tocados (PR-FIX-1 completo)

- `frontend/src/hooks/useAdaptiveRowsPerPage.ts`
- `frontend/src/components/dashboard/ClinicParticularTokensCard.tsx`
- `frontend/e2e/dashboard-clinic-tokens-mobile-parity.spec.ts` (contrato
  rígido `toHaveCount(4)` reemplazado por conteo adaptativo asentado —
  helper `waitForSettledRowCount` — con relaciones: positivo, acotado por el
  dataset mockeado, texto de paginación y estado de "Siguiente" derivados
  del conteo observado, no de un literal)
- `frontend/e2e/dashboard-global-masked-master-detail.spec.ts` (mismo
  patrón, mismo helper duplicado localmente en el archivo)
- `docs/implementation/clinic-tokens-adaptive-rows-per-page.md` (esta
  sección)

`test/frontend-dashboard-clinic-tokens.test.ts` no requirió cambios: no
pineaba `containerRef`/`containerNode` ni los nombres de refs internos, sólo
`useAdaptiveRowsPerPage`, `fallbackRows: TOKENS_PAGE_SIZE` y
`usePagedRows(filteredTokens, rowsPerPage)`, que se preservan.

### Por qué el conteo pasó de "4" a un valor asentado distinto en los e2e

`toHaveCount(4)` en los specs existentes validaba, sin saberlo, el valor
congelado del bug de activación (que coincidía numéricamente con
`TOKENS_PAGE_SIZE`). Con el hook activo, la medición real toma dos renders
en converger: un primer commit calcula con `rowHeightPx`/`headerHeightPx`
todavía en su valor de fallback (antes de que los efectos hermanos
actualicen esos estados), y un commit siguiente recalcula con los valores
reales ya medidos. Los e2e ajustados esperan explícitamente a que el
conteo se asiente (3 lecturas idénticas consecutivas) antes de tomarlo como
válido, en vez de fijar un número.

### Validaciones ejecutadas

- `pnpm test` — 2905/2905.
- `pnpm typecheck:test` — sin errores.
- `pnpm --dir frontend lint` — sin errores.
- `pnpm --dir frontend build` — build de producción exitoso.
- `pnpm --dir frontend exec playwright test e2e/dashboard-clinic-tokens-mobile-parity.spec.ts` — 3/3 (repetido 3 veces, estable).
- `pnpm --dir frontend exec playwright test e2e/dashboard-internal-no-scroll-contract.spec.ts` — 8/8.
- `pnpm --dir frontend exec playwright test e2e/dashboard-global-masked-master-detail.spec.ts` — 16/16.
- `node --test test/frontend-dashboard-clinic-tokens.test.ts` — 13/13.
- `frontend/next-env.d.ts`, regenerado por el dev server de Playwright
  durante las corridas de e2e, revertido antes de cada `pnpm test`.

### Riesgos residuales

- La medición mobile depende de que la primera card de la página actual sea
  representativa del resto (misma estructura de contenido); un token
  particular con contenido drásticamente más largo/corto que el resto de la
  página podría hacer que `rowsPerPage` quede levemente conservador o
  generoso hasta el próximo `ResizeObserver` tick, pero nunca deja de
  converger (no hay overflow sostenido observado en los e2e dirigidos).
- El primer commit tras cargar los tokens sigue mostrando un valor
  transitorio (calculado con el fallback) antes de asentarse; no afecta al
  usuario final (son milisegundos dentro de un mismo frame de React) pero
  cualquier e2e nuevo sobre este módulo debe esperar a que el conteo se
  asiente en vez de leerlo una sola vez.
- PR-PILOT-2 (cobertura e2e de resize dinámico) queda pausado; se retoma
  desde `main` limpio una vez mergeado este PR-FIX-1.

### Rollback

Revertir el/los commits de PR-FIX-1 restaura el estado de PR-PILOT-1: hook
inactivo (`rowsPerPage` clavado en `TOKENS_PAGE_SIZE = 4`), sin efectos en
backend, datos ni otros módulos. No requiere rollback de datos ni de
configuración.
