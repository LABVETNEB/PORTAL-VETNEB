# QGA Governance App-Published Check Workflow (QGA-4B)

| Campo | Valor |
| --- | --- |
| Fecha | 2026-07-13 |
| Rama | `ci/workflow-security-required-enforcement-finalize` |
| Base | `main@d004bfb4035886535fe13a7f244ccb2dd60ec306` |
| Estado | Implementado y validado localmente |
| Owner | CI owner / Engineering governance |

## Estado base

- Worktree inicial limpio.
- HEAD inicial: `d004bfb ci(governance): add parser-backed workflow security validator (#1458)`.
- GitHub App dedicada `LABVETNEB-PORTAL-QGA-Governance` verificada en fase previa de identidad:
  - App ID `4291335`, Installation ID `146398242`.
  - Permisos exactos: `checks: write` y `metadata: read`, sin extras.
  - Instalada solo sobre `LABVETNEB/PORTAL-VETNEB` (`repository_selection = selected`, no suspendida).
  - Sin OAuth, sin Device Flow, sin webhook, sin Client Secret.
- Secret `QGA_GOVERNANCE_APP_PRIVATE_KEY` y variables `QGA_GOVERNANCE_APP_ID`, `QGA_GOVERNANCE_APP_INSTALLATION_ID`, `QGA_GOVERNANCE_APP_CLIENT_ID` presentes en el repositorio.

## Scope incluido

- Nuevo workflow confiable `.github/workflows/qga-governance.yml` sobre `pull_request_target` hacia `main`.
- Publicacion del check run `qga-workflow-security` sobre `pull_request.head.sha` mediante la GitHub App dedicada, no mediante `github-actions`.
- Allowlist de `actions/create-github-app-token` pinneada por SHA en `workflow-security-policy.mjs`.
- Bump de `POLICY_VERSION` a `QGA-4.2`.
- Actualizacion coordinada de los tests contractuales de politica y validador (sexto workflow canonico, digest congelado, referencias pinneadas, allowlist).

## Scope excluido

- Branch protection y required checks (fase posterior con canarios).
- QGA-N2.
- Backend, frontend, DB, migraciones, auth, dependencias de runtime y lockfiles (el lockfile no cambia; `actions/create-github-app-token` es una action de CI, no una dependencia npm).
- Worktree protegido `C:\PORTAL-VETNEB-e2e-extended-fixes` y rama `test/e2e-extended-contract-fixes`.
- Merge del PR.

## Auditoria previa

- Se confirmo que el validador parser-backed acepta `rootDir` implicito via `process.cwd()`, lo que permite ejecutar el validador confiable de `main` sobre los archivos del head candidato sin ejecutar codigo del candidato.
- Se confirmo en documentacion oficial de GitHub que:
  - `pull_request_target` ejecuta la definicion del workflow de la rama base y corre en el contexto del repositorio base con acceso a secrets; la guia oficial advierte contra construir o ejecutar codigo del PR, cosa que este workflow no hace.
  - `POST /repos/{owner}/{repo}/check-runs` es exclusivo de GitHub Apps y requiere `checks: write`; `name` y `head_sha` son obligatorios y `output.title`/`output.summary` acompañan la conclusion.
  - `actions/create-github-app-token` es la via oficialmente documentada para autenticar como App en Actions; en v3 el input oficial es `client-id` (con `app-id` deprecado) y el token se revoca automaticamente al finalizar el job.
- Se resolvio `actions/create-github-app-token@v3.2.0` al commit `bcd2ba49218906704ab6c1aa796996da409d3eb1` consultando la API oficial del repositorio de la action.

## Cambios

- `.github/workflows/qga-governance.yml`:
  - Trigger `pull_request_target` restringido a base `main`; permisos top-level exactos `contents: read`; concurrencia por PR; timeout 10 minutos.
  - Checkout del base confiable y checkout del head candidato como datos inertes en `qga-candidate-head` con `persist-credentials: false`; ningun paso ejecuta codigo del candidato.
  - El validador `scripts/governance/workflow-security-validator.mjs` de `main` se ejecuta con working directory en el checkout candidato, de modo que analiza los workflows candidatos con la politica confiable.
  - `actions/create-github-app-token` emite el installation token de la App con `client-id` desde `vars.QGA_GOVERNANCE_APP_CLIENT_ID` y `private-key` desde `secrets.QGA_GOVERNANCE_APP_PRIVATE_KEY`.
  - `gh api` publica el check run `qga-workflow-security` sobre `CANDIDATE_HEAD_SHA` con conclusion `success` o `failure` y el reporte del validador como summary.
  - Un paso final propaga la conclusion al job para mantener visibilidad fail-closed tambien en el job de Actions.
- `scripts/governance/workflow-security-policy.mjs`: nueva entrada allowlisted `actions/create-github-app-token` y `POLICY_VERSION = "QGA-4.2"`.
- `test/unit/infrastructure/workflow-security-policy-contract.test.ts`: sexto workflow canonico, digest SHA-256 congelado del nuevo workflow, referencias pinneadas esperadas, referencia mutable prohibida `@v3`, allowlist y version de politica actualizadas.
- `test/unit/infrastructure/workflow-security-validator-contract.test.ts`: lista de seis workflows reales, version de politica y allowlist de repositorios de actions actualizadas.

## Propiedad de no-falsificabilidad

- La definicion del workflow y el validador provienen siempre de `main` (`pull_request_target`); el codigo candidato no puede modificarlos para la corrida que lo evalua.
- El check es emitido por la App dedicada via API de Checks, que es exclusiva de GitHub Apps; un workflow candidato no puede suplantar la identidad de la App porque no tiene acceso a su private key mas alla del uso interno del workflow confiable.
- Si el minting del token o la publicacion fallan, no se publica check: la ausencia de check es bloqueante una vez que el check sea required (fail-closed por ausencia).

## Archivos modificados

- `.github/workflows/qga-governance.yml` (nuevo)
- `scripts/governance/workflow-security-policy.mjs`
- `test/unit/infrastructure/workflow-security-policy-contract.test.ts`
- `test/unit/infrastructure/workflow-security-validator-contract.test.ts`
- `docs/implementation/qga-governance-app-check-workflow.md` (nuevo)
- `docs/audit/qga-governance-app-check-workflow-audit.md` (nuevo)

## Validaciones

Ver tabla de validaciones en el documento de auditoria asociado.

## Resultado

El workflow QGA Governance queda implementado y pasa la politica de seguridad de workflows con seis workflows canonicos, dieciocho referencias externas pinneadas y la excepcion exacta `postgres:16` preexistente. El check `qga-workflow-security` se activara para PRs cuando el workflow llegue a `main`.

## Riesgo residual

- El check no sera emitido para PRs hasta que este workflow exista en `main`; esta es la semantica esperada de `pull_request_target`.
- La conversion del check en required y la fase de canarios quedan pendientes por decision explicita de governance.
- `actions/create-github-app-token` queda cubierta por Dependabot (`package-ecosystem: github-actions`); las actualizaciones futuras deberan repinnear SHA y digest congelado.

## Estado final

No se modifico branch protection, required checks, backend, frontend, DB, dependencias npm ni lockfiles. El worktree protegido y la rama e2e permanecen intactos.
