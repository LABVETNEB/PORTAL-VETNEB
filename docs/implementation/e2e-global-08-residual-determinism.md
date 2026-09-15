# E2E-GLOBAL-08 — Determinismo residual

Fase `E2E-GLOBAL-08` del programa `LIMPIEZA E2E` (`docs/audit/LIMPIEZA E2E.md` §24). Problema P2-6
(flakiness latente). Cambio test-only: la sincronización E2E basada en tiempo pasa a esperar una
condición observable, sin alterar aserciones, fixtures, catálogo ni producto.

## Estado base

| Ítem | Valor |
|---|---|
| Rama | `test/e2e-global-08-residual-determinism` |
| HEAD base | `221b70ba8a614b8d572dd095e55408bf93eb6aba` (`test(e2e): centralize session setup and origin (#1726)`) |
| `origin/main` remoto (`git ls-remote`) | `221b70ba` (= HEAD; 0 ahead / 0 behind) |
| Working tree inicial | limpio (5 stashes preexistentes, no tocados) |
| `AGENTS.md` aplicables | sólo el raíz (único tracked) |
| Clasificación | R1 (edición local test-only in-scope) |
| Scope primario (`pr-governance`) | `frontend` (`frontend/e2e/**`); `test/**` y `docs/**` son soporte → sin mixed-scope |

## Scope

Incluido: specs y helpers de `frontend/e2e/**` con esperas temporales, `networkidle` sin contrato
causal o esperas silenciadas; helper nuevo `frontend/e2e/helpers/informes-adaptive-settle.ts`; guard
nuevo `test/architecture/e2e-residual-determinism.test.ts`; este documento.

Excluido (deliberadamente): `frontend/src/**`, `server/**`, DB, auth/cookies productivas,
`package.json`, `pnpm-lock.yaml`, workflows, snapshots, `frontend/e2e/suites/catalog.ts`, datos y
semántica del fixture, `docs/audit/LIMPIEZA E2E.md`, y `E2E-GLOBAL-09+` (incluidos
`dashboard-geometry-matrix.ts` y `mobile-parity-matrix.ts`, ver *Excepciones*).

## Skills utilizadas

| Skill | Estado | Uso |
|---|---|---|
| `vetneb-web-end-to-end-global` | APPLIED | censo transversal (admin, clínica, público, platform, regression, helpers, visual); runtime por familia |
| `vetneb-briefing-planificacion-diseno-desarrollo-pruebas` | APPLIED | scope/no-scope, matriz espera → causa → señal → test, gates mínimos |
| `vetneb-production-web-optimization-engineer` | APPLIED | diagnóstico previo (lectura de producto y del runtime de Playwright), cambio mínimo, reutilizar `waitForAdaptiveConvergence` antes de crear helpers |
| `vetneb-bugs-errores-optimizacion-rutas` | CONDITIONAL → APPLIED | redirect `/login`, fallback pre-hidratación, refetch por Server Action de informes |
| `vetneb-security-production-invariants` | CONDITIONAL → APPLIED | `dashboard-auth-redirect`: sin tocar sesión, cookies ni auth |

## Hallazgo de runtime que condiciona la clasificación

`waitForLoadState("networkidle")` **no drena peticiones iniciadas después de que el documento ya
alcanzó idle una vez**. En Playwright 1.63.0 (`playwright-core/lib/coreBundle.js`),
`_inflightRequestStarted` sólo llama a `_stopNetworkIdleTimer()` y no retira el evento `networkidle`
ya disparado; `_startNetworkIdleTimer()` retorna si el evento ya existe. Sólo se limpia al commit de
un documento nuevo. Prueba empírica (script de scratchpad, `page.route` sin servidor): primer
`networkidle` tras `goto` = 510 ms; con un fetch de 3 s en vuelo después de ese idle,
`waitForLoadState("networkidle")` resolvió en **0 ms**.

Consecuencia: `networkidle` sólo es una señal real como **primer idle tras una navegación**. Tras una
interacción o dentro de un bucle es un no-op.

## Censo BEFORE (HEAD `221b70ba`)

Recalculado con un script reproducible sobre `git ls-files frontend/e2e` (115 archivos `.ts/.mjs`).
Las cifras históricas del roadmap (17 / 3 / 39) no se reutilizaron.

