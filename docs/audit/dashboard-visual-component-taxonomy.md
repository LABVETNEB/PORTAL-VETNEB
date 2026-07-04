# Dashboard Visual Component Taxonomy — VETNEB

## 1. Resumen ejecutivo

Base auditada: `main` limpio, HEAD `79a9490 test(clinic): stabilize module state parity selectors (#1282)`.
El dashboard privado de VETNEB se compone como App Shell de viewport completo sobre `DashboardShellRouter`, `PrivateDashboardShell`, `DashboardTopbar`, `DashboardHorizontalNav`, `dashboard-main` y un stage persistente por superficie.
Clínica usa `/dashboard` como hub/cockpit y `?module=` para los workspaces `operaciones`, `informes`, `logistica`, `perfil` y `tokens`.
Admin usa `/dashboard/admin` como hub con hero operativo, launcher desktop/mobile y `?module=` para diez workspaces administrativos.
La arquitectura visual está gobernada por `frontend/src/app/globals.css`, especialmente `dashboard-single-viewport-app-shell`, `dashboard-no-scroll-cockpit`, `admin-mobile-*`, `dashboard-viewport-zoom-adaptability` y `dashboard-premium-grammar`.
La navegación combina `PublicRouteControl`, URL state, restauración de último módulo, señales de reset/activación y buffers de activación en dos commits para evitar detach visual.
Los componentes visuales principales son Shell, Topbar, Horizontal Nav, Mobile Bottom Nav, Hub/Cockpit, Hero, Module Stage, Workspace, Module Surface, Tabs, Cards, Tables, Filters, Pagers, Modals y Feedback States.
El contrato no-scroll se resuelve con `h-dvh overflow-hidden`, `min-h-0`, stages `overflow-hidden`, paginación adaptativa, paneles bounded y reglas CSS por viewport/altura.
Se detectaron 130 nombres `data-*` en source dashboard, 102 con consumidor E2E/unit directo y el resto como atributos visuales/de estado.
No se modificó código, tests, CSS existente, backend, API, auth, DB, dependencias, lockfiles, workflows, CI ni documentación existente.

## 2. Mapa de superficies

| Superficie | Ruta | Tipo de dashboard | Componentes raíz | Navegación | Home/hub | Workspaces | No-scroll |
|---|---|---|---|---|---|---|---|
| Clínica Hub | `/dashboard` | Clínica privado | `DashboardShellRouter`, `DashboardTopbar`, `dashboard-main`, `ClinicDashboardWorkspaceController`, `ClinicDashboardCockpit` | Topbar, Horizontal Nav, `ClinicMobileBottomNav`, cockpit actions | Sí, `data-clinic-cockpit` | No activo | Sí, stage bounded y cockpit content-hugging |
| Clínica Operaciones | `/dashboard?module=operaciones` | Clínica módulo in-shell | `ClinicDashboardWorkspaceController`, `DashboardModuleWorkspace`, `ClinicMobileModuleFrame`, `ClinicCommandCenter` | Back button, Horizontal Nav, Bottom Nav | No | Centro operativo | Sí, `data-dashboard-module-stage` + `data-dashboard-module-viewport` |
| Clínica Informes Summary | `/dashboard?module=informes` | Clínica módulo in-shell | `ClinicInformesWorkspaceSummary`, `FilterBar`, list/table/mobile rows, detail dialog | Back button, CTA full route | No | Informes resumidos | Sí, listas medidas y paginación |
| Clínica Logística Summary | `/dashboard?module=logistica` | Clínica módulo in-shell | `ClinicLogisticaWorkspaceSummary`, logistics list, detail dialog | Back button, CTA full route | No | Logística resumida | Sí, panel list/detail bounded |
| Clínica Perfil | `/dashboard?module=perfil` | Clínica módulo in-shell | `ClinicPublicProfileCard`, `PasswordChangePanel` dentro de tabs de perfil | Back button, tabs internos | No | Perfil público | Sí, module frame mobile |
| Clínica Tokens | `/dashboard?module=tokens` | Clínica módulo in-shell | `ClinicParticularTokensCard`, token primitives, detail dialog | Back button, filters, pager | No | Tokens particulares | Sí, tabla/lista mobile + paginación |
| Informes Full Route | `/dashboard/informes` | Clínica full route legacy/extendida | `DashboardTopbar`, `DashboardPageHeader`, `FilterBar`, `InformesReportsList` | URL filters, table row selection, pager | No | Master-detail informes | Sí, layout master/detail bounded |
| Logística Hub Full Route | `/dashboard/logistica` | Clínica full route extendida | `DashboardTopbar`, `DashboardPageHeader`, `LogisticsCommandCenter` | Route links a visitas/rutas/métricas | No | Hub logístico | Sí, surface cards y list rows |
| Logística Visitas | `/dashboard/logistica/visitas` | Clínica full route extendida | `DashboardTopbar`, metric cards, table, pagination controls | Pager URL `offset/limit` | No | Visitas de campo | Parcial controlado por paginación y `dashboard-main` |
| Logística Rutas | `/dashboard/logistica/rutas` | Clínica full route extendida | `DashboardTopbar`, metric cards, table, pagination controls | Pager URL `offset/limit` | No | Planes de ruta | Parcial controlado por paginación y `dashboard-main` |
| Logística Métricas | `/dashboard/logistica/metricas` | Clínica full route extendida | `DashboardTopbar`, metric cards, route metrics table | Pager URL `offset/limit` | No | Métricas logísticas | Parcial controlado por paginación y `dashboard-main` |
| Admin Hub | `/dashboard/admin` | Admin privado | `DashboardShellRouter`, `DashboardTopbar`, `dashboard-main`, `AdminDashboardWorkspaceController`, `DashboardModuleHub`, `DashboardHubHero` | Horizontal Nav, `AdminMobileBottomNav`, hub tiles, mobile launcher | Sí | No activo | Sí, dense launcher y mobile pager |
| Admin Administración | `/dashboard/admin?module=admin` | Admin módulo in-shell | `AdminCommandCenter`, `AdminMobileCommandModule`, `ModuleTabs` | Back button, tabs, bottom nav | No | Resumen y alertas | Sí, tabbed workspace bounded |
| Admin Clínicas | `/dashboard/admin?module=admin-clinics` | Admin módulo in-shell | `AdminClinicsManagementCard`, `ClinicEditDrawer` | Filters/search, mobile cards, pager, drawer | No | Gestión clínicas | Sí, table/mobile list adaptive |
| Admin Informes | `/dashboard/admin?module=admin-report-upload` | Admin módulo in-shell | `AdminReportsCard`, `ModuleDialog`, `ReportFileActions` | Filters, upload dialog, mobile list, pager | No | Workflow informes | Sí, bounded table/list |
| Admin Tokens | `/dashboard/admin?module=admin-particular-tokens` | Admin módulo in-shell | `AdminParticularTokensCard`, token primitives, detail dialog | Filters, create flow, mobile list, pager | No | Tokens particulares | Sí, mobile toolbar/pager contract |
| Admin Precios | `/dashboard/admin?module=admin-pricing` | Admin módulo in-shell | `AdminPricingEditorCard`, `AdminMobilePricingModule`, `ModuleTabs`, `CompactPager` | Category tabs, compact pager, save controls | No | Editor precios | Sí, tab/pager split |
| Admin Sesiones | `/dashboard/admin?module=admin-sessions` | Admin módulo in-shell | `AdminSessionsReadOnlyCard`, `PasswordChangePanel` dialog | Pager, revoke action, password dialog | No | Sesiones clínicas | Sí, dedicated card owns viewport |
| Admin Usuarios/Roles | `/dashboard/admin?module=admin-users-roles` | Admin módulo in-shell | `AdminUsersRolesReadOnlyCard` | Filters, update action, pager | No | Usuarios y roles | Sí, dense table/mobile module |
| Admin Auditoría | `/dashboard/admin?module=audit-log` | Admin módulo in-shell | `AdminAuditCard`, `AdminAuditDenseTable`, `AdminAuditFilterBar`, `AdminAuditDetailDialog` | Filters, detail dialog, pager | No | Audit log | Sí, dense table page size |
| Admin Estado | `/dashboard/admin?module=admin-health` | Admin módulo in-shell | `AdminSchemaHealthStatusCard`, `AdminMobileHealthModule`, `ModuleTabs` | Tabs | No | Estado sistema/esquema | Sí, status module CSS |
| Admin Mantenimiento | `/dashboard/admin?module=admin-maintenance` | Admin módulo in-shell | `AdminMaintenanceDryRunCard`, `AdminMobileMaintenanceModule`, `ModuleTabs` | Tabs, compact pager | No | Dry-run mantenimiento | Sí, config module CSS |

## 3. Taxonomía global por capas

