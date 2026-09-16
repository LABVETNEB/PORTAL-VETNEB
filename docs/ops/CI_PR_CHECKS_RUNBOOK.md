# CI PR Checks Runbook

| Campo | Valor |
| --- | --- |
| Document owner | CI owner |
| Domain | CI/CD and Pull Request Governance |
| Lifecycle status | ACTIVE |
| Authoritative source role | Mapa operativo de checks efectivos y criterios antes de merge |
| Effective date | 2026-09-16 |
| Last verified date | 2026-09-16 |
| Review cadence | Mensual y ante cambios de workflows, jobs, catálogo E2E o branch protection |
| Supersedes | Versión que documentaba dos required checks globales y clasificaba los gates funcionales como no required; versión del 2026-07-30 que describía `e2e:ci` con 43 specs, `e2e:full` con 72 specs bajo `next dev` y un presupuesto de 55/40 minutos |
| Superseded by | Ninguno |
| Related controls or gaps | `ERM-CTRL-013`; `ERM-CTRL-014`; `ERM-CTRL-015`; `ERM-CI-001`; `ERM-CI-002`; `LIMPIEZA E2E` R-18 |
| Evidence or approval reference | PR #1601 y canarias #1602/#1603; PR #1605 y su validación stale-base; canarias #1616 y #1618 del bloque 05; reconciliación E2E-GLOBAL-10B ([acta](../implementation/e2e-global-10b-documentation-closeout.md)): workflows y catálogo en `c25f4e0613b3f133efc46a7df08aa78e03006323`, branch protection de `main` y Actions permissions releídas en modo read-only el 2026-09-16 |

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
| `e2e-full-completeness` (`E2E Completeness`) | No required; aplicable | Todos los PR hacia `main`, sin filtro de paths (incluidos los docs-only) | No | `SUCCESS` antes de merge: un `FAILURE` deja el PR fuera de READY |
| `generate-sbom` (`Backend CI`) | Evidencia supply-chain; no required | Todos los eventos de `Backend CI` | No | `SUCCESS`; ningún contexto required lo observa |
| `visual-regression-<suite>` (`Visual Regression Manual`) | Diagnóstico manual | Sólo `workflow_dispatch` | No | No aparece en PRs |
| Supabase Preview | Integración externa | Paths administrados por la integración | No | `SUCCESS` cuando aplica; `SKIPPED` legítimo cuando no aplica |

La presencia de un workflow o job en el árbol no lo vuelve required. La fuente efectiva para esa
clasificación es branch protection de `main`, releída en modo read-only el 2026-09-16 (sin cambios
respecto de la verificación del 2026-07-30) con exactamente estos cuatro contextos y sus app IDs:

```text
strict: true
required_conversation_resolution: true
required_approving_review_count: 0

validate-pr-governance   app_id 15368
qga-workflow-security    app_id 4291335
validate-backend         app_id 15368
validate-frontend        app_id 15368
```

Con cero approvals requeridos, un PR con los cuatro contextos en `SUCCESS` que sigue `BLOCKED`
suele tener un review thread sin resolver: diagnosticarlo por `reviewThreads` con
`isResolved == false`.

La evidencia durable del bloque 05, incluidas la canaria positiva #1616 y la canaria negativa
#1618, se conserva en
[PR-CI-REQUIRED-CHECKS Audit](../audit/pr-ci-required-checks-audit.md).

## GitHub Actions repository policy

Política efectiva del repositorio, verificada el 2026-07-30 y releída sin cambios el 2026-09-16:

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

`backend-heavy-validation` (`timeout-minutes: 15`) ejecuta:

1. instalación con lockfile congelado;
2. `pnpm lint:backend`;
3. auditoría de dependencias (`pnpm audit --prod` y `pnpm audit`);
4. migraciones sobre Postgres efímero (`postgres:16`, base `portal_vetneb_ci`);
5. `pnpm typecheck`;
6. `pnpm typecheck:test`;
7. `pnpm test`;
8. `pnpm build`.

