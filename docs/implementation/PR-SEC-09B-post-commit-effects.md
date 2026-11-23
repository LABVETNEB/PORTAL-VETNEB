# SEC-09B — Efectos de la subida de informes dentro de la transacción (commit ambiguo)

Continuación de SEC-09 (#2030, `main@528e8050`), que garantiza la atomicidad de las escrituras de
PostgreSQL y la compensación segura de Storage, y deja un riesgo documentado: si `COMMIT` se aplica pero la
aplicación recibe un error, el informe queda persistido sin notificación ni auditoría. Este documento cubre
sólo ese riesgo. SEC-09 no se reabre.

## Estado base

`main@528e8050e79c3a2a3ead7a4742a9b24c42b0214c`. Rama `fix/report-upload-post-commit-effects`.

## Causa raíz (auditada en código real)

`uploadAdminReport` (`report-route-service.ts`) ejecutaba dos efectos de negocio **después** de que la
transacción terminara, dentro del mismo proceso y sin durabilidad propia:

1. `createStudyTrackingNotification` (notificación `report_delivered`), con `catch` que sólo registraba.
2. `writeAuditLog` (auditoría `report.uploaded`), cuya implementación (`server/lib/audit.ts`) **traga todos los
   errores**: ante un fallo registra `AUDIT_LOG_WRITE_ERROR` y devuelve normalmente.

Las dos son filas de la **misma base PostgreSQL** (`study_tracking_notifications` y `audit_log`): no hay
email ni sistema externo. Operaciones que podían quedar sin ejecutar tras un `COMMIT` que sí se aplicó:

| Escenario | Notificación | Auditoría | Lo que ve el cliente |
|---|---|---|---|
| `COMMIT` aplicado con ACK perdido (`ReportPersistenceCommitUnknownError`) | perdida | perdida | error |
| Caída o reinicio del proceso entre `COMMIT` y los efectos | perdida | perdida | sin respuesta |
| Fallo de la escritura de auditoría (sin ambigüedad) | enviada | **perdida en silencio** | éxito |
| Fallo de la notificación (sin ambigüedad) | perdida (registrada) | escrita | éxito |

La tercera fila es la más grave: no requiere ambigüedad y el cliente recibe éxito. El test PostgreSQL de
SEC-09 sobre el ACK perdido documentaba el hueco (`audits: []`, `notifications: []`).

## Alternativas evaluadas

| Alternativa | Veredicto |
|---|---|
| Transactional Outbox (tabla de eventos + procesador) | Descartada por ahora. Requiere tabla nueva, migración, procesador con reintentos, deduplicación y rollout. Sólo aporta valor para efectos **externos** a PostgreSQL, que hoy no existen. |
| Reconciliación posterior de commits ambiguos | Insuficiente sola: detecta el informe pero no repara los efectos perdidos. |
| **Escribir los efectos en la misma transacción (elegida)** | Sin schema ni migración. Si el commit se aplicó, los efectos existen; si no, no existe nada. |

Con efectos co-localizados, un `COMMIT` ambiguo deja de ser una pérdida: se puede **verificar** por el path
único del informe y, si está persistido, todos sus efectos ya están.

Extensión futura: si se agrega un efecto externo (email, webhook), ahí sí corresponde un outbox. Entregaría
**al menos una vez**, y los consumidores deberían deduplicar. Esta PR no afirma entrega exactamente una vez.

## Diseño

- `ReportUploadPersistenceScope` gana dos operaciones dentro de la transacción:
  - `createReportDeliveredNotification`: best-effort por **savepoint**. Si el `INSERT` falla se devuelve el
    fallo (sin abortar la transacción) y el servicio lo registra, igual que antes. Se centraliza en
    `createBestEffortNotificationWriter`.
  - `writeReportUploadedAudit`: falla **cerrado**. Escribe la misma fila que `createAuditLog`
    (`createAuditLogWithinTransaction`, extraída de `server/db-audit.ts` sin cambiar el comportamiento de
    `createAuditLog`). Si no puede escribirse, se revierte todo y se compensa el objeto.
- El orden dentro de la transacción es informe → seguimiento → notificación → auditoría, y la transacción se
  confirma recién después. Un fallo posterior revierte también la notificación.
- Commit ambiguo: `compensateUnpersistedUpload` consulta `findPersistedReportByStoragePath` (path único por
  subida).
  - Informe encontrado de la misma clínica ⇒ **`commit_confirmed`**: el servicio devuelve éxito (`201`) y no
    repite efectos, porque ya viajaron en la transacción.
  - No encontrado, de otra clínica o imposible de verificar ⇒ se conserva el objeto y se propaga el error
    (`preserved_commit_unknown`), como en SEC-09.
- Capas: la apertura de la transacción sigue en infrastructure; el `INSERT` de auditoría se invoca desde la
  composition porque el guard de adaptadores prohíbe auditoría en infrastructure.

## Hallazgo de review (P2): bloqueo por segunda conexión

La revisión automática detectó que `createAuditLogWithinTransaction` resolvía las columnas de `audit_log` con
`getAuditLogColumns()`, que consulta por el `pgClient` global. `pgClient` y `db` son el mismo cliente
`postgres(..., { max: ENV.databaseMaxConnections })`, cuyo mínimo es 1. Con `DATABASE_MAX_CONNECTIONS=1` y la caché
de columnas fría (por ejemplo, la primera subida tras reiniciar el servidor), la transacción de subida retiene la
única conexión y esa consulta espera otra: la subida se bloquea reteniendo sus escrituras y sus locks. Con un pool
mayor, varias subidas concurrentes con la caché fría podrían agotarlo del mismo modo.

Corrección: con una transacción en curso, las columnas se consultan por **esa** transacción
(`getAuditLogColumns(tx)`); el resultado se cachea igual. Regresión:
`test/unit/infrastructure/audit-log-transaction-columns.test.ts` usa un pool global de una conexión apuntado a un
puerto inalcanzable y una transacción simulada: si el código volviera a pedir una conexión al pool, fallaría de
inmediato. Sin la corrección, ambos casos fallan.

El spec PostgreSQL real no cubre este caso porque comparte proceso y caché entre sus pruebas; por eso la
regresión es un test unitario con la caché fría.

## Cambios de comportamiento (deliberados)

1. **La auditoría de la subida ya no se pierde en silencio**: si falla, la subida falla y se compensa. Acopla la
   disponibilidad de la subida a la de la tabla `audit_log`. Es la contraparte de no perder auditoría; la
   tabla comparte base con los informes.
2. **Un commit ambiguo que sí se aplicó responde éxito** en lugar de un error que invitaba a reintentar y
   duplicar el informe.
3. La notificación se crea dentro de la transacción: nunca existe una notificación de un informe revertido.

El contrato HTTP de éxito y de error no cambia, salvo el caso 2.

## Archivos

Producción: `server/db-audit.ts`, `server/features/reports/application/report-route-service.ts`,
`server/features/reports/composition/report-upload-persistence-composition.ts`,
`server/features/reports/composition/report-route-composition.ts`,
`server/features/reports/infrastructure/report-command-repository.ts`,
`server/features/study-tracking/infrastructure/study-tracking-repository.ts`.

Tests y guards realineados sin debilitarlos: servicio, adaptador de log, simulación con rollback, spec
PostgreSQL, ruta admin, y los guards de orden de auditoría, catch, inventarios y censo M48.

## Invariantes preservados

Aislamiento por clínica (token de otra clínica se rechaza antes de tocar Storage), compensación sólo del objeto
nuevo y del path exacto, orden Storage → persistencia, contrato HTTP, ausencia de path y de datos clínicos en
los logs, `requestId` validado como UUID v4, y el fallback `42703` de SEC-09.

## Pruebas

Se ejecutaron y pasaron (exit 0): `pnpm typecheck`, `pnpm typecheck:test`, `pnpm build` y 375 tests de los
archivos afectados (servicio, adaptador, simulación, contrato del repositorio, ruta admin, guards de
arquitectura y seguridad, y censo 01B), además del spec PostgreSQL real (14/14).

| Pedido | Cobertura |
|---|---|
| 1. Commit exitoso y efectos normales | servicio, simulación, PostgreSQL |
| 2. Commit aplicado con pérdida del ACK | servicio, simulación, ruta HTTP (`201`), PostgreSQL |
| 3. Commit realmente revertido | simulación (`before_apply`), servicio y **PostgreSQL real** (la transacción se revierte de verdad: no queda ningún efecto y el objeto se conserva) |
| 4. Caída del proceso después del `COMMIT` | **por construcción**: los efectos ya están en la transacción confirmada; no hay efecto posterior que perder |
| 5. Reintento de una operación ya persistida | simulación y PostgreSQL: crea otro informe, sin duplicar efectos del primero (no hay idempotencia HTTP). Tras un commit ambiguo revertido, el reintento crea cada efecto una sola vez |
| 6. Procesamiento duplicado de eventos | **No aplica**: no hay procesador asíncrono ni eventos |
| 7. Fallo temporal de la notificación | servicio, simulación y **PostgreSQL real**: un `22001` genuino dentro del savepoint deja la transacción usable; el informe y la auditoría se confirman y no hay notificación |
| 8. Fallo temporal de la auditoría | servicio, simulación y PostgreSQL: revierte todo y compensa. Con un error real de PostgreSQL (`22001`) la subida falla cerrado, mientras que el adaptador anterior (`writeAuditLog`) absorbe ese mismo error |
| 9. Recuperación tras reinicio | **No aplica** por la misma razón que 4 |
| 10. Aislamiento entre clínicas | PostgreSQL (token de otra clínica, concurrencia con clínica B) |
| 11. Sin fuga de información sensible | adaptador de log y ruta HTTP |
| 12. Compatibilidad con SEC-09 | los tests y guards de SEC-09 siguen vigentes |

**Spec PostgreSQL real: PASSED, 14/14** (`report-upload-persistence-postgres.test.ts`), con autorización R3 específica
y limitada a `portal_vetneb_ci` en 127.0.0.1:5432 (PostgreSQL 17.10, no réplica, sin esquemas Supabase). Pasó en tres
corridas consecutivas con exit 0 (una anterior de 11 casos, antes de agregar los últimos tres, también pasó).

- Antes y después se comparó una instantánea de la base: conteos de todas las tablas afectadas (incluidas
  `audit_log` y `study_tracking_notifications`) y hash MD5 de `reports`, `clinics`, `admin_users`, `audit_log`,
  notificaciones, tokens y seguimiento. Idéntica: los 60 informes preexistentes y todo registro ajeno quedaron
  intactos y no hubo residuos. Sólo avanzaron las secuencias. No hubo migraciones, DDL ni limpiezas generales.
- Los registros eran sintéticos (clínicas y admin creados por el spec); el spec borra únicamente lo suyo.
- **Mutaciones**: con la auditoría transaccional absorbiendo errores falla el caso del `22001`; sin el savepoint de
  la notificación falla el caso del savepoint. Ambos fueron restaurados y verificados.
- **Contrato de la notificación**: es best-effort y puede omitirse tras un fallo; no se afirma que sea atómica
  con el informe en ese caso, sólo que nunca existe una notificación de un informe revertido.
- **Esquema**: la base local conserva columnas legacy (`clinics.clinic_id`, `report_status_history` sin las
  columnas legacy), de modo que no es un esquema migrado desde cero; el spec se adapta a ambos. La ejecución
  sobre un esquema migrado desde cero queda para el CI, donde el spec de SEC-09 ya pasó 9/9.

## Skills utilizadas

Se cargaron las cuatro skills pedidas: `vetneb-security-production-invariants` (invariantes de
auditoría, aislamiento y logs), `vetneb-briefing-planificacion-diseno-desarrollo-pruebas` (scope, no-alcance y
matriz de pruebas), `vetneb-bugs-errores-optimizacion-rutas` (método causa raíz → regresión) y
`vetneb-web-end-to-end-global` (flujo HTTP de subida, cubierto con la ruta real). Ninguna aportó un comando
ejecutable propio. El protocolo Git manual de las skills coincide con `AGENTS.md`, que prevalece.

## Riesgos residuales

1. **Commit ambiguo no resuelto**: si la verificación no encuentra el informe, el commit pudo estar aún en
   vuelo y aplicarse después. Se conserva el objeto y el cliente recibe error; un reintento crea un informe
   nuevo. Los efectos siguen siendo atómicos con su informe.
2. **Acoplamiento de disponibilidad** con `audit_log` (ver cambios de comportamiento).
3. **Sin idempotencia HTTP**: dos subidas del mismo archivo crean dos informes.
4. Los trabajos separados de abajo.

## Trabajos separados (scopes independientes, no incluidos aquí)

| | Causa | Impacto | Prioridad | Estrategia | Prueba de aceptación |
|---|---|---|---|---|---|
| A. Huérfanos de Storage | objetos no eliminables o de estado incierto (`delete_failed`, `preserved_*`) | almacenamiento y datos sin referencia | P2 | job de reconciliación idempotente por `pathDigest`, con cuarentena antes de borrar | un objeto sin referencia tras N días se elimina; uno referenciado nunca |
| B. Mismo Particular Token | dos subidas serializan en el `UPDATE` del token; gana la última | informe persistido sin vínculo final | P2 | decidir la política (rechazar o conservar el más reciente) y bloquear el token al inicio | dos subidas simultáneas dejan un resultado determinista y documentado |
| C. Test de pricing | `fastify-app.test.ts` busca `4821` en una línea con UUID aleatorio | fallo intermitente (~0,04% por UUID) | P3 | excluir el `requestId` de la búsqueda o fijar el ID | 10 000 corridas sin fallo |
| D. `request_id` en auditoría | `createAuditRequestLike` no incluye `requestId` | las filas de auditoría de informes no se correlacionan | P2 | agregar `requestId: request.id` al contexto | la fila `report.uploaded` lleva el `request_id` de la petición |

## Rollback

Revertir el commit. No hay migraciones, cambios de schema ni configuración. Vuelven los efectos fuera de la
transacción y el comportamiento de SEC-09.

## Impacto operacional

Las subidas escriben dos filas más dentro de la transacción (notificación y auditoría). La latencia aumenta lo
que cuestan dos `INSERT`. Una caída de `audit_log` ahora bloquea la subida en lugar de perder el registro.

## Estado de gates

| Gate | Estado | Evidencia |
|---|---|---|
| `pnpm typecheck` | PASSED | exit 0 |
| `pnpm typecheck:test` | PASSED | exit 0 |
| `pnpm build` | PASSED | exit 0 |
| Tests y guards afectados | PASSED | 375 tests de los archivos afectados (servicio, adaptador, simulación, contrato del repositorio, ruta admin, guards de arquitectura y seguridad) |
| Censo 01B | PASSED | 10/10, con dos filas re-ancladas por sus topes de banda: assertions 2xx (395 → 396) y specs que mutan `process.env` (19 → 20) |
| Spec PostgreSQL real (`report-upload-persistence-postgres.test.ts`) | PASSED | 14/14, tres corridas con exit 0, contra `portal_vetneb_ci` local; instantánea de la base idéntica antes y después |
| `pnpm test` completo | FAILED por causas ambientales | 6.062 tests, 6.040 aprobados, 21 fallos, 1 omitido; ver abajo |
| `pnpm security:public-surface` | NOT_RUN | no se toca superficie pública ni frontend |
| `pnpm validate:local` | NOT_RUN como gate compuesto | sus piezas se corrieron por separado |

Clasificación de los 21 fallos y la prueba omitida de `pnpm test` (corrida final), ninguno atribuible a este
cambio:

- 10 specs que exigen una base aislada (`*-postgres*` y `e2e-global-03b`), incluido el de este PR: fallan en
  la corrida estándar por falta de `DATABASE_URL`. El de este PR, ejecutado con la variable apuntando a
  `portal_vetneb_ci`, da 14/14.
- 8 pruebas de PR governance: fallan igual en `main` (firma SSH en repos temporales).
- 3 del auditor de devtools: los hallazgos públicos vienen de `frontend/.next`, un artefacto local; este PR no
  toca `frontend/` ni `scripts/`.
- 1 prueba omitida (symlinks, `# symlink creation is not permitted without privileges on this platform`):
  se salta por plataforma, Windows sin privilegios.
- El censo 01B falló en una corrida intermedia por la assertion `201` nueva (395 → 396); se corrigió re-anclando
  la fila con su motivo y pasa 10/10 en la corrida final.

Esta sección no declara PASSED ningún gate que no se haya observado con exit 0.
