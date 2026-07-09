# TEST-ARCH-90 - Audit root tests

## Objetivo
Mover tests audit desde test root hacia directorios semanticos de arquitectura, seguridad, contratos e infraestructura.
No se modifica runtime, producto ni logica operativa.

## Movimientos
- Audit suite y flujos auditados: test/architecture
- Audit logging phase boundaries: test/security
- Audit core/helper contracts: test/unit/infrastructure
- Particular audit contracts: test/unit/contracts/particular

## Exclusiones
- No runtime/producto.
- No API/auth/DB/schema/migrations.
- No dependencias, lockfile ni CI.
