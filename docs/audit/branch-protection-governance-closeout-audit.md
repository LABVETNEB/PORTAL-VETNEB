# Branch Protection Governance — Closeout Audit

| Campo | Valor |
| --- | --- |
| Audit owner | Engineering governance |
| Domain | Enterprise Repository Governance |
| Lifecycle status | CLOSED |
| Audit date | 2026-07-12 |
| Repository base | `main@f3de2630c0138ec5494b92ad52d970b3e6d79248` |
| Control | `ERM-CTRL-015` |
| Historical gap | `ERM-GOV-001` |
| Implementation record | [Branch Protection Governance — Implementation Closeout](../implementation/branch-protection-governance-closeout.md) |
| Canary | PR #1447 |
| Canary workflow run | `29212530876` |

## Objetivo

Auditar si Branch Protection Governance dispone de evidencia suficiente, durable y verificable para transicionar `ERM-CTRL-015` desde `PARTIAL` a `IMPLEMENTED` sin reescribir los snapshots históricos.

## Criterios auditados

El control exige:

1. branch protection efectiva sobre `main`;
2. flujo de pull request obligatorio;
3. required status check identificable y estricto;
4. administrator enforcement;
5. linear history y conversation resolution;
6. force pushes y branch deletion deshabilitados;
7. evidencia positiva de entrega con check exitoso;
8. evidencia negativa de head con check requerido fallido;
9. snapshot sanitizado enlazado desde el control register;
10. owner, fecha y cadencia de revisión;
11. trazabilidad explícita para `ERM-GOV-001`.

## Evidencia revisada

### Configuración administrativa

Se revisó el snapshot sanitizado del estado efectivo de `main`:

| Control | Estado observado |
| --- | --- |
| Required check | `validate-pr-governance` |
| Strict required checks | `true` |
| Administrator enforcement | `true` |
| Required approving reviews | `0` |
| Required CODEOWNER review | `false` |
| Required last-push approval | `false` |
| Dismiss stale reviews | `false` |
| Conversation resolution | `true` |
| Linear history | `true` |
| Force pushes | disabled |
| Branch deletion | disabled |

El modelo es coherente con el governance single-maintainer vigente: no exige una aprobación humana simulada, pero conserva el PR flow y el gate automatizado obligatorio.

### Evidencia positiva

PR #1446:

- entregó el modelo single-maintainer mediante PR;
- `validate-pr-governance` finalizó correctamente;
- fue mergeada a `main`;
- demuestra la ruta positiva del gate requerido.

### Evidencia negativa

PR #1447:

| Campo | Evidencia |
| --- | --- |
| Título | `test(governance): verify required-check blocking` |
| Base SHA | `f3de2630c0138ec5494b92ad52d970b3e6d79248` |
| Head SHA | `533b1ab0fa6c58bf75a8171e16116c47dcbb918c` |
| Rama | `canary/branch-protection-required-check` |
| Archivos | 1 Markdown temporal |
| Workflow | `PR Governance` |
| Run | `29212530876` |
| Conclusión | `failure` |
| Contexto requerido | `validate-pr-governance` |
| Motivo inducido | body sin `Summary`, `Scope`, `Validation` y `Rollback` |
| Estado final PR | closed |
| Merge | no |
| `merged_at` | `null` |
| Rama remota | eliminada y ausencia verificada |

La canaria fue deliberadamente reversible y no incluyó secretos, runtime, dependencias, DB ni cambios de configuración.

## Evaluación

| Criterio | Resultado | Fundamento |
| --- | --- | --- |
| Protección efectiva | PASS | snapshot sanitizado con required check, strict mode y administrator enforcement |
| PR flow | PASS | entregas #1446 y #1447 ejecutadas contra `main` mediante PR |
| Positive path | PASS | #1446 pasó el check requerido y fue mergeada |
| Negative path | PASS | #1447 produjo `validate-pr-governance: failure` y terminó cerrada sin merge |
| No destructive test | PASS | no se intentó bypass ni merge forzado |
| Durable evidence | PASS | implementación y auditoría versionadas y enlazadas desde el control register |
| Ownership | PASS | `Repository admin / Tech lead` |
| Verification date | PASS | 2026-07-12 |
| Review cadence | PASS | mensual y ante cambios de protección o checks |
| Historical integrity | PASS | baseline y gap register permanecen inmutables |

## Precisión semántica

El atributo GitHub `mergeable` no se interpreta como decisión de branch protection. Puede ser `true` cuando no existen conflictos aun si un required check está fallando.

La conclusión de enforcement se basa en la relación entre configuración y estado del check:

- el contexto `validate-pr-governance` es obligatorio y estricto;
- el head de #1447 obtuvo `failure` para ese contexto;
- por lo tanto el requisito de protección no estaba satisfecho;
- la canaria fue cerrada sin merge y su rama fue eliminada.

Esta auditoría no afirma que un intento destructivo de bypass haya sido ejecutado.

## Dictamen

**PASS — `ERM-CTRL-015` puede transicionar a `IMPLEMENTED`.**

La evidencia satisface los criterios operativos de Branch Protection Governance y permite cerrar `ERM-GOV-001` operativamente mediante evidencia posterior al snapshot histórico.

## Limitaciones y riesgo residual

- la configuración administrativa vive fuera del historial Git;
- el snapshot representa el estado verificado, no garantiza inmutabilidad futura;
- la cuenta única sigue concentrando administración, autoría y merge;
- cambios en el nombre del check pueden romper el vínculo requerido;
- no se ejecutó una prueba destructiva de bypass, por diseño;
- la revisión mensual y ante cambios es obligatoria para conservar el estado `IMPLEMENTED`.

## Recomendación de mantenimiento

Revalidar y registrar drift cuando cambie cualquiera de estos elementos:

- `.github/workflows/pr-governance.yml`;
- nombre del job `validate-pr-governance`;
- branch protection o rulesets de `main`;
- administradores o modelo de maintainer;
- force-push/delete settings;
- linear history o conversation resolution.

Ante drift no justificado, reabrir el control y volverlo a `PARTIAL` hasta generar nueva evidencia.
