# PR: fix(admin): hard delete particular tokens and disable autocomplete

## Skills Claude utilizadas

- `vetneb-security-production-invariants`
  - Uso: validar privacidad, hard delete de tokens particulares, eliminación de sesiones asociadas por FK cascade, no exposición de `tokenHash`/`tokenLast4`, y ausencia de logs nuevos con token.

- `vetneb-admin-dashboard-operational-actions`
  - Uso: corregir comportamiento del dashboard admin, acción de eliminar token, actualización del listado y mensajes de UI.

- `vetneb-protocolos-comunicacion`
  - Uso: revisar contrato HTTP `DELETE`, compatibilidad legacy `PATCH /revoke`, CORS/OPTIONS y status codes.

- `vetneb-bugs-errores-optimizacion-rutas`
  - Uso: diagnosticar tokens inactivos persistentes, rutas admin particular tokens y autocomplete/autofill en formularios.

- `vetneb-staff-senior-full-stack-engineer`
  - Uso: implementar backend, frontend y tests con scope mínimo.

## Diagnóstico

- `revokeParticularToken(id)` hacía soft-delete con `isActive=false`, por lo que el token quedaba en servidor y seguía visible como inactivo.
- El listado admin podía seguir mostrando tokens inactivos.
- Los formularios de generación de tokens permitían sugerencias/autocomplete del navegador.

## Cambios realizados

- Se agregó `deleteParticularToken(id)` para borrar físicamente tokens particulares.
- Se agregó endpoint `DELETE /api/admin/particular-tokens/:tokenId`.
- `PATCH /api/admin/particular-tokens/:tokenId/revoke` queda como alias legacy, pero ahora ejecuta hard delete.
- La respuesta de eliminación devuelve `deletedTokenId` y no devuelve detalle completo del token eliminado.
- El frontend admin usa `deleteAdminParticularToken` y muestra terminología de eliminación.
- La UI remueve el token eliminado del listado.
- Se desactivó autocomplete en formularios sensibles de tokens particulares admin y clínica.
- Se mantuvo el marker `app.options("/:tokenId", optionsHandler)` y se agregó `DELETE` a `access-control-allow-methods`.

## Archivos modificados

- `server/db-particular.ts`
- `server/routes/admin-particular-tokens.fastify.ts`
- `frontend/src/lib/api.ts`
- `frontend/src/app/dashboard/admin/AdminParticularTokensCard.tsx`
- `frontend/src/components/dashboard/ClinicParticularTokensCard.tsx`
- `test/admin-particular-tokens.fastify.test.ts`
- `test/frontend-admin-particular-tokens.test.ts`

## Validación

```powershell
node --experimental-strip-types --experimental-specifier-resolution=node --test test/architecture/security/security-critical-route-surface-registry.test.ts
node --experimental-strip-types --experimental-specifier-resolution=node --test test/admin-particular-tokens.fastify.test.ts
node --experimental-strip-types --experimental-specifier-resolution=node --test test/frontend-admin-particular-tokens.test.ts
pnpm test
pnpm build
```

Resultado local:

```txt
pnpm test: 1975 pass / 0 fail / 1 skipped
pnpm build: OK
```

## Riesgos

- Medio: cambia semántica de revocación a hard delete. Se conserva `PATCH /revoke` como alias legacy para compatibilidad.
- Bajo: `particular_sessions` asociadas se eliminan por FK `ON DELETE CASCADE`.
- Bajo: autocomplete depende del navegador; el portal ahora declara `autoComplete="off"` en formularios sensibles, pero historiales ya guardados por el navegador no pueden borrarse desde el servidor.

## Evidencia de invariante

- Token eliminado desaparece del servidor mediante hard delete.
- El listado admin ya no muestra tokens eliminados.
- Las sesiones particulares asociadas quedan invalidadas por cascade.
- La respuesta de eliminación no devuelve `tokenHash` ni `tokenLast4`.
- No se usa `Token inactivo` en la tarjeta admin.
- Formularios sensibles de token tienen `autoComplete="off"`.
- No se tocaron email, Gmail API, refresh token, dominio propio, variables reales de producción ni auth sessions/cookies.
