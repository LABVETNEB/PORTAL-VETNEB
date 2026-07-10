# PR-CORS3A - backend auth CORS helper

## Estado base

- Rama: `clean/backend-cors-helper-auth-routes`.
- HEAD inicial: `9200bf1 refactor(cors): share public route origin helpers (#1165)`.
- Working tree inicial: limpio.
- PRs abiertos: no verificado con `gh` por protocolo local; no se ejecuto ningun comando `gh`.

## Scope incluido

- Migrar solo el trio auth al helper CORS compartido:
  - `server/routes/auth.fastify.ts`
  - `server/routes/admin-auth.fastify.ts`
  - `server/routes/particular-auth.fastify.ts`
- Mantener `applyCorsHeaders` local en cada ruta.
- Actualizar el test de contrato que fijaba definiciones locales de CORS en esas rutas.
- Actualizar el documento rector de auditoria final con la ejecucion real PR-CORS3A.

## Scope excluido

- Frontend runtime.
- DB, Drizzle, migraciones, dependencias, lockfiles, workflows, Render y secrets.
- Contratos HTTP: status codes, bodies, headers y mensajes.
- Logistica, `particular-study-tracking`, `study-tracking` y `public-professionals`.
- Commits, push y PR.

## Auditoria previa

- Base limpia confirmada con `git status --short`.
- Rama y HEAD confirmados con `git branch --show-current` y `git log -1 --oneline`.
- `server/lib/cors-headers.ts` ya exportaba `UNSAFE_METHODS`, `normalizeOrigin`, `getAllowedOrigins`, `getOriginHeader`, `getAllowedOriginForCors`, `getRequestOrigin` y `enforceTrustedOrigin`.
- Las tres rutas auth tenian definiciones locales de `getAllowedOrigins`, `normalizeOrigin`, `getRequestOrigin`, `enforceTrustedOrigin` y `applyCorsHeaders`.
- `security-production-invariants.test.ts` fijaba las definiciones locales del trio auth.
- `api-production-session-contract.test.ts` sigue fijando `applyCorsHeaders`; no se cambio porque `applyCorsHeaders` queda local por alcance.

## Cambios

- Las tres rutas auth importan desde `../lib/cors-headers.ts`:
  - `enforceTrustedOrigin`
  - `getAllowedOriginForCors`
  - `getAllowedOrigins`
  - `getRequestOrigin`
- Se eliminaron de esas rutas las copias locales de:
  - `UNSAFE_METHODS`
  - `getAllowedOrigins`
  - `normalizeOrigin`
  - `getOriginHeader`
  - `getAllowedOriginForCors`
  - `getRequestOrigin`
  - `enforceTrustedOrigin`
- `applyCorsHeaders` queda local y mantiene los mismos headers.
- `test/architecture/security/security-production-invariants.test.ts` ahora verifica el helper compartido y exige que las rutas auth importen el helper en vez de redefinirlo.

## Archivos modificados

- `server/routes/auth.fastify.ts`
- `server/routes/admin-auth.fastify.ts`
- `server/routes/particular-auth.fastify.ts`
- `test/architecture/security/security-production-invariants.test.ts`
- `docs/audit/final-repo-cleanup-engineering-audit.md`
- `docs/implementation/backend-cors-helper-auth-routes.md`

## Validaciones

- `pnpm typecheck`: paso.
- `pnpm typecheck:test`: paso.
- `node --experimental-strip-types --test test/cors-headers-shared-helper.test.ts`: paso, 10/10.
- `node --experimental-strip-types --test test/security-trusted-origin-cors-boundaries.test.ts`: paso, 4/4.
- `node --experimental-strip-types --test test/architecture/security/security-production-invariants.test.ts`: paso, 11/11.
- `node --experimental-strip-types --test test/api-production-session-contract.test.ts`: paso, 4/4.
- `node --experimental-strip-types --test test/architecture/security/global-auth-boundary-contract.test.ts`: paso, 5/5.
- Bloque auth especifico encontrado por grep: paso, 167/167.
- `pnpm build`: paso.
- `pnpm security:public-surface`: paso.
- `pnpm --dir frontend lint`: paso.
- `pnpm --dir frontend typecheck`: paso.
- `pnpm --dir frontend build`: paso.
- `pnpm test`: ejecutado; 2885/2893 pasaron y 8 fallaron por guardas historicas de PRs frontend que inspeccionan `git diff` y prohiben cambios en `server/routes/*`. Fallas no vinculadas a comportamiento CORS/auth.

## Resultado

PR-CORS3A queda implementado para el trio auth. El comportamiento allow-null, Origin/Referer, preflight y el mensaje `"Origen no permitido"` quedan cubiertos por tests runtime y de contrato.

## Riesgo residual

- `pnpm test` completo no queda verde mientras existan guardas frontend PR-especificas que fallan ante cualquier cambio backend en el working tree.
- `applyCorsHeaders` sigue local por contrato; su consolidacion queda fuera de este PR.

## Recomendacion PR-CORS3B

- Separar logistica y block-null en al menos dos pasos.
- Para logistica: actualizar `logistics-*-api.test.ts` para verificar import/uso del helper compartido antes de migrar rutas.
- Para `particular-study-tracking` y `study-tracking`: preservar explicitamente el contrato block-null; no reutilizar el helper allow-null sin variante o wrapper dedicado.
- Mantener `public-professionals.fastify.ts` fuera porque su CORS y mensaje son distintos.

## Estado final

- Sin commit, sin push, sin PR.
- Sin cambios en frontend runtime, DB, migraciones, dependencias, lockfiles, workflows, Render ni secrets.
