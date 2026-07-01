# PR-VIS-11 - Manual Visual Regression Workflow

## Estado base

- Rama auditada: `ci/pr-vis-11-manual-visual-regression-workflow`.
- Base obligatoria: `d102c9b docs(audit): add visual regression matrix audit (#1208)`.
- Working tree inicial: limpio.
- Tipo de PR: workflow manual y documentacion operativa.

## Objetivo

Agregar un workflow visual manual/no bloqueante para ejecutar bajo demanda la
suite de visual regression existente en Chromium Linux, subir artifacts utiles
para diagnostico y mantener fuera del gate obligatorio de PR cualquier diff
visual hasta reunir evidencia operativa suficiente.

## Scope incluido

- Nuevo workflow manual: `.github/workflows/visual-regression-manual.yml`.
- Documento operativo: `docs/audit/pr-vis-11-manual-visual-regression-workflow.md`.
- Inputs manuales para seleccionar suite, decidir si actualizar snapshots en el
  workspace efimero de CI y controlar la subida de artifacts.

## Scope excluido

- Sin cambios en `server/`.
- Sin cambios en `frontend/src/`.
- Sin cambios en `frontend/e2e/`.
- Sin cambios en specs, snapshots PNG existentes ni fixtures.
- Sin cambios en `package.json`, `frontend/package.json`, lockfiles,
  dependencias, DB, migraciones, Supabase, auth, API, deploy, workflows
  existentes ni `.claude/`.
- Sin `pull_request`, `push`, `schedule`, required status, push automatico, PR
  automatico ni commit de snapshots desde CI.

## Auditoria previa

Archivos inspeccionados en modo solo lectura:

- `docs/audit/pr-vis-10-visual-regression-matrix.md`.
- `docs/audit/pr-vis-9a-implementation.md`.
- `docs/audit/pr-vis-9b-implementation.md`.
- `docs/audit/pr-vis-9c-implementation.md`.
- `.github/workflows/frontend-ci.yml`.
- `.github/workflows/backend-ci.yml`.
- `.github/workflows/app-version-force-update.yml`.
- `frontend/playwright.config.ts`.
- `package.json`.
- `frontend/package.json`.
- `frontend/e2e/visual-regression-public.spec.ts`.
- `frontend/e2e/visual-regression-authenticated.spec.ts`.
- `frontend/e2e/visual-regression-stress.spec.ts`.

Hallazgos aplicados:

- `frontend/playwright.config.ts` define un unico proyecto Playwright:
  `chromium`.
- El repo usa Node `24` y pnpm `10.8.1`.
- `frontend-ci.yml` ya usa `actions/checkout@v7`,
  `actions/setup-node@v6` y `actions/upload-artifact@v7`.
- Los specs visuales existentes cubren 30 snapshots Chromium Linux en tres
  suites: publica, autenticada y stress.
- PR-VIS-10 recomienda Level 2: workflow manual/no bloqueante con artifacts,
  sin gate de PR todavia.

## Por que manual/no bloqueante

El workflow se define solo con `workflow_dispatch`. No declara `pull_request`,
`push` ni `schedule`, por lo que no se ejecuta automaticamente en PRs ni ramas.
Tampoco modifica branch protection ni crea required checks. Esto permite medir
runtime, reproducibilidad y calidad de artifacts antes de convertir la matriz
visual en gate bloqueante.

## Como ejecutarlo desde GitHub Actions

1. Abrir GitHub -> Actions.
2. Seleccionar `Visual Regression Manual`.
3. Elegir `Run workflow`.
4. Seleccionar los inputs.
5. Ejecutar y revisar el resultado del job `visual-regression-<suite>`.
6. Descargar artifacts si el job falla o si se corrio con
   `update_snapshots=true`.

## Inputs

