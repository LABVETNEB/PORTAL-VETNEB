# Superbuscador — certificación productiva residual de búsquedas guardadas

| Campo | Valor |
| --- | --- |
| Estado del registro | **CLOSED — GO CON LIMITACIONES** |
| Decisión final | **GO CON LIMITACIONES** para guardado, recuperación, navegación y aislamiento entre clínicas, entre sesiones administrativas y entre superficies |
| Fecha de cierre (UTC) | 2026-11-26 15:48Z |
| Aceptación | Autorización expresa de Nico: se acepta la cobertura de laboratorio para la expiración y la cobertura productiva entre sesiones para Administración. Dos controles quedan **NOT_RUN** como riesgos residuales aceptados |
| Entorno | Producción: frontend `portal-vetneb-frontend-staging` y backends A/B sobre la base compartida |
| Commit / deploys | `0b0d6a13d82f`; `dep-dc2stbu7bikc73887990`, `dep-dc36g60m7kps73dbbhm0`, `dep-dc36hqm7bikc73c93ldg` |
| Datos | Consultas sintéticas sin sentido; no se abrieron registros |
| Incidencia estructural 0031 | Cerrada en [`global-search-states-0031-production-repair-acta.md`](global-search-states-0031-production-repair-acta.md) |

Fuera de este registro y **abiertos**: `BYPASSRLS` del rol de aplicación, la reconciliación del historial Drizzle y la validación real de `listV2` de Supabase Storage (SEC-09). El cierre de este registro **no** certifica la seguridad general de PORTAL-VETNEB.

## Decisión de cierre

| Control | Estado final |
| --- | --- |
| F01–F03 (guardar, recuperar, navegar) en Clínica y Administración | PASSED (producción) |
| F04 aislamiento entre dos clínicas | PASSED (producción) |
| F05 controles negativos, salvo estado expirado | PASSED (producción) |
| F06 persistencia y seguridad | PASSED (producción) |
| R1 aislamiento entre dos sesiones administrativas | PASSED (producción) |
| R1 aislamiento entre dos identidades administrativas | **NOT_RUN** — riesgo residual aceptado |
| R2 cruce Clínica–Administración con estados vivos | PASSED (producción) |
| R3 expiración efectiva en producción | **NOT_RUN** — riesgo residual aceptado; cubierta sólo en laboratorio |
| R4 transición de sesión entre superficies | Comportamiento previsto |

### Riesgos residuales aceptados

| Riesgo | Qué no se observó en producción | Cobertura que se acepta | Condición de futura verificación |
| --- | --- | --- | --- |
| RR-1 · identidades administrativas | Que un usuario administrativo distinto no recupere el estado de otro | Aislamiento por sesión PASSED en producción (el dueño de un estado es la sesión) | Al existir una segunda identidad administrativa de prueba autorizada: repetir los pasos de R1 con una sesión por identidad |
| RR-2 · expiración | Un estado vencido consultado con una sesión vigente (404 sin texto) | Spec PostgreSQL de laboratorio (C4) y, en producción, vencimiento persistido igual al de la sesión | En un entorno no productivo con fixtures vencidos, o si el contrato permite que un estado venza antes que su sesión (p. ej. TTL del estado menor que la duración de la sesión). No se alteran relojes ni fechas en producción |

Reabrir este registro si cambian el contrato de dueño o de caducidad de los estados, la autenticación de alguna superficie o el esquema de `global_search_states`.

## Base ya certificada (no se repite)

Ejecutada el 2026-11-25 entre ≈12:08Z y ≈12:25Z. F01 guardar, F02 recuperar y F03 navegación: PASSED en Clínica y Administración. F04: PASSED entre dos clínicas distintas (A y B), en ambos sentidos, y cada cookie de una superficie recibió 401 en el endpoint de la otra. F05: controles negativos PASSED salvo el estado expirado. F06: persistencia y dueño correctos, sin nuevos `42P01`.

## Controles residuales (evidencia)

### R1 — Aislamiento entre dos sesiones administrativas

| Campo | Valor |
| --- | --- |
| Estado | **PASSED — aislamiento entre sesiones** de una misma identidad administrativa. Aislamiento entre **dos identidades** administrativas: **NOT_RUN** |
| Ejecutado (UTC, reloj de la base) | 2026-11-26 15:32Z |
| Entorno / commit | Producción; `0b0d6a13`; deploys de la cabecera |
| Sesiones | Admin A (navegador integrado) y Admin B (Chrome), iniciadas por Nico. Lectura acotada: 2 sesiones admin vigentes, 2 filas distintas, 1 mismo usuario administrativo (hay una sola cuenta) |
| Prueba | Cada sesión guarda un estado sintético, lee el propio, pide el de la otra y vuelve a leer el propio |
| `POST /api/admin/search/states` | A: 201, B (con categoría `clinic`): 201; cuerpo sólo `success` e `id`; `no-store` |
| `GET` propio | A y B: 200, texto propio, categorías propias, `no-store`; repetido tras el cruce: 200 |
| `GET` ajeno | A→B y B→A: 404 `Búsqueda guardada no disponible`, sin texto ni categorías, `no-store` |
| Persistencia | Dos filas `surface=admin` vigentes, cada una ligada a una sesión distinta (comparación por orden, sin leer ni mostrar hashes) |
| Alcance certificado | El dueño de un estado es la **sesión**: otra sesión, aun del mismo usuario, no lo recupera |
| Riesgo residual | No observado entre dos usuarios administrativos distintos; aceptado el 2026-11-26 (RR-1) |
| Verificación futura | Segunda identidad administrativa de prueba autorizada (RR-1) |

