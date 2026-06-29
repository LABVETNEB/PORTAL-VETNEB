# Auditoría P2-E — Logger mínimo y mezcla `console.*` / `logInfo/logWarn/logError` en backend

- **Fecha:** 2026-06-29
- **Rama:** `docs/observability-logger-console-audit`
- **Base:** `254dc66` (main)
- **Modo:** docs-only. No se tocó runtime backend/frontend, `server/lib/logger.ts`, rutas, tests, `package.json`, `pnpm-lock.yaml`, DB, migraciones, workflows ni Render.
- **Documentos rectores:** `docs/audit/final-repo-cleanup-engineering-audit.md` (§ P2-E), `docs/audit/final-cleanup-current-status-snapshot.md`.

## 1. Inventario

Comandos ejecutados (sin modificar archivos):

```
git grep -n "console\." -- server   # 56 coincidencias
git grep -n "logInfo\|logWarn\|logError" -- server   # 9 coincidencias
```

`server/lib/logger.ts` (vigente, sin cambios): wrapper mínimo de 3 funciones
(`logInfo`, `logWarn`, `logError`) sobre `console.log/warn/error` con
parámetros `any[]`, sin niveles configurables, sin redacción estructurada,
sin transporte/sink alternativo. `serializeError` normaliza `Error` a
`{message, stack, name}` pero no se usa en ninguno de los 56 `console.*`
inventariados (sólo está disponible para quien lo importe).

### 1.1 Conteo por archivo (`console.*`, 56 total)

| Archivo | Ocurrencias |
| --- | --- |
| `server/lib/email.ts` | 9 |
| `server/routes/admin-particular-tokens.fastify.ts` | 5 |
| `server/routes/particular-tokens.fastify.ts` | 4 |
| `server/routes/study-tracking.fastify.ts` | 3 |
| `server/routes/admin-study-tracking.fastify.ts` | 3 |
| `server/routes/admin-clinics.fastify.ts` | 3 |
| `server/lib/logger.ts` | 3 (la propia implementación del wrapper) |
| `server/routes/public-professionals.fastify.ts` | 2 |
| `server/routes/admin-reports.fastify.ts` | 2 |
| `server/routes/admin-pricing.fastify.ts` | 2 |
| `server/db-report-workflow.ts` | 2 |
| 16 archivos restantes (rutas `*.fastify.ts` + `middlewares/request-logger.ts` + `middlewares/error-handler.ts` + `fastify-app.ts`) | 1 cada uno |

### 1.2 Uso de `logInfo/logWarn/logError` (9 total)

Concentrado en `server/lib/audit.ts` (6 referencias: 2 de tipo, 2 de
inyección de dependencias, 2 de invocación real — `AUDIT_LOG_WRITTEN` /
`AUDIT_LOG_WRITE_ERROR`) más las 3 definiciones en `server/lib/logger.ts`.
Es decir: **el wrapper sólo se usa en el módulo de auditoría**; el resto del
backend llama `console.*` directamente. Esto confirma el hallazgo original
de la auditoría: no hay una convención única, y `logInfo/logWarn/logError`
no se adoptó fuera de `audit.ts`.

## 2. Clasificación por familia

### A. Request access logging (sanitizado) — 20 de 56
Patrón repetido en 20 archivos (`buildRequestLogLine` + `sanitizeUrlForLogs`):
`admin-audit`, `admin-auth`, `admin-particular-tokens` (1 de sus 5),
`admin-report-access-tokens`, `admin-reports` (1 de sus 2),
`admin-study-tracking` (1 de sus 3), `auth.fastify`, `clinic-audit`,
`clinic-public-profile`, `particular-audit`, `particular-auth`,
`particular-study-tracking`, `particular-tokens` (1 de sus 4),
`public-professionals` (1 de sus 2), `public-report-access`,
`report-access-tokens`, `reports-status`, `reports.fastify`,
`study-tracking` (1 de sus 3), `middlewares/request-logger.ts`.

```ts
const safeUrl = sanitizeUrlForLogs(request.url);
console.log(
  buildRequestLogLine({ timestamp, method, url: safeUrl, statusCode, durationMs }),
);
```

**Riesgo: bajo.** La URL pasa por `sanitizeUrlForLogs` antes de loguearse;
no se incluyen headers, cookies ni cuerpo de request. Es ruido operacional
(`console.log` en vez de un logger con niveles), no un riesgo de fuga.

### B. Notificaciones de email (`server/lib/email.ts`) — 9 de 56
`console.info` en los flujos `contact_message`, `particular_token` y
`special_stain_required`. Confirmado: **ningún log incluye el token de
acceso particular** (`particular_token` loguea `recipients`, `messageId`,
`transport`, nunca `input.token`).

**Riesgo: bajo-moderado (PII operacional, no secreto).** Los logs de
`particular_token` y `special_stain_required` sí incluyen `recipients`
(direcciones de email reales) en claro:
- `email.ts:927` (`smtp_disabled` skip) y `email.ts:934` (`sent`) — ambos en
  `sendParticularTokenEmail`.