| Capa | Nombre técnico | Componente visual | Archivo(s) | Descripción ingeniería | Riesgo si se modifica |
|---|---|---|---|---|---|
| Shell / Layout Architecture | Application Shell | Single-Viewport App Shell | `frontend/src/components/dashboard/DashboardShellRouter.tsx`, `frontend/src/app/globals.css` | Raíz `h-dvh overflow-hidden` con `data-vetneb-app-shell`, surface admin/clinic y frame interno. | Rompe no-scroll global, mobile bottom nav o detección visual por E2E. |
| Shell / Layout Architecture | Shell Router | Surface Router | `DashboardShellRouter.tsx` | Resuelve superficie con `useSelectedLayoutSegment` y monta bottom nav admin/clinic. | Montaría navegación incorrecta o perdería `data-vetneb-app-shell-surface`. |
| Shell / Layout Architecture | Private Dashboard Shell | Private Wrapper | `PrivateDashboardShell.tsx`, `frontend/src/app/dashboard/layout.tsx` | Encapsula todas las rutas privadas dashboard. | Rutas privadas quedarían fuera del contrato shell. |
| Shell / Layout Architecture | Viewport Frame | App Shell Frame | `DashboardShellRouter.tsx` | Contenedor `data-vetneb-app-shell-frame` con `min-w-0 flex-1 overflow-hidden`. | El contenido puede crecer fuera del viewport. |
| Shell / Layout Architecture | Dashboard Main | Main Work Area | `frontend/src/app/dashboard/page.tsx`, `admin/page.tsx`, full routes, `globals.css` | `main.dashboard-main` aloja hub/workspaces y aplica surface visual premium. | Scroll global, recortes o pérdida de padding/shape compartido. |
| Shell / Layout Architecture | Dashboard Sidebar Frame | Desktop Sidebar Surface | `DashboardSidebarFrame.tsx` | Frame sidebar con `data-dashboard-sidebar-polish` y nav links. | Degrada desktop legacy/expanded labels. |
| Shell / Layout Architecture | Sidebar | Role Sidebar | `DashboardSidebar.tsx`, `AdminDashboardSidebar.tsx`, `ClinicDashboardSidebar.tsx` | Sidebars por rol para navegación desktop heredada. | Pérdida de rutas, aria-current o estructura visual. |
| Shell / Layout Architecture | Topbar | Private App Bar | `DashboardTopbar.tsx` | Header sticky-ish/bounded con título, subtítulo, theme, notifications, logout/kebab. | Rompe app bar admin mobile, acciones desktop o no-scroll height. |
| Shell / Layout Architecture | Page Header | Context Header | `DashboardPageHeader.tsx` | Encabezado contextual de hub o full route, ocultable en módulos para recuperar alto. | Duplicación de títulos o pérdida de jerarquía. |
| Shell / Layout Architecture | Horizontal Nav | Desktop Primary Navigation | `DashboardHorizontalNav.tsx` | Nav `md:block` con `aria-current`, scrollIntoView activo y `?module=`. | Deep links y paridad desktop/mobile se desalinean. |
| Shell / Layout Architecture | Mobile Bottom Nav | Mobile Primary Navigation | `AdminMobileBottomNav.tsx`, `ClinicMobileBottomNav.tsx` | Nav persistente mobile con señales de activación/reset y `aria-current`. | Contratos mobile no-scroll/nav fallan. |
| Shell / Layout Architecture | BFCache Guard | Private Cache Guard | `BackForwardCacheGuard.tsx` | Controla retorno desde BFCache en superficies privadas. | Riesgo de vista privada cacheada post logout. |
| Shell / Layout Architecture | Logout Control | Auth Exit Control | `DashboardLogoutControl.tsx` | Control de logout con limpieza de último módulo. | Riesgo auth/cache y persistencia de módulo obsoleta. |
| Shell / Layout Architecture | Notifications Bell | Notifications Overlay/Panel | `DashboardNotificationsBell.tsx` | Panel desktop/mobile de notificaciones, con variante mobile no-scroll admin. | Overlays fuera de viewport o pérdida de hooks E2E. |
| Navigation / Routing / State | Workspace Controller | Module State Orchestrator | `ClinicDashboardWorkspaceController.tsx`, `AdminDashboardWorkspaceController.tsx` | Gobierna `activeModule`, URL sync, last-module, hub/module swap. | Race visual, stale module, deep link roto. |
| Navigation / Routing / State | URL State Synchronizer | `?module=` Synchronizer | Controllers + `DashboardHorizontalNav.tsx` | Sincroniza `searchParams.get("module")` con estado local. | URL y stage mostrarían módulos distintos. |
| Navigation / Routing / State | Module Activation Controller | Optimistic Module Activator | Controllers, mobile navs, hub tiles | Activa módulo por tile, CTA, nav o signal. | Click detach, latencia de stage, módulo incorrecto. |
| Navigation / Routing / State | Pending Activation Buffer | Two-Commit Activation Buffer | Controllers | `pendingActivation` evita desmontar tile durante click. | Flakes Playwright y detach DOM en hub. |
| Navigation / Routing / State | Navigation Intent Guard | Stale Router Commit Guard | Controllers | `pendingNavigationIntent` descarta commits URL obsoletos. | Back/forward o navegación rápida puede mostrar stage stale. |
| Navigation / Routing / State | Last Module Persistence | Last Module Storage | `@/lib/dashboard-last-module`, controllers, bottom nav/logout | Lee/escribe `ADMIN_LAST_MODULE_STORAGE_KEY` y `CLINIC_LAST_MODULE_STORAGE_KEY`. | Hub no restaura o restaura módulos no deseados. |
| Navigation / Routing / State | Hub Reset Signal | Hub Reset Pub/Sub | `@/lib/admin-hub-reset`, `@/lib/clinic-hub-reset`, bottom navs | Fuerza vuelta al hub aunque URL push colapse. | Inicio mobile puede dejar módulo montado. |
| Navigation / Routing / State | Bottom Nav Signal | Synchronous Bottom Nav Activation | `AdminMobileBottomNav.tsx`, `ClinicMobileBottomNav.tsx` | Publica target para swap inmediato. | Lag visual y módulo anterior renderizado. |
| Navigation / Routing / State | Back To Hub Handler | Workspace Back Control | `DashboardModuleWorkspace.tsx`, controllers | Botón `Vista general` y `router.replace` a ruta base. | No hay salida clara de workspace. |
| Navigation / Routing / State | Public Route Control usage | Safe Route Link/Button | `DashboardModuleHub.tsx`, `DashboardHorizontalNav.tsx`, navs, full routes | Usa wrapper de navegación para rutas públicas/privadas dentro del shell. | Pérdida de prefetch/aria/route consistency. |
| Navigation / Routing / State | Deep Link Handler | Initial Module Parser | `page.tsx`, `admin/page.tsx`, controllers | Valida módulos desde `searchParams` y alias admin. | Deep links pueden abrir hub equivocado o módulo inválido. |
| Navigation / Routing / State | Back/Forward Handler | Popstate/URL Reconciliation | Controllers, bottom navs | `popstate`, `searchParams` y URL sync. | Botón atrás/adelante rompe `aria-current` y stage. |
| Hub / Cockpit / Launcher | Dashboard Module Hub | Admin Desktop Hub Launcher | `DashboardModuleHub.tsx`, `AdminDashboardWorkspaceController.tsx` | Hub genérico con hero slot, dense launcher y module cards. | Rompe `data-dashboard-module-hub/card`, accesibilidad de cards y layout dense. |
| Hub / Cockpit / Launcher | Dashboard Cockpit | Clinic Operational Cockpit | `ClinicDashboardWorkspaceController.tsx` | Cockpit clínico específico con status band, KPI chips, module tiles y signal rail. | Pierde jerarquía operacional y hooks `data-clinic-cockpit-*`. |
| Hub / Cockpit / Launcher | Hero Slot | Hub Hero Slot | `DashboardModuleHub.tsx` | `data-dashboard-hub-hero-slot` fuera del section de cards. | E2E de aria-label cards se contamina con CTA del hero. |
| Hub / Cockpit / Launcher | Hero Panel | Admin Hub Hero | `DashboardHubHero.tsx` | Panel con status, métricas y CTA primaria. | Desbalance desktop admin y pérdida de `data-dashboard-hub-hero`. |
| Hub / Cockpit / Launcher | Status Band | Clinic Status Header | `ClinicDashboardWorkspaceController.tsx` | `dashboard-hub-band` con estado operativo. | Estado operativo pierde peso visual. |
| Hub / Cockpit / Launcher | Status Dot | State Indicator Dot | `ClinicDashboardWorkspaceController.tsx`, `globals.css` | `.dashboard-status-dot[data-tone]`. | Estado ok/warn deja de ser legible. |
| Hub / Cockpit / Launcher | KPI Chip | Operational KPI Chip | `ClinicDashboardWorkspaceController.tsx`, `globals.css` | `.dashboard-kpi-chip` con icon/label/value. | Métricas no caben o pierden contraste. |
| Hub / Cockpit / Launcher | Signal Rail | Operational Signal Rail | `ClinicDashboardWorkspaceController.tsx` | `.clinic-hub-signals` agrupa attention/continuity/activity. | Señales quedan dispersas o empujan scroll. |
| Hub / Cockpit / Launcher | Signal Card | Operational Signal Card | `ClinicDashboardWorkspaceController.tsx` | `.clinic-hub-signal[data-tone]`. | Señales pierden semántica y acento. |
| Hub / Cockpit / Launcher | Module Grid | Hub Module Grid | `DashboardModuleHub.tsx`, `ClinicDashboardWorkspaceController.tsx` | Grid desktop/admin y clinic tile grid. | Desborde vertical o cards sin densidad. |
| Hub / Cockpit / Launcher | Module Tile | Interactive Navigation Card | `DashboardModuleHub.tsx`, `AdminMobileLauncherTile.tsx`, clinic cockpit buttons | Elemento clickeable con icon, title, description/action. | Navegación visual y E2E `data-dashboard-module-card` fallan. |
| Hub / Cockpit / Launcher | Module Tile Icon | Module Accent Icon Slot | `DashboardModuleHub.tsx`, `AdminMobileLauncherTile.tsx`, `globals.css` | Icon slot con acentos por módulo. | Identidad visual por módulo se pierde. |
| Hub / Cockpit / Launcher | Module Tile Chevron | Navigation Affordance Icon | `DashboardModuleHub.tsx`, `ClinicDashboardWorkspaceController.tsx` | Chevron indica acción en tiles. | Se reduce affordance de apertura. |
| Hub / Cockpit / Launcher | Module Count Badge | Module Count Indicator | `DashboardModuleHub.tsx`, `ClinicDashboardWorkspaceController.tsx` | Badge textual de cantidad de módulos. | Pérdida de densidad informativa. |
| Hub / Cockpit / Launcher | Primary Actions Strip | Clinic Primary Actions Strip | `ClinicDashboardWorkspaceController.tsx` | `data-clinic-cockpit-primary-actions` con botones de apertura. | Atajos operativos del cockpit desaparecen. |
| Hub / Cockpit / Launcher | Action Button | Dashboard CTA Button | `DashboardHubHero.tsx`, `clinic-hub-action`, buttons shared | CTA primaria/secundaria con focus ring. | Click targets o foco visible se degradan. |
| Hub / Cockpit / Launcher | Admin Mobile Hub Launcher | Paged Mobile Launcher | `AdminMobileHubLauncher.tsx` | Launcher mobile admin de 6 cards por página. | Admin mobile hub no cabe en viewport. |
| Hub / Cockpit / Launcher | Admin Mobile Hub Pager | Hub Pager Control | `AdminMobileHubPager.tsx` | Pager con dots/status/live region. | No se acceden módulos 7-10 en mobile. |
| Hub / Cockpit / Launcher | Admin Mobile Launcher Tile | Mobile Launcher Navigation Tile | `AdminMobileLauncherTile.tsx` | Tile mobile con icono y label. | `data-admin-mobile-hub-tile` y tap target fallan. |
| Hub / Cockpit / Launcher | Admin Mobile Module Menu | Secondary Module Menu | `AdminMobileModuleMenu.tsx` | Menú "Más" paginado con 5 módulos por página. | Módulos secundarios no son accesibles en mobile. |
| Hub / Cockpit / Launcher | Admin Mobile Kebab Menu | App Bar Overflow Menu | `AdminMobileKebabMenu.tsx` | Acciones de apariencia, notificaciones, password, sitio público, logout. | Acciones admin mobile quedan ocultas o fuera de safe area. |
| Workspace / Module Containers | Dashboard Module Workspace | Workspace Frame | `DashboardModuleWorkspace.tsx` | Section `data-dashboard-module-workspace` con header y viewport. | Tests de workspace y no-scroll fallan. |
| Workspace / Module Containers | Dashboard Module Stage | Persistent Stage | Controllers, `globals.css` | `data-dashboard-module-stage` estable; admin usa aislamiento visual mobile. | Ghosting/stale layers o module bleed-through. |
| Workspace / Module Containers | Module Surface | Bounded Module Surface | `ModuleSurface.tsx` | Surface con header/toolbar/body. | Toolbars y body pueden crecer fuera del viewport. |
| Workspace / Module Containers | Module Dialog | Modal/Dialog Surface | `ModuleDialog.tsx`, `AdminAuditDetailDialog.tsx`, `ClinicEditDrawer.tsx` | Dialogs con overlay, focus y bounded content. | Focus trap o modal overflow se rompe. |
| Workspace / Module Containers | Module Tabs | Tabbed Module Container | `ModuleTabs.tsx`, admin page, `ClinicPublicProfileCard.tsx`, pricing/maintenance | ARIA tabs con panel activo. | Tab keyboard/selected state y no-scroll pueden fallar. |
| Workspace / Module Containers | Module Header | Workspace Header | `DashboardModuleWorkspace.tsx`, CSS `.dashboard-workspace-header` | Header de módulo con back button y título. | Altura móvil aumenta y reduce viewport útil. |
| Workspace / Module Containers | Module Body | Module Body Region | `ModuleSurface.tsx`, CSS `.dashboard-module-body` | Región flexible `min-h-0` para contenido. | Content overflow o recorte. |
| Workspace / Module Containers | Scroll Boundary | Bounded Scroll/Pagination Boundary | `dashboard-main`, `dashboard-module-viewport`, tables/lists | Limita scroll interno a zonas declaradas o evita scroll via pager. | Overflow horizontal/vertical. |
| Workspace / Module Containers | Responsive Workspace Frame | Responsive Module Frame | `ClinicMobileModuleFrame.tsx`, admin mobile modules, CSS `admin-mobile-*` | Wrapper mobile con data module y density rules. | Mobile module no cabe o mezcla capas. |
| Data Display Components | Stats Cards | KPI/Metric Cards | `StatsCards.tsx`, logistica pages, admin/clinic command centers | Cards métricas y count summaries. | Métricas pierden consistencia. |
| Data Display Components | Status Badge | Workflow Status Badge | `StatusBadge.tsx`, `AdminReportStatusBadge.tsx` | Badge de estado con `data-status` o stage labels. | Estados no distinguibles. |
| Data Display Components | Study Timeline | Report Timeline | `StudyTimeline.tsx` | Timeline con `data-timeline-status`. | Flujo de informe deja de ser verificable. |
| Data Display Components | Report Workflow Viewer Card | Admin Workflow Viewer Card | `AdminReportWorkflowViewerCard.tsx` | Tabla de seguimiento informes. | Workflow admin pierde lectura de estado. |
| Data Display Components | Clinic Public Profile Card | Profile Editor Card | `ClinicPublicProfileCard.tsx` | Editor de perfil público con tabs/toolbar/footer. | Perfil mobile y tabs de password pueden romperse. |
| Data Display Components | Clinic Particular Tokens Card | Clinic Tokens Workspace | `ClinicParticularTokensCard.tsx` | Lista/table/mobile/detail/pager para tokens de clínica. | Contratos clinic tokens y masked master-detail fallan. |
| Data Display Components | Particular Tokens Card Primitives | Shared Tokens Panels | `ParticularTokensCardPrimitives.tsx` | Primitivas de panel/header/body/footer/mobile list/metrics/empty. | Admin/clinic tokens divergen. |
| Data Display Components | Password Change Panel | Password Form Panel | `PasswordChangePanel.tsx` | Panel de cambio de contraseña admin/clinic. | Accesibilidad y auth UI pueden degradarse. |
| Data Display Components | Report Download Button | Report File Actions | `ReportDownloadButton.tsx` | Botones Ver/Descargar informe. | Acciones de archivo pierden estado disabled/loading. |
| Data Display Components | Data Table | Dashboard Data Table | Admin cards, informes/logistica pages | Tablas bounded con header/pagination. | Overflow horizontal o rows invisibles. |
| Data Display Components | Table Row | Data Table Row | Admin cards, informes/logistica pages | Row seleccionable o informativa. | Selección/detalle pierde focus/estado. |
| Data Display Components | Mobile Row Variant | Mobile List Row/Card | Admin/clinic summary/token/report components | Variante mobile `data-*-mobile-row/item/card`. | Mobile no-scroll y legibilidad fallan. |
| Data Display Components | Detail Card | Master Detail Panel/Dialog | `InformesReportsList`, `ClinicInformesWorkspaceSummary`, tokens/logistics summaries | Panel de detalle inline o dialog. | Master-detail pierde selected/empty state. |
| Data Display Components | Summary Card | Operational Summary Card | command centers, health/config modules | Cards de resumen con `surface-soft`, `dashboard-surface`. | Lectura operativa y contraste se degradan. |
| Filtering / Pagination / Actions | Filter Bar | Search/Filter Form Row | `FilterBar.tsx`, admin/clinic reports/tokens/audit | Form de filtros con density data attr. | Labels/focus/filtros y tests unit fallan. |
| Filtering / Pagination / Actions | Sticky Filter Bar | Sticky Filter Summary | `StickyFilterBar.tsx` | Barra sticky con chips activos. | Filtros activos no quedan visibles. |
| Filtering / Pagination / Actions | Filter Drawer | Filter Drawer Overlay | `FilterDrawer.tsx` | Drawer con backdrop y focus trap. | Mobile filters y focus trap fallan. |
| Filtering / Pagination / Actions | Sticky Action Bar | Sticky Action Footer | `StickyActionBar.tsx` | Barra de acciones fija dentro del módulo. | CTAs críticas pueden quedar fuera del viewport. |
| Filtering / Pagination / Actions | Compact Pager | Compact Pagination Control | `CompactPager.tsx`, pricing/maintenance | Pager compacto reutilizable. | Datasets paginados se recortan. |
| Filtering / Pagination / Actions | Refresh Button | Data Refresh Control | `DashboardRefreshButton.tsx` | Botón refresh con router refresh/loading. | Feedback de recarga desaparece. |
| Filtering / Pagination / Actions | Upload Report Modal | Report Upload Dialog | `UploadReportModal.tsx`, `AdminReportsUploadPanel.tsx` | Modal de carga con búsqueda clínica/token/file. | Carga de informes pierde focus/validación/overlay. |
| Filtering / Pagination / Actions | Primary CTA | Main Action Button | Hub hero, command centers, forms | Acción principal por módulo/surface. | Flujo principal menos visible. |
| Filtering / Pagination / Actions | Secondary CTA | Secondary Action Button | Report/profile/token/forms | Acción complementaria. | Usuarios pierden rutas alternativas. |
| Filtering / Pagination / Actions | Destructive Action | Destructive Control | `ClinicEditDrawer.tsx`, sessions revoke, delete/reset controls | Acción crítica con alert/error state. | Riesgo de acción crítica sin visibilidad. |
| Filtering / Pagination / Actions | Inline Action | Row-level Action | Tables/lists/cards | Botón inline por fila/list item. | Acciones contextuales se vuelven ambiguas. |
| State Feedback Components | Loading State | Loading Feedback | `LoadingState.tsx`, admin cards | Spinner/loading text. | Estados async parecen congelados. |
| State Feedback Components | Empty State | Empty Feedback | `EmptyState.tsx`, token/report/logistics panels | Empty surface con título/descripción. | Filtros sin resultados parecen error. |
| State Feedback Components | Error State | Error Feedback | `ErrorState.tsx`, `AdminAccessErrorState.tsx` | Error card/alert con retry cuando aplica. | Errores pierden trazabilidad y accesibilidad. |
| State Feedback Components | Alert Banner | Alert Surface | `clinical-alert-*`, admin/clinic cards | Warning/error/success/info banners. | Alertas críticas pierden contraste o role. |
| State Feedback Components | Skeleton/Spinner | Loading Primitive | `LoadingState.tsx`, `clinical-skeleton`, `Loader2` usages | Spinner/skeleton cuando existe. | Layout shift o falta de feedback. |
| State Feedback Components | Disabled State | Disabled Control State | CSS `.dashboard-disabled-state`, disabled buttons/pagers | Señala acciones no disponibles. | Usuarios ejecutan o esperan acciones imposibles. |
| State Feedback Components | Retry Control | Retry Action | `DashboardRefreshButton`, error cards, token/report panels | Reintento visible por error/loading. | No hay recuperación sin reload manual. |
| State Feedback Components | Toast/Notification | Dashboard Notifications | `DashboardNotificationsBell.tsx` | Notificaciones dentro del dashboard. | Panel notification pierde visibilidad/overlay. |
| Responsive / No-scroll / Visual System | Dashboard Premium Grammar | Premium Visual Grammar | `globals.css`, `docs/implementation/global-dashboard-premium-system.md` | Tokens/accentos/clamps/tiles/signals/hub grammar. | Cambios visuales inconsistentes entre admin/clinic. |
| Responsive / No-scroll / Visual System | Accent Tokens | Module Accent Tokens | `globals.css` | `--dash-accent-*` y selectors por `data-dashboard-module-card`. | Identidad por módulo se vuelve plana. |
| Responsive / No-scroll / Visual System | Responsive Breakpoint Rules | Viewport Rules | `globals.css` | Media queries por width/height, `svh/svw`, clamp tokens. | Overflow en 360/390/768/1366. |
| Responsive / No-scroll / Visual System | Safe-area Handling | Mobile Safe Area Rules | `globals.css`, bottom nav/topbar | Usa `env(safe-area-inset-*)` en admin mobile. | App bar/bottom nav colisiona con browser chrome. |
| Responsive / No-scroll / Visual System | Overflow Boundary | Overflow Contract | `dashboard-main`, `dashboard-module-stage`, list bodies | `overflow-hidden`/bounded regions. | Scroll externo o contenido oculto no intencional. |
| Responsive / No-scroll / Visual System | No-scroll Contract | Single Viewport Contract | `globals.css`, E2E no-scroll specs | Shell y modules caben en viewport con paginación/densidad. | Falla contract no-scroll global. |
| Responsive / No-scroll / Visual System | Mobile Density Rules | Admin/Clinic Mobile Density | `globals.css` `admin-mobile-*`, `clinic-hub-*` | Variables clamp y reducción de headers. | Mobile no cabe o pierde touch targets. |
| Responsive / No-scroll / Visual System | Tablet Composition Rules | Tablet Layout | `globals.css` | Composición intermedia y hidden/visible responsive. | Tablet hereda desktop o mobile incorrecto. |
| Responsive / No-scroll / Visual System | Desktop Composition Rules | Desktop Layout | `globals.css`, hub/workspace components | Dense grids, horizontal nav, workspace headers. | Desktop pierde jerarquía o crea scroll. |
| Responsive / No-scroll / Visual System | Reduced Motion Guard | Motion Accessibility Guard | `globals.css` `prefers-reduced-motion` | Reduce transform/animation en interactions/workspace. | Usuarios con reduced motion reciben animación. |
| Responsive / No-scroll / Visual System | Focus Ring Contract | Keyboard Focus Styling | `globals.css`, components | `focus-visible:ring-*` y `.dashboard-focus-trap-container`. | Keyboard navigation queda invisible. |
| Responsive / No-scroll / Visual System | Touch Target Contract | Touch Minimum Rules | `globals.css`, mobile nav/menu buttons | Min-height y touch-action manipulation. | Tap targets chicos o imprecisos. |
| Responsive / No-scroll / Visual System | Truncation / Line Clamp Contract | Text Fit Contract | components + CSS line-clamp/truncate | `truncate`, `line-clamp-*`, bounded labels. | Texto invade layout o desplaza controls. |
| E2E / Contract Hooks | Data Attributes | Stable Test Selectors | Source dashboard + `frontend/e2e` + `test` | 130 attrs source, 102 con tests directos. | Selectores E2E/unit fallan o pierden cobertura. |
| E2E / Contract Hooks | Tests that consume hooks | E2E/Unit Contracts | `frontend/e2e/*dashboard*`, `*clinic*`, `*admin*`, `test/*dashboard*` | Validan shell, nav, no-scroll, parity, mobile modules, tokens, reports. | Regressions visuales no detectadas o falsos negativos. |
| E2E / Contract Hooks | Protected Contract | Visual/Interaction Invariant | Specs no-scroll, parity, visual regression | Protege rutas, stage, workspace, table/list, dialogs, bottom nav. | Cualquier cambio puede romper navegación, layout o accesibilidad. |

