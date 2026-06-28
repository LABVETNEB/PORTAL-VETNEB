# PR 818 - API Referrer-Policy responses

## Resumen

Se extendio el helper backend central de headers de seguridad API para aplicar `Referrer-Policy: no-referrer` junto con `X-Content-Type-Options: nosniff` en respuestas Fastify bajo `/api` y `/api/*`.

No se tocaron schema de DB, migraciones, indices, WebAuthn, frontend UI, CSP/frontend ni logica de negocio.

## Rutas auditadas

- `server/lib/api-response-security.ts`: helper central creado en PR 817 para headers de respuestas API.
- `server/fastify-app.ts`: hook global `onRequest`, `requireTrustedOriginForFastify`, handlers globales de 404/error, `/`, `/health` y `/api/health`.
- `server/lib/sensitive-response-cache.ts`: helper backend existente para `Cache-Control: no-store` en API sensible.
- `server/routes/*.fastify.ts`: rutas Fastify registradas bajo `/api/admin/*`, `/api/auth`, `/api/clinic/*`, `/api/particular/*`, `/api/public/*`, `/api/report-access-tokens`, `/api/reports`, `/api/study-tracking` y `/api/logistics/*`.
- `test/backend-api-nosniff-responses-contract.test.ts`: contrato del helper/hook central.
- `test/fastify-app.test.ts`: contratos de respuestas publicas, autenticadas, error y raw API.
- `frontend/next.config.ts`: contiene `Referrer-Policy` frontend existente; no se modifico.

## Headers actuales auditados

- API Fastify: `X-Content-Type-Options: nosniff` ya se aplicaba desde `server/lib/api-response-security.ts`.
- API sensible: `Cache-Control: no-store` ya se aplicaba desde `server/lib/sensitive-response-cache.ts`.
- Frontend Next: `Referrer-Policy: strict-origin-when-cross-origin` existe en `frontend/next.config.ts`; queda fuera del cambio.

## Superficie API mapeada

Publica:

- `/api/health`
- `/api/contact`
- `/api/public/professionals`
- `/api/public/pricing`
- `/api/public/report-access`

Autenticada o sensible:

- `/api/admin/*`
- `/api/auth`
- `/api/clinic/*`
- `/api/particular/*`
- `/api/particular-tokens`
- `/api/report-access-tokens`
- `/api/reports`
- `/api/study-tracking`
- `/api/logistics/*`

Errores API:

- 404 global para rutas `/api/*` no registradas.
- Handler global de errores no capturados para rutas `/api/*`.

Fuera de API:

- `/`
- `/health`
- Assets estaticos o HTML publico fuera de `/api`, si existen.

## Header aplicado

- `Referrer-Policy: no-referrer`

El header se aplica desde el hook central `onRequest` solo cuando el path es `/api` o empieza con `/api/`. El helper escribe en `FastifyReply` y `reply.raw` para conservar cobertura en respuestas que terminan con `reply.raw.end`, como `/api/health`.

## Implementacion

- `server/lib/api-response-security.ts`: agrega constantes de `Referrer-Policy`, clasificacion general `shouldApplyApiSecurityHeaders` y aplicacion central de headers API.
- `server/fastify-app.ts`: reutiliza el hook central temprano con `applyApiSecurityHeaders(request, reply)`.

## Tests agregados o ajustados

- `test/backend-api-nosniff-responses-contract.test.ts`
  - Cubre constantes `Referrer-Policy: no-referrer`.
  - Cubre clasificacion del helper para API y no API.
  - Verifica registro central del hook antes de cortes tempranos.
  - Verifica que no se introduzca dependencia frontend/UI.
- `test/fastify-app.test.ts`
  - Cubre endpoint admin autenticado: `GET /api/admin/system/health`.
  - Cubre endpoint API publico: `GET /api/public/pricing`.
  - Cubre respuesta API de error: `GET /api/no-existe`.
  - Cubre endpoint raw API: `GET /api/health`.
  - Verifica que `/` no reciba `Referrer-Policy` por estar fuera de `/api`.
