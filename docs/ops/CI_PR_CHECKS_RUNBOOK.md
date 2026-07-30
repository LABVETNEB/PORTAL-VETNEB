# CI PR Checks Runbook

| Campo | Valor |
| --- | --- |
| Document owner | CI owner |
| Domain | CI/CD and Pull Request Governance |
| Lifecycle status | ACTIVE |
| Authoritative source role | Mapa operativo de checks efectivos y criterios antes de merge |
| Effective date | 2026-07-28 |
| Last verified date | 2026-07-30 |
| Review cadence | Mensual y ante cambios de workflows, jobs o branch protection |
| Supersedes | Versión que documentaba dos required checks globales y clasificaba los gates funcionales como no required |
| Superseded by | Ninguno |
| Related controls or gaps | `ERM-CTRL-013`; `ERM-CTRL-014`; `ERM-CTRL-015`; `ERM-CI-001`; `ERM-CI-002` |
| Evidence or approval reference | PR #1601 y canarias #1602/#1603; PR #1605 y su validación stale-base; canarias #1616 y #1618 del bloque 05; workflows locales, branch protection de `main` y Actions permissions verificadas en modo read-only el 2026-07-30 |

## Objetivo

Documentar cómo verificar los checks de GitHub Actions en pull requests de Portal VETNEB sin confundir:

- el gate global requerido por branch protection;
- workflows/contextos siempre presentes y jobs pesados condicionales por impacto;
- integraciones externas que pueden aparecer como `SKIPPED`;
- estados transitorios de GitHub CLI con ausencia real de CI.

## Mapa de checks vigente

| Check / integración | Clase | Aplica a | Required efectivo | Estado esperado |
| --- | --- | --- | --- | --- |
| `validate-pr-governance` | Required global | Todos los PR hacia `main` | Sí | `SUCCESS` antes de merge |
| `qga-workflow-security` | Required global | Todos los PR hacia `main` | Sí | `SUCCESS` antes de merge |
| `validate-backend` | Required funcional; contexto always-run | Todos los PR hacia `main`; heavy condicional por impacto | Sí | `SUCCESS` en todos los PR hacia `main` |
| `validate-frontend` | Required funcional; contexto always-run | Todos los PR hacia `main`; heavy condicional por impacto | Sí | `SUCCESS` en todos los PR hacia `main` |
| Supabase Preview | Integración externa | Paths administrados por la integración | No | `SUCCESS` cuando aplica; `SKIPPED` legítimo cuando no aplica |

La presencia de un workflow o job en el árbol no lo vuelve required. La fuente efectiva para esa
clasificación es branch protection de `main`, verificada el 2026-07-30 con exactamente estos
cuatro contextos y sus app IDs:

```text
strict: true

validate-pr-governance   app_id 15368
qga-workflow-security    app_id 4291335
validate-backend         app_id 15368
validate-frontend        app_id 15368
```

La evidencia durable del bloque 05, incluidas la canaria positiva #1616 y la canaria negativa
#1618, se conserva en
[PR-CI-REQUIRED-CHECKS Audit](../audit/pr-ci-required-checks-audit.md).

## GitHub Actions repository policy

Política efectiva del repositorio verificada el 2026-07-30:

```text
allowed_actions: selected
sha_pinning_required: true
github_owned_allowed: true
verified_allowed: false
patterns_allowed:
  - pnpm/action-setup@*
default_workflow_permissions: read
can_approve_pull_request_reviews: false
```

El allowlist no reemplaza el pinning SHA: ambos controles aplican simultáneamente. El allowlist
decide qué actions pueden invocarse; el pinning obliga a invocarlas por una referencia inmutable
de 40 hexadígitos. Una action allowlisted sin pinnear sigue siendo rechazada, y una action
pinneada fuera del allowlist también.

`default_workflow_permissions: read` fija el permiso predeterminado de `GITHUB_TOKEN`. Un
workflow que necesite escritura debe declararla explícitamente en su propio scope y queda sujeto
a `qga-workflow-security`, que exige `contents: read` a nivel top-level.

## PR Governance

`PR Governance` corre en todos los pull requests hacia `main`.

El job requerido se denomina exactamente:

```text
validate-pr-governance
```

Branch protection exige ese contexto con strict status checks.

Valida:

- integridad del diff;
- política de archivos sensibles;
- secretos en líneas agregadas;
- Markdown y enlaces locales;
- metadata mínima del PR;
- clasificación y coherencia de scope.

No mergear si este job aparece como:

- `QUEUED`;
- `IN_PROGRESS`;
- `FAILURE`;
- `CANCELLED`;
- `TIMED_OUT`;
- ausente cuando el PR apunta a `main`.