## 4. Inventario exhaustivo por archivo

| Archivo | Export/component/function | Nombre técnico | Componente visual | Usa CSS | Usa data-* | Usado por | Observaciones |
|---|---|---|---|---|---|---|---|
| `frontend/src/app/dashboard/layout.tsx` | `DashboardLayout` | Private Dashboard Layout | Layout privado | No directo | No | Next route tree `/dashboard/**` | Monta shell privado. |
| `frontend/src/app/dashboard/page.tsx` | `DashboardPage`, `parseClinicModule` | Clinic Dashboard Route Entrypoint | Clínica hub/workspaces | `dashboard-main`, `clinic-hub-page-header` | No directo | `/dashboard`, clinic E2E | Server route con datos iniciales y slots. |
| `frontend/src/app/dashboard/ClinicCommandCenter.tsx` | `ClinicCommandCenter` | Clinic Operations Command Center | Centro operativo clínica | `dashboard-surface`, `dashboard-kpi-pill`, `dashboard-list-row`, `surface-soft` | `data-clinic-command-*`, `data-tone` | Workspace `operaciones` | Módulo operativo con KPIs, atención, actividad y continuidad. |
| `frontend/src/app/dashboard/ClinicInformesWorkspaceSummary.tsx` | `ClinicInformesWorkspaceSummary` | Clinic Reports Summary Workspace | Resumen informes in-shell | `surface-muted`, `clinical-alert-warning` | `data-clinic-report-filter-bar`, `data-clinic-reports-*` | Workspace `informes` | Summary con filtros, table/mobile rows, pager y detail dialog. |
| `frontend/src/app/dashboard/ClinicLogisticaWorkspaceSummary.tsx` | `ClinicLogisticaWorkspaceSummary` | Clinic Logistics Summary Workspace | Resumen logística in-shell | `clinical-alert-warning` | `data-clinic-logistics-*` | Workspace `logistica` | Lista logística y detail dialog. |
| `frontend/src/app/dashboard/informes/page.tsx` | `InformesPage` | Reports Full Route Page | Full route informes | `dashboard-main`, `dashboard-surface` | No directo | `/dashboard/informes` | Filtros server y master-detail list. |
| `frontend/src/app/dashboard/informes/InformesReportsList.tsx` | `InformesReportsList`, timeline builders | Reports Master-Detail Controller | Lista/detalle informes | `dashboard-master-panel`, `dashboard-inline-*`, `dashboard-pagination-*` | `data-detail-state` | Full route informes | Adaptive items per page, selected detail, file actions, timeline. |
| `frontend/src/app/dashboard/informes/informes.actions.ts` | server actions | Reports Actions Boundary | Acción server informes | No visual | No | Informes full route | Archivo de acciones; sin rol visual directo. |
| `frontend/src/app/dashboard/informes/informes.constants.ts` | `INFORMES_FALLBACK_ROWS`, `INFORMES_LIMIT_CAP` | Reports Pagination Constants | Densidad/paginación | No | No | `InformesReportsList`/route | Define límites adaptativos. |
| `frontend/src/app/dashboard/logistica/page.tsx` | `LogisticaPage` | Logistics Full Route Hub | Hub logística full route | `dashboard-main` | No | `/dashboard/logistica` | Superficie extendida con command center logístico. |
| `frontend/src/app/dashboard/logistica/LogisticsCommandCenter.tsx` | `LogisticsCommandCenter` | Logistics Command Center | Centro logístico | `dashboard-surface`, `dashboard-kpi-pill`, `dashboard-list-row` | `data-tone` | `/dashboard/logistica` | KPIs, recientes, empty/error. |
| `frontend/src/app/dashboard/logistica/visitas/page.tsx` | `VisitasPage`, limit helpers | Field Visits Full Route | Tabla visitas | `dashboard-main`, `dashboard-metric-card`, `dashboard-surface`, `clinical-table-state` | No directo | `/dashboard/logistica/visitas` | Metric grid, table, URL pager. |
| `frontend/src/app/dashboard/logistica/rutas/page.tsx` | `RutasPage`, limit helpers | Route Plans Full Route | Tabla planes de ruta | `dashboard-main`, `dashboard-metric-card`, `dashboard-surface`, `clinical-table-state` | No directo | `/dashboard/logistica/rutas` | Metric grid, table, page-full heuristic. |
| `frontend/src/app/dashboard/logistica/metricas/page.tsx` | `MetricasPage`, limit helpers | Logistics Metrics Full Route | Tabla métricas | `dashboard-main`, `dashboard-metric-card`, `dashboard-surface`, `clinical-alert-warning` | No directo | `/dashboard/logistica/metricas` | Métricas SLA/route plans con pager. |
| `frontend/src/app/dashboard/admin/page.tsx` | `AdminPage`, workspace slot builders | Admin Dashboard Route Entrypoint | Admin hub/workspaces | `dashboard-main`, `surface-soft`, `clinical-alert-warning` | No directo | `/dashboard/admin` | Server route con slots de 10 módulos admin. |
| `frontend/src/app/dashboard/admin/AdminDashboardWorkspaceController.tsx` | `AdminDashboardWorkspaceController`, `parseModuleFromUrl` | Admin Workspace Controller | Stage/hub/workspace admin | `dashboard-module-stage` | `data-dashboard-module-stage` | Admin page | URL sync, pending activation, access error, last module. |
| `frontend/src/app/dashboard/admin/AdminCommandCenter.tsx` | `AdminCommandCenter` | Admin Command Center | Resumen admin | `surface-soft`, `dashboard-section-*` | No directo | Workspace `admin` | Métricas y enlaces operativos. |
| `frontend/src/app/dashboard/admin/AdminAccessErrorState.tsx` | `AdminAccessErrorState` | Admin Access Error State | Error card admin | `dashboard-surface` | No | Admin controller | Estado de acceso/permiso dentro de workspace. |
| `frontend/src/app/dashboard/admin/AdminClinicsManagementCard.tsx` | `AdminClinicsManagementCard`, `ClinicEditDrawer`, constants | Admin Clinics Management Workspace | Tabla/lista clínicas + drawer | `dashboard-surface`, `dashboard-table-responsive`, `clinical-alert-*` | `data-admin-clinics-mobile-list`, `data-admin-clinic-mobile-card`, `data-admin-mobile-core-*` | Workspace `admin-clinics` | Gestión server-adaptive con mobile cards. |
| `frontend/src/app/dashboard/admin/ClinicEditDrawer.tsx` | `ClinicEditDrawer` | Clinic Edit Side Drawer | Drawer edición clínica | `clinical-alert-error` | `data-form` | `AdminClinicsManagementCard` | Dialog side sheet con forms y acción crítica. |
| `frontend/src/app/dashboard/admin/AdminReportsCard.tsx` | `AdminReportsCard`, constants | Admin Reports Workflow Workspace | Tabla/lista workflow informes | `dashboard-surface`, `dashboard-table-responsive`, `surface-empty/raised` | `data-admin-report-upload-filter-bar`, `data-admin-reports-*`, `data-admin-mobile-core-*` | Workspace `admin-report-upload` | Filtros, mobile list, pager, file actions. |
| `frontend/src/app/dashboard/admin/AdminReportsUploadPanel.tsx` | `AdminReportsUploadPanel`, constants | Admin Upload Report Panel | Panel carga informe | `field-select`, `surface-raised`, `clinical-alert-error` | No | Admin reports dialogs/panels | Panel alternativo de carga. |
| `frontend/src/app/dashboard/admin/AdminReportStatusBadge.tsx` | `AdminReportStatusBadge`, `ADMIN_REPORT_STAGE_OPTIONS` | Admin Report Stage Badge | Badge workflow | `surface-muted` | No | Admin reports/workflow | Visualiza estados de informe admin. |
| `frontend/src/app/dashboard/admin/AdminParticularTokensCard.tsx` | `AdminParticularTokensCard`, constants | Admin Particular Tokens Workspace | Tokens admin table/mobile | `dashboard-surface`, `dashboard-option-row`, `field-*`, `surface-empty` | `data-admin-filter-bar`, `data-admin-particulars-*`, `data-admin-mobile-core-*` | Workspace `admin-particular-tokens` | Crear/filtrar tokens y detalle. |
| `frontend/src/app/dashboard/admin/AdminPricingEditorCard.tsx` | `AdminPricingEditorCard`, `PricingCategoryItems`, constants | Admin Pricing Editor Workspace | Editor precios | `dashboard-surface`, `field-select`, `surface-muted/raised` | `data-admin-pricing-item-form`, `data-save-all` | Workspace `admin-pricing` | Tabs/categorías, forms y save all. |
| `frontend/src/app/dashboard/admin/AdminSessionsReadOnlyCard.tsx` | `AdminSessionsReadOnlyCard`, `SessionStatusBadge`, `SessionTypeBadge`, constants | Admin Sessions Read-only Workspace | Tabla/lista sesiones | `dashboard-surface`, `dashboard-filter-stats-grid`, `dashboard-table-pagination` | `data-admin-sesiones-*`, `data-admin-mobile-ops-*` | Workspace `admin-sessions` | Sesiones paginadas desktop/mobile. |
| `frontend/src/app/dashboard/admin/AdminUsersRolesReadOnlyCard.tsx` | `AdminUsersRolesReadOnlyCard`, `AdminRoleBadge`, `AdminUserTypeBadge`, constants | Admin Users/Roles Workspace | Tabla/lista usuarios y roles | `dashboard-surface`, `dashboard-fitted-table`, `field-select` | `data-admin-mobile-ops-*` | Workspace `admin-users-roles` | Roles, filtros y actualizaciones. |
| `frontend/src/app/dashboard/admin/AdminAuditCard.tsx` | `AdminAuditCard`, constants | Admin Audit Workspace Card | Audit log container | `dashboard-surface`, no-scroll contract comments | No directo | Workspace `audit-log` | Encapsula filtros, tabla densa y pager. |
| `frontend/src/app/dashboard/admin/AdminAuditDenseTable.tsx` | `AdminAuditDenseTable` | Admin Audit Dense Table | Tabla densa audit | `dashboard-fitted-table` | No | `AdminAuditCard` | Dense table optimizada para alto volumen. |
| `frontend/src/app/dashboard/admin/AdminAuditFilterBar.tsx` | `AdminAuditFilterBar`, `FilterForm` | Admin Audit Filter Bar | Filtros auditoría | Shared filter classes | No | `AdminAuditCard` | Filtro por tipo/actor/rango. |
| `frontend/src/app/dashboard/admin/AdminAuditDetailDialog.tsx` | `AdminAuditDetailDialog` | Admin Audit Detail Dialog | Dialog detalle audit | `ModuleDialog` | No | `AdminAuditCard` | Detalle de evento audit. |
| `frontend/src/app/dashboard/admin/admin-audit-shared.ts` | `EVENT_LABELS`, `ACTOR_LABELS`, `SENSITIVE_AUDIT_METADATA_KEY_PARTS` | Audit Presentation Metadata | Labels audit | No | No | Audit components | Primitiva de labels/sanitización visual. |
| `frontend/src/app/dashboard/admin/admin-audit.actions.ts` | server actions | Audit Actions Boundary | Acciones audit | No | No | Audit workspace | Sin rol visual directo. |
| `frontend/src/app/dashboard/admin/AdminSchemaHealthStatusCard.tsx` | `AdminSchemaHealthStatusCard` | Admin Schema Health Card | Health/status card | `dashboard-surface`, `surface-soft/empty`, `clinical-alert-*` | No | Workspaces `admin-health`, `admin-maintenance` | Estado de esquema. |
| `frontend/src/app/dashboard/admin/AdminMaintenanceDryRunCard.tsx` | `AdminMaintenanceDryRunCard`, `MaintenanceCandidateRow`, constants | Admin Maintenance Dry-run Card | Mantenimiento/dry-run | `dashboard-surface`, `clinical-muted-band`, `clinical-pill`, `surface-*` | `data-admin-maintenance-candidates-list` | Workspace `admin-maintenance` | Lista candidatos y resultados. |
| `frontend/src/app/dashboard/admin/AdminFailedLoginAlertsReadOnlyCard.tsx` | `AdminFailedLoginAlertsReadOnlyCard`, constants | Admin Failed Login Alerts Card | Alertas login fallido | `dashboard-surface`, `dashboard-filter-stats-grid`, `dashboard-table-*` | `data-admin-mobile-status-item` | Admin status/command modules | Estado de seguridad read-only. |
| `frontend/src/app/dashboard/admin/AdminOverviewQuickLinks.tsx` | `AdminOverviewQuickLinks` | Admin Quick Links | Link panel | `dashboard-nav-interactive`, `surface-soft` | No | Admin command center | Accesos internos admin. |
| `frontend/src/app/dashboard/admin/AdminSectionTabs.tsx` | `AdminSectionTabs` | Admin Section Tabs | Tabs custom admin | Tailwind inline | No | Admin sections | Tabs de secciones renderizables. |
| `frontend/src/app/dashboard/admin/AdminMobileCommandModule.tsx` | `AdminMobileCommandModule`, `MetricTile` | Admin Mobile Command Module | Resumen admin mobile | `surface-soft`, `admin-mobile-status-item` | `data-admin-mobile-status-item` | Workspace `admin` mobile | Resumen mobile sin tabs desktop. |
| `frontend/src/app/dashboard/admin/AdminMobileHealthModule.tsx` | `AdminMobileHealthModule`, `AdminMobileSchemaSection`, `SchemaMetric` | Admin Mobile Health Module | Estado sistema mobile | `admin-mobile-status-item` | `data-admin-mobile-status-item` | Workspace `admin-health` mobile | Paneles compactos. |
| `frontend/src/app/dashboard/admin/AdminMobileStatusModule.tsx` | `AdminMobileStatusModule` | Admin Mobile Status Module | Status tabs mobile | `admin-mobile-status-*`, `dashboard-surface` | `data-admin-mobile-status-*`, `data-active` | Status modules | Tabs/paneles status. |
| `frontend/src/app/dashboard/admin/AdminMobilePricingModule.tsx` | `AdminMobilePricingModule`, `CATALOG_PAGE_SIZE` | Admin Mobile Pricing Module | Precios mobile | `admin-mobile-config-item`, `field-select`, `surface-muted` | `data-admin-mobile-config-item` | Workspace `admin-pricing` mobile | Catálogo paginado mobile. |
| `frontend/src/app/dashboard/admin/AdminMobileMaintenanceModule.tsx` | `AdminMobileMaintenanceModule`, `MaintenanceDryRunSection`, `MaintenanceMetric`, `MaintenanceSchemaSection`, constants | Admin Mobile Maintenance Module | Mantenimiento mobile | `admin-mobile-config-item` | `data-admin-mobile-config-item` | Workspace `admin-maintenance` mobile | Dry-run/schema compactos. |
| `frontend/src/app/dashboard/admin/AdminMobileConfigModule.tsx` | `AdminMobileConfigModule` | Admin Mobile Config Module | Config tabs/panels mobile | `admin-mobile-config-*`, `dashboard-surface` | `data-admin-mobile-config-*`, `data-active` | Config modules | Base visual para precios/mantenimiento. |
| `frontend/src/app/dashboard/admin/AdminMobileAuditModule.tsx` | `AdminMobileAuditModule` | Admin Mobile Audit Module | Audit mobile list | `admin-mobile-ops-*`, `dashboard-surface` | `data-admin-mobile-ops-*` | Workspace `audit-log` mobile | Audit compacto. |
| `frontend/src/app/dashboard/admin/AdminMobileOpsPager.tsx` | `AdminMobileOpsPager` | Admin Mobile Ops Pager | Pager mobile ops | `admin-mobile-ops-pager` | `data-admin-mobile-ops-pager` | Mobile ops modules | Pager compartido admin mobile. |
| `frontend/src/components/dashboard/DashboardShellRouter.tsx` | `DashboardShellRouter` | Application Shell Router | Shell/frame/bottom nav | `dashboard-app-shell` | `data-vetneb-app-shell*` | `PrivateDashboardShell` | Selecciona surface admin/clinic. |
| `frontend/src/components/dashboard/PrivateDashboardShell.tsx` | `PrivateDashboardShell` | Private Shell Wrapper | Wrapper shell | No | No | dashboard layout | Delegación a shell router. |
| `frontend/src/components/dashboard/BackForwardCacheGuard.tsx` | `BackForwardCacheGuard` | BFCache Guard | Guard invisible | No | No | Shell router | Control de cache privada. |
| `frontend/src/components/dashboard/DashboardTopbar.tsx` | `DashboardTopbar`, `AdminMobileContextTitle`, `DashboardTopbarNotifications` | Dashboard Topbar | App bar privada | `dashboard-topbar-*`, `admin-mobile-*` | `data-dashboard-topbar-polish`, `data-admin-mobile-*`, `data-dashboard-desktop-actions` | Todas las rutas dashboard | Título, acciones, notifications, admin mobile app bar. |
| `frontend/src/components/dashboard/DashboardHorizontalNav.tsx` | `DashboardHorizontalNav`, `DashboardHorizontalNavInner` | Horizontal Navigation | Nav desktop | `dashboard-horizontal-nav*`, `dashboard-nav-interactive` | `data-dashboard-horizontal-nav*` | Topbar/shell desktop | Rutas canónicas `?module=`. |
| `frontend/src/components/dashboard/DashboardPageHeader.tsx` | `DashboardPageHeader` | Page Header | Header contextual | Tailwind inline | No | Hub/full routes | Título, descripción, actions. |
| `frontend/src/components/dashboard/DashboardSidebarFrame.tsx` | `DashboardSidebarFrame`, `DashboardSidebarNav` | Dashboard Sidebar Frame | Sidebar desktop | `dashboard-sidebar-polish`, `dashboard-nav-interactive` | `data-dashboard-sidebar-polish` | Sidebars | Frame nav legacy/polish. |
| `frontend/src/components/dashboard/DashboardSidebar.tsx` | `DashboardSidebar` | Dashboard Sidebar | Sidebar genérico | No directo | No | Role sidebars | Primitiva sidebar. |
| `frontend/src/components/dashboard/AdminDashboardSidebar.tsx` | `AdminDashboardSidebar` | Admin Sidebar | Sidebar admin | No directo | No | Admin desktop legacy | Nav admin desktop. |
| `frontend/src/components/dashboard/ClinicDashboardSidebar.tsx` | `ClinicDashboardSidebar` | Clinic Sidebar | Sidebar clínica | No directo | No | Clinic desktop legacy | Nav clínica desktop. |
| `frontend/src/components/dashboard/DashboardModuleHub.tsx` | `DashboardModuleHub` | Module Hub Launcher | Hub hero+grid/cards | `dashboard-cockpit*`, `admin-mobile-hub-*`, `dashboard-card-interactive` | `data-dashboard-hub-*`, `data-dashboard-module-card/hub` | Admin controller | Generic hub; admin dense launcher. |
| `frontend/src/components/dashboard/DashboardHubHero.tsx` | `DashboardHubHero` | Dashboard Hub Hero | Hero panel | `dashboard-hub-hero*`, `dashboard-btn-interactive` | `data-dashboard-hub-hero` | Admin hub | Status, metrics, CTA. |
| `frontend/src/components/dashboard/DashboardModuleWorkspace.tsx` | `DashboardModuleWorkspace` | Module Workspace Frame | Workspace header/viewport | `dashboard-workspace-*`, `dashboard-module-*` | `data-dashboard-module-workspace`, `data-dashboard-module-back-button`, `data-dashboard-module-viewport` | Admin/clinic controllers | Common workspace wrapper. |
| `frontend/src/components/dashboard/ClinicDashboardWorkspaceController.tsx` | `ClinicDashboardWorkspaceController`, `ClinicDashboardCockpit`, helpers | Clinic Workspace Controller/Cockpit | Clinic cockpit/stage/workspaces | `clinic-hub-*`, `dashboard-kpi-chip`, `dashboard-module-stage` | `data-clinic-cockpit*`, `data-clinic-dashboard-stage`, `data-dashboard-module-stage/hub`, `data-tone` | Clinic page | Full clinic state/nav/cockpit contract. |
| `frontend/src/components/dashboard/AdminMobileBottomNav.tsx` | `AdminMobileBottomNav` | Admin Mobile Bottom Navigation | Bottom nav admin | `admin-mobile-bottom-nav*` | `data-admin-mobile-bottom-nav*` | Shell router admin | Home/fixed modules/more menu. |
| `frontend/src/components/dashboard/ClinicMobileBottomNav.tsx` | `ClinicMobileBottomNav` | Clinic Mobile Bottom Navigation | Bottom nav clinic | `clinic-mobile-bottom-nav*` | `data-clinic-mobile-bottom-nav*` | Shell router clinic | Inicio + 5 module destinations. |
| `frontend/src/components/dashboard/ClinicMobileModuleFrame.tsx` | `ClinicMobileModuleFrame` | Clinic Mobile Module Frame | Mobile module wrapper | No direct class | `data-clinic-mobile-module` | Clinic slots | Identifica módulo mobile. |
| `frontend/src/components/dashboard/AdminMobileHubLauncher.tsx` | `AdminMobileHubLauncher` | Admin Mobile Hub Launcher | Paged launcher mobile | `admin-mobile-hub-launcher*` | `data-admin-mobile-hub-launcher` | `DashboardModuleHub` dense admin | 6 tiles per page. |
| `frontend/src/components/dashboard/AdminMobileHubPager.tsx` | `AdminMobileHubPager` | Admin Mobile Hub Pager | Pager mobile hub | `admin-mobile-hub-pager*` | `data-admin-mobile-hub-pager` | Admin mobile hub launcher | Dots/status/buttons. |
| `frontend/src/components/dashboard/AdminMobileLauncherTile.tsx` | `AdminMobileLauncherTile` | Admin Mobile Launcher Tile | Mobile tile | `admin-mobile-hub-tile*` | `data-admin-mobile-hub-tile` | Admin mobile hub launcher | Tile with icon/label. |
| `frontend/src/components/dashboard/AdminMobileModuleMenu.tsx` | `AdminMobileModuleMenu` | Admin Mobile Module Menu | More menu | `admin-mobile-module-*`, `admin-mobile-page-*` | `data-admin-mobile-module-menu`, `data-admin-mobile-module-link` | Admin bottom nav | Secondary modules. |
| `frontend/src/components/dashboard/AdminMobileKebabMenu.tsx` | `AdminMobileKebabMenu` | Admin Mobile Overflow Menu | Kebab menu | `admin-mobile-kebab-*` | `data-admin-mobile-kebab-menu` | Topbar admin mobile | Theme, notifications, password, public route, logout. |
| `frontend/src/components/dashboard/DashboardNotificationsBell.tsx` | `DashboardNotificationsBell`, constants | Notifications Bell/Panel | Notifications popover/overlay | `dashboard-notifications-*`, `admin-mobile-notifications-panel`, `surface-*` | `data-dashboard-notifications-*`, `data-admin-mobile-notifications-panel` | Topbar/kebab | Desktop panel and mobile overlay. |
| `frontend/src/components/dashboard/DashboardLogoutControl.tsx` | `DashboardLogoutControl` | Logout Control | Logout button/form | `dashboard-last-module` refs | No | Topbar/kebab | Clears module persistence on logout. |
| `frontend/src/components/dashboard/DashboardRefreshButton.tsx` | `DashboardRefreshButton` | Refresh Control | Refresh button | No direct shared class | No | Dashboard cards/routes | Reload/refresh feedback. |
| `frontend/src/components/dashboard/ModuleSurface.tsx` | `ModuleSurface` | Module Surface | Surface wrapper | `dashboard-module-surface/body/toolbar` | `data-dashboard-module-surface`, `data-module-toolbar` | Module internals | Header/toolbar/body bounded surface. |
| `frontend/src/components/dashboard/ModuleTabs.tsx` | `ModuleTabs` | Module Tabs | Tabs/tablist/panel | `dashboard-module-tabs/tablist/tab/tabpanel` | `data-module-tabs`, `data-module-tab`, `data-module-tabpanel` | Admin/clinic/profile/pricing | Accessible tab primitive. |
| `frontend/src/components/dashboard/ModuleDialog.tsx` | `ModuleDialog` | Module Dialog | Modal dialog | `clinical-modal` | `data-module-dialog` | Admin audit/tokens/reports/sessions | Shared dialog surface. |
| `frontend/src/components/dashboard/FilterBar.tsx` | `FilterBar`, `FilterField` | Dashboard Filter Bar | Filter form | `dashboard-filter-bar`, `dashboard-filter-density`, `clinical-shadow-sm` | `data-dashboard-filter-bar`, `data-dashboard-filter-density` | Informes, admin audit/reports/tokens | Dense/comfortable filter primitive. |
| `frontend/src/components/dashboard/FilterDrawer.tsx` | `FilterDrawer`, `FOCUSABLE_SELECTOR` | Filter Drawer | Drawer overlay | `dashboard-filter-panel`, `dashboard-focus-trap-container` | `data-filter-drawer-open`, `data-filter-backdrop` | Filter workflows/tests | Mobile filter overlay/focus trap. |
| `frontend/src/components/dashboard/StickyFilterBar.tsx` | `StickyFilterBar` | Sticky Filter Bar | Sticky active filters | `surface-muted` | `data-sticky-filter-bar` | Filter polish tests | Active filter chips. |
| `frontend/src/components/dashboard/StickyActionBar.tsx` | `StickyActionBar` | Sticky Action Bar | Sticky action row | `dashboard-btn-interactive` | `data-sticky-action-bar` | Forms/actions | Persistent action footer. |
| `frontend/src/components/dashboard/CompactPager.tsx` | `CompactPager` | Compact Pager | Pagination control | `dashboard-compact-pager`, `dashboard-btn-interactive` | `data-dashboard-compact-pager` | Pricing/maintenance | Compact prev/next/status. |
| `frontend/src/components/dashboard/usePagedRows.ts` | `usePagedRows` | Paged Rows Hook | Pagination behavior | No | No | Pricing/maintenance/tables | Keeps datasets reachable via pager. |
| `frontend/src/components/dashboard/LoadingState.tsx` | `LoadingState` | Loading State | Loading feedback | No direct class | No | Admin cards/async surfaces | Spinner/label feedback. |
| `frontend/src/components/dashboard/EmptyState.tsx` | `EmptyState` | Empty State | Empty feedback | `surface-muted` | No | Lists/tables/cards | Empty visual. |
| `frontend/src/components/dashboard/ErrorState.tsx` | `ErrorState` | Error State | Error feedback | No direct shared class | No | Reports/lists | Error visual with icon. |
| `frontend/src/components/dashboard/StatsCards.tsx` | `StatsCards` | Stats Cards | Metrics cards | `dashboard-metric-card`, `clinical-pill`, `surface-muted` | No | Dashboard summary tests | Generic stat card grid. |
| `frontend/src/components/dashboard/StatusBadge.tsx` | `StatusBadge` | Status Badge | Badge status | `surface-muted` | `data-status` | Reports/tables/tests | Normalizes status. |
| `frontend/src/components/dashboard/StudyTimeline.tsx` | `StudyTimeline`, `TIMELINE_STATUS_CONFIG` | Study Timeline | Timeline | `surface-muted` | `data-timeline-status` | Reports detail | Workflow timeline. |
| `frontend/src/components/dashboard/ReportDownloadButton.tsx` | `ReportDownloadButton`, `ReportFileActions` | Report File Actions | View/download buttons | No direct shared class | No | Reports/admin/clinic token/report details | Handles file availability. |
| `frontend/src/components/dashboard/AdminReportWorkflowViewerCard.tsx` | `AdminReportWorkflowViewerCard` | Admin Report Workflow Viewer | Workflow table card | `dashboard-surface`, `dashboard-table-*`, `clinical-table-state` | No | Admin reports workflow | Viewer card for report tracking. |
| `frontend/src/components/dashboard/ClinicPublicProfileCard.tsx` | `ClinicPublicProfileCard`, constants | Clinic Public Profile Card | Profile editor | `clinical-alert-*`, `clinical-muted-band`, `field-*`, `surface-soft` | `data-clinic-profile-*` | Clinic profile workspace | Tabs/fields/avatar/footer/password. |
| `frontend/src/components/dashboard/ClinicParticularTokensCard.tsx` | `ClinicParticularTokensCard`, constants | Clinic Tokens Card | Token table/mobile/detail | `clinical-alert-*`, `clinical-pill`, `field-*`, `surface-muted` | `data-clinic-access-*` | Clinic tokens workspace | Tokens with filters, pager, detail dialog. |
| `frontend/src/components/dashboard/ParticularTokensCardPrimitives.tsx` | `ParticularTokensPanel*`, `ParticularTokensMetricStrip`, `ParticularTokensMobileList`, `ParticularTokensEmptyPanel` | Shared Tokens Visual Primitives | Token panels/list/metrics | `surface-muted` | No | Admin/clinic token cards | Shared low-level token layout primitives. |
| `frontend/src/components/dashboard/PasswordChangePanel.tsx` | `PasswordChangePanel`, constants | Password Change Panel | Password form | `dashboard-surface`, `clinical-alert-*`, `field-label` | No | Clinic profile, admin sessions dialog | Form validation and feedback. |
| `frontend/src/components/dashboard/UploadReportModal.tsx` | `UploadReportModal`, constants, `FOCUSABLE_SELECTOR` | Upload Report Modal | Modal upload workflow | `clinical-modal`, `dashboard-focus-trap-container`, `dashboard-option-row`, `field-*`, `surface-*` | No | Report upload flows | Focus trap, search, file and form states. |

