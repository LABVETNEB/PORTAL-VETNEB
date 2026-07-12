# Change Control Governance — Implementation Closeout

| Campo | Valor |
| --- | --- |
| Implementation owner | CI owner / Engineering governance |
| Domain | Change Control and Pull Request Governance |
| Lifecycle status | CLOSED |
| Implementation date | 2026-07-12 |
| Repository base | `main@6a96a6f11b1e9e8296d48a2992f4716601e20ecd` |
| Control | `ERM-CTRL-006` |
| Historical gap | `ERM-CHG-001` |
| Audit record | [Change Control Governance — Closeout Audit](../audit/change-control-governance-closeout-audit.md) |
| Negative canary | PR #1447; workflow run `29212530876` |
| Positive path | PR #1448; workflow run `29212737354` |

## Objetivo

Cerrar operativamente Change Control Governance demostrando que los pull requests dirigidos a `main` están sujetos a un contrato mínimo verificable y a un check requerido que distingue de forma observable una entrega inválida de una entrega válida.

## Estado implementado

El repositorio aplica el siguiente flujo de cambio:

1. todo cambio hacia `main` se entrega mediante pull request protegido;
2. el PR body debe declarar `Summary`, `Scope`, `Validation` y `Rollback`;
3. `.github/workflows/pr-governance.yml` ejecuta el job `validate-pr-governance` en cada pull request hacia `main`;
4. el workflow inspecciona integridad del diff, archivos sensibles, secretos, Markdown, metadata y compatibilidad del scope declarado;
5. branch protection requiere el contexto `validate-pr-governance` en modo estricto;
6. una entrega cuyo check requerido falla no satisface el merge gate;
7. una entrega válida puede avanzar cuando el check requerido finaliza correctamente.

## Fuentes normativas y técnicas

- [PR Readiness Review Checklist](../governance/pr-readiness-review-checklist.md)
- [Review Governance](../review-governance.md)
- [Branch Protection Governance — Implementation Closeout](./branch-protection-governance-closeout.md)
- `.github/PULL_REQUEST_TEMPLATE.md`
- `.github/workflows/pr-governance.yml`

## Contrato mínimo del pull request

El contrato operativo exige:

- resumen y contexto del cambio;
- scope explícito;
- validaciones realmente ejecutadas o justificación de no aplicación;
- evaluación de seguridad y regresión cuando corresponda;
- rollback trigger, pasos y data impact;
- exclusiones explícitas cuando el alcance pueda resultar ambiguo.

El workflow no confía únicamente en una checklist humana: valida automáticamente la presencia de las secciones requeridas y compara las declaraciones exclusivas `docs-only` o `CI-only` con los archivos realmente modificados.

## Evidencia negativa

PR #1447 fue creada como canaria reversible con un único archivo Markdown temporal y un body deliberadamente incompleto.

Resultado:

| Campo | Evidencia |
| --- | --- |
| Head SHA | `533b1ab0fa6c58bf75a8171e16116c47dcbb918c` |
| Workflow | `PR Governance` |
| Run | `29212530876` |
| Job requerido | `validate-pr-governance` |
| Conclusión | `failure` |
| Motivo inducido | ausencia de `Summary`, `Scope`, `Validation` y `Rollback` |
| Estado final | closed |
| Merge | no |
| Rama canaria | eliminada y ausencia verificada |

Esta canaria demuestra que una entrega que no cumple el contrato mínimo produce un check requerido fallido.

## Evidencia positiva

PR #1448 fue una entrega docs-only con scope explícito y body completo.

Resultado:

| Campo | Evidencia |
| --- | --- |
| Head SHA | `6ea8bf29f9f72e7cb0c3bfcf0180a0f6bf39ec29` |
| Workflow | `PR Governance` |
| Run | `29212737354` |
| Job requerido | `validate-pr-governance` |
| Conclusión | `success` |
| Estado final | merged |
| Merge commit | `6a96a6f11b1e9e8296d48a2992f4716601e20ecd` |

Esta ruta positiva demuestra que el mismo gate permite una entrega conforme y verificable.

## Alcance del closeout

Incluido:

- evidencia durable del contrato mínimo de PR;
- evidencia negativa y positiva del check requerido;
- transición operativa de `ERM-CTRL-006`;
- cierre operativo de `ERM-CHG-001` con trazabilidad histórica.

Excluido:

- cambios en workflows o branch protection;
- cambios en CODEOWNERS;
- backend, frontend, API, auth, sesiones o runtime;
- DB, schema, migraciones o datos;
- dependencias o lockfiles;
- reescritura del baseline o gap register históricos;
- cambios en el segundo worktree.

## Riesgo residual

- el control depende de que el nombre requerido `validate-pr-governance` permanezca alineado entre workflow y branch protection;
- el validador no reemplaza revisión técnica especializada;
- un único maintainer conserva concentración de administración y merge;
- cambios en el template, workflow o protección deben revalidar este control;
- el estado `IMPLEMENTED` debe reabrirse ante drift que permita merge sin el gate requerido.

## Mantenimiento

Revalidar ante:

- cambios en `.github/PULL_REQUEST_TEMPLATE.md`;
- cambios en `.github/workflows/pr-governance.yml`;
- cambios de branch protection o rulesets;
- cambios en el nombre del job requerido;
- cambios en el modelo de maintainers;
- incidentes de bypass o merge sin checks.

## Rollback del cierre documental

Si la evidencia se invalida:

1. revertir el commit que incorpore este closeout;
2. restaurar `ERM-CTRL-006` a `PARTIAL / 2 / P1`;
3. reabrir `ERM-CHG-001` operativamente;
4. registrar la causa del drift y el plan de corrección.

No existe impacto sobre runtime, datos ni producto.