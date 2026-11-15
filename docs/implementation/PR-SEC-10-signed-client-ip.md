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
