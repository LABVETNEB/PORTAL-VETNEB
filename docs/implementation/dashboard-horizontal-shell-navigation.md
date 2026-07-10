# PR-2 — Shell global con navegación horizontal

> Portal VETNEB · Dashboard Administración + Clínica
> Rama: `feat/dashboard-horizontal-shell-navigation`
> Base: `67059ca docs(dashboard): audit horizontal navigation information architecture (#1039)`
> Alcance: shell/navegación estructural. **No** rediseña el contenido interno de los módulos.

---

## 1. Resumen ejecutivo

Se elimina el **sidebar vertical** como navegación principal de ambos dashboards
y se reemplaza por una **navegación horizontal superior** integrada en la barra
institucional (`DashboardTopbar`). El área de contenido pasa a usar el ancho
completo del viewport (sin columna lateral reservada). Se preserva íntegramente
el contrato de navegación existente (`?module=`, rutas, estado activo,
accesibilidad y el contrato no-scroll del App Shell).

El rediseño profundo de cada módulo (tablas densas, paginación 25/50/100,
detalle estable, server-side) **no** forma parte de este PR — queda para PR-3+.

---

## 2. Objetivo del PR-2

- Quitar el sidebar vertical como navegación principal.
- Introducir navegación horizontal compacta, sobria e institucional.
- Liberar ancho operativo (sin `aside` que reserve columna).
- Preservar `?module=`, rutas, selección activa, teclado y a11y.
- No tocar login, web pública, backend, DB, dependencias ni Dependabot.

---

## 3. Archivos modificados

| Archivo | Tipo | Cambio |
|---------|------|--------|
| `frontend/src/components/dashboard/DashboardHorizontalNav.tsx` | **nuevo** | Nav horizontal compartida (admin/clínica), auto-resuelve superficie y estado activo |
| `frontend/src/components/dashboard/DashboardTopbar.tsx` | editado | Topbar a dos bandas: título/sesión + nav horizontal; se elimina el eyebrow decorativo |
| `frontend/src/components/dashboard/DashboardShellRouter.tsx` | editado | Deja de renderizar el sidebar; shell pasa a columna vertical de ancho completo |
| `test/frontend-dashboard-horizontal-nav.test.ts` | **nuevo** | Contrato de la nav horizontal (módulos, `?module=`, superficie, a11y, no-rail) |
| `test/frontend-dashboard-shell.test.ts` | editado | Reescrito el test del shell router (columna sin sidebar) |
| `test/unit/ui/frontend/frontend-visual-consistency.test.ts` | editado | Actualizadas las clases exactas del topbar (dos bandas) |
| `frontend/e2e/dashboard-card-navigation-shell.spec.ts` | editado | Bloque "sidebar compact rail" → navegación horizontal + `?module=` admin |

**Componentes legacy conservados (no renderizados, pendientes de PR-11):**
`DashboardSidebar.tsx`, `AdminDashboardSidebar.tsx`, `ClinicDashboardSidebar.tsx`,
`DashboardSidebarFrame.tsx`. Se mantienen en disco para no romper ~12 tests de
contrato que leen su `.tsx`; ya **no** se importan en runtime, no consumen ancho
ni actúan como navegación principal (permitido explícitamente por el alcance).

---

## 4. Componentes nuevos/modificados

### `DashboardHorizontalNav` (nuevo)

- Cliente. Renderiza un `nav role="navigation" aria-label="Navegación principal"`.
- **Auto-resuelve la superficie** desde la ruta: `pathname.startsWith("/dashboard/admin")`
  → admin; en caso contrario → clínica. No requiere props ni tocar las 8 páginas.
- Estado activo derivado de `usePathname()` + `useSearchParams()` (envuelto en
  `Suspense`, igual que el patrón previo del sidebar).
- Navegación vía `PublicRouteControl` (button + router) — sin `next/link` ni
  `<a>`, respetando el endurecimiento de navegación del proyecto.
- Densidad: banda ~36px, texto 13px, items `rounded-md`, indicador activo sutil
  (subrayado teal 2px + fondo navy muy leve), `overflow-x-auto` para scroll en
  viewports angostos.
- Incluye marca sobria "Portal VETNEB · {superficie}" (sin microscopio) y
  "Volver al sitio público".

### `DashboardTopbar` (modificado)

- Pasa de una sola fila a **dos bandas** dentro del mismo `<header sticky top-0>`:
  1. Título + subtítulo + controles (tema, notificaciones, cerrar sesión).
  2. `<DashboardHorizontalNav />`.
- Se elimina el eyebrow decorativo ("Portal operativo" / "Sesión clínica segura").
- Altura total ≈ la del topbar anterior (~72–80px): el presupuesto no-scroll se
  mantiene.

### `DashboardShellRouter` (modificado)

- Mantiene `useSelectedLayoutSegment` solo para `data-vetneb-app-shell-surface`.
- Shell pasa de fila con `aside` a **columna** (`flex flex-col h-dvh overflow-hidden`).
- Ya no importa ni renderiza los sidebars.

---

## 5. Cómo se preserva `?module=`

La nav horizontal usa **exactamente los mismos hrefs** que el sidebar previo:

**Administración** (7 módulos):

| Nav | href |
|-----|------|
| Resumen | `/dashboard/admin?module=admin` |
| Clínicas | `/dashboard/admin?module=admin-clinics` |
| Informes | `/dashboard/admin?module=admin-report-upload` |
| Tokens | `/dashboard/admin?module=admin-particular-tokens` |
| Auditoría | `/dashboard/admin?module=audit-log` |
| Usuarios | `/dashboard/admin?module=admin-users-roles` |
| Sesiones | `/dashboard/admin?module=admin-sessions` |

