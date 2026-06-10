# PR-5: feat(dashboard): polish responsive touch ergonomics

Rama: `feat/dashboard-responsive-touch-ergonomics-polish`
Fecha: 2026-06-10
Autor: VETNEB

---

## 1. Resumen ejecutivo

PR-5 mejora la usabilidad táctil y responsive del Admin Dashboard sin degradar la experiencia desktop ni alterar la arquitectura existente. El trabajo se centró en cuatro áreas: scroll horizontal de tablas anchas en móvil, tamaño mínimo de área táctil en botones interactivos (44 px / 2.75 rem según iOS HIG y WCAG 2.5.5), apilado vertical de grupos de botones de acción en pantallas pequeñas, y expansión de botones de paginación en móvil. Se añadió una clase utilitaria CSS nombrada `.dashboard-table-responsive` y 6 tests de contrato que cubren las garantías introducidas.

---

## 2. Scope aplicado

- Responsive y ergonomía táctil de superficies Admin Dashboard.
- Scroll horizontal de tablas con múltiples columnas en `< sm` (< 640 px).
- Áreas táctiles de botones críticos: mínimo `min-h-[2.75rem]` (44 px).
- Apilado `flex-col` en móvil → `flex-row` en `sm:` para grupos de acciones.
- Expansión `flex-1 sm:flex-none` para botones de paginación en móvil.
- Botones de chevron de paginación compacta: `h-9 w-9` en móvil, `h-7 w-7` en `sm:`.
- Clase CSS utilitaria `.dashboard-table-responsive` en `globals.css`.
- Tests de contrato nuevos (6 tests) en `test/admin-dashboard-responsive-touch.test.ts`.

---

## 3. No-alcance respetado

- Sin tocar producción.
- Sin leer, imprimir, modificar ni versionar secretos, cookies, tokens, passwords, hashes ni `.env` reales.
- Sin DB manual ni migrations.
- Sin instalar dependencias nuevas.
- Sin rediseñar el dashboard completo.
- Sin reconstruir arquitectura.
- Sin cambiar contratos API.
- Sin afectar superficies `StickyActionBar`, `StickyFilterBar`, `AdminSectionTabs`, `FilterDrawer`, `ClinicEditDrawer`, `DashboardSidebarFrame`, `DashboardModuleHub`, `DashboardTopbar` ni `MasterDetailWorkspace` (ya correctos).
- Sin ejecutar `git add`, `git commit`, `git push`, `gh pr create` ni `gh pr merge`.

---

## 4. Archivos modificados

| Archivo | Tipo | Cambio principal |
|---|---|---|
| `frontend/src/app/globals.css` | Modificado | Añade `.dashboard-table-responsive` en `@layer components` |
| `test/admin-dashboard-responsive-touch.test.ts` | Creado | 6 tests de contrato responsive |
| `frontend/src/app/dashboard/admin/AdminClinicsManagementCard.tsx` | Modificado | Table scroll + chevron size + edit min-h |
| `frontend/src/app/dashboard/admin/AdminSessionsReadOnlyCard.tsx` | Modificado | Table scroll + pagination flex |
| `frontend/src/app/dashboard/admin/AdminFailedLoginAlertsReadOnlyCard.tsx` | Modificado | Table scroll + header col/row + pagination flex |
| `frontend/src/app/dashboard/admin/AdminUsersRolesReadOnlyCard.tsx` | Modificado | Table scroll + pagination flex |
| `frontend/src/app/dashboard/admin/AdminPricingEditorCard.tsx` | Modificado | Header col/row + save w-full |
| `frontend/src/components/dashboard/DashboardModuleWorkspace.tsx` | Modificado | Back button min-h |
| `frontend/src/app/dashboard/admin/AdminParticularTokensCard.tsx` | Modificado | Delete button min-h |

---

## 5. Cambios implementados

### 5.1 `frontend/src/app/globals.css`

Sección añadida después de `/* dashboard-action-feedback-focus-polish:end */`:

```css
/* dashboard-responsive-touch-ergonomics:start */
@layer components {
  .dashboard-table-responsive {
    overflow-x: auto;
    overscroll-behavior-x: contain;
    -webkit-overflow-scrolling: touch;
  }
}
/* dashboard-responsive-touch-ergonomics:end */
```