### R2 — Cruce Clínica–Administración con estados vivos

| Campo | Valor |
| --- | --- |
| Estado | **PASSED** |
| Ejecutado (UTC, reloj de la base) | 2026-11-26 15:32Z–15:35Z |
| Entorno / commit | Producción; `0b0d6a13`; deploys de la cabecera |
| Sesiones | Admin (navegador integrado: admin 200, clínica 401) y una clínica de prueba (Chrome: clínica 200, admin 401), iniciadas por Nico en perfiles separados y vigentes a la vez |
| Estados vivos | Uno por superficie, verificados en lectura acotada: `surface=admin` ligado sólo a sesión admin; `surface=clinic` (categoría `report`) ligado sólo a sesión clínica |
| Recuperación propia | `POST /api/search/states` 201 (cuerpo sólo `success` e `id`); cada superficie lee el suyo: 200 con su texto, antes y después de los cruces |
| Cruce con autenticación válida en la superficie receptora | Clínica pide el id admin por `/api/search/states/:id`: 404; Admin pide el id clínico por `/api/admin/search/states/:id`: 404. Mensaje genérico, sin texto ni categorías |
| Cookie de la otra superficie | Cookie clínica en endpoint admin (id admin e id propio): 401 `Admin no autenticado`. Cookie admin en endpoint clínico (id clínico e id admin): 401 `No autenticado` |
| Caché | `Cache-Control: no-store` en todas las respuestas |
| Alcance certificado | Separación entre las superficies Clínica y Administración con estados vivos, para las dos sesiones usadas |
| Riesgo residual | Ninguno observado en este alcance; el aislamiento entre clínicas se certificó el 2026-11-25 (F04) |

### R3 — Expiración efectiva

| Campo | Valor |
| --- | --- |
| Estado | **NOT_RUN** (no observable por la API en las condiciones actuales) |
| Revisado (UTC) | 2026-11-26 15:15Z |
| Prueba | Leer con sesión válida un estado vencido y obtener 404 sin texto |
| Resultado observado | Quedan 2 filas sintéticas, ambas vencidas (expiraron 2026-11-26 12:16:51Z y 12:21:45Z). En ambas `expires_at` del estado es igual al de su sesión, así que la sesión venció en el mismo instante; un 401 no certificaría la caducidad del estado, y una sesión nueva respondería 404 por ser ajena |
| Evidencia | Lectura acotada: fechas de creación y expiración, sin texto ni hashes |
| Alcance por contrato | `expires_at = min(ahora + 24 h, vencimiento de la sesión)` y las sesiones duran como máximo 24 h: con la configuración observada un estado no sobrevive a su sesión |
| Evidencia de laboratorio (no productiva) | Spec PostgreSQL, caso C4: estado vencido invisible con la fila aún presente |
| Riesgo residual | La rama «estado vencido con sesión vigente» sólo está cubierta en laboratorio; aceptado el 2026-11-26 (RR-2) |
| Verificación futura | Entorno no productivo con fixtures vencidos (RR-2). No se alteran relojes ni fechas en producción |

La contrapartida observada en producción sí está certificada: la fila guarda como vencimiento el de su sesión. Las filas vencidas se purgan en un guardado posterior o en el arranque del servidor.

### R4 — Transición de sesión entre superficies

| Campo | Valor |
| --- | --- |
| Estado | **Comportamiento previsto** (clasificado; control cerrado) |
| Revisado (UTC) | 2026-11-26 15:15Z |
| Observación original | Tras iniciar sesión como clínica en el mismo perfil, la sesión admin había dejado de existir |
| Evidencia de auditoría (sólo evento y hora) | 2026-11-25: `auth.admin.logout` 12:11:52Z y `auth.clinic.login.succeeded` 12:12:05Z. Hay otro par logout admin → login clínico (12:16:12Z → 12:16:27Z) |
| Evidencia de código | El login unificado de `server/routes/auth.fastify.ts` crea una sola sesión y emite sólo la cookie de esa superficie (`app_session_id` o `admin_session_id`); no borra la sesión ni la cookie de la otra. `auth.admin.logout` lo escribe `POST /api/admin/auth/logout`; en el frontend lo invocan los controles de cerrar sesión. El servidor también elimina una sesión admin vencida o inactiva, pero eso no escribe ese evento |
| Conclusión | La sesión admin terminó por un cierre explícito previo, no por el login clínico. No se registra defecto |
| Límite | La auditoría no distingue qué persona o control disparó la petición de logout |
| Riesgo residual | Ninguno identificado |
