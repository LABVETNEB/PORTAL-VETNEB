# Global Search A4 — acta de certificación PostgreSQL (migración 0031)

| Campo | Valor |
| --- | --- |
| Entorno | PostgreSQL 17.10 (x86_64-windows), instancia local independiente de las demás, `127.0.0.1`, base aislada `portal_vetneb_ci`, rol no superusuario y sin `BYPASSRLS` |
| Fecha | 2026-11-11 (UTC, aproximada: las corridas ocurrieron entre ≈15:30 y ≈15:40) |
| Rama / commit base | `feat/global-search-drive-parity-a` @ `40684ba6` |
| Código certificado | **Árbol de trabajo sin commit** sobre `40684ba6` (35 archivos modificados y 16 untracked al momento de la prueba). No existe todavía un commit con este contenido; esta acta **no** certifica ningún commit futuro hasta recalcular los digests de abajo |
| Operador | agente de IA (Claude Code) bajo delegación expresa de Nico para la migración y el ensayo sobre la instancia aislada |
| Autorización | R3 acotada: sólo `portal_vetneb_ci` en esa instancia; sin Supabase remoto, staging ni producción; sin tocar otras instancias PostgreSQL |
| Matriz | `global-search-a4-postgres-certification-matrix.md` |
| Resultado | **C1–C10: PASSED** |

## Qué contiene la etapa 1 y qué se certificó

La Entrega A se publica en tres PRs (ver «Estrategia de publicación» en `global-search-drive-a-canonical-query.md`). Esta acta viaja en la **etapa 1**, cuyo contenido es sólo:
`0031_global_search_states.sql`, la entrada del journal, la tabla en `drizzle/schema.ts`, la aserción del journal en `admin-clinics-db-contract.test.ts` y los tres documentos de la entrega.

La certificación de abajo se ejecutó sobre el **árbol de trabajo completo** (etapas 1, 2 y 3 juntas, sin commit). Por eso:

- Lo que la etapa 1 aporta y que esta evidencia cubre directamente: la migración, el journal y la tabla (C1, C2, C3, C5, rollback y reaplicación).
- Lo que se ejercitó con código que **no** está en la etapa 1 y llegará en la etapa 2: el repositorio, los casos de uso y las rutas de estados (C4, C6–C9) y el propio spec PostgreSQL. Esa evidencia aplica a la etapa 2 cuando sus digests coincidan con los de abajo.
- La etapa 1 sola no tiene lectores ni escritores de la tabla: ningún código publicado la usa hasta la etapa 2.
- Ensayo previo de la etapa 1 aislada: `main` + sus siete archivos en un repositorio desechable, con `typecheck`, `typecheck:test`, suite completa (5668 pass, 0 fail) y `build` en PASSED. La evidencia que vale para el merge es la CI del head del PR.

## Ancla de integridad (SHA-256, primeros 16 hex)

Los archivos del recorrido certificado, tal como estaban en las corridas 2 y 3 (sin cambios entre ambas):

```text
82173c2e7273d869  drizzle/migrations/0031_global_search_states.sql
14e4f5fb10c72182  drizzle/migrations/meta/_journal.json
9354fce38eb59656  drizzle/schema.ts
6b23a707fb2bb2d2  server/features/global-search/infrastructure/global-search-state-repository.ts
ebbbcb8d7390f682  server/features/global-search/domain/global-search-state.ts
1d1323d5488e62e4  server/features/global-search/application/global-search-state-use-cases.ts
9b2c9205cb7dc1ee  server/routes/global-search-states.fastify.ts
2af6a2b29149d735  test/integration/app/global-search-states-postgres.fastify.test.ts
```

Tras el commit, recalcular con `sha256sum` sobre los mismos paths: si coinciden, la evidencia aplica al commit; si alguno difiere, hay que repetir el spec.

## Precondiciones verificadas (verificador de sólo lectura, transacción `READ ONLY`)

