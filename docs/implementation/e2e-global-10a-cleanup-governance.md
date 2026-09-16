# E2E-GLOBAL-10A — Limpieza y gobernanza (mitad de código)

Fase `E2E-GLOBAL-10` del programa `LIMPIEZA E2E` (`docs/audit/LIMPIEZA E2E.md` §24), entregada en
dos mitades por la nota §4 de esa misma ficha ("el ajuste documental va **separado** del cambio de
código"). Esta es la mitad **de código**, test-only: cierra R-12, R-13, R-14 y R-16. La mitad
documental (R-18: `CI_PR_CHECKS_RUNBOOK.md`, `SOURCES_OF_TRUTH.md` y los dos audits obsoletos) no
forma parte de este PR y no se abrió en esta tarea.

## Estado base

| Ítem | Valor |
|---|---|
| Rama | `test/e2e-global-10-cleanup-governance` |
| HEAD base | `f94cc863f3250d5d6faf25cc18fcd25e79c3dbf5` (`test(e2e): optimize canonical matrix performance (#1728)`) |
| `main` local y `origin/main` | `f94cc863` (idénticos) |
| Commits de la rama | `7d3f7678` (checkpoint de traslado) → `673553a2` (este registro) → cierre de R-12 |
| Working tree inicial | limpio salvo `frontend/AGENTS.md` y `frontend/CLAUDE.md` (generados por `next dev`, untracked, no commiteados); 5 stashes preexistentes intactos |
| `AGENTS.md` aplicables | sólo el raíz (único tracked) |
| Clasificación | R1 (edición local test-only in-scope) |
| Scope primario (`pr-governance`) | `frontend` (`frontend/e2e/**`); `test/**` y `docs/**` son soporte → sin mixed-scope |
| Entorno de validación | Windows 11, Node 24.14.1, pnpm 11.13.0, Playwright 1.63.0, 20 cores / 31,6 GB |

## Scope

Incluido: `frontend/e2e/**` (specs y helpers del régimen zero-scroll y de B04),
`frontend/e2e/suites/catalog.ts`, los censos y guards de `test/architecture/**` y
`test/unit/infrastructure/**` que el cambio rompe legítimamente, dos guards nuevos, y este
documento.

Excluido (deliberadamente): `frontend/src/**`, `server/**`, DB, auth/cookies productivas,
`package.json`, `pnpm-lock.yaml`, `.github/workflows/**`, snapshots visuales, semántica del
fixture, `docs/audit/LIMPIEZA E2E.md`, `docs/ops/CI_PR_CHECKS_RUNBOOK.md`,
`docs/SOURCES_OF_TRUTH.md`, y R-15/R-17 (fases propias).

## R-12 — Un solo régimen de scroll de documento

**Problema (audit P2-2).** La misma invariante se afirmaba con dos umbrales: A08
(`regression/dashboard-zero-scroll-baseline`) congela el delta de scroll del documento en
exactamente 0 px sobre sus 273 combinaciones canónicas, mientras los contratos de shell más
antiguos toleraban 1–2 px. Una regresión de 1–2 px pasaba en un sitio y fallaba en otro, y el
número no tenía dueño.

**Dueño.** `frontend/e2e/helpers/zero-scroll-contract.ts` declara
`MAX_DOCUMENT_SCROLL_DELTA_PX = 0` como contrato exacto, no como tolerancia, con el motivo
(AGENTS.md §10: `SCROLL_VERTICAL_DEL_DOCUMENTO = 0`) y la evidencia (A08 ya mide 0 px en las 273
combinaciones, así que no hizo falta ningún cambio de producto para alcanzarlo).

### La primera pasada cerró una sola forma sintáctica

El detector inicial del guard reconocía únicamente `clientHeight + IDENTIFICADOR`. La validación
posterior demostró que el corpus expresa **la misma tolerancia** de cuatro maneras, y que las otras
tres quedaban invisibles:

| Forma | Ejemplo real | Toleraba |
|---|---|---|
| Slack nombrado | `expect(m.htmlScrollHeight).toBeLessThanOrEqual(m.htmlClientHeight + TOLERANCE)` | indeterminado |
| Slack literal | `expect(bodyScrollHeight).toBeLessThanOrEqual(viewportHeight + 5)` | 5 px |
| Delta contra literal | `expect(overflow).toBeLessThanOrEqual(2)` | 2 px |
| Booleanización | `documentScrolls: root.scrollHeight - root.clientHeight > 1` + `.toBe(false)` | 1 px |

Un guard que vigila una sola grafía es un guard que invita a las otras tres. Por eso el detector se
reescribió para vigilar la **categoría semántica**: *un allowance positivo sobre una métrica de
scroll de la cadena del documento*. Responde una pregunta por sitio — ¿cuántos píxeles de scroll de
documento seguirían pasando acá? — y falla cuando la respuesta es 1 px o más.

**Aritmética de la tolerancia** (derivada de qué delta pasa, no de la grafía):

| Comparación | Tolera |
|---|---|
| `toBeLessThanOrEqual(n)` · `<= n` · `> n` (booleanizado y afirmado `false`) | `n` |
| `toBeLessThan(n)` · `< n` · `>= n` | `n - 1` |
| `+ n` | `n` |
| `+ IDENTIFICADOR` que no es el dueño ni un portador probado | no acotado |

**Lo que queda fuera es estructural, no una lista de exclusión por archivo:**

- **Geometría de caja** nunca matchea, porque un campo de rect (`top`, `bottom`, `height`…) no es
  una métrica `scroll*`/`client*`. Su allowance sub-pixel es el contrato, no una fuga.
- **Contenedores internos** nunca matchean, porque una métrica leída sobre algo que no es la cadena
  del documento no es una lectura de documento. `main.dashboard-main` incluido: AGENTS.md §10 lista
  `SCROLL_INTERNO_NO_AUTORIZADO` como invariante separada y ninguna matriz canónica congeló esos
  deltas en 0 px todavía.

Por eso `ADMIN_MOBILE_TOLERANCE`, `PARTICULAR_NO_SCROLL_TOLERANCE`, `INTERNAL_TOLERANCE` y el
`> 1` de `regionScrolls` sobreviven con su comentario de motivo: no son residuos, son la otra
invariante.

### Cómo resuelve el detector

1. **Normalización.** Comentarios y cuerpos de string se blanquean preservando cada salto de línea,
   así los números de línea siguen siendo exactos y la prosa que explica "1–2 px" nunca se lee como
   código.
2. **Cadena del documento.** `document.documentElement`, `document.body`, los alias locales ligados
   a cualquiera de los dos, y los nombres ya desestructurados del lado del browser
   (`htmlClientWidth`, `bodyScrollHeight`, `documentScrollX`…).
3. **Flujo de valor.** Un delta calculado dentro de `page.evaluate` y afirmado afuera se sigue por
   el nombre al que se liga, incluso cuando la expresión ocupa varias líneas (`Math.max(...)`).
4. **Binding más cercano.** `dashboard-clinic-controller-workspace-parity.spec.ts` liga `metric`
   dos veces en el mismo archivo: primero a `main.dashboard-main`, después al documento. Un
   conjunto de nombres global por archivo le cobraba a la aserción del contenedor interno la
   lectura de documento de otra función — dos falsos positivos reales, encontrados al medir. La
   resolución es "el binding que precede al uso".
5. **Portadores del régimen.** Una page function no puede capturar un import de módulo, así que un
   spec que mide el documento dentro de `page.evaluate` tiene que pasar la constante como argumento
   — y el argumento se liga **después** del cuerpo que lo usa. Por eso ésta es una regla de archivo
   completo y no de binding más cercano, y se mantiene fail-closed por los dos extremos: el nombre
   tiene que estar ligado al símbolo desnudo del dueño (no a algo derivado) y, si ese mismo nombre
   se liga a cualquier otra cosa en el archivo, deja de contar como régimen.

### Censo y convergencia

El detector, corrido sobre el corpus real antes de tocar nada, reportó **15 sitios en 8 archivos**
— cinco más de los tres que se conocían. Todos convergieron al dueño:

| Archivo | Sitios | Forma | Toleraba |
|---|---:|---|---|
| `admin/users/admin-users-roles-pager-reachability.spec.ts` | 1 | booleanización | 1 px |
| `clinic/logistics/dashboard-logistica-mobile-action-bar-reachability.spec.ts` | 2 | delta contra literal | 1 px |
| `clinic/shell/dashboard-master-detail-state-polish.spec.ts` | 2 | delta contra literal | 2 px |
| `clinic/shell/remove-dashboard-home-unified-workspace.spec.ts` | 2 | delta contra literal | 2 px |
| `helpers/mobile-parity-matrix.ts` | 2 | booleanización | 2 px |
| `platform/app-shell/dashboard-card-navigation-shell.spec.ts` | 3 | slack literal | 5 px |
| `platform/app-shell/dashboard-workspace-layout-polish.spec.ts` | 1 | delta contra literal | 5 px |
| `regression/dashboard-b08-navigation-migration.spec.ts` | 2 | slack literal | 1 px |

Consumidores del régimen: **32 → 39 archivos** (35 specs + 3 helpers + el dueño).

Dos casos exigieron cruzar la constante al browser como argumento
(`admin-users-roles-pager-reachability` y `mobile-parity-matrix`). En
`mobile-parity-matrix.ts` el umbral lo consume la **misma** función que mide Admin y Clínica, así
que el régimen aprieta las dos superficies simétricamente y la paridad CMP-12 no puede sesgarse; la
evidencia es que CMP-12 quedó 60/60 con el umbral exacto. Además
`dashboard-clinic-full-route-stage-parity.spec.ts` ya medía ese mismo booleano con tolerancia cero,
de modo que la convergencia alinea el corpus con la forma que ya era mayoritaria.

### Realineación del censo de paridad (AGENTS.md §4)

`test/architecture/clinic-mobile-admin-parity-census.test.ts` importa `mobile-parity-matrix.ts` a
nivel de Node. Al ganar el helper su primer import relativo sin extensión — el idiom de todos los
helpers de `frontend/e2e` — el loader de type-stripping dejó de resolverlo. Se probó la alternativa
de escribir el import con extensión `.ts`: resuelve en Node pero rompe
`pnpm --dir frontend typecheck` con `TS5097` (`allowImportingTsExtensions` no está habilitado en
`frontend/tsconfig.json`, y habilitarlo sería un cambio de compilador fuera de scope).

La realineación usa el mecanismo que el repositorio ya tiene para exactamente este problema: un
`registerHooks` acotado al par parent/specifier concreto, igual que
`test/unit/infrastructure/frontend-next-config-private-cache-headers.test.ts`. El import de valores
pasa a ser dinámico para que el hook esté instalado antes de resolver; los tipos siguen siendo
estáticos porque `import type` se borra y nunca se resuelve. El guard no se debilitó: sus tres
aserciones son las mismas.

### Guard

`test/architecture/e2e-zero-scroll-regime.test.ts` — **6 tests** (antes 4). Recorre el filesystem
de `frontend/e2e` (no `git ls-files`, para cubrir un spec nuevo aún sin stagear) y expone la
función detectora, así que las mutaciones son demostrables:

*Detección (8 pruebas negativas):* `+ TOLERANCE`; `+ 5`; `<= 1` a través de un binding; `<= 2` a
través de `Math.max` sobre ambos elementos del documento; `> 1` booleanizado; `< 2` (que tolera
1 px); un portador ligado a un literal en vez de al dueño; y un portador re-ligado en otra parte
del archivo.

*Aceptación (8 pruebas):* la forma canónica sumada; la forma canónica comparada; el régimen
cruzado a `page.evaluate` por un portador probado; un booleano estrictamente cero (`> 0`); un
scroller interno a 2 px; `main.dashboard-main` a 2 px; un borde de rect a 0,5 px; y un comentario
que describe el allowance viejo.

*Scoping:* la reproducción exacta del choque de nombre `metric`, probando que sólo el uso ligado al
documento es violación.

## R-13 — Detección por ancla en B04

**Problema (audit P2-3).** B04 acumulaba observaciones globalmente y sólo afirmaba
`measured.length > 0`, condición que el marco del shell satisface por sí solo: una banda de
navegación que dejara de renderizar mantenía el gate verde midiendo menos.

**Por qué no basta "todas las anclas deben observarse".** Dos anclas (`horizontal-nav`,
`module-rail`) están retiradas del producto y se conservan a propósito (audit §26: mantener estable
la forma del registro A02). Exigirlas sería un falso fallo.

**Cambio.** `DASHBOARD_CHROME_ANCHOR_CLASSES` clasifica cada ancla por su regla real en
`styles/dashboard/navigation.css` (`always-mounted`, `drawer-band` ≥ 1280 px, `rail-band`
768–1279,98 px, `mobile-band` ≤ 767 px, `module-conditional`, `retired`), y
`requiredChromeAnchorsAt(width)` resuelve por ancho las tres anclas obligatorias: el marco, la
topbar y el único dueño de banda que pinta a ese ancho. B04 afirma ahora las anclas ausentes por
estado y nombra la que faltó. Un `beforeAll` exige además que toda ancla del inventario esté
clasificada, de modo que una banda nueva no herede silenciosamente "ningún mínimo".

## R-14 — Reconciliación catálogo ↔ workflow visual · `CI_SPLIT_REQUIRED: YES`

**Problema (audit P2-4).** `visual-regression-manual.yml` mantiene una lista manual de specs
visuales en paralelo con `catalog.ts`. El runner de candidato productivo ya es catalog-driven
(`selectSuiteSpecs` lee `E2E_COHORT_SPECS["visual-linux"]`); el runner `dev` de diagnóstico sigue
enumerando los tres specs a mano, así que una cuarta entrada `visual-linux` sería capturada por un
runner y salteada por el otro sin que nada lo reporte.

**Cambio.** `test/unit/infrastructure/visual-regression-workflow-catalog.test.ts` (4 tests) parsea
el workflow como YAML (js-yaml, el mismo parser que ya usa el contrato de completeness) y falla
cerrado ante cualquier forma de drift entre el catálogo, las opciones del workflow y el runner de
candidato.

El guard **lee** el workflow; no lo reescribe. Reemplazar la lista manual por el runner de cohorte
es un cambio `ci-only` sobre `.github/workflows/**` y pertenece a su propio PR (AGENTS.md §4).
Hasta que ese PR exista, el drift falla cerrado desde el lado test-only. **`CI_SPLIT_REQUIRED: YES`.**

## R-16 — Spec de evidencia sin aserciones

`frontend/e2e/regression/evidence/remove-home-unified-workspace-screenshots.spec.ts` (10 tests,
cero aserciones) sólo escribía screenshots dentro del `outputDir` que Playwright borra al inicio de
cada corrida. Eliminado.

Realineación de censos en el mismo PR (AGENTS.md §4; es parte del scope, no una salida de scope):

| Censo | Antes | Después |
|---|---:|---:|
| `catalog.ts` / `EXPECTED_CATALOG_SPEC_COUNT` / `EXPECTED_WORKSPACE_SPEC_COUNT` | 99 | 98 |
| dominio `regression` | 21 | 20 |
| layer `fixture` | 61 | 60 |
| cohorte `evidence` | 2 | 1 |
| cohorte `full` | 99 | 98 |
| `e2e-completeness-workflow` · `missingSpecs` sin ruta `full` | 32 | 31 |

`evidence` conserva el generador que sí afirma layout
(`dashboard-runtime-post-ux1-visual-evidence`) y pierde el que no afirmaba nada. Las cohortes
siguen particionando `full`: `ci` 67 + `extended` 27 + `evidence` 1 + `visual-linux` 3 = 98.

## Archivos

| Archivo | Cambio |
|---|---|
| `frontend/e2e/helpers/zero-scroll-contract.ts` | nuevo — dueño del régimen |
| `frontend/e2e/helpers/dashboard-geometry-matrix.ts` | +77 / −0, puramente aditivo (clases de ancla + `requiredChromeAnchorsAt`) |
| `frontend/e2e/helpers/admin-mobile-contracts.ts`, `particular-session-contracts.ts`, `mobile-parity-matrix.ts` | documento → régimen; allowance interno conservado con motivo |
| 35 specs de `frontend/e2e/**` | importan el régimen en lugar de un literal local |
| `frontend/e2e/regression/dashboard-b04-surface-token-migration.spec.ts` | mínimo por ancla y por ancho |
| `frontend/e2e/regression/evidence/remove-home-unified-workspace-screenshots.spec.ts` | eliminado |
| `frontend/e2e/suites/catalog.ts` | −1 entrada |
| `test/architecture/e2e-zero-scroll-regime.test.ts` | guard del régimen, detector semántico (6 tests) |
| `test/unit/infrastructure/visual-regression-workflow-catalog.test.ts` | nuevo guard (4 tests) |
| `test/architecture/clinic-mobile-admin-parity-census.test.ts` | realineado con `registerHooks` acotado |
| `test/architecture/e2e-suite-catalog-completeness.test.ts`, `test/unit/infrastructure/e2e-completeness-workflow.test.ts` | censos realineados |

48 archivos de código + este documento, +1739 / −326 contra `main`.

## Validaciones

Ejecutadas en la máquina destino tras el traslado. Los gates observados en la máquina anterior no
se reutilizan como evidencia. La tabla refleja el estado **después** del cierre de R-12; los gates
afectados por ese cierre se volvieron a correr enteros.

| Gate | Estado | Evidencia |
|---|---|---|
| `test/architecture/e2e-zero-scroll-regime.test.ts` | PASSED | 6/6, con 8 pruebas negativas y 8 de aceptación |
| Guards dirigidos (censo de catálogo, censo de paridad, determinismo residual, workflow de completeness, reconciliación visual) | PASSED | |
| `pnpm typecheck` | PASSED | dentro de `validate:local` |
| `pnpm typecheck:test` | PASSED | dentro de `validate:local` |
| `pnpm test` (raíz) | FAILED · causa ambiental preexistente | 4.563 pass / 1 fail / 1 skipped (eran 4.561/1/1 antes de los 2 tests nuevos del guard). El único fallo es `test/integration/app/e2e-global-03b-authoritative-auth-boundary.fastify.test.ts`, que lanza `E2E-GLOBAL-03B requiere DATABASE_URL o SUPABASE_DB_URL`. El skip es el de symlink sin privilegios en Windows. |
| `pnpm validate:local` | FAILED | por la fase `pnpm test` de arriba; su `build` encadenado no llegó a correr |
| `pnpm build` (backend, ejecutado aparte) | PASSED | `dist/index.js` 918,2 kb |
| `pnpm security:public-surface` | PASSED | mismos 2 hallazgos `server-only` preexistentes en `frontend/src/proxy.ts` |
| `pnpm --dir frontend lint` | PASSED | |
| `pnpm --dir frontend typecheck` | PASSED | |
| `pnpm --dir frontend build` | PASSED | 25 rutas |
| E2E dirigido a los 8 specs convergidos + CMP-12 | FAILED · 190/191 | el único fallo es `action-bar-reachability @ 430x932` por presupuesto de test; ver abajo |
| `pnpm --dir frontend e2e:ci` | PASSED | 67 specs · **1.029 passed / 1 skipped / 0 failed**, 6,8 min, con todos los umbrales exactos. CMP-12 60/60. El skip es el declarado de B05 S7 `clinic-tokens`. |
| `pnpm --dir frontend e2e:extended` (corrida 1) | FAILED | 232 passed / 23 failed |
| `pnpm --dir frontend e2e:extended` (corrida 2) | FAILED · fingerprint preexistente exacto | 233 passed / 22 failed — 22 títulos idénticos y 1.850 líneas de drift idénticas al baseline pre-R-12 |
| `pnpm --dir frontend e2e:evidence` | PASSED | 1 spec / 1 test |
| `pnpm --dir frontend e2e:visual-linux` | BLOCKED | baselines Chromium-Linux; preflight con exit 5 en win32 |
| `git diff --check` | PASSED | |
| `db:migrate` | BLOCKED | sin DB local |

### A02/A03 en `extended`: preexistentes, no causados por este PR

Fingerprint observado, idéntico antes y después del cierre de R-12:

- **A02** — `shell.topbar.height expected=44 actual=48` en los 5 viewports de teléfono, en las 21
  superficies, con su cascada mecánica a `shell.main.y/height`. Es el drift ya registrado
  (recaptura del 2026-09-14, atribuida a `c62de271` / #1681 y a los retiros de
  module-card/metrics).
- **A03** — un único leaf: `admin-particular-tokens::w360x800`, con `limit` / `offset` /
  `secondPageCount` 12 → 11 y `source: "client-slice"`; el drift win32 ya conocido.

Comparación mecánica, no impresionista: los títulos fallados y las líneas de drift se extrajeron de
las tres corridas y se diffearon. **22 títulos y 1.850 líneas de drift, byte-idénticos** entre el
baseline pre-R-12 y la corrida 2 posterior.

Prueba estructural de no-causalidad, por lectura: de los 7 módulos del import closure de A02/A03,
6 tienen **0 líneas cambiadas** por este PR (`dashboard-geometry-baseline.spec.ts`,
`dashboard-adaptive-limit-baseline.spec.ts`, ambos fixtures de baseline,
`helpers/dashboard-adaptive-limit-matrix.ts`, `helpers/session.ts`), y el séptimo
(`helpers/dashboard-geometry-matrix.ts`) es **+77 / −0**: exportaciones nuevas sin efectos de
módulo, sin modificar ninguna exportación existente, que A02 no importa y de las que A03 sólo usa
`DASHBOARD_GEOMETRY_VIEWPORTS`. Ambos specs viven en `extended`, que no es contexto required.

### `dashboard-logistica-mobile-action-bar-reachability`

Este spec tuvo un fallo aislado durante la corrida interrumpida del traslado y volvió a fallar una
vez durante la validación de R-12. Las dos observaciones tienen la misma causa medida.

**Nota de trazabilidad:** hasta el cierre de R-12 este archivo tenía 0 líneas cambiadas, y esa era
la prueba de no-causalidad. Ya no lo es: R-12 modificó sus líneas 163-164 y su bloque de imports.
La evidencia histórica se conserva, pero la no-causalidad ahora se sostiene sobre la medición, no
sobre la ausencia de diff.

**Causa medida — agotamiento del presupuesto de test, no ausencia de contrato:**

| Corrida | Duración de los 6 tests | Resultado |
|---|---|---|
| Aislada (pre-R-12) | 22,2 – 22,7 s | 6/6 PASSED |
| Cohorte `ci` (pre-R-12) | 25,1 – 25,4 s | 6/6 PASSED |
| Dirigida de 8 specs (post-R-12, contención alta) | 25,6 – 25,8 s + **30,1 s** | 5/6; el de 30,1 s agotó el presupuesto |
| Cohorte `ci` (post-R-12) | 18,6 – 21,8 s | 6/6 PASSED |

El presupuesto por test es de 30 s (`playwright.config.ts`). El spec hace dos cargas completas de
`/dashboard/logistica`, una navegación a Métricas y cuatro recorridos de pager, y gasta ~25 s de
esos 30 — un margen de ~15 %. Bajo contención alta ese margen se consume.

El fallo ocurre en `openHub` (línea 50), **antes** de las líneas que R-12 tocó, y el snapshot del
fallo **contiene** el pager `Paginación de planes recientes` y el workspace de logística: el
elemento estaba renderizado y lo que se agotó fue el reloj. No se subió el timeout, no se agregaron
retries y no se tocó el spec por este motivo (el audit prohíbe explícitamente esas tres salidas);
queda declarado como riesgo residual.

### Fallo no reproducible en `extended` corrida 1

La corrida 1 de `extended` sumó un 23.º fallo:
`dashboard-clinic-module-state-parity.spec.ts:335` — "retry: a successful Actualizar after a failed
load clears the stale error banner". Investigado, no silenciado:

1. **Grafo de imports** — el spec importa `helpers/session` y `helpers/zero-scroll-contract`;
   ninguno de los dos fue tocado por el cierre de R-12, y el archivo tampoco.
2. **Aserción fallada** — `toHaveText("E2E forced failure")` sobre el banner de error de un fallo
   de API forzado. No es una aserción de scroll ni toca el régimen.
3. **Snapshot** — la tarjeta seguía en `Cargando` / `Sin tokens`: el módulo no había alcanzado el
   estado de error dentro de los 5 s del matcher.
4. **Aislamiento** — 14/14 PASSED.
5. **Reproducción** — la corrida 2 de `extended` no lo reprodujo y devolvió el fingerprint
   preexistente exacto.

Clasificación: flake preexistente de la ruta de retry ante fallo forzado, observado 1 de 2
corridas. No introducido por R-12 y no corregido acá (sería frontend/src o una fase propia).

## Riesgos residuales

1. **`CI_SPLIT_REQUIRED: YES`** — la reconciliación visual correcta necesita editar
   `visual-regression-manual.yml`. Queda como PR `ci-only` posterior.
2. **Mitad documental sin abrir** — R-18 sigue vigente: `CI_PR_CHECKS_RUNBOOK.md` y
   `SOURCES_OF_TRUTH.md` siguen citando 72 specs / 786 tests contra los 98 specs reales.
3. **`dashboard-logistica-mobile-action-bar-reachability` opera al ~85 % de su presupuesto** de
   30 s. No es un defecto de producto ni de contrato, pero es un margen fino: bajo contención alta
   falla por reloj. Reducir su coste (una sola apertura del hub en vez de dos) es una fase propia.
4. **`dashboard-clinic-module-state-parity.spec.ts:335`** flakea en la ruta de retry ante fallo
   forzado (1 de 2 corridas de `extended`).
5. **A02/A03** conservan su drift win32 preexistente; este PR no lo modifica ni lo recaptura.
6. **`e2e:visual-linux`** no es verificable en Windows por diseño.
7. El detector del guard es sintáctico, no un type-checker: cubre las cuatro formas medidas en el
   corpus y las pruebas negativas las fijan, pero una forma futura genuinamente nueva exigiría
   extenderlo otra vez.

## Rollback

- Disparador: regresión en `validate-frontend`, o inequivalencia de medición atribuible a este
  cambio.
- Pasos: PR de revert del squash. No compensar tocando producto, baselines ni semántica de
  fixtures; no reintroducir tolerancias locales.
- Impacto de datos: ninguno (test/docs-only).

## Estado final

R-12 **cerrado**: los 15 sitios del corpus usan el régimen exacto, el guard falla cerrado contra
las cuatro formas sintácticas y sus pruebas negativas y de aceptación lo fijan. R-13, R-14 (mitad
test-only) y R-16 cerrados. Catálogo de 98 specs, particionado por las 4 cohortes sin solapamiento.
Gate required `e2e:ci` verde con 1.029 tests. `extended` devuelve el fingerprint preexistente
exacto. Working tree sin artefactos `playwright-report/`, `test-results/` ni `next-env.d.ts`
alterado.
