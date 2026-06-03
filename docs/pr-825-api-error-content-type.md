# PR 825 - API error content-type contract

## Resumen

Se agrego una suite contractual enfocada para confirmar que las respuestas de error API/Fastify mantienen `Content-Type` JSON consistente, body parseable y el contrato vigente de `requestId`.

El cambio es tests/docs only: no modifica handlers de negocio, configuracion productiva, DB schema, migraciones, indices, WebAuthn, frontend UI, CSP/frontend, assets estaticos ni mensajes publicos.

## Superficie auditada

- `server/fastify-app.ts`: hooks globales, `setErrorHandler`, `setNotFoundHandler`, enriquecimiento `onSend` de errores API JSON y delimitacion de path.
- `server/lib/api-request-id.ts`: generacion, validacion y propagacion de `X-Request-ID` y `body.requestId`.
- `test/helpers/api-request-id-contract.ts`: helpers compartidos para parsear JSON y validar igualdad body/header.
- `test/api-request-id-observability-contract.test.ts`: contratos previos de request id en header, body y logs.
- `test/api-error-no-stack-traces-contract.test.ts`: contrato anti stack traces.
- `test/api-error-no-secrets-contract.test.ts`: contrato anti secretos.
- Tests existentes sobre `content-type`, `application/json`, errores 400/404/500 y trusted-origin.

## Contrato aplicado

En respuestas API de error:

- `Content-Type` debe incluir `application/json`.
- El body debe ser parseable como objeto JSON.
- El body debe conservar `requestId` cuando aplica.
- `X-Request-ID` debe coincidir con `body.requestId` cuando aplica.
- El body no debe exponer stack traces.
- El body no debe exponer secretos, tokens, cookies, passwords ni valores sensibles enviados por headers, payload o query string.
- La cobertura queda limitada a `/api` y no introduce dependencias frontend/UI.

## Tests agregados

- `test/api-error-content-type-contract.test.ts`
  - Cubre error API 500 generado por el error handler central.
  - Cubre error API 404 generado por el not-found handler central.
  - Cubre error API 400 controlado.
  - Cubre rechazo temprano de trusted-origin.
  - Cubre endpoint admin/protegido con `/api/admin/system/health`.
  - Cubre endpoint publico API con `/api/public/pricing`.
  - Reutiliza `assertBodyRequestIdMatchesHeader` para validar parseo JSON y coincidencia `X-Request-ID`/`body.requestId`.
  - Verifica ausencia de stack traces, secretos y dependencias frontend/UI.

## Validaciones

- `pnpm test`
- `pnpm build`
- `pnpm security:public-surface`
- `pnpm typecheck`
- `pnpm typecheck:test`
- `git diff --check`
