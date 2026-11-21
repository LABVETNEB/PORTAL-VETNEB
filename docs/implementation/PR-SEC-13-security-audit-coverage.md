# PR-SEC-13 — Cobertura de auditoría de seguridad (SEC-07 / V-02 / V-13)

## Estado base

`main` en `1c6830bb` (#2028 fusionada). `audit_log` no registraba login/logout de
particular, logout de clínica ni de admin, ni la emisión de URLs firmadas a particular.
No existía actor `particular` en la taxonomía.

## Scope

Incluido (backend-only, sin migración: `audit_log.event` y `audit_log.actor_type` son
`varchar` sin constraint):

- Actor `particular_token` (sin FK: el id del token particular va en `metadata.particularTokenId`,
  porque `actor_report_access_token_id` referencia otra tabla).
- Eventos: `auth.particular.login.succeeded` (login dedicado y unificado),
  `auth.particular.logout`, `auth.clinic.logout`, `auth.admin.logout`,
  `report.particular_url_issued` (`metadata.disposition` = `preview` | `download`).

Excluido: fallos de login (siguen en `login_failed_attempts`), MFA/inactividad (SEC-13),
frontend, schema, dependencias, CI.

## Diseño

- Metadata allowlisted por construcción: ids numéricos, `username`/`role` (ya presentes en
  eventos de login), `sessionExpiresAt`, `disposition`. Nunca token, cookie, URL firmada ni
  `storagePath`.
- La ruta particular pasa a `writeAuditLog` sólo `user-agent` como header, sin `cookie`.
- `writeAuditLog` captura sus propios errores: un fallo del sink no rompe login, logout ni
  la emisión de URL.
- Correlación: `requestId` = `request.id` en los eventos nuevos.
- La escritura ocurre después del efecto verificado (sesión creada/borrada, URL emitida).

## Archivos

`drizzle/schema.ts`, `server/lib/audit-log.ts`, `server/lib/audit.ts`,
`server/routes/{particular-auth,auth,admin-auth}.fastify.ts`, tests de integración de las tres
rutas, `test/unit/infrastructure/audit.test.ts`, y realineación de los censos
`m33-closeout` (digest) y `m48` (LOC).

## Rollback

Revertir el commit; no hay datos ni schema que deshacer. Las filas ya escritas con los
eventos nuevos quedan como `varchar` inertes.

## Riesgo residual

- Evidencia sólo local (tests con `writeAuditLog` inyectado); la escritura real contra
  `audit_log` y el listado admin de los eventos nuevos no se observaron en runtime.
- `audit_log` no tiene FK para el actor particular: la correlación por token es por metadata.
- Logout con sesión ya expirada no audita (la autenticación falla antes).
