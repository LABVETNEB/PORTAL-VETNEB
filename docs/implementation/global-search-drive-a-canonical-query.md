# Global Search — Entrega A: consulta canónica (paridad funcional con Drive)

| Campo | Valor |
| --- | --- |
| Alcance | `server/features/global-search/{domain,application,infrastructure}`, `server/routes/global-search-states.fastify.ts`, `drizzle/` (0031), `frontend/src/lib/global-search*.ts`, FSM de navegación del dashboard (`search`), diálogo y barra del buscador, tests |
| Riesgo | R2 (contrato de búsqueda; A4: schema + migración 0031 + endpoints + contrato de la FSM, autorizados por Nico el 2026-11-11). Sin RLS, dependencias, auth ni workflows. La migración 0031 se ejecutó **sólo** en la base aislada de laboratorio (acta PostgreSQL); no se aplicó a staging ni producción |
| Referencia externa | `docs/implementation/FUNCIONALIDAD SUPERBUSCADOR.md` (investigación, no fuente rectora) |
| Antecedentes | `global-search-phase-2-query-engine.md` (gramática base), `global-search-phase-2-ui.md` |
| Estado | Publicación escalonada en tres PRs (sección «Estrategia de publicación»); el estado de cada etapa lo fija su PR fusionado. Certificado contra PostgreSQL real en laboratorio (`global-search-a4-postgres-certification-acta.md`, C1–C10 PASSED sobre un árbol de trabajo sin commit) |

## Resumen

Hay **un solo modelo de consulta** (palabras + operadores + filtros). El texto que escribe la persona, los chips,
el panel de filtros, las categorías, el formulario avanzado y el request a la API son vistas del mismo modelo.

```text
texto → parser → modelo canónico → chips / filtros / categorías
chips / filtros / formulario → modelo canónico → texto (orden determinista) → API
```

El servidor sigue siendo la autoridad: el parser del cliente (`frontend/src/lib/global-search-query.ts`) es
**permisivo** (lo que no entiende queda como término literal y el servidor responde su 400 cerrado) y un test de
paridad compara su significado con el del parser del servidor sobre un corpus.

## Gramática (A1, A5)

| Forma | Significado |
| --- | --- |
| `luna perez`, `"luna perez"`, `luna OR rex` | AND implícito, frase exacta, OR (sólo mayúsculas). AND liga más fuerte que OR |
| `title:luna`, `title:"luna perez"` | el término sólo coincide con el título visible |
| `type:informe` (alias en fase 2) | restringe entidades; varios `type:` se unen; nunca amplía la superficie |
| `status:ready` (`estado:`) | estado del informe: `uploaded`, `processing`, `ready`, `delivered` (sin tildes, insensible a mayúsculas) |
| `study:histopatologia` (`estudio:`) | tipo de estudio del informe (`^[a-z]{3,40}$` tras plegar tildes) |
| `after:2026-01-01` | informes creados **desde** ese día, **inclusivo**, día UTC |
| `before:2026-12-31` | informes creados **hasta** ese día, **inclusivo** (hasta 23:59:59.999 UTC) |
| `clinic:12` (`clinica:`) | sólo Admin: estrecha a una clínica |

Reglas formales:

- **Precedencia**: `OR` < AND implícito. Los operadores de filtro y `type:` aplican a **toda** la consulta, en cualquier posición.
- **Reemplazo/duplicados**: el mismo operador con el mismo valor se unifica; con otro valor es **400** `Filtros contradictorios: <op>:`.
  Nunca se resuelve en silencio. `type:` es la excepción histórica: varios valores se unen.
- **Texto + parámetros**: `status`, `studyType`, `from`, `to` siguen aceptándose como parámetros (compatibilidad) y se combinan con el
  operador equivalente sólo si coinciden; si no, **400** `Filtros de búsqueda contradictorios`. `clinic:` contra `clinicId` distinto, ídem.
- **Fechas**: ISO `YYYY-MM-DD` con calendario real (`2026-02-30` → 400 `Fecha de búsqueda inválida`). Zona horaria: **UTC**, igual que `from`/`to`.
  `after` > `before` → 400 `Rango de fechas inválido`. Aplican a `reports.created_at`.
- **Alcance de los filtros de informe**: `status`, `study`, `after`, `before` estrechan a **informes** (como ya hacían `status`/`from`/`to`).
  Con `type:token` u otra entidad → 400 `Los filtros de informe requieren incluir informes`. No se extienden a otras entidades
  (cambiaría el significado de búsquedas existentes y esas entidades no tienen estado/estudio de informe).
