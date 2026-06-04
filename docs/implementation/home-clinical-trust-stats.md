# Home: sección Confianza clínica

## Objetivo

Agregar en la home pública una sección sobria, mobile-first y no comercial que refuerce la autoridad clínica de VETNEB como laboratorio de anatomía patológica veterinaria especializado.

La sección mantiene la jerarquía definida en `docs/product/vetneb-platform-blueprint.md`: laboratorio primero, portal operativo segundo y red profesional verificada como contexto institucional.

## Archivo modificado

- `frontend/src/app/page.tsx`
- `test/frontend-home-page-content.test.ts`

## Ubicación de la sección

La sección `Confianza clínica` se ubicó inmediatamente después del hero, dentro de `public-soft-canvas`, y antes del bloque móvil `Red de profesionales veterinarios` y de `Servicios del laboratorio patológico veterinario`.

Esta ubicación refuerza primero el carácter de laboratorio y diagnóstico, antes de presentar servicios o red profesional.

## Textos implementados

Título:

> Confianza clínica

Intro:

> Diagnóstico microscópico riguroso para la medicina veterinaria, con portal operativo e información pública como soporte del trabajo clínico.

Dato institucional 1:

> Diagnóstico histopatológico y citológico

> Evaluación microscópica de tejidos y muestras celulares con criterio anatomopatológico veterinario.

Dato institucional 2:

> Informes digitales con acceso seguro

> Entrega institucional de informes para clínicas y acceso privado por caso cuando corresponde.

Dato institucional 3:

> Red de clínicas y profesionales vinculados

> Relación operativa con equipos veterinarios que trabajan con VETNEB para sus diagnósticos.

Dato institucional 4:

> Precios públicos y comunicación directa

> Información clara para coordinar muestras, consultas y estudios sin ambigüedad operativa.

## Por qué no se usaron métricas numéricas

El blueprint menciona datos institucionales en formato stat, pero este alcance pide explícitamente no inventar métricas numéricas. Por eso la sección usa datos cualitativos verificables desde el producto actual: tipos de diagnóstico, entrega segura de informes, red vinculada y precios públicos.

No se agregaron claims como cantidad de clínicas, cantidad de casos, años de experiencia, rankings ni volúmenes de informes porque no hay una fuente institucional validada para sostenerlos en la home pública.

## Pruebas agregadas

Se actualizó `test/frontend-home-page-content.test.ts` para confirmar:

- La home contiene el título `Confianza clínica`.
- La sección se ubica antes del bloque móvil de profesionales y antes de servicios.
- Se renderizan los 4 datos institucionales esperados.
- La fuente de datos contiene exactamente 4 títulos y 4 descripciones.
- No se incorporan palabras prohibidas: `marketplace`, `ranking`, `reviews`, `estrellas`, `telemedicina`.
- No se incorporan claims numéricos no verificados como `+100`, años de experiencia, cantidad de clínicas, profesionales, casos o informes.
- Los contratos existentes de home siguen cubiertos por los tests previos del mismo archivo.

## Validaciones ejecutadas

- `pnpm exec node --experimental-strip-types --experimental-specifier-resolution=node --test test/frontend-home-page-content.test.ts` - OK, 8 tests pasados.
- `pnpm test` - OK, 2259 tests pasados y 1 skipped.
- `pnpm build` - OK, backend bundle generado en `dist/index.js`.
- `pnpm security:public-surface` - OK, sin hallazgos de exposición pública de devtools. Mantiene 2 findings `server-only` existentes en `frontend/src/middleware.ts` para nombres de cookies de sesión.
- `pnpm -C frontend build` - OK, Next.js compiló y generó 26 páginas estáticas.

## Riesgos residuales

- La sección usa datos cualitativos estáticos; si VETNEB decide publicar métricas reales en el futuro, deberán venir de una fuente validada y actualizarse junto con tests.
- El build frontend usa `next/font/google`; en esta validación se ejecutó con autorización explícita para permitir el acceso de red necesario.
