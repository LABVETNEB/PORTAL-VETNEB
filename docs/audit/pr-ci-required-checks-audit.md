# PR-CI-REQUIRED-CHECKS Audit

| Campo | Valor |
| --- | --- |
| Document owner | CI owner / Engineering governance |
| Domain | CI/CD and Quality Gate Governance |
| Lifecycle status | ACTIVE |
| Authoritative source role | Closeout durable del BLOQUE 05 |
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

El BLOQUE 05 del [Plan B](./enterprise-roadmap-consolidation-plan.md) absorbió dos objetivos del
roadmap original:

- `PR-CI-1`: convertir en required checks los gates funcionales `validate-backend` y
  `validate-frontend`;
- `PR-CI-4`: endurecer GitHub Actions mediante allowlist seleccionada, pinning SHA obligatorio y
  permiso predeterminado `read` para `GITHUB_TOKEN`.

Las mutaciones fueron config-only y no modificaron backend, frontend, workflows, tests, scripts,
dependencias ni lockfiles. El enforcement quedó demostrado mediante las canarias #1616, #1617 y
#1618, cerradas sin merge, y mediante la PR docs-only #1619 como canaria post-hardening.

Los cuatro contextos requeridos efectivos son:

```text
validate-pr-governance   app_id 15368
qga-workflow-security    app_id 4291335
validate-backend         app_id 15368
validate-frontend        app_id 15368
strict: true
```

`ERM-CTRL-014` Quality Gate Architecture pasa de `PARTIAL` a `IMPLEMENTED`; `ERM-CI-002` queda
cerrado operativamente sin reescribir su snapshot histórico.

## 2. Estado anterior

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
can_approve_pull_request_reviews: false
```

En ese estado, un gate funcional fallido no era un contexto required de branch protection.

## 3. Estado posterior

Branch protection de `main`, verificada en modo lectura el 2026-07-30:

| Contexto requerido | App ID | Clase |
| --- | ---: | --- |
| `validate-pr-governance` | 15368 | Governance de PR |
| `qga-workflow-security` | 4291335 | Seguridad de workflows |
| `validate-backend` | 15368 | Gate funcional backend |
| `validate-frontend` | 15368 | Gate funcional frontend |

Invariantes preservadas:

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

github_owned_allowed: true
verified_allowed: false
patterns_allowed:
  - pnpm/action-setup@*

default_workflow_permissions: read
can_approve_pull_request_reviews: false
```

Inventario auditado:

```text
workflows: 6
uses references: 20
remote actions: 20
unpinned actions: 0
unknown uses references: 0
```

El allowlist y el SHA pinning son controles simultáneos: el allowlist limita qué actions pueden
invocarse y el pinning exige referencias inmutables.

## 4. Matriz de evidencias

| # | Evidencia | Tipo | Resultado |
| --- | --- | --- | --- |
| 1 | Auditoría inicial de branch protection | Lectura `gh api` | Dos contextos required; gates funcionales no required |
| 2 | Mutación de required checks | Config-only R3 | Cuatro contextos con `strict: true`; invariantes preservadas |
| 3 | Canaria positiva #1616 | PR docs-only cerrada sin merge | Cuatro required `success`; heavies `skipped`; estado final `CLEAN` |
| 4 | Canaria #1617 | PR cerrada sin merge | Inválida como evidencia negativa; hallazgo de descubrimiento de tests |
| 5 | Canaria negativa válida #1618 | PR cerrada sin merge | `validate-backend` `failure`; merge `BLOCKED` con árbol `MERGEABLE` |
| 6 | Auditoría de Actions | Lectura `gh api` + árbol | 6 workflows; 20 `uses`; 0 sin pinnear |
| 7 | Mutación de Actions permissions | Config-only R3 | `selected`; pinning obligatorio; token predeterminado `read` |
| 8 | PR de closeout #1619 | Canaria docs-only post-hardening | `PASSED`; cuatro required `success`; ambos heavies `skipped` |

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
| Backend CI `30540671681` | `detect-backend-impact` | `success` |
| Backend CI `30540671681` | `backend-heavy-validation` | `skipped` |
| Backend CI `30540671681` | `validate-backend` | `success` |
| Frontend CI `30540671802` | `detect-frontend-impact` | `success` |
| Frontend CI `30540671802` | `frontend-heavy-validation` | `skipped` |
| Frontend CI `30540671802` | `validate-frontend` | `success` |

