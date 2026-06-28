# PR 823 - API error no stack traces

## Resumen

Se agrego una suite contractual enfocada para confirmar que las respuestas de error API emitidas por `createFastifyApp` no exponen stack traces.

El cambio es tests/docs only: no modifica backend productivo, DB schema, migraciones, indices, WebAuthn, frontend UI, CSP/frontend, assets estaticos ni contratos visuales.

## Invariantes cubiertos

1. Un error API 500 no expone `error.stack` ni el mensaje interno sensible en el body.
2. Un error API 400 conserva el mensaje publico esperado sin agregar `stack`, `stackTrace` ni `trace`.
3. Las respuestas de error API mantienen `requestId` en body y `X-Request-ID` mediante el contrato existente.
4. La traza contaminada artificialmente no aparece como frame, ruta de archivo ni nombre de funcion en el body.

## Tests agregados

- `test/api-error-no-stack-traces-contract.test.ts`
  - Registra rutas de contrato bajo `/api/__contract/*`.
  - Fuerza errores con `error.stack` contaminado.
  - Verifica respuestas 500 y 400.
  - Reutiliza el helper de request id para mantener el contrato de observabilidad existente sin duplicarlo.

## Validaciones

- `pnpm test`
- `pnpm build`
- `pnpm security:public-surface`
- `pnpm typecheck`
- `pnpm typecheck:test`
- `git diff --check`
