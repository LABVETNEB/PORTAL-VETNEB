# VETNEB Enterprise Test Suite Migration Manifest

> Manifiesto operativo para acelerar la migración restante de la suite de tests de
> Portal VETNEB **sin volver a micro-lotes de 2–3 archivos**. **Docs-only.** No
> mueve tests, no edita tests, no modifica imports, no toca runtime, deps, CI,
> `package.json`, `pnpm-lock.yaml` ni DB/schema. Su función es reducir tokens en
> los próximos PRs dando lotes pre-clasificados por evidencia del repo.

---

## 1. Metadata

| Campo | Valor |
|-------|-------|
| Rama | `docs/test-suite-enterprise-migration-manifest` |
| Base commit observado | `96b68a8 test(integration): move controller batch 5 (#1317)` **[OBSERVADO]** |
| Tipo de PR | **docs-only** |
| Archivo único | `docs/implementation/test-suite-enterprise-migration-manifest.md` |
| Fecha | 2026-07-07 |
| Gestor | PNPM (`pnpm@10.8.1`) |
| Runner backend | `node --experimental-strip-types --experimental-specifier-resolution=node --test test/**/*.test.ts` **[OBSERVADO]** |

### Scope

- Inventariar por **evidencia del repo** los tests aún no migrados (400 archivos en
  `test/` raíz) y clasificarlos en las categorías enterprise ya definidas.
- Definir una **regla de tamaño de lote** que reemplace los micro-lotes de 2–3.
- Proponer una secuencia concreta de batches desde **TEST-ARCH-12** con criterio de
  inclusión, validación y rollback por lote.
- Marcar el **primer bulk PR recomendado** con archivos exactos.

### No-scope

- **No** mover/editar tests, **no** modificar imports, **no** tocar runtime
  (`server/**`, `frontend/src/**`), **no** cambiar `package.json`,
  `pnpm-lock.yaml`, deps, CI, DB, schema, migraciones, stashes ni
  `.claude/worktrees`.
- **No** materializar carpetas nuevas: este PR **documenta** los lotes, no los
  ejecuta.

### Fuente normativa

- `docs/audit/test-suite-enterprise-architecture-audit.md`
- `docs/implementation/test-suite-enterprise-organization-convention.md` (**fuente de verdad**, 606 líneas)
- `test/README.md`
- `docs/implementation/test-arch-3-enterprise-first-unit-domain-batch.md` … `test-arch-10-enterprise-integration-controller-batch-5.md`

> **Convención de marcado.** Cada afirmación se etiqueta **[OBSERVADO]** (verificado
> en el commit base con comandos de solo lectura) o **[PROPUESTO]** (norma/plan que
> aún no existe físicamente). Este manifiesto es mitad inventario **[OBSERVADO]**,
> mitad plan **[PROPUESTO]**.

---

## 2. Estado actual observado **[OBSERVADO]**

- **HEAD observado:** `96b68a8 test(integration): move controller batch 5 (#1317)`.
  Árbol de trabajo limpio (`git status --short --untracked-files=all` vacío antes de
  este doc).
- **Runner:** el script `test` usa el glob recursivo `test/**/*.test.ts`, así que
  cualquier subcarpeta bajo `test/` **ya es descubierta** sin tocar `package.json`.
  **[OBSERVADO]** — habilitador clave para toda la migración.

### 2.1. Estructura enterprise ya creada y poblada

| Carpeta | Archivos hoy | Contenido observado |
|---------|-------------:|---------------------|
| `test/unit/domain/` | 2 | `rate-limit-store.test.ts`, `runtime-timing.test.ts` |
| `test/architecture/` | 3 | `fastify-only-guardrail.test.ts`, `logistics-domain-boundary-guard.test.ts`, `toolchain-contract.test.ts` |
| `test/security/` | 3 | `auth-session-boundaries.test.ts`, `backend-api-no-store-cache-contract.test.ts`, `security-rate-limit-cross-realm-isolation.test.ts` |
| `test/integration/adapters/controllers/` | 10 | `admin-clinics`, `admin-failed-login-alerts`, `admin-report-workflow`, `admin-sessions`, `admin-system-health`, `admin-system-maintenance`, `admin-system-schema-health`, `admin-users-roles`, `auth-authorization-integration`, `logistics-sla-routes-integration` (`.fastify.test.ts`) |
| `test/helpers/` | (seed) | única subcarpeta preexistente a la migración |

