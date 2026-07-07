# TEST-ARCH-26 - Logistics runtime HTTP/API batch

## Resumen ejecutivo

TEST-ARCH-26 mueve manualmente el lote logistics runtime HTTP/API identificado por TEST-ARCH-24.

El lote es homogeneo:

- `test/logistics-audit-runtime.test.ts`
- `test/logistics-route-plans-cache-runtime.test.ts`
- `test/logistics-route-plans-heuristic-runtime.test.ts`
- `test/logistics-route-plans-metrics-runtime.test.ts`

Los archivos usan request injection / `app.inject()` y validan rutas runtime de logistics. Se reubican bajo:

- `test/integration/adapters/controllers/`

## Estado base

| Item | Resultado |
|---|---|
| Repo | `C:\PORTAL-VETNEB` |
| Rama base | `main` |
| HEAD base | `47328f7 test(architecture): move pricing http api tests (#1332)` |
| Rama de trabajo | `test/logistics-runtime-http-api-batch` |
| Working tree inicial | Limpio |
| PRs abiertos | 0 |
| Residuo remoto conocido | `origin/test/particular-authenticated-session-fixture`, no tocado |

## Fuente de verdad

- `docs/implementation/test-arch-24-non-fastify-http-api-test-inventory.md`

## Archivos movidos

| Origen | Destino |
|---|---|
| `test/logistics-audit-runtime.test.ts` | `test/integration/adapters/controllers/logistics-audit-runtime.test.ts` |
| `test/logistics-route-plans-cache-runtime.test.ts` | `test/integration/adapters/controllers/logistics-route-plans-cache-runtime.test.ts` |
| `test/logistics-route-plans-heuristic-runtime.test.ts` | `test/integration/adapters/controllers/logistics-route-plans-heuristic-runtime.test.ts` |
| `test/logistics-route-plans-metrics-runtime.test.ts` | `test/integration/adapters/controllers/logistics-route-plans-metrics-runtime.test.ts` |

## Imports ajustados

Se ajustaron imports relativos mecanicos por nueva profundidad:

- `../server/db-logistics.ts` -> `../../../../server/db-logistics.ts`
- `../server/lib/env.ts` -> `../../../../server/lib/env.ts`
- `../server/lib/audit.ts` -> `../../../../server/lib/audit.ts`
- `../server/lib/logistics-route-plans-cache.ts` -> `../../../../server/lib/logistics-route-plans-cache.ts`

## Anchors/path references

Se revisaron referencias a paths antiguos en:

- `test/`
- `docs/`
- `scripts/`

Anchor activo actualizado:

- `test/audit-suite-completeness.test.ts`
  - `test/logistics-audit-runtime.test.ts`
  - `test/integration/adapters/controllers/logistics-audit-runtime.test.ts`

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
| `git diff --name-only` | OK, limitado a lote logistics y reporte. |
| `git status --short --untracked-files=all` | OK, solo cambios esperados antes de stage. |
| `& 'C:\Program Files\nodejs\pnpm.cmd' test` | OK: 2983 pass / 0 fail. |
| `& 'C:\Program Files\nodejs\pnpm.cmd' build` | OK. |
| `& 'C:\Program Files\nodejs\pnpm.cmd' security:public-surface` | PASS: no public devtools exposure findings. |

## Recomendacion para TEST-ARCH-27

Mover un lote API contract/error/observability, dejando diferido:

- `test/fastify-app.test.ts`
- rate-limit group
- public-professionals invariant group