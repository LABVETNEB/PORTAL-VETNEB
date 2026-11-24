# SEC-09C — Serialización de subidas concurrentes al mismo Particular Token

Continuación de SEC-09 (#2030) y SEC-09B (#2031). No reabre ninguna de las dos: conserva la atomicidad de las
escrituras, la auditoría transaccional, el savepoint de la notificación, la recuperación de commits ambiguos, la
compensación de Storage, la validación de tenant y la correlación por request ID.

## Estado base

`main@cbb3003c7d90cd13d4317d476c48d871d4e6753e`. Rama `fix/report-upload-token-concurrency`.

## Orden actual de operaciones (auditado en código real)

`uploadAdminReport` (`report-route-service.ts`) y los repositorios transaccionales:

| Paso | Dónde | Lock |
|---|---|---|
| 1. Lee clínica y token (`getParticularTokenById`) | fuera de la transacción, `SELECT` simple | ninguno |
| 2. Valida clínica del token sobre esa lectura | fuera | — |
| 3. Sube el archivo a Storage | fuera | — |
| 4. `INSERT` del informe y su historial | transacción | ninguno |
| 5. `getParticularStudyTrackingCase(token)` | transacción, `FOR UPDATE` | sólo si el seguimiento existe |
| 6. `UPDATE particular_tokens SET report_id` | transacción | **primera vez que se toma el lock del token** |
| 7. `ensureStudyTrackingCaseForToken` | transacción | — |
| 8. Notificación (savepoint) y auditoría | transacción | — |

## La carrera original

Dos subidas simultáneas al mismo token, **cuando el token todavía no tiene seguimiento** (el caso del primer
informe de un token sin caso), hacen lo siguiente:

1. Ambas insertan su informe y leen `previousTrackingCase = null`: ningún lock las separa, porque el lock del
   token recién se toma en el paso 6.
2. Se serializan en el `UPDATE` del token. La segunda espera y después sobrescribe `report_id`.
3. Ambas consideraron que el seguimiento pasaba de «inexistente» a «entregado», así que **ambas pueden crear la
   notificación `report_delivered`**.

Cuando el seguimiento ya existe, el paso 5 (`FOR UPDATE`) ya las serializa. Por eso el defecto es una ventana
acotada, no una pérdida de datos: ningún informe se pierde, el token queda con el de la subida que confirma
última, y el otro informe queda persistido sin vínculo.

Qué está demostrado y qué no: la secuencia se **deriva del código**. La simulación determinista (abajo) la
reproduce con el lock quitado, y el spec PostgreSQL de SEC-09 ya toleraba «1 o 2 notificaciones» justamente por
esta ventana. No ejecuté una reproducción de la carrera original contra PostgreSQL real.

## Política aplicable después del lock

`SELECT ... FOR UPDATE` por sí solo **no** elimina el efecto de «último escritor»: serializa, pero la segunda
subida igualmente reemplaza la asociación de la primera. Eso no es el defecto: **es el contrato vigente**.

- El dominio (`ensureStudyTrackingCaseForToken`) parchea `reportId` cuando un token ya asociado recibe otro
  informe, y los tests de SEC-09 y SEC-09B fijan que la segunda subida deja el token apuntando al segundo.
- Los flujos de asociación manual (`admin/clinic-particular-access-operations`) también reemplazan el vínculo.

Alternativas evaluadas:

| Política | Veredicto |
|---|---|
| **Serializar por token; el reemplazo sigue permitido (elegida)** | Respaldada por el contrato y los tests. La concurrencia pasa a ser equivalente a ejecutar las subidas una después de otra. |
| Rechazar la subida si el token ya tiene informe | Contradice el reemplazo legítimo vigente y cambiaría el contrato HTTP. |
| Detección optimista de conflicto (`409`) | Agrega un código de error nuevo y obliga a reintentar; no está respaldado por el contrato. |

No hay decisión funcional pendiente. Lo que la política sí hace: elimina la lectura previa vieja y la notificación
duplicada, y hace que el estado final sea el de un orden secuencial, no el de una intercalación arbitraria.

## Diseño

- `lockParticularTokenForUpdate` (`particular-access-transactional-repository.ts`): `SET LOCAL lock_timeout` y
  `SELECT ... FOR NO KEY UPDATE` sobre la fila del token. Se usa **NO KEY UPDATE** porque la única escritura es
  `report_id`, una columna que no es clave: así no bloquea las filas que referencian al token por clave foránea
  (sesiones, notificaciones).
- Es la **primera operación** de la unidad cuando la subida lleva token (`scope.lockParticularToken`), antes de
  crear el informe. La segunda subida espera sin haber escrito nada y, al continuar, lee el estado ya confirmado
  (`READ COMMITTED` devuelve la versión más reciente de la fila).
- Bajo el lock se revalida la clínica del token: la lectura previa fue sin lock y pudo quedar vieja. Si el token
  desapareció o es de otra clínica, falla cerrado (`token_link_failed`) antes de crear el informe y se compensa
  el objeto de Storage.
- El lock se mantiene hasta el fin de la transacción, confirmada o revertida. La subida a Storage ocurre **antes**
  de la transacción, así que el lock nunca se retiene durante E/S de red.
- `lock_timeout` de 10 s (constante `PARTICULAR_TOKEN_LOCK_TIMEOUT_MS`): acota cuánto una subida retiene una
  conexión esperando a otra. Si vence, PostgreSQL responde `55P03`, la transacción se revierte, se compensa el
  objeto y el error llega al cliente por el manejador existente (sin contrato HTTP nuevo).
- Sin schema ni migración.

## Secuencia anterior y posterior

Anterior: `INSERT informe → [FOR UPDATE seguimiento] → UPDATE token (lock) → ensure → efectos`.
Posterior: `LOCK token → INSERT informe → [FOR UPDATE seguimiento] → UPDATE token → ensure → efectos`.

## Deadlocks

- Cada unidad de subida toma el lock del token **antes** de cualquier otro lock y no toma otro lock de token:
  no hay retención-y-espera sobre el mismo recurso, así que dos subidas al mismo token no pueden entrelazarse en
  un ciclo.
- Subidas a tokens distintos no comparten filas: el seguimiento está identificado por `particular_token_id`
  único y el informe por su path único.
- Las asociaciones manuales de token (`admin/clinic-particular-access-operations`) son sentencias únicas, que
  sostienen un solo lock. Las demás transacciones del servidor (clínicas, logística, búsqueda global) no toman
  locks sobre token y seguimiento. La excepción es el **borrado de una clínica**, que elimina en cascada sus tokens
  e informes: una subida concurrente a una clínica que se está borrando podría formar un ciclo con él. PostgreSQL
  lo detecta (`40P01`) y aborta una de las dos transacciones. No es nuevo de este cambio (el ciclo existía con
  otro orden) ni ocurre entre subidas.
- El orden de locks es siempre token → seguimiento.
- Qué se demuestra y qué no: la ausencia de deadlocks se argumenta por el orden de locks y se observó en cuatro
  subidas simultáneas sobre PostgreSQL real; no es una prueba general.

## Compatibilidad

SEC-09 (rollback y compensación de Storage), SEC-09B (efectos dentro de la transacción: la auditoría sigue
fallando cerrado, la notificación sigue siendo best-effort por savepoint), recuperación de commits ambiguos
(`commit_confirmed`), validación de tenant y request ID. El contrato HTTP no cambia.

## Pruebas

Ejecutadas y aprobadas (exit 0):

- Servicio (59/59): el lock es la primera operación y usa el id del token elegido; una subida sin token no toma
  lock; token inexistente o de otra clínica bajo el lock falla cerrado antes de crear el informe y compensa.
- **Simulación determinista de concurrencia** (29/29 en el archivo): mutex FIFO por token con handoff, estado
  confirmado refrescado tras esperar, compuertas explícitas y sin esperas temporales. Cubre: dos subidas al mismo
  token (la segunda espera sin escribir; el resultado equivale a un orden secuencial; una sola notificación),
  tokens distintos sin bloqueo, titular que falla reteniendo el lock, commit ambiguo del titular, y cuatro
  subidas a dos tokens. **Es un modelo, no PostgreSQL.** Con el lock quitado del servicio fallan los 5 casos.

**PostgreSQL real: PASSED, 20/20** (los 14 casos de SEC-09 y SEC-09B más los 6 de este cambio), con autorización
R3 específica y limitada a `portal_vetneb_ci` en 127.0.0.1:5432 (PostgreSQL 17.10, no réplica, sin esquemas
Supabase). Tres corridas consecutivas con exit 0 (≈1,1 s cada una).

| Caso nuevo | Tiempo | Qué demuestra |
|---|---|---|
| Dos subidas al mismo token se serializan | 69,2 ms | PostgreSQL **reporta** a la segunda sesión esperando un lock de fila sobre `particular_tokens` (`pg_stat_activity`, no el paso del tiempo); mientras espera no hay nada confirmado ni escrito; tras el commit de la primera, continúa y deja el token con la última, un único seguimiento y una sola notificación |
| Tokens distintos no se bloquean | 20,1 ms | con el lock de A retenido, la subida al token B completa y no hay ninguna sesión esperando |
| Titular que falla reteniendo el lock | 17,5 ms | tras el **rollback** la segunda se libera y continúa sobre el estado limpio; el objeto del titular se compensa |
| Token de otra clínica bajo el lock | 3,6 ms | la lectura previa sin lock quedó vieja; el lock revela la clínica real y falla cerrado antes de crear el informe |
| `lock_timeout` efectivo | 1,9 ms | dentro de la transacción el servidor reporta `10s` |
| Cuatro subidas a dos tokens | 31,0 ms | todas completan, sin deadlock, con una asociación coherente por token y una auditoría por informe |

- **Mutaciones en PostgreSQL real**: sin `FOR NO KEY UPDATE` fallan los dos casos de serialización; sin
  `SET LOCAL lock_timeout` falla el de `lock_timeout`. Ambas se restauraron y se verificó el archivo.
- **Integridad**: instantánea de la base antes y después (conteos de todas las tablas afectadas, incluidas
  `audit_log` y notificaciones, y hash MD5 de informes, clínicas, admins, auditoría, notificaciones, tokens y
  seguimiento): idéntica. Los 60 informes preexistentes no cambiaron. Sin transacciones abiertas, sin sesiones
  esperando y sin locks persistentes al terminar. Sólo avanzaron las secuencias por las filas sintéticas que el
  spec crea y borra. Sin migraciones, DDL ni limpiezas generales.

**Lo que estos casos NO cubren** (sin atribuirles cobertura inexistente):

- **El modo del lock** (`NO KEY UPDATE` frente a `UPDATE`) no se asserta directamente. Se demuestra que existe un
  lock de fila que bloquea, pero no que no bloquea a las filas que referencian al token por clave foránea.
- **El vencimiento del `lock_timeout`** (`55P03`) no se ejercita: se prueba que el valor está fijado, no que la
  transacción se revierta al vencer.
- **El commit ambiguo durante la concurrencia** sólo está cubierto por la simulación, no por PostgreSQL real.
- **La ausencia de deadlocks** se observa en los escenarios cubiertos (cuatro subidas, dos tokens); no es una
  prueba de ausencia general. El borrado de una clínica durante una subida no está cubierto.

## Riesgos residuales

1. **Reemplazo por la última subida**: el informe de la subida anterior queda persistido pero sin vínculo.
   Es el contrato vigente, no una pérdida.
2. **Conexiones del pool**: una subida que espera el lock ocupa una conexión hasta 10 s. Con un pool pequeño,
   varias subidas simultáneas al mismo token pueden retrasar otras solicitudes.
3. **`SET LOCAL lock_timeout`** rige el resto de la transacción, no sólo el lock del token.
4. **Borrado de una clínica durante una subida**: puede producir un deadlock que PostgreSQL resuelve abortando
   una de las dos operaciones. Probabilidad muy baja y preexistente.
5. **Idempotencia HTTP**, reconciliación de huérfanos de Storage, `requestId` en la auditoría y el test de pricing
   siguen abiertos y fuera de este cambio.

## Rollback

Revertir el commit. No hay migraciones, cambios de schema ni configuración. Vuelve el orden anterior.

## Estado de gates

| Gate | Estado | Evidencia |
|---|---|---|
| `pnpm typecheck` | PASSED | exit 0 |
| `pnpm typecheck:test` | PASSED | exit 0, incluye los seis casos PostgreSQL nuevos |
| `pnpm build` | PASSED | exit 0 |
| Tests y guards afectados | PASSED | 400 tests (servicio, simulación, adaptador, contrato del repositorio, ruta admin, guards de arquitectura y seguridad, censo 01B, M48) |
| Simulación determinista de concurrencia | PASSED | 29/29; con el lock quitado del servicio fallan los 5 casos de concurrencia |
| Casos PostgreSQL reales nuevos (6) | PASSED | 20/20 con los 14 anteriores, tres corridas con exit 0 contra `portal_vetneb_ci` local; instantánea de la base idéntica antes y después; dos mutaciones detectadas. Compatibilidad con un esquema migrado desde cero: la verifica el CI |
| `pnpm test` completo | FAILED por causas ambientales | 6.074 tests, 6.052 aprobados, 21 fallos, 1 omitido; ver abajo |
| `pnpm security:public-surface` | NOT_RUN | no se toca superficie pública ni frontend |
| `pnpm validate:local` | NOT_RUN como gate compuesto | sus piezas se corrieron por separado |

Clasificación de los 21 fallos y la prueba omitida de `pnpm test`, ninguno atribuible a este cambio:

- 10 specs que exigen una base aislada (`*-postgres*` y `e2e-global-03b`), incluido el de este PR: fallan en la
  corrida estándar por falta de `DATABASE_URL`.
- 8 pruebas de PR governance: fallan igual en `main` (firma SSH en repos temporales).
- 3 del auditor de devtools: los hallazgos públicos vienen de `frontend/.next`, un artefacto local; este PR no
  toca `frontend/` ni `scripts/`.
- 1 prueba omitida (symlinks): se salta por plataforma, Windows sin privilegios.

Esta sección no declara PASSED ningún gate que no se haya observado con exit 0. Los bloqueos reales de PostgreSQL
se demostraron en los escenarios descritos arriba; los huecos de cobertura están declarados.
