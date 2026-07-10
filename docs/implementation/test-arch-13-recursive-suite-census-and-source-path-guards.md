# TEST-ARCH-13 — Recursive suite census and source path guards

## Estado base

- Entorno: Windows 11, PowerShell, PNPM (`pnpm@10.8.1`).
- Herramienta: Claude · Modelo: Claude Opus 4.8 (`claude-opus-4-8`) · Effort: xhigh.
- Rama esperada y creada: `test/architecture-recursive-suite-census` (desde `main`).
- Base: `62e1302 docs(test): document blocked controller bulk migration (#1319)`
  (TEST-ARCH-12 mergeado). Working tree inicial limpio.
- Tipo de PR: **test guard architecture only** + reporte Markdown. **No se movieron tests.**

## Objetivo

Desbloquear las migraciones enterprise nested de tests **sin mover tests todavía**,
corrigiendo los dos mecanismos que TEST-ARCH-12 probó como bloqueantes:

1. Censos no recursivos basados en `readdirSync("test")` que solo ven archivos de la raíz.
2. Guards de security con `readSource`/`readFileSync` anclados a rutas legacy de test-root.

## Skills declaradas

- **Principal:** VETNEB Production Web Optimization Engineer.
- **Complementarias:** Staff Senior Full-Stack Engineer · Briefing/Planificación/Diseño/Desarrollo/Pruebas.
- **Guardrail:** Security Production Invariants.

## Archivos inspeccionados

- `docs/implementation/test-suite-enterprise-migration-manifest.md` (batch manifest).
- `docs/implementation/test-arch-12-enterprise-controller-bulk-batch-1.md`.
- `test/README.md`; reportes TEST-ARCH-6..10 (patrón de move probado); audit/convención
  citadas como fuente de verdad.
- `test/audit-suite-completeness.test.ts`, `test/architecture/security/security-boundary-suite-completeness.test.ts`,
  `test/architecture/security/security-session-cookie-boundaries.test.ts`,
  `test/architecture/security/security-response-disclosure-boundaries.test.ts`,
  `test/architecture/security/security-access-lifecycle-boundaries.test.ts`.
- Barrido de todos los `readdirSync(` en `test/**` para confirmar que **solo** esos dos
  archivos hacen censo no recursivo sobre la **raíz de test** (el resto apunta a
  `server/`, `frontend/`, `migrations/`, dirs de fixtures, o ya son walkers recursivos con
  `withFileTypes`).

## Archivos modificados

| Archivo | Cambio |
|---|---|
| `test/audit-suite-completeness.test.ts` | Censo → recursivo + canónico; `readSource`/`assertFileExists` subdirectory-aware; walker + resolver. |
| `test/architecture/security/security-boundary-suite-completeness.test.ts` | Censo → recursivo + canónico; `readSource`/`assertFileExists` subdirectory-aware; walker + resolver. |
| `test/architecture/security/security-session-cookie-boundaries.test.ts` | `readSource` subdirectory-aware; walker + resolver. |
| `test/architecture/security/security-response-disclosure-boundaries.test.ts` | `readSource` subdirectory-aware; walker + resolver. |
| `test/architecture/security/security-access-lifecycle-boundaries.test.ts` | `readSource` subdirectory-aware; walker + resolver. |
| `docs/implementation/test-suite-enterprise-migration-manifest.md` | Corrección §3.1 y §8 (anclas subcontabilizadas; Grupo A renombrado a TEST-ARCH-14). |
| `docs/implementation/test-arch-12-enterprise-controller-bulk-batch-1.md` | Nota de resolución apuntando a TEST-ARCH-13. |

## Censos convertidos a recursivos

Dos, ambos sobre la raíz `test/`:

- **`audit-suite-completeness.test.ts`** — `test("audit suite includes every audit-named test file")`.
  Antes: `readdirSync("test")` (no recursivo) filtrando basenames `audit*.test.ts` y
  comparando **basenames** contra el registry. Ahora: `listTestFilesRecursive()` (walk
  recursivo de `test/`, rutas relativas normalizadas a forward slash) filtrando
  `basename(path).includes("audit")` y comparando **rutas canónicas completas** contra
  `allSuiteTestPaths()`.
- **`security-boundary-suite-completeness.test.ts`** — `test("security boundary suite includes
  every security boundaries guardrail file")`. Antes: `readdirSync("test")` filtrando
  `/^security-.*-boundaries\.test\.ts$/` sobre basename y comparando basenames. Ahora:
  `listFilesRecursive("test")` filtrando el mismo regex sobre `basename(path)` y comparando
  **rutas canónicas completas** contra `guardrail.path`.

Comportamiento **hoy idéntico** (todos los archivos siguen en la raíz → el walk devuelve
`test/<archivo>`, que coincide con el `path:` del registry). Es más **estricto** que antes:
comparar rutas canónicas (en vez de basenames ambiguos) obliga a que un move futuro
**actualice** el `path:` del registry a la ruta real del subdirectorio (requisito 4).

## readSource / path anchors corregidos

Se introdujo, en cada archivo modificado, un walker recursivo `listFilesRecursive(dir)` y un
resolver `resolveExistingSourcePath(relativePath)`:

- **Prefiere la ruta exacta** si existe (comportamiento byte-identical hoy).
- Si no existe (archivo migrado a subdirectorio), busca por **basename único** bajo el
  mismo directorio top-level y devuelve la ruta canónica.
- Si hay **0 o >1 coincidencias**, devuelve `undefined` → el llamador (`readSource` /
  `assertFileExists`) **falla** con aserción explícita (no hay match silencioso ni
  degradación de cobertura).