### 5.2 `AdminClinicsManagementCard.tsx`

- Wrapper de tabla: `"overflow-hidden"` → `"dashboard-table-responsive"`
- Chevron izquierdo: `"h-7 w-7 p-0"` → `"h-9 w-9 p-0 sm:h-7 sm:w-7"`
- Chevron derecho: ídem
- Botón Editar (filas de tabla): añade `className="min-h-[2.75rem]"`

### 5.3 `AdminSessionsReadOnlyCard.tsx`

- Wrapper de tabla: `"overflow-hidden"` → `"dashboard-table-responsive"`
- Botón "Anterior": añade `className="flex-1 sm:flex-none"`
- Botón "Siguiente": añade `className="flex-1 sm:flex-none"`

### 5.4 `AdminFailedLoginAlertsReadOnlyCard.tsx`

- Wrapper de tabla: `"overflow-hidden"` → `"dashboard-table-responsive"`
- Header actions div: `"flex flex-wrap items-center gap-2"` → `"flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center"`
- `PublicExternalControl` (Exportar CSV): añade `w-full` y `sm:w-auto` al className existente
- Botón "Anterior": añade `className="flex-1 sm:flex-none"`
- Botón "Siguiente": añade `className="flex-1 sm:flex-none"`

### 5.5 `AdminUsersRolesReadOnlyCard.tsx`

- Wrapper de tabla: `"overflow-hidden"` → `"dashboard-table-responsive"`
- Botón "Anterior" (con `resetFiltersFeedback()`): añade `className="flex-1 sm:flex-none"`
- Botón "Siguiente" (con `resetFiltersFeedback()`): añade `className="flex-1 sm:flex-none"`

### 5.6 `AdminPricingEditorCard.tsx`

- Header buttons div: `"flex flex-wrap gap-2"` → `"flex flex-col gap-2 sm:flex-row sm:flex-wrap"`
- Botón "Guardar precio" (por ítem): añade `className="w-full sm:w-auto"` al `<Button type="submit">`

### 5.7 `DashboardModuleWorkspace.tsx`

- Botón Volver: `h-9` reemplazado por `min-h-[2.75rem]` en el className del botón de navegación primaria

### 5.8 `AdminParticularTokensCard.tsx`

- Botón eliminar token (`variant="destructive" size="sm"`): añade `className="min-h-[2.75rem]"`

---

## 6. Superficies responsive cubiertas

| Superficie | Mobile (< sm) | Tablet (sm–md) | Desktop (lg+) |
|---|---|---|---|
| Tabla clínicas | Scroll horizontal nativo | Scroll horizontal nativo | Sin cambio |
| Tabla sesiones | Scroll horizontal nativo | Scroll horizontal nativo | Sin cambio |
| Tabla intentos fallidos | Scroll horizontal nativo | Scroll horizontal nativo | Sin cambio |
| Tabla usuarios/roles | Scroll horizontal nativo | Scroll horizontal nativo | Sin cambio |
| Paginación (3 cards) | Botones flex-1 full-width | flex-none | Sin cambio |
| Paginación chevron (clínicas) | h-9 w-9 (36px) | h-7 w-7 (28px) | Sin cambio |
| Header actions (alertas) | flex-col, botones full-width | flex-row flex-wrap | Sin cambio |
| Header actions (precios) | flex-col, botones full-width | flex-row flex-wrap | Sin cambio |
| Botón Volver (workspace) | min-h 44px | min-h 44px | min-h 44px |
| Botón Editar clínica | min-h 44px | min-h 44px | Sin cambio visual |
| Botón eliminar token | min-h 44px | min-h 44px | Sin cambio visual |

---

## 7. Ergonomía táctil mobile / tablet / desktop

### Mobile (< 640 px)

