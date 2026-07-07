# TEST-ARCH-29 - Login rate-limit HTTP/API batch

## Resumen ejecutivo

TEST-ARCH-29 mueve manualmente el lote login rate-limit HTTP/API identificado por TEST-ARCH-24.

El lote es homogeneo por superficie de autenticacion y rate limit con `app.inject()`:

- `test/login-rate-limit-operability.test.ts`
- `test/login-rate-limit-reset-on-success.test.ts`

Se reubican bajo:

- `test/integration/adapters/controllers/`

## Estado base

| Item | Resultado |
|---|---|
| Repo | `C:\PORTAL-VETNEB` |
| Rama base | `main` |
| HEAD base esperado | `9abb7b1 docs(test): close test arch 28 validation report (#1336)` |
| Rama de trabajo | `test/login-rate-limit-http-api-batch` |
| Working tree inicial | Limpio |
| PRs abiertos esperados | 0 |
| Residuo remoto conocido | `origin/test/particular-authenticated-session-fixture`, no tocado |

## Fuente de verdad

- `docs/implementation/test-arch-24-non-fastify-http-api-test-inventory.md`
- `docs/implementation/test-arch-28-public-professionals-invariants-batch.md`

## Archivos movidos

| Origen | Destino |
|---|---|
| `test/login-rate-limit-operability.test.ts` | `test/integration/adapters/controllers/login-rate-limit-operability.test.ts` |
| `test/login-rate-limit-reset-on-success.test.ts` | `test/integration/adapters/controllers/login-rate-limit-reset-on-success.test.ts` |

## Imports ajustados

Se ajustaron imports relativos mecanicos por nueva profundidad:

- `../server/lib/rate-limit-store.ts` -> `../../../../server/lib/rate-limit-store.ts`
- `../server/lib/login-rate-limit.ts` -> `../../../../server/lib/login-rate-limit.ts`
- `../server/routes/auth.fastify.ts` -> `../../../../server/routes/auth.fastify.ts`
- `../server/routes/admin-auth.fastify.ts` -> `../../../../server/routes/admin-auth.fastify.ts`
- `../server/routes/particular-auth.fastify.ts` -> `../../../../server/routes/particular-auth.fastify.ts`

## Anchors activos

No se esperan anchors activos en `test/**` o `scripts/**` para los paths antiguos del lote.
Las referencias documentales historicas se mantienen.

## Scope confirmado

No se modifico:

- runtime/producto
- backend productivo
- DB/schema/migrations
- CI
- dependencias
- `package.json`
- `pnpm-lock.yaml`

No se uso Codex ni Claude.

## Validaciones

Completadas antes de commit:

| Comando | Resultado |
|---|---|
| `git diff --check` | OK, sin salida. |
| `git diff --stat` | OK. |
| `git diff --name-only` | OK, limitado al lote login rate-limit HTTP/API y reporte. |
| `git status --short --untracked-files=all` | OK, solo cambios esperados antes de stage. |
| `& 'C:\Program Files\nodejs\pnpm.cmd' typecheck:test` | Pendiente |
| `& 'C:\Program Files\nodejs\pnpm.cmd' test` | Pendiente |
| `& 'C:\Program Files\nodejs\pnpm.cmd' build` | Pendiente |
| `& 'C:\Program Files\nodejs\pnpm.cmd' security:public-surface` | Pendiente |

## Recomendacion para siguiente lote

Mantener diferidos:

- `test/client-version-gate-contract.test.ts`
- `test/performance-load-smoke.test.ts`
- `test/fastify-app.test.ts`
- `test/contact-route.test.ts`
- security-sensitive groups con anchors activos hasta lote propio