La rama `test/**` también generó resultados por `push`. La identificación operativa debe usar
workflow, evento y app; no debe exigir unicidad absoluta por nombre.

Conclusión: un PR docs-only alcanza `CLEAN` y no queda bloqueado indefinidamente.

## 6. Canaria #1617 — inválida como evidencia negativa

| Campo | Evidencia |
| --- | --- |
| Título | `test(ci): prove failed required gate blocks merge` |
| Head | `9a744094ca64932cc271f8af587b3a853ec64e34` |
| Estado | `CLOSED`; `mergedAt=null` |

El archivo intencionalmente fallido se creó en:

```text
test/unit/infrastructure/required-checks-negative-canary.test.ts
```

El patrón efectivo observado fue:

```text
test/**/*.test.ts
```

En el runner observado, el patrón no descubrió ese nivel de anidamiento. El test no formó parte de
la suite efectiva, por lo que Backend CI pasó correctamente. #1617 se conserva únicamente como
hallazgo diagnóstico y no como evidencia negativa de enforcement.

## 7. Canaria negativa válida #1618

| Campo | Evidencia |
| --- | --- |
| Título | `test(ci): prove failed required check blocks merge` |
| Head | `649ae7d702de37680f3cbdbea073a1e8be126a5a` |
| Estado | `CLOSED`; `mergedAt=null` |
| `mergeable` | `MERGEABLE` |
| `mergeStateStatus` | `BLOCKED` |

Archivo utilizado:

```text
test/unit/required-checks-negative-canary.test.ts
```

| Workflow / run | Job | Resultado |
| --- | --- | --- |
| PR Governance `30541832254` | `validate-pr-governance` | `success` |
| QGA Governance `30541831322` | `qga-workflow-security` | `success` |
| Backend CI `30541831909` | `detect-backend-impact` | `success` |
| Backend CI `30541831909` | `backend-heavy-validation` | `failure` intencional |
| Backend CI `30541831909` | `validate-backend` | `failure` |
| Frontend CI `30541831945` | `detect-frontend-impact` | `success` |
| Frontend CI `30541831945` | `frontend-heavy-validation` | `skipped` |
| Frontend CI `30541831945` | `validate-frontend` | `success` |

Conclusión: un fallo funcional requerido bloquea el merge aunque el árbol siga siendo técnicamente
`MERGEABLE`.

## 8. Canaria post-hardening #1619

La PR docs-only #1619 es la canaria post-hardening del bloque. Sobre el head inicial
`475eb4c38cb7f95add89ab29b3df93e28e5c2dce` se observaron los resultados requeridos:

```text
validate-pr-governance: SUCCESS
qga-workflow-security: SUCCESS
validate-backend: SUCCESS
validate-frontend: SUCCESS
backend-heavy-validation: SKIPPED
frontend-heavy-validation: SKIPPED
```

Evidencia de Actions disponible:

| Workflow / run | Job | Resultado |
| --- | --- | --- |
| PR Governance `30545005626` | `validate-pr-governance` | `success` |
| Backend CI `30545005650` | `detect-backend-impact` | `success` |
| Backend CI `30545005650` | `backend-heavy-validation` | `skipped` |
| Backend CI `30545005650` | `validate-backend` | `success` |
| Frontend CI `30545005643` | `detect-frontend-impact` | `success` |
| Frontend CI `30545005643` | `frontend-heavy-validation` | `skipped` |
| Frontend CI `30545005643` | `validate-frontend` | `success` |
| QGA Governance | `qga-workflow-security` | `success` en el check rollup de la PR |

