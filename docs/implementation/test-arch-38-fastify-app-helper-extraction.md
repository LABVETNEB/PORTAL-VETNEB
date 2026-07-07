# TEST-ARCH-38 - Fastify app helper extraction

## Resumen ejecutivo

TEST-ARCH-38 realiza una extraccion estructural controlada del monolito app-level `test/fastify-app.test.ts`.

No divide los tests todavia.
No mueve `fastify-app.test.ts` todavia.

Extrae helpers, snapshots y route stubs a:

- `test/helpers/fastify-app-route-stubs.ts`

El objetivo es reducir acoplamiento fisico y preparar un split futuro por buckets sin cambiar comportamiento.

## Contexto

Auditoria local TEST-ARCH-37B:

| Metrica | Resultado |
|---|---:|
| Archivo | `test/fastify-app.test.ts` |
| Lineas | 3078 |
| Tests | 26 |
| `.inject()` | 49 |
| Route stub builders | 26 |
| Imports `../server/` | 3 |

Buckets detectados por titulo:

| Bucket | Tests |
|---|---:|
| admin-dispatch | 8 |
| app-global-security-errors | 4 |
| clinic-dispatch | 3 |
| clinic-reporting-dispatch | 2 |
| health-readiness-system | 2 |
| public-dispatch | 2 |
| particular-dispatch | 1 |
| uncategorized | 4 |

## Decision tecnica

Se elige extraccion de helpers antes de mover o dividir el monolito.

Motivo:

- `fastify-app.test.ts` es app-level, no controller-level.
- Mezcla dispatch global, health, errores, CORS, request-id, headers, admin, clinic, particular, public, reports y logistics.
- Dividirlo sin extraer builders primero duplicaria stubs o aumentaria riesgo.
- Moverlo entero solo cambiaria ubicacion fisica sin reducir deuda.

## Cambios realizados

| Archivo | Cambio |
|---|---|
| `test/fastify-app.test.ts` | Mantiene los 26 tests y consume helpers via `fastifyAppHelpers`. |
| `test/helpers/fastify-app-route-stubs.ts` | Nuevo helper con snapshots y route stubs exportados. |

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
| `git diff --name-only` | OK, limitado a fastify-app helper extraction y reporte. |
| `git status --short --untracked-files=all` | OK, solo cambios esperados antes de stage. |
| `& 'C:\Program Files\nodejs\pnpm.cmd' typecheck:test` | Pendiente |
| `& 'C:\Program Files\nodejs\pnpm.cmd' test` | Pendiente |
| `& 'C:\Program Files\nodejs\pnpm.cmd' build` | Pendiente |
| `& 'C:\Program Files\nodejs\pnpm.cmd' security:public-surface` | Pendiente |

## Recomendacion posterior

Despues de esta extraccion, evaluar split futuro por buckets:

- app-global-security-errors
- health-readiness-system
- admin-dispatch
- clinic/public/particular dispatch
- reports/study-tracking/logistics dispatch