# Auditoría + Propuesta Técnica — Navegación Horizontal y Arquitectura de Información de Dashboards

> Portal VETNEB · Laboratorio patológico veterinario
> Rama: `audit/dashboard-navigation-information-architecture-redesign`
> Fase: **AUDITORÍA + PROPUESTA** (sin implementación de código productivo)
> Base: commit `d381657` · 2026-06-18
> Principio rector: **“A mayor información, mayor organización.”**

Este documento audita el estado actual de los dos dashboards (Administración y
Clínica), define el contrato visual y de navegación aprobado a partir de las
últimas referencias de Nico, y propone un plan de rediseño por PRs mínimos. No
modifica backend, ni rutas, ni componentes productivos: el único archivo de esta
fase es este Markdown.

---

## 1. Resumen ejecutivo

### 1.1 Qué se aprueba visualmente de las referencias

- **Navegación horizontal superior**, módulos uno al lado del otro, con estado
  activo claro (referencias 1–8).
- **Topbar institucional** sobria con identidad VETNEB, estado de sesión y
  acción de cierre.
- **Tabla/lista densa** con totales reales, paginación visible y acciones
  primarias por fila (referencias 2, 4, 6, 7, 8).
- **Detalle estable** en ruta/panel propio con tabs internas (Resumen,
  Información, Contactos, Usuarios, Informes, Tokens, Auditorías) — referencia 3
  y 5.
- **Responsive real** desktop/tablet/mobile (referencia 9) sin sidebar
  permanente.
- Paleta **navy/ink + acento teal**, base blanca/gris, sin gradientes
  ornamentales.

### 1.2 Qué queda prohibido

- **Sidebar vertical** como navegación principal (hoy existe; ver §1.4).
- **Nivel 0 como “hub” de cards gigantes** + hero (patrón “cockpit” actual).
- **Detalle inline** que se expande dentro de la fila y destruye la lista.
- **Detalle que solo existe si el registro está en la página actual**.
- **Page sizes de 1–8** como solución final.
- **Filtrado client-side sobre datasets grandes** (auditoría hoy carga todo).
- **Carga masiva / N+1** para poblar selects o seguimiento.
- Chips/badges grandes, colores informales, copy ornamental repetido.

### 1.3 Qué debe reemplazarse

| Hoy | Reemplazo objetivo |
|-----|--------------------|
| `DashboardSidebarFrame` (aside vertical `w-[4.5rem]`/`2xl:w-60`) | `DashboardHorizontalNav` (tablist horizontal compacto, ya existe seed en `AdminSectionTabs`) |
| `DashboardModuleHub` + `DashboardHubHero` (cockpit de tiles) | `DashboardKpiStrip` sobrio + acceso por nav horizontal |
| Detalle inline en `informes/page.tsx` | `DashboardStableDetailPane` (ruta/panel) sobre `MasterDetailWorkspace` |
| Edit Drawer como “detalle” de clínica | Panel/ruta de detalle con tabs (`DashboardDetailTabs`) |
| Page sizes 1/3/4/5/6/8 | 25/50/100 server-side con scroll de tabla acotado |
| `getAuditEntries` (todo + filtro client) | endpoint con filtros + paginación server-side |

### 1.4 Por qué el sidebar vertical queda descartado

El sidebar existe hoy y es la navegación principal de ambos dashboards:

- `frontend/src/components/dashboard/DashboardShellRouter.tsx:28-32` monta
  `AdminDashboardSidebar` o `ClinicDashboardSidebar` dentro de un shell
  `flex h-dvh overflow-hidden`.
- `frontend/src/components/dashboard/DashboardSidebarFrame.tsx:106-108` renderiza
  un `<aside>` `sticky h-dvh w-[4.5rem] 2xl:w-60`.

Problemas concretos para un laboratorio patológico:

1. **Roba ancho operativo**: hasta `2xl` (≥1536px) el sidebar va colapsado a
   iconos (`w-[4.5rem]`) y los labels quedan en `sr-only` — el operador navega a
   ciegas por iconos en laptops 1280/1366, justo el rango de trabajo real.
2. **Compite con la densidad**: una tabla de clínicas/informes/tokens necesita el
   ancho completo; el sidebar reduce el área útil sin aportar contexto operativo.