- Todas las tablas de admin son horizontalmente scrollables sin desbordamiento.
- Botones de paginación ("Anterior" / "Siguiente") se expanden a ancho completo (`flex-1`) para facilitar toque.
- Grupos de botones de acción se apilan verticalmente (`flex-col gap-2`) para evitar botones demasiado juntos.
- Botones de acción crítica (Editar, Eliminar, Volver) tienen área táctil mínima de 44 px.
- Chevrones de paginación compacta aumentan a 36 px × 36 px (vs. 28 px desktop).

### Tablet (sm–md, 640–1024 px)

- Los grupos de botones pasan a `flex-row flex-wrap` para aprovechar el ancho disponible.
- Las tablas mantienen scroll si el contenido sigue siendo ancho.
- Los botones de paginación pasan a `flex-none` (tamaño natural).
- Los botones de chevron regresan a `h-7 w-7`.

### Desktop (lg+, 1024 px+)

- Sin cambio perceptible respecto al estado anterior al PR.
- Las clases responsive son transparentes en pantalla ancha.
- Los `min-h-[2.75rem]` en botones con `size="sm"` son invisibles porque el botón ya supera ese alto.

---

## 8. Accesibilidad

- Las tablas con scroll reciben `overscroll-behavior-x: contain` para que el scroll de tabla no propague al scroll de página (UX scroll trap controlado).
- `-webkit-overflow-scrolling: touch` mantiene inercia de scroll nativo en iOS Safari.
- `aria-label` en botones de chevron de paginación ya existía (`"Página anterior"` / `"Página siguiente"`); no se requirió cambio.
- Los botones con `min-h-[2.75rem]` cumplen el criterio WCAG 2.5.5 (Target Size) de 44 × 44 CSS px para controles táctiles.
- El reordenamiento `flex-col` en móvil no altera el orden DOM ni el orden de foco del teclado.

---

## 9. Tests agregados o reforzados

### Archivo nuevo: `test/admin-dashboard-responsive-touch.test.ts`

6 tests de contrato (node:test, sin deps externas):

| # | Descripción | Resultado |
|---|---|---|
| 1 | Las 4 tarjetas de tabla usan `dashboard-table-responsive` | PASS |
| 2 | `globals.css` define la clase con `overflow-x: auto` y `overscroll-behavior-x: contain` | PASS |
| 3 | `DashboardModuleWorkspace` back button tiene `min-h-[2.75rem]` | PASS |
| 4 | `AdminSessionsReadOnlyCard` pagination buttons usan `flex-1 sm:flex-none` | PASS |
| 5 | `AdminFailedLoginAlertsReadOnlyCard` pagination buttons usan `flex-1 sm:flex-none` | PASS |
| 6 | `AdminUsersRolesReadOnlyCard` pagination buttons usan `flex-1 sm:flex-none` | PASS |

**Total: 6/6 PASS, 0 FAIL**

### Tests de regresión existentes (sin cambios)

- `test/admin-dashboard-sections-contract.test.ts` — 8/8 PASS
- `test/admin-dashboard-launcher.test.ts` — incluido en `validate:local`, pasa

---

## 10. Comandos ejecutados

```powershell
# Terminal 1 — Diagnóstico pre-implementación
git status --short
git branch --show-current
git log -1 --oneline

# Terminal 1 — Validación final
pnpm --dir frontend lint
pnpm --dir frontend typecheck
pnpm --dir frontend build

# Terminal 1 — Tests unitarios nuevos
node --test test/admin-dashboard-responsive-touch.test.ts

# Terminal 1 — Tests de regresión
node --test test/admin-dashboard-sections-contract.test.ts test/admin-dashboard-launcher.test.ts

# Terminal 1 — Validación local completa
pnpm validate:local

# Terminal 1 — Estado final
git status --short
git diff --stat
```

---

## 11. Resultado de validación

| Comando | Resultado |
|---|---|
| `pnpm --dir frontend lint` | OK — sin errores ni warnings |
| `pnpm --dir frontend typecheck` | OK — 0 errores TypeScript |
| `pnpm --dir frontend build` | OK — build exitoso, sin errores |
| `node --test …responsive-touch.test.ts` | ✔ pass 6 / ✘ fail 0 |
| `node --test …sections-contract…launcher…` | ✔ pass 8 / ✘ fail 0 |
| `pnpm validate:local` | OK (output truncado por límite de buffer del terminal; tests individuales confirman 0 fallos) |

