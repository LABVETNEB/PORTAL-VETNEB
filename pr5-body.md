## Objetivo

Implementar PR5: `report_access_tokens` para acceso público a reportes por token, con expiración, revocación, contador de accesos y endpoint público seguro.

## Alcance

### Base de datos
- nueva lógica para `report_access_tokens`
- soporte para:
  - `token_hash`
  - `token_last4`
  - `expires_at`
  - `revoked_at`
  - `access_count`
  - `last_access_at`
  - `created_by_clinic_user_id`
  - `created_by_admin_user_id`
  - `revoked_by_clinic_user_id`
  - `revoked_by_admin_user_id`

### Backend
- rutas clínica:
  - `POST /api/report-access-tokens`
  - `GET /api/report-access-tokens`
  - `GET /api/report-access-tokens/:tokenId`
  - `PATCH /api/report-access-tokens/:tokenId/revoke`
- rutas admin:
  - `POST /api/admin/report-access-tokens`
  - `GET /api/admin/report-access-tokens`
  - `GET /api/admin/report-access-tokens/:tokenId`
  - `PATCH /api/admin/report-access-tokens/:tokenId/revoke`
- ruta pública:
  - `GET /api/public/report-access/:token`

### Seguridad
- token persistido hasheado
- no se expone token en logs
- acceso público limitado a reportes `ready` o `delivered`
- tokens expirados o revocados devuelven `410`

### Tests
- tests para helpers de token
- tests para sanitización de logger

## Archivos principales

### Nuevos
- `drizzle/migrations/0014_report_access_tokens.sql`
- `drizzle/migrations/meta/0014_snapshot.json`
- `server/db-report-access.ts`
- `server/lib/report-access-token.ts`
- `server/routes/report-access-tokens.routes.ts`
- `server/routes/admin-report-access-tokens.routes.ts`
- `server/routes/public-report-access.routes.ts`
- `test/report-access-token.test.ts`
- `test/request-logger.test.ts`

### Modificados
- `.github/workflows/backend-ci.yml`
- `CHANGELOG.md`
- `drizzle/migrations/meta/_journal.json`
- `drizzle/schema.ts`
- `package.json`
- `server/app.ts`
- `server/middlewares/request-logger.ts`

### Operativos de reconciliación / smoke
- `reconcile-report-access-tokens-runtime.mjs`
- `smoke-pr5-report-access-tokens.ps1`

## Validación

### Checks
- `pnpm typecheck` ✅
- `pnpm test` ✅
- `pnpm build` ✅

### Smoke manual
- login clínica OK
- reporte `ready` seleccionado
- token público creado
- listado y detalle OK
- acceso público OK
- `accessCount` incrementado
- revocación OK
- reintento devuelve `410`

## Riesgos / notas
- se detectó una deriva legacy en `report_access_tokens` en la base real
- se agregó reconciliación operativa para normalizar instalaciones con esquema híbrido
- siguiente fase recomendada: consolidar esa reconciliación en migración formal sin residuos legacy

## Resultado
PR5 lista para revisión y merge.