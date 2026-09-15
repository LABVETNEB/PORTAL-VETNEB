# E2E-GLOBAL-09 — Performance de la matriz canónica

Fase `E2E-GLOBAL-09` del programa `LIMPIEZA E2E` (`docs/audit/LIMPIEZA E2E.md` §24, problema §16.5 /
R-15). Cambio test-only: A02 y A08 pasan de una navegación por viewport a **una navegación por
superficie → 13 mediciones por resize**, y el intervalo de muestreo de 80 ms de A02 se reemplaza por una
frontera causal (render drenado + tráfico de datos). Sin cambios de producto, fixture, catálogo,
baselines ni tolerancias.

## Estado base

| Ítem | Valor |
|---|---|
| Rama | `test/e2e-global-09-canonical-matrix-performance` |
| HEAD base | `b1855b5cac1364fd1dbe6310818f7ed780495697` (`test(e2e): remove residual timing-based synchronization (#1727)`) |
| `origin/main` remoto (`git ls-remote`) | `b1855b5c` (= HEAD; 0 ahead / 0 behind) |
| Working tree inicial | `?? frontend/AGENTS.md`, `?? frontend/CLAUDE.md` (generados por `next dev`, no tocados); 5 stashes preexistentes, no tocados |
| `AGENTS.md` aplicables | sólo el raíz (único tracked) |
| Clasificación | R1 (edición local test-only in-scope) |
| Scope primario (`pr-governance`) | `frontend` (`frontend/e2e/**`); `test/**` y `docs/**` son soporte → sin mixed-scope |
| Entorno de medición local | Windows 11, Chromium de Playwright 1.63.0, production runner (`next start`, build con el env de CI), `--workers=2`, `--retries=0`, `--trace=off` |

## Scope

Incluido: `frontend/e2e/helpers/dashboard-geometry-matrix.ts` (primitivas causales y muestreo de A02),
`frontend/e2e/regression/dashboard-geometry-baseline.spec.ts` (A02),
`frontend/e2e/regression/dashboard-zero-scroll-baseline.spec.ts` (A08),
`test/architecture/e2e-residual-determinism.test.ts` (allowlist reducida) y este documento.

Excluido (deliberadamente): `frontend/src/**`, backend, DB, auth/cookies, `package.json`,
`pnpm-lock.yaml`, workflows, `frontend/e2e/suites/catalog.ts`, fixtures y baselines,
`docs/audit/LIMPIEZA E2E.md`, `E2E-GLOBAL-10`. Consumidores censados y no modificados, con motivo, en
*Decisiones por consumidor*.

## Skills utilizadas

| Skill | Estado | Uso |
|---|---|---|
| `vetneb-briefing-planificacion-diseno-desarrollo-pruebas` | APPLIED | scope/no-scope, criterios de aceptación, matriz de validación |
| `vetneb-production-web-optimization-engineer` | APPLIED | diagnóstico antes de implementar (lectura del motor de capacidad y de los refetch de producto), medir antes/después, cambio mínimo |
| `vetneb-web-end-to-end-global` | APPLIED | censo transversal admin/clínica de las 21 superficies y sus consumidores |

## Censo BEFORE — consumidores reales de `dashboard-geometry-matrix.ts`

`git grep -l dashboard-geometry-matrix` sobre tracked (el roadmap decía 14; se recalculó). Tests =
discovery de Playwright en `b1855b5c`. Navegaciones = `page.goto` ejecutados por corrida.

| Consumidor | Importa | Superficies × viewports | Tests | Navegaciones/corrida | `networkidle` | `waitForLayoutSettled` | `measureSurfaceGeometry` | Cohorte | Required | Navega por viewport | Hot resize | Muta estado entre mediciones |
|---|---|---|---:|---:|---:|---:|---:|---|---|---|---|---|
| A02 `dashboard-geometry-baseline` | matriz completa + comparador | 21 × 13 | 21 | 273 | 1 (por viewport) | 1 | 1 | extended | no | sí | no | no |
| A08 `dashboard-zero-scroll-baseline` | matriz + loaded-state | 21 × 13 | 21 | 273 | 1 (por viewport) | 1 | 0 | visual-contract (ci) | **sí** | sí | no | no |
| B06 `dashboard-b06-workspace-app-bar` | matriz + mocks | 21 × 13 + 21 × 2 dark + 2 | 24 | 317 | 0 | 2 | 0 | visual-contract (ci) | sí | sí | no | no |
| B04 `dashboard-b04-surface-token-migration` | matriz + chrome | 21 × 2 temas × 2 | 21 | 84 (contexto nuevo por estado) | 1 | 1 | 0 | visual-contract (ci) | sí | sí (contexto por tema) | no | tema pre-paint |
| B05 `dashboard-b05-surface-inversion` | matriz + mocks | 7 × 2 temas × 1–2 | 7 | ≤ 28 (contexto por estado) | 1 | 1 | 0 | visual-contract (ci) | sí | sí (contexto por tema) | no | abre filtros |
| B08 `dashboard-b08-navigation-migration` | matriz + tipos | 4 representantes × 7 sondas + interacción | 16 | ≥ 28 (escalera) + 1 por test de interacción | 0 | 3 | 0 | visual-contract (ci) | sí | sí (escalera) | no | clics, historial |
| B10 `dashboard-b10-clinic-shell-unification` | matriz | 6 rutas × 3 sondas + historial | 36 | ≥ 36 (1 o más por test) | 1 | 2 | 0 | visual-contract (ci) | sí | test por combinación | no | reload/back |
| B11 `dashboard-b11-workspace-header` | matriz | 2 × 2 | 4 | 4 | 1 | 1 | 0 | visual-contract (ci) | sí | test por combinación | no | no |
| B12 `dashboard-b12-module-card-removal` | matriz | 15 × 2 | 30 | 30 | 1 | 1 | 0 | visual-contract (ci) | sí | test por combinación | no | no |
| B14 `dashboard-b14-metrics-relocation` | matriz | 5 superficies, 3 tests | 3 | ~8 | 1 | 1 | 0 | admin-mobile (ci) | sí | por superficie | no | no |
| A03 `dashboard-adaptive-limit-baseline` (vía `dashboard-adaptive-limit-matrix.ts`) | `DASHBOARD_GEOMETRY_VIEWPORTS` | 15 × 13 (234 hojas) | 16 | 234 + página 2 | 2 (helper) | 0 | 0 | extended | no | sí | no | pagina a 2 |
| A05 `dashboard-limit-invariance` | `DASHBOARD_GEOMETRY_VIEWPORTS` | 15 × 13 (234 hojas) | 15 | 234 + página 2 | 2 | 0 | 0 | extended | no | sí (vía `observeLeaf`) | **sí (A→B→A)** | control interno 32/48/64 |
| `admin-tokens-mobile-toolbar-layout` | `DASHBOARD_GEOMETRY_VIEWPORTS` | ventana inicial × 13 | 13 | 5 | 0 | 0 | 0 | admin-mobile (ci) | sí | por test | parcial | crea token |
| `dashboard-clinic-metric-run-parity` (CMP-05) | `waitForLayoutSettled` | 10 × 6 | 60 | 60 | 0 | 2 | 0 | public-clinic (ci) | sí | test por combinación | no | no |
| `fixtures/dashboard-geometry-baseline.ts` | tipos | — | — | — | — | — | — | — | — | — | — | — |
| `dashboard-detail-text-integrity` | **ninguno** (sólo un comentario) | — | 35 | — | — | — | — | visual-contract | — | — | — | — |

