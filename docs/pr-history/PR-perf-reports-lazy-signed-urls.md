# PR: perf(reports): lazy signed URLs

## Resumen
- Elimina generación eager de `previewUrl` y `downloadUrl` en payloads internos de reportes.
- Mantiene `hasFile` como indicador seguro para frontend.
- Mantiene endpoints bajo demanda `preview-url` y `download-url` para Ver informe / Descargar.
- Mantiene intacto el flujo público/particular `public-report-access`, donde las URLs firmadas son parte del contrato.

## Archivos tocados
- server/routes/reports.fastify.ts
- server/routes/admin-reports.fastify.ts
- server/routes/reports-status.fastify.ts
- test/reports.fastify.test.ts
- test/admin-reports.fastify.test.ts
- test/reports-status.fastify.test.ts
- test/auth-authorization-integration.fastify.test.ts
- test/report-write-surface-ownership.test.ts

## Implementación
- `reports.fastify.ts`: los listados `/api/reports` y `/api/reports/search` ahora serializan con `serializeSafeReport`.
- `admin-reports.fastify.ts`: la respuesta de upload admin ya no embebe URLs firmadas eager.
- `reports-status.fastify.ts`: la respuesta de actualización de estado ya no embebe URLs firmadas eager.
- Los endpoints dedicados `preview-url` y `download-url` siguen generando URLs firmadas bajo demanda.

## Tests
- Actualizados contratos para confirmar ausencia de `previewUrl` / `downloadUrl` eager.
- Se mantiene `hasFile`.
- Se mantiene bloqueo de `storagePath` en payloads.
- Se conserva el flujo de endpoints bajo demanda.

## Comandos ejecutados
- node --experimental-strip-types --experimental-specifier-resolution=node --test test/reports.fastify.test.ts test/admin-reports.fastify.test.ts test/reports-status.fastify.test.ts test/auth-authorization-integration.fastify.test.ts test/report-write-surface-ownership.test.ts
- pnpm typecheck
- pnpm typecheck:test
- pnpm test
- pnpm build
- pnpm security:public-surface
- pnpm --dir frontend lint
- pnpm --dir frontend typecheck

## Resultados
- Tests dirigidos: PASS
- pnpm typecheck: PASS
- pnpm typecheck:test: PASS
- pnpm test: PASS, 2145 pass, 0 fail
- pnpm build: PASS
- pnpm security:public-surface: PASS
- pnpm --dir frontend lint: PASS con 1 warning preexistente en `frontend/src/app/api/security/csp-report/route.ts`
- pnpm --dir frontend typecheck: PASS
- No se ejecutó `pnpm --dir frontend build` por restricción de red/Google Fonts.

## Riesgos
- Bajo: el frontend ya usa endpoints bajo demanda para Ver informe y Descargar.
- Bajo: `public-report-access` no se modifica.
- Bajo: no cambia auth, cookies, CORS, CSRF, CSP, DB schema ni índices.

## Rollback
- Revertir el commit del PR.
- Eso restauraría `previewUrl` / `downloadUrl` eager en payloads internos.

## Estado final
- Validación local completa en PASS.
- Sin cambios de schema.
- Sin migraciones.
- Sin cambios de seguridad/autenticación.