## 5. Inventario visual por componente

| Nombre técnico | Nombre visual | Selector/clase/data-* | Superficie | Responsive | Interacción | Estado | Accesibilidad | Tests |
|---|---|---|---|---|---|---|---|---|
| Application Shell | Single-Viewport App Shell | `data-vetneb-app-shell`, `.dashboard-app-shell` | Admin/Clínica | `h-dvh`, mobile nav, desktop main | Surface routing | Private/no-scroll | `aria-label` shell | `dashboard-app-shell-visibility-contract`, `dashboard-real-app-shell-no-scroll-contract`, admin mobile specs |
| App Shell Frame | Viewport Frame | `data-vetneb-app-shell-frame` | Admin/Clínica | `min-h-0 overflow-hidden` | N/A | Bounds content | Semantic container | `admin-mobile-module-layer-isolation` |
| Dashboard Topbar | Private App Bar | `data-dashboard-topbar-polish`, `data-admin-mobile-app-bar` | Admin/Clínica | Desktop actions, admin mobile appbar | Theme, notifications, logout/kebab | Mobile subtitle | Focusable controls | Admin mobile shell specs, logout specs |
| Horizontal Navigation | Desktop Module Nav | `data-dashboard-horizontal-nav`, `data-dashboard-horizontal-nav-shell` | Admin/Clínica desktop | Hidden mobile, horizontal scroller desktop | `?module=` links | `aria-current` | Navigation landmark | mobile shell nav, parity specs |
| Admin Mobile Bottom Navigation | Admin Bottom Nav | `data-admin-mobile-bottom-nav`, `data-admin-mobile-bottom-nav-item` | Admin mobile | Safe-area bottom, fixed density | Home/fixed modules/more | Active item | `aria-label`, `aria-current`, `aria-expanded` | admin mobile bottom/app shell/final polish |
| Clinic Mobile Bottom Navigation | Clinic Bottom Nav | `data-clinic-mobile-bottom-nav`, `data-clinic-mobile-bottom-nav-item` | Clínica mobile | 6 items compact | Home + five modules | Active item | `aria-label`, `aria-current` | clinic mobile parity specs |
| Admin Mobile Module Menu | More Modules Menu | `data-admin-mobile-module-menu`, `data-admin-mobile-module-link` | Admin mobile | Paged 5 items | Open/close/paged navigation | `aria-expanded` source button | Escape close, labels | admin mobile core/ops/final specs |
| Admin Mobile Kebab Menu | App Bar Overflow Menu | `data-admin-mobile-kebab-menu` | Admin mobile | Overlay panel | Theme/notifications/password/public/logout | Open/closed | `aria-controls`, Escape close | admin mobile app shell/bottom/final specs |
| Dashboard Module Hub | Module Launcher Hub | `data-dashboard-module-hub`, `data-dashboard-module-card` | Admin hub | Dense grid, mobile launcher | Tile navigation | Active by URL | Card `aria-label` | card navigation, hub hero, accessibility |
| Dashboard Hub Hero | Admin Hero Panel | `data-dashboard-hub-hero`, `data-dashboard-hub-hero-slot` | Admin hub | Compact dense desktop/mobile | Primary action | Status tone | CTA focus | `frontend-dashboard-hub-hero.test.ts` |
| Clinic Dashboard Cockpit | Operational Cockpit | `data-clinic-cockpit`, `clinic-cockpit-hub` | Clínica hub | Desktop/tablet/mobile composition | Tile/action navigation | Healthy/degraded | Section aria-label | clinic controller/card nav/hub hero |
| Clinic Status Band | Operational Status Band | `data-clinic-cockpit-status`, `.dashboard-hub-band` | Clínica hub | Compresses with KPI chips | N/A | Status dot ok/warn | Heading/description | clinic controller specs |
| KPI Chip | KPI Chip | `.dashboard-kpi-chip[data-tone]` | Clínica hub | Hidden secondary chips on small screens | N/A | critical/focus/neutral | Group label | hub hero/visual contracts |
| Signal Rail | Signal Rail | `.clinic-hub-signals`, `data-clinic-cockpit-*` | Clínica hub | Rail or stacked signals | N/A | warn/ok/teal/cyan | Aside label | clinic controller specs |
| Module Workspace | Workspace Frame | `data-dashboard-module-workspace`, `data-dashboard-module-viewport` | All modules | Header reclaimed mobile | Back to hub | Active module | Section aria-label | all workspace/no-scroll specs |
| Module Stage | Persistent Module Stage | `data-dashboard-module-stage`, `data-clinic-dashboard-stage` | Admin/Clínica | Stable paint layer | Hub/workspace swap | Active/hub | N/A | stage parity/stale layer specs |
| Module Surface | Bounded Surface | `data-dashboard-module-surface`, `data-module-toolbar` | Shared modules | Toolbar/body bounded | Forms/actions | Loading/empty/error | Header/body structure | no-scroll/workspace polish |
| Module Tabs | Accessible Tabs | `data-module-tabs`, `data-module-tab`, `data-module-tabpanel` | Admin/Profile/Pricing | Scroll-safe tablist | Select tab | Selected tab/panel | ARIA tab roles | runtime/workspace/no-scroll specs |
| Module Dialog | Modal Surface | `data-module-dialog`, `.clinical-modal` | Admin/Clinic detail/upload | Overlay bounded | Open/close/action | Error/success/loading | `aria-modal`, labelledby | masked master-detail, token/layout specs |
| Filter Bar | Filter Form | `data-dashboard-filter-bar`, `data-dashboard-filter-density` | Reports/tokens/audit | Compact/comfortable | Submit/reset inputs | Applied filters | Labels/role search | filter drawer/sticky tests |
| Filter Drawer | Filter Drawer | `data-filter-drawer-open`, `data-filter-backdrop` | Filters mobile | Overlay | Open/close/focus trap | Open/closed | Escape/focus trap | workspace layout tests |
| Sticky Filter Bar | Sticky Filter Summary | `data-sticky-filter-bar` | Filtered workspaces | Sticky inside viewport | Remove/read filters | Active filters | Text labels | filter drawer tests |
| Sticky Action Bar | Sticky Action Footer | `data-sticky-action-bar` | Forms/actions | Sticky bounded | Save/submit/cancel | Disabled/loading | Focus visible | workspace layout tests |
| Compact Pager | Compact Pager | `data-dashboard-compact-pager`, `.dashboard-compact-pager` | Pricing/maintenance | Compact horizontal | Prev/next | Disabled at bounds | Buttons/status | shared component tests |
| Data Table | Dense Table | `.dashboard-table-responsive`, `.dashboard-fitted-table` | Admin/full routes | Desktop table, mobile variant hidden | Row actions | Empty/error/loading | Table semantics | no-scroll, users/tokens/reports specs |
| Mobile Row Variant | Mobile List Item/Card | `data-admin-mobile-core-item`, `data-admin-mobile-ops-item`, `data-clinic-*-mobile-row` | Mobile modules | No-scroll list/cards | Tap/detail/action | Selected/empty | Button/link labels | admin/clinic mobile specs |
| Detail Panel/Dialog | Master Detail | `data-detail-state`, `data-*-detail-dialog` | Reports/tokens/logistics | Inline desktop/dialog mobile | Row selection/open/close | Empty/selected | Region/dialog labels | masked master-detail, reports/tokens specs |
| Status Badge | Status Badge | `data-status`, `AdminReportStatusBadge` | Reports/tables | Inline | N/A | status variants | Text label | private shell foundation |
| Study Timeline | Timeline | `data-timeline-status` | Report detail | Vertical responsive | N/A | completed/current/pending | SR status label | reports master-detail test |
| Report File Actions | File Action Buttons | `ReportFileActions`, `ReportDownloadButton` | Reports/tokens | Inline/wrapped | View/download | Disabled when no file | Button labels | reports workflows |
| Clinic Public Profile Card | Profile Editor | `data-clinic-profile-*` | Clínica perfil | Mobile operable tabs | Save/upload/password | Loading/error/success | Labels/tabs | perfil mobile/runtime evidence |
| Tokens Workspace | Tokens Table/List/Detail | `data-clinic-access-*`, `data-admin-particulars-*` | Clínica/Admin tokens | Desktop table + mobile list | Filter/create/detail/pager | Empty/error/future slots | Labels/dialogs | tokens parity/toolbar/masked specs |
| Admin Clinics Card | Clinics Table/Mobile Cards | `data-admin-clinics-mobile-list`, `data-admin-clinic-mobile-card` | Admin clínicas | Desktop table + mobile cards | Edit drawer/pager | Loading/empty/error/success | Buttons labels | admin clinics mobile layout/drawer |
| Admin Reports Card | Reports Workflow Table/List | `data-admin-reports-*`, `data-admin-mobile-core-*` | Admin informes | Desktop table + mobile list | Upload/detail/file actions | Empty/error/success | Labels/dialogs | admin mobile core/final |
| Admin Sessions Card | Sessions Table/List | `data-admin-sesiones-*`, `data-admin-mobile-ops-*` | Admin sesiones | Dense desktop, mobile ops | Revoke/pager/password dialog | Active/expired | Buttons/table labels | admin ops/mobile/users |
| Admin Users/Roles Card | Users/Roles Table/List | `data-admin-mobile-ops-*` | Admin usuarios | Dense desktop, mobile ops | Update role/pager | Changed/disabled | Labels/buttons | users workspace specs |
| Admin Audit Card | Audit Dense Table | `AdminAuditCard`, `AdminAuditDenseTable` | Admin auditoría | Dense no-scroll table | Filter/detail/pager | Empty/error | Dialog labels | admin mobile ops/final |
| Admin Status/Config Modules | Mobile Status/Config Panels | `data-admin-mobile-status-*`, `data-admin-mobile-config-*` | Admin mobile health/pricing/maintenance | Tabs/panels compact | Tab/button/page | Active panel/chip | Tab roles | admin mobile status/config specs |
| Notifications Panel | Notification Bell Panels | `data-dashboard-notifications-*`, `data-admin-mobile-notifications-panel` | Topbar/kebab | Desktop panel/mobile overlay | Open/poll/page | Empty/error | Dialog/panel labels | notifications bell tests |
| Loading State | Loading Feedback | `LoadingState`, `clinical-skeleton`, `Loader2` | Shared | Fits panel | N/A | Loading | role/text where used | card/unit coverage |
| Empty State | Empty Feedback | `EmptyState`, `.surface-empty` | Shared | Fits panel | N/A | Empty | Heading/description | empty states tests |
| Error State | Error Feedback | `ErrorState`, `AdminAccessErrorState`, `.clinical-alert-error` | Shared/admin | Fits panel | Retry/back where present | Error | `role=alert` where critical | access/error/no-store tests |
| Alert Banner | Alert Banner | `.clinical-alert-*` | Shared | Inline bounded | N/A | warning/error/success/info | `role=alert` where used | visual/UX tests |