**Clínica** (5 módulos):

| Nav | href |
|-----|------|
| Resumen | `/dashboard?module=operaciones` |
| Informes | `/dashboard/informes` (ruta existente) |
| Tokens | `/dashboard?module=tokens` |
| Logística | `/dashboard/logistica` (ruta existente) |
| Perfil | `/dashboard?module=perfil` |

El `AdminDashboardWorkspaceController` / `ClinicDashboardWorkspaceController`
siguen leyendo `searchParams.get("module")` sin cambios: clic en la nav →
`router.push(...?module=...)` → el controller activa el workspace. El estado
activo (`aria-current="page"`) se marca al coincidir ruta + módulo.

**Nota de mapeo:** "Informes" admin apunta hoy a `admin-report-upload` (única
superficie de informes admin existente). PR-5 lo reemplazará por el módulo
transversal de informes definido en la auditoría. Los módulos secundarios
(Precios, Estado, Mantenimiento, Subir informe) **no** desaparecen: siguen
accesibles por el hub de nivel 0 y por URL directa `?module=` — no se pierde
acceso a ningún módulo existente.

---

## 6. Cómo se elimina el sidebar

- `DashboardShellRouter` ya no monta `AdminDashboardSidebar`/`ClinicDashboardSidebar`.
- El shell ya no reserva columna lateral (`w-[4.5rem]`/`2xl:w-60` no se renderiza).
- Los archivos del sidebar quedan en disco como legacy sin import en runtime.
- `data-vetneb-app-shell-surface` y el contrato `h-dvh overflow-hidden` se conservan.

---

## 7. Responsive

| Viewport | Topbar | Nav horizontal | Contenido |
|----------|--------|----------------|-----------|
| **Desktop (1920/1366)** | visible | completa, sin scroll | ancho completo, sin sidebar |
| **Laptop (1280)** | visible | compacta; `overflow-x-auto` si no entra | sin desbordes |
| **Tablet** | visible | scrollable superior, altura controlada | sin sidebar permanente |
| **Mobile** | compacta | scrollable; marca oculta (`md:`), "Volver" → "Salir" | contenido usable |

En todos los casos: sin sidebar fijo, sin overflow horizontal global (la nav
acota el scroll a su propia fila vía `overflow-x-auto` + `min-w-0`), sin pérdida
de acciones.

---

## 8. Accesibilidad

- `nav` con `role="navigation"` + `aria-label="Navegación principal"`.
- Items como `button` (PublicRouteControl): foco por Tab, `focus-visible` ring.
- Estado activo con `aria-current="page"` + indicador no dependiente solo de color
  (subrayado 2px + cambio de peso/fondo).
- `aria-label` por item; "Volver al sitio público" con nombre accesible estable.
- Targets táctiles ≥ ~30–36px de alto.

---

## 9. Validaciones ejecutadas (Terminal 1)

| Comando | Resultado |
|---------|-----------|
| `pnpm --dir frontend lint` | ✅ sin errores |
| `pnpm --dir frontend typecheck` | ✅ sin errores |
| `pnpm --dir frontend build` | ✅ build completo (rutas dashboard ƒ dynamic) |
| `pnpm test` (node:test, 2768 tests) | ✅ 2768 pass / 0 fail |

**E2E:** los specs afectados (`dashboard-card-navigation-shell.spec.ts`,
`dashboard-viewport-zoom-adaptability.spec.ts`) se actualizaron, pero **no** se
ejecutaron localmente: el `webServer` de Playwright usa `pnpm dev`, que regenera
`next-env.d.ts` (contamina el working tree) y es costoso. Se validan en CI con
`pnpm --dir frontend e2e`.

---

## 10. Riesgos residuales

1. **Presupuesto no-scroll**: la nav agrega ~4–8px de chrome vertical. El
   contrato page-level no-scroll se preserva (shell `h-dvh overflow-hidden`, main
   `flex-1 overflow-hidden`); a zoom extremo algún módulo denso podría recortar
   contenido (no genera scroll de página). A mitigar en PR-10 (densidad/fixtures).
2. **Mapeo "Informes" admin → `admin-report-upload`**: la nav dice "Informes" y el
   workspace muestra "Subir informe". Se resuelve en PR-5.
3. **Tests legacy de sidebar**: siguen verificando archivos no renderizados; se
   retiran en PR-11 junto con los componentes.
4. **E2E no ejecutado localmente**: pendiente de validación en CI.

---

## 11. Qué queda para PR-3+

- PR-3+: rediseño interno de cada módulo (KPI strip nivel 0 en lugar del hub de
  cards, tablas densas, paginación 25/50/100, detalle estable, server-side).
- PR-5: módulo transversal de Informes admin (reemplaza el mapeo temporal).
- PR-10: responsive + fixtures de escala + E2E visual.
- PR-11: retiro de `DashboardSidebar*` y sus tests de contrato.

---

## 12. Confirmación de no-alcance

- ❌ No se tocó login ni su pantalla.
- ❌ No se tocó web pública ni Home.
- ❌ No se rediseñó contenido interno de Clínicas/Informes/Tokens/Auditoría/etc.
- ❌ No se implementó server-side search/pagination ni detail pane estable.
- ❌ No se modificó backend ni DB.
- ❌ No se agregaron dependencias.
- ❌ No se procesaron PRs Dependabot.
- ❌ No se ejecutó `git add/commit/push` ni `gh pr create/merge` (lo hace Nico).
