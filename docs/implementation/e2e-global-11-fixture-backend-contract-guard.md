# E2E-GLOBAL-11 — Contrato fixture ↔ Fastify y guard de doble declaración

Fase `E2E-GLOBAL-11` del programa `LIMPIEZA E2E` (`docs/audit/LIMPIEZA E2E.md`, Anexo B.7). Residual
atacado: **R-02** (P0, deriva fixture↔backend sin guard) y el contrato de §23 "ninguna ruta declarada
a la vez en `page.route` y en el fixture". Cambio test-only: un guard arquitectónico nuevo más este
documento. Sin cambios en producto, backend, fixture, specs, catálogo ni workflows.

## Estado base

| Ítem | Valor |
|---|---|
| Rama | `main` (sin rama nueva: Git queda para Nico) |
| HEAD base | `70a9719bf4eddd59ed1c2c0667ec43e1e6fe8788` (`docs(e2e): reconcile CI runbook and E2E sources of truth (GLOBAL-10B) (#1731)`) |
| `origin/main` tras `git fetch --prune` | `70a9719b` (= HEAD) |
| Working tree inicial | limpio salvo `frontend/AGENTS.md` y `frontend/CLAUDE.md` untracked (generados por `next dev`), 5 stashes preexistentes; nada tocado |
| `AGENTS.md` aplicables | sólo el raíz (único tracked; `frontend/AGENTS.md` es untracked generado, no es contrato) |
| Clasificación | R1 (edición local test-only in-scope) |
| Scope primario (`pr-governance`) | `tests` (`test/**`); `docs/**` es soporte → sin mixed-scope |

## Scope

Incluido: `test/architecture/e2e-mock-backend-contract.test.ts` (nuevo) y este documento.

Excluido (deliberadamente): `frontend/src/**`, `server/**`, `frontend/e2e/**` (fixture, specs,
helpers, catálogo), DB, migraciones, snapshots, `package.json`, `pnpm-lock.yaml`, workflows,
`docs/audit/LIMPIEZA E2E.md` (ver *Registro documental*), y los demás residuales de B.7 (objetivo
<40 min de GLOBAL-09, R-15, R-19, R-20, P1-7, cobertura SEO/profesionales/offline, comentarios
stale, push paths de Frontend CI, B15/B16).

## Skills utilizadas

| Skill pedida | Disponible como | Uso |
|---|---|---|
| `senior-web-end-to-end-global-vetneb` | `vetneb-web-end-to-end-global` | arquitectura Playwright, fixture, `page.route`, catálogo/capas |
| `senior-bugs-errors-optimization-routes-vetneb` | `vetneb-bugs-errores-optimizacion-rutas` | censo Fastify (prefijos, métodos, status, payloads), divergencias fixture ↔ backend |
| `senior-large-scale-codebase-analysis-vetneb` | **no disponible** | el censo multi-superficie se hizo inline |

## Problema

La suite E2E nunca arranca Fastify. Hay dos mecanismos de mock:

- el servidor HTTP compartido `frontend/e2e/fixtures/admin-populated-api-server.mjs` (:3107), que ven
  los server components y también los fetch de cliente que pasan por el rewrite `/api` de Next;
- `page.route`, que sólo ve lo que sale del navegador.

Ningún test comparaba el fixture con el contrato real de Fastify, y ningún guard impedía que una ruta
tuviera payload en los dos mecanismos a la vez.

## Auditoría previa (inventario reproducible)

### Fixture (`admin-populated-api-server.mjs`)

Despacho por `url.pathname`: comparación literal, `Set.has`, y una regex para métricas. Sólo el
bloque admin (`handlePopulatedRequest`) exige `GET` (405 al resto); las ramas de clínica, app-version
y las sintéticas no miran el método.

