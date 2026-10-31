# Hotfix del advisory de minimatch GHSA-g3hv-75wg-m249 (octubre 2026)

## Estado base

- Fecha: 2026-10-31.
- Base: `origin/main` en `b38a013ff92cc16fc9624f9ebd9479141bb3afe5`. PR de
  dependencias independiente; no se mezcla con PR #1946 (V2 visual), cuyo head
  `27a36b4f` no modifica manifiestos ni lockfile.
- `validate-backend` falla en el gate `scripts/supply-chain/dependency-audit-gate.mjs`:
  `advisory GHSA-g3hv-75wg-m249 (minimatch) has no exception`. El gate lee
  `pnpm audit --json` en vivo, por lo que falla igual en `main`.
- `minimatch` resolvía a `10.2.6` (vía `eslint@10.13.0` → `@eslint/config-array`
  y `@typescript-eslint/typescript-estree`) y a `3.1.5` (vía `eslint-config-next`
  → `eslint-plugin-import`, `-jsx-a11y`, `-react`). Todas son dependencias dev.

## Scope incluido

- Override `"minimatch@<11.0.1": "11.0.3"` en `pnpm-workspace.yaml`.
- Regeneración controlada de `pnpm-lock.yaml` (`pnpm install --lockfile-only`).
- Realineación de `SECURITY_OVERRIDE_LINES` en
  `test/architecture/toolchain-contract.test.ts`.

## Scope excluido

- `package.json`, `frontend/package.json`, runtime frontend y backend.
- Excepciones del gate, ignores, cambios de severidad o de nivel de audit.
- Upgrades de `eslint`, `eslint-config-next` o sus plugins.
- Workflows, schema, migraciones, auth, deploy y merge.

## Auditoría previa

- `pnpm audit --prod`: 0 avisos. `pnpm audit`: 1 moderate.
- `GHSA-g3hv-75wg-m249` (CVE-2026-118764, moderate), publicado el 2026-10-30:
  amplificación de `globParts` en `firstPhasePreProcess()` con
  `optimizationLevel >= 2`. Vulnerable `<11.0.1`; primera versión parcheada
  `11.0.1`. No existe parche en las líneas 3.x ni 10.x.
- `minimatch@11.0.3` (2026-10-28) es la última; engines `18 || 20 || >=22`.

## Cambios

- `pnpm-workspace.yaml`: nuevo override tras `mysql2`.
- `pnpm-lock.yaml`: `minimatch` 3.1.5 y 10.2.6 → 11.0.3; se añade
  `@isaacs/nonrecursive-glob-match@1.0.3`; salen `brace-expansion@1.1.21`,
  `balanced-match@1.0.2` y `concat-map@0.0.1`.
- `test/architecture/toolchain-contract.test.ts`: sólo la línea nueva del
  override; el guard conserva su estructura.

## Archivos de implementación

- `pnpm-workspace.yaml`.
- `pnpm-lock.yaml`.
- `test/architecture/toolchain-contract.test.ts`.
- `docs/implementation/security-minimatch-ghsa-g3hv-75wg-m249-october-2026.md`.

## Validaciones

Ejecutadas sobre una copia de `origin/main` con el parche aplicado:

- `pnpm audit --prod` — `PASSED` (0 avisos).
- `pnpm audit` — `PASSED` (0 avisos).
- `node scripts/supply-chain/dependency-audit-gate.mjs` — `PASSED`.
- `toolchain-contract`, `supply-chain-advisory-gate`, `backend-ci-workflow` y
  `frontend-deploy-build-filter-boundary` — `PASSED` (62/62).
- `pnpm lint:backend` y `pnpm --dir frontend lint` — `PASSED`.
- `pnpm typecheck` y `pnpm --dir frontend typecheck` — `PASSED`.
- `build`, `pnpm test` completo y `db:migrate` — `NOT_RUN` (herramientas dev;
  los cubre CI).

## Riesgo residual

- `minimatch@11` no exporta función por defecto. Con opciones que invocan
  `minimatch`, las reglas `import/no-internal-modules`, `react/jsx-pascal-case`
  y `jsx-a11y/label-has-associated-control` lanzan error (verificado con un
  probe). El repo no las activa (`eslint-config-next` no las habilita y el lint
  pasa). Si se activan, antes hay que actualizar esos plugins.
- El override debe conservarse hasta que `eslint-config-next` y sus plugins
  dependan de `minimatch >=11.0.1` por sí mismos.

## Estado final

Listo para PR independiente; sin publicar ni fusionar.
