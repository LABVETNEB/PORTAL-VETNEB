# PR-SEC-09D — Dry-run de huérfanos de Storage

## 1. Estado base

- Base: `main@3d7781079bf6059cdceac4dff6f8e239f5601e8f` (SEC-09, SEC-09B y SEC-09C fusionados).
- Scope: backend, **solo lectura**. Sin schema, sin migración, sin dependencias, sin frontend.
- Riesgo abierto que cierra parcialmente (A): los objetos de informe subidos a Storage que ninguna fila de
  `reports.storage_path` referencia no tenían ningún mecanismo de detección. El grupo `storage_orphans` de
  `server/db-maintenance.ts` era una constante (`count: 0`, `supported: false`).

## 2. Qué referencia objetos de Storage (auditado)

| Origen | Columna | Prefijo | Escritor |
| --- | --- | --- | --- |
| Informes | `reports.storage_path` (`NOT NULL`, `UNIQUE`, `varchar(255)`) | `clinics/<clinicId>/<ts>-<hex12>-<nombre>` | único `INSERT`: `report-command-repository.ts`, con el path que devuelve `uploadReport` |
| Avatares | `avatar_storage_path` (dos tablas de perfil público) | `clinic-avatars/<clinicId>/…` | servicio de perfil público |
| Legado | `reports.storage_path` | `reports/<clinicId>/…` (lo acepta `reportStoragePathMatchesClinic`) | histórico; su existencia no se verificó |

Informes y avatares comparten bucket (`SUPABASE_STORAGE_BUCKET`, por defecto `reports`) y se separan por prefijo.

**Dato relevante para el diseño:** `deleteAdminClinic` elimina en cascada las filas de informes, tokens y
seguimiento y **no llama a Storage**. Los archivos de una clínica borrada quedan sin referencia. Por eso el
recorrido empieza en la raíz `clinics/` y no en las clínicas que existen en PostgreSQL. El resto de las fuentes de
huérfanos son compensaciones fallidas (`delete_failed`), commits ambiguos no confirmados y caídas entre la subida y
la transacción.

## 3. Arquitectura implementada

```text
POST /purge-dry-run  { includeStorageOrphans: true }   (sesión admin + origen confiable, como hoy)
  → getStorageOrphanInventory()              server/db-maintenance.ts (cableado)
      → runStorageOrphanInventory()          server/storage-orphan-inventory.ts (puro, sin Storage ni DB)
          ├─ StorageObjectListingPort        createStorageObjectListing()  server/lib/supabase.ts (listV2)
          └─ StorageReferenceLookup          select storage_path from reports where storage_path = any(lote)
```

- **Inventario** (`storage-orphan-inventory.ts`): recorre `clinics/` por cursor, deduplica por clave, clasifica y
  comprueba referencias por lotes. No importa Storage ni la base: recibe puertos. **Nunca lanza**: cualquier fallo
  produce `status: "failed"`, jamás un conteo vacío que parezca limpio.
- **Adaptador** (`createStorageObjectListing`): `listV2` con `with_delimiter: false`, orden `name asc`, sin
  versiones no vigentes ni marcadores de borrado, timeout de 15 s por llamada. Falla cerrado ante error, forma
  inválida, `hasNext` sin cursor, entrada sin `key` o con `key` fuera del prefijo. El error propagado no incluye el
  mensaje del proveedor. Solo expone `listPage`.
- **Mantenimiento**: `POST /purge-dry-run` mantiene su contrato. El inventario remoto corre **solo** si el cuerpo
  trae `includeStorageOrphans: true`; la tarjeta administrativa no lo envía (lo fija un test estructural). Los
  resultados viajan en `storageOrphanInventory`, separados de `candidates` y `totals`.
- `storage_orphans.supported` permanece `false`, `destructiveAction` permanece `null`, `count` permanece `0`: el
  conteo observado **no** entra en `totals.candidateRecords` ni en `supportedCandidateRecords`.

### Clasificación (en este orden; lo ambiguo nunca es candidato)

1. Clave fuera del patrón exacto `^clinics/<id>/<ts>-<hex12>-<nombre>$` (avatares, legado `reports/`, anidados,
   placeholders, ids no válidos) → `unrecognized`.
2. Antigüedad ausente, no parseable o futura (> 5 min) → `unknownAge`.
3. Antigüedad < umbral → `tooRecent`.
4. Referenciado en `reports.storage_path` → `referenced`.
5. Si no, candidato; se vuelve a comprobar la referencia por lotes antes de informarlo
   (`referencedDuringInventory` cuenta los que aparecieron en el intervalo).