| Verificación | Observado |
| --- | --- |
| Servidor | primario (`pg_is_in_recovery = false`), puerto 55432, base `portal_vetneb_ci` |
| Instancia | proceso `postgres` con directorio de datos propio de la instancia de laboratorio; los listeners 5432 y 5433 corresponden a otros procesos y no se tocaron |
| Privilegios | `rolsuper`, `rolcreaterole`, `rolcreatedb`, `rolbypassrls`, `rolreplication` = false; dueño de la base; `CREATE` sobre `public` |
| Foráneos / réplica | 0 servidores foráneos, 0 FDW, 0 tablas foráneas, 0 user mappings, 0 publicaciones, 0 suscripciones, 0 slots, 0 `wal_senders`, 0 event triggers |
| Datos ajenos | base **vacía**: 0 relaciones, único esquema `public`, única extensión `plpgsql`, sin `drizzle.__drizzle_migrations` ni `global_search_states` |
| Destino | `DATABASE_URL` y `SUPABASE_DB_URL` idénticas y con destino local aislado; el spec rehúsa correr contra otro host o base |
| Limitación | el rol no puede leer `data_directory` (`42501`): la identidad de la instancia se confirmó por el sistema operativo (proceso y puerto), no desde la conexión |

## Migración

- Alcance: cadena completa **0000 → 0031** con `pnpm db:migrate` (equivale a `backend-ci`). 0031 depende del `token_hash` único de `active_sessions` y `admin_sessions` (0000/0003/0010) y el spec usa `clinics`, `clinic_users` y `admin_users`; un subconjunto divergiría del historial real. Sin `DROP`/`DELETE` relevantes en la cadena; `pgcrypto`, `pg_trgm` y `unaccent` son extensiones *trusted* de PG17 y las crea el dueño de la base.
- Primera ejecución: exit 0. Segunda ejecución: exit 0 (idempotente).
- Observado: **32** filas en el historial de migraciones, **28** tablas en `public`, extensiones `pg_trgm`, `pgcrypto`, `plpgsql`, `unaccent`.
- `global_search_states`: 8 columnas; índices `pkey`, `clinic_session_idx`, `admin_session_idx`, `expires_at_idx`; 2 claves foráneas con `ON DELETE CASCADE`; CHECK `surface_owner`.

## Ejecuciones del spec

Comando: `node --test --test-reporter=spec test/integration/app/global-search-states-postgres.fastify.test.ts` (stdin cerrado).

| # | Estado del árbol | Resultado |
| --- | --- | --- |
| 1 | antes de corregir el fixture | **FAILED**: `23502` (`clinics.clinic_id` NOT NULL) al insertar la clínica de prueba. Defecto del fixture, no de 0031 |
| 2 | fixture corregido | **PASSED**: 9 tests (1 raíz + 8 subtests, que agrupan C1/C2 y C7/C8), 0 fallos |
| 3 | tras el ensayo de rollback y la reaplicación de 0031 | **PASSED**: 9 tests, 0 fallos |

| 4 | dentro de `pnpm validate:local` (etapa `test`, con las variables apuntando a la base aislada) | **PASSED**: el spec no figura entre las fallas de esa corrida; sin residuos después (0 filas en `clinics`, `clinic_users`, `admin_users`, sesiones, `global_search_states` y `login_rate_limits`; 32 filas de historial) |

Por lo tanto: 9/9 en dos ejecuciones consecutivas, precedidas de una ejecución fallida por el fixture, y una cuarta ejecución dentro de la suite completa. El árbol no cambió entre las ejecuciones 2 y 4.

## Matriz C1–C10

