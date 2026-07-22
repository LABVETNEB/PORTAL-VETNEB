# M22 · Mover la persistencia de Public Professionals a `infrastructure/`

## Base exacta

- **Rama base:** `refactor/backend-modularization-m22-public-professionals-infrastructure`.
- **HEAD base:** `56f081ec0b3f82b7b0dbd62d58641937d3d92b83`.
- **Working tree inicial:** limpio. Índice limpio.
- **AGENTS aplicable:** únicamente `AGENTS.md` raíz (censo `git ls-files`: 1 archivo).
- **Milestone:** Fase E — **M22** (persistencia del contexto Public Professionals).
- **Gestor:** PNPM · **Shell:** Windows PowerShell 5.1.
- **Fuente movida (baseline R0):** `server/db-public-professionals.ts` —
  `git hash-object` `d705b7c0169c63824c91068df605bc319cd402fd`, **756 líneas**,
  **0** call-sites `.transaction(`.

## Autorización R2

Autorización explícita **R2** acotada al scope estructural de M22 descrito en la
tarea: split de la persistencia a `server/features/public-professionals/infrastructure/`
detrás de un barrel, con shim legacy de compatibilidad. Sin autorización Git/GitHub:
stage, commit, push, PR, checks `--watch`, resolución de threads y merge son
`[MANUAL-NICO]`. Sin autorización para tocar dependencias, lockfiles, schema,
migraciones, CI, rutas HTTP, rate limit ni frontend.

## Documento rector

- [Backend Enterprise Modularization Program — Audit](../audit/backend-enterprise-modularization-program-audit.md)
  filas 53–54 → **M22**: "Query service, sin application pesada" · "Repo
  `db-public-professionals` (756); SQL-drift-guard fija el SQL → alinear in-PR".
- [Shared / Lib Boundary Inventory (ARCH-3)](../architecture/shared-lib-boundary-inventory.md)
  §4.1 y §6: `db-public-professionals.ts` (756) → `features/public-professionals/infrastructure/`,
  `.transaction(` = 0, SQL-drift-guard de histopatología, MOVE.
- [Backend Domain Boundary ADR (ARCH-2)](../architecture/backend-boundary-adr.md):
  reglas de dependencia por capa (infrastructure implementa persistencia sobre el
  motor real; no importa routes/http/application).

## Auditoría previa (R0)

Censo `git grep`/`git ls-files` sobre el HEAD base:

- **Consumidores runtime del path legacy `../db-public-professionals.ts`:**
  - `server/routes/clinic-public-profile.fastify.ts:27` — `import type { UpsertClinicPublicProfileInput }`.
  - `server/routes/clinic-public-profile.fastify.ts:212` — `await import(...)` (usa
    `getClinicPublicProfileByClinicId`, `buildClinicPublicProfileResponse`,
    `evaluateClinicPublicProfilePublication`, `MIN_PUBLIC_PROFILE_QUALITY_SCORE`,
    `patchClinicPublicProfile`, `removeClinicPublicAvatar`, `syncClinicPublicSearch`).
  - `server/routes/public-professionals.fastify.ts:302,307` — `await import(...)`
    (usa `searchPublicProfessionals`, `getPublicProfessionalByClinicId`).
- **Tests que leen la fuente por path literal (`process.cwd()`):**
  `public-professionals-db-contract`, `-histopathology-eligibility`,
  `-histopathology-sql-drift` — asertan constantes/queries SQL que migran al
  repository.