- **Ausencia de valor**: `type:`, `after:` sin valor (se está escribiendo) no tienen efecto.
- **Desconocidos**: operador desconocido → 400 `Operador de búsqueda desconocido: x:`. Entre comillas o con forma de hora (`10:30`) es literal.
- **Límites**: 8 términos, 4 alternativas OR, `q ≤ 200` caracteres (antes 80; el servidor trunca como siempre, por eso el cliente **nunca**
  compone más de 200 y lo avisa en vez de truncar operadores). Cada filtro admite un único valor, así que a lo sumo hay 5 operadores de filtro.
- **SQL**: cada término sigue llegando sólo como patrón LIKE escapado ligado como parámetro; estado, estudio, fechas y clínica también son
  parámetros (`createdFrom`/`createdTo` son `Date`). Los operadores no construyen texto SQL.

## A3 — búsquedas sólo de filtros

`type:informe`, `after:2026-01-01`, `type:informe before:2026-12-31` son válidas. `clauses` queda vacío y el predicado de texto es `true`;
el **tenant sigue siendo el primer predicado** del `WHERE`. El orden es `(3)::int` (rank constante; expresión tipada porque un entero
desnudo en `ORDER BY` sería una posición de columna), luego fecha y `id`: el keyset y los cursores firmados no cambian de versión.
Sin términos **ni** filtros (`OR`, `""`, `type:`) sigue siendo 400. Acotación: `limit ≤ 25`, `offset ≤ 500`, cursor, rate limit por entidad
consultada y tenant de la sesión. Costo: una consulta sólo-`type:` recorre las filas del tenant en orden `created_at DESC`; el límite lo fija
`LIMIT 26` (no hay COUNT). El aislamiento Clínica A/B está probado con el stand-in de contrato (tests de rutas), **no** contra PostgreSQL real.

## A2 — filtros persistentes

Estado del diálogo: `query` (palabras, y operadores aún sin confirmar) + `filters` (aplicados). Los filtros **efectivos** son los aplicados con
los operadores escritos encima, campo por campo.

- Cambiar las palabras no toca `filters`. Escribir un operador reemplaza **sólo** ese filtro y se pliega a chip al confirmar (Enter, o al editar
  cualquier filtro). Quitar un chip o «Borrar filtros» conserva las palabras y los demás filtros.
- Lo que llega desde la barra superior (botón «Ver todos…» o Enter) **ya no reinicia** los filtros (antes: `setFilters(EMPTY_GLOBAL_SEARCH_FILTERS)`).
  Una búsqueda reciente restaura sus propios filtros (`replaceFilters`).
- La barra refleja las palabras del diálogo (`onSearchStateChange`) y su vista previa usa los mismos filtros; el aviso «Filtros activos: …»
  del desplegable los hace visibles.

## A6 — formulario avanzado

El panel «Filtros» agrega **Contiene las palabras**, **Frase exacta**, **Sólo en el título o nombre** y **Tipo de registro** a Estado, Tipo de estudio,
Desde, Hasta y (Admin) ID de clínica. Los filtros se aplican al instante (como antes); los tres campos de texto se componen con
`composeAdvancedFreeText` y reemplazan las palabras al pulsar «Ver resultados» **sólo si la persona los editó**. Si la consulta tiene algo que el
formulario no expresa (alternativas `OR`, varias frases, términos literales), el formulario no la sobrescribe. Una palabra que parezca operador se cita.
El formulario no es un motor paralelo: produce texto del mismo modelo.

## A4 — recuperación y navegación (implementado, R2 autorizado el 2026-11-11)

La consulta nunca viaja en la URL: la URL lleva **sólo un id aleatorio** (`?sq=<uuid v4>`) de una búsqueda guardada en el servidor, ligada a la sesión.
La diferencia con Drive (que pone la consulta en la URL) es deliberada: las consultas contienen nombres de pacientes y tutores.