- `email.ts:976` (`smtp_disabled` skip) y `email.ts:984` (`sent`) — en
  `sendSpecialStainRequiredEmail`.

Es la misma clase de dato que ya circula por la app (direcciones de
contacto de clínicas/particulares), pero queda en logs de stdout sin
redacción. No es un secreto/credencial — es PII operacional de bajo riesgo,
consistente con el mitigante ya documentado en P2-E.

### C. Errores de ruta sanitizados (`errorName`/`getSafeErrorName`/`getSanitizedDbErrorDetails`) — ~17 de 56
Ej.: `admin-particular-tokens.fastify.ts` (cleanup/ensure-by-token/email/tracking),
`particular-tokens.fastify.ts` (mismos 4 puntos), `study-tracking.fastify.ts`,
`admin-study-tracking.fastify.ts`, `admin-clinics.fastify.ts:578,794,943`,
`db-report-workflow.ts:101,108`, `admin-reports.fastify.ts:497`,
`public-professionals.fastify.ts:164`.

**Riesgo: bajo.** Estos puntos ya fueron diseñados para no loguear el
objeto `error` completo: extraen `errorName`, `error.name`, o pasan por
helpers (`getSafeErrorName`, `getSanitizedDbErrorDetails`,
`getSafeEmailTransportErrorMetadata`) que filtran antes de loguear. Es el
patrón correcto; sólo falta consistencia de formato (`console.*` vs
`logError`).

### D. Errores de ruta/handler global con objeto `error` crudo — 4 de 56
**Hallazgo nuevo respecto al snapshot previo de P2-E** (que registraba el
total de 56 pero no diferenciaba este subgrupo):

- `server/middlewares/error-handler.ts:67` — `errorHandler` (handler global
  Express-style, usado por rutas no-Fastify): `console.error("[API ERROR]", { method, path, status, message, error })`.
- `server/fastify-app.ts:381` — `setErrorHandler` global de Fastify:
  `console.error("[API ERROR]", { method, path, status, message, requestId, error })`.
- `server/routes/admin-pricing.fastify.ts:406` y `:502` —
  `console.error("[ADMIN_PRICING_LIST_ERROR]"/"[ADMIN_PRICING_PATCH_ERROR]", { path, error })`.
- `server/routes/public-pricing.fastify.ts:125` —
  `console.error("[PUBLIC_PRICING_LIST_ERROR]", { path, error })`.

**Riesgo: moderado (no crítico).** Estos 4 puntos loguean el objeto
`error` completo (incluye `stack`, y cualquier propiedad adicional que el
error traiga adjunta — p. ej. detalles de driver de Postgres) directamente
a stdout. No hay evidencia de que esto llegue al cliente (las respuestas
HTTP sólo exponen `message`/`details` sanitizados), y no se observó ningún
caso donde un error capturado pueda contener tokens/contraseñas en claro
por diseño del código. El riesgo es indirecto: si en el futuro algún error
de librería incluyera datos sensibles en sus propiedades (p. ej. una
query con parámetros), quedaría en logs de servidor sin redacción. No
constituye una fuga activa de secretos hoy, pero es la única familia que
amerita seguimiento explícito en el plan futuro (ver §4).

No se encontró ningún `console.*` que logueara explícitamente contraseñas,
JWT/cookies de sesión, tokens de particular, ni variables de entorno
(`ENV.*`) en claro.

## 3. Conclusión de riesgo

| Familia | Ocurrencias | Riesgo |
| --- | --- | --- |
| A. Request access logging | 20 | Bajo |
| B. Email notification info logs | 9 | Bajo-moderado (PII operacional, no secreto) |
| C. Errores sanitizados | ~17 | Bajo |
| D. Errores con objeto `error` crudo | 4 | Moderado (no crítico — no hay fuga de secretos confirmada) |
| `server/lib/logger.ts` (definición) | 3 | N/A — wrapper mínimo en sí |

**No se detectó riesgo alto** (sin fuga de contraseñas, tokens de sesión,
tokens particulares o secretos de `ENV.*`). El hallazgo D es la única
mejora concreta que vale la pena planificar a futuro (acotar qué propiedades
de `error` se loguean en los 4 puntos globales/`*-pricing`), pero no
bloquea el cierre documental de P2-E.

## 4. Decisión

Se cierra P2-E **documentalmente, como deuda de observabilidad no
bloqueante**, con plan futuro acotado:

1. Unificar los 56 `console.*` bajo `logInfo/logWarn/logError` (o un
   logger con niveles real) — alcance ya estimado como "opcional" en la
   auditoría original.
2. Acotar el subgrupo D (4 puntos) para loguear `error.message`/`error.name`
   en vez del objeto completo, replicando el patrón ya usado en la
   familia C (`getSafeErrorName`, `getSanitizedDbErrorDetails`).
3. Mantener fuera de logs cualquier PII de email salvo que se requiera
   explícitamente para soporte (familia B) — evaluar redacción parcial
   (dominio sin local-part) si se prioriza en un PR futuro.

Ninguna de estas acciones se ejecuta en esta rama (docs-only).
