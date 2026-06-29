# PR-CORS3C - backend block-null CORS helper

## Estado base

- Rama: `clean/backend-cors-helper-block-null-routes`.
- HEAD inicial: `bef63a1 refactor(cors): share helper in logistics routes (#1167)`.
- Working tree inicial: limpio.
- PRs abiertos: no verificado con `gh` por protocolo local; no se ejecuto ningun comando `gh`.
- `pnpm` directo falla antes de scripts por `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`; se usaron equivalentes `corepack pnpm` para respetar el `packageManager` del repo.

## Scope incluido

- Migrar solo las rutas CORS *block-null*:
  - `server/routes/particular-study-tracking.fastify.ts`
  - `server/routes/study-tracking.fastify.ts`
- Agregar helper compartido explicito para metodos inseguros que requieren `Origin` o `Referer`.
- Mantener `applyCorsHeaders` local en ambas rutas.
- Actualizar tests de contrato y runtime de las dos rutas.
- Actualizar el documento rector de auditoria final con la ejecucion real PR-CORS3C.

## Scope excluido

- `server/routes/public-professionals.fastify.ts`.
- Frontend runtime.
- DB, Drizzle, migraciones, dependencias, lockfiles, workflows, Render y secrets.
- Contratos HTTP: status codes, bodies, headers y mensajes.
- Cambios en `CORS_ORIGIN` o env.
- Commits, push y PR.

## Auditoria previa

- Base limpia confirmada con `git status --short`.
- Rama y HEAD confirmados con `git branch --show-current` y `git log -1 --oneline`.
- `server/lib/cors-headers.ts` tenia `enforceTrustedOrigin` con contrato *allow-null*: metodos inseguros sin `Origin` ni `Referer` pasan.
- `particular-study-tracking` y `study-tracking` tenian contrato *block-null*: metodos inseguros sin `Origin` ni `Referer` responden 403.
- Los `git grep` obligatorios confirmaron copias locales en ambas rutas de `getAllowedOrigins`, `normalizeOrigin`, `getRequestOrigin`, `enforceTrustedOrigin`, `UNSAFE_METHODS`, `applyCorsHeaders` y `"Origen no permitido"`.
- Tests relacionados encontrados: `test/cors-headers-shared-helper.test.ts`, `test/security-production-invariants.test.ts`, `test/study-tracking.fastify.test.ts`, `test/particular-study-tracking.fastify.test.ts`, `test/security-trusted-origin-cors-boundaries.test.ts`, `test/security-csrf-mutating-route-coverage.test.ts`, `test/security-mutation-permission-surface.test.ts`, `test/study-tracking-suite-completeness.test.ts` y contratos de sesion/audit/report-status/access-token.
- `public-professionals.fastify.ts` queda fuera porque usa contrato CORS y mensaje propio: `"Origin no permitido"`.

## Cambios

- `server/lib/cors-headers.ts` exporta `enforceTrustedOriginRequired`.
- El nuevo helper reutiliza `UNSAFE_METHODS` y `getRequestOrigin`.
- `enforceTrustedOriginRequired` conserva metodos seguros y bloquea metodos inseguros cuando:
  - falta `Origin` y falta `Referer`;
  - el origen normalizado no esta en `allowedOrigins`.
- El bloqueo preserva 403 y body exacto `{ success: false, error: "Origen no permitido" }`.
- Las dos rutas importan desde `../lib/cors-headers.ts`:
  - `enforceTrustedOriginRequired as enforceTrustedOrigin`
  - `getAllowedOriginForCors`
  - `getAllowedOrigins`
  - `getRequestOrigin`
- Se eliminaron de ambas rutas las copias locales de:
  - `UNSAFE_METHODS`
  - `getAllowedOrigins`
  - `normalizeOrigin`
  - `getOriginHeader`
  - `getAllowedOriginForCors`
  - `getRequestOrigin`
  - `enforceTrustedOrigin`
- `applyCorsHeaders` queda local y mantiene los mismos headers.

## Archivos modificados

- `server/lib/cors-headers.ts`
- `server/routes/particular-study-tracking.fastify.ts`
- `server/routes/study-tracking.fastify.ts`
- `test/cors-headers-shared-helper.test.ts`
- `test/particular-study-tracking.fastify.test.ts`
- `test/security-production-invariants.test.ts`
- `test/study-tracking.fastify.test.ts`
- `docs/audit/final-repo-cleanup-engineering-audit.md`
- `docs/implementation/backend-cors-helper-block-null-routes.md`

## Validaciones

- `pnpm typecheck`: fallo antes de ejecutar scripts por `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`.
- `pnpm typecheck:test`: fallo antes de ejecutar scripts por `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`.
- `corepack pnpm typecheck`: paso.
- `corepack pnpm typecheck:test`: paso.
- `node --experimental-strip-types --test test/cors-headers-shared-helper.test.ts`: paso, 14/14.
- `node --experimental-strip-types --test test/security-trusted-origin-cors-boundaries.test.ts`: paso, 4/4.
- `node --experimental-strip-types --test test/security-production-invariants.test.ts`: paso, 11/11.
- `node --experimental-strip-types --test test/particular-study-tracking.fastify.test.ts`: paso, 12/12.
- `node --experimental-strip-types --test test/study-tracking.fastify.test.ts`: paso, 11/11.
- Contratos adicionales encontrados por grep: CSRF, mutacion/permisos, management, suite study-tracking, runtime timing, `fastify-app`, cross-auth/sesiones, ownership, response disclosure, audit/write attribution y report/status/access-token: pasaron.
- `corepack pnpm build`: paso.
- `corepack pnpm security:public-surface`: paso; sin findings publicos, con notas server-only existentes en `frontend/src/proxy.ts`.
- `corepack pnpm --dir frontend lint`: paso.
- `corepack pnpm --dir frontend typecheck`: primer intento fallo por `.next/types/routes.js` faltante antes del build; segundo intento paso despues de `frontend build`.
- `corepack pnpm --dir frontend build`: paso.
- `corepack pnpm test`: ejecutado; 2890/2898 pasaron y 8 fallaron por guardas historicas de PRs frontend que inspeccionan `git diff` y prohiben cambios backend.

## Resultado

PR-CORS3C queda implementado para las dos rutas *block-null*. El helper *allow-null* existente no cambio. El comportamiento 403 ante metodos inseguros sin `Origin` ni `Referer`, el mensaje exacto `"Origen no permitido"` y los headers/preflight de cada ruta quedan preservados y cubiertos por tests.

## Riesgo residual

- `corepack pnpm test` completo no queda verde mientras existan guardas frontend PR-especificas que fallan ante cambios backend en el working tree.
- El primer `frontend typecheck` puede fallar si `.next/types/routes.js` no existe; `frontend build` lo regenera y el typecheck posterior pasa.
- `applyCorsHeaders` sigue local por contrato; su consolidacion queda fuera de este PR.

## Recomendacion public-professionals

- No migrar `public-professionals.fastify.ts` dentro del helper actual.
- Si se decide consolidarlo, hacerlo en PR dedicado porque conserva contrato y mensaje propio: `"Origin no permitido"`.

## Estado final

- Sin commit, sin push, sin PR.
- Sin cambios en frontend runtime, DB, migraciones, dependencias, lockfiles, workflows, Render ni secrets.
