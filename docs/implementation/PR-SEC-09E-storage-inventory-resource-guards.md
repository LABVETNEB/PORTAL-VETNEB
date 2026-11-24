# PR-SEC-09E — Guardas de duración, concurrencia y timeout del inventario de Storage

Estado base: `main@a0b8eee9` (SEC-09D fusionada, PR #2033). Rama: `fix/sec-09e-storage-inventory-resource-guards`.
Scope: backend-only, sobre el inventario administrativo de solo lectura. Sin migraciones, dependencias,
cambios de esquema, borrados ni cambios en informes clínicos o Particular Tokens.

## Causa raíz (P3 confirmado)

`runStorageOrphanInventory` comprobaba el deadline solo **antes** de cada operación. Nada se comprobaba
tras el último `await` (última reverificación, última consulta de la primera pasada, último `listPage`
sin elegibles), de modo que un inventario íntegramente verificado pero fuera de presupuesto salía como
`complete` sin ninguna señal.

Reproducción previa a la corrección (reloj inyectado, `maxDurationMs = 30`, 500 ms de avance en la última
operación): A (reverificación) y B (primera pasada, todo referenciado) devolvían `status: "complete"`;
el caso C (listado lento con elegibles) ya devolvía `truncated`/`deadline`.

## Contrato de duración

| Campo | Significado |
|---|---|
| `durationMs` | Duración medida con el reloj inyectado hasta construir el resultado. `0` en el resultado fallido base. |
| `deadlineExceeded` | `durationMs >= limits.maxDurationMs`. Independiente de `complete`. |
| `complete` / `status` | Completitud de **datos**: todo lo elegible fue verificado. |
| `unverified` | Elegibles o candidatos no comprobados por truncamiento; nunca cuentan como candidatos. |

Un inventario verificado por completo fuera de presupuesto es `complete: true` con `deadlineExceeded: true`:
no se degrada, y tampoco se declara cumplido el límite temporal. Con pendientes sigue siendo `truncated`.
Los resultados `failed` generados por el módulo también informan duración.

## Límites efectivos vs cooperativos

| Límite | Naturaleza |
|---|---|
| `maxPages`, `maxObjects` | Efectivos (el bucle se detiene) |
| Timeout de `listV2` (15 s por llamada) | Efectivo: `AbortSignal.timeout` cancela la petición |
| `maxDurationMs` (30 s) | **Cooperativo**: se comprueba entre operaciones; no cancela una operación en curso. El exceso máximo es una operación (listado 15 s o lote de referencias ≤ timeout PG) |
| `statement_timeout` por lote (10 s) | Efectivo en el servidor PostgreSQL (SQLSTATE 57014); **no validado contra PostgreSQL real** |
| Espera por conexión del pool | **Sin cota** (postgres.js no tiene timeout de adquisición; no se modificó `db.ts`) |
| Tiempo de respuesta HTTP | Sin cota propia (Fastify no define timeout de solicitud) |

## Política de concurrencia

- Guarda en memoria (`server/lib/single-flight-guard.ts`): `createSingleFlightGuard()` se instancia **dentro
  del registro del plugin** (`admin-system-maintenance.fastify.ts`). Alcance, sin equivalencias entre niveles:
  1. **Instancia de la guarda**: una ejecución activa.
  2. **Registro del plugin Fastify**: una guarda independiente por registro (dos registros ⇒ dos guardas).
  3. **Proceso Node.js**: depende de cuántas aplicaciones o registros existan en el proceso. Producción crea
     una instancia mediante `createFastifyApp()` (`server/index.ts`), por lo que en la práctica hay un
     inventario por proceso, pero la guarda **no es una primitiva global del proceso**: un segundo
     `createFastifyApp()` en el mismo proceso crearía otra guarda y admitiría otro inventario.
  4. **Réplicas del despliegue**: sin exclusión distribuida; cada réplica admite el suyo.
- Solo aplica con `includeStorageOrphans: true`, **después** de autenticar y validar origen, y **antes** de
  cualquier consulta (el rechazado no consulta el snapshot, Storage ni PostgreSQL).
- Segunda solicitud simultánea: `429` inmediato, `Retry-After: 30`, `Cache-Control: no-store`, cuerpo
  `{ success: false, error: "Ya hay un inventario de Storage en curso", code: "storage_orphan_inventory_in_progress" }`.
  Sin rutas, nombres ni datos clínicos.
- Liberación en `finally` cuando el trabajo termina: resuelve o lanza. **No existe vencimiento por tiempo**: una
  versión previa de esta PR liberaba la guarda a los 120 s, lo que permitía un segundo inventario mientras el
  primero seguía activo (reproducido con un test que fallaba antes de la corrección). Un temporizador no
  cancela el trabajo en PostgreSQL ni en Storage, por lo que liberar antes viola el invariante de un solo
  inventario activo por instancia.
- Recuperación si una operación queda colgada: el trabajo está acotado por el timeout de 15 s por llamada a
  `listV2` y el `statement_timeout` de 10 s por lote. Lo único sin cota es la espera de conexión del pool; si
  esa espera no termina, el endpoint rechaza nuevos inventarios con 429 hasta que termine o se reinicie el
  proceso del backend (reinicio manual, no automático). El resto del endpoint (sin inventario) no se ve
  afectado. Una desconexión del cliente tampoco cancela el trabajo: la guarda se libera al terminar.
- Las solicitudes sin inventario no se ven afectadas.
- **Frontera**: no protege entre réplicas ni entre procesos distintos, ni entre registros del plugin dentro de
  un mismo proceso. No hay protección global del despliegue.

## Timeout PostgreSQL

Cada lote de referencias corre en una transacción corta (`db.transaction` de Drizzle sobre postgres.js, una
sola conexión) que ejecuta `select set_config('statement_timeout', '<ms>', true)` y luego el `SELECT`.
`is_local = true` limita el valor a esa transacción: no persiste en la conexión devuelta al pool ni afecta
a otras solicitudes, y no se usa `SET` de sesión. La transacción no contiene llamadas a Storage; se confirma
(o revierte) antes de volver al inventario. El uso del pool sigue siendo secuencial.

Un error con SQLSTATE `57014` (directo o en `cause`, como lo envuelve Drizzle) se convierte en
`ReferenceLookupTimeoutError`; el inventario termina `failed` con `failureReason: "reference_check_failed"`
y `failureErrorName: "ReferenceLookupTimeoutError"`. No se distingue la espera por adquisición de conexión
(ver tabla): queda como limitación.

Costo: 3 viajes adicionales por lote (BEGIN, `set_config`, COMMIT); máximo 200 lotes por corrida.

## Matriz de pruebas

| Garantía | Prueba | Clase |
|---|---|---|
| Deadline A/B/C/D, pendientes, dentro/fuera de presupuesto, coherencia de campos | `storage-inventory-resource-guards.test.ts` | Demostrada en código y tests |
| Guarda: admite una, rechaza simultánea sin ejecutar trabajo, libera, libera ante excepción, sin takeover con el trabajo activo y el reloj muy adelantado | ídem | Demostrada en código y tests |
| Ruta: 429 inmediato sin consultas, sin inventario no bloquea, tercera admitida, no autorizada no toma la guarda, registros separados no comparten guarda | ídem | Demostrada en código y tests |
| Timeout: orden `begin → timeout local → select → commit`, 57014 directo y en `cause`, inventario `failed`, rollback | ídem (runner simulado) | **Simulación**; no evidencia de PostgreSQL real |
| El timeout no persiste en la sesión | Guard estructural (`set_config(..., true)`, sin `SET` de sesión ni `false`) | Respaldada por análisis de código |
| Corte real de una sentencia lenta, liberación de conexión, 57014 efectivo | — | Pendiente de validación real (R3) |

## Compatibilidad con SEC-09D

Sin cambios en `supported=false`, `destructiveAction=null`, `deletionSafety="not_assessed"`, clasificación,
doble comprobación, paginación, deduplicación ni en la activación exclusiva por `includeStorageOrphans`.
Campos nuevos aditivos (`durationMs`, `deadlineExceeded`); el frontend no consume el objeto del inventario.
El guard estructural de SEC-09D que prohibía `.transaction(` en la consulta de referencias se realineó (no se
debilitó): ahora exige que la transacción solo contenga `set_config(..., true)` y el `SELECT`, sin
referencias a Storage ni `SET` de sesión.

## Impacto en disponibilidad y riesgos residuales

- Un inventario por guarda ocupa a lo sumo una conexión por vez; el endpoint ya no permite agotar el pool
  de 3 conexiones con inventarios simultáneos dentro de una misma guarda.
- Con varias réplicas (o varios registros del plugin) cada uno admite un inventario.
- La espera de conexión del pool y la duración HTTP siguen sin cota.
- El `statement_timeout` de 10 s es un valor fijo, no configurable.
- Una operación colgada sin cota (espera de conexión) mantiene el 429 de inventarios hasta que termine o se reinicie el proceso.
- Un administrador autenticado puede mantener el endpoint ocupado repitiendo solicitudes (efecto acotado a 429
  para otros inventarios).

## Rollback

Revertir el commit: elimina la guarda, el timeout y los campos de duración. No hay migraciones ni estado
persistente que deshacer.

## Validaciones reales pendientes

Todas requieren autorización R3 con entorno nombrado: sentencia lenta real con `statement_timeout`, ausencia
de timeout residual en la conexión del pool, comportamiento de `listV2` y `created_at` contra un bucket
autorizado.

> Nota SEC-09F: el reloj monotónico de duración y la corrección del alcance se detallan en
> `PR-SEC-09F-storage-inventory-contract-hardening.md`.
