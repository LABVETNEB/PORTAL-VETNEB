# PR: fix(report): apply workflow authority to tokens

## Rama
- `fix/report-token-workflow-authority`

## Preguntas previas (resueltas antes del cierre)
1. **¿Por qué los tokens mostraban “Sin seguimiento vinculado”?**
- Porque la UI de tokens consultaba `study_tracking_cases` por `particularTokenId`, pero no existía garantía backend de crear/vincular ese tracking en todos los flujos de token + upload.

2. **¿Se crea un `study_tracking_case` al generar token?**
- Ahora sí se asegura en creación de token (admin y clínica) vía helper canónico `ensureStudyTrackingCaseForToken`.

3. **Si no se crea, ¿existe endpoint/helper para ensure tracking by `particularTokenId`?**
- Sí. Se implementó `server/lib/token-study-tracking.ts` con `ensureStudyTrackingCaseForToken(...)` y soporte por token/report.

4. **¿El admin viewer lista por `study_tracking_cases` o por informes?**
- Por `study_tracking_cases` (flujo canónico de seguimiento).

5. **¿Tokens admin/clínica consultan tracking con el ID correcto?**
- Sí, por `particularTokenId` del token listado.

6. **¿El endpoint particular devuelve tracking real?**
- Sí. `particular-study-tracking` obtiene el tracking del token autenticado y expone estado real del caso.

7. **¿La subida de informe actualiza `currentStage` a `delivered`?**
- Sí. En `POST /api/admin/reports/upload` se fuerza cierre en `delivered` (por token vinculado o por `reportId`).

8. **¿`specialStainRequired` está asociado al caso/token correcto?**
- Sí. Queda en el `study_tracking_case` canónico y se replica en vistas admin/clínica/particular vía lectura del mismo caso.

9. **¿Clínica y particular son read-only?**
- Sí para workflow mutation: la ruta clínica `POST /api/study-tracking` ahora responde `403` (`Solo administración puede crear seguimientos`), y particular solo tiene endpoints GET.

10. **¿Hay riesgo de N requests excesivas?**
- Riesgo residual moderado en admin list/detail de tokens por `ensure` en lectura (mitigado con `Promise.all` en listado). Se documenta abajo.

## 1. Causa raíz de “Sin seguimiento vinculado”
- Existía desacople entre token y tracking: la vista esperaba `study_tracking_cases` por token, pero los flujos backend no aseguraban consistentemente ese vínculo al crear token o al subir informe.

## 2. Modelo correcto token → seguimiento
- Fuente canónica: `study_tracking_cases`.
- Clave de relación principal: `particularTokenId`.
- Fallback de conciliación: `reportId`.
- Helper central: `ensureStudyTrackingCaseForToken(...)`.

## 3. Autoridad de modificación (solo admin)
- Admin conserva mutación de workflow (`/api/admin/study-tracking` + cierre por upload admin).
- Ruta clínica de creación de tracking (`POST /api/study-tracking`) bloqueada con `403`.

## 4. Clínica read-only
- Clínica consume tracking por lectura (`GET /api/study-tracking...`), sin creación de casos desde su endpoint de workflow.

## 5. Particular read-only
- Particular consulta tracking del token autenticado (`/api/particular/study-tracking/me`) sin capacidades de mutación.

## 6. Tinción especial
- `specialStainRequired` permanece en el caso canónico y se visualiza en admin/clínica/particular sin bifurcar estado de etapa.

## 7. Upload de informe → Entrega
- `server/routes/admin-reports.fastify.ts` ahora acepta `particularTokenId` en multipart.
- Si hay token seleccionado:
  - vincula token↔report,
  - asegura/crea tracking,
  - cierra en `currentStage = "delivered"`.
- Si no hay token:
  - busca tracking por `reportId` y lo cierra en `delivered`.

## 8. Archivos modificados
- `server/lib/token-study-tracking.ts` (nuevo)
- `server/db-study-tracking.ts`
- `server/routes/admin-reports.fastify.ts`
- `server/routes/admin-particular-tokens.fastify.ts`
- `server/routes/particular-tokens.fastify.ts`
- `server/routes/study-tracking.fastify.ts`
- `frontend/src/components/dashboard/UploadReportModal.tsx`
- `test/admin-reports.fastify.test.ts`
- `test/admin-particular-tokens.fastify.test.ts`
- `test/particular-tokens.fastify.test.ts`
- `test/study-tracking.fastify.test.ts`
- `test/frontend-report-upload-modal.test.ts`
- `test/frontend-report-actions.test.ts`
- `test/clinic-management-route-policy.test.ts`
- `test/security-mutation-permission-surface.test.ts`
- `test/security-write-attribution-boundaries.test.ts`
- `test/fastify-app.test.ts`
- `test/report-write-surface-ownership.test.ts`

## 9. Tests agregados/reforzados
- `admin-reports.fastify.test.ts`:
  - validación `particularTokenId` inválido,
  - `particularTokenId` inexistente,
  - mismatch de clínica,
  - upload con token cierra tracking en `delivered`,
  - upload sin token cierra tracking por `reportId` en `delivered`.
- `study-tracking.fastify.test.ts`:
  - POST clínica bloqueado (`403`) por autoridad admin-only.
- Frontend tests del modal:
  - validan envío de `particularTokenId` en multipart,
  - eliminan expectativa de creación de tracking desde UI.
- Actualización de tests de seguridad/contrato para nuevo comportamiento admin-only.

## 10. Validaciones ejecutadas
- `pnpm test` ✅
- `pnpm validate:local` ✅
- `pnpm --dir frontend lint` ✅ (1 warning preexistente por `eslint-disable` no usado en `frontend/src/app/api/security/csp-report/route.ts`)
- `pnpm --dir frontend typecheck` ✅
- `pnpm --dir frontend build` ✅

## 11. Riesgos residuales
- En admin tokens list/detail se ejecuta `ensure` en lectura para autocorregir vinculación; esto puede aumentar llamadas por item en listados grandes.
- Se mantiene como tradeoff para consistencia inmediata del estado hasta introducir una estrategia de batch/prefetch específica.

## 12. Checklist manual
- [x] admin seguimiento de informes lista tokens/casos
- [x] admin cambia etapa
- [x] admin solicita tinción especial
- [x] clínica ve alerta
- [x] particular ve alerta
- [x] admin sube informe
- [x] clínica ve Entrega
- [x] particular ve Entrega/informe disponible

## 13. Notas de implementación
- Se eliminó la creación de tracking desde frontend en upload modal.
- El backend de upload quedó como punto de autoridad para cierre del workflow con informe.
