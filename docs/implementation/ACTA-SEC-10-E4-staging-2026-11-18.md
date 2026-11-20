# Acta SEC-10 E4 — ventana de observación en staging (2026-11-18)

Estado: **ventana ejecutada y staging restaurado.** E4.2 (observación empírica) completado; persistencia del rate limit **PASSED**. Este documento conserva la evidencia sanitizada; no introduce cambios de código ni de configuración.

Entorno: Render, servicio `vetneb-api-stg` (`srv-dbr5u80u01pc73a9e4a0`, plan Free, Auto-Deploy Off). Operación R3 delegada de forma expresa por Nico para esa única ventana. Solo datos sintéticos (direcciones reservadas RFC 5737 e identificadores `sec10-e4-synth-*`). Sin credenciales, cookies, tokens, IP reales ni cabeceras completas.

## 1. Cronología (UTC; el panel de Render muestra GMT-3)

| Hora | Hecho | Readback |
|---|---|---|
| ≈12:09 | Lectura previa: LIVE `e69f4c28`, Auto-Deploy Off. Variables presentes (solo nombres): `CORS_ORIGIN`, `NODE_ENV`, `NODE_VERSION`, `PORT`, `PUBLIC_SITE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_DB_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`. Ausentes: `TRUST_PROXY`, `CLIENT_IP_SIGNING_SECRET`, `PROXY_DIAG_*`. El host de `PUBLIC_SITE_URL` es el del frontend de staging | OK |
| ≈12:16 | Alta de `PROXY_DIAG_ENABLED`, `PROXY_DIAG_RUN_ID` (`e4-11181216`), `PROXY_DIAG_EXPIRES_AT` (14:46:10Z, ventana ≤ 4 h) y `PROXY_DIAG_TOKEN` (aleatorio, 48 caracteres, no registrado) con «Save only» | Sin deploy automático |
| 12:17:46 | Deploy manual del SHA `20792ab563de18fe761409aa62017127d11a5bce` (`dep-dbupeqlg1s2s73ci6vmg`) | LIVE 12:19:23; log `PROXY_DIAG_ACTIVATED` 12:19:17 |
| 12:19:54–12:20:03 | Sondas E4.2 | 9 eventos `PROXY_DIAGNOSTIC_OBSERVED` |
| 12:21:22–12:21:28 | 6 logins sintéticos | 401 en los 6 |
| ≈12:21:40 | «Restart service» (evento del panel «Service restarted by you»). El proceso se recicló recién ≈12:22:48 (uptime 21 s a las 12:23:09) | Uptime reiniciado |
| 12:21:53 | 6 intentos más (7–12) atendidos aún por la instancia anterior; **se descartan como prueba** | 401×4, 429×2 |
| 12:24:35 | Primer intento con el mismo identificador en el proceso nuevo (uptime 105 s) | **429** (`ratelimit-limit: 10`, política 10;w=900); identificador de control nuevo: 401 |
| ≈12:25 | Retiro de las 4 variables `PROXY_DIAG_*` con «Save only» | 9 variables originales intactas; sin deploy automático |
| 12:25:44 | Deploy manual del SHA `e69f4c2872ca905e4658327cf6bb004457b54b44` (`dep-dbupii67bikc73ald2ag`) | LIVE 12:27:14; sin `PROXY_DIAG_ACTIVATED` |
| 12:27:48 | Verificación final | `/api/health` `ok` (base de datos y storage `up`); Auto-Deploy Off |

`e69f4c28` es ancestro de `20792ab5`: el SHA diagnóstico es `e69f4c28` más el hook temporal de diagnóstico y la realineación de un guard.

## 2. E4.2 — observación empírica completada

Ruta: `GET /api/health`, con la cabecera de sondeo del hook. `TRUST_PROXY` no configurado (`request.ip` = peer). Se observaron 9 eventos (ruta directa al backend: 5; ruta frontend→backend por el rewrite: 4).

| # | Observación | Evidencia |
|---|---|---|
| 1 | Peer inmediato: IPv4 loopback | 9/9 eventos, ambas rutas |
| 2 | Ruta directa: `X-Forwarded-For` de 3 entradas `[cliente, salto público, salto privado]`; el cliente queda a 2 posiciones desde la derecha | 5/5 |
| 3 | Rewrite: 6 entradas (+3); el cliente queda a 5 posiciones desde la derecha. El segundo salto privado cambia entre requests | 4/4 |
| 4 | Salto privado: rango `10.0.0.0/8`, con prefijos /16 que varían entre requests (tres valores distintos observados) | solo prefijos, sin direcciones |
| 5 | `X-Forwarded-For` falsificado (marcadores sintéticos): se conserva a la izquierda y no sustituye la entrada del cliente real | ambas rutas |
| 6 | `CF-Connecting-IP` enviado por el cliente: Cloudflare lo rechaza en el borde (403, «error code: 1000»); la petición no llega al backend | ambas rutas |
| 7 | `True-Client-IP` enviado por el cliente: el backend recibe un valor que **no** es el sintético y que coincide con la entrada del cliente del `X-Forwarded-For`; el borde lo sobrescribe | ruta directa, 1 sonda |
| 8 | Ruta directa: `CF-Connecting-IP` y `True-Client-IP` coinciden con la entrada del cliente (2 desde la derecha) | 5/5 |
| 9 | Rewrite: ambas cabeceras coinciden con la entrada a 2 desde la derecha, que por su posición correspondería a la IP de salida del frontend (inferencia; Render no lo confirma) y **no** a la del usuario final, que está a 5 desde la derecha | 4/4 |
| 10 | `X-Real-IP` y `Forwarded` falsificados se probaron solo junto a cabeceras CF falsificadas: el borde devolvió 403 y no hay observación del backend para ellos | no evaluable |

