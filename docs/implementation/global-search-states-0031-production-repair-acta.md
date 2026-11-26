# Acta de cierre — migración 0031 (`global_search_states`) en producción

| Campo | Valor |
| --- | --- |
| Estado de la incidencia estructural | **CLOSED / PASSED** |
| Certificación funcional asociada | **GO CON LIMITACIONES** — pendientes en [`global-search-states-production-certification-residual.md`](global-search-states-production-certification-residual.md) |
| Fecha de ejecución | 2026-11-25 (UTC) |
| Entorno | Producción: proyecto Supabase (ref `sbaf…bmr`), base `postgres`, PostgreSQL 17.6, compartida por los dos servicios backend de Render |
| Commit certificado | `0b0d6a13d82fdf798c87f4dc649690de17a7069f` (`main`) |
| Deploys en ejecución | backend A `dep-dc36g60m7kps73dbbhm0`; backend B `dep-dc36hqm7bikc73c93ldg`; frontend `dep-dc2stbu7bikc73887990` |
| Operador | agente de IA (Claude Code) bajo autorización R3 expresa de Nico; las credenciales del runner las ingresó Nico en su terminal |
| Alcance | Crear `public.global_search_states` según `drizzle/migrations/0031_global_search_states.sql`, revocar privilegios de `anon`/`authenticated` sobre esa tabla y verificar. Sin cambios en otras tablas, roles, RLS global, historial Drizzle, código ni despliegues |
| Identificador de incidencia | No existe issue de GitHub específica de 0031 (búsqueda del 2026-11-26). PR de origen: #1991 (migración), #1992 (endpoints), #1993 (frontend) |

Los documentos de la Entrega A (`global-search-drive-a-canonical-query.md`, el acta y la matriz PostgreSQL A4) describen la certificación **de laboratorio** del 2026-11-11 y su constancia de que 0031 no se había aplicado a staging ni producción. Siguen siendo correctos para esa fecha y no se reescriben; esta acta registra lo ocurrido después en producción.

## Síntoma

El arranque de ambos backends registraba `PREFLIGHT_CLEANUP_WARN` con `label=global_search_states` y `reason=table_missing`. Con la tabla ausente, las rutas de guardar y recuperar búsquedas responden 500 sanitizado (comportamiento reproducido con una prueba sin base de datos, no observado con sesión en producción); la búsqueda de registros no depende de la tabla.

## Causa

1. La tabla requerida por la aplicación no existía en producción (SQLSTATE `42P01`).
2. `drizzle.__drizzle_migrations` está desalineado: 19 filas y `max(created_at) = 1778300000000`, mayor que el `when` de todas las entradas del journal (0031: `1777132800000`). El migrador instalado sólo aplica una migración si la última registrada es anterior a ella, por lo que `drizzle-kit migrate` termina con éxito sin aplicar nada. Se reprodujo en laboratorio con un historial de la misma forma.

## Resolución

| Paso | Resultado |
| --- | --- |
| Ensayo previo en PostgreSQL local (réplica del esquema productivo, event trigger `ensure_rls`, rol propietario sin superusuario) | Aplicación, `lock_timeout`, precondiciones, postcondiciones, privilegios, rollback guardado y estructura idéntica a `db:migrate`: PASSED. Spec `global-search-states-postgres.fastify.test.ts`: 9/9 |
| Respaldo `20261125T052855Z` (fuera del repositorio; `pg_dump` custom de `public` y `drizzle`, 269 799 bytes) | `exit=0`; `pg_restore -l`: 587 entradas, 36 de datos |
| Restauración de prueba en base local descartable | PASSED: 35 tablas y 1312 filas, conteos iguales a producción tabla por tabla; base eliminada al terminar |
| Prechequeo productivo de sólo lectura (05:29:46Z) | PASSED: tabla ausente, sin objetos parciales, índices únicos en `token_hash` de ambas tablas de sesiones, `ensure_rls` activo, 35 tablas, sin transacciones abiertas ni bloqueos |
| Ejecución por el runner R3, única vez (≈05:34Z) | `exit=0`; `PRE OK`, `CREATE TABLE`, 3 `CREATE INDEX`, `POST OK`, `COMMIT` |
| Postchequeo del runner (05:34:23Z) | PASSED |
| Readback independiente (conector Supabase, sólo lectura) | PASSED, coincidente |
| Cierre del runner (trabajo `stop`, 11:47Z) | Proceso terminado, sin sesiones ni trabajos pendientes; aprobación usada archivada fuera de la cola |

**SQL ejecutado** — SHA-256 `2222FE0A0B8452087D4FCF9E7F3948159D4420FD766710335517FB6F66490DC8`: una transacción con precondiciones, el contenido literal de 0031, `REVOKE ALL` sobre la tabla nueva a `anon` y `authenticated`, y postcondiciones. El archivo y su rollback guardado (se niega a borrar si hay filas) se conservan fuera del repositorio. El rollback no se ejecutó en producción.

## Postcondiciones observadas

| Control | Resultado |
| --- | --- |
| Tabla y columnas (8) | PASSED |
| Índices (3) y clave primaria | PASSED |
| Claves foráneas a `active_sessions.token_hash` y `admin_sessions.token_hash`, `ON DELETE CASCADE` | PASSED |
| CHECK `global_search_states_surface_owner_check` | PASSED |
| RLS habilitado (por `ensure_rls`), sin `FORCE` | PASSED |
| ACL: sólo propietario y `service_role`; `anon` y `authenticated` sin privilegios | PASSED |
| Tablas en `public`: 35 → 36; historial Drizzle sin cambios (19 filas) | PASSED |
| Logs de PostgreSQL posteriores sin nuevos `42P01` | PASSED |
| `/health` de los servicios y rechazo 401 sin autenticación | PASSED |

No se reiniciaron servicios: las advertencias `table_missing` de arranques anteriores permanecen en los logs históricos.

## Riesgos excluidos de este cierre (siguen abiertos)

- Historial Drizzle desalineado: `db:migrate` continúa sin aplicar nada en esa base. Requiere una tarea de reconciliación propia.
- El rol de aplicación tiene `BYPASSRLS`; el aislamiento depende de la capa aplicativa.
- Validación real de `listV2` de Supabase Storage (SEC-09D/E/F).
- Pruebas funcionales residuales del superbuscador (documento enlazado arriba).

Este cierre no constituye una certificación de seguridad de la plataforma.
