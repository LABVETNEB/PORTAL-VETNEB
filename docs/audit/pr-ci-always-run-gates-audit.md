# PR-CI-ALWAYS-RUN-GATES Audit

| Campo | Valor |
| --- | --- |
| Document owner | CI owner / Engineering governance |
| Domain | CI/CD and Quality Gate Governance |
| Lifecycle status | ACTIVE |
| Authoritative source role | closeout durable del BLOQUE 04 |
| Effective date | 2026-07-29 |
| Last verified date | 2026-07-29 |
| Related controls | `ERM-CTRL-013`; `ERM-CTRL-014`; `ERM-CI-002` |
| Block status | `PR-CI-ALWAYS-RUN-GATES CLOSED` |
| Next block | `PR-CI-REQUIRED-CHECKS NOT_RUN` |

## 1. Resultado

El BLOQUE 04 quedó `CLOSED`. PR #1601 integró la arquitectura always-run de Backend CI y
Frontend CI; las canarias #1602 y #1603 comprobaron las rutas docs-only y backend sin
incorporar sus cambios a `main`.

Los contextos finales exactos:

```text
validate-backend
validate-frontend
```

se crean en todos los pull requests hacia `main`. Todavía no son required checks. Branch
protection no fue modificada y el BLOQUE 05 permanece `NOT_RUN`.

## 2. Baseline y alcance

El cierre se verificó sobre:

```text
main / origin/main / remoto main:
68c0789a47d4af66a42a37a26cf89f9ebfebbd48

working tree: limpio
stage: vacío
PRs abiertos: 0
```

Scope incluido:

- documentar el riesgo, diseño, implementación, canarias y límites del BLOQUE 04;
- reconciliar el mapa operativo de CI y los controles enterprise relacionados;
- conservar evidencia durable del rechazo inicial y de su corrección.

Scope excluido:

- branch protection y required checks;
- código, workflows, tests, dependencias, lockfiles, DB, migraciones, auth y runtime;
- inicio o preparación de `PR-CI-REQUIRED-CHECKS`.

## 3. Riesgo original

Los filtros de paths a nivel de workflow podían impedir que GitHub creara
`validate-backend` o `validate-frontend`. Un contexto ausente no podía convertirse de manera
segura en required check: en strict mode, un PR legítimo sin paths aplicables podía quedar sin
el contexto que branch protection esperaba.

El objetivo del bloque fue eliminar esa ausencia sin ejecutar validación pesada cuando el diff
no la necesita.

## 4. Diseño final

Cada workflow de pull request implementa la misma arquitectura:

```text
detector liviano
→ validación pesada condicional
→ check final siempre presente
```

- El detector calcula impacto desde el rango base/head del PR y publica `should_run`.
- El heavy corre únicamente cuando `should_run == true`.
- El check final usa `if: always()` y conserva el nombre estable expuesto a GitHub.
- La resolución es fail-closed: detector fallido, heavy fallido/cancelado o una combinación de
  estados inesperada hacen fallar el contexto final.
- En `push`, `should_run=true`; el comportamiento pesado previamente soportado se preserva.
- Postgres existe solo en `backend-heavy-validation`.
- La instalación de Chromium, E2E y el artifact Playwright existen solo en
  `frontend-heavy-validation`.

Un heavy `skipped` es válido únicamente cuando el detector concluye `impact=false` y el check
final termina `SUCCESS`.

## 5. Archivos técnicos de PR #1601

PR #1601 modificó exactamente:

- `.github/workflows/backend-ci.yml`;
- `.github/workflows/frontend-ci.yml`;
- `docs/architecture/ci-always-run-gates-rfc.md`;
- `test/unit/infrastructure/backend-ci-workflow.test.ts`;
- `test/unit/infrastructure/frontend-ci-workflow.test.ts`;
- `test/unit/infrastructure/workflow-security-policy-contract.test.ts`.

La decisión durable se conserva en
[RFC: CI Always-Run Pull Request Gates](../architecture/ci-always-run-gates-rfc.md), y el uso
operativo en [CI PR Checks Runbook](../ops/CI_PR_CHECKS_RUNBOOK.md).

## 6. PR técnica #1601

| Campo | Evidencia |
| --- | --- |
| Título | `ci(gates): make backend and frontend checks always present` |
| Estado | `MERGED` |
| Head técnico final | `a6b5ad4229daa488a84e0c5072be755ae9586502` |
| Squash SHA en `main` | `68c0789a47d4af66a42a37a26cf89f9ebfebbd48` |

| Workflow / run | Job | Resultado |
| --- | --- | --- |
| PR Governance `30484789993` | `validate-pr-governance` | `success` |
| Backend CI `30484790027` | `detect-backend-impact` | `success` |
| Backend CI `30484790027` | `backend-heavy-validation` | `success` |
| Backend CI `30484790027` | `validate-backend` | `success` |
| Frontend CI `30484790017` | `detect-frontend-impact` | `success` |
| Frontend CI `30484790017` | `frontend-heavy-validation` | `success` |
| Frontend CI `30484790017` | `validate-frontend` | `success` |
| QGA Governance `30484788281` | `qga-workflow-security` | `success` |

## 7. Rechazo inicial de Architecture Decision

El head inicial de #1601 fue:

```text
b26f60fa08da39a08b7dfca762193b70902524d3
```

PR Governance run `30484346394` terminó en `failure` con el mensaje exacto:

```text
Architecture Decision Reference must clearly identify an ADR or RFC.
```

