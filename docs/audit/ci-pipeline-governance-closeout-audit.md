# CI/CD Pipeline Governance Closeout Audit

| Campo | Valor |
| --- | --- |
| Control auditado | `ERM-CTRL-013` — CI/CD Pipeline Governance |
| Gap | `ERM-CI-001` |
| Fecha | 2026-07-12 |
| Auditor | Engineering governance / CI owner |
| Estado observado | Implementación efectiva con gate global requerido y CI condicional por paths |
| Dictamen | `IMPLEMENTED`, sujeto a revisión periódica |

## 1. Pregunta de auditoría

¿El repositorio dispone de un pipeline de pull requests gobernado, con checks identificados por tipo de cambio, un gate requerido efectivo y evidencia de que un fallo impide completar el flujo de merge?

## 2. Alcance

Incluido:

- `.github/workflows/pr-governance.yml`;
- `.github/workflows/backend-ci.yml`;
- `.github/workflows/frontend-ci.yml`;
- `docs/ops/CI_PR_CHECKS_RUNBOOK.md`;
- branch protection ya evidenciada por `ERM-CTRL-015`;
- PRs #1447, #1448 y #1449;
- workflow runs `29212530876`, `29212737354` y `29213010708`.

Excluido:

- mutar workflows;
- mutar branch protection o rulesets;
- convertir jobs condicionales en required checks globales;
- backend, frontend, API, auth, sesiones o runtime;
- DB, schema, migraciones o datos;
- dependencias, manifests o lockfiles;
- snapshots históricos del baseline y gap register;
- segundo worktree.

## 3. Método

1. inspección de triggers, permisos, jobs y pasos de los workflows;
2. comparación entre el runbook y la configuración efectiva;
3. verificación de evidencia negativa y positiva sobre el mismo gate;
4. separación explícita entre required check global y CI condicional;
5. evaluación contra el closure criteria vigente de `ERM-CTRL-013`.

## 4. Hallazgos

### 4.1 PR Governance

El workflow `PR Governance` se ejecuta en cada pull request hacia `main`.

El job se denomina exactamente `validate-pr-governance`, usa permisos mínimos `contents: read` y valida:

- integridad del diff;
- paths sensibles;
- secretos en líneas agregadas;
- Markdown y enlaces;
- metadata mínima;
- clasificación y coherencia de scope.

Branch protection exige ese contexto con strict status checks y enforcement para administradores, según la evidencia durable de `ERM-CTRL-015`.

Resultado: **PASS**.

### 4.2 Backend CI

`Backend CI`:

- se ejecuta en PR hacia `main`;
- ignora documentación y Markdown;
- se ejecuta también en pushes a los prefijos operativos configurados;
- usa Postgres 16 efímero;
- ejecuta instalación congelada, auditorías, migraciones, typecheck, typecheck:test, tests y build;
- mantiene permisos `contents: read`.

Existe un test de contrato en `test/unit/infrastructure/backend-ci-workflow.test.ts` que verifica triggers, Postgres y orden de gates.

Resultado: **PASS como workflow condicional**.

### 4.3 Frontend CI

`Frontend CI`:

- se ejecuta en PR a `main` cuando cambia `frontend/**`, manifests/workspace o el propio workflow;
- ejecuta lint, typecheck, build, auditoría de superficie pública y E2E estratificado;
- publica artifact Playwright solo en failure;
- mantiene permisos `contents: read`.

Resultado: **PASS como workflow condicional**.

### 4.4 Evidencia negativa

PR #1447:

- body deliberadamente incompleto;
- head `533b1ab0fa6c58bf75a8171e16116c47dcbb918c`;
- run `29212530876`;
- `PR Governance`: `failure`;
- PR cerrada sin merge;
- rama eliminada.

La canaria demuestra que un PR inválido no obtiene el contexto requerido.

Resultado: **PASS**.

### 4.5 Evidencia positiva

PR #1448:

- docs-only válido;
- run `29212737354`;
- `PR Governance`: `success`;
- squash merge `6a96a6f11b1e9e8296d48a2992f4716601e20ecd`.

PR #1449:

- docs-only válido;
- run `29213010708`;
- `PR Governance`: `success`;
- squash merge `5f929b358e8b742bad6e54ac750625bd599babe4`.

Resultado: **PASS**.

### 4.6 Runbook

El runbook anterior presentaba dos desviaciones:

1. no listaba `PR Governance` como gate global requerido;
2. mostraba `git reset --hard origin/main` como parte del cleanup posterior al merge.

La actualización de este cierre:

- añade el mapa completo de checks;
- distingue obligatoriedad global de aplicabilidad condicional;
- define estados aceptables y bloqueantes;
- reemplaza el procedimiento destructivo por `git pull --ff-only` y verificaciones explícitas.

Resultado: **CORREGIDO**.

## 5. Matriz de cumplimiento

| Criterio | Evidencia | Resultado |
| --- | --- | --- |
| Required checks listados | Runbook y closeout con mapa efectivo | PASS |
| Gate global observable | `validate-pr-governance` requerido en `main` | PASS |
| Fallo bloqueante demostrado | PR #1447 / run `29212530876` | PASS |
| Ruta válida demostrada | PR #1448 y #1449 | PASS |
| Backend CI documentado | Workflow y test de contrato | PASS |
| Frontend CI documentado | Workflow por paths y steps | PASS |
| Owner y fecha | CI owner / 2026-07-12 | PASS |
| Review cadence | Mensual y ante cambios CI | PASS |
| Snapshots históricos preservados | Baseline y gap register fuera de scope | PASS |

## 6. Limitaciones explícitas

- Solo `validate-pr-governance` se documenta como contexto global requerido por branch protection.
- Backend CI y Frontend CI son condicionales por triggers/paths y no deben presentarse como required checks universales.
- Supabase Preview es una integración externa y puede aparecer `SKIPPED` cuando no aplica.
- Este cierre no evalúa cobertura, mutation testing, complejidad o supply-chain provenance; esos temas pertenecen a otros controles.
- Este cierre no resuelve `ERM-CTRL-014`, que conserva deuda sobre arquitectura integral de quality gates y mínimo privilegio más amplio.

## 7. Riesgos residuales

| Riesgo | Tratamiento |
| --- | --- |
| Deriva del nombre del job requerido | revisión mensual y ante cambios del workflow |
| Filtros de paths desactualizados | revisar ante cambios de arquitectura o manifests |
| Runbook divergente | mantenerlo en el mismo PR que cambie triggers o checks |
| Bypass administrativo | admins enforcement permanece habilitado; reabrir ante drift |
| Confusión entre `SKIPPED` y fallo | runbook define estados aceptables y aplicabilidad |

## 8. Dictamen

`ERM-CTRL-013` cumple su closure criteria operativo:

- los checks están listados por aplicabilidad;
- existe un gate requerido efectivo;
- la canaria negativa falló y no fue fusionada;
- existen rutas positivas con el mismo gate;
- la documentación operativa coincide con la configuración observada.

Se recomienda la transición:

- `ERM-CTRL-013`: `PARTIAL / 2 / P1` → `IMPLEMENTED / 3 / NONE`;
- `ERM-CI-001`: cerrado operativamente el 2026-07-12;
- snapshots históricos: preservados sin modificación.

## 9. Evidencia durable

- [Implementation closeout](../implementation/ci-pipeline-governance-closeout.md)
- [CI PR Checks Runbook](../ops/CI_PR_CHECKS_RUNBOOK.md)
- [Branch Protection implementation closeout](../implementation/branch-protection-governance-closeout.md)
- [Branch Protection closeout audit](./branch-protection-governance-closeout-audit.md)
- [Enterprise Control Register](../governance/enterprise-control-register.md)

## 10. Reapertura

Reabrir el control ante cualquiera de estas condiciones:

- el required check deja de existir o de ser requerido;
- la canaria equivalente puede llegar a merge;
- el job cambia de nombre sin actualizar branch protection;
- Backend CI o Frontend CI pierden gates esenciales sin control compensatorio;
- el runbook deja de representar la configuración vigente;
- aparece una vía de merge que evita los checks documentados.