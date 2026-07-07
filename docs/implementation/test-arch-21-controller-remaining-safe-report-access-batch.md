# TEST-ARCH-21 - Controller remaining safe report-access batch

## Resumen ejecutivo

TEST-ARCH-21 movio fisicamente los 4 controller tests restantes clasificados como `MOVIBLE_SEGURO` por TEST-ARCH-16, excluyendo explicitamente el trio reports bloqueado por `report-study-types-catalog.test.ts`.

El cambio fue mecanico:
- move a `test/integration/adapters/controllers/`
- ajuste de imports relativos `../server/**` -> `../../../../server/**`
- actualizacion de anchors/path references exactos en guards de reports/storage/security
- sin cambios de runtime, producto, backend productivo, DB, schema, migraciones, CI, dependencias, `package.json` ni `pnpm-lock.yaml`

## Base verificada

| Item | Resultado |
|---|---|
| Repo | `C:\PORTAL-VETNEB` |
| Entorno | Windows, PowerShell, PNPM |
| Rama esperada | `test/controller-remaining-safe-report-access-batch` |
| HEAD base esperado | `3c4f992 test(architecture): move admin token controller tests (#1327)` |
| Scope | Test physical organization only |

## Fuente de verdad usada

Fuente obligatoria:

- `docs/implementation/test-arch-16-controller-post-unlock-inventory.md`

Contexto reciente:

- TEST-ARCH-17 movio study-tracking.
- TEST-ARCH-18 movio auth core.
- TEST-ARCH-19 movio public/storage.
- TEST-ARCH-20 movio admin tokens.

## Archivos movidos

| Origen | Destino |
|---|---|
| `test/particular-auth.fastify.test.ts` | `test/integration/adapters/controllers/particular-auth.fastify.test.ts` |
| `test/particular-tokens.fastify.test.ts` | `test/integration/adapters/controllers/particular-tokens.fastify.test.ts` |
| `test/public-report-access.fastify.test.ts` | `test/integration/adapters/controllers/public-report-access.fastify.test.ts` |
| `test/report-access-tokens.fastify.test.ts` | `test/integration/adapters/controllers/report-access-tokens.fastify.test.ts` |

## Imports ajustados

Se ajustaron solo imports relativos desde `../server/**` a `../../../../server/**` en los 4 archivos movidos.

## Anchors/path references actualizados

Se actualizaron referencias exactas antiguas a los nuevos paths en:

- `test/reports-suite-completeness.test.ts`
- `test/storage-suite-completeness.test.ts`
- `test/security-critical-route-surface-registry.test.ts`

Los guards security clasificados como subdirectory-aware no se editaron salvo que tuvieran path exacto en los archivos anteriores.

## Archivos explicitamente excluidos

No se movieron archivos `BLOQUEADO_POR_ANCHOR`:

- `test/admin-reports.fastify.test.ts`
- `test/reports.fastify.test.ts`
- `test/reports-status.fastify.test.ts`

No se movieron tests no `*.fastify.test.ts`.

## Validaciones ejecutadas

Pendiente completar antes de commit:

| Comando | Resultado |
|---|---|
| `git diff --check` | Pendiente |
| `git diff --stat` | Pendiente |
| `git diff --name-only` | Pendiente |
| `git status --short --untracked-files=all` | Pendiente |
| `& 'C:\Program Files\nodejs\pnpm.cmd' test` | Pendiente |
| `& 'C:\Program Files\nodejs\pnpm.cmd' build` | Pendiente |
| `& 'C:\Program Files\nodejs\pnpm.cmd' security:public-surface` | Pendiente |

## Riesgo residual

Riesgo medio-bajo. El lote es mas grande que los anteriores, pero sigue limitado a archivos `MOVIBLE_SEGURO`, imports mecanicos y anchors exactos conocidos.

## Recomendacion para TEST-ARCH-22

Desbloquear y mover en un solo PR el trio reports:

- `test/admin-reports.fastify.test.ts`
- `test/reports.fastify.test.ts`
- `test/reports-status.fastify.test.ts`

Ese PR debe modificar `test/report-study-types-catalog.test.ts` para hacerlo path-aware o actualizar su lista hardcodeada y `assert.deepEqual`.

## Confirmacion de scope

No se tocaron runtime, producto, backend productivo, DB, schema, migraciones, CI, dependencias, `package.json` ni `pnpm-lock.yaml`.