# Dashboard Pitch-Locked Capacity Engine — Implementation

Implementación de **Opción D — Pitch-Locked Canvas + Single Capacity Engine** sobre la rama de
PR #1650. Documento de implementación: registra lo ejecutado, con qué evidencia, y qué queda
abierto. Roadmap rector: `docs/implementation/dashboard-pitch-locked-capacity-engine-roadmap.md`
(versionado en `main`, leído desde `origin/main`, no copiado a esta rama).

## Status

| Campo | Valor |
|---|---|
| Rama | `test/dashboard-a03-freeze-post-a05` |
| HEAD base | `377890816843c19e5fa9e86e6f99c8722376c093` (sin mover) |
| Fases A–I | ejecutadas |
| Migración | **17/17 consumidores**; 4 owners legacy retirados |
| Abierto | A03: determinismo **no demostrado** (ver *A03*) |
| Fecha | 2026-08-13 |

### Precondición del roadmap: revocada por Nico

El roadmap declaraba `BLOCKED` hasta que #1650 estuviera *merged*. Esa precondición queda revocada
por instrucción explícita de Nico: la Opción D **es** el fix de #1650. Por precedencia de
`AGENTS.md` (`PEDIDO_EXPLÍCITO_ACTUAL_DE_NICO` > `DOCUMENTACIÓN_TÉCNICA_VIGENTE`), `#1650 OPEN` es
la condición esperada. Trabajar aquí resultó además **mejor** que el plan original: la baseline
runtime auditada que el roadmap echaba en falta en `main` existe en esta rama.

## Root cause

`capacity` no era función de la geometría. El pitch se medía de una fila **renderizada**, de modo
que dependía del dataset, de la página activa y del orden en que dos observers publicaban; en las
superficies server-paged el bucle se cerraba a través de la red
(`capacity → query.limit → fetch → filas → pitch`). Por eso `A → B → A` no estaba obligado a
devolver `N` (`admin-audit-log::w1440x900`, esperado 9, recibido 8).

## Arquitectura

```
capacity = clamp(floor((canvasContentBox − reserved + gap) / (pitch + gap)), minItems, maxItems)
```

### El término `gap` en tablas con `border-collapse: collapse`

Una tabla colapsada **comparte un borde entre filas adyacentes**, así que cada fila *avanza* un
píxel más de lo que mide su propia caja: la celda resuelve al pitch y el separador colapsado queda
entre filas exactamente como un gap. Medido sobre `admin-users-roles`: celda 36 px, **avance de
fila 37 px**, uniforme en todas las filas y viewports (la media aparente de 36.944 era el artefacto
de la última fila, 36.5, sin borde inferior).

Declararlo como el término `gap` es lo que hace que la ecuación **reproduzca las cardinalidades
A03 congeladas** en vez de reclamar una fila de más por canvas:

| Viewport | `floor((canvas − reserved + gap) / (pitch + gap))` | A03 congelado |
|---|---|---|
| 1366×768 | `floor((375.69 − 32 + 1) / 37)` = **9** | 9 |
| 1440×900 | `floor((502.89 − 32 + 1) / 37)` = **12** | 12 |

Que la aritmética corregida reproduzca **independientemente** ambos valores congelados es la
evidencia más fuerte disponible de que el modelo es correcto, y no meramente de que el test pasa.

> **Trampa registrada.** El token del tier NO debe subirse a 37: `block-size` fija la **celda**, y
> el borde colapsado se suma encima, de modo que un token de 37 produce un avance de 38 —
> el mismo off-by-one un píxel más arriba. El separador es un `gap`, no parte del pitch.

### Por qué esta fase costó cuatro intentos

Los tres primeros intentos atacaron un síntoma producido por el anterior, no la caja:

| # | Cambio | Por qué falló |
|---|---|---|
| 1 | forzar filas 48→44 con `padding-block: 0` | un tier por debajo de la altura natural no es un lock, es una sobre-reclamación |
| 2 | subir el reserve del head 32→44 | consumió altura; el conteo cayó a 8 |
| 3 | `minItems: 9` incondicional | forzó 9 filas donde caben 7 ⇒ el pager quedó cubierto y se comió el hit-test de "Siguiente" |
| **4** | **`--dash-row-gap: 1px`** | **modeló el borde colapsado: el término que faltaba** |

Corolario que conviene no volver a perder: **una vez el box model es correcto, las compensaciones
dejan de ser innecesarias y pasan a ser dañinas.** El floor `minItems` pudo volver a `1` porque
sólo existía para tapar una geometría mal modelada; con el `gap` declarado, 1366×768 resuelve 9 de
forma natural y 1280×720 resuelve su ajuste real (7, el valor A03 congelado).

