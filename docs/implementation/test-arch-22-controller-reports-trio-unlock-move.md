# TEST-ARCH-22 - Controller reports trio unlock move

## Resumen ejecutivo

TEST-ARCH-22 desbloqueo y movio fisicamente el trio reports controller que
TEST-ARCH-16 habia clasificado como `BLOQUEADO_POR_ANCHOR`.

El cambio fue mecanico y limitado:

- move de 3 `*.fastify.test.ts` a `test/integration/adapters/controllers/`
- ajuste de imports relativos `../server/**` -> `../../../../server/**`
- actualizacion path-only del catalogo bloqueante
- actualizacion path-only de anchors exactos en guards de reports, storage y critical route
- sin cambios de runtime, producto, backend productivo, DB, schema, migraciones, CI, dependencias, `package.json` ni `pnpm-lock.yaml`

## Estado base

| Item | Resultado |
|---|---|
| Repo | `C:\PORTAL-VETNEB` |
| Entorno | Windows, PowerShell, PNPM |
| Rama esperada | `test/controller-reports-trio-unlock-move` |
| Rama observada | `test/controller-reports-trio-unlock-move` |
| HEAD observado | `66e2d7c test(architecture): move remaining safe controller tests (#1328)` |
| Working tree inicial | Limpio (`git status --short --untracked-files=all` sin salida). |
| `git diff --stat` inicial | Sin salida. |

## Fuente de verdad usada

Fuente obligatoria:

- `docs/implementation/test-arch-16-controller-post-unlock-inventory.md`

Lectura aplicada:

- Los 3 archivos estaban bloqueados por `test/report-study-types-catalog.test.ts`.
- El catalogo tenia paths hardcodeados y `assert.deepEqual`.
- Los imports de los 3 tests eran relativos simples a `../server/**`.
- El destino enterprise es `test/integration/adapters/controllers/`.

## Scope incluido

Se movieron unicamente:

| Origen | Destino |
|---|---|
| `test/admin-reports.fastify.test.ts` | `test/integration/adapters/controllers/admin-reports.fastify.test.ts` |
| `test/reports.fastify.test.ts` | `test/integration/adapters/controllers/reports.fastify.test.ts` |
| `test/reports-status.fastify.test.ts` | `test/integration/adapters/controllers/reports-status.fastify.test.ts` |

## Scope excluido

No se movio ningun otro test.

No se tocaron:

- runtime
- producto
- backend productivo
- DB
- schema
- migraciones
- CI/workflows
- dependencias
- `package.json`
- `pnpm-lock.yaml`
- auth estructural
- cookies
- CORS
- CSP
- rate limits

No se usaron stashes, `.claude/worktrees`, `rg`, `git add`, `git commit`, `git push`, PR ni merge.

## Auditoria previa

Comandos de base ejecutados desde Terminal 1:

```powershell
git status --short --untracked-files=all
git branch --show-current
git log -1 --oneline
git diff --stat
```

Verificaciones:

- La rama activa coincidia con la esperada.
- La base estaba limpia.
- El destino `test/integration/adapters/controllers/` existia.
- Los 3 archivos legacy existian antes del move.
- `docs/implementation/test-arch-16-controller-post-unlock-inventory.md` existia y confirmaba el bloqueo.
- `package.json` exponia los scripts requeridos: `test`, `build` y `security:public-surface`.

Se buscaron referencias legacy con PowerShell `Select-String`, sin `rg`.

## Cambios realizados

### Moves

Se movieron los 3 controller tests al destino enterprise.

### Imports

En los 3 archivos movidos se ajustaron solo imports relativos:

- `../server/lib/env.ts` -> `../../../../server/lib/env.ts`
- `../server/routes/admin-reports.fastify.ts` -> `../../../../server/routes/admin-reports.fastify.ts`
- `../server/routes/reports.fastify.ts` -> `../../../../server/routes/reports.fastify.ts`
- `../server/routes/reports-status.fastify.ts` -> `../../../../server/routes/reports-status.fastify.ts`

### Catalogo bloqueante

Se actualizo `test/report-study-types-catalog.test.ts` para que el filtro y el
`assert.deepEqual` esperen los nuevos paths.

Durante la primera validacion, `pnpm test` fallo solo por el orden esperado del
`assert.deepEqual` despues del cambio de profundidad. Se corrigio el orden para
coincidir con el sort real de `listSourceFiles("test").filter(...).sort()`.

### Anchors exactos

Se actualizaron paths exactos en:

- `test/reports-suite-completeness.test.ts`
- `test/storage-suite-completeness.test.ts`
- `test/architecture/security/security-critical-route-surface-registry.test.ts`

No se editaron guards secundarios que ya resuelven por basename/path-aware y no
fallaron en validacion.

## Archivos modificados

- `docs/implementation/test-arch-22-controller-reports-trio-unlock-move.md`
- `test/integration/adapters/controllers/admin-reports.fastify.test.ts`
- `test/integration/adapters/controllers/reports.fastify.test.ts`
- `test/integration/adapters/controllers/reports-status.fastify.test.ts`
- `test/report-study-types-catalog.test.ts`
- `test/reports-suite-completeness.test.ts`
- `test/storage-suite-completeness.test.ts`
- `test/architecture/security/security-critical-route-surface-registry.test.ts`

## Validaciones

| Comando | Resultado |
|---|---|
| `& 'C:\Program Files\nodejs\pnpm.cmd' test` | Primer intento fallo por orden esperado del catalogo; segundo intento OK: 2983 pass, 0 fail. |
| `& 'C:\Program Files\nodejs\pnpm.cmd' build` | OK: `dist\index.js 838.3kb`. |
| `& 'C:\Program Files\nodejs\pnpm.cmd' security:public-surface` | PASS: no public devtools exposure findings; conserva findings `server-only` esperados en `frontend/src/proxy.ts` para `CLINIC_SESSION_COOKIE_NAME` y `ADMIN_SESSION_COOKIE_NAME`. |

Validaciones finales de diff/status quedan registradas al cierre de la tarea:

```powershell
git diff --check
git diff --stat
git diff --name-only
git status --short --untracked-files=all
```

## Resultado

El trio reports controller quedo desbloqueado y movido al destino enterprise.
El catalogo bloqueante ahora espera los nuevos paths y mantiene cobertura sobre
los mismos archivos criticos.

## Riesgo residual

Riesgo bajo. El cambio no toca runtime ni assertions funcionales. El riesgo
principal era el orden del catalogo por paths mas profundos; quedo cubierto por
`pnpm test`.

## Estado final

Pendiente solo stage/commit/push/PR manual por Nico.
