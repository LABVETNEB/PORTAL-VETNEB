# Dashboard → Single-Viewport App Shell — Auditoría y Plan

PR objetivo: `feat(dashboard): convert workspace to single-viewport app shell`
Rama: `feat/dashboard-single-viewport-app-shell`
Base: `009254e feat(dashboard): introduce no-scroll premium operational workspace (#1008)`

> Alcance: solo frontend (`frontend/src/...`) y tests. **No** backend, DB, migrations, auth,
> sesiones, contratos API, ni dependencias nuevas. Git manual lo hace Nico.

---

## 1. Diagnóstico técnico honesto

### Por qué #1007 no resolvió el problema
- #1007 fue una mejora **visual** (hero premium, cards, gradientes). Mantuvo el patrón de
  página larga: el contenido seguía creciendo verticalmente y dependía del scroll del
  contenedor `.dashboard-main` (`overflow-y-auto`). No cambió el modelo de uso.

### Por qué #1008 no resolvió el problema
- #1008 introdujo el **cockpit no-scroll solo en el hub**: `DashboardModuleHub` con
  `.dashboard-cockpit` (grid `21rem | 1fr` en `lg`, `grid-auto-rows: minmax(0,1fr)`) que
  llena el viewport sin scroll. Eso funciona **únicamente en la vista de selección de módulos**.
- En cuanto se abre un módulo, el contenido se renderiza dentro de
  `DashboardModuleWorkspace`, cuyo área de contenido es:
  `frontend/src/components/dashboard/DashboardModuleWorkspace.tsx:46`
  ```tsx
  <div className="min-h-0 flex-1 overflow-y-auto pt-4">{children}</div>
  ```
  → **scroll interno delegado** a nivel módulo. Ese es el patrón explícitamente prohibido.
- Además los módulos reales siguen siendo "páginas largas":
  - `ClinicCommandCenter` apila `space-y-5`: nota operativa + KPIs + StatsCards + grid de
    2 cards de listas → excede 768px.
  - Admin `audit-log`: 4 cards apiladas + tabla de 7 columnas con **todas** las filas.
  - Admin `admin-clinics`: formulario de creación de 6 columnas + búsqueda + tabla con
    `PAGE_SIZE = 50` filas + drawer.
  - Admin `admin-pricing`: renderiza **todas** las categorías × **todos** los ítems como
    formularios apilados (altura no acotada).
  - Admin `admin-sessions`: grid de filtros + tabla de 7 columnas con `PAGE_SIZE = 25`.

### Qué sigue igual visual y operativamente
- El hub se ve premium y entra en viewport, pero **al operar** (abrir un módulo) el usuario
  vuelve a una página con scroll. La percepción de "dashboard web común" se mantiene en los
  módulos, que es donde se trabaja.

### Componentes que aún responden a lógica de página/módulo largo
- `DashboardModuleWorkspace` (scroll delegado).
- `ClinicCommandCenter`, `ClinicInformesWorkspaceSummary`, `ClinicLogisticaWorkspaceSummary`.
- `admin/page.tsx` workspace slots (`adminWorkspaceSlot`, `healthWorkspaceSlot`,
  `auditLogWorkspaceSlot`, `maintenanceWorkspaceSlot`, etc.).
- `AdminClinicsManagementCard`, `AdminPricingEditorCard`, `AdminSessionsReadOnlyCard`.

### Dónde existe scroll real, potencial o delegado
- **Real/delegado**: `DashboardModuleWorkspace` content `overflow-y-auto`.
- **Real**: `.dashboard-main` `overflow-y-auto` (contenedor que efectivamente scrollea cuando
  el módulo excede).
- **Potencial**: tablas/listas/formularios sin tope de altura (pricing, clinics, sessions, audit).
- **Delegado secundario**: `MasterDetailWorkspace` master panel `xl:overflow-y-auto`
  (no usado por módulos prioritarios; se deja fuera de alcance estricto).

### Dónde se usa overflow como parche
- `DashboardModuleWorkspace` content `overflow-y-auto` (parche operativo → se elimina).
- `.dashboard-cockpit-tile` `overflow:hidden` (correcto: tiles compactos, sin ocultar contenido
  crítico porque la descripción es secundaria).

### Riesgo de ocultar contenido
- Si solo se reemplaza `overflow-y-auto` por `overflow-hidden` sin rediseñar, el contenido con
  datos reales quedaría **cortado**. Por eso la solución debe **acotar el contenido**
  (paginación, tabs, dialog) y no recortarlo.

