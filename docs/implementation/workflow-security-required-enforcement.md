# Workflow Security Required Enforcement

| Campo | Valor |
| --- | --- |
| Fecha | 2026-07-13 |
| Rama | `ci/workflow-security-required-enforcement` |
| Base | `main@d004bfb4035886535fe13a7f244ccb2dd60ec306` |
| Estado | Fase transitoria #1459 implementada; QGA-4B pendiente de cierre definitivo |
| Owner | CI owner / Engineering governance |

## Estado base

- Worktree inicial limpio.
- Rama inicial: `ci/workflow-security-required-enforcement`.
- HEAD inicial: `d004bfb ci(governance): add parser-backed workflow security validator (#1458)`.
- `PR Governance / validate-pr-governance` existia con trigger `pull_request`, checkout unico y ejecucion directa de `scripts/governance/pr-governance-validator.mjs`.
- El parser-backed workflow security validator ya existia como CLI independiente y pasaba sobre los cinco workflows canonicos.
- El freeze SHA-256 de workflows estaba activo en `workflow-security-policy-contract.test.ts`.

## Scope incluido

- Convertir `.github/workflows/pr-governance.yml` en fase transitoria de activacion dual para #1459: `pull_request`, `pull_request_target` y `workflow_dispatch`.
- Mantener el workflow `PR Governance` y el job/check `validate-pr-governance`.
- Separar checkout confiable `trusted` desde base SHA/current SHA y checkout `candidate` desde `refs/pull/<number>/merge`/current SHA.
- Instalar dependencias solo en `trusted` con `pnpm --dir trusted install --frozen-lockfile --ignore-scripts`.
- Ejecutar desde `candidate` solo `node ../trusted/scripts/governance/pr-governance-validator.mjs`.
- Tratar `pull_request_target` como evento PR valido en `pr-governance-validator.mjs`.
- Cargar dinamicamente el workflow security validator solo en `pull_request_target` y `workflow_dispatch`.
- Integrar `evaluateWorkflowSecurity({ rootDir: ROOT })` dentro del check requerido para `pull_request_target` y `workflow_dispatch`.
- Conservar compatibilidad bootstrap para `pull_request` durante esta PR transitoria.
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

- `PR Governance` ahora usa activacion dual transitoria con `pull_request`, `pull_request_target` y `workflow_dispatch`.
- `pull_request` existe unicamente para obtener el required check durante la transicion #1459.
- El checkout `trusted` usa `${{ github.event.pull_request.base.sha || github.sha }}`.
- El checkout `candidate` usa `${{ github.event.pull_request.number && format('refs/pull/{0}/merge', github.event.pull_request.number) || github.sha }}`.
- `pull_request` y `pull_request_target` inspeccionan `refs/pull/<number>/merge`; `workflow_dispatch` inspecciona `github.sha`.
- Ambos checkouts usan `persist-credentials: false` y `fetch-depth: 0`.
- Se agrego `pnpm/action-setup@b906affcce14559ad1aafd4ab0e942779e9f58b1`.
- `actions/setup-node` cachea contra `trusted/pnpm-lock.yaml`.
- Dependencias se instalan solo en `trusted` con `--ignore-scripts`.
- El validador requerido corre desde `candidate` pero importa y ejecuta codigo confiable desde `trusted`.
- `pr-governance-validator.mjs` acepta `pull_request_target` para rango, metadata y scope.
- `pr-governance-validator.mjs` no importa estaticamente `workflow-security-validator.mjs`.
- `pull_request_target` y `workflow_dispatch` cargan el parser-backed validator mediante `import()` y fallan cerrado.
- El evento legacy `pull_request` conserva diff, secretos, Markdown, metadata, scope y quality impact, pero marca `workflow security` como `N/A` con detalle deterministico:
  - `Bootstrap pull_request compatibility path; parser-backed enforcement becomes mandatory after the pull_request_target workflow is merged.`
- El workflow security report se registra en el flujo general de fallos; si falla, el proceso termina con exit code `1`.
- El GitHub Step Summary incluye seccion `## Workflow security`.
- Los tests cubren:
  - trigger `pull_request_target`;
  - trigger transitorio `pull_request`;
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

#1459 queda como fase transitoria segura de activacion dual. No se declara QGA-4B como cerrado en esta PR.

Durante esta fase, `pull_request` activa el required check y mantiene `workflow security` en `N/A` sin cargar `js-yaml`. `pull_request_target` queda instalado en `main` cuando #1459 se fusione. El cierre definitivo de QGA-4B corresponde a una segunda PR que elimine `pull_request` y deje solo `pull_request_target`/`workflow_dispatch`.

El boundary confiable queda definido asi:

- codigo ejecutable: `trusted`, proveniente de la base confiable;
- arbol inspeccionado: `candidate`, proveniente del merge ref de PR;
- dependencia instalada: solo `trusted`;
- scripts/binarios candidate: no ejecutados.

## Riesgo residual

- El evento `pull_request_target` exige disciplina permanente: no agregar secrets, permisos write ni ejecucion candidate en este workflow.
- `refs/pull/<number>/merge` depende de que GitHub pueda materializar el merge ref de la PR.
- El freeze temporal sigue activo; cualquier cambio futuro de workflows debe actualizar digest solo tras revision explicita.
- El camino `pull_request` debe eliminarse en la segunda PR de cierre para completar QGA-4B.

## Estado final

- QGA-4B: fase transitoria #1459; cierre definitivo pendiente en segunda PR.
- QGA-N2: no iniciado.
- Backend/frontend/DB/auth/dependencias/branch protection: sin cambios.
- Stage, commit, push y PR: no ejecutados.