Regla operativa para geometría de tablas: `max-block-size` es **undefined** en cajas de tabla y
`block-size` actúa como **mínimo**, así que la única autoridad es el DOM medido — nunca el valor
del token razonado sobre el papel.

CSS es dueño de la geometría; el owner sólo la lee. El contenido queda al final del grafo y
ninguna flecha vuelve hacia arriba.

### Tres desviaciones respecto del pseudocódigo del roadmap

Las tres nacieron de fallos observados, no de preferencia. **El código y la evidencia tienen
precedencia sobre el pseudocódigo documental.**

1. **`rowGapPx` es un término real.** `n` filas cuestan `n·pitch + (n−1)·gap`; ignorarlo no es
   redondeo, es un error de una fila. Con `gap = 0` la fórmula colapsa exactamente al
   `floor(usable / pitch)` del roadmap — fijado por test sobre 100 entradas generadas.
2. **El canvas se mide por CONTENT BOX.** `getBoundingClientRect()` devuelve el border box, así
   que un canvas con `py-1` hacía que el motor dimensionara filas contra espacio que las filas no
   podían ocupar: reclamaba una fila de más, esa fila se superponía al pager y **se comía el
   hit-test de "Siguiente"** (paginación inalcanzable, no sólo densidad mal calculada).
3. **Las filas de tabla se bloquean por la CELDA.** `max-block-size` es *undefined* sobre cajas de
   tabla y `block-size` actúa como MÍNIMO: una fila siempre crece hasta caber sus celdas. El lock
   pasa por anular `padding-block` de la celda y darle el token como altura, de modo que la altura
   natural **iguale** el pitch en vez de estar meramente acotada por él. El padding inline —el
   ritmo de columnas— no se toca.

### Contrato de tokens

Tiers autorizados como literales `px` (las custom properties computan a su token sustituido, no a
una longitud absoluta: un `rem`/`clamp()` sería ilegible para el owner). Verificado empíricamente
en Chromium: `var()` sí se sustituye y `getPropertyValue` devuelve `44px`/`52px`/`6px`/`32px`, y el
escalón `@media` de viewport corto mueve `tall` 52→46.

| Tier | px | Gramática |
|---|---|---|
| `compact` | 36 | fila de tabla densa de una línea |
| `regular` | 44 | fila por defecto de lista/tabla |
| `tall` | 52 | fila de lista de dos líneas |
| `card` | 76 | fila que renderiza un bloque propio |
| `block` | 168 | panel de métricas |
| `form` | 220 | formulario editable completo |

Gaps: `spaced` 6px, `loose` 8px, `wide` 12px. Reserva interna: `--dash-canvas-reserved`
(cabecera de tabla, 32px) — un token en vez de un segundo `ResizeObserver`, de modo que la reserva
que el motor resta y el espacio que la cabecera ocupa son el mismo número por construcción.

## Fase A.0 — medición del quantum

No heredado de la auditoría. Corrida instrumentada de A05 sobre `logistics-recent-list`:

| Métrica | Valor |
|---|---|
| Lecturas | 130 (13 viewports × 2 hojas × 5 escenarios) |
| Pares `A → B → A` | 26 |
| **Dispersión de `canvasBlockSize`** | **0 px** |
| Valores distintos | 15, **todos** sobre la retícula `1/64 px` |

`1/64` es la `LayoutUnit` de Chromium: `quantise` es la **identidad** sobre geometría real (no
puede mover una lectura ya correcta) y sólo absorbe el epsilon de la aritmética derivada en la
discontinuidad de `floor`. Al ser potencia de dos, la idempotencia es exacta bit a bit. La
instrumentación se revirtió.

## Censo

| Owner | Antes | Después |
|---|---|---|
| `useAdaptiveItemsPerPage` | 9 | **0** |
| `useAdaptiveRowsPerPage` | 6 | **0** |
| `useAdaptiveDashboardPageSize` | 2 | **0** |
| `adaptiveRowPitchCalibration` | 1 | **0** |
| `useDashboardCanvasCapacity` | 0 | **17** |

`LEGACY_CAPACITY_HOOK_CONSUMERS=0` · `CALIBRATOR_CONSUMERS=0` · `MIGRATION_PENDING=0`

## Retirada de legacy

Retirados sólo tras verificar por grep que su contador llegó a 0:

- `adaptiveRowPitchCalibration.ts` (302 líneas). Su LRU de 16 geometrías era estado que sobrevivía
  a `A→B→A`, y bajo A05 (65 geometrías por módulo contra 16 ranuras) se desbordaba por diseño: la
  garantía "frozen and replayed" no se sostenía justo en la carga que debía proteger.
- `useAdaptiveItemsPerPage.ts`, `useAdaptiveRowsPerPage.ts`, `useAdaptiveDashboardPageSize.ts`.
- `dashboard-adaptive-row-pitch-calibration.test.ts` — retirado **con su sujeto**; su cobertura la
  reemplazan `dashboard-capacity-engine.test.ts` y `dashboard-capacity-single-owner.test.ts`, que
  demuestran determinismo **por construcción** en vez de por memoria.

Resuelto de paso: el floor `desktopMinItems` de Users/Roles era un no-op demostrable — sólo se
aplicaba cuando nueve filas ya cabían, y con el gap desktop en 0 ambas aritméticas eran idénticas.
Colapsado a `minItems: 1` para no dejar una rama muerta que se leyera como contrato.

## Defectos encontrados por A05 (los tres, propios; los tres corregidos en la primitiva)

Comparten una única raíz: **la aritmética del motor sólo es exacta mientras las filas honren el
pitch.** Cada defecto era un agujero en esa premisa.

| # | Mecanismo | Corrección |
|---|---|---|
| 1 | Filas móviles **sin lock**: tier 36px contra filas de ~40px ⇒ la fila sobrante quedaba fuera de `overflow:hidden` (presente en el DOM, invisible: A05 contó 16 de 18) | lock de toda gramática de fila móvil + tier móvil `regular` |
| 2 | **Border box vs content box**: el `py-1` del canvas contaba como espacio de filas ⇒ fila sobrante encima del pager | el owner mide el content box |
| 3 | **Filas de tabla no acotables**: `max-height` undefined en cajas de tabla ⇒ las celdas decidían la altura | lock por celda (`padding-block: 0` + token como altura) |

El guard nuevo exige cobertura de lock: cualquier marcador de fila dentro de un canvas adaptativo
debe declarar `data-dashboard-adaptive-row="true"`. Las filas de tabla se bloquean por elemento;
las de lista no tienen tal elemento, así que deben declararlo.

## A05

`--workers=2 --retries=0`, sin retry, sin tolerancia:

| Corrida | Resultado |
|---|---|
| `logistics-recent-list` BEFORE (instrumentada) | 1 passed · 93.3 s |
| `logistics-recent-list` AFTER | 1 passed · 93.7 s |
| 3 hojas críticas `--repeat-each=3` | **9 passed, 0 flaky** · 8.6 min |
| **A05 COMPLETO (15 módulos)** | **15 passed, 0 failed, 0 did-not-run** · **6.9 min (415.7 s)** |

### Scheduling

`test.describe.configure({ mode: "serial" })` **eliminado**. Verificado estructuralmente antes de
tocarlo: sin `beforeAll`/`afterAll`, sin estado mutable de módulo, sin ficheros entre tests, y
`prepareContext` reestablece cookies sobre el `page`/contexto aislado de cada test. La
serialización además **saltaba** todos los módulos posteriores a un fallo (`DID_NOT_RUN`).

**Makespan: 415.7 s contra un presupuesto de 1800 s (~4,3× de margen).** El wall clock de una hoja
aislada no mejoró (93.3 → 93.7 s): está dominado por `waitForAdaptiveConvergence`, que este PR no
toca por exclusión del roadmap. La ganancia de makespan viene de la paralelización que el
determinismo habilita, no de acelerar la hoja.

## A03 — `NO REALINEADO` (abierto)

Protocolo del roadmap: prohibido actualizar el baseline porque falle; primero hay que demostrar
determinismo.

| Corrida | Resultado |
|---|---|
| cold-1 | **15/15 módulos PASSED**; falla sólo el agregador de integridad · 4.9 min |
| cold-2 | **abortada**: `admin-clinics::w390x844: first data row` no visible (30 s timeout) |

cold-1 mostró una diferencia legítima esperada (`admin-audit-log::w1280x720`, limit 7 → 8: el
canvas desktop perdió su `py-2` y el motor divide por un token exacto de 36 en vez de un pitch
medido de ~37). Pero **cold-2 no completó**, y falló en una hoja que cold-1 había pasado, sin
cambio de código entre ambas.

Por *No-Go criterion 6* (`A03 alterna entre corridas: no actualizar baseline`), el contrato A03
**queda intacto**. `DRIFT_COUNT` no pudo calcularse: la comparación exige dos corridas completas.

