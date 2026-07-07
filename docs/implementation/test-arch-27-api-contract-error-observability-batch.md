# TEST-ARCH-27 - API contract/error/observability batch

## Resumen ejecutivo

TEST-ARCH-27 mueve manualmente el lote API contract/error/observability identificado por TEST-ARCH-24.

El lote es homogeneo por comportamiento de request injection / API contract:

- `test/api-contract-smoke.test.ts`
- `test/api-error-content-type-contract.test.ts`
- `test/api-error-no-secrets-contract.test.ts`
- `test/api-error-no-stack-traces-contract.test.ts`
- `test/api-request-id-observability-contract.test.ts`
- `test/global-public-surface-hardening-contract.test.ts`
- `test/global-storage-report-safety-contract.test.ts`

Se reubican bajo:

- `test/integration/adapters/controllers/`

## Estado base

| Item | Resultado |
|---|---|
| Repo | `C:\PORTAL-VETNEB` |
| Rama base | `main` |
| HEAD base esperado | `b9ebdb3 test(architecture): move logistics runtime http api tests (#1333)` |
| Rama de trabajo | `test/api-contract-error-observability-batch` |
| Working tree inicial | Limpio |
| PRs abiertos esperados | 0 |
| Residuo remoto conocido | `origin/tesface-hardening-contract.test.ts` | `test/integration/adapters/controllers/global-public-surface-hardening-contract.test.ts` |
| `test/global-storage-report-safety-contract.test.ts` | `test/integration/adapters/controllers/global-storage-report-safety-contract.test.ts` |

## Imports ajustados

Se ajustaron imports relativos mecanicos por nueva profundidad:

- `../server/...` -> `../../../../server/...`
- `./helpers/api-request-id-contract.ts` -> `../../../helpers/api-request-id-contract.ts`

## Anchors/path references

Se revisaron referencias a paths antiguos en:

- `test/`
- `docs/`
- `scripts/`

Anchors activos actualizados dentro del lote movido:

- `readSource("test/api-error-content-type-contract.test.ts")`
- `readSource("test/api-error-no-secrets-contract.test.ts")`
- `read("test/global-public-surface-hardening-contract.test.ts")`
- `read("test/global-storage-report-safety-contract.test.ts")`

Tambien se ajusto `repoRoot` en tests que usan `fileURLToPath(new URL(..., import.meta.url))` para que siga apuntando al root del repositorio despues del move.

Referencias historicas en documentacion previa no requieren cambio.

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

Pendiente completar antes de commit:

| Comando | Resultado |
|---|---|
| `git diff --check` | OK, sin salida. |
| `git diff --stat` | OK. |
| `git diff --name-only` | OK, limitado al lote API contract/error/observability y reporte. |
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
- rate-limit group
- public-professionals invariant group
- security-sensitive groups hasta lote propio