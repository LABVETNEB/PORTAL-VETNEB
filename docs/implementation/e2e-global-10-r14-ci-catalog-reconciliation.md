# E2E-GLOBAL-10 · R-14 CI — Runner visual `dev` guiado por el catálogo

Mitad CI de R-14 del programa `LIMPIEZA E2E` (`docs/audit/LIMPIEZA E2E.md` §8 P1-6, §15.2, §22
R-14). PR #1729 (GLOBAL-10A, mitad test-only) la dejó declarada como `CI_SPLIT_REQUIRED: YES`
(`docs/implementation/e2e-global-10a-cleanup-governance.md`). Este cambio la cierra. GLOBAL-10B /
R-18 (alineación documental global) no forma parte de este cambio.

## Estado base

| Ítem | Valor |
|---|---|
| Rama | `ci/e2e-global-10-r14-visual-catalog` |
| Base | `main@52314191d443954d869c1406d3e0e84cdda33553` (`#1729`), idéntico a `origin/main` |
| Working tree inicial | limpio salvo `frontend/AGENTS.md` y `frontend/CLAUDE.md` (generados por `next dev`, untracked, preservados y no commiteados); 5 stashes preexistentes intactos |
| `AGENTS.md` aplicables | sólo el raíz (único tracked) |
| Clasificación | R2 (CI/workflow), autorizado y delegado por Nico |
| Scope primario (`pr-governance`) | `workflows/CI`; `test/**` y `docs/**` son soporte |
| Entorno | Windows 11, Node 24.14.1, pnpm 11.13.0 |

## Problema

`visual-regression-manual.yml` tenía dos modelos de selección:

- `production-candidate` ya dependía del catálogo: `e2e:visual-production-candidate` →
  `selectSuiteSpecs()` → `E2E_COHORT_SPECS["visual-linux"]`.
- `dev` enumeraba a mano, en un `case "${VISUAL_SUITE}"`, las rutas de
  `visual-regression-public`, `-authenticated` y `-stress`.

Era una segunda fuente de verdad: si se agregaba una cuarta entrada `visual-linux`, un runner la
ejecutaba y el otro la salteaba. El guard de GLOBAL-10A detectaba esa divergencia, pero no podía
eliminarla sin tocar el workflow.

## Auditoría previa

- `selectSuiteSpecs(suite, visualSpecs = E2E_COHORT_SPECS["visual-linux"])` ya cubre lo que
  necesita el runner `dev`: `all` devuelve la cohorte completa; cada suite individual necesita
  exactamente una coincidencia `/visual-regression-<suite>.spec.ts`; y la cohorte vacía lanza error.
- Importar `visual-production-candidate.mjs` no tiene efectos secundarios: `main()` sólo corre
  cuando `process.argv[1]` es el propio script, y `run-cohort.mjs` y
  `compare-visual-artifacts.mjs` usan la misma protección. Con `node --eval`, `argv[1]` no está
  definido. `visual-production-candidate-contract.test.ts` ya verifica que el import no altere
  `process.exitCode`.
- `catalog.ts` se carga con el type stripping de Node 24, que viene activado por defecto. Es el
  mismo mecanismo que `e2e:visual-production-candidate` (`node e2e/scripts/…`) usa en CI con
  `node-version: 24`.
- No hacía falta ningún helper ni flag nuevo. Agregar un modo `--list-specs` al script del
  candidato habría cambiado su contrato de argumentos (sus flags no llegan a Playwright), que
  tiene su propio test.

## Cambio

```text
catalog.ts
  → E2E_COHORT_SPECS["visual-linux"]
  → selectSuiteSpecs()            (frontend/e2e/scripts/visual-production-candidate.mjs)
      ├── production-candidate    (e2e:visual-production-candidate, sin cambios)
      └── dev                     (node --eval importa el mismo resolver)
```

Paso `Run selected visual regression suite` (sólo `runner == 'dev'`):

1. Mantiene sin cambios el preflight de Linux y `set -euo pipefail`.
2. `node --input-type=module --eval '…' > "${RUNNER_TEMP}/visual-dev-specs"`: importa el
   resolver, rechaza cualquier `VISUAL_SUITE` fuera de `VISUAL_SUITES`, llama a
   `selectSuiteSpecs(suite)` con la cohorte por defecto del catálogo, verifica que cada spec exista
   bajo `frontend/` y escribe cada ruta terminada en NUL. Ante cualquier error emite `::error::` y
   sale con 1; la redirección conserva ese exit code bajo `set -e`.
