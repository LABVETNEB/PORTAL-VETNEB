# STAGE_B2 — Realineación del comentario de `trace` en E2E Completeness

Segunda mitad del residual **"Drift de comentarios"** de `docs/audit/LIMPIEZA E2E.md` §B.7
(`playwright.config.ts` líneas 13–17 y 69–70 **y** `e2e-completeness.yml` línea 214). STAGE_B1
cerró la mitad `config-only` en `docs(e2e): realign Playwright runner comments (#1754)`; este
cambio cierra la mitad `ci-only`: el comentario de `.github/workflows/e2e-completeness.yml`
todavía afirmaba que `--retries=2` vuelve efectivo `trace: on-first-retry`, cuando la
configuración ejecutable selecciona `retain-on-failure` en ese workflow.

Cambio **comment-only**: dos líneas de comentario sustituidas por tres, la realineación
obligatoria del digest canónico de seguridad que congelaba el archivo, y este documento. Cero
bytes ejecutables del workflow modificados.

> **Estado: `IMPLEMENTED_LOCALLY_PENDING_PR_CI`.** STAGE_B2 no está cerrado remotamente: falta el
> lifecycle manual de Git/GitHub, los checks required del PR y el merge. El closeout documental en
> `docs/audit/LIMPIEZA E2E.md` §B.7 queda deliberadamente fuera hasta después del merge.

## Estado base

| Ítem | Valor |
|---|---|
| Rama | `main` (sin rama nueva: todo el lifecycle Git/GitHub queda para Nico) |
| HEAD base | `2d0638d5d22eabb827041564776a7896bb99278a` (`docs(e2e): realign Playwright runner comments (#1754)`) |
| Working tree inicial | 0 cambios tracked; 0 staged; `frontend/AGENTS.md` y `frontend/CLAUDE.md` untracked (generados por `next dev`, preservados); 5 stashes preexistentes intactos; segundo worktree `C:/PORTAL-VETNEB-E2E06` intacto |
| `AGENTS.md` aplicables | sólo el raíz (único tracked; los de `frontend/` son untracked generados, no son contrato) |
| Actor | Nico autoriza y delega la implementación local; el agente no ejecuta Git/GitHub |
| Clasificación | R2 (CI/workflows, AGENTS.md §3.1) |
| Scope primario | `ci-only` (`.github/workflows/**`) |
| Escrituras Git/GitHub | 0 |

## Scope

**Incluido:**

- `.github/workflows/e2e-completeness.yml` — comentario de las líneas 214–215 corregido.
- `test/unit/infrastructure/workflow-security-policy-contract.test.ts` — digest canónico revisado,
  **sólo** el entry de `e2e-completeness.yml`.
- Este documento.

`test/**` aquí **no** es un segundo scope primario: es la realineación obligatoria del guard que el
cambio in-scope rompe legítimamente (AGENTS.md §4). El digest congela el archivo byte a byte, así
que cualquier modificación —incluida una de comentario— lo invalida por construcción. No se
debilitó, no se silenció y no se marcó skip.

**Excluido deliberadamente:**

