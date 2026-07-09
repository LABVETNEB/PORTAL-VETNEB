# TEST-ARCH-15 — Source path guards B/D unlock

## Estado base

- Entorno: Windows 11, PowerShell, PNPM (`pnpm@10.8.1`).
- Herramienta: Claude · Modelo usado: Claude Opus 4.8 (`claude-opus-4-8`) · Effort configurado: xhigh.
- Rama esperada y observada: `test/architecture-source-path-guards-bd`.
- Base esperada y observada: `fb2d081 test(integration): move audit controller group (#1321)`
  (TEST-ARCH-14 mergeado). Working tree inicial limpio.
- Tipo de PR: **test-guard architecture only** + reporte Markdown. **No se movieron tests.**

## Objetivo

Desbloquear las migraciones enterprise nested de los controllers restantes de los
**Grupos B (study-tracking)** y **D (reports/tokens)** replicando en los guards de security
fuera del scope de TEST-ARCH-13 el mismo tratamiento subdirectory-aware
(exact-first + fallback por basename único + fallo explícito). **Este PR no mueve tests.**

## Skills declaradas

- **Principal:** VETNEB Production Web Optimization Engineer.
- **Complementarias:** Staff Senior Full-Stack Engineer · Briefing/Planificación/Diseño/Desarrollo/Pruebas.
- **Guardrail:** Security Production Invariants.

## Documentos leídos

- `docs/implementation/test-suite-enterprise-migration-manifest.md` (§3.1, §7, §8).
- `docs/implementation/test-arch-12-enterprise-controller-bulk-batch-1.md` (bloqueo original).
- `docs/implementation/test-arch-13-recursive-suite-census-and-source-path-guards.md`
  (patrón de referencia: resolver exact-first + fallback por basename único).
- `docs/implementation/test-arch-14-enterprise-controller-audit-group-a.md` (move real Grupo A).
- `docs/implementation/test-suite-enterprise-organization-convention.md` (fuente de verdad).
- `test/README.md`.

## Guards inspeccionados

Se barrió con `Select-String` (PowerShell) por `readSource`, `readFileSync`, `assertFileExists`
y por cada basename de test de los controllers de los Grupos B/D. Referenciantes encontrados y
su clasificación:

| Archivo | Mecanismo de ancla a rutas de test | ¿Requiere fix aquí? |
|---|---|---|
| `security-write-attribution-boundaries.test.ts` | `readSource("test/…")` inline (8 tests B/D) | **SÍ — este PR** |
| `security-resource-ownership-boundaries.test.ts` | `readSource("test/…")` inline (5 tests B/D) | **SÍ — este PR** |
| `security-validation-cutoff-boundaries.test.ts` | `readSource("test/…")` inline (8 tests) | **SÍ — este PR** |
| `security-rate-limit-isolation-boundaries.test.ts` | `readSource("test/…")` inline (9 tests) | **SÍ — este PR** |
| `security-audit-logging-phase-boundaries.test.ts` | `readSource("test/…")` inline (3 tests) | **SÍ — este PR** |
| `public-professionals-source-boundaries.test.ts` | `readSource("test/…")` inline (1 test) | **SÍ — este PR** |
| `security-session-cookie-boundaries.test.ts` | `readSource` inline | ya subdirectory-aware (TEST-ARCH-13) |
| `security-response-disclosure-boundaries.test.ts` | `readSource` inline | ya subdirectory-aware (TEST-ARCH-13) |
| `security-access-lifecycle-boundaries.test.ts` | `readSource` inline | ya subdirectory-aware (TEST-ARCH-13) |
| `audit-suite-completeness.test.ts` | censo recursivo + `readSource(path)` | ya recursivo (TEST-ARCH-13) |
| `security-boundary-suite-completeness.test.ts` | censo recursivo + `readSource(path)` | ya recursivo (TEST-ARCH-13) |
| `reports-suite-completeness.test.ts` | **registry** `path:` + `assertFileExists`/`readSource(path)` | no — invariante de move: actualizar `path:` en el mismo PR |
| `study-tracking-suite-completeness.test.ts` | **registry** `path:` + `assertFileExists`/`readSource(path)` | no — invariante de move: actualizar `path:` |
| `storage-suite-completeness.test.ts` | **registry** `path:` + `readSource(path)` | no — invariante de move: actualizar `path:` |
| `security-critical-route-surface-registry.test.ts` | **registry** `path:` + `existsSync(path)` | no — invariante de move: actualizar `path:` |
| `security-cross-tenant-idor-contract.test.ts` | path como **dato** (`requiredTestEvidence`), no lee FS | no — no produce ENOENT (precedente TEST-ARCH-14) |
| `report-study-types-catalog.test.ts` | **censo por lista hardcodeada** (`.filter([...paths].includes)` + `assert.deepEqual` + `readSource(file)`) | **NO en este PR** — mecanismo distinto; ver "Grupos aún bloqueados" |