| Pieza | Implementación |
| --- | --- |
| Tabla | `global_search_states` (`drizzle/migrations/0031_global_search_states.sql`, `drizzle/schema.ts`): `id uuid` (aleatorio, sin significado), `surface`, `clinic_session_token_hash` → `active_sessions.token_hash` **o** `admin_session_token_hash` → `admin_sessions.token_hash` (`ON DELETE CASCADE`, CHECK de exactamente uno según `surface`), `query_text varchar(200)`, `kinds varchar(120)`, `created_at`, `expires_at`; índices por sesión y por caducidad |
| Qué se guarda | el texto canónico y la categoría. Nunca resultados, cursores, hits ni datos de paciente que no haya escrito la persona |
| Caducidad | `min(24 h, vigencia restante de la sesión)`; además se exige `expires_at > ahora` **al leer**, así un estado vencido es invisible antes de borrarse físicamente. Los vencidos de la sesión se borran al guardar |
| Tope | 20 por sesión: se guarda dentro de una transacción con `pg_advisory_xact_lock` por sesión (sin carreras), se descarta el más antiguo y un texto idéntico reutiliza el id |
| Logout / revocación | `deleteActiveSession`/`deleteAdminSession` son `DELETE`: la cascada borra los estados. Una sesión revocada además falla la autenticación (401) antes de tocar la tabla |
| API | `POST /api/search/states` y `POST /api/admin/search/states` (201 `{id}`); `GET .../states/:id` (200 `{q, kinds}`). `app_session_id`/`admin_session_id`, confianza de origen (CSRF) en el `POST`, presupuesto del buscador (1 unidad), `Cache-Control: no-store`, el texto nunca se registra |
| Autorización | el id **no** autoriza: se exige la cookie de la superficie y que sesión y superficie coincidan. Inexistente, mal formado, vencido, de otra sesión, de otra clínica o de la otra superficie responden el **mismo** 404 `Búsqueda guardada no disponible` |
| Validación | texto 1–200 con el parser del dominio (no admite operadores inválidos), sin caracteres de control; `kinds` ⊂ categorías de la superficie, sin repetir |
| Navegación | `search` es parte de `NavLocation` de la FSM (`dashboardNavigationMachine.ts`): se selecciona con los **mismos** eventos `SELECT_MODULE`/`SELECT_HUB`/`OPEN_ROUTE` (campo opcional `search`), de modo que single-flight, supersede e historial son los de la máquina. No hay evento nuevo ni segunda autoridad; nada toca `window.history`. El proveedor lee `?sq=` (sólo si es un uuid v4), lo agrega al href y publica el `search` del display a la barra (`searchNavigation.ts`) |
| UI | al ejecutar una búsqueda (Enter o petición de la barra) el diálogo la entrega canónica a la barra, ésta la guarda y pide a la FSM seleccionarla; cualquier display con `sq` (recarga, Atrás, Adelante) la carga de vuelta y abre el diálogo con consulta, chips y resultados. Cerrar el diálogo selecciona la ubicación sin `sq`. Un estado vencido o ajeno muestra «La búsqueda guardada venció o no está disponible» y **no ejecuta ninguna búsqueda** |
| Rollback | ver abajo |

Comportamiento: A → B → Atrás recupera A (URL y UI), Adelante recupera B; abrir un registro y volver (Atrás) reabre la búsqueda; recargar la reconstruye;
repetir la misma búsqueda no agrega entradas ni vuelve a guardar. Salir del módulo suelta el `sq`.

### Rollback de la migración 0031

La tabla sólo contiene estados de interfaz caducables: quitarla no pierde datos de negocio. Con el código ya revertido (o desplegado el anterior, que no la usa):

```sql
DROP TABLE IF EXISTS "global_search_states";
```

y borrar la entrada `0031_global_search_states` (`idx` 31) de `drizzle/migrations/meta/_journal.json` junto con el archivo. Con la tabla ausente, los endpoints
responden 500 sanitizado y el buscador sigue funcionando (el guardado falla en silencio y no hay `?sq=`). Ensayo previo a datos reales: ejecutar la migración
sobre una base **no productiva** con datos sintéticos, verificar la cascada borrando una fila de sesión y repetir el `DROP`. **Ensayado** el 2026-11-11 en la base aislada de laboratorio con la tabla vacía: `BEGIN; DROP; ROLLBACK` y un `DROP` real seguido de la reaplicación del SQL de 0031, con el inventario de objetos idéntico antes y después (acta PostgreSQL). La cascada se verificó en C5. No se ensayó con datos reales ni en staging.

### Barra superior: un solo flujo de confirmación

Toda forma de confirmar una búsqueda (Enter en la barra o en el diálogo, «Ver todos los resultados», una búsqueda reciente, un resultado sugerido
con su consulta de origen, consultas con operadores y filtros) pasa por el diálogo, que entrega la búsqueda **canónica** a una única función de la barra.
Esa función guarda y pide a la FSM seleccionarla. La vista previa por pulsación no llega a ella: no guarda nada ni agrega entradas al historial.
Protecciones: Enter repetido (mismo texto ya guardado o en vuelo) no repite el guardado; una respuesta tardía no navega si otra confirmación la superó o si el
diálogo ya se cerró (por ejemplo, al abrir un registro); un guardado fallido deja la búsqueda funcionando sin `?sq=`.

