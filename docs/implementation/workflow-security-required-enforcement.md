# Workflow Security Required Enforcement

| Campo | Valor |
| --- | --- |
| Fecha | 2026-07-13 |
| Rama | `ci/workflow-security-required-enforcement` |
| Base | `main@d004bfb4035886535fe13a7f244ccb2dd60ec306` |
| Estado | Implementado y validado localmente con fail 0 |
| Owner | CI owner / Engineering governance |

## Estado base

- Worktree inicial limpio.
- Rama inicial: `ci/workflow-security-required-enforcement`.
- HEAD inicial: `d004bfb ci(governance): add parser-backed workflow security validator (#1458)`.
- `PR Governance / validate-pr-governance` existia con trigger `pull_request`, checkout unico y ejecucion directa de `scripts/governance/pr-governance-validator.mjs`.
- El parser-backed workflow security validator ya existia como CLI independiente y pasaba sobre los cinco workflows canonicos.
- El freeze SHA-256 de workflows estaba activo en `workflow-security-policy-contract.test.ts`.

## Scope incluido

- Convertir `.github/workflows/pr-governance.yml` a `pull_request_target` conservando `workflow_dispatch`.
- Mantener el workflow `PR Governance` y el job/check `validate-pr-governance`.
- Separar checkout confiable `trusted` desde base SHA/current SHA y checkout `candidate` desde `refs/pull/<number>/merge`/current SHA.
- Instalar dependencias solo en `trusted` con `pnpm --dir trusted install --frozen-lockfile --ignore-scripts`.
- Ejecutar desde `candidate` solo `node ../trusted/scripts/governance/pr-governance-validator.mjs`.
- Tratar `pull_request_target` como evento PR valido en `pr-governance-validator.mjs`.
- Cargar dinamicamente el workflow security validator solo en `pull_request_target` y `workflow_dispatch`.
- Integrar `evaluateWorkflowSecurity({ rootDir: ROOT })` dentro del check requerido para la operacion normal post-merge.
- Conservar compatibilidad bootstrap para el unico camino legacy `pull_request` que evalua esta PR antes del merge.
- Agregar `workflow security` a `results`, `details`, `failures` y GitHub Step Summary.
- Validar siempre todos los workflows del candidate aunque la PR no toque `.github/workflows`.
- Actualizar contratos de seguridad y PR Governance.
- Mantener el freeze temporal y actualizar solo el digest revisado de `.github/workflows/pr-governance.yml`.

## Scope excluido

- Backend, frontend runtime, DB, Drizzle, migraciones, Supabase, auth, cookies, CSRF, CSP y rate limits.
- Branch protection, settings, rulesets y required-check configuration.
- Dependencias, `package.json`, `pnpm-lock.yaml` y lockfiles.
- Secrets, permisos write y cualquier ejecucion de scripts/binarios procedentes de candidate.
- Eliminacion del freeze temporal.
- Inicio de QGA-N2.
- Stage, commit, push o PR.

## Auditoria previa

- Base local limpia: `git status --short --untracked-files=all` sin salida.
- Rama local: `ci/workflow-security-required-enforcement`.
- HEAD local: `d004bfb`.
- Archivos reales identificados:
  - `.github/workflows/pr-governance.yml`
  - `scripts/governance/pr-governance-validator.mjs`
  - `scripts/governance/workflow-security-validator.mjs`
  - `test/unit/infrastructure/workflow-security-policy-contract.test.ts`
  - `test/unit/infrastructure/pr-governance-quality-impact-integration.test.ts`
- Tests nativos confirmados en `package.json` y `frontend/package.json`.
- Referencias legacy revisadas: docs de governance, parser-backed validator, QGA y branch protection.

## Cambios

- `PR Governance` ahora usa `pull_request_target` con `permissions: contents: read`.
- El checkout `trusted` usa `${{ github.event.pull_request.base.sha || github.sha }}`.
- El checkout `candidate` usa `${{ github.event_name == 'pull_request_target' && format('refs/pull/{0}/merge', github.event.pull_request.number) || github.sha }}`.
- Ambos checkouts usan `persist-credentials: false` y `fetch-depth: 0`.
- Se agrego `pnpm/action-setup@b906affcce14559ad1aafd4ab0e942779e9f58b1`.
- `actions/setup-node` cachea contra `trusted/pnpm-lock.yaml`.
- Dependencias se instalan solo en `trusted` con `--ignore-scripts`.
- El validador requerido corre desde `candidate` pero importa y ejecuta codigo confiable desde `trusted`.
- `pr-governance-validator.mjs` acepta `pull_request_target` para rango, metadata y scope.
- `pr-governance-validator.mjs` no importa estaticamente `workflow-security-validator.mjs`.
- `pull_request_target` y `workflow_dispatch` cargan el parser-backed validator mediante `import()`.
- El evento legacy `pull_request` conserva diff, secretos, Markdown, metadata, scope y quality impact, pero marca `workflow security` como `N/A` con detalle deterministico:
  - `Bootstrap pull_request compatibility path; parser-backed enforcement becomes mandatory after the pull_request_target workflow is merged.`
