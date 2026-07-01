# PR-MD-1 — Adaptive master-detail workspace contract (BLOQUEADO POR SCOPE / docs-only)

## Resultado de este PR

**PR-MD-1 se detiene deliberadamente como docs-only.** No se adapta ninguna
superficie ni la primitiva. No se toca código productivo, tests, CSS global,
e2e ni snapshots. Este documento registra la auditoría, la condición de parada
de cada target y la recomendación de un PR dedicado de rediseño.

La decisión fue tomada por Nico tras el reporte previo obligatorio, eligiendo
explícitamente **"Detener PR-MD-1"** sobre "adaptar sólo la primitiva" y
"rediseñar Logística".

## Skill / modelo / esfuerzo

- Skills: VETNEB Production Web Optimization Engineer (principal); VeTNEB
  Briefing Planificación Diseño Desarrollo Pruebas y VeTNEB Web End-to-End
  Global (complementarias); VeTNEB Security Production Invariants (guardrail).
- Modelo: Claude Opus 4.8.
- Esfuerzo: High / Maximum.

## Estado base

- Fecha: 2026-07-01.
- Repo: `C:\PORTAL-VETNEB`.
- Rama base confirmada: `main`.
- HEAD base confirmado: `49df15c feat(admin): adapt maintenance dry-run card to adaptive rows (#1217)`.
- Rama de trabajo: `feat/adaptive-master-detail-workspace`.
- Working tree inicial: limpio.
- PRs abiertos al inicio: 0.
- Ramas locales al inicio: solo `main`.
- Ramas remotas no mergeadas contra `origin/main`: 0.

## Documentos vigentes usados (todos ≥ 29/06/2026)

- `docs/audit/global-zero-scroll-adaptive-dashboard-matrix.md` — 2026-07-01 (rector).
- `docs/audit/vetneb-enterprise-operational-platform-extreme-excellence-advisory.md` — 2026-07-01.
- `docs/implementation/adaptive-items-per-page-foundation.md` — 2026-07-01.
- `docs/implementation/global-adaptive-dashboard-contract-baseline.md` — 2026-07-01.
- `docs/implementation/next-client-adaptive-dashboard-module.md` — 2026-07-01.
- `docs/implementation/admin-client-adaptive-dashboard-module.md` — 2026-07-01.
- `docs/implementation/clinic-tokens-adaptive-rows-per-page.md` — 2026-07-01.

## Documentos anteriores a 29/06/2026 excluidos como rectores

Se conservaron sólo como histórico, sin autorizar scope ni archivos:
`dashboard-masked-master-detail-no-scroll-audit.md` (17/06),
`dashboard-global-masked-master-detail.md` (17/06),
`DASHBOARD_SINGLE_VIEWPORT_APP_SHELL_PLAN.md`,
`dashboard-horizontal-navigation-information-architecture.md`,
`product-ux-dashboard-audit.md` y toda auditoría/implementación de dashboard
fechada ≤ 28/06/2026.

## Qué pedía la matriz para PR-MD-1

`global-zero-scroll-adaptive-dashboard-matrix.md`, §11 (roadmap), define:

> **PR-MD-1** — *Master-detail: quitar `overflow-y-auto`+`calc(100vh)`* — toca
> `MasterDetailWorkspace`, `ClinicLogisticaWorkspaceSummary` — no toca servidor —
> P2 — e2e visual-contract — *Sin scroll interno rígido*.

La auditoría de ambos targets encontró que, para un PR mínimo, **cada uno
dispara una condición de parada** del protocolo VETNEB de este PR.

## Targets auditados y condición de parada

### Target A — `MasterDetailWorkspace` (primitiva compartida)

Archivo: `frontend/src/components/dashboard/MasterDetailWorkspace.tsx`.

Evidencia:

