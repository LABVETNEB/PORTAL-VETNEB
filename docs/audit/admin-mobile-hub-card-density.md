# VETNEB — Fix: cards del Hub Admin mobile sin borde con ícono protagonista

Módulo 1 de 7 del bloque "Admin Mobile Refinement". Cada módulo se entrega
como rama/PR independiente, siguiendo el precedente #1077→#1081.

---

## 1. Rama y base

- Rama: `fix/admin-mobile-hub-card-density` (creada desde `main` limpio).
- HEAD base: `aa6bea6 fix(admin): align mobile core pager to canonical tokens layout (#1081)`.

## 2. Alcance

Hub/Inicio del Dashboard Administrador mobile (`AdminMobileHubLauncher` /
`AdminMobileLauncherTile`):

1. Quitar el borde visual de las cards del launcher.
2. Agrandar el ícono/logo de cada card al máximo posible sin overflow ni
   superposición con la etiqueta.
3. Mantener el tamaño de las cards, la cantidad por página (5+5 en grilla
   2×3 con un slot vacío), la navegación y el contrato no-scroll.

## 3. No alcance

Backend, API, DB, auth, dependencias, lockfiles, CI, rutas públicas,
producción, dashboard Clínica, desktop, paginación del hub, labels/orden de
módulos, cualquier otro módulo admin (Clínicas, Auditoría, Alertas, Informes,
Tokens, Sesiones — cada uno será su propio PR).

## 4. Diagnóstico previo

- `frontend/src/components/dashboard/AdminMobileLauncherTile.tsx`: renderiza
  ícono (`<card.icon className="h-4 w-4">`) + etiqueta dentro de
  `.admin-mobile-hub-tile`; no mostraba descripción en el body (ya cumplía
  "ícono + nombre").
- `frontend/src/app/globals.css`:
  - `.admin-mobile-hub-tile` (línea ~2751): tenía
    `border: 1px solid hsl(var(--vetneb-line) / 0.8)`.
  - `.admin-mobile-hub-tile-icon` (línea ~2770): tamaño del badge controlado
    por `--admin-mobile-tile-icon-size` (clamp fluido + tier de altura corta
    `@media (max-height: 700px)`), no por el tamaño del SVG.
  - El tamaño del grid/tile (cards) viene de
    `.admin-mobile-hub-launcher-grid` (2 columnas × 3 filas fijas vía
    `grid-template-rows: repeat(3, minmax(0,1fr))`), no de la card individual
    → no se tocó, así se preserva el tamaño y cantidad por página.
- e2e existente: `admin-mobile-hub-launcher-no-scroll.spec.ts` (contrato
  no-scroll + paginación + navegación del hub, sin aserciones sobre borde o
  tamaño de ícono).

## 5. Archivos modificados

| Archivo | Cambio |
|---|---|
| `frontend/src/components/dashboard/AdminMobileLauncherTile.tsx` | Ícono SVG de `h-4 w-4` (16px) a `h-6 w-6` (24px). |
| `frontend/src/app/globals.css` | `.admin-mobile-hub-tile`: `border: 1px solid hsl(var(--vetneb-line)/0.8)` → `border: none`. `--admin-mobile-tile-icon-size` (badge del ícono): clamp base de `1.7rem–2rem` a `2.05rem–2.4rem`; tier `max-height:700px` de `1.55rem` a `1.9rem`. |
| `frontend/e2e/admin-mobile-hub-launcher-no-scroll.spec.ts` | Nuevo test: cards sin borde (`border-style: none`), ícono visible ≥20px, ícono nunca excede el badge contenedor (sin overflow/superposición), en los 10 módulos del hub a 390×844. |

## 6. Decisiones técnicas

1. **No se tocó el tamaño de la card/tile en sí** (la grilla 2×3 sigue fija):
   sólo creció el badge interno del ícono (`--admin-mobile-tile-icon-size`,
   +0.35rem en cada tier) y el SVG dentro de ese badge. Esto agranda el ícono
   "al máximo posible" dentro del espacio existente sin alterar el tamaño
   externo de la card, conforme a "mantener el tamaño actual de las cards".
2. **`border: none` en vez de `border-color: transparent`**: elimina el
   borde sin dejar un 1px de espacio reservado que pudiera desalinear el
   padding interno.
3. **Sin cambios en `admin-mobile-hub-launcher-grid` ni en
   `AdminMobileHubPager`**: cantidad por página, navegación y paginación
   quedan exactamente iguales (10 módulos repartidos en páginas de hasta 6).

## 7. Validaciones ejecutadas

| Comando | Resultado |
|---|---|
| `pnpm --dir frontend lint` | OK (sin salida) |
| `pnpm --dir frontend typecheck` | OK |
| `pnpm --dir frontend build` | OK (`next build` exitoso, 25 rutas) |
| `npx playwright test e2e/admin-mobile-hub-launcher-no-scroll.spec.ts` (en `frontend/`) | **GREEN 7/7** (incluye el nuevo test borde/ícono + 5 viewports no-scroll + desktop sin launcher) |
| `npx playwright test e2e/admin-mobile-core-modules-no-scroll.spec.ts e2e/admin-mobile-module-layer-isolation.spec.ts e2e/admin-mobile-final-polish-no-scroll.spec.ts` (en `frontend/`) | **GREEN 24/24** (regresión de módulos vecinos, no-scroll, aislamiento de capas, chrome mobile) |

