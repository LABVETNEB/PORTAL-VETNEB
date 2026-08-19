# PR Governance — evento `edited` en el ciclo de vida del trigger

## Objetivo

Que corregir el body de una PR (metadata, no código) dispare un nuevo run de
`PR Governance` que lea el body corregido, sin abrir una ruta de bypass ni
debilitar el validador.

## Incidente

[PR #1662](https://github.com/LABVETNEB/PORTAL-VETNEB/pull/1662)
(`feat/dashboard-b05-surface-inversion`, head
`0e820061f54f8d2fa9c5b78ec75449c1e31e00b2`) nació con un body libre corto
(`gh pr create --body "<texto libre>"`). El primer run de `PR Governance`
(run `32213706227`, job `95951173865`, `run_attempt=1`, creado
`2026-08-19T03:52:47Z`) falló con:

```
Missing required section(s): Summary, Scope, Validation, Rollback.
Select at least one recognized scope checkbox in the Scope section.
Exactly one scope checkbox must be selected when no mixed-scope exception is declared.
```

El body remoto se corrigió (`updatedAt` `2026-08-19T03:57:30Z`) para incluir
las 6 secciones de `.github/PULL_REQUEST_TEMPLATE.md` con `[x] frontend
runtime` como único scope. Se ejecutó **Re-run failed jobs** sobre el mismo
run (`run_attempt=2`, job `95952168516`, creado `2026-08-19T03:58:54Z`,
**después** de la edición) y el job **volvió a fallar con el mismo mensaje,
byte a byte**.

## Causa raíz

`scripts/governance/pr-governance-validator.mjs` lee el body así:

```js
const EVENT_PATH = process.env.GITHUB_EVENT_PATH ?? "";
...
function readEvent() {
  return EVENT_PATH ? JSON.parse(readFileSync(EVENT_PATH, "utf8")) : {};
}
...
const body = event.pull_request?.body ?? "";
```

`GITHUB_EVENT_PATH` apunta a un JSON que GitHub Actions escribe **una sola
vez, cuando el run se crea** — el snapshot del webhook que disparó ese run.
**Re-run failed jobs** reejecuta el mismo `run_id` reusando ese mismo
snapshot; no vuelve a consultar la API de GitHub ni regenera el evento. Por
construcción, ningún re-run de un run `pull_request` puede ver un body
editado después de que el run se creó.

Evidencia que lo demuestra, no solo el código:

| | Attempt 1 | Attempt 2 (rerun) |
|---|---|---|
| `run_attempt` | 1 | 2 |
| `created_at` | `03:52:47Z` | `03:58:54Z` |
| Mensaje de error | idéntico | idéntico, byte a byte |

El body remoto cambió a las `03:57:30Z` — **entre** ambos attempts — y aun
así el segundo attempt vio el body viejo. Esto sólo es posible si ambos
attempts comparten el mismo `event.json`.

La segunda causa, ya en `.github/workflows/pr-governance.yml`:

```yaml
on:
  pull_request:
    branches:
      - main
  workflow_dispatch:
```

Sin `types:`, GitHub aplica el default para `pull_request`: `opened`,
`synchronize`, `reopened`. **`edited` no estaba incluido.** Aunque el
snapshot del evento SÍ se regenera en cada evento `pull_request` nuevo
(a diferencia de un rerun), editar el body de una PR nunca generaba ese
evento nuevo porque el workflow no escuchaba `edited`.

## Diagnóstico (§6 de la auditoría)

| | Pregunta | Respuesta | Evidencia |
|---|---|---|---|
| D1 | ¿El rerun ve el payload original? | **SÍ** | `run_attempt` 1 vs 2, mismo mensaje de error byte a byte pese al body editado entre ambos |
| D2 | ¿El body remoto actual satisface el validador? | **SÍ** | `gh pr view 1662` — 6 secciones completas, 1 checkbox de scope marcado |
| D3 | ¿El workflow corre automáticamente ante `pull_request.edited`? | **NO** (antes del fix) | `on.pull_request` sin `types:` → default `opened`/`synchronize`/`reopened` |
| D4 | ¿Rerun puede corregir un fallo cuyo único cambio fue metadata? | **NO** | Mismo `GITHUB_EVENT_PATH`, mismo body leído |
| D5 | ¿Hace falta cambiar B05? | **NO** | B05 no toca CI/governance; incidente puramente de trigger metadata |

## Cambio implementado

`.github/workflows/pr-governance.yml` — único cambio semántico, metadata del
trigger:

```diff
 on:
   pull_request:
     branches:
       - main
+    types:
+      - opened
+      - synchronize
+      - reopened
+      - edited
   workflow_dispatch:
```

Nada más se tocó: mismo job (`validate-pr-governance`), mismos permisos
(`contents: read`), mismos pins de acciones, mismo comando del validador,
misma `concurrency`. Verificado con `git diff` línea por línea antes de
tocar el digest congelado.

## Seguridad

- **Sin ampliación de superficie de confianza.** El workflow sigue en
  `pull_request` (código y contexto del fork/head branch), nunca
  `pull_request_target` (que correría con secretos/permisos de `main` sobre
  contenido de un head branch no confiable). Verificado: `node
  scripts/governance/workflow-security-validator.mjs` → PASS antes y después.
- **Permisos sin cambios**: `contents: read`, sin escritura.
- **`workflow_dispatch` no es un bypass**: sigue dependiendo del mismo job y
  el mismo paso `node scripts/governance/pr-governance-validator.mjs`, sin
  condicional que salte la validación según el evento.
- **`edited` no relaja ninguna regla del validador.** Un body inválido sigue
  fallando; sólo cambia CUÁNDO se re-evalúa.

## Validación

| Comando | Estado |
|---|---|
| `node scripts/governance/workflow-security-validator.mjs` | PASSED |
| `node --test test/unit/infrastructure/workflow-security-policy-contract.test.ts` | PASSED (8/8) |
| `node --test test/unit/infrastructure/pr-governance-trigger-contract.test.ts` | PASSED (6/6, nuevo — incluye 3 mutaciones fail-closed) |
| `node --test test/unit/infrastructure/pr-governance-*.test.ts` | PASSED |
| `pnpm typecheck:test` | ver informe final |

Digest congelado en `test/unit/infrastructure/workflow-security-policy-contract.test.ts`:

```
ANTERIOR = 4e0bf177a8581c9dd655f1ca6aa1510a823cdd976c885c4ba50b41129e4157d7
NUEVO    = 8dc2bf50342db4e45c7bcb5eadbeeeae28b87ac7b766260b903253ca6ba13947
```

Realineado sólo después de confirmar que el único byte semántico distinto es
el bloque `types:` (diff revisado arriba) y que
`workflow-security-validator.mjs` sigue en PASS.

## Desbloqueo de PR #1662

**El fix permanente debe fusionarse a `main` para que futuras ediciones del
body disparen automáticamente un nuevo `pull_request.edited`.** La activación
del workflow depende de la definición aplicable al evento, pero el paso
`actions/checkout` trabaja sobre el merge ref de la PR; por tanto, el código
relativo ejecutado después del checkout —incluido
`scripts/governance/pr-governance-validator.mjs`— puede provenir del contenido
candidato de la propia PR. El trigger y el código ejecutado después del
checkout son fronteras distintas y no deben presentarse como una única barrera
de confianza.

Para la PR #1662 actual, `pull_request.reopened` ya pertenece al set default
del workflow anterior, por lo que cerrar/reabrir puede generar el evento nuevo
sin depender técnicamente de este fix. Operativamente se cierra primero #1663
para dejar resuelta la causa sistémica antes de reactivar #1662.

## Exclusiones

- No se tocó `scripts/governance/pr-governance-validator.mjs` (semántica del
  validador intacta).
- No se tocó `.github/PULL_REQUEST_TEMPLATE.md` (ya exigía correctamente las
  4 secciones).
- No se tocó B05 ni ningún archivo de `feat/dashboard-b05-surface-inversion`.
- No se ejecutó ningún GitHub write (`gh pr edit/close/reopen`, `gh run
  rerun`, `gh workflow run`).
- No se modificó branch protection ni required checks.

## Riesgo residual

- El mismo patrón de causa raíz (rerun ≠ evento nuevo) aplica a **cualquier**
  workflow `pull_request` sin `edited` en sus `types` cuya validación dependa
  del body/metadata de la PR. Sólo `pr-governance.yml` lee el body; los
  demás workflows canónicos (`backend-ci`, `frontend-ci`, `e2e-completeness`,
  `qga-governance`, `visual-regression-manual`,
  `app-version-force-update`) validan código/impacto, no metadata de PR, así
  que no comparten este riesgo — no se tocaron.
- Regla operativa para prevenir la causa de origen (`gh pr create --body`
  libre) documentada en el informe de esta tarea; su persistencia en
  `AGENTS.md` requiere un PR separado si Nico lo autoriza.