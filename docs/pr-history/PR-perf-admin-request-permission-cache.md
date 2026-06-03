# PR: perf(admin): request-scoped auth permission cache

## Resumen

Se centralizo la lectura del contexto de autenticacion admin Fastify en un helper request-scoped. El resultado de sesion + usuario admin se memoiza solo en el objeto `request`, para que varias verificaciones dentro del mismo request reutilicen la misma consulta sin compartir estado con otros requests.

## Problema detectado

Varias rutas admin Fastify tenian helpers locales `authenticateAdminUser` que repetian el flujo de:

- leer cookie admin;
- hashear token;
- consultar sesion admin;
- consultar usuario admin;
- validar expiracion;
- refrescar `lastAccess` cuando correspondia.

Cuando una ruta combinaba gate de auth y helpers internos de permisos/roles, esa estructura podia repetir lecturas de sesion o usuario dentro del mismo request. La optimizacion anterior con JOIN redujo parte del costo, pero faltaba memoizacion acotada al request.

## Implementacion

- Se agrego `getRequestAdminAuthContext(request, deps)` en `server/lib/fastify-admin-auth.ts`.
- El cache usa un `Symbol` privado sobre el objeto `FastifyRequest`.
- El valor cacheado es una `Promise<RequestAdminAuthContext>` asociada al token actual del request.
- `authenticateFastifyAdmin` ahora consume ese contexto central.
- Se agrego `clearRequestAdminAuthContext(request)` y se usa en logout admin despues de borrar la sesion actual.
- El helper soporta ambos modelos de dependencias:
  - `getAdminSessionWithUser`, para rutas que ya usan JOIN sesion + usuario.
  - `getAdminSessionByToken` + `getAdminUserById`, para rutas con deps separadas.
- Los wrappers locales de rutas admin se mantuvieron cuando eran parte del contrato de tests, pero ahora delegan al helper central.
- Se conservaron status codes, mensajes configurables, limpieza de cookie, borrado de sesion invalida/expirada y refresh de `lastAccess`.

## Archivos tocados

Backend:

- `server/lib/fastify-admin-auth.ts`
- `server/routes/admin-audit.fastify.ts`
- `server/routes/admin-auth.fastify.ts`
- `server/routes/admin-failed-login-alerts.fastify.ts`
- `server/routes/admin-particular-tokens.fastify.ts`
- `server/routes/admin-pricing.fastify.ts`
- `server/routes/admin-report-access-tokens.fastify.ts`
- `server/routes/admin-reports.fastify.ts`
- `server/routes/admin-sessions.fastify.ts`
- `server/routes/admin-study-tracking.fastify.ts`
- `server/routes/admin-system-health.fastify.ts`
- `server/routes/admin-system-maintenance.fastify.ts`
- `server/routes/admin-system-schema-health.fastify.ts`
- `server/routes/admin-users-roles.fastify.ts`

Tests:

- `test/admin-auth-request-cache.test.ts`
- `test/admin-auth-session-last-access-contract.test.ts`
- `test/admin-clinics-auth-contract.test.ts`
- `test/admin-particular-tokens-session-last-access-contract.test.ts`
- `test/admin-report-access-tokens-session-last-access-contract.test.ts`
- `test/admin-reports-session-last-access-contract.test.ts`
- `test/admin-study-tracking-session-last-access-contract.test.ts`
- `test/audit-separated-surfaces.test.ts`
- `test/audit-suite-completeness.test.ts`
- `test/routes-session-last-access-contract.test.ts`
- `test/security-boundary-suite-completeness.test.ts`
- `test/security-critical-route-surface-registry.test.ts`
- `test/security-cross-auth-surface-boundaries.test.ts`
- `test/security-production-invariants.test.ts`
- `test/security-response-disclosure-boundaries.test.ts`
- `test/security-session-cookie-boundaries.test.ts`

Documentacion:

- `docs/pr-history/PR-perf-admin-request-permission-cache.md`

## Tests/comandos

```powershell
node --experimental-strip-types --experimental-specifier-resolution=node --test test/admin-auth-request-cache.test.ts test/admin-auth.fastify.test.ts test/admin-auth-middleware.test.ts test/admin-clinics.fastify.test.ts test/admin-users-roles.fastify.test.ts test/admin-sessions.fastify.test.ts
```

Resultado: OK.

```powershell
node --experimental-strip-types --experimental-specifier-resolution=node --test test/admin-report-access-tokens.fastify.test.ts test/admin-reports.fastify.test.ts test/admin-particular-tokens.fastify.test.ts test/admin-study-tracking.fastify.test.ts test/admin-audit.fastify.test.ts test/admin-pricing-api.test.ts
```

Resultado: OK.

