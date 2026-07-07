# TEST-ARCH-17 - Controller study tracking batch

## Resumen ejecutivo

TEST-ARCH-17 movio fisicamente el lote study-tracking de controller tests legacy
confirmado como `MOVIBLE_SEGURO` por TEST-ARCH-16.

El cambio fue mecanico y limitado a 3 tests `*.fastify.test.ts`, sus imports
relativos minimos y los anchors exactos necesarios para que los guards sigan
resolviendo los archivos reales.

No se toco runtime, producto, backend productivo, DB, schema, migraciones, CI,
dependencias, `package.json` ni `pnpm-lock.yaml`.

## Base verificada

| Item | Resultado |
|---|---|
| Repo | `C:\PORTAL-VETNEB` |
| Entorno | Windows, PowerShell, PNPM |
| Rama esperada | `test/controller-study-tracking-batch` |
| Rama observada | `test/controller-study-tracking-batch` |
| HEAD observado | `17ab38b docs(test): inventory controller post unlock candidates (#1323)` |
| Working tree inicial | Limpio (`git status --short --untracked-files=all` sin salida). |
| PRs abiertos | Ninguno (`gh pr list --state open` sin salida). |
| Residuo remoto conocido | `origin/test/particular-authenticated-session-fixture`, observado con `git branch -r --no-merged origin/main`; no se toco. |

## Fuente de verdad usada

Fuente obligatoria:

- `docs/implementation/test-arch-16-controller-post-unlock-inventory.md`

Documentos normativos leidos:

- `test/README.md`
- `docs/implementation/test-suite-enterprise-organization-convention.md`
- `docs/audit/test-suite-enterprise-architecture-audit.md`

TEST-ARCH-16 marco como `MOVIBLE_SEGURO` este lote:

- `test/admin-study-tracking.fastify.test.ts`
- `test/particular-study-tracking.fastify.test.ts`
- `test/study-tracking.fastify.test.ts`

## Archivos movidos

| Origen | Destino |
|---|---|
| `test/admin-study-tracking.fastify.test.ts` | `test/integration/adapters/controllers/admin-study-tracking.fastify.test.ts` |
| `test/particular-study-tracking.fastify.test.ts` | `test/integration/adapters/controllers/particular-study-tracking.fastify.test.ts` |
| `test/study-tracking.fastify.test.ts` | `test/integration/adapters/controllers/study-tracking.fastify.test.ts` |

## Imports ajustados

Se ajustaron solo imports relativos desde `../server/**` a
`../../../../server/**` en los 3 archivos movidos.

| Archivo | Imports ajustados |
|---|---|
| `test/integration/adapters/controllers/admin-study-tracking.fastify.test.ts` | `../../../../server/lib/env.ts`; `../../../../server/routes/admin-study-tracking.fastify.ts` |
| `test/integration/adapters/controllers/particular-study-tracking.fastify.test.ts` | `../../../../server/lib/env.ts`; `../../../../server/routes/particular-study-tracking.fastify.ts` |
| `test/integration/adapters/controllers/study-tracking.fastify.test.ts` | `../../../../server/lib/env.ts`; `../../../../server/routes/study-tracking.fastify.ts`; `../../../../server/lib/study-tracking.ts` |

No se cambiaron assertions funcionales ni logica de tests.

## Anchors/path references actualizados

Se actualizaron los anchors exactos necesarios:

| Archivo | Paths actualizados |
|---|---|
| `test/study-tracking-suite-completeness.test.ts` | `test/study-tracking.fastify.test.ts` -> `test/integration/adapters/controllers/study-tracking.fastify.test.ts`; `test/admin-study-tracking.fastify.test.ts` -> `test/integration/adapters/controllers/admin-study-tracking.fastify.test.ts`; `test/particular-study-tracking.fastify.test.ts` -> `test/integration/adapters/controllers/particular-study-tracking.fastify.test.ts` |
| `test/security-critical-route-surface-registry.test.ts` | `test/admin-study-tracking.fastify.test.ts` -> `test/integration/adapters/controllers/admin-study-tracking.fastify.test.ts` |

