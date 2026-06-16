# Public Step Number Center Alignment

## Scope
Corrección de alineación de números circulares en steps/timelines públicos.

## Problem
Los números no estaban centrados respecto al bloque descriptivo de cada paso.

## Files changed
- `frontend/src/components/public/SpecimenJourneySection.tsx`
- `frontend/src/app/clinicas/page.tsx`
- `frontend/e2e/public-service-bento-specimen-journey.spec.ts`
- `frontend/e2e/public-clinics-b2b-operations.spec.ts`
- `IMPLEMENTATION_PUBLIC_STEP_NUMBER_CENTER_ALIGNMENT.md`

## Implementation
- Los badges se centran en desktop dentro del mismo ancho que usa el bloque de contenido.
- Las líneas horizontales se posicionan detrás de los badges y conectan el centro de columnas adyacentes.
- El flujo de clínicas usa un gap de grid uniforme en lugar de padding por step.
- Se mantienen sin cambios los layouts móviles en fila y sus líneas verticales.
- Se agregaron aserciones E2E que comparan el centro horizontal del badge con el centro del contenido.

## Visual acceptance
- Números centrados respecto al párrafo descriptivo.
- Aplicado en Recorrido de la muestra.
- Aplicado en Cómo opera tu clínica con VETNEB.

## Validation
- `pnpm --dir frontend lint`
- `pnpm --dir frontend typecheck`
- `pnpm --dir frontend build`
- Pruebas E2E focalizadas de recorrido de muestra y flujo de clínicas.

## Out of scope
- Sin cambios de copy.
- Sin rediseño.
- Sin cambios de colores.
- Sin cambios backend/dashboard.