`readSource` y `assertFileExists` de los guards se reescribieron sobre ese resolver,
**preservando su post-procesamiento** original (p. ej. el strip de BOM `﻿` y CRLF en
`audit-suite-completeness` y `security-boundary-suite-completeness`). Los `readSource` que
leen archivos de runtime (`server/**`, que no se mueven) siguen tomando la rama de ruta
exacta.

### Anclas de ruta-de-test desbloqueadas para el Grupo A (audit)

- `security-session-cookie-boundaries` → `test/clinic-audit.fastify.test.ts` (readSource).
- `security-response-disclosure-boundaries` → `test/particular-audit.fastify.test.ts` (readSource).
- `security-access-lifecycle-boundaries` → `test/particular-audit.fastify.test.ts` (readSource).
- `audit-suite-completeness` → censo + `readSource(path)` de los 3 audit fastify tests.

Con esto, `admin-audit`, `clinic-audit` y `particular-audit` pueden moverse en un PR
posterior (TEST-ARCH-14) sin `ENOENT` y sin reescribir lógica de censo.

## Assertions preservadas

- Ninguna aserción semántica cambió. Los censos siguen enforzando la **misma invariante**
  ("todo test audit-named / security-boundaries está inventariado"), ahora sobre rutas
  canónicas (más preciso, no más laxo).
- Los `readSource` siguen leyendo el archivo real y verificando los **mismos markers**.
- Los `assertFileExists` siguen **fallando** si el archivo no existe en ningún lado
  (exacto ni por basename único).
- No se eliminó ninguna entrada de registry ni se silenció ningún guard.

## Cobertura preservada

- 2983 tests → 2983 pass, 0 fail (idéntico al baseline pre-PR).
- Verificación sintética adicional (Node, en scratchpad, sin tocar el repo) del resolver y
  el censo recursivo sobre un árbol anidado: (A) ruta exacta preferida; (B) archivo migrado
  a `test/integration/adapters/controllers/` resuelto sin ENOENT; (C) censo recursivo
  devuelve rutas canónicas con forward slash a través de subdirectorios; (D) basename
  duplicado ambiguo rechazado (no hay match silencioso). **ALL PASSED.**

## Manifiesto corregido

- §3.1: nota `[CORRECCIÓN — TEST-ARCH-12/13]` explicando que la tabla subcontabilizó las
  anclas (censo `readdirSync` no recursivo + `readSource` en guards de security).
- §8: la recomendación original asumía "1 solo registry"; se marca como falsa, se documenta
  el desbloqueo por TEST-ARCH-13 y se renombra el move de Grupo A a **TEST-ARCH-14** con el
  patrón corregido (actualizar `path:` a la ruta canónica del subdirectorio, no basename).

## Confirmaciones de scope

- **No se movieron tests.** Solo se editaron guards + docs.
- **No se tocó** runtime (`server/**`, `frontend/src/**`), deps, `package.json`,
  `pnpm-lock.yaml`, CI, DB, schema, migraciones, stashes ni `.claude/worktrees`.
- No se cambiaron assertions semánticas, no se eliminó cobertura, no se borraron entradas
  de registry, no se silenció ningún guard.
- Fuente de las skills (ZIP) usada solo como observación: no copiada, no descomprimida, no
  editada, no versionada, no ejecutada.

## Resultados de validación

| Comando | Resultado |
|---|---|
| `git diff --check` | Limpio (sin whitespace errors). |
| `git diff --stat` / `--name-only` | 5 tests-guard + 2 docs modificados; 1 doc nuevo (este). |
| `pnpm test` | **2983 pass / 0 fail** (idéntico al baseline). |
| `pnpm build` | OK (`dist/index.js 838.3kb`). |
| `pnpm security:public-surface` | PASS; mantiene los findings `server-only` esperados en `frontend/src/proxy.ts`. |

## Qué quedó desbloqueado y qué sigue prohibido

**Desbloqueado (para PRs de move futuros, sin cambios adicionales de guard):**

- **Grupo A (audit): `admin-audit`, `clinic-audit`, `particular-audit`** — censo audit
  recursivo + los 3 guards de security que los `readSource`-anclaban ya son
  subdirectory-aware. → **TEST-ARCH-14** recomendado.
- Cualquier `security-*-boundaries.test.ts` que en el futuro se migre a `test/security/`:
  el censo de `security-boundary-suite-completeness` ya es recursivo.

**Sigue prohibido / aún NO desbloqueado en este PR:**

- Grupos B (study-tracking) y D (reports/tokens): siguen `readSource`-anclados por guards de
  security **no incluidos** en el scope de este PR
  (`security-write-attribution-boundaries`, `security-resource-ownership-boundaries`,
  `security-validation-cutoff-boundaries`, `security-rate-limit-isolation-boundaries`,
  `security-audit-logging-phase-boundaries`, `public-professionals-source-boundaries`).
  Requieren el mismo tratamiento subdirectory-aware en un PR análogo (TEST-ARCH-13-b) antes
  de moverlos.
- Mover tests (cualquier categoría) queda fuera de este PR.
- Tocar runtime, deps, lockfile, CI, DB/schema/migrations.

## Siguiente PR recomendado

**TEST-ARCH-14 — controller bulk Grupo A (audit).** Mover los 3 audit `.fastify.test.ts` a
`test/integration/adapters/controllers/`, ajustar imports de profundidad
(`../server` → `../../../../server`) y actualizar los 3 `path:` en
`audit-suite-completeness.test.ts` a la ruta canónica del subdirectorio (el censo recursivo
lo exige). Validar con `pnpm validate:local` + `pnpm test` + `pnpm build`.

Opcionalmente, **TEST-ARCH-13-b** puede replicar el tratamiento subdirectory-aware en los
guards de security restantes para desbloquear los Grupos B y D antes de sus moves.