### Retención y limpieza de estados vencidos

- **Sesión terminada** (logout, revocación, vencida, borrada por `deleteExpiredSessions`/`deleteExpiredAdminSessions` al arrancar): `DELETE` + cascada. Mientras la
  fila exista, un estado vencido es inaccesible igual (lectura con `expires_at > ahora`).
- **Estado vencido con sesión viva**: se borra físicamente por (a) un borrado acotado (≤ 50 filas por `expires_at`, `FOR UPDATE SKIP LOCKED`, sin esperar locks)
  dentro de cada guardado, (b) el borrado de los vencidos de la sesión que guarda y (c) el paso nuevo del `preflight` de arranque junto a la limpieza de sesiones
  (`deleteExpiredGlobalSearchStates`; si la tabla aún no existe —servidor desplegado antes de la migración— sólo registra una advertencia y no impide arrancar).
  No hay cron, workflow ni servicio nuevo.
- Crecimiento: ≤ 20 filas por sesión viva (tope bajo lock asesor por sesión).
- Pruebas: `global-search-state-retention.test.ts` (fuente de la migración y del repositorio, barrido, tolerancia a tabla ausente), `global-search-states.fastify.test.ts`
  (contrato) y, contra PostgreSQL real, la matriz C1–C10 de `global-search-a4-postgres-certification-matrix.md` (**PASSED** en laboratorio aislado, 2026-11-11).

### Límites declarados de A4

- La migración y el SQL del repositorio de estados **sí** se ejecutaron contra PostgreSQL 17.10 real (laboratorio aislado, datos sintéticos): aislamiento, tope bajo
  concurrencia (40 → 20), cascada, caducidad y uso de índices pasaron en C1–C10. Quedan fuera de esa evidencia: staging/producción, el rol y el pooler productivos, RLS y la
  consulta de búsqueda filtro-solo (A3), que sigue probada con stand-in de contrato (ver el acta).
- La FSM es la única autoridad: el soporte de `sq` se verifica en `dashboard-navigation-search.test.ts` y en los E2E de Clínica y Admin (A→B→Atrás→Adelante,
  registro y vuelta, recarga, enlace en otra pestaña, otra sesión, id inexistente o mal formado, vencido, respuesta tardía, sesión revocada, cambio de superficie).
- Un `?sq=` en la URL de otra superficie (Admin sin módulo, por ejemplo) se descarta.

## Contratos y compatibilidad

- API: `q` ahora puede llevar `status:`, `study:`, `after:`, `before:`, `clinic:`; los parámetros `status`, `studyType`, `from`, `to`, `clinicId`,
  `kinds`, `limit`, `offset`, `cursor` siguen existiendo. El frontend envía los filtros dentro de `q` (la categoría sigue en `kinds`).
- Cursores: sin cambio de versión. El HMAC ata superficie, tenant, entidad, **texto con operadores** y los filtros resueltos; un cursor de otra
  clínica, otro texto o otro filtro es 400 `Cursor de búsqueda inválido` (probado).
- `GlobalSearchLanguage` expone `filters`; `GlobalSearchParsed` expone `clinicId`; `parseGlobalSearchQuery` fusiona texto y parámetros.
- `no-store`, `app_session_id`/`admin_session_id`, rate limit, proyección de hits y errores sanitizados: sin cambios.

## Matriz de aceptación