## QGA Workflow Security

`QGA Governance` corre en todos los pull requests hacia `main` mediante `pull_request_target`.
Ejecuta el validador confiable de la rama base sobre el head candidato tratado como datos inertes.

El contexto requerido se denomina exactamente:

```text
qga-workflow-security
```

Valida, entre otros controles:

- actions externas pinneadas a SHA de 40 caracteres y repositorios allowlisted;
- permisos top-level exactamente `contents: read`;
- referencias locales restringidas a `.github/actions`;
- imágenes de contenedor por digest o excepción exacta gobernada;
- YAML parseable sin aliases.

Un fallo, cancelación, timeout o ausencia de este contexto bloquea el merge. Su éxito prueba la
política de seguridad de workflows; no reemplaza typecheck, tests, builds ni E2E funcionales.

## Backend CI

Backend CI se crea en todos los pull requests hacia `main`. Su detector liviano
`detect-backend-impact` separa la presencia estable del contexto de la ejecución del job pesado.
El impacto se calcula sobre el rango efectivo del pull request, no sobre la comparación directa
base/head (ver [Rango de comparación del pull request](#rango-de-comparación-del-pull-request)):

```text
docs-only respecto del rango efectivo:
  detect-backend-impact: success
  backend-heavy-validation: skipped
  validate-backend: success

cambio no documental/backend en el rango efectivo:
  detect-backend-impact: success
  backend-heavy-validation: ejecutado
  validate-backend: refleja el resultado del heavy
```

También soporta push hacia `main` y hacia ramas:

- `chore/**`;
- `feat/**`;
- `fix/**`;
- `refactor/**`;
- `ci/**`;
- `test/**`;
- `codex/**`.

En push, el detector fija impacto verdadero y ejecuta el heavy. Por eso, en algunas ramas puede
aparecer `validate-backend` dos veces:

- evento `push`;
- evento `pull_request`.

Esa duplicación es esperada en ramas cubiertas por los filtros de push, en particular `test/**`,
y no indica anomalía. Identificar el check por workflow, evento y app, no exigir unicidad
absoluta por nombre: la instancia que branch protection evalúa es la del evento `pull_request`.
Un heavy ejecutado por `push` en una rama `test/**` no contradice un heavy `skipped` en la ruta
`pull_request` del mismo head.

`backend-heavy-validation` ejecuta:

1. instalación con lockfile congelado;
2. auditoría de dependencias;
3. migraciones sobre Postgres efímero;
4. `pnpm typecheck`;
5. `pnpm typecheck:test`;
6. `pnpm test`;
7. `pnpm build`.

El contexto final `validate-backend` usa `if: always()` y falla de forma cerrada si el detector
no termina en `success`, si el heavy no refleja el impacto detectado o si aparece cualquier
combinación de estados inesperada. Postgres existe únicamente dentro del heavy.

## Frontend CI

Frontend CI se crea en todos los pull requests hacia `main`. El detector
`detect-frontend-impact` activa `frontend-heavy-validation` cuando, dentro del rango efectivo del
pull request, cambian:

- `frontend/**`;
- `pnpm-lock.yaml`;
- `pnpm-workspace.yaml`;
- `package.json`;
- `.github/workflows/frontend-ci.yml`.

Comportamiento:

```text
sin impacto frontend:
  detect-frontend-impact: success
  frontend-heavy-validation: skipped
  validate-frontend: success

con impacto frontend:
  detect-frontend-impact: success
  frontend-heavy-validation: ejecutado
  validate-frontend: refleja el resultado del heavy
```

En push hacia `main`, el workflow conserva los filtros de paths listados y el heavy se ejecuta
cuando el workflow es disparado.

`frontend-heavy-validation` ejecuta:

1. instalación con lockfile congelado;
2. lint frontend;
3. typecheck frontend;
4. build frontend;
5. auditoría de superficie pública;
6. suites E2E estratificadas;
7. artifact Playwright solo ante failure.

El contexto final `validate-frontend` usa `if: always()` y aplica la misma propagación
fail-closed. Playwright y su artifact de failure existen únicamente dentro del heavy.

## E2E Completeness

El workflow no-required `E2E Completeness` complementa, sin reemplazar,
`validate-frontend`. Se ejecuta automáticamente en PRs que cambian la suite,
catálogo, runner, configuración o contratos relacionados; también admite
`workflow_dispatch` y un schedule semanal.

```text
Frontend CI:
  Ubuntu → e2e:ci → 43 specs → una invocación Playwright

E2E Completeness:
  Ubuntu → e2e:full → 72 specs → una invocación Playwright
  full == ci ∪ extended ∪ evidence ∪ visual-linux
```

La ruta completa construye primero el frontend con el fixture local, audita la
superficie pública, instala Chromium y activa el production runner únicamente
en el step posterior al build. Los baselines `visual-linux` se ejecutan solo en
Ubuntu. Ante fallo sube `playwright-report` y `test-results`; luego verifica
teardown, source hygiene y limpia esos outputs del checkout efímero.

Un cambio E2E no está listo si `validate-frontend` pasa pero
`e2e-full-completeness` falla. Para diagnosticar:

1. confirmar en logs `[e2e] cohort: full` y `[e2e] specs: 72`;
2. confirmar descubrimiento de 72 archivos;
3. descargar artifacts solo si el job falló;
4. no actualizar snapshots para esconder diferencias;
5. corregir en la misma rama y volver a observar el mismo workflow.

## Rango de comparación del pull request

Ambos detectores calculan los archivos cambiados desde el merge base común de la base y el head
hacia el head candidato:

```text
git merge-base "$BASE_SHA" "$HEAD_SHA"
git diff --name-only -z --diff-filter=ACDMRTUXB "$MERGE_BASE" "$HEAD_SHA"
```

Git distingue esa forma de la comparación directa `git diff "$BASE_SHA" "$HEAD_SHA"`. La
comparación directa reporta también los paths que existen únicamente en una base que avanzó
después de que la rama del PR divergió, y por eso podía lanzar heavies ajenos al diff real. PR
#1605 la eliminó de ambos workflows; los contratos de infraestructura prohíben su retorno.

Consecuencias operativas:

- el rango efectivo no depende de que la rama esté actualizada respecto de `main`;
- una rama desactualizada cuyo diff propio es solo documental mantiene ambos heavies `skipped`;
- si el merge base no resuelve, no tiene formato de 40 hexadígitos o su commit no existe, el
  detector falla y el contexto final falla de forma cerrada;
- estar detrás de `main` no es, por sí mismo, causa de ejecución de heavies ni de fallo de
  contexto.

## Semántica docs-only

Cuando todo el diff del rango efectivo merge-base → head queda bajo `docs/**` o termina en `.md`:

- los cuatro contextos required deben terminar en `SUCCESS`;
- `validate-backend` es required y termina en `SUCCESS` con detector exitoso y Backend heavy
  `skipped`;
- `validate-frontend` es required y termina en `SUCCESS` con detector exitoso y Frontend heavy
  `skipped`;
- ese contrato se cumple también cuando la rama precede a cambios no documentales de `main`,
  porque esos cambios quedan fuera del rango efectivo;
- Supabase Preview puede estar ausente o `SKIPPED` si la integración no aplica;
- cualquier check presente que falle sigue siendo bloqueante: docs-only no convierte un fallo en
  skip legítimo.

Un heavy `skipped` solo es legítimo cuando su detector concluye `impact=false` sobre el rango
efectivo y el contexto final termina en `SUCCESS`.

## Supabase Preview

Supabase Preview puede aparecer como `SKIPPED` cuando el diff no afecta los paths administrados por la integración.

Ese estado no implica fallo del PR.

No asumir que cualquier otro check `SKIPPED` es aceptable: evaluar su aplicabilidad y el contrato del workflow correspondiente.

## Verificación antes de mergear

Ejecutar desde la raíz del repositorio:

```powershell
$prNumber = <NUMERO_REAL_DEL_PR>

gh pr view $prNumber `
  --repo LABVETNEB/PORTAL-VETNEB `
  --json number,title,state,headRefName,headRefOid,baseRefName,mergeStateStatus,statusCheckRollup

gh pr checks $prNumber `
  --repo LABVETNEB/PORTAL-VETNEB
```

No ejecutar comandos finales con placeholders. Sustituir `<NUMERO_REAL_DEL_PR>` antes de ejecutar.

`gh pr checks --watch` es una acción **[MANUAL-NICO]**. Se ejecuta desde la rama del PR activo,
sin número de PR:

```powershell
gh pr checks --watch
```

## Estado aceptable antes de mergear

Se puede considerar el merge solamente cuando:

- los cuatro contextos required están presentes y en `SUCCESS`:
  `validate-pr-governance`, `qga-workflow-security`, `validate-backend` y `validate-frontend`;
- no hay checks aplicables en `QUEUED` o `IN_PROGRESS`;
- no hay checks aplicables en `FAILURE`, `CANCELLED` o `TIMED_OUT`;
- los heavies `skipped` corresponden a detector `impact=false` con contexto final `SUCCESS`;
- Supabase Preview puede estar `SKIPPED` cuando no aplica;
- el PR sigue abierto, no es draft y apunta a `main`;
- el head SHA verificado coincide con el SHA que se va a fusionar;
- el diff y el scope siguen siendo los revisados.

## Estado bloqueante

No mergear si ocurre cualquiera de estos casos:

- cualquiera de los cuatro contextos required está ausente, `QUEUED`, `IN_PROGRESS` o en
  `FAILURE`, `CANCELLED` o `TIMED_OUT`;
- un contexto required final termina en `FAILURE` aunque el PR siga técnicamente `MERGEABLE`:
  `mergeable` describe la ausencia de conflictos de árbol, no el cumplimiento de branch
  protection, y el estado real es `mergeStateStatus: BLOCKED`;
- check aplicable pendiente o fallido;
- heavy `skipped` cuando el detector no concluyó `impact=false` o el contexto final no termina
  en `SUCCESS`;
- head SHA cambió después de la revisión;
- aparecieron archivos fuera de scope;
- el PR está detrás de `main` y la política vigente exige actualización;
- existen conversaciones sin resolver;
- GitHub informa bloqueo de branch protection.

## Merge seguro

Usar squash merge explícito y fijar el head SHA cuando se automatiza mediante API o conector.

Acción **[MANUAL-NICO]**, desde la raíz del repositorio:

```powershell
$prNumber = <NUMERO_REAL_DEL_PR>

gh pr merge $prNumber `
  --repo LABVETNEB/PORTAL-VETNEB `
  --squash
```

No usar `--admin`. Ninguna urgencia documental autoriza eludir checks requeridos.

## Sincronización posterior al merge

Desde `main`, no ejecutar `gh pr checks --watch` sin número esperando que encuentre el PR recién fusionado. Puede responder que no existe un PR para la rama `main`; eso es normal.

Desde la raíz del repositorio:

```powershell
git branch --show-current
git status --short --untracked-files=all
git fetch --prune
git switch main
git pull --ff-only
git status --short --untracked-files=all
git log -1 --oneline
git branch --remotes
git worktree list
gh pr list `
  --repo LABVETNEB/PORTAL-VETNEB `
  --state open
```

No usar `git reset --hard` como procedimiento normal de sincronización o cleanup.

## Cleanup de rama de entrega

Eliminar una rama remota solamente después de verificar:

- PR fusionada o cerrada según el objetivo;
- head SHA exacto;
- ausencia de commits exclusivos que deban preservarse;
- working tree local limpio;
- rama no asociada al segundo worktree.

Después de eliminar:

```powershell
git fetch --prune
git branch --remotes
git ls-remote --heads origin
git worktree list
```

## Auditoría de un PR ya fusionado

Usar el número real del PR:

```powershell
$prNumber = <NUMERO_REAL_DEL_PR>

gh pr view $prNumber `
  --repo LABVETNEB/PORTAL-VETNEB `
  --json number,title,state,mergedAt,mergeCommit,headRefName,headRefOid,baseRefName,statusCheckRollup,url
```

## Regla operativa

- No usar comandos finales con placeholders.
- Tratar `validate-backend` o `validate-frontend` ausente como anomalía bloqueante y diagnosticar
  el routing; al ser required, su ausencia bloquea el merge en strict mode.
- Identificar cada check por workflow, evento y app; no exigir unicidad por nombre en ramas que
  también disparan `push`.
- Diferenciar siempre el workflow/contexto presente del job pesado condicional.
- Evaluar impacto sobre el rango merge-base → head, nunca sobre la comparación directa base/head.
- No tratar `mergeable` como equivalente a cumplimiento de branch protection.
- No usar `--admin` para eludir gates.
- No usar `git reset --hard` como cleanup estándar.
- Mantener este runbook alineado con los nombres reales de workflows, jobs, triggers y branch protection.

## Evidencia relacionada

- [PR Governance workflow](../../.github/workflows/pr-governance.yml)
- [QGA Governance workflow](../../.github/workflows/qga-governance.yml)
- [Workflow Security Validator](../../scripts/governance/workflow-security-validator.mjs)
- [CI/CD Pipeline Governance implementation closeout](../implementation/ci-pipeline-governance-closeout.md)
- [CI/CD Pipeline Governance closeout audit](../audit/ci-pipeline-governance-closeout-audit.md)
- [PR-CI-ALWAYS-RUN-GATES closeout audit](../audit/pr-ci-always-run-gates-audit.md)
- [PR-CI-REQUIRED-CHECKS closeout audit](../audit/pr-ci-required-checks-audit.md)
- [Branch Protection Governance implementation closeout](../implementation/branch-protection-governance-closeout.md)
- [Review Governance](../review-governance.md)
