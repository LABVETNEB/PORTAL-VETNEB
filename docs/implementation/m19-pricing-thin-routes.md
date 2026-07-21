# M19 — Pricing thin routes (Fase D)

> **Estado:** **M19 mergeado y cerrado.** PR técnico **#1521** — **MERGED**.
> **M18 permanece cerrado. Fase D permanece abierta. M20 no iniciado.**
>
> **Cierre técnico (registro histórico autosuficiente):**
> - PR técnico: **#1521** — **MERGED** (base `main`).
> - Commit técnico final (head): `b9847412fdff839ba50d2caf8c14d1a33e0af776`.
> - Squash SHA en `main`: `d1b25111d6bc0aa644647e67a784cb596b4e1afe`.
> - Merge timestamp: `2026-07-21T19:30:35Z` · Merge date: `2026-07-21`.
> - Base técnica: `a0ce4b47c7c736efe0e0a42b629826fab22de397`.
> - Rama técnica `refactor/backend-modularization-m19-thin-pricing-routes`
>   eliminada local y remotamente.
> - `main` = `origin/main` = `origin/HEAD` = squash SHA
>   `d1b25111d6bc0aa644647e67a784cb596b4e1afe`.

Adelgaza `server/routes/admin-pricing.fastify.ts` y
`server/routes/public-pricing.fastify.ts` a la arquitectura objetivo
`Fastify route → servicio directo del contexto Pricing → infraestructura canónica
DB/cache`, y **retira los dos shims legacy** que M18 conservó hasta este milestone.

## Baseline R0 (medido sobre HEAD `a0ce4b47c7c736efe0e0a42b629826fab22de397`)

- **Rama:** `refactor/backend-modularization-m19-thin-pricing-routes`.
- **Base:** `a0ce4b4` (`docs(architecture): close M18 pricing milestone`) — HEAD == base.
- **Working tree al iniciar:** limpio. La auditoría inicial reportó erróneamente
  ausencia de remote; la verificación manual posterior confirmó `origin`
  configurado como `https://github.com/LABVETNEB/PORTAL-VETNEB.git` para
  fetch/push.
- **AGENTS.md:** único raíz, sin anidados.

### Rutas (antes)

| Métrica | `admin-pricing.fastify.ts` | `public-pricing.fastify.ts` |
| --- | --- | --- |
| LOC | 513 | 136 |
| Endpoints | `OPTIONS /`, `OPTIONS /:id`, `GET /`, `PATCH /:id` | `GET /` |
| Hooks | `onRequest` (CORS) | — |
| Imports a shims | `../db-pricing.ts` (type-only + `await import`), `../lib/public-pricing-cache.ts` (`clearPublicPricingCache`) | `../db-pricing.ts` (`await import`), `../lib/public-pricing-cache.ts` (get/set/type) |
| Orquestación no-HTTP en la ruta | carga lazy DB, `groupAdminPricingItems`, `serializeAdminPricingItem`, find previous, update, clear cache | read-through cache, carga lazy DB, `groupPublicPricingItems`, construcción snapshot, set cache |
| Errores/logs | `[ADMIN_PRICING_LIST_ERROR]`, `[ADMIN_PRICING_PATCH_ERROR]` | `[PUBLIC_PRICING_LIST_ERROR]` |

**Orden contractual del PATCH admin (fijado, no alterado):**
`authenticate → validate id → validate body → list/find previous → update →
audit → clear public cache → response`.

**Public GET (fijado):** `Cache-Control: public, max-age=60, stale-while-revalidate=300`;
`X-Pricing-Cache: HIT | MISS`; body `{ success: true, categories }` en orden DB;
`priceLabel ?? null`; snapshot cacheado == body; HIT sin query; MISS con una query
y un `set`; TTL canónico 5 min; expiración lazy; singleton; error
`{ success: false, error: "Error interno del servidor" }`; sin fallback mock.

### Censo de consumidores de los shims (por path resuelto + texto)

**`server/db-pricing.ts`** (operativos): `admin-pricing.fastify.ts` (type-only +
`await import`), `public-pricing.fastify.ts` (`await import`). **Ningún test** lo
consume (ambos pricing-api tests ya apuntaban al canónico en M18).

