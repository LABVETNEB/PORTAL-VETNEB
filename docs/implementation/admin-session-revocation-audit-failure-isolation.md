# Aislamiento de fallos de auditoría en revocación de sesiones admin

## Baseline

```text
branch: main
HEAD antes del cambio: 544c70cbb8d94ad03089e5daab789c485e4f175a
origin/main: 544c70cbb8d94ad03089e5daab789c485e4f175a
working tree antes del cambio: clean
stashes: 4 declarados por Nico; no inspeccionados (git stash prohibido); preservados
```

## Problema

`server/routes/admin-sessions.fastify.ts`, ruta `POST /:sessionType/:sessionId/revoke`,
revocaba la sesión mediante `revokeAdminSessionById` y a continuación ejecutaba
`await deps.createAuditLog(...)` sin `try/catch`, antes de responder `200`. Si la
escritura de auditoría fallaba (rechazo de la promesa), el error se propagaba a
Fastify y la ruta devolvía un error HTTP **aunque la revocación de sesión ya se
había persistido exitosamente**. Esto contradice el contrato ya vigente en el resto
del sistema (`server/lib/audit.ts`, función `writeAuditLog`): un fallo de escritura de
auditoría no debe alterar una respuesta de negocio exitosa.

Esta unidad no forma parte del Plan B / slots 1-18 ni cierra ningún control
enterprise. Control candidato: `ERM-CTRL-016` (Security Hardening Program), que
permanece `PARTIAL` después de este cambio.

## Scope incluido

- `server/routes/admin-sessions.fastify.ts`: aislar exclusivamente la llamada
  `deps.createAuditLog(...)` de la ruta de revocación con `try/catch`.
- Test de regresión runtime que fuerza el fallo de `createAuditLog` y verifica que
  la respuesta de negocio permanece intacta.
- Recalculo del censo LOC congelado de M48 para `server/routes` y el total
  `server`, único efecto colateral físico del cambio.

## Scope excluido

- No se modifica el payload exitoso de auditoría (mismos campos, mismo orden).
- No se modifica autenticación, CORS, `enforceTrustedOrigin`, `no-store`, permisos
  ni el contrato de respuesta de ninguna otra ruta.
- No se introduce ningún helper global ni refactor del subsistema de auditoría
  (`server/lib/audit.ts`, `server/lib/audit-log.ts`, `server/db-audit.ts` no se
  tocan).
- No se resuelve la duplicación de registros `AUDIT_EVENTS` ni la ausencia de
  redacción de metadata sensible identificados previamente en el inventario R0 de
  auditoría — son hallazgos separados, con causa raíz distinta, fuera de esta
  unidad.
- No se toca staging, producción, DB real, restore ni rollback.

## Clasificación

```text
Tipo: backend-only security hardening
Riesgo: R2
Control: ERM-CTRL-016 (permanece PARTIAL)
Slot Plan B: ninguno
```

## Cambio aplicado

En `server/routes/admin-sessions.fastify.ts`:

1. Se importan `logError` y `serializeError` desde `../lib/logger.ts` (funciones ya
   existentes y exportadas; no se duplica ni se crea un segundo motor de logging).
2. Se conserva el orden de la ruta sin alteración: autenticar → validar parámetros
   → bloquear auto-revocación → revocar sesión (`revokeAdminSessionById`) → 404 si
   no existe → **intentar auditoría** → responder `200`.
3. Se envuelve exclusivamente la llamada `await deps.createAuditLog({...})` en
   `try/catch`. El payload de auditoría exitoso no cambia.
4. En caso de error:
   - no se relanza (`catch` sin `throw`);
   - no se modifica `statusCode`, headers ni body de la respuesta ya planificada;
   - se emite `logError("ADMIN_SESSION_REVOKE_AUDIT_WRITE_ERROR", { requestId,
     event, error })`;
   - `error` se serializa con `serializeError` (envelope cerrado: solo nombre de
     clase de error contra allowlist finita, mensaje siempre `[REDACTED]`);
   - `requestId` es `request.id` (UUID v4 generado por
     `generateFastifyRequestId`/`genReqId` de Fastify); `buildStructuredLogEvent`
     de `server/lib/logger.ts` solo lo promueve al log si pasa `isSafeRequestId`,
     igual que en `server/lib/audit.ts`;
   - `event` es únicamente el nombre del evento de auditoría afectado
     (`"auth.session.revoked"`);
   - el log **no incluye** `sessionId`, `actorId`, IP, user-agent, URL,
     `metadata`, cookie, token, hash ni el mensaje crudo del error.
