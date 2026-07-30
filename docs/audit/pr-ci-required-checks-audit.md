# PR-CI-REQUIRED-CHECKS Audit

| Campo | Valor |
| --- | --- |
| Document owner | CI owner / Engineering governance |
| Domain | CI/CD and Quality Gate Governance |
| Lifecycle status | ACTIVE |
| Authoritative source role | closeout durable del BLOQUE 05 |
| Effective date | 2026-07-30 |
| Last verified date | 2026-07-30 |
| Related controls | `ERM-CTRL-013`; `ERM-CTRL-014`; `ERM-CTRL-015`; `ERM-CTRL-024`; `ERM-CI-002` |
| Fuentes autoritativas | Branch protection de `main`; Actions permissions del repositorio; [Backend CI workflow](../../.github/workflows/backend-ci.yml); [Frontend CI workflow](../../.github/workflows/frontend-ci.yml); [PR Governance workflow](../../.github/workflows/pr-governance.yml); [QGA Governance workflow](../../.github/workflows/qga-governance.yml); [CI PR Checks Runbook](../ops/CI_PR_CHECKS_RUNBOOK.md); [Enterprise Control Register](../governance/enterprise-control-register.md) |
| Bloque | `PR-CI-REQUIRED-CHECKS` |
| Riesgo | R3 (branch protection y Actions settings) |
| Base documental | `main@2ddd4fa711d07d5b8eb8e1a114107ae28cd0036b` |
| Block status | `PR-CI-REQUIRED-CHECKS CLOSED` |
| Next block | `BLOQUE 06 NOT_RUN` |

## 1. Executive summary

```text
BLOQUE 05: CLOSED
```

El BLOQUE 05 del [Plan B](./enterprise-roadmap-consolidation-plan.md) absorbió dos PRs del
roadmap original:

- `PR-CI-1` — convertir en required checks los gates funcionales `validate-backend` y
  `validate-frontend` (brecha `P0-2` / `GAP-P0-2`);
- `PR-CI-4` — hardening de GitHub Actions: `allowed_actions` selected, SHA pinning obligatorio y
  `GITHUB_TOKEN` con permiso predeterminado `read`.

