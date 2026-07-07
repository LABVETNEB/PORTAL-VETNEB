# TEST-ARCH-34 - Report write surface security batch

## Resumen ejecutivo

TEST-ARCH-34 mueve en un unico PR eficiente el test root-level de ownership de escritura de informes y actualiza sus anchors activos.

Archivo movido:

- `test/report-write-surface-ownership.test.ts`

Destino:

- `test/security/report-write-surface-ownership.test.ts`

Anchors activos actualizados:

- `test/report-study-types-catalog.test.ts`
- `test/reports-suite-completeness.test.ts`

## Criterio de eficiencia

Este lote evita un micro-PR aislado y evita una correccion posterior de guards.

Se agrupa en un solo PR:

- movimiento del test
- ajuste de imports
- actualizacion de anchors activos
- reporte de implementacion

## Estado base

| Item | Resultado |
|---|---|
| Repo | `C:\PORTAL-VETNEB` |
| Rama base | `main` |
| HEAD base esperado | `b77a888 test(architecture): move security boundary root tests (#1341)` |
| Rama de trabajo | `test/report-write-surface-security-batch` |
| Working tree inicial | Limpio |
| PRs abiertos esperados | 0 |
| Residuo remoto conocido | `origin/test/particular-authenticated-session-fixture`, no tocado |

## Fuente de verdad

- `docs/implementation/test-arch-24-non-fastify-http-api-test-inventory.md`
- `docs/implementation/test-arch-33-security-boundary-root-batch.md`

## Archivo movido

| Origen | Destino |
|---|---|
| `test/report-write-surface-ownership.test.ts` | `test/security/report-write-surface-ownership.test.ts` |

## Imports ajustados

Se ajustaron imports relativos mecanicos por nueva profundidad:

- `../server/lib/env.ts` -> `../../server/lib/env.ts`
- `../server/routes/admin-reports.fastify.ts` -> `../../server/routes/admin-reports.fastify.ts`

No se cambiaron rutas source leidas desde `process.cwd()` como:

- `server/routes/...`

Motivo: esas rutas son relativas a la raiz del repo.

## Anchors actualizados

Se actualizo el path canonico del test movido en:

- `test/report-study-types-catalog.test.ts`
- `test/reports-suite-completeness.test.ts`

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
| `git diff --name-only` | OK, limitado al lote report write surface security y reporte. |
| `git status --short --untracked-files=all` | OK, solo cambios esperados antes de stage. |
| `& 'C:\Program Files\nodejs\pnpm.cmd' typecheck:test` | Pendiente |
| `& 'C:\Program Files\nodejs\pnpm.cmd' test` | Pendiente |
| `& 'C:\Program Files\nodejs\pnpm.cmd' build` | Pendiente |
| `& 'C:\Program Files\nodejs\pnpm.cmd' security:public-surface` | Pendiente |

## Recomendacion para siguiente lote

Mantener diferidos hasta lote propio con anchors:

- `test/audit-export-boundaries.test.ts`
- `test/security-trusted-origin-cors-boundaries.test.ts`

Mantener diferido por decision arquitectonica:

- `test/fastify-app.test.ts`