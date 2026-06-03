# PR 820 - API error request id body

## Resumen

Se agrego `requestId` a cuerpos JSON de error emitidos por `createFastifyApp` bajo `/api` y `/api/*`, reutilizando el `X-Request-ID` seguro introducido en PR 819.

El cambio no altera cuerpos de respuestas exitosas, no modifica mensajes de error existentes, no agrega stack traces y no toca DB schema, migraciones, indices, WebAuthn, frontend UI, CSP/frontend, assets estaticos ni logica de negocio.

## Superficie auditada

- `server/lib/api-request-id.ts`: validacion de ids entrantes, generacion segura con `crypto.randomUUID()`, `genReqId` de Fastify y aplicacion de `X-Request-ID`.
- `server/lib/api-response-security.ts`: delimitacion de superficie API con `/api` y `/api/*`.
- `server/fastify-app.ts`: hooks globales `onRequest` y `onSend`, `setNotFoundHandler`, `setErrorHandler`, `/`, `/health`, `/api/health` y registro de routers nativos.
- `server/routes/*.fastify.ts`: patrones de error con `success`, `error`, `message`, `details`, `code` y `statusCode` bajo rutas API.
- `server/middlewares/trusted-origin.ts`: error Fastify temprano de origen no permitido.
- `test/fastify-app.test.ts`: tests dinamicos de `createFastifyApp`, parsing con `JSON.parse(response.body)` y contratos existentes de `X-Request-ID`.
- `test/backend-api-nosniff-responses-contract.test.ts`: contratos estaticos de helpers API y ausencia de dependencias frontend/UI.

## Contrato aplicado

En respuestas API de error JSON producidas por `createFastifyApp`:

- El header `X-Request-ID` debe estar presente y no vacio.
- El body JSON debe incluir `requestId`.
- `body.requestId` debe coincidir exactamente con `X-Request-ID`.
- Si el request id entrante es valido, se conserva en header y body.
- Si el request id entrante es invalido, se usa el id seguro generado por `genReqId`.
- El contrato se aplica solo a respuestas con status `>= 400`, content type JSON y path `/api` o `/api/*`.
- Las respuestas exitosas API no reciben `requestId` en el body por este cambio.
- Las respuestas no API, HTML publico y assets estaticos quedan fuera del contrato.

## Implementacion

- `server/lib/api-request-id.ts`
  - Agrega `getSafeApiResponseRequestId(request, reply)`.
  - Lee el request id seguro desde `reply` cuando ya existe.
  - Si falta o no es seguro, reutiliza `request.id` validado o genera un UUID seguro.
  - Normaliza `X-Request-ID` en `FastifyReply` y `reply.raw` para mantener igualdad con el body.

- `server/fastify-app.ts`
  - Enriquece centralmente en `onSend` los payloads JSON de error API.
  - Mantiene intactos los formatos existentes y solo agrega o normaliza `requestId`.
  - No agrega datos internos ni modifica mensajes.

## Tests agregados o ajustados

- `test/fastify-app.test.ts`
  - Agrega helpers de contrato para validar que `body.requestId` coincide con `X-Request-ID`.
  - Ajusta errores tempranos de trusted origin para aceptar `requestId`.
  - Ajusta 404 API global para validar `requestId`.
  - Cubre error API generico `500` con `requestId`.
  - Cubre `X-Request-ID` entrante valido conservado en header y body.
  - Cubre `X-Request-ID` entrante invalido reemplazado por id seguro en header y body.
  - Cubre 404 publico API JSON con `requestId`.
  - Cubre respuesta exitosa API sin `requestId` agregado al body.

## Validaciones

- `pnpm test`
- `pnpm build`
- `pnpm security:public-surface`
- `pnpm typecheck`
- `pnpm typecheck:test`
- `git diff --check`
