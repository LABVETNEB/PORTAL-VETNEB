# PR-SEC-10 — Topes independientes de la IP y criterio E4 redefinido

Estado: **PR #2010 abierta (commit `52004a0f`), con corrección de almacenamiento compartido en el commit siguiente. SEC-10 NO CERRADO**: aprobar CI no lo cierra; falta la evidencia de staging descrita abajo.

## Bloqueo raíz

Un origen detrás de un proxy ajeno no puede probar la IP del cliente: sólo confía en lo que el proxy añadió. La resolución estructural (`TRUST_PROXY_CHAIN`) y la IP firmada Next→Fastify asumen que Render agrega siempre un salto privado y un salto de borde a la derecha del `X-Forwarded-For`. Render no garantiza esa estructura (ver `PR-SEC-10-E4-TRUST-BOUNDARY-ANALYSIS.md` §6). La firma HMAC prueba posesión del secreto, no autenticidad de la IP.

Antes de este cambio, ningún control crítico tenía respaldo independiente de la IP: el login limitaba por `identificador + IP`, y contacto, acceso público a informes y profesionales públicos limitaban sólo por IP.

## Criterio E4 redefinido (aprobado por Nico)

El criterio original («Render garantiza la autenticidad del borde») queda sustituido por:

1. Ningún control crítico depende **únicamente** de la autenticidad de la IP: cada uno tiene un tope independiente de ella.
2. La estructura de la cadena (`X-Forwarded-For`) se valida empíricamente en staging sobre el SHA exacto, con datos sintéticos.
3. La IP registrada en auditoría es **atribución no autenticada** de mejor esfuerzo.

La respuesta humana de Render, si llega, se incorpora a la matriz pero no es requisito de cierre.

## Cambios

- `server/lib/login-rate-limit.ts`: `applyLoginIdentifierCeiling` — tope por identificador (clave independiente de superficie e IP, 5 × el límite por IP, misma ventana, sin reinicio por login exitoso). Aplicado en los logins clínica/unificado, admin y particular. Reutiliza la rama 429 existente; fallo del store = 503 sin evaluar credenciales (sin cambios).
- `server/lib/rate-limit-store.ts`: `consumeGlobalCeiling` — techo global por endpoint (20 × el límite por IP). Se cobra sólo si la request pasó el límite por IP. Aplicado en contacto, acceso público a informes y profesionales públicos (búsqueda y detalle).
- `server/routes/public-professionals.fastify.ts`: los contadores por IP y el techo global de búsqueda y detalle usan el almacén persistente compartido (tabla de rate limit existente, upsert atómico `consume`). Sin store inyectado se carga el persistente; **ya no existe fallback en memoria** en producción. Claves `public-professionals:<scope>:ip:<ip>` y `ceiling:global:<scope>`: no colisionan entre búsqueda, detalle ni otras superficies. Ante fallo del store la ruta responde **503** (`Servicio temporalmente no disponible`) sin evaluar el límite ni ejecutar el handler (fail-closed).
- Realineaciones: censo M48 (LOC), censo 01B/05A (+1 importador del lector canónico), ancla de hash de `particular-auth.fastify.ts`, allowlist de imports de `public-report-access.fastify.ts`.

## Costos aceptados

- Bajo abuso dirigido, el tope por identificador puede bloquear al titular legítimo durante la ventana (15 min). Un tope bajo sería más fácil de explotar; 5× el límite por IP es el compromiso.
- Bajo abuso distribuido, el techo global bloquea también a usuarios legítimos del endpoint. Acota el abuso masivo; no lo distingue.
- Un cliente legítimo con más de 5× intentos fallidos por ventana contra el mismo identificador queda bloqueado.

## Límite distribuido y modos de fallo

- Dos instancias Fastify comparten el mismo presupuesto porque el incremento es una única sentencia `INSERT … ON CONFLICT DO UPDATE` sobre PostgreSQL; no hay lectura-escritura separada. El techo global no depende de `request.ip`.
- Contacto y acceso público a informes ya usaban el store persistente por defecto; un fallo del store hace fallar la request (500 de Fastify) sin servirla: tampoco se omite el límite. No se unificó su respuesta a 503 para no alterar su contrato.
- Riesgo de denegación de servicio: agotar el techo global (20 × el límite por IP) bloquea a los usuarios legítimos de ese endpoint durante la ventana. Es el costo aceptado de no depender de la IP.

## No alcance

Cambio de proveedor o de frontera de entrada (zona Cloudflare propia), desactivar `onrender.com`, activar la IP firmada en staging, rutas autenticadas de cambio de contraseña, tokens de informe autenticados.

## Verificación

- `test/security/security-ip-independent-ceilings.test.ts`: rotar la IP no evita el tope por identificador; el límite por IP sigue aplicando primero; aislamiento entre identificadores y entre scopes; renovación por ventana; normalización del identificador; contrato de fuente.
- `test/integration/app/public-professionals-rate-limit-postgres.fastify.test.ts` (PostgreSQL aislado `portal_vetneb_ci`): dos instancias Fastify con el store persistente por defecto; solicitudes alternadas desde orígenes sintéticos distintos agotan un único techo y ambas instancias responden 429; el detalle conserva presupuesto propio; la ventana se renueva. Ejecutado localmente contra `portal_vetneb_ci` (4/4) y corre en Backend CI.
- Fallo cerrado del store (503, handler sin ejecutar) y ausencia de fallback en memoria: `test/security/security-ip-independent-ceilings.test.ts`. Los tests existentes de profesionales públicos inyectan ahora un store en memoria de forma explícita.
- Limitaciones de E4 que siguen vigentes: la estructura de `X-Forwarded-For` de Render sigue sin ser contractual y la IP de auditoría es atribución no autenticada.
- NO ejecutado: evidencia en staging (pruebas A1–A7 de `PR-SEC-10-signed-client-ip.md`), contra el SHA fusionado y con datos sintéticos; requiere autorización R3.

## Rollback

Revertir el commit de la PR. No hay variables ni migraciones nuevas: las claves usan la tabla de rate limit existente.

## Reset administrativo del techo por identificador

El techo `login-ceiling:v2:<identificador>` se guarda sin metadata (`surface`, `identifier_hash`,
`ip_hash` nulos), es compartido por todas las superficies e independiente de la IP. El comando
`pnpm auth:reset-login-rate-limit` lo localiza con `buildLoginIdentifierCeilingKey` +
`hashRateLimitKey` (misma normalización que el runtime) y aplica esta semántica:

- Sin `--ip-address`: reinicia los contadores por IP de la superficie y **también** el techo del
  identificador (afecta a todas las superficies que lo comparten). El dry-run lo informa.
- Con `--ip-address`: el reset queda limitado a esa IP y el techo se **conserva**, salvo que se
  agregue `--include-identifier-ceiling` (PowerShell: `-IncludeIdentifierCeiling`).
- Dry-run por defecto; sin `--force` no se borra nada. Un login exitoso nunca reinicia el techo.
- Una falla de PostgreSQL termina con exit code 1 y sin reportar filas eliminadas.

Cobertura: `test/integration/app/login-rate-limit-reset-postgres.test.ts` (PostgreSQL real
`portal_vetneb_ci`) y `test/unit/infrastructure/reset-login-rate-limit-script-contract.test.ts`.
