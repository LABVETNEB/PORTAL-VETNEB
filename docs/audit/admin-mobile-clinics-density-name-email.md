# VETNEB — Fix: densidad mobile del módulo Clínicas (Admin) — 10/página, nombre+mail

Módulo 2 de 7 del bloque "Admin Mobile Refinement". Cada módulo se entrega
como rama/PR independiente, siguiendo el precedente #1077→#1081 (y el módulo
1, Hub, en `fix/admin-mobile-hub-card-density`).

---

## 1. Rama y base

- Rama: `fix/admin-mobile-clinics-density` (creada en un worktree aislado
  desde `main` limpio, para no mezclar el diff sin commitear del módulo 1).
- HEAD base: `aa6bea6 fix(admin): align mobile core pager to canonical pager layout (#1081)`.

## 2. Alcance

Lista mobile de `AdminClinicsManagementCard` (Clínicas, Dashboard
Administrador):

1. Mostrar 10 clínicas por página en mobile (antes: 3).
2. En el cuerpo visible de cada card: sólo nombre y email.
3. Quitar del cuerpo visible los detalles secundarios (usuario/`+N`, fecha de
   actualización).
4. Esos detalles secundarios quedan accesibles desde el botón `Editar`
   existente (`ClinicEditDrawer`), sin agregar un nuevo control de
   disclosure — es la opción de menor riesgo y menor diff.
5. Mantener `Editar` operativo, paginador canónico abajo, sin scroll.

## 3. No alcance

Backend, API, DB, auth, dependencias, lockfiles, CI, rutas públicas,
producción, dashboard Clínica, desktop, filtro de búsqueda (preservado tal
cual), Hub, Auditoría, Alertas, Informes, Tokens, Sesiones (cada uno su
propio PR).

## 4. Diagnóstico previo