3. **No escala a profundidad**: el sidebar es plano (lista de módulos) y no
   expresa breadcrumb ni el contexto de un registro seleccionado.
4. **Las referencias aprobadas son explícitamente horizontales**: la barra de
   módulos vive en el topbar, no en un riel lateral.

La navegación horizontal libera el ancho, expresa el módulo activo en una sola
línea y deja todo el viewport para la tabla densa + detalle estable.

---

## 2. Principio rector — “A mayor información, mayor organización”

El principio no se cumple apilando bloques: se cumple **escalonando la
estructura por profundidad**. Cada nivel reduce ruido y agrega contexto.

| Nivel | Qué muestra | Cómo se organiza | Estado/contexto |
|-------|-------------|------------------|-----------------|
| **0 — Entrada** | KPIs mínimos, alertas, pendientes, accesos | `DashboardKpiStrip` sobrio; sin cards gigantes | Sin estado profundo |
| **1 — Módulo** | Tabla/lista densa, filtros, totales, paginación | `DashboardModuleShell` + `DashboardFilterBar` + `DashboardDenseTable` + `DashboardPaginationBar` | Filtros y página persistidos en URL |
| **2 — Registro** | Detalle estable del registro seleccionado | `DashboardStableDetailPane` (panel derecho/ruta) sobre `MasterDetailWorkspace` | Preserva filtros, página y selección |
| **3 — Detalle profundo** | Resumen / Trazabilidad / Documentos / Accesos / Acciones / Auditoría | `DashboardDetailTabs` (cada tab = una responsabilidad) | Breadcrumb contextual |
| **4 — Acción sensible** | Confirmación + motivo + registro auditable | `DashboardSensitiveActionBar` + `DashboardAuditTrail` | Vuelve al contexto exacto |

**Traducción operativa**: Entrar → elegir módulo → buscar/filtrar → seleccionar
registro → ver detalle organizado → ejecutar acción → **volver al mismo contexto
sin perder filtros ni página**. La preservación de estado es requisito, no
adorno.

**Responsive**: el mismo principio aplica a viewport. Desktop muestra tabla +
panel estable en paralelo; tablet colapsa el panel a una sección ordenada;
mobile separa lista y detalle en vistas secuenciales. Nunca se pierden acciones
ni se solapa la paginación.

---

## 3. Arquitectura visual objetivo

```
┌───────────────────────────────────────────────────────────────────────┐
│ DashboardTopbar   VETNEB · [identidad]            [tema] [campana] [salir] │  ← fija
├───────────────────────────────────────────────────────────────────────┤
│ DashboardHorizontalNav   Resumen · Clínicas · Informes · Tokens · …      │  ← fija, activo claro
│ (Breadcrumb contextual cuando se entra a un registro)                    │
├───────────────────────────────────────────────────────────────────────┤
│ DashboardModuleShell                                                     │
│  ┌ DashboardKpiStrip (solo en Resumen / cabecera de módulo si aporta) ─┐ │
│  ├ DashboardFilterBar  [buscar] [estado] [localidad] [fecha] [orden]  ─┤ │  ← fija
│  ├ DashboardDenseTable / DashboardStableDetailPane ───────────────────┤ │  ← ÚNICA zona con scroll acotado
│  │   master (tabla densa)        │  detalle estable + DashboardDetailTabs│ │
│  └ DashboardPaginationBar  [25|50|100]  1–25 de 4.982  ‹ 1/200 ›  ─────┘ │  ← fija
└───────────────────────────────────────────────────────────────────────┘
```

**Regla de scroll (clave técnica).** Hoy el contrato App Shell hace que `main`
NO sea scrollable (`dashboard-main { overflow-hidden }`,
`globals.css:217-224`), lo que obligó a page sizes de 1–8 y a detalle inline. El
rediseño mantiene topbar + nav + filtros + paginación **fijos**, pero da a la
**zona de tabla/detalle un contenedor propio acotado** (`min-h-0 overflow-y-auto`)
para soportar 25/50/100 filas densas sin romper el “page-level no-scroll”. Esto
reconcilia el contrato actual con la densidad requerida.

**Topbar**: institucional, fija, identidad VETNEB, estado de sesión, tema,
notificaciones y cierre (ya existe `DashboardTopbar`, se conserva y endurece).

