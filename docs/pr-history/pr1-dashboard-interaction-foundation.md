# PR-1: Dashboard Interaction Foundation

- **Fecha:** 2026-06-10
- **Rama:** `feat/ui-dashboard-interaction-foundation`
- **Base:** `main` — HEAD `1868a1e fix(dashboard): stabilize admin workspace sync and reports filters (#924)`
- **Tipo:** feat(ui)

---

## Problema

El dashboard clínica/admin tenía interacciones planas:

- Las cards del hub usaban `duration-200` hardcodeado sin tokens reutilizables.
- El botón "Volver a módulos" usaba `transition-colors` sin duración explícita.
- No existían tokens CSS de motion ni clases de interacción reutilizables.
- Sin estado `active:/press` en cards ni botones de workspace.
- Las clases de reducción de movimiento no cubrían explícitamente los nuevos patrones.

---

## Objetivo visual

Establecer una foundation reutilizable de motion tokens e interaction classes que todo futuro PR del roadmap premium pueda consumir sin reintroducir duraciones hardcodeadas ni violaciones de `prefers-reduced-motion`.

---

## Solución aplicada

### 1. Motion tokens en `globals.css` (`:root`)

```css
--motion-fast: 120ms;
--motion-base: 180ms;
--motion-slow: 280ms;
--ease-out-soft: cubic-bezier(0.16, 1, 0.3, 1);
--ease-in-out-soft: cubic-bezier(0.4, 0, 0.2, 1);
```

### 2. Clases interaction foundation (`globals.css`, sección `dashboard-interaction-foundation`)

| Clase | Uso | Transitions | Active state |
|---|---|---|---|
| `.dashboard-card-interactive` | Cards del hub | `border-color, box-shadow, transform` / `--motion-base` / `--ease-out-soft` | `scale(0.99)` |
| `.dashboard-btn-interactive` | Botones de workspace (Volver, etc.) | `background-color, border-color, box-shadow, color, transform` / `--motion-fast` / `--ease-out-soft` | `scale(0.98)` |
| `.dashboard-row-interactive` | Filas de lista (ready for PR-3) | `background-color, border-color` / `--motion-fast` / `--ease-out-soft` | — |
| `.dashboard-disabled-state` | Estado disabled claro | `opacity: 0.45; cursor: not-allowed; pointer-events: none` | — |

### 3. Reduced motion override explícito

Dentro de la sección `@layer components` de interaction-foundation:

```css
@media (prefers-reduced-motion: reduce) {
  .dashboard-card-interactive,
  .dashboard-btn-interactive,
  .dashboard-row-interactive {
    transition: none;
  }
  .dashboard-card-interactive:active,
  .dashboard-btn-interactive:active {
    transform: none;
  }
}
```

Complementa el bloque global preexistente (`globals.css:927-945`) que ya aplica `transition-duration: 0.01ms !important` a todos los elementos.

### 4. Aplicación en componentes

**`DashboardModuleHub.tsx`:**
- `"transition-[border-color,box-shadow] duration-200"` → `"dashboard-card-interactive"`
- Se mantienen: hover states Tailwind, `focus-visible:ring-2 focus-visible:ring-ring/85 focus-visible:ring-offset-2`, `data-dashboard-module-card`, `data-dashboard-module-hub`

**`DashboardModuleWorkspace.tsx`:**
- `transition-colors` (sin duración) → `dashboard-btn-interactive`
- Se mantienen: hover states, focus ring, `data-dashboard-module-workspace`, "Volver a módulos" aria-label

---

## Tokens / clases agregadas

```
:root {
  --motion-fast: 120ms
  --motion-base: 180ms
  --motion-slow: 280ms
  --ease-out-soft: cubic-bezier(0.16, 1, 0.3, 1)
  --ease-in-out-soft: cubic-bezier(0.4, 0, 0.2, 1)
}

@layer components {
  .dashboard-card-interactive
  .dashboard-card-interactive:active
  .dashboard-btn-interactive
  .dashboard-btn-interactive:active
  .dashboard-row-interactive
  .dashboard-disabled-state
  @media (prefers-reduced-motion: reduce) { ... }
}
```

---

## Archivos tocados

| Archivo | Tipo de cambio |
|---|---|
| `frontend/src/app/globals.css` | +53 líneas: motion tokens en `:root` + sección `dashboard-interaction-foundation` |
| `frontend/src/components/dashboard/DashboardModuleHub.tsx` | -1/+1: `duration-200` → `dashboard-card-interactive` |
| `frontend/src/components/dashboard/DashboardModuleWorkspace.tsx` | -1/+1: `transition-colors` → `dashboard-btn-interactive` |
| `test/frontend-dashboard-interaction-foundation.test.ts` | nuevo: 24 tests nativos |
| `frontend/e2e/dashboard-interaction-foundation.spec.ts` | nuevo: 6 smoke E2E |
| `docs/pr1-dashboard-interaction-foundation.md` | nuevo: este documento |

---

## Tests agregados / actualizados

### Nuevos: `test/frontend-dashboard-interaction-foundation.test.ts` (24 tests)

