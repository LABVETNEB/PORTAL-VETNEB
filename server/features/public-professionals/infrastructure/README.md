# Public Professionals · infrastructure

> Capa **infrastructure** del contexto Public Professionals.
> Contiene persistencia y mapping desde M22, y las constantes del rate limit
> público desde M23.
>
> Ver la frontera del contexto en [`../README.md`](../README.md), el dominio en
> [`../domain/README.md`](../domain/README.md) y el contrato de dependencia en
> [ARCH-2](../../../../docs/architecture/backend-boundary-adr.md).

## Responsabilidad

Materializa la infraestructura propia del directorio público de profesionales
sin alterar el comportamiento observable.

### `public-professionals-mapping.ts`

Lógica pura de:

- normalización;
- evaluación de publicación;
- armado de respuestas del perfil público;
- scoring de calidad.

No realiza I/O, no importa DB ni runtime de Drizzle y sólo consume tipos del
shared kernel cuando corresponde.

### `public-professionals-repository.ts`

Acceso a datos sobre el motor real:

- Drizzle y `pgClient.unsafe`;
- SQL de elegibilidad por histopatología;
- filtros, ranking y scoring;
- límites y offset;
- upsert y patch;
- sincronización de `clinic_public_search`;
- búsqueda y detalle público.

Consume el dominio exclusivamente mediante `../domain/index.ts` y el mapping
por path interno.

### `public-professionals-rate-limit.ts`

Define las constantes de rate limit de:

- búsqueda pública;
- detalle público.

El store fixed-window genérico permanece en
`server/lib/rate-limit-store.ts`. La ruta conserva el wiring HTTP, los headers,
los buckets independientes y las respuestas 429.

### `index.ts`

Barrel público que re-exporta únicamente mapping y repository. El archivo de
rate limit se importa directamente para evitar cargar estáticamente el
repository desde el wiring HTTP.

## Query service consumidor

`../public-professionals-query-service.ts` consume el barrel de infrastructure
mediante carga dinámica y concentra:

- búsqueda;
- detalle;
- serialización pública;
- firma opcional de avatar;
- resolución de dependencias por defecto;
- seams inyectables utilizados por los tests.

No existe una capa `application`, puertos vacíos ni abstracciones
especulativas.

## Exports públicos

### Mapping

- `MIN_PUBLIC_PROFILE_QUALITY_SCORE`
- `UpsertClinicPublicProfileInput`
- `evaluateClinicPublicProfilePublication`
- `buildClinicPublicProfileResponse`

### Repository

- `getClinicPublicProfileByClinicId`
- `upsertClinicPublicProfile`
- `patchClinicPublicProfile`
- `syncClinicPublicSearch`
- `removeClinicPublicAvatar`
- `getPublicProfessionalByClinicId`
- `searchPublicProfessionals`

### Rate limit

- constantes de ventana, máximo de intentos y mensaje público para search;
- constantes de ventana, máximo de intentos y mensaje público para detail.

## Invariantes preservados

- `MIN_PUBLIC_PROFILE_QUALITY_SCORE = 75`.
- SQL de elegibilidad preservado.
- Filtros `is_public` e `is_search_eligible` preservados.
- Websearch, unaccent, trigram, pesos, boosts y `ORDER BY` preservados.
- Límite máximo de búsqueda 50.
- Count y paginación preservados.
- Cero transacciones en el repository.
- Buckets de rate limit separados para search y detail.
- El store compartido no se mueve fuera de `server/lib`.
- Sin cambios de schema, migraciones, auth, CORS ni contratos HTTP.

## Regla de dependencia

| Módulo | Puede importar | No puede importar |
| --- | --- | --- |
| Mapping | tipos del shared kernel y archivos de la propia capa | DB, Drizzle runtime, Fastify, routes, auth, env, CORS, rate limit, Supabase, I/O |
| Repository | Drizzle, `server/db.ts`, schema, domain barrel y mapping | routes, application, Fastify, auth, CORS, audit, email, Supabase, `server/lib/**`, frontend |
| Rate limit | ninguna dependencia runtime | store, Fastify, routes, auth, DB, Supabase |
| Query service | barrel de infrastructure y cliente compartido de storage | shims legacy, rutas, Fastify, auth, CORS |

Estas reglas se verifican mediante:

- `test/architecture/public-professionals-infrastructure-boundary-guard.test.ts`
- `test/architecture/public-professionals-source-boundaries.test.ts`

## Shims legacy temporales

Permanecen hasta M24:

- `server/db-public-professionals.ts`
- `server/lib/public-professionals-rate-limit.ts`
- `server/lib/professional-bank-eligibility.ts`

M23 eliminó sus consumidores operativos. Cada shim contiene únicamente un
re-export hacia la frontera canónica correspondiente.

M24 realizará el censo final y su retiro.