## 6. Componentes Clínica

**Shell**

| Nombre técnico | Archivo | Rol |
|---|---|---|
| Clinic Application Shell | `DashboardShellRouter.tsx` | Surface `clinic`, frame privado y bottom nav clinic. |
| Clinic Topbar | `DashboardTopbar.tsx` | Título "Dashboard Clínica", notifications clinic, acciones desktop. |
| Clinic Horizontal Nav | `DashboardHorizontalNav.tsx` | Links canónicos `?module=operaciones/informes/tokens/logistica/perfil`. |
| Clinic Mobile Bottom Nav | `ClinicMobileBottomNav.tsx` | Navegación mobile a Inicio y cinco módulos con reset/activation signals. |
| Clinic Page Header | `DashboardPageHeader.tsx`, `page.tsx` | Header "Resumen operativo" sólo en hub. |

**Cockpit**

| Nombre técnico | Archivo | Rol |
|---|---|---|
| Clinic Dashboard Cockpit | `ClinicDashboardWorkspaceController.tsx` | Hub operacional con status, KPIs, módulos, acciones y señales. |
| Clinic Status Band | `ClinicDashboardWorkspaceController.tsx` | Estado operativo clínica con `dashboard-status-dot`. |
| Clinic KPI Chip Group | `ClinicDashboardWorkspaceController.tsx` | Pendientes, visitas, informes, rutas. |
| Clinic Module Tile Grid | `ClinicDashboardWorkspaceController.tsx` | `data-clinic-cockpit-modules` y tiles por módulo. |
| Clinic Primary Actions Strip | `ClinicDashboardWorkspaceController.tsx` | `data-clinic-cockpit-primary-actions`, CTAs de apertura. |
| Clinic Signal Rail | `ClinicDashboardWorkspaceController.tsx` | Attention, continuity, activity. |

**Módulos**

| Módulo | Archivo raíz | Componentes visuales |
|---|---|---|
| Operaciones | `ClinicCommandCenter.tsx` | KPIs, attention panel, recent activity, continuity list. |
| Informes | `ClinicInformesWorkspaceSummary.tsx` | Advanced filter bar, reports table, mobile list, pager, detail dialog. |
| Logística | `ClinicLogisticaWorkspaceSummary.tsx` | Logistics list panel, rows, detail dialog. |
| Perfil | `ClinicPublicProfileCard.tsx` | Profile fields, toolbar, footer, editor tabs, password panel. |
| Tokens | `ClinicParticularTokensCard.tsx` | Token toolbar, table, mobile list, future slots, pager, detail dialog. |

**Workspaces**

| Nombre técnico | Archivo | Rol |
|---|---|---|
| Clinic Workspace Controller | `ClinicDashboardWorkspaceController.tsx` | URL sync, last module, pending activation, hub reset. |
| Clinic Mobile Module Frame | `ClinicMobileModuleFrame.tsx` | `data-clinic-mobile-module` para módulos mobile. |
| Dashboard Module Workspace | `DashboardModuleWorkspace.tsx` | Header, back button y viewport del módulo. |
| Dashboard Module Stage | `ClinicDashboardWorkspaceController.tsx` | Stage estable `data-dashboard-module-stage`, `data-clinic-dashboard-stage`. |

**Perfil**

| Nombre técnico | Archivo | Rol |
|---|---|---|
| Clinic Public Profile Card | `ClinicPublicProfileCard.tsx` | Editor de datos públicos, avatar, tabs internos, toolbar/footer. |
| Clinic Profile Fields | `ClinicPublicProfileCard.tsx` | `data-clinic-profile-fields`, grupos de campos. |
| Clinic Profile Editor | `ClinicPublicProfileCard.tsx` | `data-clinic-profile-editor`, superficie principal. |
| Password Change Panel | `PasswordChangePanel.tsx` | Cambio de contraseña dentro del perfil. |

**Tokens**

| Nombre técnico | Archivo | Rol |
|---|---|---|
| Clinic Particular Tokens Card | `ClinicParticularTokensCard.tsx` | Gestión de tokens de clínica. |
| Particular Tokens Primitives | `ParticularTokensCardPrimitives.tsx` | Panels, headers, body, footer, metric strip, empty panel. |
| Clinic Access Detail Dialog | `ClinicParticularTokensCard.tsx` | `data-clinic-access-detail-dialog`. |
| Clinic Access Pager | `ClinicParticularTokensCard.tsx` | `data-clinic-access-pagination-*`. |

**Informes**

| Nombre técnico | Archivo | Rol |
|---|---|---|
| Clinic Reports Summary | `ClinicInformesWorkspaceSummary.tsx` | Resumen in-shell. |
| Reports Full Route Page | `informes/page.tsx` | Full route extendida. |
| Reports Master Detail List | `InformesReportsList.tsx` | Master-detail, adaptive page size, selected detail. |
| Report File Actions | `ReportDownloadButton.tsx` | Ver/descargar informe. |
| Study Timeline | `StudyTimeline.tsx` | Timeline de workflow. |

**Logística**

| Nombre técnico | Archivo | Rol |
|---|---|---|
| Clinic Logistics Summary | `ClinicLogisticaWorkspaceSummary.tsx` | Resumen in-shell. |
| Logistics Command Center | `logistica/LogisticsCommandCenter.tsx` | Hub full route. |
| Field Visits Route | `logistica/visitas/page.tsx` | Tabla/pager visitas. |
| Route Plans Route | `logistica/rutas/page.tsx` | Tabla/pager rutas. |
| Route Metrics Route | `logistica/metricas/page.tsx` | Métricas/pager logística. |

**Operaciones**

