# PR: fix admin token-scoped report upload status

## Resumen
- La carga de informes del panel admin se movio desde el header global hacia cada token en "Ultimos tokens administrados".
- Cada token ahora abre `UploadReportModal` con clinica y token preconfigurados.
- El estado de seguimiento usa select con borrador local y boton individual "Actualizar estado".
- El vinculo y titulo del token usan nombre de clinica cuando esta disponible, con fallback seguro a `Clinica #id`.

## Archivos tocados
- `frontend/src/app/dashboard/admin/page.tsx`
- `frontend/src/app/dashboard/admin/AdminParticularTokensCard.tsx`
- `frontend/src/components/dashboard/UploadReportModal.tsx`
- `test/frontend-admin-particular-tokens.test.ts`
- `test/frontend-admin-report-workflow.test.ts`
- `test/frontend-dashboard-admin.test.ts`
- `test/frontend-report-actions.test.ts`
- `test/frontend-report-upload-modal.test.ts`
- `PR-fix-admin-token-scoped-report-upload-status.md`

## Implementacion realizada
- Se quito el boton operativo global del header "Carga de informes" y se dejo copy informativo.
- Se agrego accion visible por token: "Subir informe para este token".
- `UploadReportModal` ahora acepta `triggerLabel`, `presetClinic`, `presetParticularToken` y `onUploaded`.
- En modo preset, el modal no pide buscar clinica ni seleccionar token; muestra resumen read-only y envia `clinicId` + `particularTokenId` en `FormData`.
- Al subir desde token, se ejecuta `loadTokens` para refrescar badges y `reportId`.
- Se reutiliza la carga de clinicas via `getAdminUsersRoles` para resolver nombre por `clinicId`.
- Se agrego tracking de etapa por borrador local y PATCH solo al presionar "Actualizar estado".
- Se mantuvo la accion individual de solicitar/resolver tincion especial.

## Tests agregados/modificados
- Tests para accion de upload por token y presets del modal.
- Tests para `FormData` con `clinicId` y `particularTokenId` desde presets.
- Tests para vinculo con nombre de clinica y fallback.
- Tests para estado con select + boton individual.
- Tests actualizados para remover dependencia del modal global en `page.tsx`.

## Comandos ejecutados
- `pnpm --dir frontend typecheck`: PASS.
- Subconjunto frontend: PASS, 68/68.
- `pnpm typecheck`: PASS.
- `pnpm typecheck:test`: PASS.
- `pnpm test`: PASS, 2119 passed, 1 skipped, 0 failed.
- `pnpm build`: PASS, `dist/index.js` generado por esbuild.
- `pnpm security:public-surface`: PASS, sin hallazgos de exposicion publica; conserva dos findings informativos `server-only` en `frontend/src/middleware.ts`.

## Riesgos
- No se tocaron endpoints backend, auth, cookies, sesiones, roles, DB ni migraciones.
- La verificacion fue por typecheck y tests de contrato/runtime; no se ejecuto navegador visual.
- Si el catalogo de clinicas no trae nombre real, la UI cae al fallback `Clinica #id`.

## Rollback
- Revertir los archivos listados en "Archivos tocados".
- No hay migraciones ni cambios de datos que revertir.
- No se hizo `git add`, commit, push, PR ni merge.

## Estado final
- Implementacion completa.
- Validaciones obligatorias en verde.
- Cambios locales sin stagear.
