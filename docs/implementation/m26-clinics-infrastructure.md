
# M26 — Clinics infrastructure repository

## Identificación

- Milestone: M26, Fase F — Clinics.
- Base: 471325aba7914c69d335f6720f9debf59aee12ec.
- Rama: refactor/backend-modularization-m26-clinics-infrastructure.
- Fuente R0: server/db-admin-clinics.ts.
- Blob R0: 0624afbce5416d86c2794ace6503c3dc8b33055f.
- Líneas R0: 694.
- Transacciones R0: 2.

## Objetivo

Mover la persistencia administrativa de Clinics a
server/features/clinics/infrastructure sin modificar contratos HTTP, SQL,
serialización, resultados ni límites transaccionales.

## Resultado

~~~text
server/db-admin-clinics.ts
  └─ shim
       └─ features/clinics/infrastructure/index.ts
            └─ admin-clinics-repository.ts
~~~

El repository es una copia 1:1 de R0. Sólo cambian tres imports relativos
debido a la profundidad del nuevo path.

## Contratos preservados

- Dos transacciones exactas.
- Creación atómica clínica + usuario.
- Compatibilidad clinic_id legacy.
- Paginación, búsqueda, orden y serialización ISO.
- Resultados discriminados.
- Actualización de credenciales.
- Orden de eliminación y nullificación de audit_log.clinic_id.

## Allowlist

- docs/implementation/m26-clinics-infrastructure.md.
- server/db-admin-clinics.ts.
- server/features/clinics/README.md.
- server/features/clinics/infrastructure/README.md.
- server/features/clinics/infrastructure/admin-clinics-repository.ts.
- server/features/clinics/infrastructure/index.ts.
- test/architecture/clinics-infrastructure-boundary-guard.test.ts.
- test/unit/contracts/admin/admin-clinics-db-contract.test.ts.
- test/unit/contracts/admin/admin-heavy-list-pagination-contract.test.ts.
- test/unit/infrastructure/global-performance-resilience-contract.test.ts.

## Anclas source-only actualizadas

M26 reapunta al repository canónico los contratos que inspeccionan
paginación y resiliencia global. El shim legacy permanece sólo para los
consumidores runtime de las rutas hasta M27.

## Exclusiones

No se modifican rutas, endpoints, payloads, auth, CORS, auditoría, schema,
migraciones, dependencias, lockfiles, frontend, scripts ni CI.

## Rollback

Revertir el PR restaura la implementación en el path legacy y elimina
infrastructure. No requiere migración de datos ni cambio de schema.
