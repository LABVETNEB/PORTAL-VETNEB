# M18 — Pricing infrastructure move (Fase D)

> **Estado:** **mergeado y cerrado.**
> **M18 cierra su move de infraestructura; Fase D sigue abierta. M19 no iniciado.**

- **PR técnico:** [#1519](https://github.com/LABVETNEB/PORTAL-VETNEB/pull/1519) — MERGED
- **Commit técnico:** `0dfa1388d41dea4214fa48c9765a1d625c0396ed`
- **Squash SHA:** `5f99b5f40e08ea8929be869374f1d154f740153f`
- **Merge timestamp:** `2026-07-21T14:17:16Z`
- **Merge date:** 2026-07-21
- **Rama técnica:** `refactor/backend-modularization-m18-pricing-infrastructure` —
  eliminada local y remotamente
- **Base técnica:** `877185f161ea292313ab457a6fe4b0907eb6e28b`
  (`docs(architecture): close M17 logistics milestone` = **M17 ya mergeado**, PR #1517)
- **Resultado técnico:** `5f99b5f40e08ea8929be869374f1d154f740153f` (= `main` =
  `origin/main` = `origin/HEAD`)
- **Programa:** Fase D (Pricing), milestone **M18** (infra: persistencia + cache)
- **Estado de fase:** con M18 la **Fase D permanece abierta**. **M19 (thin rutas
  admin+public) — siguiente milestone, no iniciado.**

> Este documento registra el estado **histórico** del move técnico de M18, ya
> mergeado (PR #1519, squash `5f99b5f…`, 2026-07-21). El closeout documental
> (`docs(architecture): close M18 pricing milestone`) convierte esta nota y el
> documento rector del programa en registro definitivo del move de infraestructura
> de Pricing. M18 no declara cerrada la Fase D: eso corresponde a M20.

## Rama y base

- **Rama técnica:** `refactor/backend-modularization-m18-pricing-infrastructure`
  — eliminada local y remotamente tras el squash merge.
- **Base exacta:** `877185f161ea292313ab457a6fe4b0907eb6e28b`
  (`docs(architecture): close M17 logistics milestone`).
- **Working tree al iniciar:** limpio.

## Autorización (R2)

Move estructural de backend dentro del scope explícito de la tarea M18 (Fase D
del programa rector). Autorizado por Nico: mover la infraestructura de Pricing a
`features/pricing/infrastructure/` conservando shims de compatibilidad hasta M19.
No se tocan dependencias, schema, migraciones, CI ni rutas. El trabajo técnico se
completó, se abrió el PR #1519 y se mergeó por squash
(`5f99b5f40e08ea8929be869374f1d154f740153f`, `2026-07-21T14:17:16Z`).

## Auditoría R0 (medida sobre HEAD `877185f`)

### `server/db-pricing.ts`

| Métrica | Valor |
| --- | --- |
| LOC | 160 |
| `git hash-object` | `c3114e54d02baceeb66985de6811bccf2ba727c3` |
| SHA-256 | `5ff12a551aa4f57ab3555dd1d390fdc264c587fada79256250271ad908af0454` |
| Encoding / EOL | ASCII, LF (`.gitattributes`: `*.ts text eol=lf`), newline final presente |
| Imports | `drizzle-orm` (`asc`, `eq`); `./db.ts` (→ `server/db.ts`); `../drizzle/schema.ts` (→ `drizzle/schema.ts`) |
| Exports de valor | `listPublicPricingItems`, `listAdminPricingItems`, `updatePricingItem` |
| Exports de tipo | `PricingItem`, `UpdatePricingItemInput` |
| Internos (no exportados) | `PricingItemRow` (type), `serializePricingItem`, `hasPatchFields`, `getPricingItemById` |
| Operaciones Drizzle | `db.select().from().where().limit()`, `db.select().from().where().orderBy()`, `db.select().from().orderBy()`, `db.update().set().where().returning()` |
| `.transaction(` | **0** |
| Ordenamientos | `asc(category) → asc(displayOrder) → asc(id)` en list público y admin |
| Serialización `updatedAt` | `row.updatedAt.toISOString()` |
| Normalización `priceLabel` | `row.priceLabel ?? null` (serializer) y `input.priceLabel ?? null` (update) |

**Firmas exportadas (exactas):**

- `listPublicPricingItems(): Promise<PricingItem[]>` — filtra `isActive = true`.
- `listAdminPricingItems(): Promise<PricingItem[]>` — sin filtro.
- `updatePricingItem(id: number, input: UpdatePricingItemInput): Promise<PricingItem | null>`.

**Comportamientos preservados:**

- **PATCH sin campos** (`hasPatchFields` falso): `updatePricingItem` devuelve
  `getPricingItemById(id)` — **no** escribe `updatedAt` ni ejecuta `update`.
- **`priceLabel`**: `null`/`undefined` se normalizan a `null`; sólo se incluye en
  el `SET` si la propiedad existe (`hasOwnProperty`).
- **`isActive` / `displayOrder`**: sólo entran al `SET` si la propiedad existe.
- **Registro inexistente**: `getPricingItemById` y `updatePricingItem` devuelven
  `null` cuando `rows[0]` es `undefined`.
- **`updatedAt` en update**: `input.now ?? new Date()`.

### `server/lib/public-pricing-cache.ts`

| Métrica | Valor |
| --- | --- |
| LOC | 54 |
| `git hash-object` | `283af00cac760a1dfdcd47593d5d29e945a3379e` |
| SHA-256 | `7031019f93bffc662ebc02ee9e38b8e2beff8e8d50194474b45151e395c67689` |
| Encoding / EOL | ASCII, LF, newline final presente |
| Imports | **ninguno** (módulo in-memory puro) |
| Exports de valor | `getCachedPublicPricingSnapshot`, `setCachedPublicPricingSnapshot`, `clearPublicPricingCache` |
| Exports de tipo | `PublicPricingSnapshotItem`, `PublicPricingSnapshotCategory`, `PublicPricingSnapshot` |
| TTL | `PUBLIC_PRICING_CACHE_TTL_MS = 5 * 60 * 1000` (**5 minutos**) |
| Estado module-level | `let cacheEntry: PublicPricingCacheEntry | null = null` |
| Expiración | **lazy** en lectura: `if (cacheEntry.expiresAt <= now) { cacheEntry = null; return null; }` |
| Defaults | `now: number = Date.now()` en get y set |
| HIT | devuelve `cacheEntry.snapshot` (misma referencia almacenada) |
| MISS | `null` (sin entrada o expirada) |
| clear | `cacheEntry = null` |
| Identidad de referencia | `setCachedPublicPricingSnapshot` almacena el snapshot por referencia; el get devuelve esa misma referencia |

## Árbol antes / después

```
ANTES
  server/db-pricing.ts                                  (impl, 160 LOC)
  server/lib/public-pricing-cache.ts                    (impl, 54 LOC)
  server/features/pricing/                              (no existe)

DESPUÉS
  server/db-pricing.ts                                  (shim: 1 export *)
  server/lib/public-pricing-cache.ts                    (shim: 1 export *)
  server/features/pricing/README.md                     (nuevo)
  server/features/pricing/infrastructure/README.md      (nuevo)
  server/features/pricing/infrastructure/db-pricing.ts             (canónico, 160 LOC, 2 specifiers reapuntados)
  server/features/pricing/infrastructure/public-pricing-cache.ts   (canónico, byte-idéntico)
  test/architecture/pricing-infrastructure-boundary-guard.test.ts  (nuevo guard)
```

## Matriz de consumidores

| Consumidor | Módulo | Tipo de import | Acción M18 |
| --- | --- | --- | --- |
| `server/routes/admin-pricing.fastify.ts` | `db-pricing` (tipos) + import dinámico | type-only + `await import("../db-pricing.ts")` | **sin cambios** (consume shim hasta M19) |
| `server/routes/admin-pricing.fastify.ts` | `public-pricing-cache` | `import { clearPublicPricingCache }` | **sin cambios** (consume shim hasta M19) |
| `server/routes/public-pricing.fastify.ts` | `db-pricing` | `await import("../db-pricing.ts")` | **sin cambios** (consume shim hasta M19) |
| `server/routes/public-pricing.fastify.ts` | `public-pricing-cache` | `import { ... }` | **sin cambios** (consume shim hasta M19) |
| `test/integration/adapters/controllers/admin-pricing-api.test.ts` | `public-pricing-cache` (runtime) + `db-pricing` (tipo) | `await import` + `import(...).PricingItem` | **reapuntado al canónico** |
| `test/integration/adapters/controllers/public-pricing-api.test.ts` | `public-pricing-cache` (runtime) | `await import` | **reapuntado al canónico** |
| `test/integration/adapters/controllers/api-error-content-type-contract.test.ts` | `public-pricing-cache` (reset hygiene) | `await import` del shim | **sin cambios** (contrato global fuera de Pricing; shim persiste; no hay anchor literal que realinear) |
| `test/integration/adapters/controllers/api-request-id-observability-contract.test.ts` | `public-pricing-cache` (reset hygiene) | `await import` del shim | **sin cambios** (ídem) |
| `test/integration/adapters/controllers/global-public-surface-hardening-contract.test.ts` | `public-pricing-cache` (reset hygiene) | `await import` del shim | **sin cambios** (ídem) |
| `frontend/src/components/public/PreciosContent.tsx` + `frontend/src/lib/public-pricing-cache.ts` | módulo **homónimo del frontend** (`@/lib/...`) | — | **no relacionado** (otro archivo; el frontend no importa `server/`) |
| Documentación (`docs/**`, `*.md`) | menciones textuales | — | inventario y programa actualizados; el resto son referencias históricas |

**Identidad de módulo (por qué el reapunte parcial es seguro):** el `export *`
de cada shim re-exporta *live bindings* del mismo módulo canónico. Node instancia
el canónico una sola vez; el shim sólo re-exporta sus bindings. Por eso el estado
module-level del cache (`cacheEntry`) es un **único singleton** compartido, tanto
si un consumidor importa por el shim (rutas) como por el canónico (tests
reapuntados).

## Estrategia de moves y shims

1. **`db-pricing`:** copia completa a `features/pricing/infrastructure/db-pricing.ts`;
   único cambio permitido = los dos specifiers exigidos por la profundidad
   (`./db.ts` → `../../../db.ts`; `../drizzle/schema.ts` → `../../../../drizzle/schema.ts`,
   ambos resuelven al mismo target). Sin reorganizar funciones, sin extraer
   mappings, sin clases/factories/puertos, sin reformatear. El path legacy pasa a
   ser un shim `export * from "./features/pricing/infrastructure/db-pricing.ts";`.
2. **`public-pricing-cache`:** move **byte-idéntico** (hash igual, `283af00…`) a
   `features/pricing/infrastructure/public-pricing-cache.ts` (cero imports
   preservados). El path legacy pasa a ser un shim
   `export * from "../features/pricing/infrastructure/public-pricing-cache.ts";`.
3. **Rutas:** byte-idénticas; siguen consumiendo los shims hasta M19.

## Allowlist exacta (estados A/M/D/R)

| Estado | Archivo |
| --- | --- |
| **M** | `server/db-pricing.ts` (impl → shim) |
| **M** | `server/lib/public-pricing-cache.ts` (impl → shim) |
| **A** | `server/features/pricing/infrastructure/db-pricing.ts` (canónico) |
| **A** | `server/features/pricing/infrastructure/public-pricing-cache.ts` (canónico) |
| **A** | `server/features/pricing/README.md` |
| **A** | `server/features/pricing/infrastructure/README.md` |
| **A** | `test/architecture/pricing-infrastructure-boundary-guard.test.ts` |
| **M** | `test/integration/adapters/controllers/admin-pricing-api.test.ts` (reapunte a canónico) |
| **M** | `test/integration/adapters/controllers/public-pricing-api.test.ts` (reapunte a canónico) |
| **M** | `docs/architecture/shared-lib-boundary-inventory.md` (3 filas de estado) |
| **M** | `docs/audit/backend-enterprise-modularization-program-audit.md` (marca Fase D) |
| **A** | `docs/implementation/m18-pricing-infrastructure-move.md` (este documento) |

Sin archivos **D** (nada se borra: los shims permanecen).

## Denylist verificada (sin cambios)

`server/routes/admin-pricing.fastify.ts`, `server/routes/public-pricing.fastify.ts`,
`server/fastify-app.ts`, `server/db.ts`, `drizzle/**`, `migrations/**`,
`frontend/**`, `package.json`, `frontend/package.json`, `pnpm-lock.yaml`,
`pnpm-workspace.yaml`, `.github/**`, auth/cookies/sesiones/CORS/CSP/rate-limits,
audit events, endpoints/contratos HTTP, M19/M20. **Ninguno modificado.**

## Hashes protegidos (antes / después)

| Archivo | Antes | Después |
| --- | --- | --- |
| `server/features/.../public-pricing-cache.ts` (canónico) | — | `283af00…` (**= R0**, byte-idéntico) |
| `server/features/.../db-pricing.ts` (canónico) | — | difiere de R0 sólo en 2 líneas de specifier (mismo target) |
| `server/routes/admin-pricing.fastify.ts` | (baseline) | **sin cambios** |
| `server/routes/public-pricing.fastify.ts` | (baseline) | **sin cambios** |

## Invariantes

- Cache TTL = 5 minutos exactos; expiración lazy; singleton compartido.
- DB: 0 transacciones; superficie pública (3 funciones + 2 tipos) intacta;
  serialización ISO de `updatedAt`; normalización `priceLabel ?? null`; guard de
  PATCH sin campos; ordenamientos exactos.
- Rutas byte-idénticas: import dinámico legacy de `db-pricing`, uso del cache vía
  shim, agrupamiento de categorías, `Cache-Control`, `X-Pricing-Cache` HIT/MISS,
  CORS, trusted-origin, auth admin, validación, status codes, mensajes, auditoría
  y orden `update → audit → clear cache → response`.

## Riesgos y mitigación

- **Reapunte parcial de consumidores del cache** → mitigado por identidad de
  módulo (`export *` = singleton compartido); cubierto por los tests de
  integración admin/public.
- **Regresión silenciosa del serializer/guard** → cubierto por el guard nuevo
  (superficie pública, ISO, `priceLabel ?? null`, 0 tx, TTL) + tests HTTP.
- **Recreación futura de lógica en los shims** → el guard fija que ambos shims
  son sólo un `export *`.

## Rollback independiente

Revertible por archivo sin tocar M19: borrar `server/features/pricing/` y el
guard, y restaurar `server/db-pricing.ts` y `server/lib/public-pricing-cache.ts`
a su implementación original (hashes R0 `c3114e5…` y `283af00…`), y revertir el
reapunte de los dos tests y las notas de docs. No hay migraciones ni cambios de
schema que deshacer.

## Resultados de validación (estados canónicos)

Evidencia autosuficiente del move técnico M18 (cohorte dirigida → `validate:local`
→ `security:public-surface` → `git diff --check`), más el resultado de CI del
PR #1519 ya mergeado.

| Gate | Estado |
| --- | --- |
| Pricing infrastructure boundary guard — 11/11 | **PASSED** |
| Pricing API + contratos globales dirigidos — 21/21 | **PASSED** |
| `pnpm validate:local` | **PASSED** — 3350 passed, 1 skipped preexistente, 0 failed; build passed |
| `pnpm security:public-surface` | **PASSED** |
| `git diff --check` | **PASSED** |
| Schema / migraciones | **NOT_RUN** — sin cambios de schema o migraciones |
| Playwright / E2E | **NOT_RUN** — sin cambios frontend |
| Dependency audits | **NOT_RUN** — sin manifests o lockfiles |
| CI remoto ejecutado (PR #1519) | **PASSED** — 5 successful, 0 failing, 0 pending |
| Supabase Preview (PR #1519) | **NOT_RUN** — check skipped; no se ejecutó |

### CI remoto (PR #1519)

**5 successful · 1 skipped · 0 failing · 0 pending.**

Checks exitosos:

- `qga-workflow-security`
- `QGA Governance / qga-workflow-security`
- `Backend CI / validate-backend (push)`
- `Backend CI / validate-backend (pull_request)`
- `PR Governance / validate-pr-governance`

Check omitido (no fallido, no PASSED): `Supabase Preview` — **skipped**.

## Estado Git/GitHub

```text
rama técnica = refactor/backend-modularization-m18-pricing-infrastructure
base técnica = 877185f161ea292313ab457a6fe4b0907eb6e28b
commit técnico = 0dfa1388d41dea4214fa48c9765a1d625c0396ed
PR #1519 = creado
checks CI = completados (5 successful · 1 skipped · 0 failing · 0 pending)
squash merge = completado (SHA 5f99b5f40e08ea8929be869374f1d154f740153f, 2026-07-21T14:17:16Z)
rama técnica = eliminada local y remotamente
main = sincronizado con origin/main y origin/HEAD en el squash SHA
working tree = limpio
M19 = no iniciado
```

## Estado final

```text
M18 mergeado y cerrado (PR #1519, squash SHA 5f99b5f40e08ea8929be869374f1d154f740153f, 2026-07-21)
persistencia (db-pricing) y cache público movidos a features/pricing/infrastructure/ (canónicos)
paths legacy = shims de un único export * (vivos hasta M19)
rutas admin/public byte-idénticas en M18
guard de infraestructura pricing activo (11/11)
Fase D abierta
M19 (thin rutas admin+public) = siguiente milestone, no iniciado
```
