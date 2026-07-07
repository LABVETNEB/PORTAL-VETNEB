# TEST-ARCH-25 - Pricing HTTP/API batch

## Resumen ejecutivo

TEST-ARCH-25 mueve manualmente el lote pricing HTTP/API identificado por TEST-ARCH-24.

El lote es chico y homogeneo:

- `test/admin-pricing-api.test.ts`
- `test/public-pricing-api.test.ts`

Ambos usan request injection / `app.inject()` y validan rutas backend expuestas. Se reubican bajo:

- `test/integration/adapters/controllers/`

## Estado base

| Item | Resultado |
|---|---|
| Repo | `C:\PORTAL-VETNEB` |
| Rama base | `main` |
| HEAD base | `a523f70 docs(test): inventory non fastify http api tests (#1331)` |
| Rama de trabajo | `test/pricing-http-api-batch` |
| Working tree inicial | Limpio |
| PRs abiertos | 0 |
| Residuo remoto conocido | `origin/test/particular-authenticated-session-fixture`, no tocado |

## Fuente de verdad

- `docs/implementation/test-arch-24-non-fastify-http-api-test-inventory.md`

## Archivos movidos

| Origen | Destino |
|---|---|
| `test/admin-pricing-api.test.ts` | `test/integration/adapters/controllers/admin-pricing-api.test.ts` |
| `test/public-pricing-api.test.ts` | `test/integration/adapters/controllers/public-pricing-api.test.ts` |

## Imports ajustados

Se ajustaron imports relativos mecanicos por nueva profundidad en `admin-pricing-api.test.ts`:

- `../server/lib/env.ts` -> `../../../../server/lib/env.ts`
- `../server/lib/public-pricing-cache.ts` -> `../../../../server/lib/public-pricing-cache.ts`
- `../server/db-pricing.ts` -> `../../../../server/db-pricing.ts`

`public-pricing-api.test.ts` no tenia imports relativos detectados en la revision previa.

## Anchors/path references

Se revisaron referencias a paths antiguos en:

- `test/`
- `docs/`
- `scripts/`

Resultado:

- no hay anchors activos en `test/**`
- solo hay referencias historicas/documentales en inventarios previos y `docs/pr-history`
- no se modificaron docs historicos

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
| `git diff --name-only` | OK, limitado a lote pricing y reporte. |
| `git status --short --untracked-files=all` | OK, solo cambios esperados antes de stage. |
| `& 'C:\Program Files\nodejs\pnpm.cmd' test` | OK: 2983 pass / 0 fail. |
| `& 'C:\Program Files\nodejs\pnpm.cmd' build` | OK. |
| `& 'C:\Program Files\nodejs\pnpm.cmd' security:public-surface` | PASS: no public devtools exposure findings. |

## Recomendacion para TEST-ARCH-26

Mover el lote logistics runtime si TEST-ARCH-25 queda verde:

- `test/logistics-audit-runtime.test.ts`
- `test/logistics-route-plans-cache-runtime.test.ts`
- `test/logistics-route-plans-heuristic-runtime.test.ts`
- `test/logistics-route-plans-metrics-runtime.test.ts`

Mantener `test/fastify-app.test.ts` diferido.