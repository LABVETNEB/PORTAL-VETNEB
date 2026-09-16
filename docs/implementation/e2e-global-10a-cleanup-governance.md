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
| `main` local y `origin/main` | `f94cc863` (idénticos; rama 1 ahead / 0 behind) |
| Commit de checkpoint | `7d3f76787039885d2872be9f5312fe6782ad76e0` (traslado de máquina; validación incompleta) |
| Working tree inicial | limpio salvo `frontend/AGENTS.md` y `frontend/CLAUDE.md` (generados por `next dev`, untracked, no commiteados); 5 stashes preexistentes intactos |
| `AGENTS.md` aplicables | sólo el raíz (único tracked) |
| Clasificación | R1 (edición local test-only in-scope) |
| Scope primario (`pr-governance`) | `frontend` (`frontend/e2e/**`); `test/**` y `docs/**` son soporte → sin mixed-scope |
| Entorno de validación | Windows 11, Node 24.14.1, pnpm 11.13.0, Playwright 1.63.0, 20 cores / 31,6 GB |

## Scope

Incluido: `frontend/e2e/**` (specs y helpers del régimen zero-scroll y de B04),
`frontend/e2e/suites/catalog.ts`, los censos de `test/architecture/**` y
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

**Cambio.** `frontend/e2e/helpers/zero-scroll-contract.ts` (nuevo) declara
`MAX_DOCUMENT_SCROLL_DELTA_PX = 0` como contrato exacto, no como tolerancia, con el motivo
(AGENTS.md §10: `SCROLL_VERTICAL_DEL_DOCUMENTO = 0`) y la evidencia (A08 ya mide 0 px en las 273
combinaciones, así que no hizo falta ningún cambio de producto para alcanzarlo).

29 specs y 2 helpers consumidores (`admin-mobile-contracts.ts`, `particular-session-contracts.ts`)
importan la constante en lugar de declarar un literal local.

Lo que el régimen **no** posee, documentado en el propio módulo:

- **Geometría de caja** (`getBoundingClientRect` contra límites enteros del viewport): son píxeles
  CSS fraccionarios; la sub-pixel allowance es el contrato, no una fuga.
- **Contenedores internos** que A08 no mide (module root, workspace, surface, peor scroller
  interno): AGENTS.md §10 lista `SCROLL_INTERNO_NO_AUTORIZADO` como invariante separada y ninguna
  matriz canónica ha congelado esos deltas en 0 px todavía.

Por eso `ADMIN_MOBILE_TOLERANCE`, `PARTICULAR_NO_SCROLL_TOLERANCE` e `INTERNAL_TOLERANCE`
sobreviven con su comentario de motivo: no son residuos, son la otra invariante.

**Guard.** `test/architecture/e2e-zero-scroll-regime.test.ts` (4 tests). Recorre el filesystem de
`frontend/e2e` (no `git ls-files`, para cubrir un spec nuevo aún sin stagear) y falla si una línea
que lee una métrica del documento la compara contra un allowance que no es el dueño del régimen.
Incluye prueba de mutación: la función detectora se exporta y el guard verifica que un
`+ TOLERANCE` reintroducido produce exactamente una violación, con archivo y línea.

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
| `frontend/e2e/helpers/admin-mobile-contracts.ts`, `particular-session-contracts.ts` | documento → régimen; allowance interno conservado con motivo |
| 29 specs de `frontend/e2e/**` | importan el régimen en lugar de un literal local |
| `frontend/e2e/regression/dashboard-b04-surface-token-migration.spec.ts` | mínimo por ancla y por ancho |
| `frontend/e2e/regression/evidence/remove-home-unified-workspace-screenshots.spec.ts` | eliminado |
| `frontend/e2e/suites/catalog.ts` | −1 entrada |
| `test/architecture/e2e-zero-scroll-regime.test.ts` | nuevo guard (4 tests) |
| `test/unit/infrastructure/visual-regression-workflow-catalog.test.ts` | nuevo guard (4 tests) |
| `test/architecture/e2e-suite-catalog-completeness.test.ts`, `test/unit/infrastructure/e2e-completeness-workflow.test.ts` | censos realineados |

