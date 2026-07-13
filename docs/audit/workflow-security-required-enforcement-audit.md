# Workflow Security Required Enforcement Audit

| Campo | Valor |
| --- | --- |
| Fecha | 2026-07-13 |
| Rama | `ci/workflow-security-required-enforcement` |
| Base | `main@d004bfb4035886535fe13a7f244ccb2dd60ec306` |
| Dictamen | Fase transitoria #1459 conforme al scope; QGA-4B pendiente de cierre definitivo |

## Alcance auditado

Incluido:

- workflow requerido `PR Governance / validate-pr-governance`;
- trust boundary `trusted` / `candidate`;
- activacion dual transitoria `pull_request` + `pull_request_target`;
- bootstrap compatibility para `pull_request`;
- permisos read-only;
- parser-backed enforcement obligatorio;
- contratos de PR Governance y workflow security;
- freeze SHA-256 temporal.

Excluido:

- branch protection, settings y rulesets;
- backend, frontend runtime, DB, migraciones, Supabase, auth y sesiones;
- dependencias y lockfiles;
- secrets y permisos write;
- QGA-N2.

## Hallazgos

### Evento requerido transitorio

`.github/workflows/pr-governance.yml` declara durante #1459:

```yaml
on:
  pull_request:
    branches:
      - main
  pull_request_target:
    branches:
      - main
  workflow_dispatch:
```

`pull_request` existe unicamente para obtener el required check durante la transicion. `pull_request_target` queda instalado en `main` al fusionar #1459.

Resultado: PASS.

### Permisos

El workflow mantiene permisos top-level exactos:

```yaml
permissions:
  contents: read
```

No se agregaron permisos write, secrets ni job-level permissions.

Resultado: PASS.

### Codigo confiable

El checkout `trusted` usa la version de base para PRs:

```yaml
ref: ${{ github.event.pull_request.base.sha || github.sha }}
path: trusted
```

Para `workflow_dispatch`, la misma expresion cae en `github.sha`.

Resultado: PASS.

### Candidate estatico

El checkout `candidate` usa merge ref para PRs:

```yaml
ref: ${{ github.event.pull_request.number && format('refs/pull/{0}/merge', github.event.pull_request.number) || github.sha }}
path: candidate
```

`pull_request` y `pull_request_target` inspeccionan `refs/pull/<number>/merge`; `workflow_dispatch` usa `github.sha`.

El candidate se usa como arbol estatico de inspeccion. No se instalan dependencias ahi y no se ejecutan scripts del candidate.

Resultado: PASS.

### Dependencias

`pnpm/action-setup` usa el SHA ya aprobado. La instalacion se limita a:

```powershell
pnpm --dir trusted install --frozen-lockfile --ignore-scripts
```

Resultado: PASS.

### Ejecucion

El step requerido corre con:

```yaml
working-directory: candidate
run: node ../trusted/scripts/governance/pr-governance-validator.mjs
```

El script importado pertenece a `trusted`; `ROOT` sigue siendo `candidate`, por lo que los workflows inspeccionados son los de la PR.

Resultado: PASS.

### Enforcement parser-backed

`pr-governance-validator.mjs` no importa estaticamente `workflow-security-validator.mjs`.

Para `pull_request_target` y `workflow_dispatch`, carga dinamicamente desde codigo confiable:

```js
await import("./workflow-security-validator.mjs")
```

Luego ejecuta `evaluateWorkflowSecurity({ rootDir: ROOT })`, aun cuando la PR no modifica `.github/workflows`.

Resultado: PASS.

### Bootstrap pull_request

El evento `pull_request` transitorio conserva las validaciones existentes de governance, pero marca `workflow security` como `N/A` con el detalle deterministico:

```text
Bootstrap pull_request compatibility path; parser-backed enforcement becomes mandatory after the pull_request_target workflow is merged.
```

En ese camino no se carga `workflow-security-validator.mjs` ni `js-yaml`. El cierre definitivo de QGA-4B requiere una segunda PR que elimine `pull_request` despues de que `pull_request_target` ya exista en `main`.

Resultado: PASS.

### Fallo cerrado

Los fallos de workflow security se agregan a `failures`; por lo tanto, el required check termina con exit code `1` si el candidate contiene acciones mutables, permisos write, imagenes inseguras o aliases YAML.

Resultado: PASS.

### Summary

El GitHub Step Summary conserva PR Governance y quality impact, y agrega:

```md
## Workflow security
```

Resultado: PASS.

### Freeze

El freeze SHA-256 se conserva. Solo se actualizo el digest revisado de `.github/workflows/pr-governance.yml`.

Resultado: PASS.

## Validaciones observadas

| Comando | Resultado |
| --- | --- |
| `node --check scripts/governance/pr-governance-validator.mjs` | PASS |
| `node --check scripts/governance/workflow-security-validator.mjs` | PASS |
| `node scripts/governance/workflow-security-validator.mjs` | PASS: 5 workflows, 15 acciones externas, 1 excepcion |
| `node scripts/governance/workflow-security-validator.mjs --json` | PASS |
| `pnpm exec tsx --test test/unit/infrastructure/pr-governance-single-scope-contract.test.ts test/unit/infrastructure/quality-gate-impact-contract.test.ts test/unit/infrastructure/workflow-security-policy-contract.test.ts test/unit/infrastructure/workflow-security-validator-contract.test.ts test/unit/infrastructure/pr-governance-quality-impact-integration.test.ts` | PASS: 98 tests, fail 0 |
| `pnpm typecheck` | PASS |
| `pnpm typecheck:test` | PASS |
| `pnpm test` | PASS: 3101 tests, fail 0 |
| `pnpm build` | PASS |
| `pnpm security:public-surface` | PASS; hallazgos existentes `server-only` |
| `pnpm --dir frontend lint` | PASS |
| `pnpm --dir frontend typecheck` | PASS |
| `pnpm --dir frontend build` | PASS |
| `git diff --check` | PASS |

## Riesgo residual

- `pull_request_target` debe permanecer sin secrets, sin permisos write y sin ejecucion candidate.
- Si GitHub no puede crear `refs/pull/<number>/merge`, el checkout candidate fallara antes de ejecutar governance.
- El camino bootstrap legacy existe solo durante esta transicion y depende de mantener `workflow security` como `N/A` exclusivamente en `pull_request`.
- QGA-N2 no fue iniciado por scope explicito.

## Dictamen

#1459 queda como fase transitoria segura: activa el required check con `pull_request`, instala `pull_request_target` en `main`, preserva la separacion `trusted`/`candidate` y mantiene QGA-N2 bloqueado. QGA-4B no queda cerrado hasta una segunda PR que elimine `pull_request`.