**Navegación horizontal**: tablist roving-tabindex, `overflow-x-auto` en mobile,
estado activo `aria-current`, navega por `?module=` (contrato ya vigente).

---

## 4. Dashboard Administración

Navegación horizontal objetivo (referencias): **Resumen · Clínicas · Informes ·
Tokens · Auditoría · Usuarios · Sesiones**.

> **Gap de módulos**: la nav admin actual tiene 10 ítems
> (`AdminDashboardSidebar.tsx:19-71`): Administración, Subir informe, Estado,
> Clínicas, Tokens particulares, Precios, Sesiones, Roles clínica, Auditoría,
> Mantenimiento. La nav objetivo tiene 7. Propuesta de mapeo:
>
> | Objetivo | Origen actual |
> |----------|---------------|
> | Resumen | `admin` (resumen + alertas) |
> | Clínicas | `admin-clinics` |
> | Informes | **NUEVO** módulo transversal admin (hoy no existe; sólo `admin-report-upload`) |
> | Tokens | `admin-particular-tokens` |
> | Auditoría | `audit-log` |
> | Usuarios | `admin-users-roles` |
> | Sesiones | `admin-sessions` |
> | (secundarios) Estado, Precios, Mantenimiento, Subir informe | reubicar dentro de Resumen/Sesiones/acciones, o nav “Más” |

### 4.1 Resumen Admin

- **Estructura objetivo**: `DashboardKpiStrip` (estado global, pendientes,
  alertas, actividad reciente) + accesos directos a módulos. Responde “¿qué
  requiere atención ahora?”.
- **Navegación**: `?module=resumen` (alias del actual `admin`).
- **Datos visibles**: estado del sistema, alertas críticas (intentos fallidos),
  pendientes, actividad reciente, conteos de auditoría.
- **Acciones**: ir a cada módulo; abrir alerta.
- **Detalle**: no aplica (es entrada).
- **Filtros**: ninguno.
- **Responsive**: KPIs en grilla 1→2→4 columnas; sin cards gigantes.
- **Eliminar**: `DashboardHubHero` + tiles cockpit
  (`AdminDashboardWorkspaceController.tsx:197-308`); las dos tabs Resumen/Alertas
  pueden convivir en una sola lectura sobria.
- **Agregar**: KPI strip compacto y lista corta de “qué atender ahora”.

### 4.2 Clínicas (escala 5.000)

- **Estructura objetivo**: `DashboardFilterBar` + `DashboardDenseTable` (master)
  + `DashboardStableDetailPane` (detalle).
- **Navegación**: `?module=clinicas` y `?module=clinicas&clinicId=…`.
- **Datos visibles**: ID, nombre, localidad, estado, actividad, informes,
  tokens, responsable, fechas.
- **Acciones**: ver detalle, editar, alta (dialog), eliminar (acción sensible).
- **Detalle**: panel estable con tabs (Resumen, Información, Contacto,
  Responsable, Usuarios, Informes, Tokens, Acciones, Auditoría).
- **Filtros**: estado, localidad, tipo, actividad, responsable + búsqueda
  server-side.
- **Responsive**: desktop tabla+panel; tablet panel colapsable; mobile lista→detalle.
- **Eliminar**: page size 5 (`AdminClinicsManagementCard.tsx:53`); detalle como
  Drawer modal.
- **Agregar**: 25/50/100 server-side, ordenamiento por columnas, filtros
  enumerados, panel de detalle estable que preserva contexto.
- **Riesgo de datos**: el modelo actual (`AdminClinicManagementSummary`) **no
  expone estado ni localidad**; requiere extensión de backend (fuera de scope de
  esta fase — documentar como dependencia).

### 4.3 Informes Admin (transversal)

- **Estructura objetivo**: tabla densa transversal + detalle con metadata,
  trazabilidad, descarga y auditoría.
- **Navegación**: `?module=informes` y `?module=informes&reportId=…`.
- **Datos visibles**: ID, paciente, clínica, estudio, fecha, estado, archivo.
- **Acciones**: ver informe, descargar PDF, abrir trazabilidad.
- **Detalle**: `DashboardDetailTabs` (Resumen / Trazabilidad / Documentos /
  Auditoría).