> Nota operativa: tras correr `playwright test`, el dev server regeneró
> `frontend/next-env.d.ts` apuntando a `./.next/dev/types/routes.d.ts`; se
> revirtió a `./.next/types/routes.d.ts` (`git checkout -- next-env.d.ts`)
> antes de typecheck/build, según el patrón conocido del repo.

`pnpm test` (root, suite backend) y `pnpm validate:local` no se ejecutaron
porque este PR no toca ningún archivo bajo `test/` ni backend — el cambio es
exclusivamente CSS/JSX de un componente de presentación del frontend.

## 8. Confirmación explícita

- **Inicio cards sin borde:** confirmado (`border-style: none` verificado en
  los 10 módulos del hub vía e2e).
- **Ícono máximo posible, sin overflow ni superposición:** confirmado
  (ícono ≥20px, `iconBox <= badgeBox` en los 10 módulos).
- **Tamaño de card preservado:** confirmado (grid 2×3 sin cambios; no se tocó
  `admin-mobile-hub-launcher-grid` ni `> li`).
- **Cantidad por página y navegación preservadas:** confirmado (10 módulos
  repartidos en 2 páginas, igual que antes; specs de navegación a
  Clínicas/Auditoría/Sesiones siguen verdes).
- **Sin scroll global:** confirmado (`html`/`body` `scrollHeight <=
  clientHeight` en los 5 viewports estándar).
- **Sin scroll interno / sin `overflow:auto`/`overflow:scroll` agregado:**
  confirmado (contrato `forbiddenLauncherOverflow` vacío; `git diff` no
  introduce `overflow-auto`/`overflow-scroll`).
- **Appbar / bottom nav preservados:** confirmado (specs comparten chrome
  mobile, siguen verdes; archivos de chrome no tocados).
- **#1074 / #1076 preservados:** no tocados (`AdminDashboardWorkspaceController.tsx`
  intacto; las variables `--admin-mobile-*` de #1076 sólo se ajustaron en
  valor, no se eliminó ni renombró ninguna).
- **Backend/API/DB/auth/dependencias/lockfiles/CI:** no tocados (`git diff
  --stat` sólo muestra 1 componente, 1 hoja de estilos y 1 spec e2e).

## 9. Riesgo residual

Bajo. El ajuste es puramente de tamaño de ícono/borde vía CSS y una prop de
clase Tailwind; no introduce overflow ni cambia el árbol de elementos del
hub. Verificado en los 5 viewports estándar del repo (360×640 a 430×932) con
Playwright/Chromium headless; no verificado en hardware real.

## 10. `git status --short --untracked-files=all`

```
 M frontend/e2e/admin-mobile-hub-launcher-no-scroll.spec.ts
 M frontend/src/app/globals.css
 M frontend/src/components/dashboard/AdminMobileLauncherTile.tsx
?? docs/audit/admin-mobile-hub-card-density.md
```

---

### Cierre / Git manual (protocolo VETNEB)

Implementación, tests y validaciones completas. Según el protocolo, **Git lo
ejecuta Nico**:

```powershell
git add frontend/src/components/dashboard/AdminMobileLauncherTile.tsx `
        frontend/src/app/globals.css `
        frontend/e2e/admin-mobile-hub-launcher-no-scroll.spec.ts `
        docs/audit/admin-mobile-hub-card-density.md
git status --short --untracked-files=all
git commit -m "fix(admin): remove hub card border and enlarge mobile icon"
git push -u origin fix/admin-mobile-hub-card-density
gh pr create --base main --head fix/admin-mobile-hub-card-density --title "fix(admin): remove hub card border and enlarge mobile icon" --body "## Summary
- Remove the visual border from Admin mobile hub launcher cards
- Enlarge the icon badge inside each card as much as possible without overflow or overlap
- Keep card size, modules per page, navigation and the no-scroll contract unchanged

## Scope
- Admin Dashboard mobile Hub/Inicio module only (1 of 7 in the mobile refinement block)

## Not touched
- Backend, API, DB, auth, dependencies, lockfiles, CI, public routes, production, Clínica dashboard, desktop, hub pagination, other admin modules

## Validation
- pnpm --dir frontend lint
- pnpm --dir frontend typecheck
- pnpm --dir frontend build
- playwright admin-mobile-hub-launcher-no-scroll.spec.ts (7/7)
- playwright admin-mobile-core-modules-no-scroll.spec.ts + admin-mobile-module-layer-isolation.spec.ts + admin-mobile-final-polish-no-scroll.spec.ts (24/24 regression)"
gh pr checks --watch
```
