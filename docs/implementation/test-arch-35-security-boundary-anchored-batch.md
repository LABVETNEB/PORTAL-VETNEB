# TEST-ARCH-35 - Security boundary anchored batch

## Resumen ejecutivo

TEST-ARCH-35 mueve en un unico PR eficiente dos tests security/boundary root-level con anchors activos.

Archivos movidos:

- `test/audit-export-boundaries.test.ts`
- `test/security-trusted-origin-cors-boundaries.test.ts`

Destino:

- `test/security/audit-export-boundaries.test.ts`
- `test/security/security-trusted-origin-cors-boundaries.test.ts`

## Criterio de eficiencia

Este lote agrupa:

- movimiento de dos tests security/boundary
- ajuste de imports relativos
- actualizacion de anchors activos en `test/**`
- actualizacion de referencias activas en `docs/security/**`
- reporte de implementacion

Se evita un PR por archivo y una correccion posterior de guards.

## Estado base

| Item | Resultado |
|---|---|
| Repo | `C:\PORTAL-VETNEB` |
| Rama base | `main` |
| HEAD base esperado | `ef78b6b test(architecture): move report write surface security test (#1342)` |
| Rama de trabajo | `test/security-boundary-anchored-batch` |
| Working tree inicial | Limpio |
| PRs abiertos esperados | 0 |
| Residuo remoto conocido | `origin/test/particular-authenticated-session-fixture`, no tocado |

## Fuente de verdad

- `docs/implementation/test-arch-24-non-fastify-http-api-test-inventory.md`
- `docs/implementation/test-arch-34-report-write-surface-security-batch.md`

## Archivos movidos

| Origen | Destino |
|---|---|
| `test/audit-export-boundaries.test.ts` | `test/security/audit-export-boundaries.test.ts` |
| `test/security-trusted-origin-cors-boundaries.test.ts` | `test/security/security-trusted-origin-cors-boundaries.test.ts` |

## Imports ajustados

Se ajustaron imports relativos mecanicos por nueva profundidad:

- `../server/...` -> `../../server/...`

No se cambiaron rutas source leidas desde `process.cwd()` como:

- `server/routes/...`
- `server/middlewares/...`
- `server/fastify-app.ts`

Motivo: esas rutas son relativas a la raiz del repo.

## Anchors actualizados

Se actualizaron referencias activas de paths movidos en:

- `test/**`
- `docs/security/**`

No se actualizaron documentos historicos ni reportes previos de implementacion salvo este reporte.

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
| `git diff --name-only` | OK, limitado al lote security boundary anchored y reporte. |
| `git status --short --untracked-files=all` | OK, solo cambios esperados antes de stage. |
| `& 'C:\Program Files\nodejs\pnpm.cmd' typecheck:test` | Pendiente |
| `& 'C:\Program Files\nodejs\pnpm.cmd' test` | Pendiente |
| `& 'C:\Program Files\nodejs\pnpm.cmd' build` | Pendiente |
| `& 'C:\Program Files\nodejs\pnpm.cmd' security:public-surface` | Pendiente |

## Recomendacion para siguiente lote

Mantener diferido por decision arquitectonica:

- `test/fastify-app.test.ts`

Tras este batch, revisar si queda algun root-level HTTP/API o security/boundary pendiente antes de cerrar el bloque TEST-ARCH.