| Patrón | Histórico | BEFORE (ocurrencias / archivos) |
|---|---:|---:|
| `waitForTimeout(` | 17 | 17 / 12 |
| `setTimeout(` crudo | 3 | 8 / 7 (6 con forma de sleep; 2 no-sleep: salida del fixture, deadline del tracker A05) |
| `"networkidle"` | 39 | 34 / 20 (33 `waitForLoadState` + 1 `waitUntil`) |
| `.catch(() => {} \| undefined)` | 2–3 | 11 / 7 |

## Auditoría causal

### Cambiados

| Archivo | Actual | Problema | Señal observable | Cambio |
|---|---|---|---|---|
| `platform/auth/dashboard-auth-redirect.spec.ts` | `waitForTimeout(250)` + URL sigue en `/login` | un redirect tardío a 300 ms pasaba | los únicos redirects cliente de `/login` están en los efectos de montaje de `LoginContent` (`LoginContent.tsx:75-79`); marcador `data-public-route-control-hydrated` de su propio control (ref del commit cliente) + 2 frames | espera el marcador y 2 rAF; aserción de URL intacta |
| `clinic/shell/dashboard-clinic-module-card-parity.spec.ts` ×2 | `networkidle.catch` + `fonts.ready.catch` + `waitForTimeout(150)` | el evento esperado (sync del proxy vía ResizeObserver) es de frames, no de red; catches silencian | `document.fonts.ready` + `crossRenderedFrames` (ya existente en el spec); la geometría sigue en su `toPass` de doble medición | fonts + 2 frames, sin catch |
| `clinic/shell/clinic-mobile-admin-parity-contract.spec.ts` | `networkidle().catch(() => {})` | catch muerto para timeouts (sin `navigationTimeout`/`actionTimeout` ⇒ sin timeout propio) y oculta errores de página cerrada | primer idle tras `goto`, antes del bucle de medición estable | se retira el catch; `networkidle` retenido |
| informes: `dashboard-adaptive-rows`, `dashboard-informes-server-adaptive-pagination`, `clinic-informes-zero-internal-scroll`, `dashboard-detail-text-integrity` | dos lecturas de conteo separadas 150/180 ms | la ruta SSR usa `INFORMES_FALLBACK_ROWS = 6`; el límite medido (5–11 según A03) se pide por Server Action y React mantiene las filas previas durante el vuelo ⇒ "estable 150 ms" se satisface a mitad de vuelo | tracker de `POST /dashboard/informes` con header `next-action` (terminal = `requestfinished` o `requestfailed`) + `waitForAdaptiveConvergence('[data-informes-rows-canvas="true"]')` + ninguna petición nueva durante el drenaje | helper nuevo `informes-adaptive-settle.ts`; mismo timeout que cada `toPass` original |
| `public/home/public-perspective-scroll.spec.ts` ×3 | `waitForTimeout(120/200/200)` tras `scrollTo` | duración arbitraria | el runtime repinta desde un listener de scroll en el siguiente rAF; `waitForPerspectiveFrame` (2 rAF, ya existente en el spec) | 2 frames |
| `platform/app-shell/dashboard-real-app-shell-no-scroll-contract.spec.ts` ×2 | `waitForTimeout(500)` antes de afirmar 0 errores | ventana de observación temporal | los collectors ya se arman antes del `goto`: ninguna petición en vuelo (`request` vs `requestfinished`/`requestfailed`, excluye `eventsource`) + 2 frames | `trackPendingWork().settle()` local al spec |
| `admin/pricing/admin-pricing-multi-form-measurement.spec.ts` ×2 | 2 lecturas a 160 ms; `waitForTimeout(120)` tras clic en "siguiente" | duración arbitraria | `waitForAdaptiveConvergence` del workspace (mismo selector que A03 `admin-pricing`); el texto `data-dashboard-pager-state` cambia tras el clic | drenaje adaptativo; espera del cambio de página + drenaje |
| `regression/evidence/remove-home-unified-workspace-screenshots.spec.ts` | `waitForTimeout(900)` antes de la captura | duración arbitraria | `waitForAdaptiveConvergence("[data-dashboard-module-workspace]")`; `goto(waitUntil: "networkidle")` retenido (primer idle del documento) | drenaje adaptativo |
| `clinic/shell/dashboard-clinic-module-state-parity.spec.ts` | mock con `setTimeout(resolve, 700)` | el estado loading era observable sólo durante 700 ms | respuesta retenida hasta observar `Cargando perfil público...` (precedente: gate del skeleton en `public-pricing-actionable`) | gate liberado tras la aserción de loading |
| `platform/app-shell/dashboard-card-navigation-shell.spec.ts` ×2 + 2 catches | chunks JS demorados `setTimeout(4_000)`; `evaluate().catch(() => undefined)` | un runner lento podía hidratar antes del clic; el catch convertía un `evaluate` fallido en `undefined`, que satisface `toBeUndefined()` | chunks retenidos sin liberar (la ventana termina con el test); `waitForLoadState("domcontentloaded")` del documento navegado (DCL no espera chunks `async`) | gate nunca liberado; `evaluate` sin catch |
| `public/pricing/public-pricing-actionable.spec.ts` ×8 | `networkidle` antes de aserciones | carga cliente de precios | `[data-pricing-skeleton="true"]` se desmonta al salir de `status: "loading"` (`PreciosContent.tsx:203`) | `waitForPricingLoaded` en los 7 casos dependientes de datos; retirado en el hero (aserciones independientes de datos y auto-waiting) |
| `admin/shell/admin-mobile-config-modules-no-scroll.spec.ts`, `admin-mobile-status-modules-no-scroll.spec.ts` | `waitFor({ timeout: 10_000 }).catch(() => {})` | el propio comentario declara la condición necesaria; el catch traga 10 s y mide un estado transitorio o de error | `data-admin-mobile-*-item` / `data-admin-mobile-ops-pager` visible | se retira el catch (falla visible) |
| `admin/users/admin-users-roles-pager-reachability.spec.ts` | `networkidle` como "frontera" dentro del bucle | no-op desde el 2º intento (hallazgo de runtime) | `aria-busy` (ya existente) + `waitForAdaptiveConvergence` del workspace entre lecturas | frontera de render drenado; comentario y mensaje realineados |

