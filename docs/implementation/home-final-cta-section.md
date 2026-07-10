# Home: sección CTA final

## Objetivo

Agregar una sección final sobria en la home pública para mejorar la conversión de clínicas y profesionales que llegaron al cierre de la página, manteniendo a VETNEB como laboratorio diagnóstico y portal operativo.

La sección sigue `docs/product/vetneb-platform-blueprint.md`: cierre institucional, fondo de contraste azul profundo, dos CTAs y sin formulario inline.

## Archivo modificado

- `frontend/src/app/page.tsx`
- `test/frontend-home-page-content.test.ts`

## Ubicación de la sección

La sección `CTA final` quedó cerca del final de la home, después de `Trabajo interdisciplinario y criterio diagnóstico`, reutilizando el cierre público existente sin mover navegación ni secciones previas.

## Copy implementado

Headline:

> Empezá a trabajar con VETNEB

Subtítulo:

> Conocé los servicios diagnósticos o contactanos para coordinar el envío de muestras.

## CTAs implementados

- `Contactanos` -> `/contacto`
- `Ver servicios` -> `/servicios`

No se agregó formulario inline ni copy asociado a marketplace, ranking, reviews, estrellas, telemedicina o reservas online.

## Pruebas agregadas

Se actualizó `test/frontend-home-page-content.test.ts` para confirmar:

- La home renderiza `Empezá a trabajar con VETNEB`.
- La sección final renderiza los CTAs `Contactanos` y `Ver servicios`.
- Los CTAs usan las rutas públicas `ROUTES.contacto` y `ROUTES.servicios`, respaldadas por `/contacto` y `/servicios`.
- La sección final contiene exactamente dos `PublicRouteControl`.
- La sección final no contiene formulario inline, inputs, textareas ni `react-hook-form`.
- La sección final no introduce las palabras prohibidas del alcance.
- Los contratos existentes de home siguen cubiertos por el mismo archivo de tests.

## Validaciones ejecutadas

- `pnpm exec node --experimental-strip-types --experimental-specifier-resolution=node --test test/frontend-home-page-content.test.ts` - OK, 8 tests pasados.
- `pnpm exec node --experimental-strip-types --experimental-specifier-resolution=node --test test/unit/ui/frontend/frontend-visual-consistency.test.ts` - OK, 14 tests pasados.
- `pnpm test` - OK, 2259 tests pasados y 1 skipped.
- `pnpm build` - OK.
- `pnpm security:public-surface` - OK, sin exposición pública de devtools. Mantiene 2 findings `server-only` existentes en `frontend/src/middleware.ts` para nombres de cookies de sesión.
- `pnpm -C frontend build` - OK, Next.js compiló y generó 26 páginas estáticas.

## Riesgos residuales

- El CTA final usa copy estático; si cambia el modelo operativo de contacto o servicios, habrá que actualizar esta sección y sus tests.
- El build frontend usa `next/font/google`; se ejecutó con autorización explícita por el posible acceso de red.
