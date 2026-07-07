# TEST-ARCH-14 — Enterprise controller audit Group A migration

## Estado base

- Entorno: Windows 11, PowerShell, PNPM (`pnpm@10.8.1`).
- Herramienta: Claude · Modelo usado: Claude Opus 4.8 (`claude-opus-4-8`) · Effort configurado: high.
- Rama esperada y observada: `test/enterprise-controller-audit-group-a`.
- Base esperada y observada: `20f313d test(architecture): support recursive suite census (#1320)`
  (TEST-ARCH-13 mergeado). Working tree inicial limpio (`git status --short` sin salida).
- Tipo de PR: **test-only (move de controllers)** + reporte Markdown. No runtime.
- Categoría objetivo: `integration/adapters/controllers`.
- Destino único permitido: `test/integration/adapters/controllers/`.

## Objetivo

Ejecutar el move real del **Grupo A (audit)** desbloqueado por TEST-ARCH-13: mover los 3
audit `.fastify.test.ts` al subdirectorio enterprise canónico, ajustar imports de
profundidad y actualizar los 3 `path:` del censo recursivo `audit-suite-completeness`, sin
tocar runtime, deps, CI, DB/schema/migrations ni assertions semánticas.

## Skills declaradas

- **Skill principal:** VETNEB Production Web Optimization Engineer
  (`vetneb-production-web-optimization-engineer`).
- **Skills complementarias:**
  - VeTNEB Staff Senior Full-Stack Engineer (`vetneb-staff-senior-full-stack-engineer`).
  - VeTNEB Briefing Planificación Diseño Desarrollo Pruebas
    (`vetneb-briefing-planificacion-diseno-desarrollo-pruebas`).
- **Skill guardrail:** VeTNEB Security Production Invariants
  (`vetneb-security-production-invariants`).

## Confirmación de ZIP de skills

- El ZIP/carpeta de skills se usó **solo como material de observación**.
- **No** se copió al repo, **no** se descomprimió dentro de `C:\PORTAL-VETNEB`, **no** se
  modificó, **no** se versionó, **no** se ejecutó, **no** se usó como fuente de código.

## Documentos leídos

- `docs/implementation/test-suite-enterprise-migration-manifest.md` (§3.1, §7, §8 corregido).
- `docs/implementation/test-arch-12-enterprise-controller-bulk-batch-1.md` (bloqueo original).
- `docs/implementation/test-arch-13-recursive-suite-census-and-source-path-guards.md`
  (desbloqueo: censos recursivos + `readSource` subdirectory-aware).
- `docs/implementation/test-suite-enterprise-organization-convention.md` (fuente de verdad,
  clasificación §4/§5 + invariante de actualizar registries en el mismo PR).
- `test/README.md`.

## Archivos movidos

Solo el **Grupo A audit** (3 archivos), a `test/integration/adapters/controllers/`:

| Origen (test-root) | Destino (canónico) |
|---|---|
| `test/admin-audit.fastify.test.ts` | `test/integration/adapters/controllers/admin-audit.fastify.test.ts` |
| `test/clinic-audit.fastify.test.ts` | `test/integration/adapters/controllers/clinic-audit.fastify.test.ts` |
| `test/particular-audit.fastify.test.ts` | `test/integration/adapters/controllers/particular-audit.fastify.test.ts` |

Ningún otro test fue movido.

## Imports ajustados

Ajuste de profundidad únicamente (`../server` → `../../../../server`, patrón probado en
batches 6–10), 2 imports dinámicos por archivo:

| Archivo | Imports ajustados |
|---|---|
| `admin-audit.fastify.test.ts` | `../../../../server/lib/env.ts`, `../../../../server/routes/admin-audit.fastify.ts` |
| `clinic-audit.fastify.test.ts` | `../../../../server/lib/env.ts`, `../../../../server/routes/clinic-audit.fastify.ts` |
| `particular-audit.fastify.test.ts` | `../../../../server/lib/env.ts`, `../../../../server/routes/particular-audit.fastify.ts` |

No se tocó ninguna otra línea de esos archivos (assertions, stubs, CORS y payloads
intactos).

## Registry paths actualizados

En `test/audit-suite-completeness.test.ts`, bloque `audit-route-runtime`, se actualizaron los
**3** `path:` de los audit `.fastify` a la ruta canónica del subdirectorio. El censo recursivo
de TEST-ARCH-13 (`listTestFilesRecursive()` → rutas relativas a REPO_ROOT con forward slash)
lo **exige**: el basename ya no basta.

| Línea | Antes | Después |
|---|---|---|
| 292 | `test/admin-audit.fastify.test.ts` | `test/integration/adapters/controllers/admin-audit.fastify.test.ts` |
| 335 | `test/clinic-audit.fastify.test.ts` | `test/integration/adapters/controllers/clinic-audit.fastify.test.ts` |
| 369 | `test/particular-audit.fastify.test.ts` | `test/integration/adapters/controllers/particular-audit.fastify.test.ts` |

