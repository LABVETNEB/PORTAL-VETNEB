# P2-E — Auditoría logger/console (docs-only)

- **Rama:** `docs/observability-logger-console-audit`
- **Base:** `254dc66` (main)
- **Tipo de PR:** docs-only, sin cambios de runtime.

## Qué se hizo

Auditoría completa de la mezcla `console.*` / `logInfo|logWarn|logError` en
`server/`, sin tocar `server/lib/logger.ts`, rutas, tests ni ningún archivo
de runtime. Resultado detallado en
[`docs/audit/backend-observability-logger-console-audit.md`](../audit/backend-observability-logger-console-audit.md).

Resumen:
- 56 `console.*` confirmados en `server/` (coincide con el conteo original
  de la auditoría general).
- 9 usos de `logInfo/logWarn/logError`, concentrados en `server/lib/audit.ts`
  — el wrapper de `server/lib/logger.ts` no se adoptó fuera de ese módulo.
- 4 familias clasificadas por riesgo: request access logging sanitizado
  (bajo), email info logs con PII de `recipients` sin token (bajo-moderado),
  errores ya sanitizados (bajo), y un subgrupo de 4 puntos que loguean el
  objeto `error` completo sin filtrar (moderado, no crítico — sin fuga de
  secretos confirmada).
- No se encontró ningún caso de token/contraseña/cookie de sesión logueado
  en claro.

## Qué se actualizó

- `docs/audit/final-repo-cleanup-engineering-audit.md` — sección P2-E
  marcada como cerrada documentalmente, con referencia a la auditoría nueva.
- `docs/audit/final-cleanup-current-status-snapshot.md` — P2-E removido de
  "Pendientes reales" y agregado a "Bloques cerrados (actualización 2026-06-29)".
- `docs/audit/backend-observability-logger-console-audit.md` — auditoría
  nueva (creada en esta rama).

## Qué NO se hizo (fuera de scope, deliberado)

- No se modificó `server/lib/logger.ts`.
- No se unificaron los 56 `console.*` a `logInfo/logWarn/logError`.
- No se acotó el objeto `error` crudo en las 5 ubicaciones / 4 grupos de riesgo moderado
  (`error-handler.ts:67`, `fastify-app.ts:381`, `admin-pricing.fastify.ts:406,502`,
  `public-pricing.fastify.ts:125`).
- No se tocaron tests, rutas, `package.json`, `pnpm-lock.yaml`, migraciones
  ni workflows.

Estas acciones quedan documentadas como plan futuro opcional dentro de la
auditoría nueva, a ejecutar en un PR de runtime separado si se prioriza.

## Validaciones

Ver checklist de validación en el cierre de esta auditoría (typecheck,
typecheck:test, test, build, lint/typecheck/build de frontend, `git diff --check`)
— todas corridas sin cambios de código esperados (PR docs-only).