Umbral: 24 h, configurable **solo hacia arriba** (`resolveStorageOrphanMinAgeMs`). **No es una garantía** de que
ninguna subida legítima siga en curso: Fastify no define timeout de solicitud, así que el intervalo
subida→commit no tiene cota por configuración.

### Límites y resultados parciales

| Límite | Valor por defecto | Si se alcanza |
| --- | --- | --- |
| páginas | 200 | `status: "truncated"`, `truncationReason: "max_pages"` |
| objetos únicos | 50.000 | `truncated`, `max_objects` |
| duración total | 30 s | `truncated`, `deadline` |
| lote de referencias | 500 | (tamaño de cada consulta) |

`complete` es `true` solo si `status === "complete"`: únicamente entonces los conteos son totales. Un inventario
truncado o fallido nunca debe presentarse como total. Cursor repetido, página con forma inválida, fallo de listado o
de la consulta de referencias → `status: "failed"` con `failureReason` y solo el **nombre** del error.

### Conexiones

El inventario es secuencial: espera una página de Storage, la libera y recién entonces consulta PostgreSQL con una
sentencia breve sin transacción. Nunca hay una conexión ni una transacción abiertas durante una llamada remota,
nunca más de una consulta a la vez y nunca una conexión por objeto: máximo 1 de las 3 conexiones por defecto
(`DATABASE_MAX_CONNECTIONS`). Costo máximo por corrida: 200 listados y unas 200 consultas por lote
(50.000 objetos / 500) más la repetición para candidatos.

### Privacidad

La salida contiene conteos, `objectRef` (`<timestamp>-<hex12>`) y un digest SHA-256 del path para una muestra de
hasta 100 candidatos. No contiene paths, nombres de archivo, ids de clínica por objeto, URLs firmadas ni mensajes de
error. `deletionSafety` es siempre `"not_assessed"`: **un candidato no es seguro de eliminar**.

## 4. Archivos

| Archivo | Cambio |
| --- | --- |
| `server/storage-orphan-inventory.ts` | nuevo: puertos, clasificador, recorrido y resultado |
| `server/lib/supabase.ts` | `createStorageObjectListing` (listV2, solo lectura) |
| `server/db-maintenance.ts` | consulta de referencias, `getStorageOrphanInventory`, texto de `reason` |
| `server/routes/admin-system-maintenance.fastify.ts` | solicitud explícita `includeStorageOrphans` |
| `test/unit/infrastructure/storage-orphan-inventory.test.ts` | nuevo: 24 tests (inventario, adaptador, ruta) |
| `test/unit/infrastructure/storage-orphan-inventory-structure.test.ts` | nuevo: 4 tests estructurales |
| `test/architecture/backend-modularization-m48-final-certification.test.ts` | censo LOC realineado |
| `docs/implementation/m48-backend-modularization-final-certification.md` | tabla y párrafo SEC-09D |
| `test/architecture/test-global-01b-census-contract.test.ts` | re-anclaje de RUNTIME_ONLY (89 → 113) y piso de adopción del lector canónico (443 → 444) |

## 5. Garantías demostradas (con Storage y PostgreSQL simulados)

- Paginación completa por cursor desde `clinics/` y cursor repetido ⇒ fallo cerrado.
- Fallo en página intermedia, forma inválida y fallo de referencias ⇒ error explícito, sin mensajes ni datos.
- Límites de páginas, objetos y duración ⇒ resultado truncado; exactamente `maxObjects` sin más páginas ⇒ completo.
- Referenciados, recientes, de antigüedad nula/inválida/futura, avatares, legado y paths fuera del patrón nunca son candidatos.
- Objetos de clínicas inexistentes en PostgreSQL sí se inspeccionan y pueden ser candidatos.
- Una referencia que aparece durante el inventario retira al objeto de los candidatos.
- Deduplicación por clave; sin llamadas ni consultas superpuestas; sin transacciones ni conexiones reservadas.
- La salida no contiene paths, nombres de archivo ni mensajes de error.
- Sin operaciones destructivas en el inventario, el adaptador ni la consulta de referencias (test estructural).
- La ruta solo ejecuta el inventario con `includeStorageOrphans === true`, exige sesión admin y origen confiable, y
  un inventario que lanza se informa como `failed` sin romper el mantenimiento existente.
- Mutaciones sobre el módulo (sin deduplicación, sin umbral de edad, sin detección de cursor repetido, sin segunda
  verificación, sin filtro de referenciados, edad desconocida admitida, sin patrón exacto) hacen fallar el spec.

## 6. Limitaciones reales (no demostradas)

