# TEST-ARCH-89 - Login rate limit root tests

## Objetivo
Mover cuatro tests login-rate-limit desde test root hacia test/unit/infrastructure.
No se modifica runtime, producto ni logica operativa.

## Movimientos
- login rate limit domain/policy contract: test/unit/infrastructure
- login rate limit UX safety: test/unit/infrastructure
- login rate limits metadata migration: test/unit/infrastructure
- reset login rate limit script contract: test/unit/infrastructure

## Exclusiones
- No runtime/producto.
- No API/auth/DB/schema/migrations.
- No dependencias, lockfile ni CI.