### Retenidos con justificación

| Ubicación | Patrón | Justificación |
|---|---|---|
| `public-service-bento-specimen-journey` ×2, `public-report-preview` ×3, `public-clinics-b2b-operations` ×1, `public-pricing-actionable` ×1 | `networkidle` tras `goto` | aserción negativa sobre tráfico ("no llama APIs privadas"): el primer idle del documento **es** la ventana de observación |
| `dashboard-geometry-baseline`, `dashboard-zero-scroll-baseline`, `b04`, `b05` | `networkidle` (20 s) tras `goto` + `assertSurfaceLoaded` + `waitForLayoutSettled` | primer idle efectivo como condición adicional documentada; consumidores de la matriz canónica (A08 required) ⇒ `E2E-GLOBAL-09` |
| `b10`, `b11`, `b12`, `b14` | `networkidle` tras `goto` + `waitForLayoutSettled` | único drenaje de datos antes de medir; consumidores de la matriz ⇒ `E2E-GLOBAL-09` |
| `dashboard-limit-invariance.spec.ts:413` | `networkidle` | primer idle del documento recién medido antes de armar el tracker (Chromium ≥151 no reporta terminal para peticiones del documento reemplazado) |
| `dashboard-limit-invariance.spec.ts:169` | `setTimeout` | deadline de fallo del tracker, no sleep |
| `fixtures/admin-populated-api-server.mjs:1348` | `setTimeout` | salida del proceso fixture, fuera de sincronización E2E |

## Excepciones residuales (no corregidas)

| Ubicación | Por qué no se cambió | Dueño |
|---|---|---|
| `helpers/dashboard-geometry-matrix.ts:967`, `helpers/mobile-parity-matrix.ts:450` — `waitForTimeout(80)` | no es readiness (la poseen los callers); es el intervalo entre muestras del bucle de 3 lecturas idénticas. Cambiarlo cambia la ventana de medición de A02 y CMP-12, y A02 no puede dar evidencia de equivalencia local (stale en win32) | `E2E-GLOBAL-09` |
| `regression/visual/visual-regression-authenticated.spec.ts:99`, `visual-regression-stress.spec.ts:421` — `networkidle({ timeout: 5_000 }).catch(() => undefined)`; los 3 `window.setTimeout(resolve, 2_500)` en `Promise.race` de imágenes | los specs se autoexcluyen fuera de Linux (`test.skip(process.platform !== "linux")`); cualquier cambio de readiness sólo es validable junto a una corrida de baselines Linux | corrida Linux (`visual-regression-manual.yml`, [MANUAL-NICO]) |
| `helpers/dashboard-adaptive-limit-matrix.ts:1648,1770` (A03) | la de 1770 declara drenar la acción de página 1 en vuelo, pero sólo lo hace si el documento aún no llegó a idle (hallazgo de runtime); el drenaje causal exige un tracker de Server Action en el arnés A03 | A03 / `E2E-GLOBAL-09` |
| `dashboard-limit-invariance.spec.ts:306` (A05) | no-op probado (el idle del mismo documento ya se disparó en :413); lo precede el drenaje causal `flight.waitForIdle`. Quitarlo exige una corrida A05 completa | A05 / `E2E-GLOBAL-09` |