Resultado:

```text
CANARIA POST-HARDENING: PASSED
```

La prueba confirma que continúan operativos `actions/checkout`, `actions/setup-node`,
`pnpm/action-setup`, la GitHub App de QGA, los cuatro required checks y `GITHUB_TOKEN` con permiso
predeterminado `read`.

La fusión de #1619 publica el closeout durable en `main`; no constituye una condición técnica
adicional para declarar pasada la canaria, porque los resultados requeridos ya fueron observados.

## 9. Seguridad

- No se documentan credenciales, tokens, cookies ni secretos.
- No se incorporan respuestas API sensibles ni rutas locales de usuario.
- Los `app_id`, run IDs, job IDs y hashes de commit registrados son identificadores públicos.
- Las evidencias locales permanecen fuera de Git.

## 10. Rollback

Rollback preparado y no ejecutado. Son dos rollbacks separados.

### 10.1 Required checks

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

```text
allowed_actions: all
sha_pinning_required: false
default_workflow_permissions: write
can_approve_pull_request_reviews: false
```

Ambos rollbacks son R3 y requieren autorización específica. Ninguno se ejecutó.

## 11. Hallazgo secundario — descubrimiento de tests

```text
test/**/*.test.ts no descubrió el nivel test/unit/infrastructure observado.
```

El hallazgo se observó en #1617, no fue causado por el BLOQUE 05 y no cierra ni reabre controles
de testing architecture. Cualquier corrección requiere un scope independiente.

## 12. Límite del cierre

- Los cuatro required checks son efectivos y verificados.
- El hardening de Actions es efectivo y verificado.
- La canaria post-hardening #1619 está `PASSED`.
- `ERM-CTRL-014` queda `IMPLEMENTED`; `ERM-CI-002` queda cerrado operativamente.
- No se cierran gaps ajenos de frontend, dependencias, runtime, datos, observabilidad o release.
- El BLOQUE 06 permanece `NOT_RUN`.
- El merge de #1619 publica esta evidencia en `main` y no agrega una nueva condición técnica.

## 13. Limpieza

- #1616, #1617 y #1618 están cerradas sin merge.
- Sus ramas canaria no existen local ni remotamente.
- `main` no contiene cambios de las canarias.
- #1619 es la única PR de publicación del closeout durante esta verificación.

## 14. Validación del closeout

| Verificación | Estado |
| --- | --- |
| Cuatro required checks exactos con sus `app_id` | `PASSED` |
| `strict: true` e invariantes de branch protection | `PASSED` |
| `allowed_actions: selected`; `sha_pinning_required: true` | `PASSED` |
| Selected actions y patrón `pnpm/action-setup@*` | `PASSED` |
| `default_workflow_permissions: read` | `PASSED` |
| PRs #1616, #1617 y #1618 cerradas sin merge | `PASSED` |
| #1617 clasificada solo como diagnóstico | `PASSED` |
| #1618 usada como evidencia negativa válida | `PASSED` |
| Inventario: 6 workflows; 20 `uses`; 0 sin pinnear | `PASSED` |
| Enterprise controls: 25 IDs únicos | `PASSED` |
| `ERM-CTRL-013=IMPLEMENTED`; `ERM-CTRL-014=IMPLEMENTED` | `PASSED` |
| Canaria post-hardening #1619 | `PASSED` |
| Código, workflows, tests, scripts, deps y lockfiles modificados | `0` |

Resultado:

```text
BLOQUE 03: CLOSED
BLOQUE 04: CLOSED
BLOQUE 05: CLOSED
BLOQUE 06: NOT_RUN
base documental: 2ddd4fa711d07d5b8eb8e1a114107ae28cd0036b
```