- **Guard de dominio** ancla `runtimeConsumerFile = "server/db-public-professionals.ts"`
  (test #9) como consumidor del domain barrel.
- **`public-professionals-source-boundaries.test.ts`** inspecciona la **ruta**
  (import dinámico del shim) y su harness; queda verde sin cambios porque las
  rutas no se tocan.
- Los 9 tests de fixtures y los invariantes de query-parsing/serialización/
  registro/rate-limit **no** leen la fuente `db-*`; no se afectan.

## Matriz de consumidores

| Consumidor | Tipo | Efecto en M22 |
| --- | --- | --- |
| `routes/public-professionals.fastify.ts` | dynamic import del shim | intacto (sigue consumiendo el shim) |
| `routes/clinic-public-profile.fastify.ts` | `import type` + dynamic import del shim | intacto |
| `public-professionals-db-contract.test.ts` | `readFileSync` por path | reapuntado al repository canónico |
| `public-professionals-histopathology-eligibility.test.ts` | `readFileSync` por path | reapuntado al repository canónico |
| `public-professionals-histopathology-sql-drift.test.ts` | `readFileSync` por path | reapuntado al repository canónico |
| `public-professionals-domain-boundary-guard.test.ts` | ancla de path (#9) | reapuntado al repository canónico |
| `public-professionals-source-boundaries.test.ts` | inspecciona la ruta | intacto (verde) |

## Exports preservados

Superficie pública canónica idéntica a R0, re-exportada por el barrel de
infrastructure y por el shim legacy (live bindings vía `export *`):

- **Mapping:** `MIN_PUBLIC_PROFILE_QUALITY_SCORE` (= 75), tipo
  `UpsertClinicPublicProfileInput`, `evaluateClinicPublicProfilePublication`,
  `buildClinicPublicProfileResponse`.
- **Repository:** `getClinicPublicProfileByClinicId`, `upsertClinicPublicProfile`,
  `patchClinicPublicProfile`, `syncClinicPublicSearch`, `removeClinicPublicAvatar`,
  `getPublicProfessionalByClinicId`, `searchPublicProfessionals`.

## SQL y mapping preservados

- SQL de elegibilidad **byte por byte** en el repository:
  `LAST_HISTOPATHOLOGY_REPORT_DELIVERED_AT_SQL`, `PROFESSIONAL_BANK_ELIGIBILITY_SQL`,
  `PROFESSIONAL_BANK_ELIGIBILITY_DRIZZLE_SQL` (`sql.raw(\n  PROFESSIONAL_BANK_ELIGIBILITY_SQL,`
  intacto), filtros `is_public`/`is_search_eligible`, websearch/unaccent/trigram,
  pesos y boosts, `ORDER BY`, `LIMIT` máx. 50, offset, count con el mismo `whereSql`.
- Elegibilidad por histopatología (historial + fallback, autor admin) sin cambios.
- Mapping puro (normalización, scoring, mensajes en español, `searchText`,
  publicación, upsert/patch, remoción de avatar) copiado verbatim; sólo cambió la
  profundidad de import (`../../../../drizzle/schema.ts` como **tipos**).
- **Cero transacciones** preservadas (0 en R0 → 0 en el repository).

## Árbol antes / después

```text
# Antes
server/db-public-professionals.ts   (756 LOC: imports + SQL + mapping + repo)

# Después
server/db-public-professionals.ts   (shim: 1 re-export → infrastructure barrel)
server/features/public-professionals/
  domain/            ... M21 intacto ...
  infrastructure/
    README.md
    index.ts                              (barrel: 2 re-exports)
    public-professionals-mapping.ts       (puro; tipos del shared kernel)
    public-professionals-repository.ts    (Drizzle + pgClient.unsafe + SQL)
```

## Estrategia de shim

`server/db-public-professionals.ts` queda como **shim mínimo**: un único
`export * from "./features/public-professionals/infrastructure/index.ts";`, sin
lógica, wrappers, aliases ni defaults. Preserva toda la superficie anterior por
live bindings. Necesario en M22 porque las rutas todavía consumen el path legacy;
su reapunte o retiro corresponde a **M23/M24**. El shim de dominio de M21
(`server/lib/professional-bank-eligibility.ts`) permanece intacto (expira en M24).

## Allowlist exacta (12 paths: 6 A + 6 M, 0 D, 0 R)

```text
A  server/features/public-professionals/infrastructure/README.md
A  server/features/public-professionals/infrastructure/index.ts
A  server/features/public-professionals/infrastructure/public-professionals-mapping.ts
A  server/features/public-professionals/infrastructure/public-professionals-repository.ts
A  test/architecture/public-professionals-infrastructure-boundary-guard.test.ts
A  docs/implementation/m22-public-professionals-infrastructure.md
M  server/db-public-professionals.ts
M  server/features/public-professionals/README.md
M  test/architecture/public-professionals-domain-boundary-guard.test.ts
M  test/unit/contracts/public-professionals/public-professionals-db-contract.test.ts
M  test/unit/contracts/public-professionals/public-professionals-histopathology-eligibility.test.ts
M  test/unit/contracts/public-professionals/public-professionals-histopathology-sql-drift.test.ts
```

No hay archivos eliminados ni renombrados: el move se representa como archivos
canónicos nuevos más shim legacy, para preservar compatibilidad temporal.

## Denylist (no tocado)

Rutas HTTP, métodos, paths, status codes, payloads, rate limiting y su store,
auth, sesiones, cookies, CORS, CSP, headers, logging, storage, Supabase, schema,
migraciones, datos, `server/db.ts`, `drizzle/**`, `migrations/**`, `supabase/**`,
`frontend/**`, `package.json`, `frontend/package.json`, `pnpm-lock.yaml`,
`pnpm-workspace.yaml`, dependencias, `.github/**`, CI, workflows, `scripts/**`,
`AGENTS.md`, `server/routes/**`, `server/fastify-app.ts`,
`server/lib/public-professionals-rate-limit.ts`,
`server/lib/professional-bank-eligibility.ts`, M23, M24. No se crea capa
`application/`, ni puertos especulativos, ni interfaces de repository sin
consumidor real, ni clases/factories/DI/event bus.

## Guard de infraestructura

`test/architecture/public-professionals-infrastructure-boundary-guard.test.ts`
(node:test + lectura de fuente + parser de imports; verificación por path
resuelto): existencia de la capa/repository/mapping/barrel con código real;
superficie pública exacta; barrel = 2 re-exports; repository importa el domain
barrel (no archivos internos) y el mapping por path interno; repository sólo usa
`drizzle-orm`/`server/db.ts`/`drizzle/schema.ts`/domain barrel/propia capa;
repository no importa routes/application/fastify/auth/`server/lib`; mapping sin DB
ni runtime de Drizzle ni fastify/routes/auth/env/CORS/supabase ni `process`/`fetch`;
SQL y mapping en una única copia canónica; repository con 0 transacciones; shim
legacy = 1 re-export exacto que resuelve al barrel; rutas siguen consumiendo el
shim y no importan internos de infrastructure; M23 no iniciado (sin `application/`,
shim vigente); auto-test del parser.

## Tests actualizados

- `public-professionals-domain-boundary-guard.test.ts` — `runtimeConsumerFile`
  reapuntado al repository canónico; test #9 verifica que el repository importa el
  domain barrel y no el shim legacy.
- `public-professionals-db-contract.test.ts`, `-histopathology-eligibility.test.ts`,
  `-histopathology-sql-drift.test.ts` — `readSource` reapuntado a
  `server/features/public-professionals/infrastructure/public-professionals-repository.ts`;
  aserciones SQL sin cambios.

## Validaciones (estados canónicos)

Ver el reporte de ejecución. Dirigido `pnpm exec tsx --test` sobre el guard de
dominio, el guard de infraestructura nuevo, source-boundaries, los cuatro
contratos de public-professionals; luego `pnpm validate:local` y
`pnpm security:public-surface`. Estados: `PASSED` / `FAILED` / `NOT_RUN` /
`NOT_AVAILABLE` / `BLOCKED`. Frontend lint/typecheck/build, Playwright,
`pnpm audit`, `db:migrate` y schema quedan `NOT_RUN` (M22 no toca esas
superficies).

## Riesgo residual

- Bajo. El split preserva la superficie pública y el SQL byte por byte; el guard
  de infraestructura fija la frontera y la unicidad de la copia canónica.
- El shim legacy convive con el canónico hasta M23/M24 (estado transitorio
  aceptado por el programa). Referencias documentales al path legacy en docs
  rectores/auditoría son baseline histórico y no se modifican aquí.

## Rollback lógico

Revertir el PR restaura `server/db-public-professionals.ts` con su lógica propia y
los paths de lectura de los tests. No hay cambios de schema, migraciones, rutas ni
contratos HTTP que compliquen el revert; cada archivo nuevo es independiente.

## Estado

```text
M21 cerrado
M22 listo para integración
Fase E abierta
M23 no iniciado
```

El closeout documental posterior registrará la metadata real de merge (PR, SHA,
timestamp, checks); este PR técnico no inventa esos datos.