| Método efectivo | Ruta | 2xx | Claves top-level 2xx | Query leída |
|---|---|---|---|---|
| ANY | `/__e2e/health` | 200 | `ok` | — |
| ANY | `/api/app-version` | 200 | `success, appVersion, clientMinVersion, forceUpdate, displayVersion` | — |
| ANY | `/api/e2e/session-boundary` | 200 (+401/403) | `ok, role` | — |
| ANY | `/api/reports` | 200 (+401 expirada) | `reports, total, totalPages, limit, offset` | `query, status, studyType, limit, offset` |
| ANY | `/api/reports/search` | 200 | ídem | ídem |
| ANY | `/api/logistics/field-visits` | 200 (+401) | `visits` | `limit, offset` (A03) |
| ANY | `/api/logistics/route-plans` | 200 (+401) | `routePlans` | `limit, offset` (A03) |
| ANY | `/api/logistics/route-plans/:id/metrics` | 200 (+404) | `metrics` | — |
| GET | `/api/admin/audit-log` | 200 | `success, count, items, pagination, filters` | `event, limit, offset` |
| GET | `/api/admin/study-tracking/notifications` | 200 | `success, count, notifications, pagination` | `limit, offset` |
| GET | `/api/admin/system/health` | 200 | `success, status, version, checkedBy, services, runtime, health` | — |
| GET | `/api/admin/particular-tokens` | 200 | `success, count, particularTokens, pagination, filters` | `limit, offset, clinicId` |
| GET | `/api/admin/report-workflow` | 200 | `success, reports, pagination` | `limit, offset` |
| GET | `/api/admin/users-roles` | 200 | `success, users, total, totalPages, limit, offset, totals, checkedBy` | `limit, offset, query, search, userType, role, status, dataset` |

Respuestas globales de simulación de sesión (fuera de cualquier ruta): 404 "populated session
required", 404 fallback y 405.

### Fastify

- Fuente autoritativa: `server/fastify-app.ts` → `app.register(plugin, { prefix })` → `app.<verbo>("<literal>")`
  de cada plugin. 35 plugins, **218 rutas** (125 sin contar `OPTIONS`); ningún path no literal,
  `app.route`, `app.all` ni registro anidado.
- Contratos reutilizables: los genéricos de ruta (`app.get<{ Querystring: … }>`) y los tipos de los
  `reply.code(n).send(body)`. No existe OpenAPI ni un registry de rutas; los guards existentes
  (`security-critical-route-surface-registry`, `security-mutation-permission-surface`, …) usan
  listas manuales por archivo, no un censo global.
- Las 12 rutas no sintéticas del fixture tienen un `GET` equivalente en Fastify.

### `page.route`

74 llamadas en 32 archivos tracked de `frontend/e2e` (47 globs, 25 predicados, 2 patrones dinámicos
resueltos por objeto de definición: `StubDefinition` de A03 y `DashboardGeometryMock` de A02). No hay
`routeFromHAR` ni `routeWebSocket`.

La coincidencia textual no implica doble fuente:

- 5 call sites sobre `/api/admin/users-roles` (4 specs CAP + `REWRITE_USERS_ROLES_HIGH_VOLUME`) sólo
  reescriben la query (`dataset=high-volume`) y hacen `route.continue`: el fixture sigue siendo la
  única fuente. Es el patrón correcto y **no** cuenta como doble declaración.
- Sí la cuentan los handlers que pueden hacer `fulfill`/`abort`: **23 pares (ruta, archivo)** sobre 11
  rutas del fixture, en 7 archivos (tabla en *Resultados*).

### Divergencias encontradas

| Divergencia | Clasificación | Evidencia |
|---|---|---|
| `/__e2e/health`, `/api/e2e/session-boundary` sin ruta Fastify | sintéticas (intencionales) | sondas de readiness y de E2E-GLOBAL-03 |
| `GET /api/logistics/field-visits`: el fixture envía `visits` y Fastify envía `fieldVisits` | **defecto de contrato de producto** | `server/routes/logistics-field-visits.fastify.ts:932` envía `fieldVisits`; `frontend/src/lib/api.ts:1447-1451` lee `res.visits ?? []`; el fixture (`:1278`, `:1297`) copia la expectativa del frontend. Contra el backend real `getLogisticsFieldVisits` devuelve siempre `[]`. Ningún test de backend ni de frontend ancla esa clave. |
| `/api/reports` y `/search`: `limit`, `offset` top-level | campo sólo del fixture | Fastify los anida en `pagination`; ningún lector del frontend los usa |
| `/api/admin/users-roles`: `totalPages` | campo sólo del fixture | ausente del snapshot Fastify y de `AdminUsersRolesSnapshot` |
| `/api/reports`: query `query`, `studyType` | input sólo del fixture | filtro compartido con `/search`; `getReports` no los envía |
| `/api/admin/users-roles`: query `query`, `status` | input sólo del fixture | Fastify declara `limit, offset, role, search, userType`; `getAdminUsersRoles` no los envía |
| `/api/admin/users-roles`: query `dataset` | opt-in de test (intencional) | CAP-A1, lo añaden sólo los rewrites E2E |
| Ramas del fixture sin guard de método | latente | contestan cualquier verbo con payload de lectura; ningún consumidor usa otro verbo |