| Input | Default | Uso |
| --- | --- | --- |
| `suite` | `all` | Selecciona que spec visual correr. |
| `update_snapshots` | `false` | Si es `true`, agrega `--update-snapshots` dentro del workspace efimero de GitHub Actions. No hace commit ni push. |
| `upload_artifacts` | `true` | Sube reportes y evidencia PNG disponible para diagnostico. |

## Suites disponibles

| Suite | Spec ejecutado |
| --- | --- |
| `public` | `frontend/e2e/visual-regression-public.spec.ts` |
| `authenticated` | `frontend/e2e/visual-regression-authenticated.spec.ts` |
| `stress` | `frontend/e2e/visual-regression-stress.spec.ts` |
| `all` | Los tres specs anteriores en la misma ejecucion Playwright. |

El workflow ejecuta siempre `--project=chromium` en `ubuntu-latest`, alineado con
las baselines `chromium-linux` versionadas.

## Artifacts esperados

Cuando `upload_artifacts=true`, el workflow intenta subir:

- `frontend/playwright-report/`.
- `frontend/test-results/`.
- `frontend/e2e/**/*.png` cuando `update_snapshots=true` o cuando el job falla.

Los artifacts tienen retencion de 14 dias y usan `if-no-files-found: ignore` para
no fallar por ausencia de reporte o resultados en escenarios parciales.

## Procedimiento ante diff visual

1. Confirmar que la corrida fue manual y en `ubuntu-latest`.
2. Descargar `visual-regression-<suite>-playwright-<run_attempt>`.
3. Revisar `frontend/test-results/` y el HTML report para comparar expected,
   actual y diff.
4. Clasificar el hallazgo como cambio esperado, bug visual, flake o problema de
   entorno.
5. Si es bug visual, corregir producto en un PR separado con scope explicito.
6. Si el cambio es esperado, regenerar snapshots desde el entorno autorizado y
   revisar los PNG antes de versionarlos en un PR separado.
7. Si parece flake o entorno, repetir la corrida manual antes de decidir.

## Cuando usar update_snapshots=true

Usar `update_snapshots=true` solo para diagnostico controlado o para comparar
que snapshots generaria GitHub Actions en Linux. La actualizacion ocurre en el
workspace efimero del job y no persiste en el repositorio porque el workflow no
hace `git add`, `git commit`, `git push` ni crea PRs.

No usarlo como aprobacion automatica de cambios visuales. Todo cambio de
baseline debe revisarse y versionarse manualmente en un PR con scope explicito.

## Por que no es gate CI todavia

PR-VIS-10 identifico pendientes antes de bloquear PRs:

- Medir runtime real de los tres specs visuales en GitHub Actions.
- Confirmar reproducibilidad de los 30 snapshots en CI.
- Confirmar que los artifacts de diff son suficientes para revisar cambios.
- Definir owner y procedimiento formal de aprobacion visual.
- Reducir riesgo de flakes de entorno antes de activar required checks.

## Criterios futuros para convertirlo en gate bloqueante

- Al menos dos corridas limpias consecutivas en `ubuntu-latest`.
- Runtime aceptable y estable para el subset elegido.
- Artifacts completos y suficientes para aprobar o rechazar diffs.
- Cero snapshots `win32` o `darwin` generados por accidente.
- Owner explicito para aceptar cambios visuales.
- Procedimiento documentado de actualizacion de baselines.
- Decision explicita de branch protection/required status en un PR futuro.

## Cambios

- Se agrego el workflow `Visual Regression Manual`.
- Se configuraron inputs `suite`, `update_snapshots` y `upload_artifacts`.
- Se uso Node `24`, `corepack enable`, pnpm con lockfile frozen y Playwright
  Chromium Linux.
- Se agrego subida de artifacts con `actions/upload-artifact@v7`.

## Archivos modificados

- `.github/workflows/visual-regression-manual.yml`.
- `docs/audit/pr-vis-11-manual-visual-regression-workflow.md`.

## Restricciones respetadas

