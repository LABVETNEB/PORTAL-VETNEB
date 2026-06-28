# PR 822 - API request id observability contracts

## Resumen

Se consolido en una suite contractual dedicada la observabilidad de `X-Request-ID` agregada en PR 819, PR 820 y PR 821.

El cambio es tests/docs only: no modifica handlers de negocio, configuracion productiva, DB schema, migraciones, indices, WebAuthn, frontend UI, CSP/frontend ni contratos visuales. Los asserts de request id que ya vivian en `test/fastify-app.test.ts` se movieron a un helper compartido de test para evitar repetir la misma validacion.

## Invariantes cubiertos

1. Toda respuesta API relevante expone `X-Request-ID` no vacio.
2. Errores API JSON incluyen `body.requestId`.
3. `body.requestId` coincide exactamente con `X-Request-ID`.
4. Logs de errores API incluyen el mismo `requestId`.
5. `X-Request-ID` entrante valido se preserva en header, body y log.
6. `X-Request-ID` entrante invalido con caracteres peligrosos se reemplaza por un id seguro.
7. Los logs capturados no incluyen `Authorization`, `Cookie`, tokens, passwords ni secretos enviados en request.
8. Respuestas API exitosas no agregan `requestId` al body.
9. Superficie fuera de `/api` no recibe `X-Request-ID` ni `body.requestId`.
10. La superficie de request id API no introduce dependencia frontend/UI.

## Tests agregados o ajustados

- `test/helpers/api-request-id-contract.ts`
  - Centraliza asserts de `X-Request-ID`, parsing JSON object, igualdad `body.requestId`/header, ausencia de `requestId` en bodies exitosos y validacion del payload de log `[API ERROR]`.

- `test/fastify-app.test.ts`
  - Reutiliza el helper compartido en vez de mantener asserts inline duplicados.
  - Mantiene la cobertura dinamica existente de trusted origin, errores API y headers de seguridad.

- `test/api-request-id-observability-contract.test.ts`
  - Agrega una suite especifica para los contratos de observabilidad API request id.
  - Cubre un endpoint publico API (`/api/public/pricing`).
  - Cubre un endpoint admin/protegido (`/api/admin/system/health`).
  - Cubre error API 404, error generico 500 y error admin 401.
  - Cubre `X-Request-ID` entrante valido preservado.
  - Cubre `X-Request-ID` entrante invalido reemplazado.
  - Cubre headers y payload sensibles presentes en el request sin filtrarse al log.
  - Cubre respuesta exitosa API sin `body.requestId`.
  - Cubre respuesta fuera de `/api` sin contrato request id API.
  - Cubre ausencia de imports frontend/UI en la superficie backend relevante.

## Validaciones

- `pnpm test`
- `pnpm build`
- `pnpm security:public-surface`
- `pnpm typecheck`
- `pnpm typecheck:test`
- `git diff --check`
