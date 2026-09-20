# R-20 — Presupuesto de Frontend CI y alineación de push paths

Residual `R-20` del programa `LIMPIEZA E2E` (`docs/audit/LIMPIEZA E2E.md` §22 y §10), entregado
junto con la divergencia hermana de los **push paths de Frontend CI**. Cambio ci-only: dos líneas
semánticas del workflow, la realineación de los guards que las congelaban, el digest revisado de
seguridad y la sincronización del runbook operativo. Sin cambios de producto, backend, fixture,
specs, catálogo ni configuración de Playwright.

> **Estado: `IMPLEMENTED_LOCALLY_PENDING_PR_CI`.** El cierre remoto de R-20 exige el Frontend CI
> real del PR sobre el workflow modificado. Este documento no declara R-20 cerrado, y el cierre
> documental en `docs/audit/LIMPIEZA E2E.md` queda deliberadamente fuera hasta PR → CI verde →
> merge.

## Estado base

| Ítem | Valor |
|---|---|
| Rama | `main` (sin rama nueva: todo el lifecycle Git/GitHub queda para Nico) |
| HEAD base | `480215c41288ad5c1ec89cb3e38197667689c22d` (`docs(e2e): close GLOBAL-09 and R-15 (#1751)`) |
| `origin/main` | `480215c4` (= HEAD; sin `fetch`, `pull` ni `switch`) |
| Working tree inicial | 0 cambios tracked; `frontend/AGENTS.md` y `frontend/CLAUDE.md` untracked (generados por `next dev`, preservados); 5 stashes preexistentes; segundo worktree `C:/PORTAL-VETNEB-E2E06` intacto |
| `AGENTS.md` aplicables | sólo el raíz (único tracked; los de `frontend/` son untracked generados, no son contrato) |
| Clasificación | R2 (CI/workflows), autorizado e implementado localmente por pedido explícito de Nico |
| Escrituras Git/GitHub | 0 — no delegadas |
| Scope primario | `ci` (`.github/workflows/**`); `test/**` es realineación obligatoria del mismo cambio (AGENTS.md §4) y `docs/**` es soporte |

## Scope

**Incluido:**

- `.github/workflows/frontend-ci.yml` — `on.push.paths` + `shared/**`; `frontend-heavy-validation`
  `timeout-minutes: 20 → 45`.
- `test/unit/infrastructure/frontend-ci-workflow.test.ts` — realineación de los guards que
  congelaban el estado anterior.
- `test/unit/infrastructure/workflow-security-policy-contract.test.ts` — digest canónico revisado
  de `frontend-ci.yml`.
- `docs/ops/CI_PR_CHECKS_RUNBOOK.md` — las dos afirmaciones que el cambio vuelve obsoletas.
- Este documento.

**Excluido deliberadamente:**

- `frontend/playwright.config.ts` — el `globalTimeout` de 30 min **no se toca**; es el presupuesto
  que el cambio vuelve alcanzable, no el que se ajusta.
- El detector de impacto de PR (`case` de `detect-frontend-impact`): ya contenía `shared/*`, su
  semántica no cambia.
- `pull_request`: sigue sin `paths` ni `paths-ignore`.
- `scripts/governance/quality-gate-impact-policy.mjs`: la regla `shared-cross-runtime` ya enruta
  `shared/` hacia `backend-ci` y `frontend-ci` → `NO_CHANGE_REQUIRED`.
- `docs/audit/LIMPIEZA E2E.md`: el closeout documental del programa es posterior al merge.
- La deriva de comentarios stale de `frontend/playwright.config.ts` y
  `.github/workflows/e2e-completeness.yml` (Anexo B.7): residual separado y posterior.
