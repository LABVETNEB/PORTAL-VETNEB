# E2E-ORG-3 clinic domain organization

Fecha: 2026-07-15

## Estado base

- Rama: `test/e2e-organize-clinic-domain`.
- HEAD inicial: `26f092215954f809dd4bbc97da6f676f3901357e`.
- `origin/main`: `26f092215954f809dd4bbc97da6f676f3901357e`.
- Worktree inicial: limpio.
- Worktree unico: `C:/PORTAL-VETNEB`.

## Scope incluido

- Movimiento mecanico de 21 specs Playwright del dominio clinic desde `frontend/e2e/` hacia `frontend/e2e/clinic/**`.
- Actualizacion de `frontend/e2e/suites/catalog.ts` para apuntar a los nuevos paths.
- Actualizacion de `test/helpers/dashboard-scope-guard.ts` para cubrir `frontend/e2e/clinic`.
- Verificacion de referencias operativas no documentales a paths legacy.
- Preservacion del contenido funcional de los specs movidos.

## Scope excluido

- Backend, API, auth, DB, migraciones, dependencias, lockfiles y CI/workflows.
- `frontend/src/**`, fixtures, helpers E2E, snapshots y codigo de producto.
- Governance y `scripts/governance/**`; sus `representativePaths` quedan fuera por scope explicito.
- Renombres de specs, cambios de assertions, waits, retries, skips o timeouts.
- Correccion del P1 conocido de Informes.

## Auditoria previa

- Se leyeron `docs/audit/e2e-enterprise-organization-audit.md`, `docs/implementation/test-suite-enterprise-organization-convention.md`, `frontend/e2e/suites/catalog.ts`, `frontend/package.json`, `test/helpers/dashboard-scope-guard.ts` y `test/architecture/e2e-suite-catalog-completeness.test.ts`.
- Se reviso el lote anterior con `git show --stat --summary 26f0922` y `git show 26f0922 -- frontend/e2e/suites/catalog.ts frontend/package.json test/helpers/dashboard-scope-guard.ts`.
- El guard de catalogo paso antes del move: 5/5.
- Los 21 origenes existian y los 21 destinos no existian antes de mover.
- `frontend/package.json` ya delegaba cohortes al runner; no tenia listas literales de specs que actualizar.

## Cambios

- `frontend/e2e/clinic/reports/`: 5 specs de informes.
- `frontend/e2e/clinic/logistics/`: 5 specs de logistica.
- `frontend/e2e/clinic/tokens/`: 1 spec de tokens.
- `frontend/e2e/clinic/profile/`: 1 spec de perfil.
- `frontend/e2e/clinic/shell/`: 9 specs de shell clinico.
- `frontend/e2e/suites/catalog.ts`: 21 paths actualizados, metadata y cohortes preservadas.
- `test/helpers/dashboard-scope-guard.ts`: agregado `frontend/e2e/clinic`; se preservo `frontend/e2e/dashboard`.

## Archivos modificados

- `frontend/e2e/suites/catalog.ts`
- `test/helpers/dashboard-scope-guard.ts`
- 21 specs movidos bajo `frontend/e2e/clinic/**`
- `docs/audit/e2e-org-3-clinic-domain-organization-audit.md`
- `docs/implementation/e2e-org-3-clinic-domain-organization.md`

## Validaciones

- `git diff --check`: passed.
- `node --experimental-strip-types --experimental-specifier-resolution=node --test test/architecture/e2e-suite-catalog-completeness.test.ts`: 5 passed.
- `pnpm typecheck:test`: primer intento timeout a 120s; reintento passed.
- `pnpm exec tsx --test test/architecture/e2e-suite-catalog-completeness.test.ts`: 5 passed.
- `pnpm test`: 3107 passed.
- `pnpm --dir frontend lint`: passed.
- `pnpm --dir frontend typecheck`: passed.
- `pnpm --dir frontend build`: passed.
- `pnpm --dir frontend e2e:public-clinic`: 116 passed.
- `pnpm --dir frontend e2e:smoke`: 41 passed.
- `pnpm --dir frontend e2e:visual-contract`: 273 passed.
- `pnpm --dir frontend e2e:ci`: 562 passed.
- `pnpm --dir frontend e2e:verify-teardown`: passed, puertos 3000 y 3107 libres.
- `pnpm build`: passed.
- `pnpm security:public-surface`: passed; solo findings server-only existentes en `frontend/src/proxy.ts`.

## Evidencia de preservacion

- `clinic-reports-workspace-1000.spec.ts` SHA-256 antes y despues: `0a4e78cb4f1782cb6bf0a1949295daecf68108f08129fcda00b3c11055803893`.
- `clinic-reports-workspace-1000.spec.ts`: 6 llamadas reales a `test.fail` antes y despues.
- `git diff --cached --find-renames=90%` muestra rename 100% del spec critico y sin hunks de contenido.
- No se detectaron imports relativos en los 21 specs movidos; no hubo cambios de imports.

## Resultado

PASS. Los 21 specs clinic quedaron bajo `frontend/e2e/clinic/**`, el catalogo y el scope guard quedaron alineados, y las validaciones obligatorias pasaron.

## Riesgo residual

Bajo. Quedan patrones legacy en `scripts/governance/quality-gate-impact-policy.mjs` y en el bloque generado de `test/README.md`; no se tocaron porque governance esta excluido explicitamente del scope de E2E-ORG-3.

## Estado final

Cambios locales pendientes de revision humana. No se ejecuto `git add`, `git commit`, `git push` ni comandos remotos.
