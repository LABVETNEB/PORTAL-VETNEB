# STAGE_C — Realineación de la policy de quality gates con los required contexts reales

`scripts/governance/quality-gate-impact-policy.mjs` declaraba los gates `backend-ci` y
`frontend-ci` como `required: false` con `execution: "conditional, non-required"`. Branch
protection de `main` exige esos dos contextos. La policy afirmaba lo contrario, y su proyección
generada en `test/README.md` propagaba la afirmación falsa a nueve filas.

Este cambio corrige la **representación** de los required contexts en la fuente ejecutable de la
taxonomía y regenera su proyección. No toca branch protection, workflows, routing, comandos,
pertenencia de suites ni comportamiento de producto.

> **Estado: `IMPLEMENTED_LOCALLY_PENDING_PR_CI`.** STAGE_C no está cerrado remotamente: falta el
> lifecycle manual de Git/GitHub, los checks required del PR y el merge. El closeout documental
> (`docs/audit/LIMPIEZA E2E.md` §B.7, `docs/governance/enterprise-control-register.md`,
> `docs/qa/README.md`) queda deliberadamente fuera: es STAGE_D.

## Estado base

| Ítem | Valor |
|---|---|
| Rama | `main` (sin rama nueva: todo el lifecycle Git/GitHub queda para Nico) |
| HEAD base | `c28cf830460255a1d541636734b2fd007b3b26fb` (`test(e2e): realign runner trace diagnostics (#1756)`) |
| Working tree inicial | 0 cambios tracked; 0 staged; `frontend/AGENTS.md` y `frontend/CLAUDE.md` untracked (generados por `next dev`, preservados); 5 stashes preexistentes intactos; segundo worktree `C:/PORTAL-VETNEB-E2E06` intacto |
| `AGENTS.md` aplicables | sólo el raíz (único tracked; los de `frontend/` son untracked generados, no son contrato) |
| Actor | Nico autoriza y delega la implementación local; el agente no ejecuta Git/GitHub |
| Clasificación | R2 — `classifyPath("scripts/governance/quality-gate-impact-policy.mjs")` = `workflows/CI` (AGENTS.md §3.1) |
| Scope primario | `workflows/CI` (fuente ejecutable de gobernanza de CI) |
| Escrituras Git/GitHub | 0 |

## Problema

La policy modelaba dos conceptos distintos con un solo par de campos y los colapsaba:

```text
CONTEXT REQUIRED = el contexto final siempre existe y debe quedar SUCCESS antes del merge.
HEAVY JOB        = el job pesado puede ejecutarse o saltearse según el impacto por paths.
```

Que el heavy sea condicional no vuelve non-required al contexto. La policy escribía la segunda
propiedad en el campo de la primera:

```js
backend-ci:  execution: "conditional, non-required",  required: false
frontend-ci: execution: "conditional, non-required",  required: false
```

y sus `responsibility` lo afirmaban en prosa: *"This workflow is observable but is not the
required merge context."*

Consecuencia operativa: cualquier lector —humano o agente— que tomara la policy como fuente
concluía que un `validate-backend` en `FAILURE` no bloquea el merge. Es falso, y es exactamente la
clase de afirmación que AGENTS.md §6 obliga a leer de la configuración efectiva, no de su
descripción documental.

El drift ya estaba registrado como residual abierto en `docs/audit/LIMPIEZA E2E.md` §B.7
(`test/README.md:153`, `frontend-ci` "non-required", criterio: *alineación con el runbook*) y en
`docs/implementation/e2e-global-10b-documentation-closeout.md`, fuera del scope nominal de 10B.

## Los cuatro required contexts reales

Branch protection de `main`, releída en modo read-only durante esta etapa (`gh api GET`, sin
escrituras):

```text
strict: true
required_conversation_resolution: true
required_approving_review_count: 0

validate-pr-governance   app_id 15368
qga-workflow-security    app_id 4291335
validate-backend         app_id 15368
validate-frontend        app_id 15368
```

Coincide exactamente con AGENTS.md §6 y con el mapa de `docs/ops/CI_PR_CHECKS_RUNBOOK.md`.

## Required wrapper vs heavy condicional

La distinción es verificable en los propios workflows, no inferida:

| Workflow | Job detector | Job pesado | Contexto final |
|---|---|---|---|
| `Backend CI` | `detect-backend-impact` | `backend-heavy-validation` (`if: should_run == 'true'`) | `validate-backend` (`if: always()`) |
| `Frontend CI` | `detect-frontend-impact` | `frontend-heavy-validation` (`if: should_run == 'true'`) | `validate-frontend` (`if: always()`) |

El contexto final es un job aparte que `needs` al detector y al heavy, corre con `if: always()` y
falla cerrado si el detector no termina en `success`, si el heavy no refleja el impacto detectado
o si aparece cualquier combinación inesperada. Un heavy `skipped` con detector `impact=false`
produce contexto `SUCCESS`; nunca produce contexto ausente.