- Presencia de los 5 tokens CSS en `:root`
- Definición de `.dashboard-card-interactive` con `--motion-base` y `--ease-out-soft`
- Estado `:active { transform: scale(0.99) }` en card interactive
- Definición de `.dashboard-btn-interactive` con `--motion-fast`
- Estado `:active { transform: scale(0.98) }` en btn interactive
- Definición de `.dashboard-row-interactive` y `.dashboard-disabled-state`
- Bloque `@media (prefers-reduced-motion: reduce)` cubre los 3 nuevos patrones
- Reduced-motion elimina `transform` en estados active
- Sección delimitada por comentarios `start/end`
- `DashboardModuleHub` usa `dashboard-card-interactive`
- `DashboardModuleHub` no tiene `duration-200` hardcodeado
- `DashboardModuleHub` mantiene atributos `data-` para E2E
- `DashboardModuleHub` mantiene `focus-visible:ring-2`
- `DashboardModuleWorkspace` usa `dashboard-btn-interactive` en Volver
- `DashboardModuleWorkspace` mantiene focus ring y atributo `data-`
- `DashboardShellRouter` mantiene `h-dvh overflow-hidden` (no scroll global)
- Shell no importa `AdminSectionTabs` como navegación
- Scope guard: sin dependencias nuevas
- Scope guard: archivos prohibidos no tocados

### Nuevos: `frontend/e2e/dashboard-interaction-foundation.spec.ts` (6 tests smoke)

- `/dashboard` carga hub clínica
- `/dashboard/admin` carga hub admin
- `/dashboard?module=operaciones` renderiza workspace
- `/dashboard/admin?module=admin-clinics` renderiza workspace
- Hub cards tienen `.dashboard-card-interactive` en DOM
- Volver button tiene `.dashboard-btn-interactive` en DOM
- Reduced motion: hub visible con `prefers-reduced-motion: reduce`

---

## Comandos ejecutados

**Terminal 1:**

```powershell
git branch --show-current            # feat/ui-dashboard-interaction-foundation
git status --short                   # limpio al inicio
git log -1 --oneline                 # 1868a1e fix(dashboard): stabilize admin...
git diff --check                     # sin errores whitespace
git diff --stat                      # 3 archivos: globals.css (+53), Hub (-1/+1), Workspace (-1/+1)
pnpm --dir frontend lint             # OK
pnpm --dir frontend typecheck        # OK
pnpm --dir frontend build            # OK (Next.js 16.2.7 Turbopack, 25 páginas)
git status --short                   # next-env.d.ts y tsconfig.json intactos
node --test test/frontend-dashboard-interaction-foundation.test.ts  # 24/24
node --test test/frontend-dashboard-shell.test.ts                   # 6/6
node --test test/frontend-dashboard-accessibility-focus-aria.test.ts # 6/6
node --test test/frontend-dashboard-admin-section-tabs.test.ts       # 5/5
node --test test/frontend-dashboard-shared-components.test.ts ...    # 43/43
pnpm validate:local                  # 2495/2495
pnpm security:public-surface         # PASS
```

---

## Riesgos

| Riesgo | Valoración | Mitigación aplicada |
|---|---|---|
| CSS specificity: tokens vs Tailwind `duration-*` | Bajo | Se elimina `duration-200` del componente; el token del CSS class es la única fuente de verdad |
| Regresión de `data-dashboard-module-*` atributos (usados en E2E) | Bajo | Atributos no tocados; verificados por tests nativos |
| `will-change: transform` creando stacking contexts inesperados | Eliminado | No se usa `will-change` en las nuevas clases |
| scale(0.99) recortando contenido en tarjetas con overflow | Muy bajo | Hub cards no tienen `overflow: hidden` en el wrapper; scale es sutil |
| Hydration mismatch: active state con transform | Ninguno | El `:active` es CSS puro, no condicionado a estado cliente de React |
| Break de E2E existentes por cambio de clases | Ninguno | E2E usan `data-*` atributos, no class names |

---

## Evidencia de reduced motion

**Cobertura doble:**

1. **Global preexistente** (`globals.css:927-945`): aplica `transition-duration: 0.01ms !important` a `*` + `transition: none; animation: none` a `.render-card`, `.premium-card`, `[data-services-polished="true"] > [id]`, `.clinical-skeleton`.

2. **Nueva sección explícita** (`dashboard-interaction-foundation`): `transition: none` y `transform: none` específicamente en `.dashboard-card-interactive`, `.dashboard-btn-interactive`, `.dashboard-row-interactive` con sus estados `:active`.

**Test:** "PR-1 globals.css reduced-motion overrides dashboard-card-interactive transition" → verde.

---

## Evidencia de no dependencias nuevas

```powershell
git diff --stat
# 3 files changed, 55 insertions(+), 2 deletions(-)
# No package.json, no pnpm-lock.yaml
```

`pnpm validate:local` pasa sin instalar nada nuevo. `pnpm security:public-surface` PASS.

---

## Evidencia de no scroll global

`DashboardShellRouter.tsx` mantiene `h-dvh overflow-hidden` en el contenedor raíz (verificado por test "PR-1 DashboardShellRouter keeps h-dvh overflow-hidden preventing global scroll").

---

## Evidencia de no AdminSectionTabs como navegación principal

`DashboardShellRouter.tsx` no importa `AdminSectionTabs` (verificado por test "PR-1 dashboard shell router does not use AdminSectionTabs as navigation"). El componente existe en disco como código muerto (no modificado ni usado en páginas — igual que antes de este PR).

---

## No-alcance explícito

- **No command palette**: no implementado; pertenece a PR-8.
- **No data visualization**: no implementado; pertenece a PR-7.
- **No AI / copilot**: no implementado; pertenece a PR-10.
- **No rediseño total**: estructura de hub → workspace sin cambios.
- **No transición hub↔workspace**: animación de entrada/salida pertenece a PR-2.
- **No tooltip component**: reemplazo de `title=` en sidebar pertenece a PR-1b o PR-2.
- **No backend**: cero archivos en `server/`, `drizzle/`, `shared/`.
- **No auth / middleware**: no tocados.
- **No PWA / service worker**: no tocados.
- **No deps nuevas**: `frontend/package.json` sin cambios.
- **No `next-env.d.ts` / `tsconfig.json`**: intactos post-build.