Pendiente: aislar `admin-clinics::w390x844`. La sospecha razonable es la activación de módulos
admin (flake conocido, `docs`/memoria del repo), no la capacidad — cold-1 pasó esa hoja y A05
cubre `admin-clinics` en los 13 viewports sin fallar —, pero **es una sospecha, no evidencia**.

## Zero Scroll

| Invariante | Garantía | Estado |
|---|---|---|
| `SCROLL_INTERNO_NO_AUTORIZADO = 0` | con pitch fijo `N·pitch + (N−1)·gap ≤ H` es exacto al evaluarse y permanece exacto | A05 completo `PASSED` |
| `ACCIONES_CRÍTICAS_VISIBLES = 100%` | el pager es reserva fuera del canvas medido; el defecto #2 era precisamente su violación, ahora imposible por content-box | A05 completo `PASSED` |
| `SCROLL_VERTICAL/HORIZONTAL = 0` | sin cambios de shell | `e2e:visual-contract` **NOT_RUN** |

## Performance (por evento de resize)

| Métrica | BEFORE | AFTER |
|---|---|---|
| ResizeObservers por superficie | 2 (hasta 4 targets) | **1** |
| MutationObservers | 1 (`subtree`) en 5 superficies | **0** |
| Targets observados | 1 + N filas (hasta 13) | **1** |
| Lecturas de layout | 1 + N `getBoundingClientRect` | **1 rect + 1 `getComputedStyle`** |
| DOM writes / `setPage` desde medición | presentes | **0** |
| Caché geométrica con estado | LRU de 16 + refs latcheados | **0** |
| Rearmado del efecto por cambio de pitch | sí | **no** (deps congeladas) |
| `A → B → A` | no determinista | **determinista** (15/15) |

## Validación

| Gate | Estado |
|---|---|
| `dashboard-capacity-engine.test.ts` (19) | `PASSED` |
| `dashboard-capacity-single-owner.test.ts` (13) | `PASSED` |
| A05 completo `--workers=2 --retries=0` | `PASSED` (15/15) |
| A05 3 hojas críticas `--repeat-each=3` | `PASSED` (9/9) |
| `pnpm test` (raíz) | `FAILED` — 5 fallos, **todos preexistentes**; 0 nuevos |
| `lint` / `typecheck` / `build` | `PASSED` |
| `security:public-surface` (post-build) | `PASSED` |
| `e2e:verify-catalog` | `PASSED` |
| `git diff --check` | `PASSED` |
| **A03 determinismo** | **`FAILED` — cold-2 no completó; baseline NO tocado** |
| `e2e:visual-contract` / `e2e:extended` / `e2e:admin-mobile` | `NOT_RUN` |
| `e2e:public-clinic` | `NOT_RUN` — 0 consumidores en superficie pública |

Suite raíz: `pass 4163 / fail 8` → `pass 4167 / fail 5`. Los 5 restantes leen archivos ausentes de
este diff (`StickyActionBar`, fixture A03, helper de matriz, `page.tsx` de logística, conteos del
catálogo E2E). Dos de los 7 preexistentes originales quedaron verdes como **efecto colateral
legítimo**: sus aserciones apuntaban a markup que este PR cambia (p. ej. un
`<div ref={setDesktopBodyNode} className="min-h-0 flex-1 py-2">` de una sola línea que nunca
casó con el JSX real), y `AGENTS.md` §4 exige realinear en el mismo PR el guard cuyo sujeto se
toca. No se tocó ninguno de los otros cinco.

## Rollback

`git revert` del commit restaura los tres hooks, el calibrador y los 17 consumidores a la vez. Sin
cambios de datos, esquema ni migración; contrato HTTP intacto (`limit` conserva semántica); sin
dependencias ni lockfile; sin workflows.

## Riesgos residuales

| # | Riesgo | Severidad | Nota |
|---|---|---|---|
| R1 | **A03 sin determinismo demostrado** | **Alta** | Baseline intacto por protocolo. Reproducir `admin-clinics::w390x844` antes de cerrar |
| R2 | Cohortes Zero Scroll no ejecutadas | Media | El contrato se argumenta por A05 completo, no por los specs visuales |
| R3 | El pitch-lock cambia densidad (truncado accesible) | Media | Autorizado (R1 del roadmap). A05 verde en 15 módulos × 13 viewports |
| R4 | Tiers deben seguir siendo literales `px` | Baja | Fijado por guard de arquitectura |
| R5 | 5 fallos preexistentes en `pnpm test` | Media | Fuera de scope (§4); reportados, no corregidos |