## 3. Persistencia del rate limit — PASSED

Superficie `POST /api/auth/login` con identificador sintético y contraseña inválida sintética. Límite por clave: 10 intentos en 900 s, almacenado en PostgreSQL. Tras el reciclaje real del proceso, el mismo identificador recibió 429 de inmediato y un identificador nuevo recibió 401. El contador sobrevive al reinicio.

Alcance exacto de lo probado: el límite por clave (identificador + IP). **No** se ejercitaron el tope por identificador de 5× ni los techos globales por endpoint; no se repitieron las pruebas A1–A7 de `PR-SEC-10-signed-client-ip.md`, ni se probaron otras superficies.

## 4. Comparación con el criterio E4 redefinido

Criterio vigente (`PR-SEC-10-ip-independent-ceilings.md`): (1) ningún control crítico depende únicamente de la autenticidad de la IP; (2) la estructura de la cadena se valida empíricamente en staging sobre el SHA exacto, con datos sintéticos; (3) la IP de auditoría es atribución no autenticada de mejor esfuerzo. La respuesta humana de Render no es requisito de cierre.

| Punto | Estado | Base |
|---|---|---|
| 1. Topes independientes de la IP | Implementado y desplegado en el SHA `e69f4c28` (PR #2010), que fue el que quedó LIVE; su cobertura de tests la aporta esa PR y no se repitió aquí | `PR-SEC-10-ip-independent-ceilings.md`; el punto 3 de esta acta confirma la persistencia entre procesos |
| 2. Estructura de la cadena en staging con datos sintéticos | **Cumplido con salvedad** | Sección 2. El SHA observado es `20792ab5` (`e69f4c28` + hook y guard), no un SHA de main posterior |
| 3. IP de auditoría = atribución no autenticada | Vigente | Las observaciones 5 a 9 de la sección 2 no demuestran autenticidad contractual, y en el rewrite la cabecera de borde no identifica al usuario final |

La acta distingue estos estados y no los mezcla:

- **E4.2:** observación empírica completada.
- **Persistencia del rate limit:** PASSED, con el alcance exacto del punto 3.
- **Autenticidad contractual de la IP:** no demostrada y no exigida por el criterio redefinido; Render no garantiza la estructura de la cadena.

## 5. Riesgos residuales y limitaciones

- **Bloqueo compartido:** con `TRUST_PROXY` apagado, `request.ip` es el loopback. La clave por IP es compartida por todos los clientes del servicio, de modo que el límite por IP actúa como un cubo común.
- **Denegación de servicio:** agotar un límite o un techo global bloquea a los usuarios legítimos de ese endpoint durante la ventana de 15 min. Es el costo aceptado en `PR-SEC-10-ip-independent-ceilings.md`.
- **Una sola ventana:** ≈10 min de observación, una instancia del frontend Free, una región. No se midió la red privada ni el acceso por dominio propio.
- **Sin lista de rangos de Cloudflare:** `PROXY_DIAG_EDGE_CIDRS` no se configuró; no se evaluó pertenencia a rangos.
- **Rewrite:** la IP real del usuario no llega por las cabeceras de borde en esa ruta (observación 9).
- **Sin garantía contractual de Render:** las observaciones describen un comportamiento medido, no un compromiso del proveedor.
- **Lectura de eventos:** se leyeron del panel de logs (booleanos, clases y etiquetas efímeras de proceso); no se guardaron capturas.
- **Reinicio:** «Restart service» tardó ≈1,5 min en reciclar el proceso; la lectura debe esperar a que el uptime se reinicie.
- **Auditoría:** las pruebas de login dejaron entradas de intentos fallidos con el identificador sintético `sec10-e4-synth-*`.

## 6. Estado final y conclusión

- Backend `vetneb-api-stg` en `e69f4c2872ca905e4658327cf6bb004457b54b44`, sin variables `PROXY_DIAG_*`, Auto-Deploy Off, health `ok`.
- Sin cambios en producción, `main`, el frontend de staging ni la rama diagnóstica; la PR #2009 no se fusionó.
- **Conclusión:** conforme al criterio E4 redefinido, la evidencia de staging solicitada por el punto 2 queda aportada y no queda ningún requisito de certificación adicional por las limitaciones de la sección 5, que ya estaban aceptadas. El cierre formal de SEC-10 queda sujeto a la fusión de esta acta y a la aprobación de Nico.