| Nombre técnico | Archivo | Rol |
|---|---|---|
| Clinic Command Center | `ClinicCommandCenter.tsx` | Centro de operaciones con KPIs y señales. |
| Clinic Command Attention | `ClinicCommandCenter.tsx` | `data-clinic-command-attention`. |
| Clinic Command Activity | `ClinicCommandCenter.tsx` | `data-clinic-command-activity`. |
| Clinic Command Continuity | `ClinicCommandCenter.tsx` | `data-clinic-command-continuity`. |

**Mobile Nav**

| Nombre técnico | Archivo | Rol |
|---|---|---|
| Clinic Mobile Bottom Nav | `ClinicMobileBottomNav.tsx` | Inicio, Ops, Info, Log, Perfil, Tokens. |
| Clinic Hub Reset Signal | `@/lib/clinic-hub-reset`, `ClinicMobileBottomNav.tsx` | Limpia last module y vuelve al hub. |
| Clinic Module Activate Signal | `@/lib/clinic-hub-reset`, `ClinicMobileBottomNav.tsx` | Swap inmediato del workspace. |

**No-scroll**

| Nombre técnico | Archivo | Rol |
|---|---|---|
| Clinic Dashboard Stage | `ClinicDashboardWorkspaceController.tsx` | `overflow-hidden`, `min-h-0`, `dashboard-module-stage`. |
| Clinic Hub Premium Grammar | `globals.css` | `clinic-hub-*`, `dashboard-premium-grammar`, reduced motion. |
| Clinic Mobile Module Contract | `ClinicMobileModuleFrame.tsx`, `globals.css` | Identificación mobile y density rules. |
| Full Route Adaptive Contract | `InformesReportsList.tsx`, logistica pages | Paginación/list boundaries para rutas extendidas. |

## 7. Componentes Admin

**Shell**

| Nombre técnico | Archivo | Rol |
|---|---|---|
| Admin Application Shell | `DashboardShellRouter.tsx` | Surface `admin`, frame privado y bottom nav admin. |
| Admin Topbar | `DashboardTopbar.tsx` | Título "Administración", app bar mobile, actions desktop. |
| Admin Horizontal Nav | `DashboardHorizontalNav.tsx` | Diez módulos canónicos `?module=`. |
| Admin Mobile Bottom Nav | `AdminMobileBottomNav.tsx` | Inicio, Clínicas, Auditoría, Sesiones, Más. |
| Admin Kebab Menu | `AdminMobileKebabMenu.tsx` | Acciones overflow mobile. |

**Hub**

| Nombre técnico | Archivo | Rol |
|---|---|---|
| Admin Workspace Controller | `AdminDashboardWorkspaceController.tsx` | Estado URL, last-module, access error, hub/workspace. |
| Dashboard Module Hub | `DashboardModuleHub.tsx` | Launcher admin desktop con 10 cards. |
| Admin Hub Hero | `DashboardHubHero.tsx` | Estado sistema, métricas audit/event types, CTA. |
| Admin Dense Launcher | `DashboardModuleHub.tsx`, `globals.css` | Grid denso para 10 módulos y no-scroll desktop. |

**Launcher mobile**

| Nombre técnico | Archivo | Rol |
|---|---|---|
| Admin Mobile Hub Launcher | `AdminMobileHubLauncher.tsx` | 6 tiles por página. |
| Admin Mobile Launcher Tile | `AdminMobileLauncherTile.tsx` | Tile tap target con `data-admin-mobile-hub-tile`. |
| Admin Mobile Hub Pager | `AdminMobileHubPager.tsx` | Paginación del launcher. |

**Bottom nav**

| Nombre técnico | Archivo | Rol |
|---|---|---|
| Admin Mobile Bottom Nav | `AdminMobileBottomNav.tsx` | Fixed destinations y menú "Más". |
| Admin Hub Reset Signal | `@/lib/admin-hub-reset`, `AdminMobileBottomNav.tsx` | Fuerza vuelta al hub. |
| Admin Module Activate Signal | `@/lib/admin-hub-reset`, `AdminMobileBottomNav.tsx` | Swap inmediato del workspace. |

**Module menu**

| Nombre técnico | Archivo | Rol |
|---|---|---|
| Admin Mobile Module Menu | `AdminMobileModuleMenu.tsx` | Todos los módulos admin en páginas de 5. |
| Admin Mobile Module Link | `AdminMobileModuleMenu.tsx` | `data-admin-mobile-module-link` por destino. |
| Admin Mobile Page Button/Dot | `AdminMobileModuleMenu.tsx` | Paginación del menú. |

**Tiles**

| Nombre técnico | Archivo | Rol |
|---|---|---|
| Admin Module Tile | `DashboardModuleHub.tsx` | `data-dashboard-module-card="admin-*"` desktop. |
| Admin Module Tile Icon | `DashboardModuleHub.tsx`, `globals.css` | Acentos por módulo. |
| Admin Mobile Hub Tile | `AdminMobileLauncherTile.tsx` | Tile mobile de launcher. |
| Admin Hero CTA | `DashboardHubHero.tsx` | Activación de módulo `admin`. |

**Workspaces**

| Módulo | Archivo raíz | Componentes visuales |
|---|---|---|
| Administración | `AdminCommandCenter.tsx`, `AdminMobileCommandModule.tsx` | Resumen, alertas, metric tiles, tabs desktop. |
| Clínicas | `AdminClinicsManagementCard.tsx`, `ClinicEditDrawer.tsx` | Tabla/lista mobile, edit drawer, actions. |
| Informes/workflow | `AdminReportsCard.tsx`, `AdminReportsUploadPanel.tsx` | Filtros, workflow table/list, upload/file actions. |
| Tokens | `AdminParticularTokensCard.tsx` | Token table/list/detail/create flow. |
| Precios | `AdminPricingEditorCard.tsx`, `AdminMobilePricingModule.tsx` | Category tabs, compact pager, save all. |
| Sesiones | `AdminSessionsReadOnlyCard.tsx` | Sessions table/list, password dialog. |
| Usuarios/Roles | `AdminUsersRolesReadOnlyCard.tsx` | Dense table/list, role controls. |
| Auditoría | `AdminAuditCard.tsx`, `AdminAuditDenseTable.tsx`, `AdminAuditFilterBar.tsx`, `AdminAuditDetailDialog.tsx` | Audit filters, dense table, detail dialog. |
| Estado | `AdminSchemaHealthStatusCard.tsx`, `AdminMobileHealthModule.tsx`, `AdminMobileStatusModule.tsx` | Service/schema status panels. |
| Mantenimiento | `AdminMaintenanceDryRunCard.tsx`, `AdminMobileMaintenanceModule.tsx`, `AdminMobileConfigModule.tsx` | Dry-run, schema, config panels. |

**Tokens**

| Nombre técnico | Archivo | Rol |
|---|---|---|
| Admin Particular Tokens Card | `AdminParticularTokensCard.tsx` | Admin token workflow. |
| Admin Particulars Toolbar | `AdminParticularTokensCard.tsx` | `data-admin-particulars-toolbar`. |
| Admin Particulars Mobile List | `AdminParticularTokensCard.tsx` | `data-admin-particulars-mobile-list`. |
| Admin Mobile Core Pager | `AdminParticularTokensCard.tsx` | `data-admin-mobile-core-pager`. |

**Informes/workflow**

| Nombre técnico | Archivo | Rol |
|---|---|---|
| Admin Reports Card | `AdminReportsCard.tsx` | Workflow table/mobile list. |
| Admin Reports Toolbar | `AdminReportsCard.tsx` | `data-admin-reports-toolbar`. |
| Admin Reports Mobile List | `AdminReportsCard.tsx` | `data-admin-reports-mobile-list`. |
| Admin Report Workflow Viewer Card | `AdminReportWorkflowViewerCard.tsx` | Viewer table de seguimiento. |
| Upload Report Modal/Panel | `UploadReportModal.tsx`, `AdminReportsUploadPanel.tsx` | Carga de informes. |

**Auditoría**

| Nombre técnico | Archivo | Rol |
|---|---|---|
| Admin Audit Card | `AdminAuditCard.tsx` | Container audit workspace. |
| Admin Audit Dense Table | `AdminAuditDenseTable.tsx` | Tabla densa audit. |
| Admin Audit Filter Bar | `AdminAuditFilterBar.tsx` | Filtros audit. |
| Admin Audit Detail Dialog | `AdminAuditDetailDialog.tsx` | Detalle evento audit. |
| Admin Mobile Audit Module | `AdminMobileAuditModule.tsx` | Audit mobile ops. |

**Alertas**

| Nombre técnico | Archivo | Rol |
|---|---|---|
| Admin Failed Login Alerts Card | `AdminFailedLoginAlertsReadOnlyCard.tsx` | Alertas de login fallido. |
| Admin Access Error State | `AdminAccessErrorState.tsx` | Errores de acceso admin. |
| Clinical Alert Surfaces | `globals.css` | Warning/error/success/info banners. |

**Sesiones**

| Nombre técnico | Archivo | Rol |
|---|---|---|
| Admin Sessions Read-only Card | `AdminSessionsReadOnlyCard.tsx` | Tabla/lista sesiones. |
| Session Status Badge | `AdminSessionsReadOnlyCard.tsx` | Badge estado sesión. |
| Session Type Badge | `AdminSessionsReadOnlyCard.tsx` | Badge tipo sesión. |
| Password Change Dialog | `admin/page.tsx`, `PasswordChangePanel.tsx`, `ModuleDialog.tsx` | Cambio contraseña desde sesiones. |

**Mobile no-scroll**

| Nombre técnico | Archivo | Rol |
|---|---|---|
| Admin Mobile App Shell | `globals.css` `admin-mobile-app-shell` | Variables clamp, safe area, appbar/bottom nav heights. |
| Admin Mobile Stage Layer | `globals.css`, `AdminDashboardWorkspaceController.tsx` | Aislamiento de capas en stage persistente. |
| Admin Mobile Core Modules | `AdminClinicsManagementCard.tsx`, `AdminReportsCard.tsx`, `AdminParticularTokensCard.tsx` | `data-admin-mobile-core-*` para clínicas/informes/tokens. |
| Admin Mobile Ops Modules | `AdminMobileAuditModule.tsx`, `AdminSessionsReadOnlyCard.tsx`, `AdminUsersRolesReadOnlyCard.tsx` | `data-admin-mobile-ops-*`. |
| Admin Mobile Status Modules | `AdminMobileStatusModule.tsx`, health/failed login cards | `data-admin-mobile-status-*`. |
| Admin Mobile Config Modules | `AdminMobileConfigModule.tsx`, pricing/maintenance modules | `data-admin-mobile-config-*`. |

## 8. Primitivas visuales compartidas

| Primitiva | Selector/componente | Archivo | Rol visual |
|---|---|---|---|
| Tokens CSS | `--card`, `--sidebar-*`, `--vetneb-*`, `--dash-accent-*`, `--admin-mobile-*` | `frontend/src/app/globals.css` | Base cromática, surfaces, acentos por módulo, density mobile. |
| Chips | `.dashboard-kpi-chip`, `.clinical-pill`, badges | `globals.css`, `ClinicDashboardWorkspaceController.tsx`, admin cards | Indicadores compactos de estado/métrica. |
| Badges | `StatusBadge`, `AdminReportStatusBadge`, `Badge` UI | Dashboard components/admin cards | Estado workflow, rol, tipo, status. |
| Cards | `.dashboard-surface`, `.dashboard-metric-card`, `.surface-soft`, `.surface-muted`, `.surface-raised` | `globals.css`, cards/dashboard pages | Superficies elevadas de operación. |
| Buttons | `.dashboard-btn-interactive`, `.dashboard-nav-interactive`, `.dashboard-card-interactive`, `.dashboard-pagination-btn` | `globals.css`, hub/nav/pagers | Feedback hover/active/focus y touch behavior. |
| Surfaces | `ModuleSurface`, `DashboardModuleWorkspace`, `dashboard-main` | components + CSS | Contenedores bounded. |
| Wrappers | `DashboardShellRouter`, `PrivateDashboardShell`, `ClinicMobileModuleFrame` | components | Encapsulación de viewport/superficie/módulo. |
| Icon slots | `.dashboard-cockpit-tile-icon`, `.clinic-hub-tile-icon`, `.admin-mobile-hub-tile-icon`, `.dashboard-kpi-chip-icon` | CSS + hub/cockpit | Jerarquía por icono/acento. |
| Rails | `.dashboard-cockpit-rail`, `.clinic-hub-signals` | `globals.css`, controllers | Columna/pista de hero o señales. |
| Panels | `.dashboard-master-panel`, `.dashboard-detail-panel`, `.dashboard-filter-panel`, `.clinical-modal` | `globals.css`, modules | Master-detail, filter drawer, dialog. |
| Grid systems | `.dashboard-cockpit-grid`, `.clinic-hub-tile-grid`, `.admin-mobile-hub-launcher-grid`, `.dashboard-filter-stats-grid` | `globals.css`, hub/admin mobile | Layout denso por viewport. |
| Table systems | `.dashboard-table-responsive`, `.dashboard-fitted-table`, `.dashboard-table-pagination` | `globals.css`, admin/full route tables | Tablas bounded y paginación consistente. |
| Form systems | `.field-label`, `.field-select`, `.field-textarea`, `.dashboard-option-row` | `globals.css`, forms/modals/cards | Inputs/selects/options consistentes. |
| Feedback systems | `EmptyState`, `ErrorState`, `LoadingState`, `.clinical-alert-*`, `.clinical-skeleton` | components + CSS | Estados vacíos, error, loading y alertas. |
| Accessibility systems | `.dashboard-focus-trap-container`, focus-visible rings, `prefers-reduced-motion` | CSS + dialogs/drawers | Foco visible, focus trap, reduced motion. |

## 9. Contratos `data-*`