```powershell
node --experimental-strip-types --experimental-specifier-resolution=node --test test/admin-system-health.fastify.test.ts test/admin-system-maintenance.fastify.test.ts test/admin-system-schema-health.fastify.test.ts test/admin-failed-login-alerts.fastify.test.ts test/security-session-cookie-boundaries.test.ts test/admin-clinics-auth-contract.test.ts
```

Resultado: OK.

```powershell
node --experimental-strip-types --experimental-specifier-resolution=node --test test/admin-auth-session-last-access-contract.test.ts test/admin-particular-tokens-session-last-access-contract.test.ts test/admin-report-access-tokens-session-last-access-contract.test.ts test/admin-reports-session-last-access-contract.test.ts test/admin-study-tracking-session-last-access-contract.test.ts test/routes-session-last-access-contract.test.ts
```

Resultado: OK.

```powershell
node --experimental-strip-types --experimental-specifier-resolution=node --test test/security-cross-auth-surface-boundaries.test.ts test/security-production-invariants.test.ts test/security-response-disclosure-boundaries.test.ts test/security-boundary-suite-completeness.test.ts test/security-critical-route-surface-registry.test.ts test/audit-suite-completeness.test.ts
```

Resultado: OK.

```powershell
node --experimental-strip-types --experimental-specifier-resolution=node --test test/audit-separated-surfaces.test.ts
```

Resultado: OK.

```powershell
pnpm --dir frontend lint
```

Resultado: OK.

```powershell
pnpm --dir frontend typecheck
```

Resultado: OK.

```powershell
pnpm typecheck
```

Resultado: OK.

```powershell
pnpm typecheck:test
```

Resultado: OK.

```powershell
pnpm test
```

Resultado: OK, `2190` tests, `2189` pass, `1` skipped, `0` fail.

```powershell
pnpm build
```

Resultado: OK, `dist/index.js 848.8kb`.

```powershell
pnpm security:public-surface
```

Resultado: OK, `PASS security/public-surface`. Reporto solo findings informativos `server-only` existentes por identifiers sensibles en `frontend/src/middleware.ts`:

- `CLINIC_SESSION_COOKIE_NAME`
- `ADMIN_SESSION_COOKIE_NAME`

No se ejecuto `pnpm --dir frontend build`.

## Resultados

- Dentro del mismo request, dos llamadas al helper comparten el resultado y hacen una sola lectura de sesion/usuario.
- Requests distintos vuelven a consultar, sin cache cross-request.
- Admin valido sigue aceptando con las mismas reglas existentes.
- Sesion invalida sigue rechazando con `401`.
- Sesion expirada sigue rechazando, borra sesion y limpia cookie.
- Usuario admin ausente sigue rechazando, borra sesion y limpia cookie.
- El refresh de `lastAccess` se mantiene y ahora ocurre una sola vez por request autenticado.
- Rutas no admin no fueron migradas ni cambiadas.
- En el flujo admin auditado no hay helper separado `requireAdminPermission`/`requireRole` ni flag `disabled` en el record de auth admin actual; no se agregaron permisos nuevos y no se elimino ningun rechazo existente.

## Riesgos

- Bajo: el cache vive solo en `FastifyRequest` y desaparece al terminar el request.
- Bajo: no se confia en un cache externo ni en memoria por sesion, evitando permisos stale despues de cambios de rol.
- Bajo: errores y limpieza de cookies siguen pasando por el mismo `authenticateFastifyAdmin`.
- Medio-bajo: se centralizo un flujo usado por muchas rutas admin; se compenso con tests especificos, regressions admin y guardrails de seguridad.

## Rollback

- Revertir `getRequestAdminAuthContext` y `clearRequestAdminAuthContext` en `server/lib/fastify-admin-auth.ts`.
- Restaurar los helpers locales previos de autenticacion admin en las rutas afectadas.
- Revertir los tests de request-scoped cache y los ajustes de guardrails que ahora esperan el helper central.

## Estado final

Implementado y validado localmente. No se hizo `git add`, commit, push, PR ni merge.

Confirmacion request-scoped only:

- El cache se guarda solo en el objeto `request`.
- El cache se invalida automaticamente al finalizar el request porque no existe fuera de ese objeto.
- No hay cache global.
- No hay cache cross-request.
- No hay cache por sesion en memoria global.
- No se persiste cache.

Confirmacion de alcance:

- No se tocaron DB schema, migraciones ni indices.
- No se tocaron WebAuthn/Passkeys.
- No se tocaron frontend, UI ni mobile.
- No se tocaron CSP, CORS, CSRF/trusted-origin ni signed URLs.
- No se tocaron `storagePath`.
- No se cambiaron cookies de sesion salvo limpieza ya existente en auth admin y `clearRequestAdminAuthContext` en logout.
- No se cambiaron reglas de roles/permisos.
- No se modifico `test/security-csrf-mutating-route-coverage.test.ts`.
