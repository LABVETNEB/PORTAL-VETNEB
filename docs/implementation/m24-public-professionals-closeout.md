# M24 — Public Professionals phase closeout

## Identificación

| Campo | Valor |
| --- | --- |
| Programa | Backend Enterprise Modularization |
| Fase | E — Public Professionals |
| Milestone | M24 |
| Tipo | Closeout técnico y documental |
| Rama | `refactor/backend-modularization-m24-public-professionals-closeout` |
| Base | `8402ec79e9b7b713d3cc77c40817046fdcb7ede0` |
| Prerequisito | M23 mergeado mediante PR #1527 |
| Impacto de datos | Ninguno |

## Objetivo

Cerrar Fase E después de que:

- M21 estableciera el dominio canónico de elegibilidad;
- M22 moviera persistencia y mapping a infrastructure;
- M23 adelgazara la ruta pública y reapuntara los consumidores operativos.

M24 no agrega capas ni modifica comportamiento. Retira compatibilidad temporal,
endurece los guards y formaliza la arquitectura final.

## Censo final

La auditoría read-only confirmó cero consumidores operativos de:

- `server/db-public-professionals.ts`
- `server/lib/public-professionals-rate-limit.ts`
- `server/lib/professional-bank-eligibility.ts`

Destinos canónicos:

| Path retirado | Destino canónico |
| --- | --- |
| `server/db-public-professionals.ts` | `server/features/public-professionals/infrastructure/index.ts` |
| `server/lib/public-professionals-rate-limit.ts` | `server/features/public-professionals/infrastructure/public-professionals-rate-limit.ts` |
| `server/lib/professional-bank-eligibility.ts` | `server/features/public-professionals/domain/index.ts` |

## Cambios

1. Eliminación de los tres paths legacy.
2. Guard de dominio invertido a ausencia permanente del shim de elegibilidad.
3. Guard de infrastructure invertido a ausencia permanente de los shims DB y rate limit.
4. Censo global de imports runtime resueltos hacia paths retirados.
5. Source boundaries fija la ausencia de los tres paths.
6. Contrato DB continúa leyendo el repository canónico.
7. Barrel de infrastructure documentado como entrada pública directa.
8. Documentación vigente alineada con el cierre de Fase E.

## Arquitectura final

~~~text
public-professionals.fastify.ts
  ├─ HTTP, parsing, CORS, logging y rate-limit wiring
  ├─ public-professionals-query-service.ts
  │  └─ infrastructure/index.ts + lib/supabase.ts
  └─ infrastructure/public-professionals-rate-limit.ts

clinic-public-profile.fastify.ts
  └─ infrastructure/index.ts

infrastructure/public-professionals-repository.ts
  └─ domain/index.ts
~~~

No existe una capa `application`.

## Invariantes preservados

- Endpoints, métodos, prefijos y status codes.
- Payloads, serialización y mensajes públicos.
- CORS y logging.
- SQL de elegibilidad por histopatología.
- Filtros, ranking, scoring, websearch, unaccent y trigram.
- Límites, offset, count y paginación.
- Buckets, ventanas, máximos y mensajes de rate limit.
- `server/lib/rate-limit-store.ts`.
- Auth, sesiones y cookies.
- Schema, migraciones, dependencias, lockfiles y CI.

## Archivos runtime excluidos

M24 no modifica:

- `server/routes/**`
- `server/features/public-professionals/public-professionals-query-service.ts`
- `server/features/public-professionals/domain/professional-bank-eligibility.ts`
- `server/features/public-professionals/domain/index.ts`
- `server/features/public-professionals/infrastructure/public-professionals-mapping.ts`
- `server/features/public-professionals/infrastructure/public-professionals-repository.ts`
- `server/features/public-professionals/infrastructure/public-professionals-rate-limit.ts`
- `server/lib/rate-limit-store.ts`

## Evidencia dirigida

~~~text
tests 60
pass 60
fail 0
~~~

El censo de imports y re-exports legacy sobre `server`, `test`, `scripts` y
`.github` no devolvió resultados.

## Validación final requerida

- `pnpm typecheck`
- `pnpm typecheck:test`
- `pnpm validate:local`
- `pnpm build`
- `pnpm security:public-surface`
- `git diff --check`
- censo final de paths legacy
- revisión final de allowlist y denylist

## Rollback

Revertir el único commit o squash de M24 restaura los tres re-exports temporales
y los contratos anteriores de los guards.

M24 no modifica datos, schema, migraciones, SQL ni registros persistidos.