- **Filtros**: ID, paciente, clínica, estudio, fecha, estado (persistentes en URL).
- **Responsive**: master+detalle / colapsable / secuencial.
- **Eliminar**: dependencia de detalle inline; “Subir informe” como módulo
  separado decorativo (`page.tsx:454-475`).
- **Agregar**: módulo admin de informes (hoy inexistente); reutilizar
  `searchReportsPaginated`/`getReportsPaginated` con scope admin.

### 4.4 Tokens Admin (sensible)

- **Estructura objetivo**: tabla densa sobria con token enmascarado + detalle
  con resumen/trazabilidad/accesos/acciones.
- **Navegación**: `?module=tokens` y `?module=tokens&tokenId=…`.
- **Datos visibles**: token `****last4`, clínica, paciente/tutor, informe
  vinculado, estado (activo/revocado/vencido), último acceso, fechas.
- **Acciones**: revocar (confirmación + auditable), eliminar (sensible), vincular
  informe.
- **Detalle**: tabs Resumen / Trazabilidad / Accesos / Acciones.
- **Filtros**: clínica, paciente, tutor, informe, estado, fecha (server-side).
- **Responsive**: igual patrón master/detalle.
- **Eliminar**: `limit:8, offset:0` fijo sin paginación
  (`AdminParticularTokensCard.tsx:430`); **N+1** de seguimiento
  (`:447-457`); **carga masiva** `while(offset<total)` de usuarios
  (`:515-543`).
- **Agregar**: paginación server-side real + búsqueda; seguimiento por demanda
  (al abrir detalle), no por fila.
- **Mantener (OK)**: enmascarado ya correcto — sólo `tokenLast4`
  (`:1480`, `:716`); token completo sólo en flujo de creación.

### 4.5 Auditoría (consola de investigación)

- **Estructura objetivo**: tabla densa con wrapping/clamping controlado + detalle
  de evento + paginación robusta.
- **Navegación**: `?module=auditoria` con filtros en URL (`event`, `actorType`,
  ya vigentes en `admin/page.tsx:298-304`).
- **Datos visibles**: evento, actor, tipo, objetivo, fecha, metadata sanitizada.
- **Acciones**: ver detalle de evento, exportar (proponer si no existe).
- **Detalle**: panel con metadata completa sanitizada (ya hay sanitización de
  claves sensibles en `admin/page.tsx:216-231`).
- **Filtros**: evento, actor, tipo, fecha, objetivo (server-side).
- **Responsive**: tabla con celdas clamp; paginación que no se solapa.
- **Eliminar**: **filtrado client-side sobre todo el dataset**
  (`getAuditEntries` sin params, `api.ts:1421-1439`; filtro en
  `admin/page.tsx:364-399`) + paginación client (`AdminAuditLogTable.tsx:42,52`).
- **Agregar**: filtros + paginación server-side (dependencia backend a documentar).

### 4.6 Usuarios

- **Estructura objetivo**: búsqueda server-side + tabla densa + detalle por tabs.
- **Navegación**: `?module=usuarios` (+ `userId` para detalle).
- **Datos visibles**: usuario, rol, estado, última actividad, clínica asociada.
- **Acciones**: cambio de rol (confirmación + auditable), credenciales.
- **Detalle**: tabs (Datos / Roles / Accesos / Auditoría).
- **Filtros**: tipo, rol, estado, búsqueda (parcialmente server-side hoy:
  `getAdminUsersRoles` soporta `userType/role/limit/offset`, `api.ts:1723-1751`).
- **Responsive**: master/detalle estándar.
- **Eliminar**: page size 5 (`AdminUsersRolesReadOnlyCard.tsx:34`).
- **Agregar**: búsqueda de texto server-side; 25/50/100.

### 4.7 Sesiones

- **Estructura objetivo**: vista densa (no cards) de sesiones activas + detalle.
- **Navegación**: `?module=sesiones`.
- **Datos visibles**: sesión, usuario, tipo, IP/dispositivo, última actividad,
  estado.
- **Acciones**: revocar (auditable, ya existe `revokeAdminSession`).
- **Detalle**: panel con metadata de sesión.
- **Filtros**: usuario, tipo, fecha (hoy `sessionType/status` server-side,
  `api.ts:1874-1902`).
- **Responsive**: tabla densa adaptativa.
- **Eliminar**: page size 3 (`AdminSessionsReadOnlyCard.tsx:36`).
- **Agregar**: 25/50/100; columna IP/dispositivo si el backend la expone
  (documentar dependencia).

