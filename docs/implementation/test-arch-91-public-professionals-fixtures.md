# TEST-ARCH-91 - Public Professionals Fixtures Root Tests

## Objetivo

Reducir tests en `test/` root moviendo el cluster cohesivo de invariants/guardrails de fixtures publicos de profesionales hacia `test/architecture`.

## Alcance

- Cambio exclusivo de organizacion de tests y referencias internas.
- Sin cambios runtime/producto/API/auth/DB/deps/lockfiles/CI.
- Cluster movido:
  - `test/architecture/public-professionals-fixtures-invariants.test.ts`
  - `test/architecture/public-professionals-fixture-adoption-invariants.test.ts`
  - `test/architecture/public-professionals-fixture-assertions-quality-invariants.test.ts`
  - `test/architecture/public-professionals-fixture-file-scope-invariants.test.ts`
  - `test/architecture/public-professionals-fixture-helper-boundaries-invariants.test.ts`
  - `test/architecture/public-professionals-fixture-isolation-invariants.test.ts`
  - `test/architecture/public-professionals-fixture-naming-consistency-invariants.test.ts`
  - `test/architecture/public-professionals-fixture-registry-invariants.test.ts`
  - `test/architecture/public-professionals-fixture-suite-completeness-invariants.test.ts`

## Referencias actualizadas

- Imports relativos al helper compartido `test/helpers/public-professionals-fixtures.ts`.
- Rutas literales del registry/completeness del cluster.
- Referencia del surface registry critico de seguridad.

## Validacion esperada

- Focales del cluster movido.
- `test/security-critical-route-surface-registry.test.ts`.
- `pnpm typecheck:test`.
- `pnpm test`.
- `pnpm build`.
- `pnpm security:public-surface`.
