# PR-2: Dashboard Workspace Layout Polish

- **Fecha:** 2026-06-10
- **Rama:** `feat/dashboard-workspace-layout-polish`
- **Base:** `main` — HEAD `f1cc744 feat(ui): add dashboard interaction foundation (#925)`
- **Tipo:** feat(dashboard)

---

## Problema

Los workspaces del dashboard clínica/admin tenían presentación visual plana:

- `DashboardModuleWorkspace` montaba sin animación de entrada — el cambio hub → workspace era un swap instantáneo sin continuidad espacial.
- El header del workspace (Volver + título) no tenía separación visual del cuerpo.
- Los paneles del `MasterDetailWorkspace` usaban clases Tailwind hardcodeadas (`shadow-sm`, `bg-card/95`, `border-vetneb-line/80`) sin tokens reutilizables.
- El `FilterDrawer` tenía `shadow-lg` sin conexión con el sistema de sombras del dashboard.
- Los items de navegación de `DashboardSidebarFrame` usaban `transition-colors` (Tailwind, 150ms fijo) en lugar de los motion tokens del sistema.
- Los botones del `StickyActionBar` no tenían el estado press/active de la foundation.

---

## Objetivo visual

Aplicar los tokens de interacción existentes (`--motion-base`, `--motion-fast`, `--ease-out-soft`, clases foundation PR-1) a la capa de layout/estructura visual de los workspaces, elevando la percepción de calidad sin cambiar lógica de negocio.

---

## Solución aplicada

### 1. `globals.css` — Nueva sección `dashboard-workspace-layout-polish`

**Keyframe de entrada:**
```css
@keyframes dashboard-workspace-enter {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0);    }
}
```

**Clases nuevas:**

| Clase | Propósito |
|---|---|
| `.dashboard-workspace-enter` | Animación de entrada del workspace (opacity + translateY, `--motion-base`, `--ease-out-soft`) |
| `.dashboard-workspace-header` | Separador visual header/cuerpo: `border-bottom`, `padding-bottom: 1rem`, `margin-bottom: 1rem` |
| `.dashboard-master-panel` | Panel maestro del master-detail: background, border-color, box-shadow con inset |
| `.dashboard-detail-panel` | Panel de detalle: gradient sutil, box-shadow consistente |
| `.dashboard-detail-panel[data-detail-state="selected"]` | Refuerzo visual cuando hay selección activa (teal border, sombra más pronunciada) |
| `.dashboard-nav-interactive` | Transición token-based para items de navegación: `background-color, color, box-shadow` / `--motion-fast` / `--ease-out-soft` |
| `.dashboard-filter-panel` | Sombra lateral semántica para el drawer de filtros |

**`prefers-reduced-motion: reduce` — bloque consolidado (último en el archivo):**
- Cubre `.dashboard-card-interactive`, `.dashboard-btn-interactive`, `.dashboard-row-interactive` (PR-1)
- Añade `animation: none` para `.dashboard-workspace-enter` (PR-2)
- Garantiza que el test `lastIndexOf` de PR-1 siga verde

### 2. `DashboardModuleWorkspace.tsx`

- Añade `dashboard-workspace-enter` al `<section>` raíz → animación de entrada al montar
- Reemplaza `mb-4 flex flex-col...` → `dashboard-workspace-header flex flex-col...` → separador visual header/cuerpo

### 3. `MasterDetailWorkspace.tsx`

- Master panel: elimina `border-vetneb-line/80 bg-card/95 shadow-sm`, añade `dashboard-master-panel`
- Detail panel: elimina `border-vetneb-line/80 bg-card/95 shadow-sm`, añade `dashboard-detail-panel`
- `data-detail-state` preservado para E2E y CSS del estado seleccionado

### 4. `FilterDrawer.tsx`

- Reemplaza `shadow-lg` (Tailwind) con `dashboard-filter-panel` (shadow lateral semántica del sistema)

