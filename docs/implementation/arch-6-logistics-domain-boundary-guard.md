# ARCH-6 — Logistics domain boundary guardrail

> **Tipo:** Test-only. No implementa runtime, no cambia API/DB/schema, no toca
> deps/lockfiles/CI. Un único archivo nuevo bajo `test/` y este doc bajo
> `docs/implementation/`.
> **Base:** `main` · **HEAD:** `fe8a586` refactor(logistics): extract field
> visit id normalization (#1301).
> **Rama:** `test/logistics-domain-boundary-arch6`.
> **Documentos rectores:**
> [`docs/architecture/backend-boundary-adr.md`](../architecture/backend-boundary-adr.md)
> (ARCH-2) ·
> [`docs/architecture/shared-lib-boundary-inventory.md`](../architecture/shared-lib-boundary-inventory.md)
> (ARCH-3).
> **Modelo / esfuerzo:** Claude Sonnet 5 · medium-high.
> **ID:** ARCH-6.

## Objetivo

Proteger con un test automatizado la regla de dependencia de la capa **domain**
del contexto Logistics (`server/features/logistics/domain/`) fijada por el ADR
ARCH-2: domain es lógica pura, sin framework, sin persistencia y sin I/O. Hasta
este PR la regla sólo vivía documentada en
[`server/features/logistics/domain/README.md`](../../server/features/logistics/domain/README.md);
no había ningún guardrail de código que la hiciera fallar ante una regresión.

## Alcance

- **Test-only.** No se modifica ningún archivo de runtime.
- No se tocan API, DB, schema, migraciones, auth ni middlewares.
- No se agregan dependencias, no se toca `package.json` ni lockfiles.
- No se toca CI (workflows).
- Sin stashes, sin `.claude/worktrees`.
- Se verificó que no existía un guardrail equivalente antes de crear uno nuevo
  (`test/fastify-only-guardrail.test.ts` cubre Express-vs-Fastify a nivel de
  todo `server/`; los guardrails `test/security-*-boundaries.test.ts` cubren
  fronteras de seguridad; ninguno inspecciona la pureza de
  `server/features/logistics/domain/`).

## Archivo agregado

[`test/logistics-domain-boundary-guard.test.ts`](../../test/logistics-domain-boundary-guard.test.ts)
(nuevo, sin snapshots frágiles). Reutiliza el estilo de
[`test/fastify-only-guardrail.test.ts`](../../test/fastify-only-guardrail.test.ts):
recorre archivos `.ts` con `node:fs`, extrae especificadores de import con una
regex sobre `from "..."` / `require("...")` / `import("...")`, y falla si
encuentra un patrón prohibido.

Contiene 3 tests:

1. **Existencia:** `server/features/logistics/domain` existe y contiene al
   menos un archivo `.ts` (evita que el guardrail quede protegiendo una carpeta
   vacía sin que nadie lo note).
2. **Blacklist explícita del brief:** ningún archivo del dominio importa (por
   especificador o por patrón en el código fuente):
   - `server/db` / `db-*` / `database*` (persistencia).
   - `lib/env` (config de entorno).
   - rutas hacia `infrastructure/` o `routes/` del propio contexto.
   - `fastify`.
   - `process` / `node:process`, o acceso directo a `process.*` en el código.
   - clientes `supabase`.
   - módulos node de I/O: `fs`, `http`, `https` (con o sin prefijo `node:`).
   - IO de red explícito (`fetch(`).
3. **Whitelist derivada del ADR:** cada import de domain es o bien relativo
   interno (`./...`, `../...`) o bien tipos del shared kernel
   (`drizzle/schema`) — espejo exacto de la fila `domain` de la tabla de
   dependencias del ADR ARCH-2 ("Puede importar: shared kernel sólo tipos, y
   otras utilidades puras de su propio contexto").

## Regla protegida

Tabla de dependencias, fila `domain`, de
[`docs/architecture/backend-boundary-adr.md`](../architecture/backend-boundary-adr.md#dependency-rules):

| Layer | Puede importar | No puede importar |
| --- | --- | --- |
| **domain** | shared kernel (sólo tipos), utilidades puras del propio contexto | Fastify, Drizzle runtime, `env`, `http`, auth middleware, React/Next, `db-*` |

## Validaciones

Auto-validación de la regex antes de confiar en el guardrail: se ejecutó un
script descartable (`scratchpad/domain-guard-selftest.mjs`, fuera del repo) que
alimentó las reglas de la blacklist con especificadores conocidos-malos
(`../../../db-logistics`, `fastify`, `node:process`, `@supabase/supabase-js`,
`node:fs`, etc.) y conocidos-buenos (`./route-plan-field-visits`,
`drizzle/schema`) para confirmar cero falsos negativos y cero falsos positivos
antes de correr la suite completa.

## Comandos ejecutados y resultados

```
node --experimental-strip-types --experimental-specifier-resolution=node --test test/logistics-domain-boundary-guard.test.ts
  -> 3 tests, 3 pass, 0 fail

pnpm test
  -> 2973 tests, 2973 pass, 0 fail

pnpm build
  -> esbuild server/index.ts ... dist/index.js  838.0kb — Done in 63ms

git diff --check
  -> sin salida (exit 0), sin conflictos ni whitespace issues

git status --short --untracked-files=all
  -> ?? test/logistics-domain-boundary-guard.test.ts   (único cambio)
```

## Riesgos residuales

- **Bajo.** El guardrail sólo agrega un test; no cambia comportamiento en
  runtime. El único archivo real del dominio hoy
  (`route-plan-field-visits.ts`) no tiene imports, por lo que el test pasa
  trivialmente contra el estado actual — su valor es prevenir regresiones
  futuras cuando ARCH-7+ mueva más helpers a `domain/`.
- La whitelist (test 3) es más estricta que el blacklist explícito del brief:
  bloquea cualquier import no-relativo que no sea `drizzle/schema`, incluyendo
  librerías npm puras hipotéticas. Se decidió así porque refleja literalmente
  la tabla de dependencias del ADR ARCH-2 ("Puede importar: shared kernel sólo
  tipos, y otras utilidades puras de su propio contexto"), no porque el brief
  lo pidiera explícitamente. Si un futuro PR necesita una librería pura de
  terceros en domain, este test fallará a propósito y deberá ajustarse en el
  mismo PR que introduzca esa dependencia.

## Confirmaciones

- No se agregaron dependencias ni se tocó `package.json`/lockfiles.
- No se tocó CI (workflows).
- No se tocó DB/schema/migraciones.
- No se tocó auth ni API pública.
- No hubo cambios de runtime behavior (0 archivos fuera de `test/` y
  `docs/implementation/` modificados).
- No se usaron stashes ni `.claude/worktrees`.
- El ZIP/carpeta de skills fue usado sólo como modo de trabajo (observación);
  no fue copiado, descomprimido, editado, ejecutado ni agregado al repo.
- No se hizo `git add`/`commit`/`push`, ni PR, ni merge.