- **Sin consumidores runtime.** Grep de `MasterDetailWorkspace` sobre
  `frontend/src/**/*.tsx` sólo devuelve su propia definición: ninguna
  superficie la importa ni la renderiza. Los tests de contrato afirman
  activamente que las superficies reales **no** la usan:
  - `test/frontend-dashboard-informes.test.ts:120` →
    `assert.equal(source.includes("<MasterDetailWorkspace"), false)`.
  - `test/frontend-dashboard-reports-master-detail.test.ts:120` → ídem.
  - `test/frontend-dashboard-filter-drawer-sticky-filters.test.ts:158` → ídem.
- **Su `overflow-y-auto` + `calc(100vh)` están pineados literalmente** por
  `test/frontend-dashboard-reports-master-detail.test.ts:74-75`
  (`xl:max-h-[calc(100vh-13rem)]` y `xl:overflow-y-auto`), y su estructura por
  otros source-contract tests
  (`frontend-dashboard-workspace-layout-polish.test.ts`,
  `frontend-dashboard-accessibility-focus-aria.test.ts`,
  `frontend-dashboard-mobile-polish-bottom-actions.test.ts`).

Condición de parada disparada: **"tocar `MasterDetailWorkspace` impacta
demasiados consumidores"** (múltiples source-contract tests) **y no es una
superficie master-detail *real* renderizada** (es código de reserva/primitiva).
Adaptarla sola sería tocar código no montado en ninguna vista: no es una
entrega funcional validable en runtime ni cumple el objetivo textual del PR
("una superficie master-detail **real** de menor riesgo").

### Target B — `ClinicLogisticaWorkspaceSummary` (superficie Clínica real)

Archivo: `frontend/src/app/dashboard/ClinicLogisticaWorkspaceSummary.tsx`.

Clasificación en la matriz: Familia B (cliente master-detail), paginación
**ninguna**, riesgo P2, estrategia "MD sin pag / QA".

Evidencia:

- La lista está capada a **3 ítems** (`frontend/src/app/dashboard/page.tsx:101`
  → `const recentVisits = visits.slice(0, 3)`). No hay paginación aplicable:
  `useAdaptiveItemsPerPage` / `useAdaptiveRowsPerPage` no corresponde (no hay
  cardinalidad que derivar).
- El detalle es **inline enmascarado** (se expande bajo la fila seleccionada),
  no un panel lateral ni un dialog. Es un diseño de interacción deliberado.
- Cadena flex real:
  - `.dashboard-module-body` → `overflow: hidden` (`globals.css:1939`).
  - `.dashboard-inline-list` → `overflow-x: hidden`, `min-height: 0`
    (`globals.css:2282`).
  - `.dashboard-inline-scroll` → **único** `overflow-y: auto`
    (`globals.css:2290`), aplicado en
    `ClinicLogisticaWorkspaceSummary.tsx:70`.
  - Como los ancestros son `overflow: hidden`, **quitar el `overflow-y: auto`
    del inner-scroll no produce scroll: produce clipping** (el detalle inline
    largo en mobile queda recortado, con pérdida de datos). Viola la regla
    "evitar clipping" / "overflow ocultando datos".
- La clase `dashboard-inline-scroll` es **CSS global compartida** con la ruta
  full `frontend/src/app/dashboard/informes/page.tsx` (servidor, fuera de
  scope): no puede editarse en `globals.css` sin impactar otra superficie.
- Existe e2e dirigido `frontend/e2e/dashboard-clinic-logistica-mobile-parity.spec.ts`
  que fija estructuralmente `.dashboard-inline-scroll`
  (líneas 61, 102, 139) y verifica **no-scroll global con el detalle largo
  expandido** en mobile 360×740 / 390×844 / 430×932. La solución zero-scroll
  correcta (mover el detalle a dialog, o partir el master-detail en dos
  regiones flex con scroll acotado propio del detalle) **cambia el layout y la
  interacción** y obliga a reescribir ese e2e.

Condición de parada disparada: **"la solución requiere rediseño visual"**. La
superficie ya cumple el contrato no-scroll a nivel shell (el inner-scroll
nunca hace crecer `main`); reducir de verdad la dependencia del scroll interno
exige reestructurar el patrón master-detail, lo que excede un PR-MD-1 mínimo.

### Target conjunto (matriz completa)

