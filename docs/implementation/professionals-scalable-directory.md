# Banco de Profesionales publico escalable

## Problema resuelto

La busqueda publica de profesionales mostraba el perfil completo dentro de cada resultado. Esa experiencia no escala para miles de clinicas porque cada item repetia datos de detalle y contacto en el listado.

Este cambio separa el banco publico en dos superficies:

- Listado liviano con cards compactas por perfil.
- Detalle aislado por `clinicId` en `/profesionales/[clinicId]`.

## Archivos modificados

- `frontend/src/components/public/ProfesionalesSearchContent.tsx`
- `frontend/src/components/public/ProfesionalDetailContent.tsx`
- `frontend/src/app/profesionales/[clinicId]/page.tsx`
- `frontend/src/lib/api.ts`
- `frontend/src/lib/public-professionals.ts`
- `test/frontend-profesionales-page-content.test.ts`
- `test/frontend-native-link-preview-contract.test.ts`
- `test/frontend-public-page-semantics.test.ts`
- `test/frontend-public-seo-contract.test.ts`
- `test/frontend-public-professionals-scalable-directory.test.ts`

## Arquitectura UI/listado/detalle

El listado sigue usando `/api/public/professionals/search` con `limit` y `offset`, pero renderiza solo avatar, nombre, localidad, badge de perfil verificado y un resumen breve de especialidades/servicios. Ya no pinta `aboutText`, email, telefono, direccion ni mapa en cada resultado.

Cada card usa `clinicId` como `key` e identidad de navegacion. La ruta se construye con `buildProfessionalDetailHref(clinicId)` y abre `/profesionales/[clinicId]`.

El detalle usa `getPublicProfessional(parsedClinicId)` contra `/api/public/professionals/:clinicId`. El estado vive dentro de `ProfesionalDetailContent`, se invalida por `clinicId`, y no depende del array del listado ni de estado global compartido.

## Avatar fallback

Si `avatarUrl` existe, se muestra con `next/image` y alt `Logo o avatar de ...`.

Si no existe, se muestra un fallback local estable con icono `BriefcaseMedical`, clase `professional-avatar-fallback` y `aria-hidden="true"`. No se agregaron URLs externas nuevas para el fallback.

## Pruebas agregadas

Se agrego `test/frontend-public-professionals-scalable-directory.test.ts` con cobertura para:

- Listado compacto con nombre, avatar/fallback, localidad, verificacion y resumen.
- Ausencia de datos completos de contacto/detalle en el listado.
- Fallback local sin avatar.
- Navegacion desde card hacia detalle por `clinicId`.
- Aislamiento con dos clinicas similares y datos exclusivos.
- Contrato de seguridad UI/API publica contra filtrado de paths privados, tokens, cookies y scripts inline.

Tambien se actualizaron contratos existentes de SEO, semantica publica y links externos para reflejar que email, telefono y mapa viven en el detalle.

## Validaciones ejecutadas

- `pnpm test`: OK, 2256 tests passing.
- `pnpm build`: OK, backend bundle generado.
- `pnpm -C frontend build`: OK. El primer intento sin red fallo por descarga de Google Fonts en `next/font`; se reejecuto con permiso de red y paso.
- `pnpm security:public-surface`: OK, sin public devtools exposure findings. Mantiene dos findings `server-only` existentes en `frontend/src/middleware.ts` para nombres de cookies de sesion.

## Riesgos residuales

- El endpoint de busqueda sigue serializando los campos completos porque ese contrato ya existia; la UI publica ya no los renderiza en el listado. Una optimizacion futura podria agregar un DTO de listado mas chico en backend sin cambiar elegibilidad.
- El detalle muestra `displayName` como responsable/perfil porque no hay un campo publico separado de responsable en el modelo actual.
