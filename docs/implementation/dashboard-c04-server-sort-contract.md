# C04 · Contrato server-side de ordenamiento (prerrequisito backend-only)

## Baseline

- Base: `main` / `origin/main` en `cf70dc4185d1fbaa65474d5e8f0773f4839d54cb` (#1821, resolución contractual de C04).
- Rama: `feat/dashboard-c04-server-sort-contract-v2`, creada desde esa base. Sin commit.
- Preservados: los untracked `frontend/AGENTS.md` y `frontend/CLAUDE.md`, los 5 stashes y el worktree principal.
- Riesgo: **R2**. Toca un endpoint y su query. Nico lo autorizó exclusivamente como prerrequisito de C04 (§7.8 del rector).

## Trabajo local previo

La rama local `feat/dashboard-c04-server-sort-contract` (`dff443d4`) se usó sólo como referencia (prior art). No se hizo merge, rebase ni cherry-pick.

| Campo | Valor |
|---|---|
| Base | `21971134` |
| Adelante / detrás de `main` | 1 / 3 |
| Archivos | 28 |
| Endpoints | 6: Auditoría, Clínicas, Intentos fallidos, Informes admin (workflow), Logística rutas y visitas |
| Helper | `parseListSortQuery` / `resolveListSortOrder` en `server/lib/list-pagination.ts` |

Esta fase reduce el alcance a **un endpoint**. La nota «Helper compartido» explica por qué no hay helper genérico.

## Scope

**Incluye:** `GET /api/admin/clinics`. Agrega los parámetros opcionales `sort` y `direction`: los transporta, los parsea, los tipa, los valida, los allowlistea y los aplica en el `ORDER BY`. Incluye sus tests causales y la realineación del censo M48.

**No incluye:**
- frontend (C04 UI, `aria-sort`, iconos, `api.ts`);
- C05, C08+;
- DB schema, migraciones, índices, dependencias, `package.json`, lockfile;
- auth, cookies, sesiones, CSP, rate limits, CI y workflows;
- cualquier otro endpoint.

## Censo (sobre `main @ cf70dc41`)

| Superficie | Ruta / repositorio | Orden por defecto | Paginación | Sort hoy | Decisión |
|---|---|---|---|---|---|
| Clínicas admin | `admin-clinics.fastify.ts` → `listAdminClinicsQuery` → `admin-clinics-repository.ts` | `name asc, id asc` (total) | `limit` 1–100 (50), `offset` 0–100 000, `total` por `count(*)` sobre el mismo WHERE | no | **Seleccionada** |
| Auditoría admin | `admin-audit.fastify.ts` → `db-audit.ts` | `created_at desc, id desc` dentro de un template `sql\`\`` | servidor, `total` | no | Descartada: el ORDER BY vive en SQL template y el frontend depende de la URL de S1 (`<form method="get">`), el contrato más delicado (§17, R5) |
| Informes admin (workflow) | `admin-report-workflow.fastify.ts` → `db-report-workflow.ts` | `upload_date desc, created_at desc, id desc` | `limit` ≤ 21, `hasMore` sin total; join con clinics | no | Descartada: no hace falta para desbloquear C04; es el piloto de C17 |
| Usuarios y roles | `admin-users-roles.fastify.ts` → `admin-users-roles-repository.ts` | dos consultas (admin y luego clinic) por `username`, con offset particionado | servidor | no | Descartada: el orden global entre dos tablas exige reescribir la paginación |
| Sesiones | `admin-sessions.fastify.ts` → `db-admin-sessions.ts` | tres tablas por `created_at desc` sin desempate, `fetchLimit` por tabla y merge | servidor | no | Descartada: merge multi-tabla y sin desempate |
| Intentos fallidos | `admin-failed-login-alerts.fastify.ts` → `db-admin-failed-login-alerts.ts` | `created_at desc, id desc` | `limit` 1–100, `total` | no | Descartada: no hace falta para desbloquear C04 |
| Logística rutas | `logistics-route-plans.fastify.ts` → `db-logistics.ts` | `service_date desc, id desc` | `limit` ≤ 100, sin total; tenant por clínica | no | Descartada: tenant scoping y paginación sin total |
| Logística visitas | `logistics-field-visits.fastify.ts` → `db-logistics.ts` | `created_at desc, id desc` | `limit` ≤ 100, sin total; tenant por clínica | no | Descartada (ídem) |
| Tokens admin / clínica | `admin-report-access-tokens`, `report-access-tokens`, `admin-particular-tokens` → repositorios | `created_at desc` **sin desempate** | `limit` ≤ 100, sin total; el frontend usa ventana / «Cargar más» | no | Descartada: orden no total y el frontend es una ventana |
| Informes clínica | `reports.fastify.ts` → `report-query-repository.ts` | `created_at desc` | `limit` ≤ 100, sin total; el frontend usa una ventana de 100 | no | Descartada: ventana acotada |

Ninguna ruta de `main` aceptaba parámetros de orden.

## Adopter frontend recomendado (fase 4)

**Clínicas admin** (`AdminClinicsManagementCard`). Es una tabla real con paginación servidor y `total`. Tiene un único filtro (`search`) sin contrato de URL. Las columnas «Clínica» (`name`) y «Fechas» (`createdAt`) son inequívocas. No hay tenant scoping (es un listado global admin) y el riesgo funcional es bajo.

## Contrato de query

| Parámetro | Valores | Obligatoriedad |
|---|---|---|
| `sort` | `name` · `createdAt` | opcional, pero junto con `direction` |
| `direction` | `asc` · `desc` | opcional, pero junto con `sort` |

Los nombres no tenían convención previa en el repositorio, así que se eligieron `sort` y `direction`.

**Política ante entrada inválida: rechazo explícito**, con 400 y `{ success: false, error }`, siguiendo el patrón de `limit`/`offset` de la misma ruta. El listado no se consulta.

| Caso | Error |
|---|---|
| `sort` fuera de la allowlist, vacío, repetido (array) o con mayúsculas distintas | `Query inválida. sort no permitido.` |
| `direction` distinta de `asc`/`desc` | `Query inválida. direction debe ser asc o desc.` |
| Sólo uno de los dos | `Query inválida. sort y direction deben enviarse juntos.` |

Nunca se degrada en silencio a otro orden. El orden de evaluación es: autenticación admin (401) → `limit`/`offset` (400) → `sort` (400).

## Allowlist

Hay dos allowlists y un test exige que coincidan:
- **Dominio** (`server/features/clinics/domain/clinic-management-validation.ts`): `ADMIN_CLINICS_SORT_KEYS` y `ADMIN_CLINICS_SORT_DIRECTIONS`, más `parseAdminClinicsListSort`. Usa uniones literales derivadas de las listas. No hay `any`.
- **Repositorio** (`admin-clinics-repository.ts`): `ADMIN_CLINICS_LIST_ORDER` mapea cada clave pública a un `ORDER BY` total escrito con columnas Drizzle (`clinics.name`, `clinics.createdAt`, `clinics.id`). El resolver usa `Object.hasOwn` y lanza un error si la clave o la dirección no está mapeada, de modo que tampoco aceptan `constructor` ni `__proto__`.

El cliente nunca nombra una columna. No hay `sql.raw`, `sql.identifier` ni interpolación.

## Semántica de orden global

Todo ocurre en una sola sentencia:

```
WHERE (búsqueda) → ORDER BY (variante allowlisted) → LIMIT → OFFSET
```

La consulta de `total` usa el mismo WHERE sin orden. No se reordena nada en JS después de paginar. Esto lo verifican un test y un guard.

## Desempate y estabilidad

| Variante | ORDER BY |
|---|---|
| `name asc` (= default histórico) | `name asc, id asc` |
| `name desc` | `name desc, id desc` |
| `createdAt asc` | `created_at asc, id asc` |
| `createdAt desc` | `created_at desc, id desc` |

`id` es la PK única, así que cada variante es un orden total. El desempate va en la misma dirección que la clave primaria de orden: invierte exactamente la variante ascendente y conserva el default histórico. No se fijó `id asc` de forma universal.

## Paginación

`limit` (1–100, default 50) y `offset` (0–100 000, default 0) se parsean igual que antes y llegan al repositorio sin cambios. El backend no reinicia el `offset` al cambiar el orden; volver a la primera página corresponde a la fase 4 (frontend).

## Comportamiento legacy

Sin `sort`/`direction`:
- el route llama al listado con exactamente `{ limit, offset, search? }`, sin clave `sort`;
- el SQL emitido es idéntico byte a byte al legacy (`… order by "clinics"."name" asc, "clinics"."id" asc limit $1`, también con búsqueda y `offset`).

## Seguridad

- La autenticación admin se evalúa antes del sort: sin sesión se responde 401 y no se consulta, aun con un sort válido.
- El listado admin de clínicas no tiene tenant scoping; no cambian permisos ni auth.
- El payload es idéntico: mismos campos, tipos, status y `content-type`. El sort no agrega metadata.
- Las columnas ordenables no son sensibles (no hay `contact_email` ni datos de usuarios).

## Performance

`clinics` es una tabla administrativa chica. El default histórico ya ordena por `name` sin índice, y `created_at` tiene el mismo costo. No se agregaron índices ni migraciones. No se detectó `BLOCKED_BY_INDEX_REQUIREMENT`.

## Helper compartido

No se creó. La regla exige al menos dos endpoints con el mismo parsing, y aquí hay uno solo. El parser vive en el dominio Clinics y el mapeo de columnas en su repositorio. Cuando aparezca un segundo adopter (C17+), se podrá extraer `direction` a `server/lib`.

## Tests

| Capa | Archivo | Cobertura |
|---|---|---|
| Dominio | `test/unit/domain/clinics/clinic-management-validation.test.ts` | allowlist exacta; sin parámetros → `null`; 4 combinaciones válidas; par obligatorio; 14 claves inválidas (incluye `id desc`, `passwordHash`, `name; DROP TABLE clinics`, `constructor`, `__proto__`, array); 8 direcciones inválidas |
| Request | `test/integration/adapters/controllers/admin-clinics.fastify.test.ts` | params legacy exactos sin sort; 4 combinaciones válidas llegan tipadas con payload y `content-type` idénticos; 12 entradas inválidas → 400 sin consultar; 401 sin sesión |
| Query | ídem | SQL legacy exacto; ORDER BY total por variante; allowlist dominio = repositorio; WHERE, parámetros, `limit`, `offset` y `total` idénticos con y sin sort; claves no mapeadas nunca llegan al SQL; orden global antes de paginar sobre un dataset sintético de 7 filas con empates en `name` y `created_at`, en páginas de 3 |
| Arquitectura | `test/architecture/clinics-infrastructure-boundary-guard.test.ts` | un único `.orderBy(...)` en la secuencia `where → orderBy → limit → offset`; sin `.sort`/`.reverse`/`toSorted` post-paginación; sin `sql.raw`/`sql.identifier`; columnas del allowlist ⊆ {`name`, `createdAt`, `id`}; `sort`/`direction` entran sólo por el parser de dominio; el cliente frontend de clínicas todavía no envía orden |

**Prueba de orden global.** No hay Postgres local, así que el test no ejecuta la consulta contra una DB. Evalúa el `ORDER BY` y los `LIMIT`/`OFFSET` *exactos que emite Drizzle* sobre el dataset sintético, con la semántica de Postgres (ordenar el conjunto filtrado y después cortar). Exige:
- 0 duplicados y 0 omisiones entre páginas;
- que ningún par de filas distintas empate;
- que cada fila de una página posterior ordene después de todas las anteriores.

Las fences existentes de `dashboard-b11-workspace-header.test.ts` siguen cubriendo el frontend: `aria-sort` ausente en `frontend/src`, tokens C05 congelados y C08+ ausente.

## Mutation proof

Cada mutación fue temporal; el archivo se restauró desde una copia en memoria.

| Mutación | Resultado |
|---|---|
| 1. sort ignorado | KILLED (4) |
| 2. ASC/DESC invertido | KILLED (2) |
| 3. allowlist de dominio eliminada | KILLED (2) |
| 4. clave arbitraria aceptada en el repositorio (fallback silencioso) | KILLED (2) |
| 5. reordenar en JS después de paginar | KILLED (1) |
| 5b. ORDER BY fijo en SQL | KILLED (3) |
| 6. desempate eliminado | KILLED (2) |
| 7. default histórico alterado | KILLED (2) |
| 8. filtro alterado por el sort | KILLED (1) |
| 9. `offset` alterado por el sort | KILLED (2) |

**10/10 KILLED.**

## Realineación causal

El censo M48 congela las LOC exactas del backend (`test/architecture/backend-modularization-m48-final-certification.test.ts` y `docs/implementation/m48-backend-modularization-final-certification.md`). Se realineó en el mismo PR sin debilitarlo:

| Área | Antes | Después |
|---|---|---|
| `server/features` | 16 983 | 17 092 |
| `server/routes` | 21 174 | 21 189 |
| Clinics | 2 638 | 2 747 |
| Total | 46 186 | 46 310 |

La cantidad de archivos no cambió.

## Validación

Ver el reporte de cierre del PR. Los gates siguen AGENTS §6 para backend: tests dirigidos → `pnpm validate:local` → `lint:backend`. `db:migrate` no aplica (no hay schema). `security:public-surface` es NOT_RUN porque no se tocó superficie pública del frontend.

## Riesgo residual

- La prueba de orden global evalúa el SQL emitido, no una ejecución real en Postgres (no hay DB local). La semántica `ORDER BY → LIMIT/OFFSET` de una sola sentencia es estándar de Postgres.
- La colación de Postgres para `name` puede diferir del orden de bytes, pero no afecta la totalidad del orden ni la estabilidad (las garantiza `id`).

## Rollback

Revertir el PR. No hay datos, schema ni migraciones que revertir. Los clientes que no envían `sort` no notan diferencia.

## Validación post-merge (fase 3)

- **Base:** `main` = `origin/main` = `7d3066250652bc63f9625c6a58058628dcd70cfa`, el merge commit de PR #1822 (MERGED el 2026-10-05). Las fuentes C04 no tienen diff entre el head del PR (`470f957a`) y el merge.

**Contrato en `main`:**
- allowlists sincronizadas;
- `where → orderBy → limit → offset` en una sola query;
- sin `sql.raw`, `sql.identifier` ni `.sort()`/`.reverse()`/`toSorted` post-paginación;
- `server/lib` sin cambios.

**Paridad del SQL legacy.** El SQL de `buildAdminClinicsListQuery` sin `sort` es byte a byte igual al de la query literal de `listAdminClinics` en `cf70dc41` (antes de #1822), incluido el `total`. Se verificó en 5/5 casos: vacío; `limit`/`offset`; búsqueda; `limit` 500, `offset` 999 999 y búsqueda con espacios; `limit` 0, `offset` −5 y búsqueda vacía.

| Gate | Estado |
|---|---|
| Dominio | PASSED 76/76 |
| Integración de ruta y query de clínicas | PASSED 25/25 (10 C04) |
| Guard de infraestructura Clinics | PASSED 22/22 |
| Guard de dominio Clinics | PASSED 12/12 |
| M48 | PASSED 35/35, sin drift |
| `admin-clinics-query-service` | PASSED 3/3 |
| Contratos db, auth y paginación pesada admin | PASSED 15/15, 3/3 y 5/5 |
| `pnpm typecheck` / `pnpm typecheck:test` | PASSED / PASSED |
| `pnpm lint:backend` | PASSED: 0 errores, 45 warnings. El único warning en clínicas es `ENV` sin uso en `admin-clinics.fastify.ts:8`, idéntico en `cf70dc41` e introducido en `f94a347b` |
| `pnpm build` | PASSED |
| `pnpm validate:local` | FAILED por precondición ambiental. 4 810 tests, 4 808 pass, 1 skip; la única falla es `e2e-global-03b-authoritative-auth-boundary`, que aborta al importar porque exige la DB aislada `portal_vetneb_ci`. Es el mismo resultado que antes del merge; los 12 tests C04 pasaron en esa corrida |
| Postgres real | BLOCKED (no hay DB local). La evidencia aceptada es la evaluación del SQL emitido (ver «Riesgo residual») |
| GitHub, sobre el merge commit | `validate-backend`, `backend-heavy-validation`, `detect-backend-impact`, `generate-sbom`, `test-coverage-diagnostic` y Supabase Preview: SUCCESS |
| Mutation proof | Se reutiliza la evidencia de 10/10 porque las fuentes y los tests C04 no cambiaron después del PR; no se re-ejecutó |

## Estado

| Ítem | Estado |
|---|---|
| `C04_SERVER_SORT_PREREQUISITE` | `COMPLETE` |
| `C04_SERVER_SORT_MAIN_VALIDATION` | `PASSED` |
| `C04_FRONTEND` | `READY_FOR_IMPLEMENTATION` (adopter recomendado: Clínicas) |
| C04 | `IN_PROGRESS_PREREQUISITE_COMPLETE`. No está COMPLETE: falta su PR frontend |
| NEXT_SLOT | C04 frontend |
| C05 | BLOCKED (sin cambios) |
