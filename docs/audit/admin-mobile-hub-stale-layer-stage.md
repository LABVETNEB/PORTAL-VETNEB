# VETNEB — Fix P1: bleed-through / capa vieja detrás del Hub (Admin mobile)

Auditoría extrema + corrección quirúrgica del bug visual de **Inicio / Hub** del
dashboard administrador en mobile, donde al volver a Inicio quedaba visible por
detrás el módulo anterior (Clínicas / Auditoría / Login / Mantenimiento).

---

## 1. Resumen ejecutivo

El dashboard admin ya tenía un contrato de “pintado opaco” extenso y **verde**
(PRs #1071–#1073): topbar, bottom-nav, frame del app-shell, `main` y hub-root
pintan fondo opaco `--card`, sin `backdrop-filter` ni `transform`. Aun así el
usuario seguía viendo restos del módulo anterior en mobile.

**Causa raíz real (por eliminación, con evidencia de código y tests):** el Hub y
el módulo activo se montan como **dos subárboles aislados de tipo distinto que se
reemplazan entre sí directamente bajo `<main>`**. Cada uno crea su propio
`isolation: isolate` (stacking context). En cada navegación el contexto de
apilamiento del punto de intercambio se **destruye y se recrea con otras
dimensiones**. En GPUs móviles eso permite que un *tile* reciclado del módulo
recién desmontado sobreviva **por detrás** del nuevo contexto del Hub; un ancestro
opaco que queda **debajo** en el orden Z no puede taparlo. Por eso “hacer todo
opaco” no bastó: faltaba una **superficie estable** en el punto de swap.

**Corrección:** se introduce **una única “stage” persistente, opaca y aislada**
(`[data-dashboard-module-stage]`) que envuelve ambas ramas. El nodo **no se
desmonta nunca** (sólo cambian sus hijos), y en Admin mobile se promueve a **una
sola capa de composición estable** (`transform: translateZ(0)`). Como esa capa es
persistente, el compositor **la repinta en su sitio** en cada swap en vez de
reciclar un tile huérfano de una capa por-módulo destruida. Resultado: Hub =
superficie opaca, aislada y estable. Desktop y Clínica quedan intactos.

TDD real: **RED** reproducible (no existía la stage) → implementación → **GREEN**
(stage persiste con identidad de nodo a través de Hub→módulo→Inicio).

---

## 2. Rama usada

`fix/admin-mobile-hub-stale-layer-stage` (creada desde `main` actualizado).

## 3. HEAD inicial

`d796ae0d2829c372a07691fae3100d3054bd18a9`
(`d796ae0 fix(admin): add mobile no-scroll config modules (#1073)`)

---

## 4. Root cause exacto

| Hecho verificado | Evidencia |
|---|---|
| El controller renderiza Hub **o** workspace de forma mutuamente excluyente (no hay DOM viejo persistente en React). | `AdminDashboardWorkspaceController.tsx`; e2e existente: `[data-dashboard-module-workspace]` count = 0 en el Hub. |
| Todo ancestro persistente ya pinta opaco `--card`, sin blur ni transform. | `admin-mobile-real-device-layer-isolation` en `globals.css`; `admin-mobile-module-layer-isolation.spec.ts` (verde). |
| Hay **4–5 `isolation: isolate` anidados** en la ruta del swap (app-shell, surface, `dashboard-main`, hub-root/workspace, leaf launcher/status/ops). | `globals.css` líneas ~1993, 2293, 2333, 2677, etc. |
| El punto de swap (hijo directo de `<main>`) **no tenía** una superficie estable: se recrea un stacking context por navegación. | Render de `AdminDashboardWorkspaceController` (rama hub-root vs rama workspace). |

**Conclusión:** el síntoma residual es **reciclaje de tiles del compositor móvil**
en el punto de swap por recreación del stacking context, no una transparencia
estática (ya descartada y testeada) ni DOM React persistente (ya descartado y
testeado).

---

## 5. Archivos inspeccionados (auditoría)

- `frontend/src/app/dashboard/admin/AdminDashboardWorkspaceController.tsx`
- `frontend/src/app/dashboard/admin/page.tsx`
- `frontend/src/lib/admin-hub-reset.ts`
- `frontend/src/components/dashboard/DashboardShellRouter.tsx`
- `frontend/src/components/dashboard/DashboardModuleHub.tsx`
- `frontend/src/components/dashboard/DashboardModuleWorkspace.tsx`
- `frontend/src/components/dashboard/DashboardPageHeader.tsx`
- `frontend/src/components/dashboard/AdminMobileBottomNav.tsx`
- `frontend/src/components/dashboard/AdminMobileHubLauncher.tsx`,
  `AdminMobileHubPager.tsx`, `AdminMobileModuleMenu.tsx`
- `frontend/src/app/dashboard/admin/AdminMobileStatusModule.tsx`
- `frontend/src/app/globals.css` (bloques shell / app-shell / admin-mobile-*)
- e2e: `admin-mobile-module-layer-isolation.spec.ts` y familia `admin-mobile-*`
- Tests de contrato: `test/frontend-dashboard-admin.test.ts`,
  `test/frontend-admin-unauthorized-ui-consistency.test.ts`

---

## 6. Archivos modificados

| Archivo | Cambio |
|---|---|
| `frontend/src/app/dashboard/admin/AdminDashboardWorkspaceController.tsx` | Envuelve las 3 ramas (módulo / access-error / hub) en **una stage persistente** `div[data-dashboard-module-stage]`. Lógica de estado/efectos **sin cambios**. |
| `frontend/src/app/globals.css` | (a) Regla de ritmo adaptativo para los hijos de la stage (espejo de `dashboard-main`, token `--dash-rhythm`). (b) Nuevo bloque `admin-mobile-stage-layer`: en Admin mobile la stage es opaca `--card`, `isolation: isolate`, `transform: translateZ(0)`. |
| `frontend/src/app/dashboard/admin/__nuevo__` | — |
| `frontend/e2e/admin-mobile-hub-stale-layer-stage.spec.ts` | **Nuevo** spec TDD: identidad de nodo de la stage persistente a través de Hub→módulo→Inicio, opacidad, aislamiento, promoción de capa y no-scroll, en 360/390/430 y light/dark. |
| `test/frontend-admin-unauthorized-ui-consistency.test.ts` | Alineación in-PR de un contrato de estructura `.tsx` (indentación del bloque access-error que ahora anida un nivel más). Significado preservado. |

---

## 7. Qué legacy se eliminó o preservó y por qué

- **Preservado** todo el contrato opaco previo (`admin-mobile-real-device-layer-isolation`,
  `admin-mobile-module-layer-isolation`): sigue siendo correcto y necesario; la
  stage lo **complementa**, no lo reemplaza. Eliminarlo habría reabierto el caso
  de ancestros transparentes.
- **No se eliminó** ninguna `isolation` anidada existente: quitarlas globalmente
  arriesga regresiones desktop/Clínica y otros contratos. La stage añade el punto
  estable que faltaba sin tocar los demás.
- **No se introdujo** scroll, ni dependencias, ni rediseño. Cambio quirúrgico.

---

## 8. Decisiones técnicas

1. **Una stage persistente** en vez de más fondos opacos: ataca la *recreación del
   stacking context*, que es la causa real; los fondos opacos ya estaban.
2. **`translateZ(0)` sólo en Admin mobile**: una capa de composición persistente se
   repinta en sitio; no hay capa por-módulo que reciclar. Respeta la filosofía del
   repo (sin promociones en desktop/Clínica). No hay descendientes `position: fixed`
   dentro de la stage (bottom-nav, app-bar, menús y diálogos Radix se montan fuera),
   por lo que el nuevo containing-block es inerte.
3. **Ritmo adaptativo** replicado con `--dash-rhythm` para que el gap header↔hub no
   se rompa en ningún viewport/zoom (mismo comportamiento que tenía `main`).
4. **Sin tocar backend** ni `page.tsx` ni la lógica de URL/estado del controller.

---

## 9. Preparación para 5000 clínicas / 1000 informes por clínica

El cambio es estructural del shell, no del data layer, y **no degrada** la
escalabilidad ya presente; la consolida:

- La **stage es estable** durante el swap → repaints más baratos al navegar entre
  módulos de alta densidad (menos rasterización redundante por navegación).
- Se conserva la paginación/lazy ya existente: `usePagedRows`/`CompactPager`,
  paginación server-side de auditoría (`limit/offset`), montaje perezoso por
  sección (`AdminMobileStatusModule` sólo monta la sección activa), variantes
  mobile/desktop desacopladas (`md:hidden` / `hidden md:flex`).
- El contrato no-scroll por viewport sigue intacto (la stage es `overflow: hidden`,
  nunca un contenedor scrollable), lista para virtualización futura sin reescritura.

No se añadió backend porque la causa raíz es de composición/UI; tocarlo habría
sido fuera de scope.

---

## 10. Validaciones ejecutadas

| Comando | Resultado |
|---|---|
| `pnpm --dir frontend exec playwright test admin-mobile-hub-stale-layer-stage.spec.ts` | **RED** antes del fix (stage ausente) → **GREEN** 4/4 después |
| `pnpm --dir frontend exec playwright test admin-mobile … shell contracts` | **112 passed** (sin regresión) |
| `git diff --check` | limpio |
| `pnpm --dir frontend typecheck` | OK |
| `pnpm --dir frontend lint` | OK |
| `pnpm typecheck` (root) | OK |
| `pnpm test` (root) | **2815 pass / 0 fail** |
| `pnpm --dir frontend build` | OK |
| `pnpm build` (root) | OK |
| `pnpm security:public-surface` | **PASS** (sólo markers server-only en `proxy.ts`) |

> Nota operativa aplicada: tras cada corrida e2e se revierte `frontend/next-env.d.ts`
> (el dev server lo regenera) y se limpia `frontend/.next` antes de re-correr
> Playwright tras editar `globals.css` (cache stale de Turbopack).

---

## 11. Resultado de tests (TDD)

- **RED** (pre-fix): los 4 casos fallan con `module stage missing while stamping`
  → confirma que el punto de swap no tenía superficie estable.
- **GREEN** (post-fix): 4/4 — la stage existe, es opaca (alpha 1), `isolation:
  isolate`, promovida (`transform != none`) y **conserva identidad de nodo** a
  través de Hub→Clínicas→Inicio, con el workspace/launcher anidados dentro y sin
  scroll.

---

## 12. `git status --short --untracked-files=all`

```
 M frontend/src/app/dashboard/admin/AdminDashboardWorkspaceController.tsx
 M frontend/src/app/globals.css
 M test/frontend-admin-unauthorized-ui-consistency.test.ts
?? frontend/e2e/admin-mobile-hub-stale-layer-stage.spec.ts
```

## 13. `git diff --stat`

```
 .../admin/AdminDashboardWorkspaceController.tsx    | 76 ++++++++++++----------
 frontend/src/app/globals.css                       | 37 +++++++++++
 ...ntend-admin-unauthorized-ui-consistency.test.ts |  2 +-
 3 files changed, 79 insertions(+), 36 deletions(-)
```

## 14. `git diff --name-only`

```
frontend/src/app/dashboard/admin/AdminDashboardWorkspaceController.tsx
frontend/src/app/globals.css
test/frontend-admin-unauthorized-ui-consistency.test.ts
```

## 15. `git diff --check`

Sin hallazgos (salida vacía).

---

## 16. Capturas before/after

Carpeta de salida (Playwright; se regenera por corrida):
`frontend/test-results/admin-mobile-hub-stale-layer-stage/`

- `360-light-hub-after-clinics.png`
- `360-dark-hub-after-clinics.png`
- `390-light-hub-after-clinics.png`
- `430-light-hub-after-clinics.png`

**After (post-fix):** Hub limpio, opaco, sin restos de Clínicas tras
Hub→Clínicas→Inicio en 360/390/430 y light/dark.

**Honestidad técnica sobre el “before” visual:** el artefacto es **reciclaje de
tiles de GPU específico de dispositivos móviles reales**; **Chromium headless no lo
reproduce** (ya documentado en el spec PR-A). Por eso el before/after *visual* en
headless sería idéntico (Hub limpio) y **no** probaría el fix. La evidencia
determinista del cambio es el **RED→GREEN estructural** (la stage pasa de ausente a
presente y persistente con identidad de nodo). Recomendado: verificación final en
dispositivo real (ver riesgos residuales).

---

## 17. Riesgos residuales

1. **Verificación en hardware real pendiente:** el fix ataca el mecanismo correcto
   (capa de composición persistente), pero como headless no reproduce el reciclaje
   de tiles, conviene una confirmación visual en un Android/iOS real con
   Hub→módulo→Inicio repetido en light/dark. Bajo riesgo de regresión; alta
   probabilidad de cierre del síntoma.
2. **`translateZ(0)` crea containing-block** para `position: fixed` descendiente.
   Verificado que **no hay** ninguno dentro de la stage (menús/diálogos se portan a
   `body` o viven en el bottom-nav/app-bar, fuera de la stage). Si en el futuro se
   añade un `fixed` dentro de un módulo, recordar este contexto.

---

## 18. Confirmación de no-regresión

- **Desktop:** la stage es un passthrough flex transparente fuera de mobile (sin
  fondo ni `translateZ`); el ritmo header↔hub se preserva vía `--dash-rhythm`.
  Typecheck/lint/build/tests de contrato verdes. **Sin regresión desktop.**
- **Clínica:** el cambio está acotado a `AdminDashboardWorkspaceController` y a
  selectores `surface="admin"`; el controller de Clínica
  (`ClinicDashboardWorkspaceController`) **no se toca**. Suite e2e mobile
  (incl. parity Clínica) y `pnpm test` verdes. **Sin regresión Clínica.**

---

### Cierre / Git manual (protocolo VETNEB)

Implementación y validación completas. Según el protocolo, **Git lo ejecuta Nico**:

```powershell
git add frontend/src/app/dashboard/admin/AdminDashboardWorkspaceController.tsx `
        frontend/src/app/globals.css `
        frontend/e2e/admin-mobile-hub-stale-layer-stage.spec.ts `
        test/frontend-admin-unauthorized-ui-consistency.test.ts
git status
git commit -m "fix(admin): persistent isolated stage to kill mobile hub bleed-through"
git push -u origin fix/admin-mobile-hub-stale-layer-stage
gh pr create --fill
gh pr checks --watch
```