El contexto final `validate-backend` usa `if: always()` y falla de forma cerrada si el detector
no termina en `success`, si el heavy no refleja el impacto detectado o si aparece cualquier
combinación de estados inesperada. Postgres existe únicamente dentro del heavy.

`pnpm test` incluye los guards que gobiernan la infraestructura E2E (completitud del catálogo,
contratos de workflows, régimen zero-scroll, fuente única de sesión) y el smoke autoritativo
`test/integration/app/e2e-global-03b-authoritative-auth-boundary.fastify.test.ts` contra Fastify y
el Postgres del heavy. Ese test falla cerrado sin `DATABASE_URL`/`SUPABASE_DB_URL` apuntando a
`portal_vetneb_ci` local: una corrida local sin DB lo reporta como fallo ambiental (BLOCKED por DB
ausente), no como regresión. En CI corre y pasa: Backend CI `35109809582` sobre `c25f4e06`,
4.566/4.566 tests.

El job `generate-sbom` corre en cada evento de `Backend CI`, sube el SBOM CycloneDX como artifact y
no bloquea el merge: ningún contexto required depende de él.

## Frontend CI

Frontend CI se crea en todos los pull requests hacia `main`. El detector
`detect-frontend-impact` activa `frontend-heavy-validation` cuando, dentro del rango efectivo del
pull request, cambian:

- `frontend/**`;
- `shared/**`;
- `pnpm-lock.yaml`;
- `pnpm-workspace.yaml`;
- `package.json`;
- `.github/workflows/frontend-ci.yml`;
- `.github/workflows/e2e-completeness.yml`.

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

En push hacia `main` el workflow se dispara por filtro de paths y el heavy se ejecuta siempre que
el workflow corre. Ese filtro enumera los paths del detector salvo `shared/**`: un push a `main`
que sólo toque `shared/**` no dispara Frontend CI. Bajo branch protection todo cambio llega por
PR, donde el detector sí lo cubre (divergencia registrada en `LIMPIEZA E2E` §10, P3).

`frontend-heavy-validation` (`timeout-minutes: 20`) ejecuta:

