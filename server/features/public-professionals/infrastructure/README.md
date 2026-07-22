# Public Professionals · infrastructure (persistencia + mapping)

> Capa **infrastructure** del contexto Public Professionals. **Contiene código**
> desde M22. Ver la frontera del contexto en [`../README.md`](../README.md), el
> dominio en [`../domain/README.md`](../domain/README.md) y el contrato de
> dependencia en [ARCH-2](../../../../docs/architecture/backend-boundary-adr.md).

## Responsabilidad

Materializa la persistencia y el mapping del directorio público de profesionales,
movidos desde `server/db-public-professionals.ts` (756 LOC) sin alterar el
comportamiento observable. Dos módulos con responsabilidades separadas más un
barrel:

- **`public-professionals-mapping.ts`** — lógica **pura** de normalización,
  evaluación de publicación y armado de respuesta. Sin I/O, sin Drizzle runtime,
  sin DB. Sólo importa **tipos** del shared kernel (`drizzle/schema.ts`).
- **`public-professionals-repository.ts`** — acceso a datos sobre el motor real:
  Drizzle (`db`), `pgClient.unsafe`, el SQL de elegibilidad por histopatología,
  filtros, ranking/scoring, límites/offset, upsert/patch, sincronización de
  `clinic_public_search`, búsqueda y detalle. Consume el dominio **exclusivamente
  por el barrel** (`../domain/index.ts`) y el mapping por path interno.
- **`index.ts`** — barrel público que re-exporta ambos módulos sin lógica.

## Exports públicos

Mapping:

- **Constante:** `MIN_PUBLIC_PROFILE_QUALITY_SCORE` (75).
- **Tipo:** `UpsertClinicPublicProfileInput`.
- **Funciones:** `evaluateClinicPublicProfilePublication`,
  `buildClinicPublicProfileResponse`.

Repository:

- `getClinicPublicProfileByClinicId`, `upsertClinicPublicProfile`,
  `patchClinicPublicProfile`, `syncClinicPublicSearch`,
  `removeClinicPublicAvatar`, `getPublicProfessionalByClinicId`,
  `searchPublicProfessionals`.

## Invariantes preservados (sin cambios de comportamiento)

- `MIN_PUBLIC_PROFILE_QUALITY_SCORE = 75`; campos requeridos/recomendados,
  scoring y mensajes en español idénticos.
- SQL de elegibilidad **byte por byte**: `LAST_HISTOPATHOLOGY_REPORT_DELIVERED_AT_SQL`,
  `PROFESSIONAL_BANK_ELIGIBILITY_SQL`, `PROFESSIONAL_BANK_ELIGIBILITY_DRIZZLE_SQL`
  (`sql.raw` reutiliza exactamente el SQL raw); filtros `is_public` /
  `is_search_eligible`; websearch/unaccent/trigram; pesos y boosts; `ORDER BY`;
  `LIMIT` máximo 50; offset; count con el mismo `whereSql`.
- **Cero transacciones** (medido en R0: `db-public-professionals.ts` tenía 0
  call-sites `.transaction(`).

## Regla de dependencia

| Puede importar | No puede importar |
| --- | --- |
| `drizzle-orm`, `server/db.ts`, `drizzle/schema.ts`, el domain barrel (`../domain/index.ts`), y archivos de la propia capa | `fastify`, `server/routes`, una capa `application`, auth/sesiones/CORS/audit/email, `server/lib/**`, Supabase, frontend |

El **mapping** es estricto: no importa DB, ni el runtime de Drizzle, ni Fastify,
routes, auth, env, CORS, rate limit, Supabase o I/O. Verificado por
`test/architecture/public-professionals-infrastructure-boundary-guard.test.ts`.

## Shim legacy temporal

`server/db-public-professionals.ts` queda como **shim mínimo** — un único
`export *` hacia este barrel, sin lógica — porque las rutas
(`public-professionals.fastify.ts`, `clinic-public-profile.fastify.ts`) todavía
consumen el path legacy en M22. Su reapunte o retiro corresponde a **M23/M24**.
