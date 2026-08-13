# Dashboard Pitch-Locked Capacity Engine Roadmap

Roadmap ejecutable para la arquitectura **Opción D — Pitch-Locked Canvas + Single Capacity
Engine**. Sustituye la capacidad adaptativa actual (derivada del contenido renderizado) por una
función pura de la geometría.

Este documento es la única entrega de la sesión que lo creó: la implementación quedó **bloqueada
por una precondición externa** (ver *Blocking Precondition*). Está escrito para que otro agente
pueda ejecutar el PR único leyendo exclusivamente `AGENTS.md`, este roadmap y el código.

## Status

| Campo | Valor |
|---|---|
| Estado | `ROADMAP_ONLY` — implementación **BLOCKED** |
| Decisión de producto | Opción D **autorizada por Nico** (principio de pitch-lock incluido) |
| Modo de entrega previsto | **PR único** (`MODE=IMPLEMENT_SINGLE_PR`) cuando se levante la precondición |
| Rama prevista | `refactor/dashboard-pitch-locked-capacity-engine`, creada desde `main` **actualizado** |
| Prohibido | Ampliar `test/dashboard-a03-freeze-post-a05`; apilar sobre PR #1650 |
| Fecha de redacción | 2026-08-13 |
| SHA de análisis | `377890816843c19e5fa9e86e6f99c8722376c093` (head de PR #1650) |

## Decision

**Opción D — Pitch-Locked Canvas + Single Capacity Engine.**

Seleccionada frente a tres alternativas con matriz ponderada (determinismo A→B→A 30 %,
correctitud Zero Scroll 25 %, performance 20 %, mantenibilidad 15 %, riesgo de migración 10 %):

| Opción | Score |
|---|---|
| A — Grid Ledger + Single Canvas Owner | 7.25 |
| B — Capacity Engine central (snapshot + pureza) | 7.40 |
| C — CSS-first / container-query capacity | 5.20 *(rechazada)* |
| **D — Pitch-Locked Canvas + Single Capacity Engine** | **9.00** |

D subsume A (chasis de grid) y B (snapshot coherente + función pura), y añade lo que a ambas les
falta: **hacer que el argumento de la función sea tan puro como la función**. A y B mejoran *cómo*
se mide el pitch; D elimina la medición del pitch.

C se rechaza por motivos técnicos, no de preferencia: CSS no puede entregar el `limit` de fetch
como `number` sin volver a medir; ocultar filas con CSS haría mentir al pager y produciría
clipping; y sustituir `floor(H/pitch)` por tiers discretos exigiría enumerar cortes por módulo —
la matriz de excepciones que este trabajo existe para eliminar.

## Blocking Precondition

**PR #1650 no está mergeado en `main`, y `main` no contiene la baseline runtime sobre la que se
auditó la Opción D.**

Verificado en modo lectura el 2026-08-13:

```
gh pr view 1650 --repo LABVETNEB/PORTAL-VETNEB \
  --json state,mergedAt,headRefName,baseRefName,headRefOid,mergeable,mergeStateStatus
```

```json
{ "state": "OPEN", "mergedAt": null, "mergeable": "MERGEABLE",
  "mergeStateStatus": "BLOCKED", "baseRefName": "main",
  "headRefName": "test/dashboard-a03-freeze-post-a05",
  "headRefOid": "377890816843c19e5fa9e86e6f99c8722376c093" }
```

```
git log origin/main -1 --oneline          → 8d533c33 fix(dashboard): keep logistics mobile actions reachable (#1648)
git rev-list --count origin/main..HEAD    → 9
git merge-base --is-ancestor 11e735c5 origin/main   → NO   (A05 no está en main)
git merge-base --is-ancestor 37789081 origin/main   → NO
git cat-file -e origin/main:frontend/src/components/dashboard/adaptiveRowPitchCalibration.ts → NO
git cat-file -e origin/main:frontend/e2e/regression/dashboard-limit-invariance.spec.ts       → NO
```

Dos fallos independientes de las condiciones `GO_SINGLE_PR`:

1. **Condición 1 falla** — #1650 sigue `OPEN`.
2. **Condición 2 falla** — `main` (`8d533c33`) **no contiene**:
   - `frontend/src/components/dashboard/adaptiveRowPitchCalibration.ts`, cuya retirada es la
     Fase Interna G;
   - `frontend/e2e/regression/dashboard-limit-invariance.spec.ts` (A05), que es **la evidencia
     de aceptación** de la propiedad A→B→A.

Implementar Opción D contra `8d533c33` significaría escribir el motor sin el test que demuestra
que funciona y retirar un módulo que no existe. El diff resultante no sería revisable ni
reversible como unidad.

> `origin/main` es una referencia de seguimiento local y podría estar desactualizada (esta sesión
> tiene prohibido `git fetch`). La conclusión no depende de ello: como #1650 está `OPEN`, sus
> 9 commits — incluido A05 — no pueden estar en `main` por ninguna vía.

## Baseline

| Campo | Valor |
|---|---|
| Rama de análisis | `test/dashboard-a03-freeze-post-a05` |
| HEAD de análisis | `377890816843c19e5fa9e86e6f99c8722376c093` |
| `main` local | `8d533c33` (#1648) |
| Commits de #1650 | 9 (`da7dc189` … `37789081`) |
| Working tree | limpio en tracked; staged vacío; untracked = `scratchpad/**` (preservado) |
| Stashes | 4, intactos |
| `AGENTS.md` | 1 único archivo versionado (raíz). Sin AGENTS anidados |
| Next / React | `next@^16.2.11`, `react@^19.2.8` |
| `browserslist` | **no configurado** en `frontend/package.json` ni `.browserslistrc` → target por defecto de Next 16 |

## Root Cause

**`capacity` no es hoy una función de la geometría.** Es una función de:

```
capacity = f( geometría, historial de render, identidad de la fila 0,
              orden de llegada de dos setState, qué rAF sobrevivió al teardown
              del efecto, qué respuesta HTTP llegó primero, qué había en la
              caché LRU de 16 entradas )
```

Seis de esos siete argumentos dependen del **camino recorrido**, no del estado. Por eso
`A → B → A` no está obligado a devolver `N`.

Cadena causal concreta, con `admin-audit-log` en desktop como caso de referencia:

```
1. CSS calcula un ledger completo (--dash-data-canvas-h)          ← fuente de verdad #1
2. JS lo IGNORA y mide getBoundingClientRect() del canvas          ← fuente de verdad #2
3. JS resta constantes mágicas propias (32 / 6 / 8) que duplican el ledger
4. JS mide el PITCH desde una fila renderizada real (index === 0)  ← fuente de verdad #3
5. Esa fila está keyed por row.id ⇒ se desmonta en cada refetch
6. Al desmontarse, el pitch cae a otra constante mágica (36)       ← fuente de verdad #4
7. Pitch y altura los publican DOS observers distintos, por setState,
   sin snapshot común
8. Cambiar el pitch está en el array de deps del efecto del hook ⇒
   destruye el observer y cancela el rAF pendiente
9. El valor latcheado NO se resetea; sólo un nuevo resize del contenedor
   lo corrige — y en un viewport devuelto no lo hay
10. floor() evaluado en su discontinuidad:
    N = clamp(floor((H - 32 - 14) / pitch), 1, 9)
    N = 9 exige H >= 379 con pitch = 37.00
    N = 9 exige H >= 379.5 con pitch = 37.05
    ⇒ una deriva de 0.05 px en el pitch da 8 SIN QUE H CAMBIE
11. El resultado alimenta query.limit ⇒ fetch ⇒ nuevas filas ⇒ paso 4.
    El bucle se cierra A TRAVÉS DE LA RED.
```

Síntoma observado en CI: `A05 · admin-audit-log::w1440x900: A -> B -> A limit — Expected: 9,
Received: 8`. El mismo patrón apareció en `clinic-particular-tokens` (SHA `9d3d97b8`) y en
`logistics-recent-list` (SHA `61c55906`). **No son tres bugs: son tres muestras de la misma
distribución.** Cada módulo tiene su propio borde de `floor`; falla el que ese día quedó más
cerca del suyo.

## Confirmed Evidence

Todo verificado por lectura de código en `377890816843c19e5fa9e86e6f99c8722376c093`.

| # | Hecho | Evidencia |
|---|---|---|
| H1 | `useAdaptiveRowsPerPage` **no es una abstracción distinta**: delega íntegramente en `useAdaptiveItemsPerPage`; sólo renombra campos y fija `minItems ?? 2` | `frontend/src/hooks/useAdaptiveRowsPerPage.ts:27-38` |
| H2 | `useAdaptiveDashboardPageSize` es el mismo algoritmo con tres términos de reserva extra | `useAdaptiveDashboardPageSize.ts:118-128` vs `useAdaptiveItemsPerPage.ts:97-105` |
| H3 | El pitch se mide de un `<TableRow key={row.id} ref={index === 0 ? desktopRowRef : undefined}>` | `frontend/src/app/dashboard/admin/AdminAuditDenseTable.tsx:72` |
| H4 | Al desmontarse la fila 0, el pitch colapsa a la constante `36` vía `?? 0` → fallback | `AdminAuditCard.tsx:150,155`; `ADMIN_AUDIT_ROW_HEIGHT_FALLBACK_PX = 36` (l.36) |
| H5 | Dos ResizeObservers sobre el mismo nodo sin atomicidad ni versionado | `AdminAuditCard.tsx:117-179` + `useAdaptiveItemsPerPage.ts:77-148` |
| H6 | `itemHeightPx` está en el array de deps ⇒ cada cambio de pitch destruye el observer y ejecuta `cancelAnimationFrame(frame)` | `useAdaptiveItemsPerPage.ts:134-148` |
| H7 | El valor latcheado (`itemsPerPageRef`, `measuredRef`) **no se resetea** al re-armar el efecto | `useAdaptiveItemsPerPage.ts:75,110-113`; `useAdaptiveDashboardPageSize.ts:100,135-143` |
| H8 | La capacidad cierra el bucle a través de la red: `rowsPerPage → effectiveLimit → query.limit → getAdminAuditPage → setRows → fila 0 → pitch` | `AdminAuditCard.tsx:196-240` |
| H9 | `admin-audit-log` desktop está clavado en su techo: `maxItems = ADMIN_AUDIT_FALLBACK_ROWS = 9`. Sólo la caída es observable | `AdminAuditCard.tsx:27,205-207` |
| H10 | El equipo ya nombró la histéresis: *"the same viewport settles on a different page size depending on which page was active … and A -> B -> A does not return to A"* | `adaptiveRowPitchCalibration.ts:1-33` |
| H11 | El calibrador está cableado en **1 de 17** consumidores | censo §*Consumer Census* |
| H12 | El calibrador introduce estado que sobrevive a A→B→A: LRU de `DEFAULT_CACHED_GEOMETRIES = 16`, clave `inlineSize x blockSize n itemCount` | `adaptiveRowPitchCalibration.ts:42,133-162` |
| H13 | **Bajo A05 esa caché se desborda por diseño**: 13 viewports × 5 escenarios = **65 geometrías por módulo** contra 16 ranuras ⇒ evicción garantizada ⇒ la garantía *"frozen and replayed"* no se sostiene en el workload que debe proteger | `dashboard-limit-invariance.spec.ts:145-211` |
| H14 | Ledger CSS completo y sano: `--dash-viewport-h → --dash-main-h → --dash-module-canvas-h → --dash-data-canvas-h` | `frontend/src/styles/dashboard/zero-scroll.css:17-48` |
| H15 | `zero-scroll.css` = 336 líneas, **0 `!important`, 0 selectores `data-dashboard-module=`**, 3 `:has()`, 7 `@media`. La deuda por excepciones **no está ahí** | conteos sobre el archivo |
| H16 | Container queries: **no usadas en ningún CSS del repo todavía** | `git ls-files "frontend/src/**/*.css"` + grep `container-type\|@container` → 0 |
| H17 | En el fallo real, las aserciones de invariancia **dentro** del viewport A (l.171-182) **pasaron**; la que falló es la de la vuelta (l.207). La l.208 (`canvasBlockSize` tras la vuelta) **nunca llegó a ejecutarse** | log CI + `dashboard-limit-invariance.spec.ts:171-211` |

### Feedback loops identificados

| # | Loop | Estado hoy |
|---|---|---|
| L1 | `pitch → capacity → nº filas → contenido fila 0 → pitch` | ABIERTO en 16/17 consumidores |
| L2 | `capacity → query.limit → fetch HTTP → rows → remount fila 0 → pitch=36 → capacity` | ABIERTO en los 9 consumidores server-paged |
| L3 | `pitch → deps → teardown → cancelAnimationFrame → medición descartada → valor obsoleto` | ABIERTO en los 3 hooks |
| L4 | `capacity → nº filas → altura canvas → geometryKey → pitch cacheado → capacity` | ABIERTO en `LogisticsRecentListCanvas` |
| L5 | `MutationObserver(subtree) → observeRows → RO por fila → measure → render → mutación` | ACOTADO por probe budget, no eliminado |
| L6 | `capacity → setPage(CANONICAL) → slice distinto → pitch → capacity` | El efecto de medición escribe la página del usuario |

**Objetivo de la Opción D: cero.**

## Target Architecture

```
VIEWPORT (100dvh)
  ↓
CSS LEDGER            (--dash-topbar-h, --dash-horizontal-nav-h,
                       --dash-bottom-nav-h, --dash-safe-bottom, --dash-pagination-h)
  ↓
MODULE GRID           grid-template-rows: auto / auto / minmax(0,1fr) / auto
  ↓
DATA CANVAS FINAL     [data-dashboard-adaptive-rows-canvas="true"]
  ↓
1 ResizeObserver      (1 target: el canvas)
  ↓
1 coherent snapshot   (todas las lecturas en el mismo rAF, antes de cualquier escritura)
  ↓
computeCapacity()     PURA — sin DOM, sin React, sin closure mutable, sin caché
  ↓
capacity: number
  ↓
render / pager / contrato de request existente
```

**El contenido está al final del grafo. Ninguna flecha vuelve hacia arriba.**

### Component graph

```
DashboardAppShell                  grid: auto / auto / minmax(0,1fr) / auto
└── ModuleSurface                  grid: auto / auto / minmax(0,1fr) / auto
    ├── ModuleHeader               track 1  auto
    ├── ModuleToolbar / Filters    track 2  auto
    ├── AdaptiveCanvas             track 3  minmax(0,1fr)   ← ÚNICO nodo observado
    │   └── rows                   block-size: var(--dash-row-pitch)
    └── DashboardPager             track 4  auto            ← siempre en flow
```

### Event flow

```
resize del viewport
  └─ ResizeObserver(canvas)                         [1 callback]
       └─ requestAnimationFrame                     [coalescing; máx. 1 por frame]
            ├─ DOM READ: canvas.getBoundingClientRect()          (1 lectura)
            ├─ DOM READ: pitch del tier (memoizado por tier)     (0 en régimen)
            ├─ quantise(blockSize), quantise(pitch)              (puro)
            ├─ computeCapacity(...)                              (puro)
            └─ si capacity !== capacityRef → setCapacity()       [0 o 1 commit]
```

### State machine

```
UNMEASURED  ──(primer snapshot válido)──►  MEASURED(N)
MEASURED(N) ──(snapshot con mismo N)────►  MEASURED(N)     [0 commits]
MEASURED(N) ──(snapshot con N' ≠ N)─────►  MEASURED(N')    [1 commit]
```

Tres estados, dos transiciones. Sin `calibrating`, sin `settled`, sin `probes`, sin caché.

## Invariants

### Capacidad

```
capacity = f(canvasBlockSizePx, rowPitchPx, reservedPx, minItems, maxItems)
```

y **nada más**. `capacity` no puede depender de: contenido de la primera fila, identidad
`row.id`, página actual, respuesta HTTP previa, histórico de resize, caché de geometrías, fuente
todavía cargándose, `MutationObserver`, orden entre observers, ni estado anterior del hook.

```
f(A) = N ;  f(B) = M ;  f(A) = N     SIEMPRE
```

### Zero Scroll (AGENTS.md §10 — no debilitables)

```
SCROLL_VERTICAL_DEL_DOCUMENTO   = 0
SCROLL_HORIZONTAL_DEL_DOCUMENTO = 0
SCROLL_INTERNO_NO_AUTORIZADO    = 0
ACCIONES_CRÍTICAS_VISIBLES      = 100%
SOLAPAMIENTOS_DE_LAYOUT         = 0
```

### Owner único (exigibles por guard de arquitectura)

```
ResizeObservers por surface   = 1
targets observados            = 1   (el canvas)
MutationObservers             = 0
observers sobre filas         = 0
DOM writes desde el hook      = 0
setPage desde el hook         = 0
deps del useLayoutEffect      = [canvasNode, enabled]   exactamente
caché geométrica con estado   = 0
```

## Single-PR Feasibility Analysis

Evaluación de las seis condiciones `GO_SINGLE_PR`:

| # | Condición | Estado | Nota |
|---|---|---|---|
| 1 | #1650 MERGED en `main` | **NO** | `state: OPEN`, `mergedAt: null` |
| 2 | `main` contiene la baseline runtime auditada | **NO** | Faltan el calibrador y la spec A05 |
| 3 | Scope primario único = frontend runtime; tests/docs como supporting | **SÍ** | Ver justificación abajo |
| 4 | Sin cambios en backend/DB/schema/migrations/workflows/`package.json`/lockfile/deps/settings | **SÍ** | El motor es aritmética; container queries son CSS nativo |
| 5 | Una sola causa arquitectónica | **SÍ** | `capacity` depende de historia/render/contenido |
| 6 | Rollback único: revertir el PR restaura la arquitectura anterior | **SÍ** | Ningún cambio de datos, contrato HTTP ni migración |

**4 de 6 se cumplen. Las dos que fallan son de base, no de diseño.**

### Por qué el PR único SÍ es defendible una vez levantada la precondición

- **Un scope primario.** Todo el diff vive bajo `frontend/src/**` (runtime + CSS). Los cambios en
  `test/**` y `frontend/e2e/**` son **realineamiento de guards que el cambio in-scope rompe
  legítimamente** — AGENTS.md §4 exige que se realineen **en el mismo PR** y prohíbe entregarlos
  aparte, debilitarlos o marcarlos skip. No son un segundo scope: son la condición de que el
  primero esté bien hecho.
- **Una causa.** Un único defecto arquitectónico (`capacity` depende del render). Migrar la mitad
  de los consumidores dejaría dos arquitecturas de capacidad conviviendo, con dos semánticas de
  A→B→A distintas y un guard de owner único que no podría afirmarse.
- **Un rollback.** `git revert` del PR restaura los tres hooks, el calibrador y todos los
  consumidores a la vez. Un split por lotes crearía estados intermedios donde `main` tiene el
  motor nuevo y consumidores viejos: reversible, pero con dos verdades sobre la mesa.
- **Un documento.** `docs/implementation/dashboard-pitch-locked-capacity-engine.md` describe una
  arquitectura, no seis fragmentos.

### Riesgo asumido del PR único, y su mitigación

El diff tocará ~17 consumidores + ~23 guards + 4 archivos nuevos. Es grande para revisión humana.
Mitigación **obligatoria**: las Fases Internas A–I de este roadmap se ejecutan en orden,
fail-fast, cada una con su gate dirigido, de modo que el diff final esté construido por capas
verificadas y el revisor pueda leerlo en ese mismo orden. Si al terminar la Fase E el diff resulta
inmanejable en revisión, **el ejecutor debe detenerse y consultar a Nico** antes de continuar; esa
es la única salida legítima hacia un split, y es decisión suya, no del agente.

## Why Implementation Is Blocked

Resumido, con las dos razones separadas:

1. **PR #1650 está abierto.** Implementar Opción D en una rama nueva desde `main` produciría un PR
   que no compila contra el runtime auditado; implementarlo sobre `test/dashboard-a03-freeze-post-a05`
   convertiría #1650 en la PR arquitectónica — expresamente prohibido por el encargo y por
   AGENTS.md §4 (un scope primario por PR).
2. **`main` carece de la evidencia de aceptación.** Sin `dashboard-limit-invariance.spec.ts` en
   `main` no existe el test que demuestra `returnedA.limit === initialA.limit`. La Opción D se
   entregaría sin poder probar su propiedad central.

Ninguna de las dos se resuelve con trabajo del agente: dependen de que Nico cierre #1650.

## Required Base Commit

```
main, con PR #1650 mergeado (squash), es decir:
  git merge-base --is-ancestor 11e735c5 origin/main   → 0   (A05 presente)
  git cat-file -e origin/main:frontend/e2e/regression/dashboard-limit-invariance.spec.ts        → 0
  git cat-file -e origin/main:frontend/src/components/dashboard/adaptiveRowPitchCalibration.ts  → 0
```

Preparación de rama, sólo cuando lo anterior se cumpla (R1 — requiere que Nico haya pedido
implementación en la tarea de entonces):

```powershell
git fetch --prune
git switch main
git pull --ff-only origin main
git status --short
git switch -c refactor/dashboard-pitch-locked-capacity-engine
```

**No** apilar sobre `test/dashboard-a03-freeze-post-a05`. **No** merge, rebase ni cherry-pick.

## Scope

**PRIMARY SCOPE: frontend runtime.**

Incluye: motor puro de capacidad, hook single-owner, tokens y contrato de pitch en CSS, migración
de los 17 consumidores, retirada de los 4 owners legacy, realineamiento de los guards que el
cambio rompe, y el documento arquitectónico.

## Explicit Exclusions

Fuera de alcance en **todas** las fases. Tocar cualquiera de estos ⇒ `SINGLE_PR_FEASIBILITY=NO`
y volver a modo roadmap explicando por qué.

| Excluido | Motivo |
|---|---|
| `server/**`, endpoints, contratos HTTP | La capacidad sigue viajando como `limit` con idéntica semántica |
| DB, Drizzle, schema, migraciones | Sin relación. R2/R3 sin autorización |
| Auth, sesiones, cookies, CORS, CSP, rate limits | Invariantes de AGENTS.md §9 preservadas |
| `.github/workflows/**`, configuración CI | R2 |
| `package.json`, `frontend/package.json`, `pnpm-lock.yaml`, dependencias | **Cero dependencias nuevas.** Prohibido cualquier polyfill |
| `globalTimeout`, `--retries`, `test.setTimeout`, timeouts de Playwright | No se tocan |
| `waitForAdaptiveConvergence`, `ADAPTIVE_STABLE_RENDER_REPEATS` | **No se tocan en ninguna fase.** Si el determinismo permite simplificarlos, se demuestra con medición en un PR posterior |
| PR #1650 y su rama; planificación serial de A05 (`mode: "serial"`) | Scope primario distinto (test-only) |
| Refactor de `mobile-admin.css` (698 líneas) / `globals.css` (1586) | Deuda declarada, auditoría propia |
| Producción y staging | Sin despliegues. R3 |

## Consumer Census

Recalculado en `377890816843c19e5fa9e86e6f99c8722376c093` — **no heredado de la auditoría previa**.

Comando de recuento:

```powershell
git ls-files "frontend/src/**/*.tsx" "frontend/src/**/*.ts" | ForEach-Object {
  if (Select-String -Path $_ -Pattern "\buseAdaptiveItemsPerPage\b" -List) { $_ } }
```

### `useAdaptiveItemsPerPage` — 9 consumidores (gramática de **tabla**, server-paged)

| # | Archivo | Línea del hook |
|---|---|---|
| 1 | `frontend/src/app/dashboard/admin/AdminAuditCard.tsx` | 196 |
| 2 | `frontend/src/app/dashboard/admin/AdminClinicsManagementCard.tsx` | 241 |
| 3 | `frontend/src/app/dashboard/admin/AdminFailedLoginAlertsReadOnlyCard.tsx` | 215 |
| 4 | `frontend/src/app/dashboard/admin/AdminParticularTokensCard.tsx` | 626 |
| 5 | `frontend/src/app/dashboard/admin/AdminPricingEditorCard.tsx` | 323 |
| 6 | `frontend/src/app/dashboard/admin/AdminReportsCard.tsx` | 357 |
| 7 | `frontend/src/app/dashboard/admin/AdminSessionsReadOnlyCard.tsx` | 226 |
| 8 | `frontend/src/app/dashboard/admin/AdminUsersRolesReadOnlyCard.tsx` | 300 |
| 9 | `frontend/src/app/dashboard/informes/InformesReportsList.tsx` | 262 |

### `useAdaptiveRowsPerPage` — 6 consumidores (gramática de **lista**)

| # | Archivo | Línea del hook |
|---|---|---|
| 10 | `frontend/src/app/dashboard/ClinicInformesWorkspaceSummary.tsx` | 242 |
| 11 | `frontend/src/app/dashboard/ClinicLogisticaWorkspaceSummary.tsx` | 103 |
| 12 | `frontend/src/app/dashboard/admin/AdminMaintenanceDryRunCard.tsx` | 165 |
| 13 | `frontend/src/app/dashboard/admin/AdminMobileMaintenanceModule.tsx` | 248 |
| 14 | `frontend/src/app/dashboard/admin/AdminMobilePricingModule.tsx` | 204 |
| 15 | `frontend/src/components/dashboard/ClinicParticularTokensCard.tsx` | 488 |

### `useAdaptiveDashboardPageSize` — 2 consumidores (**compuestos**)

| # | Archivo | Línea del hook | Nota |
|---|---|---|---|
| 16 | `frontend/src/app/dashboard/logistica/LogisticsBoundedCanvas.tsx` | 53 | Usa las 3 reservas extra |
| 17 | `frontend/src/app/dashboard/logistica/LogisticsRecentListCanvas.tsx` | 46 | **PILOTO.** Único consumidor del calibrador (l.67) |

### Referencia sin consumo

| Archivo | Naturaleza |
|---|---|
| `frontend/src/app/dashboard/page.tsx:43` | **Sólo comentario** (`// page size stays owned by useAdaptiveRowsPerPage inside each workspace`). No es consumidor. Debe actualizarse para que el comentario no quede mintiendo tras la migración |

```
CONSUMER_CENSUS_BEFORE = 17 consumidores reales + 1 referencia en comentario
CONSUMER_CENSUS_AFTER  = 0   (exigido antes de la Fase Interna G)
```

> La auditoría previa reportó 18. El recuento estricto da **17**: `page.tsx` es una mención en
> comentario, no una invocación. Diferencia registrada deliberadamente.

## Guard Census

Comando de recuento:

```powershell
git ls-files "test/**/*.ts" "frontend/e2e/**/*.ts" | ForEach-Object {
  if (Select-String -Path $_ -Pattern "useAdaptiveItemsPerPage|useAdaptiveRowsPerPage|useAdaptiveDashboardPageSize|adaptiveRowPitchCalibration|createAdaptiveRowPitchCalibrator" -List) { $_ } }
```

### Anclados por nombre de hook/calibrador — 23 archivos

**`test/unit/ui/admin/` (13)**

`admin-adaptive-row-pitch-stability.test.ts` · `admin-audit-enterprise-density.test.ts` ·
`admin-mobile-core-pager-canonical-layout.test.ts` · `admin-reports-enterprise-density.test.ts` ·
`admin-sessions-enterprise-density.test.ts` · `admin-tokens-enterprise-density.test.ts` ·
`admin-users-roles-enterprise-density.test.ts` · `frontend-admin-clinics-management-card.test.ts` ·
`frontend-admin-failed-login-alerts-card.test.ts` · `frontend-admin-maintenance-dry-run-card.test.ts` ·
`frontend-admin-sessions-card.test.ts` · `frontend-admin-sessions-read-only-card.test.ts` ·
`frontend-admin-users-roles-card.test.ts`

**`test/unit/ui/dashboard/` (6)**

`dashboard-adaptive-row-pitch-calibration.test.ts` *(su sujeto desaparece en la Fase G)* ·
`dashboard-stable-geometry-reservation.test.ts` · `frontend-dashboard-clinic-tokens.test.ts` ·
`frontend-dashboard-home.test.ts` · `frontend-dashboard-informes.test.ts` ·
`frontend-dashboard-reports-master-detail.test.ts`

**`frontend/e2e/` (4)**

`admin/users/admin-users-visual-quality-gate.spec.ts` ·
`clinic/tokens/dashboard-clinic-tokens-mobile-parity.spec.ts` ·
`helpers/dashboard-adaptive-limit-matrix.ts` ·
`platform/app-shell/dashboard-global-masked-master-detail.spec.ts`

### Anclados sólo por `ResizeObserver` — revisar, no necesariamente tocar

`test/unit/ui/dashboard/frontend-dashboard-logistica-metricas.test.ts` ·
`frontend-dashboard-logistica-rutas.test.ts` · `frontend-dashboard-logistica-visitas.test.ts`

### Contratos de geometría que **no** se realinean por reflejo

`frontend/e2e/regression/dashboard-adaptive-limit-baseline.spec.ts` (A03) ·
`dashboard-geometry-baseline.spec.ts` (A02) ·
`dashboard-limit-invariance.spec.ts` (A05)

Sujetos al protocolo de *A03/A05 Strategy*.

**Regla absoluta (AGENTS.md §4):** los guards se **realinean en el mismo PR**; nunca se debilitan,
se silencian ni se marcan como skip. Borrar un guard porque molesta es motivo de rechazo del PR.

## Files To Create

| Archivo | Responsabilidad |
|---|---|
| `frontend/src/lib/dashboard/capacity/computeCapacity.ts` | Motor puro: `computeCapacity`, `quantise`, tipos. Sin DOM, sin React, sin closure mutable, sin caché global |
| `frontend/src/hooks/useDashboardCanvasCapacity.ts` | Único owner DOM: 1 RO, 1 target, 1 rect, ≤1 commit |
| `test/unit/ui/dashboard/dashboard-capacity-engine.test.ts` | Unit del motor puro (plan completo abajo) |
| `test/architecture/dashboard-capacity-single-owner.test.ts` | Guard de arquitectura (plan completo abajo) |
| `docs/implementation/dashboard-pitch-locked-capacity-engine.md` | Documento arquitectónico de la migración ejecutada |

### Justificación del path del motor

`frontend/src/lib/dashboard/capacity/computeCapacity.ts` en lugar de
`frontend/src/components/dashboard/` (donde vive hoy `adaptiveRowPitchCalibration.ts`): el módulo
no es un componente ni renderiza nada. `frontend/src/lib/` es la ubicación existente para lógica
pura del repo (`frontend/src/lib/api.ts`, `frontend/src/lib/dashboard/`). Colocarlo bajo
`components/` reproduciría la mezcla de capas que este trabajo elimina.

## Files To Modify

| Archivo | Cambio | Fase |
|---|---|---|
| `frontend/src/styles/dashboard/tokens.css` | +3 tokens `--dash-row-pitch-*` | B |
| `frontend/src/styles/dashboard/zero-scroll.css` | Tier de densidad + pitch-lock de fila | B |
| `frontend/src/app/dashboard/logistica/LogisticsRecentListCanvas.tsx` | **Piloto** | C |
| Los 6 consumidores de lista (#10–#15) | Migración | D |
| Los 9 consumidores de tabla (#1–#9) | Migración | E |
| `frontend/src/app/dashboard/logistica/LogisticsBoundedCanvas.tsx` | Migración compuesta | F |
| `frontend/src/app/dashboard/page.tsx:43` | Actualizar el comentario obsoleto | F |
| 23 guards anclados | Realineamiento | H |

## Files To Retire

Sólo cuando su contador de consumidores llegue a **0**, verificado por grep, **nunca antes**.

| Archivo | Fase | Motivo |
|---|---|---|
| `frontend/src/components/dashboard/adaptiveRowPitchCalibration.ts` | G | 302 líneas de caché para un bucle que deja de existir; su LRU de 16 es además estado que sobrevive a A→B→A (H12–H13) |
| `frontend/src/hooks/useAdaptiveRowsPerPage.ts` | G | Wrapper puro sin lógica propia (H1) |
| `frontend/src/hooks/useAdaptiveItemsPerPage.ts` | G | Sustituido |
| `frontend/src/hooks/useAdaptiveDashboardPageSize.ts` | G | Sustituido |
| `test/unit/ui/dashboard/dashboard-adaptive-row-pitch-calibration.test.ts` | G | Su sujeto desaparece |

## Internal Implementation Phases

Fases **internas del PR único**. Fail-fast: si una falla, se diagnostica y se corrige antes de
continuar. **El agente no ejecuta `git add`/`commit`/`push` en ninguna fase.**

Una tarea pesada a la vez (AGENTS.md §8). Sin watchers. Sin builds paralelos. No repetir un gate
que ya pasó si el código que cubre no volvió a cambiar.

### Fase A — Motor puro

Crear `computeCapacity.ts` + `dashboard-capacity-engine.test.ts`.

**A.0 — Medir el subpixel variance ANTES de fijar el quantum.** No adoptar `1/64 px` porque la
auditoría lo propusiera. Instrumentar una corrida dirigida que registre `blockSize` del canvas en
las dos visitas al mismo viewport:

```bash
pnpm --dir frontend exec playwright test e2e/regression/dashboard-limit-invariance.spec.ts --project=chromium -g "logistics-recent-list" --workers=1 --retries=0
```

Registrar la dispersión observada de `canvasBlockSize` entre `A_initial` y `A_returned`. Elegir
**el quantum más pequeño que la absorba** y documentar la medición en el documento arquitectónico.
Si la dispersión es 0, el quantum es 0 y `quantise` es la identidad — resultado válido y preferible.

Gate: `pnpm test` dirigido al nuevo spec. **Sin runtime tocado todavía.**

### Fase B — Owner único + contrato de pitch + guards

- `useDashboardCanvasCapacity.ts`.
- Tokens `--dash-row-pitch-{compact,regular,tall}` en `tokens.css`.
- Tier de densidad + `block-size: var(--dash-row-pitch)` en `zero-scroll.css`.
- `dashboard-capacity-single-owner.test.ts`.

**Verificación de soporte de container queries antes de usarlas.** El repo **no tiene
`browserslist`** (ni en `frontend/package.json` ni `.browserslistrc`), por lo que rige el target
por defecto de `next@^16.2.11`. `container-type: inline-size` es Baseline desde 2023 y está por
debajo de ese target, pero **hay que confirmarlo contra el target efectivo del build**, no
asumirlo. Además, `container-type: inline-size` **crea un contexto de contención**: censar
descendientes con `position: absolute` colgando de un canvas adaptativo antes de aplicarlo.

Si el soporte no cumpliera: **no instalar polyfill, no añadir dependencia**. Alternativa
determinista compatible: resolver el tier con `@media` sobre el viewport. Sigue siendo función de
la geometría y conserva la propiedad A→B→A, a costa de precisión en layouts anidados.

Gate: `pnpm --dir frontend lint` → `typecheck` → `pnpm test` dirigido al guard nuevo.

### Fase C — PILOTO: `LogisticsRecentListCanvas`

Sustituir `useAdaptiveDashboardPageSize` + calibrador por `useDashboardCanvasCapacity`. Debe
**eliminar del consumidor**: el `MutationObserver` (l.156-160), los `observer.observe(row)` por
fila (l.151-155), el `setPageRef.current(outcome.requestedPage)` (l.129-131) y el
`createAdaptiveRowPitchCalibrator` (l.65-68).

Gate dirigido:

```bash
pnpm --dir frontend exec playwright test e2e/regression/dashboard-limit-invariance.spec.ts --project=chromium -g "logistics-recent-list" --workers=1 --retries=0
```

Después, determinismo:

```bash
pnpm --dir frontend exec playwright test e2e/regression/dashboard-limit-invariance.spec.ts --project=chromium -g "logistics-recent-list" --workers=1 --retries=0 --repeat-each=3
```

**Cero flaky admitido.** No continuar si falla.

### Fase D — Consumidores de lista (#10–#15)

Migrar los 6. Validar el grupo con los specs dirigidos de cada superficie + `e2e:affected`.

### Fase E — Consumidores de tabla / server-paged (#1–#9)

**Frontera crítica: `FETCH WINDOW != VISIBLE CAPACITY`.**

- No alterar semántica de backend, endpoints ni DB.
- No cambiar `offset` arbitrariamente: preservar la lógica de reencuadre existente
  (p. ej. `AdminAuditCard.tsx:245-260`).
- Cada consumidor conserva su contrato previo (server pagination o client pagination).
- Retirar únicamente las **constantes mágicas de resta** que CSS ya reserva.

Gate por consumidor + A05 dirigido a `admin-audit-log`.

### Fase F — Consumidores compuestos

`LogisticsBoundedCanvas` (las 3 reservas extra pasan a ser tracks) + corregir el comentario de
`page.tsx:43`.

### Fase G — Retirada de legacy

Sólo si:

```powershell
git ls-files "frontend/src/**/*.tsx" "frontend/src/**/*.ts" | ForEach-Object {
  if (Select-String -Path $_ -Pattern "useAdaptiveItemsPerPage|useAdaptiveRowsPerPage|useAdaptiveDashboardPageSize|createAdaptiveRowPitchCalibrator" -List) { $_ } }
# debe devolver SOLO los propios archivos legacy → LEGACY_CONSUMERS = 0
```

Entonces retirar los 4 owners + el unit test del calibrador. **Nunca antes.**

### Fase H — Realineamiento de guards

Los 23 archivos del censo. Nunca skip, nunca debilitar, nunca borrar.

### Fase I — Documento arquitectónico

`docs/implementation/dashboard-pitch-locked-capacity-engine.md` con: baseline, root cause,
arquitectura, data flow, geometry flow, censo before/after, migración ejecutada, archivos, tests,
performance before/after **medida**, rollback, riesgos y resultado.

## Migration Order

```
A (motor puro, sin runtime)
  → B (owner + CSS + guards)
    → C (PILOTO logistics-recent-list)      ← puerta de calidad: cero flaky en repeat-each=3
      → D (6 listas)
        → E (9 tablas / server-paged)       ← frontera fetch window
          → F (compuestos)
            → G (retirada legacy, LEGACY_CONSUMERS=0)
              → H (23 guards)
                → I (documento)
```

### Por qué `LogisticsRecentListCanvas` es el piloto

- Único consumidor donde el canvas adaptativo ya está **aislado en un componente cliente propio y
  pequeño** (200 líneas, una responsabilidad). El resto son cards de 300–600 líneas.
- **Paginación cliente** (`usePagedRows`, filas server-rendered): **L2 no existe ahí**. Permite
  cerrar L1/L3/L4 sin la latencia HTTP como variable, y deja la frontera `capacity → query.limit`
  intacta para la Fase E, donde es explícita.
- **Retira código en vez de añadir un camino paralelo**: es el único con calibrador. Salen 1
  `MutationObserver` con `subtree: true`, hasta 12 targets de fila y el uso de 302 líneas. El
  antes/después es medible en el mismo archivo.
- Cubre todos los contratos que un piloto debe demostrar: desktop y móvil (hub de logística ⇒
  `--dash-bottom-nav-h` y `--dash-safe-bottom` aplican), pager reservado, `minItems: 1` y
  `maxItems: 12` (los dos extremos del clamp) y zero-scroll (`overflow-hidden`).
- Ya falló en CI: fue la hoja A05 que cayó en `61c55906`, en la posición 14/15 — la que peor
  amplificó el reinicio serial.

**Por qué no los otros:** `admin-audit-log` alimenta un fetch de servidor (L2) y tiene doble
presentación desktop/móvil en el mismo `recompute` — demasiadas variables para la fase 1;
`logistics-bounded-canvas` usa las tres reservas extra, es el caso más complejo del ledger;
`clinic-particular-tokens` es una card de ~500 líneas con drawers y formularios;
`admin-maintenance`/`admin-pricing` tienen su variante móvil en un componente separado.

## A03/A05 Strategy

**Prohibido actualizar un baseline automáticamente porque falle.**

La Opción D puede cambiar legítimamente capacidades observadas (un módulo cuyo pitch real difería
del token pasará a un `N` distinto). Protocolo obligatorio antes de tocar A03:

1. Demostrar que el nuevo resultado es **determinista**.
2. `cold-1` y `cold-2` deben coincidir exactamente.
3. `A → B → A` debe coincidir.
4. No debe existir drift interno dentro de una misma corrida.
5. Explicar, por cada diferencia, **qué cambio geométrico legítimo la produjo**.
6. Sólo entonces realinear el contrato, **en el mismo PR**.

**Si el resultado alterna entre corridas: NO actualizar baseline. Seguir corrigiendo.**

A05 debe verificar, **sin retry**:

```
initialA.limit = N
B.limit        = M
returnedA.limit = N        ⇒  returnedA.limit === initialA.limit
```

## Zero Scroll Proof

| Invariante | Cómo lo garantiza D | Cómo se demuestra |
|---|---|---|
| `SCROLL_VERTICAL_DEL_DOCUMENTO = 0` | Shell en grid de altura `100dvh` con el canvas en `minmax(0,1fr)`: ningún track puede crecer más allá del ledger | `dashboard-internal-no-scroll-contract`, `dashboard-real-app-shell-no-scroll-contract` (cohorte `visual-contract`) |
| `SCROLL_HORIZONTAL_DEL_DOCUMENTO = 0` | El pitch-lock no toca el eje inline | mismos specs |
| `SCROLL_INTERNO_NO_AUTORIZADO = 0` | Con `pitch` **fijo**, `N·pitch ≤ H` es aritméticamente exacto, no aproximado. Hoy la desigualdad depende de que el pitch medido no crezca después del cálculo | `assertNoInternalScroll` (ya presente) + guard contra `overflow-y: auto` |
| `ACCIONES_CRÍTICAS_VISIBLES = 100%` | El pager es un **track de grid**, no un hermano empujable: estructuralmente no puede quedar fuera | `admin-users-roles-pager-reachability.spec.ts` (`nextEnabled`, `nextHitIsOwn`) |
| `SOLAPAMIENTOS_DE_LAYOUT = 0` | Tracks de grid: por definición no se solapan | specs de contrato visual |

**Argumento fuerte.** Hoy la ausencia de scroll interno depende de que `N·pitch_medido ≤ H` siga
siendo cierta *después* de que las filas terminen de crecer. Ese es exactamente el fallo
documentado en `LogisticsRecentListCanvas.tsx:144-150`: *"el pitch se congeló en ~40px en vez de
~51px y el canvas reclamó tres filas donde caben dos, dejando la tercera recortada."* Con el pitch
bloqueado, **las filas no crecen**: la desigualdad es exacta al calcularse y permanece exacta.

### Accesibilidad del pitch-lock

El truncado es **accesible**, no clipping ciego (AGENTS.md §10 admite "truncado accesible" y las
celdas de `AdminAuditDenseTable` ya usan `truncate`). Requisitos por superficie migrada:

- nombre accesible completo disponible (`title` o `aria-label`) cuando el texto se trunque;
- ningún dato crítico oculto sin vía de acceso;
- foco visible y navegación por teclado preservados;
- acciones críticas visibles al 100 %;
- superficies que necesiten dos líneas usan **tier semántico/geométrico**, nunca un selector por
  `moduleId`.

## A→B→A Proof

Sean `A`, `B` estados de viewport y `C` el chrome. En la Opción D:

```
capacity(V, C) = clamp( floor( (q(blockSize(V,C)) − q(reserved(V,C))) / q(pitch(V,C)) ),
                        minItems, maxItems )
```

| Término | ¿De qué depende? | ¿Depende del camino? |
|---|---|---|
| `blockSize(V,C)` | Track `minmax(0,1fr)` = `--dash-main-h` menos los tracks `auto` hermanos, que fija el chrome | **No.** El canvas está acotado: su altura no puede leer su contenido |
| `reserved(V,C)` | Tokens del ledger (`--dash-pagination-h`, `--dash-bottom-nav-h`, `--dash-safe-bottom`) | **No.** `calc()` de tokens |
| `pitch(V,C)` | Token `--dash-row-pitch`, tier por container query sobre el **inline-size** del canvas | **No.** Función escalón del ancho, no del contenido |
| `minItems`, `maxItems` | Constantes del consumidor | **No** |
| datos / página / respuesta HTTP | **No son argumentos de la función** | — |
| `q(·)` | Cuantización determinista e idempotente | **No** |

`capacity` es una **función pura de `(V, C)`**. Como `A` es el mismo `V` en la ida y en la vuelta,
y `C` no cambia:

```
capacity(A) = N   (primera visita)
capacity(B) = M
capacity(A) = N   (retorno)                          ∎
```

**Qué lo garantiza — y no es una caché.** El calibrador actual persigue lo mismo *recordando* el
resultado de A. Recordar falla cuando la memoria se desborda (65 geometrías contra 16 ranuras,
H13). D **no recuerda nada**: recalcula, y el recálculo no puede dar otro resultado porque ninguno
de sus argumentos cambió. **Determinismo por construcción, no por memoria.**

**Única premisa a vigilar:** que `blockSize` no dependa del número de filas — es decir, que el
canvas esté siempre en un track acotado. Es una propiedad estructural, verificable estáticamente
por el guard de arquitectura, y A05 ya la asserta en runtime
(`dashboard-limit-invariance.spec.ts:208-211`). Nótese que **esa aserción nunca llegó a ejecutarse
en el fallo actual** (H17): la de `limit` lanzó antes. Con D, `limit` deja de fallar y esa segunda
aserción pasa a cubrir efectivamente la premisa.

## Unit Test Plan

`test/unit/ui/dashboard/dashboard-capacity-engine.test.ts` — motor puro, sin DOM.

| Caso | Aserción |
|---|---|
| Mismo input = mismo output | `computeCapacity(x)` idéntico en 200 entradas generadas |
| Independiente del orden de llamada | Cualquier permutación de llamadas da los mismos resultados; el módulo no exporta estado mutable |
| **A→B→A** | `c(A)=N`, `c(B)=M`, `c(A)=N`, como igualdad de la función — sin instancia, sin estado |
| Bordes subpíxel | `canvas = 379`, `pitch ∈ {37, 37.004, 36.996}` → **mismo N**. Es el caso que hoy produce `9→8` |
| Cuantización | `quantise` idempotente; `quantise(q(x)) === q(x)` |
| `measured: false` | Canvas 0/negativo/no finito → `measured === false`, `capacity === minItems` |
| `minItems` | Canvas menor que una fila → `capacity === minItems` |
| `maxItems` | Canvas enorme → `capacity === maxItems` |
| Inversión min/max | `min > max` ⇒ `max` se eleva a `min`; nunca `NaN` ni rango invertido |
| Dataset vacío **no participa** | `itemCount` **no es parámetro** del motor — la prueba de que L1 no puede formularse |
| Borde de una fila exacta | `canvas === pitch` → `1` |
| Borde ± quantum | `canvas === 9·pitch` → `9`; `canvas === 9·pitch − quantum` → `8` |
| `NaN` | `measured: false`, sin throw |
| `Infinity` | `measured: false`, sin throw |
| Entrada negativa | `measured: false`, sin throw |

## Architecture Guard Plan

`test/architecture/dashboard-capacity-single-owner.test.ts`.

| Guard | Regla |
|---|---|
| Owner único | Cada consumidor migrado invoca `useDashboardCanvasCapacity` exactamente una vez |
| Legacy no usado | Ningún consumidor migrado importa los hooks legacy ni el calibrador |
| ≤1 ResizeObserver | `new ResizeObserver` ≤ 1 por archivo migrado |
| 0 MutationObserver | `new MutationObserver` === 0 en archivos migrados |
| 0 row observers | Ningún `observe(` sobre un nodo de fila |
| 0 DOM writes desde el hook | Sin `setProperty`, `setAttribute`, `style.` en `useDashboardCanvasCapacity.ts` |
| 0 `setPage` | El hook no escribe estado de navegación |
| Deps congeladas | El `useLayoutEffect` del hook declara **exactamente** `[canvasNode, enabled]` |
| Pager reservado en flow | Todo canvas adaptativo tiene hermano `[data-dashboard-adaptive-reserved-region="pager"]` |
| Sin overflow prohibido | Ningún archivo migrado introduce `overflow-y: auto` ni `overflow: scroll` |
| **Sin excepción por módulo** | Ninguna regla CSS nueva contiene `data-dashboard-module=` con un moduleId concreto |

## E2E Plan

Cohortes verificadas en `frontend/e2e/suites/catalog.ts:155-157` en el SHA de análisis: A02, A03 y
A05 pertenecen a **`extended`** (cohortes `[]`, no están en `ci`). **Reverificar en el SHA base
antes de ejecutar** — el nombre de una cohorte no es evidencia de pertenencia (AGENTS.md §7).

Orden dirigido, `--workers=1 --retries=0`, una tarea pesada a la vez:

```bash
pnpm --dir frontend exec playwright test e2e/regression/dashboard-limit-invariance.spec.ts --project=chromium -g "logistics-recent-list" --workers=1 --retries=0
```

```bash
pnpm --dir frontend exec playwright test e2e/regression/dashboard-limit-invariance.spec.ts --project=chromium -g "admin-audit-log" --workers=1 --retries=0
```

```bash
pnpm --dir frontend exec playwright test e2e/regression/dashboard-limit-invariance.spec.ts --project=chromium -g "clinic-particular-tokens" --workers=1 --retries=0
```

Determinismo (los tres, tras pasar una vez):

```bash
pnpm --dir frontend exec playwright test e2e/regression/dashboard-limit-invariance.spec.ts --project=chromium -g "logistics-recent-list|admin-audit-log|clinic-particular-tokens" --workers=1 --retries=0 --repeat-each=3
```

**Cero flaky admitido en estos dirigidos.**

Cierre:

```bash
pnpm --dir frontend e2e:visual-contract
```

```bash
pnpm --dir frontend e2e:extended
```

**No ejecutar `e2e:full` en local.** `E2E Completeness` es la verificación Linux posterior al push
manual de Nico.

Recordatorios de higiene E2E (AGENTS.md §7): si se editó CSS global con el dev server caído,
borrar `frontend/.next` antes de correr Playwright; tras cualquier corrida E2E, verificar que
`frontend/next-env.d.ts` no quedó modificado antes de `pnpm test`.

### Comprobación de superficie global (no sólo el módulo migrado)

La migración toca CSS del dashboard y 17 componentes repartidos por **las tres superficies del
producto**, así que el cierre no puede limitarse a los specs de capacidad. Antes de dar el PR por
terminado, verificar que ninguna superficie global regresó:

| Superficie | Cobertura en el censo | Gate |
|---|---|---|
| **Público** (`/`, `/servicios`, `/profesionales`, `/clinicas`, `/particulares`, `/contacto`, `/precios`, `/login`) | 0 consumidores — **no debe cambiar nada** | `pnpm --dir frontend e2e:public-clinic` + `pnpm security:public-surface` |
| **Clínica** (`/dashboard`, `/dashboard/informes`, `/dashboard/logistica` → visitas / rutas / métricas) | #10 `ClinicInformesWorkspaceSummary`, #11 `ClinicLogisticaWorkspaceSummary`, #15 `ClinicParticularTokensCard`, #9 `InformesReportsList`, #16 `LogisticsBoundedCanvas` (variantes `bounded-visitas` / `bounded-rutas` / `bounded-metricas`), #17 `LogisticsRecentListCanvas` | `e2e:visual-contract` + `e2e:extended` + dirigidos A05 |
| **Admin** (launcher, `/dashboard/admin` y submódulos: clínicas, precios, sesiones, intentos fallidos, auditoría, mantenimiento) | #1–#8, #12–#14 | `e2e:visual-contract` + `e2e:admin-mobile` (por #13 `AdminMobileMaintenanceModule` y #14 `AdminMobilePricingModule`) |
| **Backend / API** | **0 consumidores. Contrato HTTP inalterado** | Sin gate propio: si algún gate de backend cambia de estado, el PR salió de scope |

Invariantes operativas que deben seguir siendo ciertas al cerrar (no las toca la migración, pero
son la definición de "operativo" del producto): rutas públicas responden 200; privado sin cookie
sigue protegido; admin sin cookie responde 404; las acciones de dashboard siguen persistiendo o
mostrando error real; sin mocks ni demos residuales; sin secretos visibles.

`pnpm --dir frontend e2e:admin-mobile` es de ejecución obligatoria **sólo** porque dos
consumidores del censo (#13, #14) son módulos móviles de admin. Si el censo recalculado en el SHA
base ya no los incluye, ese gate pasa a `NOT_RUN` con el motivo escrito.

## Performance Budget

Por superficie adaptativa, por evento de resize. **No afirmar mejora sin medirla.**

| Métrica | BEFORE `admin-audit-log` | BEFORE `logistics-recent-list` | **TARGET** |
|---|---|---|---|
| ResizeObservers | 2 | 2 | **1** |
| MutationObservers | 0 | 1 (`subtree: true`) | **0** |
| Targets observados | 5 | 1 + N filas (hasta 13) | **1** |
| DOM reads (`getBoundingClientRect`) | 4–6 | 1 + N (hasta 13) | **1** |
| DOM writes | 0 | 0 | **0** |
| Commits de React | hasta 3 + 1 fetch | hasta 3 | **≤1** si cambia el entero; **0** si no |
| Re-armado del efecto por resize | sí (`itemHeightPx` en deps) | sí | **no** |
| Caché geométrica con estado | `measuredRef`, `itemsPerPageRef` | + LRU de 16 geometrías | **0** |
| Ciclos de estabilización | acotados por 12 intentos del helper | + probe budget 8 | **1 layout pass** |
| A→B→A | no determinista | no determinista | **determinista** |

**Línea base temporal medida en CI (`61c55906`):** la hoja A05 `logistics-recent-list` costó
**~66 s**. Es la referencia del antes/después del piloto.

**Método de medición:** contar `new ResizeObserver` / `new MutationObserver` /
`getBoundingClientRect` con el guard de arquitectura, y comparar la duración de la hoja A05
aislada (`--workers=1 --retries=0`) antes y después.

**Nota sobre `waitForAdaptiveConvergence`:** si el determinismo permite reducir los drains
necesarios, se demostrará **con medición, en un PR posterior**. Este PR no toca el helper.

## Rollback

**Rollback único:** `git revert` del PR completo restaura los tres hooks, el calibrador y los 17
consumidores simultáneamente.

Condiciones que lo hacen seguro:

- ningún cambio de datos, esquema ni migración;
- ningún cambio del contrato HTTP: `limit` conserva su semántica;
- ninguna dependencia añadida ni lockfile tocado;
- ningún workflow ni required check modificado;
- los guards realineados vuelven con el revert, en coherencia con el código que vuelve.

**Restricción de orden que preserva la reversibilidad:** los owners legacy **no se borran hasta la
Fase G**, cuando `LEGACY_CONSUMERS = 0`. Hasta ese punto de la construcción interna, el árbol
siempre contiene ambas arquitecturas y cualquier retroceso es válido sin fix-forward.

## Risks

| # | Riesgo | Severidad | Mitigación |
|---|---|---|---|
| R1 | **Cambio de producto**: filas que hoy envuelven pasarán a truncar | Media | Principio ya autorizado por Nico. Tiers de densidad para superficies que necesiten dos líneas. Verificar accesibilidad por superficie (nombre accesible, dato crítico, teclado) |
| R2 | `container-type: inline-size` frente al target real del build | Media | Sin `browserslist` en el repo ⇒ rige el default de `next@^16.2.11`, por encima del soporte de container queries. **Confirmar, no asumir**, en Fase B. Si no cumple: `@media` sobre viewport, sin polyfill ni dependencia |
| R3 | `container-type` crea contexto de contención: descendientes `position: absolute` se recolocan | Media | Censar antes de aplicar (Fase B) |
| R4 | 23 guards a realinear ⇒ diff grande | Media-alta | Fases internas ordenadas; si tras la Fase E el diff es inmanejable en revisión, **detenerse y consultar a Nico** |
| R5 | Fase E toca la frontera `capacity → query.limit` | Media | Aislada en su propia fase interna; `FETCH WINDOW != VISIBLE CAPACITY`; sin tocar endpoint, DB ni `offset` arbitrariamente |
| R6 | El quantum elegido no absorbe el ruido real del navegador | Baja | Fase A.0 lo **mide** antes de fijarlo; prohibido copiar `1/64` de la auditoría |
| R7 | A03 cambia legítimamente y se realinea de más | Media | Protocolo de 6 pasos en *A03/A05 Strategy*; si alterna entre corridas, no se actualiza el baseline |
| R8 | Este trabajo **no** arregla el timeout de `E2E Completeness` | Alta si se confunde | Es un cambio test-only distinto (planificación serial de A05). Excluido explícitamente |

## Go Criteria

Todas deben cumplirse antes de pasar a `MODE=IMPLEMENT_SINGLE_PR`:

1. `gh pr view 1650 --json state,mergedAt` → `state: MERGED`, `mergedAt` no nulo.
2. `git cat-file -e origin/main:frontend/e2e/regression/dashboard-limit-invariance.spec.ts` → exit 0.
3. `git cat-file -e origin/main:frontend/src/components/dashboard/adaptiveRowPitchCalibration.ts` → exit 0.
4. Working tree limpio en tracked; staged vacío; `scratchpad/**` y los 4 stashes preservados.
5. Rama nueva desde `main` actualizado, **no apilada** sobre `test/dashboard-a03-freeze-post-a05`.
6. Nico pide implementación en la tarea de entonces (autorización R1 no se hereda entre tareas —
   AGENTS.md §3).
7. Censo recalculado en el SHA base: no dar por buenos los 17/23 de este documento sin reverificar.

## No-Go Criteria

Cualquiera de estas obliga a permanecer en `ROADMAP_ONLY` o a detenerse:

1. #1650 sigue `OPEN` o fue cerrado sin merge.
2. `main` no contiene la baseline runtime auditada.
3. La solución exige tocar cualquier ítem de *Explicit Exclusions*.
4. Un consumidor sólo puede migrarse mediante una excepción específica por `moduleId` — entonces
   **la primitive está mal**: detener esa migración y revisar el motor, **no añadir la excepción**.
5. Los dirigidos A05 muestran flaky en `--repeat-each=3`: seguir corrigiendo, nunca enmascarar.
6. A03 alterna entre corridas: no actualizar baseline.
7. El diff resulta inmanejable para revisión humana tras la Fase E: consultar a Nico; el split es
   decisión suya.

## Manual Nico Actions

El agente **no** ejecuta ninguna de estas (AGENTS.md §5):

```powershell
git add
git commit -m
git push -u
gh pr create
gh pr checks --watch
gh pr merge --squash --delete-branch
```

Además, previo al desbloqueo:

- resolver `mergeStateStatus: BLOCKED` de PR #1650 y mergearlo;
- decidir si el fix de planificación de A05 (`mode: "serial"` injustificado en
  `frontend/e2e/regression/dashboard-limit-invariance.spec.ts:134`) entra en #1650 o en un PR
  test-only propio — **no forma parte de este roadmap**.

## Final State

| Campo | Valor |
|---|---|
| Modo ejecutado | `ROADMAP_ONLY` |
| Runtime modificado | **No** — `frontend/src`, `frontend/e2e`, `test/`, `package.json`, workflows intactos |
| Archivos creados | 1 (este documento) |
| Motivo del bloqueo | PR #1650 `OPEN`; `main` sin la baseline runtime auditada |
| Siguiente acción | Nico mergea #1650 → reverificar *Go Criteria* → ejecutar el PR único |
| Estado | `BLOCKED` |