Tocar `MasterDetailWorkspace` **y** `ClinicLogisticaWorkspaceSummary` en el
mismo PR dispara además **"el cambio exige más de una superficie"**.

## Por qué no se adapta la primitiva sola

- No es una superficie renderizada: adaptar `MasterDetailWorkspace` sin ningún
  consumidor no entrega valor funcional observable ni validable en runtime;
  sería un cambio de contrato sobre código de reserva.
- El objetivo textual del PR pide "una superficie master-detail **real** de
  menor riesgo"; la primitiva no lo es.
- Obligaría a modificar source-contract tests que hoy congelan su forma exacta
  (incluido el `calc(100vh)`/`overflow-y-auto`), sin beneficio de producción.

Decisión de Nico: **no adaptar sólo la primitiva.**

## Por qué Logística requiere un PR dedicado de rediseño

- Quitar el inner-scroll sin clipping exige mover el detalle largo a un
  contenedor que sí pueda desbordar de forma controlada: dialog (`ModuleDialog`)
  o una segunda región flex de detalle con scroll acotado propio.
- Cualquiera de esas opciones **cambia el layout/interacción** del master-detail
  enmascarado actual y **reescribe el e2e dirigido**, es decir, es un rediseño,
  no una adaptación mínima.
- Ese trabajo debe ir en su propio PR con autorización previa, no dentro de
  PR-MD-1.

Decisión de Nico: **no rediseñar Logística dentro de PR-MD-1.**

## Recomendación de próximo PR

**PR-LOGISTICA-REDESIGN-1** — `feat(clinic): redesign logistics master-detail workspace`.

Alcance sugerido (a autorizar por Nico antes de ejecutar):

- Superficie única: `ClinicLogisticaWorkspaceSummary`.
- Rediseñar el master-detail para eliminar la dependencia del inner-scroll
  (`dashboard-inline-scroll`) sin clipping: opción 1 = detalle a `ModuleDialog`
  (alineado con `ClinicInformesWorkspaceSummary`, ya migrado); opción 2 =
  lista `shrink-0` + región de detalle `flex-1 min-h-0` con scroll acotado
  propio.
- Actualizar `frontend/e2e/dashboard-clinic-logistica-mobile-parity.spec.ts` al
  nuevo contrato (no rígido).
- No tocar `globals.css` compartido salvo mínimo justificado; no tocar la ruta
  full de informes; no tocar servidor.
- La primitiva `MasterDetailWorkspace` queda para un PR de contrato aparte
  (o para eliminación si se confirma que seguirá sin consumidores), decidido
  fuera de este roadmap de superficies.

## Confirmación de scope

- Superficie cubierta: **Clínica** (auditoría). **NO** Admin servidor.
- No se tocó: Admin servidor, Particular, Clínica Tokens, Admin Maintenance,
  Admin Pricing, backend/API/auth/DB, CI/workflows, deps/lockfiles, snapshots,
  CSS global, ni ninguna superficie productiva.
- No se creó estrategia servidor. No se rediseñó nada. No se avanzó al PR
  siguiente.

## Archivos de este PR

- `docs/implementation/adaptive-master-detail-workspace.md` (este documento;
  único archivo del PR).

## Validaciones

Cambio **docs-only** (un único archivo Markdown, sin código productivo, tests,
CSS, e2e ni snapshots). No aplica `pnpm test` / `build` / `lint` / Playwright
como señal: no hay superficie ni contrato de código modificado.

- `git diff --check` — sin errores de whitespace.
- `git status --short --untracked-files=all` — sólo el documento nuevo.

## Riesgos residuales

- La deuda master-detail de Logística (P2, `dashboard-inline-scroll`) sigue
  abierta; se difiere a `PR-LOGISTICA-REDESIGN-1`.
- La primitiva `MasterDetailWorkspace` conserva `calc(100vh)`/`overflow-y-auto`
  como deuda de contrato, pero sin consumidores no genera scroll rígido en
  ninguna vista real.

## Estado final

Pendiente de stage/commit/push/PR manual por Nico. No se avanzó al PR
siguiente. No se ejecutó `git add`, `commit`, `push` ni `gh pr create`.
