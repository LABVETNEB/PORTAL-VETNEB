# Workflow Security Parser Validator

| Campo | Valor |
| --- | --- |
| Fecha | 2026-07-13 |
| Rama | `ci/workflow-security-parser-validator` |
| Base | `main@3da0184e92a4c2027c5daaa2f1ce90998e9c1017` |
| Estado | Implementado y validado localmente con suite completa verde |
| Owner | CI owner / Engineering governance |

## Estado base

- Worktree inicial limpio.
- Rama inicial: `ci/workflow-security-parser-validator`.
- HEAD inicial: `3da0184 ci(governance): bootstrap workflow security policy (#1457)`.
- Workflows reales detectados: cinco archivos bajo `.github/workflows`.
- `js-yaml` existia solo como override; no era `devDependency` directa.

## Scope incluido

- Declarar `js-yaml` `4.2.0` exacto como `devDependency` directa mediante pnpm.
- Agregar validador parser-backed en `scripts/governance/workflow-security-validator.mjs`.
- Agregar contrato de tipos `workflow-security-validator.d.mts`.
- Clasificar los dos archivos del validador como `workflows/CI`.
- Agregar `workflow-security-validator.mjs` a `REQUIRED_SOURCE_PATHS`.
- Agregar test contractual positivo/negativo para acciones, permisos, YAML real, contenedores, servicios y CLI/reporting.
- Aislar guardrails historicos CLEAN7A del working tree actual mediante invariantes deterministicas post-merge.
- Mantener freeze SHA-256 de los cinco workflows.

## Scope excluido

- Integracion del validador en `pr-governance-validator.mjs`.
- QGA-4B.
- QGA-N2.
- Settings, rulesets, branch protection y workflows.
- Backend runtime, DB, Drizzle, migraciones, auth, cookies, CSRF, CSP y rate limits.
- Worktree protegido `C:\PORTAL-VETNEB-e2e-extended-fixes`.

## Auditoria previa

- Se confirmo que `workflow-security-policy.mjs` ya contenia allowlist de acciones, permisos top-level y excepcion exacta `postgres:16`.
- Se confirmo que no habia validador parser-backed existente.
- Se confirmo que el contrato de quality impact tenia que ampliarse para la nueva fuente requerida.
- Riesgo identificado: `js-yaml 4.2.0` no documenta `maxAliasCount`.
- Mitigacion aplicada: `maxDepth=100`, `maxMergeSeqLength=20`, y rechazo de todo alias YAML observado por el listener del parser.
- Riesgo identificado: guardrails visuales historicos CLEAN7A usaban `git diff HEAD` y fallaban en PRs futuras con cambios legitimos de manifests fuera de esa feature historica.
- Mitigacion aplicada: `assertClean7aDependencyCleanupInvariants()` comprueba solo invariantes actuales de `frontend/package.json` y la nota rectora CLEAN7A, sin calcular ni recibir `changedManifestFiles`.

## Cambios

- El validador lee recursivamente `.yml` y `.yaml` bajo `.github/workflows`.
- Parseo exclusivo mediante `js-yaml`.
- Rechazo de YAML invalido, documentos vacios, multiples documentos, raiz no mapping y estructuras incompatibles.
- Rechazo conservador de aliases YAML escalares, mappings, sequences y merges por ausencia de limite oficial suficiente de aliases.
- Recorrido semantico de `jobs.<job>.steps[].uses` y `jobs.<job>.uses`.
- Validacion de acciones externas allowlisted y pinneadas con SHA lowercase de 40 caracteres.
- Validacion de acciones locales normalizadas dentro de `.github/actions`.
- Validacion de permisos top-level exactos `contents: read` y bloqueo de permisos a nivel job.
- Validacion de imagenes de `container` y `services` por digest sha256 o excepcion exacta declarada.
- Reporte deterministico con `passed`, `failures`, `details`, `policyVersion`, `workflows`, `externalActions`, `localActions`, `permissions`, `containerImages` y `exceptionsUsed`.
- CLEAN7A conserva su politica pura: `assertClean7aDependencyCleanupScopeInput()` sigue rechazando `package.json`, `frontend/pnpm-lock.yaml`, lockfiles sin cambio real de dependencias y reintroduccion de dependencias removidas.
- Los cinco guardrails visuales historicos ahora usan invariantes CLEAN7A desacoplados del diff actual.
- CLI:
  - `node scripts/governance/workflow-security-validator.mjs`
  - `node scripts/governance/workflow-security-validator.mjs --json`

