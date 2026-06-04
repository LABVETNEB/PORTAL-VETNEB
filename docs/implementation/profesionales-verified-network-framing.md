# Banco de Profesionales como red verificada

## Objetivo

Alinear el copy publico de `/profesionales` con `docs/product/vetneb-platform-blueprint.md`: VETNEB se presenta primero como laboratorio, luego como portal operativo, y el Banco de Profesionales como una red verificada de clinicas y profesionales que trabajan con VETNEB.

## Archivo modificado

- `frontend/src/components/public/ProfesionalesSearchContent.tsx`
- `frontend/src/app/profesionales/page.tsx`
- `frontend/src/lib/seo.ts`
- `test/frontend-profesionales-page-content.test.ts`
- `test/frontend-public-page-semantics.test.ts`
- `test/frontend-public-page-ctas.test.ts`
- `test/frontend-public-page-metadata.test.ts`
- `test/frontend-public-seo-contract.test.ts`
- `test/frontend-public-professionals-scalable-directory.test.ts`

## Copy anterior

Hero visible:

> Red de profesionales veterinarios

> Banco publico de profesionales vinculados a VETNEB, con busqueda directa, clara y optimizada para coordinar derivaciones e interconsultas con datos verificables.

Bloque de consulta:

> Buscar profesionales

> Ingrese texto libre, incluso una sola letra. La busqueda admite coincidencias por nombre, especialidad, servicios, localidad, pais, email, telefono o descripcion, y facilita la coordinacion profesional con trazabilidad de contacto.

## Copy nuevo

Hero visible:

> Clínicas y profesionales verificados que trabajan con VETNEB.

> Cada ficha forma parte de una red vinculada al laboratorio y se muestra bajo criterios operativos verificables, no por ranking comercial.

Bloque de consulta:

> Consultar la red verificada

> Ingrese texto libre, incluso una sola letra. La consulta admite coincidencias por nombre, especialidad, servicios, localidad, pais o descripcion para ubicar perfiles institucionales dentro de la red VETNEB.

Metadata publica:

> Clínicas y Profesionales Verificados VETNEB

> Clínicas y profesionales verificados que trabajan con VETNEB dentro de una red vinculada al laboratorio.

## Por que se evita lenguaje marketplace/directorio

El Banco no debe comunicar busqueda comercial de veterinarios, posicionamiento pago, rankings, reseñas, reservas ni telemedicina. El nuevo texto enfatiza relacion con el laboratorio, verificacion operativa y fichas institucionales dentro de una red VETNEB.

La unica negacion visible conservada es "no por ranking comercial", porque aclara el criterio operativo sin convertir la pagina en una lista de exclusiones.

## Pruebas agregadas

- `/profesionales` renderiza el framing de red verificada.
- El copy menciona que clinicas y profesionales trabajan con VETNEB.
- El copy visible evita lenguaje de marketplace/directorio comercial.
- El listado compacto no expone email, telefono ni direccion completa.
- El detalle aislado por `clinicId` conserva su contrato.
- La busqueda conserva `q`, `limit`, `offset`, helper y endpoints publicos existentes.
- La UI publica no expone `storagePath`, `signedUrl`, `token`, `cookie`, `session` ni `service_role`.

## Validaciones ejecutadas

- `pnpm test`: OK, 2260 tests passing y 1 skipped.
- `pnpm build`: OK, backend bundle generado en `dist/index.js`.
- `pnpm security:public-surface`: OK, sin public devtools exposure findings. Mantiene dos findings `server-only` existentes en `frontend/src/middleware.ts` para `CLINIC_SESSION_COOKIE_NAME` y `ADMIN_SESSION_COOKIE_NAME`.
- `pnpm -C frontend build`: pendiente de autorizacion para red, porque `frontend/src/app/layout.tsx` usa `next/font/google`.

## Riesgos residuales

- El endpoint publico mantiene el contrato de busqueda existente. Este cambio no reduce ni amplia campos de backend; solo ajusta copy y guardrails source-level.
- La pagina sigue teniendo formulario de consulta porque la funcionalidad actual de busqueda permanece vigente.

## Confirmacion de alcance

No se cambio elegibilidad del Banco de Profesionales, backend ni API publica. No se modifico `/api/public/professionals`, detalle por `clinicId`, precios, home, particulares, dashboard ni auth.
