# PR 819 - API request id responses

## Resumen

Se agrego `X-Request-ID` a respuestas Fastify bajo `/api` y `/api/*`, reutilizando `request.id` de Fastify con generacion segura cuando no hay un id entrante valido.

No se tocaron schema de DB, migraciones, indices, WebAuthn, frontend UI, CSP/frontend, assets estaticos ni logica de negocio.

## Superficie auditada

- `server/fastify-app.ts`: configuracion `Fastify({ logger: false, trustProxy })`, hook global temprano `onRequest`, `requireTrustedOriginForFastify`, handlers globales de 404/error, `/`, `/health` y `/api/health`.
- `server/lib/api-response-security.ts`: helper central de PR 817/818 para headers API bajo `/api` y `/api/*`, con escritura en `FastifyReply` y `reply.raw`.
- `server/lib/sensitive-response-cache.ts`: helper backend existente para `Cache-Control: no-store` en API sensible.
- `server/routes/*.fastify.ts`: rutas nativas registradas bajo `/api/admin/*`, `/api/auth`, `/api/clinic/*`, `/api/particular/*`, `/api/public/*`, `/api/report-access-tokens`, `/api/reports`, `/api/study-tracking` y `/api/logistics/*`.
- `server/lib/audit.ts`, `server/lib/http-types.ts` y rutas admin/clinic/particular de auditoria: ya consumian `request.id` como request id para auditoria.
- `node_modules/fastify/docs/Reference/Server.md` y tipos Fastify locales: Fastify provee `request.id`, `genReqId` y `requestIdHeader`; `requestIdHeader` no valida el valor entrante.
- `test/backend-api-nosniff-responses-contract.test.ts` y `test/fastify-app.test.ts`: contratos existentes de headers API, endpoints publicos, autenticados, errores y respuestas raw.

## Decision

- Se reutiliza el `request.id` nativo de Fastify como fuente del header.
- Se configura `genReqId` con `generateFastifyRequestId` para aceptar `X-Request-ID` entrante solo si cumple formato seguro.
- No se usa `requestIdHeader` porque Fastify no valida ese valor.
- Si el header entrante falta, viene duplicado o no cumple formato seguro, se genera un UUID con `crypto.randomUUID()`.
- El formato aceptado queda limitado a 1-128 caracteres `[A-Za-z0-9._:-]`, sin espacios, saltos de linea ni caracteres de control.

## Header aplicado

- `X-Request-ID: <request.id seguro>`

El header se aplica desde el hook central `onRequest` solo cuando el path es `/api` o empieza con `/api/`. El helper escribe en `FastifyReply` y `reply.raw` para conservar cobertura en respuestas que terminan con `reply.raw.end`, como `/api/health`.

## Implementacion

- `server/lib/api-request-id.ts`: nuevo helper backend para validar ids entrantes, generar fallback seguro, configurar `genReqId` y aplicar `X-Request-ID`.
- `server/fastify-app.ts`: conecta `genReqId: generateFastifyRequestId` y aplica `applyApiRequestIdHeader(request, reply)` en el hook temprano existente antes de cortes tempranos.

## Tests agregados o ajustados

- `test/backend-api-nosniff-responses-contract.test.ts`
  - Cubre constantes de `X-Request-ID`.
  - Cubre validacion de formato seguro.
  - Cubre preservacion de request id entrante valido y reemplazo de invalido.
  - Verifica que Fastify use `genReqId` y no `requestIdHeader`.
  - Verifica que no se introduzca dependencia frontend/UI.
- `test/fastify-app.test.ts`
  - Cubre endpoint admin/autenticado: `GET /api/admin/system/health`.
  - Cubre endpoint API publico: `GET /api/public/pricing`.
  - Cubre respuesta API de error: `GET /api/no-existe`.
  - Cubre endpoint raw API: `GET /api/health`.
  - Cubre preservacion de `X-Request-ID` entrante valido.
  - Cubre reemplazo de `X-Request-ID` entrante invalido.
  - Verifica que `/` no reciba `X-Request-ID` por estar fuera de `/api`.
