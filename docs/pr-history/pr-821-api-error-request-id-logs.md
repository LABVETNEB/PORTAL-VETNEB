# PR 821 - API error request id logs

## Resumen

Se agrego `requestId` al log estructurado `[API ERROR]` emitido por el `setErrorHandler` central de `createFastifyApp`, reutilizando el request id seguro ya creado por PR 819 y agregado al body JSON de errores API por PR 820.

El cambio mantiene el formato publico de respuesta igual salvo el `requestId` ya existente en errores API, no agrega stack traces a respuestas, no toca DB schema, migraciones, indices, WebAuthn, frontend UI, CSP/frontend, assets estaticos ni logica de negocio.

## Superficie auditada

- `server/lib/api-request-id.ts`: validacion de `X-Request-ID` entrante, generacion segura con `crypto.randomUUID()`, `genReqId`, aplicacion del header y helper `getSafeApiResponseRequestId`.
- `server/fastify-app.ts`: hooks globales `onRequest` y `onSend`, `setNotFoundHandler`, `setErrorHandler`, rutas `/`, `/health`, `/api/health` y registro de routers nativos.
- `server/middlewares/error-handler.ts`: middleware legado con `[API ERROR]`, fuera del handler Fastify central modificado.
- `server/middlewares/request-logger.ts`: patron de logging de requests y sanitizacion de URLs con tokens.
- `server/routes/*.fastify.ts`: patrones existentes de `console.error`, `console.warn`, `console.log` y uso de `request.id`.
- `test/fastify-app.test.ts`: contratos dinamicos de errores API, `X-Request-ID`, body JSON con `requestId` y captura manual de `console.error`.
- `test/fastify-only-guardrail.test.ts`: guardrails de runtime backend sin Express directo ni dependencias frontend/UI.

## Contrato aplicado

En errores API manejados por `createFastifyApp`:

- El header `X-Request-ID` debe estar presente y no vacio.
- El body JSON de error debe incluir `requestId`.
- El log `[API ERROR]` debe incluir el mismo `requestId`.
- Si `X-Request-ID` entrante es valido, se conserva en header, body y log.
- Si `X-Request-ID` entrante es invalido, no se refleja; se usa y se loguea el id seguro generado.
- Los logs nuevos no incorporan headers, cookies, authorization, passwords ni tokens del request.
- Las respuestas API exitosas no generan logs de error nuevos.
- Las respuestas no API, HTML publico y assets estaticos quedan fuera del contrato de request id API.

## Implementacion

- `server/fastify-app.ts`
  - El `setErrorHandler` obtiene `requestId` mediante `getSafeApiResponseRequestId(request, reply)`.
  - Ese helper reutiliza primero el header seguro ya fijado en `reply`; si falta, usa `request.id` validado o genera un UUID seguro.
  - El payload de `console.error("[API ERROR]", ...)` agrega solo `requestId` cuando existe para la superficie API.
  - No se agregan datos del request, headers, cookies, authorization, payloads ni campos sensibles al log.

## Tests agregados o ajustados

- `test/fastify-app.test.ts`
  - Agrega helpers para serializar capturas de consola y validar payloads `[API ERROR]`.
  - Cubre error API generico `500` con `requestId` logueado.
  - Verifica que el `requestId` logueado coincide con `X-Request-ID` y `body.requestId`.
  - Cubre `X-Request-ID` entrante valido conservado en header, body y log.
  - Cubre `X-Request-ID` entrante invalido reemplazado por id seguro en header, body y log.
  - Verifica que el log no incluya authorization, cookies, passwords ni tokens enviados en el request.
  - Verifica que una respuesta API exitosa no agregue logs de error.

- `test/fastify-only-guardrail.test.ts`
  - Agrega guardrail estatica para confirmar que `server/fastify-app.ts` no introduce dependencias frontend/UI, Next o React.

## Validaciones

- `pnpm test`
- `pnpm build`
- `pnpm security:public-surface`
- `pnpm typecheck`
- `pnpm typecheck:test`
- `git diff --check`