Total migrado: **18** archivos. Total aún en `test/` raíz (plano): **400** archivos
`*.test.ts`. **[OBSERVADO]**

### 2.2. Tests ya migrados por bloque (mapa batch → commit → archivos)

| Batch | Commit | Categoría destino | Archivos movidos | Edición del move |
|-------|--------|-------------------|------------------|------------------|
| TEST-ARCH-3 | `c6abbcb` | `unit/domain` | `rate-limit-store`, `runtime-timing` | ajuste de import (depth) |
| TEST-ARCH-4 | `32e1d73` | `architecture` | `fastify-only-guardrail`, `logistics-domain-boundary-guard`, `toolchain-contract` | move puro |
| TEST-ARCH-5 | `3324186` | `security` | `auth-session-boundaries`, `backend-api-no-store-cache-contract`, `security-rate-limit-cross-realm-isolation` | ajuste de import |
| TEST-ARCH-6 | `1d47a9d` | `integration/adapters/controllers` | `admin-system-health`, `admin-system-maintenance` | `../server`→`../../server` |
| TEST-ARCH-7 | `0d2ed0b` | `…/controllers` | `admin-report-workflow`, `admin-system-schema-health` | ajuste de import |
| TEST-ARCH-8 | `554dc51` | `…/controllers` | `admin-failed-login-alerts`, `admin-sessions` | ajuste de import |
| TEST-ARCH-9 | `4214934` | `…/controllers` | `admin-clinics`, `admin-users-roles` | ajuste de import |
| TEST-ARCH-10 | `96b68a8` | `…/controllers` | `auth-authorization-integration`, `logistics-sla-routes-integration` | ajuste de import |

> **[OBSERVADO] crítico.** Cada batch de controller tocó **solo** su doc + 2 tests.
> **Ninguno** editó un registry de completitud ni un scope-guard. Motivo verificado:
> esos 10 controllers **no estaban anclados** por ningún registry (§4). Los 19
> controllers que quedan **sí lo están** (§3.1) — por eso los baratos ya se
> agotaron y el resto es de mayor riesgo. Este es el hallazgo central del
> manifiesto.

---

## 3. Inventario de tests restantes **[OBSERVADO]**

400 archivos en `test/` raíz. Se inventarían **por familia** (no 400 filas) para
priorizar claridad operativa y reducir tokens. Los conteos son exactos
(`Get-ChildItem` + `Select-String`, sin `rg` ni Python). "Anchors" = referenciado
por nombre/path en un registry de completitud o scope-guard (§4).

