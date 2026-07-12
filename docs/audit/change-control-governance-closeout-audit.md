# Change Control Governance — Closeout Audit

| Campo | Valor |
| --- | --- |
| Audit owner | Engineering governance |
| Domain | Change Control and Pull Request Governance |
| Lifecycle status | CLOSED |
| Audit date | 2026-07-12 |
| Repository base | `main@6a96a6f11b1e9e8296d48a2992f4716601e20ecd` |
| Control | `ERM-CTRL-006` |
| Historical gap | `ERM-CHG-001` |
| Implementation record | [Change Control Governance — Implementation Closeout](../implementation/change-control-governance-closeout.md) |
| Negative canary | PR #1447; workflow run `29212530876` |
| Positive path | PR #1448; workflow run `29212737354` |

## Objetivo

Auditar si Change Control Governance dispone de implementación observable y evidencia durable suficiente para transicionar `ERM-CTRL-006` desde `PARTIAL` a `IMPLEMENTED` sin reescribir los snapshots históricos.

## Criterios de cierre auditados

El control requiere:

1. template o política que defina contenido mínimo del PR;
2. validación automática del contrato mínimo;
3. ejecución en pull requests dirigidos a `main`;
4. required status check enlazado a branch protection;
5. evidencia negativa de una entrega inválida con check fallido;
6. evidencia positiva de una entrega válida con check exitoso;
7. ausencia de merge en la canaria negativa;
8. merge efectivo en la ruta positiva;
9. owner y fecha de verificación;
10. cadencia de revisión y criterio de reapertura;
11. trazabilidad explícita para `ERM-CHG-001`.

## Fuentes revisadas

- `.github/PULL_REQUEST_TEMPLATE.md`
- `.github/workflows/pr-governance.yml`
- [PR Readiness Review Checklist](../governance/pr-readiness-review-checklist.md)
- [Review Governance](../review-governance.md)
- [Branch Protection Governance — Implementation Closeout](../implementation/branch-protection-governance-closeout.md)
- [Branch Protection Governance — Closeout Audit](./branch-protection-governance-closeout-audit.md)
- PR #1447
- PR #1448

## Evaluación del contrato mínimo

El template de PR contiene secciones explícitas para:

- `Summary`;
- `Scope`;
- `Validation`;
- `Security / Regression Checklist`;
- `Rollback`.

El workflow `PR Governance` se ejecuta en eventos `pull_request` con base `main` y expone el job `validate-pr-governance`.

El validador comprueba:

- integridad del diff mediante `git diff --check`;
- política de archivos sensibles;
- patrones de secretos en líneas agregadas;
- validez UTF-8, marcadores de conflicto y enlaces locales Markdown;
- presencia de las secciones requeridas;
- compatibilidad entre declaraciones exclusivas de scope y archivos modificados.

## Evidencia negativa — PR #1447

| Campo | Resultado |
| --- | --- |
| Título | `test(governance): verify required-check blocking` |
| Base | `main` |
| Base SHA | `f3de2630c0138ec5494b92ad52d970b3e6d79248` |
| Head SHA | `533b1ab0fa6c58bf75a8171e16116c47dcbb918c` |
| Archivos | 1 Markdown temporal |
| Body | incompleto deliberadamente |
| Workflow | `PR Governance` |
| Run | `29212530876` |
| Conclusión | `failure` |
| Estado final | closed |
| Merge | no |
| `merged_at` | `null` |
| Rama | eliminada y ausencia verificada |

La falla fue inducida mediante la ausencia de `Summary`, `Scope`, `Validation` y `Rollback`. El experimento no incluyó secretos, runtime, dependencias, DB ni cambios administrativos.

## Evidencia positiva — PR #1448

| Campo | Resultado |
| --- | --- |
| Título | `docs(governance): close branch protection control` |
| Base | `main` |
| Head SHA | `6ea8bf29f9f72e7cb0c3bfcf0180a0f6bf39ec29` |
| Scope | docs-only |
| Archivos | 3 documentos declarados |
| Workflow | `PR Governance` |
| Run | `29212737354` |
| Conclusión | `success` |
| Estado final | merged |
| Merge commit | `6a96a6f11b1e9e8296d48a2992f4716601e20ecd` |

La ruta positiva utilizó el mismo job y cumplió el contrato mínimo de metadata y scope.

## Relación con branch protection

La evidencia de [Branch Protection Governance](./branch-protection-governance-closeout-audit.md) demuestra que:

- `validate-pr-governance` es un check requerido;
- los checks requeridos operan en modo estricto;
- administrator enforcement está activo;
- el flujo protegido es mediante pull request;
- force pushes y branch deletion están deshabilitados.

Esta auditoría no interpreta `mergeable` como decisión de protección. La conclusión se basa en la combinación verificable entre el contexto requerido y las conclusiones `failure`/`success` de los dos heads observados.

## Matriz de dictamen

| Criterio | Resultado | Fundamento |
| --- | --- | --- |
| Contrato mínimo documentado | PASS | template, checklist y review governance |
| Ejecución automática | PASS | workflow sobre PRs a `main` |
| Metadata requerida | PASS | validator exige las cuatro secciones nucleares |
| Scope verificable | PASS | comparación entre declaración y archivos modificados |
| Negative path | PASS | #1447 produjo `failure` y terminó sin merge |
| Positive path | PASS | #1448 produjo `success` y fue fusionada |
| Required merge gate | PASS | evidencia enlazada de branch protection |
| Reversibilidad | PASS | canaria cerrada y rama eliminada |
| Evidencia durable | PASS | implementación y auditoría versionadas |
| Historical integrity | PASS | baseline y gap register no se modifican |
| Ownership y fecha | PASS | CI owner; 2026-07-12 |
| Cadencia | PASS | por cambios CI y revisión mensual |

## Dictamen

**PASS — `ERM-CTRL-006` puede transicionar a `IMPLEMENTED`.**

El repositorio dispone de un contrato mínimo de pull request, validación automática, check requerido y evidencia observable de rechazo lógico de una entrega inválida junto con aceptación de una entrega válida.

`ERM-CHG-001` puede cerrarse operativamente mediante evidencia posterior al snapshot histórico. La fila histórica permanece inmutable y se conserva como trazabilidad del estado observado en su fecha.

## Limitaciones y riesgo residual

- el gate valida gobernanza y scope, no sustituye revisión funcional o de seguridad especializada;
- el modelo single-maintainer no aporta segregación de funciones humana;
- cambios en el nombre del job o en branch protection pueden invalidar el cierre;
- cambios en el template o validator pueden reducir cobertura;
- los checks específicos de backend, frontend, seguridad, DB y dependencias siguen gobernados por controles separados;
- cualquier bypass o merge sin required check obliga a reabrir el control.

## Recomendación de mantenimiento

Revalidar el control:

- mensualmente mientras continúe el programa enterprise;
- ante cambios en workflow, template, ruleset o branch protection;
- ante cambios de maintainers;
- después de cualquier incidente de merge o check bypass;
- cuando se agreguen nuevas categorías de scope.

## Resultado final

- `ERM-CTRL-006`: `IMPLEMENTED / 3 / NONE`;
- `ERM-CHG-001`: cerrado operativamente el 2026-07-12;
- snapshots históricos: sin modificaciones;
- impacto runtime, datos y producto: ninguno.