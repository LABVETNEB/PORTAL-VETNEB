# PR 816 - Admin no-store sensitive responses

## Resumen

- Se centralizo el header defensivo de cache en `server/lib/sensitive-response-cache.ts`.
- `createFastifyApp()` mantiene el hook global `onSend` y delega alli la aplicacion de `Cache-Control: no-store`.
- La politica existente queda limitada a API no publica: rutas `/api/*` salvo `/api/public/*`.
- No se tocaron DB schema, migraciones, indices, frontend, WebAuthn ni logica de negocio.

## Rutas auditadas

| Superficie | Prefijos revisados | Resultado |
| --- | --- | --- |
| Admin auth | `/api/admin/auth` | Cubierta por hook global. |
| Admin audit | `/api/admin/audit-log` | Cubierta por hook global. |
| Admin listados sensibles | `/api/admin/failed-login-alerts`, `/api/admin/sessions`, `/api/admin/users-roles`, `/api/admin/clinics`, `/api/admin/particular-tokens`, `/api/admin/report-access-tokens`, `/api/admin/study-tracking` | Cubiertas por hook global. |
| Admin informes/workflow | `/api/admin/reports`, `/api/admin/report-workflow` | Cubiertas por hook global. |
| Admin sistema | `/api/admin/system/health`, `/api/admin/system/maintenance`, `/api/admin/system/schema-health` | Cubiertas por hook global. |
| Auth clinica | `/api/auth`, `/api/clinic/audit-log`, `/api/clinic/profile` | Cubiertas por hook global. |
| Auth particular | `/api/particular/auth`, `/api/particular/audit-log`, `/api/particular/study-tracking`, `/api/particular-tokens` | Cubiertas por hook global. |
| Informes/tokens clinica | `/api/reports`, `/api/report-access-tokens`, `/api/study-tracking` | Cubiertas por hook global. |
| Logistica autenticada | `/api/logistics/field-visits`, `/api/logistics/route-plans`, `/api/logistics/route-events`, `/api/logistics/sla` | Cubiertas por hook global. |
| Publicas | `/api/public/pricing`, `/api/public/professionals`, `/api/public/report-access` | No se modifican por este PR. |

## Headers aplicados

- `Cache-Control: no-store` en respuestas API no publicas cuando el handler no declaro su propio `Cache-Control`.
- `Pragma: no-cache` no se agrego: no hay patron backend compatible para respuestas API, solo usos de `Expires` en cookies/logout.
- `Expires: 0` no se agrego por la misma razon.

## Tests

- `test/backend-api-no-store-cache-contract.test.ts`
  - Valida el helper centralizado y la clasificacion de rutas sensibles.
  - Verifica que `fastify-app.ts` delega el hook `onSend` al helper.
  - Verifica que rutas admin/autenticadas criticas no setean `Cache-Control` propio.
  - Verifica que `public-pricing` conserva cache publica propia.
  - Verifica que no se introduce dependencia de frontend/UI.
- `test/fastify-app.test.ts`
  - Verifica `Cache-Control: no-store` en `/api/admin/auth/me`.
  - Verifica `Cache-Control: no-store` en `/api/admin/system/health` con respuesta 200.
  - Verifica `Cache-Control: no-store` en `/api/admin/failed-login-alerts` con respuesta 200 de listado.
  - Verifica que `/api/public/professionals/search` no recibe `no-store` global.
  - Verifica que `/api/public/pricing` conserva `public, max-age=60, stale-while-revalidate=300`.
