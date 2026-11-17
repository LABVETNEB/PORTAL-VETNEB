# PR-SEC-09 — Expiración obligatoria, TTL máximo e inactividad administrativa

Estado base: `d5a76173`. Scope: backend runtime (R2, auth). Hallazgos del roadmap: SEC-14 y SEC-13 (parcial).

## Cambios

- `server/lib/session-expiry.ts` (nuevo): `isSessionExpired` (fail-closed: `expiresAt` nulo o inválido = vencida; el límite exacto = vencida) e `isSessionIdle`.
- Los cinco chequeos de expiración (admin, clínica, particular auth/audit/study-tracking) usan el helper; HTTP 401, limpieza de cookie y borrado de sesión se conservan.
- `db-admin-sessions.ts`: el estado `active|expired` del listado trata `expiresAt` nulo como `expired`.
- `SESSION_TTL_HOURS`: `0 < x <= 24` y `x * 3600` entero (Max-Age válido y coherente con `expiresAt`). Fuera de cota aborta el arranque.
- `ADMIN_SESSION_IDLE_TIMEOUT_MINUTES`: entero 5–1440, default 30. Sólo admin.

## Criterios de selección (no fijados por el roadmap)

- Máximo 24 h = default vigente (`docs/release-readiness.md`, `.env.example`): no cambia ningún despliegue con defaults.
- 30 min de inactividad: valor candidato; no existe política documental más restrictiva. Ajustable por entorno.

## Política de inactividad admin

Inactividad = `now - lastAccess`. `>=` umbral → 401 (reason `expired_session`, mismo mensaje y cookie limpiada). `lastAccess` nulo/inválido → 401. Futuro hasta 5 min (desfase de reloj) → activo; más allá → 401. La expiración absoluta se evalúa primero. `lastAccess` sólo se persiste cada cierto intervalo, así que para admin el intervalo de refresco es `min(10 min, umbral/10)` (3 min con 30 min) para que la inactividad medida sobrestime la real en como máximo ese intervalo. El contexto de auth por request no se comparte entre requests.

## Fuera de alcance

TRUST_PROXY, vencimiento de tokens particulares, auditoría de particulares, MFA, frontend, migraciones, workflows. Las sesiones con `expiresAt` nulo ya persistidas no se borran (la limpieza usa `expires_at <= now`); quedan inutilizables y se pueden purgar manualmente.

## Rollback

Revert del commit. Sin migraciones ni cambios de datos.