| Familia (patrón) | Nº | Categoría enterprise propuesta | Riesgo | Motivo | Patrón técnico | ¿Ajuste imports? | ¿Anchors? | Batch sugerido | Notas |
|------------------|---:|--------------------------------|--------|--------|----------------|------------------|-----------|----------------|-------|
| `*.fastify.test.ts` | 19 | `integration/adapters/controllers` | **medio** | homogéneos y probados, pero **todos anclados** | `Fastify()` + `app.inject()` | sí (`../server`→`../../server`) | **sí (100%)** | ARCH-12/13 | mover agrupando por anchor común |
| `frontend-*` | 147 | **unknown / needs audit** (R2) → `architecture` o reemplazo render/e2e | **alto** | leen `.tsx` y aseveran strings exactos; no son unit/integration reales | source-contract del frontend | sí (depth) | desconocido/parcial | **fuera de batches de move** | deuda R2 explícita; decisión por archivo, no bulk |
| `security-*` (boundaries/registry) | 19 | `security` (eje) | **medio-alto** | varios anclados por `security-boundary-suite-completeness` + registry | behavioral / registry-driven | sí | sí (mayoría) | ARCH-15 | actualizar registries en el mismo PR |
| `*runtime-timing-contract` | 20 | `regression` (eje) | **medio** | congelan timing; `routes-runtime-timing-legacy-guard` escanea `server/routes`, no paths de test | freeze de contrato | sí | mayormente libres | ARCH-15 | verificar anchor por archivo antes de mover |
| `*session-last-access-contract` | 13 | `regression` (eje) | **medio** | congelan last-access | freeze de contrato | sí | mayormente libres | ARCH-15 | idem |
| `logistics-*` | 26 | mixto: `unit/domain`, `unit/use-cases`, `integration/adapters/repositories` | **medio** | `metrics`/`schema` anclados por sus `*-suite-completeness`; `pagination` libre | mixto | sí | parcial | ARCH-14/16 | desempatar por I/O (§5 convención) |
| `public-professionals-*` | 22 | mixto: `architecture`/`security` (invariants+fixtures), `controllers` (`.fastify`), `repositories` (`db-contract`) | **alto** | `fixture-registry`/`fixture-suite-completeness` se auto-anclan | invariants + fixtures | sí | sí (fixtures) | ARCH-15/16 | fixtures → `shared/factories` es su propio sub-plan |
| `supabase-*` | 5 | `integration/external-services` | **medio-alto** | anclados por `storage-suite-completeness` + `security-critical-route-surface-registry` | fakes de storage/signed-url | sí | sí | ARCH-17 canary | 1–3 por PR |
| `email-*` | 4 | `integration/external-services` | **medio** | `email-success` anclado por `study-tracking-suite-completeness`; `email-gmail-api` libre | fakes de email/gmail | sí | parcial | ARCH-17 canary | empezar por el libre |
| `*suite-completeness` / `*-registry` | 8+ | `architecture` (eje) | **alto** | **son los anchors**; moverlos rompe su auto-referencia | registries hardcodeados (R5) | sí | auto-anclados | **último** | mover al final; idealmente tras generarlos por glob (deuda R5) |
| `audit-*` (no-frontend) | 8 | mixto: `architecture` (`suite-completeness`), `unit`/`use-cases` (`audit.test`, `audit-write`) | **medio-alto** | domain anclado por `audit-suite-completeness` | mixto | sí | sí | ARCH-14/15 | ver anchor por archivo |
| `report-access-token*` (no `.fastify`) | 8 | `unit/domain` | **bajo–medio** | `serializers`/`helpers`/`edge` **libres**; `report-access-token.test` anclado | dominio puro | sí (depth) | parcial | **ARCH-14** | grupo libre = candidato ideal |
| `particular-token*` (no `.fastify`) | 4 | `unit/domain` | **bajo–medio** | `particular-token-edge` **libre**; `particular-token` anclado | dominio puro | sí (depth) | parcial | ARCH-14 | idem |
| `login-rate-limit*` / `rate-limit*` | ~11 | `unit/domain` + `security` | **medio** | mezcla dominio y frontera de seguridad | mixto | sí | parcial | ARCH-14/15 | desempatar por eje |
| `api-*-contract` | 6 | `security`/`architecture` (eje) | **medio** | contratos de error/no-secrets/no-stack | contract | sí | parcial | ARCH-15 | |
| `smoke-*` | 4 | `architecture` (contratos de script) | **bajo** | validan que los smokes de prod viven fuera del runner | contract de script | sí | no | ARCH-15 | los scripts smoke reales viven en `scripts/` |
| Resto no clasificado | ~ (residual) | **unknown / needs audit** | variable | requiere lectura individual | mixto | sí | desconocido | closeout | honesto: quedan `unknown` |

> **No se afirma que los 400 estén clasificados al 100%.** El bloque `frontend-*`
> (147, R2) y el "resto residual" quedan explícitamente como **unknown / needs
> audit**: no son un move mecánico simple.

### 3.1. Detalle por archivo — los 19 controllers restantes (todos anclados) **[OBSERVADO]**

Verificado con `Select-String` sobre todos los registries. Agrupados por anchor
para diseñar lotes que actualicen **un solo registry** por PR:

| `.fastify.test.ts` restante | Anclado por | Grupo de lote limpio |
|-----------------------------|-------------|----------------------|
| `admin-audit` | `audit-suite-completeness` | **A (audit)** — 1 anchor |
| `clinic-audit` | `audit-suite-completeness` | **A (audit)** |
| `particular-audit` | `audit-suite-completeness` | **A (audit)** |
| `particular-study-tracking` | `study-tracking-suite-completeness` | **B (study-tracking)** — 1 anchor |
| `admin-study-tracking` | `study-tracking-suite-completeness`, `security-critical-route-surface-registry` | B (2 anchors) |
| `study-tracking` | `study-tracking-suite-completeness`, `security-critical-route-surface-registry` | B (2 anchors) |
| `clinic-public-profile` | `storage-suite-completeness` | C (storage) — 1 anchor |
| `public-professionals` | `storage-suite-completeness` | C (storage) — 1 anchor |
| `particular-auth` | `reports-suite-completeness` | D (reports) — 1 anchor |
| `admin-particular-tokens` | `reports-suite-completeness`, `security-critical-route-surface-registry` | D (reports, multi) |
| `admin-report-access-tokens` | `reports-suite-completeness`, `security-critical-route-surface-registry` | D |
| `particular-tokens` | `reports-suite-completeness`, `security-critical-route-surface-registry` | D |
| `reports-status` | `reports-suite-completeness`, `security-boundary-suite-completeness` | D |
| `admin-reports` | `reports-suite-completeness`, `storage-suite-completeness` | D |
| `report-access-tokens` | `reports`, `security-boundary`, `security-critical-route-surface-registry` | D (3 anchors) |
| `public-report-access` | `reports`, `security-boundary`, `storage-suite-completeness` | D (3 anchors) |
| `reports` | `reports`, `security-critical-route-surface-registry`, `storage-suite-completeness` | D (3 anchors) |
| `auth` | `reports`, `security-boundary`, `security-critical-route-surface-registry` | D (3 anchors) |
| `admin-auth` | `security-boundary-suite-completeness`, `security-critical-route-surface-registry` | E (security) |

**Lectura:** el **Grupo A (audit)** es el más limpio (3 archivos, 1 solo registry).
Grupos B y C son medianos (1–2 registries). Grupo D (reports/tokens) es el más
enredado (varios multi-anclados) → dejarlo para el final del bloque de controllers.

> **[CORRECCIÓN — TEST-ARCH-12/13]** Esta tabla **subcontabilizó** las anclas. Solo miró
> `*-suite-completeness`/`*-registry`. Dos clases de ancla adicionales fueron omitidas y
> confirmadas por evidencia en TEST-ARCH-12:
> 1. **Censo `readdirSync("test")` no recursivo** en `audit-suite-completeness.test.ts`
>    (y en `security-boundary-suite-completeness.test.ts`): mover un archivo audit-named
>    fuera de `test/` raíz rompe el `deepEqual` de basenames y **no** se repara actualizando
>    el `path:` del registry.
> 2. **`readSource`/`readFileSync` del archivo de test** dentro de guards de security
>    (`security-session-cookie-boundaries`, `security-response-disclosure-boundaries`,
>    `security-access-lifecycle-boundaries`, y varios más): lanzan `ENOENT` al mover.
>
> Consecuencia: **ninguno** de los 19 controllers restantes era un move limpio "de 1 solo
> registry". **TEST-ARCH-13** volvió recursivos ambos censos y subdirectory-aware los
> `readSource` de esos guards (sin mover tests). El **Grupo A (audit)** queda desbloqueado
> para su move real (ver §8 corregido).

### 3.2. Detalle por archivo — grupo `unit/domain` **libre** (sin anchors) **[OBSERVADO]**

Candidatos puros de dominio que **no** están en ningún registry → move + ajuste de
import de profundidad, **sin** tocar registries:

- `report-access-token-serializers.test.ts`
- `report-access-token-helpers.test.ts`
- `report-access-token-edge.test.ts`
- `particular-token-edge.test.ts`
- `logistics-pagination.test.ts`
- `session-last-access.test.ts`