1. instalación con lockfile congelado;
2. lint frontend;
3. typecheck frontend;
4. build frontend con el fixture API local (`NEXT_PUBLIC_API_URL=http://127.0.0.1:3107`);
5. auditoría de superficie pública;
6. `playwright install --with-deps chromium`;
7. `pnpm --dir frontend e2e:ci` con `VETNEB_E2E_PRODUCTION_RUNNER=1`, que sirve el bundle recién
   construido con `next start` en una sola invocación Playwright (ver
   [Catálogo y cohortes E2E](#catálogo-y-cohortes-e2e));
8. sólo ante failure: sanitizer de artefactos y, únicamente si el sanitizer termina en `success`,
   subida del `playwright-report` y de `test-results` sanitizados.

Referencia observada: push a `main` `52314191` (Frontend CI `35099449451`), cohorte `ci` con 67
specs y 1.030 tests, 1.029 passed y 1 skipped, 12,7 min de Playwright y 14,5 min de job heavy.

El contexto final `validate-frontend` usa `if: always()` y aplica la misma propagación
fail-closed. Playwright y su artifact de failure existen únicamente dentro del heavy.

## Catálogo y cohortes E2E

La única fuente de pertenencia de specs a cohortes es
[`frontend/e2e/suites/catalog.ts`](../../frontend/e2e/suites/catalog.ts). Los scripts `e2e:*` de
[`frontend/package.json`](../../frontend/package.json) delegan en
`frontend/e2e/scripts/run-cohort.mjs`, que lee el catálogo y falla cerrado con exit 2 (cohorte
inválida), 3 (selección vacía), 4 (spec catalogado inexistente) o 5 (`visual-linux` fuera de
Linux). `test/architecture/e2e-suite-catalog-completeness.test.ts` (`pnpm test`, dentro de
`validate-backend`, y `pnpm --dir frontend e2e:verify-catalog`) fija los conteos y las
particiones. Si cambia el catálogo, ese guard se realinea en el mismo PR; este runbook no es la
fuente de los números.

Inventario recalculado en `c25f4e0613b3f133efc46a7df08aa78e03006323` (2026-09-16), desde el
catálogo y `playwright test --list --reporter=json`:

| Cohorte | Specs | Tests | Dónde corre |
| --- | ---: | ---: | --- |
| `smoke` | 12 | 61 | subconjunto de `ci` |
| `admin-mobile` | 14 | 136 | subconjunto de `ci` |
| `visual-contract` | 24 | 521 | subconjunto de `ci` |
| `public-clinic` | 17 | 312 | subconjunto de `ci` |
| `ci` | 67 | 1.030 | `Frontend CI` (required, vía `validate-frontend`) y `e2e:full` |
| `extended` | 27 | 255 | sólo `e2e:full` |
| `evidence` | 1 | 1 | sólo `e2e:full` |
| `visual-linux` | 3 | 40 | `e2e:full` y `Visual Regression Manual`; sólo Linux |
| `full` | 98 | 1.326 | `E2E Completeness` |
| `affected` | dinámico | — | local; cae a `ci` ante cualquier path compartido o no mapeado |

Invariantes verificadas:

- las cuatro cohortes current particionan `ci` sin solapamiento (12 + 14 + 24 + 17 = 67);
- `full == ci ∪ extended ∪ evidence ∪ visual-linux`, también sin solapamiento
  (67 + 27 + 1 + 3 = 98);
- 98 specs tracked = 98 en disco = 98 entradas de catálogo = 98 archivos descubiertos por
  Playwright; `E2E_MANUAL_ONLY_SPECS` está vacío;
- 70 specs `P1`; los únicos `P1` fuera de `ci` son A02 (`dashboard-geometry-baseline`), A03
  (`dashboard-adaptive-limit-baseline`) y A05 (`dashboard-limit-invariance`), y los tres corren
  en `E2E Completeness` en cada PR;
- 40 baselines PNG `*-chromium-linux`, promovidos desde capturas `next start`
  (`E2E-GLOBAL-05B`).

Configuración Playwright (`frontend/playwright.config.ts`): un proyecto `chromium`, `retries: 0`
(`e2e:full` lo sobrescribe con `--retries=2`), `workers` sin fijar (2 observados en
`ubuntu-latest`), `fullyParallel`, `timeout` 30 s, `expect.timeout` 5 s, `globalTimeout` 30 min
(override `E2E_GLOBAL_TIMEOUT_MS`), `forbidOnly` y `failOnFlakyTests` activos en CI,
`screenshot: only-on-failure` y `trace` `retain-on-failure` bajo el production runner (`off` en
local). El servidor de aplicación es `next start` sólo cuando `CI=true` y
`VETNEB_E2E_PRODUCTION_RUNNER=1`; en cualquier otro contexto es `next dev`. Ningún E2E arranca
Fastify ni Postgres: el backend es el fixture hermético `127.0.0.1:3107`.

## E2E Completeness

El workflow no-required `E2E Completeness` complementa, sin reemplazar, `validate-frontend`.

```text
Triggers:
  pull_request → main    sin filtro de paths (E2E-GLOBAL-06): corre en todo PR, docs-only incluido
  workflow_dispatch
  schedule '17 3 * * 2'  semanal, sobre main
  (sin trigger push: un merge a main no lo dispara)

Frontend CI (required):
  Ubuntu → next build → next start → e2e:ci   → 67 specs / 1.030 tests → una invocación Playwright

E2E Completeness (no required):
  Ubuntu → next build → next start → e2e:full → 98 specs / 1.326 tests → una invocación Playwright
  full == ci ∪ extended ∪ evidence ∪ visual-linux
```

El job `e2e-full-completeness` (`ubuntu-latest`, `timeout-minutes: 60`, concurrencia por ref con
`cancel-in-progress`) ejecuta:

1. instalación con lockfile congelado;
2. `pnpm --dir frontend e2e:verify-catalog`;
3. build del frontend con el mismo env de fixture que `Frontend CI`;
4. auditoría de superficie pública;
5. dependencias de sistema de Playwright, neutralizando antes sólo la fuente APT de Google Chrome
   en formato `.list` y Deb822 (`E2E-GLOBAL-01`);
6. instalación de Chromium, con hasta dos intentos de 180 s;
7. `pnpm --dir frontend e2e:full -- --workers=2 --retries=2` con
   `VETNEB_E2E_PRODUCTION_RUNNER=1` (`next start`, `E2E-GLOBAL-05B`) y
   `E2E_GLOBAL_TIMEOUT_MS=2700000`;
8. sólo ante failure: sanitizer y subida de `playwright-report` y `test-results` sanitizados
   (retención 14 días);
9. siempre: `e2e:verify-teardown` y verificación de higiene, que borra los outputs y exige
   `frontend/next-env.d.ts` y `frontend/e2e` sin cambios ni untracked.

Cada retry vuelve a ejecutar el callback y debe pasar sus assertions; no equivale a skip ni a
`continue-on-error`. Con `failOnFlakyTests: true`, un test que sólo pasa en retry marca el run como
`FAILURE`: los retries no enmascaran flakes. Ejemplo: el run `35060350621` (head intermedio
`052bb54b` de #1729) terminó `FAILURE` con `2 flaky / 1323 passed / 1 skipped`.

Presupuesto de runtime:

```text
job timeout-minutes            60m   (tope duro)
E2E_GLOBAL_TIMEOUT_MS          45m   (env del paso full, sólo este workload)
envelope exterior              15m   (job − Playwright)
globalTimeout por defecto      30m   (frontend/playwright.config.ts; e2e:ci y corridas locales)
```

El envelope de 15 minutos cubre todo lo que Playwright no posee: checkout, install, verify del
catálogo, build, auditoría pública, dependencias y Chromium y, si el paso agota su
`globalTimeout`, subida de diagnostics, teardown e higiene.
`test/unit/infrastructure/e2e-completeness-workflow.test.ts` fija `timeout-minutes: 60` y exige
`job − E2E_GLOBAL_TIMEOUT_MS >= 15m`; también exige el build previo y el flag del production
runner sólo en el paso full, y prohíbe `paths`, `paths-ignore` y `types` en `pull_request`.

Referencia observada: run `35104076249` (head `4dcb07d5` de #1730), `[e2e] specs: 98`,
`next start --hostname 127.0.0.1`, `Running 1326 tests using 2 workers`,
`1325 passed / 1 skipped (24.6m)`, 48,5 min de trabajo agregado y job de 26 min. El skip es el
declarado de B05 S7 `clinic-tokens`. El schedule sobre `main` del 2026-09-15 (`34948699577`,
`886f19ee`) también terminó en `SUCCESS`.

`E2E Completeness` no es uno de los cuatro contextos required de `main`, pero sí es un check
aplicable: mientras esté en `FAILURE` el PR no está READY (AGENTS.md §5.8). "No required" no
significa "ignorable en rojo". Un cambio no está listo si `validate-frontend` pasa pero
`e2e-full-completeness` falla.

Para diagnosticar:

1. confirmar en el log `[e2e] cohort: full`, `[e2e] specs: <N>` con `N` igual al tamaño de
   `full` en el catálogo del head (98 en `c25f4e06`), `[WebServer] $ next start` y
   `Running <T> tests`;
2. separar `failed` de `flaky`: ambos ponen el run en rojo;
3. descargar artifacts sólo si el job falló; sólo existen en su versión sanitizada;
4. no actualizar snapshots para esconder diferencias (ver
   [Visual Regression Manual](#visual-regression-manual));
5. corregir en la misma rama y volver a observar el mismo workflow sobre el head nuevo.

## Visual Regression Manual

`visual-regression-manual.yml` sólo se dispara por `workflow_dispatch`. Lanzarlo es
**[MANUAL-NICO]**: `gh workflow run` es NO-DELEGABLE (AGENTS.md §5.5). No aparece en PRs y no
es un gate.

- `runner=production-candidate` (default): `next build` más `next start` en un candidato aislado
  que se compara contra los baselines canónicos, con un `globalTimeout` de 20 minutos dentro de un
  job de 45. Nunca actualiza baselines.
- `runner=dev`: diagnóstico no canónico bajo `next dev`. Difiere por diseño de los baselines
  productivos (indicador de desarrollo), así que su rojo no es señal de regresión.
- `update_snapshots=true` se rechaza siempre en el primer paso. Un baseline canónico sólo cambia
  por copia byte-exacta de un candidato productivo revisado, en un PR con acta (`E2E-GLOBAL-05B`).
- Los specs se resuelven desde la cohorte `visual-linux` del catálogo con `selectSuiteSpecs()`,
  el mismo resolver para ambos runners (`E2E-GLOBAL-10` R-14, #1730). El workflow no nombra
  ningún spec; `test/unit/infrastructure/visual-regression-workflow-catalog.test.ts` lo
  garantiza.

La comparación automática de los 40 baselines no depende de este workflow: `visual-linux` forma
parte de `e2e:full`, que la ejecuta bajo `next start` en cada PR dentro de `E2E Completeness`. En
Windows, `e2e:visual-linux` queda BLOCKED por diseño (exit 5): los baselines son Chromium-Linux.

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
- `E2E Completeness` también corre, porque no tiene filtro de paths: su resultado sigue siendo un
  check aplicable aunque el diff sea documental;
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
- no hay checks aplicables en `FAILURE`, `CANCELLED` o `TIMED_OUT`, incluido
  `e2e-full-completeness`;
- los heavies `skipped` corresponden a detector `impact=false` con contexto final `SUCCESS`;
- Supabase Preview puede estar `SKIPPED` cuando no aplica;
- el PR sigue abierto, no es draft y apunta a `main`;
- no hay review threads sin resolver;
- el head SHA verificado coincide con el SHA que se va a fusionar, y todos los checks anteriores
  corresponden a ese head: un check de un head previo no es evidencia;
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

Usar squash merge explícito y fijar el head SHA verificado con `--match-head-commit`, como exige
AGENTS.md §5.8. Así, un push que llegue entre la verificación y el merge hace fallar el merge en
lugar de fusionar un head no revisado.

Acción **[MANUAL-NICO]** salvo delegación explícita (AGENTS.md §5.3), desde la raíz del
repositorio:

```powershell
$prNumber = <NUMERO_REAL_DEL_PR>
$headSha = <HEAD_SHA_VERIFICADO>

gh pr merge $prNumber `
  --repo LABVETNEB/PORTAL-VETNEB `
  --squash `
  --match-head-commit $headSha
```

Si el merge falla porque el head cambió, no reintentar contra el SHA nuevo: revalidar los checks
de ese head. No usar `--admin`. Ninguna urgencia documental autoriza eludir checks requeridos.
Tampoco acoplar `--delete-branch` al merge: la eliminación de la rama remota es un paso aparte,
posterior al readback del merge (AGENTS.md §5.9).

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

- PR fusionada (`merged=true`, `mergedAt` y `mergeCommit` presentes) y rama igual a su
  `headRefName`, o PR canaria cerrada sin merge por decisión explícita de Nico. Un agente sólo
  elimina ramas de PRs fusionadas (AGENTS.md §5.9);
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
- Leer los conteos E2E del catálogo y del log del run. Toda cifra de este runbook indica el HEAD en
  que se recalculó; una cifra sin fecha ni HEAD no es evidencia.

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
- [Frontend CI workflow](../../.github/workflows/frontend-ci.yml)
- [E2E Completeness workflow](../../.github/workflows/e2e-completeness.yml)
- [Visual Regression Manual workflow](../../.github/workflows/visual-regression-manual.yml)
- [Catálogo E2E](../../frontend/e2e/suites/catalog.ts)
- [LIMPIEZA E2E](../audit/LIMPIEZA%20E2E.md), programa de saneamiento E2E
- [E2E-GLOBAL-10B — cierre documental](../implementation/e2e-global-10b-documentation-closeout.md)
- [PR-E2E-CI-COMPLETENESS Audit](../audit/pr-e2e-ci-completeness-audit.md), evidencia histórica del
  slot 06 (43/72 specs y `e2e:full` bajo `next dev`, estado del 2026-07-30)
