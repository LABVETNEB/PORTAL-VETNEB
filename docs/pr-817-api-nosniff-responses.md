# PR 817 - API nosniff responses

## Resumen

Se agrego un helper backend minimo para aplicar `X-Content-Type-Options: nosniff` a respuestas de la superficie API Fastify. La aplicacion se hace desde un hook central `onRequest` en `createFastifyApp`, filtrado por rutas `/api` y `/api/*`.

No se tocaron schema de DB, migraciones, indices, WebAuthn, frontend UI, CSP/frontend ni logica de negocio.

## Auditoria

- `server/fastify-app.ts`: registro central Fastify, hooks globales `onRequest` y `onSend`, handlers globales de 404/error, `/`, `/health` y `/api/health`.
- `server/middlewares/trusted-origin.ts`: middleware global existente para origen confiable.
- `server/lib/sensitive-response-cache.ts`: helper backend existente para `Cache-Control: no-store` en API sensible.
- `server/routes/*.fastify.ts`: rutas nativas Fastify publicas, admin, clinic, particular, reports y logistics.
- `frontend/next.config.ts`: ya tenia `X-Content-Type-Options: nosniff` para frontend; no se modifico.

No se encontro helper backend compatible para `X-Content-Type-Options`, ni uso de `helmet` en backend.

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

Fuera de API:

- `/`
- `/health`
- Assets estaticos o HTML publico fuera de `/api`, si existen.

## Header aplicado

- `X-Content-Type-Options: nosniff`

El helper escribe el header en `FastifyReply` y tambien en `reply.raw` para conservar cobertura en endpoints que terminan con `reply.raw.end`, como `/api/health`.

## Implementacion

- `server/lib/api-response-security.ts`: nuevo helper backend con constantes, clasificacion de path API y aplicacion del header.
- `server/fastify-app.ts`: registro de hook global `onRequest` antes de `requireTrustedOriginForFastify`, para cubrir respuestas tempranas de API.

## Tests agregados o ajustados

- `test/backend-api-nosniff-responses-contract.test.ts`
  - Cubre clasificacion del helper para API y no API.
  - Verifica registro central del hook antes de cortes tempranos.
  - Verifica que no se introduzca dependencia frontend/UI.
- `test/fastify-app.test.ts`
  - Cubre endpoint admin autenticado: `GET /api/admin/system/health`.
  - Cubre endpoint API publico: `GET /api/public/pricing`.
  - Cubre respuesta API de error: `GET /api/no-existe`.
  - Cubre endpoint raw API: `GET /api/health`.
  - Verifica que `/` no reciba el header por estar fuera de `/api`.