---

## 5. Dashboard Clínica

Navegación horizontal objetivo: **Resumen · Informes · Tokens · Logística ·
Perfil**.

> **Gap de módulos**: la nav clínica actual
> (`ClinicDashboardSidebar.tsx:14-46`) usa `operaciones/informes/logistica/
> perfil/tokens` (+ Logística como ruta dedicada con subrutas visitas/rutas/
> métricas). Mapeo: `operaciones → Resumen`. El resto coincide.

### 5.1 Resumen Clínica

- **Estructura objetivo**: `DashboardKpiStrip` accionable: informes
  pendientes/listos, logística a atender, tokens activos/por vencer, accesos
  recientes, alertas.
- **Navegación**: `/dashboard` (`?module=resumen`).
- **Datos visibles**: KPIs operativos + listas cortas “qué atender”.
- **Acciones**: ir a módulo, abrir informe/visita.
- **Detalle**: no aplica.
- **Filtros**: ninguno.
- **Responsive**: KPIs 1→2→4 col.
- **Eliminar**: `DashboardHubHero` + tiles cockpit
  (`ClinicDashboardWorkspaceController.tsx:139-224`).
- **Agregar**: strip sobrio y accionable.

### 5.2 Informes Clínica (escala 1.000)

- **Estructura objetivo**: tabla/lista densa + detalle estable del informe.
- **Navegación**: `/dashboard/informes` y `/dashboard/informes?reportId=…`
  (filtros ya en URL: `query/status/studyType/page`).
- **Datos visibles**: ID, paciente, estudio, estado, fecha, archivo.
- **Acciones**: ver informe, descargar PDF, volver al contexto.
- **Detalle**: panel estable + trazabilidad (`StudyTimeline` ya existe).
- **Filtros**: paciente, estudio, estado, fecha, archivo (server-side ya:
  `searchReportsPaginated`/`getReportsPaginated`).
- **Responsive**: master/detalle / colapsable / secuencial.
- **Eliminar**: page size **6** (`informes/page.tsx:44`); **detalle inline** que
  se expande en la fila (`:508-621`) y que **muere al paginar**
  (`selectedReport` depende de `reports.find`, `:259-262`).
- **Agregar**: 25/50/100; `MasterDetailWorkspace` (ya existe) con detalle estable
  que sobrevive al cambio de página (detalle por `reportId` server-side, no
  por “está en la página”).

### 5.3 Tokens Clínica

- **Estructura objetivo**: tabla/lista densa con token enmascarado + detalle
  estable.
- **Navegación**: `?module=tokens` (+ `tokenId`).
- **Datos visibles**: token `****last4`, estado, informe vinculado,
  emisión/vencimiento, último acceso.
- **Acciones**: crear (flujo sobrio), revocar, ver trazabilidad.
- **Detalle**: tabs Resumen / Trazabilidad / Acciones.
- **Filtros**: estado, informe, fecha.
- **Responsive**: master/detalle.
- **Eliminar**: `TOKENS_PAGE_SIZE = 4` client sobre primeros 10 cargados
  (`ClinicParticularTokensCard.tsx:44,253,272`); N+1 de seguimiento (`:291`).
- **Agregar**: paginación server-side + seguimiento on-demand.

### 5.4 Logística

- **Estructura objetivo**: lista/tabla densa por estado + detalle organizado.
- **Navegación**: `?module=logistica` (hoy ruta dedicada con subrutas
  visitas/rutas/métricas).
- **Datos visibles**: estado (En tránsito / Pendiente / Listo para retiro /
  Demorado / Entregado), fechas, responsable, acciones.
- **Acciones**: avanzar estado, ver detalle.
- **Detalle**: panel con trazabilidad y responsable.
- **Filtros**: estado, fecha, responsable.
- **Responsive**: tabla densa adaptativa.
- **Eliminar**: cajas decorativas sin flujo operativo.
- **Agregar**: tablero denso por estado + detalle estable.

### 5.5 Perfil

- **Estructura objetivo**: panel sobrio administrativo.
- **Navegación**: `?module=perfil`.
- **Datos visibles**: datos de clínica, contacto, responsable técnico, estado,
  seguridad, accesos.
