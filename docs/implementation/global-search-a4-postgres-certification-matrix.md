# Global Search A4 — matriz de certificación PostgreSQL (migración 0031)

| Campo | Valor |
| --- | --- |
| Estado | **EJECUTADA — C1–C10 PASSED** el 2026-11-11 sobre PostgreSQL 17.10, base aislada `portal_vetneb_ci`, árbol de trabajo sin commit sobre `40684ba6`. Acta: `global-search-a4-postgres-certification-acta.md` |
| Spec ejecutable | `test/integration/app/global-search-states-postgres.fastify.test.ts` (rehúsa correr fuera de `localhost/127.0.0.1` + `/portal_vetneb_ci`) |
| Acta | `global-search-a4-postgres-certification-acta.md` (entorno, digests de los archivos certificados, comandos y resultados observados) |
| Datos | sólo sintéticos (`gss-<etiqueta>-<pid>-<epoch>`), eliminados en `t.after` por cascada desde `clinics` y `admin_users` |
| Relacionados | `global-search-drive-a-canonical-query.md` (diseño y rollback), `drizzle/migrations/0031_global_search_states.sql` |

## Precondiciones de seguridad (todas, antes de ejecutar)

1. Autorización R3 de Nico, por escrito, que nombre la base `portal_vetneb_ci` y esta matriz.
2. `DATABASE_URL` y `SUPABASE_DB_URL` apuntan a `postgresql://…@localhost|127.0.0.1…/portal_vetneb_ci` (el spec lo verifica y falla si no).
3. Base **vacía de datos reales**: creada para CI, nunca un dump de staging o producción. Sin credenciales en el repositorio ni en el acta.
4. Rama = `feat/global-search-drive-parity-a`, commit exacto anotado en el acta (§17 de `AGENTS.md`).
5. Una sola tarea pesada a la vez (§8): sin build ni E2E en paralelo.
6. Evidencia sanitizada: el acta guarda estados y conteos, no cadenas de conexión ni hashes de sesión.

## Procedimiento

Terminal 1, con las dos variables de entorno ya apuntando a la base aislada:

```bash
pnpm db:migrate
node --test test/integration/app/global-search-states-postgres.fastify.test.ts
```

Para el ensayo de rollback fuera de la transacción del spec (C10, variante completa), sólo con autorización explícita y sobre la misma base:

```bash
psql "$DATABASE_URL" -c "BEGIN; DROP TABLE IF EXISTS global_search_states; SELECT to_regclass('global_search_states'); ROLLBACK;"
```

## Matriz

| # | Verificación | Dónde | Resultado esperado | Estado |
| --- | --- | --- | --- | --- |
| C1 | La migración 0031 se aplica (`pnpm db:migrate`) y es idempotente (`IF NOT EXISTS`) | `db:migrate` + subtest C1/C2 | tabla presente; segunda ejecución sin error | PASSED |
| C2 | Tabla, índices (`pkey`, sesión Clínica, sesión Admin, `expires_at`) y CHECK | subtest C1/C2 | los 4 índices, CHECK `surface_owner`, 2 FKs con `confdeltype = c` | PASSED |
| C3 | FK Admin y Clínica; dueño único | subtest C3 | hash inexistente → 23503; ambos, ninguno o cruzado → 23514 | PASSED |
| C4 | Caducidad lógica **antes** de la física; barrido sólo de lo vencido; TTL = mín(24 h, sesión); sesión vencida no guarda | subtest C4 | `find` = null con la fila aún presente; el barrido la borra y no toca otras sesiones; `save` con sesión vencida = null | PASSED |
| C5 | Cascada al eliminar la sesión (Clínica y Admin) | subtest C5 | 0 filas de la sesión borrada; las demás intactas | PASSED |
| C6 | Tope de 20 con 40 guardados concurrentes; mismo texto converge a un id | subtest C6 | exactamente 20 filas; ningún guardado falla; 1 id distinto para 10 iguales | PASSED |
| C7 | Aislamiento Clínica A/B, Admin y superficie cruzada con el mismo hash | subtest C7/C8 | `find` ajeno = null en los 3 casos | PASSED |
| C8 | Recuperación entre conexiones (otra instancia del repositorio) | subtest C7/C8 | mismo `{queryText, kinds}` | PASSED |
| C9 | Planes e índices (`enable_seqscan = off` en la transacción) | subtest C9 | lectura por id → `pkey`; barrido → `expires_at_idx`; por sesión → `clinic_session_idx` | PASSED |
| C10 | Ensayo de rollback | subtest C10 | `DROP` dentro de una transacción revertida; la tabla sigue existiendo | PASSED |

Costo SQL esperado por operación: `find` = 1 lookup por clave primaria (más filtros de sesión/superficie sobre una fila); `save` = 1 transacción con
1 lock asesor por sesión, 1 lectura de sesión, 1 borrado acotado (≤ 50 filas vencidas, `FOR UPDATE SKIP LOCKED`, índice `expires_at`), 1 borrado por
dueño, 1 lectura de ≤ 20 filas del dueño y 1 inserción. Crecimiento acotado: ≤ 20 filas por sesión viva; las de sesiones terminadas se van por cascada y
las vencidas con sesión viva por el borrado acotado de cada guardado y por el barrido de arranque (`preflight`).

## Cierre

Los 10 casos pasaron sobre la base aislada (9 tests: 1 raíz + 8 subtests que agrupan C1/C2 y C7/C8; dos ejecuciones consecutivas en verde, precedidas de una ejecución fallida por el fixture de `clinics`, corregido sin tocar el schema). El código certificado era un **árbol de trabajo sin commit** sobre `40684ba6`: la evidencia queda anclada por los digests SHA-256 del acta y debe revalidarse (recalcular digests; repetir el spec si alguno difiere) tras el commit.

Estado de la migración 0031: **PASSED en laboratorio aislado**. Sigue **no aplicada** a staging/producción: esa aplicación requiere autorización R3 propia. Los límites (rol de laboratorio, sin RLS, sin pooler productivo) están en el acta.
