# PR-CORS3B - backend logistics CORS helper

## Estado base

- Rama: `clean/backend-cors-helper-logistics-routes`.
- HEAD inicial: `9f2e4af refactor(cors): share helper in auth routes (#1166)`.
- Working tree inicial: limpio.
- PRs abiertos: no verificado con `gh` por protocolo local; no se ejecuto ningun comando `gh`.
- Nota de paridad: `pnpm` directo resolvia `11.7.0` y fallo antes de scripts por mismatch de overrides/lockfile; se uso `corepack pnpm` para respetar `packageManager: pnpm@10.8.1`.

## Scope incluido

- Migrar solo el trio logistico real al helper CORS compartido:
  - `server/routes/logistics-field-visits.fastify.ts`
  - `server/routes/logistics-route-events.fastify.ts`
  - `server/routes/logistics-route-plans.fastify.ts`
- Mantener `applyCorsHeaders` local en cada ruta.
- Actualizar tests de contrato que fijaban definiciones locales en esas rutas.
- Actualizar el documento rector de auditoria final con la ejecucion real PR-CORS3B.

## Scope excluido

- Frontend runtime.
- DB, Drizzle, migraciones, dependencias, lockfiles, workflows, Render y secrets.
- Contratos HTTP: status codes, bodies, headers y mensajes.
- `particular-study-tracking`, `study-tracking` y `public-professionals.fastify.ts`.
- Commits, push y PR.

## Auditoria previa

- Base limpia confirmada con `git status --short --untracked-files=all`.
- Rama y HEAD confirmados con `git branch --show-current` y `git log -1 --oneline`.
- `git fetch --prune` no dejo ramas remotas no mergeadas contra `origin/main`.
- Los paths del brief `server/routes/logistics.fastify.ts`, `server/routes/logistics-admin.fastify.ts` y `server/routes/logistics-public.fastify.ts` no existen en el repo actual.
- Los archivos reales identificados por el documento rector y por `rg --files server/routes | rg "logistics"` son `logistics-field-visits`, `logistics-route-events` y `logistics-route-plans`.
- `server/lib/cors-headers.ts` ya exportaba `UNSAFE_METHODS`, `normalizeOrigin`, `getAllowedOrigins`, `getOriginHeader`, `getAllowedOriginForCors`, `getRequestOrigin` y `enforceTrustedOrigin`.
- Las tres rutas logisticas tenian definiciones locales compatibles *allow-null* de `getAllowedOrigins`, `normalizeOrigin`, `getRequestOrigin` y `enforceTrustedOrigin`.
- Las tres rutas logisticas usan `UNSAFE_METHODS` tambien fuera de CORS para guardias RBAC de metodos inseguros, por lo que ese simbolo debe importarse desde el helper compartido.
- `applyCorsHeaders` no se migro: queda local y conserva los mismos headers.
- Los tests reales que fijaban definiciones locales eran `test/logistics-field-visits-api.test.ts`, `test/logistics-route-events-api.test.ts`, `test/logistics-route-plans-api.test.ts` y la guardia ampliada en `test/architecture/security/security-production-invariants.test.ts`.
- Los tests nombrados en el brief `test/logistics-api.test.ts`, `test/logistics-admin-api.test.ts` y `test/logistics-public-api.test.ts` no existen en el repo actual.

## Cambios

- Las tres rutas logisticas importan desde `../lib/cors-headers.ts`:
  - `UNSAFE_METHODS`
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
- `applyCorsHeaders` queda local y mantiene `vary`, `access-control-allow-origin` y `access-control-allow-credentials`.
- Los tres tests `logistics-*-api.test.ts` ahora verifican import/uso del helper compartido y ausencia de definiciones locales.
- `test/architecture/security/security-production-invariants.test.ts` incorpora las rutas logisticas al contrato del helper compartido.

## Archivos modificados

- `server/routes/logistics-field-visits.fastify.ts`
- `server/routes/logistics-route-events.fastify.ts`
- `server/routes/logistics-route-plans.fastify.ts`
- `test/logistics-field-visits-api.test.ts`
- `test/logistics-route-events-api.test.ts`
- `test/logistics-route-plans-api.test.ts`
- `test/architecture/security/security-production-invariants.test.ts`
- `docs/audit/final-repo-cleanup-engineering-audit.md`
- `docs/implementation/backend-cors-helper-logistics-routes.md`

## Validaciones

- `corepack pnpm install --frozen-lockfile`: paso; restauro `node_modules` con lock congelado despues de que `pnpm 11.7.0` intentara purgarlo sin TTY.
- `corepack pnpm typecheck`: paso.
- `corepack pnpm typecheck:test`: paso.
- `node --experimental-strip-types --test test/cors-headers-shared-helper.test.ts`: paso, 10/10.
- `node --experimental-strip-types --test test/security-trusted-origin-cors-boundaries.test.ts`: paso, 4/4.
- `node --experimental-strip-types --test test/architecture/security/security-production-invariants.test.ts`: paso, 11/11.
- `node --experimental-strip-types --test test/logistics-field-visits-api.test.ts`: paso, 17/17.
- `node --experimental-strip-types --test test/logistics-route-events-api.test.ts`: paso, 11/11.
- `node --experimental-strip-types --test test/logistics-route-plans-api.test.ts`: paso, 23/23.
- `node --experimental-strip-types --test test/logistics-*.test.ts` encontrado por `rg`: paso, 219/219.
- `corepack pnpm test`: ejecutado; 2885/2893 pasaron y 8 fallaron por guardas historicas de PRs frontend que inspeccionan `git diff` y prohiben cambios backend, no por regresion CORS/logistica.
- `corepack pnpm build`: paso.
- `corepack pnpm security:public-surface`: paso; mantuvo findings informativos existentes sobre identificadores uppercase server-only en `frontend/src/proxy.ts`.
- `corepack pnpm --dir frontend lint`: paso.
- `corepack pnpm --dir frontend typecheck`: paso.
- `corepack pnpm --dir frontend build`: paso.

## Resultado

PR-CORS3B queda implementado para el trio logistico real. El comportamiento *allow-null*, `Origin`/`Referer`, preflight, mensaje `"Origen no permitido"`, headers CORS con credenciales y guardias RBAC con `UNSAFE_METHODS` quedan cubiertos por tests.

## Riesgo residual

- `corepack pnpm test` completo no queda verde mientras existan guardas frontend PR-especificas que fallan ante cualquier cambio backend en el working tree.
- `applyCorsHeaders` sigue local por contrato; su consolidacion queda fuera de este PR.
- Las rutas *block-null* siguen sin migrar porque requieren variante o wrapper dedicado para no cambiar comportamiento sin `Origin`/`Referer`.

## Recomendacion PR-CORS3C

- Migrar `particular-study-tracking` y `study-tracking` por separado.
- Preservar explicitamente el contrato *block-null* para metodos inseguros sin `Origin` ni `Referer`.
- No reutilizar el helper *allow-null* actual sin adaptar contrato.
- Mantener `public-professionals.fastify.ts` fuera porque su CORS y mensaje son distintos.

## Estado final

- Sin commit, sin push, sin PR.
- Sin cambios en frontend runtime, DB, migraciones, dependencias, lockfiles, workflows, Render ni secrets.
