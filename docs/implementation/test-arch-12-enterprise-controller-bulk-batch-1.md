# TEST-ARCH-12 — Enterprise controller bulk batch 1

## Estado base

- Entorno: Windows 11, PowerShell, PNPM (`pnpm@10.8.1`).
- Herramienta: Claude.
- Modelo usado: Claude Opus 4.8 (`claude-opus-4-8`).
- Effort configurado: xhigh.
- Rama esperada y observada: `test/enterprise-controller-bulk-batch-1`.
- Base esperada y observada: `9891011 docs(test): add enterprise migration manifest (#1318)`.
- Working tree inicial: limpio (`git status --short --untracked-files=all` sin salida antes de este reporte).
- Categoría objetivo del batch: `integration/adapters/controllers`.
- Destino único permitido: `test/integration/adapters/controllers/`.

## Resultado ejecutivo

**Archivos movidos en este batch: 0.**

La verificación por evidencia del repo **contradice la premisa central** del manifiesto
para TEST-ARCH-12. El manifiesto recomendó el **Grupo A (audit controllers)** como un
move limpio de **un solo registry** (3 actualizaciones de `path:` en
`audit-suite-completeness`). El repo demuestra que ese trío **no es movible** dentro de
las restricciones absolutas del brief. La generalización del hallazgo muestra que
**ninguno** de los 19 controllers restantes es un candidato seguro que respete el scope
(destino-único + sin tocar tests de security/architecture + sin reescribir tests).

Por lo tanto, conforme a la regla del brief *"No mover menos de 5 salvo que el
manifiesto indique que no hay candidatos seguros"* y a la propia §6.3/§8 del manifiesto
(el máximo efectivo de controllers = tamaño del grupo de anchor común, y ni siquiera ese
grupo sobrevive a la verificación), el batch correcto es **cero movimientos** más este
reporte correctivo.

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

## Documentos normativos leídos

- `docs/implementation/test-suite-enterprise-migration-manifest.md` (batch manifest usado).
- `test/README.md`.
- `docs/implementation/test-arch-6-enterprise-integration-controller-batch.md`.
- (Referenciados por el manifiesto y confirmados como fuente del patrón de move batches
  6–10) `docs/implementation/test-arch-7..10-*`.
- `docs/audit/test-suite-enterprise-architecture-audit.md` y
  `docs/implementation/test-suite-enterprise-organization-convention.md`:
  citados como fuente de verdad por el manifiesto y `test/README.md`; la convención §4/§5
  (clasificación + desempate por I/O) y §8/§9.5 (actualizar registries en el mismo PR) se
  respetan en el análisis.

## Batch manifest usado

