# M27 — Clinics thin admin

## Baseline

- Rama: refactor/backend-modularization-m27-clinics-thin-admin.
- Base: eb46092922de66989ed8e98c16b1379d5c32989c.
- Repository canónico:
  server/features/clinics/infrastructure/admin-clinics-repository.ts.
- Blob inicial del repository: 7d9437d49e461536a742a95f9fa13794814dafd0.
- Transacciones iniciales: 2.
- El árbol y el índice estaban limpios.

## Arquitectura

Antes:

~~~text
Fastify route
  -> server/db-admin-clinics.ts (shim)
       -> Clinics infrastructure
~~~

Después:

~~~text
Fastify route
  -> servicio directo Clinics
       -> carga lazy de Clinics infrastructure
~~~

No se crea una capa application ni puertos, adapters, clases, factories o
repositorios genéricos. El SQL y las dos transacciones permanecen en el
repository canónico sin modificaciones.

## Servicios directos

- admin-clinics-query-service.ts delega listado y obtención por id sin
  transformar params ni resultados.
- admin-clinics-command-service.ts coordina hash inyectado, create, update,
  confirmación exacta y delete, credenciales y clasificación/sanitización de
  errores PostgreSQL.
- Ambos cargan infrastructure/index.ts de forma lazy cuando no reciben el
  seam correspondiente.
- Ningún servicio depende de Fastify, auditoría, CORS o auth.

## Responsabilidades preservadas en rutas

Las rutas conservan registro Fastify, métodos y paths, parsing, validación
HTTP, CORS, trusted-origin, autenticación administrativa, respuestas, status
codes, mensajes exactos, auditoría posterior al éxito, logging con contexto
de request, mapeo final de errores a HTTP y seams de inyección.

admin-users-roles.fastify.ts sólo delega a Clinics el comando de actualización
de credenciales. El resto de Users/Roles no se refactoriza.

## Retiro del shim

server/db-admin-clinics.ts se elimina después de reapuntar imports runtime y
type-only activos. Las menciones históricas en documentación previa no forman
parte de la resolución runtime.

## Allowlist real

- docs/implementation/m27-clinics-thin-admin.md.
- server/db-admin-clinics.ts (eliminado).
- server/features/clinics/README.md.
- server/features/clinics/admin-clinics-command-service.ts.
- server/features/clinics/admin-clinics-query-service.ts.
- server/features/clinics/infrastructure/README.md.
- server/routes/admin-clinics.fastify.ts.
- server/routes/admin-users-roles.fastify.ts.
- test/architecture/clinics-infrastructure-boundary-guard.test.ts.
- test/integration/adapters/controllers/admin-clinics.fastify.test.ts.
- test/integration/adapters/controllers/admin-users-roles.fastify.test.ts.
- test/unit/clinics/admin-clinics-command-service.test.ts.
- test/unit/clinics/admin-clinics-query-service.test.ts.
- test/unit/infrastructure/global-performance-resilience-contract.test.ts.

## Denylist respetada

No se modifican repository ni barrel de infrastructure, domain, Users/Roles
DB, fastify-app, db.ts, schema, Drizzle, migraciones, frontend, manifiestos,
lockfiles, dependencias, scripts, CI, perfil público, auth global, sesiones,
cookies o permisos.

## Tests y contratos

La validación M27 incluye typecheck runtime/test, tests unitarios de ambos
servicios, guards Clinics, contratos admin source-only e integraciones Fastify.
Después ejecuta validate:local, security:public-surface y git diff --check.

El contrato global de performance/resiliencia sólo actualiza su comentario
source-only para reflejar que el shim ya no existe; continúa midiendo el
repository canónico sin debilitar expectativas.

El guard de infrastructure verifica ausencia del shim y application,
presencia y pureza de servicios, consumo lazy del barrel canónico, rutas sin
imports directos de infrastructure y delegación exclusiva del comando de
credenciales desde Users/Roles.

## Resultado de validación

- pnpm typecheck: PASSED.
- pnpm typecheck:test: PASSED.
- Tests dirigidos M27: PASSED (167/167).
- pnpm validate:local: PASSED (typecheck, typecheck:test, 3513 tests con
  3512 pass, 1 skip y 0 fail, y build).
- pnpm security:public-surface: PASSED.
- git diff --check: PASSED.

## Rollback

Revertir el cambio restaura el shim y la coordinación inline en las rutas.
No requiere migración de datos, rollback de schema ni cambios de
infraestructura.

## Fuera de alcance

M28 (perfil público) y M29 (cierre y verificación cross-tenant) permanecen
fuera de M27.