Ambas mutaciones son config-only: no modificaron backend, frontend, workflows, tests, scripts,
dependencias ni lockfiles. La evidencia de enforcement se obtuvo con tres pull requests canaria
cerradas sin merge (#1616, #1617, #1618) y ninguna rama canaria quedó residual.

Desde el cierre, los cuatro contextos requeridos por branch protection son:

```text
validate-pr-governance   app_id 15368
qga-workflow-security    app_id 4291335
validate-backend         app_id 15368
validate-frontend        app_id 15368
```

`ERM-CTRL-014` Quality Gate Architecture pasa de `PARTIAL` a `IMPLEMENTED` y `ERM-CI-002` queda
cerrado operativamente sin reescribir su snapshot histórico.

## 2. Estado anterior

Estado observado antes de las mutaciones del bloque.

Branch protection de `main`:

```text
required:
  validate-pr-governance
  qga-workflow-security

no required:
  validate-backend
  validate-frontend
```

Actions del repositorio:

```text
allowed_actions: all
sha_pinning_required: false
default_workflow_permissions: write
```

Consecuencia operativa del estado anterior: un pull request que tocara `server/**` podía
fusionarse con Backend CI en rojo, porque el fallo de un gate funcional no era bloqueante. Los
dos contextos requeridos validaban metadatos de PR y política de workflows, no código.

## 3. Estado posterior

Branch protection de `main`, verificada en modo lectura el 2026-07-30:

| Contexto requerido | App ID | Clase |
| --- | ---: | --- |
| `validate-pr-governance` | 15368 | Governance de PR |
| `qga-workflow-security` | 4291335 | Seguridad de workflows |
| `validate-backend` | 15368 | Gate funcional backend |
| `validate-frontend` | 15368 | Gate funcional frontend |

```text
strict: true
```

Invariantes preservadas por la mutación:

```text
enforce_admins: true
required_linear_history: true
required_conversation_resolution: true
allow_force_pushes: false
allow_deletions: false
required_approving_review_count: 0
require_code_owner_reviews: false
```

Actions del repositorio:

```text
enabled: true
allowed_actions: selected
sha_pinning_required: true

selected actions:
  github_owned_allowed: true
  verified_allowed: false
  patterns_allowed:
    - pnpm/action-setup@*

default_workflow_permissions: read
can_approve_pull_request_reviews: false
```

Inventario de workflows auditado sobre la base documental del bloque:

```text
workflows: 6
uses references: 20
remote actions: 20
unpinned actions: 0
unknown uses references: 0
```

El allowlist de Actions y el SHA pinning son controles simultáneos y no intercambiables: el
allowlist decide **qué** actions pueden invocarse; el pinning decide **con qué referencia
inmutable** se invocan. Desactivar uno no queda compensado por el otro.

## 4. Matriz de evidencias

| # | Evidencia | Tipo | Resultado |
| --- | --- | --- | --- |
| 1 | Auditoría inicial de branch protection y required checks | Lectura `gh api` | Dos contextos requeridos; gates funcionales no required |
| 2 | Mutación de required checks a cuatro contextos con `strict: true` | Config-only, R3 | Aplicada; invariantes de protección preservadas |
| 3 | Canaria positiva #1616 | PR docs-only, cerrada sin merge | Cuatro required `success`; heavies `skipped`; `mergeStateStatus` final `CLEAN` |
| 4 | Canaria #1617 | PR, cerrada sin merge | **Inválida como evidencia negativa**; clasificada como hallazgo de descubrimiento de tests |
| 5 | Canaria negativa válida #1618 | PR, cerrada sin merge | `validate-backend` `failure`; `mergeStateStatus` `BLOCKED` con `mergeable: MERGEABLE` |
| 6 | Auditoría de GitHub Actions settings e inventario de workflows | Lectura `gh api` + árbol | 6 workflows, 20 `uses`, 0 sin pinnear |
| 7 | Mutación de Actions permissions | Config-only, R3 | `selected` + pinning obligatorio + token `read` |
| 8 | PR de closeout documental (esta PR) | PR docs-only | Canaria post-hardening; ver sección 8 |

## 5. Canaria positiva #1616

| Campo | Evidencia |
| --- | --- |
| Título | `test(ci): verify required checks enforcement` |
| Rama | `test/pr-ci-05-required-checks-canary` |
| Head | `dfb4b6c8eddedba54ea4a9c4d421857db68c0ad6` |
| Estado | `CLOSED`; `mergedAt=null` |
| `mergeable` | `MERGEABLE` |
| `mergeStateStatus` durante pending | `BLOCKED` |
| `mergeStateStatus` final | `CLEAN` |

| Workflow / run | Job | Resultado |
| --- | --- | --- |
| PR Governance `30540671662` | `validate-pr-governance` | `success` |
| QGA Governance `30540671695` | `qga-workflow-security` | `success` |
| Backend CI `30540671681` (`pull_request`) | `detect-backend-impact` | `success` |
| Backend CI `30540671681` (`pull_request`) | `backend-heavy-validation` | `skipped` |
| Backend CI `30540671681` (`pull_request`) | `validate-backend` | `success` |
| Frontend CI `30540671802` (`pull_request`) | `detect-frontend-impact` | `success` |
| Frontend CI `30540671802` (`pull_request`) | `frontend-heavy-validation` | `skipped` |
| Frontend CI `30540671802` (`pull_request`) | `validate-frontend` | `success` |
| Supabase Preview | integración externa | `skipped` |

La rama `test/**` también disparó Backend CI por evento `push` (run `30540668745`), donde el
detector fija impacto verdadero y el heavy se ejecuta. Ese resultado duplicado es esperado y no
contradice la ruta de `pull_request`: el contexto debe identificarse por workflow, evento y app,
no exigiendo unicidad absoluta por nombre.

Conclusión: con cuatro required checks, un PR docs-only alcanza `CLEAN` y no queda bloqueado
indefinidamente. El paso transitorio por `BLOCKED` mientras los checks están pendientes es la
conducta esperada de strict mode, no una regresión.

## 6. Canaria #1617 — inválida como evidencia negativa

| Campo | Evidencia |
| --- | --- |
| Título | `test(ci): prove failed required gate blocks merge` |
| Rama | `test/pr-ci-05-required-checks-negative-canary` |
| Head | `9a744094ca64932cc271f8af587b3a853ec64e34` |
| Estado | `CLOSED`; `mergedAt=null` |
| `mergeStateStatus` final | `CLEAN` |

El archivo de la canaria se creó en:

```text
test/unit/infrastructure/required-checks-negative-canary.test.ts
```

El patrón efectivo del script de test de la raíz es:

```text
test/**/*.test.ts
```

En el runner observado ese patrón no descubrió ese nivel de anidamiento, de modo que el test
intencionalmente roto nunca formó parte de la suite efectiva. Backend CI pasó correctamente:
`backend-heavy-validation` y `validate-backend` terminaron en `success` porque no había ningún
test fallido que ejecutar.

Clasificación: **#1617 no es evidencia negativa de enforcement de required checks**. Su
resultado se registra exclusivamente como hallazgo diagnóstico de descubrimiento de tests
(sección 11). No demuestra que un gate fallido no bloquee, y no debe citarse como tal.

## 7. Canaria negativa válida #1618

| Campo | Evidencia |
| --- | --- |
| Título | `test(ci): prove failed required check blocks merge` |
| Rama | `canary/pr-ci-05-required-checks-negative-v2` |
| Head | `649ae7d702de37680f3cbdbea073a1e8be126a5a` |
| Estado | `CLOSED`; `mergedAt=null` |
| `mergeable` | `MERGEABLE` |
| `mergeStateStatus` | `BLOCKED` |

Archivo utilizado:

```text
test/unit/required-checks-negative-canary.test.ts
```

El descubrimiento local mediante `pnpm test` quedó confirmado antes de abrir la PR, de modo que
el fallo intencional sí pertenecía a la suite efectiva.

| Workflow / run | Job | Resultado |
| --- | --- | --- |
| PR Governance `30541832254` | `validate-pr-governance` | `success` |
| QGA Governance `30541831322` | `qga-workflow-security` | `success` |
| Backend CI `30541831909` | `detect-backend-impact` | `success` |
| Backend CI `30541831909` | `backend-heavy-validation` | `failure` (intencional) |
| Backend CI `30541831909` | `validate-backend` | `failure` |
| Frontend CI `30541831945` | `detect-frontend-impact` | `success` |
| Frontend CI `30541831945` | `frontend-heavy-validation` | `skipped` |
| Frontend CI `30541831945` | `validate-frontend` | `success` |

Conclusión: un fallo funcional en un contexto required bloquea el merge. La combinación
`mergeable: MERGEABLE` con `mergeStateStatus: BLOCKED` demuestra además que `mergeable` describe
la ausencia de conflictos de árbol, no el cumplimiento de branch protection.

## 8. Canaria post-hardening

La propia PR docs-only de este closeout es la canaria post-hardening del bloque. No se crea otra
PR canaria.

Antes de su merge debe demostrar:

```text
validate-pr-governance: SUCCESS
qga-workflow-security: SUCCESS
validate-backend: SUCCESS
validate-frontend: SUCCESS
backend-heavy-validation: SKIPPED
frontend-heavy-validation: SKIPPED
```

Ese resultado confirma, después del hardening de Actions, que siguen operativos:

- `actions/checkout`;
- `actions/setup-node`;
- `pnpm/action-setup`, cubierta por el patrón allowlisted `pnpm/action-setup@*`;
- la GitHub App de QGA (`app_id 4291335`) sobre `pull_request_target`;
- los cuatro required checks;
- `GITHUB_TOKEN` con `default_workflow_permissions: read`.

Un fallo de cualquiera de esos elementos indicaría que el allowlist, el pinning obligatorio o la
reducción de permisos del token degradaron la ejecución, y sería causa de rollback según la
sección 10.

## 9. Seguridad

- Ninguna credencial, token, cookie, secreto ni hash de credencial se documenta en este closeout.
- Ningún payload transcrito contiene tokens ni respuestas API sensibles; solo se registran
  identificadores públicos de PR, run, job, commit y app.
- Ninguna ruta local de usuario se incorpora al repositorio; todos los enlaces son relativos.
- Las evidencias locales de verificación permanecen fuera de Git.
- Los `app_id` registrados son identificadores públicos de GitHub Apps, no credenciales.

## 10. Rollback

Rollback preparado, **no ejecutado**. Son dos rollbacks separados e independientes.

### 10.1 Required checks

Restaurar el conjunto anterior de contextos requeridos:

```json
{
  "strict": true,
  "checks": [
    {
      "context": "validate-pr-governance",
      "app_id": 15368
    },
    {
      "context": "qga-workflow-security",
      "app_id": 4291335
    }
  ]
}
```

### 10.2 Actions

Restaurar la política previa de Actions:

```text
allowed_actions: all
sha_pinning_required: false
default_workflow_permissions: write
can_approve_pull_request_reviews: false
```

Ambos rollbacks son R3 y requieren autorización específica y actual. Ninguno se ejecutó como
parte de este bloque. Ejecutar uno no implica ejecutar el otro: el bloque los aplicó como
mutaciones separadas y así deben revertirse. Las canarias no deben recrearse ni mergearse.

## 11. Hallazgo secundario — descubrimiento de tests

```text
test/**/*.test.ts no descubrió el nivel test/unit/infrastructure observado.
```

Registro del hallazgo:

- se observó al construir la canaria #1617, sobre el runner efectivo del script de test de la
  raíz;
- no es una regresión causada por el BLOQUE 05: ninguna mutación del bloque tocó scripts, runner,
  workflows ni tests;
- no invalida las suites de infraestructura existentes, que se ejecutan en CI a través de sus
  propios paths;
- no cierra ni reabre ningún control de testing architecture.

Este bloque no abre una iniciativa de testing architecture. Cualquier corrección del patrón de
descubrimiento requiere su propio scope, con evidencia previa del inventario real de archivos
descubiertos y no descubiertos.

## 12. Límite del cierre

- Los cuatro required checks son efectivos y verificados en modo lectura el 2026-07-30.
- El hardening de Actions es efectivo y verificado el 2026-07-30.
- `ERM-CTRL-014` queda `IMPLEMENTED`; `ERM-CI-002` queda cerrado operativamente y su snapshot
  histórico se conserva sin reescribir.
- Este cierre no declara cerrados gaps ajenos: `ERM-FE-001`, `ERM-DEP-001` y los gaps runtime de
  seguridad, datos, observabilidad y release permanecen abiertos bajo sus controles.
- Este cierre no implica cobertura de tests, lint backend, SBOM ni Dependabot security updates.
- El BLOQUE 06 permanece `NOT_RUN`.
- El bloque no se declara definitivamente cerrado hasta que la PR de closeout esté fusionada con
  el resultado de la sección 8.

## 13. Limpieza

- #1616, #1617 y #1618 están cerradas sin merge.
- Las ramas `test/pr-ci-05-required-checks-canary`,
  `test/pr-ci-05-required-checks-negative-canary` y
  `canary/pr-ci-05-required-checks-negative-v2` no existen local ni remotamente.
- `main` no contiene cambios de ninguna canaria.
- Al cierre local del bloque hay 0 PRs abiertos.

## 14. Validación del closeout

| Verificación | Estado |
| --- | --- |
| Cuatro required checks exactos con sus `app_id` | `PASSED` |
| `strict: true` y invariantes de branch protection preservadas | `PASSED` |
| `allowed_actions: selected` y `sha_pinning_required: true` | `PASSED` |
| Selected actions: GitHub-owned permitidas, verified deshabilitadas, patrón `pnpm/action-setup@*` | `PASSED` |
| `default_workflow_permissions: read`; `can_approve_pull_request_reviews: false` | `PASSED` |
| PRs #1616, #1617 y #1618 cerradas sin merge | `PASSED` |
| 0 PRs abiertos y 0 ramas canaria residuales | `PASSED` |
| #1617 clasificada como diagnóstico y no como evidencia negativa | `PASSED` |
| #1618 usada como única evidencia negativa válida | `PASSED` |
| Inventario de workflows: 6 workflows, 20 `uses`, 0 sin pinnear | `PASSED` |
| Allowlist exacta de seis documentos | `PASSED` |
| Links Markdown relativos válidos | `PASSED` |
| UTF-8 sin BOM, final newline y ausencia de trailing whitespace | `PASSED` |
| Enterprise controls: 25 IDs únicos y vocabulario permitido | `PASSED` |
| `ERM-CTRL-013=IMPLEMENTED`; `ERM-CTRL-014=IMPLEMENTED` | `PASSED` |
| Mutaciones Git/GitHub ejecutadas por este closeout | `0` |
| Código, workflows, tests, scripts, dependencias y lockfiles modificados | `0` |
| Canaria post-hardening (sección 8) | `NOT_RUN` hasta el merge de esta PR |

Resultado documental:

```text
BLOQUE 03: CLOSED
BLOQUE 04: CLOSED
BLOQUE 05: CLOSED
BLOQUE 06: NOT_RUN
base documental: 2ddd4fa711d07d5b8eb8e1a114107ae28cd0036b
```
