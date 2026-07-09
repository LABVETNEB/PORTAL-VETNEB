# TEST-ARCH-87 - Report access root tests

## Objetivo
Mover seis tests report-access y public-report-access desde test root hacia carpetas arquitectonicas explicitas.
No se modifica runtime, producto ni logica operativa.

## Movimientos
- report-access-token-edge: test root a test/unit/domain
- report-access-token-rate-limit: test root a test/unit/infrastructure
- public-report-access-rate-limit: test root a test/unit/infrastructure
- report-access-tokens-runtime-timing-contract: test root a test/unit/contracts/reports
- report-access-tokens-session-last-access-contract: test root a test/unit/contracts/reports
- public-report-access-runtime-timing-contract: test root a test/unit/contracts/reports

## Validaciones
- Seis validaciones focales: pass.
- pnpm typecheck:test: pass.

## Exclusiones
- No runtime/producto.
- No API/auth/DB/schema/migrations.
- No dependencias, lockfile ni CI.