Por tanto:

```text
"heavy job conditional"  !=  "required context non-required"
```

## Decisión sobre `qga-workflow-security`

**`QGA_POLICY_CHANGE = NO_CHANGE_REQUIRED`** — caso B: `QUALITY_GATES` no representa el registro
de required merge contexts, sino el **codominio cerrado del routing por impacto**. Evidencia
ejecutable, no estética:

1. `QUALITY_GATES` contiene `manual-review` con `workflow: null` y `check: null`. Un registro de
   required contexts no puede tener un miembro que no es un check. La estructura es otra cosa.
2. Todos los gates declarados son destino de al menos una regla de `IMPACT_RULES`
   (declarados-no-usados = 0). `validateImpactPolicy()` fuerza que `rule.gates` y `suite.gate`
   pertenezcan al conjunto: existe para que el routing tenga destinos válidos.
3. `qga-governance.yml` no tiene detector ni `if:`. Corre incondicionalmente por
   `pull_request_target` en todo PR hacia `main`. No hay nada que rutear: el routing decide *qué*
   validación exige un cambio, y la respuesta de QGA es invariantemente "todas". Enrutarlo por
   paths afirmaría que cambiar `.gitignore` "impacta" la seguridad de workflows, lo cual es falso.
4. QGA ya tiene su propia policy ejecutable y sus propios contratos:
   `scripts/governance/workflow-security-policy.mjs`,
   `scripts/governance/workflow-security-validator.mjs`,
   `test/unit/infrastructure/workflow-security-policy-contract.test.ts` y
   `test/unit/infrastructure/workflow-security-validator-contract.test.ts`.
5. Su check lo publica una GitHub App distinta (`app_id 4291335`) desde la rama base confiable, no
   la app de Actions (`15368`) que emite los otros tres.
6. Agregarlo exigiría un `commands` no vacío para `validateImpactPolicy`, o ampliar
   `DIRECT_COMMAND_ALLOWLIST` con el validador, sin ningún beneficio de routing.

`pr-governance` sí está en el conjunto porque es el **consumidor** de esta policy —
`pr-governance-validator.mjs` importa el validador de impacto— y toda regla lo enruta como gate
(reglas sin `pr-governance` = 0). QGA no consume la policy de impacto en absoluto.

La arquitectura no se amplía. El contrato se documenta y se congela con un test.

## Cambios

### `scripts/governance/quality-gate-impact-policy.mjs`

Seis líneas, dos gates. Sin cambios de `id`, `check`, `workflow`, `owner`, `commands`,
`IMPACT_RULES`, `TEST_TAXONOMY`, `REQUIRED_SOURCE_PATHS` ni `DIRECT_COMMAND_ALLOWLIST`.

```text
backend-ci / frontend-ci:
  required:  false → true
  execution: "conditional, non-required"
           → "required context, heavy validation conditional by impact"
  responsibility: se elimina "is not the required merge context" y se declara el contrato real
                  (contexto siempre presente; heavy condicional por impacto; contexto SUCCESS
                  cuando el heavy se saltea legítimamente)
```

`POLICY_VERSION` se mantiene en `QGA-2.2`: no cambia la forma de la policy ni su superficie de
consumo, sólo el valor de dos gates.

### `test/unit/infrastructure/quality-gate-impact-contract.test.ts`

Dos tests focales agregados. Ningún test existente modificado.

- **`backend and frontend gates model required branch-protection contexts`** — congela
  `required === true` y el nombre de check para los tres gates que sí son contextos required
  modelados por la policy, prohíbe semántica `non-required` en `execution` y prohíbe la frase
  `not the required merge context` en `responsibility`. Para los dos gates con heavy, exige que
  `execution` declare a la vez el contexto y la condicionalidad del job pesado.
- **`quality gates are the impact-routing codomain, not the required-context register`** — congela
  la decisión de la sección anterior: igualdad exacta entre gates declarados y gates enrutados,
  ausencia deliberada de `qga-workflow-security`, y `manual-review` con `check: null` /
  `required: false` como prueba de que el conjunto no es un registro de contextos.

Las aserciones son de propiedad estructurada (`required`, `check`, presencia o ausencia de
semántica) en vez de igualdad literal de la prosa, para no volver frágil el wording.

**Control negativo ejecutado:** las nuevas aserciones evaluadas contra la policy del base
`c28cf830` fallan en 6 puntos (`required === false` ×2, `execution` con `non-required` ×2,
`responsibility` negando el contexto required ×2). El test prueba el cambio; no lo acompaña.

### `test/README.md`

