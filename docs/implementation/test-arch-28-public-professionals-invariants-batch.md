# TEST-ARCH-28 - Public professionals invariants batch

## Resumen ejecutivo

TEST-ARCH-28 mueve manualmente el lote public-professionals invariants identificado por TEST-ARCH-24.

El lote es homogeneo por superficie HTTP/API de profesionales publicos:

- `test/public-professionals-logging-invariants.test.ts`
- `test/public-professionals-response-headers-invariants.test.ts`
- `test/public-professionals-route-surface-invariants.test.ts`

Se reubican bajo:

- `test/integration/adapters/controllers/`

## Estado base

| Item | Resultado |
|---|---|
| Repo | `C:\PORTAL-VETNEB` |
| Rama base | `main` |
| HEAD base esperado | `6dd227c test(architecture): move api contract observability tests (#1334)` |
| Rama de trabajo | `test/public-professionals-invariants-batch` |
| Working tree inicial | Limpio |
| PRs abiertos esperados | 0 |
| Residuo remoto conocido | `origin/test/particular-authenticated-session-fixture`, no tocado |

## Fuente de verdad

- `docs/implementation/test-arch-24-non-fastify-http-api-test-inventory.md`
- `docs/implementation/test-arch-27-api-contract-error-observability-batch.md`

## Archivos movidos

| Origen | Destino |
|---|---|
| `test/public-professionals-logging-invariants.test.ts` | `test/integration/adapters/controllers/public-professionals-logging-invariants.test.ts` |
| `test/public-professionals-response-headers-invariants.test.ts` | `test/integration/adapters/controllers/public-professionals-response-headers-invariants.test.ts` |
| `test/public-professionals-route-surface-invariants.test.ts` | `test/integration/adapters/controllers/public-professionals-route-surface-invariants.test.ts` |

## Anchors actualizados

Se actualizaron guards activos:

- `test/public-professionals-fixture-adoption-invariants.test.ts`
- `test/public-professionals-fixture-file-scope-invariants.test.ts`
- `test/security-critical-route-surface-registry.test.ts`
- `test/security-rate-limit-isolation-boundaries.test.ts`

Cambios realizados:

- paths antiguos del lote public-professionals -> paths nuevos bajo `test/integration/adapters/controllers/`
- import esperado de fixture compartido:
  - `from "./helpers/public-professionals-fixtures.ts"`
  - `from "../../../helpers/public-professionals-fixtures.ts"`

## Imports ajustados

Se ajustaron imports relativos mecanicos por nueva profundidad:

- `../server/routes/public-professionals.fastify.ts` -> `../../../../server/routes/public-professionals.fastify.ts`
- `./helpers/public-professionals-fixtures.ts` -> `../../../helpers/public-professionals-fixtures.ts`

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
| `git diff --name-only` | OK, limitado al lote public-professionals invariants, guards activos y reporte. |
| `git status --short --untracked-files=all` | OK, solo cambios esperados antes de stage. |
| `& 'C:\Program Files\nodejs\pnpm.cmd' typecheck:test` | OK. |
| `& 'C:\Program Files\nodejs\pnpm.cmd' test` | OK: 2983 pass / 0 fail. |
| `& 'C:\Program Files\nodejs\pnpm.cmd' build` | OK. |
| `& 'C:\Program Files\nodejs\pnpm.cmd' security:public-surface` | PASS. |

## Recomendacion para siguiente lote

Mantener diferidos:

- `test/client-version-gate-contract.test.ts`
- `test/performance-load-smoke.test.ts`
- `test/fastify-app.test.ts`
- rate-limit group
- security-sensitive groups hasta lote propio