- **Acciones**: cambiar contraseña (ya existe `PasswordChangePanel`), editar
  perfil público (`ClinicPublicProfileCard`).
- **Detalle**: tabs Acceso / Perfil público (ya en `ModuleTabs`,
  `dashboard/page.tsx:150-164`).
- **Filtros**: ninguno.
- **Responsive**: una columna ordenada.
- **Eliminar**: textos repetitivos.
- **Agregar**: sección Seguridad/Accesos sobria.

---

## 6. Reglas de componentes propuestos

> Criterio: **reutilizar** primitivas existentes antes de crear nuevas. Varias ya
> existen y sólo necesitan promoción/composición.

| Componente | Estado | Base reutilizable | Responsabilidad |
|------------|--------|-------------------|-----------------|
| `DashboardTopbar` | **Existe** | `DashboardTopbar.tsx` | Topbar institucional fija; conservar |
| `DashboardHorizontalNav` | **Nuevo** (seed) | `AdminSectionTabs.tsx` (roving tabindex, Arrow/Home/End, `overflow-x-auto`) | Nav horizontal por `?module=`, activo `aria-current` |
| `DashboardModuleShell` | **Nuevo** (compone) | `DashboardModuleWorkspace.tsx` | Layout módulo: nav + kpi + filtros + body acotado + paginación |
| `DashboardKpiStrip` | **Nuevo** (reemplaza) | sustituye `DashboardHubHero`/`DashboardModuleHub` | KPIs sobrios nivel 0 |
| `DashboardFilterBar` | **Existe parcial** | `StickyFilterBar.tsx` / `FilterDrawer.tsx` | Filtros persistentes en URL |
| `DashboardDenseTable` | **Existe parcial** | `ui/table` + `dashboard-table-responsive` | Tabla densa, sort, clamp |
| `DashboardStableDetailPane` | **Existe** | `MasterDetailWorkspace.tsx` | Detalle estable que preserva contexto |
| `DashboardDetailTabs` | **Existe** | `ModuleTabs.tsx` | Tabs internas por responsabilidad |
| `DashboardPaginationBar` | **Existe parcial** | `CompactPager.tsx` + `usePagedRows.ts` | Paginación visible 25/50/100; **server-side** en datasets grandes |
| `DashboardSensitiveActionBar` | **Existe parcial** | `StickyActionBar.tsx` + `ModuleDialog.tsx` | Confirmación + motivo de acción sensible |
| `DashboardAuditTrail` | **Existe parcial** | `StudyTimeline.tsx` / `AdminAuditLogTable.tsx` | Trazabilidad/auditoría por registro |
| `DashboardEmptyState` | **Existe** | `EmptyState.tsx` | Estado vacío |
| `DashboardErrorState` | **Existe** | `ErrorState.tsx` | Estado error |
| `DashboardLoadingState` | **Existe** | `LoadingState.tsx` | Estado carga |

**A retirar** tras la migración: `DashboardSidebarFrame`,
`AdminDashboardSidebar`, `ClinicDashboardSidebar`, `DashboardModuleHub`,
`DashboardHubHero` (y sus tests/contratos asociados).

---

## 7. Responsive

`usePagedRows`/contrato no-scroll deben respetar todos los breakpoints. Page size
por defecto se adapta, pero el scroll de la tabla queda acotado al body.

| Dispositivo | Topbar | Nav horizontal | Tabla/detalle | Paginación |
|-------------|--------|----------------|---------------|------------|
| **Desktop 1920/1366** | fija | visible completa | tabla + panel estable en paralelo | fija inferior |
| **Laptop 1280** | fija | visible (sin colapso a iconos) | tabla + panel (panel angosto) | fija |
| **Tablet** | fija | visible, posible `overflow-x-auto` | tabla; panel colapsable ordenado | fija |
| **Mobile** | compacta | `overflow-x-auto` scrollable (nunca sidebar fijo) | lista → detalle secuencial | fija, sin solape |
| **Zoom 100/125/150/menor** | sin overflow horizontal | sin solape | scroll sólo en body de tabla | sin solape |

Invariantes en todos los casos: sin solapamiento, sin overflow horizontal, sin
pérdida de acciones, sin texto fuera de contenedor, sin paginación superpuesta,
sin sidebar robando ancho. Ya existen specs de zoom
(`dashboard-viewport-zoom-adaptability.spec.ts`) que deben actualizarse al nuevo
shell.

