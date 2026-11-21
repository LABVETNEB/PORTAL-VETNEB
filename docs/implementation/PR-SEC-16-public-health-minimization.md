# PR-SEC-16 — Minimización de la divulgación pública de `/`, `/health` y `/api/health`

## Estado base

`origin/main` @ `9852269c`. `GET /` publicaba `environment` (`NODE_ENV`); `/health` y
`/api/health` publicaban `checks.database`, `checks.storage`, `uptimeSeconds`,
`responseTimeMs` y `timestamp`.

## Alcance

Incluido: handlers públicos de `server/fastify-app.ts`, `buildServiceInfoPayload`,
scripts de smoke/readiness que leían el payload, tests y contratos directamente afectados.
Excluido: superficie administrativa (`/api/admin/system/health`), migraciones, dependencias,
workflows, producción.

## Consumidores verificados

- Render/uptime: sólo estado HTTP (200/503); sin cambios.
- `scripts/ops/verify-production-readiness.mjs`, `scripts/smoke/smoke-prod-public.mjs`,
  `scripts/smoke/smoke-test.mjs`: leían `checks.*`/`uptimeSeconds`; realineados a
  `{ success, status }`.
- `scripts/dev/smoke-staging.ps1`, `scripts/dev/open-admin-dashboard.ps1`: sólo HTTP status.
- Admin: `getHealthCheckResponse` (sin cambios) alimenta `/api/admin/system/health`.

## Cambios

- `GET /` → `{ success, service }` (allowlist; ignora campos extra del factory).
- `/health`, `/api/health` → `{ success, status }` con 200 (`ok`) / 503 (`degraded`).
- La caché de 5 s/2 s y el single-flight no cambian: la proyección ocurre en el handler.
- `getHealthCheckResponse` conserva el detalle completo para la superficie admin.

## Validaciones

- Tests dirigidos (`fastify-app`, `production-readiness`, `health-check-cache`,
  `admin-system-health`, `smoke-local-contract`): PASSED.
- `pnpm typecheck`, `pnpm typecheck:test`, `pnpm build`: PASSED.
- `pnpm test`: 5.929/5.947; 17 FAILED ambientales sin relación con el cambio: 9 requieren
  PostgreSQL aislado (`DATABASE_URL`) y 8 de PR governance fallan al firmar commits en repos
  temporales (clave SSH con passphrase). Los cubre CI.
- `pnpm security:public-surface`: NOT_RUN (sin cambios de frontend).

## Riesgo residual

Los monitores externos que parseen `checks` dejarán de ver ese campo; sólo se verificó el
repositorio, no la configuración externa de monitoreo.
