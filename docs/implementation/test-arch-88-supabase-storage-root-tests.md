# TEST-ARCH-88 - Supabase storage root tests

## Objetivo
Mover siete tests Supabase/Storage desde test root hacia carpetas arquitectonicas explicitas.
No se modifica runtime, producto ni logica operativa.

## Movimientos
- storage suite completeness: test/architecture
- supabase bucket health: test/unit/infrastructure
- supabase recovery edge: test/unit/infrastructure
- supabase signed URL: test/unit/infrastructure
- supabase storage boundaries: test/unit/infrastructure
- supabase upload success: test/unit/infrastructure
- supabase MIME policy: test/unit/infrastructure

## Exclusiones
- No runtime/producto.
- No API/auth/DB/schema/migrations.
- No dependencias, lockfile ni CI.
