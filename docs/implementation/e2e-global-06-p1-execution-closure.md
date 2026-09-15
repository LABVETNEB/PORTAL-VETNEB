# E2E-GLOBAL-06 — Cierre de la brecha de ejecución de los P1

Fase `E2E-GLOBAL-06` del programa `LIMPIEZA E2E` (`docs/audit/LIMPIEZA E2E.md` §24). Problema
P1-5 / R-08. Dependencias `E2E-GLOBAL-01` y `E2E-GLOBAL-05` (05B, #1721) ya fusionadas.

Aceptación: ningún spec P1 depende del schedule semanal.

## Estado base

| Ítem | Valor |
|---|---|
| Rama base | `main` |
| HEAD base de la implementación | `bef259f8f54a2195010ef79ecf8d203a204fd8cc` (`test(e2e): promote production visual baselines (#1721)`), padre de `d2343816` |
| Base efectiva del PR | `2b39d15d52ce11eb9724cdbc25b9f3d696d606bc` (`test(e2e): require stable metric run geometry (#1724)`), integrada por el merge `8ad524f1` (`^1 = d2343816`, `^2 = 2b39d15d`) |
| Rama de trabajo | `ci/e2e-global-06-p1-execution-closure-v2` (PR #1725; recrea #1722, cerrada sin merge sobre el mismo head) |
| Clasificación | R1 (catálogo, guards, acta) + R2 (`.github/workflows/e2e-completeness.yml`) |
| Scopes primarios detectados | `frontend` (`frontend/e2e/suites/catalog.ts`) + `workflows/CI` → excepción mixed-scope |

El roadmap rotula la fase `ci-only`; el validador de `pr-governance` clasifica `frontend/**` como
primario, igual que en 05B. Manda la clasificación ejecutable.

## Auditoría previa (HEAD base)

- P1 fuera de `ci` (5 de 69 P1; los 69 están en `full`):
  - `e2e/admin/users/admin-users-roles-pager-reachability.spec.ts` — `extended+full`, `targetGate=extended`.
  - `e2e/clinic/logistics/dashboard-logistica-mobile-action-bar-reachability.spec.ts` — `extended+full`, `targetGate=extended`.
  - `e2e/regression/dashboard-adaptive-limit-baseline.spec.ts` (A03), `dashboard-geometry-baseline.spec.ts` (A02),
    `dashboard-limit-invariance.spec.ts` (A05) — `extended+full`.
- `e2e-completeness.yml` (única ejecución de `extended`, vía `e2e:full`) tenía `on.pull_request.paths` con 15
  paths: un PR que tocara sólo `frontend/src/**` o `server/**` no ejecutaba ningún P1 fuera de `ci` hasta el
  cron `17 3 * * 2`.
- `run-cohort.mjs ci` selecciona por `executionCohorts`; el guard de catálogo exige además
  `ci == unión de las cuatro cohortes current`, así que una promoción a `ci` requiere cohorte current.

## Cambios

- `frontend/e2e/suites/catalog.ts`: los 2 P1 baratos pasan de `extended` a `ci`.
  - pager Usuarios/Roles → `currentCohorts=["visual-contract"]` (contrato de geometría adaptativa desktop, AGENTS.md §7).
  - action bar Logística mobile → `currentCohorts=["public-clinic"]` (igual que `dashboard-clinic-logistica-mobile-parity`).
  - ambos `criticality=P1`, `targetGate="current-ci"`. Assertions, specs y fixtures sin cambios.
- `.github/workflows/e2e-completeness.yml`: se elimina `on.pull_request.paths`. Se conservan `branches: [main]`,
  `workflow_dispatch`, `schedule`, permisos, concurrencia, timeouts, build, production runner, sanitizer,
  upload sanitizado, teardown, higiene, `--workers=2 --retries=2`.
- Guards realineados:
  - `test/architecture/e2e-suite-catalog-completeness.test.ts`: `ci 64→66`, `extended 29→27`,
    `visual-contract 22→23`, `public-clinic 16→17`, unión current y fallback `affected` `64→66`; invariante
    nueva: los 2 promovidos son `P1/current-ci/[ci, full]` y los P1 fuera de `ci` son exactamente A02/A03/A05,
    todos en `full`.
  - `test/unit/infrastructure/e2e-completeness-workflow.test.ts`: `REQUIRED_PULL_REQUEST_PATHS` se reemplaza por
    la prohibición de `paths`/`paths-ignore`/`types` y `Object.keys(on.pull_request) == ["branches"]`;
    `missingSpecs` sin `full` `34→32` (extended 27 + evidence 2 + visual-linux 3).
  - `test/unit/infrastructure/workflow-security-policy-contract.test.ts`: digest canónico de
    `e2e-completeness.yml` `fcd32d73…` → `33343569…`. Verificado: `sha256(HEAD sin líneas 7–22)` =
    `33343569…` = digest del worktree; el único cambio material es el bloque `paths`.

## Cobertura resultante

| P1 | Antes | Después |
|---|---|---|
| pager Usuarios/Roles, action bar Logística | `extended` (sólo PRs con path filter + cron) | `ci` (required `validate-frontend`) + `full` |
| A02 / A03 / A05 | `extended` (sólo PRs con path filter + cron) | `extended` → `full` en E2E Completeness para todo PR a `main` |

A02/A03/A05 no se promueven a `ci`: la fuente rectora sólo promueve los 2 baratos. E2E Completeness no es
required (AGENTS.md §6); su señal para A02/A03/A05 es visible en cada PR pero no bloquea el merge.

## Actualización de base

Entre `bef259f8` y `2b39d15d`, `main` sumó #1723 y #1724, que sólo tocan
`frontend/e2e/clinic/shell/dashboard-clinic-metric-run-parity.spec.ts`. El merge `8ad524f1` no altera los
archivos de este PR (`git diff d2343816 8ad524f1` sobre ellos: vacío) y trae ese spec idéntico a `main`
(`git diff 2b39d15d 8ad524f1` = exactamente los 6 archivos de este PR). Catálogo, workflow y guards no
cambian entre ambas bases.

Revalidado sobre `8ad524f1`:

| Gate | Estado |
|---|---|
| `pnpm --dir frontend e2e:verify-catalog` | PASSED (7/7) |
| Tests infra dirigidos (mismo set que abajo) | PASSED (108/108) |
| Censo P1 desde `E2E_SUITE_CATALOG` | 69 P1; 66 en `ci`; fuera de `ci` sólo A02/A03/A05, los 69 en `full` |
| Prueba negativa del guard de trigger | `[branches]` → PASS; `paths`, `paths-ignore`, `types` o el workflow de `2b39d15d` → FAIL |
| Digest de `e2e-completeness.yml` | `sha256` actual = `33343569…`; `2b39d15d` sin líneas 7–22 = archivo actual |
| `pnpm --dir frontend lint` / `typecheck` | PASSED / PASSED |
| `pnpm typecheck:test` | PASSED |
| Playwright local | NOT_RUN (la tabla siguiente corresponde al árbol de `d2343816`) |

## Validaciones (árbol de `d2343816`)

| Gate | Estado |
|---|---|
| `pnpm --dir frontend e2e:verify-catalog` | PASSED (7/7) |
| Tests infra dirigidos (e2e-completeness-workflow, workflow-security-policy-contract, frontend-ci-workflow, workflow-security-validator-contract, playwright-artifact-sanitizer, frontend-playwright-production-runner, catálogo) | PASSED (108/108) |
| Prueba negativa del guard de trigger | HEAD base `on.pull_request` = `[branches, paths]` → FAIL; worktree `[branches]` → PASS |
| `pnpm --dir frontend typecheck` / `lint` | PASSED / PASSED |
| `pnpm validate:local` | FAILED ambiental: sólo `e2e-global-03b-authoritative-auth-boundary.fastify.test.ts` exige `DATABASE_URL`/`SUPABASE_DB_URL` (4547 pass / 1 fail / 1 skipped); preexistente desde #1711 |
| `pnpm build` (aparte, el encadenado no corrió) | PASSED |
| `pnpm --dir frontend build` con env de CI | PASSED |
| `pnpm security:public-surface` | PASSED |
| Playwright, 2 specs promovidos, `CI=true VETNEB_E2E_PRODUCTION_RUNNER=1` (modo de `e2e:ci`) | PASSED 9/9 (5,7 s) |
| Playwright, 2 specs promovidos, `next dev` local | FAILED ambiental: pager 3/3 PASS; Logística 6/6 `page.goto` timeout 30 s por compilación en frío de `next dev`. `e2e:ci` y `e2e:full` corren bajo `next start` |
| `e2e:full` / `e2e:ci` completos | NOT_RUN localmente (AGENTS.md §7: Playwright completo = 0); los ejecuta CI |
| `git diff --check` | PASSED |

## Riesgos residuales

- Coste: E2E Completeness (~45 min de presupuesto de Playwright, job de 60 min) corre en todo PR a `main`;
  `cancel-in-progress` por ref limita corridas superpuestas. No es required.
- `e2e:ci` suma 9 tests (~53 s auditados en dev; 5,7 s medidos bajo `next start`).
- Un rojo de A02/A03/A05 en E2E Completeness no bloquea merge; cerrar esa brecha exigiría promoverlos o
  hacer required el workflow (fuera de scope).

## No-alcance

`frontend/src/**`, `server/**`, DB, auth/cookies, dependencias, manifiestos, lockfile, Playwright config,
fixtures, assertions de specs, snapshots/baselines, sanitizer, `frontend-ci.yml`, retries, timeouts, workers,
y `E2E-GLOBAL-07..10`.

## Rollback

Revertir el squash de este PR: restaura `paths`, las cohortes `extended` de los 2 specs y los guards/digest
previos. Sin impacto de datos.

## Estado final

Implementado; pendiente de CI sobre el head del PR.
