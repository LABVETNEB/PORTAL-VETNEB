# M23 — Public Professionals thin route + rate limit wiring

> **Estado:** implementación técnica completa; pendiente de commit, PR, CI y merge.
> **Fase E permanece abierta. M24 no iniciado.**

## Objetivo

Adelgazar `server/routes/public-professionals.fastify.ts` mediante un query
service directo del contexto Public Professionals y mover el wrapper de rate
limit a `features/public-professionals/infrastructure/`, sin cambiar contratos
HTTP, CORS, logging, storage, SQL, auth, schema ni migraciones.

## Arquitectura resultante

~~~text
public-professionals.fastify.ts
  ├─ HTTP, parsing, CORS, logging y rate-limit wiring
  ├─ public-professionals-query-service.ts
  │  ├─ búsqueda y detalle
  │  ├─ serialización pública
  │  ├─ firma opcional de avatar
  │  └─ infrastructure/index.ts + lib/supabase.ts
  └─ infrastructure/public-professionals-rate-limit.ts
     └─ constantes del rate limit público

clinic-public-profile.fastify.ts
  └─ infrastructure/index.ts
~~~

No se creó una capa `application`, puertos vacíos, clases, factories ni
abstracciones especulativas.

## Cambios técnicos

- Nuevo `public-professionals-query-service.ts`.
- La ruta pública delega búsqueda, detalle, serialización y firma de avatar.
- La ruta conserva endpoints, parsing, status codes, payloads, CORS, logging y
  fixed-window rate-limit wiring.
- `public-professionals-rate-limit.ts` se mueve al contexto.
- `rate-limit-store.ts` permanece en `server/lib`.
- La ruta clínica consume el barrel canónico de infrastructure.
- Los shims temporales permanecen hasta M24, pero ya no tienen consumidores
  operativos dentro del alcance M23.

## Contratos preservados

- `GET /api/public/professionals/search`.
- `GET /api/public/professionals/:clinicId`.
- Status 200, 400, 403, 404, 429 y 500.
- Payloads públicos y mensajes existentes.
- Headers CORS y RateLimit.
- Buckets independientes para search y detail.
- Logging sanitizado y marcador `RATE_LIMITED`.
- Fallo opcional de firma de avatar devuelve `avatarUrl: null`.
- Sin exposición de paths internos de storage.
- Sin cambios de SQL, ranking, filtros, DB o elegibilidad.

## Shims temporales

Permanecen hasta M24:

- `server/db-public-professionals.ts`
- `server/lib/public-professionals-rate-limit.ts`
- `server/lib/professional-bank-eligibility.ts`

Los consumidores operativos ya apuntan a las fronteras canónicas. M24 realizará
el censo final y el retiro de los shims.

## Allowlist

### Nuevos

- `server/features/public-professionals/public-professionals-query-service.ts`
- `server/features/public-professionals/infrastructure/public-professionals-rate-limit.ts`
- `test/unit/contracts/public-professionals/public-professionals-query-service.test.ts`
- `docs/implementation/m23-public-professionals-thin-route.md`

### Modificados

- `server/routes/public-professionals.fastify.ts`
- `server/routes/clinic-public-profile.fastify.ts`
- `server/lib/public-professionals-rate-limit.ts`
- `test/architecture/public-professionals-infrastructure-boundary-guard.test.ts`
- `test/architecture/public-professionals-source-boundaries.test.ts`
- `test/architecture/security/security-rate-limit-isolation-boundaries.test.ts`
- `test/architecture/storage-suite-completeness.test.ts`
- `test/unit/contracts/public-professionals/public-professionals-rate-limit.test.ts`
- `test/unit/contracts/public-professionals/public-professionals-query-parsing-invariants.test.ts`
- `test/unit/contracts/public-professionals/public-professionals-serialization-invariants.test.ts`
- `test/unit/ui/public/frontend-public-professionals-scalable-directory.test.ts`
- `server/features/public-professionals/README.md`
- `server/features/public-professionals/infrastructure/README.md`
- `docs/architecture/shared-lib-boundary-inventory.md`
- `docs/audit/backend-enterprise-modularization-program-audit.md`

## Denylist

Sin cambios en:

- `server/features/public-professionals/domain/**`
- `server/features/public-professionals/infrastructure/public-professionals-mapping.ts`
- `server/features/public-professionals/infrastructure/public-professionals-repository.ts`
- `server/lib/rate-limit-store.ts`
- `server/lib/supabase.ts`
- `server/fastify-app.ts`
- `server/db.ts`
- `drizzle/**`
- `migrations/**`
- `frontend/**`
- auth, sesiones, cookies y CORS compartido
- dependencias, lockfiles, workspace, CI y `.github/**`
- M24

## Validación dirigida registrada

- Reapunte inicial, rutas y rate limits: 47/47.
- Contratos HTTP, CORS, logging y headers: 39/39.
- Query service y guards arquitectónicos: 23/23.
- `pnpm typecheck`: PASS.
- `pnpm typecheck:test`: PASS.
- `git diff --check`: PASS.

## Riesgo y rollback

Riesgo técnico bajo/moderado. El cambio conserva los seams inyectables y no
altera persistencia, SQL ni contratos HTTP.

El rollback consiste en revertir el PR: restaura la serialización y los loaders
dentro de la ruta, devuelve el wrapper de rate limit a `server/lib` y reapunta
los consumidores a los paths anteriores.

## Estado del programa

- M21: mergeado.
- M22: mergeado.
- M23: implementación técnica completa, pendiente de integración.
- M24: no iniciado; cierre de Fase E y retiro de shims.
