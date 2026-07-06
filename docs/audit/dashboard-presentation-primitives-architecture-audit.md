# Dashboard Presentation Primitives — Architecture Audit (PR-PRES-1)

> **Tipo:** Auditoría docs-only. **No implementa, no mueve archivos, no toca código ni CSS.**
> **Base:** `main` limpio · **HEAD:** `6cbe446` refactor(dashboard): introduce css composition root (#1290)
> **Rama:** `docs/dashboard-presentation-primitives-audit`
> **Alcance de escritura:** exclusivamente `docs/audit/`.
> **Modelo / esfuerzo:** Claude Opus 4.8 · high.

Antecedentes cerrados que habilitan esta auditoría:

- **#1288** — se elimina el home/hub genérico y se unifica el workspace por módulo.
- **#1289** — CSS del dashboard modularizado; los tests leen la fuente CSS compuesta.
- **#1290** — `styles/dashboard/index.css` como *composition root* y módulos CSS por responsabilidad.

El CSS ya quedó ordenado por responsabilidad. **Esta auditoría cubre la deuda equivalente en la capa
TSX/React**, para preparar el rediseño premium (PR-UX-1) sin seguir acumulando parches.

---

## 1. Resumen ejecutivo

La presentación del dashboard **funciona y ya tiene primitivas limpias**, pero su arquitectura TSX
está fragmentada en tres árboles (`app/dashboard/`, `components/dashboard/`, `lib/`) sin una frontera
declarada entre **config**, **domain**, **application** y **presentation**. El CSS ya se modularizó por
responsabilidad (#1289/#1290); el TSX todavía no.

El síntoma dominante es que **el registro de módulos del dashboard no tiene fuente única de verdad**:
la misma lista de módulos (ids, alias, título, descripción, icono, etiqueta, destinos de navegación)
está **copiada literalmente en 8+ archivos**. Cualquier cambio de módulo (agregar, renombrar, reordenar,
cambiar icono) obliga a editar múltiples archivos desincronizables. En paralelo, **la máquina de estado
de navegación optimista está duplicada y escrita a mano** en dos controllers casi idénticos (admin y
clínica), con un tercer *tracker* independiente en el bottom-nav móvil.

Las rutas (`page.tsx`) son *kitchen sinks*: mezclan parseo de módulo, *view-model* de salud del sistema,
orquestación de fetch, redirección de auth y JSX de presentación inline en un solo archivo (admin
`page.tsx` = **813 líneas**).

La buena noticia: **la taxonomía de destino ya existe en el CSS** (`shell/navigation/layout/surfaces/
mobile-admin/mobile-clinic`) y **varias primitivas ya están limpias** (`DashboardModuleWorkspace`,
`ModuleSurface`, estados). La reorganización puede hacerse por extracción incremental de bajo riesgo,
espejando la estructura CSS ya aprobada, **sin cambios de comportamiento**.

### Hallazgos priorizados

| # | Hallazgo | Prioridad | Evidencia principal |
|---|----------|-----------|---------------------|
| H1 | Registro de módulos sin fuente única de verdad (copiado en 8+ archivos) | **P1** | admin: `admin-particular-tokens` literal en 8 archivos; clínica: lista en 4 |
| H2 | Máquina de navegación optimista duplicada y hecha a mano en 2 controllers + 1 tracker paralelo | **P1** | `AdminDashboardWorkspaceController` (472 LOC) ≈ `ClinicDashboardWorkspaceController` (192 LOC) + `AdminMobileBottomNav` |
| H3 | Rutas `page.tsx` mezclan datos + view-model + auth + presentación | **P1** | admin `page.tsx` 813 LOC; clínica `page.tsx` 168 LOC |
| H4 | Sin frontera `features/dashboard/{config,domain,application,presentation}`; TSX disperso en 3 árboles | **P1** | `features/` no existe; 97 archivos en `app/dashboard`+`components/dashboard` |
| H5 | Acoplamiento a datos difundido en la presentación (35 archivos importan `@/lib/api`) | **P2** | god-cards de 800–2040 LOC con fetch propio |
| H6 | Capa *application* real pero dispersa en `lib/` global y duplicada por rol | **P2** | `clinic-hub-reset.ts` ≈ `admin-hub-reset.ts`; `dashboard-last-module.ts`; `admin-access-error.ts` |
| H7 | *View-model* de salud/estado embebido en la ruta (10+ formatters) | **P2** | admin `page.tsx` `getServiceVariant`/`formatServiceStatus`/`formatUptime`… |

---

## 2. Dónde viven hoy las rutas y componentes del dashboard

Tres árboles, sin frontera de capas declarada:

```
frontend/src/
  app/dashboard/                     ← RUTAS (server components) + cards co-localizadas
    layout.tsx                       ← delega en PrivateDashboardShell
    page.tsx                         ← ruta clínica (fetch + parse + presentación)
    ClinicCommandCenter.tsx          ← surface de clínica (co-localizada en la ruta)
    ClinicInformesWorkspaceSummary.tsx
    ClinicLogisticaWorkspaceSummary.tsx
    admin/
      page.tsx                       ← ruta admin: 813 LOC, kitchen-sink
      AdminDashboardWorkspaceController.tsx  ← 472 LOC, máquina de navegación
      Admin*Card.tsx (…)             ← ~30 cards/módulos admin co-localizados
    informes/ · logistica/           ← subrutas + *.actions.ts + canvases

  components/dashboard/              ← ~50 componentes compartidos (mezcla de capas)
    PrivateDashboardShell · DashboardShellRouter · DashboardTopbar   (shell)
    DashboardModuleRail · *MobileBottomNav · DashboardHorizontalNav  (navigation)
    DashboardPageHeader · DashboardSidebarFrame                       (layout)
    ModuleSurface · EmptyState · ErrorState · LoadingState · StatsCards (surfaces)
    ClinicDashboardWorkspaceController · Clinic*Card                  (clinic)
    Admin*Mobile* · AdminReportWorkflowViewerCard                     (admin)

  lib/                              ← capa application dispersa en util global
    routes.ts · dashboard-last-module.ts
    clinic-hub-reset.ts · admin-hub-reset.ts · admin-access-error.ts
    dashboard-server-auth.ts · app-shell-release.ts

  styles/dashboard/                 ← YA modularizado por responsabilidad (#1289/#1290)
    index.css (composition root) · shell · navigation · layout · surfaces ·
    tables · interactions · responsive · tokens · zero-scroll ·
    mobile-admin · mobile-clinic
```

Observación clave: **el CSS ya declara la taxonomía objetivo** (`shell/navigation/layout/surfaces/
admin/clinic`). El TSX debe **espejar esa misma taxonomía** en `features/dashboard/presentation/…`.
Hoy no existe `frontend/src/features/` ni ninguna carpeta `config/domain/application/presentation`.

Métricas de superficie (verificadas):

- **97** archivos `.ts(x)` entre `app/dashboard` y `components/dashboard`.
- **61/97** declaran `"use client"` (frontera cliente muy extendida).
- **35** archivos importan `@/lib/api` directamente (datos difundidos en presentación).

---

## 3. Componentes que concentran demasiada responsabilidad

Tamaño como *smell* de responsabilidad acumulada (LOC verificadas):

| Archivo | LOC | Responsabilidades mezcladas |
|---------|-----|-----------------------------|
| `app/dashboard/admin/AdminParticularTokensCard.tsx` | 2040 | datos + estado + tabla + acciones + presentación |
| `components/dashboard/ClinicParticularTokensCard.tsx` | 1708 | ídem, variante clínica |
| `app/dashboard/admin/AdminReportsCard.tsx` | 1033 | fetch + upload + workflow + tabla |
| `app/dashboard/admin/AdminUsersRolesReadOnlyCard.tsx` | 949 | fetch + paginación + presentación |
| `components/dashboard/ClinicPublicProfileCard.tsx` | 911 | formulario + fetch + validación + presentación |
| `app/dashboard/admin/AdminClinicsManagementCard.tsx` | 887 | CRUD + búsqueda + drawer + tabla |
| `components/dashboard/UploadReportModal.tsx` | 865 | formulario + upload + estado |
| `app/dashboard/admin/page.tsx` | 813 | parse módulo + view-model salud + fetch + JSX inline |
| `app/dashboard/admin/AdminSessionsReadOnlyCard.tsx` | 804 | fetch + revocación + tabla |
| `app/dashboard/admin/AdminDashboardWorkspaceController.tsx` | 472 | máquina navegación + registro módulos + hero + hub |
| `components/dashboard/DashboardNotificationsBell.tsx` | 623 | fetch + polling + panel |

Estas god-cards **no son el foco de PR-PRES** (dividirlas es trabajo funcional posterior), pero
justifican por qué la presentación necesita primitivas: sin `surfaces`/`states`/`tables` reutilizables,
cada card reimplementa su propio *scaffold*.

---

## 4. Lógica mezclada con presentación (datos, navegación, layout, viewport, rol, módulo, estado)

### 4.1 Registro de módulos (config/domain) mezclado en la presentación — **H1**

La misma verdad ("qué módulos existen y cómo se ven") está esparcida y **duplicada literalmente**:

**Clínica** — la lista de módulos aparece en 4 lugares distintos, cada uno con su forma:

| Fuente | Forma de la duplicación |
|--------|-------------------------|
| `app/dashboard/page.tsx` | `VALID_CLINIC_MODULES` + `parseClinicModule` |
| `ClinicDashboardWorkspaceController.tsx` | `ClinicModule` (type) + `CLINIC_MODULE_VALUES` + `DEFAULT_CLINIC_MODULE` + `MODULE_META` (title/description) + `parseModuleFromUrl` |
| `DashboardModuleRail.tsx` | `CLINIC_MODULE_RAIL_ITEMS` (label/shortLabel/icon) |
| slots `workspaces={{…}}` en `page.tsx` | mapa módulo→ReactNode |

**Admin** — el id `admin-particular-tokens` (uno de diez módulos) aparece literal en **8 archivos**:
`AdminDashboardWorkspaceController.tsx`, `admin/page.tsx`, `AdminOverviewQuickLinks.tsx`,
`AdminDashboardSidebar.tsx`, `AdminMobileModuleMenu.tsx`, `DashboardHorizontalNav.tsx`,
`DashboardTopbar.tsx` (`ADMIN_MOBILE_TITLES`), `lib/notification-destinations.ts`.
Además:

- `ADMIN_MODULE_VALUES` + `ADMIN_MODULE_ALIASES` + `parseModuleFromUrl` viven **en el controller
  y otra vez** en `admin/page.tsx` (`VALID_ADMIN_MODULES` + `ADMIN_MODULE_ALIASES` + `parseAdminModule`).
- `ADMIN_MODULE_META` (title/description) y `adminCards` (icon/title/description/actionLabel/onClick)
  son **dos representaciones** del mismo catálogo, ambas en el controller.
- `AdminMobileBottomNav` tiene su **propio** subconjunto `FIXED_DESTINATIONS` (label/moduleId/icon).
- `DashboardTopbar` tiene su **propio** mapa `ADMIN_MOBILE_TITLES` (moduleId→título móvil).

**Causa raíz:** no hay un `config/` que declare el catálogo de módulos una sola vez. Cada superficie
(ruta, controller, rail, bottom-nav, sidebar, topbar, quick-links) re-declara su vista del catálogo.

### 4.2 Navegación / estado de módulo activo (application) mezclado con presentación — **H2**

`AdminDashboardWorkspaceController` (472 LOC) y `ClinicDashboardWorkspaceController` (192 LOC)
**re-implementan la misma máquina de navegación optimista** con diferencias sutiles:

- `useState(activeModule)` + `useSearchParams` + `useRouter`.
- `pendingNavigationIntent` (ref) con **consumo one-shot** para distinguir el commit de URL correcto de
  uno *superseded* (comentarios extensos documentan flakes de CI: "hub tile detached mid-click",
  "mobile bottom-nav flake").
- Suscripciones a un *event bus* (`subscribe*ModuleActivate` / `subscribe*HubReset`).
- Persistencia de "último módulo" (`writeDashboardLastModule` / `readDashboardLastModule`) + restauración
  con `router.replace`.
- Admin agrega un **buffer de dos commits** (`pendingActivation` → efecto de promoción) para no
  desmontar el tile dentro del ciclo del click.

Y `AdminMobileBottomNav` corre **un tracker independiente más**: escucha `popstate` y lee
`URLSearchParams` para su propio `activeModule`, coordinándose con el controller **solo por el event bus**.
Resultado: **múltiples fuentes del estado "módulo activo"** que deben mantenerse sincronizadas a mano.

**Causa raíz:** la lógica de navegación es *application*, pero vive dentro de componentes de presentación
y está duplicada por rol y por superficie.

### 4.3 Rutas que mezclan datos + view-model + auth + presentación — **H3 / H7**

`admin/page.tsx` (813 LOC) concentra, en un solo archivo:

- **domain (parse):** `VALID_ADMIN_MODULES`, `ADMIN_MODULE_ALIASES`, `parseAdminModule` (3ª copia).
- **domain/view-model (salud):** `getServiceVariant`, `formatServiceStatus`,
  `getEmailTransportBadgeVariant`, `formatEmailTransport`, `getSystemStatusVariant`,
  `formatSystemStatus`, `getSystemStatusIndicatorClass`, `formatSystemStatusDetail`,
  `formatConfigurationFlag`, `formatUptime`, `formatHealthTimestamp` (10+ formatters).
- **application (datos/auth):** `getAdminRequestOptions`, `loadAdminAuditSnapshot`,
  `loadAdminSystemHealth`, `Promise.all([...])`, resolución anidada de `initialAccessErrorStatus`,
  `redirectToLoginOnUnauthorized`.
- **presentation:** JSX inline gigante (`healthServicesGrid`, `healthRuntimeGrid`, `adminWorkspaceSlot`,
  `sessionsWorkspaceSlot`, …) + arrays *view-model* móviles (`healthMobileServices`,
  `healthMobileRuntime`).

`app/dashboard/page.tsx` (clínica, 168 LOC) tiene el mismo patrón en menor escala: fetch (`getDashboardStats`
`getReports` `getLogisticsFieldVisits`), `redirectToLoginOnUnauthorized`, parse de módulo
(`VALID_CLINIC_MODULES`) y composición de slots, todo junto.

### 4.4 Viewport / rol acoplados dentro de componentes

- `DashboardShellRouter` deriva `surface = admin|clinic` desde `useSelectedLayoutSegment` y elige el
  bottom-nav por rol — decisión de *rol/shell* correcta, pero hoy embebida.
- Doble render admin **desktop vs móvil** dentro de la ruta: `admin/page.tsx` emite `AdminMobile*Module`
  (`md:hidden`) **y** el equivalente desktop (`hidden md:flex`) como ramas hermanas. El *viewport switch*
  vive en la ruta en vez de en un primitive de layout.
- `DashboardTopbar` mezcla presentación de shell + **logout/sesión** (`logoutAdmin`/`logoutClinic`,
  `clearDashboardLastModules`, `window.location.replace`) + ramificación por rol + `ADMIN_MOBILE_TITLES`.

---

## 5. Componentes que ya son (o deberían ser) primitives reutilizables

### 5.1 Ya limpios — mover casi tal cual (bajo riesgo)

| Componente | Rol de primitive | Nota |
|------------|------------------|------|
| `DashboardModuleWorkspace` | shell | header + viewport + `onBack` opcional; API estable |
| `ModuleSurface` | surfaces | frame de un-viewport (`toolbar` + `body`); ya documentado |
| `EmptyState` · `ErrorState` · `LoadingState` | surfaces/states | estados reutilizables |
| `StatusBadge` · `StatsCards` · `DashboardPageHeader` | surfaces/layout | presentación pura |
| `ModuleTabs` · `ModuleDialog` | surfaces | usados por la ruta para partir viewport |
| `DashboardModuleWorkspace` + `dashboard-module-stage` | shell | *stage* persistente ya aislado |

### 5.2 Primitives implícitas que hay que extraer

| Hoy | Debería ser |
|-----|-------------|
| Máquina de navegación en ambos controllers | `application/useDashboardModuleNavigation` (hook único, parametrizado por catálogo de rol) |
| `clinic-hub-reset.ts` + `admin-hub-reset.ts` | `application/moduleActivationBus` (un bus, parametrizado por rol) |
| `CLINIC_MODULE_RAIL_ITEMS` / `adminCards` / `FIXED_DESTINATIONS` / `ADMIN_MOBILE_TITLES` | `config/*ModuleCatalog` (una sola declaración; las vistas derivan de ahí) |
| formatters de salud en `admin/page.tsx` | `domain/systemHealthViewModel` |
| `parse*Module` (×3) | `domain/parseDashboardModule` (uno por rol, sobre el catálogo) |

---

## 6. Qué debería ir a cada capa (config / domain / application / presentation)

Arquitectura objetivo (espeja la taxonomía CSS ya aprobada):

```
frontend/src/features/dashboard/
  config/          ← catálogo de módulos por rol (id, alias, label, shortLabel, icon,
                     title, description, storageKey, destinos nav). Fuente ÚNICA de verdad.
                     + routes/shell-release re-exportados o movidos.
  domain/          ← tipos ClinicModule/AdminModule, parse/validación de módulo,
                     view-models puros (systemHealth, audit labels, status→variant).
  application/     ← useDashboardModuleNavigation (URL-sync optimista, last-module,
                     intent one-shot, two-commit), moduleActivationBus, accessError store,
                     server-auth/redirect, wrappers de carga de datos (load*Snapshot).
  presentation/
    shell/         ← PrivateDashboardShell, DashboardShellRouter, DashboardTopbar,
                     DashboardModuleWorkspace, DashboardModuleHub, DashboardHubHero, ModuleSurface.
    navigation/    ← DashboardModuleRail, Admin/ClinicMobileBottomNav, DashboardHorizontalNav,
                     Admin/ClinicDashboardSidebar, pagers, AdminMobile*Menu/HubLauncher, kebab.
    layout/        ← DashboardPageHeader, DashboardSidebarFrame, viewport-switch primitive,
                     stage wrappers.
    surfaces/      ← EmptyState/ErrorState/LoadingState, StatsCards, StatusBadge, FilterBar/Drawer,
                     StickyActionBar, ModuleTabs/Dialog, StudyTimeline, ReportDownloadButton, tablas.
    admin/         ← Admin*Card + Admin*Mobile*Module (workspace wrappers admin).
    clinic/        ← Clinic*Card + Clinic*WorkspaceSummary + ClinicCommandCenter (wrappers clínica).
```

Regla de la frontera: **`presentation` no importa `@/lib/api` directamente**; recibe datos por props o
vía hooks de `application`. `config` y `domain` no importan React. `application` no renderiza JSX.

---

## 7. Archivos a tocar en los próximos PRs (mapa de movimiento propuesto)

> Solo movimientos/extracciones **behavior-preserving**. Sin cambios visuales ni de contrato.

**Fuente única del catálogo (config) — máxima palanca:**
`AdminDashboardWorkspaceController.tsx`, `admin/page.tsx`, `AdminOverviewQuickLinks.tsx`,
`AdminDashboardSidebar.tsx`, `AdminMobileModuleMenu.tsx`, `DashboardHorizontalNav.tsx`,
`DashboardTopbar.tsx`, `ClinicDashboardWorkspaceController.tsx`, `DashboardModuleRail.tsx`,
`app/dashboard/page.tsx` → **consumen** `config/*ModuleCatalog` en lugar de literales propios.

**Navegación (application):**
`AdminDashboardWorkspaceController.tsx` + `ClinicDashboardWorkspaceController.tsx` →
extraer `application/useDashboardModuleNavigation`; `clinic-hub-reset.ts` + `admin-hub-reset.ts` →
`application/moduleActivationBus`; `dashboard-last-module.ts`, `admin-access-error.ts`,
`dashboard-server-auth.ts` → `application/`.

**Shell / surfaces (presentation):**
`PrivateDashboardShell`, `DashboardShellRouter`, `DashboardTopbar`, `DashboardModuleWorkspace`,
`ModuleSurface`, estados y `Module{Tabs,Dialog}` → `presentation/shell|surfaces`.

**View-model de salud (domain):**
formatters de `admin/page.tsx` → `domain/systemHealthViewModel`; la ruta queda como composición.

---

## 8. Qué NO se debe tocar

- **CSS del dashboard** (`styles/dashboard/*`): ya modularizado (#1289/#1290). Los PR-PRES son
  **TSX-only**. Ningún cambio de clase, selector ni token.
- **Contratos y transporte de datos**: `lib/api.ts`, endpoints, payloads, métodos HTTP.
- **Auth / sesiones**: invariantes `admin_session_id` (admin) y `app_session_id` (clínica); nunca
  mezclarlas ni alterar el logout seguro de `DashboardTopbar`.
- **Backend / API / DB / Supabase / Drizzle / storage / RLS.**
- **Dependencias / lockfiles** (`package.json`, `pnpm-lock.yaml`), **CI**, **Playwright config**.
- **`.claude/`, worktrees, stashes.**
- **Atributos de contrato E2E/CSS**: `data-vetneb-app-shell*`, `data-dashboard-*`, `data-admin-mobile-*`,
  nombres de clase y **anidamiento del DOM** — son el contrato entre TSX, el CSS compuesto y los
  selectores Playwright. Mover ≠ renombrar.

---

## 9. Riesgos visuales y operativos

**Visuales**

- La cadena de altura *no-scroll* del App Shell depende de `min-h-0`/`flex-1` y de clases como
  `dashboard-module-stage`, `dashboard-module-surface`, `dashboard-workspace-*`. Reubicar componentes
  debe **preservar clases y anidamiento** o se rompe el un-viewport.
- El *stage* persistente (`data-dashboard-module-stage`) evita ghosting en GPUs móviles (documentado en
  el controller). No debe recrearse su stacking context por navegación.
- El *viewport switch* admin (ramas `md:hidden` / `hidden md:flex`) debe moverse íntegro; separar solo
  una rama causaría duplicación o pérdida visual en un breakpoint.

**Operativos**

- La máquina de navegación optimista es **timing-sensitive** con historial de flakes de CI (intent
  one-shot, buffer de dos commits admin). Unificar los dos controllers en un hook debe ser
  **comportamiento-idéntico** y quedar cubierto por los E2E existentes antes de mover.
- Centralizar el catálogo toca imports en 8+ archivos: hacerlo primero como **re-export puro** (config
  re-exporta; los antiguos literales quedan como alias temporal) evita un *big-bang* y desincronización.
- Frontera server/client: las rutas son server components (fetch, `cookies`); los controllers son
  client. Al mover, preservar `"use client"` y no arrastrar imports server-only al bundle cliente.
- `next-env.d.ts`: si algún PR corre `pnpm build`, restaurar el archivo si queda reescrito (ver nota de
  memoria del proyecto). No forma parte del cambio.

---

## 10. Plan de PRs chicos (posterior a esta auditoría)

> Cada PR: una causa raíz, alcance acotado, `git diff --check` limpio, sin cambios de comportamiento
> hasta PR-UX-1, rollback lógico posible. TSX-only (excepto tests si aportan regresión).

| PR | Objetivo | Alcance | No-alcance | Éxito |
|----|----------|---------|------------|-------|
| **PR-PRES-2** | Estructura vacía + índices | Crear `features/dashboard/{config,domain,application,presentation/{shell,navigation,layout,surfaces,admin,clinic}}` con barrels/README. **Sin mover archivos.** *(Solo si aporta; puede fusionarse con PR-PRES-3.)* | Ningún import de app tocado | Estructura existe, `typecheck`/`build` verdes |
| **PR-PRES-3** | Extraer shell primitives | Mover shell ya-limpio (`DashboardModuleWorkspace`, `ModuleSurface`, shell router/shell) a `presentation/shell` con re-export de compatibilidad | Sin cambios de markup/CSS | Render idéntico; E2E shell verdes |
| **PR-PRES-4** | Navigation primitives + **catálogo único** | `config/*ModuleCatalog` como fuente única; rail/bottom-nav/sidebar/topbar/quick-links consumen config; extraer `useDashboardModuleNavigation` + `moduleActivationBus` a `application` | Sin cambiar destinos ni URLs | 8+ literales colapsan a 1; navegación byte-idéntica; flakes no reaparecen |
| **PR-PRES-5** | Surface primitives | Estados, `StatsCards`, `StatusBadge`, `FilterBar/Drawer`, `Module{Tabs,Dialog}`, tablas → `presentation/surfaces` | Sin tocar god-cards por dentro | Reuso disponible; render idéntico |
| **PR-PRES-6** | Wrappers clinic/admin | Controllers → hook `application` + wrapper `presentation/{clinic,admin}`; rutas adelgazan a composición; `domain/systemHealthViewModel` | Sin dividir god-cards ni fetch nuevo | `admin/page.tsx` << 813 LOC; comportamiento idéntico |
| **PR-UX-1** | Rediseño visual premium | Solo **después** de PRES-2..6 | — | Base estable para tocar solo `presentation` + CSS |

**Orden y dependencias:** PRES-2 → PRES-3 → PRES-4 → PRES-5 → PRES-6 → UX-1. PRES-3..5 son
independientes entre sí salvo por la estructura de PRES-2; PRES-6 depende de que el catálogo (PRES-4)
y las surfaces (PRES-5) existan.

---

## 11. Validación (post-cada-PR, no de esta auditoría docs-only)

```powershell
pnpm typecheck
pnpm build
pnpm test
```

Para esta auditoría (docs-only), la validación es de superficie de cambios:

```powershell
git -C C:\PORTAL-VETNEB diff --check
git -C C:\PORTAL-VETNEB status --short --untracked-files=all
```

Criterio: el working tree solo debe mostrar `docs/audit/dashboard-presentation-primitives-architecture-audit.md`.

---

## 12. Conclusión

El rediseño premium (PR-UX-1) no debe iniciarse sobre la disposición TSX actual: sin fuente única del
catálogo de módulos y sin frontera de capas, cada ajuste visual arrastraría los 8+ puntos de duplicación
y la máquina de navegación duplicada. La secuencia PRES-2..6 **espeja en TSX la modularización que el CSS
ya logró en #1289/#1290**, con extracciones behavior-preserving de bajo riesgo, y deja la presentación
lista para que el rediseño toque solo `presentation/` + CSS. **Máxima eficiencia de cambio** = un cambio
de módulo o de estilo toca un archivo, no ocho.