## Guards modificados

Los **6** guards nombrados en el objetivo, exclusivamente su helper `readSource`
(y sus imports de `node:fs`/`node:path`):

| Archivo | Cambio |
|---|---|
| `test/architecture/security/security-write-attribution-boundaries.test.ts` | `readSource` subdirectory-aware; añadidos `listFilesRecursive` + `resolveExistingSourcePath`. |
| `test/architecture/security/security-resource-ownership-boundaries.test.ts` | idem. |
| `test/architecture/security/security-validation-cutoff-boundaries.test.ts` | idem (se preserva el strip de BOM `﻿` + CRLF). |
| `test/architecture/security/security-rate-limit-isolation-boundaries.test.ts` | idem (se preserva el strip de CRLF). |
| `test/security-audit-logging-phase-boundaries.test.ts` | idem (se preserva el strip de CRLF). |
| `test/public-professionals-source-boundaries.test.ts` | idem sobre base `process.cwd()` (`SOURCE_ROOT`), preserva strip de CRLF. |

## Patrón exact-first / fallback único aplicado

Idéntico al de TEST-ARCH-13 (byte-compatible con los guards ya migrados):

- **Prefiere la ruta exacta** si existe → comportamiento byte-identical hoy (todos los
  archivos siguen en su ubicación actual; runtime `server/**` siempre toma esta rama).
- Si no existe (archivo migrado a subdirectorio), busca por **basename único** bajo el
  mismo directorio top-level (`test/`) con un walker recursivo `withFileTypes` y devuelve la
  ruta canónica (forward slash).
- **0 coincidencias** → `undefined` → `assert.ok(resolved, …)` **falla** explícito (ENOENT
  convertido en aserción legible).
- **>1 coincidencia** (basename ambiguo) → `undefined` → **falla** explícito. Sin match
  silencioso, sin degradación de cobertura.

`readSource` conserva su post-procesamiento original por guard (strip de BOM/CRLF donde
existía). Los `readSource` de runtime (`server/**`, que no se mueven) siguen tomando siempre
la rama exact-first.

### Verificación en vivo del resolver (contra el árbol real, sin mover nada)

Comprobación sintética (Node, en scratchpad, sin tocar el repo) usando el árbol real, que ya
contiene el Grupo A audit movido por TEST-ARCH-14:

| Entrada | Resultado |
|---|---|
| `test/admin-audit.fastify.test.ts` (movido por TEST-ARCH-14) | `test/integration/adapters/controllers/admin-audit.fastify.test.ts` **[FALLBACK-UNIQUE]** |
| `test/reports.fastify.test.ts` (aún en raíz) | `test/reports.fastify.test.ts` **[EXACT]** |
| `server/routes/reports.fastify.ts` (runtime) | `server/routes/reports.fastify.ts` **[EXACT]** |
| `test/does-not-exist.fastify.test.ts` | `undefined (matches=0)` **[FAIL explícito]** |

Prueba que, una vez movidos, los tests de los controllers B/D resolverán en los 6 guards
**sin ENOENT** por fallback de basename único.

## Assertions preservadas

- Ninguna aserción semántica cambió. Cada guard sigue leyendo el archivo real y verificando
  **los mismos markers** (mismos `assertContains`/`assertContainsInOrder`/`assertMatches`).
- Los self-checks ascii-only de cada guard siguen pasando: todo el código insertado es ASCII.
- 0 assertions debilitadas, 0 guards silenciados.

## Cobertura preservada

- 2983 tests → **2983 pass / 0 fail** (idéntico al baseline TEST-ARCH-14).
- El resolver falla explícito ante 0 o >1 coincidencias → no hay pérdida silenciosa de
  cobertura si un move futuro deja un basename ambiguo.

## Docs / manifiesto actualizados

- Este reporte (`docs/implementation/test-arch-15-source-path-guards-bd-unlock.md`).
- `docs/implementation/test-suite-enterprise-migration-manifest.md`: nota
  `[CORRECCIÓN — TEST-ARCH-15]` en §3.1 y actualización de §7 documentando (a) el desbloqueo
  de los 6 guards, (b) el **anchor adicional no anticipado** `report-study-types-catalog`
  (censo por lista hardcodeada) que aún bloquea el sub-trío `reports`/`admin-reports`/
  `reports-status` del Grupo D.

