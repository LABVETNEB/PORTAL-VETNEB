# TEST-ARCH-92 - Public Professionals Contracts Root Tests

## Objetivo

Reducir tests en `test/` root moviendo el cluster cohesivo de contratos/eligibilidad de profesionales publicos hacia `test/unit/contracts/public-professionals`.

## Alcance

- Cambio exclusivo de organizacion de tests y referencias internas necesarias.
- Sin cambios runtime/producto/API/auth/DB/deps/lockfiles/CI.
- Cluster movido:
  - `test/unit/contracts/public-professionals/professional-bank-eligibility.test.ts`
  - `test/unit/contracts/public-professionals/public-professionals-db-contract.test.ts`
  - `test/unit/contracts/public-professionals/public-professionals-histopathology-eligibility.test.ts`
  - `test/unit/contracts/public-professionals/public-professionals-histopathology-sql-drift.test.ts`

## Ajustes

- Import relativo de `server/lib/professional-bank-eligibility.ts` actualizado por la nueva profundidad.
- Los tests que leen `server/db-public-professionals.ts` via `process.cwd()` no requieren cambio de ruta.

## Validacion esperada

- Focales del cluster movido.
- `pnpm typecheck:test`.
- `pnpm test`.
- `pnpm build`.
- `pnpm security:public-surface`.
