# Auditoría: Dashboard Premium — Interacción y Valor Operativo

- **Fecha:** 2026-06-09
- **Rama:** `audit/premium-dashboard-interaction-value`
- **HEAD base real:** `efa295c fix(dashboard): sync workspace routing and reports back navigation (#922)`
  - Nota: el briefing indicaba base `90385c1` (#921), pero `main` ya incluye #922, que corrige parte de las regresiones reportadas. Esta auditoría está hecha contra `efa295c`.
- **Alcance:** solo auditoría y propuesta. Cero cambios de código productivo.
- **Skills aplicadas:** Production Web Optimization Engineer, Bugs/Errores/Optimización Rutas, Briefing/Planificación, Staff Senior Full-Stack, Web End-to-End Global, Security Production Invariants.

---

## 1. Resumen ejecutivo

### Estado visual actual

El dashboard ya tiene una arquitectura correcta y moderna: hub de cards → workspace aislado → "Volver a módulos", shell `h-dvh overflow-hidden` sin scroll global, sidebar rail compacta de 72px, master-detail en informes con paginación server-side, timeline de estudio, sticky bars, estados empty/error/loading dedicados y un sistema de clases CSS semánticas (`clinical-*`, `dashboard-*`, `surface-*`) coherente. La base es sana. Lo que falta no es estructura: es **capa de interacción**.

### Por qué se percibe básico

1. **Cero transiciones entre estados.** Hub ↔ workspace es un swap instantáneo de React (`ClinicDashboardWorkspaceController.tsx:169-189`). No hay enter/exit, no hay continuidad espacial entre la card clickeada y el workspace que abre.
2. **Feedback plano.** No existe sistema de toasts (cero matches de `toast/sonner` en `frontend/src`); los éxitos/errores son banners inline con estado local (`AdminClinicsManagementCard.tsx:110`). No hay undo, no hay confirmación visual de acciones más allá de texto.
3. **Interacciones servidor-céntricas sin máscara.** Seleccionar un informe o filtrar dispara un round-trip SSR completo sin estado de transición visible (`informes/page.tsx:502-518`, form GET nativo en `:379`): la UI "congela y reaparece".
4. **Sin datos visualizados.** Las métricas son números planos (`StatsCards.tsx:109`); los tokens `--chart-1..5` están definidos (`globals.css:26-30`) y `echarts` está instalado, pero nada los usa.
5. **Microdetalle inconsistente.** Duraciones dispersas (150/180/200/300ms), easings ad-hoc, hover solo en sombras/bordes, sin estado `press`, tooltips nativos `title=` en la sidebar.

### Qué elevaría más el valor

En orden de ROI: **(1)** cerrar las regresiones funcionales residuales (admin URL sync, filtros informes), **(2)** un sistema de motion tokens + microinteracciones base (una sola vez, beneficia todo), **(3)** transición hub↔workspace, **(4)** informes master-detail con selección instantánea y search highlight, **(5)** toasts + undo, **(6)** data viz mínima (sparklines/aging) sobre datos ya disponibles.

### Riesgos principales

- Romper el invariante "no scroll global" (los E2E lo verifican con tolerancia de 5px).
- Hidratación: los controllers son client components sobre páginas server async con `searchParams` — cualquier animación condicionada a estado cliente puede causar mismatch.
- Tests de contrato por string-matching (`test/frontend-dashboard-informes.test.ts` hace `source.includes(...)`): refactors visuales los rompen aunque el comportamiento sea idéntico.
- Sobreanimación en contexto clínico: cada ms de motion debe justificar orientación, no decoración.

---

## 2. Diagnóstico visual actual

### Qué ya está bien (no tocar sin razón)

| Área | Evidencia |
|---|---|
| Arquitectura hub → workspace con aislamiento real | `ClinicDashboardWorkspaceController.tsx`, `AdminDashboardWorkspaceController.tsx`, E2E `dashboard-card-navigation-shell.spec.ts` (700 líneas, incluye isolation tests) |
| Shell sin scroll global | `DashboardShellRouter.tsx:16` (`h-dvh overflow-hidden`), `.dashboard-main` con `overflow-y-auto` (`globals.css:201`) |
| Deep links validados con whitelist server-side | `parseClinicModule` (`dashboard/page.tsx:32`), `parseAdminModule` (`admin/page.tsx:84`) — nunca se renderiza un módulo arbitrario desde la URL |
| Back/forward en clínica | `useEffect` + `useSearchParams` agregado en #922 (`ClinicDashboardWorkspaceController.tsx:91-93`) |
| "Volver a módulos" en informes | Agregado en #922 (`informes/page.tsx:344-353`) con test de regresión |
| Master-detail informes con paginación server-side | `informes/page.tsx` + `MasterDetailWorkspace.tsx` (aria-live para selección, `data-detail-state`) |
| Estados empty/error/loading dedicados | `EmptyState.tsx`, `ErrorState.tsx`, `LoadingState.tsx`, `Skeleton` con `clinical-skeleton-pulse` |
| `prefers-reduced-motion` global | `globals.css:927-945` |
| Accesibilidad base | `:focus-visible` global (`globals.css:145`), aria-labels en cards/workspaces, `aria-current` en selección, `role="alert"` en errores |
| Seguridad de sesión y datos | Cookies separadas (`app_session_id`/`admin_session_id` en E2E), `cache: "no-store"` en todos los fetch privados, sanitización de metadata de auditoría (`admin/page.tsx:208-235`) |
| FilterDrawer accesible | `role="dialog"`, `aria-modal`, Escape, focus al abrir (`FilterDrawer.tsx:40-58`) |
| Notificaciones con polling y auto-show | `DashboardNotificationsBell.tsx` (30s, sin marcar como leídas al auto-mostrar) |

### Qué se ve básico

- **Swap instantáneo hub↔workspace**: sin animación, sin continuidad visual; la card no "se convierte" en el workspace.
- **Métricas como texto plano**: `StatsCards` muestra 4 números sin tendencia, sin sparkline, sin contexto temporal.
- **Tabla de informes genérica en mobile**: `overflow-x-auto` (`informes/page.tsx:442`) = tabla comprimida con scroll horizontal, justo el anti-patrón que el briefing quiere eliminar.
- **Hover-only feedback**: las cards del hub solo cambian sombra/borde; no hay estado press/active, no hay scale sutil.
- **Tooltips nativos** (`title=`) en la sidebar rail (`DashboardSidebarFrame.tsx:76`): aparecen tarde, no estilizados, invisibles en touch.
- **Sin search highlight**: la búsqueda en informes filtra pero no resalta el match en los resultados.
- **Workspace "Subir informe" admin es solo un texto explicativo** (`admin/page.tsx:405-426`): card que abre un módulo sin acción real — exactamente el anti-patrón "estado UI falso" del protocolo (mitigado porque explica dónde está la acción real, pero percibido como hueco).

### Qué está roto (regresiones residuales, bloque PR-0)

1. **Admin no sincroniza URL → estado** *(confirmado por código)*. `AdminDashboardWorkspaceController.tsx` usa solo `useState(initialModule)` sin el `useEffect`+`useSearchParams` que #922 agregó al controller de clínica. Consecuencias: botón back/forward del navegador no restaura hub/módulo; los links internos `?module=audit-log&event=...` (`admin/page.tsx:627-634`) re-renderizan el server component pero **no** actualizan `activeModule` si el usuario estaba en otro módulo.
2. **Filtro de informes pierde `studyType`** *(confirmado por código)*. El form GET del drawer (`informes/page.tsx:379-424`) solo tiene inputs `query` y `status`; si la URL traía `studyType`, al filtrar se descarta silenciosamente, y el chip "Tipo de estudio" del `StickyFilterBar` no tiene forma de quitarse individualmente.
3. **Selección de informes con fricción** *(parcialmente confirmado)*. `Seleccionar` usa `router.replace` + hash `#report-detail` (`informes/page.tsx:502-518`): cada selección es un round-trip SSR sin estado de carga visible, y el fallback `?? reports[0]` (`informes/page.tsx:298`) hace que un `reportId` inválido caiga al primero en silencio. El re-scroll al mismo hash en selecciones sucesivas es el candidato más probable del "no cambia correctamente". **NO CONFIRMADO en runtime — requiere validación manual con sesión real.**
4. **`/dashboard?module=operaciones`** — el código actual (`dashboard/page.tsx:58` + sync de #922) lo soporta. **NO CONFIRMADO en runtime**; debe validarse en PR-0 con E2E de deep link directo antes de cerrar el reclamo.
5. **`StickyActionBar` navega con `window.location.assign`** (`StickyActionBar.tsx:37`): para hrefs de ruta real provoca full reload (hoy solo recibe hashes, pero es una trampa latente).

### Qué genera fricción

- **Navegación 100% `<button>`**: `PublicRouteControl` nunca renderiza `<a>` — sin Ctrl+click, sin abrir en pestaña nueva, sin "copiar dirección del enlace", sin rol `link` para lectores de pantalla. Para "URLs compartibles" premium es la fricción estructural número uno.
- **Form GET nativo en filtros** = full page load (no client navigation), pierde scroll y estado del drawer.
- **`AdminSectionTabs.tsx` es código muerto** (cero imports en páginas) y todavía condiciona un comentario/branch en `PublicRouteControl.tsx:71-80`.
- **Dependencias instaladas sin uso**: `echarts`, `echarts-for-react`, `gsap`, `@tanstack/react-query`, `@tanstack/react-table`, `@radix-ui/react-{toast,tooltip,tabs,dropdown-menu,select,avatar}` — solo `@radix-ui/react-dialog` se importa (`ClinicEditDrawer.tsx:4`). No afectan bundle (tree-shaking) pero sí install/CI y señalizan deuda de decisión.

### Qué falta para sensación premium

Motion tokens, transición hub↔workspace, selección optimista en informes, search highlight, toasts+undo, tooltips reales, command palette, data viz mínima, cards mobile en vez de tabla comprimida, y consistencia de duraciones/easings.

---

## 3. Principios de diseño VETNEB

1. **Claridad clínica antes que ornamento.** Ningún efecto puede competir con la lectura de un estado de informe o una métrica pendiente.
2. **Movimiento funcional, nunca decorativo.** Cada animación responde una pregunta del usuario: "¿de dónde vengo?", "¿qué cambió?", "¿terminó?". Si no responde ninguna, no existe.
3. **Cada acción confirma su estado.** Toda acción visible llama backend real y muestra pending → success/error. Prohibido simular éxito (invariante de skill).
4. **Navegación recuperable.** Refrescar, back del navegador y compartir URL siempre restauran el mismo estado (módulo, filtros, selección, página).
5. **Filtros no bloqueantes.** Filtrar nunca debe sentirse como "salir de la página": drawer persistente, chips removibles, resultados sin full reload.
6. **Feedback en <100ms, resultado honesto.** La UI reacciona al instante (optimista o skeleton), pero el estado final solo se afirma cuando el backend respondió.
7. **Densidad controlada.** Hub aireado para orientarse; workspaces densos para operar. Nunca dashboard largo, nunca scroll global.
8. **Mobile operativo real.** En <640px no hay tablas comprimidas: hay cards, bottom sheets y acciones sticky alcanzables con el pulgar.
9. **Accesibilidad obligatoria.** Focus visible, aria sincronizado con el estado visual, navegación por teclado completa, `prefers-reduced-motion` respetado en todo lo nuevo.
10. **Privacidad primero.** Datos clínicos jamás en caché de SW, URLs sin datos sensibles (solo IDs), nada de paciente/diagnóstico en toasts persistentes ni logs.
11. **Una fuente de verdad por estado.** URL para navegación/filtros/selección; React state solo para efímeros (drawer abierto, hover). Evitar el doble-estado que causó la regresión admin.
12. **Cambios pequeños y reversibles.** Cada mejora entra como PR mínimo con test de regresión y rollback lógico claro.

---

## 4. Catálogo completo de mejoras posibles

> Dificultad/Riesgo: B=bajo, M=medio, A=alto. Prioridad: P0 (bloqueante) → P3 (opcional).

### 4.1 Estabilidad (pre-visual)

| # | Mejora | Descripción | Valor operativo | Valor visual | Dif. | Riesgo | Dependencias | Superficie | Tests | Prio | ¿Sí? |
|---|---|---|---|---|---|---|---|---|---|---|
| E1 | Admin URL↔estado sync | Portar el `useEffect`+`useSearchParams` de #922 al `AdminDashboardWorkspaceController` | Alto: back/forward y links internos admin funcionan | — | B | B | ninguna | `AdminDashboardWorkspaceController.tsx` | unit contrato + E2E back/forward admin | P0 | **Sí** |
| E2 | Preservar `studyType` en filtros informes | Hidden input o campo visible en el form del drawer; chips removibles individualmente | Alto: filtros dejan de perder estado | Bajo | B | B | ninguna | `informes/page.tsx` | unit + E2E filtros | P0 | **Sí** |
| E3 | Selección informes robusta | Eliminar fallback silencioso `?? reports[0]` (estado "no encontrado" explícito) y validar re-scroll de hash repetido | Alto: selección predecible | Medio | B | B | ninguna | `informes/page.tsx` | E2E selección sucesiva | P0 | **Sí** |
| E4 | E2E deep link `?module=` | Specs `goto("/dashboard?module=operaciones")` y admin equivalente, validando workspace activo | Alto: cierra el reclamo con evidencia | — | B | B | ninguna | `frontend/e2e/` | E2E nuevos | P0 | **Sí** |
| E5 | Borrar `AdminSectionTabs.tsx` muerto | Eliminar componente sin imports + limpiar branch hash en `PublicRouteControl` | Medio: menos deuda | — | B | B | E4 (verificar hash usage) | 2 archivos | unit existentes | P1 | **Sí** |
| E6 | Decidir deps sin uso | Quitar `gsap`, `react-query`, `react-table` y radix no usados, o adoptarlos explícitamente en el roadmap (toast/tooltip sí se adoptan; echarts se decide en PR-7) | Medio: CI/install más rápidos, menos confusión | — | B | B | decisión roadmap | `package.json` | build+typecheck | P2 | **Sí** (parcial) |

### 4.2 Foundation de interacción

| # | Mejora | Descripción | Valor operativo | Valor visual | Dif. | Riesgo | Dependencias | Superficie | Tests | Prio | ¿Sí? |
|---|---|---|---|---|---|---|---|---|---|---|
| F1 | Motion tokens | Variables CSS `--motion-fast: 120ms`, `--motion-base: 180ms`, `--motion-slow: 280ms`, `--ease-out-soft`, `--ease-spring` en `globals.css`; migrar duraciones dispersas | Medio: consistencia | Alto | B | B | ninguna | `globals.css`, componentes con transition | unit contrato CSS | P1 | **Sí** |
| F2 | Estados press/active | `active:scale-[0.99]` + cambio de sombra en cards/botones del hub, respetando reduced-motion | Bajo | Alto | B | B | F1 | `DashboardModuleHub`, `button.tsx` | E2E visual smoke | P1 | **Sí** |
| F3 | Tooltip real | Adoptar `@radix-ui/react-tooltip` (ya instalado) como `ui/tooltip.tsx`; reemplazar `title=` en sidebar rail | Medio: labels visibles en rail de iconos | Alto | B | B | ninguna | `ui/`, `DashboardSidebarFrame` | a11y test | P1 | **Sí** |
| F4 | Focus ring unificado | Auditar y consolidar las variantes de `focus-visible:ring` en una clase utilitaria | Medio: a11y | Medio | B | B | F1 | global | a11y test existente | P2 | **Sí** |

### 4.3 Navegación y transiciones

| # | Mejora | Descripción | Valor operativo | Valor visual | Dif. | Riesgo | Dependencias | Superficie | Tests | Prio | ¿Sí? |
|---|---|---|---|---|---|---|---|---|---|---|
| N1 | Transición hub↔workspace | Fade+slide-up de 180ms al montar workspace, fade-out al volver; CSS puro (`@keyframes` + clase en `DashboardModuleWorkspace`), sin lib | Bajo | Muy alto | B | B | F1 | `DashboardModuleWorkspace`, `DashboardModuleHub` | E2E reduced-motion + visibilidad | P1 | **Sí** |
| N2 | Continuidad card→workspace | View Transitions API (progressive enhancement, `document.startViewTransition` con fallback a N1) para morph card→header del workspace | Bajo | Muy alto | M | M | N1 | controllers | E2E en Chromium + fallback test | P2 | **Sí** (como enhancement) |
| N3 | Links reales en navegación | Variante `<a>` de `PublicRouteControl` (renderizar `next/link` cuando `href` es ruta) para sidebar, cards y selección de informes → Ctrl+click, middle-click, copy link | Alto: URLs compartibles de verdad | Medio | M | M | tests que asumen `button` | `PublicRouteControl`, consumidores | actualizar E2E selectores | P1 | **Sí** (gradual, empezando por dashboard) |
| N4 | Indicador de navegación pendiente | `useLinkStatus`/transition state: barra de progreso fina top o spinner en card clickeada durante el round-trip SSR | Alto: elimina sensación de "no pasó nada" | Alto | B | B | F1 | shell | E2E | P1 | **Sí** |

### 4.4 Informes premium

| # | Mejora | Descripción | Valor operativo | Valor visual | Dif. | Riesgo | Dependencias | Superficie | Tests | Prio | ¿Sí? |
|---|---|---|---|---|---|---|---|---|---|---|
| I1 | Selección instantánea client-side | La lista ya viene con la página completa: la selección puede resolverse client-side (estado derivado de URL con `useSearchParams` + render optimista) manteniendo SSR para deep links | Muy alto: selección <50ms | Alto | M | M | E3 | `informes/page.tsx` → split client component | unit + E2E selección | P1 | **Sí** |
| I2 | Search highlight | Resaltar el término buscado en paciente/tipo con `<mark>` estilizado | Alto: escaneo visual rápido | Alto | B | B | ninguna | lista informes | unit highlight | P1 | **Sí** |
| I3 | Filtros con submit client-side | Reemplazar form GET nativo por `router.replace` con params construidos (sin full reload), manteniendo URL como fuente de verdad | Alto | Medio | B | B | E2 | drawer informes | E2E filtros | P1 | **Sí** |
| I4 | Navegación por teclado en lista | ↑/↓ mueve selección, Enter abre detalle, `/` enfoca búsqueda | Alto para uso intensivo | Medio | M | B | I1 | lista informes | unit keyboard + a11y | P2 | **Sí** |
| I5 | Cards mobile en lugar de tabla | En <768px renderizar cards apiladas (paciente, tipo, estado, fecha, acciones) en vez de tabla con scroll-x | Muy alto mobile | Alto | M | B | ninguna | lista informes | E2E viewport mobile | P1 | **Sí** |
| I6 | Aging visual por informe | Badge "hace N días" con tono por antigüedad (verde <2d, ámbar 2-5d, rojo >5d) calculado de `uploadDate` | Alto: priorización inmediata | Alto | B | B | ninguna | lista + detalle | unit aging | P1 | **Sí** |

### 4.5 Dashboards clínica y admin

| # | Mejora | Descripción | Valor operativo | Valor visual | Dif. | Riesgo | Dependencias | Superficie | Tests | Prio | ¿Sí? |
|---|---|---|---|---|---|---|---|---|---|---|
| D1 | Bento operativo clínica | Reorganizar `ClinicCommandCenter` en grid bento: KPI hero (pendientes), sparkline informes 7d, lista priorizada, visitas del día | Alto | Muy alto | M | M | F1, V1 | `ClinicCommandCenter` | unit + E2E | P2 | **Sí** |
| D2 | Hub cards con dato vivo | Cards del hub muestran mini-dato (ya hay badges de pendientes/visitas): agregar última actividad y tendencia | Medio | Alto | B | B | ninguna | controllers | unit | P2 | **Sí** |
| D3 | Admin command center con acciones | Quick actions reales en el resumen admin (ir a sesiones activas, ver últimos fallos) — solo navegación a workspaces existentes, sin backend nuevo | Alto | Medio | B | B | E1 | `AdminCommandCenter` | E2E admin | P2 | **Sí** |
| D4 | Drawers admin consistentes | Extraer patrón de `ClinicEditDrawer` (Radix Dialog) a `ui/drawer.tsx` y usarlo en FilterDrawer y futuros editores | Medio: un solo patrón | Medio | M | B | ninguna | `ui/`, 2 drawers | unit + a11y | P2 | **Sí** |
| D5 | Bulk actions admin | Selección múltiple en tablas admin (clinics/sessions) con barra de acciones flotante | Medio | Medio | A | M | D4, backend existente | tablas admin | E2E + unit | P3 | **No por ahora** — el volumen actual de clínicas no justifica el riesgo; reevaluar con >100 filas reales |

### 4.6 Feedback y data viz

| # | Mejora | Descripción | Valor operativo | Valor visual | Dif. | Riesgo | Dependencias | Superficie | Tests | Prio | ¿Sí? |
|---|---|---|---|---|---|---|---|---|---|---|
| V1 | Sparklines SVG propias | Mini-líneas de 7/30 días en StatsCards; SVG inline ~40 líneas, sin echarts | Medio | Muy alto | B | B | datos agregados existentes o derivables client-side | `StatsCards` | unit render | P2 | **Sí** |
| V2 | Aging buckets / SLA bar | Distribución de informes por antigüedad como barra apilada semántica | Alto | Alto | B | B | I6 | command centers | unit | P2 | **Sí** |
| V3 | echarts para auditoría admin | Gráfico de eventos por día solo en workspace auditoría, con `next/dynamic` lazy | Bajo-medio | Alto | M | M | decisión E6 | audit workspace | bundle check + unit | P3 | **Solo si** el lazy-load demuestra 0 impacto en first load; si no, V1/V2 bastan y echarts se desinstala |
| T1 | Sistema de toasts | Adoptar `@radix-ui/react-toast` (instalado) como `ui/toast.tsx` + provider en layout dashboard; migrar success/error de admin clinics, pricing, tokens | Muy alto | Alto | M | B | ninguna | layout + cards admin | unit + a11y aria-live | P1 | **Sí** |
| T2 | Undo en acciones reversibles | Toast con acción "Deshacer" para ediciones (revierte con el mismo endpoint de update); NO para delete de clínica (ya tiene confirmación por nombre) | Alto: confianza | Alto | M | M | T1 | acciones admin | unit + integration | P2 | **Sí** (solo updates) |
| T3 | Copy feedback | Botón copiar (tokens, IDs) con cambio de icono check 1.2s | Medio | Medio | B | B | F1 | tokens cards | unit | P2 | **Sí** |

### 4.7 Interacción avanzada

| # | Mejora | Descripción | Valor operativo | Valor visual | Dif. | Riesgo | Dependencias | Superficie | Tests | Prio | ¿Sí? |
|---|---|---|---|---|---|---|---|---|---|---|
| A1 | Command palette Ctrl+K | Navegación rápida a módulos + búsqueda de informes por paciente; build propio sobre Radix Dialog (sin `cmdk` nuevo) o autorizar `cmdk` (~10KB) | Alto para usuarios frecuentes | Muy alto | M | M | N3, T1 | nuevo componente + layout | unit keyboard + E2E | P2 | **Sí** |
| A2 | Saved views/filters | Persistir combinaciones de filtros de informes en `localStorage` (sin backend; nombres definidos por el usuario, sin datos clínicos en la key) | Alto | Medio | M | B | I3 | informes | unit storage + E2E | P2 | **Sí** |
| A3 | Notification center mejorado | El bell existente gana: agrupación por tipo, "marcar todo" ya existe; agregar deep link por entidad ya soportado en `buildNotificationDestination` | Medio | Medio | B | B | E1 | bell | unit | P3 | **Sí** (menor) |
| A4 | Row preview / context menu | Hover-preview de informe o menú contextual | Bajo | Medio | M | M | I1 | informes | E2E | P3 | **No** — duplica el detail pane ya visible en master-detail |

### 4.8 Inteligencia (solo propuesta)

| # | Mejora | Descripción | Valor | Riesgo | ¿Sí? |
|---|---|---|---|---|---|
| AI1 | Resumen operativo diario | Texto generado server-side ("3 informes >5 días, 2 visitas hoy") — primera versión puede ser **reglas puras sin LLM** | Alto | Bajo (sin LLM) | **Sí** como reglas; LLM después |
| AI2 | Búsqueda en lenguaje natural | Parsear "informes pendientes de la semana pasada" a filtros | Medio | Alto (backend + costos + privacidad de datos clínicos hacia un proveedor) | **No por ahora** |
| AI3 | Priorización asistida | Score de urgencia por aging+tipo, visible como orden por defecto | Alto | Medio | **Sí** como heurística determinística (sin ML) |
| AI4 | Detección de inconsistencias | Alertar informes sin archivo en estado "ready", tokens vencidos sin revocar | Alto | Bajo | **Sí** — son queries, no IA |

---

## 5. Matriz de impacto

| Mejora | Impacto visual | Impacto operativo | Riesgo | Esfuerzo | ROI | PR | Fase |
|---|---|---|---|---|---|---|---|
| E1 Admin URL sync | 2 | 9 | 2 | 2 | ★★★★★ | PR-0 | 0 |
| E2 studyType en filtros | 3 | 8 | 1 | 1 | ★★★★★ | PR-0 | 0 |
| E3 Selección robusta | 4 | 8 | 2 | 2 | ★★★★★ | PR-0 | 0 |
| E4 E2E deep links | 1 | 8 | 1 | 2 | ★★★★★ | PR-0 | 0 |
| E5 Borrar AdminSectionTabs | 1 | 4 | 2 | 1 | ★★★★ | PR-0 | 0 |
| F1 Motion tokens | 7 | 4 | 2 | 2 | ★★★★★ | PR-1 | 1 |
| F2 Press states | 6 | 3 | 1 | 1 | ★★★★ | PR-1 | 1 |
| F3 Tooltips | 6 | 5 | 2 | 2 | ★★★★ | PR-1 | 1 |
| N1 Transición hub↔workspace | 9 | 4 | 3 | 3 | ★★★★★ | PR-2 | 1 |
| N4 Indicador navegación | 7 | 8 | 2 | 2 | ★★★★★ | PR-2 | 1 |
| N2 View Transitions morph | 9 | 3 | 5 | 5 | ★★★ | PR-2b | 2 |
| N3 Links reales | 4 | 8 | 5 | 5 | ★★★★ | PR-2/3 | 1-2 |
| I1 Selección instantánea | 7 | 9 | 5 | 5 | ★★★★★ | PR-3 | 2 |
| I2 Search highlight | 7 | 7 | 1 | 2 | ★★★★★ | PR-3 | 2 |
| I3 Filtros client-side | 5 | 8 | 3 | 3 | ★★★★★ | PR-3 | 2 |
| I5 Cards mobile informes | 8 | 9 | 3 | 4 | ★★★★★ | PR-6 | 3 |
| I6 Aging badges | 7 | 8 | 1 | 2 | ★★★★★ | PR-3/7 | 2 |
| T1 Toasts | 7 | 8 | 2 | 3 | ★★★★★ | PR-9* | 2 |
| T2 Undo | 6 | 7 | 4 | 4 | ★★★★ | PR-9 | 3 |
| D1 Bento clínica | 9 | 7 | 4 | 5 | ★★★★ | PR-4 | 3 |
| D3 Admin quick actions | 5 | 7 | 2 | 2 | ★★★★ | PR-5 | 3 |
| D4 Drawer unificado | 5 | 5 | 3 | 4 | ★★★ | PR-5 | 3 |
| V1 Sparklines | 8 | 6 | 2 | 3 | ★★★★★ | PR-7 | 3 |
| V2 Aging buckets | 7 | 8 | 2 | 3 | ★★★★★ | PR-7 | 3 |
| A1 Command palette | 8 | 7 | 4 | 5 | ★★★★ | PR-8 | 4 |
| A2 Saved views | 5 | 7 | 3 | 4 | ★★★★ | PR-8 | 4 |
| AI1/AI3/AI4 reglas | 6 | 8 | 3 | 5 | ★★★★ | PR-10 | 5 |
| V3 echarts auditoría | 7 | 4 | 5 | 5 | ★★ | opcional | 5 |
| D5 Bulk actions | 5 | 5 | 6 | 7 | ★★ | descartado | — |

\* T1 (toasts) conviene adelantarlo: es dependencia de PR-3/5/9. Ver plan de ejecución (§11).

---

## 6. Roadmap por PRs

> Cada PR: rama desde `main` actualizado, cambio mínimo, validación `pnpm --dir frontend lint && typecheck && build` + `pnpm validate:local`. Git add/commit/push/PR los ejecuta Nico manualmente.

### PR-0 — Estabilidad funcional previa (BLOQUEANTE)

**Alcance:**
- Portar a `AdminDashboardWorkspaceController.tsx` la sincronización `useSearchParams`→`activeModule` de #922 (con whitelist `VALID_ADMIN_MODULES` ya existente).
- `informes/page.tsx`: preservar `studyType` en el form del drawer (hidden input o campo visible); chips de `StickyFilterBar` removibles individualmente (href que quita solo ese param).
- Eliminar fallback silencioso `?? reports[0]`: si `reportId` no está en la página, mostrar empty-detail con aviso "Informe no visible en esta página" + link limpiar.
- Verificar en runtime `/dashboard?module=operaciones` y selección sucesiva de informes; corregir re-scroll de hash repetido si se confirma.
- Borrar `AdminSectionTabs.tsx` y simplificar el branch hash de `PublicRouteControl.tsx:71-80` si ya no hay listeners de hashchange.

**Criterios de aceptación:**
- Back del navegador desde `/dashboard/admin?module=admin-clinics` vuelve al hub admin.
- Filtrar informes con `studyType` activo lo conserva.
- `goto /dashboard?module=operaciones` muestra workspace operaciones con "Volver a módulos".
- Seleccionar 3 informes distintos consecutivos actualiza detalle las 3 veces.

**Tests:** unit de contrato (admin sync, studyType), E2E nuevos: deep link clinic/admin, back/forward admin, selección sucesiva, filtros con studyType.

### PR-1 — Interaction foundation

**Alcance:** motion tokens CSS (`--motion-fast/base/slow`, `--ease-out-soft`), migración de duraciones hardcodeadas en `globals.css` y componentes dashboard; estados `active:` en cards y botones; `ui/tooltip.tsx` (Radix instalado) reemplazando `title=` en sidebar; verificación `prefers-reduced-motion` extendida a tokens.
**Criterios:** cero cambios de layout; toda transición usa tokens; tooltips accesibles (focus + hover); reduced-motion anula todo.
**Tests:** unit de contrato CSS (tokens presentes, sin `duration-[0-9]+ms` hardcodeado en dashboard), a11y tooltip, E2E reduced-motion smoke.

### PR-2 — Workspace transitions

**Alcance:** animación enter (fade+slide 180ms) / exit en `DashboardModuleWorkspace` y hub; indicador de navegación pendiente (N4) en cards y "Volver"; `data-state` para testear; View Transitions API como enhancement detrás de feature-check (`if (document.startViewTransition)`), fallback CSS.
**Criterios:** hub→workspace percibido fluido; sin layout shift; reduced-motion = sin animación; E2E existentes sin cambios de selectores.
**Tests:** E2E animación presente/ausente según media query, contrato data-state, no-global-scroll intacto.

### PR-3 — Reports master-detail premium

**Alcance:** split del render de lista/detalle a client component con selección instantánea derivada de URL (I1); search highlight `<mark>` (I2); submit de filtros client-side con `router.replace` (I3); aging badge por informe (I6); navegación teclado básica ↑/↓/Enter (I4); migración de "Seleccionar" a links reales (N3 parcial).
**Criterios:** selección <100ms percibida; URL sigue siendo fuente de verdad (refresh restaura todo); highlight visible; teclado completo.
**Tests:** unit (highlight, aging calc, keyboard handlers), E2E (selección instantánea, deep link reportId, filtros sin full reload, mobile viewport), a11y (aria-current, focus).

### PR-4 — Dashboard clinic command center

**Alcance:** bento del `ClinicCommandCenter`: KPI hero pendientes con aging buckets (V2), informes recientes con aging badge y link directo al detalle (`/dashboard/informes?reportId=`), visitas del día destacadas, estado operativo del día en una línea.
**Criterios:** sin scroll global; datos 100% reales existentes (`getDashboardStats`, `getReports`, `getLogisticsFieldVisits`); errores parciales siguen aislados por sección.
**Tests:** unit composición, E2E hub→operaciones→informe específico, empty states.

### PR-5 — Admin command center premium

**Alcance:** quick actions de navegación en `AdminCommandCenter` (D3); extraer `ui/drawer.tsx` desde el patrón `ClinicEditDrawer` y migrar `FilterDrawer` (D4); consistencia de tablas admin (mismos chips/estados que informes).
**Criterios:** cero endpoints nuevos; drawers con mismo comportamiento a11y (Escape, focus trap, scroll lock — Radix lo da gratis); flujo admin auditado de punta a punta.
**Tests:** E2E admin (quick actions, drawer clinics), a11y drawer, unit contrato.

### PR-6 — Mobile operational polish

**Alcance:** cards apiladas en informes <768px (I5); revisar bottom action bar (ya existe `StickyActionBar` fixed-bottom mobile); tap targets ≥44px auditados; bottom sheet para FilterDrawer en mobile (mismo componente, posición bottom en <640px); dock/acceso pulgar para "Volver a módulos".
**Criterios:** cero tablas con scroll-x en mobile en informes; Lighthouse mobile sin regresión; E2E en viewport 390×844.
**Tests:** E2E mobile viewport (informes cards, filtros bottom sheet, volver), tap target audit test.

### PR-7 — Data visualization

**Alcance:** sparklines SVG propias en StatsCards (V1); aging buckets/SLA bar en command centers (V2); distribución de estados como barra apilada en informes; activity feed admin desde auditoría existente (lista, no chart).
**Decisión echarts:** si tras V1/V2 no hay necesidad de charts complejos, **desinstalar echarts+echarts-for-react+gsap** en este PR (autorización explícita de Nico para tocar deps).
**Criterios:** todo SVG/CSS, sin dependencia nueva, bundle sin crecimiento medible.
**Tests:** unit render sparkline/buckets con datos límite (0, 1, N), visual smoke.

### PR-8 — Command palette y saved views

**Alcance:** Ctrl+K con navegación a módulos clinic/admin (scoped por sesión activa — **nunca** mezclar destinos admin en sesión clínica) y búsqueda de informes; saved filters en `localStorage` (A2) con nombres sanitizados.
**Criterios:** palette respeta frontera clínica/admin; teclado completo; sin fetch hasta query ≥2 chars; localStorage sin datos clínicos (solo params de filtro).
**Tests:** unit (scoping por superficie, storage), E2E keyboard, a11y dialog.

### PR-9 — Premium feedback system

**Alcance:** `ui/toast.tsx` (Radix toast instalado) + provider en layout dashboard; migrar success/error inline de admin clinics/pricing/tokens a toasts; undo en updates (T2); error recovery con retry en toasts de error; copy feedback (T3); revisar empty states con acción sugerida.
**Nota de orden:** si se prefiere, T1 (toasts base) puede adelantarse como PR-2.5 porque PR-3/5 lo aprovechan; el roadmap lo mantiene aquí para respetar el briefing, con T1 extraíble.
**Criterios:** toasts con `aria-live`, nunca contienen datos de paciente; undo solo en operaciones con update inverso real; errores siempre accionables.
**Tests:** unit toast queue, integration undo (mock API), a11y aria-live, E2E success/error flows.

### PR-10 — Optional intelligent operations (solo diseño + reglas)

**Alcance:** resumen operativo diario por reglas (AI1: "N informes >5 días, M visitas hoy"), priorización heurística determinística (AI3), detección de inconsistencias por queries (AI4: ready sin archivo, tokens vencidos). Sin LLM, sin dependencia nueva, sin backend nuevo si los datos ya llegan al frontend; si requiere endpoint de agregación, se documenta como propuesta backend separada (fuera de este roadmap).
**Criterios:** todo determinístico y testeable; cero datos clínicos hacia servicios externos.
**Tests:** unit de reglas con fixtures, E2E presencia del resumen.

---

## 7. Diseño recomendado final

**Clínica:** `/dashboard` abre el hub de 5 cards con datos vivos (badge pendientes, última actividad). Tocar "Centro de operaciones" desliza al bento: hero de pendientes con buckets de antigüedad, sparkline de 7 días, informes recientes clickeables que llevan directo al detalle, visitas del día. Todo en una pantalla, sin scroll global.

**Informes:** master-detail donde seleccionar es instantáneo, la búsqueda resalta el match, los filtros viven en un drawer (bottom sheet en mobile) que no recarga la página, cada fila muestra su antigüedad con color semántico, y la URL siempre refleja búsqueda+filtros+selección+página: cualquier URL pegada en otro navegador reproduce la vista exacta.

**Admin:** mismo lenguaje. Hub de 10 cards → workspaces con back/forward funcionando; el resumen ofrece quick actions a sesiones, fallos de login y salud; los editores comparten un único patrón de drawer Radix; auditoría con activity feed y filtros por chips.

**Mobile:** cards en vez de tablas, filtros como bottom sheet, acciones primarias en barra inferior fija dentro del alcance del pulgar, tap targets ≥44px.

**Motion:** tres duraciones, dos easings, un patrón de entrada (fade+slide 180ms). Se anima la orientación (entrar/salir de workspace, aparición de toast, progreso) y nunca los datos (números no hacen count-up, tablas no hacen stagger).

**Datos:** sparklines y buckets SVG propios, badges semánticos con los tokens `--chart-*` ya definidos, prioridad visual por antigüedad.

**Feedback:** toda acción muestra pending→resultado; éxitos como toast con undo cuando es reversible; errores con retry; copy con check.

---

## 8. No-alcance

- **No** rediseño total ni big-bang sin tests por PR.
- **No** animaciones masivas, stagger de listas, parallax, count-up de métricas, glassmorphism adicional.
- **No** dependencias pesadas nuevas sin autorización explícita (cmdk requiere autorización; framer-motion **descartado**: CSS + View Transitions cubren todo lo propuesto).
- **No** cambios backend como primera opción; AI2 (NL search) queda fuera.
- **No** reintroducir `AdminSectionTabs` como navegación (se elimina).
- **No** dashboard largo ni scroll global (los E2E de no-global-scroll son contrato).
- **No** romper rutas actuales: `/dashboard`, `/dashboard/admin`, `/dashboard/informes`, `/dashboard/logistica/*` y el contrato `?module=` se mantienen byte a byte.
- **No** tocar auth, cookies, middleware ni service worker en PRs visuales.
- **No** bulk actions admin (D5) en este ciclo.
- **No** cachear datos privados ni mover fetches a cliente con caché persistente (react-query queda sin adoptar salvo decisión explícita futura con `gcTime` controlado).

## 9. Testing strategy

**Por cada PR (base obligatoria):** `pnpm --dir frontend lint`, `typecheck`, `build`, `pnpm validate:local`.

| PR | Unit/native (`test/`) | E2E (`frontend/e2e/`) | A11y | Mobile | Reduced motion | Routing |
|---|---|---|---|---|---|---|
| 0 | contrato admin sync, studyType, no-fallback | deep links module=, back/forward admin, selección sucesiva, filtros | aria-current selección | — | — | **核心**: refresh restaura módulo |
| 1 | tokens CSS presentes, sin duraciones hardcodeadas | smoke | tooltip focus/hover | — | media query anula | — |
| 2 | data-state contrato | transición visible/ausente, no-global-scroll intacto | focus al entrar workspace | — | **sí** | back durante transición |
| 3 | highlight, aging, keyboard | selección instantánea, deep link reportId, filtros sin reload | aria-live detalle, focus lista | viewport 390px | sí | URL=estado tras cada acción |
| 4-5 | composición, quick actions | hub→workspace→entidad, drawer admin | drawer focus trap | — | sí | links cruzados módulo→informes |
| 6 | tap targets | suite mobile completa (cards, bottom sheet, volver) | touch a11y | **核心** | sí | — |
| 7 | sparkline/buckets edge cases (0,1,N) | visual smoke | aria-hidden en decorativos | sí | sí (sin animación de charts) | — |
| 8 | scoping palette por sesión, storage | Ctrl+K keyboard E2E | dialog a11y | — | — | navegación palette respeta frontera admin/clinic |
| 9 | toast queue, undo revert | success/error/retry flows | aria-live toasts | toast position mobile | sí | — |
| 10 | reglas con fixtures | presencia resumen | — | — | — | — |

**Seguridad transversal (cada PR):** ningún test nuevo imprime tokens/cookies/hashes; E2E usan cookies sintéticas como `dashboard-card-navigation-shell.spec.ts`; verificar que nada nuevo introduce `cache` distinto de `no-store` en rutas privadas; palette/toasts/saved-views sin datos de pacientes persistidos.

**Visual smoke:** ya existe `frontend/e2e/visual-smoke.spec.ts` — extenderlo con capturas de hub, workspace, informes desktop/mobile como referencia por PR (factible, bajo costo).

## 10. Criterios de aceptación globales

"VETNEB alcanzó frontend superpremium operativo" cuando **todo** esto sea cierto:

1. ☐ Toda URL del dashboard es restaurable: refresh y compartir reproducen módulo, filtros, selección y página exactos (clínica **y** admin).
2. ☐ Back/forward del navegador nunca deja la UI en estado inconsistente con la URL.
3. ☐ Ninguna acción del usuario queda sin feedback en <100ms (optimista, skeleton o indicador de navegación).
4. ☐ Toda acción de escritura muestra pending → success/error real del backend, con retry en errores y undo donde es reversible.
5. ☐ Seleccionar un informe es percibido instantáneo; buscar resalta los matches; filtrar no recarga la página.
6. ☐ En mobile no existe ninguna tabla con scroll horizontal en flujos operativos; filtros y acciones primarias alcanzables con el pulgar.
7. ☐ Tres duraciones y dos easings gobiernan todo el motion; `prefers-reduced-motion` lo anula completo; cero animación en datos.
8. ☐ Las métricas muestran tendencia y antigüedad, no solo valores absolutos.
9. ☐ Usuarios de teclado operan informes completos sin mouse; axe/a11y tests verdes.
10. ☐ Cero mezcla de superficies: palette, toasts y deep links respetan la frontera clínica/admin/particular; cero datos clínicos en localStorage/toasts persistentes/logs.
11. ☐ Suite completa verde: unit + E2E (incluidos no-global-scroll, deep links, mobile, reduced-motion) + build + typecheck.
12. ☐ Bundle first-load del dashboard sin crecimiento >5% respecto a la línea base medida antes de PR-1.

## 11. Plan de ejecución recomendado

Orden exacto, un PR mergeado antes de empezar el siguiente:

1. **PR-0** estabilidad (admin sync, filtros, selección, deep links E2E, limpieza AdminSectionTabs) — *empezar ya*.
2. **PR-1** foundation (motion tokens, press, tooltips) + **medir bundle baseline**.
3. **PR-2** workspace transitions + indicador de navegación.
4. **PR-2.5 (recomendado)** toasts base (T1 extraído de PR-9) — desbloquea feedback en todo lo siguiente.
5. **PR-3** informes master-detail premium.
6. **PR-5** admin command center (antes que clínica: el drawer unificado D4 beneficia más superficies).
7. **PR-4** clinic command center bento.
8. **PR-6** mobile polish.
9. **PR-7** data viz + decisión final echarts/gsap (desinstalar si no se adoptaron).
10. **PR-8** command palette + saved views.
11. **PR-9** resto del feedback system (undo, retry, copy).
12. **PR-10** operaciones inteligentes por reglas.

Validación staging tras cada merge: `/dashboard`, `/dashboard/admin`, `/dashboard/informes` con sesión real, + `/health` backend.

## 12. Riesgos y mitigaciones

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| Regresión de rutas/`module=` | Media | PR-0 fija E2E de deep links como contrato antes de tocar nada visual; whitelist server-side se mantiene única fuente |
| Hydration mismatch (animaciones según estado cliente) | Media | Animar solo con CSS y `data-state` post-mount; nunca condicionar markup SSR a `window`; View Transitions solo como enhancement |
| CSS global (`globals.css` ~1100 líneas) con efectos colaterales | Media | Tokens nuevos aditivos; migración de duraciones por grep dirigido; visual smoke E2E antes/después |
| Performance mobile degradada | Baja-media | Solo animar `opacity`/`transform`; cero `box-shadow` animado en listas; presupuesto: 0 dependencias de animación; medir con Lighthouse CI manual por PR |
| Accesibilidad rota por nuevos overlays | Media | Radix (dialog/toast/tooltip ya instalados) da focus trap/aria gratis; tests a11y por PR |
| Tests frágiles por string-matching | Alta | Al tocar archivos con tests `source.includes(...)`, actualizar el test en el mismo PR hacia asserts de comportamiento donde sea posible |
| Sobreanimación | Media | Principio 2 + lista explícita de "qué NO animar" (datos, tablas, badges); revisión con reduced-motion en cada PR |
| Scope creep | Alta | Cada PR con no-alcance escrito; bulk actions y NL search ya descartados; anti-deriva de skill briefing |
| E2E sin backend real (cookies sintéticas) ocultan estados reales | Media | Mantener validación manual staging post-merge como en §11 |

## 13. Conclusión senior

**Lo de más valor** no es lo más vistoso: es PR-0 (la asimetría del admin controller es un bug confirmado por código que rompe back/forward) seguido de PR-1+PR-2+toasts. Con ~4 PRs pequeños el producto pasa de "funcional" a "se siente cuidado", sin una sola dependencia nueva, porque las librerías necesarias (Radix toast/tooltip/dialog) **ya están instaladas y sin usar**.

**Lo que no conviene:** framer-motion/gsap para animar (CSS alcanza y gsap debería desinstalarse), echarts para 4 sparklines (SVG propio), bulk actions sin volumen de datos que lo justifique, NL search con datos clínicos hacia terceros, y cualquier morph espectacular que retrase el cierre de bugs reales.

**Empezar inmediatamente con PR-0.** Es chico (≈4 archivos productivos + tests), des-riesga todo lo demás y convierte las regresiones reportadas en contratos E2E permanentes.

**Resultado visible esperado:** tras PR-0–PR-3, un operador de clínica nota que el back del navegador "simplemente funciona", que seleccionar y filtrar informes es instantáneo y resaltado, que cada acción confirma su estado, y que el dashboard se mueve con una fluidez discreta y consistente — la definición operativa de premium para un portal clínico.

---

### Apéndice A — Inventario de evidencia inspeccionada

- `frontend/src/app/dashboard/page.tsx`, `admin/page.tsx`, `informes/page.tsx`
- `frontend/src/app/dashboard/ClinicCommandCenter.tsx`, `ClinicInformesWorkspaceSummary.tsx`
- `frontend/src/app/dashboard/admin/AdminCommandCenter.tsx`, `AdminDashboardWorkspaceController.tsx`, `AdminSectionTabs.tsx` (muerto), `ClinicEditDrawer.tsx`, `AdminClinicsManagementCard.tsx`
- `frontend/src/components/dashboard/`: `DashboardModuleHub`, `DashboardModuleWorkspace`, `DashboardShellRouter`, `DashboardSidebarFrame`, `PrivateDashboardShell`, `ClinicDashboardWorkspaceController`, `ClinicDashboardSidebar`, `MasterDetailWorkspace`, `FilterDrawer`, `StickyFilterBar`, `StickyActionBar`, `StudyTimeline`, `StatsCards`, `DashboardTopbar`, `DashboardNotificationsBell`
- `frontend/src/components/public/PublicRouteControl.tsx`
- `frontend/src/components/ui/` (7 primitivas), `frontend/src/app/globals.css`, `frontend/tailwind.config.ts`, `frontend/package.json`
- `frontend/e2e/dashboard-card-navigation-shell.spec.ts` (+ inventario de los 6 specs)
- `test/frontend-dashboard-*.test.ts` (24 archivos inventariados; diff de #922 sobre informes/shell)
- `git show efa295c` (#922) para delimitar regresiones ya corregidas vs. residuales

### Apéndice B — Hallazgos NO CONFIRMADOS (requieren verificación manual)

- Comportamiento runtime de `/dashboard?module=operaciones` (código correcto post-#922; falta evidencia E2E).
- Re-scroll de hash `#report-detail` en selecciones sucesivas de informes.
- Comportamiento real de `searchReportsPaginated` backend ante combinaciones query+status+studyType (backend fuera de alcance de esta auditoría).
