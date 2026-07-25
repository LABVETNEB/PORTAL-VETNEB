# Public Report Access error path redaction hotfix

## Baseline

- Repositorio: `LABVETNEB/PORTAL-VETNEB`.
- Rama: `fix/security-public-report-access-error-path-redaction`.
- HEAD base: `7297be2b031e18b77164bf0ea610654cd9ba4ea6`.
- Naturaleza: hotfix R2 de seguridad autorizado por Nico.

## Objetivo

Evitar que una credencial incluida en el path de Public Report Access aparezca
en `response.path` cuando el handler global transforma un fallo interno en una
respuesta HTTP.

## Alcance incluido

- `server/fastify-app.ts`.
- Evidencia ejecutable conjunta en
  `test/security/token-access-enumeration-disclosure-regression.test.ts`.
- Este documento.

## Alcance excluido

No se modifican autenticación, cookies, sesiones, CORS, rate limits, schema,
migraciones, dependencias, frontend, CI ni runtime ajeno al handler global de
errores. M36 y Reports Phase I no se inician.

## Estado previo y hallazgo

`public-report-access.fastify.ts` ya sanitizaba el path en logs mediante
`sanitizeUrlForLogs`. Sin embargo, `getFastifyErrorResponsePath` construía el
campo `path` desde `request.url` sin esa sanitización.

Una excepción de repository o storage en
`GET /api/public/report-access/:token` producía:

- status `500`;
- mensaje público genérico;
- `path` con el token raw.

El token no aparecía en el mensaje genérico, pero su presencia en `path`
seguía siendo exposición de una credencial.

## Cambio

`getFastifyErrorResponsePath` aplica el sanitizador canónico antes de extraer
el pathname. Para Public Report Access, el contrato resultante es:

```text
/api/public/report-access/[REDACTED]
```

El cambio no altera status codes, bodies funcionales, autenticación, orden de
side effects ni políticas de rate limit.

## Evidencia

La matriz ejecutable cubre:

- Particular Access missing y foreign clinic indistinguibles;
- selectores hostiles subordinados al `clinicId` autenticado;
- redacción de token raw/hash y errores internos;
- Report Access público malformed, missing, revoked, expired y cross-clinic
  con `404` genérico;
- unavailable con `409`;
- acceso exitoso;
- fallos de repository y storage con `500`, mensaje genérico y path redactado;
- rate limit antes de parse/hash/lookup;
- conteo y orden de record-access, signed URLs y audit.

## Seguridad y riesgo residual

El hotfix reutiliza una función existente y no introduce una segunda regla de
redacción. El riesgo residual es que futuras credenciales incorporadas a otros
paths deban registrarse también en el sanitizador canónico. No se afirma
evidencia de staging, producción, DB real ni RLS.

## Rollback

Revertir únicamente la importación de `sanitizeUrlForLogs` y su aplicación en
`getFastifyErrorResponsePath`. Ese rollback reabriría la exposición y no debe
realizarse sin una alternativa equivalente.

## Validaciones

- `pnpm exec node --experimental-strip-types --test
  test/security/token-access-enumeration-disclosure-regression.test.ts`:
  `PASSED` (4/4).
- `pnpm exec node --experimental-strip-types --test
  test/integration/adapters/controllers/public-report-access.fastify.test.ts`:
  `PASSED` (7/7).
- `pnpm exec node --experimental-strip-types --test
  test/integration/app/fastify-app.test.ts`: `PASSED` (26/26).
- `pnpm validate:local`: corridas preliminares `FAILED` por tipado incompleto
  del fixture nuevo y luego por un test de workflow transitorio. Corregido el
  fixture, el test de workflow pasó dirigido 7/7 y la corrida final quedó
  `PASSED` con typecheck, typecheck:test, 3725 tests aprobados, un skip previsto
  y build.
- `pnpm security:public-surface`: `PASSED`.
- `pnpm audit --prod` y `pnpm audit`: `NOT_RUN`; no se modificaron
  dependencias ni lockfiles.
- Playwright, migraciones y frontend build: `NOT_RUN`; fuera del alcance.

## Estado final

Hotfix local implementado y validado sobre el baseline indicado. M35b se
preserva como evidencia y no inicia M36 ni Reports Phase I.