**`server/lib/public-pricing-cache.ts`** (operativos): `admin-pricing.fastify.ts`
(`clearPublicPricingCache`), `public-pricing.fastify.ts` (get/set/type), y **3
contratos globales** que sólo lo usan para **higiene de reset**
(`clearPublicPricingCache`): `api-error-content-type-contract`,
`api-request-id-observability-contract`, `global-public-surface-hardening-contract`
— sin aserciones estructurales sobre las rutas Pricing.

**No relacionados:** `frontend/src/lib/public-pricing-cache.ts` y
`frontend/src/components/public/PreciosContent.tsx` (homónimo del frontend, `@/lib/…`);
`test/unit/ui/public/frontend-public-pricing-runtime-cache.test.ts` (importa el
homónimo del frontend). El resto son menciones documentales históricas.

**Conclusión:** tras reapuntar las rutas al servicio y los 3 contratos globales al
canónico, ambos shims quedan con **cero consumidores operativos** → retirados.

## Diseño seleccionado

Dos **servicios directos** mínimos dentro de la frontera del contexto, sin
`domain/`, sin `application/`, sin puertos vacíos, sin clases/DI/factories/repos
genéricos (Pricing no tiene reglas de dominio):

- `server/features/pricing/public-pricing-service.ts` — `readThroughPublicPricing(options)`:
  cache lookup → HIT devuelve snapshot cacheado por referencia (sin query); MISS →
  lista (inyectada o canónica lazy) + `groupPublicPricingItems` + construcción del
  snapshot + `setCachedPublicPricingSnapshot`; devuelve `{ snapshot, cacheStatus }`.
  Un error de la query se propaga **antes** de escribir el cache.
- `server/features/pricing/admin-pricing-service.ts` — `listAdminPricingCategories`
  (list + `groupAdminPricingItems`), `serializeAdminPricingItem` (DTO),
  `updateAdminPricingItem` (find previous → update con `{...payload, now}` sin
  mutar el payload → `{ status: "updated", previous, updated }` | `{ status:
  "not_found" }`), `invalidatePublicPricingCache` (invalidación explícita para que
  la ruta la invoque en el orden exacto), `loadDefaultAdminPricingDataDeps` (carga
  lazy del canónico). **La auditoría NO vive en el servicio.**

Las rutas quedan thin: sólo HTTP y cross-cutting. La ruta admin conserva el
control explícito del orden `update → audit → clear cache → response` y construye
la metadata de auditoría con los `previous`/`updated` crudos que devuelve el
servicio. Ninguna ruta importa los canónicos DB/cache directamente: el servicio es
la frontera.

### Alternativas rechazadas

- **Replicar la arquitectura de Logistics** (domain + application + puertos +
  adapters/factories): prohibido por la restricción 13 del programa — inventaría
  estructura para código inexistente.
- **Esconder la auditoría o el clear-cache dentro del servicio de update:** rompe
  el orden contractual y acopla el servicio a audit. Rechazado: la auditoría se
  queda en la ruta; el clear-cache es una operación explícita invocada por la ruta.
- **Mantener snapshot/grouping inline en la ruta public sólo para conservar anclas
  antiguas:** dejaría la ruta no-thin. Rechazado: se realineó la única ancla
  externa (ver más abajo) al servicio, preservando exactamente la invariante.
- **Que la ruta siga cargando el canónico DB/cache directamente:** rechazado; el
  servicio directo es la frontera de composición (verificado por el guard).

## Árbol antes / después

```
ANTES
  server/db-pricing.ts                                   (shim: export *)
  server/lib/public-pricing-cache.ts                     (shim: export *)
  server/routes/admin-pricing.fastify.ts                 (513 LOC, orquestación + HTTP)
  server/routes/public-pricing.fastify.ts                (136 LOC, orquestación + HTTP)
  server/features/pricing/infrastructure/db-pricing.ts             (canónico)
  server/features/pricing/infrastructure/public-pricing-cache.ts   (canónico)

DESPUÉS
  server/db-pricing.ts                                   (ELIMINADO)
  server/lib/public-pricing-cache.ts                     (ELIMINADO)
  server/routes/admin-pricing.fastify.ts                 (451 LOC, sólo HTTP + orden)
  server/routes/public-pricing.fastify.ts                (48 LOC, sólo HTTP)
  server/features/pricing/admin-pricing-service.ts       (164 LOC, servicio directo)  [nuevo]
  server/features/pricing/public-pricing-service.ts      (111 LOC, servicio directo)  [nuevo]
  server/features/pricing/infrastructure/db-pricing.ts             (canónico, intacto)
  server/features/pricing/infrastructure/public-pricing-cache.ts   (canónico, intacto)
```