| data attribute | Componente | Archivo | Test consumidor | Contrato protegido |
|---|---|---|---|---|
| `data-vetneb-app-shell` | Application Shell | `DashboardShellRouter.tsx` | `dashboard-app-shell-visibility-contract`, admin mobile specs, `frontend-dashboard-shell.test.ts` | Shell privado presente y surface detectable. |
| `data-vetneb-app-shell-frame` | Viewport Frame | `DashboardShellRouter.tsx` | `admin-mobile-module-layer-isolation.spec.ts` | Frame estable de viewport. |
| `data-vetneb-app-shell-release` | Application Shell Release | `DashboardShellRouter.tsx` | `dashboard-app-shell-visibility-contract.spec.ts` | Versión/contrato app shell visible. |
| `data-vetneb-app-shell-surface` | Surface discriminator | `DashboardShellRouter.tsx` | `dashboard-app-shell-visibility-contract`, admin mobile helpers, shell tests | Diferencia admin/clinic. |
| `data-dashboard-topbar-polish` | Topbar | `DashboardTopbar.tsx` | `admin-mobile-module-layer-isolation.spec.ts` | Topbar pulida dentro del shell. |
| `data-admin-mobile-app-bar` | Admin Mobile App Bar | `DashboardTopbar.tsx` | admin mobile no-scroll specs | App bar admin mobile bounded. |
| `data-admin-mobile-topbar-subtitle` | Admin Mobile Subtitle | `DashboardTopbar.tsx` | Sin consumidor directo detectado | Densidad/subtitle mobile. |
| `data-dashboard-desktop-actions` | Desktop Actions | `DashboardTopbar.tsx` | `dashboard-logout-private-cache.spec.ts` | Acciones desktop privadas. |
| `data-dashboard-horizontal-nav` | Horizontal Nav | `DashboardHorizontalNav.tsx` | mobile shell/nav specs | Navegación desktop por surface. |
| `data-dashboard-horizontal-nav-shell` | Horizontal Nav Shell | `DashboardHorizontalNav.tsx` | mobile shell/nav specs | Landmark nav y shell nav desktop. |
| `data-dashboard-sidebar-polish` | Sidebar Frame | `DashboardSidebarFrame.tsx` | Sin consumidor directo detectado | Sidebar desktop visual polish. |
| `data-dashboard-hub-root` | Hub Root | `DashboardModuleHub.tsx` | `dashboard-internal-no-scroll-contract`, `dashboard-mobile-shell-nav-contract`, admin layer isolation | Root de hub bounded. |
| `data-dashboard-hub-hero-slot` | Hero Slot | `DashboardModuleHub.tsx` | `frontend-dashboard-hub-hero.test.ts` | Hero fuera del section de cards. |
| `data-dashboard-hub-hero` | Hub Hero | `DashboardHubHero.tsx` | `frontend-dashboard-hub-hero.test.ts` | Hero renderizado y variante. |
| `data-dashboard-module-hub` | Module Hub/Cockpit | `DashboardModuleHub.tsx`, `ClinicDashboardWorkspaceController.tsx` | accessibility, card nav, no-scroll, visual regression, hub tests | Hub visible y listo. |
| `data-dashboard-module-card` | Module Tile | `DashboardModuleHub.tsx` | `admin-clinic-edit-drawer`, accessibility, hub hero, interaction tests | Card de módulo navegable. |
| `data-dashboard-module-stage` | Module Stage | controllers | stage parity/stale layer/workspace tests | Stage persistente activo. |
| `data-dashboard-module-workspace` | Module Workspace | `DashboardModuleWorkspace.tsx` | Amplio set admin/clinic/no-scroll/workspace specs | Workspace activo por module id. |
| `data-dashboard-module-back-button` | Back Button | `DashboardModuleWorkspace.tsx` | Sin consumidor directo detectado | Vuelta al hub desde módulo. |
| `data-dashboard-module-viewport` | Module Viewport | `DashboardModuleWorkspace.tsx` | `dashboard-real-app-shell-no-scroll-contract.spec.ts` | Región viewport interna del módulo. |
| `data-dashboard-module-surface` | Module Surface | `ModuleSurface.tsx` | `dashboard-real-app-shell-no-scroll-contract`, `dashboard-workspace-layout-polish` | Surface bounded del módulo. |
| `data-module-toolbar` | Module Toolbar | `ModuleSurface.tsx` | Sin consumidor directo detectado | Toolbar fija del módulo. |
| `data-module-tabs` | Module Tabs | `ModuleTabs.tsx` | no-scroll/runtime/workspace specs | Tab system presente. |
| `data-module-tab` | Module Tab | `ModuleTabs.tsx` | no-scroll/runtime/workspace specs | Tab seleccionable. |
| `data-module-tabpanel` | Module Tab Panel | `ModuleTabs.tsx` | runtime evidence spec | Panel activo. |
| `data-module-dialog` | Module Dialog | `ModuleDialog.tsx` | admin tokens toolbar, masked master-detail | Dialog de módulo abierto. |
| `data-dashboard-filter-bar` | Filter Bar | `FilterBar.tsx` | `frontend-dashboard-filter-drawer-sticky-filters.test.ts` | Barra de filtros presente. |
| `data-dashboard-filter-density` | Filter Density | `FilterBar.tsx` | `frontend-dashboard-filter-drawer-sticky-filters.test.ts` | Densidad compact/comfortable. |
| `data-filter-drawer-open` | Filter Drawer | `FilterDrawer.tsx` | `frontend-dashboard-workspace-layout-polish.test.ts` | Drawer abierto. |
| `data-filter-backdrop` | Filter Drawer Backdrop | `FilterDrawer.tsx` | Sin consumidor directo detectado | Backdrop de filtro. |
| `data-sticky-filter-bar` | Sticky Filter Bar | `StickyFilterBar.tsx` | filter drawer tests | Barra sticky. |
| `data-sticky-action-bar` | Sticky Action Bar | `StickyActionBar.tsx` | workspace layout tests | Barra sticky de acciones. |
| `data-dashboard-compact-pager` | Compact Pager | `CompactPager.tsx` | Sin consumidor directo detectado | Pager compacto. |
| `data-status` | Status Badge | `StatusBadge.tsx` | `frontend-dashboard-private-shell-foundation.test.ts` | Estado normalizado. |
| `data-timeline-status` | Study Timeline | `StudyTimeline.tsx` | `frontend-dashboard-reports-master-detail.test.ts` | Estado de paso timeline. |
| `data-detail-state` | Detail Panel | `InformesReportsList.tsx` | reports/logistics/tokens/masked/workspace tests | Empty/selected detail state. |
| `data-dashboard-notifications-desktop-panel` | Notifications Desktop Panel | `DashboardNotificationsBell.tsx` | accessibility keyboard, notifications bell test | Panel desktop abierto. |
| `data-dashboard-notifications-mobile-overlay` | Notifications Mobile Overlay | `DashboardNotificationsBell.tsx` | notifications bell test | Overlay mobile. |
| `data-dashboard-notifications-mobile-panel` | Notifications Mobile Panel | `DashboardNotificationsBell.tsx` | notifications bell test | Panel mobile. |
| `data-admin-mobile-notifications-panel` | Admin Mobile Notifications Panel | `DashboardNotificationsBell.tsx` | admin mobile bottom/final specs | Notificaciones admin mobile dentro de no-scroll. |
| `data-clinic-cockpit` | Clinic Cockpit | `ClinicDashboardWorkspaceController.tsx` | clinic controller/card nav/mobile stage/hub hero tests | Hub clínico operativo. |
| `data-clinic-cockpit-status` | Clinic Status Band | `ClinicDashboardWorkspaceController.tsx` | clinic controller/card nav/hub hero tests | Banda de estado. |
| `data-clinic-cockpit-modules` | Clinic Module Grid | `ClinicDashboardWorkspaceController.tsx` | clinic controller/card nav/hub hero tests | Launcher módulos clínica. |
| `data-clinic-cockpit-module-card` | Clinic Module Tile | `ClinicDashboardWorkspaceController.tsx` | `dashboard-card-navigation-shell.spec.ts` | Tile clínico navegable. |
| `data-clinic-cockpit-primary-actions` | Clinic Primary Actions | `ClinicDashboardWorkspaceController.tsx` | clinic controller/card nav/hub hero tests | Acciones principales. |
| `data-clinic-cockpit-attention` | Clinic Attention Signal | `ClinicDashboardWorkspaceController.tsx` | clinic controller/card nav/hub hero tests | Señal atención requerida. |
| `data-clinic-cockpit-continuity` | Clinic Continuity Signal | `ClinicDashboardWorkspaceController.tsx` | clinic controller/card nav/hub hero tests | Señal continuidad logística. |
| `data-clinic-cockpit-activity` | Clinic Activity Signal | `ClinicDashboardWorkspaceController.tsx` | clinic controller/card nav/hub hero tests | Señal actividad reciente. |
| `data-clinic-dashboard-stage` | Clinic Stage | `ClinicDashboardWorkspaceController.tsx` | clinic controller/mobile nav stage/hub hero tests | Stage clínica activo. |
| `data-clinic-mobile-bottom-nav` | Clinic Bottom Nav | `ClinicMobileBottomNav.tsx` | clinic mobile parity/nav specs | Nav mobile clínica presente. |
| `data-clinic-mobile-bottom-nav-item` | Clinic Bottom Nav Item | `ClinicMobileBottomNav.tsx` | clinic mobile parity specs | Ítems nav mobile clínica. |
| `data-clinic-mobile-module` | Clinic Mobile Module Frame | `ClinicMobileModuleFrame.tsx` | Sin consumidor directo detectado | Identidad módulo mobile. |
| `data-clinic-command-center` | Clinic Command Center | `ClinicCommandCenter.tsx` | clinic controller/module state parity | Operaciones renderizado. |
| `data-clinic-command-attention` | Clinic Command Attention | `ClinicCommandCenter.tsx` | clinic controller parity | Panel atención operaciones. |
| `data-clinic-command-activity` | Clinic Command Activity | `ClinicCommandCenter.tsx` | clinic controller parity | Panel actividad operaciones. |
| `data-clinic-command-continuity` | Clinic Command Continuity | `ClinicCommandCenter.tsx` | clinic controller/module state parity | Panel continuidad operaciones. |
| `data-clinic-report-filter-bar` | Clinic Reports Filter Bar | `ClinicInformesWorkspaceSummary.tsx` | `frontend-dashboard-home.test.ts` | Filtros informes summary. |
| `data-clinic-reports-list-panel` | Clinic Reports List Panel | `ClinicInformesWorkspaceSummary.tsx` | home/mobile parity tests | Panel lista informes. |
| `data-clinic-reports-list-body` | Clinic Reports List Body | `ClinicInformesWorkspaceSummary.tsx` | home tests | Cuerpo medible informes. |
| `data-clinic-reports-table` | Clinic Reports Table | `ClinicInformesWorkspaceSummary.tsx` | clinic informes parity, home test | Tabla informes desktop. |
| `data-clinic-reports-table-row` | Clinic Reports Table Row | `ClinicInformesWorkspaceSummary.tsx` | Sin consumidor directo detectado | Row tabla informes. |
| `data-clinic-reports-mobile-list` | Clinic Reports Mobile List | `ClinicInformesWorkspaceSummary.tsx` | clinic informes parity, home test | Lista mobile informes. |
| `data-clinic-reports-mobile-row` | Clinic Reports Mobile Row | `ClinicInformesWorkspaceSummary.tsx` | clinic reports pagination/mobile parity | Row mobile informes. |
| `data-clinic-reports-pagination-footer` | Clinic Reports Pager Footer | `ClinicInformesWorkspaceSummary.tsx` | Sin consumidor directo detectado | Footer paginación informes. |
| `data-clinic-reports-pagination-controls` | Clinic Reports Pager Controls | `ClinicInformesWorkspaceSummary.tsx` | Sin consumidor directo detectado | Controles paginación informes. |
| `data-clinic-reports-pagination-status` | Clinic Reports Pager Status | `ClinicInformesWorkspaceSummary.tsx` | Sin consumidor directo detectado | Status paginación informes. |
| `data-clinic-reports-detail-dialog` | Clinic Reports Detail Dialog | `ClinicInformesWorkspaceSummary.tsx` | clinic informes parity, home test | Dialog detalle informes. |
| `data-clinic-logistics-list-panel` | Clinic Logistics List Panel | `ClinicLogisticaWorkspaceSummary.tsx` | clinic logistica parity, home test | Panel lista logística. |
| `data-clinic-logistics-list-body` | Clinic Logistics List Body | `ClinicLogisticaWorkspaceSummary.tsx` | clinic logistica parity, home test | Cuerpo medible logística. |
| `data-clinic-logistics-row` | Clinic Logistics Row | `ClinicLogisticaWorkspaceSummary.tsx` | clinic logistica parity, home test | Row logística. |
| `data-clinic-logistics-detail-dialog` | Clinic Logistics Detail Dialog | `ClinicLogisticaWorkspaceSummary.tsx` | clinic logistica parity, home test | Dialog detalle logística. |
| `data-clinic-profile-editor` | Clinic Profile Editor | `ClinicPublicProfileCard.tsx` | module state, perfil mobile, runtime evidence | Editor perfil visible. |
| `data-clinic-profile-fields` | Clinic Profile Fields | `ClinicPublicProfileCard.tsx` | perfil mobile, runtime evidence | Fields por tab/perfil. |
| `data-clinic-profile-toolbar` | Clinic Profile Toolbar | `ClinicPublicProfileCard.tsx` | Sin consumidor directo detectado | Toolbar perfil. |
| `data-clinic-profile-footer` | Clinic Profile Footer | `ClinicPublicProfileCard.tsx` | Sin consumidor directo detectado | Footer perfil. |
| `data-clinic-access-filter-bar` | Clinic Access Filter Bar | `ClinicParticularTokensCard.tsx` | clinic tokens unit test | Filtros tokens clínica. |
| `data-clinic-access-toolbar` | Clinic Access Toolbar | `ClinicParticularTokensCard.tsx` | Sin consumidor directo detectado | Toolbar tokens. |
| `data-clinic-access-list-panel` | Clinic Access List Panel | `ClinicParticularTokensCard.tsx` | clinic tokens mobile, primitives test | Panel lista tokens. |
| `data-clinic-access-list-body` | Clinic Access List Body | `ClinicParticularTokensCard.tsx` | clinic tokens mobile, viewport zoom, unit | Cuerpo medible tokens. |
| `data-clinic-access-table` | Clinic Access Table | `ClinicParticularTokensCard.tsx` | module state, tokens parity, masked, zoom, unit | Tabla tokens desktop. |
| `data-clinic-access-table-row` | Clinic Access Table Row | `ClinicParticularTokensCard.tsx` | module state, masked, zoom, unit | Row tabla tokens. |
| `data-clinic-access-mobile-list` | Clinic Access Mobile List | `ClinicParticularTokensCard.tsx` | tokens parity, unit | Lista mobile tokens. |
| `data-clinic-access-mobile-row` | Clinic Access Mobile Row | `ClinicParticularTokensCard.tsx` | tokens parity, masked, zoom, unit | Row mobile tokens. |
| `data-clinic-access-future-slots` | Clinic Access Future Slots | `ClinicParticularTokensCard.tsx` | tokens parity, masked, unit | Slots futuros tokens. |
| `data-clinic-access-pagination-footer` | Clinic Access Pager Footer | `ClinicParticularTokensCard.tsx` | tokens parity, masked, zoom, primitives/unit | Footer paginación tokens. |
| `data-clinic-access-pagination-controls` | Clinic Access Pager Controls | `ClinicParticularTokensCard.tsx` | tokens parity, masked, unit | Controles paginación tokens. |
| `data-clinic-access-pagination-status` | Clinic Access Pager Status | `ClinicParticularTokensCard.tsx` | Sin consumidor directo detectado | Status paginación tokens. |
| `data-clinic-access-detail-dialog` | Clinic Access Detail Dialog | `ClinicParticularTokensCard.tsx` | tokens parity, masked, unit | Dialog detalle token. |
| `data-admin-mobile-bottom-nav` | Admin Bottom Nav | `AdminMobileBottomNav.tsx` | admin mobile specs, clinic mobile parity/nav specs | Nav mobile admin visible. |
| `data-admin-mobile-bottom-nav-item` | Admin Bottom Nav Item | `AdminMobileBottomNav.tsx` | admin bottom/final specs | Ítems nav admin. |
| `data-admin-mobile-module-menu` | Admin Mobile Module Menu | `AdminMobileModuleMenu.tsx` | admin app shell/bottom/core/final/ops specs | Menú módulos mobile. |
| `data-admin-mobile-module-link` | Admin Mobile Module Link | `AdminMobileModuleMenu.tsx` | admin bottom/core/final/ops specs | Link módulo mobile. |
| `data-admin-mobile-kebab-menu` | Admin Kebab Menu | `AdminMobileKebabMenu.tsx` | admin app shell/bottom/final specs | Menú overflow admin. |
| `data-admin-mobile-hub-launcher` | Admin Mobile Hub Launcher | `AdminMobileHubLauncher.tsx` | accessibility, admin mobile hub/final/visual specs | Launcher mobile admin. |
| `data-admin-mobile-hub-tile` | Admin Mobile Hub Tile | `AdminMobileLauncherTile.tsx` | hub launcher/final/stale/layer specs | Tile mobile hub. |
| `data-admin-mobile-hub-pager` | Admin Mobile Hub Pager | `AdminMobileHubPager.tsx` | hub launcher/final/layer specs | Pager hub mobile. |
| `data-admin-mobile-core-module` | Admin Core Mobile Module | Admin clinics/reports/tokens cards | admin mobile core/final/tokens toolbar specs | Root mobile de clínicas/reportes/tokens. |
| `data-admin-mobile-core-item` | Admin Core Mobile Item | Admin clinics/reports/tokens cards | admin mobile core/final/tokens toolbar specs | Item mobile core. |
| `data-admin-mobile-core-pager` | Admin Core Mobile Pager | Admin clinics/reports/tokens cards | clinics layout, core/final/tokens specs | Pager mobile core. |
| `data-admin-mobile-ops-module` | Admin Ops Mobile Module | `AdminMobileAuditModule`, sessions/users cards | admin ops/final/users specs | Root mobile audit/sessions/users. |
| `data-admin-mobile-ops-item` | Admin Ops Mobile Item | `AdminMobileAuditModule`, sessions/users cards | admin ops/final/users specs | Item mobile ops. |
| `data-admin-mobile-ops-pager` | Admin Ops Pager | `AdminMobileOpsPager.tsx` | admin config/status specs | Pager mobile ops/config/status. |
| `data-admin-mobile-status-module` | Admin Status Module | `AdminMobileStatusModule.tsx` | admin mobile status specs | Root status module. |
| `data-admin-mobile-status-item` | Admin Status Item | failed login/command/health modules | admin mobile status specs | Item status mobile. |
| `data-admin-mobile-status-chip` | Admin Status Chip | `AdminMobileStatusModule.tsx` | admin mobile status specs | Chip tab status. |
| `data-admin-mobile-status-panel` | Admin Status Panel | `AdminMobileStatusModule.tsx` | admin mobile status specs | Panel status. |
| `data-admin-mobile-config-module` | Admin Config Module | `AdminMobileConfigModule.tsx` | admin mobile config specs | Root config module. |
| `data-admin-mobile-config-` | Admin Config Dynamic Attribute Prefix | `AdminMobileConfigModule.tsx` | admin mobile config specs | Familia dinámica config. |
| `data-admin-mobile-config-item` | Admin Config Item | pricing/maintenance mobile | admin mobile config specs | Item config mobile. |
| `data-admin-mobile-config-chip` | Admin Config Chip | `AdminMobileConfigModule.tsx` | admin mobile config specs | Chip tab config. |
| `data-admin-mobile-config-panel` | Admin Config Panel | `AdminMobileConfigModule.tsx` | admin mobile config specs | Panel config. |
| `data-admin-clinics-mobile-list` | Admin Clinics Mobile List | `AdminClinicsManagementCard.tsx` | admin clinics mobile layout | Lista mobile clínicas. |
| `data-admin-clinic-mobile-card` | Admin Clinic Mobile Card | `AdminClinicsManagementCard.tsx` | admin clinics mobile layout | Card mobile clínica. |
| `data-admin-report-upload-filter-bar` | Admin Reports Filter Bar | `AdminReportsCard.tsx` | Sin consumidor directo detectado | Filtros upload/workflow. |
| `data-admin-reports-toolbar` | Admin Reports Toolbar | `AdminReportsCard.tsx` | Sin consumidor directo detectado | Toolbar reports. |
| `data-admin-reports-mobile-list` | Admin Reports Mobile List | `AdminReportsCard.tsx` | admin mobile core specs | Lista mobile reports. |
| `data-admin-filter-bar` | Admin Tokens Filter Bar | `AdminParticularTokensCard.tsx` | `frontend-admin-particular-tokens.test.ts` | Filtros admin tokens. |
| `data-admin-particulars-toolbar` | Admin Particulars Toolbar | `AdminParticularTokensCard.tsx` | admin module layer/tokens toolbar specs | Toolbar admin tokens. |
| `data-admin-particulars-mobile-list` | Admin Particulars Mobile List | `AdminParticularTokensCard.tsx` | admin layer/tokens/primitives tests | Lista mobile admin tokens. |
| `data-admin-pricing-item-form` | Admin Pricing Item Form | `AdminPricingEditorCard.tsx` | Sin consumidor directo detectado | Form por precio. |
| `data-save-all` | Admin Pricing Save All | `AdminPricingEditorCard.tsx` | Sin consumidor directo detectado | Acción guardar todo. |
| `data-admin-sesiones-card` | Admin Sessions Card | `AdminSessionsReadOnlyCard.tsx` | Sin consumidor directo detectado | Root sesiones. |
| `data-admin-sesiones-page-size` | Admin Sessions Page Size | `AdminSessionsReadOnlyCard.tsx` | Sin consumidor directo detectado | Cardinalidad efectiva. |
| `data-admin-sesiones-list-body` | Admin Sessions List Body | `AdminSessionsReadOnlyCard.tsx` | Sin consumidor directo detectado | Cuerpo lista sesiones. |
| `data-admin-sesiones-row` | Admin Sessions Row | `AdminSessionsReadOnlyCard.tsx` | Sin consumidor directo detectado | Row sesión. |
| `data-admin-sesiones-pagination` | Admin Sessions Pagination | `AdminSessionsReadOnlyCard.tsx` | Sin consumidor directo detectado | Pager sesiones. |
| `data-admin-maintenance-candidates-list` | Admin Maintenance Candidates List | `AdminMaintenanceDryRunCard.tsx` | Docs implementation references | Lista candidatos mantenimiento. |
| `data-form` | Clinic Edit Drawer Form State | `ClinicEditDrawer.tsx` | Sin consumidor directo detectado | Estado visual Radix/form. |
| `data-active` | Mobile Status/Config Active State | `AdminMobileStatusModule.tsx`, `AdminMobileConfigModule.tsx` | Sin consumidor directo detectado | Estado activo de chip/panel. |
| `data-tone` | Tone Attribute | Clinic command/logistics/cockpit | clinic command/logistics tests | Tono visual de KPI/señal/status. |

