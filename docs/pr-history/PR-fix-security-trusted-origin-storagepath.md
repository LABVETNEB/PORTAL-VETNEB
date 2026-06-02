# PR fix/security-trusted-origin-storagepath

## Resumen

Este PR aplica el alcance PR-A de seguridad:

- Refuerza `trusted-origin` como control global para mutaciones Fastify.
- Bloquea mutaciones sin `Origin`/`Referer` cuando viajan con cookies de sesion conocidas.
- Mantiene permitidas las mutaciones sin `Origin`/`Referer` solo para clientes sin cookie de sesion.
- Elimina `storagePath` de payloads publicos/privados de reportes.
- Expone `hasFile` como indicador seguro para acciones de preview/download.
- Conserva signed URLs como unica superficie para acceder a archivos.

No se tocaron fuentes, configuracion de `next/font`, despliegue, ni logica ajena a trusted-origin/CSRF y payloads de reportes.

## Archivos tocados

- `server/middlewares/trusted-origin.ts`
- `server/fastify-app.ts`
- `server/lib/reports.ts`
- `server/lib/report-access-token.ts`
- `server/lib/particular-token.ts`
- `server/routes/reports.fastify.ts`
- `server/routes/reports-status.fastify.ts`
- `server/routes/admin-reports.fastify.ts`
- `frontend/src/types/index.ts`
- `frontend/src/components/dashboard/ReportDownloadButton.tsx`
- `frontend/src/app/dashboard/informes/page.tsx`
- `frontend/src/app/dashboard/admin/page.tsx`
- `scripts/smoke/smoke-upload.mjs`
- Tests de backend, frontend contracts, smoke contracts y guardrails de seguridad relacionados.

## Implementacion realizada

### Trusted origin / CSRF

- `requireTrustedOrigin` ahora centraliza el analisis de `Origin` y `Referer`.
- `Origin` tiene prioridad sobre `Referer`.
- Un `Origin` invalido o no permitido bloquea la mutacion aunque exista `Referer`.
- Metodos inseguros (`POST`, `PUT`, `PATCH`, `DELETE`) con cookie de sesion conocida y sin `Origin`/`Referer` responden `403`.
- Metodos inseguros sin `Origin`/`Referer` siguen permitidos cuando no hay cookies de sesion conocidas.
- Se agrego `requireTrustedOriginForFastify`.
- `createFastifyApp` registra el hook global con `app.addHook("onRequest", requireTrustedOriginForFastify)`.
- La respuesta de bloqueo mantiene contrato estable: `{ success: false, error: "Origen no permitido" }`.

### Reportes sin `storagePath`

- Se agrego `serializeSafeReport(report)` como serializador seguro.
- Las respuestas de reportes conservan campos publicos de estado y archivo:
  - `status`
  - `currentStatus`
  - `fileName`
  - `hasFile`
- `storagePath` queda solo como dato interno para firmar preview/download.
- Public access, token access, particular token detail, clinic reports y admin reports usan serializacion segura.
- La auditoria de upload admin ya no guarda `storagePath` en metadata.

### Frontend y smoke

- El tipo `Report` elimina `storagePath` y agrega `hasFile`.
- `ReportDownloadButton` decide disponibilidad con `hasFile`.
- La pagina de informes pasa `report.hasFile`.
- El dashboard admin suma `storage` al guard de metadata sensible.
- El smoke de upload valida `report.hasFile === true` y signed URLs, sin imprimir ni resolver rutas de storage.

## Tests agregados o reforzados

- Unit tests de `trusted-origin` para:
  - mutaciones sin origin/referer y sin cookie.
  - mutaciones sin origin/referer y con cookie de sesion.
  - prioridad de `Origin` sobre `Referer`.
  - origin invalido.
  - ausencia de logs con cookies o tokens.
- Test de `createFastifyApp` para confirmar hook global antes de rutas mutables.
- Guardrail de produccion para exigir import y registro de `requireTrustedOriginForFastify`.
- Tests de serializers y rutas para verificar que no sale `storagePath` y si sale `hasFile`.
- Tests frontend para confirmar que las acciones de archivo usan `hasFile`.
- Tests de audit metadata y smoke local actualizados al nuevo contrato.

## Comandos ejecutados

| Comando | Resultado |
| --- | --- |
| `pnpm --dir frontend build` | Bloqueado localmente. `next/font` intento descargar `Inter` y `Source Sans 3` desde Google Fonts; sin red permitida fallo con `EACCES`. No se pidio ni se habilito red despues de la instruccion explicita. |
| `pnpm typecheck` | OK. |
| `pnpm typecheck:test` | OK. |
| `pnpm test` | OK. 2142 pass, 0 fail. |
| `pnpm build` | OK. Genero `dist/index.js` (`878.9kb`). |
| `pnpm security:public-surface` | OK. PASS sin findings de exposicion publica. Nota: `.next/static` no existe porque el build frontend local quedo bloqueado; reporta markers `[server-only]` esperados en `frontend/src/middleware.ts`. |
| `pnpm --dir frontend lint` | OK con warning no relacionado: unused eslint-disable en `frontend/src/app/api/security/csp-report/route.ts:177`. |
| `pnpm --dir frontend typecheck` | OK. |
| `node --experimental-strip-types --experimental-specifier-resolution=node --test test\fastify-app.test.ts` | OK. 23 pass, 0 fail. |
| `git diff --check` | OK. Solo warnings LF/CRLF en archivos frontend. |

## Validacion alternativa frontend sin red

Como `pnpm --dir frontend build` depende de descarga de Google Fonts durante `next build`, la validacion local sin red se cubrio con:

- `pnpm --dir frontend lint`
- `pnpm --dir frontend typecheck`
- contratos frontend incluidos en `pnpm test`

El build frontend completo debe ejecutarse en CI/Render/GitHub Actions donde la red para Google Fonts este permitida, o en una validacion posterior autorizada.

## Riesgos

- El bloqueo global de trusted-origin cambia el comportamiento de mutaciones con cookies de sesion y sin `Origin`/`Referer`; esto es intencional para cerrar CSRF.
- Clientes no-browser autenticados con cookies que no manden `Origin`/`Referer` deberan adaptarse o usar un flujo sin cookie de sesion.
- `hasFile` reemplaza la inferencia frontend basada en `storagePath`; los consumidores externos que dependian de `storagePath` deben migrar.
- `pnpm security:public-surface` no pudo auditar assets compilados de `.next/static` localmente porque el build frontend sin red no se completo.

## Rollback

Para revertir este PR:

- Quitar el hook `requireTrustedOriginForFastify` de `server/fastify-app.ts`.
- Revertir `server/middlewares/trusted-origin.ts` al control previo por ruta.
- Quitar `serializeSafeReport` y restaurar serializers anteriores.
- Restaurar `storagePath` en tipos y contratos frontend si se necesitara volver al contrato anterior.
- Revertir tests y smoke contracts asociados.

## Estado final

- Cambios implementados en la rama `fix/security-trusted-origin-storagepath`.
- Validaciones principales de backend y contratos pasan.
- Build frontend local documentado como bloqueado por descarga de Google Fonts sin red.
- No se hizo `git add`.
- No se hizo commit.
- No se hizo push.
- No se creo PR.
- No se hizo merge.
