# GLOBAL-SEARCH-3C · Presupuesto de solicitudes del superbuscador (backend)

## 1. Estado base

- Base: `origin/main` @ `c8f530a9` (#1972 fusionada; cursores backend #1971, frontend #1972).
- Rama: `feat/global-search-3c-rate-limiting`. Scope primario: backend runtime.
- Antes de este cambio `GET /api/search` y `GET /api/admin/search` no tenían límite: cada solicitud
  autenticada ejecutaba SQL de búsqueda (`ILIKE` + `unaccent`, sin índices trigram hasta 3D).

## 2. Auditoría previa

| Pieza | Hallazgo |
|---|---|
| `server/lib/rate-limit-store.ts` | Contrato `RateLimitStore`; adaptador persistente que guarda sólo `sha256(key)`. |
| `server/db.ts` (`login_rate_limits`) | `INSERT … ON CONFLICT (key_hash) DO UPDATE` con `CASE` de reinicio: atómico y compartido entre instancias (lock de fila). Sólo sumaba de a 1. |
| Contacto | Ya reutiliza `login_rate_limits` con otro espacio de claves: precedente de tabla compartida. |
| `cleanupExpired` | `DELETE` de todas las filas vencidas en cada consumo: aceptable en login, no en el camino caliente de búsqueda. |
| Fallo del store en contacto | La excepción sube y termina en 500 implícito; no había política declarada. |
| Frontend (#1972) | Ya distingue 429 (`throttled`, usa `Retry-After`) y 5xx (genérico con «Reintentar»). No requiere cambios. |
| CORS de búsqueda | No exponía `Retry-After` ni `RateLimit-*`. |

## 3. Patrón real de solicitudes

Cada solicitud HTTP ejecuta una consulta SQL **por categoría pedida** (`Promise.all` en `runSearch`).

| Origen | HTTP | SQL Clínica | SQL Admin |
|---|---|---|---|
| Barra: una por tecla tras 250 ms (todas las categorías, `limit=5`) | 1 | 3 | 5 |
| Abrir el diálogo en «Todo» | 3 / 5 | 3 | 5 |
| Recarga de «Todo» (ventanas de 25 por categoría) | ≤ 3 / ≤ 5 | ≤ 3 | ≤ 5 |
| Categoría única, página siguiente (cursor) | 1 | 1 | 1 |
| Volver a una página ya leída | 0 (memoria) | 0 | 0 |

Conclusión: el costo para PostgreSQL son las consultas de entidad, no las solicitudes. Una tecla de la
barra cuesta lo mismo que una recarga completa de «Todo».

## 4. Política

**Unidad = una consulta de categoría ejecutada.** El peso lo calcula `globalSearchQueryUnits` con el
mismo parser puro del caso de uso (`parseGlobalSearchQuery`); una consulta que el parser rechaza
cuesta 1, de modo que una ráfaga de 400 también se presupuesta.

| Actor | Ráfaga | Sostenida |
|---|---|---|
| Usuario de Clínica | 60 u / 10 s | 600 u / 10 min |
| Administrador | 100 u / 10 s | 1000 u / 10 min |

Justificación:

- Escribir 12 caracteres con pausas (≈ 12 sugerencias) y abrir el diálogo cuesta ≈ 39 u en Clínica y
  ≈ 65 u en Admin: entra en la ráfaga. Paginar rápido una categoría cuesta 1 u por página.
- Una sesión intensa de 10 minutos (búsquedas, filtros y paginado) se estimó en ≈ 300 u.
- La ventana sostenida limita la automatización a ≈ 1 consulta de entidad por segundo en Clínica y
  ≈ 1,7 en Admin.
- **Admin no se escaló automáticamente por categorías.** Medido (§8): el costo por consulta de entidad
  de Admin (sin filtro de clínica) fue ≈ 4,4 ms contra ≈ 3,6 ms en Clínica (≈ 1,2×). Los
  administradores son pocos y su ráfaga legítima es de 5 consultas por tecla; con 100 u la carga
  máxima por administrador es ≈ 0,44 s de SQL cada 10 s. Si 3D o datos productivos muestran otro
  costo por unidad, el ajuste es una constante.
- Se descartó el tope agregado por clínica de la propuesta inicial: con cobro en paralelo, un usuario
  abusivo consumiría la cuota de sus compañeros (DoS dentro del tenant), y la creación de cuentas de
  clínica ya está controlada por el administrador.

## 5. Arquitectura

- `server/lib/global-search-rate-limit.ts`: política, claves, headers y respuestas 429/503.
- `server/lib/rate-limit-store.ts`: `consume` acepta `units` opcional (por defecto 1). El store en
  memoria implementa `consume` atómico (síncrono); un store sin `consume` no puede cobrar más de una
  unidad y falla en lugar de subcontar.
- `server/db.ts`: `consumeRateLimitUnits`, el mismo upsert atómico sobre `login_rate_limits` con
  `count + units`. La SQL de `consumeLoginRateLimitAttempt` no cambia.
- Store de producción: tabla persistente compartida, **sin** `cleanupExpired` en el camino de búsqueda
  (las filas vencidas las barre la limpieza que ya corre en login y contacto).
- Rutas: el cobro va después de autenticar y antes de validar `clinicId`, parsear filtros o ejecutar
  SQL de búsqueda.

### Identidad y claves

```text
global-search:v1:clinic:<clinicId>:user:<clinicUserId>:<burst|sustained>
global-search:v1:admin:user:<adminUserId>:<burst|sustained>
```

- Derivada de la sesión validada (`auth.id`, `auth.clinicId`, `admin.id`), nunca de la query.
- Por **usuario**, no por sesión: otra pestaña o un segundo login comparten el presupuesto.
- No usa la IP. No incluye texto, filtros, categorías, el parámetro `clinicId` ni cursores.
- Se persiste sólo `sha256(clave)`; `surface`, `identifier_hash` e `ip_hash` quedan nulos.

### Concurrencia

- Cada ventana es un upsert con lock de fila: las solicitudes concurrentes, de una o varias
  instancias, se serializan; el contador devuelto ya incluye el cobro propio. No hay lectura previa,
  así que no hay carrera.
- Las dos ventanas se cobran en paralelo (un viaje a la DB). Una solicitud rechazada también suma:
  insistir no regenera presupuesto.
- Ventana fija: en el borde entre ventanas puede pasar hasta el doble de la ráfaga; lo acota la
  ventana sostenida.

### Respuestas

| Caso | Status | Headers | Body |
|---|---|---|---|
| Dentro del presupuesto | el de la búsqueda (200/400/403) | `RateLimit-Policy: 60;w=10, 600;w=600`, `RateLimit-Limit/Remaining/Reset` de la ventana más ajustada | sin cambios |
| Presupuesto agotado | 429 | lo anterior + `Retry-After` (reset más lejano entre las ventanas excedidas, ≥ 1) | `{success:false, error, requestId}` |
| Store inaccesible | 503 | `Retry-After: 5` | `{success:false, error, requestId}` |

- `Cache-Control: no-store` lo aplica el hook global de `/api/*` también a 429 y 503.
- 429 y 503 no setean cookies ni repiten texto, filtros o cursores. El log de fallo del store
  (`GLOBAL_SEARCH_RATE_LIMIT_STORE_ERROR`) registra `requestId`, superficie y el error sanitizado; no
  incluye claves, cookies ni la consulta.
- CORS de ambas rutas expone `RateLimit-*` y `Retry-After`.
- Sin sesión, la respuesta sigue siendo 401 y no consume presupuesto: el costo de ese camino es la
  búsqueda de sesión, no SQL de búsqueda.
- El contrato `cursor` / `nextCursor` no cambia. Las cuotas de login, contacto, tokens de informe y
  acceso público no cambian (módulos, stores y espacios de clave propios).

## 6. Hallazgo fuera de scope: fechas en SQL crudo con `postgres@4`

Desde #1962 (2026-11-05, `postgres` 3.4.9 → 4.0.0) el driver rechaza un `Date` ligado dentro de
SQL crudo de Drizzle (`sql\`… ${date}\``):
`ERR_INVALID_ARG_TYPE … Received an instance of Date`. Reproducido localmente contra PostgreSQL con
`consumeLoginRateLimitAttempt`, que usa ese patrón en el `CASE` del upsert; `incrementLoginRateLimitEntry`
usa el mismo patrón. Ambos sirven a login y contacto contra la DB real.

`consumeRateLimitUnits` liga las fechas como texto ISO con cast explícito
(`${date.toISOString()}::timestamp`), el mismo instante UTC que escribe el mapeador de la columna. Las
funciones de login no se tocan en esta PR: se reporta para un cambio propio.

## 7. Seguridad

| Verificación | Evidencia |
|---|---|
| Clínica A / Clínica B separadas | claves con `clinicId`; tests controller y PostgreSQL |
| Sesiones admin separadas por usuario | `admin:user:1` vs `admin:user:2` |
| Distintas sesiones del mismo usuario comparten presupuesto | segunda pestaña rechazada |
| Sin texto clínico ni consulta en la clave persistida | sólo hash; `like 'global-search:%'` = 0 filas |
| Sin cursores en errores | 429/503/400 no repiten el cursor |
| Sin evasión por consulta, filtros, categoría, `clinicId` o cursor | 7 variantes rechazadas sin SQL |
| Concurrencia de la misma sesión | 40 en paralelo → 20 pasan; 60 en dos instancias → 20 pasan |
| Fallo del store | 503 sin SQL; log sin datos sensibles |
| 401 / 403 / 400 | preservados; 401 no consume |

El presupuesto no reemplaza RBAC ni el aislamiento tenant: las rutas siguen resolviendo el tenant
desde la sesión y rechazando `clinicId` ajeno con 403.

## 8. Validación

Local, Windows, Node 24, PostgreSQL 17 con la DB sintética aislada `portal_vetneb_ci`
(`DATABASE_URL` explícito; no se leyó `.env`). Los archivos nuevos se simularon como trackeados para
los censos (`tracked-source-files.ts` vía hook de carga, sin `git add`).

| Gate | Estado | Detalle |
|---|---|---|
| `global-search-rate-limit.test.ts` (unit) | PASSED | 7/7 |
| `global-search-rate-limit.fastify.test.ts` (integración) | PASSED | 11/11, tres corridas seguidas |
| `global-search-rate-limit-postgres.fastify.test.ts` (PostgreSQL real) | PASSED | dos instancias, 60 concurrentes → 20 pasan |
| Suites de búsqueda existentes (controller, aislamiento PG, cursor PG) | PASSED | con store sin tope inyectado |
| `security-rate-limit-isolation-boundaries` | PASSED | 14/14, matriz realineada |
| Censos M45/M46/M48 y 01B | PASSED | LOC M48 y `process.env` 01B re-anclados con delta declarado |
| `pnpm validate:local` (typecheck, typecheck:test, test, build) | PASSED | exit 0; 5.589 pass, 0 fail, 1 skip preexistente (symlink sin privilegios en Windows) |
| `pnpm security:public-surface` | PASSED | exit 0; hallazgos `server-only` preexistentes en `frontend/src/proxy.ts` |
| `git diff --check` | PASSED | |
| `pnpm audit --prod` / `pnpm audit` | NOT_RUN | sin cambios de dependencias ni lockfile |
| `db:migrate` | NOT_RUN | sin migraciones |
| Frontend (lint, typecheck, build, E2E) | NOT_RUN | sin cambios de frontend |
| Evidencia staging | BLOCKED | sin autorización ni entorno staging para esta tarea |

### 8.1 Rendimiento (p50/p95, ms, 4.000 informes sintéticos)

| Medición | Aislada | Bajo la suite completa |
|---|---|---|
| «Todo» Clínica con presupuesto | 12,8 / 18,3 | 28,2 / 72,1 |
| «Todo» Clínica sin presupuesto | 10,8 / 16,1 | 26,8 / 64,0 |
| «Todo» Admin con presupuesto | 22,3 / 24,8 | 211,5 / 516,6 |
| «Todo» Admin sin presupuesto | 20,5 / 22,4 | 246,6 / 577,2 |
| Cobro del presupuesto (2 ventanas) | 0,3 / 0,7 | 0,5 / 0,6 |

- El cobro agrega ≈ 2 ms al p50 aislado (un upsert por ventana, en paralelo). p95 < 750 ms en todos
  los casos.
- Bajo la suite completa la latencia de Admin sube con y sin presupuesto por igual: Admin busca sobre
  todas las clínicas y comparte la DB con suites que siembran hasta 25.000 informes al mismo tiempo.
  No es costo del limitador.
- «Todo» en Admin hace 5 consultas por recarga y en Clínica 3; el presupuesto no cambia esa cantidad,
  sólo la limita por actor.

## 9. Riesgos residuales

- Ventana fija: hasta 2× la ráfaga en el borde entre ventanas.
- `reset_at` se calcula con el reloj de cada instancia; un desfase entre instancias corre la
  ventana unos segundos.
- El peso no distingue el costo real de cada categoría hasta 3D (índices trigram).
- Las solicitudes sin sesión no tienen límite propio (cuestan una búsqueda de sesión).
- Las cifras se midieron con 4.000 informes en PostgreSQL 17 local; los volúmenes productivos y 3D
  pueden justificar recalibrar.
- §6: el hallazgo de `postgres@4` en login/contacto sigue abierto fuera de esta PR.

## 10. Archivos

| Archivo | Riesgo |
|---|---|
| `server/lib/global-search-rate-limit.ts` (nuevo) | R2 |
| `server/lib/rate-limit-store.ts` | R2 |
| `server/db.ts` | R2 (función nueva; sin migración) |
| `server/features/global-search/domain/global-search.ts` | R2 (`globalSearchQueryUnits`, puro) |
| `server/routes/clinic-global-search.fastify.ts` | R2 |
| `server/routes/admin-global-search.fastify.ts` | R2 |
| `test/unit/infrastructure/global-search-rate-limit.test.ts` (nuevo) | R1 |
| `test/integration/adapters/controllers/global-search-rate-limit.fastify.test.ts` (nuevo) | R1 |
| `test/integration/app/global-search-rate-limit-postgres.fastify.test.ts` (nuevo) | R1 |
| `test/integration/adapters/controllers/global-search.fastify.test.ts` | R1 (store sin tope inyectado) |
| `test/integration/app/global-search-postgres-isolation.fastify.test.ts` | R1 (ídem) |
| `test/integration/app/global-search-cursor-postgres.fastify.test.ts` | R1 (ídem) |
| `test/architecture/security/security-rate-limit-isolation-boundaries.test.ts` | R1 (matriz realineada) |
| `docs/security/RBAC_MATRIX.md`, este documento | R1 docs |

## 11. No alcance

Frontend, paginación, deep links, Zero Scroll, entidades del buscador, migraciones/schema,
dependencias, workflows, configuración productiva, y la corrección de §6 en login/contacto.