---

## 8. Plan de implementación por PRs

Secuencia mínima, sin PR gigante. Cada PR alinea sus tests de contrato en el
mismo PR (precedente #958).

| PR | Alcance | Riesgo |
|----|---------|--------|
| **PR-1** | Este documento (auditoría + contrato visual aprobado) | nulo |
| **PR-2** | `DashboardHorizontalNav` + `DashboardModuleShell`; reemplaza `DashboardShellRouter`/sidebar conservando `?module=`; alinea tests de shell/sidebar | alto (toca shell global) |
| **PR-3** | Admin Resumen (KPI strip) + Clínicas (tabla densa + detalle estable, 25/50/100) | medio |
| **PR-4** | Admin Tokens (paginación server-side, quitar N+1/carga masiva) | medio |
| **PR-5** | Admin Informes (módulo nuevo) + Auditoría (server-side) | alto (dep. backend) |
| **PR-6** | Admin Usuarios + Sesiones (25/50/100, búsqueda) | bajo |
| **PR-7** | Clínica Resumen (KPI strip) | bajo |
| **PR-8** | Clínica Informes (master/detalle estable, fin del inline) | medio |
| **PR-9** | Clínica Tokens + Logística | medio |
| **PR-10** | Responsive + fixtures de escala + E2E visual (5.000 clínicas / 1.000 informes / 10.000 tokens / zoom) | medio |
| **PR-11** | Limpieza de patrones viejos (sidebar, hub, hero) y sus tests | bajo |

> **Dependencias backend** (a tramitar por separado, fuera de esta fase): estado/
> localidad de clínicas, paginación+filtros server-side de auditoría, búsqueda de
> tokens, IP/dispositivo de sesiones. PR-2/3/4/6/8 pueden avanzar con el contrato
> de datos actual; PR-5 requiere backend.

---

## 9. Tests requeridos

- **Navegación horizontal**: nav por `?module=`, activo `aria-current`, roving
  tabindex (Arrow/Home/End), `overflow-x-auto` mobile.
- **Preservación de filtros**: abrir detalle y volver mantiene query/estado/página.
- **Detalle profundo**: tabs por responsabilidad; detalle sobrevive al cambio de
  página (por `id` server-side, no por “está en la página actual”).
- **Server-side pagination/search/sort**: clínicas, informes, tokens, auditoría,
  usuarios, sesiones.
- **Escala**: fixtures 5.000 clínicas, 1.000 informes/clínica, 10.000 tokens.
- **Zoom 100/125/150** y **mobile/tablet/desktop** sin overflow ni solape.
- **Acciones sensibles**: revocación/eliminación con confirmación + auditable.
- **Invariantes negativos**: no sidebar vertical, no overflow horizontal, no
  detalle inline gigante en listas masivas.
- **Contratos a actualizar (existentes)**:
  `frontend-admin-sidebar-module-navigation.test.ts`,
  `frontend-dashboard-hub-hero.test.ts`, `frontend-dashboard-shell.test.ts`,
  `admin-dashboard-launcher.test.ts`,
  `admin-dashboard-sections-contract.test.ts`, y e2e
  `dashboard-card-navigation-shell.spec.ts`,
  `dashboard-app-shell-visibility-contract.spec.ts`,
  `dashboard-single-viewport-app-shell.spec.ts`,
  `dashboard-viewport-zoom-adaptability.spec.ts`.

---

## 10. Riesgos

1. **Regresión de rutas**: el contrato `?module=` está pinneado por tests; se
   conserva el esquema para minimizar ruptura.
2. **Pérdida de filtros**: el detalle inline actual ata el estado a la fila;
   migrar a detalle por `id` debe preservar URL.
3. **Exceso de cambios visuales por PR**: el shell (PR-2) toca todo; aislarlo y
   no mezclar módulos.
4. **Mezcla backend/frontend**: auditoría/clínicas/tokens necesitan endpoints
   nuevos; no mezclar esas dependencias en PRs de UI.
5. **Cambios no autorizados**: no introducir dependencias nuevas; reutilizar
   primitivas existentes (§6).
6. **Performance**: eliminar N+1 (tokens) y carga masiva (`while(offset<total)`)
   es prerequisito de escala; no reintroducir filtrado client sobre datasets
   grandes.
7. **Contrato no-scroll**: el page-level no-scroll se conserva; el scroll se
   acota al body de la tabla. No volver a `overflow-y-auto` en `main`.
8. **Navegación hardening**: prohibido `next/link`/`<a>`; usar
   `PublicRouteControl` (memoria `project_frontend_navigation_hardening`).

---

## 11. Criterio de aceptación

El rediseño se aprueba sólo si:

- [ ] No hay sidebar vertical; la navegación principal es horizontal.
- [ ] Cada módulo conserva contexto (filtros + página + selección) al entrar y
      volver del detalle.
- [ ] A mayor profundidad hay mayor organización (KPIs → tabla → detalle estable
      → tabs → acción sensible auditable).
- [ ] No hay cards ornamentales (hub/hero retirados).
- [ ] No hay detalle inline gigante en listas masivas; el detalle es estable y
      sobrevive a la paginación.
- [ ] La UI soporta 5.000 clínicas y 1.000 informes/clínica con server-side
      pagination/search/sort y page sizes 25/50/100.
- [ ] Opera en desktop, tablet y mobile; zoom 100/125/150 no rompe la experiencia.
- [ ] Representa visualmente la responsabilidad de un laboratorio patológico:
      sobrio, clínico, institucional, denso y auditable.

---

### Anexo A — Evidencia de auditoría (archivo:línea)

| Hallazgo | Ubicación |
|----------|-----------|
| Sidebar vertical (shell) | `frontend/src/components/dashboard/DashboardShellRouter.tsx:20-37` |
| Sidebar `aside w-[4.5rem] 2xl:w-60` | `frontend/src/components/dashboard/DashboardSidebarFrame.tsx:106-151` |
| Nav admin 10 ítems | `frontend/src/components/dashboard/AdminDashboardSidebar.tsx:19-71` |
| Nav clínica 5 ítems | `frontend/src/components/dashboard/ClinicDashboardSidebar.tsx:14-46` |
| Nivel 0 = hub cards + hero (admin) | `frontend/src/app/dashboard/admin/AdminDashboardWorkspaceController.tsx:197-334` |
| Nivel 0 = hub cards + hero (clínica) | `frontend/src/components/dashboard/ClinicDashboardWorkspaceController.tsx:139-249` |
| Cockpit grid de tiles | `frontend/src/components/dashboard/DashboardModuleHub.tsx:38-140` |
| Contrato no-scroll (`main` overflow-hidden) | `frontend/src/app/globals.css:217-224` |
| Detalle inline informes + muere al paginar | `frontend/src/app/dashboard/informes/page.tsx:44,259-262,508-621` |
| Page sizes 1/3/4/5/6/8 | `informes:44` · `clinics:53` · `pricing:32` · `sessions:36` · `users-roles:34` · `failed-logins:35` · `audit:42` · `clinic-tokens:44` |
| Tokens admin limit 8 / offset 0 fijo | `frontend/src/app/dashboard/admin/AdminParticularTokensCard.tsx:430` |
| N+1 seguimiento por token | `frontend/src/app/dashboard/admin/AdminParticularTokensCard.tsx:447-457` |
| Carga masiva `while(offset<total)` usuarios | `frontend/src/app/dashboard/admin/AdminParticularTokensCard.tsx:515-543` |
| Auditoría sin paginación server-side | `frontend/src/lib/api.ts:1421-1439` + `frontend/src/app/dashboard/admin/page.tsx:364-399` |
| Enmascarado de tokens correcto (last4) | `frontend/src/app/dashboard/admin/AdminParticularTokensCard.tsx:716,1480` |
| Server-side existente (clínicas/usuarios/sesiones/tokens) | `frontend/src/lib/api.ts:1768-1796,1723-1751,1874-1902,756-784` |
| `MasterDetailWorkspace` (detalle estable, subutilizado) | `frontend/src/components/dashboard/MasterDetailWorkspace.tsx:15-60` |
| Seed nav horizontal (tablist accesible) | `frontend/src/app/dashboard/admin/AdminSectionTabs.tsx:116-175` |
| Contrato `?module=` pinneado por test | `test/frontend-admin-sidebar-module-navigation.test.ts:20-104` |
