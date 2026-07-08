# TEST-ARCH-86 - Reports runtime session root tests

## Objetivo
Mover cinco guardrails de reports desde test root.
No se modifico runtime, producto ni logica operativa.

## Movimientos
- reports-runtime-timing-contract: test root a test/unit/contracts/reports
- reports-session-last-access-contract: test root a test/unit/contracts/reports
- reports-status-runtime-timing-contract: test root a test/unit/contracts/reports
- reports-status-session-last-access-contract: test root a test/unit/contracts/reports
- reports-suite-completeness: test root a test/architecture

## Ajustes
- REPO_ROOT fue actualizado por nueva profundidad.
- La autorreferencia del suite fue actualizada.

## Exclusiones
- No runtime/producto.
- No API/auth/DB/schema/migrations.
- No dependencias, lockfile ni CI.

## Validaciones
- Cuatro contracts focales: pass.
- reports-suite-completeness: 7 pass, 0 fail.
- pnpm typecheck:test: pass.
