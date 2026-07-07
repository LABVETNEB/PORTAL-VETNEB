# TEST-ARCH-33 - Security boundary root batch

## Resumen ejecutivo

TEST-ARCH-33 mueve en un unico PR eficiente dos tests security/boundary root-level identificados por TEST-ARCH-24.

Archivos movidos:

- `test/auth-password-change.test.ts`
- `test/security-csrf-mutating-route-coverage.test.ts`

Destino:

- `test/security/`

## Criterio de eficiencia

Este lote agrupa dos archivos compatibles para evitar micro-PRs y reducir ejecuciones CI.

No se incluyeron en este batch:

- `test/audit-export-boundaries.test.ts`
- `test/security-trusted-origin-cors-boundaries.test.ts`

Motivo: tienen anchors activos en guards/matrices de seguridad y requieren lote propio.

## Estado base

| Item | Resultado |
|---|---|
| Repo | `C:\PORTAL-VETNEB` |
| Rama base | `main` |
| HEAD base esperado | `4d170f0 test(architecture): move contact route api test (#1340)` |
| Rama de trabajo | `test/security-boundary-root-batch` |
| Working tree inicial | Limpio |
| PRs abiertos esperados | 0 |
| Residuo remoto conocido | `origin/test/particular-authenticated-session-fixture`, no tocado |

## Fuente de verdad

- `docs/implementation/test-arch-24-non-fastify-http-api-test-inventory.md`
- `docs/implementation/test-arch-32-contact-route-http-api.md`

## Archivos movidos

| Origen | Destino |
|---|---|
| `test/auth-password-change.test.ts` | `test/security/auth-password-change.test.ts` |
| `test/security-csrf-mutating-route-coverage.test.ts` | `test/security/security-csrf-mutating-route-coverage.test.ts` |

## Imports ajustados

Se ajustaron imports relativos mecanicos por nueva profundidad:

- `../server/...` -> `../../server/...`

No se cambiaron rutas source leidas desde `process.cwd()` como:

- `server/routes/...`
- `server/middlewares/...`
- `server/fastify-app.ts`

Motivo: esas rutas son relativas a la raiz del repo, no a `import.meta.url`.

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
| `git diff --name-only` | OK, limitado al lote security boundary root y reporte. |
| `git status --short --untracked-files=all` | OK, solo cambios esperados antes de stage. |
| `& 'C:\Program Files\nodejs\pnpm.cmd' typecheck:test` | Pendiente |
| `& 'C:\Program Files\nodejs\pnpm.cmd' test` | Pendiente |
| `& 'C:\Program Files\nodejs\pnpm.cmd' build` | Pendiente |
| `& 'C:\Program Files\nodejs\pnpm.cmd' security:public-surface` | Pendiente |

## Recomendacion para siguiente lote

Mantener diferidos hasta lote propio con anchors:

- `test/audit-export-boundaries.test.ts`
- `test/security-trusted-origin-cors-boundaries.test.ts`
- `test/report-write-surface-ownership.test.ts`

Mantener diferido por decision arquitectonica:

- `test/fastify-app.test.ts`