| Caso | Prueba |
| --- | --- |
| `luna type:informe` / `type:informe` | `global-search-query-language.test.ts`, `global-search.fastify.test.ts` (A3), E2E A1/A3 |
| `luna OR rex`, `"luna perez"`, `title:luna` | tests de lenguaje (fase 2) + paridad en `frontend-global-search-query-model.test.ts` |
| `after:` / `before:` (inclusivo, rangos contradictorios, fecha imposible) | lenguaje, SQL (`global-search-query-language-sql.test.ts`), rutas, E2E A5 |
| Fecha desde formulario → texto y chips | E2E A6 |
| Quitar chip conserva el resto / Borrar filtros conserva texto | `frontend-global-search-query-model.test.ts`, E2E A2/A5 |
| Cambiar `luna` por `rex` conserva filtros (diálogo y barra) | modelo, E2E A2 |
| Operador inválido: 400 claro | lenguaje, rutas, E2E A5 |
| Clínica A/B sin filtración; `clinic:` sólo Admin | `global-search-filter-use-cases.test.ts`, rutas, E2E |
| Cursor de otro texto/filtro/clínica | casos de uso y rutas (A3 cursor) |
| 320/390/768/1024/1920 sin desborde | E2E A6 por viewport |
| Recargar / Atrás-Adelante / URL opaca / registro y volver | E2E «GLOBAL-SEARCH-DRIVE-A4» (Clínica y Admin) |
| Sesión revocada, otra sesión/clínica/superficie, vencido, tope 20, origen, no-store, logs | `global-search-states.fastify.test.ts` |
| FSM: A→B→Atrás→Adelante, hub/ruta, sin evento nuevo | `dashboard-navigation-search.test.ts` + suite de la máquina intacta |
| PostgreSQL real de los estados (aislamiento, cascada, tope, índices, rollback) | `global-search-states-postgres.fastify.test.ts`, C1–C10 PASSED en laboratorio |
| PostgreSQL real de la consulta filtro-solo (EXPLAIN) | NOT_RUN: fuera de la certificación de A4 |

## Divergencia histórica de `clinics` (hallazgo fuera de alcance, no corregido)

`drizzle/schema.ts` declara `clinics` con 6 columnas (`id`, `name`, `contact_email`, `contact_phone`, `created_at`, `updated_at`). La base creada por el historial de
migraciones (0000) tiene además `clinic_id varchar(50) NOT NULL UNIQUE` (sin valor por defecto), `storage_folder_path` y `status` (enum, por defecto `active`).

| Hecho | Evidencia |
| --- | --- |
| Un `INSERT` de Drizzle sin `clinic_id` falla con `23502` contra una base creada por el historial | **Observado** contra PostgreSQL 17.10 real (primera ejecución del spec de estados) |
| `createAdminClinicWithUser` (`admin-clinics-repository.ts`) detecta la columna con `information_schema` (`requiresLegacyClinicId`: `clinic_id` con `is_nullable = 'NO'`, cacheado por proceso). Si es obligatoria, reserva el id con `nextval(pg_get_serial_sequence('public.clinics','id'))`, usa `clinic_id = clinic-<id>` y hace un `INSERT` SQL crudo; si no, usa Drizzle | Lectura del código y `admin-clinics-db-contract.test.ts` (contrato de fuente). **No se ejecutó** `createAdminClinicWithUser` contra PostgreSQL |
| Sobre una base creada por el historial la rama Drizzle de ese repositorio no es alcanzable (la columna es `NOT NULL`) | Inferencia del código y del esquema observado; no probada ejecutando la función |
| Otros specs PostgreSQL (`global-search-postgres-isolation`, `-cursor-`, `-rate-limit-`, `report-by-id-…`, `e2e-global-03b-…`) ya insertan con SQL crudo incluyendo `clinic_id` | `grep` del repositorio |
| `scripts/db/list-or-create-clinic.mjs` inserta una clínica demo **sin** `clinic_id` cuando la tabla está vacía | Lectura del script; **no ejecutado**. Sin referencias desde `package.json`, workflows ni documentación; fallaría con `23502` sobre una base creada por el historial |
| Escrituras Drizzle sobre `clinics` en `server/`: un `insert` (el de la rama anterior), un `update` y un `delete`; los dos últimos no dependen de las columnas omitidas | `grep` |

Riesgo real: bajo y acotado. **No** se afirma que la creación de clínicas falle: la ruta de producción del repositorio es la compatible. El riesgo es (1) cualquier `insert(clinics)`
de Drizzle futuro, que fallaría contra el esquema histórico, (2) el script de demo, y (3) que `schema.ts` ya no sea fuente fiel de la tabla (`schema:verify` sólo comprueba columnas
críticas de otras tablas, así que no lo detecta). Corregirlo (alinear `schema.ts` o retirar la rama doble) es R2 y **no** forma parte de la Entrega A: PR propia, con su propio rollback.
La Entrega A sólo ajustó el fixture del spec de estados para insertar con SQL crudo.

## Estrategia de publicación (AGENTS.md §4)

**Veredicto: sin excepción mixed-scope.** La Entrega A se publica en tres PRs secuenciales, cada una con un único scope primario según el clasificador de `scripts/governance/pr-governance-validator.mjs`
(`drizzle/` → database/migrations; `server/` → backend; `frontend/` → frontend; `test/` y documentación son categorías de apoyo). El estado de cada etapa lo fija su PR fusionado.

