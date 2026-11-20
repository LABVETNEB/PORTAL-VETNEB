# PR-SEC-10 — IP de cliente firmada entre Next y Fastify

Estado: **IMPLEMENTADO LOCALMENTE, NO DESPLEGADO. SEC-10 NO CERRADO (E4 BLOQUEADO).**

## Problema

Tras el rewrite de Next, `request.ip` del backend es la salida compartida de Next (un solo bucket de rate limit para todos los usuarios) o, si se confiara en ese rango, es suplantable. La IP de salida de Render es compartida por la región y no es frontera de confianza (ver `PR-SEC-10-E4-TRUST-BOUNDARY-ANALYSIS.md`).

## Solución (opción 5b del análisis, opt-in)

1. **Frontend** (`frontend/src/proxy.ts`, `frontend/src/lib/security/client-ip-signing.ts`): en `/api/*` elimina SIEMPRE `x-vetneb-client-ip`, `-ts` y `-sig` enviados por el navegador. Resuelve la IP del cliente del `X-Forwarded-For` **anclado a la derecha y validado por dirección** (último salto privado, penúltimo dentro de `CLIENT_IP_EDGE_CIDRS`, el cliente es la entrada anterior) y firma `HMAC-SHA256(secret, v1 | ts | método | ruta sin query | ip)`. Si algo no valida: no firma.
2. **Backend** (`server/lib/signed-client-ip.ts`, `signed-forwarded-ip-hook.ts`): con `CLIENT_IP_SIGNING_SECRET` (≥ 32 caracteres) acepta la IP firmada como `request.ip` sólo si la firma es válida, el timestamp está en [-5 s, +30 s], método y ruta coinciden y la IP es literal estricta. Todo lo demás conserva la resolución previa. Sin secreto no se registra nada.
3. `frontend/next.config.ts`: `experimental.proxyClientMaxBodySize: "25mb"`. El proxy bufferiza el cuerpo (10 MB por defecto); sin este ajuste los uploads de hasta 20 MB se truncan (**regresión detectada y corregida en runtime real**).

## Garantías y límites

- Una firma prueba posesión del secreto, **no autenticidad de la IP**. La autenticidad depende de que la estructura del XFF de Render sea la esperada y de que `CLIENT_IP_EDGE_CIDRS` cubra todos los saltos de borde posibles: **eso es E4 y no está confirmado**.
- La ruta directa al backend (dominio propio u `onrender.com`) no usa firma: sigue gobernada por `TRUST_PROXY` / `TRUST_PROXY_CHAIN` y `request.ip` del socket. Un cliente que envíe cabeceras `x-vetneb-*` directo al backend no puede firmarlas.
- Replay: ligado a método y ruta y a 30 s; dentro de esa ventana, un atacante que capture tráfico interno ya descifrado podría repetir esa request exacta (mismo método, ruta e IP).
- Fallo de topología: la request no se firma y el backend usa su IP del socket (bucket compartido de Next). Es fail-closed respecto de evasión de límites, pero degrada a un bucket compartido; debe observarse en staging.
- Rate limits y auditoría no cambian de código: consumen `request.ip`.

## Verificación

- Tests: `test/security/security-signed-client-ip.test.ts` (backend: spoofing, replay, ventana, cabeceras duplicadas/malformadas, IPv6, buckets, POST con cuerpo, sin contaminación) y `test/security/security-client-ip-proxy-signing.test.ts` (resolución de cadena, cadenas parciales, rangos inválidos, contrato cruzado frontend→backend, límite de cuerpo).
- Runtime local con `next start` contra un backend stub (2026-11-15): clientes distintos firmados y verificados, XFF falsificado ignorado, identidad falsificada del navegador reemplazada o eliminada, cadena parcial o salto fuera de rango sin firma, cookie intacta, POST y upload de 12 MB íntegros, 30 MB truncado por el límite de 25 MB.
- NO ejecutado: evidencia en staging (Render), pruebas adversariales reales, E4.

## Activación y rollback (staging, requiere autorización R3)

Activar: mismo `CLIENT_IP_SIGNING_SECRET` en `vetneb-api-stg` y `vetneb-web-stg`, más `CLIENT_IP_EDGE_CIDRS` en el frontend, y redeploy de ambos.
Rollback: eliminar `CLIENT_IP_SIGNING_SECRET` (y `CLIENT_IP_EDGE_CIDRS`) de ambos servicios y redeploy, o redeploy del commit anterior (`b5db634c`). Sin el secreto, backend y frontend vuelven exactamente al comportamiento previo. Producción no se toca.

## Procedimiento de activación en staging (preparado, NO ejecutado)

Precondiciones: los tres PRs fusionados en orden backend → frontend → documentación; CI requerido en verde sobre el head fusionado; identidad de `vetneb-api-stg` (`srv-dbr5u80u01pc73a9e4a0`) y `vetneb-web-stg` (`srv-dbre2i6i0phs73fjapig`) reconfirmada; Auto-Deploy en Off; Supabase staging `qlupryhscwlihzsxbmqy`. Producción queda fuera.

1. Generar un secreto aleatorio de ≥ 32 caracteres sin mostrarlo ni registrarlo.
2. Backend: `CLIENT_IP_SIGNING_SECRET`. Frontend: el mismo valor y `CLIENT_IP_EDGE_CIDRS` (rangos acotados; ver evidencia E4 abajo). Redeploy del commit exacto en cada servicio, uno por vez, con readback.
3. Pruebas adversariales sintéticas (sin credenciales ni datos reales; ráfagas pequeñas, sin saturar el servicio):
   - A1 dos orígenes de prueba distintos por `/api/*` → buckets distintos (clave de rate limit del endpoint de contacto).
   - A2 `X-Forwarded-For` falsificado a la izquierda → no cambia el bucket.
   - A3 `x-vetneb-client-ip*` falsificado por el navegador → ignorado/borrado.
   - A4 acceso directo al backend con `x-vetneb-client-ip*` inventado → `request.ip` sin cambio.
   - A5 replay de una firma capturada en otra ruta o pasados 30 s → rechazada (cubierto en tests; verificar contra el servicio).
   - A6 upload de ~15 MB por `/api` → íntegro (backend admite 20 MB).
   - A7 rate limit sigue limitando por cliente y no se elude cambiando cabeceras.
4. Evidencia E4 (necesaria para cerrar SEC-10): en la misma ventana, medir sobre tráfico propio y sintético (a) la posición del cliente real dentro del XFF que ve Next, (b) si el salto de borde cae dentro de `CLIENT_IP_EDGE_CIDRS`, (c) el valor de `CF-Connecting-IP` frente a esa posición y frente a un valor falsificado enviado por el cliente, (d) la IP/peer y XFF que ve el backend en una llamada directa. Sin (a)–(d) E4 permanece BLOQUEADO y la solución se considera sólo implementada, no cerrada.

## Rollback

1. Eliminar `CLIENT_IP_SIGNING_SECRET` (y `CLIENT_IP_EDGE_CIDRS`) de ambos servicios staging; redeploy. Sin el secreto el comportamiento es exactamente el previo: el proxy no firma y el backend no registra el hook.
2. Si hiciera falta volver al código anterior: redeploy del commit `b5db634c` en ambos servicios (Render «Deploy a specific commit»).
3. Verificar por readback: deploy Live, `/health`, variables retiradas y Auto-Deploy Off.
