# TEST-ARCH-31 - Performance load smoke

## Resumen ejecutivo

TEST-ARCH-31 mueve manualmente el smoke de performance/capacity identificado por TEST-ARCH-24.

Archivo movido:

- `test/performance-load-smoke.test.ts`

Destino:

- `test/integration/adapters/controllers/performance-load-smoke.test.ts`

El test cubre:

- search publico de profesionales bajo carga concurrente
- detail publico de profesionales bajo carga concurrente
- budgets de capacidad bounded public surfaces
- guardrails textuales de limites y rate-limit en rutas publicas

## Estado base

| Item | Resultado |
|---|---|
| Repo | `C:\PORTAL-VETNEB` |
| Rama base | `main` |
| HEAD base esperado | `5ddf739 test(architecture): move client version gate contract (#1338)` |
| Rama de trabajo | `test/performance-load-smoke-move` |
| Working tree inicial | Limpio |
| PRs abiertos esperados | 0 |
| Residuo remoto conocido | `origin/test/particular-authenticated-session-fixture`, no tocado |

## Fuente de verdad

- `docs/implementation/test-arch-24-non-fastify-http-api-test-inventory.md`
- `docs/implementation/test-arch-30-client-version-gate-contract.md`

## Archivo movido

| Origen | Destino |
|---|---|
| `test/performance-load-smoke.test.ts` | `test/integration/adapters/controllers/performance-load-smoke.test.ts` |

## Paths ajustados

Se ajustaron paths relativos mecanicos por nueva profundidad:

- `../server/routes/public-professionals.fastify.ts` -> `../../../../server/routes/public-professionals.fastify.ts`
- `../server/routes/public-report-access.fastify.ts` -> `../../../../server/routes/public-report-access.fastify.ts`

Aplica tanto al import real como a los `new URL(..., import.meta.url)` usados para guardrails textuales.

## Anchors activos

No se esperan anchors activos en `test/**` o `scripts/**` para el path antiguo del archivo.
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
| `git diff --name-only` | OK, limitado al smoke performance-load y reporte. |
| `git status --short --untracked-files=all` | OK, solo cambios esperados antes de stage. |
| `& 'C:\Program Files\nodejs\pnpm.cmd' typecheck:test` | Pendiente |
| `& 'C:\Program Files\nodejs\pnpm.cmd' test` | Pendiente |
| `& 'C:\Program Files\nodejs\pnpm.cmd' build` | Pendiente |
| `& 'C:\Program Files\nodejs\pnpm.cmd' security:public-surface` | Pendiente |

## Recomendacion para siguiente lote

Mantener diferidos:

- `test/contact-route.test.ts`
- `test/fastify-app.test.ts`
- security-sensitive groups con anchors activos hasta lote propio