Los `markers` de cada entrada se conservaron sin cambios (misma aserción de contenido). No se
eliminó ninguna entrada de registry. Los `path:` de runtime (`server/...`) y los demás tests
audit-named (no-`.fastify`) quedaron intactos.

## Guards security subdirectory-aware — verificación sin ENOENT

Los `readSource` que TEST-ARCH-13 volvió subdirectory-aware (resolver exact-first + fallback
por basename único) resuelven las nuevas rutas sin `ENOENT`:

- `security-session-cookie-boundaries.test.ts:398` → `readSource("test/clinic-audit.fastify.test.ts")`.
- `security-response-disclosure-boundaries.test.ts:198` → `readSource("test/particular-audit.fastify.test.ts")`.
- `security-access-lifecycle-boundaries.test.ts:215` → `readSource("test/particular-audit.fastify.test.ts")`.
- `audit-suite-completeness.test.ts` → censo recursivo + `readSource(path)` de los 3 (path ya
  actualizado).

Se conservaron los hints legacy `readSource("test/…")` en esos guards (opción explícitamente
tolerada por el resolver subdirectory-aware de TEST-ARCH-13); no se editó ningún test de
security, evitando churn fuera de scope.

**Referencia adicional revisada (no bloqueante):**
`security-cross-tenant-idor-contract.test.ts:134` contiene el string
`"test/clinic-audit.fastify.test.ts"` dentro del campo de datos `requiredTestEvidence`. Ese
array **no se lee del filesystem** (solo se asevera `.length > 0` en el test de la línea 413;
el único `readSource` del archivo lee su propio source). Por tanto **no** produce `ENOENT` y no
requiere edición; se dejó intacto por ser dato de un test de security fuera del scope de este
PR (precedente TEST-ARCH-6: referencias de datos se dejan para evitar churn).

## Confirmación — solo Grupo A audit

Los 3 archivos movidos son exactamente `admin-audit`, `clinic-audit`, `particular-audit`
(`.fastify.test.ts`). No se movió ningún otro `.fastify.test.ts` ni ningún otro test. El único
archivo editado además de los movidos es el registry `audit-suite-completeness.test.ts`
(invariante de migración: actualizar el registry en el mismo PR).

## Confirmación de scope

- **No** se tocó runtime (`server/**`, `frontend/src/**`).
- **No** se cambió lógica de producción.
- **No** se cambiaron assertions semánticas (solo import de profundidad + `path:` de registry,
  que mantiene aserciones existentes verdaderas tras el move).
- **No** se eliminaron entradas de registry ni se silenció ningún guard.
- **No** se tocó `package.json`, `pnpm-lock.yaml`, deps, CI, DB, schema, migraciones, stashes
  ni `.claude/worktrees`.
- No se usó Python, no se usó `rg`; todo por PowerShell; PNPM only.

## Resultados de validación

| Comando | Resultado |
|---|---|
| `git diff --check` | Limpio (sin whitespace errors). |
| `git diff --stat` | 4 archivos en el diff tracked: 3 deletions (test-root) + `audit-suite-completeness.test.ts` (+3/−3); los 3 destinos aparecen como untracked en `git status --short`. |
| `git diff --name-only` | `admin-audit.fastify.test.ts`, `audit-suite-completeness.test.ts`, `clinic-audit.fastify.test.ts`, `particular-audit.fastify.test.ts`. |
| `pnpm test` | **2983 pass / 0 fail** (idéntico al baseline TEST-ARCH-13). |
| `pnpm build` | OK (`dist/index.js 838.3kb`). |
| `pnpm security:public-surface` | PASS; mantiene solo los findings `server-only` esperados en `frontend/src/proxy.ts` (`CLINIC_SESSION_COOKIE_NAME`, `ADMIN_SESSION_COOKIE_NAME`). |

## Rollback lógico

- `git restore` / revert del move devuelve los 3 archivos a `test/` raíz.
- Revert de los 3 `path:` en `audit-suite-completeness.test.ts` restaura el registry.
- Cero registries adicionales, cero guards de security editados → rollback de bajo riesgo.

## Siguiente PR recomendado

Grupos B (study-tracking) y D (reports/tokens) siguen `readSource`-anclados por guards de
security **no** tratados en TEST-ARCH-13. Requieren un **TEST-ARCH-13-b** que replique el
tratamiento subdirectory-aware en esos guards (`security-write-attribution-boundaries`,
`security-resource-ownership-boundaries`, `security-validation-cutoff-boundaries`,
`security-rate-limit-isolation-boundaries`, `security-audit-logging-phase-boundaries`,
`public-professionals-source-boundaries`) antes de mover esos controllers. Alternativa sin
anclas: el bulk `unit/domain` libre del manifiesto §3.2.
