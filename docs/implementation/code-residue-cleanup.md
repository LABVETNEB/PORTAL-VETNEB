# Limpieza de residuos de codigo

## Objetivo

Eliminar residuos tecnicos posteriores a los PRs #829, #830 y #831 sin cambiar comportamiento funcional del producto.

## Residuos encontrados

- Import no usado de `Suspense` en `test/frontend-profesionales-page-content.test.ts`.
- Imports duplicados desde `@/lib/seo` en `frontend/src/app/profesionales/page.tsx`.
- Literal repetido de headers expuestos para `429` de login rate-limit en las rutas de auth clinic, admin y particular.
- Literales repetidos del mismo contrato de headers en tests de auth.

## Archivos modificados

- `frontend/src/app/profesionales/page.tsx`
- `server/lib/login-rate-limit.ts`
- `server/routes/admin-auth.fastify.ts`
- `server/routes/auth.fastify.ts`
- `server/routes/particular-auth.fastify.ts`
- `test/admin-auth.fastify.test.ts`
- `test/auth.fastify.test.ts`
- `test/frontend-profesionales-page-content.test.ts`
- `test/login-rate-limit.test.ts`
- `test/particular-auth.fastify.test.ts`

## Que se elimino y por que era seguro

- Se elimino un import muerto en un test que solo leia archivos fuente y no usaba React en runtime.
- Se unificaron dos imports consecutivos desde el mismo modulo SEO sin cambiar el render ni el JSON-LD de `/profesionales`.
- Se centralizo el valor de `access-control-expose-headers` de login rate-limit en `LOGIN_RATE_LIMIT_EXPOSED_HEADERS`.
- Los tests de auth ahora comparan contra la constante compartida, y `test/login-rate-limit.test.ts` mantiene fijo el valor exacto del contrato HTTP.

## Que no se toco deliberadamente

- No se modifico `/precios`, su cache local, sus estados vacios ni su mensaje de error real.
- No se modifico `/profesionales`, su elegibilidad, busqueda, detalle, paginado ni serializacion publica.
- No se modificaron limites, ventanas, claves ni stores de rate-limit.
- No se modificaron CORS, cookies, sesiones ni contratos publicos funcionales.
- No se tocaron migraciones, dependencias, `package.json` ni lockfile.
- No se borraron tests utiles ni documentacion historica que no contradice el estado actual de #831.

## Pruebas ejecutadas

- `pnpm exec node --experimental-strip-types --experimental-specifier-resolution=node --test test/login-rate-limit.test.ts test/admin-auth.fastify.test.ts test/auth.fastify.test.ts test/particular-auth.fastify.test.ts test/frontend-profesionales-page-content.test.ts`
- `pnpm exec node --experimental-strip-types --experimental-specifier-resolution=node --test test/frontend-public-page-metadata.test.ts test/frontend-public-seo-contract.test.ts test/frontend-profesionales-page-content.test.ts`
- `pnpm test`
- `pnpm build`
- `pnpm security:public-surface`
- `pnpm -C frontend build`

## Riesgos residuales

- La inspeccion estricta con `noUnusedLocals` detecto residuos preexistentes fuera del scope pedido. No se corrigieron para no mezclar limpieza reciente con refactors no relacionados.
- Los contratos de algunos tests siguen basados en inspeccion de texto fuente. Solo se ajustaron los afectados por esta limpieza.

## Confirmacion funcional

No se cambio comportamiento funcional del producto. La limpieza se limito a imports muertos, imports duplicados y duplicacion de un literal de headers ya cubierto por tests.