(Contraparte anclada, **no** incluir en el lote libre: `report-access-token.test.ts`,
`particular-token.test.ts`, `logistics-metrics.test.ts`,
`permissions-and-report-status.test.ts`.)

---

## 4. Concepto de "anchor" (por qué el riesgo cambió) **[OBSERVADO]**

Varios tests son **registries de completitud** con paths **hardcodeados** (deuda R5
de la auditoría). Ejemplos verificados:

```
// reports-suite-completeness.test.ts
path: "test/admin-reports.fastify.test.ts"
path: "test/reports.fastify.test.ts"
path: "test/report-access-tokens.fastify.test.ts"

// security-boundary-suite-completeness.test.ts
path: "test/security-session-cookie-boundaries.test.ts"
...

// audit-suite-completeness.test.ts
path: "test/audit-write.test.ts"
```

**Implicación operativa:** mover un archivo anclado **exige actualizar el string
del path en su registry en el mismo PR** (invariante de migración de la convención
§8/§9.5). Eso **no** es "editar un test funcional" ni "assertion nueva": es
mantener verdadera una aserción existente tras el move. Los guards que escanean
runtime por `readdirSync` (p. ej. `routes-runtime-timing-legacy-guard` sobre
`server/routes`) **no** anclan paths de test → esos timing-contracts son libres.

---

## 5. Categorías enterprise permitidas **[PROPUESTO]**

Cada test restante se clasifica en **una** de (idéntico a la convención §5 y
`test/README.md` §4):

`unit/domain` · `unit/use-cases` · `integration/adapters/controllers` ·
`integration/adapters/repositories` · `integration/external-services` ·
`e2e/flows` · `e2e/features` · `shared/fixtures` · `shared/factories` ·
`shared/mocks` · `shared/setup` · `architecture` · `security` · `regression` ·
`unknown / needs audit`.

> **Desempate (convención §5):** clasificar por el colaborador de mayor peso de I/O.
> **E2E > External-service > Repository > Controller > Use-case > Domain.** Los ejes
> `security` / `regression` / `architecture` se **etiquetan además** del tipo.

---

## 6. Nueva regla operativa de tamaño de lote **[PROPUESTO]**

Reemplaza los micro-lotes de 2–3. **Máximos por PR** (homogéneo = mismo dominio +
mismo patrón + mismo eje):

| Categoría | Máx. por PR | Condición |
|-----------|------------:|-----------|
| `unit/domain` puro | **10–20** | homogéneos, sin I/O, sin `Fastify` |
| `architecture` guards | **5–10** | si usan `process.cwd()` / repo-root paths |
| `security` invariants | **5–8** | sin fixtures sensibles complejos |
| `integration/controllers` | **8–15** | solo si homogéneos `Fastify`/`app.inject` y ya siguen el patrón probado |
| `integration/repositories` | **2–4** | fakes de DB |
| `integration/external-services` | **1–3** | fakes de Supabase/email |
| `e2e/flows` | **1–3** | Playwright, `frontend/e2e` |
| `shared` fixtures/factories/mocks | **1–3 archivos** | aditivo |

**Reglas:**

1. **El máximo no obliga a llenar el lote.** Si solo hay candidatos seguros para
   menos, mover menos.
2. **No mezclar categorías** en un mismo PR.
3. **Ajuste anti-anchor (propio de VETNEB):** dentro del máximo, **agrupar por
   anchor común**. Un lote de controllers de tamaño 8–15 solo es aceptable si
   comparten **el mismo registry**; si tocan varios registries, subdividir. Por
   §3.1, el máximo real efectivo hoy para controllers restantes es **el tamaño del
   grupo de anchor común** (p. ej. Grupo A = 3), no 15.

---

## 7. Batches propuestos (desde TEST-ARCH-12) **[PROPUESTO]**

