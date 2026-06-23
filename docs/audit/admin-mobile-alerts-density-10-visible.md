# VETNEB — Fix: densidad mobile de Alertas (intentos fallidos) — 10/página

Módulo 4 de 7 del bloque "Admin Mobile Refinement". Cada módulo se entrega
como rama/PR independiente (precedente #1077→#1081; módulos 1-Hub,
2-Clínicas y 3-Auditoría ya entregados en sus propias ramas/worktrees).

---

## 1. Rama y base

- Rama: `fix/admin-mobile-alerts-density` (worktree aislado desde `main`
  limpio).
- HEAD base: `aa6bea6 fix(admin): align mobile core pager to canonical
  tokens layout (#1081)`.

## 2. Alcance

Chip "Alertas" dentro de `AdminMobileCommandModule` (módulo Resumen/
Administración mobile, sección `AdminMobileFailedLoginSection`):

1. Mostrar 10 intentos fallidos por página en mobile (antes: 3).
2. Mantener el layout general (chips Resumen/Actividad/Alertas, header con
   contador + botón `Actualizar`, paginador canónico abajo).
3. No tocar tabs salvo preservación mínima.
4. No tocar lógica de actualización ni fetch (`getAdminFailedLoginAlerts`,
   `loadAlerts`, el `useEffect` de carga — sin cambios; sólo cambia la
   constante de tamaño de página y la densidad visual de cada fila).

## 3. No alcance

Backend, API, DB, auth, dependencias, lockfiles, CI, rutas públicas,
producción, dashboard Clínica, desktop (`AdminFailedLoginAlertsReadOnlyCard`
y su tabla/paginación intactas), Hub, Clínicas, Auditoría, Informes, Tokens,
Sesiones (cada uno su propio PR). Tampoco se tocó el chip "Estado del
sistema" (`admin-health`, módulo separado).

## 4. Diagnóstico previo

- "Alertas" en el Dashboard Administrador **no es la tab de Auditoría** ni
  el módulo "Estado del sistema": es el chip `alertas` dentro del módulo
  Resumen/Administración (`AdminMobileCommandModule.tsx`), que renderiza
  `AdminMobileFailedLoginSection` — la vista mobile de
  `AdminFailedLoginAlertsReadOnlyCard` (intentos fallidos de login).
- `FAILED_LOGIN_PAGE_SIZE = 3` (línea 38) controlaba tanto el fetch
  (`limit`) como una grilla `grid-rows-3` fija para las filas.
- El chip "Alertas" ocupa el panel completo del `AdminMobileStatusModule`
  (sólo el chip activo se monta), por lo que tiene más presupuesto vertical
  que módulos como Auditoría/Sesiones (que comparten esa altura con un
  header de métricas y una barra de filtros).
- e2e existente: `admin-mobile-status-modules-no-scroll.spec.ts` (contrato
  no-scroll + gutters por chip de los módulos `admin`/`admin-health`,
  genérico — sin aserciones de conteo de ítems).

## 5. Archivos modificados

| Archivo | Cambio |
|---|---|
| `frontend/src/app/dashboard/admin/AdminMobileCommandModule.tsx` | `FAILED_LOGIN_PAGE_SIZE` 3→10. Lista de alertas: de `grid-rows-3` con tarjetas individuales bordeadas/redondeadas (3 líneas: badges+id, usuario, ip+fecha) a lista compacta `divide-y` (mismo patrón Tokens/Clínicas/Auditoría) con filas de 2 líneas (badges+usuario, ip+fecha) y el id reubicado al margen derecho de la fila. Header (contador + `Actualizar`) y paginador (`AdminMobileOpsPager`) sin cambios. Fetch (`getAdminFailedLoginAlerts`, `loadAlerts`, efectos) sin cambios. |
| `frontend/e2e/admin-mobile-status-modules-no-scroll.spec.ts` | Dataset mock `MOCK_FAILED_LOGIN_ALERTS` 8→13 (para que 10/página tenga una página 2 real). Nuevo test dedicado: chip Alertas muestra exactamente 10 ítems en página 1, paginador `Pág. 1/2`→`Pág. 2/2`, página 2 muestra los 3 restantes. |

No se crearon archivos de test nuevos: se reforzó el contrato más cercano
ya existente.

## 6. Decisiones técnicas

1. **Lista compacta `divide-y` en vez de `grid-rows-3` fijo**: mismo patrón
   ya validado en Tokens/Clínicas/Auditoría de este bloque; el chip
   "Alertas" tiene más presupuesto vertical que esos módulos (no comparte
   el panel con header de métricas ni filtros), por lo que 10 filas entran
   con margen incluso siendo levemente menos compactas.
2. **Id reubicado al margen derecho de la fila** (antes: línea propia junto
   a los badges) para ganar una línea de alto por fila sin perder el dato.
3. **Sin cambios en la lógica de fetch/paginación**: `loadAlerts`,
   `getAdminFailedLoginAlerts`, el `useMemo` de query y los `useEffect` de
   viewport/carga quedan idénticos; sólo cambió la constante
   `FAILED_LOGIN_PAGE_SIZE` (afecta el `limit`/`offset` que ya se
   parametrizaban, no la lógica en sí) y el markup de cada fila.
4. **Chips/tabs sin cambios**: `AdminMobileStatusModule` (el contenedor de
   chips) no se tocó; "Alertas" sigue siendo el tercer chip del módulo
   Resumen.

## 7. Validaciones ejecutadas

