# PR-SEC-09F — Endurecimiento de contratos de error, duración y documentación del inventario de Storage

Estado base: `main@c4176d2c` (SEC-09E fusionada, PR #2034). Rama: `fix/sec-09f-storage-inventory-contract-hardening`.
Scope: backend-only (código, tests y documentación). Sin migraciones, dependencias, esquema, escrituras en
PostgreSQL ni operaciones sobre Storage. Origen: hallazgos H1, H2, H3 y H5 de la auditoría post-merge de SEC-09E.

## Causas raíz y reproducciones previas (código de `main`)

| ID | Causa raíz | Reproducción determinista previa |
|---|---|---|
| H1 | El núcleo no validaba las respuestas de sus puertos: `object.key` sobre `null` y `referenced.has` sobre un valor que no es `Set` | `page.objects=[null]` ⇒ `TypeError`; `lookupReferencedPaths ⇒ undefined` ⇒ `TypeError` (el contrato decía "nunca lanza") |
| H2 | `buildFailedStorageOrphanInventory` fijaba siempre `durationMs: 0` y `deadlineExceeded: false` | Constructor sin medición ⇒ `0 / false` aunque el fallo ocurra tarde |
| H3 | Duración y deadline usaban el reloj de pared (`Date.now`) | Reloj que retrocede 1 s por lectura, `maxDurationMs: 30`, 5 páginas ⇒ `truncated/max_pages`, `durationMs: 0`, `deadlineExceeded: false` |
| H5 | El documento de SEC-09E equiparaba "registro del plugin" con "proceso" | Lectura de `PR-SEC-09E-storage-inventory-resource-guards.md` |

## Correcciones

- **H1** (`server/storage-orphan-inventory.ts`): cada entrada de página debe ser un objeto con `key` string; si
  no, `failed / invalid_page`. La respuesta del puerto de referencias debe ser un `Set`; si no,
  `failed / reference_check_failed` con `failureErrorName: "InvalidPortResponse"` (primera pasada y
  reverificación). Nunca se interpreta una respuesta inválida como "sin referencias". `candidates` queda vacío
  y `orphanCandidates` en 0. No se expone contenido de Storage ni mensajes de error.
- **H2**: `buildFailedStorageOrphanInventory(generatedAt, reason, errorName?, elapsedMs?)`. Con `elapsedMs`
  (monotónico, medido por quien captura el fallo desde **antes** de la operación) fija `durationMs` y
  `deadlineExceeded`. Sin él, el resultado es sintético: `durationMs: 0` y **`durationMeasured: false`**
  (campo aditivo nuevo; `true` en toda duración medida). `getStorageOrphanInventory` y la ruta miden con
  `performance.now()` desde antes del adaptador / del puerto inyectado. El núcleo nunca lanza, por lo que
  sus fallos conservan su propia duración y no se suman a la de composición.
- **H3**: `StorageOrphanInventoryDependencies` separa `now` (pared) y `monotonicNow` (por defecto
  `performance.now()`). Duración, deadline y `deadlineExceeded` usan solo el monotónico; `durationMs` es un
  entero finito `>= 0` (`NaN` o retroceso ⇒ 0). `generatedAt` y la antigüedad de objetos usan solo el reloj de
  pared. Ambos son inyectables (también en la composición y, el monotónico, en la ruta: `monotonicNow`).
- **H5**: `PR-SEC-09E-...md` distingue instancia de la guarda, registro del plugin, proceso Node.js y réplicas.
  Se conserva la limitación de la espera de conexión del pool sin cota.

## Contrato de errores

Todo fallo: `status: "failed"`, `complete: false`, `candidates: []`, `orphanCandidates: 0`,
`deletionSafety: "not_assessed"`, `failureReason` en `listing_failed | incomplete_listing | invalid_page |
reference_check_failed | inventory_unavailable` y, opcionalmente, solo el **nombre** del error.

## Contrato de duración

`durationMs` (monotónico, entero, `>= 0`), `durationMeasured` (¿es una medición?), `deadlineExceeded`
(`durationMs >= maxDurationMs`, independiente de `complete`). Un resultado sintético sin medición declara
`durationMeasured: false` y no inventa una duración. El presupuesto sigue siendo cooperativo.

## Separación de relojes

| Uso | Fuente |
|---|---|
| `generatedAt`, antigüedad, comparación con `created_at` | Pared (`Date.now`, inyectable como `now`) |
| `durationMs`, deadline, `deadlineExceeded` | Monotónico (`performance.now`, inyectable como `monotonicNow`) |

Los tests anteriores que simulaban duración con un único reloj se adaptaron a `monotonicNow` sin cambiar
sus assertions.

## Resultados de regresión

Nuevo `test/unit/infrastructure/storage-inventory-contract-hardening.test.ts` (16 casos): H1 (entradas
nulas/no objeto/sin key, puerto inválido en ambas pasadas, valores válidos sin cambios), H2 (constructor,
adaptador, núcleo sin doble conteo, puerto inyectado en la ruta), H3 (pared retrocede / salta, monotónico
normal / retrocede / `NaN`, `generatedAt` y antigüedad en pared, fallo tardío, completo tardío, truncado con
`unverified`, relojes por defecto, guard estructural sin timers sobre la guarda). Los resultados de la
suite completa figuran en el informe de entrega.

## Compatibilidad

- **SEC-09D**: `supported=false`, `destructiveAction=null`, `deletionSafety="not_assessed"`, doble
  verificación, patrón exacto de paths, umbral de antigüedad, paginación y deduplicación, activación con
  `includeStorageOrphans: true`: sin cambios. `scope` de cada resultado es ahora una copia, no el objeto
  compartido.
- **SEC-09E**: guarda single-flight sin vencimiento ni takeover, 429 + `Retry-After` + `no-store`, y
  `statement_timeout` local de PostgreSQL: sin cambios.

## Limitaciones

- La espera de conexión del pool y la duración HTTP siguen sin cota; el presupuesto es cooperativo.
- Sin exclusión entre réplicas ni entre registros del plugin.
- Un fallo sin medición real (resultado sintético) declara `durationMeasured: false`.
- Fuera de alcance: reclasificación de SQLSTATE 57014 (H4), cambios del pool, locks distribuidos, timeouts
  HTTP, idempotencia de subida, borrado de huérfanos, migraciones, `supported: true`.

## Impacto sobre los datos y rollback

Sin escrituras en PostgreSQL ni Storage; sin cambios de esquema. Rollback: revertir el commit; el campo
nuevo (`durationMeasured`) es aditivo y el frontend no consume el objeto del inventario.

## Evidencias pendientes de validación real (R3)

`statement_timeout` efectivo y ausencia de timeout residual en la conexión del pool contra PostgreSQL real;
comportamiento de `listV2` y `created_at` contra un bucket autorizado.