- `frontend/playwright.config.ts` — ya corregido por STAGE_B1 (#1754); es la fuente ejecutable que
  este comentario pasa a reflejar, no algo que se ajuste aquí.
- `test/unit/infrastructure/frontend-ci-workflow.test.ts` y
  `test/unit/infrastructure/frontend-playwright-production-runner.test.ts` — drift de comentarios
  test-only reportado por B1, independiente de este cambio y no necesario para realinear el digest.
- `test/unit/infrastructure/e2e-completeness-workflow.test.ts` — **hallazgo nuevo** de esta etapa
  (ver "Riesgo residual"): su comentario de líneas 368–369 repite la misma afirmación falsa. Es
  test-only, no lo exige el digest y no entra en el scope nominal de 3 archivos.
- `scripts/governance/quality-gate-impact-policy.mjs`, `test/README.md`,
  `docs/audit/LIMPIEZA E2E.md`, `docs/governance/enterprise-control-register.md`, `docs/qa/README.md`.
- Los demás workflows y sus digests, `package.json`, `pnpm-lock.yaml`, `server/**`,
  `frontend/src/**` y `frontend/e2e/**`.

## Problema

El comentario que precede al step `Sanitize Playwright diagnostics` afirmaba:

```yaml
# --retries=2 makes trace: on-first-retry real here; raw traces carry cookies
# and auth headers, so only the sanitized staging copy may be uploaded.
```

La primera cláusula es falsa. La cadena ejecutable real es:

```text
E2E Completeness
  → Build frontend
  → step "Run complete cataloged E2E suite"
      env VETNEB_E2E_PRODUCTION_RUNNER: "1"
      run pnpm --dir frontend e2e:full -- --workers=2 --retries=2

frontend/playwright.config.ts
  → isCi = (CI === "true")                                    → true en GitHub Actions
  → isProductionRunner = isCi && VETNEB_E2E_PRODUCTION_RUNNER === "1"  → true
  → trace = !isCi ? "off" : isProductionRunner ? "retain-on-failure" : "on-first-retry"
```

`isProductionRunner` selecciona la rama `retain-on-failure` **independientemente de los retries**:
`--retries=2` no participa de esa condición. En E2E Completeness `on-first-retry` no se selecciona
nunca, así que el comentario describía una política de trazas que ese workflow no ejecuta.

La afirmación de seguridad subordinada seguía siendo correcta y no cambia: bajo
`retain-on-failure` Playwright graba una traza en cada corrida y conserva las de las corridas que
fallan, de modo que las trazas crudas que sobreviven siguen llevando cookies y headers de auth y
siguen exigiendo el sanitizer.

Este drift ya estaba registrado como residual abierto en `docs/audit/LIMPIEZA E2E.md` §B.7 y
declarado fuera de scope por `docs/implementation/e2e-r20-frontend-ci-budget-path-alignment.md`
("residual separado y posterior").

## Cambio

```yaml
# The production runner uses trace: retain-on-failure even with --retries=2;
# raw traces that survive carry cookies and auth headers, so only the
# sanitized staging copy may be uploaded.
```

El wording nuevo:

- no atribuye `on-first-retry` a E2E Completeness;
- nombra el mecanismo real (production runner) y su independencia de los retries, en la misma
  lengua que el bloque ya corregido de `frontend/playwright.config.ts` (B1);
- no introduce ninguna afirmación de ahorro ni de performance;
- conserva intacto el motivo de seguridad del sanitizer.

Permanecen verdaderos y verificados por lectura sobre el archivo resultante: las trazas crudas
pueden contener cookies y headers de auth; sólo la copia sanitizada puede subirse; el upload sigue
fail-closed (`failure() && steps.sanitize-playwright-artifacts.outcome == 'success'`); y el step de
sanitización sigue bajo `if: failure()`.

## Workflow-security review

El digest de `workflow-security-policy-contract.test.ts` **debía** cambiar. Se actualizó únicamente
después de revisar el diff completo y de demostrar —no suponer— que el cambio es comment-only.

**Prueba 1 — textual.** Todas las líneas `+`/`-` del diff del workflow son líneas de comentario:

```text
git diff -U0 -- .github/workflows/e2e-completeness.yml
  | grep '^[+-]' | grep -v '^\(+++\|---\)' | grep -v '^[+-][[:space:]]*#'
  → salida vacía
```

**Prueba 2 — semántica.** Los documentos YAML del base y del head, parseados con el mismo
`js-yaml` y las mismas opciones que usan los guards del repositorio
(`CORE_SCHEMA.withTags(mergeTag)`, `maxAliases: 0`), son `deepStrictEqual`:

```text
PARSED_YAML_DEEP_EQUAL = YES
```

**Prueba 3 — campo por campo.** Comparación mecánica base ↔ head sobre el documento parseado:

| Campo | Estado |
|---|---|
| `name` | NO CHANGE |
| `on` (triggers: `pull_request.branches`, `workflow_dispatch`, `schedule`) | NO CHANGE |
| `permissions` (`contents: read`) | NO CHANGE |
| `concurrency` | NO CHANGE |
| `jobs` (claves) | NO CHANGE |
| `runs-on` | NO CHANGE |
| `timeout-minutes` del job | NO CHANGE |
| Nombres y orden de los steps | NO CHANGE |
| `uses:` por step | NO CHANGE |
| Pins SHA de actions (conjunto ordenado) | NO CHANGE |
| `run:` por step | NO CHANGE |
| `env:` por step (`E2E_GLOBAL_TIMEOUT_MS`, `VETNEB_E2E_PRODUCTION_RUNNER`, build env) | NO CHANGE |
| `if:` por step | NO CHANGE |
| `with:` por step (incl. `path`, `retention-days`) | NO CHANGE |
| `timeout-minutes` por step | NO CHANGE |
| `shell:` por step | NO CHANGE |
| `id:` por step | NO CHANGE |
| Step `Sanitize Playwright diagnostics` (completo) | NO CHANGE |
| Step `Upload Playwright diagnostics` (completo) | NO CHANGE |

No se añadieron actions, no se movieron refs a versiones mutables, no se ampliaron permisos, no se
introdujeron `secrets`, `environment` ni `continue-on-error`, y no se tocó el comando del
sanitizer ni los paths del artefacto.

```text
OLD_E2E_COMPLETENESS_SHA256 = 3334356940263f522a7792ae8ffca45069011bbb6fc25feb82709707bcfd38e8
NEW_E2E_COMPLETENESS_SHA256 = 094f77b4cbe637073d1b03a01f1ebd37cee7af552aea45808d04da122dc1e3dd
CANONICAL_WORKFLOW_DIGESTS_CHANGED = 1
```

Normalización idéntica a la del guard: `readFileSync(..., "utf8").replace(/\r\n/g, "\n")` +
`createHash("sha256").update(source, "utf8").digest("hex")`. Se verificó además que el digest base
coincidía con el archivo base antes de editar (baseline limpio), y que ningún otro entry del mapa
se modificó.

## Validaciones

| Gate | Estado | Evidencia |
|---|---|---|
| `git diff --check` | PASSED | sin whitespace errors |
| `node --test test/unit/infrastructure/workflow-security-policy-contract.test.ts` | PASSED | 8/8 |
| `node --test test/unit/infrastructure/e2e-completeness-workflow.test.ts` | FAILED (ambiental, preexistente) | 7/9; los 2 fallos son la clase win32 del launcher (#1748). **A/B ejecutado**: el mismo test contra el workflow base pristino da 7/9 idéntico ⇒ no lo causa este cambio |
| `node scripts/governance/workflow-security-validator.mjs` | PASSED | `Workflow security validator PASS.` — 7 workflows, 30 external actions, 1 exception (sin excepciones nuevas) |
| `pnpm typecheck` | PASSED | vía `validate:local` |
| `pnpm typecheck:test` | PASSED | exit 0 |
| `pnpm test` | FAILED (ambiental, preexistente) | 4588 tests, 4578 pass, **9 fail**: 8 guards win32 del launcher de webServer (#1748) + 1 integración Fastify 03B sin `DATABASE_URL`/`SUPABASE_DB_URL` (#1711). Verdes en Linux CI |
| `pnpm build` | PASSED | `dist/index.js` 918.2kb (ejecutado aparte: `validate:local` aborta en `test` antes de llegar a `build`) |
| `pnpm validate:local` | FAILED (ambiental) | cadena `typecheck && typecheck:test && test && build`; corta en `test` por los 9 fallos ambientales de arriba |
| Cohortes E2E / `e2e:full` | NOT_RUN | cambio comment-only sin efecto ejecutable: mismos steps, mismos comandos, mismos env, mismo production runner, mismos workers/retries. El `E2E Completeness` real del PR es la evidencia autoritativa |

Los 9 fallos de `pnpm test` son la línea base conocida de esta máquina Windows y **preceden** a este
cambio: ninguno lee el digest ni la estructura del workflow. Los dos que sí viven en
`e2e-completeness-workflow.test.ts` se verificaron por A/B contra el archivo base pristino, con el
working tree restaurado y el digest re-verificado después.

## Rollback

Rollback lógico (documentado, **no ejecutado**):

```text
1. .github/workflows/e2e-completeness.yml: restaurar las dos líneas de comentario previas
   (# --retries=2 makes trace: on-first-retry real here; ...)
2. workflow-security-policy-contract.test.ts: restaurar el digest
   3334356940263f522a7792ae8ffca45069011bbb6fc25feb82709707bcfd38e8
3. Eliminar este documento
```

Un scope, una causa, un rollback. El cambio no acopla producto, backend, specs ni configuración de
Playwright, y su reversión no altera ningún comportamiento de CI porque no altera ninguno al
aplicarse.

## Riesgo residual

- **Hallazgo nuevo, no corregido aquí.** `test/unit/infrastructure/e2e-completeness-workflow.test.ts`
  líneas 368–369 repiten la misma afirmación falsa
  (`--retries=2 makes on-first-retry traces real here`). Es drift test-only, no lo exige el digest y
  queda fuera del scope nominal de STAGE_B2. Se suma a los dos ya reportados por B1
  (`frontend-ci-workflow.test.ts`, `frontend-playwright-production-runner.test.ts`): son **tres** los
  comentarios stale test-only pendientes de un scope test-only posterior.
- **Residual §B.7 aún abierto documentalmente.** `docs/audit/LIMPIEZA E2E.md` sigue listando el
  drift de comentarios como OPEN y nombrando la línea 214. Su cierre es posterior al merge y de
  scope docs-only.
- **Riesgo ejecutable de este cambio: ninguno.** El workflow parseado es `deepStrictEqual` al del
  base; no hay superficie de comportamiento que pueda regresionar.
- **STAGE_B2 no está cerrado remotamente.** Falta PR, los cuatro contextos required y el merge.

## Estado final

```text
FINALIZATION_STAGE                 = STAGE_B2
BASE_SHA                           = 2d0638d5d22eabb827041564776a7896bb99278a
WORKFLOW_COMMENT_ONLY              = YES
WORKFLOW_EXECUTABLE_CHANGE         = 0
PARSED_YAML_DEEP_EQUAL             = YES
CANONICAL_WORKFLOW_DIGESTS_CHANGED = 1
WORKFLOW_SECURITY_REVIEW           = PASSED
FILES_CHANGED                      = 3
GIT_GITHUB_WRITES                  = 0
IMPLEMENTATION_STATUS              = IMPLEMENTED_LOCALLY_PENDING_PR_CI
```
