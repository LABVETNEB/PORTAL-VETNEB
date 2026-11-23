# PR-SEC-16 (SEC-09 / V-14) — Consistencia entre Storage y PostgreSQL en la subida de informes

> Nomenclatura: la hoja de ruta (`docs/audit/AUDITORIA_SEGURIDAD_CAJA_BLANCA_ROADMAP_2026-11-11.md`) asigna
> la etiqueta «PR-SEC-16» a este trabajo (SEC-09). El PR #2027 ya usó esa etiqueta para SEC-16
> (`PR-SEC-16-public-health-minimization.md`). Este documento conserva la ruta pedida; el commit y la PR
> deben llevar el hallazgo, `(SEC-09)`, para no colisionar.

## Estado base

`main` @ `151bb648a0e191a4e720a91dd6ccc22f9a964d35`. Rama `fix/sec-09-report-storage-consistency`.

## Causa raíz

`uploadAdminReport` (`server/features/reports/application/report-route-service.ts`) ejecutaba:

1. `uploadReport`: el archivo se subía a Supabase Storage **primero**.
2. `createOrEditReport`: transacción propia (informe + historial).
3. `updateParticularTokenReport`: escritura **fuera** de esa transacción.
4. `ensureStudyTrackingCaseForToken`: escrituras de seguimiento, también fuera de ella.
5. Parseo y normalización de `patientName`, `studyType` y `uploadDate`: **después** de subir el archivo.

Efectos: cualquier fallo de los pasos 2 a 5 dejaba un objeto huérfano en Storage, un informe sin vínculo con su
token, o un vínculo parcial entre informe, token y seguimiento. No existía compensación. Un error de validación
posterior al paso 1 también dejaba el objeto. Si el vínculo con el token afectaba cero filas, el flujo seguía como
si hubiera funcionado.

## Alcance

Incluido: `server/features/reports/**`, los repositorios transaccionales de `particular-access` y
`study-tracking`, y los tests y guards directamente afectados.
Excluido: frontend, workflows, dependencias, `drizzle/schema.ts` y migraciones (no se modificaron), contrato
HTTP y cualquier proceso de reconciliación de objetos huérfanos. El fallback `42703` del historial entró al
alcance cuando las pruebas contra PostgreSQL real demostraron que bloqueaba la subida (ver «Defecto
preexistente corregido»).

## Diseño

### Frontera transaccional

`PostgreSQL` es atómico para: informe, historial de estado, vínculo del Particular Token y seguimiento
(`study_tracking_cases`). Las cuatro escrituras ocurren en **una sola** `db.transaction`.

- Infrastructure es el único dueño de la transacción: `runReportUploadTransaction`
  (`report-command-repository.ts`). Lo exige el guard M38.
- `createTransactionalReportPersistenceRunner` (composition) ejecuta el trabajo dentro de esa transacción. Si el
  trabajo lanza, la transacción se revierte y el error original se propaga intacto.
- `buildReportUploadScope` arma el scope con las escrituras ligadas a **la misma** transacción. Si la
  actualización del seguimiento no afecta filas, lanza `ReportUploadPersistenceError("tracking_write_failed")` y
  revierte todo (fail-closed). Lo mismo ocurre con el vínculo del token (`token_link_failed`) cuando devuelve
  `null` o una fila de otra clínica.
- `uploadAdminReport` parsea y normaliza los campos **antes** de subir el archivo, de modo que un error de
  validación ya no deja un objeto.

No existe atomicidad distribuida: Storage y PostgreSQL son sistemas distintos y esta PR no la reclama. Lo que
existe es transacción PostgreSQL más compensación de Storage.

### Compensación de Storage

Si la persistencia falla, `compensateUnpersistedUpload` actúa únicamente sobre el objeto **recién subido**:

| Resultado | Condición | Acción sobre el objeto |
|---|---|---|
| `deleted` | path exacto `clinics/<clinicId>/<segmento>`, no referenciado | se elimina |
| `preserved_referenced` | otra conexión ya lo referencia en `reports` | se conserva |
| `preserved_verification_failed` | la verificación de referencia falló | se conserva |
| `delete_failed` | el borrado falló | se conserva y se registra |
| `preserved_commit_unknown` | el `COMMIT` falló después de completar el trabajo | **nunca** se elimina |
| `preserved_unsafe_path` | el path no cumple el patrón exacto | se conserva |

Nunca se borra un objeto preexistente, referenciado por la base o de estado incierto. La compensación no lanza:
el error funcional original es el que llega al cliente.

### Commit ambiguo

Si el trabajo terminó y `COMMIT` lanza, el runner lanza `ReportPersistenceCommitUnknownError`. No se puede saber
si la transacción se aplicó. El objeto se conserva y se registra la verificación (`persisted`, `not_persisted` o
`unverifiable`).