## Guard

`test/architecture/e2e-residual-determinism.test.ts` (corre en `pnpm test` / `backend-ci`). Recorre el
filesystem de `frontend/e2e` y exige, con conteo exacto por ruta permitida:

1. `waitForTimeout(`: sólo `dashboard-geometry-matrix.ts` (1) y `mobile-parity-matrix.ts` (1).
2. Timer con forma de sleep (`setTimeout(<identificador>, …)`, con o sin `window.`): sólo los 3 specs
   visuales (1 cada uno). No afecta a `socket.setTimeout(...)` ni a callbacks inline.
3. Espera silenciada (`.catch(() => {} | undefined | null | void 0)`): sólo los 2 specs visuales (1 cada uno).

No congela `networkidle`: la auditoría demostró usos legítimos y un conteo sería frágil. Incluye un test
en memoria que rechaza cada regresión y la ampliación de una excepción.

**Prueba negativa en disco:** se reinsertó `await page.waitForTimeout(250);` en
`dashboard-auth-redirect.spec.ts` → guard exit 1 con
`wait-for-timeout frontend/e2e/platform/auth/dashboard-auth-redirect.spec.ts: found 1, allowed 0`; se
retiró exactamente esa línea con una edición puntual → guard 2/2 PASSED, 0 ocurrencias en el archivo.

## Censo AFTER

Mismo script, `git ls-files --cached --others --exclude-standard` (116 archivos: incluye el helper nuevo).

| Patrón | BEFORE | AFTER |
|---|---:|---:|
| `waitForTimeout(` | 17 / 12 | 2 / 2 (excepciones GLOBAL-09) |
| `setTimeout(` crudo | 8 / 7 (6 sleeps) | 5 / 5 (3 sleeps visuales Linux + 2 no-sleep) |
| `"networkidle"` | 34 / 20 | 23 / 18 |
| `.catch(() => {} \| undefined)` | 11 / 7 | 2 / 2 (visuales Linux) |

`networkidle` AFTER (23): 7 observación negativa de red, 8 matriz canónica tras `goto`, 1 CMP-12 sin
catch, 1 `waitUntil` de evidencia, 1 A05:413, 3 residuales A03/A05, 2 visuales con catch.

## Paridad

| Ítem | BEFORE | AFTER |
|---|---|---|
| `playwright test --list --reporter=json` | 1.334 tests en 98 archivos, 0 errores | 1.334 en 98; lista de IDs (archivo + títulos, sin línea) con hash idéntico |
| Specs físicos | 98 | 98 |
| `e2e:verify-catalog` | 7/7 | 7/7 |
| Cohortes (`E2E_COHORT_SPECS`) | ci 66, extended 27, evidence 2, visual-linux 3, full 98 | JSON idéntico (hash) |
| Aserciones / timeouts / `skip` / `fixme` / `retries` / `force` | — | por archivo, los únicos deltas son los `expect`/`toPass` de los bucles de asentamiento movidos al helper (mismo timeout pasado como argumento) y el `expect(pagerState).not.toHaveText(...)` que reemplaza el sleep de pricing; ningún `skip`/`fixme`/`retries`/`force`/`test.setTimeout` nuevo |
| Fixture / datos / sesiones | — | sin cambios |

## Validaciones