- Los demás workflows, `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `shared/**`,
  `server/**`, `frontend/src/**` y `frontend/e2e/**`.

## Problema 1 — R-20: `globalTimeout` inalcanzable

`frontend-heavy-validation` declaraba `timeout-minutes: 20` mientras Playwright corre con un
`globalTimeout` de 30 min (`frontend/playwright.config.ts`, default sin override en Frontend CI).

Consecuencia: GitHub podía cancelar el job **antes** de que Playwright agotara su propio
presupuesto. El `globalTimeout` de 30 min era configuración muerta en el gate required: su
mecanismo de terminación limpia —exit no-cero, cierre de ambos webServers, teardown— nunca llegaba
a ejecutarse, y una corrida colgada terminaba como cancelación de job en vez de como fallo
diagnosticable de Playwright.

Clasificación en el audit: P3 (claridad; el heavy observado es de ≈14,5 min, así que el tope de
20 min no estaba causando cancelaciones reales).

## Problema 2 — push paths desalineados

El detector de impacto de PR ya enrutaba el dominio cross-runtime:

```text
frontend/*|shared/*|pnpm-lock.yaml|pnpm-workspace.yaml|package.json|.github/workflows/frontend-ci.yml|.github/workflows/e2e-completeness.yml
```

pero `on.push.paths` enumeraba esos mismos paths **salvo** `shared/**`. Las dos declaraciones del
mismo criterio estaban desalineadas: un push a `main` que sólo tocara `shared/**` —un contrato
compilado tanto en el bundle backend como en el proxy Next— no disparaba Frontend CI. Bajo branch
protection todo cambio llega por PR, donde el detector sí lo cubre, así que la divergencia era de
coherencia declarativa, no un hueco de cobertura en el camino habitual.

## Diseño elegido: 45 / 30 / 15

```text
FRONTEND_HEAVY_JOB_TIMEOUT = 45 min   (tope duro)
PLAYWRIGHT_GLOBAL_TIMEOUT  = 30 min   (sin cambios)
OUTER_ENVELOPE             = 15 min   (job − Playwright)
```

Se sube el techo del job en lugar de bajar el `globalTimeout` de Playwright: el objetivo es que
Playwright sea quien agote primero su propio presupuesto y termine de forma diagnosticable, no
recortar el margen de la suite. El envelope de 15 min cubre todo lo que Playwright no posee:
checkout, setup de pnpm/Node, install, lint, typecheck, build, auditoría de superficie pública,
instalación de Chromium y —ante fallo o timeout— sanitizer de artefactos, subida de diagnostics y
cierre del job.

Los 45 min son un `HARD_JOB_CEILING`, **no** un objetivo de runtime ni un SLA. Referencia
observada vigente: `frontend-heavy-validation` ≈14,5 min y `e2e:ci` ≈12,7 min.

El mismo patrón ya está en producción en `E2E Completeness` (job 60m − `E2E_GLOBAL_TIMEOUT_MS` 45m
= envelope 15m), con su guard equivalente en
`test/unit/infrastructure/e2e-completeness-workflow.test.ts`. Frontend CI **no** define
`E2E_GLOBAL_TIMEOUT_MS`: `e2e:ci` usa el default del config.

## Archivos modificados

| Archivo | Cambio |
|---|---|
| `.github/workflows/frontend-ci.yml` | +`- 'shared/**'` en `on.push.paths`; `timeout-minutes: 20 → 45` en `validate-frontend` |
| `test/unit/infrastructure/frontend-ci-workflow.test.ts` | `frontendPathFilters` + `shared/**`; guard negativo → guard de alineación; `timeout-minutes: 45`; test nuevo del envelope |
| `test/unit/infrastructure/workflow-security-policy-contract.test.ts` | digest canónico de `frontend-ci.yml` (sólo ese entry) |
| `docs/ops/CI_PR_CHECKS_RUNBOOK.md` | afirmación de push paths y bloque de presupuesto de runtime |
| `docs/implementation/e2e-r20-frontend-ci-budget-path-alignment.md` | este documento (nuevo) |

## Workflow-security review

El digest congelado en `workflow-security-policy-contract.test.ts` **debía** cambiar. Se actualizó
únicamente después de revisar el diff completo del workflow, verificando por lectura:

| Invariante | Estado |
|---|---|
| `permissions` top-level `contents: read` | sin cambios |
| Referencias a actions externas | sin cambios (byte-idénticas) |
| Pins inmutables por SHA | `actions/checkout@3d3c42e5…`, `pnpm/action-setup@0ebf4713…`, `actions/setup-node@82076278…`, `actions/upload-artifact@043fb46d…` (×2) |
| Actions nuevas / refs mutables | 0 |
| Expansión de permisos, secrets, `environment` | 0 |
| `continue-on-error`, relajación de shell | 0 |
| Triggers nuevos, `workflow_dispatch`, `pull_request_target` | 0 |
| Semántica del detector de impacto | sin cambios |
| Jobs y steps distintos del timeout del heavy | sin cambios |

Verificación mecánica: el diff completo son **3 líneas** (`+1 / −1 / +1`) y la superficie de
seguridad (`permissions`, `uses:`, `run:`, `env:`, `shell:`, `if:`, `runs-on`, `name:`) es
byte-idéntica a la del base salvo el corrimiento de una línea.

```text
NEW_FRONTEND_CI_SHA256 = 5fc0539530c806e2133e8e15256f565ad249ab3e69fa131f0afd69808ab84534
OLD_FRONTEND_CI_SHA256 = 3a82fc5faf5d17af0b75bd80e62b30ca5911f553c35d0ac854d473714aa0960d
```

Normalización del digest idéntica a la del test: `readFileSync(..., "utf8").replace(/\r\n/g, "\n")`.
No se tocó ningún otro digest ni ningún pin.

## Realineación de guards

`test/unit/infrastructure/frontend-ci-workflow.test.ts` congelaba dos comportamientos que este
cambio vuelve legítimamente obsoletos. Ninguno se eliminó, se saltó ni se debilitó (AGENTS.md §4).

1. **`frontendPathFilters`** incorpora `- 'shared/**'` en su posición semántica. La lista se usa
   en dos direcciones: exige los paths en `push` y su ausencia en `pull_request`, así que sigue
   protegiendo que el trigger de PR no gane filtros.
2. **Guard negativo → guard de alineación.** El test
   `Frontend CI distingue push path filters del detector de impacto de PR` afirmaba
   `!pushTriggerBlock.includes("'shared/**'")`. Se reemplazó por
   `Frontend CI alinea los push path filters con el detector de impacto de PR`, que ahora compara
   **las dos listas completas** tras normalizar la notación (`frontend/**` de GitHub ↔ `frontend/*`
   del `case` de bash) y exige `deepEqual`. Es estrictamente más fuerte que el original: antes sólo
   se verificaba contención de `shared/*` en el detector; ahora una divergencia en cualquiera de
   los siete paths, en cualquiera de los dos sentidos, rompe el guard. Conserva además la
   afirmación de que `pull_request` no tiene `paths`.
3. **Timeout.** `assertContains(heavy, "timeout-minutes: 20")` → `45`, más un test nuevo
   `Frontend CI reserva un envelope exterior sobre el globalTimeout de Playwright (R-20)` que lee
   el timeout del job y el default de `frontend/playwright.config.ts` con anclas de fuente acotadas
   (sin parser YAML), fija `45` y `30` y exige `job − globalTimeout >= 15m`. Incluye
   `assertNotContains(source, "E2E_GLOBAL_TIMEOUT_MS")`: Frontend CI no puede ganar un override del
   presupuesto sin romper el contrato.

**Prueba de mutación** (en copia aislada fuera del repo, working tree intacto): revertir
`shared/**` hace fallar 2 tests; revertir `45 → 20` hace fallar 2 tests. Los guards no son vacíos.

## Validaciones

| Gate | Estado | Evidencia |
|---|---|---|
| `node --experimental-strip-types --test test/unit/infrastructure/frontend-ci-workflow.test.ts` | PASSED | 17/17 |
| `node --experimental-strip-types --test test/unit/infrastructure/workflow-security-policy-contract.test.ts` | PASSED | 8/8 |
| `node scripts/governance/workflow-security-validator.mjs` | PASSED | `Workflow security validator PASS.` — 7 workflows, 30 external actions, 1 exception (sin excepciones nuevas) |
| `pnpm typecheck:test` | PASSED | — |
| `pnpm validate:local` | ver informe del PR | `test` falla por el 03B Fastify sin `DATABASE_URL`/`SUPABASE_DB_URL` (ambiental, predates este cambio); `pnpm build` se cubre aparte |
| `pnpm --dir frontend e2e:ci` | NOT_RUN | no cambió comportamiento ejecutable de frontend ni de tests: mismos steps, mismos specs, mismo production runner, mismos workers/retries/`globalTimeout`. El Frontend CI real del PR es la evidencia autoritativa del workflow modificado |

## Rollback

Rollback lógico (documentado, **no ejecutado**):

```text
1. .github/workflows/frontend-ci.yml: timeout-minutes 45 → 20
2. .github/workflows/frontend-ci.yml: quitar - 'shared/**' de on.push.paths
3. frontend-ci-workflow.test.ts: quitar shared/** de frontendPathFilters, restaurar el guard
   negativo, volver a "timeout-minutes: 20" y retirar el test del envelope
4. workflow-security-policy-contract.test.ts: restaurar el digest
   3a82fc5faf5d17af0b75bd80e62b30ca5911f553c35d0ac854d473714aa0960d
5. CI_PR_CHECKS_RUNBOOK.md: restaurar las dos afirmaciones previas
```

Un scope, una causa, un rollback: el cambio no acopla producto ni tests de producto.

## Riesgo residual

- **Techo más alto ante cuelgue real.** Si Playwright colgara sin respetar su `globalTimeout`, el
  job tarda hasta 45 min en ser cancelado en vez de 20. Es el precio explícito de que el
  `globalTimeout` sea alcanzable; el envelope de 15 min está dimensionado para que el caso normal
  sea que Playwright termine primero.
- **Más corridas de heavy en push.** Un push directo a `main` que toque sólo `shared/**` ahora
  dispara el heavy. Bajo branch protection ese camino es marginal (todo llega por PR).
- **Ancla de fuente cruzada.** El test del envelope lee el literal del `globalTimeout` de
  `frontend/playwright.config.ts`. Si ese `const` se reescribe, el guard falla con mensaje
  explícito y debe realinearse en el mismo PR — es el comportamiento buscado, no un efecto
  colateral.
- **Fecha de verificación del runbook.** `Last verified date` sigue en `2026-09-16`: este cambio
  no revalidó branch protection ni Actions permissions, así que no se movió la fecha.
- **R-20 no está cerrado remotamente.** Falta el Frontend CI real del PR sobre el workflow nuevo.

## Estado final

```text
R20_IMPLEMENTATION        = COMPLETE_LOCAL
FRONTEND_PUSH_SHARED_PATH = ALIGNED
FRONTEND_HEAVY_TIMEOUT    = 45_MIN
PLAYWRIGHT_GLOBAL_TIMEOUT = 30_MIN
OUTER_ENVELOPE            = 15_MIN
WORKFLOW_SECURITY_REVIEW  = PASSED
R20_REMOTE_CI             = NOT_RUN
GIT_GITHUB_WRITES         = 0
```
