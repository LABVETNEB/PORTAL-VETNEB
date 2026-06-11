# PR-15 — feat(public): finalize institutional consistency QA

## 1. Resumen

Auditoría técnica de superficies públicas post-PR-14. Se eliminó el único remanente de contenido simulado (`ReportPreviewCard.tsx`), se fortaleció la cobertura de tests de contrato institucional y se confirmó que Home, /clinicas, /servicios y /precios son 100% institucionales sin contenido demo visible.

## 2. Auditoría realizada

### Páginas auditadas

| Página | Términos demo buscados | Resultado |
|---|---|---|
| `frontend/src/app/page.tsx` | DEMOSTRATIVO, DEMO-*, Paciente demostrativo, ReportPreviewCard, etc. | Limpio |
| `frontend/src/app/clinicas/page.tsx` | Ídem | Limpio |
| `frontend/src/app/servicios/page.tsx` | Ídem | Limpio |
| `frontend/src/components/public/PreciosContent.tsx` | Ídem | Limpio |

### Componentes auditados

| Componente | Resultado |
|---|---|
| `ClinicOperationsSection.tsx` | Limpio — solo layout, datos recibidos como props |
| `SpecimenJourneySection.tsx` | En scope indirecto — datos legítimos de protocolo real |
| `ReportPreviewCard.tsx` | Contenía DEMOSTRATIVO, DEMO-000, Paciente demostrativo — **eliminado** |

### Ocurrencias de "muestra" en páginas públicas

Todas las ocurrencias son terminología científica legítima (muestras biológicas, especímenes): `Enviás la muestra`, `recorrido de la muestra`, `fijación de la muestra`, etc. No son contenido demo.

## 3. Archivos modificados / creados / eliminados

### Eliminado
- `frontend/src/components/public/ReportPreviewCard.tsx`

### Reescrito
- `test/frontend-public-report-preview.test.ts` — Eliminados tests que verificaban la estructura interna del componente (ya no existe). Agregado test que confirma la no-existencia del archivo. Ampliados scope guards a servicios y precios. Preservados todos los tests de contenido preservado (PR-10/12/14).

### Modificados (tests agregados)
- `test/frontend-home-page-content.test.ts` — +1 test: no-demo guard
- `test/frontend-clinicas-page-content.test.ts` — +1 test: no-demo guard
- `test/frontend-servicios-page-content.test.ts` — +1 test: no-demo guard
- `test/frontend-precios-page-content.test.ts` — +1 test: no-demo guard
- `frontend/e2e/public-report-preview.spec.ts` — +1 test.describe block para /servicios (no-demo + private API + mobile overflow)

### Creado
- `IMPLEMENTACION-PR-15-public-institutional-consistency-qa.md` (este archivo)

## 4. Remanentes demo/simulados detectados y resolución

| Remanente | Ubicación | Resolución |
|---|---|---|
| `DEMOSTRATIVO`, `DEMO-000`, `Paciente demostrativo`, `Canino demostrativo`, `Ejemplo visual sin datos reales` | `ReportPreviewCard.tsx` | Eliminado el archivo completo |

No se detectaron remanentes en páginas públicas renderizadas.

## 5. Estado de ReportPreviewCard

**Decisión: ELIMINADO.**

Motivo: el componente no estaba importado en ninguna página pública (`grep -rni "ReportPreviewCard" frontend/src` devolvió únicamente el propio archivo). Su único uso era en `test/frontend-public-report-preview.test.ts`, donde los tests verificaban la estructura interna del componente. Al eliminar el componente, esos tests ya no tienen objeto. Se reemplazaron por un test que confirma la no-existencia del archivo y por scope guards más amplios.

Riesgo de eliminar: bajo. El archivo no generaba ningún output visible en el sitio y no era importado desde ningún módulo activo.

## 6. Tests ejecutados

### Unit tests (pnpm test)
- `test/frontend-public-report-preview.test.ts` — reescrito, todos los tests nuevos deben pasar
- `test/frontend-home-page-content.test.ts` — guard adicional
- `test/frontend-clinicas-page-content.test.ts` — guard adicional
- `test/frontend-servicios-page-content.test.ts` — guard adicional
- `test/frontend-precios-page-content.test.ts` — guard adicional

### Build / lint / typecheck
- `pnpm --dir frontend lint`
- `pnpm --dir frontend typecheck`
- `pnpm --dir frontend build`
- `pnpm test`

### E2E (si se ejecuta)
- `frontend/e2e/public-report-preview.spec.ts` — ampliado con servicios page
- `frontend/e2e/public-clinics-b2b-operations.spec.ts` — sin cambios, ya cubre no-demo para /clinicas
- `frontend/e2e/public-service-bento-specimen-journey.spec.ts` — sin cambios, ya cubre servicios e home

## 7. Confirmación de scope

- No se tocó producción, DB, auth, secrets, workflows, APIs/server, dashboard funcional.
- No se tocó pricing API, login funcional, particulares funcional.
- No se agregaron dependencias.
- No se usaron datos reales, PDF real, screenshots reales ni signed URLs.
- `frontend/next-env.d.ts` no modificado.
- `package.json` / lockfile no modificados.
- No se inventaron métricas, certificaciones, tiempos ni volumen de casos.

## 8. Riesgos y notas

- La eliminación de `ReportPreviewCard.tsx` es irreversible vía git (recuperable con `git checkout`). El componente no tenía uso productivo.
- Los tests de `test/frontend-public-report-preview.test.ts` ahora incluyen `existsSync` para verificar ausencia del archivo. Si por alguna razón el archivo vuelve a existir, el test fallará como scope guard.
- El e2e de servicios no cubre /precios porque la página de precios carga datos dinámicos desde la API pública y requeriría servidor corriendo. Los guards de precios están cubiertos a nivel unit test.