40 archivos, +878 / −272.

## Validaciones

Ejecutadas sobre el head `7d3f7678` en la máquina destino tras el traslado. Los gates observados en
la máquina anterior no se reutilizan como evidencia: todo lo listado se volvió a ejecutar aquí.

| Gate | Estado | Evidencia |
|---|---|---|
| Tests dirigidos (censo de catálogo, régimen zero-scroll, workflow de completeness, reconciliación visual) | PASSED | 24/24 |
| `pnpm typecheck` | PASSED | dentro de `validate:local` |
| `pnpm typecheck:test` | PASSED | dentro de `validate:local` |
| `pnpm test` (raíz) | FAILED · causa ambiental preexistente | 4.561 pass / 1 fail / 1 skipped. El único fallo es `test/integration/app/e2e-global-03b-authoritative-auth-boundary.fastify.test.ts`, que lanza `E2E-GLOBAL-03B requiere DATABASE_URL o SUPABASE_DB_URL`. El skip es el de symlink sin privilegios en Windows. |
| `pnpm validate:local` | FAILED | por la fase `pnpm test` de arriba; su `build` encadenado no llegó a correr |
| `pnpm build` (backend, ejecutado aparte) | PASSED | `dist/index.js` 918,2 kb |
| `pnpm security:public-surface` | PASSED | mismos 2 hallazgos `server-only` preexistentes en `frontend/src/proxy.ts` |
| `pnpm --dir frontend lint` | PASSED | |
| `pnpm --dir frontend typecheck` | PASSED | |
| `pnpm --dir frontend build` | PASSED | 25 rutas |
| `pnpm --dir frontend e2e:ci` | PASSED | 67 specs · 1.029 passed / 1 skipped / 0 failed, 6,7 min. El skip es el declarado de B05 S7 `clinic-tokens`. |
| `pnpm --dir frontend e2e:extended` | FAILED · causa preexistente | 27 specs · 233 passed / 22 failed: A02 `dashboard-geometry-baseline` 21/21 superficies y A03 `dashboard-adaptive-limit-baseline` 1 leaf. Ver abajo. |
| `pnpm --dir frontend e2e:evidence` | PASSED | 1 spec / 1 test |
| `pnpm --dir frontend e2e:visual-linux` | BLOCKED | baselines Chromium-Linux; preflight con exit 5 en win32 |
| `git diff --check` | PASSED | |
| `db:migrate` | BLOCKED | sin DB local |

### A02/A03 en `extended`: preexistentes, no causados por este PR

Fingerprint observado:

- **A02** — `shell.topbar.height expected=44 actual=48` en los 5 viewports de teléfono, en las 21
  superficies. Es exactamente el drift ya registrado (recaptura del 2026-09-14, atribuida a
  `c62de271` / #1681 y a los retiros de module-card/metrics).
- **A03** — un único leaf: `admin-particular-tokens::w360x800`, con `limit` / `offset` /
  `secondPageCount` 12 → 11 y `source: "client-slice"`; el drift win32 ya conocido.

Prueba estructural de no-causalidad, por lectura y no por inferencia:

| Módulo del import closure de A02/A03 | Líneas cambiadas por este PR |
|---|---:|
| `regression/dashboard-geometry-baseline.spec.ts` | 0 |
| `regression/dashboard-adaptive-limit-baseline.spec.ts` | 0 |
| `fixtures/dashboard-geometry-baseline.ts` | 0 |
| `fixtures/dashboard-adaptive-limit-baseline.ts` | 0 |
| `helpers/dashboard-adaptive-limit-matrix.ts` | 0 |
| `helpers/session.ts` | 0 |
| `helpers/dashboard-geometry-matrix.ts` | +77 / −0 |

El único módulo tocado del closure recibe exportaciones nuevas (`DASHBOARD_SHELL_FRAME_ANCHOR`,
`DASHBOARD_CHROME_ANCHOR_CLASSES`, `requiredChromeAnchorsAt`) sin efectos de módulo y sin modificar
ninguna exportación existente; A02 no las importa y A03 sólo importa
`DASHBOARD_GEOMETRY_VIEWPORTS`. Ninguna de las 22 fallas puede originarse en este cambio. Ambos
specs viven en `extended`, que no es contexto required.

### `dashboard-logistica-mobile-action-bar-reachability`

Investigación dirigida por un fallo aislado durante la corrida interrumpida del traslado. No se
clasificó como flake sin evidencia:

1. **Grafo de imports** — el spec importa únicamente `helpers/session`, que este PR no toca; su
   propio archivo tiene 0 líneas cambiadas. El cambio no puede alcanzarlo.
2. **Corrida aislada** — 6/6 PASSED (27,5 s).
3. **Corrida dentro de la cohorte `ci` completa**, con 10 workers y contención real — 6/6 PASSED
   (~25 s por test).

12/12 en la máquina destino. La causa del fallo original queda atribuida a la interrupción de la
corrida, no al spec ni al cambio; no se observó ninguna reproducción y no se tocó nada por ello.

## Riesgos residuales

1. **R-12 no está cerrado al 100 %.** Quedan tres call sites que afirman una métrica del documento
   contra un allowance positivo y que el guard no ve, porque su detector cubre la forma
   `client* + ALLOWANCE` y no la forma "delta comparado contra literal":

   - `frontend/e2e/clinic/logistics/dashboard-logistica-mobile-action-bar-reachability.spec.ts:163-164` → `toBeLessThanOrEqual(1)`
   - `frontend/e2e/clinic/shell/remove-dashboard-home-unified-workspace.spec.ts:215-216` → `toBeLessThanOrEqual(2)`
   - `frontend/e2e/admin/users/admin-users-roles-pager-reachability.spec.ts:102` → `root.scrollHeight - root.clientHeight > 1` dentro de `page.evaluate`

   Es deuda preexistente (ninguno de los tres se rompe por este cambio) y por eso se reporta en vez
   de corregirse de contrabando (AGENTS.md §4). Cerrarla exige extender el detector del guard a la
   forma delta y pasar la constante como parámetro de `page.evaluate` en el tercero, y luego
   revalidar `ci` + `extended`.

2. **`CI_SPLIT_REQUIRED: YES`** — la reconciliación visual correcta necesita editar
   `visual-regression-manual.yml`. Queda como PR `ci-only` posterior.

3. **Mitad documental sin abrir** — R-18 sigue vigente: `CI_PR_CHECKS_RUNBOOK.md` y
   `SOURCES_OF_TRUTH.md` siguen citando 72 specs / 786 tests contra los 98 specs reales.

4. **A02/A03** conservan su drift win32 preexistente; este PR no lo modifica ni lo recaptura.

5. **`e2e:visual-linux`** no es verificable en Windows por diseño.

## Rollback

- Disparador: regresión en `validate-frontend`, o inequivalencia de medición atribuible a este
  cambio.
- Pasos: PR de revert del squash. No compensar tocando producto, baselines ni semántica de
  fixtures; no reintroducir tolerancias locales.
- Impacto de datos: ninguno (test/docs-only).

## Estado final

R-12 (con el residual declarado arriba), R-13, R-14 (mitad test-only) y R-16 cerrados. Catálogo de
98 specs, particionado por las 4 cohortes sin solapamiento. Gate required `e2e:ci` verde con 1.029
tests. Working tree sin artefactos `playwright-report/`, `test-results/` ni `next-env.d.ts`
alterado.