5. `deps.createAuditLog` se conserva como dependencia inyectable (sin cambios en
   `AdminSessionsNativeRoutesOptions`).

## Contrato HTTP preservado

- `POST /:sessionType/:sessionId/revoke` sigue devolviendo `200` con
  `{ success: true, revokedSession, revokedBy }` cuando la revocación tiene éxito,
  **independientemente de si la escritura de auditoría tuvo éxito o falló**.
- Los códigos `400` (parámetros inválidos / auto-revocación) y `404` (sesión no
  encontrada) no cambian: en esos casos `createAuditLog` ni siquiera se invoca,
  igual que antes.
- CORS, `enforceTrustedOrigin`, autenticación admin y el resto de rutas del
  archivo (`GET /`, `OPTIONS`) permanecen sin modificación.

## Tests ejecutados y estados canónicos

```text
node --test test/integration/adapters/controllers/admin-sessions.fastify.test.ts
  → PASSED (11/11, incluye el nuevo test de regresión, exit code 0)

node --test test/architecture/backend-modularization-m48-final-certification.test.ts
  → PASSED (35/35, incluye M44/M45/M46 delegados y el censo LOC recalculado, exit code 0)

pnpm lint:backend             → PASSED (0 errores, 49 warnings preexistentes, exit code 0;
                                  admin-sessions.fastify.ts solo conserva el warning
                                  preexistente de "ENV" no usado, sin warnings nuevos)
pnpm validate:local            → PASSED (typecheck + typecheck:test + test + build;
                                  4081 tests, 4080 pass, 1 skipped, 0 fail; build esbuild
                                  exitoso; exit code 0)
pnpm security:public-surface   → PASSED (sin hallazgos de exposición devtools pública;
                                  exit code 0; los dos findings "server-only" listados son
                                  preexistentes y no relacionados con este cambio)
git diff --check               → PASSED (exit code 0, sin errores de espacio en blanco)
```

No se afirma ningún estado `PASSED` sin exit code 0 observado.

## Riesgo residual

- El aislamiento cubre únicamente la llamada `createAuditLog` de esta ruta. El
  patrón de escritura directa de auditoría (sin pasar por `writeAuditLog` de
  `server/lib/audit.ts`) en `admin-sessions.fastify.ts` se conserva intacto — no
  se unificó con el resto del sistema porque el pedido de esta unidad fue
  exclusivamente el aislamiento de fallos, no un refactor del subsistema.
- La ausencia de redacción centralizada de `metadata` sensible en la vía de
  auditoría (hallazgo previo, no resuelto aquí) sigue vigente para todas las
  rutas, incluida esta.
- No se declara esta auditoría "durable", "no repudiable", "compliant" ni
  "completa". Este cambio solo evita que un fallo transitorio de escritura de
  auditoría degrade una operación de negocio ya exitosa; no mejora la
  durabilidad ni la integridad del propio registro de auditoría.
- El log de error (`ADMIN_SESSION_REVOKE_AUDIT_WRITE_ERROR`) no contiene
  suficiente detalle para diagnosticar la causa exacta del fallo de escritura sin
  acceso a los logs de la capa de datos — deliberado, para no exponer
  información sensible en el log estructurado.

## Rollback lógico

Revertir el commit que introduce este cambio restaura el comportamiento anterior
(fallo de auditoría propaga error HTTP). No hay migración de schema, no hay dato
persistido que dependa de este cambio, no hay estado externo a revertir. Reversión
= `git revert` del commit correspondiente (comando `[MANUAL-NICO]`, no ejecutado
por el agente).

## Estado final

```text
Código modificado: SÍ, dentro de la allowlist autorizada por Nico
Implementación autorizada: SÍ (R2, autorización explícita en el mensaje de Nico)
Staging/producción/DB real: BLOCKED (no aplica, no se intentó)
Cierre de control enterprise: NO — ERM-CTRL-016 permanece PARTIAL
Cierre de slot Plan B: NO — esta unidad no es un slot
```