## Arquitectura del guard

`test/architecture/e2e-mock-backend-contract.test.ts` corre en `pnpm test` / `validate-backend`.
Es estático y determinista: no levanta servidores, no usa DB, red, navegador, runtime de Playwright
ni credenciales.

Nombre: el guard `public-professionals-fixture-naming-consistency-invariants` prohíbe `fixture` en
el nombre de cualquier `.test.ts` fuera de ese dominio. Por eso el archivo se llama `e2e-mock-…`
(cubre ambos mecanismos de mock) y ese guard no se tocó.

### Fuentes de verdad

| Superficie | Fuente | Técnica |
|---|---|---|
| Rutas Fastify | `server/fastify-app.ts` + plugins | AST (TypeScript compiler API, ya usado por los guards M44–M48) |
| Contrato por ruta Fastify | genérico `Querystring` y tipo del body de cada `send` 2xx | `TypeChecker` sobre un `Program` con la `tsconfig.json` raíz |
| Rutas del fixture | ramas `if` que despachan por `url.pathname` | AST + `TypeChecker` (`allowJs`) |
| `page.route` | archivos de `frontend/e2e` | AST + intérprete estático de tres valores |
| Recorrido de `frontend/e2e` | `listTrackedSourceFiles` (`test/helpers/tracked-source-files.ts`) + overrides explícitos | inventario canónico `git ls-files` (E2E-STAB-006) |

No hay ninguna lista manual de endpoints. Las dos únicas listas del guard son ledgers de
excepciones y se verifican en ambos sentidos.

### Algoritmo A — reconciliación fixture ↔ Fastify

1. Censo Fastify: por cada `register` se exige un `prefix` literal y un import local. Por cada
   `app.<verbo>` se exige un path literal. Se normaliza `prefix + path`: sin barra final y `:x` →
   `:param`. `app.route`, `app.all`, un `register` anidado o sin prefijo literal, y la sintaxis
   `*`/`(…)` hacen fallar el guard.
2. Censo del fixture: el guard reconoce `url.pathname === "<lit>"`, `SET.has(url.pathname)` y
   `url.pathname.match(/^…$/)` (regex acotada a `\/`, `(\d+)`, `([^/]+)` y literales). El método sale
   del `request.method === "X"` de la condición o de un guard `request.method !== "X"` + `return`
   previo en la misma función; si no hay ninguno, el método es `ANY`. Todo `url.pathname` o
   `request.method` que no quede contabilizado hace fallar el guard ("unrecognized request dispatch").
3. Para cada ruta del fixture se busca el mismo `(método, template)` en Fastify, con `ANY`
   reconciliado como `GET`. Si no existe, la violación es `route <método> <template>`.
4. Si existe, se comparan tres dimensiones:
   - **status 2xx**: cada status 2xx del fixture tiene que estar entre los literales 2xx del
     handler. Si Fastify usa un status no literal (`health.statusCode`), su payload queda separado
     de los contratos de status literal.
   - **claves top-level del body 2xx**: las del fixture se comparan contra el payload de su mismo
     status. El checker resuelve primero; si el JS infiere `any`, una resolución estructural acotada sigue
     ternarios, spreads, `const` y funciones locales con parámetros ligados.
   - **query**: las claves que lee el fixture, directamente o en funciones locales llamadas desde la
     rama, ⊆ las claves del `Querystring` declarado. Si Fastify no declara un tipo cerrado (p. ej. el
     `Record` de audit-log), la dimensión no se compara.
5. Las violaciones se comparan contra `DECLARED_DIVERGENCES`, entrada por entrada: una violación nueva
   falla, y una entrada que ya no se observa falla por stale. Cada entrada tiene una clasificación
   cerrada y un motivo de al menos 20 caracteres.

