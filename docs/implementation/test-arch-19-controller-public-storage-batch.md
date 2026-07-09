# TEST-ARCH-19 - Controller public storage batch

## Resumen ejecutivo

TEST-ARCH-19 movio fisicamente un lote minimo de controller tests
public/storage clasificados como `MOVIBLE_SEGURO` por TEST-ARCH-16.

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
| Rama esperada | `test/controller-public-storage-batch` |
| Rama observada | `test/controller-public-storage-batch` |
| HEAD observado | `f9afaef test(architecture): move auth core controller tests (#1325)` |
| Working tree inicial | Limpio (`git status --short --untracked-files=all` sin salida). |
| PRs abiertos | Ninguno devuelto por el conector de GitHub para `LABVETNEB/PORTAL-VETNEB`. |
| Residuo remoto conocido | `origin/test/particular-authenticated-session-fixture`, observado con `git branch -r --no-merged origin/main`; no se toco. |

## Fuente de verdad usada

Fuente obligatoria:

- `docs/implementation/test-arch-16-controller-post-unlock-inventory.md`

Documentos normativos leidos:

- `docs/implementation/test-arch-17-controller-study-tracking-batch.md`
- `docs/implementation/test-arch-18-controller-auth-core-batch.md`
- `test/README.md`
- `docs/implementation/test-suite-enterprise-organization-convention.md`
- `docs/audit/test-suite-enterprise-architecture-audit.md`

TEST-ARCH-16 marco como `MOVIBLE_SEGURO` este lote:

- `test/clinic-public-profile.fastify.test.ts`
- `test/public-professionals.fastify.test.ts`

## Archivos movidos

| Origen | Destino |
|---|---|
| `test/clinic-public-profile.fastify.test.ts` | `test/integration/adapters/controllers/clinic-public-profile.fastify.test.ts` |
| `test/public-professionals.fastify.test.ts` | `test/integration/adapters/controllers/public-professionals.fastify.test.ts` |

## Imports ajustados

Se ajustaron solo imports relativos desde `../server/**` a
`../../../../server/**` en los 2 archivos movidos.

| Archivo | Imports ajustados |
|---|---|
| `test/integration/adapters/controllers/clinic-public-profile.fastify.test.ts` | `../../../../server/lib/env.ts`; `../../../../server/routes/clinic-public-profile.fastify.ts` |
| `test/integration/adapters/controllers/public-professionals.fastify.test.ts` | `../../../../server/routes/public-professionals.fastify.ts` |

No se cambiaron assertions funcionales ni logica de tests.

## Anchors/path references actualizados

Se actualizaron los anchors exactos necesarios:

| Archivo | Paths actualizados |
|---|---|
| `test/storage-suite-completeness.test.ts` | `test/clinic-public-profile.fastify.test.ts` -> `test/integration/adapters/controllers/clinic-public-profile.fastify.test.ts`; `test/public-professionals.fastify.test.ts` -> `test/integration/adapters/controllers/public-professionals.fastify.test.ts` |

Referencias legacy detectadas y no editadas por no ser anchors exactos necesarios
para este move:

- `test/public-professionals-source-boundaries.test.ts`
- `test/architecture/security/security-rate-limit-isolation-boundaries.test.ts`
- `test/architecture/security/security-validation-cutoff-boundaries.test.ts`
- Documentacion historica bajo `docs/**`

Los tres guards listados usan fallback recursivo por basename y TEST-ARCH-16 los
clasifico como subdirectory-aware.

## Archivos explicitamente excluidos

No se movio `public-report-access.fastify.test.ts`.

No se movio `particular-auth.fastify.test.ts`.

No se movieron tokens:

- `test/admin-particular-tokens.fastify.test.ts`
- `test/admin-report-access-tokens.fastify.test.ts`
- `test/particular-tokens.fastify.test.ts`
- `test/report-access-tokens.fastify.test.ts`

No se movio report-access fuera de los archivos explicitamente excluidos.

No se movieron archivos `BLOQUEADO_POR_ANCHOR`:

- `test/admin-reports.fastify.test.ts`
- `test/reports.fastify.test.ts`
- `test/reports-status.fastify.test.ts`

No se movieron tests no `*.fastify.test.ts`.

## Validaciones ejecutadas

| Comando | Resultado |
|---|---|
| `git diff --check` | OK, sin salida. |
| `git diff --stat` | OK. Muestra deletes legacy y cambios en 1 guard; los archivos nuevos quedan untracked hasta stage manual. |
| `git diff --name-only` | OK. Lista los 2 origenes legacy removidos y 1 guard modificado; los archivos nuevos quedan untracked hasta stage manual. |
| `git status --short --untracked-files=all` | OK. Muestra 2 deletes, 1 guard modificado, 2 destinos nuevos y este reporte nuevo. |
| `pnpm test` | Fallo antes del runner por shim no interactivo: `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`. |
| `& 'C:\Program Files\nodejs\pnpm.cmd' test` | OK: 2983 pass, 0 fail. |
| `pnpm build` | Fallo antes del build por shim no interactivo: `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`. |
| `& 'C:\Program Files\nodejs\pnpm.cmd' build` | OK: `dist\index.js 838.3kb`. |
| `pnpm security:public-surface` | Fallo antes del script por shim no interactivo: `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`. |
| `& 'C:\Program Files\nodejs\pnpm.cmd' security:public-surface` | PASS: no public devtools exposure findings; conserva findings `server-only` esperados en `frontend/src/proxy.ts` para `CLINIC_SESSION_COOKIE_NAME` y `ADMIN_SESSION_COOKIE_NAME`. |
| `& 'C:\Program Files\nodejs\pnpm.cmd' --dir frontend lint` | OK. |
| `& 'C:\Program Files\nodejs\pnpm.cmd' --dir frontend typecheck` | OK. |
| `& 'C:\Program Files\nodejs\pnpm.cmd' --dir frontend build` | OK: Next.js 16.2.7 compilo y genero 25 paginas estaticas. |

## Riesgo residual

Riesgo bajo. El runner descubre subdirectorios con `test/**/*.test.ts`, y los
imports relativos fueron ajustados a la profundidad nueva.

Quedan referencias legacy documentales o subdirectory-aware fuera del scope de
este lote. No deberian bloquear `pnpm test` y no se editaron para evitar churn no
necesario.

## Recomendacion para TEST-ARCH-20

Mantener lotes pequenos por dominio. Candidato recomendado: seleccionar otro
grupo `MOVIBLE_SEGURO` que no mezcle report-access, tokens, particular-auth ni el
subtrio reports bloqueado, o hacer primero una auditoria minima si el proximo
lote requiere tocar anchors adicionales.

No mover todavia:

- `test/admin-reports.fastify.test.ts`
- `test/reports.fastify.test.ts`
- `test/reports-status.fastify.test.ts`

Antes de mover reports, corregir o hacer path-aware
`test/report-study-types-catalog.test.ts`.

## Confirmacion de scope

Scope incluido:

- Move fisico de los 2 controller tests public/storage autorizados.
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