### 5. `DashboardSidebarFrame.tsx`

- Reemplaza `transition-colors` (Tailwind, 150ms fijo) → `dashboard-nav-interactive` (motion tokens: `--motion-fast`, `--ease-out-soft`) en items de navegación y enlace "Volver al sitio público"

### 6. `StickyActionBar.tsx`

- Añade `dashboard-btn-interactive` a los botones de acciones → propaga el estado `:active { transform: scale(0.98) }` del sistema

---

## Archivos tocados

| Archivo | Tipo de cambio |
|---|---|
| `frontend/src/app/globals.css` | +74 líneas: keyframe + sección `dashboard-workspace-layout-polish` + bloque reduced-motion consolidado |
| `frontend/src/components/dashboard/DashboardModuleWorkspace.tsx` | -2/+2: enter animation + header separator |
| `frontend/src/components/dashboard/DashboardSidebarFrame.tsx` | -2/+2: `transition-colors` → `dashboard-nav-interactive` |
| `frontend/src/components/dashboard/FilterDrawer.tsx` | -1/+1: `shadow-lg` → `dashboard-filter-panel` |
| `frontend/src/components/dashboard/MasterDetailWorkspace.tsx` | -2/+2: panel polish classes |
| `frontend/src/components/dashboard/StickyActionBar.tsx` | -1/+1: añade `dashboard-btn-interactive` |
| `test/unit/ui/frontend/frontend-visual-consistency.test.ts` | -1/+1: actualiza regex sidebar (`transition-colors` → `dashboard-nav-interactive`) |
| `test/frontend-dashboard-workspace-layout-polish.test.ts` | nuevo: 36 tests nativos PR-2 |
| `frontend/e2e/dashboard-workspace-layout-polish.spec.ts` | nuevo: 7 smoke E2E PR-2 |
| `docs/pr2-dashboard-workspace-layout-polish.md` | nuevo: este documento |

---

## Tokens / clases reutilizados

```
:root (PR-1, reutilizados):
  --motion-fast: 120ms
  --motion-base: 180ms
  --ease-out-soft: cubic-bezier(0.16, 1, 0.3, 1)

@layer components (PR-1, preservados):
  .dashboard-card-interactive   — hub cards (sin cambio)
  .dashboard-btn-interactive    — Volver button + StickyActionBar buttons
  .dashboard-row-interactive    — ready for PR-3 list rows (sin cambio)
  .dashboard-disabled-state     — (sin cambio)

@keyframes + @layer components (PR-2, nuevos):
  dashboard-workspace-enter     — workspace enter animation
  .dashboard-workspace-enter
  .dashboard-workspace-header
  .dashboard-master-panel
  .dashboard-detail-panel
  .dashboard-detail-panel[data-detail-state="selected"]
  .dashboard-nav-interactive
  .dashboard-filter-panel
```

---

## Tests agregados / actualizados

### Nuevo: `test/frontend-dashboard-workspace-layout-polish.test.ts` (36 tests)