| Gate | Estado | Evidencia |
|---|---|---|
| Discovery Playwright BEFORE/AFTER | PASSED | 1.334/1.334, IDs idénticos |
| `node --test test/architecture/e2e-residual-determinism.test.ts` | PASSED | 2/2 |
| Prueba negativa del guard en disco | PASSED | exit 1 con la violación exacta → exit 0 tras retirar la mutación |
| `pnpm --dir frontend e2e:verify-catalog` | PASSED | 7/7 antes y después |
| `pnpm --dir frontend lint` | PASSED | exit 0 |
| `pnpm --dir frontend typecheck` | PASSED | exit 0 (incluye `e2e/**`) |
| `pnpm typecheck:test` | PASSED | exit 0 |
| Runtime G1 (`next dev`, 4 workers): auth-redirect, perspective-scroll, pricing-actionable, card-navigation-shell, module-state-parity, pricing-multi-form, users-roles-pager | PASSED | 114/114 |
| Runtime G2: adaptive-rows, informes-server-adaptive, informes-zero-internal-scroll, detail-text-integrity, real-app-shell-no-scroll | PASSED | 84/84 (= conteo de discovery por archivo) |
| Runtime G3: module-card-parity, CMP-12 | PASSED | 90/90 |
| Runtime G4: admin-mobile config/status no-scroll | PASSED | 45/45 |
| Runtime G5: remove-home evidence | PASSED | 10/10 (PNG en scratchpad) |
| Estabilidad `--repeat-each=3` sobre los mecanismos nuevos (informes ×3 specs, auth, pricing-multi-form, users-roles, pre-hidratación ×3, perfil loading, no-scroll poblados + hidratación) | PASSED | 174/174, 0 flaky |
| `pnpm validate:local` | FAILED (ambiental) | `typecheck` y `typecheck:test` PASSED; `test` 4.553 pass / 1 fail / 1 skipped: el único fallo es `e2e-global-03b-authoritative-auth-boundary.fastify.test.ts` (exige `DATABASE_URL`/`SUPABASE_DB_URL`, preexistente desde #1711); el guard nuevo pasa dentro de la corrida; el `build` encadenado no corrió |
| `pnpm build` (aparte) | PASSED | exit 0 (`dist/` ignorado por git) |
| Visual Linux (`visual-linux`) | BLOCKED | specs autoexcluidos fuera de Linux; no se modificaron |
| A02/A03/A05/B04–B14 runtime | NOT_RUN | no modificados |
| `e2e:full` | NOT_RUN | cohortes mínimas por familia modificada cubren el cambio (AGENTS.md §7) |
| `pnpm --dir frontend build`, `security:public-surface` | NOT_RUN | sin cambios en `frontend/src/**` ni en el bundle |

## Archivos

- Nuevos: `frontend/e2e/helpers/informes-adaptive-settle.ts`,
  `test/architecture/e2e-residual-determinism.test.ts`, este documento.
- Modificados (17 specs): los listados en *Cambiados*. Diff tracked: 17 archivos, +164 / −103.

## Rollback

Revertir el commit. Sin migraciones, dependencias ni artefactos persistentes; producto y fixture intactos.

## Riesgo residual

- Excepciones de la sección anterior (GLOBAL-09, visuales Linux, arnés A03/A05).
- `settleInformesRows` confía en que el commit de React de una respuesta terminada cae dentro del
  drenaje posterior (3 frames quietos × 2 renders idénticos); no se observó lo contrario en 3 repeticiones.
- `trackPendingWork` falla visible (expect.poll 5 s) si una petición queda abierta; hoy no ocurre.
- Readiness de las secciones de precios en admin mobile config: el pager `data-admin-mobile-ops-pager`
  se renderiza también durante la carga, así que la espera se satisface antes de los datos (preexistente,
  no temporal; no se cambió la semántica).
- `measureSettledParityContract` devuelve la última lectura si no converge en 24 intentos, sin fallar
  (preexistente; parte del helper de GLOBAL-09).
- `next dev` crea `frontend/AGENTS.md` y `frontend/CLAUDE.md` untracked tras las corridas; no se
  incorporan ni se borran.
- `admin-mobile-{config,status}-modules-no-scroll` escriben capturas en una ruta fija
  `frontend/test-results/<spec>/` que ignora `--output` (preexistente). Las 140 PNG generadas por la
  corrida G4 se eliminaron por ruta exacta; `playwright-report/` y `test-results/.last-run.json`
  preexistentes no se tocaron.

## Estado final

GLOBAL-08 implementado y validado localmente con excepciones residuales documentadas. Git/GitHub
(stage, commit, push, PR) queda a cargo de Nico.
