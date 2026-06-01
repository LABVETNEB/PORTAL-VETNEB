# PR: feat/report-workflow-unified-token-tracking

## 1. Rama
- `feat/report-workflow-unified-token-tracking`

## 2. Objetivo
- Unificar el seguimiento del informe/estudio para que la etapa actual y la alerta de tinción especial sean consistentes y visibles en admin, clínica y particular (sesión por token), sin romper seguridad ni aislamiento por rol.

## 3. Diagnóstico de fuente de verdad del workflow
- La fuente de verdad funcional para seguimiento ya existía en `study_tracking_cases` y en los endpoints:
  - Admin: `/api/admin/study-tracking`
  - Clínica: `/api/study-tracking`
  - Particular: `/api/particular/study-tracking/me`
- Se detectó superficie paralela en admin con `/api/admin/report-workflow` (flujo legacy/alterno) que divergía en naming y contrato de estados.
- No faltaron columnas para `currentStage` ni `specialStainRequired`.

## 4. Diagnóstico admin
- El visor de "Seguimiento de informes" consumía `report-workflow` en vez de `study-tracking`.
- La acción de etapa/tinción existía, pero sobre contrato distinto al utilizado por clínica/particular.
- Riesgo: desalineación semántica de estados mostrados respecto al resto de roles.

## 5. Diagnóstico clínica
- La tarjeta de últimos tokens no incorporaba la etapa real de seguimiento por token.
- No mostraba de forma consistente la alerta de tinción especial proveniente del tracking.
- Contrato clínico ya disponible para consulta scoped por clínica, faltaba consumirlo en UI.

## 6. Diagnóstico particular
- La sesión activa cargaba datos de autenticación/reportes, pero no mostraba de forma explícita la etapa actual del tracking.
- En caso sin informe vinculado quedaba mensaje genérico, sin reflejar el estado real del estudio.
- El endpoint particular de tracking ya existía, faltaba integrarlo en frontend.

## 7. Estados soportados
- Flujo unificado mostrado en frontend:
  1. `reception` → Recepción de muestra
  2. `processing` → Procesamiento
  3. `evaluation` → Evaluación
  4. `report_development` → Desarrollo de informe
  5. `delivered` → Informe disponible / Publicado
- La solicitud de tinción especial permanece como alerta separada (`specialStainRequired`), no como estado terminal.

## 8. Alerta de tinción especial
- Se mantiene lógica de alerta independiente y visible en los tres roles.
- Se presenta como "Solicitud de tinción especial" cuando `specialStainRequired = true`.
- Queda ubicada lógicamente entre evaluación y desarrollo de informe al no reemplazar la etapa actual ni el progreso.

## 9. Implementaciones aplicadas
- API frontend (`frontend/src/lib/api.ts`):
  - Nuevo helper `getParticularStudyTrackingCase()` con manejo de errores recuperables.
  - Nuevos contratos/helpers admin para `study-tracking`:
    - `AdminStudyTrackingSnapshot`
    - `AdminStudyTrackingUpdatePayload`
    - `AdminStudyTrackingUpdateResponse`
    - `getAdminStudyTrackingCases()`
    - `updateAdminStudyTrackingCase()`
  - Nuevos contratos/helpers clínica:
    - `ClinicStudyTrackingCaseSummary`
    - `ClinicStudyTrackingSnapshot`
    - `getClinicStudyTrackingCases()`
- Admin UI (`frontend/src/components/dashboard/AdminReportWorkflowViewerCard.tsx`):
  - Migra de `/api/admin/report-workflow` a `/api/admin/study-tracking`.
  - Conserva acciones de cambio de etapa y solicitar/resolver tinción especial con patch unificado.
  - Ajusta labels de etapa y copy para contrato unificado.
- Admin tokens (`frontend/src/app/dashboard/admin/AdminParticularTokensCard.tsx`):
  - Carga tracking por `particularTokenId` para cada token visible.
  - Muestra bloque "Seguimiento" con etapa + alerta de tinción especial.
- Clínica tokens (`frontend/src/components/dashboard/ClinicParticularTokensCard.tsx`):
  - Integra consulta `study-tracking` por token y renderiza etapa + alerta.
- Particular (`frontend/src/components/public/ParticularesContent.tsx`):
  - Carga tracking en sesión activa (login, check de sesión, cleanup en logout).
  - Muestra "Seguimiento del estudio" con etapa actual y alerta.
  - En casos sin informe vinculado muestra estado real cuando hay tracking.

## 10. Implementaciones descartadas por requerir DB/migration
- No se requirieron migrations ni cambios de schema para cumplir el objetivo.
- No se implementó alteración de tablas porque `currentStage` y `specialStainRequired` ya estaban disponibles en la fuente de verdad.

## 11. Archivos modificados
- `frontend/src/lib/api.ts`
- `frontend/src/components/dashboard/AdminReportWorkflowViewerCard.tsx`
- `frontend/src/app/dashboard/admin/AdminParticularTokensCard.tsx`
- `frontend/src/components/dashboard/ClinicParticularTokensCard.tsx`
- `frontend/src/components/public/ParticularesContent.tsx`
- `test/frontend-admin-report-workflow.test.ts`
- `test/frontend-admin-particular-tokens.test.ts`
- `test/frontend-dashboard-clinic-tokens.test.ts`
- `test/frontend-particulares-content.test.ts`

## 12. Tests agregados/reforzados
- `test/frontend-admin-report-workflow.test.ts`:
  - Ajuste de labels/contratos al flujo unificado de `study-tracking`.
- `test/frontend-admin-particular-tokens.test.ts`:
  - Cobertura de consumo de seguimiento por token y alerta.
- `test/frontend-dashboard-clinic-tokens.test.ts`:
  - Cobertura de visualización de etapa/alerta desde tracking clínico.
- `test/frontend-particulares-content.test.ts`:
  - Cobertura de estado y alerta en sesión particular activa.

## 13. Validaciones ejecutadas
- `pnpm test` ✅
- `pnpm validate:local` ✅
- `pnpm --dir frontend lint` ✅ (1 warning preexistente en `frontend/src/app/api/security/csp-report/route.ts`: unused eslint-disable)
- `pnpm --dir frontend typecheck` ✅
- `pnpm --dir frontend build` ✅

## 14. Riesgos residuales
- En tarjetas de tokens (admin/clínica) se hacen consultas de tracking por token listado (`N` requests para `N` tokens). Funcionalmente correcto; puede optimizarse luego con endpoint bulk si hiciera falta.
- Persiste endpoint legacy `/api/admin/report-workflow` en backend; ya no es la fuente consumida por esta UI, pero conviene planificar deprecación controlada para evitar regresiones futuras.
- Warning de lint no relacionado sigue vigente en ruta CSP.

## 15. Checklist manual
- [ ] Admin seguimiento de informes
- [ ] Admin últimos tokens
- [ ] Clínica últimos tokens
- [ ] Particular sesión activa
- [ ] Caso con alerta de tinción especial
- [ ] Caso sin informe vinculado
- [ ] Caso con informe publicado