| # | Verificación | Estado | Evidencia observada |
| --- | --- | --- | --- |
| C1 | 0031 aplicada e idempotente | PASSED | dos `db:migrate` con exit 0; subtest C1/C2 |
| C2 | tabla, índices, CHECK, FKs | PASSED | 4 índices, 1 CHECK, 2 FKs con `confdeltype = c` |
| C3 | FK y dueño único | PASSED | hash inexistente → `23503`; ambos, ninguno o cruzado → `23514` |
| C4 | caducidad lógica antes de la física; barrido; TTL; sesión vencida | PASSED | `find` = null con la fila presente; barrido sólo de lo vencido; `save` con sesión vencida = null |
| C5 | cascada al borrar la sesión | PASSED | 0 filas de la sesión borrada, las demás intactas (Clínica y Admin) |
| C6 | tope bajo concurrencia | PASSED | **40 escrituras simultáneas → 20 estados finales**, ninguna falla; 10 guardados iguales → 1 id |
| C7 | aislamiento Clínica A/B, Admin y superficie cruzada | PASSED | `find` ajeno = null en los tres casos |
| C8 | recuperación desde otra instancia del repositorio | PASSED | mismo `{queryText, kinds}` |
| C9 | planes con índices (`enable_seqscan = off` dentro de la transacción) | PASSED | id → `pkey`; barrido → `expires_at_idx`; por sesión → `clinic_session_idx` |
| C10 | rollback | PASSED | ver abajo |

C9 se verificó con `enable_seqscan = off`: demuestra que los índices son utilizables, no el plan que elegiría el optimizador con tablas grandes.

## Rollback y reaplicación (sobre la tabla propia de la migración, vacía)

1. Variante de la matriz (`BEGIN; DROP TABLE; ROLLBACK`): dentro de la transacción la tabla no existía; tras revertir seguía presente y el inventario de objetos de `public` quedó idéntico.
2. Ciclo real: `DROP TABLE IF EXISTS "global_search_states"` retiró exactamente sus 5 objetos (tabla, 3 índices, pkey); el resto del inventario quedó idéntico. Las tablas de sesión conservaron su unicidad de `token_hash` (`admin_sessions` como constraint, `active_sessions` como índice único `active_sessions_token_hash_uidx`).
3. Se reaplicó el SQL de 0031 sin modificaciones: inventario idéntico al previo, 2 FKs en cascada, 1 CHECK.
4. El historial de migraciones se mantuvo en 32 filas (la reaplicación fue del archivo SQL, no de `drizzle-kit`).
5. Se repitió el spec (ejecución 3): PASSED.

## Residuos de fixtures

Tras las ejecuciones y el rollback: `clinics` = 0, `clinic_users` = 0, `admin_users` = 0, `global_search_states` = 0.

## Corrección del fixture de `clinics`

`drizzle/schema.ts` no declara `clinics.clinic_id` (`varchar(50) NOT NULL UNIQUE` desde 0000), `storage_folder_path` ni `status`. El `INSERT` por Drizzle del spec fallaba contra una base creada por el historial de migraciones. Se cambió **sólo el fixture** del spec para insertar con SQL que incluye `clinic_id`, como ya hacen otros specs PostgreSQL del repositorio. No se modificó el schema. Análisis del riesgo: sección «Divergencia histórica de `clinics`» de `global-search-drive-a-canonical-query.md`.

## Comandos realmente ejecutados

```text
verificador de sólo lectura (script local, SELECT bajo BEGIN READ ONLY) → identidad, rol, esquema, foráneos
pnpm db:migrate                                                          → exit 0 (x2)
lecturas de verificación (historial, columnas, índices, restricciones)   → 32 / 28 / 4 / 2 FK / 1 CHECK
node --test … global-search-states-postgres.fastify.test.ts              → FAILED (fixture), PASSED, PASSED
ciclo de rollback (BEGIN/DROP/ROLLBACK; DROP real; reaplicar 0031)       → inventario idéntico
pnpm typecheck:test                                                      → exit 0
```

## Límites

- Evidencia de **una** instancia local de laboratorio con datos sintéticos; no sustituye staging ni producción.
- No se ejecutó RLS (fuera de alcance; el piloto RLS sigue bloqueado por `AGENTS.md` §14).
- El rol del laboratorio no es el rol productivo: privilegios y pooler de producción no están cubiertos.
- La migración **no** se ha aplicado a ningún entorno con datos reales. Su aplicación en staging/producción requiere autorización R3 propia y el orden de despliegue de la sección «Estrategia de publicación» de `global-search-drive-a-canonical-query.md`.