- `frontend/src/app/dashboard/admin/AdminClinicsManagementCard.tsx`:
  - `MOBILE_PAGE_SIZE = 3` (línea 56), independiente de `PAGE_SIZE = 9`
    (desktop) — mismo patrón ya usado por Tokens (#1077), por lo que subir
    sólo la constante mobile no afecta desktop.
  - El mobile list (`data-admin-clinics-mobile-list`) usaba `<article>` por
    clínica con `border`, `shadow`, padding amplio y una segunda línea con
    `Usuario: {username}{+N}` y `Actualizada: {fecha}` — exactamente los
    "detalles secundarios" a quitar del cuerpo visible.
  - `ClinicEditDrawer.tsx` (abierto por el botón `Editar`) ya renderiza la
    lista completa de usuarios de la clínica (`clinic.users.map(...)`, línea
    314) con sus credenciales editables — cubre el detalle de "usuario" sin
    cambios. No muestra `updatedAt`; se decidió no agregarlo (ver §6.2).
  - El paginador mobile (`data-admin-mobile-core-pager`) ya usa el patrón
    canónico `Anterior` / `Pág. X / Y` / `Siguiente` (alineado en #1078).
- e2e: `admin-clinics-mobile-card-layout.spec.ts` (contrato dedicado de
  Clínicas mobile) tenía aserciones que fijaban el comportamiento viejo:
  `visibleMobileCards <= 3` y dataset mock de 9 clínicas. Sin esa
  actualización, el PR quedaría en rojo por diseño.
- `admin-mobile-core-modules-no-scroll.spec.ts` (contrato compartido
  clinics/reports/tokens): `maxItemsPerPage` para `clinics` estaba en `5`
  (remanente de un ajuste previo a #1077-1081); se alineó a `10`.

## 5. Archivos modificados

| Archivo | Cambio |
|---|---|
| `frontend/src/app/dashboard/admin/AdminClinicsManagementCard.tsx` | `MOBILE_PAGE_SIZE` 3→10. Mobile list: de `grid` con `<article>` bordeado/con sombra por clínica, a lista compacta `divide-y` (mismo patrón que Tokens, #1077) con filas `min-h-9`. Cada fila muestra sólo nombre + email; se quitó la línea de `Usuario:`/`Actualizada:`. El botón `Editar` se mantuvo en `h-9` (touch target 36px, sin cambios) y su `aria-label` ahora indica explícitamente que el usuario y la fecha de actualización se ven al editar. Ningún `md:*` (desktop) tocado. |
| `frontend/e2e/admin-clinics-mobile-card-layout.spec.ts` | Dataset mock 9→13 clínicas (para que la paginación 10/página sea significativa). Aserción `visibleMobileCards <= 3` → `=== 10`. Nuevas aserciones: cada card muestra email (`cardsShowingEmail === 10`) y ninguna muestra la línea secundaria vieja (`secondaryDetailLineCount === 0`). Se mantiene intacta la aserción de touch target ≥36px en `Editar`. El click a "Editar clínica 1" se acotó a la primera card (antes el regex de nombre coincidía también con "Clínica Mobile 10" por substring). Nuevo test: el drawer de edición sigue exponiendo el username (`mobile-owner-1`) que se quitó de la card. Nuevo test de paginación: página 1 muestra clínicas 1-10, página 2 muestra 11-13, `Pág. 1/2` → `Pág. 2/2`. |
| `frontend/e2e/admin-mobile-core-modules-no-scroll.spec.ts` | Dataset mock de `MOCK_CLINICS` 9→13 (mismo ajuste que Tokens en #1077, para que "cambia de página" siga siendo significativo). `maxItemsPerPage` de `clinics` 5→10. `reports`/`tokens` sin cambios. |

No se crearon archivos nuevos de test: se reforzaron el spec dedicado de
Clínicas y el contrato compartido más cercano.

## 6. Decisiones técnicas

1. **Lista compacta `divide-y` en vez de cards con borde/sombra**: mismo
   patrón ya validado por Tokens (#1077) para alcanzar 10 filas sin scroll;
   reduce el riesgo de reinventar un layout nuevo.
2. **Detalles secundarios accesibles vía `Editar`, sin nuevo control de
   3 puntos**: el drawer ya existente (`ClinicEditDrawer`) muestra la lista
   completa de usuarios de la clínica (más completa que el `+N` que había en
   la card). La fecha `updatedAt` no se relocalizó a ningún lado: es
   metadata no crítica (no es un dato operable ni de seguridad) y agregar un
   nuevo elemento de UI sólo para mostrarla habría sido mayor diff y mayor
   riesgo que omitirla, sin perder ninguna acción real.
3. **Botón `Editar` se mantuvo en `h-9` (36px)**: el spec dedicado de
   Clínicas exige explícitamente `>=36px` de touch target; reducirlo para
   ganar espacio vertical (como hace `Ver` en Tokens, a 28px) habría violado
   esa restricción y la regla general "Mantener touch targets >=36px" del
   bloque. El ajuste de densidad se logró achicando el padding vertical de
   la fila (`py-0.5`) y el texto (nombre `text-xs`, email `0.68rem`), no el
   control interactivo.
4. **Sin cambios en `globals.css`**: no existía ninguna regla CSS acoplada a
   `data-admin-clinics-mobile-list`/`data-admin-clinic-mobile-card`; todo el
   ajuste fue posible con clases Tailwind locales al componente.

## 7. Validaciones ejecutadas

| Comando | Resultado |
|---|---|
| `pnpm --dir frontend lint` | OK (sin salida) |
| `pnpm --dir frontend typecheck` | OK |
| `pnpm --dir frontend build` | OK (`next build` exitoso, 25 rutas) |
| `npx playwright test e2e/admin-clinics-mobile-card-layout.spec.ts` | **GREEN 4/4** (3 viewports + test de paginación nuevo) |
| `npx playwright test e2e/admin-mobile-core-modules-no-scroll.spec.ts e2e/admin-mobile-final-polish-no-scroll.spec.ts e2e/admin-mobile-module-layer-isolation.spec.ts` | **GREEN 24/24** (regresión clinics/reports/tokens, chrome mobile, aislamiento de capas) |
| `npx playwright test e2e/admin-mobile-hub-launcher-no-scroll.spec.ts` | **GREEN 6/6** (navegación Hub→Clínicas intacta) |

`pnpm test` (root, suite backend) no se ejecutó: este PR no toca ningún
archivo bajo `test/` ni backend.

> Nota operativa: esta vez `frontend/next-env.d.ts` no quedó modificado tras
> correr Playwright/build en este worktree (`git status` limpio salvo los 3
> archivos de implementación); se verificó explícitamente para no arrastrar
> el efecto colateral conocido del repo.

## 8. Resultado de tests (TDD)

- **RED inicial (esperado por diseño):** con el dataset viejo (9 clínicas) y
  la aserción vieja (`<=3`), el spec dedicado fallaba contra el código
  nuevo (10 filas) por incompatibilidad de expectativas — se actualizó el
  spec en el mismo PR, conforme al protocolo (alinear specs en el mismo
  cambio, precedente #958).
- **RED #1 (al reforzar):** `getByRole('button', { name: /editar clínica
  clínica mobile 1/i })` resolvía a 2 botones (`...Mobile 1` y
  `...Mobile 10`, coincidencia por substring). Fix: acotar el click a la
  primera card visible (`.first()`) y anclar el regex con `^`.
- **RED #2 (al reforzar):** el test de paginación usaba
  `page.getByText("Clínica Mobile 1")`, que también matcheaba el nombre en
  la tabla desktop oculta (`display:none` pero presente en el DOM). Fix:
  acotar todas las aserciones de texto al contenedor
  `[data-admin-clinics-mobile-list='true']`.
- **GREEN:** 3/3 viewports del spec dedicado + paginación 10/3 entre página
  1 y 2, sin overflow, `Editar` ≥36px sin clipping, drawer expone el
  username removido de la card.

## 9. `git status --short --untracked-files=all`

```
 M frontend/e2e/admin-clinics-mobile-card-layout.spec.ts
 M frontend/e2e/admin-mobile-core-modules-no-scroll.spec.ts
 M frontend/src/app/dashboard/admin/AdminClinicsManagementCard.tsx
?? docs/audit/admin-mobile-clinics-density-name-email.md
```

## 10. `git diff --stat`

```
 .../e2e/admin-clinics-mobile-card-layout.spec.ts   | 69 ++++++++++++++++++---
 .../admin-mobile-core-modules-no-scroll.spec.ts    |  4 +-
 .../dashboard/admin/AdminClinicsManagementCard.tsx | 62 +++++++------------
 3 files changed, 84 insertions(+), 51 deletions(-)
```

## 11. Confirmación explícita

- **10 clínicas por página en mobile:** confirmado (`toBe(10)` en e2e).
- **Cuerpo visible: sólo nombre + email:** confirmado
  (`cardsShowingEmail === 10`, `secondaryDetailLineCount === 0`).
- **Detalles secundarios accesibles vía `Editar`:** confirmado (drawer
  expone username completo; `updatedAt` se decidió omitir, ver §6.2).
- **Botón `Editar` operativo:** confirmado (abre el drawer, touch target
  ≥36px sin clipping en los 3 viewports).
- **Paginador canónico abajo:** confirmado (`Pág. X / Y`, `Anterior`/
  `Siguiente`, sin cambios de markup/posición).
- **Sin scroll global / interno / `overflow:auto`/`scroll` agregado:**
  confirmado (contrato compartido `admin-mobile-core-modules-no-scroll`
  sigue verde; `git diff` no introduce overflow nuevo).
- **Appbar / bottom nav preservados:** confirmado (specs de chrome mobile
  compartidos siguen verdes; archivos de chrome no tocados).
- **#1074 / #1076 preservados:** no tocados (ningún archivo de
  `AdminDashboardWorkspaceController.tsx` ni de las variables
  `--admin-mobile-*` fue modificado en este PR).
- **Backend/API/DB/auth/dependencias/lockfiles/CI/dashboard Clínica/otros
  módulos admin:** no tocados (`git diff --stat`: 1 componente + 2 specs
  e2e).

## 12. Riesgo residual

1. La fecha `updatedAt` ya no es visible en ningún punto del flujo mobile
   (ni card ni drawer). Es metadata de bajo valor operativo (no se usa para
   tomar decisiones en el dashboard), pero si en el futuro se necesitara
   visible en mobile, se podría agregar al drawer en un PR puntual.
2. Densidad de 10 filas verificada con Playwright/Chromium headless en 3
   viewports estándar (360×740 a 430×932); no verificada en hardware real.
   Riesgo bajo: el ajuste es de espaciado/Tailwind puro, sin transform ni
   composición GPU.

## 13. Nota de CI (PR2 — fix posterior al PR abierto #1083)

- **Backend CI falló** en #1083: `pnpm test` (suite root, Node `--test`)
  tenía 3 contratos pineados a la densidad mobile anterior, esperando
  literalmente `const MOBILE_PAGE_SIZE = 3;` en
  `AdminClinicsManagementCard.tsx`:
  - `test/admin-mobile-core-pager-canonical-layout.test.ts` — test
    `admin core pagers do not alter fetch, page size or pagination logic`.
  - `test/admin-overview-clinics-enterprise-density.test.ts` — test
    `admin clinics console raises the server page size while respecting
    no-scroll`.
  - `test/frontend-admin-clinics-management-card.test.ts` — test
    `admin clinics management card renders mobile cards while preserving
    desktop table`.
- **No era flaky**: los 3 contratos fallaban de forma determinística
  porque seguían codificando el valor viejo (3) del cambio intencional de
  este mismo PR (10). No se hizo rerun; se corrigieron los contratos.
- **Corrección aplicada**: se actualizaron los 3 archivos para esperar
  `MOBILE_PAGE_SIZE = 10` en Clínicas. El test compartido de
  `admin-mobile-core-pager-canonical-layout.test.ts` que mezclaba
  Clínicas+Informes en un solo `test()` con nombre "do not alter... page
  size" se separó en dos tests independientes: uno para Clínicas
  (`page size intentionally raised to 10, fetch/desktop untouched`) y uno
  para Informes (`do not alter fetch, page size or pagination logic`, sin
  cambios — Informes sigue en 3 en esta rama; su propio cambio a 10 vive en
  el PR de Informes, módulo 5, rama aparte). No se tocó ningún otro
  contrato, ni backend/API/DB/auth/deps/lockfiles/CI.
- **Validación tras el fix**: `pnpm test` (root) → **2826/2826 OK**;
  `pnpm typecheck`, `pnpm typecheck:test`, `pnpm build` (backend) → OK;
  `pnpm --dir frontend lint`/`typecheck` → OK (frontend ya estaba verde,
  sin cambios adicionales).

---

### Cierre / Git manual (protocolo VETNEB)

Implementación, tests y validaciones completas. Según el protocolo, **Git lo
ejecuta Nico**. Este PR vive en un worktree separado
(`C:\PORTAL-VETNEB-clinics`) para no mezclarse con el módulo 1 (Hub), que
sigue sin commitear en `C:\PORTAL-VETNEB`. Los comandos siguientes deben
ejecutarse **desde `C:\PORTAL-VETNEB-clinics`**:

```powershell
cd C:\PORTAL-VETNEB-clinics
git add frontend/src/app/dashboard/admin/AdminClinicsManagementCard.tsx `
        frontend/e2e/admin-clinics-mobile-card-layout.spec.ts `
        frontend/e2e/admin-mobile-core-modules-no-scroll.spec.ts `
        docs/audit/admin-mobile-clinics-density-name-email.md
git status --short --untracked-files=all
git commit -m "fix(admin): show 10 clinics per mobile page with name and email only"
git push -u origin fix/admin-mobile-clinics-density
gh pr create --base main --head fix/admin-mobile-clinics-density --title "fix(admin): show 10 clinics per mobile page with name and email only" --body "## Summary
- Raise Admin mobile Clinics list from 3 to 10 visible clinics per page
- Reduce each mobile card to name + email; user list and credentials stay reachable via the existing Editar drawer
- Compact the mobile row pattern to fit 10 rows without scroll, matching the Tokens module (#1077)

## Scope
- Admin Dashboard mobile Clínicas module only (2 of 7 in the mobile refinement block)

## Not touched
- Backend, API, DB, auth, dependencies, lockfiles, CI, public routes, production, Clínica dashboard, desktop, search filter, other admin modules

## Validation
- pnpm --dir frontend lint
- pnpm --dir frontend typecheck
- pnpm --dir frontend build
- playwright admin-clinics-mobile-card-layout.spec.ts (4/4)
- playwright admin-mobile-core-modules-no-scroll.spec.ts + admin-mobile-final-polish-no-scroll.spec.ts + admin-mobile-module-layer-isolation.spec.ts (24/24 regression)
- playwright admin-mobile-hub-launcher-no-scroll.spec.ts (6/6, Hub→Clínicas navigation)"
gh pr checks --watch

# Tras mergear este PR (o el del Hub), eliminar el worktree:
cd C:\PORTAL-VETNEB
git worktree remove ../PORTAL-VETNEB-clinics
```
