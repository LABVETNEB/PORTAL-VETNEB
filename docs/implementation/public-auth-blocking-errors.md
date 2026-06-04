# Public/auth blocking errors

## Síntomas observados

- `/profesionales`: buscar `MI BABAU` mostraba `No se pudo realizar la búsqueda. Intente nuevamente.`
- `/precios`: la página mostraba `No se pudieron cargar los precios. Intente nuevamente.`
- `/particulares`: el login por token podía mostrar `Demasiados intentos de inicio de sesión. Intente más tarde.`
- `/login`: el login privado podía mostrar `El backend no informó cuándo reintentar el inicio de sesión. Reintentá más tarde o contactá a VETNEB.`

## Causa raíz

- `/profesionales`: el cliente público resolvía la base API validando `NEXT_PUBLIC_API_URL` antes de tomar la rama browser same-origin. En producción o entornos con proxy same-origin, eso podía cortar la búsqueda antes de llamar a `/api/public/professionals/search`. Además, la firma opcional de avatar podía convertir un perfil válido en error de búsqueda.
- `/precios`: la página cargaba precios como server component. En runtime servidor dependía de `NEXT_PUBLIC_API_URL`, por lo que un catálogo válido o vacío podía terminar como error de carga antes de pasar por el proxy same-origin del navegador.
- `/particulares token`: el backend devolvía 429 con headers, pero sin body JSON recuperable con `code` estable y `retryAfterSeconds`. El frontend podía mostrar copy poco específico y no tenía contrato de body como respaldo.
- `/login privado`: el cliente exigía todos los headers de rate limit en rutas de login. Si faltaba algún header, incluso con `Retry-After` o metadata recuperable, mostraba el mensaje anómalo de backend incompleto.

## Archivos modificados

- `frontend/src/lib/api.ts`
- `frontend/src/app/precios/page.tsx`
- `frontend/src/components/public/PreciosContent.tsx`
- `server/lib/login-rate-limit.ts`
- `server/routes/auth.fastify.ts`
- `server/routes/admin-auth.fastify.ts`
- `server/routes/particular-auth.fastify.ts`
- `server/routes/public-professionals.fastify.ts`
- `test/frontend-api-client-request.test.ts`
- `test/frontend-precios-page-content.test.ts`
- `test/login-rate-limit.test.ts`
- `test/auth.fastify.test.ts`
- `test/admin-auth.fastify.test.ts`
- `test/particular-auth.fastify.test.ts`
- `test/public-professionals.fastify.test.ts`

## Solución implementada

- El helper frontend resuelve same-origin en browser antes de validar `NEXT_PUBLIC_API_URL`; el fallback `http://localhost:3000` queda limitado al runtime servidor de desarrollo.
- `/precios` conserva metadata server-side, pero la carga del catálogo vive en `PreciosContent`, un client component que usa `/api/public/pricing` por same-origin, separando loading, vacío y error real.
- El endpoint público de profesionales conserva la respuesta válida si falla la firma opcional de avatar; devuelve `avatarUrl: null`, usa el fallback visual local y no expone el path interno.
- Los logins clinic/unified, admin y particular devuelven 429 con un contrato común recuperable.
- El frontend acepta metadata de reintento desde `Retry-After`, `RateLimit-Reset`, `retryAfterSeconds` o `retryAfter`; si no hay metadata usa el fallback seguro sin mensaje anómalo.

## Contrato 429/retry

Cuando aplica rate limit de login:

- HTTP status: `429`
- Header: `Retry-After`
- Headers auxiliares: `RateLimit-Policy`, `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`
- Body JSON:
  - `success: false`
  - `error: "Demasiados intentos de inicio de sesión. Intentá nuevamente más tarde."`
  - `code: "LOGIN_RATE_LIMITED"`
  - `retryAfterSeconds: number`

Si el frontend recibe 429 sin metadata, muestra:

`Demasiados intentos de inicio de sesión. Intentá nuevamente más tarde.`

## Pruebas agregadas/actualizadas

- API frontend: resolución same-origin antes de validar env, parsing de 429 por headers o body, eliminación del mensaje de headers faltantes.
- Precios frontend: metadata server, carga client-side, estados loading/error/vacío y render de categorías/items.
- Login rate limit: constante de fallback, headers y body JSON recuperable.
- Auth clinic/unified, admin y particular: 429 con `code` y `retryAfterSeconds`.
- Profesionales público: búsqueda `MI BABAU` con payload válido sigue respondiendo 200 aunque falle el avatar opcional, sin exponer paths internos.
- Se mantiene cobertura existente de login válido, login inválido genérico, token válido, rate limit sin bypass, listado compacto, detalle por `clinicId`, precios vacíos y errores reales.

## Validaciones ejecutadas

- Pendiente registrar resultado final de `pnpm test`.
- Pendiente registrar resultado final de `pnpm build`.
- Pendiente registrar resultado final de `pnpm security:public-surface`.
- Pendiente registrar resultado final de `pnpm -C frontend build`.

## Riesgos residuales

- Si el deployment no sirve `/api/*` en el mismo host ni configura rewrites con `NEXT_PUBLIC_API_URL`, las llamadas browser same-origin fallarán como error real de backend/red.
- La firma de avatar puede quedar ausente en el listado cuando el servicio de storage no responda; el perfil sigue visible con fallback local.

## Confirmación de seguridad

- No se eliminaron ni relajaron rate limits.
- No se agregó bypass de fuerza bruta.
- No se relajó CORS.
- No se agregaron scripts inline, handlers inline ni `dangerouslySetInnerHTML`.
- No se loggean credenciales, tokens completos, cookies, sesiones, passwords ni service role.
- La respuesta pública no expone `storagePath`, `avatarStoragePath` ni paths de avatar ante fallos de firma.
- El listado de profesionales sigue renderizando cards compactas y no vuelve a mostrar email, teléfono ni dirección completa.
