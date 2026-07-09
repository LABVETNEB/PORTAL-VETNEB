# TEST-ARCH-20 - Controller admin tokens batch

## Resumen ejecutivo

TEST-ARCH-20 movio fisicamente un lote minimo de controller tests admin/tokens
clasificados como `MOVIBLE_SEGURO` por TEST-ARCH-16.

El cambio fue mecanico y limitado a 2 tests `*.fastify.test.ts`, sus imports
relativos minimos y los anchors/path references necesarios para que los guards
sigan resolviendo los archivos reales.

No se toco runtime, producto, backend productivo, DB, schema, migraciones, CI,
dependencias, `package.json` ni `pnpm-lock.yaml`.

## Base verificada

| Item | Resultado |
|---|---|
| Repo | `C:\PORTAL-VETNEB` |
| Entorno | Windows, PowerShell, PNPM |
| Rama esperada | `test/controller-admin-tokens-batch` |
| Rama observada | `test/controller-admin-tokens-batch` |
| HEAD observado | `778c6e8 test(architecture): move public storage controller tests (#1326)` |
| Working tree inicial | Limpio (`git status --short` sin salida). |
| PRs abiertos | Ninguno devuelto por el conector de GitHub para `LABVETNEB/PORTAL-VETNEB`. |
| Residuo remoto conocido | `origin/test/particular-authenticated-session-fixture`, observado con `git branch -r --no-merged origin/main`; no se toco. |

## Fuente de verdad usada

Fuente obligatoria:

- `docs/implementation/test-arch-16-controller-post-unlock-inventory.md`

Documentos normativos leidos:

- `docs/implementation/test-arch-17-controller-study-tracking-batch.md`
- `docs/implementation/test-arch-18-controller-auth-core-batch.md`
- `docs/implementation/test-arch-19-controller-public-storage-batch.md`
- `test/README.md`
- `docs/implementation/test-suite-enterprise-organization-convention.md`
- `docs/audit/test-suite-enterprise-architecture-audit.md`

TEST-ARCH-16 marco como `MOVIBLE_SEGURO` este lote:

- `test/admin-particular-tokens.fastify.test.ts`
- `test/admin-report-access-tokens.fastify.test.ts`

## Archivos movidos

| Origen | Destino |
|---|---|
| `test/admin-particular-tokens.fastify.test.ts` | `test/integration/adapters/controllers/admin-particular-tokens.fastify.test.ts` |
| `test/admin-report-access-tokens.fastify.test.ts` | `test/integration/adapters/controllers/admin-report-access-tokens.fastify.test.ts` |

## Imports ajustados

Se ajustaron solo imports relativos desde `../server/**` a
`../../../../server/**` en los 2 archivos movidos.

| Archivo | Imports ajustados |
|---|---|
| `test/integration/adapters/controllers/admin-particular-tokens.fastify.test.ts` | `../../../../server/lib/env.ts`; `../../../../server/routes/admin-particular-tokens.fastify.ts` |
| `test/integration/adapters/controllers/admin-report-access-tokens.fastify.test.ts` | `../../../../server/lib/audit.ts`; `../../../../server/lib/env.ts`; `../../../../server/lib/report-access-token-rate-limit.ts`; `../../../../server/routes/admin-report-access-tokens.fastify.ts` |

No se cambiaron assertions funcionales ni logica de tests.

## Anchors/path references actualizados

Se actualizaron los anchors exactos necesarios:

| Archivo | Paths actualizados |
|---|---|
| `test/reports-suite-completeness.test.ts` | `test/admin-report-access-tokens.fastify.test.ts` -> `test/integration/adapters/controllers/admin-report-access-tokens.fastify.test.ts`; `test/admin-particular-tokens.fastify.test.ts` -> `test/integration/adapters/controllers/admin-particular-tokens.fastify.test.ts` |
| `test/security-critical-route-surface-registry.test.ts` | `test/admin-particular-tokens.fastify.test.ts` -> `test/integration/adapters/controllers/admin-particular-tokens.fastify.test.ts`; `test/admin-report-access-tokens.fastify.test.ts` -> `test/integration/adapters/controllers/admin-report-access-tokens.fastify.test.ts` |

Referencias legacy detectadas y no editadas por no ser anchors exactos necesarios
para este move:

- `test/architecture/security/security-access-lifecycle-boundaries.test.ts`
- `test/security-rate-limit-isolation-boundaries.test.ts`
- `test/architecture/security/security-write-attribution-boundaries.test.ts`
- Documentacion historica bajo `docs/**`

Los tres guards listados usan fallback recursivo por basename
`resolveExistingSourcePath`, y TEST-ARCH-16 los clasifico como subdirectory-aware.

## Archivos explicitamente excluidos

No se movio `particular-auth.fastify.test.ts`.

No se movieron otros tokens:

- `test/particular-tokens.fastify.test.ts`
- `test/report-access-tokens.fastify.test.ts`

No se movieron public/report-access:

- `test/public-report-access.fastify.test.ts`

No se movieron archivos `BLOQUEADO_POR_ANCHOR`:

- `test/admin-reports.fastify.test.ts`
- `test/reports.fastify.test.ts`
- `test/reports-status.fastify.test.ts`

No se movieron tests no `*.fastify.test.ts`.

## Validaciones ejecutadas

| Comando | Resultado |
|---|---|
| `git diff --check` | OK, sin salida. |
| `git diff --stat` | OK. Muestra deletes legacy y cambios en 2 guards; los archivos nuevos quedan untracked hasta stage manual. |
| `git diff --name-only` | OK. Lista los 2 origenes legacy removidos y 2 guards modificados; los archivos nuevos quedan untracked hasta stage manual. |
| `git status --short --untracked-files=all` | OK. Muestra 2 deletes, 2 guards modificados, 2 destinos nuevos y este reporte nuevo. |
| `pnpm test` | Fallo antes del runner por shim no interactivo: `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`. |
| `& 'C:\Program Files\nodejs\pnpm.cmd' test` | OK: 2983 pass, 0 fail. |
| `pnpm build` | Fallo antes del build por shim no interactivo: `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`. |
| `& 'C:\Program Files\nodejs\pnpm.cmd' build` | OK: `dist\index.js 838.3kb`. |
| `pnpm security:public-surface` | Fallo antes del script por shim no interactivo: `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`. |
| `& 'C:\Program Files\nodejs\pnpm.cmd' security:public-surface` | PASS: no public devtools exposure findings; conserva findings `server-only` esperados en `frontend/src/proxy.ts` para `CLINIC_SESSION_COOKIE_NAME` y `ADMIN_SESSION_COOKIE_NAME`. |

Si `pnpm` falla por shim no interactivo antes del runner, se debe reintentar con:

```powershell
& 'C:\Program Files\nodejs\pnpm.cmd' test
& 'C:\Program Files\nodejs\pnpm.cmd' build
& 'C:\Program Files\nodejs\pnpm.cmd' security:public-surface
```

## Riesgo residual

Riesgo bajo. El runner descubre subdirectorios con `test/**/*.test.ts`, y los
imports relativos fueron ajustados a la profundidad nueva.

Quedan referencias legacy documentales o subdirectory-aware fuera del scope de
este lote. No bloquean `pnpm test` y no se editaron para evitar churn no
necesario.

## Recomendacion para TEST-ARCH-21

Mantener lotes pequenos por dominio y no mezclar particular-auth, tokens
particular/clinic, public-report-access ni el subtrio reports bloqueado en un
mismo PR.

No mover todavia:

- `test/admin-reports.fastify.test.ts`
- `test/reports.fastify.test.ts`
- `test/reports-status.fastify.test.ts`

Antes de mover reports, corregir o hacer path-aware
`test/report-study-types-catalog.test.ts`.

## Confirmacion de scope

Scope incluido:

- Move fisico de los 2 controller tests admin/tokens autorizados.
- Ajuste mecanico de imports relativos en los 2 archivos movidos.
- Actualizacion de anchors/path references autorizados.
- Reporte Markdown obligatorio en `docs/implementation/`.

Scope excluido y respetado:

- No runtime.
- No producto.
- No backend productivo.
- No DB/schema/migrations.
- No CI/workflows.
- No dependencias.
- No `package.json`.
- No `pnpm-lock.yaml`.
- No stashes.
- No `.claude/worktrees`.
- No `rg`.
- No `git add`, `git commit`, `git push`, `gh pr create` ni `gh pr merge`.
