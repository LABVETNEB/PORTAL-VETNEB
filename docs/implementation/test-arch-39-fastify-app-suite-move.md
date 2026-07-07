# TEST-ARCH-39 - Fastify app suite move

## Resumen ejecutivo

TEST-ARCH-39 mueve la suite app-level `fastify-app.test.ts` fuera del root de `test/`.

Origen:

- `test/fastify-app.test.ts`

Destino:

- `test/integration/app/fastify-app.test.ts`

Este PR no divide la suite ni cambia comportamiento.
El objetivo es cerrar la deuda fisica del ultimo root-level test con `app.inject()`.

## Contexto

TEST-ARCH-38 extrajo previamente snapshots y route stubs a:

- `test/helpers/fastify-app-route-stubs.ts`

Despues de esa extraccion, `fastify-app.test.ts` quedo como suite app-level mas limpia y apta para moverse fisicamente sin duplicar stubs.

## Cambios realizados

| Archivo | Cambio |
|---|---|
| `test/integration/app/fastify-app.test.ts` | Nueva ubicacion app-level de la suite. |
| `test/fastify-app.test.ts` | Removido por move. |
| `docs/implementation/test-arch-39-fastify-app-suite-move.md` | Reporte de implementacion. |

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
| `git diff --name-only` | OK, limitado al move de fastify-app suite y reporte. |
| `git status --short --untracked-files=all` | OK, solo cambios esperados antes de stage. |
| `& 'C:\Program Files\nodejs\pnpm.cmd' typecheck:test` | Pendiente |
| `& 'C:\Program Files\nodejs\pnpm.cmd' exec node --test test/integration/app/fastify-app.test.ts` | Pendiente |
| `& 'C:\Program Files\nodejs\pnpm.cmd' test` | Pendiente |
| `& 'C:\Program Files\nodejs\pnpm.cmd' build` | Pendiente |
| `& 'C:\Program Files\nodejs\pnpm.cmd' security:public-surface` | Pendiente |

## Resultado esperado

Despues del move:

- no quedan archivos root-level `test/*.test.ts` con `.inject(`
- `fastify-app.test.ts` queda clasificado como integration/app
- el bloque non-fastify/app-inject root queda cerrado operativamente