- **Nada se validó contra Supabase Storage real.** La semántica de `listV2` (orden, paginación, forma de `key`,
  `created_at`, comportamiento ante cambios concurrentes) proviene de los tipos y el código de `@supabase/storage-js`
  2.119.0, no de una ejecución. Si el servidor no devuelve `key`, el adaptador falla cerrado y el inventario queda
  `failed`: la limitación es explícita, no silenciosa. Por eso `supported` sigue en `false`.
- **El listado no es un snapshot atómico.** Altas o bajas durante el recorrido pueden omitir o repetir entradas. Los
  defectos de listado producen solo falsos negativos o duplicados (deduplicados); un objeto listado se clasifica por
  PostgreSQL y por antigüedad, no por el listado.
- **Falsos positivos posibles:** un objeto de una subida en curso o de un commit ambiguo todavía no visible, y un
  reloj de Storage muy distinto del de la aplicación. El umbral de 24 h los mitiga, no los excluye.
- **Falsos negativos posibles:** objetos creados durante la corrida, entradas omitidas por el listado, informes
  borrados después de la comprobación, y todo lo que el recorrido trunque o no cubra (`reports/` legado y avatares).
- No se probó la consulta `= any(...)` contra PostgreSQL real (requiere una autorización R3 específica).
- Un candidato podría dejar de ser huérfano antes de cualquier borrado futuro: toda acción destructiva exigiría una
  revalidación de la referencia y es otra PR.

## 7. Resultados

Estados canónicos (AGENTS §6):

| Gate | Estado |
| --- | --- |
| `pnpm typecheck` | PASSED |
| `pnpm typecheck:test` | PASSED |
| `pnpm build` | PASSED |
| Specs propios (inventario, adaptador, ruta: 24; estructura: 4) | PASSED 28/28 |
| Ruta de mantenimiento existente (`admin-system-maintenance.fastify.test.ts`) | PASSED |
| Guards de arquitectura (M44, M45, M46, M48, 01B, 05A, seguridad) con los archivos nuevos visibles (índice temporal) | PASSED |
| `pnpm test` completo con el índice real | FAILED (67 de 6.099; ver clasificación) |
| `pnpm security:public-surface` | NOT_RUN (no se toca superficie pública) |
| Validación contra Supabase Storage real | NOT_RUN (sin autorización) |
| Consulta por lotes contra PostgreSQL real | NOT_RUN (R3, sin autorización) |

Clasificación de los 67 fallos de `pnpm test` (6.099 tests, 6.031 aprobados, 1 omitido):

- **45 por archivos nuevos sin versionar** (`source path is not a git-tracked file: server/storage-orphan-inventory.ts`):
  los guards M24, M35, M41, M44, M46 y afines leen solo archivos de git. Con los archivos visibles (índice temporal)
  los guards de `test/architecture` pasan. Se resuelven al versionar los archivos.
- **10 specs que exigen una base aislada** (`DATABASE_URL` de `portal_vetneb_ci`): los de PostgreSQL real
  (incluido `report-upload-persistence-postgres.test.ts`) y `e2e-global-03b`. Son R3 y no se ejecutaron.
- **8 de PR governance** (`git commit -m base failed`, firma SSH en repositorios temporales): fallan igual en `main`.
- **3 del auditor de devtools** (`env-value-leak-detector` ×2 y `frontend-public-devtools-exposure-contract`): dependen
  del artefacto local `frontend/.next`; no tocan este scope.
- **1 spec estructural propio** (`storage-orphan-inventory-structure`): lee por el lector canónico, que solo ve
  archivos versionados; pasa con el índice temporal (4/4).

Realineaciones de censo (en esta PR, sin debilitar nada): M48 (raíz 9/2.707 → 10/3.189, `server/lib` 5.990 → 6.075,
`server/routes` 22.293 → 22.333, total 248/51.440 → 249/52.047), 01B (`RUNTIME_ONLY` 89 → 113 con la tolerancia
sin cambios) y piso de adopción del lector canónico 443 → 444.

## 8. Riesgo residual y rollback

- Riesgo: que alguien use un candidato como autorización de borrado. No existe ninguna acción destructiva en esta PR
  y `destructiveAction` es `null`.
- Rollback: revertir el commit squash. Sin migraciones, sin datos y sin cambios de schema.
- Validaciones pendientes contra Storage real: listado completo y orden de `listV2`, forma de `key` y `created_at`,
  comportamiento ante cambios concurrentes, volumen y latencia del bucket. Requieren autorización específica y son
  condición para pasar `supported` a `true` en otra PR.