- Sección `dashboard-workspace-layout-polish` marcada con comentarios
- `@keyframes dashboard-workspace-enter` definido con `opacity: 0` y `translateY(6px)`
- `.dashboard-workspace-enter` usa `--motion-base` y `--ease-out-soft`
- Reduced-motion desactiva `.dashboard-workspace-enter` con `animation: none`
- `.dashboard-workspace-header` con `border-bottom` + `padding-bottom` + `margin-bottom`
- `.dashboard-master-panel` y `.dashboard-detail-panel` definidos
- Estado `[data-detail-state="selected"]` en `.dashboard-detail-panel`
- `.dashboard-nav-interactive` usa `--motion-fast` y `--ease-out-soft`
- `.dashboard-filter-panel` con `box-shadow: -14px 0 44px`
- `DashboardModuleWorkspace` tiene `dashboard-workspace-enter` y `dashboard-workspace-header`
- `DashboardModuleWorkspace` no tiene `mb-4` en el header
- `DashboardModuleWorkspace` preserva `data-dashboard-module-workspace`, `dashboard-btn-interactive`, `focus-visible` ring
- `MasterDetailWorkspace` usa `dashboard-master-panel` y `dashboard-detail-panel`
- `MasterDetailWorkspace` sin `shadow-sm` en paneles
- `MasterDetailWorkspace` preserva `data-detail-state`, `overflow-hidden rounded-lg border`
- `FilterDrawer` usa `dashboard-filter-panel`, sin `shadow-lg`, preserva `role=dialog`, `aria-modal`, `data-filter-drawer-open`
- `DashboardSidebarFrame` usa `dashboard-nav-interactive`, sin `transition-colors`, preserva `focus-visible`, `aria-current`
- `StickyActionBar` usa `dashboard-btn-interactive`, preserva `data-sticky-action-bar`, `focus-visible`
- `DashboardShellRouter` preserva `h-dvh overflow-hidden`
- `DashboardShellRouter` no importa `AdminSectionTabs`
- Sin dependencias nuevas, dentro del scope de archivos permitidos

### Nuevo: `frontend/e2e/dashboard-workspace-layout-polish.spec.ts` (7 tests)

- `/dashboard` carga hub clínica
- `/dashboard?module=operaciones` renderiza workspace con clase `dashboard-workspace-enter`
- `/dashboard/admin` carga hub admin
- `/dashboard/admin?module=admin-clinics` renderiza workspace con clase `dashboard-workspace-enter`
- `/dashboard/informes` master-detail carga
- Workspace "Volver" preserva `dashboard-btn-interactive` (PR-1 contract)
- `prefers-reduced-motion: reduce` — workspace sigue visible sin animación
- No scroll global (≤5px overflow)

### Actualizado: `test/unit/ui/frontend/frontend-visual-consistency.test.ts` (1 línea)

- Regex del sidebar actualizada: `transition-colors` → `dashboard-nav-interactive` (refleja la mejora intencional de PR-2)

---

## Comandos ejecutados

**Terminal 1:**

```powershell
git branch --show-current            # feat/dashboard-workspace-layout-polish
git status --short                   # limpio al inicio
git log -1 --oneline                 # f1cc744 feat(ui): add dashboard interaction foundation (#925)
git diff --check                     # sin errores whitespace
git diff --stat                      # 7 archivos: 83 ins, 9 del + 2 nuevos
pnpm --dir frontend lint             # OK
pnpm --dir frontend typecheck        # OK
pnpm --dir frontend build            # OK (25 páginas, Turbopack)
git diff -- frontend/next-env.d.ts frontend/tsconfig.json  # vacío (no modificados)
git status --short                   # 7 M + 2 ?? nuevos
node --test test/frontend-dashboard-workspace-layout-polish.test.ts  # 36/36
node --test test/frontend-dashboard-interaction-foundation.test.ts   # 24/24
node --test test/frontend-dashboard-shell.test.ts                     # 6/6
pnpm validate:local                  # 2531/2531
pnpm security:public-surface         # PASS
```

---

## Riesgos

| Riesgo | Valoración | Mitigación aplicada |
|---|---|---|
| Animación de entrada causa hydration mismatch | Ninguno | `DashboardModuleWorkspace` ya es `"use client"`; la animación CSS pura no condiciona markup SSR |
| `animation: both` puede causar flash si el componente se renderiza antes que CSS | Muy bajo | CSS está en `globals.css` que carga antes del componente; `both` rellena el estado inicial inmediatamente |
| `dashboard-workspace-header` cambia el layout (padding + margin en lugar de solo margin) | Bajo | El spacing total es equivalente (1rem); el `border-bottom` añade 1px visual, no afecta flexbox flow |
| `dashboard-nav-interactive` en sidebar puede perder `transition-colors` propiedades (border-color, fill) | Muy bajo | El sidebar rail no muestra bordes visibles en los nav items; `background-color + color` es suficiente |
| `dashboard-filter-panel` sin `shadow-lg` puede ser menos visible | Bajo | La shadow lateral (`-14px 0 44px rgba(8,35,50,0.20)`) es visualmente más apropiada que `shadow-lg` para un panel lateral |
| Reduced-motion consolidado puede duplicar reglas con PR-1 | Ninguno | CSS cascade: la última regla aplicable gana; doble declaración de `transition: none` es inocua |
| Regresión en test de visual-consistency del sidebar | Resuelto | Actualizado el regex en el test para reflejar la mejora (`dashboard-nav-interactive`) |