### Algoritmo B — doble declaración

1. Por cada `X.route(matcher, handler)`, el matcher se resuelve según su forma:
   - glob literal: `**` y `*`; `?`, `{}`, `[]` o un glob relativo hacen fallar el guard;
   - regex literal;
   - predicado `(url) => …`, que se evalúa;
   - `const` string del archivo (con un único literal para ese nombre);
   - `obj.prop` de una variable de bucle o parámetro: se liga a cada objeto literal del archivo que
     tenga todas las propiedades que la llamada usa sobre esa variable (tipado estructural).
   Si nada de eso resuelve el matcher, el guard falla.
2. Para cada ruta del fixture se derivan witnesses de los pathname literales del matcher y de las
   clases de segmento parametrizado; un pathname literal intersecta el template cuando sus segmentos
   fijos coinciden y cada `:param` admite cualquier segmento concreto. El intérprete evalúa el matcher
   y ejecuta el handler con lógica
   de tres valores. Modela `route.request().method()`, `request.url()`, `new URL(…)`, `.pathname`,
   `===`/`!==`, `&&`/`||`/`!`, `startsWith`/`endsWith`/`includes`, `regex.test`, `if`/`else`,
   `return` y los helpers locales o importados que reciben `route`. Una condición desconocida
   explora ambas ramas: es un análisis *may*, conservador.
3. El call site cuenta sólo si algún camino termina en `fulfill`/`abort`, incluidos los de callbacks
   anidados. `continue` y `fallback` no cuentan.
4. Los pares `(ruta, archivo)` observados se comparan contra `LEGACY_DOUBLE_DECLARATIONS`, par por
   par: un par nuevo falla y un par que desaparece falla por stale.

## Exclusiones declaradas

- Los status no 2xx no se comparan: 404/405/401 son simulación de sesión del fixture, y Fastify emite
  sus fallos de auth fuera de los handlers.
- Las claves anidadas de los payloads no se comparan: varios tipos Fastify son
  `Record<string, unknown>` y generarían falsos positivos.
- Las rutas `ANY` del fixture se reconcilian como `GET`. La permisividad de verbo queda como riesgo
  latente, no como violación.
- Los payloads de `page.route` no se reconcilian con Fastify: no es parte de R-02.
- No se contempla la sesión de cada spec: una ruta cuenta como doble declaración aunque el spec use la
  sesión por defecto, con la que el fixture responde 404.

## Mutation proofs (en memoria)

Cada prueba construye un workspace con overrides. El `CompilerHost` sirve el texto mutado, y los
archivos E2E virtuales entran al censo. **Ningún archivo tracked se escribe ni se restaura.**
`mutate()` exige que el ancla exista, así que ninguna prueba es vacua.