- Workflow solo `workflow_dispatch`.
- Sin `pull_request`, `push` ni `schedule`.
- Sin secrets.
- Sin deploy.
- Sin Supabase.
- Sin publicacion.
- Sin push automatico.
- Sin PR automatico.
- Sin cambios persistentes de snapshots desde CI.
- Sin cambios de codigo/producto, specs, packages, lockfiles, backend, DB,
  migraciones, auth, API, `frontend/src/`, `server/`, `test/` ni `.claude/`.

## Validaciones ejecutadas

Ejecutadas y pasaron:

- `git status --short`: paso, working tree inicial limpio.
- `git branch --show-current`: paso,
  `ci/pr-vis-11-manual-visual-regression-workflow`.
- `git log -1 --oneline`: paso,
  `d102c9b docs(audit): add visual regression matrix audit (#1208)`.
- `git diff --check`: paso, sin salida.
- `git status --short --untracked-files=all`: paso, muestra solo:
  - `?? .github/workflows/visual-regression-manual.yml`
  - `?? docs/audit/pr-vis-11-manual-visual-regression-workflow.md`
- `git diff --stat`: paso, sin salida porque los archivos nuevos siguen
  untracked y no se ejecuto `git add`.
- `git diff --name-only`: paso, sin salida porque los archivos nuevos siguen
  untracked y no se ejecuto `git add`.
- Guardrail de archivos modificados via `git status --short
  --untracked-files=all`: paso, solo los dos archivos esperados.
- Guardrail de rutas prohibidas sobre archivos modificados: paso, sin cambios
  en packages, lockfiles, `frontend/e2e/`, `frontend/src/`, `server/`, `test/`,
  snapshots ni `.claude/`.
- Revision textual del workflow: paso, contiene `workflow_dispatch`,
  `corepack`, `--project=chromium`, `--update-snapshots` condicional y
  `actions/upload-artifact@v7`.
- Revision textual de triggers prohibidos en el workflow: paso, sin
  `pull_request`, `push`, `schedule`, `workflow_call`, secrets, deploy,
  `git push` ni `gh pr`.
- Revision ASCII de los archivos nuevos: paso, sin caracteres no ASCII.

Validador YAML local:

- No ejecutado porque no hay validador disponible sin instalar dependencias:
  `yq`, `yamllint`, `ConvertFrom-Yaml`, `ruby`, `node_modules/yaml` y
  `node_modules/js-yaml` no existen en el entorno local.
- No se instalaron dependencias nuevas.

Validaciones no ejecutadas:

- `pnpm test`, `pnpm build`, `pnpm security:public-surface`,
  `pnpm --dir frontend lint`, `pnpm --dir frontend typecheck` y
  `pnpm --dir frontend build`: no ejecutadas por scope workflow/docs-only, sin
  cambios de codigo producto, frontend, backend, specs, snapshots, packages ni
  lockfiles.

## Resultado

- Workflow manual/no bloqueante creado.
- Documento operativo creado.
- No se modifico codigo de producto.
- No se modificaron specs ni snapshots.
- No se modificaron packages ni lockfiles.
- El workflow no corre en `pull_request`, `push` ni `schedule`.
- El workflow corre solo por `workflow_dispatch`.
- Working tree con solo los dos archivos esperados.

## Riesgo residual

- El primer uso real puede revelar diferencias de entorno de GitHub Actions que
  no fueron visibles en WSL/local.
- `update_snapshots=true` puede producir PNG utiles para diagnostico dentro del
  artifact, pero no reemplaza revision humana ni versionado manual.
- El workflow sigue sin ser evidencia suficiente para activar un gate bloqueante
  hasta tener corridas limpias y runtime medido.

## Estado final

- Implementacion PR-VIS-11 completa dentro del scope autorizado.
- Cambios listos para revision manual de Nico.
- No se ejecuto `git add`, `git commit`, `git push`, `gh pr create`, merge ni
  checks de GitHub CLI.