## 10. Checklist de “no debe faltar”

| Categoría | Estado | Evidencia |
|---|---|---|
| shell | Cubierto | `DashboardShellRouter`, `PrivateDashboardShell`, `data-vetneb-app-shell` |
| topbar | Cubierto | `DashboardTopbar`, `data-dashboard-topbar-polish` |
| sidebar | Cubierto | `DashboardSidebarFrame`, `DashboardSidebar`, role sidebars |
| bottom nav | Cubierto | `AdminMobileBottomNav`, `ClinicMobileBottomNav` |
| hub | Cubierto | `DashboardModuleHub`, `ClinicDashboardCockpit` |
| cockpit | Cubierto | `data-clinic-cockpit`, `dashboard-cockpit` |
| hero | Cubierto | `DashboardHubHero`, `data-dashboard-hub-hero-slot` |
| module grid | Cubierto | `dashboard-cockpit-grid`, `clinic-hub-tile-grid` |
| tile | Cubierto | `data-dashboard-module-card`, `data-clinic-cockpit-module-card`, `data-admin-mobile-hub-tile` |
| actions | Cubierto | `clinic-hub-action`, hero CTA, inline actions, sticky action bar |
| workspace | Cubierto | `DashboardModuleWorkspace`, `data-dashboard-module-workspace` |
| cards | Cubierto | `dashboard-surface`, metric cards, command cards |
| tables | Cubierto | admin/read-only tables, informes/logistica full routes |
| filters | Cubierto | `FilterBar`, `AdminAuditFilterBar`, token/report filters |
| drawer | Cubierto | `FilterDrawer`, `ClinicEditDrawer` |
| pagination | Cubierto | `CompactPager`, table pagers, mobile hub/core/ops pagers |
| modals | Cubierto | `ModuleDialog`, `UploadReportModal`, detail dialogs |
| feedback states | Cubierto | `LoadingState`, `EmptyState`, `ErrorState`, `clinical-alert-*` |
| badges | Cubierto | `StatusBadge`, `AdminReportStatusBadge`, UI `Badge` usage |
| KPIs | Cubierto | `dashboard-kpi-chip`, `dashboard-kpi-pill`, metric cards |
| signals | Cubierto | `clinic-hub-signal`, command attention/activity/continuity |
| tokens | Cubierto | `ClinicParticularTokensCard`, `AdminParticularTokensCard`, primitives |
| profile | Cubierto | `ClinicPublicProfileCard`, `PasswordChangePanel` |
| reports | Cubierto | `InformesReportsList`, `AdminReportsCard`, `AdminReportWorkflowViewerCard` |
| logistics | Cubierto | `ClinicLogisticaWorkspaceSummary`, `LogisticsCommandCenter`, full routes |
| admin mobile | Cubierto | `admin-mobile-*` components/CSS/data attrs |
| clinic mobile | Cubierto | `ClinicMobileBottomNav`, `ClinicMobileModuleFrame`, clinic mobile attrs |
| responsive/no-scroll | Cubierto | `globals.css` no-scroll/app-shell/viewport/mobile blocks + E2E specs |
| accessibility | Cubierto | ARIA navs/tabs/dialogs, focus rings, reduced motion, axe specs |
| e2e hooks | Cubierto | 130 source `data-*`, 102 con consumidor directo detectado |

## 11. Glosario técnico final

| Término técnico correcto | Definición | Ejemplo en repo |
|---|---|---|
| Application Shell | Contenedor raíz privado que ocupa el viewport y gobierna navegación inferior/superficie. | `DashboardShellRouter.tsx` |
| Viewport Frame | Frame interno flexible que impide crecimiento fuera del shell. | `data-vetneb-app-shell-frame` |
| Dashboard Main | Área principal visual del dashboard dentro del shell. | `.dashboard-main` |
| Module Stage | Capa estable que alterna hub y workspace sin desmontar el surface raíz. | `data-dashboard-module-stage` |
| Module Workspace | Contenedor de módulo con header/back button/viewport. | `DashboardModuleWorkspace.tsx` |
| Module Viewport | Región flexible interna donde vive el contenido real del módulo. | `data-dashboard-module-viewport` |
| Dashboard Module Hub | Launcher de módulos con cards y hero opcional. | `DashboardModuleHub.tsx` |
| Dashboard Cockpit | Hub operativo con status, KPIs, módulos y señales. | `ClinicDashboardCockpit` |
| Hero Slot | Wrapper del hero fuera del section de cards para no contaminar E2E de buttons. | `data-dashboard-hub-hero-slot` |
| Module Tile / Interactive Navigation Card | Elemento interactivo que abre un módulo. | `data-dashboard-module-card` |
| Mobile Bottom Navigation | Navegación primaria mobile persistente. | `AdminMobileBottomNav.tsx`, `ClinicMobileBottomNav.tsx` |
| Signal Rail | Columna o grupo de señales operativas. | `.clinic-hub-signals` |
| KPI Chip | Indicador compacto con icono, etiqueta y valor. | `.dashboard-kpi-chip` |
| Status Band | Header operativo con estado global de una superficie. | `.dashboard-hub-band` |
| Bounded Surface | Surface que no debe crecer fuera de su frame. | `ModuleSurface`, `.dashboard-surface` |
| Master-Detail Workspace | Patrón lista + detalle seleccionado. | `InformesReportsList.tsx` |
| Detail Dialog | Dialog de detalle para variantes mobile o workflows específicos. | `data-clinic-access-detail-dialog` |
| Dense Table | Tabla compacta para caber en viewport administrativo. | `AdminAuditDenseTable.tsx` |
| Mobile Row Variant | Representación mobile de una fila de tabla como list item/card. | `data-admin-mobile-core-item` |
| Filter Bar | Formulario horizontal/compacto de filtros. | `FilterBar.tsx` |
| Filter Drawer | Overlay de filtros para layout reducido. | `FilterDrawer.tsx` |
| Compact Pager | Paginador compacto para mantener no-scroll. | `CompactPager.tsx` |
| Pending Activation Buffer | Estado intermedio que demora un commit la activación para evitar detach. | `pendingActivation` en controllers |
| Navigation Intent Guard | Ref que descarta commits URL obsoletos tras navegación optimista. | `pendingNavigationIntent` |
| Last Module Persistence | Persistencia client-side del último módulo activo por superficie. | `dashboard-last-module` usage |
| Hub Reset Signal | Pub/sub que fuerza retorno al hub aunque la navegación URL colapse. | `admin-hub-reset`, `clinic-hub-reset` |
| No-scroll Contract | Invariante de caber en viewport sin scroll global. | `dashboard-real-app-shell-no-scroll-contract.spec.ts` |
| Touch Target Contract | Reglas de tamaño/foco para interacción táctil. | `admin-mobile-app-shell` CSS |
| Focus Ring Contract | Foco visible para teclado y focus trap. | `focus-visible:ring-*`, `.dashboard-focus-trap-container` |
| Reduced Motion Guard | Reglas que reducen animaciones para preferencias del usuario. | `@media (prefers-reduced-motion: reduce)` |
| Truncation Contract | Uso de `truncate`/`line-clamp` para que textos no desborden. | `clinic-hub-tile`, nav items |

## 12. Riesgos de diseño

No modificar sin captura visual y revisión de no-scroll: `DashboardShellRouter`, `DashboardTopbar`, `DashboardHorizontalNav`, `AdminMobileBottomNav`, `ClinicMobileBottomNav`, `DashboardModuleHub`, `ClinicDashboardWorkspaceController`, `AdminDashboardWorkspaceController`, `DashboardModuleWorkspace` y `frontend/src/app/globals.css`.
Los componentes más sensibles son los que participan en la cadena `h-dvh overflow-hidden -> frame min-h-0 -> dashboard-main -> module-stage -> module-workspace -> module-viewport`.
Cambios en `data-dashboard-module-hub`, `data-dashboard-module-card`, `data-dashboard-module-workspace`, `data-dashboard-module-stage` o `data-vetneb-app-shell-*` impactan contratos E2E amplios y pueden romper navegación, no-scroll o readiness.
Cambios en `admin-mobile-*` requieren capturas en 360x740, 390x844, 412x915 y al menos un viewport tablet/desktop porque esas reglas controlan safe-area, appbar, bottom nav, hub pager y aislamiento de capas.
Cambios en `clinic-hub-*`, `.dashboard-kpi-chip`, `.dashboard-hub-band` o `.clinic-hub-signal` requieren capturas del hub clínica, porque el cockpit está optimizado para jerarquía status -> módulos -> señales sin scroll.
Cambios en tablas/listas de Admin (`AdminClinicsManagementCard`, `AdminReportsCard`, `AdminParticularTokensCard`, `AdminSessionsReadOnlyCard`, `AdminUsersRolesReadOnlyCard`, `AdminAuditCard`) deben verificarse con datos poblados y mobile, porque la cardinalidad/paginación evita overflow.
Cambios en `ModuleTabs`, `ModuleDialog`, `FilterDrawer`, `UploadReportModal`, `ClinicEditDrawer` o detail dialogs deben verificarse con teclado/focus trap, `aria-*`, close behavior y viewport reducido.
Cambios en `DashboardNotificationsBell`, `DashboardLogoutControl` o BFCache guard no son sólo visuales: tocan superficies privadas y deben preservar no-store/cache/logout y nombres de cookies por rol.
Cambios en `ReportDownloadButton`, upload/report workflows o token detail dialogs deben validar estados disabled/empty/error para no ocultar ausencia de archivo o estado real.
No conviene modificar `globals.css` por búsqueda/reemplazo global: conviven bloques históricos y contratos actuales, y el riesgo principal es tocar el path visual equivocado.

## 13. Resultado

El inventario cubre el 100% de dashboards privados detectados por inspección del repo: Clínica (`/dashboard`, módulos `operaciones`, `informes`, `logistica`, `perfil`, `tokens`, full routes de informes/logística) y Admin (`/dashboard/admin` y diez módulos `?module=`).
Archivos inspeccionados: 256 distintos (46 `frontend/src/app/dashboard`, 47 `frontend/src/components/dashboard`, 1 CSS global, 56 E2E relacionados, 45 tests relacionados y 61 documentos dashboard relacionados).
Componentes/exports técnicos detectados: 249.
Data attributes inventariados desde source dashboard: 130; con consumidor E2E/unit directo detectado: 102.
Validaciones nativas confirmadas por scripts disponibles: `pnpm test`, `pnpm build`, `pnpm security:public-surface`, `pnpm --dir frontend lint`, `pnpm --dir frontend typecheck`, `pnpm --dir frontend build`.
Validación ejecutada para esta auditoría documental: inspección estática por PowerShell/rg y revisión final de git/diff/check.
No se modificó código, tests, CSS existente, backend, API, auth, DB, Supabase, dependencias, lockfiles, workflows, CI, stage, commit, push ni PR.
Archivo creado: `docs/audit/dashboard-visual-component-taxonomy.md`.