| # | Mutación | Resultado esperado y observado |
|---|---|---|
| 1 | Rama `/api/admin/e2e-ghost` en el fixture | `route GET /api/admin/e2e-ghost` — PASS |
| 2a | Guard admin `!== "GET"` → `!== "PUT"` | exactamente 6 `route PUT /api/admin/…` — PASS |
| 2b | `app.get` → `app.post` en `app-version.fastify.ts` | `route ANY /api/app-version` = "Fastify only exposes POST" — PASS |
| 3a | `/api/admin/report-workflow` → `…-workflows` | `route GET /api/admin/report-workflows` — PASS |
| 3b | Regex `\/metrics$` → `\/metric$` | `route ANY /api/logistics/route-plans/:param/metric` — PASS |
| 4a | Spec virtual con `page.route("**/api/admin/audit-log**", fulfill)` | par nuevo exacto — PASS |
| 4a-param | `page.route("**/api/logistics/route-plans/8601/metrics", fulfill)` | detecta `:param/metrics`; `…/8601/history` no coincide — PASS |
| 4b | Stub en bucle (`stub.urlPattern` + guard de método/pathname) | par nuevo sobre `/api/admin/system/health` — PASS |
| 4c | Catch-all `**/api/**` con helper local que hace fulfill | 13 pares (todas las rutas `/api` del fixture) — PASS |
| 4d | Mismo glob con `route.continue()` | sin pares (control negativo) — PASS |
| 4e | Predicado exacto con fulfill sólo para `POST` | sin pares (control de método) — PASS |
| 4f | Glob en una `const` local del test | par nuevo sobre `/api/admin/study-tracking/notifications` — PASS |
| 5a | Catch-all de `visual-regression-stress` neutralizado | 11 entradas stale — PASS |
| 5b | `totalPages` quitado del fixture | stale `response-key GET /api/admin/users-roles totalPages` — PASS |
| 5c | Entrada de ledger para una ruta nunca servida (ambos ledgers) | stale — PASS |
| 5d | Clasificación inválida, clave malformada y motivo corto | las 3 rechazadas — PASS |
| 6a | `routePlans` → `plans` | `response-key ANY /api/logistics/route-plans plans` — PASS |
| 6b | audit-log 200 → 201 | `status GET /api/admin/audit-log 201` — PASS |
| 6c | `searchParams.get("clinicId")` → `"clinic"` | `query-key GET /api/admin/particular-tokens clinic` — PASS |
| 7a | Fastify 200 `{ items }` y 201 `{ id }` | 200 `{ id }` falla; 200 `{ items }` y 201 `{ id }` pasan — PASS |
| 8a | Despacho `url.pathname.startsWith(…)` | throw "unrecognized request dispatch" — PASS |
| 8b | Matcher de `page.route` no resoluble | throw "unresolvable page.route matcher" — PASS |
| 8c | `app.all()` en un plugin | throw "app.all() is not censused" — PASS |

## Resultados

- Reconciliación A: 14 rutas en el fixture. 12 reconcilian con Fastify y 2 son sintéticas. Quedan
  13 divergencias declaradas: 2 sintéticas, 1 defecto de producto, 5 campos sólo del fixture, 4
  inputs sólo del fixture y 1 opt-in de test.
- Doble declaración B: 23 pares congelados como deuda §23. **No** están justificados por arquitectura.

| Ruta del fixture | Archivos con `fulfill` |
|---|---|
| `GET /api/admin/particular-tokens` | `admin-mobile-core-modules-no-scroll`, `admin-tokens-mobile-toolbar-layout`, `helpers/dashboard-adaptive-limit-matrix`, `dashboard-accessibility-keyboard`, `dashboard-detail-text-integrity`, `visual-regression-stress` |
| `GET /api/admin/users-roles` | `admin-mobile-ops-modules-no-scroll`, `admin-tokens-mobile-toolbar-layout`, `dashboard-accessibility-keyboard`, `dashboard-detail-text-integrity`, `visual-regression-stress` |
| `GET /api/admin/report-workflow` | `admin-mobile-core-modules-no-scroll`, `helpers/dashboard-adaptive-limit-matrix`, `dashboard-detail-text-integrity`, `visual-regression-stress` |
| `GET /api/admin/audit-log`, `…/study-tracking/notifications`, `…/system/health`; `ANY /api/reports`, `…/search`, `…/logistics/field-visits`, `…/route-plans`, `…/route-plans/:param/metrics` | `visual-regression-stress` (catch-all `**/api/**`) |

El catch-all de `visual-regression-stress` declara payloads para rutas que consumen server components
(`/api/reports`, logística). Para esos fetch, `page.route` no intercepta nada: es exactamente el caso de
§5 del audit ("page.route NO lo ve").

## Validaciones

| Gate | Estado | Detalle |
|---|---|---|
| `node --test test/architecture/e2e-mock-backend-contract.test.ts` | PASSED | 12/12 (4 sobre el árbol real + 8 mutation proofs), ~6,3 s aislado |
| Guards acoplados (`public-professionals-fixture-naming-consistency-invariants`, `test-support-layout-contract`, `tracked-source-inventory`) | PASSED | tras el renombrado del guard |
| `pnpm validate:local` → `typecheck` | PASSED | |
| `pnpm validate:local` → `typecheck:test` | PASSED | |
| `pnpm validate:local` → `test` | FAILED (ambiental) | 4.576 tests: 4.574 pass, 1 skipped, 1 fail. El único fallo es `e2e-global-03b-authoritative-auth-boundary.fastify.test.ts` ("requiere DATABASE_URL o SUPABASE_DB_URL"): preexistente, sin DB local; en CI corre con Postgres |
| `pnpm build` (aparte, porque la cadena se cortó en `test`) | PASSED | `dist/` ignorado |
| `git diff --check` + whitespace de los archivos nuevos | PASSED | |
| `pnpm security:public-surface`, lint/typecheck/build frontend, Playwright | NOT_RUN | no se tocó `frontend/**` ni superficie pública |
| `db:migrate` | NOT_RUN | sin cambios de schema |

