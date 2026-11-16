# PR-SEC-10 — Topes independientes de la IP y criterio E4 redefinido

Estado: **IMPLEMENTADO LOCALMENTE, SIN COMMIT NI DESPLIEGUE. SEC-10 NO CERRADO** hasta la evidencia de staging descrita abajo.

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
- Realineaciones: censo M48 (LOC), censo 01B/05A (+1 importador del lector canónico), ancla de hash de `particular-auth.fastify.ts`, allowlist de imports de `public-report-access.fastify.ts`.

## Costos aceptados

- Bajo abuso dirigido, el tope por identificador puede bloquear al titular legítimo durante la ventana (15 min). Un tope bajo sería más fácil de explotar; 5× el límite por IP es el compromiso.
- Bajo abuso distribuido, el techo global bloquea también a usuarios legítimos del endpoint. Acota el abuso masivo; no lo distingue.
- Un cliente legítimo con más de 5× intentos fallidos por ventana contra el mismo identificador queda bloqueado.

## No alcance

Cambio de proveedor o de frontera de entrada (zona Cloudflare propia), desactivar `onrender.com`, activar la IP firmada en staging, rutas autenticadas de cambio de contraseña, tokens de informe autenticados.

## Verificación

- `test/security/security-ip-independent-ceilings.test.ts`: rotar la IP no evita el tope por identificador; el límite por IP sigue aplicando primero; aislamiento entre identificadores y entre scopes; renovación por ventana; normalización del identificador; contrato de fuente.
- NO ejecutado: evidencia en staging (pruebas A1–A7 de `PR-SEC-10-signed-client-ip.md`), contra el SHA fusionado y con datos sintéticos; requiere autorización R3.

## Rollback

Revertir el commit de la PR. No hay variables ni migraciones nuevas: las claves usan la tabla de rate limit existente.
