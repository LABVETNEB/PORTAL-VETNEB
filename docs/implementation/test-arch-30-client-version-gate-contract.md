# TEST-ARCH-30 - Client version gate contract

## Resumen ejecutivo

TEST-ARCH-30 mueve manualmente el contrato `client-version-gate` identificado por TEST-ARCH-24.

El lote es intencionalmente de un solo archivo porque el test combina:

- contrato directo de `server/middlewares/version-gate.ts`
- escenarios con `spawnSync`
- lectura textual de `server/fastify-app.ts`
- runtime smoke con `createFastifyApp()` en child process

Archivo movido:

- `test/client-version-gate-contract.test.ts`

Destino:

- `test/integration/adapters/controllers/client-version-gate-contract.test.ts`

## Estado base

| Item | Resultado |
|---|---|
| Repo | `C:\PORTAL-VETNEB` |
| Rama base | `main` |
| HEAD base esperado | `96536af test(architecture): move login rate limit api tests (#1337)` |
| Rama de trabajo | `test/client-version-gate-contract-move` |
| Working tree inicial | Limpio |
| PRs abiertos esperados | 0 |
| Residuo remoto conocido | `origin/test/particular-authenticated-session-fixture`, no tocado |

## Fuente de verdad

- `docs/implementation/test-arch-24-non-fastify-http-api-test-inventory.md`
- `docs/implementation/test-arch-29-login-rate-limit-http-api-batch.md`

## Archivo movido

| Origen | Destino |
|---|---|
| `test/client-version-gate-contract.test.ts` | `test/integration/adapters/controllers/client-version-gate-contract.test.ts` |

## Imports ajustados

Se ajusto solo el import real del test por nueva profundidad:

- `../server/middlewares/version-gate.ts` -> `../../../../server/middlewares/version-gate.ts`

No se cambiaron los imports dentro de scripts ejecutados por `spawnSync`:

- `./server/middlewares/version-gate.ts`
- `./server/fastify-app.ts`

Motivo: esos scripts corren en child process con `cwd` en la raiz del repo.

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
| `git diff --name-only` | OK, limitado al contrato client-version-gate y reporte. |
| `git status --short --untracked-files=all` | OK, solo cambios esperados antes de stage. |
| `& 'C:\Program Files\nodejs\pnpm.cmd' typecheck:test` | Pendiente |
| `& 'C:\Program Files\nodejs\pnpm.cmd' test` | Pendiente |
| `& 'C:\Program Files\nodejs\pnpm.cmd' build` | Pendiente |
| `& 'C:\Program Files\nodejs\pnpm.cmd' security:public-surface` | Pendiente |

## Recomendacion para siguiente lote

Mantener diferidos:

- `test/performance-load-smoke.test.ts`
- `test/contact-route.test.ts`
- `test/fastify-app.test.ts`
- security-sensitive groups con anchors activos hasta lote propio