# Dashboard Surface Primitives (PR-PRES-5)

> **Tipo:** extracción de presentación *behavior-preserving*. **No mueve la
> implementación, no cambia DOM/className/`data-*`, no toca CSS, rutas,
> navegación ni textos visibles.**
> **Base:** `main` limpio · **HEAD:** `d2e7390` refactor(dashboard): extract module navigation helpers (#1294)
> **Documento rector:** [`docs/audit/dashboard-presentation-primitives-architecture-audit.md`](../audit/dashboard-presentation-primitives-architecture-audit.md)
> **Modelo / esfuerzo:** Claude Opus 4.8 · high.

## 1. Objetivo

Dar el primer contenido real a la capa `presentation/surfaces` del dashboard,
abriendo la superficie de importación
`@/features/dashboard/presentation/surfaces` con **una** primitive de estado ya
limpia (`StatusBadge`), sin acumular más duplicación y **sin cambio de
comportamiento**. Es el **PR-PRES-5** de la sección 10 del documento rector.

## 2. Qué se hizo

Se expone `StatusBadge` (audit §5.1 — "ya limpio, mover casi tal cual") a través
del boundary `presentation/surfaces` mediante un **re-export puro**:

```
frontend/src/features/dashboard/presentation/surfaces/
  DashboardStatusBadge.tsx   ← re-export de StatusBadge + StatusBadgeProps
  index.ts                    ← export * from "./DashboardStatusBadge"
```

`DashboardStatusBadge.tsx` no reimplementa nada: reexporta
`StatusBadge`/`StatusBadgeProps` desde `@/components/dashboard/StatusBadge`. El
componente renderizado es **idéntico** (mismo JSX, mismas clases, mismo
`data-status`).

## 3. Por qué re-export y no mover el archivo

La implementación de `StatusBadge` (y de las demás surfaces del scope: estados,
`StatsCards`, `FilterBar/Drawer`, `Module{Tabs,Dialog}`) está **fijada por
guardrails source-invariant** que hacen `readFileSync` de
`frontend/src/components/dashboard/*.tsx` y afirman substrings exactos —
`test/frontend-dashboard-private-shell-foundation.test.ts`,
`test/frontend-dashboard-state-polish.test.ts`,
`test/frontend-dashboard-tables-cards-consistency-polish.test.ts`, etc. Además,
los consumidores tienen su string de import fijado
(`import { StatusBadge } from "@/components/dashboard/StatusBadge";` en
`frontend-dashboard-home` / `-informes` / `-logistics-hub` /
`-clinic-command-center`).

Mover el archivo obligaría a un shim + edición de múltiples guardrails y a mayor
blast radius. El propio audit (§9) prescribe hacerlo **"primero como re-export
puro"** para evitar un *big-bang*, y el JSDoc de PR-PRES-2 dejó lista la
superficie para exactamente este `export * from`. Por eso este PR:

- **no** migra ningún consumidor (los imports pinneados quedan intactos);
- **no** edita ningún guardrail existente;
- **no** mueve la implementación.

El movimiento físico de la implementación a `surfaces/` (con actualización de los
guardrails a la nueva ruta, preservando su significado) queda para un PR
posterior si se decide adelgazar `components/dashboard`.

## 4. Preservación de contrato

- **DOM nesting:** sin cambios (mismo componente, mismo árbol).
- **className:** sin cambios (`status-badge`, `status-badge-*`, tonos).
- **`data-*`:** sin cambios (`data-status`).
- **Variant names / props:** sin cambios (`StatusBadgeProps`, `size`, etc.).
- **CSS / rutas / navegación / copy visible:** intactos.
- **Boundary:** el módulo no importa `@/lib/api`.

## 5. Archivos tocados

```
frontend/src/features/dashboard/presentation/surfaces/DashboardStatusBadge.tsx  (nuevo)
frontend/src/features/dashboard/presentation/surfaces/index.ts                  (barrel → re-export)
docs/implementation/dashboard-surface-primitives.md                             (este doc)
test/frontend-dashboard-surface-primitives.test.ts                              (guardrail del contrato de re-export)
```

## 6. Validación

```powershell
cd C:\PORTAL-VETNEB
pnpm test
pnpm build

cd C:\PORTAL-VETNEB\frontend
pnpm typecheck
pnpm build
pnpm e2e:visual-contract
```

Superficie de cambios (solo archivos nuevos + barrel):

```powershell
git -C C:\PORTAL-VETNEB diff --check
git -C C:\PORTAL-VETNEB status --short --untracked-files=all
git -C C:\PORTAL-VETNEB diff -- frontend/next-env.d.ts   # sin cambios
```

Nota: si `pnpm build` (frontend) reescribe `frontend/next-env.d.ts`, se restaura
a su contenido original — no forma parte de este cambio.
