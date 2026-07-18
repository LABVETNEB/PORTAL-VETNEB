# M02 · Limpieza de huérfanos Express-era

> **Programa:** [Backend Enterprise Modularization Program](../audit/backend-enterprise-modularization-program-audit.md)
> (`ARCH-AUDIT-110`) · **Fase 0 — Precondiciones** · **PR lógico M02** (adelantado desde el
> PR 40 del programa original).
> **Inventario rector:** [ARCH-3 / M01](../architecture/shared-lib-boundary-inventory.md)
> (decisión `REMOVE` de los huérfanos, §4/§6).
> **Base:** `main` · **HEAD:** `f001910877b3ef695fc44d8382b5a205d1a51f95`
> docs(architecture): refresh shared lib boundary inventory (#1496).
> **Rama de trabajo:** pendiente de creación por Nico (Git reservado).
> **Fecha:** 2026-07-18 · **Autorización de scope:** R2 explícita de Nico para M02.

## Objetivo

Eliminar los dos módulos **Express-era muertos** del backend y su único test, cerrando la
deuda de código muerto que ARCH-3/M01 marcó como `REMOVE`. La app corre sobre Fastify con
composición manual; estos módulos usan tipos y firmas de Express (`Request`/`Response`/
`NextFunction`) y **no tienen ningún consumidor de runtime**: los mantenía vivos únicamente su
propio test.

## Archivos eliminados

| Archivo | LOC | Por qué es huérfano |
|---|---:|---|
| `server/utils/async-handler.ts` | 10 | Wrapper `asyncHandler` de estilo Express (`(req,res,next)=>…`). Cero importadores de runtime en `server/`, `frontend/` y `scripts/`. |
| `server/middlewares/error-handler.ts` | 82 | `errorHandler`/`notFoundHandler` de estilo Express. **Duplicado muerto**: la app usa `app.setErrorHandler`/`app.setNotFoundHandler` de Fastify (`server/fastify-app.ts:368` y `:376`). Cero importadores de runtime. |
| `test/unit/infrastructure/error-and-async-middleware.test.ts` | 195 | Su **única** responsabilidad era ejercitar los dos módulos anteriores (6 casos). Al desaparecer el sujeto bajo prueba, el test se elimina en el mismo diff. |

Efecto colateral inevitable y benigno: el directorio `server/utils/` queda vacío tras eliminar
su único archivo y se remueve (git no versiona directorios vacíos).

## Demostración de que son huérfanos (evidencia HEAD `f001910`)

- **Cero importadores de runtime** [CONFIRMED]:
  `git grep -lnE "utils/async-handler|middlewares/error-handler" -- 'server/**' 'frontend/**'
  'scripts/**'` → vacío.
- **Único importador = el test eliminado** [CONFIRMED]:
  `git grep -nE "asyncHandler|notFoundHandler|errorHandler"` sólo aparece en
  `error-and-async-middleware.test.ts` (imports + usos) y en documentación/auditorías (prosa).
- **La app real reemplaza la lógica** [CONFIRMED]: `server/fastify-app.ts` define
  `setNotFoundHandler` (:368) y `setErrorHandler` (:376) con el envelope
  `{success:false,error,details?,path}` y el mapeo de códigos Postgres (`23505`,`23503`,
  `22P02`,`42703` → 400). El handler Express de `error-handler.ts` era una copia paralela
  muerta (coherente con `ENG-P3-007` de la auditoría de ingeniería y con `pr-821`).
- **`server/utils/` sólo contenía `async-handler.ts`** [CONFIRMED]: `git ls-files server/utils/`.
- **Sin referencias en config/build/test-runner** [CONFIRMED]: sin menciones en `tsconfig*`,
  `package.json`, `scripts/**` ni `*.mjs/*.mts` (el runner usa glob `test/**/*.test.ts`, sin
  listas hardcodeadas).

## Censos y guards de arquitectura: sin cambios necesarios

El scope autorizaba actualizar los censos/guards directamente afectados (incluido
`tracked-source-inventory`). **Ninguno requirió edición**, y se demostró por qué:

- **`test/architecture/tracked-source-inventory.test.ts`** es **dinámico**: enumera vía
  `listTrackedSourceFiles` (`git ls-files`) y sólo afirma que ciertos archivos conocidos
  (`server/fastify-app.ts`, el propio helper, …) están presentes y que los árboles auxiliares
  quedan excluidos. **No** hardcodea los paths eliminados ni un conteo total. El helper
  `test/helpers/tracked-source-files.ts` filtra por `existsSync`, de modo que un archivo
  borrado en el working tree se excluye automáticamente. Verde tras la eliminación.
- **`fastify-only-guardrail`** y **`audit-suite-completeness`** no referencian los huérfanos;
  el primero vela por que no se reintroduzca Express **runtime** — eliminar código Express
  muerto lo refuerza, no lo rompe.
- Ningún test hardcodea `async-handler`/`error-handler` ni un total de archivos/tests que los
  incluya (`git grep` sobre `test/**` y `scripts/**` → sólo el test eliminado).

> Nota de trazabilidad: el apéndice de ARCH-3/M01 lista el test eliminado dentro de su censo de
> 202 tests ancla (categoría *DB/schema/infrastructure*). Ese documento es **prosa descriptiva**
> (no un censo/guard ejecutable) y queda fuera del scope de M02; su cifra pasará de 202 a 201 en
> el próximo refresh del inventario. No se edita aquí para respetar el diff mínimo.

## Validación (estados canónicos de `AGENTS.md`)

Dirigida (fail-fast) y luego general:

| Gate | Comando | Estado | Evidencia |
|---|---|---|---|
| typecheck backend | `pnpm typecheck` | `PASSED` | exit 0 |
| typecheck tests | `pnpm typecheck:test` | `PASSED` | exit 0 |
| guards dirigidos | `node --test tracked-source-inventory + fastify-only-guardrail + audit-suite-completeness` | `PASSED` | tests 15 · pass 15 · fail 0 |
| suite completa + build | `pnpm validate:local` | `PASSED` | tests 3137 · pass 3136 · fail 0 · skip 1 (preexistente); build `dist/index.js` 838.3kb, Done; exit 0 |
| `git diff --check` | `git diff --check` | `PASSED` | exit 0 |
| `pnpm security:public-surface` | — | `NOT_RUN` | no se tocó superficie pública frontend |
| `pnpm db:migrate` / schema | — | `NOT_RUN` | sin cambios de DB/schema/migraciones |

Delta de tests: la suite baja exactamente **6** casos (los 6 del test eliminado); ningún otro
test se ve afectado.

## Confirmaciones de scope

- **Sólo** se eliminaron los 3 archivos autorizados; se agregó **este** documento de
  implementación.
- **No** se tocó auth, sesiones, cookies, CORS, CSP, rate limits, endpoints activos, DB,
  schema, migraciones, dependencias, lockfiles, frontend, CI/workflows ni producción.
- **No** se modificó `drizzle/**`, `package.json`, lockfiles ni ningún workflow.
- **No** se editaron guards/censos (no fue necesario; demostrado arriba).
- **No** `git add`, commit, push, creación de rama, PR ni merge — Git final reservado a Nico.
- **No** stashes, `.claude/worktrees` ni artefactos (`dist/` está gitignorado; no entra al diff).

## Riesgos residuales

- **Bajos.** Eliminación de código muerto sin consumidores de runtime; comportamiento
  observable idéntico (la app ya usaba los handlers Fastify).
- Rollback trivial e independiente: `git revert` del commit restaura los 3 archivos; no
  depende de ningún otro PR.

## Readiness para Fase A

Con M01 (inventario) y M02 (huérfanos) cerrados, la Fase 0 queda completa. Sigue **M02b**
(mover `sla-breach` + `time-window` a `features/logistics/domain/`), cada PR de código con
autorización R2 individual de Nico.