| Comando | Resultado |
|---|---|
| `pnpm --dir frontend lint` | OK (sin salida) |
| `pnpm --dir frontend typecheck` | OK |
| `pnpm --dir frontend build` | OK (`next build` exitoso, 25 rutas) |
| `npx playwright test e2e/admin-mobile-status-modules-no-scroll.spec.ts` | **GREEN 23/23** (10 viewports×modo para `admin`/`admin-health`, 2 desktop, 1 test nuevo dedicado a Alertas) |
| `npx playwright test e2e/admin-mobile-final-polish-no-scroll.spec.ts e2e/admin-mobile-module-layer-isolation.spec.ts e2e/admin-mobile-hub-launcher-no-scroll.spec.ts` | **GREEN 17/17** (regresión chrome mobile, aislamiento de capas, navegación del hub) |

`pnpm test` (root, suite backend) no se ejecutó: este PR no toca backend ni
archivos bajo `test/`.

> Nota operativa: `frontend/next-env.d.ts` no quedó modificado tras correr
> Playwright/build en este worktree; se verificó explícitamente.

## 8. Resultado de tests (TDD)

- **RED inicial (esperado por diseño):** el dataset viejo (8 alertas) no
  alcanzaba para probar una página 2 real a 10/página; se amplió a 13 en el
  mismo PR antes de escribir el test dedicado.
- **GREEN:** test dedicado confirma exactamente 10 ítems en página 1, 3 en
  página 2, paginador `Pág. 1/2`→`Pág. 2/2`; los 23 casos del contrato
  compartido (no-scroll, gutters balanceados, sin overflow auto/scroll,
  workspace header oculto, navegación de vuelta al hub) siguen en verde
  para ambos módulos de status (`admin`, `admin-health`) en los 5 viewports
  y 2 modos de color.

## 9. `git status --short --untracked-files=all`

```
 M frontend/e2e/admin-mobile-status-modules-no-scroll.spec.ts
 M frontend/src/app/dashboard/admin/AdminMobileCommandModule.tsx
?? docs/audit/admin-mobile-alerts-density-10-visible.md
```

## 10. Confirmación explícita

- **10 registros por página en mobile:** confirmado (`FAILED_LOGIN_PAGE_SIZE
  = 10`; e2e con dataset de 13 muestra página 1 con 10 y página 2 con 3).
- **Layout general mantenido:** confirmado (chips Resumen/Actividad/Alertas
  sin cambios, header contador+Actualizar sin cambios, badges de
  superficie/motivo preservados).
- **Paginador canónico abajo:** confirmado (`AdminMobileOpsPager`, mismo
  componente, sin cambios).
- **Tabs no tocados:** confirmado (`AdminMobileStatusModule` intacto).
- **Lógica de actualización/fetch no tocada:** confirmado (`git diff` no
  modifica `loadAlerts`, `getAdminFailedLoginAlerts`, ni los `useEffect`/
  `useMemo` de carga — sólo la constante de tamaño de página y el markup
  de la fila).
- **Sin scroll global / interno / `overflow:auto`/`scroll` agregado:**
  confirmado (contrato de gutters/no-scroll sigue verde en los 5 viewports
  × 2 modos).
- **Appbar / bottom nav preservados:** confirmado (specs de chrome mobile
  compartidos siguen verdes).
- **#1074 / #1076 preservados:** no tocados.
- **Backend/API/DB/auth/dependencias/lockfiles/CI/dashboard Clínica/otros
  módulos admin:** no tocados (`git diff --stat`: 1 componente + 1 spec
  e2e).

## 11. Riesgo residual

Bajo. El ajuste es de constante de paginación + reflujo de markup
(2 líneas por fila en vez de 3, lista `divide-y` en vez de grid fijo), sin
tocar lógica de datos. Verificado en 5 viewports estándar × 2 modos de
color con Playwright/Chromium headless; no verificado en hardware real.

---

### Cierre / Git manual (protocolo VETNEB)

Implementación, tests y validaciones completas. Según el protocolo, **Git
lo ejecuta Nico**. Este PR vive en un worktree separado
(`C:\PORTAL-VETNEB-alerts`). Comandos a ejecutar **desde
`C:\PORTAL-VETNEB-alerts`**:

```powershell
cd C:\PORTAL-VETNEB-alerts
git add frontend/src/app/dashboard/admin/AdminMobileCommandModule.tsx `
        frontend/e2e/admin-mobile-status-modules-no-scroll.spec.ts `
        docs/audit/admin-mobile-alerts-density-10-visible.md
git status --short --untracked-files=all
git commit -m "fix(admin): show 10 failed-login alerts per mobile page"
git push -u origin fix/admin-mobile-alerts-density
gh pr create --base main --head fix/admin-mobile-alerts-density --title "fix(admin): show 10 failed-login alerts per mobile page" --body "## Summary
- Raise the Admin mobile Alertas chip (failed-login attempts) from 3 to 10 visible records per page
- Compact each row to fit 10 without scroll (divide-y list, same pattern as Tokens/Clínicas/Auditoría), without touching fetch logic or the chip tabs

## Scope
- Admin Dashboard mobile Alertas chip only (4 of 7 in the mobile refinement block)

## Not touched
- Backend, API, DB, auth, dependencies, lockfiles, CI, public routes, production, Clínica dashboard, desktop failed-login table, admin-health chip, other admin modules

## Validation
- pnpm --dir frontend lint
- pnpm --dir frontend typecheck
- pnpm --dir frontend build
- playwright admin-mobile-status-modules-no-scroll.spec.ts (23/23, includes new dedicated 10-per-page test)
- playwright admin-mobile-final-polish-no-scroll.spec.ts + admin-mobile-module-layer-isolation.spec.ts + admin-mobile-hub-launcher-no-scroll.spec.ts (17/17 regression)"
gh pr checks --watch

# Tras mergear los PRs anteriores, eliminar este worktree:
cd C:\PORTAL-VETNEB
git worktree remove ../PORTAL-VETNEB-alerts
```