La referencia inicial al Plan B no cumplía el contrato ADR/RFC. La corrección agregó
[`docs/architecture/ci-always-run-gates-rfc.md`](../architecture/ci-always-run-gates-rfc.md),
actualizó el body de #1601 y enmendó su único commit. Todos los checks pasaron sobre el head
final `a6b5ad4229daa488a84e0c5072be755ae9586502`.

Este rechazo no fue un fallo de la arquitectura CI. Fue evidencia positiva del enforcement de
`Architecture Decision`.

## 8. Canaria docs-only #1602

| Campo | Evidencia |
| --- | --- |
| Título | `test(canary): verify docs-only CI contexts` |
| Head | `171244b122b7ce9a2bc96e14cd9fee26d9f4d61b` |
| Estado | `CLOSED`; `mergedAt=null` |

| Workflow / run | Job | Resultado |
| --- | --- | --- |
| PR Governance `30488036416` | `validate-pr-governance` | `success` |
| Backend CI `30488036428` | `detect-backend-impact` | `success` |
| Backend CI `30488036428` | `backend-heavy-validation` | `skipped` |
| Backend CI `30488036428` | `validate-backend` | `success` |
| Frontend CI `30488036480` | `detect-frontend-impact` | `success` |
| Frontend CI `30488036480` | `frontend-heavy-validation` | `skipped` |
| Frontend CI `30488036480` | `validate-frontend` | `success` |
| QGA Governance `30488036532` | `qga-workflow-security` | `success` |

La canaria demuestra que un PR docs-only recibe ambos contextos finales sin ejecutar los
heavies.

## 9. Canaria backend #1603

| Campo | Evidencia |
| --- | --- |
| Título | `test(canary): verify backend CI routing` |
| Head | `562bf505f94da1a91d0780d6ecb63deafa48e34f` |
| Estado | `CLOSED`; `mergedAt=null` |

| Workflow / run | Job | Resultado |
| --- | --- | --- |
| PR Governance `30488332441` | `validate-pr-governance` | `success` |
| Backend CI `30488332446` | `detect-backend-impact` | `success` |
| Backend CI `30488332446` | `backend-heavy-validation` | `success` |
| Backend CI `30488332446` | `validate-backend` | `success` |
| Frontend CI `30488332517` | `detect-frontend-impact` | `success` |
| Frontend CI `30488332517` | `frontend-heavy-validation` | `skipped` |
| Frontend CI `30488332517` | `validate-frontend` | `success` |
| QGA Governance `30488332625` | `qga-workflow-security` | `success` |

La canaria demuestra que un cambio backend ejecuta Backend heavy mientras Frontend heavy queda
legítimamente `skipped`; ambos contextos finales permanecen presentes y exitosos.

## 10. Invariantes preservadas

La implementación conserva:

- actions externas pinneadas a SHA;
- permisos top-level `contents: read`;
- grupos de concurrency y `cancel-in-progress`;
- timeouts de detector, heavy y final;
- `pnpm audit --prod` y `pnpm audit`;
- migraciones sobre Postgres efímero;
- typechecks, tests y builds;
- lint, auditoría de superficie pública y E2E frontend;
- artifact Playwright únicamente ante failure;
- ausencia de `continue-on-error`.

## 11. Limpieza

- #1602 y #1603 están cerradas sin merge.
- Las ramas `canary/pr-ci-04-docs-only` y `canary/pr-ci-04-backend` no existen local ni
  remotamente.
- La rama técnica `ci/pr-ci-always-run-gates` tampoco permanece local ni remota.
- `main` no contiene cambios de las canarias.
- Hay 0 PRs abiertos al cierre.

## 12. Límite del cierre

- `validate-backend` y `validate-frontend` están siempre presentes en PRs hacia `main`.
- Ninguno de esos contextos es todavía required.
- Branch protection no fue modificada.
- `ERM-CTRL-014` permanece `PARTIAL`.
- `ERM-CI-002` no se cierra mientras ambos contextos no sean required efectivos.
- El BLOQUE 05 requiere autorización R3 separada y permanece `NOT_RUN`.

## 13. Rollback

Si fuera necesario deshacer la arquitectura, el rollback técnico es revertir el squash
`68c0789a47d4af66a42a37a26cf89f9ebfebbd48` de #1601 mediante un cambio separado y
autorizado. No se deben recrear ni mergear las canarias. Branch protection no requiere rollback
porque no fue modificada por el bloque.

## 14. Validación del closeout

| Verificación | Estado |
| --- | --- |
| PRs, heads, estados, run IDs y resultados de jobs | `PASSED` |
| Ausencia de ramas técnicas y canarias local/remota | `PASSED` |
| Allowlist exacta de seis documentos | `PASSED` |
| Links Markdown relativos | `PASSED` |
| UTF-8 sin BOM, final newline y trailing whitespace | `PASSED` |
| Enterprise controls: 25 IDs únicos y vocabulario permitido | `PASSED` |
| `ERM-CTRL-013=IMPLEMENTED`; `ERM-CTRL-014=PARTIAL` | `PASSED` |
| BLOQUE 04 `CLOSED`; BLOQUE 05 `NOT_RUN` | `PASSED` |
| Required checks, branch protection, código, workflows y tests modificados | `0` |

Resultado final:

```text
BLOQUE 04: CLOSED
BLOQUE 05: NOT_RUN
main: sin cambios hasta el merge documental
```