---

## Evidencia de no cambios de lógica

- No se modificaron props públicas de ningún componente
- No se cambió `onBack`, `activeModule`, `searchParams`, `reportId`, paginación ni filtros
- No se modificaron rutas, `ROUTES`, `parseClinicModule`, `parseAdminModule`
- No se modificaron `getDashboardStats`, `getReports`, `getLogisticsFieldVisits`
- No se tocaron archivos de `server/`, `drizzle/`, `shared/`, `src/lib/auth.ts`, `src/middleware.ts`

---

## Evidencia de no dependencias nuevas

```
git diff --stat:
  7 files changed, 83 insertions(+), 9 deletions(-)
  No package.json, no pnpm-lock.yaml
```

Test "PR-2 workspace layout polish does not add new dependencies" → verde.

---

## Evidencia de reduced motion preservado

1. **Bloque consolidado** en `globals.css` (último `@media (prefers-reduced-motion: reduce)` del archivo): cubre `dashboard-card-interactive`, `dashboard-btn-interactive`, `dashboard-row-interactive` (PR-1) y añade `animation: none` para `dashboard-workspace-enter` (PR-2).
2. **Bloque global preexistente** (`globals.css:932-950`): `transition-duration: 0.01ms !important` y `animation-duration: 0.01ms !important` a `*`.
3. **Test**: "PR-2 globals.css reduced-motion disables dashboard-workspace-enter animation" → verde.
4. **E2E**: "reduced-motion: workspace still visible with prefers-reduced-motion: reduce" → cobertura de smoke.
5. **PR-1 tests**: "PR-1 globals.css reduced-motion overrides dashboard-card-interactive transition" → sigue verde (bloque consolidado cubre ambos PRs).

---

## Evidencia de no scroll global

- `DashboardShellRouter.tsx` mantiene `h-dvh overflow-hidden` (sin cambio)
- Test "PR-2 DashboardShellRouter keeps h-dvh overflow-hidden preventing global scroll" → verde
- E2E "no global scroll" verifica `scrollHeight - clientHeight ≤ 5px`

---

## Evidencia de que no se reintroduce AdminSectionTabs como navegación principal

- `DashboardShellRouter.tsx` no importa `AdminSectionTabs` (sin cambio)
- Test "PR-2 DashboardShellRouter does not import AdminSectionTabs" → verde

---

## No-alcance explícito

- **No command palette**: no implementado; pertenece a PR-8
- **No data visualization**: no implementado; pertenece a PR-7
- **No AI / copilot**: no implementado; pertenece a PR-10
- **No rediseño total**: estructura hub → workspace sin cambios
- **No transición hub↔workspace con View Transitions API**: no implementado en este PR (requiere mayor análisis de hydration risk)
- **No tooltip component**: reemplazo de `title=` en sidebar no está en scope de PR-2
- **No backend**: cero archivos en `server/`, `drizzle/`, `shared/`
- **No auth / middleware**: no tocados
- **No PWA / service worker**: no tocados
- **No dependencias nuevas**: `frontend/package.json` sin cambios
- **No `next-env.d.ts` / `tsconfig.json`**: intactos post-build
- **No selección optimista de informes**: pertenece a PR-3
- **No search highlight**: pertenece a PR-3
- **No filtros client-side**: pertenece a PR-3