### Contratos E2E / source que condicionan la implementación
- `frontend/e2e/dashboard-card-navigation-shell.spec.ts`:
  - `data-dashboard-module-hub="true"`, `data-dashboard-module-workspace="<id>"`,
    cards `button[aria-label^="Título:"]`, `data-dashboard-module-card`.
  - Shell con ancestro `.overflow-hidden` (`h-dvh overflow-hidden`).
  - **`main` debe tener `overflow-y: auto` computado** (test "dashboard main content area is
    scroll container"). → Se conserva la propiedad CSS pero sin overflow efectivo.
  - Deep links `?module=...`, fallback a hub, back/forward, "Volver a módulos".
  - Sidebar rail ≤ 80px, ≥ 4 nav items con `aria-label`, "Volver al sitio público".
- `frontend/e2e/dashboard-workspace-layout-polish.spec.ts`: `dashboard-workspace-enter`,
  `main.dashboard-main`, region "Informes del dashboard", `overflow <= 5` en `documentElement`.
- `test/frontend-dashboard-workspace-layout-polish.test.ts`: **scope guard** (`git diff
  --name-only` no debe tocar `server/`, `frontend/src/app/api/`, `package.json`,
  `frontend/package.json`, `frontend/next-env.d.ts`, etc.) + **no nuevas dependencias** +
  pins de `DashboardModuleWorkspace` (`dashboard-workspace-enter`, `dashboard-workspace-header`,
  `data-dashboard-module-workspace`, `dashboard-btn-interactive`, focus ring) y de
  `DashboardShellRouter` (`h-dvh overflow-hidden`).
- `test/frontend-dashboard-shell.test.ts`, `...-private-shell-foundation.test.ts`,
  `...-hub-hero.test.ts`, `admin-dashboard-sections-contract.test.ts` (cada `id="admin-*"` /
  `id="audit-log"` debe seguir presente en `admin/page.tsx` o en `AdminClinicsManagementCard`).

### Por qué el usuario sigue percibiendo que no se respetó "sin scroll"
- Porque la operación real (módulos) **scrollea**. El no-scroll solo se logró en la antesala
  (hub). El brief exige no-scroll **en los módulos**, que es donde se trabaja.

---

## 2. Mapa de arquitectura actual

```
app/dashboard/layout.tsx
└─ PrivateDashboardShell
   └─ DashboardShellRouter        ← <div class="flex h-dvh overflow-hidden">   (shell raíz)
      ├─ Clinic/AdminDashboardSidebar  (aside sticky h-dvh w-[4.5rem] 2xl:w-60, overflow-y-auto)
      └─ <div class="flex flex-1 flex-col min-w-0 overflow-hidden">            (columna principal)
         └─ {children} = page.tsx:
            ├─ DashboardTopbar (sticky, min-h 4.5rem)
            └─ <main class="dashboard-main"> (flex min-h-0 flex-1 flex-col space-y-6 overflow-y-auto)
               ├─ DashboardPageHeader (border-b, pb-5)
               ├─ <Suspense> Controller
               │   ├─ HUB:  DashboardModuleHub (.dashboard-cockpit min-h-0 lg:flex-1)
               │   │         ├─ hero slot (.dashboard-cockpit-rail)
               │   │         └─ launcher (.dashboard-cockpit-launcher → .dashboard-cockpit-grid)
               │   └─ MODULE: DashboardModuleWorkspace (flex min-h-0 flex-1 flex-col)
               │             ├─ header (dashboard-workspace-header)  [Volver + título]
               │             └─ content (min-h-0 flex-1 OVERFLOW-Y-AUTO)  ← scroll delegado
               └─ <div class="h-24 md:hidden"> (spacer móvil)
```

- Rutas: `/dashboard`, `/dashboard?module=operaciones|informes|logistica|perfil|tokens`;
  `/dashboard/admin`, `/dashboard/admin?module=<admin-module>`; además páginas separadas
  `/dashboard/informes`, `/dashboard/logistica/*` (fuera de alcance estricto de este PR).
- Query params: `module`, y en admin auditoría `event`, `actorType`.
- Estado: `useState(activeModule)` sincronizado con `searchParams`, persistencia
  `dashboard-last-module` en `localStorage`.
- Limitaciones reales: el contenido de módulo no tiene presupuesto de altura → scrollea.

---

## 3. Diseño App Shell propuesto

Cadena de altura determinística (de raíz a hoja), **sin tocar el shell raíz** (ya correcto):

| Región            | Regla                                                                 |
|-------------------|-----------------------------------------------------------------------|
| Shell raíz        | `flex h-dvh overflow-hidden` (sin cambios — pin de test)              |
| Sidebar           | `w-[4.5rem] 2xl:w-60`, `h-dvh`, `overflow-y-auto` (nav corta, no scroll real) |
| Columna principal | `flex flex-1 flex-col min-w-0 overflow-hidden` (sin cambios)          |
| Topbar            | `min-h-[4.5rem]` fijo                                                 |
| `main`            | `flex min-h-0 flex-1 flex-col overflow-y-auto` (propiedad conservada por contrato; contenido entra → sin overflow efectivo) |
| PageHeader        | Solo en HUB. Se oculta en módulo para recuperar altura.              |
| HUB cockpit       | `min-h-0 lg:flex-1` (sin cambios — ya entra)                          |
| Workspace módulo  | `flex min-h-0 flex-1 flex-col`; **content = `min-h-0 flex-1` SIN scroll** |
| ModuleSurface     | `flex min-h-0 flex-1 flex-col`: toolbar fija + body `min-h-0 flex-1`  |
| ModuleTabs        | tablist fijo + panel activo `min-h-0 flex-1` (sin scroll)            |
| Tabla/lista       | `usePagedRows` (tope de filas) + `CompactPager` fijo al pie          |

Reglas transversales:
- Todos los contenedores de la cadena: `min-h-0` y `min-w-0`.
- `overflow` efectivo nulo en módulos: el contenido se **acota**, no se recorta.
- Sin `ScrollArea`, sin `overflow-y-auto`/`overflow-auto`/`max-height+scroll` como solución
  operativa en desktop.
- Altura por layout (flex/grid), nunca por contenido.

Presupuesto vertical (peor caso 1366×768):
```
768 - topbar(72) - main padding(~48) - workspace header(~64) ≈ 584px para el body del módulo
(con PageHeader oculto en módulo). Una tabla compacta = filtros(~44) + thead(~36) +
N filas(40px) + pager(~44). N=8 → ~408px. Holgado. Page size objetivo: 6–8 filas.
```

Cómo se evita ocultar funcionalidad:
- Formularios largos → **Dialog/wizard** (crear clínica, editar precio).
- Tablas largas → **paginación** (page size que entra en viewport).
- Multi-sección → **tabs** (auditoría: Resumen/Registro; precios: por categoría).
- Detalle → **drawer/dialog** (clínica) ya existente.

---

## 4. Estrategia por módulo

| Familia | Vista que entra | Prioriza | Tabs | Paginación | Drawer/Dialog | No scroll |
|---|---|---|---|---|---|---|
| **Clínica hub** | cockpit | hero + 5 tiles | — | — | — | OK (ya) |
| **Clínica operaciones** | KPIs + 2 listas (3 ítems) | pendientes/visitas | — | top 3 | — | compactar `space-y` |
| **Clínica informes** | 1 card + CTA | informes recientes | — | top 3 | — | ya corto |
| **Clínica logística** | 1 card + CTA | visitas recientes | — | top 3 | — | ya corto |
| **Clínica perfil** | password + perfil | acciones | (perfil/seguridad) | — | — | tabs si excede |
| **Clínica tokens** | tabla tokens | activos | — | sí | dialog crear | page size |
| **Admin hub** | cockpit (10 tiles) | — | — | — | — | OK (ya) |
| **Admin clínicas** | tabla | clínicas+usuario | — | **sí (6/pág)** | **dialog crear** + drawer editar | mover form a dialog |
| **Admin auditoría** | tabs Resumen/Registro | registro | **sí** | **sí (tabla)** | — | tabs + paginación |
| **Admin precios** | tabs por categoría | ítems de categoría | **sí** | **sí (lista)** | **dialog editar ítem** | tabs + paginación + dialog |
| **Admin sesiones** | filtros + tabla | activas | — | **sí (6/pág)** | — | filtros compactos |
| **Admin estado** | grid compacto / tabs | servicios | tabs si excede | — | — | compactar grid |
| **Admin tokens** | tabla | tokens | — | sí | dialog | page size |
| **Admin roles** | tabla | cambios rol | — | sí | — | page size |
| **Admin mantenimiento** | schema + dry-run | acciones | tabs si excede | — | — | compactar |
| **Admin subir informe** | aviso | indicación | — | — | — | ya corto |

Riesgos específicos:
- **Precios**: número de ítems por categoría no acotado → obligatorio paginar dentro de cada
  tab de categoría + edición por dialog (no formularios apilados).
- **Clínicas**: formulario de creación de 6 campos no entra junto a la tabla → va a dialog.
- Source-contract tests pinnean estructura de estos componentes → se actualizan en el PR.

---

## 5. Criterios de aceptación verificables

1. `document.documentElement.scrollHeight <= clientHeight + 2` en `/dashboard` y `/dashboard/admin`
   a 1440×900 y 1366×768.
2. Idem `document.body` (alto y ancho) → sin scroll vertical ni horizontal.
3. Hub clínica y hub admin visibles completos en ambos viewports.
4. Módulos mínimos clínica (`operaciones`, `informes`, `logistica`) visibles completos en ambos.
5. Módulos mínimos admin (`admin-clinics`, `audit-log`, `admin-pricing`, `admin-sessions`)
   visibles completos en ambos.
6. `[data-dashboard-module-workspace="<id>"]` sin scroll efectivo
   (`scrollHeight <= clientHeight + 2`).
7. Tablas principales paginadas (no scroll vertical/horizontal).
8. Acciones principales visibles sin desplazamiento.
9. Tabs/drawers/dialogs sin scroll interno en desktop.
10. Deep links existentes preservados (incluye `event`/`actorType` de auditoría).
11. `PasswordChangePanel` preservado (clínica perfil + admin sesiones).
12. Tema dark-gray preservado.
13. Accesibilidad básica: roles `tab`/`tablist`/`dialog`, `aria-label`, focus ring.
14. E2E nuevo de contrato viewport (9 rutas × 2 viewports).
15. `main.dashboard-main` conserva `overflow-y: auto` (compatibilidad) sin overflow efectivo.

---

## 6. Plan de implementación

**Componentes a crear** (zero deps):
- `frontend/src/components/dashboard/ModuleSurface.tsx` — frame estándar no-scroll.
- `frontend/src/components/dashboard/ModuleTabs.tsx` — segmented control + paneles `flex-1 min-h-0`.
- `frontend/src/components/dashboard/usePagedRows.ts` — hook de paginación cliente.
- `frontend/src/components/dashboard/CompactPager.tsx` — barra de paginación compacta.
- `frontend/src/components/dashboard/ModuleDialog.tsx` — dialog compacto (wrap radix-dialog) para formularios.

**Componentes a refactorizar**:
- `DashboardModuleWorkspace.tsx` — quitar `overflow-y-auto`; content `min-h-0 flex-1`; añadir
  `data-dashboard-module-viewport`.
- `ClinicDashboardWorkspaceController.tsx` / `AdminDashboardWorkspaceController.tsx` — renderizar
  `DashboardPageHeader` solo en hub (recuperar altura en módulo) + pasar workspaces vía ModuleSurface.
- `app/dashboard/page.tsx` / `app/dashboard/admin/page.tsx` — mover PageHeader al controller; envolver slots.
- `ClinicCommandCenter.tsx`, `ClinicInformesWorkspaceSummary.tsx`, `ClinicLogisticaWorkspaceSummary.tsx`.
- `AdminClinicsManagementCard.tsx`, `AdminPricingEditorCard.tsx`, `AdminSessionsReadOnlyCard.tsx`,
  y los slots de `admin/page.tsx` (audit-log compacto con tabs).

**Archivos CSS**: `globals.css` — nueva sección `dashboard-single-viewport-app-shell:*` (después de
las secciones de dashboard existentes, respetando el orden reduced-motion).

**Tests a agregar/actualizar**:
- `frontend/e2e/dashboard-single-viewport-app-shell.spec.ts` (nuevo, 9 rutas × 2 viewports).
- Alinear pins en `test/frontend-dashboard-workspace-layout-polish.test.ts` y los contract tests
  de módulos refactorizados (solo lo necesario, manteniendo invariantes de seguridad/scope).

**Validaciones**: `pnpm --dir frontend typecheck|lint|build`, `pnpm test`,
`pnpm security:public-surface`, e2e específicos. Revertir `next-env.d.ts` tras e2e.

**Riesgos**: alto número de source-contract tests sobre los archivos tocados; mitigación: mantener
patrones pinneados y actualizar tests en el mismo PR. Datos reales más altos que en e2e (sin
backend) → mitigado por paginación/tabs/dialog (no recorte).

**Rollback**: revertir el merge del PR (cambios 100% frontend + tests; sin migrations ni contratos).
