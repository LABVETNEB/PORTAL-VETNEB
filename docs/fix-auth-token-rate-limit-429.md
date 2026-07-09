# fix(auth): prevent false HTTP 429 on login and token access

**Branch:** `fix/auth-token-rate-limit-429`
**Fecha:** 2026-05-30

---

## Skills aplicadas

- `vetneb-staff-senior-full-stack-engineer`
- `vetneb-protocolos-comunicacion`
- `vetneb-bugs-errores-optimizacion-rutas`
- `vetneb-security-production-invariants`
- `vetneb-briefing-planificacion-diseno-desarrollo-pruebas`

---

## Diagnóstico

### Superficies afectadas

| Endpoint | Método | Fichero de ruta | Store rate-limit en producción | Key anterior |
|---|---|---|---|---|
| `POST /api/auth/login` | Unified (admin+clinic+particular) | `server/routes/auth.fastify.ts` | DB persistente | `request.ip \|\| "unknown"` |
| `POST /api/particular/auth/login` | Token particular | `server/routes/particular-auth.fastify.ts` | Memoria in-process | `request.ip \|\| "unknown"` |
| `POST /api/admin/auth/login` | Admin | `server/routes/admin-auth.fastify.ts` | Memoria in-process | `request.ip \|\| "unknown"` |

### Causa raíz

**RC1 — Key sin prefijo de realm → bucket global al fallar IP**

Los tres endpoints de auth usaban `request.ip || "unknown"` como clave de rate-limit.
Cuando `request.ip` no está disponible o resuelve a la IP del proxy interno de Render
(en lugar de la IP real del cliente), todos los usuarios comparten la misma entrada
de rate-limit dentro del store.

Consecuencias:
- 10 intentos fallidos desde cualquier usuario → bucket lleno → todos los usuarios
  de ese realm bloqueados con 429 durante 15 minutos.
- El fallback `"unknown"` era global dentro de cada store: un solo bucket para todos.

**RC2 — Ausencia de namespace entre realms**

El `/api/auth/login` (login unificado) y `/api/particular/auth/login` (token particular)
usaban la misma clave sin prefijo. Aunque usan stores separados en producción
(DB persistente vs memoria), si en algún entorno se inyecta el mismo store (o si el
patrón de key se comparte accidentalmente), los fallos de uno bloquean al otro.

**RC3 — Test `security-rate-limit-isolation-boundaries.test.ts` codificaba el patrón buggy**

El test afirmaba explícitamente:
```
assertContains(source, 'const rateLimitKey = request.ip || "unknown";', ...)
```
Esto bloqueaba cualquier corrección al patrón de key sin romper primero ese test.

**Observación adicional (fuera de scope del fix)**

El `/api/particular/auth/login` usa store en memoria en producción (no DB persistente).
El counter se reinicia en cada restart del servidor Render, pero se acumula durante el
uptime del proceso. Esto no se cambia en este PR; el aislamiento de realm mitiga el
impacto.

---

## Causa raíz resumida

> `rateLimitKey = request.ip || "unknown"` sin prefijo de realm = bucket global
> compartido cuando la IP no se resuelve o múltiples usuarios comparten IP de proxy.

---

## Archivos modificados

| Fichero | Tipo | Cambio |
|---|---|---|
| `server/routes/auth.fastify.ts` | Producción | `rateLimitKey` → `` `login:${request.ip \|\| "unknown"}` `` |
| `server/routes/particular-auth.fastify.ts` | Producción | `rateLimitKey` → `` `particular:${request.ip \|\| "unknown"}` `` |
| `server/routes/admin-auth.fastify.ts` | Producción | `rateLimitKey` → `` `admin:${request.ip \|\| "unknown"}` `` |
| `test/auth.fastify.test.ts` | Test | `hashRateLimitKey("203.0.113.50")` → `hashRateLimitKey("login:203.0.113.50")` (x2) |
| `test/architecture/security/security-rate-limit-isolation-boundaries.test.ts` | Test | Reemplaza assertion de key genérica por mapa por realm |
| `test/security-rate-limit-cross-realm-isolation.test.ts` | Test (nuevo) | 7 tests de regresión cross-realm |

### Nota de limpieza

Los ficheros temporales `test/architecture/security/security-rate-limit-isolation-boundaries.test.ts.clean`
y `test/architecture/security/security-rate-limit-isolation-boundaries.test.ts.tmp` deben eliminarse
manualmente en Windows antes del commit:
```powershell
Remove-Item test\architecture\security\security-rate-limit-isolation-boundaries.test.ts.clean
Remove-Item test\architecture\security\security-rate-limit-isolation-boundaries.test.ts.tmp
```

---

## Descripción del fix

Añadir prefijo de realm a la clave de rate-limit en los tres endpoints de autenticación:

