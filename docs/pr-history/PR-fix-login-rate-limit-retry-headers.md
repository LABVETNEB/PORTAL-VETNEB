# PR: fix(login): rate limit retry headers completos

## Resumen

Se aseguró que todo `429` de login devuelva los headers obligatorios para que el frontend no muestre el mensaje de headers faltantes cuando el backend informa correctamente el cooldown.

Superficies cubiertas:

- Clinica/unified: `POST /api/auth/login`
- Admin: `POST /api/admin/auth/login`
- Particular: `POST /api/particular/auth/login`

## Archivos tocados

- `server/lib/login-rate-limit.ts`
- `server/routes/auth.fastify.ts`
- `server/routes/admin-auth.fastify.ts`
- `server/routes/particular-auth.fastify.ts`
- `frontend/src/lib/api.ts`
- `test/login-rate-limit.test.ts`
- `test/auth.fastify.test.ts`
- `test/admin-auth.fastify.test.ts`
- `test/particular-auth.fastify.test.ts`
- `test/frontend-api-client-request.test.ts`
- `docs/pr-history/PR-fix-login-rate-limit-retry-headers.md`

## Implementacion

- `buildLoginRateLimitHeaders` ahora calcula una sola vez los segundos de reset y puede incluir `Retry-After` con `includeRetryAfter: true`.
- Las tres rutas de login llaman a `setLoginRateLimitHeaders(..., includeRetryAfter: true)` antes de cada `reply.code(429).send(...)`.
- Se removio el seteo manual separado de `Retry-After` en las rutas para evitar divergencias con `RateLimit-Reset`.
- El frontend sigue exigiendo los cinco headers en rutas de login, pero acepta `Retry-After: 0` como valor valido. Con headers presentes y `0`, conserva el mensaje del backend sin mostrar `LOGIN_RATE_LIMIT_HEADERS_MISSING_MESSAGE`.
- No se cambiaron limites, ventanas, cookies, sesiones, trusted-origin, CSRF, CORS, CSP, DB schema, indices ni WebAuthn.

## Tests

- Helper central:
  - Verifica que `buildLoginRateLimitHeaders(..., includeRetryAfter: true)` emite `Retry-After` junto con `RateLimit-Policy`, `RateLimit-Limit`, `RateLimit-Remaining` y `RateLimit-Reset`.
  - Verifica que `Retry-After: 0` y `RateLimit-Reset: 0` son coherentes.
- Clinica/unified:
  - `429` en `/api/auth/login` contiene los cinco headers obligatorios.
  - `Retry-After` es entero y mayor o igual a cero.
- Admin:
  - `429` en `/api/admin/auth/login` contiene los cinco headers obligatorios.
- Particular:
  - `429` en `/api/particular/auth/login` contiene los cinco headers obligatorios.
- Frontend:
  - El contrato conserva la exigencia de headers completos.
  - El cliente no usa truthiness de `retryAfterSeconds`, evitando mostrar `LOGIN_RATE_LIMIT_HEADERS_MISSING_MESSAGE` cuando el backend entrega los cinco headers y `Retry-After` es `0`.

## Comandos/resultados

```powershell
node --experimental-strip-types --experimental-specifier-resolution=node --test test/login-rate-limit.test.ts test/auth.fastify.test.ts test/admin-auth.fastify.test.ts test/particular-auth.fastify.test.ts test/frontend-api-client-request.test.ts
```

Resultado: OK, `78` tests pass.

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

Resultado: OK, `2147` tests, `2146` pass, `1` skipped, `0` fail.

```powershell
pnpm build
```

Resultado: OK, `dist/index.js 877.8kb`.

```powershell
pnpm security:public-surface
```

Resultado: OK, `PASS security/public-surface`. Reporto solo findings `server-only` por identifiers sensibles en `frontend/src/middleware.ts`.

```powershell
pnpm --dir frontend lint
```

Resultado: exit `0`, con `1` warning existente: `frontend/src/app/api/security/csp-report/route.ts:177` tiene un `eslint-disable` sin uso.

```powershell
pnpm --dir frontend typecheck
```

Resultado: OK.

No se ejecuto `pnpm --dir frontend build`, respetando la instruccion de no correrlo si puede pedir red por Google Fonts.

## Riesgos

- Bajo: el cambio centraliza `Retry-After` solo cuando las rutas 429 lo solicitan con `includeRetryAfter`, por lo que no agrega `Retry-After` a respuestas no limitadas.
- Bajo: el frontend acepta `Retry-After: 0` como valor valido, manteniendo la validacion de los cinco headers obligatorios.
- Bajo: las pruebas cubren los caminos runtime de login y el contrato frontend.

## Rollback

- Revertir `includeRetryAfter` en `buildLoginRateLimitHeaders`.
- Restaurar el seteo manual previo de `Retry-After` en las tres rutas si se necesitara volver al comportamiento anterior.
- Revertir el ajuste frontend de `retryAfterSeconds === null` para volver a tratar `0` como ausencia.
- Revertir las aserciones agregadas en tests.

## Estado final

Implementado y validado localmente. No se hizo `git add`, commit, push, PR ni merge.

Confirmacion explicita: todo `429` de login en `POST /api/auth/login`, `POST /api/admin/auth/login` y `POST /api/particular/auth/login` incluye los cinco headers obligatorios:

- `Retry-After`
- `RateLimit-Policy`
- `RateLimit-Limit`
- `RateLimit-Remaining`
- `RateLimit-Reset`
