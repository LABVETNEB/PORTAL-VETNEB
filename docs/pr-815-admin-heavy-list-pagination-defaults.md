# PR 815 - Admin heavy list pagination defaults

## Resumen

Se auditaron listados admin que pueden crecer con el uso operativo y se reforzo la paginacion en backend sin tocar schema, migraciones, indices, WebAuthn ni UI.

Cambios aplicados:

- Helper backend `normalizeListPagination` con default conservador, max limit y max offset.
- Clamp backend en listadores compartidos usados por endpoints admin.
- `admin users roles` pagina las consultas DB antes de combinar usuarios admin y clinic.
- Tests de contrato para defaults, max limit, valores invalidos y consultas DB con limite.

## Defaults y limites

| Superficie | Default limit | Max limit | Offset |
| --- | ---: | ---: | --- |
| Listados admin generales | 50 | 100 | default 0, max backend 100000 |
| Admin report workflow | 20 | 20 en contrato HTTP | backend fetch max 21 para sentinel `hasMore` |
| Export admin audit | n/a | 10000 filas | offset 0 |
| Export failed login alerts | n/a | 10000 filas | offset 0 |

Valores invalidos se mantienen segun la convencion existente:

- Tokens/report access/study tracking: se normalizan a defaults.
- Clinics/sessions/users-roles/failed-login-alerts/report-workflow: la ruta rechaza query invalida con 400.
- En backend, los listadores normalizan de forma defensiva antes de llamar `.limit()` y `.offset()`.

## Endpoints auditados

| Endpoint | Estado |
| --- | --- |
| `GET /api/admin/audit-log` | Ya tenia default 50, max 100 y export max 10000. |
| `GET /api/admin/failed-login-alerts` | Ruta con default 50/max 100; backend ahora usa helper compartido. |
| `GET /api/admin/clinics` | Ruta con default 50/max 100; backend ahora usa helper compartido. |
| `GET /api/admin/sessions` | Ruta con default 50/max 100; backend ahora usa helper compartido y mantiene `fetchLimit`. |
| `GET /api/admin/users-roles` | Ruta con default 50/max 100; backend ahora limita consultas DB antes de combinar resultados. |
| `GET /api/admin/particular-tokens` | Ruta con default 50/max 100; backend compartido ahora clampa limit/offset. |
| `GET /api/admin/report-access-tokens` | Ruta con default 50/max 100; backend compartido ahora clampa limit/offset. |
| `GET /api/admin/study-tracking` | Ruta con default 50/max 100; backend compartido ahora clampa limit/offset. |
| `GET /api/admin/study-tracking/notifications` | Ruta con default 50/max 100; backend compartido ahora clampa limit/offset. |
| `GET /api/admin/report-workflow` | Default 20/max 20; backend clampa a max 21 por overfetch de `hasMore`. |
| `GET /api/admin/pricing` | Catalogo acotado; sin cambio de paginacion. |
| `GET /api/admin/reports/:id/preview-url` y `download-url` | No son listados. |
| Admin system health/schema/maintenance | No son listados pesados. |

## Tests agregados o ajustados

- `test/admin-heavy-list-pagination-contract.test.ts`
  - default limit/offset del helper.
  - max limit y max offset.
  - limit/offset invalidos.
  - listadores backend auditados usan `normalizeListPagination`.
  - `admin users roles` limita queries DB con `adminLimit/clinicLimit`.
- `test/admin-particular-tokens.fastify.test.ts`
  - `GET /api/admin/particular-tokens` aplica default 50/0 sin query params.
  - clampa `limit=999` a 100.
  - normaliza `limit=abc&offset=-2` a 50/0.

## Archivos de implementacion

- `server/lib/list-pagination.ts`
- `server/db-admin-clinics.ts`
- `server/db-admin-failed-login-alerts.ts`
- `server/db-admin-sessions.ts`
- `server/db-admin-users-roles.ts`
- `server/db-particular.ts`
- `server/db-report-access.ts`
- `server/db-study-tracking.ts`
- `server/db-report-workflow.ts`
- `test/admin-heavy-list-pagination-contract.test.ts`
- `test/admin-particular-tokens.fastify.test.ts`