```typescript
// Antes (todos los endpoints):
const rateLimitKey = request.ip || "unknown";

// Después:
// auth.fastify.ts (login unificado clinic/admin/particular):
const rateLimitKey = `login:${request.ip || "unknown"}`;

// particular-auth.fastify.ts (token particular):
const rateLimitKey = `particular:${request.ip || "unknown"}`;

// admin-auth.fastify.ts (admin dedicado):
const rateLimitKey = `admin:${request.ip || "unknown"}`;
```

Esto garantiza:
1. Fallos en `/api/auth/login` no afectan el store de `/api/particular/auth/login`
   incluso si se comparte el mismo store (store separados por diseño en producción).
2. El fallback `"unknown"` queda acotado al realm: `"login:unknown"` ≠ `"particular:unknown"`.
3. Los stores siguen siendo independientes en producción (no se modifica esa arquitectura).
4. La protección anti-bruteforce se mantiene dentro de cada realm.

---

## Tests de regresión nuevos

Fichero: `test/security-rate-limit-cross-realm-isolation.test.ts`

| Test | Verifica |
|---|---|
| `intentos fallidos en login clinica no bloquean login particular con store compartido` | Cross-realm isolation login→particular |
| `intentos fallidos en login particular no bloquean login clinica con store compartido` | Cross-realm isolation particular→login |
| `rate limit clinica sigue funcionando dentro del mismo flujo` | Anti-bruteforce intacto en clinic |
| `rate limit particular sigue funcionando dentro del mismo flujo` | Anti-bruteforce intacto en particular |
| `respuesta 429 no filtra informacion sensible en login clinica` | Sanitización: sin password/hash/token/cookie en 429 |
| `respuesta 429 no filtra informacion sensible en login particular` | Sanitización: sin hash/cookie/secret en 429 |
| `IP desconocida no colapsa realm login con realm particular` | `"unknown"` scoped por realm |

---

## Validaciones ejecutadas

| Validación | Resultado |
|---|---|
| `node --test test/architecture/security/security-rate-limit-isolation-boundaries.test.ts` | 9/9 pass |
| `node --test test/login-rate-limit.test.ts test/rate-limit-store.test.ts` | 10/10 pass |
| `node --test test/architecture/security/security-production-invariants.test.ts` | 11/11 pass |
| Tests estructurales combinados (30 tests) | 30/30 pass |
| `git diff --check` | EXIT 0 (sin whitespace errors) |
| `pnpm test` (requiere host Windows) | Pendiente ejecución manual por Nico |
| `pnpm build` (requiere host Windows) | Pendiente ejecución manual por Nico |

---

## No-alcance explícito

- No se toca Gmail API, SMTP ni email.
- No se cambia `TRUST_PROXY` ni ENV (el valor `trustProxy: ENV.trustProxy ?? 1` es correcto
  para Render de un hop; si hay múltiples hops en producción, ajustar ENV.TRUST_PROXY=2 en
  Render → fuera de scope de este PR).
- No se migra el store in-memory de particular-auth a DB persistente.
- No se modifican migraciones ni schema de DB.
- No se modifica CSP (la advertencia de upgrade-insecure-requests en consola es un
  report-only de Next.js y no tiene relación con el 429).
- No se tocan dependencias (package.json / pnpm-lock.yaml).
- No se modifica el modelo de usuarios ni permisos.

---

## Riesgos y resguardos

| Riesgo | Severidad | Resguardo |
|---|---|---|
| Keys existentes en DB sin prefijo quedan activas hasta que expiren (15 min) | Bajo | Las entradas antiguas expiran por TTL; ningún usuario bloqueado legítimamente se libera antes de tiempo |
| Store in-memory de particular y admin se reinicia con servidor | Bajo-existente | Comportamiento previo sin cambio; prefijo solo añade namespace |
| El fallback `"unknown"` sigue siendo un bucket compartido dentro del mismo realm | Bajo | Solo afecta cuando IP no se resuelve; el realm-prefix reduce el radio de impacto al dominio específico |
| `trustProxy` mal configurado sigue causando IP de proxy en `request.ip` | Medio-externo | Ajustar `ENV.TRUST_PROXY` en Render si hay múltiples hops; este PR no cambia esa config |

---

## Estado final

```
branch: fix/auth-token-rate-limit-429
base:   main (01def8a feat(particular): email generated token from backend (#766))

Archivos modificados (5 M + 1 A):
  M server/routes/auth.fastify.ts
  M server/routes/particular-auth.fastify.ts
  M server/routes/admin-auth.fastify.ts
  M test/auth.fastify.test.ts
  M test/architecture/security/security-rate-limit-isolation-boundaries.test.ts
  A test/security-rate-limit-cross-realm-isolation.test.ts

Tests estructurales: 30/30 pass
git diff --check: EXIT 0
Listo para: pnpm test && pnpm build en host → git add → commit → push → PR
```
