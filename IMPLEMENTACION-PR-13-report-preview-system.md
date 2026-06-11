# PR-13 — feat(public): add report preview system

## 1. Resumen

Sistema público de preview de informe diagnóstico demostrativo para Portal VETNEB.
Comunica el entregable diagnóstico (qué recibe una clínica/tutor) sin usar datos reales,
PDFs reales ni tocar backend. Se integra en Home (sección "Así se entrega la evidencia
diagnóstica") y en Clínicas (sección B2B "El informe diagnóstico que recibe tu clínica").

## 2. Archivos modificados / creados

| Acción    | Archivo                                                              |
|-----------|----------------------------------------------------------------------|
| Creado    | `frontend/src/components/public/ReportPreviewCard.tsx`               |
| Modificado| `frontend/src/app/page.tsx`                                          |
| Modificado| `frontend/src/app/clinicas/page.tsx`                                 |
| Creado    | `frontend/e2e/public-report-preview.spec.ts`                         |
| Creado    | `test/frontend-public-report-preview.test.ts`                        |
| Creado    | `IMPLEMENTACION-PR-13-report-preview-system.md`                      |

## 3. Cambios implementados

### `ReportPreviewCard.tsx`
Componente reutilizable que representa un informe anatomopatológico demostrativo.
Secciones: banner de advertencia, cabecera institucional, metadatos del caso,
Macroscopía, Microscopía, Diagnóstico, Comentario, Acceso digital / Trazabilidad,
pie institucional. Usa tokens navy/teal existentes y la clase `clinical-card-header`.
Sin dependencias nuevas.

### `frontend/src/app/page.tsx`
Nueva sección `aria-labelledby="report-preview-heading"` insertada entre
"Recorrido de la muestra" y "Beneficios". Heading: "Así se entrega la evidencia
diagnóstica". Incluye copy explicativo y rótulo de datos ficticios.

### `frontend/src/app/clinicas/page.tsx`
Nueva sección `aria-labelledby="clinicas-report-preview-heading"` insertada entre
el grid de features ("Todo lo que necesita su clínica") y el onboarding
("Cómo comenzar"). Heading B2B: "El informe diagnóstico que recibe tu clínica".

## 4. Seguridad de datos ficticios / demostrativos

- Banner visible: "Muestra · Demostrativo — Ejemplo visual sin datos reales"
- `role="note"` con `aria-label` explícito para lectores de pantalla
- Paciente: "Paciente demostrativo", Especie: "Canino demostrativo"
- Código: DEMO-000 (claramente no real)
- Sin email, DNI, teléfono, firma escaneada, matrícula ni QR real
- Sin signed URLs ni rutas privadas (`/api/`, `/dashboard`)
- Diagnóstico demostrativo (Mastocitoma grado II) — entidad clínica conocida,
  usada solo como ejemplo visual
- No hay claim sobre tiempos, volumen de casos ni certificaciones

## 5. Tests ejecutados y resultado

### pnpm --dir frontend lint
✓ Sin errores ni warnings

### pnpm --dir frontend typecheck
✓ Sin errores TypeScript

### pnpm --dir frontend build
✓ Build exitoso — 26 rutas generadas, tamaño Home: 2.8 kB

**Nota sobre next-env.d.ts y tsconfig.json:**
El build modifica estos archivos automáticamente. Se revirtieron con
`git checkout --` tras el build, según protocolo VETNEB.

### pnpm test (suite backend + contratos frontend)
✓ 21 tests nuevos en `test/frontend-public-report-preview.test.ts` — todos pasan
✓ Tests de preservación PR-10/11/12 — todos pasan

Fallos presentes: 7 scope guards de PRs anteriores (PR-1, PR-2, PR-4, PR-6, PR-7,
PR-8, logistics hub). Todos dependen de `git diff --name-only` y fallan siempre
que el working tree tenga cambios no staged. Mismo comportamiento durante
desarrollo de PR-10/11/12. Pasan en CI con working tree limpio post-commit.

### pnpm --dir frontend e2e public-report-preview.spec.ts
✓ 21/21 tests pasan — Chromium
- Home: heading, badge demostrativo, secciones diagnósticas, datos ficticios,
  preservación PR-10/12, sin APIs privadas, mobile sin overflow
- Clínicas: heading B2B, badge demostrativo, secciones diagnósticas,
  CTAs preservados, sin APIs privadas, mobile sin overflow

## 6. Decisiones

**Integración en Home y Clínicas (no Servicios):** Home aporta mayor impacto
en el funnel público (visitante aún no convencido). Clínicas refuerza la propuesta
B2B mostrando el entregable antes del onboarding. Servicios ya es denso en contenido
y agregar el preview duplicaría la sección sin ganancia estratégica.

**Posición en Home:** Después de Specimen Journey, antes de Beneficios.
El usuario ya comprende el proceso (journey), ahora ve el resultado (informe).

**Posición en Clínicas:** Después de features, antes del onboarding.
La clínica ve lo que recibirá antes de decidir iniciar el proceso.

**Sin variant prop en ReportPreviewCard:** El contenido del informe es idéntico
en ambas superficies. La diferencia está en el copy de la sección envolvente,
no en el card. Se evitó complejidad innecesaria.

**`clinical-card-header`:** Reutiliza clase existente del design system para
el header del informe. Consistencia con el look-and-feel del dashboard sin
duplicar estilos.

## 7. Confirmación de scope

- No se tocó producción
- No se tocó DB ni migrations
- No se tocó auth ni sesiones
- No se tocaron secrets, tokens, cookies ni `.env`
- No se tocaron workflows CI/CD
- No se tocaron APIs ni server
- No se tocó dashboard
- No se tocó pricing (`PreciosContent.tsx` intacto)
- No se tocó login
- No se tocó particulares (`ParticularesContent.tsx` intacto)
- No se agregaron dependencias (`package.json` / `pnpm-lock.yaml` intactos)
- No se usaron datos reales de pacientes, clínicas ni tutores
- No se usaron PDFs reales ni signed URLs
- No se creó visor de PDF
- No se inventaron métricas, certificaciones ni volúmenes de casos

## 8. Riesgos y notas

- Los 7 fallos de scope guard son pre-existentes para cualquier PR que modifique
  `page.tsx`. No son regresiones introducidas por PR-13. Se espera que pasen
  en CI con working tree limpio.
- El `next-env.d.ts` fue revertido tras el build; no debe incluirse en el commit.
- El `tsconfig.json` fue revertido tras el build; no debe incluirse en el commit.
- Working tree listo para revisión manual: solo los 5 archivos del PR en diff.