## Archivos modificados

- `package.json`
- `pnpm-lock.yaml`
- `scripts/governance/workflow-security-validator.mjs`
- `scripts/governance/workflow-security-validator.d.mts`
- `scripts/governance/pr-governance-validator.mjs`
- `scripts/governance/quality-gate-impact-policy.mjs`
- `test/helpers/clean7a-dependency-cleanup-scope.ts`
- `test/unit/infrastructure/workflow-security-policy-contract.test.ts`
- `test/unit/infrastructure/workflow-security-validator-contract.test.ts`
- `test/unit/infrastructure/clean.test.ts`
- `test/unit/ui/admin/frontend-dashboard-admin-command-center.test.ts`
- `test/unit/ui/dashboard/frontend-dashboard-interaction-foundation.test.ts`
- `test/unit/ui/dashboard/frontend-dashboard-logistics-hub.test.ts`
- `test/unit/ui/dashboard/frontend-dashboard-reports-master-detail.test.ts`
- `test/unit/ui/dashboard/frontend-dashboard-workspace-layout-polish.test.ts`
- `docs/implementation/workflow-security-parser-validator.md`
- `docs/audit/workflow-security-parser-validator-audit.md`

## Validaciones

| Comando | Resultado |
| --- | --- |
| `pnpm install --frozen-lockfile` | Paso; pnpm reporto warnings existentes de build scripts ignorados y peer deps frontend |
| `node --check scripts/governance/workflow-security-policy.mjs` | Paso |
| `node --check scripts/governance/workflow-security-validator.mjs` | Paso |
| `node scripts/governance/workflow-security-validator.mjs` | Paso |
| `node scripts/governance/workflow-security-validator.mjs --json` | Paso |
| `pnpm exec tsx --test test/unit/infrastructure/clean.test.ts test/unit/infrastructure/workflow-security-policy-contract.test.ts test/unit/infrastructure/workflow-security-validator-contract.test.ts test/unit/ui/admin/frontend-dashboard-admin-command-center.test.ts test/unit/ui/dashboard/frontend-dashboard-interaction-foundation.test.ts test/unit/ui/dashboard/frontend-dashboard-logistics-hub.test.ts test/unit/ui/dashboard/frontend-dashboard-reports-master-detail.test.ts test/unit/ui/dashboard/frontend-dashboard-workspace-layout-polish.test.ts` | Paso |
| `pnpm exec tsx --test test/unit/infrastructure/workflow-security-policy-contract.test.ts test/unit/infrastructure/workflow-security-validator-contract.test.ts` | Paso |
| `pnpm exec tsx --test test/unit/infrastructure/quality-gate-impact-contract.test.ts test/unit/infrastructure/pr-governance-single-scope-contract.test.ts` | Paso |
| `pnpm typecheck` | Paso |
| `pnpm typecheck:test` | Paso |
| `pnpm build` | Paso |
| `pnpm security:public-surface` | Paso; hallazgos existentes clasificados como `server-only` |
| `pnpm --dir frontend lint` | Paso |
| `pnpm --dir frontend typecheck` | Paso |
| `pnpm --dir frontend build` | Paso |
| `pnpm test` | Paso: 3092 tests, `fail 0` |
| `git diff --check` | Paso |

## Resultado

El validador parser-backed queda implementado y pasa contra los cinco workflows reales. El reporte registra 13 acciones externas pinneadas, cero acciones locales y una excepcion exacta usada para `postgres:16`.

`js-yaml@4.2.0` queda como dependencia directa exacta del validador. `package.json` continua prohibido dentro del contrato especifico CLEAN7A; el desacople solo evita que features historicas lean el diff de una PR no-CLEAN7A.

## Riesgo residual

- La deteccion de aliases depende del listener de `js-yaml`; ante aliases observados por el parser, la politica es bloqueo total.
- `maxDepth` y `maxMergeSeqLength` se conservan como defensa adicional, pero no sustituyen el bloqueo de aliases.

## Estado final

No se integro el validador al required PR Governance. No se modificaron workflows, branch protection, settings, backend, DB, auth ni migraciones.