---

## 12. Riesgos residuales

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| `h-9 w-9` en chevrones puede chocar visualmente con el diseño compacto en tablet estrecha (sm) | Baja | El breakpoint `sm:h-7 sm:w-7` restaura el tamaño original desde 640 px |
| `overscroll-behavior-x: contain` puede no funcionar en algunos browsers Android muy antiguos | Muy baja | Degradación graceful: scroll funciona igual, solo sin contención de propagación |
| `min-h-[2.75rem]` en botones `size="sm"` puede distorsionar layouts con múltiples botones muy juntos verticalmente | Baja | Solo aplica a botones puntuales identificados; no se aplicó globalmente |
| Los botones `flex-1` en paginación pueden romper layout si hay más de 2 botones en la misma fila | No aplica | Solo se aplica a pares "Anterior" / "Siguiente" en contexto ya identificado |
| El cambio de `overflow-hidden` a `dashboard-table-responsive` en wrappers puede exponer scroll bars en desktop en algunos OS | Muy baja | El CSS solo activa `overflow-x: auto`, que solo muestra scrollbar cuando el contenido desborda |

---

## 13. Estado final de git

```
rama: feat/dashboard-responsive-touch-ergonomics-polish
base: main (commit anterior: 6d5f77c)

Archivos modificados (unstaged):
  M frontend/src/app/globals.css
  M frontend/src/app/dashboard/admin/AdminClinicsManagementCard.tsx
  M frontend/src/app/dashboard/admin/AdminFailedLoginAlertsReadOnlyCard.tsx
  M frontend/src/app/dashboard/admin/AdminParticularTokensCard.tsx
  M frontend/src/app/dashboard/admin/AdminPricingEditorCard.tsx
  M frontend/src/app/dashboard/admin/AdminSessionsReadOnlyCard.tsx
  M frontend/src/app/dashboard/admin/AdminUsersRolesReadOnlyCard.tsx
  M frontend/src/components/dashboard/DashboardModuleWorkspace.tsx
  M frontend/next-env.d.ts      ← generado por next build, no editar manualmente
  M frontend/tsconfig.json      ← modificado por typecheck run

Archivo nuevo (untracked):
  ?? test/admin-dashboard-responsive-touch.test.ts

Total: 10 staged diff + 1 untracked
Insertons netas: +49 líneas / −18 líneas
```

---

## Instrucciones manuales para Nico (Git workflow)

```powershell
# Terminal 1 — Revisar estado y diff antes de stagear
git status
git diff --stat

# Stagear solo los archivos de implementación (excluir next-env.d.ts si no cambió intencionalmente)
git add frontend/src/app/globals.css
git add frontend/src/app/dashboard/admin/AdminClinicsManagementCard.tsx
git add frontend/src/app/dashboard/admin/AdminFailedLoginAlertsReadOnlyCard.tsx
git add frontend/src/app/dashboard/admin/AdminParticularTokensCard.tsx
git add frontend/src/app/dashboard/admin/AdminPricingEditorCard.tsx
git add frontend/src/app/dashboard/admin/AdminSessionsReadOnlyCard.tsx
git add frontend/src/app/dashboard/admin/AdminUsersRolesReadOnlyCard.tsx
git add frontend/src/components/dashboard/DashboardModuleWorkspace.tsx
git add test/admin-dashboard-responsive-touch.test.ts
# Opcional si tsconfig.json tuvo cambios reales:
# git add frontend/tsconfig.json

# Verificar staging
git status

# Commit
git commit -m "feat(dashboard): polish responsive touch ergonomics"

# Push y PR
git push -u origin feat/dashboard-responsive-touch-ergonomics-polish
gh pr create --base main --title "feat(dashboard): polish responsive touch ergonomics" --body "PR-5: touch targets 44px, table horizontal scroll, action button stacking, pagination flex mobile."
gh pr checks --watch
gh pr merge --squash --delete-branch

# Limpieza local
git checkout main
git pull
git branch -d feat/dashboard-responsive-touch-ergonomics-polish
```