### Registro sanitizado

El adaptador `logReportStorageCompensation` emite `REPORT_UPLOAD_STORAGE_COMPENSATION` con nivel según el
resultado y un contexto cerrado: `outcome`, `clinicId`, `objectRef` (`<timestamp>-<12 hex>`), `pathDigest`
(SHA-256 del path completo), `persistError` y, si aplica, `cleanupError` y `verification`. Nunca incluye el path,
el nombre de archivo ni mensajes de error, que pueden identificar a un paciente.

### Lo que no cambia

Contrato HTTP, aislamiento por clínica, notificaciones best-effort, auditoría **después** de la persistencia,
y el orden Storage → persistencia → auditoría que anclan los guards.

## Concurrencia e idempotencia

- Dos subidas simultáneas para el **mismo token** se serializan en el `UPDATE` del token (lock de fila). Todo
  `INSERT` de seguimiento ocurre después de ese lock y `ensure` relee tras él. Resultado esperado: el token y el
  seguimiento apuntan al informe de la subida que gana, el otro informe queda persistido pero **sin vincular**, no
  hay corrupción. Es el mismo comportamiento que existía antes del cambio.
- La segunda subida puede emitir un segundo `report_delivered`, porque leyó el seguimiento antes del lock. Se
  corresponde con dos informes realmente subidos.
- `UNIQUE(reports.storage_path)` **no** da idempotencia: cada subida genera un path aleatorio nuevo. Dos
  subidas exitosas del mismo archivo crean dos informes. No se reclama idempotencia HTTP.
- Un reintento tras un fallo crea un objeto nuevo y no deja residuos del intento fallido.

## Pruebas

| Nivel | Archivo | Qué demuestra | Límite |
|---|---|---|---|
| Orquestación | `test/unit/application/reports/report-route-service.test.ts` | orden, compensación, errores, commit ambiguo, paths inseguros, sin PII | el runner de test **no** es transaccional |
| Adaptador | `test/unit/infrastructure/reports/report-storage-compensation-log.test.ts` | registro emitido: nivel, evento, contexto, sin fuga de path ni paciente | |
| Simulación con rollback | `test/unit/infrastructure/reports/report-upload-rollback-simulation.test.ts` | runner y servicio **reales** sobre un motor en memoria: siete puntos de fallo con rollback total, commit ambiguo en ambos modos, preservación de objetos | **no es PostgreSQL**; no certifica atomicidad de infraestructura |
| PostgreSQL real | `test/integration/app/report-upload-persistence-postgres.test.ts` | rollback, `23505`, `23503`, concurrencia sobre el mismo token, ack de commit perdido tras un `COMMIT` real, aislamiento entre clínicas | Storage es un `Set` en memoria; la inyección de fallos usa una composición espejo |

Notas del spec PostgreSQL: usa el runner de producción (`loadReportUploadPersistence`), salvo los casos
`23505` y «fallo tras tracking», que usan los mismos repositorios con una composición espejo y un wrapper que
inyecta el fallo. Sólo corre en loopback sobre `portal_vetneb_ci` o `portal_vetneb_sec09_ci`. Se adapta a la
columna legacy `clinics.clinic_id` cuando existe, registra su limpieza antes de crear filas y borra únicamente
las filas sintéticas que creó.

Ejecución (autorizada de forma específica y limitada a `portal_vetneb_ci` local): 9/9, tres corridas
consecutivas más una cuarta tras restaurar el código, todas con exit 0. Antes y después se comparó una
instantánea de la base (conteos de todas las tablas relevantes y hash MD5 de `reports`, `clinics` y
`admin_users`): idéntica. Los 60 informes preexistentes no se modificaron. Una primera corrida falló en la
preparación y dejó una fila sintética en `admin_users`, que se eliminó por su `username` exacto; el spec ahora
no puede repetirlo. Sólo avanzaron las secuencias.

## Defecto preexistente corregido: fallback `42703` del historial

`insertCompatibleReportStatusHistory` (`report-command-repository.ts`) inserta con columnas legacy y, si
PostgreSQL responde `42703` (columna inexistente), debería reintentar con `tx.insert`. Una base migrada con
`db:migrate` no tiene esas columnas (la migración 0013 sólo relaja `NOT NULL` si existen), de modo que **toda
creación de informe fallaba** en ese esquema. Había dos fallas encadenadas, demostradas contra PostgreSQL real:

1. Drizzle 0.45 envuelve el error: el SQLSTATE vive en `error.cause.code`. La condición `error.code !== "42703"`
   nunca coincidía y relanzaba. El test de contrato no lo detectaba porque simulaba un error con `code` directo.
2. Aun coincidiendo, dentro de una transacción el siguiente statement falla con `25P02`.

