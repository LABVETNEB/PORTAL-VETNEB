# VETNEB — Fix: densidad mobile de Informes — 10/página, paginador ya anclado

Módulo 5 de 7 del bloque "Admin Mobile Refinement". Cada módulo se entrega
como rama/PR independiente (precedente #1077→#1081; módulos 1-Hub,
2-Clínicas, 3-Auditoría y 4-Alertas ya entregados en sus propios
worktrees/ramas).

---

## 1. Rama y base

- Rama: `fix/admin-mobile-reports-density` (worktree aislado desde `main`
  limpio).
- HEAD base: `aa6bea6 fix(admin): align mobile core pager to canonical
  tokens layout (#1081)`.

## 2. Alcance

Mobile de `AdminReportsCard` (Informes, Dashboard Administrador):

1. Mostrar 10 informes por página en mobile (antes: 3).
2. Asegurar el paginador en el borde inferior interno del módulo, patrón
   `Anterior` / `Pág. X` / `Siguiente` (sin total porque la API no lo
   expone).
3. Mantener no-scroll y las acciones existentes (`Subir informe`,
   `Actualizar`, `Ver`).

## 3. No alcance

Backend, API, DB, auth, dependencias, lockfiles, CI, rutas públicas,
producción, dashboard Clínica, desktop (`PAGE_SIZE=9`, tabla y paginación
desktop intactas), Hub, Clínicas, Auditoría, Alertas, Tokens, Sesiones (cada
uno su propio PR).

## 4. Diagnóstico previo

- `AdminReportsCard.tsx` ya seguía el patrón canónico de los módulos
  recientes: lista mobile independiente (`mobileReports`/`mobilePage`,
  fetch propio vía `getAdminReportWorkflow` con `limit/offset` propios,
  decoplado del `PAGE_SIZE=9` desktop) en una lista compacta `divide-y`
  (`data-admin-reports-mobile-list`), con el paginador
  (`data-admin-mobile-core-pager`) ya en un `<div>` separado, debajo de la
  lista, dentro del mismo contenedor flex (`flex-col`) — es decir, **el
  paginador ya estaba anclado al borde inferior interno del módulo**; no
  hizo falta reubicarlo, sólo confirmar/preservar esa posición.
- `MOBILE_PAGE_SIZE = 3` (línea 40) era la única pieza que faltaba para
  cumplir "10 por página".
- El paginador ya usa el patrón exacto pedido: "Anterior" / `Pág. {N}` /
  "Siguiente", sin total (la API `getAdminReportWorkflow` expone
  `pagination.hasMore`, no un total) — no se inventó ningún total.
- e2e: `admin-mobile-core-modules-no-scroll.spec.ts` (contrato compartido
  clinics/reports/tokens, `maxItemsPerPage` por módulo) y
  `admin-mobile-final-polish-no-scroll.spec.ts` (contrato genérico de
  banda de contenido, sin conteos hardcodeados para reports).

## 5. Archivos modificados