`test/architecture/dashboard-b04-*`, `dashboard-b06-*` y `e2e-residual-determinism` sólo leen el
fuente. Los dos consumidores de `mobile-parity-matrix.ts` son CMP-12
(`clinic-mobile-admin-parity-contract`, único usuario de `measureSettledParityContract`, 60 tests, 120
navegaciones) y el comentario de CMP-05; además lo importa a nivel node
`test/architecture/clinic-mobile-admin-parity-census.test.ts`.

### Coste BEFORE en CI (Linux, production runner, run `34978116640`, 1.333 tests)

Trabajo agregado del catálogo: **54,3 min** (wall 27,5 min, 2 workers; el roadmap histórico decía
64,6). Top de la matriz canónica: A05 15,00 · A03 5,34 · A02 5,11 · A08 3,61 · CMP-12 2,49 · B06 1,77 ·
B04 1,50 min.

## Modelo OLD

```text
por superficie (1 contexto):
  por cada viewport (13):
    setViewportSize → goto(route) → readiness → networkidle (primer idle del documento nuevo)
    → assertSurfaceLoaded → waitForLayoutSettled
    → A02: 3 lecturas idénticas, cada una tras fonts + 2 rAF + waitForTimeout(80), ≤ 24 intentos
    → A08: toPass sobre la lectura de zero-scroll
```

Perfil por combinación (medido en el experimento, 546 combinaciones frías):
`goto` 52 ms · readiness 26 ms · **`networkidle` 476 ms** · loaded 4 ms · settle 13 ms · bucle A02
332 ms. El coste de navegación dominante no es el `goto` sino la ventana de 500 ms de `networkidle` que
cada documento nuevo exige.

## Modelo NEW

```text
por superficie (1 contexto, 1 navegación):
  setViewportSize(viewport 0) → goto → readiness → networkidle (primer idle del ÚNICO documento)
  flight = trackDataRequests(page)          // fetch/xhr con eventos terminales
  por cada viewport:
    si no es el primero: resizeSurfaceViewport  // setViewportSize + inner size exacto + settleRenderAndData
    readiness → assertSurfaceLoaded → waitForLayoutSettled
    → A02: measureSurfaceGeometry(…, flight) // 3 lecturas idénticas, cada una tras un ciclo de render drenado
    → A08: toPass sin cambios
```

Primitivas nuevas (en `dashboard-geometry-matrix.ts`, sólo E2E):

| Primitiva | Frontera observable |
|---|---|
| `trackDataRequests(page)` | peticiones `fetch`/`xhr` iniciadas, terminadas (`requestfinished`/`requestfailed`) y en vuelo; `waitForIdle` resuelve en el evento terminal, falla a los 30 s con la lista pendiente |
| `waitForRenderQuiescence(page, label, roots)` | `document.fonts.ready` + 3 frames consecutivos sin `MutationObserver` (documento), sin `ResizeObserver` (html, body, `main`, raíz de la superficie, canvas adaptativos) y sin animación finita corriendo; presupuesto de 600 frames, luego lanza |
| `settleRenderAndData(page, flight, label, roots)` | render quieto **y** ninguna petición iniciada o terminada durante ese ciclo **y** nada en vuelo; ≤ 8 ciclos, luego lanza |
| `resizeSurfaceViewport(page, surface, viewport, flight)` | `window.innerWidth/innerHeight` exactos al destino + `settleRenderAndData` |
| `measureSurfaceGeometry(page, surface, viewport, flight)` | mismo contrato (3 lecturas idénticas, ≤ 24) con `waitForRenderQuiescence` entre lecturas; una lectura cuyo ciclo cruzó una frontera de datos reinicia la cuenta desde un estado asentado |

Invariantes preservados: cada superficie es su propio test/contexto (no hereda estado de otra); los
loaded/error/loading markers, el comparador, las tolerancias y los 273 keys no cambian; A08 conserva
`MAX_SCROLL_DELTA_PX = 0`.

## Evidencia de equivalencia

### Diseño

Arnés temporal **fuera del repo** (scratchpad del sistema, config Playwright propia apuntando al
production runner del repo). Importa la matriz canónica real y una copia generada del helper con las
primitivas candidatas. Para cada una de las 21 superficies y cada modo, en un contexto nuevo:

| Modo | Orden de viewports | Qué hace |
|---|---|---|
| `cold` | canónico | exactamente el modelo OLD (una navegación por viewport) |
| `hot-canonical` | 0→12 | una navegación + resize drenado |
| `hot-reverse` | 12→0 | ídem, orden inverso |
| `hot-permuted` | 0,12,1,11,2,10,3,9,4,8,5,7,6 | ídem, saltos máximos cruzando breakpoints en ambos sentidos |
| `hot-frames` *(control)* | permutado | resize + sólo `fonts` + 2 rAF, una lectura |
| `hot-unsettled` *(control)* | permutado | resize y lectura inmediata |

En cada punto se midió con el bucle OLD de 80 ms (copia lógica exacta, instrumentada para contar
reinicios) **y** con el bucle causal, alternando cuál va primero por viewport; además la lectura de
zero-scroll de A08 y la del app bar de B06. Comparación con `compareGeometryRecords` (tolerancias
vigentes) **y** con igualdad exacta métrica a métrica.

### Resultado (2 rondas: 4 workers y 2 workers)

| Comparación | Combinaciones | Fuera de tolerancia | Distintas en exacto |
|---|---:|---:|---:|
| cold r1 vs cold r2 (control de ruido) | 273 × 2 muestreos | 0 | 0 |
| cold vs hot-canonical (r1, r2) | 546 × 2 | 0 | 0 |
| cold vs hot-reverse (r1, r2) | 546 × 2 | 0 | 0 |
| cold vs hot-permuted (r1, r2) | 546 × 2 | 0 | 0 |
| zero-scroll A08, cold vs hot (3 órdenes × 2 rondas) | 1.638 | — | 0 |
| app bar B06, cold vs hot | 1.638 | — | 0 |
| bucle 80 ms vs bucle causal (mismos estados) | 2.184 | 0 | 0 |
| **control** `hot-frames` | 273 | **14** | 14 |
| **control** `hot-unsettled` | 273 | **252** | 252 (+126 zero-scroll, +210 app bar) |