Corrección: el `INSERT` crudo corre en un savepoint (`tx.transaction`), de modo que un `42703` revierte sólo ese
statement y deja usable la transacción; y `isUndefinedColumnError` reconoce el código en `error` o en
`error.cause`. Regresión: caso nuevo en `report-command-repository-contract.test.ts` (error envuelto) y el spec
PostgreSQL, que sin el cambio falla 7 de 9 casos con `42703` real. Afecta también a
`persistReportStatusTransition`, que usa el mismo helper.

Corresponde a SEC-09 porque la subida transaccional ejecuta ese helper dentro de su transacción y no podía
completarse en un esquema migrado.

## Riesgos residuales

1. **Commit ambiguo**: si el `COMMIT` realmente se aplicó, el cliente recibe un error y no se emiten
   notificación ni auditoría. El informe existe y el objeto se conserva. El log permite reconciliar por
   `pathDigest`.
2. **Sin reconciliación automática**: los objetos huérfanos preexistentes y los preservados por incertidumbre no
   se limpian solos. Es trabajo futuro.
3. **Último escritor** en subidas simultáneas al mismo token: un informe puede quedar persistido sin vínculo.
4. **Compensación fallida** (`delete_failed`): el objeto queda en Storage hasta una reconciliación.

## Cambios de guards realineados en el mismo PR

Sin debilitar ningún assert: inventarios y puentes de Reports (M38, M40, M41), censo M45 (18 referencias
cross-feature), censo LOC M48, el marcador de fuente del fallback `42703` en tres guards (el contrato pasó de
`error.code !== "42703"` a la comprobación sobre `error` y `error.cause`), inventario M33 de Particular Access (el hash de queries 1:1 **no** cambió: la
función transaccional vive en un archivo propio), cantidad de bloques `catch` del servicio, loaders de
Study Tracking, anclas de orden de los guards de validación y auditoría, y tres filas re-ancladas del censo 01B
con el valor medido de `main`.

## Rollback

Revertir el commit. No hay migraciones, ni cambios de schema, ni configuración nueva. Los objetos preservados
por la compensación son inertes. El comportamiento previo (subida sin transacción unificada ni compensación)
vuelve íntegro.

## Estado de gates

| Gate | Estado | Evidencia |
|---|---|---|
| `pnpm typecheck` | PASSED | exit 0 |
| `pnpm typecheck:test` | PASSED | exit 0 |
| `pnpm build` | PASSED | exit 0 |
| Test del servicio de informes | PASSED | 42/42 |
| Test del adaptador de compensación | PASSED | 15/15 |
| Simulación con rollback (runner real, motor en memoria) | PASSED | 21/21 |
| Guards de arquitectura y contratos afectados | PASSED | con el árbol rastreado simulado |
| Censo 01B | PASSED | 10/10 |
| Spec PostgreSQL real (`report-upload-persistence-postgres.test.ts`) | PASSED | 9/9, cuatro corridas con exit 0, contra `portal_vetneb_ci` local (127.0.0.1, PostgreSQL 17.10, no réplica, sin esquemas Supabase). Instantánea de la base idéntica antes y después. Con el fallback `42703` en su forma original falla 7 de 9 |
| Contrato del repositorio de comandos | PASSED | incluye el caso del error envuelto |
| `pnpm test` completo | FAILED por causas ambientales o de estado, ninguna del código | ver abajo |
| `pnpm security:public-surface` | NOT_RUN | no se tocó superficie pública ni frontend |
| `pnpm validate:local` | NOT_RUN como gate compuesto | sus piezas se corrieron por separado; `pnpm test` incluye specs que requieren base aislada |

Clasificación de `pnpm test` (5.978 tests, 70 fallos, exit 1 como gate compuesto):

- Guards que leen sólo archivos rastreados por git y todavía no ven los seis archivos nuevos: los 347 tests de
  esos archivos pasan al simularlos como rastreados (índice temporal, sin tocar el real), salvo los 3 del
  auditor de devtools de abajo. Se resuelven al hacer `git add`.
- Specs que exigen una base aislada (`*-postgres*`, `e2e-global-03b`): fallan en la corrida estándar por falta
  de `DATABASE_URL`, como los de PRs anteriores. El de este PR, ejecutado con la variable apuntando a la base
  local aislada, da 9/9.
- 8 pruebas de PR governance: fallan igual en una copia limpia de `main@151bb648` (firma de commits en repos
  temporales).
- Auditor de devtools (3 pruebas): los hallazgos públicos provienen de `frontend/.next`, un artefacto local de
  build; en la copia limpia de `main` el auditor da `ok: true` con 0 hallazgos públicos. Este PR no modifica
  `frontend/` ni `scripts/`.

Esta sección no declara PASSED ningún gate que no se haya observado con exit 0.