## Grupos desbloqueados

- **Grupo B (study-tracking): DESBLOQUEADO.** Sus anclas inline (`security-resource-ownership`,
  `security-write-attribution` en este PR; `security-access-lifecycle` y
  `security-response-disclosure` ya de TEST-ARCH-13) son subdirectory-aware. Sus registries
  (`study-tracking-suite-completeness`, `security-critical-route-surface-registry`) se
  resuelven con la actualización estándar de `path:` en el mismo PR de move.
  `security-cross-tenant-idor-contract` guarda el path como dato (no lee FS). → move real
  candidato para **TEST-ARCH-16**.
- **Grupo D (reports/tokens): PARCIALMENTE DESBLOQUEADO.** Los 6 guards + los de TEST-ARCH-13
  ya no dan ENOENT; los registries (`reports-suite-completeness`, `storage-suite-completeness`,
  `security-critical-route-surface-registry`) se manejan con la actualización de `path:` en el
  move. **Subconjunto desbloqueado:** `particular-auth`, `admin-particular-tokens`,
  `admin-report-access-tokens`, `particular-tokens`, `report-access-tokens`,
  `public-report-access`, `auth` (`.fastify`).

## Grupos aún bloqueados

- **Sub-trío `reports` del Grupo D — AÚN BLOQUEADO:** `reports.fastify`, `admin-reports.fastify`
  y `reports-status.fastify` siguen anclados por
  **`test/report-study-types-catalog.test.ts`** (test _"critical report tests stop using
  free-text or abbreviated studyType"_). Ese guard **no** usa el patrón `readSource("test/…")`
  inline sino un **censo por lista hardcodeada**: `listSourceFiles("test")` (ya recursivo)
  filtrado por `.filter(file => [rutas test-root].includes(file))` y comparado con
  `assert.deepEqual(criticalTestFiles, [rutas test-root])`. Mover cualquiera de esos 3 archivos
  haría que el filtro los excluya (nueva ruta ≠ ruta hardcodeada) → `deepEqual` rojo + pérdida
  de cobertura. **Fix pendiente (fuera del scope nombrado de este PR):** hacer ese censo
  path-aware (comparar por basename canónico o actualizar las 3 rutas hardcodeadas en el PR de
  move). Recomendado como **TEST-ARCH-15-b** antes de mover el sub-trío `reports`.
- Grupo C (storage: `clinic-public-profile`, `public-professionals`) fuera de scope aquí.
- `frontend-*` (R2) y residual `unknown` siguen fuera de move mecánico.

## Confirmaciones de scope

- **No se movieron tests.** Solo se editaron 6 guards + docs.
- **No se tocó** runtime (`server/**`, `frontend/src/**`), deps, `package.json`,
  `pnpm-lock.yaml`, CI, DB, schema, migraciones, stashes ni `.claude/worktrees`.
- No se cambiaron assertions semánticas, no se eliminó cobertura, no se borraron entradas de
  registry, no se silenció ningún guard.
- No se usó Python, no se usó `rg`; todo por PowerShell; PNPM only.

## Resultados de validación

| Comando | Resultado |
|---|---|
| `git diff --check` | Limpio (sin whitespace errors). |
| `git diff --stat` / `--name-only` | 6 guards modificados + 2 docs (este reporte + manifiesto). |
| `pnpm test` | **2983 pass / 0 fail** (idéntico al baseline). |
| `pnpm build` | OK (`dist/index.js 838.3kb`). |
| `pnpm security:public-surface` | PASS; mantiene solo los findings `server-only` esperados en `frontend/src/proxy.ts`. |

## Siguiente PR recomendado

- **TEST-ARCH-16 — controller bulk Grupo B (study-tracking).** Mover `particular-study-tracking`,
  `admin-study-tracking`, `study-tracking` (`.fastify`) a
  `test/integration/adapters/controllers/`, ajustar imports de profundidad y actualizar `path:`
  en `study-tracking-suite-completeness` y `security-critical-route-surface-registry`. Validar
  con `pnpm validate:local` + `pnpm test` + `pnpm build`.
- **TEST-ARCH-15-b (prerrequisito del sub-trío `reports`):** hacer path-aware el censo por lista
  hardcodeada de `report-study-types-catalog.test.ts` antes de mover
  `reports`/`admin-reports`/`reports-status`.
