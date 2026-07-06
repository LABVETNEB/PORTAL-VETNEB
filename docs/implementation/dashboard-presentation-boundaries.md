# Dashboard Presentation Architecture Boundaries (PR-PRES-2)

> **Tipo:** estructura + índices. **No mueve componentes, no cambia comportamiento, no toca CSS ni rutas públicas.**
> **Base:** `main` limpio · **HEAD:** `63ea30d` docs(dashboard): audit presentation primitives architecture (#1291)
> **Rama:** `refactor/dashboard-presentation-boundaries`
> **Documento rector:** [`docs/audit/dashboard-presentation-primitives-architecture-audit.md`](../audit/dashboard-presentation-primitives-architecture-audit.md)
> **Modelo / esfuerzo:** Claude Opus 4.8 · high.

## 1. Objetivo

Introducir la **frontera de arquitectura de presentación** del dashboard como
carpeta declarada, para habilitar extracciones *behavior-preserving* en los PRs
siguientes (PR-PRES-3..6) sin seguir acumulando duplicación. Este PR crea la
estructura y los índices; **no mueve ningún componente existente**.

Es la implementación del **PR-PRES-2** definido en la sección 10 del documento
rector, que a su vez espeja en la capa TSX/React la modularización que el CSS
del dashboard ya logró en #1289 (modularización) y #1290 (composition root).

## 2. Qué se creó

```
frontend/src/features/dashboard/
  README.md                         ← mapa de capas + reglas de frontera
  config/index.ts                   ← barrel placeholder (export {})
  domain/index.ts                   ← barrel placeholder
  application/index.ts              ← barrel placeholder
  presentation/index.ts             ← barrel placeholder
  presentation/shell/index.ts       ← barrel placeholder
  presentation/navigation/index.ts  ← barrel placeholder
  presentation/layout/index.ts      ← barrel placeholder
  presentation/surfaces/index.ts    ← barrel placeholder
  presentation/admin/index.ts       ← barrel placeholder
  presentation/clinic/index.ts      ← barrel placeholder
```

Cada `index.ts` es un **barrel vacío** (`export {};`) con un encabezado JSDoc
que documenta el contrato de su capa. El `export {};` mantiene el archivo como
módulo válido bajo `isolatedModules` y deja lista la superficie de importación
(`@/features/dashboard/<capa>`) para que los PRs siguientes solo agreguen
`export * from './<archivo-real>'` sin crear el índice.

## 3. Responsabilidad por capa (espeja la taxonomía CSS aprobada)

| Capa | Contenido futuro | Regla de frontera |
|------|------------------|-------------------|
| `config` | Catálogo de módulos por rol (id, alias, label, shortLabel, icon, title, description, storageKey, destinos nav). Fuente única de verdad. | No importa React. |
| `domain` | Tipos `ClinicModule`/`AdminModule`, `parse`/validación de módulo, view-models puros (systemHealth, audit labels, status→variant). | No importa React. |
| `application` | `useDashboardModuleNavigation` (URL-sync optimista, last-module, intent one-shot, two-commit), `moduleActivationBus`, access-error store, server-auth/redirect, wrappers de carga de datos. | No renderiza JSX. |
| `presentation/shell` | PrivateDashboardShell, DashboardShellRouter, DashboardTopbar, DashboardModuleWorkspace, DashboardModuleHub, DashboardHubHero, stage. | No importa `@/lib/api`. |
| `presentation/navigation` | DashboardModuleRail, Admin/ClinicMobileBottomNav, DashboardHorizontalNav, Admin/ClinicDashboardSidebar, pagers, menús móviles, kebab. | No importa `@/lib/api`. |
| `presentation/layout` | DashboardPageHeader, DashboardSidebarFrame, viewport-switch, stage wrappers. | No importa `@/lib/api`. |
| `presentation/surfaces` | EmptyState/ErrorState/LoadingState, StatsCards, StatusBadge, FilterBar/Drawer, StickyActionBar, ModuleSurface, ModuleTabs/Dialog, tablas. | No importa `@/lib/api`. |
| `presentation/admin` | Admin*Card + Admin*Mobile*Module (wrappers de workspace admin). | No importa `@/lib/api`. |
| `presentation/clinic` | Clinic*Card + Clinic*WorkspaceSummary + ClinicCommandCenter (wrappers de workspace clínica). | No importa `@/lib/api`. |

Regla transversal: al reubicar componentes en `presentation`, **preservar el
anidamiento del DOM, las clases y los atributos `data-*`** (contrato entre TSX,
el CSS compuesto y los selectores Playwright). Mover ≠ renombrar.

## 4. Alcance y no-alcance

**Alcance de este PR**

- Crear la carpeta `frontend/src/features/dashboard/` con sus subcapas y
  subcarpetas.
- Barrels `index.ts` placeholder + `README.md` del feature.
- Este documento de implementación.

**No-alcance (queda para PR-PRES-3..6)**

- No se mueve ningún componente (`page.tsx`, controllers, cards, shell).
- No se extrae el catálogo de módulos ni la máquina de navegación.
- No se cambia CSS, rutas Next, auth, datos ni comportamiento.
- No se tocan backend/API/DB/Supabase, deps/lockfiles ni CI.

## 5. Plan de continuación

Según la sección 10 del documento rector:

| PR | Objetivo |
|----|----------|
| **PR-PRES-3** | Extraer shell primitives ya-limpios a `presentation/shell` con re-export de compatibilidad. |
| **PR-PRES-4** | `config/*ModuleCatalog` como fuente única; navegación → `application`. |
| **PR-PRES-5** | Surface primitives (estados, StatsCards, tabs, tablas) → `presentation/surfaces`. |
| **PR-PRES-6** | Wrappers clinic/admin + `domain/systemHealthViewModel`; rutas adelgazan a composición. |
| **PR-UX-1** | Rediseño visual premium, solo después de PRES-2..6. |

Orden y dependencias: PRES-2 → PRES-3 → PRES-4 → PRES-5 → PRES-6 → UX-1.

## 6. Validación

Ejecutada para este PR (estructura sin cambios de comportamiento):

```powershell
# raíz backend
cd C:\PORTAL-VETNEB
pnpm test
pnpm build

# frontend
cd C:\PORTAL-VETNEB\frontend
pnpm typecheck
pnpm build
```

Superficie de cambios (solo carpetas/documentación nuevas; sin archivos
modificados):

```powershell
git -C C:\PORTAL-VETNEB diff --check
git -C C:\PORTAL-VETNEB status --short --untracked-files=all
git -C C:\PORTAL-VETNEB diff -- frontend/next-env.d.ts   # sin cambios
```

Nota: si `pnpm build` (frontend) reescribe `frontend/next-env.d.ts`, se
restaura a su contenido original — no forma parte de este cambio.