3. `mapfile -d '' -t specs` lee el archivo. El delimitador NUL es seguro con espacios o saltos de
   línea en los nombres, y un fallo del resolver no se pierde, como pasaría con una sustitución de
   proceso.
4. Si el array queda vacío, el paso falla con exit 1.
5. La línea `cmd=(corepack pnpm --dir frontend exec playwright test "${specs[@]}" --project=chromium)`
   no cambia; `visual-production-candidate-contract.test.ts` la ancla como precondición.

Sin cambios: triggers, `workflow_dispatch.inputs` (`suite` sigue siendo `all/public/authenticated/stress`
y su lista estática la prueba el guard contra `VISUAL_SUITES`), `permissions: contents: read`, pins
SHA de las actions, `timeout-minutes: 45` y los 20 minutos del candidato, el rechazo de
`update_snapshots`, el paso de producción, la sanitización y los uploads.

## Guards

`test/unit/infrastructure/visual-regression-workflow-catalog.test.ts` se reescribió para verificar
el estado final. Tenía 4 tests y ahora tiene 5.

| Test | Qué demuestra |
|---|---|
| sin lista de specs | `workflowSpecLiterals(workflow)` = `[]` en todo el archivo; contratos estructurales de `dev` y del candidato sin fallos |
| resolución idéntica | el snippet se **extrae del YAML parseado y se ejecuta**: `all` = `E2E_COHORT_SPECS["visual-linux"]` = `selectSuiteSpecs("all")`; cada suite individual = su único spec; las tres suites individuales dan specs distintos y, juntas, la cohorte completa (`VISUAL_SUITE` realmente dirige la selección) |
| fail-closed | `""`, `bogus`, `ALL`, `all `, `print`, `../public` y `public.spec.ts` salen distinto de 0, sin stdout y con `::error::`; `selectSuiteSpecs(…, [])` lanza error |
| vocabulario | `inputs.suite.options` = `VISUAL_SUITES`, `type: choice`, `default: all`, `VISUAL_SUITE: ${{ inputs.suite }}`; una suite por spec más `all`; toda entrada `visual-linux` es `platform: linux` |
| mutaciones | ver abajo |

Mutation proofs (cada uno debe producir un fallo concreto):

1. `specs+=("…public.spec.ts")` reintroducido → literal detectado y asignación de array literal.
2. Resolver reemplazado por el `case` hardcodeado → `found 0`, `branch on the suite by hand` y literal.
3. `process.env.VISUAL_SUITE` reemplazado por `"all"` → fallo estructural, y la ejecución deja de
   seguir la suite; `VISUAL_SUITE: all` en el job → fallo de vocabulario.
4. Resolver eludido: `const specs = []`, `selectSuiteSpecs(suite, [])`, import de otro módulo o
   validación de suite removida.
5. Resolver removido, lectura por newline en vez de NUL, guard de vacío removido,
   `${specs[*]}` en vez del argv array, `set -uo pipefail` o paso renombrado.
6. Un literal `.spec.ts` en cualquier otra parte del workflow (env del job).
7. Opción de suite extra (`print`) o `VISUAL_SUITES` divergente.
8. El paso del candidato con un `--spec …spec.ts` literal.

El workflow anterior (`main@52314191`) evaluado con el guard nuevo devuelve 4 fallos estructurales
y 6 literales: el guard no acepta la lista manual.

`test/unit/infrastructure/workflow-security-policy-contract.test.ts`: se realineó el digest
SHA-256 canónico de `visual-regression-manual.yml` (`1f4f5a80…` → `93b70929…`). Es la
realineación que exige el propio contrato para cualquier cambio de workflow, y ninguna otra
aserción cambió.

No se modificó `visual-production-candidate-contract.test.ts`: sigue cubriendo el resolver (`all`,
suites individuales, `unknown`), la política de snapshots canónicos y la línea `cmd=(…)`.

## Validaciones