Reinicios observados: bucle 80 ms 0, bucle causal 0 (ni por geometría ni por frontera de datos).

Los controles prueban que el experimento es sensible: leer justo tras el resize difiere en 252/252
transiciones, y leer tras fonts + 2 frames todavía difiere en 14 — todas en `admin-clinicas` y
`admin-sesiones` (`regions.collection.height`/`derived.collectionCanvasHeight`, deltas de 36 a 252 px):
su refetch paginado (`GET /api/admin/clinics`, `GET /api/admin/sessions`) sigue en vuelo y el canvas aún
pinta la página del viewport anterior. El drenado de datos + render es necesario, no decorativo.

### Hallazgos

- **Path dependence:** ninguna. Canónico, inverso y permutado producen registros idénticos entre sí y a
  la navegación fría, en ambas rondas y concurrencias.
- **Fronteras de request:** los únicos refetch disparados por resize dentro de la matriz son los de
  capacidad (ResizeObserver → rAF → render → efecto → fetch). El motor
  (`useDashboardCanvasCapacity`) no usa temporizadores; los `setTimeout` de producto (búsqueda con
  debounce de 300 ms, polling de notificaciones 30 s, versión 60 s) no se disparan por resize.
- **Generaciones de layout:** la señal observable que cierra el ciclo es la ausencia de mutaciones y de
  resize en tres frames seguidos, acoplada a la ausencia de tráfico de datos durante ese ciclo.
- **Intervalo de 80 ms (A02):** reemplazado. No aporta ahorro (~330 ms por medición en ambos casos) sino
  una frontera observable estrictamente más fuerte ante vuelos largos: el bucle de 80 ms podía aceptar
  tres lecturas iguales durante un vuelo de más de ~350 ms; el causal no.
- **Intervalo de 80 ms (CMP-12, `mobile-parity-matrix.ts`):** evaluado con el mismo arnés sobre sus 60
  combinaciones × 2 roles (120 contratos): 120/120 idénticos entre bucle de 80 ms y bucle causal, 0
  reinicios. **No se cambió**: el helper lo importa a nivel node
  `test/architecture/clinic-mobile-admin-parity-census.test.ts` con `--experimental-strip-types`, que no
  resuelve imports relativos sin extensión (verificado con Node 24.14.1) y el `tsconfig` del frontend no
  admite imports con `.ts`; migrarlo exige duplicar las primitivas dentro del helper. CMP-12 navega por
  test (60 tests), así que el modelo de una navegación no le aplica. La excepción queda en el guard con
  este motivo.

## Decisiones por consumidor

| Consumidor | Decisión | Motivo |
|---|---|---|
| A02 | **una navegación → 13 mediciones** + muestreo causal | equivalencia 273/273 en 3 órdenes; mayor ahorro de la matriz |
| A08 | **una navegación → 13 mediciones** | equivalencia exacta de las 6 deltas + `overflow-y`; mayor ahorro relativo del gate required |
| B06 | sin cambios | su readiness no espera datos: 135 ms por combinación en frío local; el camino caliente (~130 ms + primer idle) no ahorra. Equivalencia medida (0 diffs) disponible si CI demuestra lo contrario |
| B04, B05 | sin cambios | contexto nuevo por estado porque el tema se escribe pre-paint |
| B08, B10, B11, B12, B14, CMP-05, admin-tokens | sin cambios | una navegación por test/sonda; fusionarlos cambiaría la cantidad y los IDs de tests |
| A03 | sin cambios | observa una transición a página 2 por hoja; su `networkidle` residual queda fuera |
| A05 | sin cambios, **KEEP_13** | ver *Cardinalidad A05* |
| CMP-12 | sin cambios | ver hallazgo del intervalo de 80 ms |

## Cardinalidad A05

Fuente: las 1.170 observaciones `[A05 observation]` (234 hojas × 32/48/64/hot-b/hot-a) del run Linux
`34978116640`, más la geometría del contrato. Lectura en el escenario 64 px. "Límite único por hoja" =
hojas cuyo `LIMIT` en ese viewport no se repite en ningún otro viewport.

| Viewport | Ancho | Alto | Régimen | Límite (mín–máx, Σ 18 hojas) | Reserva del pager (px) | Canvas (px) | Límite único por hoja | Vector de límites idéntico a | Vector de canvas idéntico a |
|---|---:|---:|---|---|---|---|---:|---|---|
| w1920x1080 | 1920 | 1080 | drawer ≥1280 | 2–20 (Σ232) | 34,469 / 43,188 | 520,5–806,2 | 10/18 | ninguno | ninguno |
| w1600x900 | 1600 | 900 | drawer ≥1280 | 2–15 (Σ176) | 33,391 / 36 / 40 | 350,4–635,1 | 1/18 | ninguno | ninguno |
| w1440x900 | 1440 | 900 | drawer ≥1280 | 2–16 (Σ178) | 33,391 / 36 / 40 | 352,0–636,7 | 1/18 | ninguno | ninguno |
| w1366x768 | 1366 | 768 | drawer ≥1280 | 1–12 (Σ134) | 32,594 / 36 / 40 | 228,0–513,6 | 0/18 | ninguno | ninguno |
| w1280x720 | 1280 | 720 | drawer ≥1280 (borde inferior) | 1–11 (Σ124) | 32,313 / 36 / 40 | 176,5–458,9 | 7/18 | ninguno | ninguno |
| w1024x768 | 1024 | 768 | rail 768–1279 | 1–12 (Σ134) | 32,594 / 36 / 40 | 234,3–519,8 | 1/18 | ninguno | ninguno |
| w834x1194 | 834 | 1194 | rail (tablet alto) | 3–23 (Σ251) | 35,156 / 44 | 295,5–931,1 | 14/18 | ninguno | ninguno |
| w768x1024 | 768 | 1024 | rail (borde `md`) | 2–19 (Σ195) | 34,141 / 40,953 | 215,0–767,1 | 9/18 | ninguno | ninguno |
| w430x932 | 430 | 932 | mobile <768 | 4–16 (Σ232) | 37,266 / 40 | 240,2–723,3 | 2/18 | ninguno | ninguno |
| w412x915 | 412 | 915 | mobile | 4–16 (Σ228) | 36,594 / 40 | 231,8–706,5 | 1/18 | ninguno | ninguno |
| w390x844 | 390 | 844 | mobile | 3–14 (Σ198) | 36 / 40 | 179,7–635,7 | 8/18 | ninguno | ninguno |
| w375x812 | 375 | 812 | mobile | 3–13 (Σ185) | 36 / 40 | 163,8–603,8 | 0/18 | ninguno | ninguno |
| w360x800 | 360 | 800 | mobile (extremo) | 3–13 (Σ183) | 36 / 40 | 157,9–592,0 | 1/18 | ninguno | ninguno |

Respuestas:

1. Estados geométricos/de capacidad distintos: **13**. Ningún par de viewports produce el mismo vector
   de límites ni el mismo vector de block-size del canvas sobre las 18 hojas.
2. Cruzan breakpoints: 1280→1024 (drawer→rail) y 768→430 (rail→mobile); 1280 y 768 son los bordes.
3. Mismo ancho distinta altura: no hay en la matriz; misma altura distinto ancho: 1366×768 vs 1024×768
   (cambia de régimen y difiere en límite de al menos una hoja).
4. Cambios de capacidad: los 13 (vectores únicos). 1366×768 y 375×812 no tienen un límite exclusivo por
   hoja, pero coinciden con viewports **distintos** según la hoja, y su canvas difiere en todas: la
   distancia del canvas al siguiente múltiplo del pitch, que es lo que la invarianza 32/48/64 pone a
   prueba, no se repite.
5. Boundary cases: 1280×720 (altura mínima desktop), 768×1024 (borde `md`), 360×800 (extremo), 834×1194
   (máximo de filas).
6. Redundantes para A05: **ninguno demostrable**. Además `hotViewport` es el viewport siguiente: quitar
   uno cambia también el par A→B de su vecino.

Decisión: **KEEP_13**. A05 no se modificó; la reducción no se intenta por rendimiento.

## `networkidle` afectado

| Ubicación | Clasificación |
|---|---|
| A02 `dashboard-geometry-baseline.spec.ts` (1 sitio, ahora 21 ejecuciones en vez de 273) | `LEGITIMATE_FIRST_DOCUMENT_IDLE` |
| A08 `dashboard-zero-scroll-baseline.spec.ts` (1 sitio, 21 ejecuciones) | `LEGITIMATE_FIRST_DOCUMENT_IDLE` |
| Viewports 2..13 de A02/A08 (antes un `networkidle` por documento nuevo) | `CAUSAL_REPLACED` (`trackDataRequests` + `settleRenderAndData`) |
| A05 `dashboard-limit-invariance.spec.ts:413` | `LEGITIMATE_FIRST_DOCUMENT_IDLE` (sin cambios) |
| A05 `dashboard-limit-invariance.spec.ts:306` (no-op probado en GLOBAL-08) | `UNCHANGED_OUT_OF_SCOPE`: A05 no se tocó; retirarlo no ahorra tiempo (resuelve al instante) y exige la prueba dirigida de peticiones tardías sobre A05 |
| A03 `dashboard-adaptive-limit-matrix.ts:1648,1770` | `UNCHANGED_OUT_OF_SCOPE`: el camino A03 no se tocó |
| B04, B05, B10, B11, B12, B14 | `LEGITIMATE_FIRST_DOCUMENT_IDLE` (sin cambios) |

Líneas con `networkidle` en `frontend/e2e` (`git grep -c`, comentarios incluidos): 25 BEFORE, 25 AFTER.

## Cambios por archivo

- `frontend/e2e/helpers/dashboard-geometry-matrix.ts`: `DataRequestFlight`, `trackDataRequests`,
  `surfaceMeasurementRoots`, `waitForRenderQuiescence`, `settleRenderAndData`,
  `resizeSurfaceViewport`; `measureSurfaceGeometry` recibe el `flight` y muestrea sobre ciclos drenados
  (retirado `waitForTimeout(80)`). Superficies, viewports, mocks, loaded-state, selectores, comparador y
  tolerancias intactos.
- `frontend/e2e/regression/dashboard-geometry-baseline.spec.ts` (A02) y
  `frontend/e2e/regression/dashboard-zero-scroll-baseline.spec.ts` (A08): una navegación por superficie,
  resize drenado para los viewports siguientes, `flight.dispose()` en `finally`. Aserciones, conteos
  fail-closed, adjuntos y modo captura intactos.
- `test/architecture/e2e-residual-determinism.test.ts`: `wait-for-timeout` permitido sólo en
  `mobile-parity-matrix.ts` (1); prueba en memoria del crecimiento realineada a ese helper; prueba nueva
  que rechaza el retorno del intervalo en `dashboard-geometry-matrix.ts`.
- Este documento.

## Guard

`waitForTimeout(` en `frontend/e2e`: BEFORE 2 (geometry + parity) → AFTER 1 (parity, motivo arriba).

**Prueba negativa en disco:** se añadió `// global09-guard-probe: await page.waitForTimeout(80);` al
final de `dashboard-geometry-matrix.ts` → guard exit 1 con
`wait-for-timeout frontend/e2e/helpers/dashboard-geometry-matrix.ts: found 1, allowed 0`; se retiró esa
línea con una edición puntual → guard 2/2 PASSED y 0 ocurrencias del marcador.

## Paridad de discovery y catálogo

| Ítem | BEFORE | AFTER |
|---|---|---|
| `playwright test --list --reporter=json` | 1.334 tests / 98 archivos / 0 errores; hash de IDs (archivo › títulos › proyecto) `02f727b3…8318` | 1.334 / 98 / 0; hash de IDs idéntico `02f727b3…8318` |
| Cohortes (`E2E_COHORT_SPECS` + current + catálogo) | ci 66, extended 27, evidence 2, visual-linux 3, full 98; hash `8bb3f212…7f8e` | hash idéntico; `catalog.ts` sin cambios |
| `e2e:verify-catalog` | 7/7 | 7/7 |

## Benchmark

Local, production runner, `--workers=2`, 3 observaciones por fila (desviación < 1 %).

| Métrica | BEFORE | AFTER | Delta | Tipo |
|---|---:|---:|---:|---|
| Navegaciones matriz canónica (A02 + A08) | 546 | 42 | −504 (−92 %) | OBSERVED (estático) |
| A02 trabajo (suma de tests) | 270,4 s (271,1 / 270,3 / 269,8) | 148,0 s (148,4 / 148,1 / 147,6) | −45 % | OBSERVED |
| A02 wall | 155,4 s | 90,4 s | −42 % | OBSERVED |
| A08 trabajo | 181,7 s (180,9 / 182,6 / 181,5) | 58,4 s (58,1 / 58,3 / 58,9) | −68 % | OBSERVED |
| A08 wall | 99,4 s | 36,3 s | −63 % | OBSERVED |
| B06 (sin cambios) trabajo | 43,7 s | 44,3 s | ≈ 0 | OBSERVED |
| A05 | no modificado | — | — | NOT_RUN |
| CMP-12 | no modificado | — | — | NOT_RUN |
| Subconjunto benchmark (A02 + A08 + B06) trabajo | 495,8 s | 250,7 s | −49 % | OBSERVED |
| A02 + A08 en `e2e:full` Linux (5,11 + 3,61 min) | 8,72 min | ~4,0 min | ~−4,7 min | INFERRED (ratios locales aplicados a CI) |
| `e2e:full` trabajo agregado | 54,3 min | ~49,6 min | ~−4,7 min | INFERRED |
| A08 dentro de `e2e:ci` (required) | 3,61 min | ~1,2 min | ~−2,4 min | INFERRED |
| Objetivo `<40 min` de `full` | — | — | — | CI-ONLY → `FULL_RUNTIME_TARGET: PENDING_CI_EVIDENCE` |