## Registro documental

`LIMPIEZA E2E.md` no se modificó. Las fases 01–10A se documentaron en su acta y sólo 10B consolidó
el Anexo B. Además R-02 no se cierra en esta fase. La próxima consolidación debería actualizar B.5
(R-02), B.6 (§23) y B.7 con el estado de este documento.

## Criterio de cierre de R-02

| Criterio | Estado |
|---|---|
| Reconciliación automática fixture ↔ backend | ✔ |
| Sin listas manuales duplicadas evitables | ✔ (sólo ledgers de excepciones, verificados en ambos sentidos) |
| Detecta drift de método y de path | ✔ (mutaciones 1–3) |
| Detecta doble declaración fixture + `page.route` | ✔ (mutación 4) |
| Mutation proofs negativos | ✔ (8 pruebas) |
| Determinista y sin servicios externos | ✔ |
| Sin cambios de backend/producto | ✔ |
| Scope test-only | ✔ |
| Validaciones | ✔ salvo el fallo ambiental preexistente de 03B |
| Excepciones mínimas y **justificadas por arquitectura** | ✘ — los 23 pares de §23 y 10 de las 13 divergencias son deuda, no arquitectura. Eliminarlos exige tocar `frontend/e2e/**` (fixture/specs) y `frontend/src/lib/api.ts`, otros scopes |

**R-02: PARTIAL.** El riesgo "deriva sin guard" queda cubierto por un contrato fail-closed y el
ledger sólo puede achicarse. La deriva existente no desapareció: quedó enumerada. Incluye un defecto
real de producto (`fieldVisits`).

## Riesgos residuales

1. **P1 de producto (fuera de scope):** `getLogisticsFieldVisits` lee `visits` y el backend envía
   `fieldVisits`, así que en producción las visitas de logística llegarían vacías. Hay que corregirlo
   en el frontend y realinear el fixture en el mismo cambio (el acoplamiento justifica un PR
   coordinado), y después retirar la entrada `PRODUCT_CONTRACT_DEFECT`.
2. Deuda §23 (23 pares). Scope propuesto `E2E-GLOBAL-11B` (test-only, `frontend/e2e/**`): pasar los
   overrides al patrón de rewrite de query que ya usa CAP-A1, o sacar del fixture las rutas admin que
   sólo consumen client components; quitar el catch-all de logística y reports de
   `visual-regression-stress` o justificarlo; recortar los campos e inputs sólo del fixture.
3. Mantenimiento fail-closed: un `app.register` sin `prefix` literal (p. ej. un plugin sin rutas), un
   helper de `page.route` con patrón parametrizado o un despacho nuevo en el fixture hacen fallar el
   guard hasta extenderlo. Es deliberado.
4. Análisis *may*: una condición desconocida en un handler cuenta como posible `fulfill`. Puede dar un
   falso positivo, nunca un falso negativo.
5. Costo: ~5,6 s aislado (un `Program` TypeScript de ~880 archivos más 11 programas mutados que
   reutilizan los `SourceFile`; las sondas de `page.route` reutilizan el programa base). Dentro de `pnpm test`, en paralelo, el wall total no cambió de forma
   apreciable (~37 s con typecheck).

## Rollback

Borrar `test/architecture/e2e-mock-backend-contract.test.ts` y este documento. No hay otros
consumidores ni cambios de runtime.

## Estado final

- Archivos nuevos: `test/architecture/e2e-mock-backend-contract.test.ts`,
  `docs/implementation/e2e-global-11-fixture-backend-contract-guard.md`.
- Preservados sin tocar: `frontend/AGENTS.md`, `frontend/CLAUDE.md` (untracked) y los 5 stashes.
- Git/GitHub: no ejecutado (stage, commit, push y PR quedan para Nico).