| Gate | Estado | Evidencia |
|---|---|---|
| `node --test` dirigido (catálogo visual, contrato del candidato, política de seguridad, validador de seguridad, sanitizer) | PASSED | 81/81 |
| Paso `dev` real extraído del YAML con un `corepack` falso que imprime argv (Git Bash) | PASSED | `all` → 3 argumentos separados en orden de catálogo; `stress` → 1; `bogus`/vacío → `::error::` exit 1; no-Linux → exit 1; salida vacía del resolver → `::error::` exit 1 |
| Guard nuevo contra el workflow anterior (`main@52314191`) | PASSED (rechazo) | 4 fallos estructurales + 6 literales |
| `pnpm typecheck` | PASSED | dentro de `validate:local` |
| `pnpm typecheck:test` | PASSED | dentro de `validate:local` |
| `pnpm test` (raíz) | FAILED · causa ambiental preexistente | 4.566 tests: 4.564 pass / 1 fail / 1 skipped. El único fallo es `test/integration/app/e2e-global-03b-authoritative-auth-boundary.fastify.test.ts` (`requiere DATABASE_URL o SUPABASE_DB_URL`); el diff no toca `server/` ni `test/integration/`. El skip es el de symlink en Windows. El guard R-14 pasó de 4 a 5 tests |
| `pnpm validate:local` | FAILED | por la fase `pnpm test` anterior; su `build` encadenado no llegó a correr |
| `pnpm build` (backend, aparte) | PASSED | `dist/index.js` 918,2 kb |
| `pnpm --dir frontend lint/typecheck/build`, `security:public-surface`, cohortes E2E | NOT_RUN | no hay paths de `frontend/` cambiados; el runner visual es sólo dispatch manual |
| `git diff --check` | PASSED | |
| `e2e:visual-linux` / runner visual | BLOCKED | baselines Chromium-Linux; win32 por diseño |
| `db:migrate` | BLOCKED | sin DB local |

Incidente de validación, registrado sin omitirlo: en la primera prueba del paso bash, la ruta
`C:/…` del `corepack` falso se partió en el `:` del `PATH`, así que se ejecutó el `corepack` real.
Corrió Playwright visual bajo `next dev` en win32: `public` escribió 10 PNG `-chromium-win32`
nuevos y `authenticated`/`stress` se saltearon por su guard de plataforma. Esa corrida **no** es
evidencia visual. Los 10 PNG untracked se eliminaron uno por uno. Los baselines Linux quedaron
intactos, `next-env.d.ts` no cambió y no quedaron procesos escuchando en 3000/3107. La corrida sí
confirmó de punta a punta que los specs resueltos llegan a Playwright y que su exit code se
propaga.

## Riesgo residual

1. El runner `dev` sólo se ejecuta por `workflow_dispatch` (`[MANUAL-NICO]`,
   `gh workflow run` es NO-DELEGABLE). La ejecución en Ubuntu queda pendiente hasta ese dispatch;
   la evidencia local cubre el snippet y el bash, no el runner de GitHub.
2. El contrato de la parte bash es estructural (el repositorio no tiene precedente de tests que
   lancen bash, y `validate-backend` también corre localmente en win32); el snippet Node sí se
   ejecuta en el test.
3. La lista `workflow_dispatch.inputs.suite.options` sigue siendo estática por limitación de
   GitHub Actions; el guard la mantiene igual a `VISUAL_SUITES`.

## Rollback

- Disparador: fallo del runner `dev` en un dispatch manual atribuible a este cambio.
- Pasos: PR de revert del squash (workflow, guard, digest y este documento juntos).
- Impacto de datos: ninguno. No cambian snapshots, producto ni backend.

## No-alcance

GLOBAL-10B / R-18 (`CI_PR_CHECKS_RUNBOOK.md`, `SOURCES_OF_TRUTH.md`, audits obsoletos, estado final
de `LIMPIEZA E2E.md`), producto, backend, DB, dependencias/lockfile, snapshots/baselines, otros
workflows, el RFC `docs/architecture/e2e-visual-production-candidate-rfc.md` (vigente, no se
modifica) y el merge del PR.

## Estado final

R-14 CI implementado: el workflow no nombra ningún spec, y ambos runners resuelven la cohorte
`visual-linux` mediante `selectSuiteSpecs()`. Con esto, R-14 queda cerrado en sus dos mitades
(10A test-only y este cambio CI).
