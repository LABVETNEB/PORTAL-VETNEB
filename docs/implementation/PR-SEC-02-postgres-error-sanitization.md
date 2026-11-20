# PR-SEC-02 — Sanitización de errores PostgreSQL (SEC-05)

## Estado base
`main` @ `f0cf91da`. Hallazgo SEC-05 de `docs/audit/AUDITORIA_SEGURIDAD_CAJA_BLANCA_ROADMAP_2026-11-11.md`: el handler global convertía los SQLSTATE `23505`, `23503`, `22P02` y `42703` en HTTP 400 y devolvía `error.message` crudo en `error` y `details` (nombres de constraint, tabla y columna).

## Scope
Incluido: `server/fastify-app.ts` (backend-only, R2) y su test de integración.
Excluido: rutas, repositorios, otros códigos SQLSTATE, logging, frontend, dependencias, CI.

## Cambio
- Una única constante de SQLSTATE y un único predicado `isPostgresClientError`, usados tanto por `getFastifyErrorStatus` como por `getFastifyErrorMessage`.
- Esos errores responden 400 con el mensaje público fijo `Solicitud inválida` en `error` y `details`.
- Sin cambios: errores HTTP 400 no PostgreSQL conservan su mensaje; los 5xx siguen respondiendo `Error interno del servidor`; no hay segundo error handler; el log `API_ERROR` no cambia.

## Validación
`test/integration/app/fastify-app.test.ts` inyecta los cuatro SQLSTATE con mensajes sintéticos y verifica status 400, cuerpo exacto y ausencia de los identificadores filtrados; las aserciones preexistentes de 500 y de 400 genérico se mantienen.
El censo M48 se realineó (raíz `server/*.ts` 9/2.628 → 9/2.641; total 246/50.381).

## Riesgo residual
Los clientes que dependían del texto interno de PostgreSQL en `details` dejan de recibirlo. Rollback: revertir el PR.