La proyección indica que esta fase sola no alcanza `<40 min`: el coste restante lo dominan A05
(15,0 min) y A03 (5,3 min), cuyo coste es la observación de página 2 por hoja, no la navegación de la
matriz.

**Salida idéntica BEFORE/AFTER sobre los tests reales:**

- A02 en win32 falla 21/21 antes y después por la deriva preexistente del baseline Windows (p. ej.
  topbar de teléfono 44→48 px; preexistente en `main`, no causada por esta fase). Las 2.434 líneas de
  deriva son **idénticas** (sha256 `d6aa087bcc1c6db0`) en las 3 corridas BEFORE y las 3 AFTER, y los 273
  registros medidos adjuntos también (sha256 `6ee53d92f049ef8b`).
- A08: 21/21 PASSED y los 273 registros de zero-scroll adjuntos idénticos (sha256 `0416e2ec3f26eefb`)
  en las 6 corridas.
- B06 (consumidor del helper, sin cambios): 273 registros idénticos (sha256 `c2fa863499413d40`).

## Validaciones

Runtime E2E: production runner local (`CI=true VETNEB_E2E_PRODUCTION_RUNNER=1`, build con el env de
CI), `--retries=0`, `--trace=off`, salida y reportes fuera del repo.

| Gate | Estado | Evidencia |
|---|---|---|
| G1 `node --test test/architecture/e2e-residual-determinism.test.ts` | PASSED | 2/2 |
| G1 prueba negativa del guard en disco | PASSED | exit 1 con la violación exacta → 2/2 tras retirar la línea |
| G1 arquitectura que ancla los archivos tocados (determinismo, B04, B06, censo CMP-12, catálogo, sesión/origen) | PASSED | 40/40 |
| G2 A02 `dashboard-geometry-baseline` (3 corridas, 2 workers) | FAILED (preexistente, idéntico a BEFORE) | 21/21 fallan en win32 antes y después por la deriva del baseline Windows; deriva y registros byte-idénticos a BEFORE; 0 flaky |
| G2 A08 `dashboard-zero-scroll-baseline` (3 corridas, 2 workers) | PASSED | 63/63; registros idénticos a BEFORE; 0 flaky |
| G3 A05 | NOT_RUN | no modificado (KEEP_13) |
| G4 CMP-12 | NOT_RUN | `mobile-parity-matrix.ts` no modificado (equivalencia medida en arnés: 120/120) |
| G5 estabilidad `--repeat-each=3 --workers=1` (A02 + A08 × admin-hub, admin-clinicas, admin-sesiones, admin-mantenimiento, clinic-informes, clinic-log-metricas) | PASSED (A08) / FAILED preexistente idéntico (A02) | A08 18/18; A02 18 fallos con las 2.145 líneas de deriva = BEFORE × 3; 0 flaky |
| G6 `pnpm --dir frontend lint` | PASSED | exit 0 |
| G6 `pnpm --dir frontend typecheck` | PASSED | exit 0 |
| G6 `pnpm --dir frontend build` (env de CI) | PASSED | exit 0 |
| G6 `pnpm security:public-surface` | PASSED | exit 0 (sólo hallazgos `server-only` preexistentes) |
| G7 `pnpm --dir frontend e2e:verify-catalog` | PASSED | 7/7 |
| G8 `pnpm --dir frontend e2e:visual-contract` (contiene A08, B04, B05, B06, B08, B10, B11, B12) | PASSED | 518 passed + 1 skipped declarado (B05 S7 `clinic-tokens`) = 519 del discovery |
| G8 consumidores restantes del helper: B14, `admin-tokens-mobile-toolbar-layout`, CMP-05 | PASSED | 76/76 |
| `pnpm typecheck:test` | PASSED | exit 0 |
| `pnpm test` | FAILED (ambiental) | 4.553 pass / 1 fail / 1 skipped; el único fallo es `e2e-global-03b-authoritative-auth-boundary.fastify.test.ts` (exige `DATABASE_URL`/`SUPABASE_DB_URL`, preexistente desde #1711); el guard pasa dentro de la corrida |
| G9 `e2e:full` | NOT_RUN | en Windows el preflight del runner rechaza las selecciones Linux-only; el objetivo de runtime se mide en `E2E Completeness` (Linux) |
| A03 | NOT_RUN | no modificado |
| Visual Linux | BLOCKED | specs autoexcluidos fuera de Linux; no modificados |

## Riesgos residuales

- **Cobertura de SSR por viewport:** A02/A08 ya no cargan en frío cada viewport; sólo el primero
  (1920×1080). La geometría y el zero-scroll asentados son idénticos (medido), pero un defecto que sólo
  aparezca en la primera pintura de un documento cargado en teléfono ya no lo detectarían A02/A08. Siguen
  cargando en frío por viewport de teléfono: B06, B11, B12, CMP-05, CMP-12, B10 y las suites
  `admin-mobile-*`.
- **Equivalencia cross-platform:** el experimento corrió en win32. Linux CI no se observó con el modelo
  nuevo; A02 Linux compara contra su baseline Linux en `E2E Completeness` y A08 corre en el gate required.
  Primera evidencia real: los runs de CI de este PR.
- **A08 (required):** una transición que no se asienta (render que nunca queda quieto 3 frames, petición
  colgada > 30 s) ahora aborta el test entero en vez de acumular la violación del viewport; falla visible,
  nunca verde.
- **Peticiones perpetuas:** una superficie futura con polling < 1 frame de quietud o un spinner con
  animación finita repetida haría fallar el drenado (fail-closed, mensaje con la lista pendiente).
- **Timers de producto:** un cambio de geometría programado con `setTimeout` sin actividad intermedia no es
  observable por ninguna de las dos estrategias; hoy ninguno se dispara por resize.
- **CMP-12** conserva `waitForTimeout(80)` (motivo documentado) y su `measureSettledParityContract` sigue
  devolviendo la última lectura sin fallar si no converge (preexistente).
- `next dev` crea `frontend/AGENTS.md` y `frontend/CLAUDE.md` untracked; no se incorporan ni se borran.

## Rollback

Revertir el commit. Sin migraciones, dependencias ni artefactos persistentes; producto, fixture, catálogo
y baselines intactos.

---

## Segunda pasada — A03/A05: `observeLeaf()` como preparación pagada dos veces

Objetivo: cerrar la brecha restante hacia `<40 min` sin tocar los 13 viewports de A05, sin debilitar
A03, sin eliminar A→B→A ni el contrato 32/48/64. Misma rama
(`test/e2e-global-09-canonical-matrix-performance`), mismo HEAD base
(`b1855b5cac1364fd1dbe6310818f7ed780495697`).

### B. Descomposición de dependencias de A05

`dashboard-limit-invariance.spec.ts:409` (antes de esta pasada) llamaba `await observeLeaf(...)` y
**descartaba el valor retornado** — confirmado en código (sin asignación) y en runtime (A05 nunca lee un
campo de `A03Observation`; su propia medición empieza recién después, con su propio `visibleCanvas` +
`trackPaginationFlight`). Descomposición de `observeLeaf()` (`dashboard-adaptive-limit-matrix.ts`):

| Etapa | Clasificación | Motivo |
|---|---|---|
| 1. navegación (`page.goto`) | `REQUIRED_BY_A05` | precondición de cualquier lectura |
| 2. `initialResponse` (si aplica) | `REQUIRED_BY_A05` | confirma que el rewrite/stub respondió antes de medir |
| 3. readiness | `REQUIRED_BY_A05` | idéntico para ambos contratos |
| 4. `leaf.prepare` | `REQUIRED_BY_A05` | estado representativo (p. ej. pestaña dry-run) |
| 5. primera fila visible | `REQUIRED_BY_A05` | sin datos no hay canvas que medir |
| 6. convergencia adaptativa (page 1) | `REQUIRED_BY_A05` | es la misma condición que hoy cierra el bucle de estabilidad de A05 |
| 7. confirmación de página 1 (por `source`) | `REQUIRED_BY_A05` | ver `PreparedLeafFirstPage` abajo — geometría de A05 depende de que la página 1 esté REAL, no en fallback |
| 8. transición a página 2 (click + espera) | `A03_ONLY_DUPLICATION` | A05 nunca pagina |
| 9. captura/validación de limit/offset/pageSize | `A03_ONLY_DUPLICATION` | exclusivo del contrato A03 |
| 10. validación de página 2 completa | `A03_ONLY_DUPLICATION` | ídem |
| 11. retorno `A03Observation` | `A03_ONLY_DUPLICATION` | A05 lo descarta hoy |

### C. Contrato de preparación de página 1

Extraído a `prepareLeafFirstPage(page, observer, leaf, viewportSlug): Promise<PreparedLeafFirstPage>` en
`dashboard-adaptive-limit-matrix.ts`, reutilizando exactamente las mismas primitivas que `observeLeaf()`
ya usaba (nada reescrito, sólo relocalizado):

- **`url-query`** (`logistics-bounded-canvas`, único consumidor): `page.waitForURL` a que el canvas
  acotado reemplace la URL con `offset=0` y un `limit` medido — la señal causal es el REPLACE de la URL
  que el propio runtime hace, nunca un idle — más una reconvergencia y la comprobación exacta
  `rows.count() === limit`.
- **`server-request`**: etiqueta de página 1 (si el leaf declara una) + `rows.count() > 0`. El
  `networkidle` "antes de página 2" de `observeServerRequestLeaf:1770` (drenar un request de página 1 que
  siga en vuelo antes de armar el listener de la transición) es **exclusivo de la transición de A03** y
  queda dentro de esa función — A05 ya no lo dispara.
- **`client-slice`**: etiqueta de página 1 (si aplica) + `networkidle` + reconvergencia — porque estos
  consumidores dimensionan su fetch desde la capacidad MEDIDA y el DOM puede verse convergido con ese
  fetch aún en vuelo (comentario original de `dashboard-adaptive-limit-matrix.ts`). Es el ÚNICO
  `networkidle` que emite esta preparación para ese documento, así que es una señal causal real, no una
  segunda comprobación contra un idle ya disparado (hallazgo de GLOBAL-08).

`observeLeaf()` pasa a ser `prepareLeafFirstPage()` + un despacho de 3 líneas a
`observeUrlQueryLeaf`/`observeServerRequestLeaf`/`observeClientSliceLeaf`, que ahora reciben el estado
preparado en vez de recalcularlo — sin reescribir su lógica de página 2. `mobile-parity-matrix.ts` no se
tocó (excepción ya documentada en la primera pasada).

### D. Equivalencia A03

A03 (`dashboard-adaptive-limit-baseline.spec.ts`, los 15 módulos + el agregador de integridad) corrió
2 veces ANTES del refactor y 1 vez DESPUÉS, production runner local:

| Corrida | Estado | Leaves | `a03-matrix-observations.json` sha256 |
|---|---|---:|---|
| before-r1 | 15/15 módulos PASSED, agregador FAILED (preexistente) | 234 | `7694920a480e78f6` |
| before-r2 | ídem | 234 | `7694920a480e78f6` |
| after-r1 | ídem | 234 | `7694920a480e78f6` |

Las 3 corridas son **byte-idénticas**. El único fallo (agregador, `assertMatchesBaseline`) es preexistente
y ajeno a esta fase: `admin-particular-tokens::w360x800` mide `limit/offset/secondPageCount = 11` contra
un baseline win32 congelado en `12` — coincide exactamente con la nota ya registrada ("A03 win32 12→11")
de una recaptura de main anterior a esta rama. A03 no cambió de output; el refactor es transparente para
su contrato.

### E. Equivalencia A05

`dashboard-limit-invariance.spec.ts` corrió 2 veces ANTES (con `observeLeaf()` completo, descartando el
retorno) y 3 veces DESPUÉS (con `prepareLeafFirstPage()`), production runner local, `--workers=2`,
`--retries=0`. Las 1.170 líneas `[A05 observation]` de cada corrida (234 leaves × 5 escenarios:
32/48/64/hot-b/hot-a) se compararon excluyendo `PAGINATION_REQUESTS`/`DATA_REQUESTS` (contadores
acumulados del propio `flight` tracker de A05, que un control mostró **no deterministas incluso entre dos
corridas BEFORE sin tocar código** — un hot resize dispara un número variable de refetches intermedios;
ninguna assertion de A05 depende de su valor absoluto). Sobre el resto — `CONTROL`, `PAGER_BLOCK_SIZE`,
`PAGER_COMPUTED_BLOCK_SIZE`, `PAGER_MIN_BLOCK_SIZE`, `PAGER_MAX_BLOCK_SIZE`, `PAGER_FLEX_BASIS`,
`ROWS_CANVAS_BLOCK_SIZE`, `LIMIT` — que es exactamente lo que las `expect()` de A05 comparan:

| Corrida | Estado | sha256 (1.170 líneas, contractual) |
|---|---|---|
| before-r1 | 15/15 PASSED | `4359db14…8680864` |
| before-r2 | 15/15 PASSED | `4359db14…8680864` |
| after-r1 | 15/15 PASSED | `4359db14…8680864` |
| after-r2 | 15/15 PASSED | `4359db14…8680864` |
| after-r3 | 15/15 PASSED | `4359db14…8680864` |

**Las 5 corridas son byte-idénticas** (hash SHA-256 completo, no truncado). `OLD_OUTPUT == NEW_OUTPUT`
para las 1.170 observaciones contractuales, en 5 corridas independientes. Confirma la hipótesis: la
lectura de capacidad de A05 no depende de qué página esté cargada, porque todos los datasets del fixture
están dimensionados muy por encima de cualquier capacidad de viewport — la página 1 está tan completa
como la página 2.

### F. Control negativo (sólo scratch, nunca commiteado)

Arnés temporal fuera del repo con dos variantes de una copia de `prepareLeafFirstPage`:

1. **Control grueso** (`omit-all-convergence`): omite también la convergencia compartida (no sólo el
   drenaje exclusivo de `client-slice`), con un delay artificial de 700 ms inyectado en cada
   `fetch`/`xhr` vía `page.route`. Sobre `clinic-logistica-summary` (client-slice, 5 viewports):
   **5/5 divergentes**, con deltas grandes y reales — p. ej. `w1920x1080`: roto lee `rowCount=3`
   (fallback), correcto lee `rowCount=15`. Sobre `admin-particular-tokens`: 0/5 divergentes — ese leaf en
   particular no expone un estado de fallback distinto (su readiness ya exige el dato real). Prueba que
   la metodología de comparación **sí detecta** una lectura prematura cuando existe.
2. **Control quirúrgico** (`omit-client-slice-drain`, la omisión que de verdad importaría si
   `prepareLeafFirstPage` estuviera mal escrita): mismo delay de 700 ms, mantiene la convergencia
   compartida y omite sólo el `networkidle` + reconvergencia exclusivos de `client-slice`. Sobre
   `clinic-logistica-summary` y `clinic-informes-summary` (5 viewports cada uno): **0/10 divergentes** —
   la convergencia compartida (con su `MutationObserver` sobre el contenedor) ya detecta la mutación que
   produce el fetch al resolver y fuerza otra vuelta del bucle, así que el paso extra es defensa en
   profundidad, no la única barrera. `clinic-particular-tokens` y `admin-maintenance` con el delay de
   700 ms superaron el timeout de readiness de 30 s (su primera pintura depende de datos reales; no es
   una incoherencia, es una precondición del leaf ajena a esta prueba) y se excluyeron del control.

Conclusión: el arnés SÍ distingue una preparación rota de una correcta (control grueso), y la preparación
real que se implementó (`prepareLeafFirstPage`, que conserva exactamente el paso `client-slice` que el
código original tenía) no depende únicamente de ese paso para ser correcta — coherente con las 5 corridas
reales byte-idénticas de la sección E.

### G. Performance A05 (BEFORE/AFTER, por módulo)

Local, production runner, `--workers=2`, promedio de 2 corridas BEFORE y 3 AFTER:

| Módulo | BEFORE | AFTER | Delta |
|---|---:|---:|---:|
| `logistics-bounded-canvas` (39 leaves, 3 variantes) | 110,98 s | 96,21 s | −14,77 s (−13,3 %) |
| `logistics-recent-list` (26 leaves, 2 variantes) | 73,58 s | 67,71 s | −5,87 s (−8,0 %) |
| `admin-pricing` | 47,40 s | 34,16 s | −13,24 s (−27,9 %) |
| `admin-sessions` | 41,71 s | 36,54 s | −5,17 s |
| `admin-clinics` | 41,24 s | 36,24 s | −5,00 s |
| `admin-users-roles` | 40,65 s | 35,87 s | −4,79 s |
| `admin-report-upload` | 40,55 s | 35,05 s | −5,50 s |
| `admin-maintenance` | 40,07 s | 36,96 s | −3,11 s |
| `clinic-particular-tokens` | 40,00 s | 37,11 s | −2,89 s |
| `informes-reports-list` | 39,74 s | 35,81 s | −3,93 s |
| `admin-failed-login-alerts` | 39,22 s | 34,77 s | −4,45 s |
| `admin-audit-log` | 38,36 s | 33,58 s | −4,78 s |
| `admin-particular-tokens` | 37,15 s | 34,58 s | −2,58 s |
| `clinic-informes-summary` | 36,65 s | 33,95 s | −2,70 s |
| `clinic-logistica-summary` | 36,20 s | 33,02 s | −3,18 s |
| **TOTAL (trabajo, suma de tests)** | **703,50 s** | **621,54 s** | **−81,96 s (−11,7 %)** |
| **Wall (2 workers)** | 387,0 s (386/388) | 345,3 s (343/348/345) | −41,7 s (−10,8 %) |

15 filas = 15 entradas de `A03_MODULE_IDS`, verificado sin duplicados.

El ahorro relativo es menor que en A02/A08 porque `prepareLeafFirstPage` sólo retira la transición de
página 2 (click + espera + validación); la navegación, el `readiness`, `leaf.prepare` y la convergencia de
página 1 — que ya eran necesarios para A05 — se conservan intactos, y el resto del costo de cada leaf (los
5 escenarios 32/48/64/hot-b/hot-a con sus propias convergencias) es el contrato mismo y no se tocó.

## H. Proyección de runtime total

| Métrica | BEFORE (roadmap) | AFTER primera pasada | AFTER segunda pasada | Tipo |
|---|---:|---:|---:|---|
| A02 (CI 5,11 min) | 5,11 min | 2,81 min | 2,81 min | INFERRED (ratio local aplicado a CI) |
| A08 (CI 3,61 min) | 3,61 min | 1,16 min | 1,16 min | INFERRED |
| A05 (CI 15,00 min) | 15,00 min | 15,00 min | 13,25 min | INFERRED |
| A03 (CI 5,34 min) | 5,34 min | 5,34 min | 5,34 min | OBSERVED (0 % de cambio, confirmado sección D) |
| Resto del catálogo | 25,24 min | 25,24 min | 25,24 min | sin tocar |
| **`e2e:full` trabajo agregado** | **54,30 min** | **~49,55 min** | **~47,80 min** | INFERRED |
| Objetivo `<40 min` | — | — | — | CI-ONLY → `FULL_RUNTIME_TARGET: PENDING_CI_EVIDENCE` |

La proyección tras esta segunda pasada (~47,8 min) sigue por encima de 40 min. El siguiente mayor costo
in-scope es A05 mismo (~13,25 min proyectados, el ítem más caro del catálogo) y, dentro de A05, lo que
queda es estructuralmente idéntico a lo que A02/A08 tenían ANTES de su propia optimización: una
navegación en frío por cada una de las 234 combinaciones (viewport, leaf), en vez de una navegación por
leaf y 13 mediciones por resize.

**Por qué esta fase no lo intenta:** A05 ya implementa su PROPIO mecanismo de transición caliente interno
(A→B→A, obligatorio por contrato) DENTRO de cada iteración del bucle externo. Convertir también el bucle
EXTERNO (por los 13 viewports) a navegación-por-resize exigiría reconciliar dos mecanismos de resize
anidados — cuál convergencia pertenece a cuál transición, si el estado que deja la excursión A→B→A
contamina el resize externo siguiente, y una prueba de equivalencia dedicada tan extensa como las de las
secciones D/E pero sobre una superficie de cambio mayor (el bucle completo de A05, no sólo su
preparación). Es un cambio de alcance y riesgo comparables al de A02/A08 en la primera pasada, no una
extensión trivial del patrón ya aplicado, y el mandato de esta pasada fue explícitamente la duplicación
`observeLeaf`/A03, no el modelo de navegación de A05. Queda identificado como el candidato para una fase
siguiente, no absorbido aquí.

## I. Estado A02/A08 (sin cambios en esta pasada)

Archivos de la primera pasada (`dashboard-geometry-matrix.ts`, `dashboard-geometry-baseline.spec.ts`,
`dashboard-zero-scroll-baseline.spec.ts`) no se tocaron en esta segunda pasada. Confirmación puntual
(1 corrida cada uno, production runner):

| Contrato | Resultado | Evidencia |
|---|---|---|
| A02 | FAILED (preexistente, idéntico) | 2.434 líneas de deriva sha256 `d6aa087bcc1c6db0` — igual a las 3 corridas de la primera pasada |
| A08 | PASSED | 273 registros sha256 `0416e2ec3f26eefb` — igual a las 6 corridas de la primera pasada |

## J. Guard (segunda pasada)

La excepción `waitForTimeout` de `dashboard-adaptive-limit-matrix.ts` no existía (nunca tuvo una): el
archivo no aparece en la allowlist de `e2e-residual-determinism.test.ts` ni antes ni después de esta
pasada, y mi extracción no introduce ninguna. El único cambio al guard fue en la primera pasada
(`GEOMETRY_MATRIX` retirado de la allowlist). No hubo cambios adicionales en esta pasada; se re-verificó
verde (33/33 incluyendo los 4 archivos de arquitectura que anclan los paths tocados).

## K. Validaciones (segunda pasada)

Production runner local (`CI=true VETNEB_E2E_PRODUCTION_RUNNER=1`), `--retries=0`, `--trace=off`.

| Gate | Estado | Evidencia |
|---|---|---|
| Guard determinismo + 3 tests de arquitectura que anclan los archivos tocados | PASSED | 33/33 |
| A03 dirigido (3 corridas: 2 before, 1 after) | FAILED (preexistente, idéntico) / 15 módulos PASSED | sha256 `7694920a480e78f6` en las 3 |
| A05 (2 before + 3 after) | PASSED | 15/15 en las 5; sha256 contractual completo idéntico en las 5 |
| A05 `--repeat-each=3 --workers=1` (logistics-bounded-canvas, clinic-logistica-summary, admin-clinics — el mayor delta y 2 fuentes distintas) | PASSED | 9/9, 0 flaky; 325 claves × 3 repeticiones, 0 discrepancias |
| Control negativo (scratch) | grueso: 5/5 divergente en superficie sensible; quirúrgico: 0/10 | ver sección F |
| A02/A08 confirmatorio (archivos sin cambios) | ver sección I | — |
| `pnpm --dir frontend lint` | PASSED | exit 0 |
| `pnpm --dir frontend typecheck` | PASSED | exit 0 |
| `pnpm --dir frontend build` (env CI) | PASSED | exit 0 |
| `pnpm security:public-surface` | PASSED | exit 0 (mismos 2 hallazgos `server-only` preexistentes) |
| `pnpm --dir frontend e2e:verify-catalog` | PASSED | 7/7 |
| Discovery `playwright test --list` | PASSED | 1.334/98/0, hash de IDs idéntico al inicio de la sesión |
| `catalog.ts` | sin cambios | `git diff --quiet` |
| `pnpm validate:local` | FAILED (ambiental) | 4.553 pass / 1 fail / 1 skipped; único fallo `e2e-global-03b-authoritative-auth-boundary.fastify.test.ts` (exige `DATABASE_URL`/`SUPABASE_DB_URL`, preexistente desde #1711); reproducido de forma limpia tras revertir una regeneración transitoria de `next-env.d.ts` causada por una corrida previa en modo `next dev` del arnés de control negativo — el archivo ya estaba correcto antes de la corrida limpia, `git diff` sobre él vacío |
| `visual-contract` | NOT_APPLICABLE | ningún archivo tocado en esta pasada pertenece a esa cohorte (A03/A05 son `extended`); ya cubierto por A03/A05 dirigidos arriba |
| `e2e:full` | NOT_RUN | Windows rechaza las selecciones Linux-only; el objetivo se mide en `E2E Completeness` |

## L. Riesgos residuales (segunda pasada)

- Igual que la primera pasada (sección "Riesgos residuales" arriba), más: A05 sigue navegando en frío por
  cada una de las 234 combinaciones — es la brecha identificada para una fase futura (sección H).
- `next-env.d.ts`: una corrida del arnés de control negativo en modo `next dev` regeneró el archivo hacia
  la ruta de desarrollo entre medio de esta sesión; se detectó por el fallo de
  `next-env-hygiene.test.ts` dentro de `pnpm validate:local`, se confirmó que el archivo ya estaba
  correcto al momento de re-ejecutar y la corrida limpia subsiguiente fue PASSED. No se editó el archivo
  manualmente en ningún momento.
- Ejecutar dos invocaciones de Playwright en paralelo (`validate:local` y la confirmación A02/A08)
  produjo el falso positivo anterior; evitado en el resto de la sesión corriendo secuencialmente.

## Rollback (ambas pasadas)

Revertir el commit. Sin migraciones, dependencias ni artefactos persistentes; producto, fixture, catálogo
y baselines intactos.

## Estado final

GLOBAL-09 implementado en dos pasadas. Primera: A02/A08 a una navegación por superficie. Segunda:
`observeLeaf()` (A03) separado de una preparación de página 1 reutilizable
(`prepareLeafFirstPage`), consumida también por A05, que deja de pagar la transición de página 2 que su
propio contrato nunca leía. Equivalencia demostrada con salida byte-idéntica en A02 (deriva preexistente
incluida), A08, A03 y A05 (5 corridas), control negativo que confirma la sensibilidad del método, y 0
flaky en la validación de estabilidad. A05 conserva sus 13 viewports (`KEEP_13`), su contrato 32/48/64 y
su ciclo A→B→A intactos. Proyección de `e2e:full`: ~54,3 → ~47,8 min de trabajo agregado — **por encima**
de 40 min. El próximo mayor costo in-scope (A05 a navegación-por-resize) queda identificado, no
implementado: es un cambio de alcance comparable al de A02/A08, con su propio mecanismo de transición
caliente interno que reconciliar, fuera del mandato explícito de esta pasada.
`FULL_RUNTIME_TARGET: PENDING_CI_EVIDENCE`. Git/GitHub (stage, commit, push, PR) queda a cargo de Nico.