Referencias legacy detectadas y no editadas por no ser anchors exactos necesarios
para este move:

- `test/security-access-lifecycle-boundaries.test.ts`
- `test/security-resource-ownership-boundaries.test.ts`
- `test/security-response-disclosure-boundaries.test.ts`
- `test/security-write-attribution-boundaries.test.ts`
- `test/security-cross-tenant-idor-contract.test.ts`

Los cuatro primeros usan fallback recursivo por basename. El ultimo mantiene
evidencia documental y TEST-ARCH-16 lo clasifico como `solo dato`.

## Archivos explicitamente excluidos

No se movieron archivos `BLOQUEADO_POR_ANCHOR`:

- `test/admin-reports.fastify.test.ts`
- `test/reports.fastify.test.ts`
- `test/reports-status.fastify.test.ts`

No se movieron otros `MOVIBLE_SEGURO` del backlog:

- `test/auth.fastify.test.ts`
- `test/admin-auth.fastify.test.ts`
- `test/admin-particular-tokens.fastify.test.ts`
- `test/admin-report-access-tokens.fastify.test.ts`
- `test/clinic-public-profile.fastify.test.ts`
- `test/particular-auth.fastify.test.ts`
- `test/particular-tokens.fastify.test.ts`
- `test/public-professionals.fastify.test.ts`
- `test/public-report-access.fastify.test.ts`
- `test/report-access-tokens.fastify.test.ts`

No se movieron tests no `*.fastify.test.ts`.

## Validaciones ejecutadas

| Comando | Resultado |
|---|---|
| `git diff --check` | OK, sin salida. |
| `git diff --stat` | OK. Muestra deletes legacy y cambios en 2 guards; los archivos nuevos quedan untracked hasta stage manual. |
| `git diff --name-only` | OK. Lista los 3 origenes legacy removidos y 2 guards modificados; los archivos nuevos quedan untracked hasta stage manual. |
| `git status --short --untracked-files=all` | OK. Muestra 3 deletes, 2 guards modificados, 3 destinos nuevos y este reporte nuevo. |
| `pnpm test` | Fallo antes del runner por shim no interactivo: `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`. |
| `& 'C:\Program Files\nodejs\pnpm.cmd' test` | OK: 2983 pass, 0 fail. |
| `pnpm build` | Fallo antes del build por shim no interactivo: `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`. |
| `& 'C:\Program Files\nodejs\pnpm.cmd' build` | OK: `dist\index.js 838.3kb`. |
| `pnpm security:public-surface` | Fallo antes del script por shim no interactivo: `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`. |
| `& 'C:\Program Files\nodejs\pnpm.cmd' security:public-surface` | PASS: no public devtools exposure findings; conserva findings `server-only` esperados en `frontend/src/proxy.ts` para `CLINIC_SESSION_COOKIE_NAME` y `ADMIN_SESSION_COOKIE_NAME`. |
| `& 'C:\Program Files\nodejs\pnpm.cmd' --dir frontend lint` | OK. |
| `& 'C:\Program Files\nodejs\pnpm.cmd' --dir frontend typecheck` | OK. |
| `& 'C:\Program Files\nodejs\pnpm.cmd' --dir frontend build` | OK: Next.js 16.2.7 compilo y genero 25 paginas estaticas. |

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

## Recomendacion para TEST-ARCH-18

Mantener lotes pequenos por dominio. Candidato recomendado: seleccionar un grupo
MOVIBLE_SEGURO distinto del subtrio reports y actualizar solo los registries
exactos que TEST-ARCH-16 identifica para ese grupo.

No mover todavia:

- `test/admin-reports.fastify.test.ts`
- `test/reports.fastify.test.ts`
- `test/reports-status.fastify.test.ts`

Antes de mover reports, corregir o hacer path-aware
`test/report-study-types-catalog.test.ts`.

## Confirmacion de scope

Scope incluido:

- Move fisico de los 3 controller tests study-tracking autorizados.
- Ajuste mecanico de imports relativos en los 3 archivos movidos.
- Actualizacion de anchors exactos necesarios.
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