## Responsabilidades antes / después

| Responsabilidad | Antes | Después |
| --- | --- | --- |
| Registro Fastify, CORS, trusted-origin, auth admin, parsing/validación, status codes, mensajes, headers, logging, contexto+llamada de auditoría | ruta | **ruta** (sin cambios) |
| Orden `update → audit → clear cache → response` | ruta | **ruta** (sin cambios) |
| Carga lazy DB, read-through cache, agrupamiento, serialización DTO, find previous, update, invalidación de cache | ruta | **servicio directo** |
| Persistencia (Drizzle) y cache in-memory | canónico infra | **canónico infra** (intacto) |

## Allowlist exacta (A/M/D/R)

| Estado | Archivo |
| --- | --- |
| **M** | `server/routes/admin-pricing.fastify.ts` (thin) |
| **M** | `server/routes/public-pricing.fastify.ts` (thin) |
| **A** | `server/features/pricing/admin-pricing-service.ts` |
| **A** | `server/features/pricing/public-pricing-service.ts` |
| **D** | `server/db-pricing.ts` (shim retirado) |
| **D** | `server/lib/public-pricing-cache.ts` (shim retirado) |
| **M** | `test/architecture/pricing-infrastructure-boundary-guard.test.ts` (shim-ausente + frontera servicio + delegación rutas) |
| **M** | `test/integration/adapters/controllers/api-error-content-type-contract.test.ts` (reapunte cache al canónico) |
| **M** | `test/integration/adapters/controllers/api-request-id-observability-contract.test.ts` (reapunte) |
| **M** | `test/integration/adapters/controllers/global-public-surface-hardening-contract.test.ts` (reapunte) |
| **M** | `test/unit/infrastructure/progress-production-invariants.test.ts` (realineo de las 3 anclas del snapshot → servicio; **+ ancla de delegación ruta→servicio, + ancla anti-inline grouping/snapshot en la ruta, + ausencia de imports a shims retirados**; sin tocar otros bloques, sin eliminar expectativas) |
| **A** | `test/unit/pricing/pricing-public-service.test.ts` |
| **A** | `test/unit/pricing/pricing-admin-service.test.ts` |
| **M** | `server/features/pricing/README.md` (estado M19) |
| **M** | `server/features/pricing/infrastructure/README.md` (estado M19) |
| **M** | `docs/architecture/shared-lib-boundary-inventory.md` (2 filas) |
| **M** | `docs/audit/backend-enterprise-modularization-program-audit.md` (Fase D) |
| **A** | `docs/implementation/m19-pricing-thin-routes.md` (este documento) |

> **Autorización adicional (Nico, tarea actual):** agregar exclusivamente
> `test/unit/infrastructure/progress-production-invariants.test.ts` a la allowlist
> M19 para: (1) **realinear** sus 3 anclas del snapshot público desde la ruta al
> nuevo servicio (shape, `success: true`, categorías agrupadas, orden); (2) agregar
> una **ancla de delegación** ruta→servicio (`readThroughPublicPricing({` +
> import del servicio); (3) agregar una **ancla anti-inline** que impide
> reintroducir `const snapshot: PublicPricingSnapshot = {` o `groupPublicPricingItems`
> en la ruta; (4) agregar **ausencia de imports** hacia los shims retirados.
> Sólo el bloque de invariantes de pricing público; sin tocar otros bloques, sin
> eliminar expectativas ni reducir cobertura. Ningún otro path fuera del superset;
> sin cambios de comportamiento HTTP/cache/DB/auth/CORS/headers/contratos.