| Batch | Categoría | Archivos sugeridos | Riesgo | Lote | Criterio de inclusión | Validación | Rollback lógico |
|-------|-----------|--------------------|--------|-----:|-----------------------|------------|-----------------|
| **TEST-ARCH-12** | controllers (Grupo A audit) | `admin-audit`, `clinic-audit`, `particular-audit` (`.fastify`) | medio | 3 | 1 solo anchor (`audit-suite-completeness`) | `validate:local` | revert del move + revert de 3 paths del registry |
| **TEST-ARCH-13** | controllers (Grupo B study-tracking) | `particular-study-tracking`, `admin-study-tracking`, `study-tracking` (`.fastify`) | medio | 3 | comparten `study-tracking-suite-completeness` (2 también `security-critical-route-surface-registry`) | `validate:local` | revert move + paths en 1–2 registries |
| **TEST-ARCH-14** | `unit/domain` bulk (libre) | grupo §3.2 (6 archivos libres) | **bajo** | 6 | pure domain, sin anchors, sin I/O | `typecheck:test` · `test` | revert del move (0 registries) |
| **TEST-ARCH-15** | `architecture` / `security` guards | `security-*-boundaries` + `api-*-contract` + `smoke-*` + timing/last-access libres | medio | 5–10 | agrupar por eje; actualizar `security-boundary-suite-completeness`/registry en el mismo PR | `test` · `security:public-surface` | revert move + registries |
| **TEST-ARCH-16** | `integration/repositories` (canary) | `logistics-db.test.ts` (o `db-pool-contract`) | medio | 2–4 | fake de DB; **pin de identificador por source en `logistics-db`** — conservar el nombre al mover | `typecheck:test` · `test` | revert move |
| **TEST-ARCH-17** | `integration/external-services` (canary) | `email-gmail-api` (libre) → luego `supabase-*` | medio-alto | 1–3 | empezar por el libre; los `supabase-*` exigen `storage-suite-completeness`+registry | `typecheck:test` · `test` | revert move + registries |
| **TEST-ARCH-18** | `e2e` (canary) | subcarpetas `flows/`/`features/` dentro de `frontend/e2e` | alto | 1–3 | físico en `frontend/e2e`; cuidado con scripts | `--dir frontend e2e:smoke` | revert move + re-anclar snapshots |
| **TEST-ARCH-controllers-D** | controllers (Grupo D reports/tokens) | los 11 multi-anclados de §3.1 | alto | subdividir | requiere tocar 2–3 registries; **subdividir por registry** | `validate:local` | revert move + varios registries |
| **TEST-ARCH-frontend-R2** | `unknown / needs audit` | los 147 `frontend-*` | alto | por archivo | **no es move mecánico**: decidir architecture-guard vs reemplazo render/e2e | según destino | por archivo |
| **TEST-ARCH-closeout** | documental | — | nulo | — | actualizar auditoría + convención con estado final y `unknown` residual | `test` · `build` | n/a |

---

## 8. Primer bulk PR recomendado **[PROPUESTO]**

> **[CORRECCIÓN — TEST-ARCH-12/13]** La recomendación original (abajo) asumía que el Grupo A
> era un move de **1 solo registry** con solo 3 actualizaciones de `path:`. **Falso:** el
> trío audit estaba doblemente anclado por el **censo `readdirSync` no recursivo** de
> `audit-suite-completeness` (irreparable con `path:`) y por `readSource` en guards de
> security. TEST-ARCH-12 documentó el bloqueo (0 moves); **TEST-ARCH-13** desbloqueó los
> guards (censos recursivos + `readSource` subdirectory-aware). **Recomendación vigente
> ahora:** **TEST-ARCH-14 — mover Grupo A (audit)** con el patrón corregido descrito abajo.

**TEST-ARCH-14 (post-TEST-ARCH-13) — controller bulk Grupo A: audit controllers.**

- **Categoría:** `integration/adapters/controllers`.
- **Rama sugerida:** `test/enterprise-controller-batch-audit`.
- **Archivos (mover):**
  - `test/admin-audit.fastify.test.ts` → `test/integration/adapters/controllers/admin-audit.fastify.test.ts`
  - `test/clinic-audit.fastify.test.ts` → `test/integration/adapters/controllers/clinic-audit.fastify.test.ts`
  - `test/particular-audit.fastify.test.ts` → `test/integration/adapters/controllers/particular-audit.fastify.test.ts`