`docs/implementation/test-suite-enterprise-migration-manifest.md` (#1318). Secciones
clave aplicadas: §3.1 (los 19 controllers restantes están anclados), §4 (concepto de
anchor), §6.3 (máximo efectivo = tamaño del grupo de anchor común), §7 (plan de batches),
§8 (primer bulk recomendado = Grupo A audit).

## Candidatos inspeccionados

19 `*.fastify.test.ts` restantes en `test/` raíz (`Get-ChildItem` / Glob):

`admin-audit`, `admin-auth`, `admin-particular-tokens`, `admin-report-access-tokens`,
`admin-reports`, `admin-study-tracking`, `auth`, `clinic-audit`, `clinic-public-profile`,
`particular-audit`, `public-professionals`, `particular-auth`, `particular-tokens`,
`public-report-access`, `report-access-tokens`, `reports-status`, `reports`,
`particular-study-tracking`, `study-tracking`.

Todos son controllers técnicamente válidos por contrato (usan `Fastify()`, `app.inject()`,
env sintético — `https://example.supabase.co`, `test-service-role-key` —, stubs locales,
sin DB real, sin Supabase real, sin red externa, sin credenciales reales; imports
relativos `../server/lib/env.ts` y `../server/routes/<name>.fastify.ts`).

## Grupo A (recomendado por el manifiesto) — inspección detallada

Archivos: `admin-audit.fastify.test.ts`, `clinic-audit.fastify.test.ts`,
`particular-audit.fastify.test.ts`. El manifiesto §8 los describe como move de **1 solo
registry** (`audit-suite-completeness`). Evidencia contraria:

### Bloqueante 1 (fatal, no reparable con actualización de `path:`)

`test/audit-suite-completeness.test.ts` ejecuta un **censo de directorio no recursivo**:

```ts
// test/audit-suite-completeness.test.ts:536-546
const actualFiles = readdirSync(resolve(REPO_ROOT, "test"))
  .filter((f) => f.includes("audit") && f.endsWith(".test.ts"))
  .sort();
const expectedFiles = allSuiteTestPaths().map((p) => basename(p)).sort();
assert.deepEqual(actualFiles, expectedFiles);
```

`readdirSync("test")` **no es recursivo**. Al mover los 3 archivos a un subdirectorio,
`actualFiles` pierde esos 3 basenames. Una actualización de `path:` en el registry
**mantiene** los mismos 3 basenames en `expectedFiles` (basename es idéntico) →
`deepEqual` **falla**. Las únicas formas de repararlo son:

1. eliminar las 3 entradas del registry (borra sus aserciones de `markers` en el bloque
   `audit-route-runtime`) → prohibido ("No cambiar assertions", "No reescribir tests"); o
2. volver `readdirSync` recursivo / consciente del subdirectorio → reescribe la lógica
   del test → prohibido.

Ambas violan restricciones absolutas del brief.

### Bloqueante 2 (los archivos de test están anclados por `readSource` en guards de security)

Los **archivos de test** (no solo las rutas runtime) se leen por ruta fija dentro de tests
de **security**, que hacen `readFileSync`/`readSource` y lanzan `ENOENT` si el archivo se
mueve:

- `test/security-session-cookie-boundaries.test.ts:356` → `readSource("test/clinic-audit.fastify.test.ts")`.
- `test/architecture/security/security-response-disclosure-boundaries.test.ts:156` → `readSource("test/particular-audit.fastify.test.ts")`.
- `test/architecture/security/security-access-lifecycle-boundaries.test.ts:173` → `readSource("test/particular-audit.fastify.test.ts")`.
- `test/security-cross-tenant-idor-contract.test.ts:134` → `"test/clinic-audit.fastify.test.ts"` (referencia de datos).

Moverlos deja esos guards en rojo. Repararlos exige **editar tests de security**, algo que
el brief prohíbe ("No mover repository/e2e/security/architecture/unit/domain tests") y que
el precedente TEST-ARCH-6 evitó explícitamente ("las referencias quedaron fuera de scope
para evitar churn no requerido").

## Generalización — por qué ningún controller restante es un candidato seguro

Inventario de anclas de **ruta-de-archivo-de-test** (`Select-String`/Grep sobre
`test/**` excluyendo los propios `*.fastify.test.ts`):

- **Censo `readdirSync("test")` no recursivo** en `audit-suite-completeness.test.ts:537`
  (bloquea el trío audit) y en `security-boundary-suite-completeness.test.ts:548`
  (enumera `security-*-boundaries.test.ts`).
- **`readSource`/`readFileSync` del archivo de test dentro de guards de security** —
  fatal al mover — en al menos:
  `security-session-cookie-boundaries`, `security-response-disclosure-boundaries`,
  `security-access-lifecycle-boundaries`, `security-write-attribution-boundaries`,
  `security-resource-ownership-boundaries`, `security-validation-cutoff-boundaries`,
  `security-rate-limit-isolation-boundaries`, `security-audit-logging-phase-boundaries`,
  `public-professionals-source-boundaries`.
- **Registries de completitud** que anclan la ruta del test:
  `reports-suite-completeness`, `study-tracking-suite-completeness`,
  `storage-suite-completeness`, `security-critical-route-surface-registry`.

Mapa resumido (bloqueante duro = deja `pnpm test` en rojo al mover):

| Controller restante | Anclas de ruta-de-test | Bloqueante duro |
|---|---|---|
| `admin-audit` | audit-suite-completeness (censo) | **Censo (irreparable por path)** |
| `clinic-audit` | audit-suite-completeness (censo), security-session-cookie-boundaries, security-cross-tenant-idor | **Censo + readSource security** |
| `particular-audit` | audit-suite-completeness (censo), security-access-lifecycle, security-response-disclosure | **Censo + readSource security** |
| `auth` | security-critical-route-surface-registry, security-boundary-suite-completeness, security-session-cookie-boundaries | readSource security |
| `admin-auth` | idem + security-session-cookie-boundaries | readSource security |
| `particular-auth` | reports-suite-completeness, security-session-cookie-boundaries, security-cross-tenant-idor | readSource security |
| `admin-particular-tokens` | security-critical-route-surface-registry, security-write-attribution | readSource security |
| `particular-tokens` | reports-suite-completeness, security-write-attribution, security-cross-tenant-idor | readSource security |
| `admin-report-access-tokens` | reports-suite-completeness, security-critical-route-surface-registry, security-access-lifecycle, security-rate-limit-isolation, security-write-attribution | readSource security |
| `report-access-tokens` | reports-suite-completeness, security-critical-route-surface-registry, security-boundary-suite-completeness, +6 security guards | readSource security |
| `admin-reports` | reports-suite-completeness, report-study-types-catalog, storage-suite-completeness, security-validation-cutoff | readSource security |
| `reports` | reports-suite-completeness, report-study-types-catalog, security-critical-route-surface-registry, +3 security guards | readSource security |
| `reports-status` | reports-suite-completeness, report-study-types-catalog, security-boundary-suite-completeness, +4 security guards | readSource security |
| `public-report-access` | reports-suite-completeness + 7 security guards | readSource security |
| `admin-study-tracking` | study-tracking-suite-completeness, security-critical-route-surface-registry, security-write-attribution, security-cross-tenant-idor | readSource security |
| `study-tracking` | study-tracking-suite-completeness, security-write-attribution, security-cross-tenant-idor | readSource security |
| `particular-study-tracking` | study-tracking-suite-completeness, security-access-lifecycle, security-response-disclosure, security-resource-ownership | readSource security |
| `public-professionals` | public-professionals-source-boundaries, security-rate-limit-isolation, security-validation-cutoff, storage-suite-completeness | readSource security/architecture |
| `clinic-public-profile` | storage-suite-completeness (solo) | Edita registry architecture-eje (1 archivo, no batch) |

**Lectura:** todos los controllers restantes están `readSource`-anclados por ≥1 guard de
**security** (o, en `clinic-public-profile`, por un registry **architecture-eje**). El trío
audit suma además un **censo de directorio irreparable con actualización de `path:`**. En
contraste, los 10 controllers ya migrados en TEST-ARCH-6..10 **no tenían** anclas de
ruta-de-test — por eso fueron baratos, tal como el manifiesto §2.2 anticipó. Los baratos
se agotaron; el resto no es un move mecánico dentro del scope.

## Candidatos elegidos

Ninguno. No existe un batch de controllers de 5–15 (ni el trío de 3 de Grupo A) que se
pueda mover respetando: destino único + no tocar tests de security/architecture + no
reescribir tests + no cambiar assertions salvo ajuste de path/import.

## Candidatos descartados y por qué

- **Grupo A (audit): `admin-audit`, `clinic-audit`, `particular-audit`** — bloqueados por
  el censo `readdirSync` no recursivo de `audit-suite-completeness` (irreparable con
  actualización de `path:`, exige reescribir lógica del test) **y** por `readSource` en
  guards de security. La premisa "1 solo registry" del manifiesto §8 es incorrecta.
- **Grupo B (study-tracking) y Grupo D (reports/tokens)** — cada archivo está
  `readSource`-anclado por múltiples guards de security; moverlos exige editar 4–8 tests
  de security por trío/grupo. Fuera de scope.
- **`clinic-public-profile`** — el menos enredado (solo `storage-suite-completeness`), pero
  (a) es 1 archivo, por debajo del mínimo de 5; (b) es dominio storage, no el grupo audit
  de este branch; (c) aun así edita un registry architecture-eje. No constituye un batch de
  controllers conforme.

## Archivos movidos

Ninguno.

## Imports ajustados

Ninguno.

## Reporte creado

`docs/implementation/test-arch-12-enterprise-controller-bulk-batch-1.md` (este archivo,
untracked).

## Confirmación de scope

- **No** se tocó runtime (`server/**`, `frontend/src/**`).
- **No** se movió ni editó ningún test.
- **No** se ajustaron imports.
- **No** se tocó `package.json`, `pnpm-lock.yaml`, deps, CI, DB, schema, migraciones,
  stashes ni `.claude/worktrees`.
- **No** se cambió lógica de producción ni assertions.
- El único cambio en el working tree es este reporte Markdown (untracked).

## Recomendación (para desbloquear la migración de controllers)

La migración de controllers restantes **no puede** continuar como move mecánico. Opciones,
en orden de menor a mayor scope, todas requieren autorización explícita porque salen del
destino-único y tocan tests de security/architecture:

1. **PR de convención/architecture previo**: volver recursivos los censos
   `readdirSync("test")` de `audit-suite-completeness` y `security-boundary-suite-completeness`
   (deuda R5 de la auditoría), como cambio de arquitectura de tests autorizado. Prerequisito
   para cualquier move de controller anclado.
2. **Corregir el manifiesto**: §3.1/§8 subcontabilizan las anclas (ignoran los
   `security-*-boundaries` que hacen `readSource` del archivo de test y el censo del trío
   audit). Actualizar el manifiesto antes de emitir más batches de controller.
3. **Redirigir el esfuerzo enterprise a una categoría realmente sin anclas**: el grupo
   `unit/domain` libre del manifiesto §3.2 (`report-access-token-serializers`,
   `report-access-token-helpers`, `report-access-token-edge`, `particular-token-edge`,
   `logistics-pagination`, `session-last-access` — 6 archivos, 0 anclas) es un bulk limpio,
   pero es `unit/domain`, no controllers, y excede la categoría de este branch.

## Validaciones ejecutadas

Ver sección de resultados de comandos en el resumen de entrega. Como no cambió ningún test
ni runtime, las validaciones confirman el **baseline verde intacto** y que el único cambio
es este reporte untracked.

## Resolución — TEST-ARCH-13

La **Opción 1** de la recomendación fue ejecutada en
[TEST-ARCH-13](test-arch-13-recursive-suite-census-and-source-path-guards.md): los censos
`readdirSync("test")` de `audit-suite-completeness` y `security-boundary-suite-completeness`
se volvieron **recursivos + canónicos**, y los `readSource`/`readFileSync` anclados a rutas
de test-root en los guards de security se volvieron **subdirectory-aware** (resolver
exact-first con fallback por basename único). **Sin mover tests.** Con eso, el **Grupo A
(audit)** queda desbloqueado para su move real (renombrado a **TEST-ARCH-14** en el
manifiesto §8 corregido).