`admin-pricing-api.test.ts` y `public-pricing-api.test.ts` están en el superset
pero **no requirieron cambios**: ya apuntaban al canónico en M18 y verifican
comportamiento HTTP preservado byte a byte.

## Denylist verificada (sin cambios)

`server/features/pricing/infrastructure/db-pricing.ts`,
`server/features/pricing/infrastructure/public-pricing-cache.ts`,
`server/fastify-app.ts`, `server/db.ts`, `drizzle/**`, `migrations/**`,
`frontend/**`, `package.json`, `frontend/package.json`, `pnpm-lock.yaml`,
`pnpm-workspace.yaml`, `.github/**`; auth global, cookies, sesiones, CORS shared,
CSP, rate limits, schema, migraciones, endpoints, contratos HTTP, M20. **Ninguno
modificado.** Los seams `AdminPricingNativeRoutesOptions` /
`PublicPricingNativeRoutesOptions` conservan su forma (fastify-app importa los
tipos sin cambios).

## Invariantes verificadas

- **Contratos HTTP admin/public** byte a byte (status 200/204/400/401/403/404/500,
  mensajes, campos editables, prohibición de `category`/`studyName`, validaciones
  de `priceLabel`/`displayOrder`/ID, cuerpo agrupado, DTO serializado, evento
  `AUDIT_EVENTS.ADMIN_PRICING_UPDATED`, metadata `updatedFields`/`previous`/`next`,
  invalidación de cache sólo tras auditoría exitosa, logs).
- **Public:** headers exactos, HIT sin query, MISS con una query y un `set`,
  snapshot == body, `priceLabel ?? null`, sin fallback mock, error seguro.
- **Orden PATCH:** `update → audit → clear cache → response` (la auditoría se
  mantiene en la ruta; el clear-cache no se ejecuta si update o audit falla).
- **Carga lazy e inyección:** con todas las deps inyectadas, registrar la ruta no
  carga `server/db.ts` ni infraestructura DB (la carga default sigue siendo lazy).
- **Canónicos DB/cache:** intactos (superficie pública, 0 transacciones, TTL 5 min,
  cero imports del cache, singleton compartido).
- **Shims:** ausentes; cero consumidores productivos; cero tests operativos
  resolviendo al path retirado; guard impide recreación.

## Validaciones (estados canónicos)

| Gate | Estado |
| --- | --- |
| `git diff --check` | **PASSED** |
| Cohorte dirigida (guard + admin/public API + 3 contratos globales + 2 unit M19 + progress-invariants) | **PASSED** — 50/50 |
| Guards de rutas fuera del superset (no-store-cache, csrf-mutating, auth-boundary) + logistics guard | **PASSED** — 56/56 (verificación de no-regresión) |
| `pnpm validate:local` | **PASSED** — 3364 passed, 1 skipped preexistente, 0 failed; build OK |
| `pnpm security:public-surface` | **PASSED** |
| CI técnico PR #1521 sobre el head técnico final `b9847412fdff839ba50d2caf8c14d1a33e0af776` | **PASSED** — 5 successful, 1 skipped, 0 failing, 0 pending |
| Supabase Preview | **NOT_RUN** — skipped porque no hubo cambios en `supabase/` |
| Schema / migrations | **NOT_RUN** |
| Playwright / E2E | **NOT_RUN** |
| Dependency audits locales | **NOT_RUN** — sin manifests/lockfiles |

## Rollback

Revertible por archivo sin tocar M20: restaurar los dos shims
(`export *` hacia el canónico) con los hashes M18, revertir las rutas a su versión
M18, borrar los dos servicios directos y los dos unit tests, revertir el guard a
la variante shim-presente, y revertir los reapuntes de los 3 contratos globales y
el realineo de `progress-production-invariants`. No hay migraciones ni cambios de
schema que deshacer. Los canónicos infra no se tocaron.

## Estado final

```text
M18 permanece cerrado
M19 mergeado y cerrado
PR técnico #1521
squash merge completado (d1b25111d6bc0aa644647e67a784cb596b4e1afe)
CI técnico PASSED: 5 successful, 1 skipped, 0 failing, 0 pending
rama técnica eliminada local y remotamente
Fase D abierta
M20 no iniciado
```