- **Edición mínima obligatoria en el mismo PR (patrón corregido):**
  - ajustar el import relativo de profundidad (`../server` → `../../../../server`, patrón probado en batches 6–10);
  - actualizar los 3 `path:` en `test/audit-suite-completeness.test.ts` a la ruta canónica
    del subdirectorio (el **censo recursivo** ahora **exige** que el `path:` refleje la
    ubicación real; el basename ya no basta);
  - actualizar, si se desea trazabilidad, los hints legacy `readSource("test/clinic-audit…")`
    / `readSource("test/particular-audit…")` en los guards de security a la nueva ruta
    (opcional: el resolver subdirectory-aware de TEST-ARCH-13 los tolera aunque queden como
    hint legacy).
- **Tamaño de lote:** 3 (tope efectivo = tamaño del grupo de anchor común).
- **Riesgo:** medio-bajo (guards ya recursivos; patrón `app.inject` probado; dominio homogéneo).
- **Validaciones:** `pnpm validate:local` (`typecheck:test` + `test` + `build`),
  `git diff --stat` para confirmar el alcance.

**Por qué este y no un "controller bulk" de 15:** §3.1 demuestra que los 19
controllers restantes están anclados y que Grupo A es el único trío con **un solo
registry**. Un bulk de 15 tocaría 2–3 registries a la vez, elevando el riesgo de
dejar `pnpm test` rojo. El manifiesto acelera la migración **sin** fingir que el
resto es tan barato como los primeros 10.

---

## 9. Guardrails (recordatorio breve) **[OBSERVADO + PROPUESTO]**

- No runtime (`server/**`, `frontend/src/**`).
- No imports funcionales salvo por el propio movimiento (ajuste de profundidad).
- No assertions nuevas (actualizar un `path:` de registry mantiene una aserción
  existente; **no** es nueva).
- No `package.json`, no `pnpm-lock.yaml`, no deps, no CI.
- No DB / schema / migrations. No producción.
- No credenciales reales. No fixtures con datos productivos reales (solo sintéticos:
  `fixture@example.com`, `test-service-role-key`, `https://example.supabase.co`).
- No mezclar `admin_session_id` con `app_session_id`.
- No exponer tokens, cookies, hashes, secrets ni signed URLs.
- No cachear dashboards privados ni APIs privadas.

---

## 10. Comandos de validación por bulk PR **[OBSERVADO]**

**Terminal 1** = raíz `C:\PORTAL-VETNEB`. Solo lectura para inspección; el `git` de
escritura lo ejecuta Nico manualmente.

```powershell
git status --short --untracked-files=all
git diff --check
git diff --stat
git diff --name-only
pnpm test
pnpm build
gh pr checks --watch
```

Para lotes de movimiento añadir `pnpm typecheck:test`; para controllers,
`pnpm validate:local`; para security/architecture, `pnpm run security:public-surface`.

---

## 11. Sección "No hacer" **[PROPUESTO]**

- **No** volver a micro-lotes de 2–3 para controllers ya probados: agrupar por
  anchor común (§3.1) y mover el grupo entero.
- **No** mover todo el árbol `test/` en un único PR (rompería registries R5 y
  scope-guards R4 → `pnpm test` rojo).
- **No** mezclar controllers con repositories / e2e / security en un mismo PR.
- **No** crear helpers nuevos en un PR de movimiento (los `shared/**` van en PRs
  aditivos aparte).
- **No** introducir mutation testing todavía (post-closeout).
- **No** cambiar el runner (`node:test` ya descubre `test/**`).
- **No** tocar CI para resolver pathing salvo instrucción explícita.
- **No** mover un archivo anclado sin actualizar su registry en el mismo PR.
- **No** tratar los 147 `frontend-*` (R2) como move mecánico: requieren decisión por
  archivo (architecture-guard vs reemplazo render/e2e).

---

*Fin del manifiesto. Documento normativo docs-only: inventaría y planifica la
migración restante de la suite de tests VETNEB con evidencia del repo, sin mover ni
editar tests, imports ni runtime. Distingue **[OBSERVADO]** de **[PROPUESTO]** y deja
explícito el residual **unknown / needs audit**.*