| Archivo | Cambio |
|---|---|
| `frontend/src/app/dashboard/admin/AdminReportsCard.tsx` | `MOBILE_PAGE_SIZE` 3→10. Fila de la lista mobile: `min-h-10 py-1.5` → `min-h-9 py-0.5` (mismo ajuste de densidad que el resto del bloque) para que 10 filas entren sin scroll. Ningún cambio en `PAGE_SIZE` (desktop), en el fetch (`getAdminReportWorkflow`, `loadReports`, `loadMobileReports`), ni en la posición/estructura del paginador (ya estaba anclado abajo). |
| `frontend/e2e/admin-mobile-core-modules-no-scroll.spec.ts` | `MOCK_REPORTS` 9→13 (para que 10/página tenga una página 2 real). `maxItemsPerPage` de `reports` 5→10 (remanente de un ajuste previo a #1077-1081; `clinics`/`tokens` sin cambios en este PR). Nuevo test dedicado: 10 informes en página 1 (`#7400`…`#7409`), página 2 con los 3 restantes (`#7410`…`#7412`), paginador (`Pág. 1`→`Pág. 2`) medido como anclado al borde inferior interno (su borde inferior coincide con el techo del bottom nav, sin hueco). |

No se crearon archivos de test nuevos: se reforzó el contrato compartido ya
existente.

## 6. Decisiones técnicas

1. **No se tocó la posición del paginador**: ya cumplía el requisito
   (`Anterior`/`Pág. X`/`Siguiente`, anclado abajo dentro del mismo
   contenedor flex de la lista). Cualquier reestructuración hubiera sido
   diff innecesario sobre algo que ya funcionaba.
2. **Compactación de fila igual al resto del bloque** (`min-h-9 py-0.5`,
   mismo valor usado en Tokens/Clínicas/Auditoría/Alertas) para mantener
   consistencia visual entre módulos del mismo bloque, en vez de elegir un
   valor distinto.
3. **Sin total inventado**: se mantiene el mismo patrón que ya tenía
   (`Pág. {N}` sin `/ M`), porque la API no expone `total`, sólo
   `hasMore`. No se agregó un cálculo de páginas totales ficticio.

## 7. Validaciones ejecutadas

| Comando | Resultado |
|---|---|
| `pnpm --dir frontend lint` | OK (sin salida) |
| `pnpm --dir frontend typecheck` | OK |
| `pnpm --dir frontend build` | OK (`next build` exitoso, 25 rutas) |
| `npx playwright test e2e/admin-mobile-core-modules-no-scroll.spec.ts` | **GREEN 31/31** (incluye el nuevo test dedicado a 10/página + paginador anclado) |
| `npx playwright test e2e/admin-mobile-final-polish-no-scroll.spec.ts e2e/admin-mobile-module-layer-isolation.spec.ts e2e/admin-mobile-hub-launcher-no-scroll.spec.ts` | **GREEN** (incluidos en el mismo run de 31/31 arriba) |

`pnpm test` (root, suite backend) no se ejecutó: este PR no toca backend ni
archivos bajo `test/`.

> Nota operativa: `frontend/next-env.d.ts` no quedó modificado tras correr
> Playwright/build en este worktree; se verificó explícitamente.

## 8. Resultado de tests (TDD)

- **RED inicial (esperado por diseño):** `maxItemsPerPage: 5` y
  `MOCK_REPORTS` de 9 no alcanzaban para validar 10/página; se actualizaron
  en el mismo PR.
- **RED de aserción (ajuste de test, no de código):** el primer intento del
  test de paginación usaba `getByText("Paciente 1")`, que matcheaba tanto
  "Paciente 1" como "Paciente 10"/"Paciente 11" por contención de texto
  (Playwright `getByText` sin `exact` hace match por substring). Fix:
  aserciones por el id único del informe (`#7400`, `#7409`, etc.) en vez
  del nombre de paciente.
- **GREEN:** 10 informes exactos en página 1, 3 en página 2, paginador
  `Pág. 1`→`Pág. 2`, paginador con su borde inferior alineado al techo del
  bottom nav (sin hueco, sin pegarse), sin overflow.

## 9. `git status --short --untracked-files=all`

```
 M frontend/e2e/admin-mobile-core-modules-no-scroll.spec.ts
 M frontend/src/app/dashboard/admin/AdminReportsCard.tsx
?? docs/audit/admin-mobile-reports-density-10-anchored-pager.md
```

## 10. Confirmación explícita

- **10 informes por página en mobile:** confirmado (`MOBILE_PAGE_SIZE =
  10`; e2e con dataset de 13 muestra página 1 con 10 y página 2 con 3).
- **Paginador anclado al borde inferior interno:** confirmado (ya lo
  estaba; verificado con medición de bounding box contra el bottom nav).
- **Patrón canónico `Anterior`/`Pág. X`/`Siguiente` sin total inventado:**
  confirmado (sin cambios respecto al patrón ya existente).
- **No-scroll:** confirmado (contrato compartido de no-scroll sigue
  verde).
- **Acciones existentes preservadas** (`Subir informe`, `Actualizar`,
  `Ver`): confirmado, ningún handler ni botón fue tocado.
- **Appbar / bottom nav preservados:** confirmado (specs de chrome mobile
  compartidos siguen verdes).
- **#1074 / #1076 preservados:** no tocados.
- **Backend/API/DB/auth/dependencias/lockfiles/CI/dashboard Clínica/otros
  módulos admin:** no tocados (`git diff --stat`: 1 componente + 1 spec
  e2e).

## 11. Riesgo residual

Bajo. Único cambio funcional real es la constante de página; el resto es
ajuste de padding/altura de fila ya validado en los módulos previos de
este mismo bloque. El botón `Ver` mobile sigue en `h-7` (28px), por debajo
del touch target de 36px solicitado para el bloque — **preexistente, no
introducido por este PR** (no se tocó ese botón); se documenta para
seguimiento, no se corrige aquí para no ampliar el alcance de este PR
puntual.

---

### Cierre / Git manual (protocolo VETNEB)

Implementación, tests y validaciones completas. Según el protocolo, **Git
lo ejecuta Nico**. Este PR vive en un worktree separado
(`C:\PORTAL-VETNEB-reports`). Comandos a ejecutar **desde
`C:\PORTAL-VETNEB-reports`**:

```powershell
cd C:\PORTAL-VETNEB-reports
git add frontend/src/app/dashboard/admin/AdminReportsCard.tsx `
        frontend/e2e/admin-mobile-core-modules-no-scroll.spec.ts `
        docs/audit/admin-mobile-reports-density-10-anchored-pager.md
git status --short --untracked-files=all
git commit -m "fix(admin): show 10 reports per mobile page"
git push -u origin fix/admin-mobile-reports-density
gh pr create --base main --head fix/admin-mobile-reports-density --title "fix(admin): show 10 reports per mobile page" --body "## Summary
- Raise Admin mobile Informes from 3 to 10 visible reports per page
- Compact row density to match the rest of the mobile refinement block (min-h-9, py-0.5)
- Pager was already anchored at the bottom in its own pattern (Anterior/Pág. X/Siguiente, no invented total) — confirmed and preserved, not restructured

## Scope
- Admin Dashboard mobile Informes module only (5 of 7 in the mobile refinement block)

## Not touched
- Backend, API, DB, auth, dependencies, lockfiles, CI, public routes, production, Clínica dashboard, desktop reports table/pagination, other admin modules

## Known pre-existing item (not introduced by this PR)
- The mobile 'Ver' button stays at 28px height (h-7), below the 36px touch target target for this block. Not touched here to keep this PR's diff scoped to pagination/density.

## Validation
- pnpm --dir frontend lint
- pnpm --dir frontend typecheck
- pnpm --dir frontend build
- playwright admin-mobile-core-modules-no-scroll.spec.ts + admin-mobile-final-polish-no-scroll.spec.ts + admin-mobile-module-layer-isolation.spec.ts + admin-mobile-hub-launcher-no-scroll.spec.ts (31/31)"
gh pr checks --watch

# Tras mergear los PRs anteriores, eliminar este worktree:
cd C:\PORTAL-VETNEB
git worktree remove ../PORTAL-VETNEB-reports
```


## Nota de rebase y contrato root

- Durante el rebase contra main, el e2e core tenía conflicto entre la densidad ya mergeada de Clínicas y la nueva densidad de Informes.
- La resolución mantiene Clínicas en 10 por página, Informes en 10 por página y Tokens en 10 por página.
- El contrato root de Informes fue actualizado para reflejar el cambio intencional de `MOBILE_PAGE_SIZE = 3` a `MOBILE_PAGE_SIZE = 10`, preservando `PAGE_SIZE = 9` y la llamada `getAdminReportWorkflow({`.
