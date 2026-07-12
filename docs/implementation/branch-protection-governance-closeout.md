# Branch Protection Governance — Implementation Closeout

| Campo | Valor |
| --- | --- |
| Document owner | Repository admin / Engineering governance |
| Domain | Enterprise Repository Governance |
| Lifecycle status | CLOSED |
| Authoritative source role | Implementation and operational closure evidence for `ERM-CTRL-015` |
| Effective date | 2026-07-12 |
| Last verified date | 2026-07-12 |
| Review cadence | Monthly and whenever branch protection, required checks or repository administrators change |
| Supersedes | Administrative-only evidence recorded on 2026-07-11 |
| Superseded by | None |
| Related controls or gaps | `ERM-CTRL-015`; `ERM-GOV-001` |
| Evidence references | PR #1446 positive delivery; PR #1447 negative canary; workflow run `29212530876` |

## Propósito

Este registro cierra operativamente Branch Protection Governance para `main` mediante evidencia durable dentro del repositorio.

No modifica la protección de rama. Documenta la configuración efectiva ya aplicada, la ejecución positiva del flujo protegido y una canaria negativa controlada que produjo un check requerido fallido y fue cerrada sin merge.

## Alcance

Incluye:

- snapshot sanitizado de la configuración efectiva de protección de `main`;
- evidencia positiva de entrega mediante PR #1446;
- evidencia negativa mediante PR #1447;
- trazabilidad de cierre de `ERM-CTRL-015`;
- cierre operativo de `ERM-GOV-001` sin reescribir el gap register histórico.

Excluye:

- cambios en branch protection o rulesets;
- cambios en workflows o Actions permissions;
- cambios en CODEOWNERS;
- backend, frontend, API, autenticación, sesiones o runtime;
- base de datos, schema, migraciones o datos productivos;
- dependencias, package manifests o lockfiles;
- modificación de snapshots históricos;
- modificación del segundo worktree.

## Configuración efectiva sanitizada

La configuración administrativa de `main` fue verificada el 2026-07-11 y revalidada como base de la canaria del 2026-07-12.

```json
{
  "branch": "main",
  "required_status_checks": {
    "strict": true,
    "contexts": [
      "validate-pr-governance"
    ]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": false,
    "require_code_owner_reviews": false,
    "require_last_push_approval": false,
    "required_approving_review_count": 0
  },
  "required_conversation_resolution": true,
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false
}
```

El snapshot omite URLs, identificadores internos, actores y campos no necesarios. No contiene secretos, tokens ni credenciales.

## Evidencia positiva

PR #1446, `chore(governance): adopt single-maintainer repository model`:

- apuntó a `main`;
- ejecutó `PR Governance / validate-pr-governance` con resultado positivo;
- fue mergeada el 2026-07-11;
- demostró que el flujo protegido acepta una entrega cuando el check requerido finaliza correctamente;
- no dependió de una aprobación humana simulada.

## Evidencia negativa

PR #1447, `test(governance): verify required-check blocking`:

- base: `main@f3de2630c0138ec5494b92ad52d970b3e6d79248`;
- head: `533b1ab0fa6c58bf75a8171e16116c47dcbb918c`;
- rama: `canary/branch-protection-required-check`;
- alcance: un archivo Markdown temporal y no operativo;
- body deliberadamente incompleto, sin las secciones obligatorias `Summary`, `Scope`, `Validation` y `Rollback`;
- workflow `PR Governance`, run `29212530876`, resultado `failure`;
- check afectado: `validate-pr-governance`;
- PR cerrada el 2026-07-12 sin merge;
- `merged_at`: `null`;
- rama remota eliminada y ausencia verificada después de `fetch --prune`.

La canaria no intentó forzar un merge ni modificar `main`. La evidencia de bloqueo se deriva de la combinación verificable de:

1. `validate-pr-governance` configurado como required status check estricto para `main`;
2. ejecución del contexto requerido con conclusión `failure` en el head canario;
3. cierre sin merge del PR;
4. eliminación completa de la rama temporal.

El campo GitHub `mergeable` no se utiliza como evidencia de cumplimiento de branch protection porque representa principalmente conflictos de merge y no sustituye el estado de required checks.

## Resultado del control

`ERM-CTRL-015` puede transicionar de `PARTIAL` a `IMPLEMENTED` porque ahora existen:

- configuración efectiva observable;
- snapshot sanitizado durable;
- owner por rol;
- fecha de verificación;
- evidencia positiva de check requerido exitoso;
- evidencia negativa de check requerido fallido;
- PR canaria cerrada sin merge;
- revisión periódica definida;
- vínculo explícito desde el Enterprise Control Register.

`ERM-GOV-001` queda cerrado operativamente mediante esta evidencia posterior. Su fila histórica en el gap register se conserva sin cambios como snapshot del estado observado el 2026-07-10.

## Riesgo residual

- un único maintainer conserva autoridad administrativa y de merge;
- la protección depende de mantener estable el nombre del contexto `validate-pr-governance`;
- un cambio administrativo puede producir drift fuera del repositorio;
- los required checks no sustituyen revisión experta independiente;
- la protección debe revalidarse después de cambios en workflows, reglas, administradores o plan de GitHub.

## Mantenimiento

El control debe reabrirse o volver a `PARTIAL` si ocurre cualquiera de estas condiciones:

- `main` deja de requerir PR;
- `validate-pr-governance` deja de ser required o strict;
- administrator enforcement se desactiva;
- force pushes o branch deletion se habilitan;
- conversación resuelta o linear history dejan de exigirse sin justificación aprobada;
- una canaria futura demuestra que un head con required check fallido puede fusionarse;
- la evidencia queda obsoleta por cambio de configuración.

## Rollback documental

Si la evidencia resulta incorrecta o incompleta:

1. revertir el commit que introduzca este registro;
2. devolver `ERM-CTRL-015` a `PARTIAL`;
3. mantener `ERM-GOV-001` abierto operativamente;
4. ejecutar una nueva verificación administrativa y una canaria controlada.

No existe impacto de datos, runtime ni producto.
