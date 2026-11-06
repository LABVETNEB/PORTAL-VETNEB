# GLOBAL-SEARCH-2 · Interfaz del superbuscador «Buscar en VETNEB»

## 1. Estado base

- Base: `origin/main@30c7215393f7859d4dbd03dd95c9f3185ec466ed` (GLOBAL-SEARCH-1, #1967, fusionada).
- Rama: `feat/global-search-2-frontend`.
- Scope primario: **frontend runtime**. Sin cambios de backend, migraciones, dependencias ni workflows.

## 2. Qué cambia

- `WorkspaceModuleSearch` (filtro local del catálogo de módulos) se retira de `WorkspaceAppBar`.
  La barra sigue **presentation-pure**: recibe la búsqueda como slot `search`, que inyecta
  `DashboardTopbar` (orquestador) con `<DashboardGlobalSearch surface="clinic" | "admin" />`.
- Campo «Buscar en VETNEB» con sugerencias de **registros reales** desde
  `GET /api/search` (Clínica) y `GET /api/admin/search` (Admin), agrupadas por categoría.
  Los atajos «Ir a módulo» se conservan como grupo secundario (catálogo canónico, `?module=`,
  reclamo al dueño de navegación DT-10), no como corpus de búsqueda.
- Debounce de 250 ms; cada pedido nuevo aborta el anterior (`AbortController`) y una respuesta
  sólo se aplica si pertenece al último pedido.
- Vista de resultados completos (diálogo): filtro por tipo, filtros de informe (estado, tipo de
  estudio, desde/hasta), `clinicId` sólo para Admin, paginación por tipo (offset ≤ 500),
  estados de carga, vacío y error con reintento; el mensaje del servidor nunca se muestra.
- **Vista de registro**: se construye con el hit (resuelto por id en el servidor), así que el
  registro abre aunque su módulo nunca lo haya cargado. Informes (o hits con informe vinculado)
  ofrecen «Ver informe» / «Descargar» (`ReportFileActions`, por id). «Abrir en …» navega al
  módulo con el ancla de fila existente (`#report-<id>`, `#clinic-particular-token-<id>`,
  `#admin-particular-token-<id>`), registrada en el guard de dueño único como deep-link externo
  (misma gramática que la campana de notificaciones).
- Móvil (< 768 px): «Buscar en VETNEB» es la primera acción del menú overflow existente y abre la
  búsqueda a pantalla completa (lista ↔ registro en un panel). La barra móvil no cambia de
  geometría. Ctrl/Cmd+K enfoca la búsqueda (o abre el diálogo en móvil).
- Accesibilidad: combobox con `aria-activedescendant`, grupos `role="group"`, región
  `role="status"` cortés, foco devuelto al campo al cerrar, objetivos ≥ 44 px.
- Tema: el diálogo se monta bajo `[data-dashboard-portal-root]` (B05) para resolver los tokens
  del dashboard en claro y oscuro.

## 3. Archivos

Nuevos: `frontend/src/lib/global-search.ts` (contrato cliente puro),
`frontend/src/components/dashboard/DashboardGlobalSearch.tsx`,
`DashboardGlobalSearchDialog.tsx`, `useDashboardGlobalSearch.ts`,
`frontend/e2e/platform/app-shell/dashboard-global-search.spec.ts`,
`test/unit/ui/frontend/frontend-global-search-client.test.ts`.

Modificados: `WorkspaceAppBar.tsx` (slot), `DashboardTopbar.tsx` (inyección),
`DashboardMobileKebabMenu.tsx` (entrada móvil), `frontend/src/lib/api.ts`
(`searchDashboardGlobal`), `frontend/e2e/suites/catalog.ts`.

Guards realineados en el mismo PR (AGENTS §4), sin debilitar reglas: B06 (T3/T5/drive-shell),
dueño único de navegación (path del buscador y deep-link de hit), FSM clínica, single flight,
catálogo E2E (+1 spec en cada contador) y censo 01B «archivos fuente de frontend/src/**»
(re-anclaje 200 → 252, main producía 248 con tope 250).

## 4. Cobertura de datos

| Superficie | Cubierto en GLOBAL-SEARCH-2 | Pendiente (GLOBAL-SEARCH-3) |
| --- | --- | --- |
| Clínica | Informes, tokens particulares, seguimientos (tenant = sesión) | Logística (visitas, rutas), Perfil, auditoría propia |
| Admin | Clínicas, informes, tokens, seguimientos, usuarios de clínica | Sesiones, auditoría, report access tokens, precios |
| Ambas | Nombre, archivo, mascota, tutor, `#id`, filtros de informe | Contenido de PDF, relevancia avanzada, índices trigram |

Deep-link: la vista de registro abre cualquier registro autorizado; el ancla del módulo sólo
posiciona la fila si la página cargada la contiene. Seleccionar la fila por id dentro del módulo
queda para GLOBAL-SEARCH-3.

## 5. Seguridad

- El pedido de Clínica nunca envía `clinicId`; el tenant lo fija el servidor desde
  `app_session_id`. `clinicId` sólo se emite en Admin y sólo numérico.
- Sin datos simulados en producción; los datos sintéticos viven sólo en el spec E2E.
- El aislamiento A/B lo prueba GLOBAL-SEARCH-1 contra PostgreSQL real; el spec E2E prueba el
  lado UI (sin `clinicId`, sólo se pinta lo devuelto, 403 ante un `clinicId` ajeno).

## 6. Validación

Ver el cuerpo de la PR para los estados canónicos de cada gate.

## 7. Riesgos residuales

- Baselines de píxeles Chromium-Linux (`visual-regression-authenticated`, cohorte
  `visual-linux`/`full`) pueden diferir por el placeholder nuevo; si fallan requieren
  regeneración autorizada.
- Sin evidencia runtime en staging con dos clínicas reales de prueba (§17): BLOCKED.
- Sin rate limit específico en los GET de búsqueda; lo mitigan debounce y cancelación.
