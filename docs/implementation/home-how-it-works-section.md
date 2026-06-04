# Home: sección Cómo funciona

## Objetivo

Agregar en la home pública una sección sobria y mobile-first que explique el flujo operativo crítico para clínicas y profesionales que trabajan con VETNEB: envío de muestra, análisis anatomopatológico y descarga del informe.

La sección mantiene a VETNEB como laboratorio primero, portal operativo segundo y red profesional verificada como contexto posterior.

## Archivo modificado

- `frontend/src/app/page.tsx`
- `test/frontend-home-page-content.test.ts`

## Ubicación de la sección

La sección `Cómo funciona` se ubicó inmediatamente después de `Servicios del laboratorio patológico veterinario` y antes de `Trabajo interdisciplinario y criterio diagnóstico`.

La home actual no contiene una sección desktop del Banco de Profesionales después de servicios; por eso la nueva sección se insertó en el punto equivalente del flujo público sin reordenar navegación ni otras áreas.

## Copy implementado

Título:

> Cómo funciona

Subtexto:

> Trabajar con VETNEB es simple: la muestra llega al laboratorio, se analiza con criterio anatomopatológico y el informe queda disponible en el portal.

Paso 1:

> Enviás la muestra

> Preparás la muestra según el protocolo de VETNEB y la enviás con los datos del caso y de la clínica.

Paso 2:

> VETNEB analiza

> El anatomopatólogo examina el tejido o la muestra citológica y elabora el informe diagnóstico.

Paso 3:

> Recibís el informe

> La clínica lo descarga directamente desde el portal. Si corresponde, el tutor del animal recibe acceso con un código privado.

CTA:

> Contactanos para empezar

## Pruebas agregadas

Se actualizó `test/frontend-home-page-content.test.ts` para confirmar:

- La home contiene el título `Cómo funciona`.
- La sección se ubica después de servicios y antes de beneficios.
- La definición de pasos contiene exactamente 3 títulos y 3 copies.
- Los pasos esperados se renderizan desde una única fuente de datos.
- La sección no incorpora los términos públicos prohibidos definidos para este alcance.
- Los contratos SEO/home existentes siguen cubiertos por los tests previos del mismo archivo.

## Validaciones ejecutadas

- `pnpm exec node --experimental-strip-types --experimental-specifier-resolution=node --test test/frontend-home-page-content.test.ts` - OK.
- `pnpm test` - OK, 2258 tests pasados y 1 skipped.
- `pnpm build` - OK.
- `pnpm security:public-surface` - OK, sin hallazgos de exposición pública de devtools.

Pendiente de autorización:

- `pnpm -C frontend build`: el frontend usa `next/font/google` en `frontend/src/app/layout.tsx`, por lo que el build puede requerir red para Google Fonts.

## Riesgos residuales

- No se ejecutó todavía el build frontend por la condición explícita de autorización de red para Google Fonts.
- La home no tiene actualmente una sección desktop del Banco de Profesionales ubicada después de servicios; la nueva sección quedó en el punto más cercano al blueprint sin reordenar secciones existentes.
