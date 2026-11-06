# GLOBAL-SEARCH-3A · Paginación por cursor (backend)

## 1. Estado base

- Base: `origin/main@0b6475448eb138c21d7fe7b06c3aad77efe3fe11` (#1967, #1968, #1969 y #1970 fusionadas).
- Rama: `feat/global-search-3a-cursor-backend`.
- Scope primario: **backend runtime**. Sin migraciones, dependencias, variables de entorno nuevas ni cambios de frontend.

## 2. Contrato anterior y nuevo

| | Antes (#1967) | Ahora |
| --- | --- | --- |
| Paginación | `offset` ≤ 500 con una sola entidad | `offset` ≤ 500 **o** `cursor` opaco con una sola entidad |
| Alcance por entidad | hasta 525 registros (500 + 25) | **todos** los registros autorizados |
| Continuación | `groups[].hasMore` | `groups[].hasMore` + `groups[].nextCursor` (string, presente exactamente cuando `hasMore`) |
| Errores nuevos | — | 400 `Cursor de búsqueda inválido` · 400 `El cursor no se combina con offset` · 400 `El cursor requiere un único tipo de entidad` |

Reglas del parámetro `cursor`: máximo 512 caracteres, requiere exactamente una entidad (`kinds=<k>` o un filtro de informe, que acota a informes), no se combina con `offset`. Cada respuesta, incluida «Todo» (varias entidades), devuelve un `nextCursor` por entidad, para continuar esa entidad por separado.

**Compatibilidad**: los clientes que usan `offset` (incluido el frontend de #1970) siguen funcionando sin cambios; la ventana de `offset` conserva su límite de 500.

## 3. Estructura y validación del cursor

`v1.<payload base64url>.<HMAC-SHA256 base64url>` (`server/features/global-search/domain/global-search-cursor.ts`).

- **Payload**: sólo posición y vencimiento: `k` (entidad), `r` (rango 0–3), `t` (marca de orden exacta con microsegundos, `to_char(col, 'YYYY-MM-DD HH24:MI:SS.US')`), `i` (id), `e` (vencimiento, 2 h). Nunca la consulta, nombres de pacientes o tutores ni valores clínicos.
- **Firma**: HMAC-SHA256 sobre el payload **y el contexto**: superficie (`clinic`/`admin`), tenant de la sesión (Clínica) o filtro de clínica (Admin), entidad, texto normalizado de la consulta, estado, tipo de estudio y fechas. El contexto no viaja en el token: un cursor de otra clínica, superficie, consulta, filtro o entidad no verifica, y cualquier edición de la posición tampoco.
- **Clave**: derivada por HKDF-SHA256 de `SUPABASE_SERVICE_ROLE_KEY` (secreto de servidor ya obligatorio) con etiqueta propia (`vetneb.global-search` / `cursor/v1`): el secreto nunca se usa directamente como clave MAC, no hay configuración nueva y funciona igual en varias instancias. Rotar el secreto sólo invalida cursores vivos.
- **Rechazos indistinguibles**: versión desconocida, token mal formado, firma inválida, contexto distinto, vencido o con vencimiento fuera de ventana → el mismo 400 sin detalle ni filas.
- **El cursor no otorga nada**: tenant y filtros se vuelven a aplicar siempre desde la sesión y la solicitud.

## 4. Ordenamiento SQL

| Entidad | Orden (total) | Columna de orden |
| --- | --- | --- |
| Informes | `rank` ASC, `created_at` DESC, `id` DESC | `reports.created_at` |
| Tokens particulares | `rank` ASC, `created_at` DESC, `id` DESC | `particular_tokens.created_at` |
| Seguimientos | `rank` ASC, `reception_at` DESC, `id` DESC | `study_tracking_cases.reception_at` |
| Clínicas | `rank` ASC, `updated_at` DESC, `id` DESC | `clinics.updated_at` |
| Usuarios de clínica | `rank` ASC, `updated_at` DESC, `id` DESC | `clinic_users.updated_at` |

- Las cinco columnas son `timestamp NOT NULL`: no hay fechas nulas posibles; los empates se rompen por `id` (único).
- Predicado keyset (parametrizado): `rank > $r OR (rank = $r AND (col, id) < ($t::timestamp, $id))`. `rank` es la misma expresión `CASE` del `ORDER BY`, recalculada con la misma consulta (el cursor está atado a ella).
- La marca viaja como texto exacto de PostgreSQL con 6 decimales (`to_char(col, 'YYYY-MM-DD HH24:MI:SS.US')`) porque `Date` de JavaScript sólo guarda milisegundos: dos filas del mismo milisegundo nunca se funden ni se invierten. Se usa `to_char` y no `col::text` porque la salida de `::text` depende del `DateStyle` de la sesión (verificado: con `SQL, DMY` devuelve `06/11/2026 …`); la entrada ISO se lee igual con cualquier estilo.
- `hasMore` sigue siendo la ventana `limit + 1`, sin `COUNT`.
- **Corrección incluida**: `mergeGlobalSearchHits` reordenaba cada página por la fecha visible (`upload_date ?? created_at`, milisegundos), que no es la columna del `ORDER BY` de informes. Ahora es una mezcla k-way: conserva el orden SQL dentro de cada entidad y el comparador sólo elige entre cabezas de entidades distintas. Sin esto la continuación keyset no coincidía con el orden de la página.

## 5. Consistencia ante cambios concurrentes

La paginación keyset **no** es una fotografía inmutable (no hay snapshot ni transacción entre páginas). Garantías medidas contra PostgreSQL real:

| Cambio durante el recorrido | Efecto |
| --- | --- |
| Alta que ordena **antes** del cursor | no se ve |
| Alta que ordena **después** del cursor | se ve una vez |
| Baja de una fila pendiente | no aparece y no desplaza a ninguna otra (a diferencia de `offset`) |
| Fila cuya clave de orden cruza el cursor hacia atrás | se pierde en ese recorrido |
| Fila cuya clave de orden cruza el cursor hacia adelante | se ve dos veces (el paginador del frontend deduplica por `kind:id`) |
| Filas sin cambios | se ven exactamente una vez y en orden |

## 6. Matriz de permisos

| Actor | Ruta | Cursor | Resultado |
| --- | --- | --- | --- |
| Clínica A | `/api/search` | propio | 200, sólo filas de A |
| Clínica B | `/api/search` | de A | 400 |
| Clínica A | `/api/search` con otra consulta, filtro o entidad | de A | 400 |
| Admin | `/api/admin/search` | de Clínica | 400 |
| Admin | `/api/admin/search` con otro `clinicId` o sin él | con `clinicId=A` | 400 |
| Cookie de Clínica | `/api/admin/search` | cualquiera | 401 |
| Sin sesión | ambas | cualquiera | 401 |

Respuestas `no-store` (hook existente de API sensible).

## 7. Resultados

- Unit (dominio): códec — round trip con microsegundos, payload sin texto, rechazo en otro contexto (7 variantes) y con otra clave, 8 manipulaciones, vencimiento, posiciones inválidas; parser — reglas de `cursor`.
- Forma SQL: predicado keyset parametrizado en las 5 entidades, tenant primero, `offset` anulado, texto hostil como parámetro.
- Rutas (1.200 registros con empates cada 7): recorrido completo por cursor sin duplicados ni omisiones; orden idéntico a `offset` dentro de los primeros 525; «Todo» emite un cursor por entidad; reutilización entre clínicas, consultas, filtros, superficies y entidades rechazada.
- **PostgreSQL real** (`portal_vetneb_ci`, PG 17.10, sintético): conjuntos de **2.000, 10.000 y 25.000** informes recorridos hasta el final en el orden exacto del SQL; microsegundos distintos dentro del mismo milisegundo; tildes; id exacto con rango 0; filtros combinados por cursor = conjunto SQL; cursor manipulado, entre clínicas y entre superficies → 400; Clínica contra Admin → 401; Clínica B ve sólo sus 300 homónimos; compatibilidad `offset`; escenario concurrente de §5.
- Rendimiento por página (API, incluye autenticación y serialización):

| Conjunto | Páginas (25) | p50 | p95 |
| --- | ---: | ---: | ---: |
| 2.000 | 80 | 97,5 ms | 156,6 ms |
| 10.000 | 400 | 126,2 ms | 196,4 ms |
| 25.000 | 1.000 | 172,1 ms | 233,3 ms |

  Presupuesto p95 < 750 ms de GLOBAL-SEARCH-1 conservado.

- `EXPLAIN (ANALYZE, BUFFERS)` sobre 25.000 coincidencias (~37.000 informes en total): primera página 138 ms; página keyset tras 20.000 filas 138 ms; página `offset 500` 159 ms; Admin sin filtro de clínica, keyset profundo 324 ms. Todas son `Seq Scan` o `Index Scan` por `clinic_id` + `top-N heapsort`: el costo lo domina el filtro `ILIKE` sobre texto plegado, no la profundidad. El keyset mantiene el costo de una página profunda igual al de la primera; los índices trigram de expresión siguen siendo trabajo de GLOBAL-SEARCH-3D (migración R2).

## 8. Costo de «Todo» y protecciones pendientes (GLOBAL-SEARCH-3C)

«Todo» pide una ventana por entidad y página (3 en Clínica, 5 en Admin). Cada ventana recorre el filtro completo de su entidad. 3C debe agregar un límite del lado servidor por actor (sesión), contando cada solicitud de búsqueda, con 429 y `Retry-After`, sin usar el texto buscado como clave ni registrarlo, y válido con varias instancias.

## 9. Plan GLOBAL-SEARCH-3A-CURSOR-FRONTEND

1. `lib/global-search-pager.ts`: cada flujo guarda `nextCursor` en lugar de `offset`; la primera ventana sigue siendo `offset=0` (o sin parámetro), las siguientes `cursor=<nextCursor>`.
2. Retirar el estado `capped` y el aviso «afiná la búsqueda»: sin tope, el paginador recorre hasta `hasMore = false`.
3. Un 400 de cursor (vencido tras 2 h) reinicia la sesión en la página 1 con aviso.
4. Mantener la deduplicación por `kind:id` (cubre el caso concurrente de §5).
5. E2E: el stub del spec modela `nextCursor`; prueba de un recorrido de más de 525 registros por categoría y en «Todo».

## 10. No alcance

Frontend (3A-CURSOR-FRONTEND), nuevas entidades (3B), rate limit (3C), índices y migraciones (3D), evidencia en staging (BLOCKED, AGENTS §17).
