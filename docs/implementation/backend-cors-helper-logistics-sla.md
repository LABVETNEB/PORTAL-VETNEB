# Backend CORS helper - logistics SLA

## Estado base

- Rama: `clean/backend-cors-helper-logistics-sla`.
- HEAD inicial: `3ccfeab docs(audit): close cors cleanup block (#1169)`.
- Working tree inicial: limpio (`git status --short` sin salida).
- Ramas remotas no mergeadas contra `origin/main`: sin salida local.
- PRs abiertos: no verificado con `gh` por protocolo local; no se ejecuto ningun comando `gh`.

## Scope incluido

- Auditar el residual CORS documentado en `server/routes/logistics-sla.fastify.ts`.
- Migrar solo `logistics-sla.fastify.ts` al helper CORS compartido si el contrato era compatible.
- Mantener `applyCorsHeaders` local.
- Preservar preflight `OPTIONS`, status codes, bodies, headers, mensajes y semantica `Origin`/`Referer`.
- Actualizar tests contractuales existentes.
- Actualizar `docs/audit/final-repo-cleanup-engineering-audit.md`.

## Scope excluido

- Frontend runtime.
- DB, Drizzle, migraciones, dependencias, lockfiles, workflows, Render y secrets.
- Contratos HTTP.
- `server/routes/public-professionals.fastify.ts`.
- Rutas logisticas ya migradas, study-tracking y middleware global.
- Commits, push y PR.

## Auditoria previa

- `server/lib/cors-headers.ts` ya exportaba `UNSAFE_METHODS`, `normalizeOrigin`, `getAllowedOrigins`, `getOriginHeader`, `getAllowedOriginForCors`, `getRequestOrigin`, `enforceTrustedOrigin` y `enforceTrustedOriginRequired`.
- `server/routes/logistics-sla.fastify.ts` tenia superficie GET-only: `GET,OPTIONS`.
- La ruta no usaba `UNSAFE_METHODS`, `enforceTrustedOrigin` ni `enforceTrustedOriginRequired`.
- La ruta solo necesitaba helpers de allowlist, reflejo CORS y lectura de `Origin`/`Referer`.
- Las funciones locales eran compatibles con el helper compartido para el contrato usado:
  `getAllowedOrigins`, `normalizeOrigin`, `getOriginHeader`, `getAllowedOriginForCors` y `getRequestOrigin`.
- No correspondia introducir trusted-origin nuevo ni convertir el endpoint GET-only en block-null.
- Tests relacionados encontrados: `test/logistics-sla-routes-api.test.ts`,
  `test/logistics-sla-routes-integration.fastify.test.ts`,
  `test/cors-headers-shared-helper.test.ts`,
  `test/architecture/security/security-production-invariants.test.ts`,
  `test/security-trusted-origin-cors-boundaries.test.ts`,
  `test/global-auth-boundary-contract.test.ts` y
  `test/security-csrf-mutating-route-coverage.test.ts`.

## Cambios

- `server/routes/logistics-sla.fastify.ts` importa desde `../lib/cors-headers.ts`:
  - `getAllowedOriginForCors`
  - `getAllowedOrigins`
  - `getRequestOrigin`
- Se eliminaron de `logistics-sla.fastify.ts` las copias locales de:
  - `getAllowedOrigins`
  - `normalizeOrigin`
  - `getOriginHeader`
  - `getAllowedOriginForCors`
  - `getRequestOrigin`
- `applyCorsHeaders` queda local y conserva `vary`, `access-control-allow-origin` y `access-control-allow-credentials`.
- `OPTIONS` mantiene `access-control-allow-methods: GET,OPTIONS`.
- No se importo ni se uso `UNSAFE_METHODS`, `enforceTrustedOrigin` ni `enforceTrustedOriginRequired`.
- `test/logistics-sla-routes-api.test.ts` ahora fija import/uso del helper compartido y ausencia de copias CORS locales.
- `test/architecture/security/security-production-invariants.test.ts` incorpora `logistics-sla.fastify.ts` al contrato CORS compartido GET-only.
- `docs/audit/final-repo-cleanup-engineering-audit.md` marca el residual como resuelto.

## Archivos modificados

- `server/routes/logistics-sla.fastify.ts`
- `test/logistics-sla-routes-api.test.ts`
- `test/architecture/security/security-production-invariants.test.ts`
- `docs/audit/final-repo-cleanup-engineering-audit.md`
- `docs/implementation/backend-cors-helper-logistics-sla.md`

## Validaciones

- `pnpm typecheck`: fallo antes de ejecutar el script por `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`.
- `pnpm typecheck:test`: fallo antes de ejecutar el script por `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`.
- `corepack pnpm typecheck`: paso.
- `corepack pnpm typecheck:test`: paso.
- `node --experimental-strip-types --test test/cors-headers-shared-helper.test.ts`: paso, 14/14.
- `node --experimental-strip-types --test test/architecture/security/security-production-invariants.test.ts`: paso, 11/11.
- `node --experimental-strip-types --test test/security-trusted-origin-cors-boundaries.test.ts`: paso, 4/4.
- `node --experimental-strip-types --test test/logistics-sla-routes-api.test.ts`: paso, 8/8.
- `node --experimental-strip-types --test test/logistics-sla-routes-integration.fastify.test.ts`: paso, 16/16.
- `node --experimental-strip-types --test test/logistics-sla-schema.test.ts test/logistics-sla-compliance.test.ts test/logistics-sla-breach-runtime.test.ts test/logistics-metrics-suite-completeness.test.ts`: paso, 32/32.
- `node --experimental-strip-types --test test/global-auth-boundary-contract.test.ts`: paso, 5/5.
- `node --experimental-strip-types --test test/security-csrf-mutating-route-coverage.test.ts`: paso, 17/17.
- `corepack pnpm build`: paso.
- `corepack pnpm security:public-surface`: paso; conserva findings informativos server-only existentes en `frontend/src/proxy.ts`.
- `corepack pnpm --dir frontend lint`: paso.
- `corepack pnpm --dir frontend typecheck`: paso.
- `corepack pnpm --dir frontend build`: paso.
- `corepack pnpm test`: ejecutado; 2891/2899 pasaron y 8 fallaron por guardas historicas frontend que inspeccionan `git diff` y rechazan cambios backend en `server/routes/logistics-sla.fastify.ts`, no por regresion CORS/SLA.

## Resultado

`logistics-sla.fastify.ts` queda migrado al helper CORS compartido para los helpers compatibles. El residual documentado queda cerrado sin tocar `server/lib/cors-headers.ts` y sin cambiar el contrato GET/OPTIONS.

## Riesgo residual

- `corepack pnpm test` completo no queda verde mientras existan guardas frontend PR-especificas que fallan ante cambios backend en el working tree.
- `applyCorsHeaders` sigue local por contrato; su consolidacion queda fuera de este PR.
- `public-professionals.fastify.ts` sigue fuera por contrato CORS y mensaje propio.

## Estado final

- Sin commit, sin push, sin PR.
- Sin cambios en frontend runtime, DB, migraciones, dependencias, lockfiles, workflows, Render ni secrets.
