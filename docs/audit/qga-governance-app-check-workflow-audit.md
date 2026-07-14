# Auditoria: QGA Governance App-Published Check Workflow (QGA-4B)

| Campo | Valor |
| --- | --- |
| Fecha | 2026-07-13 |
| Rama | `ci/workflow-security-required-enforcement-finalize` |
| Base | `main@d004bfb4035886535fe13a7f244ccb2dd60ec306` |
| Alcance | Workflow confiable + politica QGA-4.2 + tests contractuales |

## Verificaciones de identidad previas (fase QGA-4B identidad)

| Verificacion | Metodo | Resultado |
| --- | --- | --- |
| App autenticada | JWT RS256 (`iss` = Client ID) contra `GET /app` | Paso; App ID `4291335`, slug `labvetneb-portal-qga-governance` |
| Permisos exactos | `GET /app` permissions | `checks: write`, `metadata: read`, sin extras |
| Instalacion | `GET /repos/LABVETNEB/PORTAL-VETNEB/installation` | Installation ID `146398242`, `selected`, no suspendida |
| Alcance del token | `GET /installation/repositories` con token temporal | Exactamente 1 repositorio: `LABVETNEB/PORTAL-VETNEB` |
| Revocacion | `DELETE /installation/token` | 204, token revocado |
| Secret | `gh secret list` | `QGA_GOVERNANCE_APP_PRIVATE_KEY` presente |
| Variables | `gh variable list` | `QGA_GOVERNANCE_APP_ID`, `QGA_GOVERNANCE_APP_INSTALLATION_ID`, `QGA_GOVERNANCE_APP_CLIENT_ID` presentes |

## Fuentes oficiales verificadas

| Tema | Fuente | Conclusion aplicada |
| --- | --- | --- |
| `pull_request_target` | GitHub Docs, events that trigger workflows | Definicion del workflow tomada de la rama base; contexto del repositorio base; advertencia de no ejecutar codigo del PR respetada |
| Autenticacion App en Actions | GitHub Docs, making authenticated API requests with a GitHub App in a GitHub Actions workflow | `actions/create-github-app-token` con `client-id` en variable y `private-key` en secret |
| Inputs de la action | `action.yml` de `actions/create-github-app-token@v3.2.0` | `client-id` oficial, `app-id` deprecado, revocacion automatica del token al finalizar el job |
| Check runs | GitHub Docs, REST checks/runs | `POST /repos/{owner}/{repo}/check-runs` exclusivo de GitHub Apps; `name` y `head_sha` obligatorios |
| Pin de la action | API oficial del repo `actions/create-github-app-token` | `v3.2.0 = bcd2ba49218906704ab6c1aa796996da409d3eb1` |

## Controles de seguridad del workflow

| Control | Estado |
| --- | --- |
| Permisos top-level exactos `contents: read` | Cumplido |
| Sin permisos a nivel job | Cumplido |
| Todas las actions allowlisted y pinneadas por SHA de 40 caracteres | Cumplido |
| Checkout del candidato con `persist-credentials: false` | Cumplido |
| Codigo candidato nunca ejecutado (solo parseado por el validador confiable) | Cumplido |
| Secrets solo en el paso de minting y publicacion, nunca expuestos al candidato | Cumplido |
| Check emitido por la App dedicada sobre `pull_request.head.sha` | Cumplido |
| Fail-closed: sin token o sin publicacion no hay check | Cumplido |

## Validaciones ejecutadas

| Comando | Resultado |
| --- | --- |
| `node --check scripts/governance/workflow-security-policy.mjs` | Paso |
| `node scripts/governance/workflow-security-validator.mjs` | Paso: 6 workflows, 18 acciones externas pinneadas, 1 excepcion |
| `pnpm exec tsx --test test/unit/infrastructure/workflow-security-policy-contract.test.ts test/unit/infrastructure/workflow-security-validator-contract.test.ts` | Paso |
| `pnpm typecheck` | Paso |
| `pnpm typecheck:test` | Paso |
| `pnpm test` | Paso |
| `git diff --check` | Paso |

## Riesgo residual

- El required check y los canarios quedan explicitamente fuera de este cambio.
- El digest congelado del nuevo workflow debera actualizarse solo tras revision explicita de workflow-security, igual que los cinco preexistentes.

## Estado final

Working tree limpio tras commit; rama `ci/workflow-security-required-enforcement-finalize`; sin cambios en branch protection, backend, frontend, DB, dependencias npm ni lockfiles.
