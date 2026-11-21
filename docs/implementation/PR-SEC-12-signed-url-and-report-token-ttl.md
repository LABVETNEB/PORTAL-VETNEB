# PR-SEC-12 — Cota de URLs firmadas y vencimiento obligatorio de tokens públicos de informe (SEC-10)

Estado base: `4dadfaf0` (`origin/main`). Scope: backend runtime (R2, configuración). Hallazgo SEC-10 de `docs/audit/AUDITORIA_SEGURIDAD_CAJA_BLANCA_ROADMAP_2026-11-11.md`, reconfirmado contra el código vigente (la numeración «PR-SEC-10/11» ya usada por otros PRs no es la de este hallazgo).

## Problema

- `SUPABASE_SIGNED_URL_EXPIRES_IN_SECONDS` no tenía cota superior: una configuración errónea emitía URLs firmadas de informes válidas por horas o días.
- Los tokens públicos de acceso a informes se creaban con `expiresAt = null` (clínica y administración) y quedaban utilizables hasta una revocación manual.

## Cambio

- `server/lib/env.ts`: `SUPABASE_SIGNED_URL_EXPIRES_IN_SECONDS` admite solo enteros 1–900 (`SIGNED_URL_MAX_EXPIRES_IN_SECONDS = 900`); sigue siendo opcional con default 900. Cero, negativo, fraccionario, no finito, no numérico o > 900 abortan el arranque con un mensaje que nombra la variable y no incluye valores sensibles. Vacío equivale a no configurado. No se trunca. `createSignedReportUrl` y `createSignedReportDownloadUrl` (preview y descarga) leen el mismo `ENV.signedUrlExpiresInSeconds`.
- `domain/report-access.ts`: `resolveReportAccessTokenExpiry(requested, nowMs)`, política única y pura para clínica y administración: omitido ⇒ 7 días; entre ahora (excluido) y 30 días (incluido) ⇒ aceptado; `null`, vencido, igual a ahora, inválido o > 30 días ⇒ 400. El reloj es el `now` ya inyectable de cada ruta.
- `report-access-token.ts`: el schema solo parsea fecha; la regla temporal vive en el dominio (antes comparaba contra `Date.now()` en el schema y aceptaba `null`/omitido como «sin vencimiento»).
- Rutas `POST /api/report-access-tokens` y `POST /api/admin/report-access-tokens`: aplican la política antes de tocar repositorios; `expiresAt` persistido nunca es `null`.

## Contrato HTTP

Se mantienen respuesta 201 y forma del cuerpo. Cambios: omitir `expiresAt` ahora produce vencimiento a 7 días; `expiresAt: null` o > 30 días responde 400 `{success:false,error}`. El frontend no crea estos tokens (sin consumidores de `expiresAt` de creación), por lo que no requiere cambios.

## No-alcance y riesgo residual

- Sin migración ni cambio de schema; sin acceso a bases de datos reales.
- **Tokens históricos con `expiresAt = null` siguen válidos** hasta su revocación manual: no se invalidan masivamente en este PR. Su inventario y revocación/migración requieren una operación R3 aparte.
- Revocar un token no invalida URLs firmadas ya emitidas; la exposición queda acotado a ≤ 900 s por la cota.
- Un despliegue con la variable > 900 fallará al arrancar: verificar el valor en el entorno antes de desplegar.

## Rollback

Revertir el squash commit del PR (sin datos ni schema que deshacer). Tokens creados bajo la nueva política conservan su `expiresAt` (≤ 30 días), compatible con el código anterior.

## Tests

`test/unit/infrastructure/env-db-pool.test.ts` (env en proceso aislado: default, válido, límite, > máximo, cero/negativo/fraccionario/inválido, sin filtrado de secretos), `test/unit/domain/report-access-token.test.ts` (política de dominio; estados histórico/vencido/revocado) y tres casos por superficie en `report-access-tokens.fastify.test.ts` y `admin-report-access-tokens.fastify.test.ts` con reloj fijo. Se realineó el payload de los tests de creación existentes (`2099` ya no es válido). Revocado, vencido y token de otra clínica en acceso público siguen cubiertos por `public-report-access.fastify.test.ts`.