Bloque entre `<!-- quality-gate-taxonomy:start -->` y `<!-- quality-gate-taxonomy:end -->`
regenerado con el renderer canónico `renderReadmeTaxonomyBlock` de
`scripts/governance/quality-gate-impact-validator.mjs`, reemplazando **sólo** el contenido entre
markers. Ninguna fila editada a mano y ninguna otra línea del archivo tocada.

Las nueve filas pasan de `backend-ci` / `frontend-ci` `(conditional, non-required)` a
`(required context, heavy validation conditional by impact)`.

## Validaciones

| Gate | Comando | Estado |
|---|---|---|
| `validateImpactPolicy` | entrypoint canónico del validador | `PASSED` (0 failures) |
| `validateReadmeTaxonomyProjection` | entrypoint canónico del validador | `PASSED` (0 failures) |
| `validateCommandReferences` | entrypoint canónico del validador | `PASSED` (0 failures) |
| `evaluateQualityGateImpact` sobre los 4 paths de este PR | entrypoint canónico del validador | `PASS`; gates `pr-governance(required)`, `backend-ci(required)`, `frontend-ci(required)`, `manual-review(non-required)` |
| Contrato de quality gates | `node --test test/unit/infrastructure/quality-gate-impact-contract.test.ts` | `PASSED` — 32/32 |
| Integración PR governance ↔ impacto | `node --test test/unit/infrastructure/pr-governance-quality-impact-integration.test.ts` | `PASSED` — 8/8 |
| Cohorte acoplada a la policy | `node --test` sobre `workflow-security-policy-contract`, `workflow-security-validator-contract`, `supply-chain-governance-contract`, `pr-governance-single-scope-contract` | `PASSED` — 101/101 |
| Typecheck de tests | `pnpm typecheck:test` | `PASSED` |
| Higiene de diff | `git diff --check` | `PASSED` |
| `pnpm validate:local` | — | `NOT_RUN`: incluye `pnpm test` completo, cuyo smoke autoritativo Fastify falla cerrado sin `DATABASE_URL` local. Los gates afectados por este cambio se cubrieron por cohorte dirigida. CI lo ejecuta completo en `validate-backend`. |
| Playwright / `e2e:ci` / `e2e:full` | — | `NOT_RUN`: sin impacto frontend ni E2E en el diff |

## No-alcance

Deliberadamente fuera:

- `docs/audit/LIMPIEZA E2E.md` — el cierre del residual §B.7 es STAGE_D, después del merge.
- `docs/governance/enterprise-control-register.md` (`ERM-CTRL-013`), `docs/qa/README.md` y
  `docs/SOURCES_OF_TRUTH.md` — mitad documental del mismo residual; STAGE_D, con su owner.
- `docs/ops/CI_PR_CHECKS_RUNBOOK.md` — ya describe correctamente los cuatro contextos y la
  distinción wrapper/heavy. Es la fuente con la que este cambio se alinea, no algo que se ajuste
  aquí.
- `.github/workflows/**` — cero bytes modificados. La implementación operativa ya era correcta; lo
  incorrecto era su representación.
- Branch protection, required checks, settings de GitHub y Actions policy — sólo lectura.
- `IMPACT_RULES`, `TEST_TAXONOMY`, `REQUIRED_SOURCE_PATHS`, comandos, pertenencia de suites y
  `POLICY_VERSION`.
- `scripts/governance/quality-gate-impact-policy.d.mts` — `execution: string` y `required: boolean`
  ya tipan correctamente los valores nuevos; no hace falta estrechar el tipo para este cambio.

## Rollback

Revertir el PR. Los cuatro archivos vuelven al estado de `c28cf830`: la policy recupera
`required: false` y la proyección de `test/README.md` vuelve a `(conditional, non-required)`. No
hay estado remoto, de CI ni de base de datos que deshacer, porque este cambio no creó ninguno.

## Riesgo residual

- **Residual §B.7 aún abierto documentalmente.** `docs/audit/LIMPIEZA E2E.md` sigue listando
  `test/README.md:153` como drift. La fila queda obsoleta al mergear este PR, pero se corrige en
  STAGE_D, no aquí.
- **`ERM-CTRL-013` sin revisar en esta etapa.** El control register mantiene su propia redacción
  sobre required contexts; su owner la revalida en STAGE_D.
- **`execution` sigue siendo prosa libre.** El nuevo test prohíbe la semántica `non-required` y
  exige las dos afirmaciones que importan, pero el campo admite cualquier string. Estrecharlo a un
  tipo unión sería un cambio de forma de la policy, fuera del scope de esta corrección.
- **`renderQualityGateImpactSummary` cambia su salida en CI.** La tabla "Impacted gates" del step
  summary de `validate-pr-governance` pasará a mostrar `required` para `backend-ci` y
  `frontend-ci`. Es el efecto buscado; no hay test que congele esa salida y ninguno lo exige.