| Etapa | Scope primario | Contenido |
| --- | --- | --- |
| 1 | database/migrations | `0031_global_search_states.sql`, entrada del journal, tabla en `drizzle/schema.ts`, la aserción del journal en `admin-clinics-db-contract.test.ts` y esta documentación (contrato, matriz y acta PostgreSQL) |
| 2 | backend | gramática y filtros de la consulta, repositorio/casos de uso/rutas de estados guardados, `preflight` y arranque, sus tests y los guards de servidor (m45/m46/m48, censo 01B) |
| 3 | frontend | FSM de navegación (`search`), proveedor y adaptador `searchNavigation.ts`, diálogo y barra del buscador, cliente de la API, modelo de consulta del cliente, E2E y los guards de frontend afectados |

### Grafo de dependencias (verificado por imports y por ejecución)

```text
Etapa 1  tabla                         ← no depende de código nuevo (sólo de active_sessions / admin_sessions, ya existentes)
Etapa 2  backend                       ← usa la tabla de la etapa 1
Etapa 3  FSM + UI                      ← usa la API de la etapa 2 (`q` con filtros, /states) y el parser del servidor en el test de paridad
```

La etapa 1 no tiene consumidores: la tabla existe y nada la lee (expand). La etapa 2 con la etapa 1 aplicada es completa en backend. La etapa 3 sólo se publica con la 2 desplegada.
Que `q` sea común no los vuelve un solo cambio: el servidor es la autoridad, el cliente es permisivo y un test de paridad los compara.

### Contrato de compatibilidad y rollback por etapa

| Etapa | Compatibilidad hacia atrás | Rollback |
| --- | --- | --- |
| 1 | Sin lectores ni escritores: el servidor y el frontend vigentes no la usan | `DROP TABLE IF EXISTS "global_search_states"` y retirar 0031 del journal (ensayado en el laboratorio, ver el acta). Sólo si las etapas 2 y 3 ya se revirtieron |
| 2 | La UI anterior sigue válida: los parámetros `status`, `studyType`, `from`, `to`, `clinicId`, `kinds`, `limit`, `offset`, `cursor` se aceptan; las rutas `/states` no las usa nadie aún. Con la tabla ausente (etapa 2 desplegada antes que la migración) el `preflight` sólo advierte y los endpoints responden 500 sanitizado | revertir el código; los estados guardados caducan o se borran por cascada. Sólo si la etapa 3 ya se revirtió |
| 3 | Requiere las etapas 1 y 2 **desplegadas**. `search` es opcional en la FSM: sin `?sq=` el comportamiento es el anterior | revertir; los estados quedan huérfanos y caducan; los `?sq=` en URLs viejas se ignoran |

Orden de despliegue **1 → 2 → 3**; de rollback **3 → 2 → 1**. Revertir la etapa 2 con la 3 vigente rompería las búsquedas con filtros (400 por operadores desconocidos) y el guardado.

### Validación por etapa

Cada etapa se valida sobre un árbol que contiene `main` más las etapas anteriores y la propia, nunca archivos de etapas posteriores. La evidencia que vale para el merge es la CI del head de su PR (§5.7);
el ensayo previo se hizo en repositorios desechables construidos con `git archive` de `main` y sólo los archivos de la etapa.

### Riesgos

1. **Desfase backend/frontend en producción** (se despliegan por separado): no fusionar la etapa 3 hasta confirmar la etapa 2 desplegada y, para guardar búsquedas, la migración 0031 aplicada (R3, decisión de Nico).
2. **Guards y censos que anclan literales**: cada etapa realinea sólo lo suyo y se re-mide sobre su propio árbol.
3. **Sin E2E de A4 hasta la etapa 3**: el E2E necesita las tres capas; las etapas 1 y 2 quedan cubiertas por tests de contrato, de fuente y por la certificación PostgreSQL.

## Fuera de alcance

- `owner:`, ubicación, destacados y otros conceptos de Google Workspace: **no aplicables** (VETNEB no tiene propietario compartible ni carpetas;
  no se inventan columnas). `clinic:` es el único equivalente (la clínica dueña del registro), sólo Admin.
- Fechas para entidades distintas de informe, exclusión `-término`, tolerancia tipográfica (ver fase 2).
- Entregas posteriores: inteligencia, historial y experiencia.