- El workflow security report se registra en el flujo general de fallos; si falla, el proceso termina con exit code `1`.
- El GitHub Step Summary incluye seccion `## Workflow security`.
- Los tests cubren:
  - trigger `pull_request_target`;
  - ausencia de trigger `pull_request` directo;
  - permisos `contents: read`;
  - checkouts `trusted` / `candidate`;
  - base SHA confiable y merge ref candidate;
  - install solo en `trusted`;
  - comando `../trusted/scripts/governance`;
  - no ejecucion propia del candidate;
  - `pull_request_target` como evento PR valido;
  - `workflow_dispatch`;
  - fallos por tag mutable, permisos write, imagen insegura y alias YAML.

## Archivos modificados

- `.github/workflows/pr-governance.yml`
- `scripts/governance/pr-governance-validator.mjs`
- `scripts/governance/pr-governance-validator.d.mts`
- `test/unit/infrastructure/workflow-security-policy-contract.test.ts`
- `test/unit/infrastructure/pr-governance-quality-impact-integration.test.ts`
- `docs/implementation/workflow-security-required-enforcement.md`
- `docs/audit/workflow-security-required-enforcement-audit.md`

## Validaciones

| Comando | Resultado |
| --- | --- |
| `node --check scripts/governance/pr-governance-validator.mjs` | Paso |
| `node --check scripts/governance/workflow-security-validator.mjs` | Paso |
| `node scripts/governance/workflow-security-validator.mjs` | Paso: 5 workflows, 15 acciones externas, 1 excepcion |
| `node scripts/governance/workflow-security-validator.mjs --json` | Paso |
| `pnpm exec tsx --test test/unit/infrastructure/pr-governance-single-scope-contract.test.ts test/unit/infrastructure/quality-gate-impact-contract.test.ts test/unit/infrastructure/workflow-security-policy-contract.test.ts test/unit/infrastructure/workflow-security-validator-contract.test.ts test/unit/infrastructure/pr-governance-quality-impact-integration.test.ts` | Paso: 98 tests, fail 0 |
| `pnpm typecheck` | Paso |
| `pnpm typecheck:test` | Paso |
| `pnpm test` | Paso: 3101 tests, fail 0 |
| `pnpm build` | Paso |
| `pnpm security:public-surface` | Paso; hallazgos existentes clasificados como `server-only` |
| `pnpm --dir frontend lint` | Paso |
| `pnpm --dir frontend typecheck` | Paso |
| `pnpm --dir frontend build` | Paso |
| `git diff --check` | Paso |

## Resultado

QGA-4B queda completado: el validador parser-backed pasa de control disponible a enforcement obligatorio dentro del check requerido `PR Governance / validate-pr-governance`.

La PR conserva un bootstrap de una sola transicion: mientras `main` todavia ejecute el workflow legacy `pull_request`, `workflow security` queda `N/A` y no intenta cargar `js-yaml`. Despues del merge, el workflow nuevo ya no escucha `pull_request`, por lo que ese camino queda inalcanzable en operacion normal.

El boundary confiable queda definido asi:

- codigo ejecutable: `trusted`, proveniente de la base confiable;
- arbol inspeccionado: `candidate`, proveniente del merge ref de PR;
- dependencia instalada: solo `trusted`;
- scripts/binarios candidate: no ejecutados.

## Riesgo residual

- El evento `pull_request_target` exige disciplina permanente: no agregar secrets, permisos write ni ejecucion candidate en este workflow.
- `refs/pull/<number>/merge` depende de que GitHub pueda materializar el merge ref de la PR.
- El freeze temporal sigue activo; cualquier cambio futuro de workflows debe actualizar digest solo tras revision explicita.
- El camino bootstrap legacy existe solo para que esta PR pueda ser evaluada por el workflow `pull_request` aun no migrado en `main`.

## Estado final

- QGA-4B: completado.
- QGA-N2: no iniciado.
- Backend/frontend/DB/auth/dependencias/branch protection: sin cambios.
- Stage, commit, push y PR: no ejecutados.
